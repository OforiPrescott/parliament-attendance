"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { api, ClientError, run } from "@/lib/client";

type Committee = { id: number; name: string; type: string; is_active: number; members: number; chair: string | null };
type Mp = { id: number; name: string; party: string | null; constituency: string | null };

export function CommitteeManager({ committees, canManage, mps }: { committees: Committee[]; canManage: boolean; mps: Mp[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Committee | "new" | null>(null);
  const [members, setMembers] = useState<Committee | null>(null);
  return (
    <Card>
      {canManage && <div className="flex justify-end border-b p-4"><Button onClick={() => setEditing("new")}><Plus />Add committee</Button></div>}
      {committees.length ? (
        <Table>
          <THead><tr><TH>Committee</TH><TH>Type</TH><TH>Chair</TH><TH className="text-right">Members</TH><TH>Status</TH>{canManage && <TH />}</tr></THead>
          <TBody>
            {committees.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">{c.name}</TD>
                <TD className="capitalize text-muted-foreground">{c.type.replace("_", "-").toLowerCase()}</TD>
                <TD>{c.chair ?? <span className="text-muted-foreground">—</span>}</TD>
                <TD className="num text-right">{c.members}</TD>
                <TD>{c.is_active ? <Badge tone="success" dot>Active</Badge> : <Badge>Inactive</Badge>}</TD>
                {canManage && (
                  <TD className="whitespace-nowrap text-right">
                    <Button variant="secondary" size="sm" onClick={() => setMembers(c)}><Users />Members</Button>
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(c)}><Pencil /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={async () => {
                      if ((await confirm({ title: `Delete ${c.name}?`, destructive: true, confirmLabel: "Delete", message: "A committee with recorded sittings cannot be deleted — mark it inactive instead." })) === false) return;
                      if (await run(() => api(`/api/committees/${c.id}`, { method: "DELETE" }), "Committee deleted.")) router.refresh();
                    }}><Trash2 /></Button>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      ) : <EmptyState icon={Users} title="No committees yet" />}
      {editing && <CommitteeDialog committee={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {members && <MembersDialog committee={members} mps={mps} onClose={() => setMembers(null)} />}
    </Card>
  );
}

function CommitteeDialog({ committee, onClose }: { committee: Committee | null; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: committee?.name ?? "", type: committee?.type ?? "SELECT", isActive: committee ? !!committee.is_active : true });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api(committee ? `/api/committees/${committee.id}` : "/api/committees", { method: committee ? "PATCH" : "POST", body: v });
      onClose(); router.refresh();
    } catch (e) { if (e instanceof ClientError) setErr({ ...e.fields, _: e.message }); } finally { setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} size="sm" title={committee ? "Edit committee" : "Add committee"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4">
        {err._ && <p className="rounded-md bg-destructive-soft p-3 text-[13px] text-destructive">{err._}</p>}
        <Field label="Name" required error={err.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Type">
          <Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
            <option value="STANDING">Standing</option><option value="SELECT">Select</option><option value="AD_HOC">Ad hoc</option>
          </Select>
        </Field>
        <Switch checked={v.isActive} onChange={(isActive) => setV({ ...v, isActive })} label="Active" />
      </div>
    </Dialog>
  );
}

const ROLES = [["CHAIR", "Chair"], ["VICE_CHAIR", "Vice-chair"], ["RANKING", "Ranking member"], ["MEMBER", "Member"]] as const;

function MembersDialog({ committee, mps, onClose }: { committee: Committee; mps: Mp[]; onClose: () => void }) {
  const router = useRouter();
  const [list, setList] = useState<{ mpId: number; role: string }[] | null>(null);
  const [q, setQ] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ mp_id: number; role: string }[]>(`/api/committees/${committee.id}/members`)
      .then((r) => setList(r.map((m) => ({ mpId: m.mp_id, role: m.role }))))
      .catch((e) => toast.error(e.message));
  }, [committee.id]);
  const byId = useMemo(() => new Map(mps.map((m) => [m.id, m])), [mps]);
  const candidates = useMemo(() => {
    if (!q || !list) return [];
    const chosen = new Set(list.map((l) => l.mpId));
    return mps.filter((m) => !chosen.has(m.id) && `${m.name} ${m.constituency ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  }, [q, list, mps]);

  async function save() {
    setBusy(true);
    const r = await run(() => api<{ added: number; removed: number; changed: number }>(`/api/committees/${committee.id}/members`, { method: "PUT", body: { members: list, effectiveDate: date } }));
    setBusy(false);
    if (r) { toast.success(`Saved: ${r.added} added, ${r.removed} removed, ${r.changed} role changes.`); onClose(); router.refresh(); }
  }

  return (
    <Dialog open onClose={onClose} size="lg" title={`${committee.name} — members`}
      description="Changes take effect from the date below; earlier committee registers keep their original membership."
      footer={<>
        <div className="mr-auto flex items-center gap-2 text-[13px]"><span className="text-muted-foreground">Effective</span><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[150px]" /></div>
        <Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy} disabled={!list}>Save membership</Button>
      </>}>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Add a member — search by name or constituency" value={q} onChange={(e) => setQ(e.target.value)} />
        {candidates.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-card shadow-elevated">
            {candidates.map((m) => (
              <li key={m.id}>
                <button className="flex w-full items-center justify-between px-3 py-2 text-left text-[13.5px] hover:bg-muted"
                  onClick={() => { setList((l) => [...(l ?? []), { mpId: m.id, role: "MEMBER" }]); setQ(""); }}>
                  <span>{m.name}</span><span className="text-[12px] text-muted-foreground">{m.party} · {m.constituency}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!list ? <p className="text-[13px] text-muted-foreground">Loading…</p> : list.length === 0 ? <p className="text-[13px] text-muted-foreground">No members yet.</p> : (
        <ul className="divide-y rounded-md border">
          {list.map((l) => {
            const mp = byId.get(l.mpId);
            return (
              <li key={l.mpId} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium">{mp?.name ?? `Member #${l.mpId}`}</div>
                  <div className="text-[12px] text-muted-foreground">{mp ? `${mp.party ?? ""} · ${mp.constituency ?? ""}` : "No longer active"}</div>
                </div>
                <div className="w-44">
                  <Select value={l.role} onChange={(e) => setList((x) => x!.map((y) => (y.mpId === l.mpId ? { ...y, role: e.target.value } : y)))}>
                    {ROLES.map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
                  </Select>
                </div>
                <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setList((x) => x!.filter((y) => y.mpId !== l.mpId))}><X /></Button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
