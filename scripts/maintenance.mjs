import { openDatabase } from "../server/db.mjs";
import { expire } from "../server/orders.mjs";
import { drainMail } from "../server/mail.mjs";
const db = await openDatabase();
try {
  const expired = await expire(db),
    mail = await drainMail(db);
  for (const table of ["sessions", "password_resets"])
    await db.query(`DELETE FROM ${table} WHERE expires_at<?`, [Date.now()]);
  await db.query("DELETE FROM rate_buckets WHERE reset_at<?", [Date.now()]);
  console.log({ expired, mail });
} finally {
  await db.close();
}
