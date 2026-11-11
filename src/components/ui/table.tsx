import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...p }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="scroll-thin w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-[13.5px]", className)} {...p} />
    </div>
  );
}
export const THead = (p: HTMLAttributes<HTMLTableSectionElement>) => <thead className="bg-muted/50" {...p} />;
export const TBody = (p: HTMLAttributes<HTMLTableSectionElement>) => <tbody className="divide-y" {...p} />;
export function TR({ className, ...p }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-muted/40", className)} {...p} />;
}
export function TH({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("whitespace-nowrap border-b px-4 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground", className)} {...p} />;
}
export function TD({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...p} />;
}
