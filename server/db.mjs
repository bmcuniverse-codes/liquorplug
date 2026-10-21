import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import pg from "pg";
pg.types.setTypeParser(20, (value) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n))
    throw Error("Integer exceeds the supported range");
  return n;
});
const context = new AsyncLocalStorage();
export async function openDatabase(options = {}) {
  const url = options.url ?? process.env.DATABASE_URL;
  let sqlite, pool;
  if (url) {
    pool = new pg.Pool({
      connectionString: url,
      max: 5,
      ssl:
        process.env.DATABASE_SSL === "true"
          ? { rejectUnauthorized: true }
          : undefined,
    });
  } else {
    const { DatabaseSync } = await import("node:sqlite");
    const path = resolve(
      options.path ?? process.env.SQLITE_PATH ?? "data/liquor-plug.sqlite",
    );
    mkdirSync(dirname(path), { recursive: true });
    sqlite = new DatabaseSync(path);
    sqlite.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
  }
  let tail = Promise.resolve();
  async function exclusive(fn) {
    const previous = tail;
    let release;
    tail = new Promise((r) => (release = r));
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
  function pgSql(sql) {
    let n = 0;
    return sql.replace(/\?/g, () => `$${++n}`);
  }
  async function run(sql, args = [], conn) {
    if (pool) {
      const r = await (conn || pool).query(pgSql(sql), args);
      return { rows: r.rows, changes: r.rowCount };
    }
    const statement = sqlite.prepare(sql);
    if (/^\s*(SELECT|PRAGMA|WITH)/i.test(sql) || /\bRETURNING\b/i.test(sql))
      return { rows: statement.all(...args), changes: 0 };
    return { rows: [], changes: statement.run(...args).changes };
  }
  const db = {
    postgres: !!pool,
    async query(sql, args = []) {
      const tx = context.getStore();
      if (tx?.db === db) return run(sql, args, tx.conn);
      if (sqlite) return exclusive(() => run(sql, args));
      return run(sql, args);
    },
    async all(sql, args = []) {
      return (await db.query(sql, args)).rows;
    },
    async one(sql, args = []) {
      return (await db.all(sql, args))[0];
    },
    async tx(fn) {
      if (context.getStore()?.db === db) return fn(db);
      const perform = async () => {
        const conn = pool ? await pool.connect() : null;
        try {
          await run("BEGIN", [], conn);
          if (pool)
            await run("SELECT pg_advisory_xact_lock(7643821)", [], conn);
          const value = await context.run({ db, conn }, () => fn(db));
          await run("COMMIT", [], conn);
          return value;
        } catch (e) {
          await run("ROLLBACK", [], conn);
          throw e;
        } finally {
          conn?.release();
        }
      };
      return sqlite ? exclusive(perform) : perform();
    },
    async close() {
      if (pool) await pool.end();
      else sqlite.close();
    },
  };
  return db;
}
