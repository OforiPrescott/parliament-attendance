"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { api, run } from "@/lib/client";
import { SittingDialog, type SittingValues } from "../sitting-form";

export function SittingHeaderActions({ sitting, hasRecords, meetings, committees }: {
  sitting: SittingValues & { id: number }; hasRecords: boolean;
  meetings: { id: number; name: string; session_name: string }[]; committees: { id: number; name: string; is_active: number }[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [edit, setEdit] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setEdit(true)}><Pencil />Edit</Button>
      {!hasRecords && (
        <Button variant="ghost" size="icon" aria-label="Delete sitting" onClick={async () => {
          if ((await confirm({ title: "Delete this sitting?", destructive: true, confirmLabel: "Delete", message: "The sitting has no attendance records and will be removed permanently. This is recorded in the audit trail." })) === false) return;
          if (await run(() => api(`/api/sittings/${sitting.id}`, { method: "DELETE" }), "Sitting deleted.")) router.push("/sittings");
        }}><Trash2 /></Button>
      )}
      {edit && <SittingDialog onClose={() => setEdit(false)} meetings={meetings} committees={committees} initial={sitting} locked={hasRecords} />}
    </>
  );
}
