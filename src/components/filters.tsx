"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/** Hook that writes filter values into the URL query string (resetting page). */
export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string | null | undefined>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v ? q.set(k, v) : q.delete(k));
    if (!("page" in patch)) q.delete("page");
    start(() => router.replace(`${pathname}${q.toString() ? `?${q}` : ""}`, { scroll: false }));
  };
  return { sp, set, pending };
}

export function SearchBox({ param = "q", placeholder = "Search…", className }: { param?: string; placeholder?: string; className?: string }) {
  const { sp, set, pending } = useQueryState();
  const [v, setV] = useState(sp.get(param) ?? "");
  useEffect(() => {
    const t = setTimeout(() => { if ((sp.get(param) ?? "") !== v) set({ [param]: v.trim() || null }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return (
    <div className={cn("relative min-w-[220px] flex-1", className)}>
      {pending ? <Loader2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        : <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />}
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="pl-9 pr-8" aria-label={placeholder} />
      {v && (
        <button onClick={() => setV("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Clear search">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function FilterSelect({ param, label, options, className }: { param: string; label: string; options: { value: string | number; label: string }[]; className?: string }) {
  const { sp, set } = useQueryState();
  return (
    <div className={cn("min-w-[150px]", className)}>
      <Select value={sp.get(param) ?? ""} onChange={(e) => set({ [param]: e.target.value || null })} aria-label={label}>
        <option value="">{label}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </div>
  );
}

export function DateFilter({ param, label }: { param: string; label: string }) {
  const { sp, set } = useQueryState();
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
      {label}
      <Input type="date" value={sp.get(param) ?? ""} onChange={(e) => set({ [param]: e.target.value || null })} className="w-[150px]" />
    </label>
  );
}
