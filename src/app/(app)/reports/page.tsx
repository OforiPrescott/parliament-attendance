import type { Metadata } from "next";
import { FileBarChart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { rows } from "@/lib/db";
import { can } from "@/lib/permissions";
import { listMps } from "@/lib/queries";
import { getRefData } from "@/lib/reference";
import { buildReport, REPORT_LABELS } from "@/lib/reports";
import { reportFilterSchema } from "@/lib/validation";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ReportTable } from "./report-table";
import { ReportControls } from "./controls";

export const metadata: Metadata = { title: "Reports & analytics" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser("reports.view");
  const raw = await searchParams;
  const year = new Date().getUTCFullYear();
  // Default to the current year; an explicitly empty "from" (the "All time" preset) means no lower bound.
  const withDefaults: Record<string, string> = {
    ...raw,
    from: "from" in raw ? raw.from : `${year}-01-01`,
    to: "to" in raw ? raw.to : new Date().toISOString().slice(0, 10),
  };
  const parsed = reportFilterSchema.safeParse(Object.fromEntries(Object.entries(withDefaults).filter(([, v]) => v)));
  const f = parsed.success ? parsed.data : reportFilterSchema.parse({});

  const [ref, mps, sittings, report] = await Promise.all([
    getRefData(),
    listMps({ pageSize: 500, status: undefined }),
    rows<{ id: number; title: string; sitting_date: string }>(
      "SELECT id, title, sitting_date FROM sittings WHERE register_status = 'APPROVED' ORDER BY sitting_date DESC, start_time DESC LIMIT 300",
    ),
    buildReport({ ...f, format: "json" }),
  ]);

  return (
    <>
      <PageHeader eyebrow="Overview" title="Reports & analytics"
        description="Attendance reports from approved registers. Choose a report, refine the filters, then export to PDF or Excel." />
      <ReportControls
        filters={{ ...f, from: f.from ?? "", to: f.to ?? "" }}
        labels={REPORT_LABELS}
        canExport={can(user.permissions, "reports.export")}
        ref_={{ parties: ref.parties, regions: ref.regions, constituencies: ref.constituencies }}
        mps={mps.items.map((m) => ({ id: m.id, name: `${m.full_name} — ${m.constituency_name ?? "former"}` }))}
        sittings={sittings.map((s) => ({ id: s.id, name: `${s.sitting_date} · ${s.title}` }))}
      />
      {report.rows.length ? (
        <ReportTable report={report} />
      ) : (
        <Card><EmptyState icon={FileBarChart} title="No approved attendance matches these filters">Widen the date range or clear a filter.</EmptyState></Card>
      )}
    </>
  );
}
