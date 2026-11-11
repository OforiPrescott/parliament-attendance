import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listMps } from "@/lib/queries";
import { getRefData } from "@/lib/reference";
import { MP_STATUS_META } from "@/lib/utils";
import { Badge, PartyChip } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, MpAvatar, PageHeader, Pagination } from "@/components/ui/misc";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { FilterSelect, SearchBox } from "@/components/filters";
import { MemberActions } from "./member-actions";

export const metadata: Metadata = { title: "Members of Parliament" };

type SP = { q?: string; partyId?: string; regionId?: string; status?: string; page?: string };

export default async function MembersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("mps.view");
  const sp = await searchParams;
  const status = sp.status === "ALL" ? undefined : sp.status ?? "ACTIVE";
  const [data, ref] = await Promise.all([
    listMps({ q: sp.q, partyId: Number(sp.partyId) || undefined, regionId: Number(sp.regionId) || undefined, status, page: Number(sp.page) || 1, pageSize: 25 }),
    getRefData(),
  ]);
  const manage = can(user.permissions, "mps.manage");
  const qs = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    q.set("page", String(p));
    return `/members?${q}`;
  };

  return (
    <>
      <PageHeader eyebrow="Registry" title="Members of Parliament"
        description="The roster of members, their party, constituency and membership history."
        actions={manage && <MemberActions ref_={ref} />} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          <SearchBox placeholder="Search name, ID or constituency" />
          <FilterSelect param="partyId" label="All parties" options={ref.parties.map((p) => ({ value: p.id, label: p.abbreviation }))} />
          <FilterSelect param="regionId" label="All regions" options={ref.regions.map((r) => ({ value: r.id, label: r.name }))} />
          <FilterSelect param="status" label="Active members"
            options={[{ value: "ALL", label: "All statuses" }, ...Object.entries(MP_STATUS_META).filter(([k]) => k !== "ACTIVE").map(([k, v]) => ({ value: k, label: v.label }))]} />
        </div>
        {data.items.length ? (
          <Table>
            <THead>
              <tr><TH>Member</TH><TH>Parliamentary ID</TH><TH>Party</TH><TH>Constituency</TH><TH className="hidden md:table-cell">Region</TH><TH>Status</TH></tr>
            </THead>
            <TBody>
              {data.items.map((m) => {
                const st = MP_STATUS_META[m.status as keyof typeof MP_STATUS_META];
                return (
                  <TR key={m.id}>
                    <TD>
                      <Link href={`/members/${m.id}`} className="group flex items-center gap-3">
                        <MpAvatar id={m.id} name={m.full_name} photo={m.photo} />
                        <span>
                          <span className="block font-medium group-hover:text-primary">{m.title ? `${m.title} ` : ""}{m.full_name}</span>
                          <span className="block text-[12px] text-muted-foreground">{m.email ?? (m.gender === "F" ? "Female" : "Male")}</span>
                        </span>
                      </Link>
                    </TD>
                    <TD className="num font-mono text-[12.5px]">{m.parliamentary_id}</TD>
                    <TD><PartyChip abbr={m.party_abbr} color={m.party_color} /></TD>
                    <TD>{m.constituency_name ?? "—"}</TD>
                    <TD className="hidden text-muted-foreground md:table-cell">{m.region_name ?? "—"}</TD>
                    <TD><Badge tone={st?.tone ?? "muted"} dot>{st?.label ?? m.status}</Badge></TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <EmptyState icon={Users} title="No members match these filters">Try clearing the search or choosing a different status.</EmptyState>
        )}
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={qs} />
      </Card>
    </>
  );
}
