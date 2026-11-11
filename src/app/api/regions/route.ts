import { body, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec } from "@/lib/db";
import { listRegions } from "@/lib/queries";
import { regionSchema } from "@/lib/validation";

export const GET = route({ permission: ["mps.view", "reports.view"] }, async () => listRegions());

export const POST = route({ permission: "reference.manage" }, async ({ req, user }) => {
  const d = await body(req, regionSchema);
  const r = await exec("INSERT INTO regions (name, code) VALUES (?, ?)", [d.name, d.code]);
  await audit(user, { action: "REGION_CREATE", entityType: "region", entityId: r.insertId, summary: `Added region ${d.name}` });
  return { id: r.insertId };
});
