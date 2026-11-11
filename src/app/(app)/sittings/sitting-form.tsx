"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { api, ClientError } from "@/lib/client";
import { cn } from "@/lib/utils";

type Meeting = { id: number; name: string; session_name: string; start_date?: string; end_date?: string | null };
type Committee = { id: number; name: string; is_active: number };

export type SittingValues = {
  id?: number; meetingId: string; sittingType: string; committeeId: string; title: string; sittingDate: string;
  startTime: string; endTime: string; venue: string; status: string;
};

export function SittingActions({ meetings, committees }: { meetings: Meeting[]; committees: Committee[] }) {
  const [single, setSingle] = useState(false);
  const [bulk, setBulk] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setBulk(true)}><Wand2 />Generate for a meeting</Button>
      <Button onClick={() => setSingle(true)}><CalendarPlus />New sitting</Button>
      {single && <SittingDialog onClose={() => setSingle(false)} meetings={meetings} committees={committees} />}
      {bulk && <BulkDialog onClose={() => setBulk(false)} meetings={meetings} />}
    </>
  );
}

export function SittingDialog({ onClose, meetings, committees, initial, locked }: {
  onClose: () => void; meetings: Meeting[]; committees: Committee[]; initial?: SittingValues; locked?: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<SittingValues>(initial ?? {
    meetingId: String(meetings[0]?.id ?? ""), sittingType: "PLENARY", committeeId: "", title: "", sittingDate: new Date().toISOString().slice(0, 10),
    startTime: "10:00", endTime: "", venue: "Chamber, Parliament House", status: "SCHEDULED",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof SittingValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    setErrors({});
    try {
      const r = await api<{ id?: number }>(initial?.id ? `/api/sittings/${initial.id}` : "/api/sittings", { method: initial?.id ? "PATCH" : "POST", body: v });
      toast.success(initial?.id ? "Sitting updated." : "Sitting scheduled.");
      onClose();
      if (!initial?.id && r.id) router.push(`/sittings/${r.id}`);
      router.refresh();
    } catch (e) {
      if (e instanceof ClientError) { setErrors(e.fields); toast.error(e.message); }
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onClose={onClose} size="lg" title={initial?.id ? "Edit sitting" : "Schedule a sitting"}
      description={locked ? "Attendance has been recorded, so date, type and committee are locked." : undefined}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" required>
          <Select value={v.sittingType} onChange={set("sittingType")} disabled={locked}>
            <option value="PLENARY">Plenary sitting</option>
            <option value="COMMITTEE">Committee meeting</option>
            <option value="OTHER">Other official activity</option>
          </Select>
        </Field>
        {v.sittingType === "COMMITTEE" ? (
          <Field label="Committee" required error={errors.committeeId}>
            <Select value={v.committeeId} onChange={set("committeeId")} disabled={locked} aria-invalid={!!errors.committeeId}>
              <option value="">Select…</option>
              {committees.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label="Meeting">
            <Select value={v.meetingId} onChange={set("meetingId")}>
              <option value="">None</option>
              {meetings.map((m) => <option key={m.id} value={m.id}>{m.session_name} · {m.name}</option>)}
            </Select>
          </Field>
        )}
        {v.sittingType === "COMMITTEE" && (
          <Field label="Meeting" className="sm:col-span-2">
            <Select value={v.meetingId} onChange={set("meetingId")}>
              <option value="">None</option>
              {meetings.map((m) => <option key={m.id} value={m.id}>{m.session_name} · {m.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Title" required className="sm:col-span-2" error={errors.title}>
          <Input value={v.title} onChange={set("title")} placeholder={v.sittingType === "PLENARY" ? "e.g. Plenary Sitting No. 42" : "e.g. Consideration of the Budget Estimates"} aria-invalid={!!errors.title} />
        </Field>
        <Field label="Date" required error={errors.sittingDate}><Input type="date" value={v.sittingDate} onChange={set("sittingDate")} disabled={locked} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" required error={errors.startTime}><Input type="time" value={v.startTime} onChange={set("startTime")} /></Field>
          <Field label="Ends" error={errors.endTime}><Input type="time" value={v.endTime} onChange={set("endTime")} /></Field>
        </div>
        <Field label="Venue" error={errors.venue}><Input value={v.venue} onChange={set("venue")} /></Field>
        <Field label="Sitting status">
          <Select value={v.status} onChange={set("status")}>
            <option value="SCHEDULED">Scheduled</option><option value="HELD">Held</option>
            <option value="ADJOURNED">Adjourned</option><option value="CANCELLED">Cancelled</option>
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function BulkDialog({ onClose, meetings }: { onClose: () => void; meetings: Meeting[] }) {
  const router = useRouter();
  const [meetingId, setMeetingId] = useState(String(meetings[0]?.id ?? ""));
  const [weekdays, setWeekdays] = useState([2, 3, 4, 5]);
  const [startTime, setStart] = useState("10:00");
  const [venue, setVenue] = useState("Chamber, Parliament House");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await api<{ created: number }>("/api/sittings?bulk=1", { body: { meetingId, weekdays, startTime, venue } });
      toast.success(r.created ? `${r.created} plenary sittings created.` : "No new dates — all sitting days already exist.");
      onClose();
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title="Generate plenary sittings"
      description="Creates a scheduled plenary sitting for every chosen weekday within the meeting's dates. Existing dates are skipped."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={go} loading={busy} disabled={!meetingId || !weekdays.length}>Generate</Button></>}>
      <div className="space-y-4">
        <Field label="Meeting" required>
          <Select value={meetingId} onChange={(e) => setMeetingId(e.target.value)}>
            {meetings.map((m) => <option key={m.id} value={m.id}>{m.session_name} · {m.name}</option>)}
          </Select>
        </Field>
        <Field label="Sitting days">
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <button key={d} type="button" aria-pressed={weekdays.includes(i)}
                onClick={() => setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i].sort()))}
                className={cn("h-9 w-12 rounded-md border text-[13px] font-medium", weekdays.includes(i) ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
                {d}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start time"><Input type="time" value={startTime} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Venue"><Input value={venue} onChange={(e) => setVenue(e.target.value)} /></Field>
        </div>
      </div>
    </Dialog>
  );
}
