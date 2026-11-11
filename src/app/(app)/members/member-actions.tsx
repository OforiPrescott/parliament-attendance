"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api, ClientError } from "@/lib/client";
import { MpFormDialog, type Ref } from "./member-form";

const TEMPLATE =
  "parliamentary_id,title,first_name,other_names,last_name,gender,party,constituency,region,email,phone,term_start\n" +
  "MP9-001,Hon.,Ama,,Mensah,F,NDC,Ablekuma North,Greater Accra,ama.mensah@parliament.gh,+233 24 000 0000,2025-01-07\n";

export function MemberActions({ ref_ }: { ref_: Ref }) {
  const [add, setAdd] = useState(false);
  const [imp, setImp] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setImp(true)}><FileUp />Import CSV</Button>
      <Button onClick={() => setAdd(true)}><UserPlus />Add member</Button>
      {add && <MpFormDialog open onClose={() => setAdd(false)} ref_={ref_} />}
      {imp && <ImportDialog onClose={() => setImp(false)} />}
    </>
  );
}

type Result = { total: number; valid: number; errors: { row: number; message: string }[]; created?: number; updated?: number; dryRun: boolean };

function ImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    try {
      const r = await api<Result>(`/api/mps/import${dryRun ? "?dryRun=1" : ""}`, { form });
      setResult(r);
      if (!dryRun && !r.errors.length) {
        toast.success(`Import complete: ${r.created} added, ${r.updated} updated.`);
        router.refresh();
        onClose();
      }
    } catch (e) {
      toast.error(e instanceof ClientError ? e.message : "Import failed.");
    } finally { setBusy(false); }
  }

  const canImport = result && result.dryRun && !result.errors.length;
  return (
    <Dialog open onClose={onClose} size="lg" title="Import members from CSV"
      description="Validate first, then import. Existing members (matched by parliamentary ID) have their personal details updated; party and seat changes must be recorded on the member's page."
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="secondary" onClick={() => send(true)} disabled={!file} loading={busy && !canImport}>Validate</Button>
        <Button onClick={() => send(false)} disabled={!canImport} loading={busy && !!canImport}>Import {result?.valid ?? ""} rows</Button>
      </>}>
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed bg-muted/40 px-6 py-8 text-center hover:border-primary/50">
          <FileUp className="size-6 text-muted-foreground" />
          <span className="text-[13.5px] font-medium">{file ? file.name : "Choose a CSV file"}</span>
          <span className="text-[12px] text-muted-foreground">Up to 1,000 rows, 2 MB</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
        </label>
        <a className="inline-block text-[13px] text-primary hover:underline" download="mp-import-template.csv"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}>Download template</a>
        {result && (
          <div className={result.errors.length ? "rounded-md border border-destructive/25 bg-destructive-soft p-4" : "rounded-md border border-success/25 bg-success-soft p-4"}>
            <p className="text-[13.5px] font-medium">
              {result.errors.length ? `${result.errors.length} row(s) need fixing before import` : `All ${result.total} rows are valid.`}
            </p>
            {result.errors.length > 0 && (
              <ul className="scroll-thin mt-2 max-h-48 space-y-1 overflow-y-auto text-[12.5px]">
                {result.errors.map((e) => <li key={e.row}><b>Row {e.row}:</b> {e.message}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
