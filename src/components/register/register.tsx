"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCheck, CheckCircle2, Clock, Filter, PenLine, RotateCcw, Save, Search, Send, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge, PartyChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { MpAvatar } from "@/components/ui/misc";
import { api, ClientError, run } from "@/lib/client";
import { cn, STATUS_META, type AttendanceStatus } from "@/lib/utils";

export type RegRow = {
  mp_id: number; parliamentary_id: string; title: string | null; full_name: string; photo: number;
  party_id: number; party_abbr: string; party_color: string; constituency_name: string; region_name: string;
  attendance_id: number | null; status: string | null; arrival_time: string | null; remarks: string | null; pending_correction: number;
};
type Sit = { id: number; register_status: string; submitted_by: number | null; start_time: string; title: string };
type Perms = { capture: boolean; review: boolean; requestCorrection: boolean; reopen: boolean; userId: number };

type Draft = { status: AttendanceStatus | null; arrivalTime: string; remarks: string };
const STATUSES = Object.keys(STATUS_META) as AttendanceStatus[];
const TONE_CLASS: Record<string, string> = {
  success: "bg-success text-white border-success",
  warning: "bg-warning text-white border-warning",
  destructive: "bg-destructive text-white border-destructive",
  info: "bg-info text-white border-info",
  gold: "bg-gold text-gold-foreground border-gold",
};

