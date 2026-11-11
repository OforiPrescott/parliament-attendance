import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getSessionUser();
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (user) redirect(user.mustChangePassword || user.passwordExpired ? "/change-password" : safeNext);
  const s = await getSettings();

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Institutional panel */}
      <div className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, hsl(var(--gold)) 0, transparent 40%), radial-gradient(circle at 80% 70%, hsl(var(--gold)) 0, transparent 35%)",
        }} />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-gold/40 to-transparent" />
        <div className="relative flex flex-1 flex-col justify-between p-12">
          <div className="flex items-center gap-4">
            <Logo size={64} />
            <div>
              <div className="font-serif text-[22px] font-semibold leading-tight">{s.institution_name}</div>
              <div className="text-[13px] uppercase tracking-[0.18em] text-gold">MP Attendance System</div>
            </div>
          </div>
          <div className="max-w-md">
            <div className="mb-4 h-px w-16 bg-gold" />
            <h1 className="font-serif text-[40px] font-semibold leading-[1.1]">Members&apos; Attendance Register</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-sidebar-muted">
              The official record of attendance at plenary sittings, committee meetings and other parliamentary business — captured,
              reviewed and reported in one secure system.
            </p>
          </div>
          <p className="text-[12px] text-sidebar-muted">Authorised users only. All activity in this system is logged.</p>
        </div>
        <div className="kente-rule relative" />
      </div>

      {/* Form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo size={48} />
            <div className="font-serif text-[18px] font-semibold leading-tight">{s.institution_name}</div>
          </div>
          <h2 className="font-serif text-[28px] font-semibold">Sign in</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">{s.system_name}</p>
          <LoginForm next={safeNext} />
          <p className="mt-8 text-[12.5px] leading-relaxed text-muted-foreground">
            Forgotten your password or locked out? Contact the system administrator in the ICT Directorate.
          </p>
        </div>
      </div>
    </div>
  );
}
