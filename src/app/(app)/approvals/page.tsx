import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FileCheck2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listCorrections, listSubmittedRegisters } from "@/lib/queries";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { LinkTabs } from "@/components/ui/tabs";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { CorrectionList } from "./correction-list";

export const metadata: Metadata = { title: "Review & approval" };

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser(["attendance.review", "corrections.review", "corrections.request"]);
  const tabParam = (await searchParams).tab;
  const tab = tabParam === "corrections" || tabParam === "history" ? tabParam : "registers";
  const [registers, pending, history] = await Promise.all([
    listSubmittedRegisters(),
    listCorrections("PENDING"),
    tab === "history" ? listCorrections("ALL") : Promise.resolve([]),
  ]);
  const review = can(user.permissions, "attendance.review");

  return (
    <>
      <PageHeader eyebrow="Attendance" title="Review & approval"
        description="Registers become official — and count in reports — only once a reviewer approves them. Reviewers cannot approve their own submissions." />
      <LinkTabs active={tab} tabs={[
        { key: "registers", label: "Registers awaiting approval", href: "/approvals", count: registers.length },
        { key: "corrections", label: "Correction requests", href: "/approvals?tab=corrections", count: pending.length },
        { key: "history", label: "Correction history", href: "/approvals?tab=history" },
      ]} />

      {tab === "registers" && (
        <Card>
          {registers.length ? (
            <Table>
              <THead><tr><TH>Sitting</TH><TH>Date</TH><TH>Submitted by</TH><TH className="text-right">Recorded</TH><TH className="text-right">Present</TH><TH className="text-right">Absent</TH><TH /></tr></THead>
              <TBody>
                {registers.map((r) => (
                  <TR key={r.id}>
                    <TD><div className="font-medium">{r.title}</div><div className="text-[12px] text-muted-foreground">{r.committee_name ?? r.sitting_type.toLowerCase()}</div></TD>
                    <TD className="whitespace-nowrap">{fmtDate(r.sitting_date)}</TD>
                    <TD><div>{r.submitted_by_name ?? "—"}</div><div className="text-[12px] text-muted-foreground">{fmtDateTime(r.submitted_at)}</div></TD>
                    <TD className="num text-right">{r.recorded}</TD>
                    <TD className="num text-right text-success">{r.present}</TD>
                    <TD className="num text-right text-destructive">{r.absent}</TD>
                    <TD className="text-right">
                      {review && r.submitted_by !== user.id ? (
                        <Link href={`/sittings/${r.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"><BadgeCheck className="size-4" />Review</Link>
                      ) : (
                        <Link href={`/sittings/${r.id}`} className="text-[13px] text-primary hover:underline">View</Link>
                      )}
                      {r.submitted_by === user.id && <div className="mt-1"><Badge>Your submission</Badge></div>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : <EmptyState icon={FileCheck2} title="No registers awaiting approval">Submitted registers will appear here.</EmptyState>}
        </Card>
      )}

      {tab === "corrections" && <CorrectionList items={pending} canReview={can(user.permissions, "corrections.review")} userId={user.id} />}
      {tab === "history" && <CorrectionList items={history} canReview={false} userId={user.id} history />}
    </>
  );
}
