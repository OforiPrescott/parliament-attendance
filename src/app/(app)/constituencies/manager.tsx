"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge, PartyChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { api, ClientError, run } from "@/lib/client";

type C = { id: number; name: string; code: string | null; region_id: number; region_name: string; is_active: number; member: string | null; member_id: number | null; party_abbr: string | null; party_color: string | null };
type R = { id: number; name: string; code: string | null; constituencies: number };

export function ConstituencyManager({ items, regions, canManage }: { items: C[]; regions: R[]; canManage: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [editing, setEditing] = useState<C | "new" | null>(null);
  const shown = useMemo(() => items.filter((c) =>
    (!region || c.region_id === Number(region)) &&
    (!q || `${c.name} ${c.member ?? ""} ${c.code ?? ""}`.toLowerCase().includes(q.toLowerCase()))), [items, q, region]);
  const vacant = items.filter((c) => c.is_active && !c.member).length;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search constituency or member" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="w-48">
          <Select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
            <option value="">All regions</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </div>
        {vacant > 0 && <Badge tone="warning">{vacant} vacant</Badge>}
        {canManage && <Button onClick={() => setEditing("new")} className="ml-auto"><Plus />Add constituency</Button>}
      </div>
      {shown.length ? (
        <Table>
          <THead><tr><TH>Constituency</TH><TH>Region</TH><TH>Sitting member</TH><TH>Party</TH><TH>Status</TH>{canManage && <TH className="w-24" />}</tr></THead>
          <TBody>
            {shown.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">{c.name}{c.code && <span className="ml-2 font-mono text-[11.5px] text-muted-foreground">{c.code}</span>}</TD>
                <TD className="text-muted-foreground">{c.region_name}</TD>
                <TD>{c.member_id ? <Link href={`/members/${c.member_id}`} className="hover:text-primary">{c.member}</Link> : <span className="text-muted-foreground">Vacant</span>}</TD>
                <TD><PartyChip abbr={c.party_abbr} color={c.party_color} /></TD>
                <TD>{c.is_active ? <Badge tone="success" dot>Active</Badge> : <Badge>Abolished</Badge>}</TD>
                {canManage && (
                  <TD className="text-right">
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(c)}><Pencil /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={async () => {
                      if ((await confirm({ title: `Delete ${c.name}?`, destructive: true, confirmLabel: "Delete", message: "Constituencies with members or attendance history cannot be deleted — mark them inactive instead." })) === false) return;
                      if (await run(() => api(`/api/constituencies/${c.id}`, { method: "DELETE" }), "Constituency deleted.")) router.refresh();
                    }}><Trash2 /></Button>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      ) : <EmptyState icon={MapPin} title="No constituencies found" />}
      <div className="border-t px-5 py-3 text-[12.5px] text-muted-foreground">{shown.length} of {items.length} constituencies</div>
      {editing && (
        <SimpleDialog
          title={editing === "new" ? "Add constituency" : `Edit ${editing.name}`}
          url={editing === "new" ? "/api/constituencies" : `/api/constituencies/${editing.id}`}
          method={editing === "new" ? "POST" : "PATCH"}
          initial={{ name: editing === "new" ? "" : editing.name, regionId: editing === "new" ? "" : String(editing.region_id), code: editing === "new" ? "" : editing.code ?? "", isActive: editing === "new" ? true : !!editing.is_active }}
          regions={regions}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

export function RegionManager({ regions, canManage }: { regions: R[]; canManage: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<R | "new" | null>(null);
  return (
    <Card>
      {canManage && <div className="flex justify-end border-b p-4"><Button onClick={() => setEditing("new")}><Plus />Add region</Button></div>}
      <Table>
        <THead><tr><TH>Region</TH><TH>Code</TH><TH className="text-right">Constituencies</TH>{canManage && <TH className="w-24" />}</tr></THead>
        <TBody>
          {regions.map((r) => (
            <TR key={r.id}>
              <TD className="font-medium">{r.name}</TD>
              <TD className="font-mono text-muted-foreground">{r.code ?? "—"}</TD>
              <TD className="num text-right">{r.constituencies}</TD>
              {canManage && (
                <TD className="text-right">
                  <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(r)}><Pencil /></Button>
                  <Button variant="ghost" size="icon" aria-label="Delete" onClick={async () => {
                    if ((await confirm({ title: `Delete ${r.name}?`, destructive: true, confirmLabel: "Delete", message: "A region that still has constituencies cannot be deleted." })) === false) return;
                    if (await run(() => api(`/api/regions/${r.id}`, { method: "DELETE" }), "Region deleted.")) router.refresh();
                  }}><Trash2 /></Button>
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>
      {editing && (
        <SimpleDialog
          title={editing === "new" ? "Add region" : `Edit ${editing.name}`}
          url={editing === "new" ? "/api/regions" : `/api/regions/${editing.id}`}
          method={editing === "new" ? "POST" : "PATCH"}
          initial={{ name: editing === "new" ? "" : editing.name, code: editing === "new" ? "" : editing.code ?? "" }}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

function SimpleDialog({ title, url, method, initial, regions, onClose }: {
  title: string; url: string; method: string; initial: { name: string; code: string; regionId?: string; isActive?: boolean }; regions?: R[]; onClose: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api(url, { method, body: v });
      onClose();
      router.refresh();
    } catch (e) {
      if (e instanceof ClientError) setErrors({ ...e.fields, _: e.message });
    } finally { setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} size="sm" title={title}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4">
        {errors._ && <p className="rounded-md bg-destructive-soft p-3 text-[13px] text-destructive">{errors._}</p>}
        <Field label="Name" required error={errors.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        {regions && (
          <Field label="Region" required error={errors.regionId}>
            <Select value={v.regionId} onChange={(e) => setV({ ...v, regionId: e.target.value })}>
              <option value="">Select…</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Code" hint="Optional official code" error={errors.code}><Input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} /></Field>
        {v.isActive !== undefined && <Switch checked={v.isActive} onChange={(isActive) => setV({ ...v, isActive })} label="Active" />}
      </div>
    </Dialog>
  );
}
