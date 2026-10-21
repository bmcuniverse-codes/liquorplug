import { openDatabase } from "./db.mjs";
import { migrate, seed } from "./setup.mjs";
import { createApp } from "./app.mjs";
let instance;
export function getApp() {
  return (instance ??= (async () => {
    if (process.env.VERCEL && !process.env.DATABASE_URL)
      throw Error("Vercel requires DATABASE_URL (PostgreSQL).");
    const db = await openDatabase();
    await migrate(db);
    if (!(await db.one("SELECT id FROM content WHERE id='published'")))
      await seed(db, {
        ownerEmail: process.env.OWNER_EMAIL,
        ownerPassword: process.env.OWNER_PASSWORD,
      });
    return createApp(db, { production: process.env.NODE_ENV === "production" });
  })());
}
