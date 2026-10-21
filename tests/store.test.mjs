import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createHmac } from "node:crypto";
import { openDatabase } from "../server/db.mjs";
import { migrate, seed } from "../server/setup.mjs";
import { createApp } from "../server/app.mjs";
import { defaults } from "../server/defaults.mjs";
import { id, token, hash, csv } from "../server/security.mjs";
import { expire, acceptPayment } from "../server/orders.mjs";
let db,
  app,
  dir,
  owner,
  guest,
  customer,
  staff,
  csrfOwner,
  csrfGuest,
  csrfCustomer,
  csrfStaff;
const password = "Test-only-strong-pass-2026!";
async function session(agent, email) {
  let b = await agent.get("/api/bootstrap");
  const c = b.body.csrf;
  if (email) {
    const r = await agent
      .post("/api/auth/login")
      .set("x-csrf-token", c)
      .send({ email, password });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.csrf;
  }
  return c;
}
async function product(extra = {}) {
  const pid = id(),
    name = "Test " + pid.slice(0, 8);
  await db.query(
    "INSERT INTO products(id,slug,sku,name,category,brand,size,price,stock,wholesale_price,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    [
      pid,
      pid,
      pid,
      name,
      "Whiskey",
      "Test Brand",
      "70cl",
      1000000,
      20,
      800000,
      Date.now(),
    ],
  );
  if (Object.keys(extra).length)
    for (const [k, v] of Object.entries(extra))
      await db.query(`UPDATE products SET ${k}=? WHERE id=?`, [v, pid]);
  return await db.one("SELECT * FROM products WHERE id=?", [pid]);
}
async function zone(extra = {}) {
  const zid = id();
  await db.query(
    "INSERT INTO zones(id,lga,fee,enabled,minimum) VALUES(?,?,?,?,?)",
    [zid, "Ikeja", 200000, 1, extra.minimum || 0],
  );
  if (extra.enabled === 0)
    await db.query("UPDATE zones SET enabled=0 WHERE id=?", [zid]);
  return zid;
}
function body(p, z, extra = {}) {
  return {
    name: "A Customer",
    email: "guest@example.test",
    phone: "+2348060000000",
    address: "10 Example Street",
    zoneId: z,
    note: "",
    channel: "whatsapp",
    coupon: "",
    ageConfirmed: true,
    pricing: "retail",
    idempotencyKey: token(),
    items: [{ id: p.id, qty: 1 }],
    ...extra,
  };
}
const post = (agent, path, csrf, b) =>
  agent
    .post("/api" + path)
    .set("x-csrf-token", csrf)
    .send(b);
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "liquor-plug-test-"));
  db = await openDatabase({ url: "", path: join(dir, "test.sqlite") });
  await migrate(db);
  await seed(db, { ownerEmail: "owner@example.test", ownerPassword: password });
  app = createApp(db);
  owner = request.agent(app);
  guest = request.agent(app);
  customer = request.agent(app);
  staff = request.agent(app);
  csrfOwner = await session(owner, "owner@example.test");
  csrfGuest = await session(guest);
  csrfCustomer = await session(customer);
  await post(customer, "/auth/register", csrfCustomer, {
    name: "Retail Customer",
    email: "customer@example.test",
    password,
  });
  csrfCustomer = await session(customer, "customer@example.test");
  await post(owner, "/admin/team", csrfOwner, {
    name: "Staff Member",
    email: "staff@example.test",
    password,
    role: "staff",
  });
  csrfStaff = await session(staff, "staff@example.test");
});
beforeEach(async () => {
  await db.query("DELETE FROM rate_buckets WHERE key LIKE 'checkout:%'");
});
after(async () => {
  await db.close();
  await rm(dir, { recursive: true, force: true });
});
test("catalogue contains all 532 products and 20 delivery LGAs", async () => {
  const r = await guest.get("/api/products");
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 532);
  const b = await guest.get("/api/bootstrap");
  assert.equal(new Set(b.body.zones.map((z) => z.lga)).size, 20);
  assert.ok(b.body.zones.every((z) => z.enabled === 0));
  assert.equal(b.body.settings.whatsapp, "2348062833017");
  assert.ok(r.body.products.every((p) => p.stock === 0));
});
test("retail and anonymous API never expose wholesale prices", async () => {
  const p = await product();
  for (const agent of [guest, customer]) {
    const r = await agent.get("/api/products/" + p.slug);
    assert.equal(r.body.wholesale_price, undefined);
    assert.equal(r.body.source_url, undefined);
  }
});
test("unauthenticated users cannot access admin", async () => {
  const r = await guest.get("/api/admin/products");
  assert.equal(r.status, 403);
});
test("staff can process orders but cannot change products or content", async () => {
  assert.equal((await staff.get("/api/admin/orders")).status, 200);
  assert.equal((await staff.get("/api/admin/content")).status, 403);
  assert.equal(
    (await post(staff, "/admin/products", csrfStaff, {})).status,
    403,
  );
  assert.equal((await staff.get("/api/admin/team")).status, 403);
});
test("cross-site and missing-CSRF mutations are rejected", async () => {
  assert.equal((await guest.post("/api/auth/logout").send({})).status, 403);
  assert.equal(
    (
      await guest
        .post("/api/auth/logout")
        .set("x-csrf-token", csrfGuest)
        .set("origin", "https://attacker.example")
        .send({})
    ).status,
    403,
  );
});
test("server quote ignores submitted prices and totals", async () => {
  const p = await product(),
    z = await zone();
  const b = body(p, z, {
    total: 1,
    price: 1,
    items: [{ id: p.id, qty: 2, price: 1 }],
  });
  const r = await post(guest, "/orders/quote", csrfGuest, b);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.total, 2200000);
});
test("unserviceable delivery areas cannot accept orders", async () => {
  const p = await product(),
    z = await zone({ enabled: 0 });
  assert.equal(
    (await post(guest, "/orders", csrfGuest, body(p, z))).status,
    400,
  );
});
test("delivery minimum spend is enforced", async () => {
  const p = await product(),
    z = await zone({ minimum: 5000000 });
  assert.equal(
    (await post(guest, "/orders/quote", csrfGuest, body(p, z))).status,
    400,
  );
});
test("adult confirmation and positive integral quantities are required", async () => {
  const p = await product(),
    z = await zone();
  for (const extra of [
    { ageConfirmed: false },
    { items: [{ id: p.id, qty: -1 }] },
    { items: [{ id: p.id, qty: 1.5 }] },
  ])
    assert.equal(
      (await post(guest, "/orders", csrfGuest, body(p, z, extra))).status,
      400,
    );
});
test("WhatsApp checkout persists order and reserves stock before returning message link", async () => {
  const p = await product(),
    z = await zone();
  const r = await post(
    guest,
    "/orders",
    csrfGuest,
    body(p, z, { items: [{ id: p.id, qty: 2 }] }),
  );
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.ok(r.body.whatsappUrl.startsWith("https://wa.me/2348062833017?text="));
  const o = await db.one("SELECT * FROM orders WHERE ref=?", [r.body.ref]);
  assert.equal(o.total, 2200000);
  assert.equal(o.payment_status, "unpaid");
  assert.equal(o.stock_state, "reserved");
  assert.equal(
    (await db.one("SELECT stock FROM products WHERE id=?", [p.id])).stock,
    18,
  );
  assert.ok(
    (
      await db.one("SELECT COUNT(*) AS n FROM order_events WHERE order_id=?", [
        o.id,
      ])
    ).n > 0,
  );
});
test("concurrent checkouts cannot oversell stock", async () => {
  const p = await product({ stock: 1 }),
    z = await zone();
  const results = await Promise.all([
    post(guest, "/orders", csrfGuest, body(p, z)),
    post(guest, "/orders", csrfGuest, body(p, z)),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (await db.one("SELECT stock FROM products WHERE id=?", [p.id])).stock,
    0,
  );
});
test("repeated idempotency key cannot create another order", async () => {
  const p = await product(),
    z = await zone(),
    b = body(p, z);
  assert.equal((await post(guest, "/orders", csrfGuest, b)).status, 201);
  assert.equal((await post(guest, "/orders", csrfGuest, b)).status, 409);
});
test("guest order details require secret token", async () => {
  const p = await product(),
    z = await zone();
  const r = await post(guest, "/orders", csrfGuest, body(p, z));
  assert.equal((await guest.get("/api/orders/" + r.body.ref)).status, 404);
  const o = await guest
    .get("/api/orders/" + r.body.ref)
    .set("x-order-token", r.body.token);
  assert.equal(o.status, 200);
  assert.equal(o.body.token_hash, undefined);
  assert.ok(o.body.items.length);
});
test("unapproved accounts cannot request wholesale checkout", async () => {
  const p = await product(),
    z = await zone();
  assert.equal(
    (
      await post(
        customer,
        "/orders/quote",
        csrfCustomer,
        body(p, z, { pricing: "wholesale" }),
      )
    ).status,
    403,
  );
});
test("wholesale applications require account approval and enforce product minimums", async () => {
  assert.equal(
    (
      await post(customer, "/wholesale/apply", csrfCustomer, {
        business: "Test Restaurant",
        phone: "+2348060000000",
      })
    ).status,
    200,
  );
  const u = await db.one("SELECT * FROM users WHERE email=?", [
    "customer@example.test",
  ]);
  await post(owner, "/admin/customers/" + u.id + "/wholesale", csrfOwner, {
    status: "approved",
  });
  const p = await product(),
    z = await zone();
  let r = await post(
    customer,
    "/orders/quote",
    csrfCustomer,
    body(p, z, { pricing: "wholesale" }),
  );
  assert.equal(r.status, 400);
  r = await post(
    customer,
    "/orders/quote",
    csrfCustomer,
    body(p, z, { pricing: "wholesale", items: [{ id: p.id, qty: 6 }] }),
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 5000000);
  await db.query("UPDATE users SET wholesale_status='none' WHERE id=?", [u.id]);
});
test("expired reservations restore inventory exactly once", async () => {
  const p = await product(),
    z = await zone();
  const r = await post(guest, "/orders", csrfGuest, body(p, z));
  await db.query("UPDATE orders SET expires_at=0 WHERE ref=?", [r.body.ref]);
  await expire(db);
  await expire(db);
  assert.equal(
    (await db.one("SELECT stock FROM products WHERE id=?", [p.id])).stock,
    20,
  );
  assert.equal(
    (await db.one("SELECT status FROM orders WHERE ref=?", [r.body.ref]))
      .status,
    "expired",
  );
});
test("unpaid orders cannot be dispatched", async () => {
  const p = await product(),
    z = await zone();
  const r = await post(guest, "/orders", csrfGuest, body(p, z));
  assert.equal(
    (
      await post(owner, "/admin/orders/" + r.body.ref + "/status", csrfOwner, {
        status: "shipped",
      })
    ).status,
    400,
  );
});
test("manual WhatsApp payment, fulfilment and refund record work", async () => {
  const p = await product(),
    z = await zone();
  const r = await post(guest, "/orders", csrfGuest, body(p, z));
  assert.equal(
    (
      await post(
        owner,
        "/admin/orders/" + r.body.ref + "/manual-payment",
        csrfOwner,
        { evidence: "Bank transfer TEST-001 confirmed" },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await post(owner, "/admin/orders/" + r.body.ref + "/status", csrfOwner, {
        status: "shipped",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(owner, "/admin/orders/" + r.body.ref + "/refund", csrfOwner, {
        amount: 1200001,
        reason: "Too much",
        status: "completed",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(owner, "/admin/orders/" + r.body.ref + "/refund", csrfOwner, {
        amount: 100000,
        reason: "Partial refund completed externally",
        status: "completed",
      })
    ).status,
    200,
  );
  const o = await db.one("SELECT * FROM orders WHERE ref=?", [r.body.ref]);
  assert.equal(o.payment_status, "partially_refunded");
});
test("cancelled reservations restore stock and cannot be cancelled twice", async () => {
  const p = await product(),
    z = await zone();
  const r = await post(guest, "/orders", csrfGuest, body(p, z));
  assert.equal(
    (
      await post(owner, "/admin/orders/" + r.body.ref + "/status", csrfOwner, {
        status: "cancelled",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(owner, "/admin/orders/" + r.body.ref + "/status", csrfOwner, {
        status: "cancelled",
      })
    ).status,
    400,
  );
  assert.equal(
    (await db.one("SELECT stock FROM products WHERE id=?", [p.id])).stock,
    20,
  );
});
test("coupon usage limits and discount combination rules are enforced", async () => {
  const code = "TEST" + token().slice(0, 6).toUpperCase();
  await post(owner, "/admin/coupons", csrfOwner, {
    code,
    type: "percent",
    value: 10,
    minimum: 0,
    max_uses: 1,
    starts_at: null,
    expires_at: null,
    enabled: 1,
  });
  const p = await product(),
    z = await zone();
  let r = await post(guest, "/orders", csrfGuest, body(p, z, { coupon: code }));
  assert.equal(r.status, 201);
  assert.equal(r.body.total, 1100000);
  assert.equal(
    (await post(guest, "/orders", csrfGuest, body(p, z, { coupon: code })))
      .status,
    400,
  );
  await post(owner, "/admin/orders/" + r.body.ref + "/status", csrfOwner, {
    status: "cancelled",
  });
  await db.query("UPDATE products SET sale_price=900000 WHERE id=?", [p.id]);
  assert.equal(
    (
      await post(
        guest,
        "/orders/quote",
        csrfGuest,
        body(p, z, { coupon: code }),
      )
    ).status,
    400,
  );
});
test("online checkout unavailable without configured Paystack key", async () => {
  const p = await product(),
    z = await zone();
  assert.equal(
    (
      await post(
        guest,
        "/orders",
        csrfGuest,
        body(p, z, { channel: "paystack" }),
      )
    ).status,
    503,
  );
});
test("Paystack webhook rejects unsigned payload", async () => {
  assert.equal(
    (
      await request(app)
        .post("/api/payments/webhook")
        .send({ event: "charge.success" })
    ).status,
    401,
  );
});
test("valid signed Paystack webhook verifies remotely and is idempotent", async () => {
  const p = await product(),
    z = await zone();
  const created = await post(guest, "/orders", csrfGuest, body(p, z));
  const o = await db.one("SELECT * FROM orders WHERE ref=?", [
    created.body.ref,
  ]);
  const reference = "TEST-" + token();
  await db.query(
    "INSERT INTO payments(reference,order_id,amount,created_at) VALUES(?,?,?,?)",
    [reference, o.id, o.total, Date.now()],
  );
  const original = global.fetch;
  process.env.PAYSTACK_SECRET_KEY = "sk_test_fixture";
  const d = { reference, status: "success", currency: "NGN", amount: o.total };
  global.fetch = async (url) => {
    assert.ok(url.startsWith("https://api.paystack.co/transaction/verify/"));
    return { ok: true, json: async () => ({ status: true, data: d }) };
  };
  try {
    const payload = JSON.stringify({
      event: "charge.success",
      data: { reference },
    });
    const signature = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(payload)
      .digest("hex");
    for (let i = 0; i < 2; i++) {
      const r = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", signature)
        .send(payload);
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
    assert.equal(
      (await db.one("SELECT payment_status FROM orders WHERE id=?", [o.id]))
        .payment_status,
      "paid",
    );
    assert.equal(
      (await db.one("SELECT stock FROM products WHERE id=?", [p.id])).stock,
      19,
    );
  } finally {
    global.fetch = original;
    delete process.env.PAYSTACK_SECRET_KEY;
  }
});
test("payment amount mismatch cannot mark order paid", async () => {
  const p = await product(),
    z = await zone();
  const created = await post(guest, "/orders", csrfGuest, body(p, z));
  const o = await db.one("SELECT * FROM orders WHERE ref=?", [
    created.body.ref,
  ]);
  const reference = "TEST-" + token();
  await db.query(
    "INSERT INTO payments(reference,order_id,amount,created_at) VALUES(?,?,?,?)",
    [reference, o.id, o.total, Date.now()],
  );
  await assert.rejects(() =>
    acceptPayment(db, {
      reference,
      status: "success",
      currency: "NGN",
      amount: 1,
    }),
  );
  assert.equal(
    (await db.one("SELECT payment_status FROM orders WHERE id=?", [o.id]))
      .payment_status,
    "unpaid",
  );
});
test("draft content is private until publication and old version can be restored", async () => {
  const before = (await guest.get("/api/bootstrap")).body.settings;
  const draft = { ...before, tagline: "A test draft." };
  assert.equal(
    (
      await owner
        .put("/api/admin/content")
        .set("x-csrf-token", csrfOwner)
        .send(draft)
    ).status,
    200,
  );
  assert.equal(
    (await guest.get("/api/bootstrap")).body.settings.tagline,
    before.tagline,
  );
  await post(owner, "/admin/content/publish", csrfOwner, {});
  assert.equal(
    (await guest.get("/api/bootstrap")).body.settings.tagline,
    "A test draft.",
  );
  const versions = (await owner.get("/api/admin/content")).body.versions;
  await post(owner, "/admin/content/restore", csrfOwner, {
    id: versions[0].id,
  });
  assert.equal(
    (await owner.get("/api/admin/content")).body.draft.tagline,
    before.tagline,
  );
});
test("invalid banner URLs cannot be published", async () => {
  const draft = structuredClone(defaults);
  draft.banners.home[0].href = "javascript:alert(1)";
  assert.equal(
    (
      await owner
        .put("/api/admin/content")
        .set("x-csrf-token", csrfOwner)
        .send(draft)
    ).status,
    400,
  );
});
test("CSV import preview validates without writing; commit persists zero-stock product", async () => {
  const unique = "IMPORT-" + token().slice(0, 7);
  const buf = Buffer.from(
    `sku,name,category,price\n${unique},Import Test,Whiskey,3000`,
  );
  let r = await owner
    .post("/api/admin/import")
    .set("x-csrf-token", csrfOwner)
    .field("commit", "false")
    .attach("file", buf, "products.csv");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.total, 1);
  assert.ok(!(await db.one("SELECT id FROM products WHERE sku=?", [unique])));
  r = await owner
    .post("/api/admin/import")
    .set("x-csrf-token", csrfOwner)
    .field("commit", "true")
    .attach("file", buf, "products.csv");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const p = await db.one("SELECT * FROM products WHERE sku=?", [unique]);
  assert.equal(p.price, 300000);
  assert.equal(p.stock, 0);
});
test("uploads reject executable and SVG content", async () => {
  const r = await owner
    .post("/api/admin/upload")
    .set("x-csrf-token", csrfOwner)
    .attach("file", Buffer.from('<svg onload="alert(1)"/>'), "image.svg");
  assert.equal(r.status, 400);
});
test("CSV exports mitigate formula execution", () => {
  assert.match(csv([{ name: '=HYPERLINK("bad")' }]), /"'=HYPERLINK/);
});
test("SEO sitemap and robots are available", async () => {
  assert.equal((await guest.get("/sitemap.xml")).status, 200);
  assert.match((await guest.get("/robots.txt")).text, /Disallow: \/admin/);
});
test("SEO renderer emits escaped product metadata and structured product data", async () => {
  const p = await product();
  await db.query("UPDATE products SET name=? WHERE id=?", [
    "Bottle <script>not HTML</script>",
    p.id,
  ]);
  const r = await guest
    .get("/api/render")
    .query({ path: "/product/" + p.slug });
  assert.equal(r.status, 200);
  assert.match(r.text, /Bottle &lt;script&gt;not HTML&lt;\/script&gt;/);
  assert.match(r.text, /application\/ld\+json/);
  assert.doesNotMatch(r.text, /<title>Bottle <script>/);
});
test("late payment with unavailable stock enters review and can later be allocated", async () => {
  const p = await product({ stock: 1 }),
    z = await zone();
  const first = await post(guest, "/orders", csrfGuest, body(p, z));
  await db.query("UPDATE orders SET expires_at=0 WHERE ref=?", [
    first.body.ref,
  ]);
  await expire(db);
  assert.equal(
    (await post(guest, "/orders", csrfGuest, body(p, z))).status,
    201,
  );
  const o = await db.one("SELECT * FROM orders WHERE ref=?", [first.body.ref]);
  const reference = "LATE-" + token();
  await db.query(
    "INSERT INTO payments(reference,order_id,amount,created_at) VALUES(?,?,?,?)",
    [reference, o.id, o.total, Date.now()],
  );
  await acceptPayment(db, {
    reference,
    status: "success",
    currency: "NGN",
    amount: o.total,
  });
  assert.equal(
    (await db.one("SELECT status FROM orders WHERE id=?", [o.id])).status,
    "payment_review",
  );
  assert.equal(
    (await post(owner, "/admin/orders/" + o.ref + "/allocate", csrfOwner, {}))
      .status,
    409,
  );
  await post(owner, "/admin/stock", csrfOwner, {
    productId: p.id,
    delta: 1,
    reason: "Restock for reviewed payment",
  });
  assert.equal(
    (await post(owner, "/admin/orders/" + o.ref + "/allocate", csrfOwner, {}))
      .status,
    200,
  );
  assert.equal(
    (await db.one("SELECT stock FROM products WHERE id=?", [p.id])).stock,
    0,
  );
});
test("additional successful payment is flagged without allocating inventory twice", async () => {
  const p = await product(),
    z = await zone();
  const made = await post(guest, "/orders", csrfGuest, body(p, z));
  const o = await db.one("SELECT * FROM orders WHERE ref=?", [made.body.ref]);
  let last;
  for (let n = 0; n < 2; n++) {
    last = "DOUBLE-" + token();
    await db.query(
      "INSERT INTO payments(reference,order_id,amount,created_at) VALUES(?,?,?,?)",
      [last, o.id, o.total, Date.now()],
    );
    await acceptPayment(db, {
      reference: last,
      status: "success",
      currency: "NGN",
      amount: o.total,
    });
  }
  assert.equal(
    (await db.one("SELECT state FROM payments WHERE reference=?", [last]))
      .state,
    "duplicate_review",
  );
  assert.equal(
    (await db.one("SELECT stock FROM products WHERE id=?", [p.id])).stock,
    19,
  );
});
test("payment initialization reuses an existing checkout URL", async () => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_fixture";
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return {
      ok: true,
      json: async () => ({
        status: true,
        data: { authorization_url: "https://checkout.paystack.com/fixture" },
      }),
    };
  };
  try {
    const p = await product(),
      z = await zone();
    const made = await post(
      guest,
      "/orders",
      csrfGuest,
      body(p, z, { channel: "paystack" }),
    );
    for (let i = 0; i < 2; i++) {
      const r = await guest
        .post("/api/orders/" + made.body.ref + "/pay")
        .set("x-csrf-token", csrfGuest)
        .set("x-order-token", made.body.token)
        .send({});
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.url, "https://checkout.paystack.com/fixture");
    }
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
    delete process.env.PAYSTACK_SECRET_KEY;
  }
});
test("XLSX upload previews products with naira-to-kobo conversion", async () => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  sheet.addRow(["sku", "name", "category", "price"]);
  sheet.addRow([
    "XLSX-" + token().slice(0, 7),
    "Excel product",
    "Whiskey",
    4500,
  ]);
  const r = await owner
    .post("/api/admin/import")
    .set("x-csrf-token", csrfOwner)
    .field("commit", "false")
    .attach(
      "file",
      Buffer.from(await workbook.xlsx.writeBuffer()),
      "products.xlsx",
    );
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.rows[0].price, 450000);
  assert.equal(r.body.errors.length, 0);
});
test("customer editing does not allow escalation of account permissions", async () => {
  const u = await db.one("SELECT id FROM users WHERE email=?", [
    "customer@example.test",
  ]);
  const r = await post(owner, "/admin/customers/" + u.id, csrfOwner, {
    name: "Updated Customer",
    phone: "08060000000",
    business: "Test Company",
    role: "owner",
  });
  assert.equal(r.status, 200);
  const saved = await db.one("SELECT * FROM users WHERE id=?", [u.id]);
  assert.equal(saved.name, "Updated Customer");
  assert.equal(saved.role, "customer");
});
test("SQLite backup is consistent and readable", async () => {
  const backup = join(dir, "backup.sqlite");
  await db.query("VACUUM INTO ?", [backup]);
  const copy = await openDatabase({ url: "", path: backup });
  try {
    assert.equal(
      (await copy.one("SELECT COUNT(*) AS n FROM orders")).n,
      (await db.one("SELECT COUNT(*) AS n FROM orders")).n,
    );
  } finally {
    await copy.close();
  }
});
test("checkout rate limit blocks repeated submissions", async () => {
  for (let i = 0; i < 20; i++)
    assert.equal((await post(guest, "/orders", csrfGuest, {})).status, 400);
  assert.equal((await post(guest, "/orders", csrfGuest, {})).status, 429);
});
