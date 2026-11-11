import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarCheck2, ClipboardList, Percent, UserCheck, UserX, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDashboard, rate } from "@/lib/stats";
import { cn, fmtDate, num, pct } from "@/lib/utils";
import { Badge, PartyChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, MpAvatar, PageHeader, RateBar } from "@/components/ui/misc";
import { MonthlyComparison, PartyChart, RegionChart, StatusDonut, TrendChart } from "./charts";

export const metadata: Metadata = { title: "Dashboard" };

const RANGES = [30, 90, 180, 365];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser("dashboard.view");
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.range)) ? Number(sp.range) : 90;
  const d = await getDashboard(days);
  const curRate = rate(d.current);
  const prevRate = rate(d.previous);
  const delta = d.previous.expected ? curRate - prevRate : null;
  const latestRate = d.latest ? rate(d.latest) : null;

  return (
    <>
      <PageHeader
        eyebrow={d.meeting ? `${d.meeting.session_name} · ${d.meeting.name}` : "Overview"}
        title={`Good ${greeting()}, ${user.fullName.split(" ")[0]}`}
        description="Attendance of Members of Parliament, drawn live from approved registers."
        actions={
          <div className="flex rounded-lg border bg-card p-0.5 shadow-sm" role="group" aria-label="Period">
            {RANGES.map((r) => (
              <Link key={r} href={`/dashboard?range=${r}`} scroll={false}
                className={cn("rounded-md px-3 py-1.5 text-[12.5px] font-medium", r === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {r === 365 ? "12 months" : `${r} days`}
              </Link>
            ))}
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} label="Members of Parliament" value={num(d.totals.active)}
          foot={<>{num(d.totals.female)} women · {num(d.totals.total - d.totals.active)} former / inactive</>} />
        <Kpi icon={UserCheck} label="Present at latest sitting" tone="success"
          value={d.latest ? num(d.latest.attended) : "—"}
          foot={d.latest ? (
            <span className="flex flex-wrap items-center gap-1.5">
              of {num(d.latest.expected)} on {fmtDate(d.latest.sitting_date)}
              {d.latest.register_status === "SUBMITTED" && <Badge tone="warning">awaiting approval</Badge>}
            </span>
          ) : "No sittings recorded yet"} />
        <Kpi icon={UserX} label="Absent at latest sitting" tone="destructive"
          value={d.latest ? num(d.latest.absent + d.latest.excused) : "—"}
          foot={d.latest ? <>{num(d.latest.absent)} without permission · {num(d.latest.excused)} excused</> : "—"} />
        <Kpi icon={Percent} label={`Plenary attendance · ${days === 365 ? "12 months" : `${days} days`}`} tone="gold"
          value={d.current.expected ? pct(curRate) : "—"}
          foot={delta === null ? <>{num(d.current.sittings)} sittings</> : (
            <span className={cn("inline-flex items-center gap-1 font-medium", delta >= 0 ? "text-success" : "text-destructive")}>
              {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {(Math.abs(delta) * 100).toFixed(1)} pts vs previous period
            </span>
          )} />
      </div>

      {/* Pending actions */}
      {(d.pending.submitted || d.pending.corrections || d.pending.returned || d.pending.overdue) > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gold/30 bg-gold-soft/60 px-5 py-3 text-[13px]">
          <ClipboardList className="size-4 text-gold" />
          {d.pending.submitted > 0 && <span><b className="num">{d.pending.submitted}</b> register(s) awaiting approval</span>}
          {d.pending.corrections > 0 && <span><b className="num">{d.pending.corrections}</b> correction request(s)</span>}
          {d.pending.returned > 0 && <span><b className="num">{d.pending.returned}</b> returned for amendment</span>}
          {d.pending.overdue > 0 && <span><b className="num">{d.pending.overdue}</b> past sitting(s) with no register</span>}
          {can(user.permissions, ["attendance.review", "corrections.review", "corrections.request"]) && (
            <Link href="/approvals" className="ml-auto inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              Open review queue <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* Trend + mix */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Attendance trend" description="Share of members present at each plenary sitting" />
          <CardBody className="pt-2">
            {d.trend.length ? <TrendChart data={d.trend} /> : <EmptyState icon={CalendarCheck2} title="No approved sittings in this period" />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Status breakdown" description="All approved sittings in the period" />
          <CardBody>
            {d.statusMix.expected ? <StatusDonut agg={d.statusMix} /> : <EmptyState icon={CalendarCheck2} title="No data yet" />}
          </CardBody>
        </Card>
      </div>

      {/* Party + region */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="By political party" description="Plenary attendance rate by party at the time of sitting" />
          <CardBody>{d.byParty.length ? <PartyChart data={d.byParty} /> : <EmptyState icon={CalendarCheck2} title="No data yet" />}</CardBody>
        </Card>
        <Card>
          <CardHeader title="By region" description="Plenary attendance rate of members, grouped by their constituency's region" />
          <CardBody>{d.byRegion.length ? <RegionChart data={d.byRegion} /> : <EmptyState icon={CalendarCheck2} title="No data yet" />}</CardBody>
        </Card>
      </div>

      {/* Year on year */}
      <Card className="mt-4">
        <CardHeader title="Historical comparison" description={`Monthly plenary attendance, ${d.thisYear} compared with ${d.thisYear - 1}`} />
        <CardBody><MonthlyComparison data={d.months} year={d.thisYear} /></CardBody>
      </Card>

      {/* Members and constituencies */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Highest attendance" description="Members, current period" />
          <MpList items={d.topMps} />
        </Card>
        <Card>
          <CardHeader title="Lowest attendance" description="Members, current period" />
          <MpList items={d.bottomMps} />
        </Card>
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2"><AlertTriangle className="size-4 text-warning" />Absence watch-list</span>}
            description={d.meeting ? `Unexcused plenary absences this meeting (constitutional threshold: ${d.settings.absence_alert_threshold})` : "No meeting in progress"}
          />
          {d.watch.length ? (
            <ul className="divide-y">
              {d.watch.map((w) => (
                <li key={w.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/members/${w.id}`} className="block truncate text-[13.5px] font-medium hover:text-primary">{w.name}</Link>
                    <div className="truncate text-[12px] text-muted-foreground">{w.constituency}</div>
                  </div>
                  <PartyChip abbr={w.party} color={w.party_color} />
                  <Badge tone={w.unexcused >= d.settings.absence_alert_threshold ? "destructive" : w.unexcused >= d.settings.absence_alert_threshold * 0.66 ? "warning" : "muted"}>
                    <span className="num">{w.unexcused}</span> / {d.settings.absence_alert_threshold}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={UserCheck} title="No members approaching the threshold" />
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ConstituencyTable title="Top constituencies" items={d.topConstituencies} />
        <ConstituencyTable title="Constituencies needing attention" items={d.bottomConstituencies} />
      </div>
    </>
  );
}

function greeting() {
  const h = new Date().getUTCHours(); // Accra is UTC+0
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function Kpi({ icon: Icon, label, value, foot, tone = "primary" }: {
  icon: typeof Users; label: string; value: string; foot: React.ReactNode; tone?: "primary" | "success" | "destructive" | "gold";
}) {
  const t = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    destructive: "bg-destructive-soft text-destructive",
    gold: "bg-gold-soft text-gold",
  }[tone];
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <div className="text-[12.5px] font-medium text-muted-foreground">{label}</div>
        <span className={cn("grid size-9 place-items-center rounded-lg", t)}><Icon className="size-[18px]" /></span>
      </div>
      <div className="num mt-1 font-serif text-[34px] font-semibold leading-none tracking-tight">{value}</div>
      <div className="mt-3 text-[12.5px] text-muted-foreground">{foot}</div>
    </Card>
  );
}

function MpList({ items }: { items: { id: number; name: string; constituency: string | null; party: string | null; party_color: string | null; photo: number; rate: number }[] }) {
  if (!items.length) return <EmptyState icon={Users} title="Not enough data yet" />;
  return (
    <ul className="divide-y">
      {items.map((m) => (
        <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
          <MpAvatar id={m.id} name={m.name} photo={m.photo} size={34} />
          <div className="min-w-0 flex-1">
            <Link href={`/members/${m.id}`} className="block truncate text-[13.5px] font-medium hover:text-primary">{m.name}</Link>
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="truncate">{m.constituency}</span>
            </div>
          </div>
          <PartyChip abbr={m.party} color={m.party_color} />
          <RateBar value={m.rate} className="w-28" />
        </li>
      ))}
    </ul>
  );
}

function ConstituencyTable({ title, items }: { title: string; items: { id: number; name: string; region: string; rate: number; expected: number }[] }) {
  return (
    <Card>
      <CardHeader title={title} description="By plenary attendance of the sitting member(s)" />
      {items.length ? (
        <ul className="divide-y">
          {items.map((c) => (
            <li key={c.id} className="flex items-center gap-4 px-5 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{c.name}</div>
                <div className="text-[12px] text-muted-foreground">{c.region}</div>
              </div>
              <RateBar value={c.rate} className="w-40" />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Users} title="Not enough data yet" />
      )}
    </Card>
  );
}
