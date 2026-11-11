"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/** URL-driven tabs, so each tab is linkable and survives a refresh. */
export function LinkTabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <div className="scroll-thin mb-5 flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "relative -mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors",
            active === t.key ? "border-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn("ml-2 rounded-full px-1.5 py-0.5 text-[11px] num", active === t.key ? "bg-gold-soft text-gold-foreground" : "bg-muted")}>{t.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
