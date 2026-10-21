import { getApp } from "./runtime.mjs";
import express from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderPage } from "./seo.mjs";
const app = await getApp();
const production =
  process.env.NODE_ENV === "production" ||
  process.argv.includes("--production");
if (production) {
  app.use(express.static(resolve("dist"), { index: false }));
  app.get("/{*path}", async (req, res, next) => {
    try {
      res.type("html").send(await renderPage(app.locals.db, req.originalUrl));
    } catch (e) {
      next(e);
    }
  });
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true, allowedHosts: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () =>
  console.log(`Liquor Plug available on port ${port}`),
);
if (!process.env.OWNER_EMAIL)
  console.log(
    "Run npm run db:setup after setting OWNER_EMAIL and OWNER_PASSWORD to create your owner account.",
  );
setInterval(async () => {
  try {
    const { expire } = await import("./orders.mjs");
    const { drainMail } = await import("./mail.mjs");
    const { openDatabase } = await import("./db.mjs");
    const db = await openDatabase();
    try {
      await expire(db);
      await drainMail(db);
    } finally {
      await db.close();
    }
  } catch (e) {
    console.error("Maintenance failed:", e.name);
  }
}, 60000).unref();
