import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { defaults, lgas } from "./defaults.mjs";
export async function migrate(db) {
  const schema = await readFile(
    new URL("./schema.sql", import.meta.url),
    "utf8",
  );
  for (const statement of schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await db.query(statement);
  if (db.postgres)
    await db.query(
      await readFile(
        new URL("./postgres-security.sql", import.meta.url),
        "utf8",
      ),
    );
  await db.query(
    "INSERT INTO migrations(version,applied_at) VALUES(1,?) ON CONFLICT(version) DO NOTHING",
    [Date.now()],
  );
}
export async function seed(
  db,
  { ownerEmail, ownerPassword, demoStock = false } = {},
) {
  await db.tx(async () => {
    if (!(await db.one("SELECT id FROM content WHERE id=?", ["published"])))
      for (const id of ["published", "draft"])
        await db.query(
          "INSERT INTO content(id,data,updated_at) VALUES(?,?,?)",
          [id, JSON.stringify(defaults), Date.now()],
        );
    if (!(await db.one("SELECT id FROM zones LIMIT 1")))
      for (const lga of lgas)
        await db.query("INSERT INTO zones(id,lga) VALUES(?,?)", [
          randomUUID(),
          lga,
        ]);
    let catalog;
    try {
      catalog = JSON.parse(
        await readFile(
          new URL("../data/catalogue.json", import.meta.url),
          "utf8",
        ),
      );
    } catch {
      catalog = { products: [], brands: [], categories: [] };
    }
    for (const kind of ["categories", "brands"])
      for (const row of catalog[kind] || [])
        await db.query(
          "INSERT INTO taxonomy(id,kind,name,slug,image) VALUES(?,?,?,?,?) ON CONFLICT(kind,slug) DO NOTHING",
          [
            randomUUID(),
            kind,
            row.name,
            row.slug,
            row.image ||
              (catalog.products || []).find(
                (p) =>
                  (kind === "categories" ? p.category : p.brand) === row.name &&
                  p.image !== "/placeholder.svg",
              )?.image ||
              "/placeholder.svg",
          ],
        );
    for (const [i, p] of (catalog.products || []).entries()) {
      await db.query(
        "INSERT INTO products(id,slug,sku,name,category,brand,size,price,stock,featured,image,source_url,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO NOTHING",
        [
          p.id || randomUUID(),
          p.slug,
          `LP-${String(i + 1).padStart(5, "0")}`,
          p.name.split("|")[0].trim(),
          p.category || "Other",
          p.brand || "",
          p.size || "",
          Math.round((Number(p.price) || 0) * 100),
          demoStock ? 24 : 0,
          p.image && p.image !== "/placeholder.svg" ? 1 : 0,
          p.image || "/placeholder.svg",
          p.source_url || "",
          Date.now(),
        ],
      );
    }
    if (ownerEmail && ownerPassword) {
      if (ownerPassword.length < 12)
        throw Error("OWNER_PASSWORD must contain at least 12 characters");
      if (
        !(await db.one("SELECT id FROM users WHERE email=?", [
          ownerEmail.toLowerCase(),
        ]))
      )
        await db.query(
          "INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)",
          [
            randomUUID(),
            ownerEmail.toLowerCase(),
            "Store Owner",
            await bcrypt.hash(ownerPassword, 12),
            "owner",
            Date.now(),
          ],
        );
    }
  });
}
