/**
 * Shared PostgreSQL plumbing for the app (src/lib/db.ts) and the CLI scripts.
 *
 * Application SQL is written with `?` placeholders. `toPg` rewrites them to
 * PostgreSQL's `$1, $2, …` and flattens the parameter list:
 *   - an array of arrays expands to row tuples   VALUES ?      -> VALUES ($1,$2),($3,$4)
 *   - a flat array expands to a list             IN (?)        -> IN ($1,$2,$3)
 *   - booleans become 1/0 (flag columns are SMALLINT 0/1)
 *   - undefined becomes NULL
 * Values are always sent as bound parameters, never spliced into SQL text.
 */
import pg from "pg";

// Return DATE / TIMESTAMP / TIME as the plain strings stored ('YYYY-MM-DD',
// 'YYYY-MM-DD hh:mm:ss') instead of JS Dates, so there is no timezone drift.
// BIGINT (COUNT(*), BIGINT ids) and NUMERIC (SUM over BIGINT) become numbers.
const raw = (v: string) => v;
pg.types.setTypeParser(pg.types.builtins.DATE, raw);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, raw);
pg.types.setTypeParser(pg.types.builtins.TIME, raw);
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));

export function connectionConfig(): pg.PoolConfig {
  return {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
    // Ghana is UTC+0 all year; LOCALTIMESTAMP / CURRENT_DATE are evaluated in UTC.
    options: "-c timezone=UTC",
  };
}

const norm = (v: unknown) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

export function toPg(sql: string, params: unknown[] = []): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const bind = (v: unknown) => {
    values.push(norm(v));
    return `$${values.length}`;
  };
  let out = "";
  let p = 0;
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch !== "?") {
      out += ch;
      continue;
    }
    if (p >= params.length) throw new Error(`SQL has more placeholders than parameters: ${sql.slice(0, 120)}`);
    const v = params[p++];
    if (Array.isArray(v) && v.length && Array.isArray(v[0])) out += (v as unknown[][]).map((r) => `(${r.map(bind).join(",")})`).join(",");
    else if (Array.isArray(v)) out += v.length ? v.map(bind).join(",") : "NULL";
    else out += bind(v);
  }
  if (p !== params.length) throw new Error(`SQL has ${p} placeholders but ${params.length} parameters: ${sql.slice(0, 120)}`);
  return { text: out, values };
}

/** Tables whose primary key is not an `id` column — INSERTs into them do not return an id. */
const NO_ID = new Set(["settings", "user_sessions"]);
const INSERT_RE = /^\s*INSERT\s+INTO\s+([a-z_]+)/i;

export type ExecResult = { insertId: number; affectedRows: number };

/** INSERT/UPDATE/DELETE. For INSERTs, `insertId` is the new row's id (first row when several are inserted). */
export async function execOn(client: pg.Pool | pg.PoolClient | pg.Client, sql: string, params: unknown[] = []): Promise<ExecResult> {
  const m = INSERT_RE.exec(sql);
  const wantId = m && !NO_ID.has(m[1].toLowerCase()) && !/\bRETURNING\b/i.test(sql);
  const { text, values } = toPg(wantId ? `${sql} RETURNING id` : sql, params);
  const r = await client.query(text, values);
  const id = wantId ? r.rows[0]?.id : undefined;
  return { insertId: id === undefined ? 0 : Number(id), affectedRows: r.rowCount ?? 0 };
}

export async function rowsOn<T>(client: pg.Pool | pg.PoolClient | pg.Client, sql: string, params: unknown[] = []): Promise<T[]> {
  const { text, values } = toPg(sql, params);
  return (await client.query(text, values)).rows as T[];
}

/** PostgreSQL SQLSTATE codes the app reacts to. */
export const PG = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_VIOLATION: "23514",
} as const;

export { pg };
