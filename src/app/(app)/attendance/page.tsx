import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ClipboardCheck, ClipboardList, Undo2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { rows } from "@/lib/db";
import { fmtDate, REGISTER_META, time5 } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Attendance capture" };

type S = { id: number; title: string; sitting_date: string; start_time: string; sitting_type: string; committee_name: string | null; register_status: string; review_comment: string | null; recorded: number; status: string };

export default async function AttendancePage() {
  await requireUser(["attendance.capture", "attendance.review"]);
  const base = `SELECT s.id, s.title, s.sitting_date, s.start_time, s.sitting_type, c.name committee_name, s.register_status, s.review_comment, s.status,
                       (SELECT COUNT(*) FROM attendance a WHERE a.sitting_id = s.id) recorded
                  FROM sittings s LEFT JOIN committees c ON c.id = s.committee_id`;
  const [today, todo, upcoming, recent] = await Promise.all([
    rows<S>(`${base} WHERE s.sitting_date = CURRENT_DATE AND s.status <> 'CANCELLED' ORDER BY s.start_time`),
    rows<S>(`${base} WHERE s.sitting_date < CURRENT_DATE AND s.status <> 'CANCELLED' AND s.register_status IN ('NOT_STARTED','DRAFT','RETURNED')
              ORDER BY s.register_status = 'RETURNED' DESC, s.sitting_date DESC LIMIT 50`),
    rows<S>(`${base} WHERE s.sitting_date > CURRENT_DATE AND s.status <> 'CANCELLED' ORDER BY s.sitting_date, s.start_time LIMIT 6`),
    rows<S>(`${base} WHERE s.register_status IN ('SUBMITTED','APPROVED') ORDER BY COALESCE(s.submitted_at, s.updated_at) DESC LIMIT 8`),
  ]);

  return (
    <>
      <PageHeader eyebrow="Attendance" title="Attendance capture" description="Record who attended each sitting. Registers are saved as drafts and submitted for approval." />

      <Card className="mb-4 overflow-hidden">
        <div className="flex items-center gap-3 border-b bg-gradient-to-r from-primary to-sidebar px-5 py-4 text-primary-foreground">
          <CalendarClock className="size-5 text-gold" />
          <div>
            <div className="font-serif text-[18px] font-semibold">Today&apos;s sittings</div>
            <div className="text-[12.5px] opacity-80">{fmtDate(new Date().toISOString().slice(0, 10), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
        </div>
        {today.length ? <SittingRows items={today} primary /> : <EmptyState icon={CalendarClock} title="No sittings scheduled today">Upcoming sittings are listed below.</EmptyState>}
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Registers to complete" description="Past sittings without a submitted register — returned registers first" />
          {todo.length ? <SittingRows items={todo} /> : <EmptyState icon={CheckCircle2} title="All caught up">Every past sitting has a submitted register.</EmptyState>}
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Coming up" />
            {upcoming.length ? (
              <ul className="divide-y">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                    <DateBlock date={s.sitting_date} />
                    <div className="min-w-0"><Link href={`/sittings/${s.id}`} className="block truncate text-[13.5px] font-medium hover:text-primary">{s.title}</Link>
                      <div className="text-[12px] text-muted-foreground">{time5(s.start_time)} · {s.committee_name ?? s.sitting_type.toLowerCase()}</div></div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={CalendarClock} title="Nothing scheduled" />}
          </Card>
          <Card>
            <CardHeader title="Recently submitted" />
            <ul className="divide-y">
              {recent.map((s) => {
                const r = REGISTER_META[s.register_status as keyof typeof REGISTER_META];
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0"><Link href={`/sittings/${s.id}`} className="block truncate text-[13.5px] hover:text-primary">{s.title}</Link>
                      <div className="text-[12px] text-muted-foreground">{fmtDate(s.sitting_date)}</div></div>
                    <Badge tone={r.tone}>{r.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function DateBlock({ date }: { date: string }) {
  const d = new Date(`${date}T00:00:00Z`);
  return (
    <div className="w-11 shrink-0 overflow-hidden rounded-md border text-center">
      <div className="bg-primary py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">{d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</div>
      <div className="num py-0.5 font-serif text-[17px] font-semibold">{d.getUTCDate()}</div>
    </div>
  );
}

function SittingRows({ items, primary }: { items: S[]; primary?: boolean }) {
  return (
    <ul className="divide-y">
      {items.map((s) => {
        const r = REGISTER_META[s.register_status as keyof typeof REGISTER_META];
        const done = ["SUBMITTED", "APPROVED"].includes(s.register_status);
        return (
          <li key={s.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
            <DateBlock date={s.sitting_date} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{s.title}</div>
              <div className="text-[12.5px] text-muted-foreground">{time5(s.start_time)} · {s.committee_name ?? (s.sitting_type === "PLENARY" ? "Plenary" : "Other")}{s.recorded ? ` · ${s.recorded} recorded` : ""}</div>
              {s.register_status === "RETURNED" && s.review_comment && (
                <div className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-destructive"><Undo2 className="mt-0.5 size-3.5 shrink-0" />{s.review_comment}</div>
              )}
            </div>
            <Badge tone={r.tone} dot>{r.label}</Badge>
            {done ? (
              <Link href={`/sittings/${s.id}`} className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-4 text-[13.5px] font-medium hover:bg-muted"><ClipboardList className="size-4" />View</Link>
            ) : (
              <Link href={`/attendance/${s.id}`} className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-[13.5px] font-medium shadow-sm ${primary ? "bg-gold text-gold-foreground hover:bg-gold/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
                <ClipboardCheck className="size-4" />{s.register_status === "NOT_STARTED" ? "Take attendance" : "Continue"}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
