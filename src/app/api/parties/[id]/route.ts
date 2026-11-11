import { body, intParam, notFound, route } from "@/lib/api";
import { audit, diff } from "@/lib/audit";
import { exec, one } from "@/lib/db";
import { partySchema } from "@/lib/validation";

type P = { id: string };

export const PATCH = route<P>({ permission: "reference.manage" }, async ({ req, user, params }) => {
  const id = intParam(params.id);
  const d = await body(req, partySchema);
  const before = await one<Record<string, unknown>>("SELECT name, abbreviation, color, is_active FROM parties WHERE id = ?", [id]);
  if (!before) notFound("Party");
  await exec("UPDATE parties SET name=?, abbreviation=?, color=?, is_active=? WHERE id=?", [d.name, d.abbreviation, d.color, d.isActive, id]);
  const ch = diff(before, { name: d.name, abbreviation: d.abbreviation, color: d.color, is_active: d.isActive ? 1 : 0 });
  await audit(user, { action: "PARTY_UPDATE", entityType: "party", entityId: id, summary: `Updated party ${d.abbreviation}`, before: ch.before, after: ch.after });
  return { ok: true };
});

export const DELETE = route<P>({ permission: "reference.manage" }, async ({ user, params }) => {
  const id = intParam(params.id);
  const p = await one<{ abbreviation: string }>("SELECT abbreviation FROM parties WHERE id = ?", [id]);
  if (!p) notFound("Party");
  await exec("DELETE FROM parties WHERE id = ?", [id]); // FK RESTRICT blocks deletion if referenced
  await audit(user, { action: "PARTY_DELETE", entityType: "party", entityId: id, summary: `Deleted party ${p.abbreviation}` });
  return { ok: true };
});
