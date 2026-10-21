import { z } from "zod";
import { id, token, hash, fail, wholesale } from "./security.mjs";
import { enqueue } from "./mail.mjs";
export const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.email().max(254),
  phone: z.string().regex(/^\+?[0-9 ()-]{7,25}$/),
  address: z.string().trim().min(4).max(1000),
  zoneId: z.string().max(80),
  note: z.string().max(1000).default(""),
  channel: z.enum(["paystack", "whatsapp"]),
  coupon: z.string().max(60).default(""),
  ageConfirmed: z.literal(true),
  pricing: z.enum(["retail", "wholesale"]).default("retail"),
  idempotencyKey: z.string().min(16).max(120),
  items: z
    .array(
      z.object({
        id: z.string().max(100),
        qty: z.number().int().min(1).max(10000),
      }),
    )
    .min(1)
    .max(100),
});
export async function event(db, orderId, message, internal = 0) {
  await db.query(
    "INSERT INTO order_events(id,order_id,message,internal,created_at) VALUES(?,?,?,?,?)",
    [id(), orderId, message, internal, Date.now()],
  );
}
export function priceOf(p, user, pricing = "retail") {
  if (pricing === "wholesale") {
    if (!wholesale(user) || p.wholesale_price === null)
      fail(400, "Wholesale pricing is unavailable for one or more products.");
    return p.wholesale_price;
  }
  const now = Date.now();
  return p.sale_price !== null &&
    (!p.sale_start || now >= Number(p.sale_start)) &&
    (!p.sale_end || now <= Number(p.sale_end))
    ? Math.min(p.price, p.sale_price)
    : p.price;
}
export async function moveStock(db, pid, delta, reason, actor = "system") {
  const r = await db.query(
    "UPDATE products SET stock=stock+? WHERE id=? AND stock+?>=0",
    [delta, pid, delta],
  );
  if (!r.changes) fail(409, "Stock changed. Refresh your cart and try again.");
  await db.query(
    "INSERT INTO stock_movements(id,product_id,delta,reason,actor,created_at) VALUES(?,?,?,?,?,?)",
    [id(), pid, delta, reason, actor, Date.now()],
  );
  if (delta < 0) {
    const p = await db.one(
      "SELECT name,stock,low_stock FROM products WHERE id=?",
      [pid],
    );
    if (p.stock <= p.low_stock && p.stock - delta > p.low_stock) {
      await db.query(
        "INSERT INTO notifications(id,kind,message,created_at) VALUES(?,?,?,?)",
        [id(), "stock", `${p.name}: ${p.stock} units available`, Date.now()],
      );
      await enqueue(
        db,
        process.env.ADMIN_NOTIFICATION_EMAIL,
        "Low stock",
        `${p.name}: ${p.stock} units available`,
      );
    }
  }
}
export async function release(db, o, reason) {
  if (o.stock_state !== "reserved") return;
  for (const it of await db.all("SELECT * FROM order_items WHERE order_id=?", [
    o.id,
  ]))
    await moveStock(db, it.product_id, it.qty, reason);
  await db.query("UPDATE orders SET stock_state='released' WHERE id=?", [o.id]);
  if (o.coupon_id)
    await db.query(
      "UPDATE coupons SET uses=CASE WHEN uses>0 THEN uses-1 ELSE 0 END WHERE id=?",
      [o.coupon_id],
    );
}
export async function expire(db) {
  return db.tx(async () => {
    const due = await db.all(
      "SELECT * FROM orders WHERE stock_state='reserved' AND payment_status='unpaid' AND expires_at<?",
      [Date.now()],
    );
    for (const o of due) {
      await release(db, o, "Reservation expired");
      await db.query("UPDATE orders SET status='expired' WHERE id=?", [o.id]);
      await event(db, o.id, "Unpaid stock reservation expired.");
    }
    return due.length;
  });
}
export async function calculate(db, b, user, settings) {
  if (b.pricing === "wholesale" && !wholesale(user))
    fail(403, "An approved wholesale account is required.");
  const grouped = new Map();
  for (const it of b.items)
    grouped.set(it.id, (grouped.get(it.id) || 0) + it.qty);
  let subtotal = 0;
  const items = [];
  for (const [pid, qty] of grouped) {
    const p = await db.one(
      "SELECT * FROM products WHERE id=? AND visible=1 AND archived=0",
      [pid],
    );
    if (!p) fail(400, "An item is no longer available.");
    if (qty > p.stock) fail(409, `${p.name}: only ${p.stock} available.`);
    if (
      b.pricing === "wholesale" &&
      settings.wholesaleQuantityEnabled &&
      qty < p.wholesale_min
    )
      fail(
        400,
        `${p.name} requires at least ${p.wholesale_min} units for wholesale.`,
      );
    const unit = priceOf(p, user, b.pricing);
    items.push({ p, qty, unit });
    subtotal += unit * qty;
  }
  if (!Number.isSafeInteger(subtotal) || subtotal > 100000000000)
    fail(400, "Order amount exceeds the supported limit.");
  if (
    b.pricing === "wholesale" &&
    settings.wholesaleValueEnabled &&
    subtotal < settings.wholesaleMinimum
  )
    fail(400, "The wholesale minimum order value has not been reached.");
  let zone;
  if (b.zoneId === "pickup") {
    if (!settings.pickupEnabled || !settings.address)
      fail(400, "Store pickup is not configured.");
    zone = {
      lga: "Store pickup",
      neighbourhood: settings.address,
      fee: 0,
      minimum: 0,
    };
  } else
    zone = await db.one("SELECT * FROM zones WHERE id=? AND enabled=1", [
      b.zoneId,
    ]);
  if (!zone) fail(400, "Select an available delivery area.");
  if (subtotal < zone.minimum)
    fail(400, "The delivery-area minimum order has not been reached.");
  let discount = 0,
    coupon;
  if (b.coupon) {
    coupon = await db.one("SELECT * FROM coupons WHERE code=? AND enabled=1", [
      b.coupon.trim().toUpperCase(),
    ]);
    const now = Date.now();
    if (
      !coupon ||
      coupon.uses >= coupon.max_uses ||
      (coupon.starts_at && Number(coupon.starts_at) > now) ||
      (coupon.expires_at && Number(coupon.expires_at) < now) ||
      subtotal < coupon.minimum
    )
      fail(
        400,
        "This coupon is unavailable or its minimum spend has not been met.",
      );
    if (b.pricing === "wholesale" || items.some((it) => it.unit < it.p.price))
      fail(400, "Coupons cannot be combined with wholesale or sale pricing.");
    discount =
      coupon.type === "percent"
        ? Math.floor((subtotal * coupon.value) / 100)
        : Math.min(subtotal, coupon.value);
  }
  return {
    items,
    subtotal,
    discount,
    delivery: zone.fee,
    total: subtotal - discount + zone.fee,
    zone: [zone.lga, zone.neighbourhood].filter(Boolean).join(" · "),
    coupon,
  };
}
export async function createOrder(db, b, user, settings) {
  return db.tx(async () => {
    const old = await db.one("SELECT id FROM orders WHERE idempotency_key=?", [
      hash(b.idempotencyKey),
    ]);
    if (old)
      fail(
        409,
        "This checkout was already submitted. Open your order confirmation or start a fresh checkout.",
      );
    const c = await calculate(db, b, user, settings);
    const orderId = id(),
      secret = token(),
      ref =
        "LP-" +
        Date.now().toString(36).toUpperCase() +
        "-" +
        token().slice(0, 5).toUpperCase();
    await db.query(
      "INSERT INTO orders(id,ref,token_hash,user_id,name,email,phone,address,zone,note,channel,pricing,subtotal,discount,delivery,total,coupon_id,expires_at,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        orderId,
        ref,
        hash(secret),
        user?.id || null,
        b.name,
        b.email.toLowerCase(),
        b.phone,
        b.address,
        c.zone,
        b.note,
        b.channel,
        b.pricing,
        c.subtotal,
        c.discount,
        c.delivery,
        c.total,
        c.coupon?.id || null,
        Date.now() + 30 * 60 * 1000,
        hash(b.idempotencyKey),
        Date.now(),
      ],
    );
    for (const { p, qty, unit } of c.items) {
      await db.query(
        "INSERT INTO order_items(id,order_id,product_id,name,sku,size,qty,unit_price,image) VALUES(?,?,?,?,?,?,?,?,?)",
        [id(), orderId, p.id, p.name, p.sku, p.size, qty, unit, p.image],
      );
      await moveStock(db, p.id, -qty, `Order ${ref} reservation`);
    }
    if (c.coupon)
      await db.query("UPDATE coupons SET uses=uses+1 WHERE id=?", [
        c.coupon.id,
      ]);
    await event(
      db,
      orderId,
      b.channel === "whatsapp"
        ? "WhatsApp checkout initiated. Message delivery is not yet confirmed."
        : "Order created. Awaiting payment.",
    );
    await enqueue(
      db,
      b.email,
      `Order ${ref} received`,
      `Hello ${b.name},\nWe have received your order ${ref}. Total: NGN ${(c.total / 100).toLocaleString("en-NG")}. Payment has not yet been confirmed.\nYour stock reservation lasts 30 minutes.\nLiquor Plug`,
    );
    await enqueue(
      db,
      process.env.ADMIN_NOTIFICATION_EMAIL,
      `New ${b.channel} order ${ref}`,
      `${b.name} placed order ${ref}. View it securely in your admin dashboard.`,
    );
    const msg = `Hello Liquor Plug! Order ${ref}\n${c.items.map(({ p, qty, unit }) => `${qty} × ${p.name} (${p.size}): NGN ${((unit * qty) / 100).toLocaleString("en-NG")}`).join("\n")}\nSubtotal: NGN ${c.subtotal / 100}\nDiscount: NGN ${c.discount / 100}\nDelivery: NGN ${c.delivery / 100}\nTotal: NGN ${c.total / 100}\nName: ${b.name}\nPhone: ${b.phone}\nArea: ${c.zone}\nAddress: ${b.address}\nNote: ${b.note}\nPayment pending. Please confirm my order.`;
    return {
      ref,
      token: secret,
      total: c.total,
      whatsappUrl: `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`,
    };
  });
}
export async function acceptPayment(db, data) {
  return db.tx(async () => {
    const payment = await db.one("SELECT * FROM payments WHERE reference=?", [
      data.reference,
    ]);
    if (!payment) return false;
    const o = await db.one("SELECT * FROM orders WHERE id=?", [
      payment.order_id,
    ]);
    if (
      data.status !== "success" ||
      data.currency !== "NGN" ||
      Number(data.amount) !== o.total ||
      Number(data.amount) !== payment.amount
    )
      fail(400, "Payment amount or currency does not match the order.");
    if (payment.state === "success") return true;
    if (o.payment_status !== "unpaid") {
      await db.query(
        "UPDATE payments SET state='duplicate_review' WHERE reference=?",
        [payment.reference],
      );
      await event(
        db,
        o.id,
        "An additional successful payment needs review: " + payment.reference,
        1,
      );
      await enqueue(
        db,
        process.env.ADMIN_NOTIFICATION_EMAIL,
        "Additional payment needs review",
        `Order ${o.ref}; additional transaction ${payment.reference}. Check the provider and refund any duplicate collection.`,
      );
      return true;
    }
    let status = o.status,
      stockState = o.stock_state;
    if (stockState === "released") {
      const items = await db.all("SELECT * FROM order_items WHERE order_id=?", [
        o.id,
      ]);
      let available = status !== "cancelled";
      for (const it of items) {
        const p = await db.one("SELECT stock FROM products WHERE id=?", [
          it.product_id,
        ]);
        if (p.stock < it.qty) available = false;
      }
      if (available) {
        for (const it of items)
          await moveStock(db, it.product_id, -it.qty, `Late payment ${o.ref}`);
        stockState = "committed";
        status = "confirmed";
        if (o.coupon_id)
          await db.query("UPDATE coupons SET uses=uses+1 WHERE id=?", [
            o.coupon_id,
          ]);
      } else status = "payment_review";
    } else {
      stockState = "committed";
      status = status === "new" ? "confirmed" : status;
    }
    await db.query("UPDATE payments SET state='success' WHERE reference=?", [
      payment.reference,
    ]);
    await db.query(
      "UPDATE orders SET payment_status='paid',stock_state=?,status=? WHERE id=?",
      [stockState, status, o.id],
    );
    await event(
      db,
      o.id,
      status === "payment_review"
        ? "Payment received after stock release. Store review required."
        : "Payment confirmed.",
    );
    await enqueue(
      db,
      o.email,
      `Payment received · ${o.ref}`,
      `Your payment of NGN ${o.total / 100} for ${o.ref} has been confirmed.${status === "payment_review" ? " We will contact you to confirm availability." : ""}`,
    );
    return true;
  });
}
