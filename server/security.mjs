import {
  randomBytes,
  createHash,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
export const id = () => randomUUID();
export const token = () => randomBytes(32).toString("hex");
export const hash = (s) => createHash("sha256").update(s).digest("hex");
export function same(a, b) {
  return (
    typeof a === "string" &&
    typeof b === "string" &&
    a.length === b.length &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
export const staff = (u) => ["owner", "manager", "staff"].includes(u?.role);
export const manager = (u) => ["owner", "manager"].includes(u?.role);
export const wholesale = (u) => u?.wholesale_status === "approved";
export async function audit(db, user, action, detail) {
  await db.query(
    "INSERT INTO audit_log(id,actor,action,detail,created_at) VALUES(?,?,?,?,?)",
    [
      id(),
      user?.email || "system",
      action,
      typeof detail === "string" ? detail : JSON.stringify(detail),
      Date.now(),
    ],
  );
}
export async function throttle(db, key, max, period) {
  await db.tx(async () => {
    const b = await db.one("SELECT * FROM rate_buckets WHERE key=?", [key]);
    const now = Date.now();
    if (!b || Number(b.reset_at) < now)
      await db.query(
        "INSERT INTO rate_buckets(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,reset_at=excluded.reset_at",
        [key, now + period],
      );
    else {
      if (b.count >= max)
        fail(429, "Too many attempts. Please try again later.");
      await db.query("UPDATE rate_buckets SET count=count+1 WHERE key=?", [
        key,
      ]);
    }
  });
}
export function csv(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const escape = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  return (
    "\uFEFF" +
    [keys, ...rows.map((r) => keys.map((k) => r[k]))]
      .map((r) => r.map(escape).join(","))
      .join("\r\n")
  );
}
export function safeLink(v) {
  if(typeof v!=='string'||/[\\\u0000-\u001f\u007f]/.test(v))return false;
  if(v.startsWith('/')&&!v.startsWith('//'))return true;
  if(!/^https:\/\//i.test(v))return false;
  try{const url=new URL(v);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password;}catch{return false;}
}
