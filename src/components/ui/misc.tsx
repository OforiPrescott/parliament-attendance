import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-5" />
      </div>
      <p className="font-serif text-[17px] font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-gold">{eyebrow}</div>}
        <h1 className="font-serif text-[26px] font-semibold leading-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** MP portrait (served by the authenticated photo route) with an initials fallback. */
export function MpAvatar({ id, name, photo, size = 36, className }: { id: number; name: string; photo?: number | boolean | null; size?: number; className?: string }) {
  const s = { width: size, height: size };
  if (photo)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/mps/${id}/photo`} alt="" style={s} className={cn("shrink-0 rounded-full object-cover ring-2 ring-card", className)} loading="lazy" />;
  return (
    <span style={{ ...s, fontSize: size * 0.36 }} className={cn("grid shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary ring-2 ring-card", className)}>
      {initials(name)}
    </span>
  );
}

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-4 border-t px-5 py-3 text-[13px] text-muted-foreground">
      <span className="num">
        {from.toLocaleString("en-GB")}–{to.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")}
      </span>
      <div className="flex items-center gap-1">
        <PageLink disabled={page <= 1} href={hrefFor(page - 1)} label="Previous page"><ChevronLeft className="size-4" /></PageLink>
        <span className="num px-2">Page {page} of {pages}</span>
        <PageLink disabled={page >= pages} href={hrefFor(page + 1)} label="Next page"><ChevronRight className="size-4" /></PageLink>
      </div>
    </div>
  );
}

function PageLink({ href, disabled, children, label }: { href: string; disabled: boolean; children: ReactNode; label: string }) {
  if (disabled) return <span className="grid size-8 place-items-center rounded-md opacity-40">{children}</span>;
  return (
    <Link href={href} aria-label={label} className="grid size-8 place-items-center rounded-md border bg-card hover:bg-muted">
      {children}
    </Link>
  );
}

export function RateBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const color = v >= 0.85 ? "bg-success" : v >= 0.7 ? "bg-warning" : "bg-destructive";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${v * 100}%` }} />
      </div>
      <span className="num w-12 text-right text-[12.5px] font-medium">{(v * 100).toFixed(1)}%</span>
    </div>
  );
}
