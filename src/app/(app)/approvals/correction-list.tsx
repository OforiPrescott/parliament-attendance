"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, FileCheck2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/misc";
import { api, run } from "@/lib/client";
import { fmtDate, fmtDateTime, STATUS_META, type AttendanceStatus } from "@/lib/utils";

type Item = {
  id: number; old_status: string; new_status: string; old_remarks: string | null; new_remarks: string | null; reason: string; status: string;
  requested_at: string; requested_by: number | null; requested_by_name: string | null; reviewed_at: string | null; reviewed_by_name: string | null;
  review_comment: string | null; mp_name: string; mp_id: number; sitting_id: number; sitting_title: string; sitting_date: string;
};

const S = ({ s }: { s: string }) => {
  const m = STATUS_META[s as AttendanceStatus];
  return <Badge tone={m?.tone ?? "muted"}>{m?.label ?? s}</Badge>;
};

export function CorrectionList({ items, canReview, userId, history }: { items: Item[]; canReview: boolean; userId: number; history?: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  if (!items.length) return <Card><EmptyState icon={FileCheck2} title={history ? "No correction requests yet" : "No pending correction requests"} /></Card>;

  async function review(c: Item, action: "approve" | "reject") {
    const r = await confirm({
      title: action === "approve" ? "Approve correction?" : "Reject correction?",
      destructive: action === "reject",
      confirmLabel: action === "approve" ? "Approve and apply" : "Reject",
      message: <>{c.mp_name} at <b>{c.sitting_title}</b>: {STATUS_META[c.old_status as AttendanceStatus]?.label} → {STATUS_META[c.new_status as AttendanceStatus]?.label}</>,
      reason: { label: action === "approve" ? "Comment (optional)" : "Reason for rejecting", required: action === "reject" },
    });
    if (r === false) return;
    if (await run(() => api(`/api/corrections/${c.id}`, { body: { action, comment: r || null } }), action === "approve" ? "Correction applied." : "Correction rejected.")) router.refresh();
  }

  return (
    <div className="space-y-3">
      {items.map((c) => (
        <Card key={c.id} className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/members/${c.mp_id}`} className="font-serif text-[16px] font-semibold hover:text-primary">{c.mp_name}</Link>
                <span className="text-muted-foreground">·</span>
                <Link href={`/sittings/${c.sitting_id}`} className="text-[13.5px] hover:text-primary">{c.sitting_title}, {fmtDate(c.sitting_date)}</Link>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <S s={c.old_status} /><ArrowRight className="size-4 text-muted-foreground" /><S s={c.new_status} />
                {c.new_remarks && <span className="text-[12.5px] text-muted-foreground">“{c.new_remarks}”</span>}
              </div>
              <p className="mt-3 rounded-md bg-muted/70 px-3 py-2 text-[13px]">{c.reason}</p>
              <div className="mt-2 text-[12px] text-muted-foreground">
                Requested by {c.requested_by_name ?? "—"} · {fmtDateTime(c.requested_at)}
                {c.reviewed_at && <> · {c.status === "APPROVED" ? "approved" : "rejected"} by {c.reviewed_by_name} · {fmtDateTime(c.reviewed_at)}</>}
                {c.review_comment && <> — “{c.review_comment}”</>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {c.status !== "PENDING" && <Badge tone={c.status === "APPROVED" ? "success" : "destructive"} dot>{c.status.toLowerCase()}</Badge>}
              {c.status === "PENDING" && canReview && c.requested_by !== userId && (
                <>
                  <Button variant="secondary" onClick={() => review(c, "reject")}><X />Reject</Button>
                  <Button onClick={() => review(c, "approve")}><Check />Approve</Button>
                </>
              )}
              {c.status === "PENDING" && (!canReview || c.requested_by === userId) && <Badge tone="warning" dot>Awaiting review</Badge>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
