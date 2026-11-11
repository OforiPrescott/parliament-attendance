"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RateBar } from "@/components/ui/misc";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import type { ReportData } from "@/lib/reports";
import { cn, fmtDate } from "@/lib/utils";

export function ReportTable({ report }: { report: ReportData }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [limit, setLimit] = useState(100);
  const sorted = useMemo(() => {
    if (!sort) return report.rows;
    return [...report.rows].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (typeof x === "number" && typeof y === "number") return (x - y) * sort.dir;
      return String(x ?? "").localeCompare(String(y ?? "")) * sort.dir;
    });
  }, [report.rows, sort]);

  return (
    <Card>
      <div className="flex flex-col gap-4 border-b px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-serif text-[20px] font-semibold">{report.title}</h2>
          <p className="text-[13px] text-muted-foreground">{report.subtitle} · approved registers only</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {report.summary.map((s) => (
            <div key={s.label}>
              <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{s.label}</div>
              <div className="num font-serif text-[20px] font-semibold">{s.value}</div>
            </div>
          ))}
        </div>
      </div>
      <Table>
        <THead>
          <tr>
            {report.columns.map((c) => (
              <TH key={c.key} className={cn(c.align === "right" && "text-right", "cursor-pointer select-none hover:text-foreground")}
                onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: c.kind === "percent" || c.kind === "number" ? -1 : 1 }))}
                aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                <span className="inline-flex items-center gap-1">{c.label}{sort?.key === c.key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}</span>
              </TH>
            ))}
          </tr>
        </THead>
        <TBody>
          {sorted.slice(0, limit).map((r, i) => (
            <TR key={i}>
              {report.columns.map((c) => {
                const v = r[c.key];
                return (
                  <TD key={c.key} className={cn(c.align === "right" && "num text-right", c.kind === "percent" && "w-40")}>
                    {c.kind === "percent" && typeof v === "number" ? <RateBar value={v} />
                      : c.kind === "number" && typeof v === "number" ? v.toLocaleString("en-GB")
                      : c.kind === "date" ? fmtDate(String(v ?? ""))
                      : String(v ?? "")}
                  </TD>
                );
              })}
            </TR>
          ))}
        </TBody>
      </Table>
      <div className="flex items-center justify-between border-t px-5 py-3 text-[12.5px] text-muted-foreground">
        <span>{Math.min(limit, sorted.length).toLocaleString("en-GB")} of {sorted.length.toLocaleString("en-GB")} rows shown{sorted.length > limit ? " — exports include every row" : ""}</span>
        {sorted.length > limit && <button className="font-medium text-primary hover:underline" onClick={() => setLimit((l) => l + 200)}>Show more</button>}
      </div>
    </Card>
  );
}
