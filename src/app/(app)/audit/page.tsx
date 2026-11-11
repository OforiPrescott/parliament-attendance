import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listAudit } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { DateFilter, FilterSelect, SearchBox } from "@/components/filters";
import { AuditRows, AuditExport } from "./audit-rows";

export const metadata: Metadata = { title: "Audit trail" };

type SP = { q?: string; action?: string; entityType?: string; from?: string; to?: string; page?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser("audit.view");
  const sp = await searchParams;
  const data = await listAudit({ q: sp.q, action: sp.action, entityType: sp.entityType, from: sp.from, to: sp.to, page: Number(sp.page) || 1, pageSize: 50 });
  const qs = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    q.set("page", String(p));
    return `/audit?${q}`;
  };
  return (
    <>
      <PageHeader eyebrow="Administration" title="Audit trail"
        description="An append-only record of every sign-in, change, approval and export, with before-and-after values."
        actions={<AuditExport params={Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page")) as Record<string, string>} />} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          <SearchBox placeholder="Search summary, user or record ID" />
          <FilterSelect param="action" label="All actions" options={data.actions.map((a) => ({ value: a, label: a.replace(/_/g, " ").toLowerCase() }))} />
          <FilterSelect param="entityType" label="All records" options={data.entities.map((a) => ({ value: a, label: a.replace(/_/g, " ") }))} />
          <DateFilter param="from" label="From" />
          <DateFilter param="to" label="To" />
        </div>
        {data.items.length ? <AuditRows items={data.items} /> : <EmptyState icon={ScrollText} title="No audit entries match" />}
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={qs} />
      </Card>
    </>
  );
}
