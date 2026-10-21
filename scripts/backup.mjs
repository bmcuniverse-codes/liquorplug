import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import { openDatabase } from "../server/db.mjs";
const directory = resolve(process.env.BACKUP_DIRECTORY || "data/backups");
await mkdir(directory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
if (process.env.DATABASE_URL) {
  const u = new URL(process.env.DATABASE_URL);
  const output = join(directory, "liquor-plug-" + stamp + ".dump");
  const env = {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
  };
  if (u.searchParams.get("sslmode"))
    env.PGSSLMODE = u.searchParams.get("sslmode");
  const child = spawn(
    "pg_dump",
    ["--format=custom", "--no-owner", "--file", output],
    { env, stdio: ["ignore", "inherit", "inherit"] },
  );
  await new Promise((yes, no) => {
    child.on("error", no);
    child.on("exit", (code) =>
      code === 0
        ? yes()
        : no(
            Error(
              "pg_dump failed. Install PostgreSQL client tools and check the connection.",
            ),
          ),
    );
  });
  console.log("Backup saved:", output);
} else {
  const output = join(directory, "liquor-plug-" + stamp + ".sqlite");
  const db = await openDatabase();
  try {
    await db.query("VACUUM INTO ?", [output]);
    console.log("Backup saved:", output);
  } finally {
    await db.close();
  }
}
console.log(
  "Also back up uploaded images and environment configuration securely. Test a restore before relying on backups.",
);
