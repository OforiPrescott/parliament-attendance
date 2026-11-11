/**
 * Applies database/schema.sql to the configured PostgreSQL database.
 * Safe to re-run: every statement uses IF NOT EXISTS / ON CONFLICT DO NOTHING.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connectionConfig, pg } from "../src/lib/sql";

/** Creates DB_NAME when it does not exist yet (needs CREATEDB, e.g. the postgres superuser). */
async function ensureDatabase() {
  const name = process.env.DB_NAME;
  if (!name) throw new Error("Set DB_NAME in .env");
  const admin = new pg.Client({ ...connectionConfig(), database: "postgres" });
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!exists.rowCount) {
      await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(name)} ENCODING 'UTF8' TEMPLATE template0`);
      console.log("✔ Created database", name);
    }
  } finally {
    await admin.end();
  }
}

async function main() {
  const client = new pg.Client(connectionConfig());
  try {
    await client.connect();
  } catch (e) {
    if ((e as { code?: string }).code !== "3D000") throw e; // 3D000 = database does not exist
    await ensureDatabase();
    return main();
  }
  const sql = readFileSync(join(process.cwd(), "database", "schema.sql"), "utf8");
  // A parameterless query runs as one multi-statement script.
  await client.query(sql);
  await client.end();
  console.log("✔ Schema applied to", process.env.DB_NAME);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
