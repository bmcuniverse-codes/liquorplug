import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import multer from "multer";
import ExcelJS from "exceljs";
import { createHmac } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import {
  id,
  token,
  hash,
  same,
  fail,
  staff,
  manager,
  wholesale,
  audit,
  throttle,
  csv,
  safeLink,
} from "./security.mjs";
import {
  checkoutSchema,
  createOrder,
  calculate,
  expire,
  acceptPayment,
  event,
  moveStock,
  release,
} from "./orders.mjs";
import { enqueue, drainMail } from "./mail.mjs";
import { defaults } from "./defaults.mjs";
import { renderPage } from "./seo.mjs";
const parse = (schema, value) => schema.parse(value);
const now = () => Date.now();
const money = z.number().int().min(0).max(100000000000);
const productSchema = z.object({
  name: z.string().trim().min(2).max(250),
  sku: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(180),
  description: z.string().max(5000).default(""),
  category: z.string().min(1).max(100),
  brand: z.string().max(100).default(""),
  size: z.string().max(80).default(""),
  price: money,
  wholesale_price: money.nullable().default(null),
  wholesale_min: z.number().int().min(1).max(10000).default(6),
  sale_price: money.nullable().default(null),
  sale_start: money.nullable().default(null),
  sale_end: money.nullable().default(null),
  low_stock: z.number().int().min(0).max(10000).default(5),
  image: z.string().refine(safeLink).default("/placeholder.svg"),
  gallery: z.array(z.string().refine(safeLink)).max(12).default([]),
  visible: z.number().int().min(0).max(1),
  featured: z.number().int().min(0).max(1),
});
const cleanUser = (u) =>
  u
    ? Object.fromEntries(
        Object.entries(u).filter(([k]) => k !== "password_hash"),
      )
    : null;
