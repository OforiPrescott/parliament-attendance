"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flag, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Switch } from "@/components/ui/form";
import { EmptyState, RateBar } from "@/components/ui/misc";
import { api, ClientError, run } from "@/lib/client";

type Party = { id: number; name: string; abbreviation: string; color: string; is_active: number; mps: number; rate: number | null; records: number };

export function PartiesManager({ parties, canManage }: { parties: Party[]; canManage: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Party | "new" | null>(null);
  const total = parties.reduce((a, p) => a + p.mps, 0);

  return (
    <>
      {canManage && (
        <div className="-mt-2 mb-4 flex justify-end"><Button onClick={() => setEditing("new")}><Plus />Add party</Button></div>
      )}
      {parties.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {parties.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="h-1.5" style={{ background: p.color }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-lg text-[13px] font-bold text-white" style={{ background: p.color }}>{p.abbreviation.slice(0, 4)}</span>
                    <div>
                      <div className="font-serif text-[17px] font-semibold leading-tight">{p.name}</div>
                      <div className="text-[12.5px] text-muted-foreground">{p.abbreviation}{!p.is_active && " · inactive"}</div>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${p.abbreviation}`} onClick={() => setEditing(p)}><Pencil /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${p.abbreviation}`} onClick={async () => {
                        if ((await confirm({ title: `Delete ${p.abbreviation}?`, destructive: true, confirmLabel: "Delete", message: "A party with members or attendance history cannot be deleted — mark it inactive instead." })) === false) return;
                        if (await run(() => api(`/api/parties/${p.id}`, { method: "DELETE" }), "Party deleted.")) router.refresh();
                      }}><Trash2 /></Button>
                    </div>
                  )}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <div className="num font-serif text-[28px] font-semibold leading-none">{p.mps}</div>
                    <div className="mt-1 text-[12px] text-muted-foreground">sitting members {total ? `· ${((p.mps / total) * 100).toFixed(0)}%` : ""}</div>
                  </div>
                  <div>
                    {p.rate === null ? <Badge>No data</Badge> : <RateBar value={p.rate} />}
                    <div className="mt-1 text-[12px] text-muted-foreground">plenary attendance</div>
                  </div>
                </div>
                <div className="mt-4 flex gap-4 border-t pt-3 text-[13px]">
                  <Link className="text-primary hover:underline" href={`/members?partyId=${p.id}`}>View members</Link>
                  <Link className="text-primary hover:underline" href={`/reports?type=party&partyId=${p.id}`}>Attendance report</Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card><EmptyState icon={Flag} title="No parties yet" /></Card>
      )}
      {editing && <PartyDialog party={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function PartyDialog({ party, onClose }: { party: Party | null; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: party?.name ?? "", abbreviation: party?.abbreviation ?? "", color: party?.color ?? "#1E7B3E", isActive: party ? !!party.is_active : true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api(party ? `/api/parties/${party.id}` : "/api/parties", { method: party ? "PATCH" : "POST", body: v });
      onClose();
      router.refresh();
    } catch (e) {
      if (e instanceof ClientError) setErrors({ ...e.fields, _: e.message });
    } finally { setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} size="sm" title={party ? `Edit ${party.abbreviation}` : "Add political party"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4">
        {errors._ && <p className="rounded-md bg-destructive-soft p-3 text-[13px] text-destructive">{errors._}</p>}
        <Field label="Full name" required error={errors.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Abbreviation" required error={errors.abbreviation}><Input value={v.abbreviation} onChange={(e) => setV({ ...v, abbreviation: e.target.value.toUpperCase() })} maxLength={20} /></Field>
          <Field label="Colour" error={errors.color}>
            <div className="flex items-center gap-2">
              <input type="color" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} className="h-9 w-12 cursor-pointer rounded border bg-card" />
              <Input value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} className="font-mono" />
            </div>
          </Field>
        </div>
        <Switch checked={v.isActive} onChange={(isActive) => setV({ ...v, isActive })} label="Active" />
      </div>
    </Dialog>
  );
}
