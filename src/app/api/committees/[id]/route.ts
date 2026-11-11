import { body, intParam, notFound, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec, one } from "@/lib/db";
import { committeeSchema } from "@/lib/validation";

type P = { id: string };

export const PATCH = route<P>({ permission: "sittings.manage" }, async ({ req, user, params }) => {
  const id = intParam(params.id);
  const d = await body(req, committeeSchema);
  const before = await one<{ name: string; type: string; is_active: number }>("SELECT name, type, is_active FROM committees WHERE id = ?", [id]);
  if (!before) notFound("Committee");
  await exec("UPDATE committees SET name=?, type=?, is_active=? WHERE id=?", [d.name, d.type, d.isActive, id]);
  await audit(user, { action: "COMMITTEE_UPDATE", entityType: "committee", entityId: id, summary: `Updated ${d.name}`, before, after: d });
  return { ok: true };
});

export const DELETE = route<P>({ permission: "sittings.manage" }, async ({ user, params }) => {
  const id = intParam(params.id);
  const c = await one<{ name: string }>("SELECT name FROM committees WHERE id = ?", [id]);
  if (!c) notFound("Committee");
  await exec("DELETE FROM committees WHERE id = ?", [id]); // blocked by FK if it has sittings
  await audit(user, { action: "COMMITTEE_DELETE", entityType: "committee", entityId: id, summary: `Deleted ${c.name}` });
  return { ok: true };
});
