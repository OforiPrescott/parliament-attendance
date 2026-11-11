"use client";

import { useState } from "react";
import { ChevronRight, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { download } from "@/lib/client";
import { cn, fmtDateTime } from "@/lib/utils";

type Item = { id: number; username: string | null; action: string; entity_type: string; entity_id: string | null; summary: string; before_data: unknown; after_data: unknown; ip_address: string | null; user_agent: string | null; created_at: string };

function tone(action: string): Tone {
  if (/FAILED|LOCKED|BLOCKED|DELETE|REJECT|RETURN|REOPEN/.test(action)) return "destructive";
  if (/APPROVE|LOGIN$|CREATE/.test(action)) return "success";
  if (/UPDATE|CHANGE|SAVE|RESET|CORRECTION/.test(action)) return "warning";
  if (/EXPORT/.test(action)) return "info";
  return "muted";
}

const parse = (v: unknown) => (typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return v; } })() : v);

export function AuditRows({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ul className="divide-y">
      {items.map((i) => {
        const before = parse(i.before_data), after = parse(i.after_data);
        const hasDetail = before || after || i.user_agent;
        return (
          <li key={i.id}>
            <button className={cn("flex w-full items-start gap-4 px-5 py-3 text-left hover:bg-muted/40", !hasDetail && "cursor-default")}
              onClick={() => hasDetail && setOpen(open === i.id ? null : i.id)} aria-expanded={open === i.id}>
              <ChevronRight className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open === i.id && "rotate-90", !hasDetail && "opacity-0")} />
              <div className="w-40 shrink-0 text-[12.5px] text-muted-foreground"><div className="num">{fmtDateTime(i.created_at)}</div><div>{i.ip_address ?? ""}</div></div>
              <div className="w-28 shrink-0 truncate text-[13px] font-medium">{i.username ?? "system"}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={tone(i.action)}>{i.action.replace(/_/g, " ").toLowerCase()}</Badge>
                  <span className="font-mono text-[11.5px] text-muted-foreground">{i.entity_type}{i.entity_id ? ` #${i.entity_id}` : ""}</span>
                </div>
                <div className="mt-1 text-[13.5px]">{i.summary}</div>
              </div>
            </button>
            {open === i.id && (
              <div className="grid gap-3 bg-muted/30 px-5 pb-4 pl-[3.25rem] md:grid-cols-2">
                {before != null && <Json label="Before" value={before} />}
                {after != null && <Json label="After" value={after} />}
                {i.user_agent && <div className="text-[12px] text-muted-foreground md:col-span-2">Client: {i.user_agent}</div>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <pre className="scroll-thin max-h-64 overflow-auto rounded-md border bg-card p-3 text-[12px] leading-relaxed">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export function AuditExport({ params }: { params: Record<string, string> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="secondary" loading={busy} onClick={async () => {
      setBusy(true);
      try { await download(`/api/audit?${new URLSearchParams({ ...params, format: "xlsx" })}`); } catch (e) { toast.error(e instanceof Error ? e.message : "Export failed."); }
      setBusy(false);
    }}><FileSpreadsheet />Export to Excel</Button>
  );
}
