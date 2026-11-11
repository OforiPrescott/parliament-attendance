import { body, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec } from "@/lib/db";
import { listParties } from "@/lib/queries";
import { partySchema } from "@/lib/validation";

export const GET = route({ permission: ["mps.view", "reports.view"] }, async () => listParties());

export const POST = route({ permission: "reference.manage" }, async ({ req, user }) => {
  const d = await body(req, partySchema);
  const r = await exec("INSERT INTO parties (name, abbreviation, color, is_active) VALUES (?,?,?,?)", [d.name, d.abbreviation, d.color, d.isActive]);
  await audit(user, { action: "PARTY_CREATE", entityType: "party", entityId: r.insertId, summary: `Added party ${d.abbreviation}`, after: d });
  return { id: r.insertId };
});
