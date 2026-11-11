import "server-only";
import { connectionConfig, execOn, pg, rowsOn, type ExecResult } from "./sql";

/**
 * All SQL in this application uses `?` placeholders, translated to PostgreSQL
 * `$n` parameters in ./sql.ts. Every value is bound, so user input is never
 * concatenated into SQL text. The few identifiers that vary (sort columns,
 * GROUP BY expressions) come from fixed allow-lists in code, never from the request.
 */
const globalForDb = globalThis as unknown as { __paPool?: pg.Pool };

function createPool(): pg.Pool {
  const p = new pg.Pool({ ...connectionConfig(), max: Number(process.env.DB_CONNECTION_LIMIT ?? 10) });
  // An idle client losing its connection must not crash the process.
  p.on("error", (e) => console.error("[db] idle client error", e));
  return p;
}

export const pool: pg.Pool = globalForDb.__paPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__paPool = pool;

export type Executor = pg.Pool | pg.PoolClient;
export type { ExecResult };

export function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = [], ex: Executor = pool): Promise<T[]> {
  return rowsOn<T>(ex, sql, params);
}

export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = [], ex: Executor = pool): Promise<T | null> {
  const r = await rows<T>(sql, params, ex);
  return r[0] ?? null;
}

export function exec(sql: string, params: unknown[] = [], ex: Executor = pool): Promise<ExecResult> {
  return execOn(ex, sql, params);
}

export async function transaction<T>(fn: (conn: pg.PoolClient) => Promise<T>): Promise<T> {
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    const result = await fn(conn);
    await conn.query("COMMIT");
    return result;
  } catch (e) {
    await conn.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}
