import { body, intParam, notFound, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec, one } from "@/lib/db";
import { regionSchema } from "@/lib/validation";

type P = { id: string };

export const PATCH = route<P>({ permission: "reference.manage" }, async ({ req, user, params }) => {
  const id = intParam(params.id);
  const d = await body(req, regionSchema);
  const before = await one<{ name: string; code: string | null }>("SELECT name, code FROM regions WHERE id = ?", [id]);
  if (!before) notFound("Region");
  await exec("UPDATE regions SET name = ?, code = ? WHERE id = ?", [d.name, d.code, id]);
  await audit(user, { action: "REGION_UPDATE", entityType: "region", entityId: id, summary: `Updated region ${d.name}`, before, after: d });
  return { ok: true };
});

export const DELETE = route<P>({ permission: "reference.manage" }, async ({ user, params }) => {
  const id = intParam(params.id);
  const r = await one<{ name: string }>("SELECT name FROM regions WHERE id = ?", [id]);
  if (!r) notFound("Region");
  await exec("DELETE FROM regions WHERE id = ?", [id]);
  await audit(user, { action: "REGION_DELETE", entityType: "region", entityId: id, summary: `Deleted region ${r.name}` });
  return { ok: true };
});
