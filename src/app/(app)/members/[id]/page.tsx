import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarX2, History, Mail, Phone, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getMp } from "@/lib/queries";
import { getRefData } from "@/lib/reference";
import { getMpStats, rate } from "@/lib/stats";
import { fmtDate, MP_STATUS_META, num, pct, STATUS_META, time5, type AttendanceStatus } from "@/lib/utils";
import { Badge, PartyChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, MpAvatar, RateBar } from "@/components/ui/misc";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { MonthlyRate } from "./monthly-chart";
import { ProfileActions } from "./profile-actions";

export const metadata: Metadata = { title: "Member profile" };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("mps.view");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [mp, stats, ref] = await Promise.all([getMp(id), getMpStats(id), getRefData()]);
  if (!mp) notFound();
  const st = MP_STATUS_META[mp.status as keyof typeof MP_STATUS_META];
  const name = `${mp.title ? `${mp.title} ` : ""}${mp.full_name}`;

  return (
    <>
      <Link href="/members" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Members of Parliament
      </Link>

      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-sidebar via-primary to-sidebar" />
        <div className="flex flex-col gap-5 px-6 pb-6 sm:flex-row sm:items-end">
          <MpAvatar id={mp.id} name={mp.full_name} photo={mp.photo} size={104} className="-mt-12 ring-4" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-[26px] font-semibold leading-tight">{name}</h1>
              <Badge tone={st?.tone ?? "muted"} dot>{st?.label ?? mp.status}</Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              <span className="font-mono">{mp.parliamentary_id}</span>
              <PartyChip abbr={mp.party_abbr} color={mp.party_color} />
              <span>{mp.constituency_name ?? "No current seat"}{mp.region_name ? `, ${mp.region_name}` : ""}</span>
              {mp.email && <span className="inline-flex items-center gap-1"><Mail className="size-3.5" />{mp.email}</span>}
              {mp.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3.5" />{mp.phone}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {can(user.permissions, "reports.view") && (
              <Link href={`/reports?type=mp&mpId=${mp.id}`} className="inline-flex h-9 items-center rounded-md border bg-card px-4 text-[14px] font-medium shadow-sm hover:bg-muted">
                Attendance report
              </Link>
            )}
            {can(user.permissions, "mps.manage") && (
              <ProfileActions ref_={ref} hasPhoto={!!mp.photo} mp={{
                id: mp.id, parliamentaryId: mp.parliamentary_id, title: mp.title ?? "", firstName: mp.first_name, otherNames: mp.other_names ?? "",
                lastName: mp.last_name, gender: mp.gender, email: mp.email ?? "", phone: mp.phone ?? "", status: mp.status, currentStatus: mp.status,
              }} />
            )}
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Overall attendance" value={stats.overall.expected ? pct(rate(stats.overall)) : "—"} sub={`${num(stats.overall.attended)} of ${num(stats.overall.expected)} sittings`} r={rate(stats.overall)} />
        <Stat label="Plenary sittings" value={stats.plenary.expected ? pct(rate(stats.plenary)) : "—"} sub={`${num(stats.plenary.expected)} recorded`} r={rate(stats.plenary)} />
        <Stat label="Committee meetings" value={stats.committee.expected ? pct(rate(stats.committee)) : "—"} sub={`${num(stats.committee.expected)} recorded`} r={rate(stats.committee)} />
        <Card className="p-5">
          <div className="text-[12.5px] font-medium text-muted-foreground">Absences</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            {([["Unexcused", stats.overall.absent, "text-destructive"], ["Excused", stats.overall.excused, "text-info"], ["Official", stats.overall.official, "text-gold"]] as const).map(([l, v, c]) => (
              <div key={l}><div className={`num font-serif text-[24px] font-semibold ${c}`}>{num(v)}</div><div className="text-[11px] text-muted-foreground">{l}</div></div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Monthly attendance" description="All approved sittings" />
          <CardBody>{stats.monthly.length ? <MonthlyRate data={stats.monthly} /> : <EmptyState icon={CalendarX2} title="No approved attendance yet" />}</CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><History className="size-4 text-gold" />Membership history</span>} />
          <ol className="relative space-y-0 px-5 py-4">
            {mp.memberships.map((m, i) => (
              <li key={m.id} className="relative border-l-2 border-border pb-5 pl-5 last:pb-0">
                <span className={`absolute -left-[7px] top-1 size-3 rounded-full ring-4 ring-card ${i === 0 && !m.end_date ? "bg-gold" : "bg-muted-foreground/40"}`} />
                <div className="flex items-center gap-2"><PartyChip abbr={m.party} color={m.party_color} /><span className="text-[13.5px] font-medium">{m.constituency}</span></div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{m.parliament}</div>
                <div className="text-[12px] text-muted-foreground">{fmtDate(m.start_date)} — {m.end_date ? fmtDate(m.end_date) : "present"}</div>
                {m.end_reason && <div className="mt-0.5 text-[12px] italic text-muted-foreground">{m.end_reason}</div>}
              </li>
            ))}
          </ol>
          {mp.committees.length > 0 && (
            <div className="border-t px-5 py-4">
              <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Committees</div>
              <ul className="space-y-1.5 text-[13px]">
                {mp.committees.map((c) => (
                  <li key={c.name + c.start_date} className="flex items-center justify-between gap-2">
                    <span className={c.end_date ? "text-muted-foreground line-through" : ""}>{c.name}</span>
                    {c.role !== "MEMBER" && <Badge tone="gold">{c.role.replace("_", " ").toLowerCase()}</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Recent attendance" description="Last 25 sittings, including registers not yet approved" />
        {stats.recent.length ? (
          <Table>
            <THead><tr><TH>Date</TH><TH>Sitting</TH><TH>Type</TH><TH>Status</TH><TH>Arrival</TH><TH>Remarks</TH><TH>Register</TH></tr></THead>
            <TBody>
              {stats.recent.map((r) => {
                const m = STATUS_META[r.status as AttendanceStatus];
                return (
                  <TR key={r.sitting_id}>
                    <TD className="whitespace-nowrap">{fmtDate(r.sitting_date)}</TD>
                    <TD><Link href={`/sittings/${r.sitting_id}`} className="hover:text-primary">{r.title}</Link></TD>
                    <TD className="capitalize text-muted-foreground">{r.sitting_type.toLowerCase()}</TD>
                    <TD><Badge tone={m.tone}>{m.label}</Badge></TD>
                    <TD className="num">{time5(r.arrival_time)}</TD>
                    <TD className="max-w-[260px] truncate text-muted-foreground">{r.remarks ?? ""}</TD>
                    <TD>{r.register_status === "APPROVED" ? <span className="text-[12px] text-success">Approved</span> : <span className="text-[12px] text-warning">Pending</span>}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        ) : <EmptyState icon={Users} title="No attendance recorded yet" />}
      </Card>
    </>
  );
}

function Stat({ label, value, sub, r }: { label: string; value: string; sub: string; r: number }) {
  return (
    <Card className="p-5">
      <div className="text-[12.5px] font-medium text-muted-foreground">{label}</div>
      <div className="num mt-1 font-serif text-[30px] font-semibold leading-tight">{value}</div>
      <RateBar value={r} className="mt-2" />
      <div className="mt-1.5 text-[12px] text-muted-foreground">{sub}</div>
    </Card>
  );
}
