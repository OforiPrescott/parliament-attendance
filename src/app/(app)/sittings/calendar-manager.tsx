"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { api, ClientError, run } from "@/lib/client";
import { fmtDate } from "@/lib/utils";

type Parl = { id: number; number: number; name: string; start_date: string; end_date: string | null; is_current: number };
type Sess = { id: number; parliament_id: number; number: number; name: string; start_date: string; end_date: string | null; parliament_name: string };
type Meet = { id: number; session_id: number; number: number; name: string; start_date: string; end_date: string | null; session_name: string; sittings: number };
type Kind = "parliaments" | "sessions" | "meetings";
type Editing = { kind: Kind; row: Record<string, unknown> | null };

export function CalendarManager({ data, canManage }: { data: { parliaments: Parl[]; sessions: Sess[]; meetings: Meet[] }; canManage: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Editing | null>(null);
  const del = async (kind: Kind, id: number, name: string) => {
    if ((await confirm({ title: `Delete ${name}?`, destructive: true, confirmLabel: "Delete", message: "Items that have sessions, meetings, sittings or members attached cannot be deleted." })) === false) return;
    if (await run(() => api(`/api/calendar/${kind}/${id}`, { method: "DELETE" }), "Deleted.")) router.refresh();
  };
  const actions = (kind: Kind, row: { id: number; name: string }) => canManage && (
    <TD className="w-24 text-right">
      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing({ kind, row: row as unknown as Record<string, unknown> })}><Pencil /></Button>
      <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => del(kind, row.id, row.name)}><Trash2 /></Button>
    </TD>
  );
  const add = (kind: Kind) => canManage && <Button size="sm" variant="secondary" onClick={() => setEditing({ kind, row: null })}><Plus />Add</Button>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Parliaments" description="Each Parliament of the Fourth Republic" action={add("parliaments")} />
        <Table>
          <THead><tr><TH>No.</TH><TH>Name</TH><TH>Start</TH><TH>End</TH><TH />{canManage && <TH />}</tr></THead>
          <TBody>{data.parliaments.map((p) => (
            <TR key={p.id}>
              <TD className="num">{p.number}</TD><TD className="font-medium">{p.name}</TD>
              <TD>{fmtDate(p.start_date)}</TD><TD>{p.end_date ? fmtDate(p.end_date) : "—"}</TD>
              <TD>{p.is_current ? <Badge tone="gold">Current</Badge> : null}</TD>{actions("parliaments", p)}
            </TR>
          ))}</TBody>
        </Table>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Sessions" description="Annual sessions of each Parliament" action={add("sessions")} />
          <Table>
            <THead><tr><TH>Session</TH><TH>Parliament</TH><TH>Dates</TH>{canManage && <TH />}</tr></THead>
            <TBody>{data.sessions.map((s) => (
              <TR key={s.id}>
                <TD className="font-medium">{s.name}</TD><TD className="text-[12.5px] text-muted-foreground">{s.parliament_name}</TD>
                <TD className="whitespace-nowrap text-[13px]">{fmtDate(s.start_date)} – {s.end_date ? fmtDate(s.end_date) : "…"}</TD>{actions("sessions", s)}
              </TR>
            ))}</TBody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Meetings" description="Meeting periods within each session" action={add("meetings")} />
          <Table>
            <THead><tr><TH>Meeting</TH><TH>Dates</TH><TH className="text-right">Sittings</TH>{canManage && <TH />}</tr></THead>
            <TBody>{data.meetings.map((m) => (
              <TR key={m.id}>
                <TD><div className="font-medium">{m.name}</div><div className="text-[12px] text-muted-foreground">{m.session_name}</div></TD>
                <TD className="whitespace-nowrap text-[13px]">{fmtDate(m.start_date)} – {m.end_date ? fmtDate(m.end_date) : "…"}</TD>
                <TD className="num text-right"><Link href={`/sittings?meetingId=${m.id}`} className="text-primary hover:underline">{m.sittings}</Link></TD>
                {actions("meetings", m)}
              </TR>
            ))}</TBody>
          </Table>
        </Card>
      </div>
      {editing && <CalendarDialog editing={editing} data={data} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CalendarDialog({ editing, data, onClose }: { editing: Editing; data: { parliaments: Parl[]; sessions: Sess[] }; onClose: () => void }) {
  const router = useRouter();
  const r = editing.row as Record<string, string | number | null> | null;
  const [v, setV] = useState({
    number: String(r?.number ?? ""), name: String(r?.name ?? ""), startDate: String(r?.start_date ?? ""), endDate: String(r?.end_date ?? ""),
    isCurrent: !!r?.is_current, parliamentId: String(r?.parliament_id ?? data.parliaments[0]?.id ?? ""), sessionId: String(r?.session_id ?? data.sessions[0]?.id ?? ""),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const label = { parliaments: "Parliament", sessions: "session", meetings: "meeting" }[editing.kind];
  async function save() {
    setBusy(true);
    try {
      await api(r ? `/api/calendar/${editing.kind}/${r.id}` : `/api/calendar/${editing.kind}`, { method: r ? "PATCH" : "POST", body: v });
      onClose();
      router.refresh();
    } catch (e) {
      if (e instanceof ClientError) setErrors({ ...e.fields, _: e.message });
    } finally { setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} size="sm" title={`${r ? "Edit" : "Add"} ${label}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4">
        {errors._ && <p className="rounded-md bg-destructive-soft p-3 text-[13px] text-destructive">{errors._}</p>}
        {editing.kind === "sessions" && (
          <Field label="Parliament" required>
            <Select value={v.parliamentId} onChange={(e) => setV({ ...v, parliamentId: e.target.value })}>
              {data.parliaments.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        )}
        {editing.kind === "meetings" && (
          <Field label="Session" required>
            <Select value={v.sessionId} onChange={(e) => setV({ ...v, sessionId: e.target.value })}>
              {data.sessions.map((s) => <option key={s.id} value={s.id}>{s.parliament_name} · {s.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-[90px_1fr] gap-3">
          <Field label="Number" required error={errors.number}><Input type="number" min={1} value={v.number} onChange={(e) => setV({ ...v, number: e.target.value })} /></Field>
          <Field label="Name" required error={errors.name}>
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={editing.kind === "meetings" ? "e.g. Third Meeting" : editing.kind === "sessions" ? "e.g. Second Session" : "e.g. Ninth Parliament of the Fourth Republic"} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" required error={errors.startDate}><Input type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} /></Field>
          <Field label="End date" error={errors.endDate}><Input type="date" value={v.endDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} /></Field>
        </div>
        {editing.kind === "parliaments" && <Switch checked={v.isCurrent} onChange={(isCurrent) => setV({ ...v, isCurrent })} label="This is the current Parliament" />}
      </div>
    </Dialog>
  );
}
