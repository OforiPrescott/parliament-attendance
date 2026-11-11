import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Logo } from "@/components/layout/logo";
import { ChangePasswordForm } from "./form";

export const metadata: Metadata = { title: "Change password" };
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const s = await getSettings();
  const forced = user.mustChangePassword || user.passwordExpired;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={44} />
          <div className="font-serif text-[18px] font-semibold">{s.institution_name}</div>
        </div>
        <div className="rounded-xl border bg-card p-7 shadow-card">
          <h1 className="font-serif text-[24px] font-semibold">Change your password</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            {user.mustChangePassword
              ? "You are using a temporary password. Choose a new one to continue."
              : user.passwordExpired
                ? `Your password is more than ${s.password_expiry_days} days old. Choose a new one to continue.`
                : "Other devices signed in to your account will be signed out."}
          </p>
          <ChangePasswordForm minLength={s.password_min_length} username={user.username} forced={forced} />
        </div>
      </div>
    </div>
  );
}
