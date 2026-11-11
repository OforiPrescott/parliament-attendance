import "server-only";
import { exec, type Executor, pool } from "./db";
import { clientInfo, type SessionUser } from "./auth";

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string | number | null;
  summary: string;
  before?: unknown;
  after?: unknown;
};

/** Append-only audit log. Pass the transaction connection when inside one. */
export async function audit(user: Pick<SessionUser, "id" | "username"> | null, e: AuditEntry, ex: Executor = pool) {
  const { ip, userAgent } = await clientInfo();
  await exec(
    `INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, summary, before_data, after_data, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user?.id ?? null,
      user?.username ?? null,
      e.action,
      e.entityType,
      e.entityId == null ? null : String(e.entityId),
      e.summary.slice(0, 500),
      e.before === undefined ? null : JSON.stringify(e.before),
      e.after === undefined ? null : JSON.stringify(e.after),
      ip,
      userAgent,
    ],
    ex,
  );
}

/** Returns only the fields that changed, for compact before/after records. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    if (after[k] !== undefined && String(before[k] ?? "") !== String(after[k] ?? "")) {
      b[k] = before[k];
      a[k] = after[k];
    }
  }
  return { before: b, after: a, changed: Object.keys(a) };
}
