import { body, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec } from "@/lib/db";
import { committeeSchema } from "@/lib/validation";

export const POST = route({ permission: "sittings.manage" }, async ({ req, user }) => {
  const d = await body(req, committeeSchema);
  const r = await exec("INSERT INTO committees (name, type, is_active) VALUES (?,?,?)", [d.name, d.type, d.isActive]);
  await audit(user, { action: "COMMITTEE_CREATE", entityType: "committee", entityId: r.insertId, summary: `Added ${d.name}`, after: d });
  return { id: r.insertId };
});
