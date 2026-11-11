import { ApiError, intParam, notFound, route } from "@/lib/api";
import { audit, diff } from "@/lib/audit";
import { exec, one, transaction } from "@/lib/db";
import { kindOf, validate } from "../../_shared";

type P = { kind: string; id: string };

export const PATCH = route<P>({ permission: "sittings.manage" }, async ({ req, user, params }) => {
  const def = kindOf(params.kind);
  const id = intParam(params.id);
  const cols = validate(params.kind, await req.json().catch(() => { throw new ApiError(400, "Invalid JSON"); }));
  const before = await one<Record<string, unknown>>(`SELECT * FROM ${def.table} WHERE id = ?`, [id]);
  if (!before) notFound(def.label);
  await transaction(async (tx) => {
    if (def.table === "parliaments" && cols.is_current) await exec("UPDATE parliaments SET is_current = 0 WHERE id <> ?", [id], tx);
    const keys = Object.keys(cols);
    await exec(`UPDATE ${def.table} SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`, [...keys.map((k) => cols[k]), id], tx);
    const ch = diff(before, cols);
    await audit(user, { action: `${def.label.toUpperCase()}_UPDATE`, entityType: def.table, entityId: id, summary: `Updated ${def.label.toLowerCase()} '${cols.name}'`, before: ch.before, after: ch.after }, tx);
  });
  return { ok: true };
});

export const DELETE = route<P>({ permission: "sittings.manage" }, async ({ user, params }) => {
  const def = kindOf(params.kind);
  const id = intParam(params.id);
  const row = await one<{ name: string }>(`SELECT name FROM ${def.table} WHERE id = ?`, [id]);
  if (!row) notFound(def.label);
  if (def.table === "meetings") {
    const n = await one<{ n: number }>("SELECT COUNT(*) n FROM sittings WHERE meeting_id = ?", [id]);
    if (n?.n) throw new ApiError(409, `This meeting has ${n.n} sittings. Remove or move them first.`);
  }
  await exec(`DELETE FROM ${def.table} WHERE id = ?`, [id]);
  await audit(user, { action: `${def.label.toUpperCase()}_DELETE`, entityType: def.table, entityId: id, summary: `Deleted ${def.label.toLowerCase()} '${row.name}'` });
  return { ok: true };
});
