"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, CalendarRange, FileSpreadsheet, FileText, Flag, Landmark, Loader2, MapPin, Printer, User, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { download } from "@/lib/client";
import { cn } from "@/lib/utils";

type F = { type: string; from: string; to: string; format?: string; partyId?: number | null; regionId?: number | null; constituencyId?: number | null; mpId?: number | null; sittingId?: number | null; sittingType?: string };
type Opt = { id: number; name: string };

const TYPES: { key: string; icon: typeof User; group: string }[] = [
  { key: "daily", icon: CalendarDays, group: "Period" },
  { key: "weekly", icon: CalendarDays, group: "Period" },
  { key: "monthly", icon: CalendarRange, group: "Period" },
  { key: "quarterly", icon: CalendarRange, group: "Period" },
  { key: "annual", icon: CalendarRange, group: "Period" },
  { key: "mp", icon: User, group: "Breakdown" },
  { key: "party", icon: Flag, group: "Breakdown" },
  { key: "constituency", icon: MapPin, group: "Breakdown" },
  { key: "region", icon: MapIcon, group: "Breakdown" },
  { key: "sitting", icon: Landmark, group: "Breakdown" },
];

const PRESETS = () => {
  const t = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const y = t.getUTCFullYear();
  const q = Math.floor(t.getUTCMonth() / 3);
  return [
    { label: "This month", from: iso(new Date(Date.UTC(y, t.getUTCMonth(), 1))), to: iso(t) },
    { label: "This quarter", from: iso(new Date(Date.UTC(y, q * 3, 1))), to: iso(t) },
    { label: "This year", from: `${y}-01-01`, to: iso(t) },
    { label: "Last year", from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { label: "All time", from: "", to: "" },
  ];
};

export function ReportControls({ filters, labels, canExport, ref_, mps, sittings }: {
  filters: F; labels: Record<string, string>; canExport: boolean;
  ref_: { parties: { id: number; abbreviation: string }[]; regions: { id: number; name: string }[]; constituencies: { id: number; name: string; region_id: number }[] };
  mps: Opt[]; sittings: Opt[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  const push = (patch: Partial<F>) => {
    const next = { ...filters, ...patch };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v !== undefined && v !== null && v !== "" && k !== "format") q.set(k, String(v));
    if (!next.from) q.set("from", "");
    setNavigating(true);
    router.push(`${pathname}?${q}`, { scroll: false });
    setTimeout(() => setNavigating(false), 600);
  };
  const qs = (format: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
    q.set("format", format);
    return `/api/reports?${q}`;
  };
  async function exp(format: "pdf" | "xlsx") {
    setBusy(format);
    try { await download(qs(format)); toast.success("Export ready."); } catch (e) { toast.error(e instanceof Error ? e.message : "Export failed."); }
    setBusy(null);
  }
  const consts = ref_.constituencies.filter((c) => !filters.regionId || c.region_id === Number(filters.regionId));

  return (
    <div className="mb-4 space-y-4">
      <div className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TYPES.map((t) => (
          <button key={t.key} onClick={() => push({ type: t.key, mpId: t.key === "mp" ? filters.mpId : null, sittingId: t.key === "sitting" ? filters.sittingId : null })}
            className={cn("flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2.5 text-[13px] font-medium shadow-sm transition-colors",
              filters.type === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}>
            <t.icon className={cn("size-4", filters.type === t.key ? "text-gold" : "text-muted-foreground")} />
            {labels[t.key].replace(" attendance", "").replace("Parliamentary ", "")}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <Field label="From"><Input type="date" value={filters.from} onChange={(e) => push({ from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={filters.to} onChange={(e) => push({ to: e.target.value })} /></Field>
          <Field label="Sitting type">
            <Select value={filters.sittingType ?? ""} onChange={(e) => push({ sittingType: e.target.value || undefined })}>
              <option value="">All types</option><option value="PLENARY">Plenary</option><option value="COMMITTEE">Committee</option><option value="OTHER">Other</option>
            </Select>
          </Field>
          <Field label="Party">
            <Select value={filters.partyId ?? ""} onChange={(e) => push({ partyId: Number(e.target.value) || null })}>
              <option value="">All parties</option>{ref_.parties.map((p) => <option key={p.id} value={p.id}>{p.abbreviation}</option>)}
            </Select>
          </Field>
          <Field label="Region">
            <Select value={filters.regionId ?? ""} onChange={(e) => push({ regionId: Number(e.target.value) || null, constituencyId: null })}>
              <option value="">All regions</option>{ref_.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label="Constituency">
            <Select value={filters.constituencyId ?? ""} onChange={(e) => push({ constituencyId: Number(e.target.value) || null })}>
              <option value="">All constituencies</option>{consts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          {filters.type === "mp" && (
            <Field label="Member" className="sm:col-span-2 lg:col-span-3" hint="Leave blank for a summary of every member">
              <Select value={filters.mpId ?? ""} onChange={(e) => push({ mpId: Number(e.target.value) || null })}>
                <option value="">All members (summary)</option>{mps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
          )}
          {filters.type === "sitting" && (
            <Field label="Sitting" className="sm:col-span-2 lg:col-span-3" hint="Leave blank to list every sitting">
              <Select value={filters.sittingId ?? ""} onChange={(e) => push({ sittingId: Number(e.target.value) || null })}>
                <option value="">All sittings (summary)</option>{sittings.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <span className="mr-1 text-[12.5px] text-muted-foreground">Quick range:</span>
          {PRESETS().map((p) => (
            <button key={p.label} onClick={() => push({ from: p.from, to: p.to })}
              className={cn("rounded-full border px-3 py-1 text-[12.5px]", filters.from === p.from && filters.to === p.to ? "border-gold bg-gold-soft" : "hover:bg-muted")}>
              {p.label}
            </button>
          ))}
          {navigating && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => window.print()}><Printer />Print</Button>
            {canExport && (
              <>
                <Button variant="secondary" size="sm" onClick={() => exp("xlsx")} loading={busy === "xlsx"}><FileSpreadsheet />Excel</Button>
                <Button size="sm" onClick={() => exp("pdf")} loading={busy === "pdf"}><FileText />PDF</Button>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
