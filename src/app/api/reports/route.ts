import { ApiError, query, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { fileName, toPdf, toXlsx } from "@/lib/export";
import { can } from "@/lib/permissions";
import { buildReport } from "@/lib/reports";
import { getSettings } from "@/lib/settings";
import { reportFilterSchema } from "@/lib/validation";

export const GET = route({ permission: "reports.view" }, async ({ req, user }) => {
  const f = query(req, reportFilterSchema);
  if (f.from && f.to && f.from > f.to) throw new ApiError(400, "'From' date must be before 'To' date.");
  const report = await buildReport(f);
  if (f.format === "json") return report;

  if (!can(user.permissions, "reports.export")) throw new ApiError(403, "You do not have permission to export reports.");
  const s = await getSettings();
  const meta = { institution: s.institution_name, generatedBy: user.fullName };
  await audit(user, { action: "REPORT_EXPORT", entityType: "report", entityId: f.type, summary: `Exported ${report.title} (${f.format.toUpperCase()}) — ${report.subtitle}` });

  if (f.format === "pdf") {
    return new Response(new Uint8Array(toPdf(report, meta)), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileName(report.title, "pdf")}"` },
    });
  }
  return new Response(new Uint8Array(await toXlsx(report, meta)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName(report.title, "xlsx")}"`,
    },
  });
});
