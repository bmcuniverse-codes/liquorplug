import { openDatabase } from "./db.mjs";
import { migrate, seed } from "./setup.mjs";
import { createApp } from "./app.mjs";
import { configurationError } from "./config.mjs";
let instance;
export function getApp() {
  if (instance) return instance;
  instance = (async () => {
    if (process.env.VERCEL && !process.env.DATABASE_URL)
      throw configurationError('DATABASE_REQUIRED','Set DATABASE_URL to the Supabase PostgreSQL connection string in Vercel, then redeploy.');
    const db = await openDatabase();
    try {
    await migrate(db);
    if (!(await db.one("SELECT id FROM content WHERE id='published'")))
      await seed(db, {
        ownerEmail: process.env.OWNER_EMAIL,
        ownerPassword: process.env.OWNER_PASSWORD,
      });
    return createApp(db, { production: process.env.NODE_ENV === "production" || process.argv.includes('--production') || !!process.env.VERCEL });
    } catch(error) { await db.close().catch(()=>{}); throw error; }
  })().catch(error => { instance=undefined; throw error; });
  return instance;
}
