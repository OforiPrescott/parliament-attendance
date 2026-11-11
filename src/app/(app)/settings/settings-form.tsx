"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ClipboardCheck, Database, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Switch } from "@/components/ui/form";
import { api, ClientError } from "@/lib/client";

type S = {
  institution_name: string; system_name: string; default_sitting_start: string; late_after_minutes: number; absence_alert_threshold: number;
  count_official_duty_present: boolean; session_idle_minutes: number; session_max_hours: number; max_failed_logins: number;
  lockout_minutes: number; password_min_length: number; password_expiry_days: number;
};

export function SettingsForm({ initial, system }: { initial: S; system: { db: string; sizeMb: number; attendance: number; audit: number; node: string; env: string } }) {
  const router = useRouter();
  const [v, setV] = useState<S>(initial);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const num = (k: keyof S) => ({ type: "number", value: String(v[k]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) });

  async function save() {
    setBusy(true);
    setErr({});
    try {
      await api("/api/settings", { method: "PATCH", body: v });
      toast.success("Settings saved.");
      router.refresh();
    } catch (e) { if (e instanceof ClientError) { setErr(e.fields); toast.error(e.message); } } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Building2 className="size-4 text-gold" />Institution</span>} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Institution name" error={err.institution_name}><Input value={v.institution_name} onChange={(e) => setV({ ...v, institution_name: e.target.value })} /></Field>
            <Field label="System name" error={err.system_name}><Input value={v.system_name} onChange={(e) => setV({ ...v, system_name: e.target.value })} /></Field>
            <p className="text-[12.5px] text-muted-foreground sm:col-span-2">
              The official logo is read from <code className="rounded bg-muted px-1">public/branding/parliament-logo.png</code> on the server and appears on the sign-in page, navigation and PDF reports.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><ClipboardCheck className="size-4 text-gold" />Attendance rules</span>} />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Default sitting start" error={err.default_sitting_start}><Input type="time" value={v.default_sitting_start} onChange={(e) => setV({ ...v, default_sitting_start: e.target.value })} /></Field>
            <Field label="Late after (minutes)" error={err.late_after_minutes} hint="Guidance for officers"><Input {...num("late_after_minutes")} /></Field>
            <Field label="Absence alert threshold" error={err.absence_alert_threshold} hint="Unexcused absences per meeting"><Input {...num("absence_alert_threshold")} /></Field>
            <div className="sm:col-span-3">
              <Switch checked={v.count_official_duty_present} onChange={(c) => setV({ ...v, count_official_duty_present: c })}
                label="Count 'official duty' as attended in attendance rates" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><ShieldCheck className="size-4 text-gold" />Security policy</span>} />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Idle sign-out (minutes)" error={err.session_idle_minutes}><Input {...num("session_idle_minutes")} /></Field>
            <Field label="Maximum session (hours)" error={err.session_max_hours}><Input {...num("session_max_hours")} /></Field>
            <Field label="Failed sign-ins before lockout" error={err.max_failed_logins}><Input {...num("max_failed_logins")} /></Field>
            <Field label="Lockout duration (minutes)" error={err.lockout_minutes}><Input {...num("lockout_minutes")} /></Field>
            <Field label="Minimum password length" error={err.password_min_length}><Input {...num("password_min_length")} /></Field>
            <Field label="Password expiry (days)" error={err.password_expiry_days} hint="0 = never"><Input {...num("password_expiry_days")} /></Field>
          </CardBody>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={!dirty} onClick={() => setV(initial)}>Discard</Button>
          <Button onClick={save} loading={busy} disabled={!dirty}>Save settings</Button>
        </div>
      </div>
      <Card className="h-fit">
        <CardHeader title={<span className="flex items-center gap-2"><Database className="size-4 text-gold" />System</span>} />
        <CardBody className="space-y-3 text-[13px]">
          {([["Database", `MySQL ${system.db}`], ["Database size", `${system.sizeMb} MB`], ["Attendance records", system.attendance.toLocaleString("en-GB")],
            ["Audit entries", system.audit.toLocaleString("en-GB")], ["Runtime", `Node.js ${system.node}`], ["Environment", system.env]] as const).map(([k, val]) => (
            <div key={k} className="flex justify-between gap-4 border-b pb-2 last:border-0"><span className="text-muted-foreground">{k}</span><span className="num text-right font-medium">{val}</span></div>
          ))}
          <p className="pt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            Backups run on the server via <code className="rounded bg-muted px-1">scripts/backup.sh</code> (scheduled with cron). See the installation guide for restore procedures.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
