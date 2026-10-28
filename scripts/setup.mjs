import { openDatabase } from "../server/db.mjs";
import { migrate, seed } from "../server/setup.mjs";
if (!process.env.OWNER_EMAIL || !process.env.OWNER_PASSWORD) {
  console.error(
    "Set OWNER_EMAIL and a unique OWNER_PASSWORD (12+ characters) in .env first.",
  );
  process.exit(1);
}
const db = await openDatabase();
try {
  await migrate(db);
  await seed(db, {
    ownerEmail: process.env.OWNER_EMAIL,
    ownerPassword: process.env.OWNER_PASSWORD,
  });
  console.log(
    "Database ready. Catalogue ready with 10 opening units per new product. Existing stores receive the one-time minimum-stock upgrade. Set wholesale prices and enable delivery zones in admin.",
  );
} finally {
  await db.close();
}
