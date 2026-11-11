import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCalendar, listMps, listSittings } from "@/lib/queries";
import { fmtDate, REGISTER_META, time5 } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { LinkTabs } from "@/components/ui/tabs";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { DateFilter, FilterSelect, SearchBox } from "@/components/filters";
import { CalendarManager } from "./calendar-manager";
import { CommitteeManager } from "./committee-manager";
import { SittingActions } from "./sitting-form";

export const metadata: Metadata = { title: "Sittings & calendar" };

type SP = { tab?: string; q?: string; type?: string; registerStatus?: string; from?: string; to?: string; meetingId?: string; page?: string };

export default async function SittingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("sittings.view");
  const sp = await searchParams;
  const tab = sp.tab === "calendar" ? "calendar" : sp.tab === "committees" ? "committees" : "sittings";
  const manage = can(user.permissions, "sittings.manage");
  const calendar = await getCalendar();

  return (
    <>
      <PageHeader eyebrow="Attendance" title="Sittings & parliamentary calendar"
        description="Plenary sittings, committee meetings and other official business, organised by Parliament, session and meeting."
        actions={manage && tab === "sittings" && <SittingActions meetings={calendar.meetings} committees={calendar.committees} />} />
      <LinkTabs active={tab} tabs={[
        { key: "sittings", label: "Sittings", href: "/sittings" },
        { key: "calendar", label: "Parliaments, sessions & meetings", href: "/sittings?tab=calendar" },
        { key: "committees", label: "Committees", href: "/sittings?tab=committees", count: calendar.committees.length },
      ]} />
      {tab === "calendar" && <CalendarManager data={calendar} canManage={manage} />}
      {tab === "committees" && <CommitteeManager committees={calendar.committees} canManage={manage} mps={manage ? (await getActiveMps()) : []} />}
      {tab === "sittings" && <SittingList sp={sp} meetings={calendar.meetings} />}
    </>
  );
}

async function getActiveMps() {
  return (await listMps({ status: "ACTIVE", pageSize: 500 })).items.map((m) => ({ id: m.id, name: `${m.full_name}`, party: m.party_abbr, constituency: m.constituency_name }));
}

async function SittingList({ sp, meetings }: { sp: SP; meetings: { id: number; name: string; session_name: string }[] }) {
  const data = await listSittings({
    q: sp.q, type: sp.type, registerStatus: sp.registerStatus, from: sp.from, to: sp.to,
    meetingId: Number(sp.meetingId) || undefined, page: Number(sp.page) || 1, pageSize: 25,
  });
  const qs = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    q.set("page", String(p));
    return `/sittings?${q}`;
  };
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <SearchBox placeholder="Search sittings" />
        <FilterSelect param="meetingId" label="All meetings" options={meetings.map((m) => ({ value: m.id, label: `${m.session_name} · ${m.name}` }))} />
        <FilterSelect param="type" label="All types" options={[{ value: "PLENARY", label: "Plenary" }, { value: "COMMITTEE", label: "Committee" }, { value: "OTHER", label: "Other" }]} />
        <FilterSelect param="registerStatus" label="Any register status" options={Object.entries(REGISTER_META).map(([k, v]) => ({ value: k, label: v.label }))} />
        <DateFilter param="from" label="From" />
        <DateFilter param="to" label="To" />
      </div>
      {data.items.length ? (
        <Table>
          <THead><tr><TH>Date</TH><TH>Sitting</TH><TH>Type</TH><TH className="hidden lg:table-cell">Meeting</TH><TH>Status</TH><TH>Register</TH><TH className="text-right">Present</TH></tr></THead>
          <TBody>
            {data.items.map((s) => {
              const reg = REGISTER_META[s.register_status as keyof typeof REGISTER_META];
              return (
                <TR key={s.id}>
                  <TD className="whitespace-nowrap">
                    <div className="font-medium">{fmtDate(s.sitting_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
                    <div className="num text-[12px] text-muted-foreground">{time5(s.start_time)}{s.end_time ? `–${time5(s.end_time)}` : ""}</div>
                  </TD>
                  <TD>
                    <Link href={`/sittings/${s.id}`} className="font-medium hover:text-primary">{s.title}</Link>
                    {s.venue && <div className="text-[12px] text-muted-foreground">{s.venue}</div>}
                  </TD>
                  <TD><Badge tone={s.sitting_type === "PLENARY" ? "primary" : s.sitting_type === "COMMITTEE" ? "gold" : "muted"}>{s.sitting_type === "COMMITTEE" ? s.committee_name ?? "Committee" : s.sitting_type.toLowerCase()}</Badge></TD>
                  <TD className="hidden text-[12.5px] text-muted-foreground lg:table-cell">{s.meeting_name ? `${s.session_name} · ${s.meeting_name}` : "—"}</TD>
                  <TD className="capitalize text-[13px]">{s.status.toLowerCase()}</TD>
                  <TD><Badge tone={reg.tone} dot>{reg.label}</Badge></TD>
                  <TD className="num text-right">{s.recorded ? `${s.attended}/${s.recorded}` : "—"}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      ) : <EmptyState icon={CalendarDays} title="No sittings match these filters" />}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={qs} />
    </Card>
  );
}

