"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck, BarChart3, CalendarDays, ClipboardCheck, Flag, LayoutDashboard, MapPin, ScrollText, Settings, UserCog, Users, X,
} from "lucide-react";
import { can, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

type Item = { href: string; label: string; icon: typeof Users; perm: Permission | Permission[]; badgeKey?: "approvals" };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Overview", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.view" },
    { href: "/reports", label: "Reports & analytics", icon: BarChart3, perm: "reports.view" },
  ] },
  { title: "Attendance", items: [
    { href: "/attendance", label: "Attendance capture", icon: ClipboardCheck, perm: ["attendance.capture", "attendance.review"] },
    { href: "/approvals", label: "Review & approval", icon: BadgeCheck, perm: ["attendance.review", "corrections.review", "corrections.request"], badgeKey: "approvals" },
    { href: "/sittings", label: "Sittings & calendar", icon: CalendarDays, perm: "sittings.view" },
  ] },
  { title: "Registry", items: [
    { href: "/members", label: "Members of Parliament", icon: Users, perm: "mps.view" },
    { href: "/parties", label: "Political parties", icon: Flag, perm: "mps.view" },
    { href: "/constituencies", label: "Constituencies", icon: MapPin, perm: "mps.view" },
  ] },
  { title: "Administration", items: [
    { href: "/users", label: "Users & roles", icon: UserCog, perm: "users.manage" },
    { href: "/audit", label: "Audit trail", icon: ScrollText, perm: "audit.view" },
    { href: "/settings", label: "System settings", icon: Settings, perm: "settings.manage" },
  ] },
];

export function Sidebar({
  permissions, institution, badges, open, onClose,
}: { permissions: Permission[]; institution: string; badges: { approvals: number }; open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <div className={cn("fixed inset-0 z-40 bg-black/40 lg:hidden", open ? "block" : "hidden")} onClick={onClose} />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
          <Logo size={44} />
          <div className="min-w-0">
            <div className="truncate font-serif text-[16px] font-semibold leading-tight">{institution}</div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-gold">Attendance System</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded p-1 text-sidebar-muted hover:text-white lg:hidden" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <div className="mx-5 h-px bg-gradient-to-r from-gold/50 via-gold/20 to-transparent" />
        <nav className="scroll-thin flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Main">
          {GROUPS.map((g) => {
            const items = g.items.filter((i) => can(permissions, i.perm));
            if (!items.length) return null;
            return (
              <div key={g.title}>
                <div className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted/80">{g.title}</div>
                <ul className="space-y-0.5">
                  {items.map((i) => {
                    const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
                    const badge = i.badgeKey ? badges[i.badgeKey] : 0;
                    return (
                      <li key={i.href}>
                        <Link
                          href={i.href}
                          onClick={onClose}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors",
                            active ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white",
                          )}
                        >
                          {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-gold" />}
                          <i.icon className={cn("size-[18px]", active ? "text-gold" : "text-sidebar-muted group-hover:text-sidebar-foreground")} />
                          <span className="flex-1">{i.label}</span>
                          {badge > 0 && <span className="num rounded-full bg-gold px-1.5 py-px text-[11px] font-bold text-gold-foreground">{badge}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="kente-rule opacity-80" />
      </aside>
    </>
  );
}