export function Register({ sitting, rows, mode, perms }: { sitting: Sit; rows: RegRow[]; mode: "edit" | "view"; perms: Perms }) {
  const router = useRouter();
  const confirm = useConfirm();
  const initial = useMemo(
    () => new Map(rows.map((r) => [r.mp_id, { status: (r.status as AttendanceStatus) ?? null, arrivalTime: r.arrival_time?.slice(0, 5) ?? "", remarks: r.remarks ?? "" }])),
    [rows],
  );
  const [draft, setDraft] = useState<Map<number, Draft>>(initial);
  const [q, setQ] = useState("");
  const [party, setParty] = useState("");
  const [only, setOnly] = useState<"" | "unmarked" | AttendanceStatus>("");
  const [saving, setSaving] = useState(false);
  const [correcting, setCorrecting] = useState<RegRow | null>(null);
  useEffect(() => setDraft(initial), [initial]);

  const dirty = useMemo(() => [...draft].filter(([id, d]) => {
    const o = initial.get(id)!;
    return d.status !== o.status || d.arrivalTime !== o.arrivalTime || d.remarks !== o.remarks;
  }).map(([id]) => id), [draft, initial]);

  // Warn before leaving with unsaved changes
  const dirtyRef = useRef(0);
  dirtyRef.current = dirty.length;
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { unmarked: 0 };
    STATUSES.forEach((s) => (c[s] = 0));
    draft.forEach((d) => (d.status ? c[d.status]++ : c.unmarked++));
    return c;
  }, [draft]);

  const parties = useMemo(() => [...new Map(rows.map((r) => [r.party_abbr, r.party_color])).entries()].filter(([a]) => a), [rows]);
  const shown = rows.filter((r) => {
    const d = draft.get(r.mp_id)!;
    if (party && r.party_abbr !== party) return false;
    if (only === "unmarked" && d.status) return false;
    if (only && only !== "unmarked" && d.status !== only) return false;
    if (q && !`${r.full_name} ${r.constituency_name} ${r.parliamentary_id}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const update = (id: number, patch: Partial<Draft>) =>
    setDraft((m) => {
      const n = new Map(m);
      const cur = n.get(id)!;
      const next = { ...cur, ...patch };
      if (patch.status && !["PRESENT", "LATE"].includes(patch.status)) next.arrivalTime = "";
      n.set(id, next);
      return n;
    });

  const markRest = (status: AttendanceStatus) => {
    const n = new Map(draft);
    let k = 0;
    for (const r of shown) {
      const d = n.get(r.mp_id)!;
      if (!d.status) { n.set(r.mp_id, { ...d, status }); k++; }
    }
    setDraft(n);
    toast.info(`${k} member(s) marked ${STATUS_META[status].label.toLowerCase()}.`);
  };

  async function save(silent = false) {
    const ids = dirty;
    if (!ids.length) return true;
    const body = { rows: ids.filter((id) => draft.get(id)!.status).map((id) => {
      const d = draft.get(id)!;
      return { mpId: id, status: d.status, arrivalTime: d.arrivalTime || null, remarks: d.remarks || null };
    }) };
    if (!body.rows.length) return true;
    setSaving(true);
    try {
      await api(`/api/sittings/${sitting.id}/register`, { method: "PUT", body });
      if (!silent) toast.success(`Saved ${body.rows.length} change(s).`);
      router.refresh();
      return true;
    } catch (e) {
      toast.error(e instanceof ClientError ? e.message : "Save failed.");
      return false;
    } finally { setSaving(false); }
  }

  async function action(a: "submit" | "approve" | "return" | "reopen") {
    let comment: string | undefined;
    if (a === "submit") {
      if (counts.unmarked) return toast.error(`${counts.unmarked} member(s) still have no status.`);
      const ok = await confirm({ title: "Submit register for approval?", confirmLabel: "Submit",
        message: <>The register will be locked and sent to a reviewer. <b>{counts.PRESENT + counts.LATE}</b> present, <b>{counts.ABSENT}</b> absent, <b>{counts.EXCUSED}</b> excused, <b>{counts.OFFICIAL_DUTY}</b> on official duty.</> });
      if (ok === false) return;
      if (!(await save(true))) return;
    }
    if (a === "approve") {
      const ok = await confirm({ title: "Approve this register?", confirmLabel: "Approve", message: "Approved registers are locked and count towards official attendance figures. Later changes need a correction request." });
      if (ok === false) return;
    }
    if (a === "return" || a === "reopen") {
      const r = await confirm({
        title: a === "return" ? "Return register for amendment" : "Reopen approved register", destructive: a === "reopen", confirmLabel: a === "return" ? "Return" : "Reopen",
        message: a === "return" ? "The attendance officer will see your comment and can amend and resubmit." : "This unlocks an approved register for editing. Use only for substantial errors — prefer correction requests.",
        reason: { label: a === "return" ? "What needs correcting?" : "Reason for reopening", required: true },
      });
      if (r === false) return;
      comment = r;
    }
    const res = await run(() => api(`/api/sittings/${sitting.id}/register`, { body: { action: a, comment } }),
      { submit: "Register submitted for approval.", approve: "Register approved.", return: "Register returned to the officer.", reopen: "Register reopened." }[a]);
    if (res) {
      router.refresh();
      if (a === "submit") router.push(`/sittings/${sitting.id}`);
    }
  }

  const total = rows.length;
  const marked = total - counts.unmarked;
  const attended = counts.PRESENT + counts.LATE + counts.OFFICIAL_DUTY;
  const isEdit = mode === "edit";
  const canReviewThis = perms.review && sitting.register_status === "SUBMITTED" && sitting.submitted_by !== perms.userId;

  return (
    <>
      {/* Summary strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryTile label="Expected" value={total} />
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setOnly(only === s ? "" : s)} className="text-left">
            <SummaryTile label={STATUS_META[s].label} value={counts[s]} tone={STATUS_META[s].tone} active={only === s} />
          </button>
        ))}
      </div>

      <Card className="overflow-visible">
        {/* Toolbar */}
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-t-lg border-b bg-card/95 p-3 backdrop-blur">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Find member or constituency" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="w-32"><Select value={party} onChange={(e) => setParty(e.target.value)} aria-label="Party"><option value="">All parties</option>{parties.map(([a]) => <option key={a}>{a}</option>)}</Select></div>
          {isEdit && (
            <Button variant={only === "unmarked" ? "primary" : "secondary"} size="sm" onClick={() => setOnly(only === "unmarked" ? "" : "unmarked")}>
              <Filter />Unmarked <span className="num">{counts.unmarked}</span>
            </Button>
          )}
          {isEdit && counts.unmarked > 0 && (
            <Button variant="secondary" size="sm" onClick={() => markRest("PRESENT")}><CheckCheck />Mark remaining present</Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {isEdit && (
              <>
                <span className="num hidden text-[12.5px] text-muted-foreground md:inline">{marked}/{total} marked{dirty.length ? ` · ${dirty.length} unsaved` : ""}</span>
                <Button variant="secondary" onClick={() => save()} loading={saving} disabled={!dirty.length}><Save />Save draft</Button>
                <Button onClick={() => action("submit")} disabled={saving}><Send />Submit</Button>
              </>
            )}
            {!isEdit && canReviewThis && (
              <>
                <Button variant="secondary" onClick={() => action("return")}><Undo2 />Return</Button>
                <Button onClick={() => action("approve")}><CheckCircle2 />Approve</Button>
              </>
            )}
            {!isEdit && perms.review && sitting.register_status === "SUBMITTED" && sitting.submitted_by === perms.userId && (
              <span className="text-[12.5px] text-muted-foreground">You submitted this register — another reviewer must approve it.</span>
            )}
            {!isEdit && perms.reopen && sitting.register_status === "APPROVED" && (
              <Button variant="ghost" size="sm" onClick={() => action("reopen")}><RotateCcw />Reopen</Button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="h-1 bg-muted">
          <div className="h-full bg-gold transition-all" style={{ width: `${total ? (marked / total) * 100 : 0}%` }} />
        </div>

        <ul className="divide-y">
          {shown.map((r) => {
            const d = draft.get(r.mp_id)!;
            const changed = dirty.includes(r.mp_id);
            return (
              <li key={r.mp_id} className={cn("flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center", changed && "bg-gold-soft/40")}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <MpAvatar id={r.mp_id} name={r.full_name} photo={r.photo} size={38} />
                  <div className="min-w-0">
                    <Link href={`/members/${r.mp_id}`} className="block truncate text-[14px] font-medium hover:text-primary">{r.title ? `${r.title} ` : ""}{r.full_name}</Link>
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <PartyChip abbr={r.party_abbr} color={r.party_color} />
                      <span className="truncate">{r.constituency_name}</span>
                    </div>
                  </div>
                </div>

                {isEdit ? (
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <div className="flex overflow-hidden rounded-md border" role="radiogroup" aria-label={`Status for ${r.full_name}`}>
                      {STATUSES.map((s) => {
                        const meta = STATUS_META[s];
                        const on = d.status === s;
                        return (
                          <button key={s} role="radio" aria-checked={on} title={meta.label}
                            onClick={() => update(r.mp_id, { status: s })}
                            className={cn("h-8 min-w-[38px] border-r px-2 text-[12px] font-semibold last:border-r-0 transition-colors",
                              on ? TONE_CLASS[meta.tone] : "bg-card text-muted-foreground hover:bg-muted")}>
                            {meta.short}
                          </button>
                        );
                      })}
                    </div>
                    {(d.status === "LATE" || d.status === "PRESENT") && (
                      <div className="relative">
                        <Clock className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input type="time" value={d.arrivalTime} onChange={(e) => update(r.mp_id, { arrivalTime: e.target.value })}
                          className="h-8 w-[112px] pl-7 text-[12.5px]" aria-label="Arrival time" />
                      </div>
                    )}
                    <Input value={d.remarks} onChange={(e) => update(r.mp_id, { remarks: e.target.value })} placeholder="Remarks"
                      className="h-8 w-full text-[12.5px] md:w-44" maxLength={255} aria-label="Remarks" />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 md:justify-end">
                    {d.status ? <Badge tone={STATUS_META[d.status].tone}>{STATUS_META[d.status].label}</Badge> : <Badge>Not recorded</Badge>}
                    {d.arrivalTime && <span className="num text-[12.5px] text-muted-foreground">{d.arrivalTime}</span>}
                    {d.remarks && <span className="max-w-[240px] truncate text-[12.5px] text-muted-foreground" title={d.remarks}>{d.remarks}</span>}
                    {r.pending_correction > 0 && <Badge tone="warning"><AlertCircle className="size-3" />Correction pending</Badge>}
                    {perms.requestCorrection && sitting.register_status === "APPROVED" && r.attendance_id && !r.pending_correction && (
                      <Button variant="ghost" size="sm" onClick={() => setCorrecting(r)}><PenLine />Correct</Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {!shown.length && <li className="px-4 py-10 text-center text-[13px] text-muted-foreground">No members match.</li>}
        </ul>
        <div className="flex items-center justify-between border-t px-4 py-3 text-[12.5px] text-muted-foreground">
          <span>Showing {shown.length} of {total}</span>
          <span className="num">Attendance {total ? ((attended / total) * 100).toFixed(1) : "0.0"}%</span>
        </div>
      </Card>
      {correcting && <CorrectionDialog row={correcting} onClose={() => setCorrecting(null)} />}
    </>
  );
}

function SummaryTile({ label, value, tone, active }: { label: string; value: number; tone?: string; active?: boolean }) {
  const bar: Record<string, string> = { success: "bg-success", warning: "bg-warning", destructive: "bg-destructive", info: "bg-info", gold: "bg-gold" };
  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-card px-4 py-3 shadow-card transition", active && "ring-2 ring-primary")}>
      {tone && <span className={cn("absolute inset-y-0 left-0 w-1", bar[tone])} />}
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="num font-serif text-[24px] font-semibold leading-tight">{value}</div>
    </div>
  );
}

function CorrectionDialog({ row, onClose }: { row: RegRow; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ newStatus: (row.status ?? "PRESENT") as string, newRemarks: row.remarks ?? "", reason: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api("/api/corrections", { body: { attendanceId: row.attendance_id, ...v } });
      toast.success("Correction request sent for review.");
      onClose();
      router.refresh();
    } catch (e) {
      if (e instanceof ClientError) { setErr(e.fields); toast.error(e.message); }
    } finally { setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title="Request a correction" description={`${row.full_name} · currently ${STATUS_META[row.status as AttendanceStatus]?.label ?? "—"}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Send for review</Button></>}>
      <div className="space-y-4">
        <Field label="Correct status" required>
          <Select value={v.newStatus} onChange={(e) => setV({ ...v, newStatus: e.target.value })}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </Select>
        </Field>
        <Field label="Remarks"><Input value={v.newRemarks} onChange={(e) => setV({ ...v, newRemarks: e.target.value })} maxLength={255} /></Field>
        <Field label="Reason and supporting evidence" required error={err.reason} hint="e.g. Speaker's permission letter ref., Votes and Proceedings page">
          <Textarea value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} maxLength={500} />
        </Field>
        <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-[12.5px] text-muted-foreground">
          <XCircle className="mt-0.5 size-4 shrink-0" />The record will not change until an approver accepts the request. Both the original and corrected values are kept in the audit trail.
        </p>
      </div>
    </Dialog>
  );
}