const hydrate = (p) => ({ ...p, gallery: JSON.parse(p.gallery || "[]") });
const publicProduct = (p, u) => {
  const x = hydrate(p);
  delete x.source_url;
  if (!wholesale(u)) {
    delete x.wholesale_price;
  }
  return x;
};
const staffRoles = ["owner", "manager", "staff"];
async function settings(db, state = "published") {
  return JSON.parse(
    (await db.one("SELECT data FROM content WHERE id=?", [state]))?.data ||
      JSON.stringify(defaults),
  );
}
async function update(db, table, data, key, value) {
  const fields = Object.keys(data);
  if (!fields.length) return;
  await db.query(
    `UPDATE ${table} SET ${fields.map((k) => `${k}=?`).join(",")} WHERE ${key}=?`,
    [...fields.map((k) => data[k]), value],
  );
}
async function insert(db, table, data) {
  const keys = Object.keys(data);
  await db.query(
    `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
    keys.map((k) => data[k]),
  );
}
async function paystack(path, body) {
  if (!process.env.PAYSTACK_SECRET_KEY)
    fail(
      503,
      "Online payments are not configured. You can order via WhatsApp.",
    );
  const response = await fetch("https://api.paystack.co" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const r = await response.json();
  if (!response.ok || !r.status)
    fail(502, "Payment provider is unavailable. Try again shortly.");
  return r.data;
}
export function createApp(db, { production = false } = {}) {
  const app = express();
  app.locals.db = db;
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "https:", "data:"],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json", limit: "200kb" }),
    async (req, res, next) => {
      try {
        const key = process.env.PAYSTACK_SECRET_KEY;
        if (
          !key ||
          !Buffer.isBuffer(req.body) ||
          !same(
            createHmac("sha512", key).update(req.body).digest("hex"),
            req.get("x-paystack-signature"),
          )
        )
          fail(401, "Invalid signature");
        const e = JSON.parse(req.body.toString());
        if (e.event === "charge.success") {
          const verified = await paystack(
            "/transaction/verify/" + encodeURIComponent(e.data.reference),
          );
          await acceptPayment(db, verified);
        }
        res.sendStatus(200);
      } catch (e) {
        next(e);
      }
    },
  );
  app.use(express.json({ limit: "1mb" }), cookieParser());
  app.use("/api", async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store");
      let csrf = req.cookies.lp_csrf;
      if (!csrf || csrf.length !== 64) {
        csrf = token();
        res.cookie("lp_csrf", csrf, {
          httpOnly: true,
          sameSite: "lax",
          secure: production,
          maxAge: 7 * 86400000,
          path: "/",
        });
      }
      req.csrf = csrf;
      if (req.cookies.lp_session) {
        const s = await db.one(
          "SELECT user_id,csrf FROM sessions WHERE token_hash=? AND expires_at>?",
          [hash(req.cookies.lp_session), now()],
        );
        if (s) {
          req.user = await db.one("SELECT * FROM users WHERE id=?", [
            s.user_id,
          ]);
          req.csrf = s.csrf;
        }
      }
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        !req.path.startsWith("/maintenance")
      ) {
        if (!same(req.get("x-csrf-token"), req.csrf))
          fail(403, "Your session changed. Refresh the page and try again.");
        const origin = req.get("origin");
        if (
          origin &&
          origin !==
            new URL(process.env.PUBLIC_URL || "http://localhost:3000").origin
        )
          fail(403, "Request origin is not allowed.");
      }
      if (req.path.startsWith("/admin")) {
        if (!staff(req.user)) fail(403, "Admin access required.");
        const read = req.method === "GET";
        const limited = ["/admin/orders", "/admin/notifications"];
        if (!manager(req.user) && !limited.some((x) => req.path.startsWith(x)))
          fail(403, "Manager permission required.");
        if (req.path.startsWith("/admin/team") && req.user.role !== "owner")
          fail(403, "Owner permission required.");
      }
      next();
    } catch (e) {
      next(e);
    }
  });
  const wrap = (fn) => async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (e) {
      next(e);
    }
  };
  app.get(
    "/api/bootstrap",
    wrap(async (req, res) =>
      res.json({
        settings: await settings(db),
        user: cleanUser(req.user),
        csrf: req.csrf,
        categories: await db.all(
          "SELECT * FROM taxonomy WHERE kind='categories' ORDER BY name",
        ),
        brands: await db.all(
          "SELECT * FROM taxonomy WHERE kind='brands' ORDER BY name",
        ),
        zones: await db.all("SELECT * FROM zones ORDER BY lga,neighbourhood"),
        paymentsConfigured: !!process.env.PAYSTACK_SECRET_KEY,
      }),
    ),
  );
  app.get(
    "/api/products",
    wrap(async (req, res) => {
      const {
        q = "",
        category = "",
        brand = "",
        size = "",
        sort = "featured",
        inStock = "",
        deals = "",
      } = req.query;
      const page = Math.max(1, Number(req.query.page) || 1),
        limit = Math.min(60, Math.max(1, Number(req.query.limit) || 20));
      let where = "archived=0 AND visible=1",
        args = [];
      for (const [col, val] of [
        ["category", category],
        ["brand", brand],
        ["size", size],
      ])
        if (val) {
          where += ` AND ${col}=?`;
          args.push(val);
        }
      if (q) {
        where += " AND (LOWER(name) LIKE ? OR LOWER(brand) LIKE ?)";
        args.push(
          "%" + String(q).toLowerCase() + "%",
          "%" + String(q).toLowerCase() + "%",
        );
      }
      if (inStock === "true") where += " AND stock>0";
      if (deals === "true") {
        where +=
          " AND sale_price IS NOT NULL AND (sale_start IS NULL OR sale_start<=?) AND (sale_end IS NULL OR sale_end>=?)";
        args.push(now(), now());
      }
      if (req.query.min) {
        where += " AND price>=?";
        args.push(Math.max(0, Number(req.query.min) || 0));
      }
      if (req.query.max) {
        where += " AND price<=?";
        args.push(Number(req.query.max) || 0);
      }
      const ordering =
        {
          featured: "featured DESC,name ASC",
          bestsellers:
            "(SELECT COALESCE(SUM(oi.qty),0) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.product_id=products.id AND o.payment_status IN ('paid','partially_refunded')) DESC,featured DESC,name ASC",
          price_asc: "price ASC",
          price_desc: "price DESC",
          name: "name ASC",
          newest: "created_at DESC",
        }[sort] || "featured DESC,name ASC";
      const total = Number(
        (
          await db.one(
            `SELECT COUNT(*) AS count FROM products WHERE ${where}`,
            args,
          )
        ).count,
      );
      const products = await db.all(
        `SELECT * FROM products WHERE ${where} ORDER BY ${ordering} LIMIT ? OFFSET ?`,
        [...args, limit, (page - 1) * limit],
      );
      res.json({
        products: products.map((p) => publicProduct(p, req.user)),
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    }),
  );
  app.get(
    "/api/products/:slug",
    wrap(async (req, res) => {
      const p = await db.one(
        "SELECT * FROM products WHERE slug=? AND visible=1 AND archived=0",
        [req.params.slug],
      );
      if (!p) fail(404, "Product not found");
      res.json(publicProduct(p, req.user));
    }),
  );
  app.post(
    "/api/auth/register",
    wrap(async (req, res) => {
      await throttle(db, "register:" + req.ip, 6, 3600000);
      const b = parse(
        z.object({
          name: z.string().trim().min(2).max(120),
          email: z.email().max(254),
          password: z.string().min(12).max(128),
        }),
        req.body,
      );
      const email = b.email.toLowerCase();
      if (await db.one("SELECT id FROM users WHERE email=?", [email]))
        fail(
          400,
          "Unable to register this email. Try signing in or resetting your password.",
        );
      await insert(db, "users", {
        id: id(),
        name: b.name,
        email,
        password_hash: await bcrypt.hash(b.password, 12),
        role: "customer",
        created_at: now(),
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/auth/login",
    wrap(async (req, res) => {
      const b = parse(
        z.object({ email: z.email(), password: z.string().max(128) }),
        req.body,
      );
      await throttle(db, "login:" + req.ip, 20, 900000);
      await throttle(db, "account:" + b.email.toLowerCase(), 10, 900000);
      const u = await db.one("SELECT * FROM users WHERE email=?", [
        b.email.toLowerCase(),
      ]);
      if (!u || !(await bcrypt.compare(b.password, u.password_hash)))
        fail(401, "Incorrect email or password.");
      const t = token(),
        csrf = token();
      await insert(db, "sessions", {
        token_hash: hash(t),
        user_id: u.id,
        csrf,
        expires_at: now() + 7 * 86400000,
      });
      res.cookie("lp_session", t, {
        httpOnly: true,
        sameSite: "lax",
        secure: production,
        maxAge: 7 * 86400000,
        path: "/",
      });
      res.json({ user: cleanUser(u), csrf });
    }),
  );
  app.post(
    "/api/auth/logout",
    wrap(async (req, res) => {
      if (req.cookies.lp_session)
        await db.query("DELETE FROM sessions WHERE token_hash=?", [
          hash(req.cookies.lp_session),
        ]);
      res.clearCookie("lp_session", { path: "/" });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/auth/forgot",
    wrap(async (req, res) => {
      const b = parse(z.object({ email: z.email() }), req.body);
      await throttle(db, "reset:" + req.ip, 5, 3600000);
      if (!process.env.SMTP_HOST)
        fail(503, "Password reset email is not configured. Contact the store.");
      const u = await db.one("SELECT id FROM users WHERE email=?", [
        b.email.toLowerCase(),
      ]);
      if (u) {
        const t = token();
        await insert(db, "password_resets", {
          token_hash: hash(t),
          user_id: u.id,
          expires_at: now() + 3600000,
        });
        await enqueue(
          db,
          b.email,
          "Reset your Liquor Plug password",
          `${process.env.PUBLIC_URL}/account?reset=${t}\nThis link expires in one hour.`,
        );
      }
      res.json({
        message:
          "If this address is registered, a reset email will arrive shortly.",
      });
    }),
  );
  app.post(
    "/api/auth/reset",
    wrap(async (req, res) => {
      const b = parse(
        z.object({
          token: z.string().length(64),
          password: z.string().min(12).max(128),
        }),
        req.body,
      );
      const pw = await bcrypt.hash(b.password, 12);
      await db.tx(async () => {
        const r = await db.one(
          "SELECT * FROM password_resets WHERE token_hash=? AND expires_at>?",
          [hash(b.token), now()],
        );
        if (!r) fail(400, "The reset link is invalid or expired.");
        await db.query("UPDATE users SET password_hash=? WHERE id=?", [
          pw,
          r.user_id,
        ]);
        await db.query("DELETE FROM sessions WHERE user_id=?", [r.user_id]);
        await db.query("DELETE FROM password_resets WHERE user_id=?", [
          r.user_id,
        ]);
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/wholesale/apply",
    wrap(async (req, res) => {
      if (!req.user) fail(401, "Sign in to apply.");
      const b = parse(
        z.object({
          business: z.string().trim().min(2).max(200),
          phone: z.string().min(7).max(30),
        }),
        req.body,
      );
      if (req.user.wholesale_status === "approved")
        fail(400, "Your account is already approved.");
      await update(
        db,
        "users",
        { ...b, wholesale_status: "pending" },
        "id",
        req.user.id,
      );
      await enqueue(
        db,
        process.env.ADMIN_NOTIFICATION_EMAIL,
        "Wholesale application",
        `${req.user.name} (${req.user.email}) applied for wholesale access.`,
      );
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/orders/quote",
    wrap(async (req, res) => {
      const b = parse(checkoutSchema, req.body);
      await expire(db);
      const s = await settings(db);
      const c = await db.tx(() => calculate(db, b, req.user, s));
      res.json({
        subtotal: c.subtotal,
        discount: c.discount,
        delivery: c.delivery,
        total: c.total,
        zone: c.zone,
      });
    }),
  );
  app.post(
    "/api/orders",
    wrap(async (req, res) => {
      await throttle(db, "checkout:" + req.ip, 20, 3600000);
      const b = parse(checkoutSchema, req.body);
      await expire(db);
      const s = await settings(db);
      if (b.channel === "paystack" && !process.env.PAYSTACK_SECRET_KEY)
        fail(
          503,
          "Online payments are not configured. Choose WhatsApp ordering.",
        );
      res.status(201).json(await createOrder(db, b, req.user, s));
    }),
  );
  async function permittedOrder(req) {
    const o = await db.one("SELECT * FROM orders WHERE ref=?", [
      req.params.ref,
    ]);
    if (
      !o ||
      !(
        staff(req.user) ||
        (o.user_id && o.user_id === req.user?.id) ||
        (req.get("x-order-token") &&
          same(hash(req.get("x-order-token")), o.token_hash))
      )
    )
      fail(404, "Order not found or access denied.");
    return o;
  }
  app.get(
    "/api/orders/:ref",
    wrap(async (req, res) => {
      await expire(db);
      const o = await permittedOrder(req);
      delete o.token_hash;
      delete o.idempotency_key;
      res.json({
        ...o,
        items: await db.all("SELECT * FROM order_items WHERE order_id=?", [
          o.id,
        ]),
        events: await db.all(
          "SELECT * FROM order_events WHERE order_id=? AND internal=0 ORDER BY created_at",
          [o.id],
        ),
      });
    }),
  );
  app.get(
    "/api/account/orders",
    wrap(async (req, res) => {
      if (!req.user) fail(401, "Sign in to view your orders");
      res.json(
        await db.all(
          "SELECT ref,total,status,payment_status,created_at FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 200",
          [req.user.id],
        ),
      );
    }),
  );
  app.post(
    "/api/orders/:ref/pay",
    wrap(async (req, res) => {
      const o = await permittedOrder(req);
      if (
        o.payment_status !== "unpaid" ||
        o.stock_state !== "reserved" ||
        Number(o.expires_at) < now()
      )
        fail(400, "This order cannot accept payment.");
      const pending = await db.tx(async () => {
        const previous = await db.one(
          "SELECT * FROM payments WHERE order_id=? AND state='pending' ORDER BY created_at DESC LIMIT 1",
          [o.id],
        );
        if (previous?.authorization_url) return previous;
        if (previous && now() - Number(previous.created_at) < 60000)
          fail(
            409,
            "Payment initialization is in progress. Wait a moment, then retry.",
          );
        const reference = o.ref + "-" + token().slice(0, 12);
        await insert(db, "payments", {
          reference,
          order_id: o.id,
          amount: o.total,
          created_at: now(),
        });
        return { reference };
      });
      if (pending.authorization_url)
        return res.json({ url: pending.authorization_url });
      const reference = pending.reference;
      let data;
      try {
        data = await paystack("/transaction/initialize", {
          email: o.email,
          amount: o.total,
          currency: "NGN",
          reference,
          callback_url: `${process.env.PUBLIC_URL}/track?ref=${o.ref}`,
          metadata: { order_ref: o.ref },
        });
      } catch (e) {
        await update(
          db,
          "payments",
          { state: "initialization_failed" },
          "reference",
          reference,
        );
        throw e;
      }
      await update(
        db,
        "payments",
        { authorization_url: data.authorization_url },
        "reference",
        reference,
      );
      res.json({ url: data.authorization_url });
    }),
  );
  app.post(
    "/api/orders/:ref/verify",
    wrap(async (req, res) => {
      const o = await permittedOrder(req);
      const payments = await db.all(
        "SELECT * FROM payments WHERE order_id=? ORDER BY created_at DESC",
        [o.id],
      );
      for (const p of payments) {
        const d = await paystack(
          "/transaction/verify/" + encodeURIComponent(p.reference),
        );
        if (d.status === "success") {
          await acceptPayment(db, d);
          break;
        }
      }
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/admin/summary",
    wrap(async (req, res) => {
      await expire(db);
      const from = Number(req.query.from) || 0,
        to = Number(req.query.to) || now();
      const orders = await db.all(
        "SELECT * FROM orders WHERE created_at>=? AND created_at<=?",
        [from, to],
      );
      const paid = orders.filter((o) =>
        ["paid", "partially_refunded", "refunded"].includes(o.payment_status),
      );
      const totals = paid.reduce(
        (r, o) => ({
          sales: r.sales + o.total,
          delivery: r.delivery + o.delivery,
          discounts: r.discounts + o.discount,
        }),
        { sales: 0, delivery: 0, discounts: 0 },
      );
      res.json({
        ...totals,
        orders: orders.length,
        paidOrders: paid.length,
        lowStock: await db.all(
          "SELECT id,name,stock,low_stock FROM products WHERE archived=0 AND stock<=low_stock ORDER BY stock,name LIMIT 50",
        ),
        pendingWholesale: Number(
          (
            await db.one(
              "SELECT COUNT(*) AS n FROM users WHERE wholesale_status='pending'",
            )
          ).n,
        ),
        revenueByChannel: ["whatsapp", "paystack"].map((channel) => ({
          channel,
          amount: paid
            .filter((o) => o.channel === channel)
            .reduce((a, o) => a + o.total, 0),
        })),
        revenueByPricing: ["retail", "wholesale"].map((pricing) => ({
          pricing,
          amount: paid
            .filter((o) => o.pricing === pricing)
            .reduce((a, o) => a + o.total, 0),
        })),
        refunds: Number(
          (
            await db.one(
              "SELECT COALESCE(SUM(amount),0) AS n FROM refunds WHERE status='completed' AND created_at>=? AND created_at<=?",
              [from, to],
            )
          ).n,
        ),
        products: await db.all(
          "SELECT oi.name,p.category,SUM(oi.qty) AS units,SUM(oi.qty*oi.unit_price) AS revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id WHERE o.payment_status IN ('paid','partially_refunded') AND o.created_at>=? AND o.created_at<=? GROUP BY oi.name,p.category ORDER BY revenue DESC LIMIT 30",
          [from, to],
        ),
      });
    }),
  );
  app.get(
    "/api/admin/products",
    wrap(async (req, res) =>
      res.json(
        (
          await db.all("SELECT * FROM products WHERE archived=0 ORDER BY name")
        ).map(hydrate),
      ),
    ),
  );
  app.post(
    "/api/admin/products",
    wrap(async (req, res) => {
      const b = parse(productSchema, req.body);
      await insert(db, "products", {
        ...b,
        id: id(),
        gallery: JSON.stringify(b.gallery),
        created_at: now(),
      });
      await audit(db, req.user, "product.create", b.name);
      res.json({ ok: true });
    }),
  );
  app.put(
    "/api/admin/products/:id",
    wrap(async (req, res) => {
      const b = parse(productSchema, req.body);
      if (b.sale_price !== null && b.sale_price > b.price)
        fail(400, "Sale price must not exceed retail price.");
      await update(
        db,
        "products",
        { ...b, gallery: JSON.stringify(b.gallery) },
        "id",
        req.params.id,
      );
      await audit(db, req.user, "product.update", b.name);
      res.json({ ok: true });
    }),
  );
  app.delete(
    "/api/admin/products/:id",
    wrap(async (req, res) => {
      await update(
        db,
        "products",
        { archived: 1, visible: 0 },
        "id",
        req.params.id,
      );
      await audit(db, req.user, "product.archive", req.params.id);
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/stock",
    wrap(async (req, res) => {
      const b = parse(
        z.object({
          productId: z.string(),
          delta: z.number().int().min(-100000).max(100000),
          reason: z.string().min(3).max(200),
        }),
        req.body,
      );
      await db.tx(() =>
        moveStock(db, b.productId, b.delta, b.reason, req.user.email),
      );
      await audit(db, req.user, "stock.adjust", b);
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/admin/stock",
    wrap(async (req, res) =>
      res.json(
        await db.all(
          "SELECT s.*,p.name FROM stock_movements s JOIN products p ON p.id=s.product_id ORDER BY s.created_at DESC LIMIT 1000",
        ),
      ),
    ),
  );
  app.get(
    "/api/admin/orders",
    wrap(async (req, res) => {
      let rows = await db.all(
        "SELECT * FROM orders ORDER BY created_at DESC LIMIT 5000",
      );
      const q = String(req.query.q || "").toLowerCase();
      rows = rows.filter(
        (o) =>
          (!q ||
            [o.ref, o.name, o.email, o.phone].some((v) =>
              v.toLowerCase().includes(q),
            )) &&
          (!req.query.status || o.status === req.query.status),
      );
      res.json(rows.map(({ token_hash, idempotency_key, ...o }) => o));
    }),
  );
  app.get(
    "/api/admin/orders/:ref",
    wrap(async (req, res) => {
      const o = await permittedOrder(req);
      delete o.token_hash;
      delete o.idempotency_key;
      res.json({
        ...o,
        items: await db.all("SELECT * FROM order_items WHERE order_id=?", [
          o.id,
        ]),
        events: await db.all(
          "SELECT * FROM order_events WHERE order_id=? ORDER BY created_at",
          [o.id],
        ),
        refunds: await db.all("SELECT * FROM refunds WHERE order_id=?", [o.id]),
      });
    }),
  );
  app.post(
    "/api/admin/orders/:ref/status",
    wrap(async (req, res) => {
      const b = parse(
        z.object({
          status: z.enum([
            "confirmed",
            "processing",
            "ready",
            "shipped",
            "delivered",
            "cancelled",
          ]),
          note: z.string().max(1000).default(""),
        }),
        req.body,
      );
      await db.tx(async () => {
        const o = await permittedOrder(req);
        if (o.status === "cancelled" || o.status === "delivered")
          fail(400, "This order is closed.");
        if (
          b.status !== "cancelled" &&
          (o.payment_status !== "paid" || o.stock_state !== "committed")
        )
          fail(400, "Confirm payment and stock allocation before fulfilment.");
        if (b.status === "cancelled") {
          if (["shipped", "delivered"].includes(o.status))
            fail(400, "Dispatched orders require a manual return review.");
          if (o.stock_state === "reserved") await release(db, o, "Cancelled");
          else if (o.stock_state === "committed") {
            for (const it of await db.all(
              "SELECT * FROM order_items WHERE order_id=?",
              [o.id],
            ))
              await moveStock(
                db,
                it.product_id,
                it.qty,
                "Cancelled paid order",
                req.user.email,
              );
            await update(db, "orders", { stock_state: "released" }, "id", o.id);
          }
        }
        await update(db, "orders", { status: b.status }, "id", o.id);
        await event(db, o.id, `Order ${b.status}.`);
        if (b.note) await event(db, o.id, b.note, 1);
        await enqueue(
          db,
          o.email,
          `Order update · ${o.ref}`,
          `Your order ${o.ref} is now ${b.status}.`,
        );
        await audit(db, req.user, "order.status", {
          ref: o.ref,
          status: b.status,
        });
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/orders/:ref/note",
    wrap(async (req, res) => {
      const o = await permittedOrder(req);
      const b = parse(
        z.object({ note: z.string().min(1).max(1000) }),
        req.body,
      );
      await event(db, o.id, b.note, 1);
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/orders/:ref/manual-payment",
    wrap(async (req, res) => {
      if (!manager(req.user)) fail(403, "Manager permission required.");
      const b = parse(
        z.object({ evidence: z.string().min(5).max(1000) }),
        req.body,
      );
      await db.tx(async () => {
        const o = await permittedOrder(req);
        if (
          o.channel !== "whatsapp" ||
          o.payment_status !== "unpaid" ||
          o.stock_state !== "reserved" ||
          Number(o.expires_at) < now()
        )
          fail(
            400,
            "Only active unpaid WhatsApp orders can be confirmed manually.",
          );
        await update(
          db,
          "orders",
          {
            payment_status: "paid",
            stock_state: "committed",
            status: "confirmed",
          },
          "id",
          o.id,
        );
        await event(db, o.id, "Payment confirmed by store.");
        await event(db, o.id, b.evidence, 1);
        await audit(db, req.user, "payment.manual", {
          ref: o.ref,
          evidence: b.evidence,
        });
        await enqueue(
          db,
          o.email,
          `Payment confirmed · ${o.ref}`,
          "Your payment has been confirmed by the store.",
        );
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/orders/:ref/refund",
    wrap(async (req, res) => {
      if (!manager(req.user)) fail(403, "Manager permission required.");
      const b = parse(
        z.object({
          amount: money.positive(),
          reason: z.string().min(3).max(1000),
          status: z.enum(["recorded", "completed"]),
        }),
        req.body,
      );
      await db.tx(async () => {
        const o = await permittedOrder(req);
        if (!["paid", "partially_refunded"].includes(o.payment_status))
          fail(400, "No refundable payment on this order.");
        const refunded = Number(
          (
            await db.one(
              "SELECT COALESCE(SUM(amount),0) AS n FROM refunds WHERE order_id=? AND status='completed'",
              [o.id],
            )
          ).n,
        );
        if (b.amount > o.total - refunded)
          fail(400, "Refund exceeds the unrefunded amount.");
        await insert(db, "refunds", {
          id: id(),
          order_id: o.id,
          ...b,
          created_at: now(),
        });
        if (b.status === "completed")
          await update(
            db,
            "orders",
            {
              payment_status:
                refunded + b.amount === o.total
                  ? "refunded"
                  : "partially_refunded",
            },
            "id",
            o.id,
          );
        await event(db, o.id, `Refund ${b.status}: NGN ${b.amount / 100}.`, 1);
        await audit(db, req.user, "refund.record", { ref: o.ref, ...b });
      });
      res.json({
        ok: true,
        message:
          "Record saved. Transfer refunds separately through your payment provider.",
      });
    }),
  );
  app.get(
    "/api/admin/customers",
    wrap(async (req, res) =>
      res.json(
        await db.all(
          "SELECT id,name,email,phone,business,role,wholesale_status,created_at FROM users ORDER BY created_at DESC",
        ),
      ),
    ),
  );
  app.post(
    "/api/admin/customers/:id",
    wrap(async (req, res) => {
      const b = parse(
        z.object({
          name: z.string().trim().min(2).max(150),
          phone: z.string().max(30),
          business: z.string().max(200),
        }),
        req.body,
      );
      const u = await db.one("SELECT id,role FROM users WHERE id=?", [
        req.params.id,
      ]);
      if (!u) fail(404, "Customer not found.");
      if (u.role !== "customer" && req.user.role !== "owner")
        fail(403, "Only the owner can change staff contact records.");
      await update(db, "users", b, "id", u.id);
      await audit(db, req.user, "customer.update", u.id);
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/orders/:ref/allocate",
    wrap(async (req, res) => {
      if (!manager(req.user)) fail(403, "Manager permission required.");
      await db.tx(async () => {
        const o = await permittedOrder(req);
        if (
          o.payment_status !== "paid" ||
          o.stock_state !== "released" ||
          o.status !== "payment_review"
        )
          fail(400, "This order is not awaiting stock allocation.");
        for (const it of await db.all(
          "SELECT * FROM order_items WHERE order_id=?",
          [o.id],
        ))
          await moveStock(
            db,
            it.product_id,
            -it.qty,
            "Payment review allocation " + o.ref,
            req.user.email,
          );
        await update(
          db,
          "orders",
          { stock_state: "committed", status: "confirmed" },
          "id",
          o.id,
        );
        if (o.coupon_id)
          await db.query("UPDATE coupons SET uses=uses+1 WHERE id=?", [
            o.coupon_id,
          ]);
        await event(db, o.id, "Available stock allocated. Order confirmed.");
        await audit(db, req.user, "order.allocate", o.ref);
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/customers/:id/wholesale",
    wrap(async (req, res) => {
      const b = parse(
        z.object({
          status: z.enum(["approved", "rejected", "pending", "none"]),
        }),
        req.body,
      );
      await update(
        db,
        "users",
        { wholesale_status: b.status },
        "id",
        req.params.id,
      );
      await audit(db, req.user, "wholesale.status", {
        id: req.params.id,
        ...b,
      });
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/admin/team",
    wrap(async (req, res) =>
      res.json(
        await db.all(
          "SELECT id,name,email,role FROM users WHERE role IN ('owner','manager','staff')",
        ),
      ),
    ),
  );
  app.post(
    "/api/admin/team",
    wrap(async (req, res) => {
      const b = parse(
        z.object({
          email: z.email(),
          name: z.string().min(2),
          password: z.string().min(12).max(128),
          role: z.enum(["manager", "staff"]),
        }),
        req.body,
      );
      await insert(db, "users", {
        id: id(),
        email: b.email.toLowerCase(),
        name: b.name,
        password_hash: await bcrypt.hash(b.password, 12),
        role: b.role,
        created_at: now(),
      });
      await audit(db, req.user, "team.create", b.email);
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/team/:id",
    wrap(async (req, res) => {
      const b = parse(
        z.object({ role: z.enum(["manager", "staff", "customer"]) }),
        req.body,
      );
      const u = await db.one("SELECT role FROM users WHERE id=?", [
        req.params.id,
      ]);
      if (!u || u.role === "owner")
        fail(400, "Owner roles cannot be changed here.");
      await update(db, "users", b, "id", req.params.id);
      await db.query("DELETE FROM sessions WHERE user_id=?", [req.params.id]);
      await audit(db, req.user, "team.role", { id: req.params.id, ...b });
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/admin/content",
    wrap(async (req, res) =>
      res.json({
        draft: await settings(db, "draft"),
        published: await settings(db),
        versions: await db.all(
          "SELECT id,actor,created_at FROM content_versions ORDER BY created_at DESC LIMIT 20",
        ),
      }),
    ),
  );
  app.put(
    "/api/admin/content",
    wrap(async (req, res) => {
      const b = req.body;
      if (JSON.stringify(b).length > 500000) fail(400, "Content is too large.");
      if (
        !/^#[0-9a-f]{6}$/i.test(b.primary) ||
        !/^#[0-9a-f]{6}$/i.test(b.background)
      )
        fail(400, "Use valid hex colours.");
      if (!/^\d{7,15}$/.test(b.whatsapp))
        fail(400, "Use international WhatsApp digits only.");
      if (!Array.isArray(b.sections) || !b.banners || !b.policies)
        fail(400, "Invalid content structure.");
      for (const list of [
        b.navigation,
        b.footerLinks,
        ...Object.values(b.banners),
      ])
        for (const x of list || []) {
          for (const key of ["href", "image", "mobileImage"])
            if (x[key] && !safeLink(x[key]))
              fail(400, "Links must be site paths or HTTPS URLs.");
        }
      if (b.socialImage && !safeLink(b.socialImage))
        fail(400, "Sharing image must use a site path or HTTPS URL.");
      for (const value of Object.values(b.socials || {}))
        if (value && !safeLink(value))
          fail(400, "Social links must use HTTPS URLs.");
      if (b.logo && !safeLink(b.logo))
        fail(400, "Logo URL must be a site path or HTTPS URL.");
      if (!Number.isSafeInteger(b.wholesaleMinimum) || b.wholesaleMinimum < 0)
        fail(400, "Invalid wholesale minimum.");
      await update(
        db,
        "content",
        { data: JSON.stringify(b), updated_at: now() },
        "id",
        "draft",
      );
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/content/publish",
    wrap(async (req, res) => {
      await db.tx(async () => {
        const old = await db.one(
          "SELECT data FROM content WHERE id='published'",
        );
        await insert(db, "content_versions", {
          id: id(),
          data: old.data,
          actor: req.user.email,
          created_at: now(),
        });
        await update(
          db,
          "content",
          {
            data: JSON.stringify(await settings(db, "draft")),
            updated_at: now(),
          },
          "id",
          "published",
        );
        await audit(db, req.user, "content.publish", "Website published");
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/content/restore",
    wrap(async (req, res) => {
      const v = await db.one("SELECT data FROM content_versions WHERE id=?", [
        String(req.body.id),
      ]);
      if (!v) fail(404, "Version not found.");
      await update(
        db,
        "content",
        { data: v.data, updated_at: now() },
        "id",
        "draft",
      );
      res.json({ ok: true });
    }),
  );
  for (const table of ["zones", "coupons", "taxonomy"]) {
    app.get(
      "/api/admin/" + table,
      wrap(async (req, res) =>
        res.json(
          await db.all(
            `SELECT * FROM ${table} ORDER BY ${table === "zones" ? "lga" : table === "taxonomy" ? "kind,name" : "code"}`,
          ),
        ),
      ),
    );
    app.post(
      "/api/admin/" + table,
      wrap(async (req, res) => {
        let schema;
        if (table === "zones")
          schema = z.object({
            lga: z.string().min(2).max(100),
            neighbourhood: z.string().max(100).default(""),
            fee: money,
            minimum: money,
            eta: z.string().max(200),
            enabled: z.number().min(0).max(1),
          });
        else if (table === "coupons")
          schema = z.object({
            code: z
              .string()
              .regex(/^[A-Z0-9_-]+$/)
              .max(60),
            type: z.enum(["percent", "fixed"]),
            value: money,
            minimum: money,
            max_uses: z.number().int().min(1),
            starts_at: money.nullable(),
            expires_at: money.nullable(),
            enabled: z.number().min(0).max(1),
          });
        else
          schema = z.object({
            kind: z.enum(["categories", "brands"]),
            name: z.string().min(1).max(100),
            slug: z.string().regex(/^[a-z0-9-]+$/),
            image: z.string().refine(safeLink),
          });
        const b = parse(schema, req.body);
        if (table === "coupons" && b.type === "percent" && b.value > 100)
          fail(400, "Percentage cannot exceed 100.");
        if (req.body.id) await update(db, table, b, "id", String(req.body.id));
        else await insert(db, table, { id: id(), ...b });
        await audit(db, req.user, table + ".save", b);
        res.json({ ok: true });
      }),
    );
    app.delete(
      "/api/admin/" + table + "/:id",
      wrap(async (req, res) => {
        if (table === "coupons")
          await update(db, table, { enabled: 0 }, "id", req.params.id);
        else await db.query(`DELETE FROM ${table} WHERE id=?`, [req.params.id]);
        await audit(db, req.user, table + ".delete", req.params.id);
        res.json({ ok: true });
      }),
    );
  }
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  app.post(
    "/api/admin/upload",
    upload.single("file"),
    wrap(async (req, res) => {
      const f = req.file;
      if (!f) fail(400, "Select an image.");
      const b = f.buffer;
      let ext;
      if (
        b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        ext = "png";
      else if (b[0] === 255 && b[1] === 216 && b[2] === 255) ext = "jpg";
      else if (
        b.toString("ascii", 0, 4) === "RIFF" &&
        b.toString("ascii", 8, 12) === "WEBP"
      )
        ext = "webp";
      else fail(400, "Upload a PNG, JPEG or WebP image.");
      const key = id() + "." + ext;
      if (process.env.S3_BUCKET) {
        const { S3Client, PutObjectCommand } = await import(
          "@aws-sdk/client-s3"
        );
        if (!process.env.S3_PUBLIC_URL)
          fail(503, "Configure S3_PUBLIC_URL for uploaded images.");
        const client = new S3Client({
          region: process.env.S3_REGION || "auto",
          endpoint: process.env.S3_ENDPOINT || undefined,
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          },
        });
        await client.send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: key,
            Body: b,
            ContentType: {
              png: "image/png",
              jpg: "image/jpeg",
              webp: "image/webp",
            }[ext],
          }),
        );
        res.json({
          url: process.env.S3_PUBLIC_URL.replace(/\/$/, "") + "/" + key,
        });
      } else {
        if (process.env.VERCEL)
          fail(503, "Configure object storage before uploading on Vercel.");
        await mkdir("uploads", { recursive: true });
        await writeFile(resolve("uploads", key), b);
        res.json({ url: "/uploads/" + key });
      }
    }),
  );
  app.post(
    "/api/admin/import",
    upload.single("file"),
    wrap(async (req, res) => {
      if (!req.file) fail(400, "Choose a CSV or XLSX file (maximum 5 MB).");
      const workbook = new ExcelJS.Workbook();
      let sheet;
      if (req.file.originalname.toLowerCase().endsWith(".csv")) {
        const { Readable } = await import("node:stream");
        sheet = await workbook.csv.read(Readable.from(req.file.buffer));
      } else {
        await workbook.xlsx.load(req.file.buffer);
        sheet = workbook.worksheets[0];
      }
      if (!sheet || sheet.rowCount > 3001)
        fail(400, "Import up to 3,000 products at once.");
      const headers = sheet
        .getRow(1)
        .values.slice(1)
        .map((v) => String(v).trim().toLowerCase());
      const rows = [],
        errors = [];
      for (let n = 2; n <= sheet.rowCount; n++) {
        const raw = {};
        headers.forEach(
          (h, i) =>
            (raw[h] = sheet
              .getRow(n)
              .getCell(i + 1)
              .text.trim()),
        );
        if (!raw.name) continue;
        try {
          const price = Math.round(Number(raw.price) * 100);
          if (raw.price === "" || !Number.isFinite(price))
            throw Error("Retail price is required");
          const slug =
            raw.slug ||
            raw.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
          const p = parse(productSchema, {
            name: raw.name,
            sku: raw.sku || slug.toUpperCase().slice(0, 80),
            slug,
            category: raw.category || "Other",
            brand: raw.brand || "",
            size: raw.size || "",
            description: raw.description || "",
            price,
            wholesale_price: raw.wholesale_price
              ? Math.round(Number(raw.wholesale_price) * 100)
              : null,
            wholesale_min: Number(raw.wholesale_min) || 6,
            image: raw.image || "/placeholder.svg",
            visible: raw.visible === "0" ? 0 : 1,
            featured: 0,
          });
          rows.push(p);
        } catch (e) {
          errors.push({
            row: n,
            message:
              e.issues
                ?.map((i) => i.path.join(".") + ": " + i.message)
                .join("; ") || e.message,
          });
        }
      }
      if (
        new Set(rows.map((r) => r.sku)).size !== rows.length ||
        new Set(rows.map((r) => r.slug)).size !== rows.length
      )
        errors.push({ row: 0, message: "Duplicate SKU or slug in file." });
      if (req.body.commit === "true") {
        if (errors.length) fail(400, "Correct import errors first.");
        await db.tx(async () => {
          for (const p of rows) {
            const old = await db.one("SELECT id FROM products WHERE sku=?", [
              p.sku,
            ]);
            if (old)
              await update(
                db,
                "products",
                { ...p, gallery: "[]" },
                "id",
                old.id,
              );
            else
              await insert(db, "products", {
                ...p,
                gallery: "[]",
                id: id(),
                stock: 0,
                created_at: now(),
              });
          }
          await audit(db, req.user, "products.import", { count: rows.length });
        });
      }
      res.json({
        rows: rows.slice(0, 50),
        total: rows.length,
        errors,
        committed: req.body.commit === "true",
      });
    }),
  );
  app.get(
    "/api/admin/export/:type",
    wrap(async (req, res) => {
      const queries = {
        products:
          "SELECT sku,slug,name,category,brand,size,price,wholesale_price,stock,visible FROM products WHERE archived=0",
        orders:
          "SELECT ref,name,email,phone,zone,channel,pricing,total,discount,delivery,payment_status,status,created_at FROM orders",
        customers:
          "SELECT name,email,phone,business,wholesale_status FROM users",
        stock: "SELECT * FROM stock_movements",
      };
      const q = queries[req.params.type];
      if (!q) fail(404, "Export not found");
      const rows = await db.all(q);
      for (const r of rows)
        for (const k of [
          "price",
          "wholesale_price",
          "total",
          "discount",
          "delivery",
        ])
          if (r[k] !== undefined && r[k] !== null) r[k] /= 100;
      res
        .type("text/csv")
        .attachment(`liquor-plug-${req.params.type}.csv`)
        .send(csv(rows));
    }),
  );
  app.get(
    "/api/admin/audit",
    wrap(async (req, res) =>
      res.json(
        await db.all(
          "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 1000",
        ),
      ),
    ),
  );
  app.get(
    "/api/admin/notifications",
    wrap(async (req, res) =>
      res.json(
        await db.all(
          "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100",
        ),
      ),
    ),
  );
  app.get(
    "/api/admin/email-status",
    wrap(async (req, res) =>
      res.json({
        configured: !!process.env.SMTP_HOST,
        queue: await db.all(
          "SELECT state,COUNT(*) AS count FROM email_outbox GROUP BY state",
        ),
      }),
    ),
  );
  app.post(
    "/api/admin/maintenance",
    wrap(async (req, res) =>
      res.json({ expired: await expire(db), mail: await drainMail(db) }),
    ),
  );
  app.get(
    "/api/maintenance",
    wrap(async (req, res) => {
      if (
        !process.env.CRON_SECRET ||
        !same(req.get("authorization"), "Bearer " + process.env.CRON_SECRET)
      )
        fail(401, "Unauthorized");
      res.json({ expired: await expire(db), mail: await drainMail(db) });
    }),
  );
  app.get("/robots.txt", (req, res) =>
    res
      .type("text/plain")
      .send(
        `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /checkout\nDisallow: /track\nSitemap: ${process.env.PUBLIC_URL}/sitemap.xml`,
      ),
  );
  app.get(
    "/sitemap.xml",
    wrap(async (req, res) => {
      const base = (process.env.PUBLIC_URL || "http://localhost:3000").replace(
        /\/$/,
        "",
      );
      const pages = [
        "/",
        "/shop",
        "/categories",
        "/brands",
        "/wholesale",
        "/contact",
        ...(
          await db.all(
            "SELECT slug FROM products WHERE visible=1 AND archived=0",
          )
        ).map((p) => "/product/" + p.slug),
      ];
      res
        .type("application/xml")
        .send(
          '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
            pages.map((p) => `<url><loc>${base + p}</loc></url>`).join("") +
            "</urlset>",
        );
    }),
  );
  app.use(
    "/uploads",
    express.static(resolve("uploads"), {
      dotfiles: "deny",
      setHeaders: (r) => r.set("X-Content-Type-Options", "nosniff"),
    }),
  );
  app.use(express.static(resolve("public")));
  app.get(
    "/api/render",
    wrap(async (req, res) => {
      const path = String(req.query.path || "/");
      if (!path.startsWith("/") || path.startsWith("//"))
        fail(400, "Invalid page path.");
      res
        .set("Cache-Control", "no-cache")
        .type("html")
        .send(await renderPage(db, path));
    }),
  );
  app.use("/api", (_, res) =>
    res.status(404).json({ error: "API route not found" }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status =
      error instanceof z.ZodError
        ? 400
        : error.status || (error.code === "LIMIT_FILE_SIZE" ? 413 : 500);
    if (status >= 500)
      console.error("Request failed:", error.code || error.name);
    res.status(status).json({
      error:
        error instanceof z.ZodError
          ? error.issues
              .map((i) => i.path.join(".") + ": " + i.message)
              .join("; ")
          : status >= 500 && !error.status
            ? "The request could not be completed. Check the server configuration and try again."
            : error.message,
    });
  });
  return app;
}
