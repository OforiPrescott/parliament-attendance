import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Undo2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { EDITABLE_REGISTER, getRegister, getSitting } from "@/lib/attendance";
import { can } from "@/lib/permissions";
import { fmtDate, time5 } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Register } from "@/components/register/register";

export const metadata: Metadata = { title: "Take attendance" };

export default async function CapturePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("attendance.capture");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const s = await getSitting(id);
  if (!s) notFound();
  // Locked, cancelled or future registers are shown read-only on the sitting page
  if (!EDITABLE_REGISTER.includes(s.register_status) || s.status === "CANCELLED" || s.sitting_date > new Date().toISOString().slice(0, 10))
    redirect(`/sittings/${id}`);
  const rows = await getRegister(s);

  return (
    <>
      <Link href="/attendance" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Attendance capture
      </Link>
      <PageHeader
        eyebrow={s.sitting_type === "COMMITTEE" ? s.committee_name ?? "Committee" : "Plenary register"}
        title={s.title}
        description={`${fmtDate(s.sitting_date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · starts ${time5(s.start_time)}${s.venue ? ` · ${s.venue}` : ""}`}
      />
      {s.register_status === "RETURNED" && s.review_comment && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive-soft px-5 py-3.5 text-[13.5px] text-destructive">
          <Undo2 className="mt-0.5 size-4 shrink-0" />
          <div><b>Returned by {s.reviewed_by_name ?? "reviewer"}:</b> {s.review_comment}</div>
        </div>
      )}
      <p className="mb-4 text-[12.5px] text-muted-foreground">
        Keys: <b>P</b> present · <b>L</b> late · <b>A</b> absent without permission · <b>E</b> excused (Speaker&apos;s permission) · <b>OD</b> official parliamentary duty.
      </p>
      <Register mode="edit" rows={rows}
        sitting={{ id: s.id, register_status: s.register_status, submitted_by: s.submitted_by, start_time: s.start_time, title: s.title }}
        perms={{ capture: true, review: can(user.permissions, "attendance.review"), requestCorrection: false, reopen: false, userId: user.id }} />
    </>
  );
}
