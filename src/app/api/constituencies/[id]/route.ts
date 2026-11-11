import { body, intParam, notFound, route } from "@/lib/api";
import { audit, diff } from "@/lib/audit";
import { exec, one } from "@/lib/db";
import { constituencySchema } from "@/lib/validation";

type P = { id: string };

export const PATCH = route<P>({ permission: "reference.manage" }, async ({ req, user, params }) => {
  const id = intParam(params.id);
  const d = await body(req, constituencySchema);
  const before = await one<Record<string, unknown>>("SELECT name, region_id, code, is_active FROM constituencies WHERE id = ?", [id]);
  if (!before) notFound("Constituency");
  await exec("UPDATE constituencies SET name=?, region_id=?, code=?, is_active=? WHERE id=?", [d.name, d.regionId, d.code, d.isActive, id]);
  const ch = diff(before, { name: d.name, region_id: d.regionId, code: d.code, is_active: d.isActive ? 1 : 0 });
  await audit(user, { action: "CONSTITUENCY_UPDATE", entityType: "constituency", entityId: id, summary: `Updated constituency ${d.name}`, before: ch.before, after: ch.after });
  return { ok: true };
});

export const DELETE = route<P>({ permission: "reference.manage" }, async ({ user, params }) => {
  const id = intParam(params.id);
  const c = await one<{ name: string }>("SELECT name FROM constituencies WHERE id = ?", [id]);
  if (!c) notFound("Constituency");
  await exec("DELETE FROM constituencies WHERE id = ?", [id]);
  await audit(user, { action: "CONSTITUENCY_DELETE", entityType: "constituency", entityId: id, summary: `Deleted constituency ${c.name}` });
  return { ok: true };
});
