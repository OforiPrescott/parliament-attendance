import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "destructive" | "info" | "gold" | "muted" | "primary";

const tones: Record<Tone, string> = {
  success: "bg-success-soft text-success ring-success/20",
  warning: "bg-warning-soft text-warning ring-warning/25",
  destructive: "bg-destructive-soft text-destructive ring-destructive/20",
  info: "bg-info-soft text-info ring-info/20",
  gold: "bg-gold-soft text-gold-foreground ring-gold/30",
  muted: "bg-muted text-muted-foreground ring-border",
  primary: "bg-primary-soft text-primary ring-primary/20",
};

export function Badge({ tone = "muted", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function PartyChip({ abbr, color }: { abbr: string | null; color: string | null }) {
  if (!abbr) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-1.5 py-0.5 text-[12px] font-semibold tracking-wide">
      <span className="size-2 rounded-full" style={{ background: color ?? "#888" }} />
      {abbr}
    </span>
  );
}
