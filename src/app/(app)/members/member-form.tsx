"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { api, ClientError } from "@/lib/client";
import { MP_STATUS_META } from "@/lib/utils";

export type Ref = {
  parties: { id: number; abbreviation: string; name: string; is_active: number }[];
  regions: { id: number; name: string }[];
  constituencies: { id: number; name: string; region_id: number; region_name: string }[];
  parliaments: { id: number; name: string; start_date: string; is_current: number }[];
};

export type MpValues = {
  id?: number; parliamentaryId: string; title: string; firstName: string; otherNames: string; lastName: string;
  gender: "M" | "F"; email: string; phone: string; status: string;
};

const blank: MpValues = { parliamentaryId: "", title: "Hon.", firstName: "", otherNames: "", lastName: "", gender: "M", email: "", phone: "", status: "ACTIVE" };

/** Create (with first membership) or edit an MP's personal details and status. */
export function MpFormDialog({ open, onClose, ref_, initial }: { open: boolean; onClose: () => void; ref_: Ref; initial?: MpValues & { currentStatus?: string } }) {
  const router = useRouter();
  const editing = !!initial?.id;
  const current = ref_.parliaments.find((p) => p.is_current) ?? ref_.parliaments[0];
  const [v, setV] = useState<MpValues>(initial ?? blank);
  const [m, setM] = useState({ partyId: "", regionId: "", constituencyId: "", parliamentId: String(current?.id ?? ""), termStart: current?.start_date ?? "" });
  const [leave, setLeave] = useState({ statusDate: "", statusReason: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof MpValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const consts = useMemo(() => ref_.constituencies.filter((c) => !m.regionId || c.region_id === Number(m.regionId)), [ref_.constituencies, m.regionId]);
  const leaving = editing && v.status !== initial?.currentStatus && !["ACTIVE", "SUSPENDED"].includes(v.status);

  async function save() {
    setBusy(true);
    setErrors({});
    try {
      if (editing) {
        await api(`/api/mps/${initial!.id}`, { method: "PATCH", body: { ...v, ...(leaving ? leave : {}) } });
        toast.success("Member updated.");
      } else {
        const r = await api<{ id: number }>("/api/mps", { body: { ...v, ...m } });
        toast.success("Member added.");
        router.push(`/members/${r.id}`);
      }
      onClose();
      router.refresh();
    } catch (e) {
      if (e instanceof ClientError) { setErrors(e.fields); toast.error(e.message); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg" title={editing ? "Edit member" : "Add a Member of Parliament"}
      description={editing ? "To record a change of party or constituency, use 'Record membership change' instead." : "The first membership period is created with the member."}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>{editing ? "Save changes" : "Add member"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="Title" className="sm:col-span-2" error={errors.title}>
          <Select value={v.title} onChange={set("title")}>
            {["Hon.", "Hon. Dr.", "Hon. Prof.", "Hon. Mrs.", "Hon. Ms.", "Rt. Hon."].map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Parliamentary ID" required className="sm:col-span-4" error={errors.parliamentaryId}>
          <Input value={v.parliamentaryId} onChange={set("parliamentaryId")} placeholder="e.g. MP9-001" aria-invalid={!!errors.parliamentaryId} />
        </Field>
        <Field label="First name" required className="sm:col-span-2" error={errors.firstName}>
          <Input value={v.firstName} onChange={set("firstName")} aria-invalid={!!errors.firstName} />
        </Field>
        <Field label="Other names" className="sm:col-span-2" error={errors.otherNames}><Input value={v.otherNames} onChange={set("otherNames")} /></Field>
        <Field label="Surname" required className="sm:col-span-2" error={errors.lastName}>
          <Input value={v.lastName} onChange={set("lastName")} aria-invalid={!!errors.lastName} />
        </Field>
        <Field label="Gender" required className="sm:col-span-2">
          <Select value={v.gender} onChange={set("gender")}><option value="M">Male</option><option value="F">Female</option></Select>
        </Field>
        <Field label="Email" className="sm:col-span-2" error={errors.email}><Input type="email" value={v.email} onChange={set("email")} aria-invalid={!!errors.email} /></Field>
        <Field label="Phone" className="sm:col-span-2" error={errors.phone}><Input value={v.phone} onChange={set("phone")} /></Field>

        {editing ? (
          <Field label="Membership status" className="sm:col-span-6">
            <Select value={v.status} onChange={set("status")}>
              {Object.entries(MP_STATUS_META).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </Select>
          </Field>
        ) : (
          <>
            <div className="sm:col-span-6 -mb-1 mt-2 border-t pt-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Seat and party</div>
            <Field label="Party" required className="sm:col-span-2" error={errors.partyId}>
              <Select value={m.partyId} onChange={(e) => setM({ ...m, partyId: e.target.value })} aria-invalid={!!errors.partyId}>
                <option value="">Select…</option>
                {ref_.parties.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.abbreviation} — {p.name}</option>)}
              </Select>
            </Field>
            <Field label="Region" className="sm:col-span-2">
              <Select value={m.regionId} onChange={(e) => setM({ ...m, regionId: e.target.value, constituencyId: "" })}>
                <option value="">All regions</option>
                {ref_.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </Field>
            <Field label="Constituency" required className="sm:col-span-2" error={errors.constituencyId}>
              <Select value={m.constituencyId} onChange={(e) => setM({ ...m, constituencyId: e.target.value })} aria-invalid={!!errors.constituencyId}>
                <option value="">Select…</option>
                {consts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Parliament" required className="sm:col-span-3" error={errors.parliamentId}>
              <Select value={m.parliamentId} onChange={(e) => setM({ ...m, parliamentId: e.target.value })}>
                {ref_.parliaments.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Sworn in / term start" required className="sm:col-span-3" error={errors.termStart}>
              <Input type="date" value={m.termStart} onChange={(e) => setM({ ...m, termStart: e.target.value })} />
            </Field>
          </>
        )}

        {leaving && (
          <div className="grid gap-4 rounded-md border border-warning/30 bg-warning-soft/60 p-4 sm:col-span-6 sm:grid-cols-2">
            <p className="text-[13px] sm:col-span-2">
              The member&apos;s current seat and committee places will be closed on this date, and they will no longer appear on registers after it.
            </p>
            <Field label="Date left office" required error={errors.statusDate}>
              <Input type="date" value={leave.statusDate} onChange={(e) => setLeave({ ...leave, statusDate: e.target.value })} aria-invalid={!!errors.statusDate} />
            </Field>
            <Field label="Reason / reference"><Input value={leave.statusReason} onChange={(e) => setLeave({ ...leave, statusReason: e.target.value })} placeholder="e.g. Resigned — letter dated…" /></Field>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** Floor-crossing, new Parliament, or a constituency change. */
export function MembershipDialog({ open, onClose, ref_, mpId }: { open: boolean; onClose: () => void; ref_: Ref; mpId: number }) {
  const router = useRouter();
  const current = ref_.parliaments.find((p) => p.is_current) ?? ref_.parliaments[0];
  const [v, setV] = useState({ partyId: "", constituencyId: "", parliamentId: String(current?.id ?? ""), effectiveDate: "", reason: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const r = await api<{ recordsOnOrAfter: number }>(`/api/mps/${mpId}/membership`, { body: v });
      toast.success("Membership change recorded.", {
        description: r.recordsOnOrAfter ? `${r.recordsOnOrAfter} attendance record(s) on or after this date keep the party/constituency recorded at the time.` : undefined,
      });
      onClose();
      router.refresh();
    } catch (e) {
      if (e instanceof ClientError) { setErrors(e.fields); toast.error(e.message); }
    } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Record membership change" description="Closes the current membership period and opens a new one. History is preserved."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Record change</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New party" required error={errors.partyId}>
          <Select value={v.partyId} onChange={(e) => setV({ ...v, partyId: e.target.value })}>
            <option value="">Select…</option>
            {ref_.parties.map((p) => <option key={p.id} value={p.id}>{p.abbreviation}</option>)}
          </Select>
        </Field>
        <Field label="Constituency" required error={errors.constituencyId}>
          <Select value={v.constituencyId} onChange={(e) => setV({ ...v, constituencyId: e.target.value })}>
            <option value="">Select…</option>
            {ref_.constituencies.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.region_name})</option>)}
          </Select>
        </Field>
        <Field label="Parliament" required>
          <Select value={v.parliamentId} onChange={(e) => setV({ ...v, parliamentId: e.target.value })}>
            {ref_.parliaments.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Effective date" required error={errors.effectiveDate}>
          <Input type="date" value={v.effectiveDate} onChange={(e) => setV({ ...v, effectiveDate: e.target.value })} />
        </Field>
        <Field label="Reason" required className="sm:col-span-2" error={errors.reason} hint="e.g. 'Declared as independent', 'Re-elected to the Tenth Parliament'">
          <Input value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
