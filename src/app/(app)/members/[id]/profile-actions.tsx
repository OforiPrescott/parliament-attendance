"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, MoreHorizontal, Pencil, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { api, run } from "@/lib/client";
import { MembershipDialog, MpFormDialog, type MpValues, type Ref } from "../member-form";

export function ProfileActions({ mp, ref_, hasPhoto }: { mp: MpValues & { id: number; currentStatus: string }; ref_: Ref; hasPhoto: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [edit, setEdit] = useState(false);
  const [move, setMove] = useState(false);
  const [menu, setMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function upload(f: File) {
    if (f.size > 2 * 1024 * 1024) return toast.error("Photograph must be 2 MB or smaller.");
    setUploading(true);
    const form = new FormData();
    form.set("photo", f);
    if (await run(() => api(`/api/mps/${mp.id}/photo`, { form }), "Photograph updated.")) router.refresh();
    setUploading(false);
  }

  return (
    <>
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <Button variant="secondary" onClick={() => file.current?.click()} loading={uploading}><Camera />Photo</Button>
      <Button onClick={() => setEdit(true)}><Pencil />Edit</Button>
      <div className="relative">
        <Button variant="secondary" size="icon" onClick={() => setMenu((m) => !m)} aria-label="More actions"><MoreHorizontal /></Button>
        {menu && (
          <div className="absolute right-0 z-20 mt-2 w-60 rounded-lg border bg-card py-1 shadow-elevated" onMouseLeave={() => setMenu(false)}>
            <button className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13.5px] hover:bg-muted" onClick={() => { setMenu(false); setMove(true); }}>
              <Repeat className="size-4 text-muted-foreground" /> Record membership change
            </button>
            {hasPhoto && (
              <button className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13.5px] hover:bg-muted" onClick={async () => {
                setMenu(false);
                if (await run(() => api(`/api/mps/${mp.id}/photo`, { method: "DELETE" }), "Photograph removed.")) router.refresh();
              }}>
                <Camera className="size-4 text-muted-foreground" /> Remove photograph
              </button>
            )}
            <button className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13.5px] text-destructive hover:bg-destructive-soft" onClick={async () => {
              setMenu(false);
              const ok = await confirm({
                title: "Delete this member?", destructive: true, confirmLabel: "Delete",
                message: "Only members with no attendance history can be deleted. Members who have left office should have their status changed instead.",
              });
              if (ok === false) return;
              if (await run(() => api(`/api/mps/${mp.id}`, { method: "DELETE" }), "Member deleted.")) router.push("/members");
            }}>
              <Trash2 className="size-4" /> Delete member
            </button>
          </div>
        )}
      </div>
      {edit && <MpFormDialog open onClose={() => setEdit(false)} ref_={ref_} initial={mp} />}
      {move && <MembershipDialog open onClose={() => setMove(false)} ref_={ref_} mpId={mp.id} />}
    </>
  );
}
