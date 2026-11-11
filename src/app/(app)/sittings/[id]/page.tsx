import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, FileDown, MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { EDITABLE_REGISTER, getRegister, getSitting } from "@/lib/attendance";
import { can } from "@/lib/permissions";
import { getCalendar } from "@/lib/queries";
import { fmtDate, fmtDateTime, REGISTER_META, time5 } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Register } from "@/components/register/register";
import { SittingHeaderActions } from "./header-actions";

export const metadata: Metadata = { title: "Sitting" };

export default async function SittingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("sittings.view");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const s = await getSitting(id);
  if (!s) notFound();
  const [rows, cal] = await Promise.all([getRegister(s), getCalendar()]);
  const reg = REGISTER_META[s.register_status];
  const canCapture = can(user.permissions, "attendance.capture") && EDITABLE_REGISTER.includes(s.register_status) && s.status !== "CANCELLED"
    && s.sitting_date <= new Date().toISOString().slice(0, 10);

  return (
    <>
      <Link href="/sittings" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Sittings
      </Link>
      <Card className="mb-4 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-gold">
              {s.sitting_type === "COMMITTEE" ? s.committee_name : s.sitting_type === "PLENARY" ? "Plenary" : "Other business"}
              {s.meeting_name && ` · ${s.session_name}, ${s.meeting_name}`}
            </div>
            <h1 className="font-serif text-[26px] font-semibold leading-tight">{s.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
              <span>{fmtDate(s.sitting_date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              <span className="num">{time5(s.start_time)}{s.end_time ? ` – ${time5(s.end_time)}` : ""}</span>
              {s.venue && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{s.venue}</span>}
              <span className="capitalize">{s.status.toLowerCase()}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={reg.tone} dot className="px-3 py-1 text-[13px]">{reg.label}</Badge>
            {can(user.permissions, "reports.export") && s.register_status === "APPROVED" && (
              <Link href={`/reports?type=sitting&sittingId=${s.id}`} className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-4 text-[14px] font-medium shadow-sm hover:bg-muted">
                <FileDown className="size-4" />Report
              </Link>
            )}
            {canCapture && (
              <Link href={`/attendance/${s.id}`} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[14px] font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
                <ClipboardCheck className="size-4" />{s.register_status === "NOT_STARTED" ? "Take attendance" : "Continue register"}
              </Link>
            )}
            {can(user.permissions, "sittings.manage") && (
              <SittingHeaderActions hasRecords={rows.some((r) => r.attendance_id)} meetings={cal.meetings} committees={cal.committees}
                sitting={{ id: s.id, meetingId: String(s.meeting_id ?? ""), sittingType: s.sitting_type, committeeId: String(s.committee_id ?? ""), title: s.title,
                  sittingDate: s.sitting_date, startTime: time5(s.start_time), endTime: s.end_time ? time5(s.end_time) : "", venue: s.venue ?? "", status: s.status }} />
            )}
          </div>
        </div>
        {(s.submitted_at || s.review_comment) && (
          <div className="mt-5 grid gap-3 border-t pt-4 text-[13px] sm:grid-cols-3">
            {s.submitted_at && <div><div className="text-muted-foreground">Submitted</div><div>{s.submitted_by_name ?? "—"} · {fmtDateTime(s.submitted_at)}</div></div>}
            {s.reviewed_at && <div><div className="text-muted-foreground">{s.register_status === "RETURNED" ? "Returned" : "Approved"}</div><div>{s.reviewed_by_name ?? "—"} · {fmtDateTime(s.reviewed_at)}</div></div>}
            {s.review_comment && (
              <div className={s.register_status === "RETURNED" ? "rounded-md bg-destructive-soft p-3 text-destructive sm:col-span-3" : "sm:col-span-1"}>
                <div className="font-medium">Reviewer&apos;s comment</div><div>{s.review_comment}</div>
              </div>
            )}
          </div>
        )}
      </Card>
      <Register mode="view" sitting={{ id: s.id, register_status: s.register_status, submitted_by: s.submitted_by, start_time: s.start_time, title: s.title }} rows={rows}
        perms={{
          capture: can(user.permissions, "attendance.capture"), review: can(user.permissions, "attendance.review"),
          requestCorrection: can(user.permissions, "corrections.request"), reopen: can(user.permissions, "settings.manage"), userId: user.id,
        }} />
    </>
  );
}
