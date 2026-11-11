import { body, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec } from "@/lib/db";
import { listConstituencies } from "@/lib/queries";
import { constituencySchema } from "@/lib/validation";

export const GET = route({ permission: ["mps.view", "reports.view"] }, async () => listConstituencies());

export const POST = route({ permission: "reference.manage" }, async ({ req, user }) => {
  const d = await body(req, constituencySchema);
  const r = await exec("INSERT INTO constituencies (name, region_id, code, is_active) VALUES (?,?,?,?)", [d.name, d.regionId, d.code, d.isActive]);
  await audit(user, { action: "CONSTITUENCY_CREATE", entityType: "constituency", entityId: r.insertId, summary: `Added constituency ${d.name}`, after: d });
  return { id: r.insertId };
});
