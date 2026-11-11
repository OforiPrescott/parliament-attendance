import { z } from "zod";
import { ApiError, query, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { fileName, toXlsx } from "@/lib/export";
import { listAudit } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { fmtDateTime } from "@/lib/utils";

const q = z.object({
  q: z.string().max(100).optional(), action: z.string().max(60).optional(), entityType: z.string().max(40).optional(),
  userId: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().optional(), format: z.enum(["json", "xlsx"]).default("json"),
});

export const GET = route({ permission: "audit.view" }, async ({ req, user }) => {
  const f = query(req, q);
  if (f.format === "json") return listAudit({ ...f, pageSize: 50 });
  const data = await listAudit({ ...f, page: 1, pageSize: 1000 });
  if (data.total > 1000) throw new ApiError(400, `That filter matches ${data.total.toLocaleString("en-GB")} entries. Narrow the date range to 1,000 or fewer to export.`);
  const s = await getSettings();
  const report = {
    title: "Audit trail", subtitle: [f.from, f.to].filter(Boolean).join(" to ") || "All dates",
    columns: [
      { key: "time", label: "Time" }, { key: "username", label: "User" }, { key: "action", label: "Action" },
      { key: "entity", label: "Record" }, { key: "summary", label: "Summary" }, { key: "ip", label: "IP address" },
    ],
    rows: data.items.map((i) => ({ time: fmtDateTime(i.created_at), username: i.username ?? "system", action: i.action, entity: `${i.entity_type}${i.entity_id ? ` #${i.entity_id}` : ""}`, summary: i.summary, ip: i.ip_address ?? "" })),
    summary: [{ label: "Entries", value: String(data.total) }],
  };
  await audit(user, { action: "AUDIT_EXPORT", entityType: "audit", summary: `Exported ${data.total} audit entries` });
  return new Response(new Uint8Array(await toXlsx(report, { institution: s.institution_name, generatedBy: user.fullName })), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName("audit-trail", "xlsx")}"`,
    },
  });
});
