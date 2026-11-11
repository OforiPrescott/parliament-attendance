"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, KeyRound, LogOut, Menu } from "lucide-react";
import { toast } from "sonner";
import type { Permission } from "@/lib/permissions";
import { initials } from "@/lib/utils";
import { ConfirmProvider } from "@/components/ui/confirm";
import { Sidebar } from "./sidebar";

type User = { fullName: string; username: string; roleName: string; permissions: Permission[] };

export function Shell({ user, institution, badges, idleMinutes, children }: {
  user: User; institution: string; badges: { approvals: number }; idleMinutes: number; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Client-side idle warning mirrors the server's idle timeout.
  useEffect(() => {
    let warn: ReturnType<typeof setTimeout>, out: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(warn); clearTimeout(out);
      warn = setTimeout(() => toast.warning("You will be signed out in 1 minute due to inactivity."), Math.max(0, idleMinutes - 1) * 60_000);
      out = setTimeout(() => { window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname); }, idleMinutes * 60_000 + 2000);
    };
    const evs = ["mousedown", "keydown", "touchstart", "scroll"];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(warn); clearTimeout(out); evs.forEach((e) => window.removeEventListener(e, reset)); };
  }, [idleMinutes]);

  return (
    <ConfirmProvider>
      <Sidebar permissions={user.permissions} institution={institution} badges={badges} open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <button className="rounded-md p-2 hover:bg-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="hidden text-[13px] text-muted-foreground sm:block">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Accra" })}
          </div>
          <div className="ml-auto">
            <UserMenu user={user} onSignOut={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/login");
              router.refresh();
            }} />
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 animate-fade-in">{children}</main>
      </div>
    </ConfirmProvider>
  );
}

function UserMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 hover:bg-muted" aria-haspopup="menu" aria-expanded={open}>
        <span className="grid size-8 place-items-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">{initials(user.fullName)}</span>
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] font-semibold leading-tight">{user.fullName}</span>
          <span className="block text-[11.5px] leading-tight text-muted-foreground">{user.roleName}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border bg-card py-1 shadow-elevated animate-scale-in">
          <div className="border-b px-3.5 py-2.5 text-[12px] text-muted-foreground">Signed in as <b className="text-foreground">{user.username}</b></div>
          <Link href="/change-password" role="menuitem" className="flex items-center gap-2 px-3.5 py-2 text-[13.5px] hover:bg-muted" onClick={() => setOpen(false)}>
            <KeyRound className="size-4 text-muted-foreground" /> Change password
          </Link>
          <button role="menuitem" onClick={onSignOut} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13.5px] text-destructive hover:bg-destructive-soft">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
