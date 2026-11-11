"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { api, ClientError } from "@/lib/client";
import { passwordProblems } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

export function ChangePasswordForm({ minLength, username, forced }: { minLength: number; username: string; forced: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = [
    { label: `${minLength}+ characters`, ok: next.length >= minLength },
    { label: "Upper and lowercase letters", ok: /[a-z]/.test(next) && /[A-Z]/.test(next) },
    { label: "A number", ok: /\d/.test(next) },
    { label: "A symbol", ok: /[^A-Za-z0-9]/.test(next) },
    { label: "Passwords match", ok: next.length > 0 && next === confirm },
  ];
  const valid = passwordProblems(next, minLength, username).length === 0 && next === confirm && current.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/password", { body: { currentPassword: current, newPassword: next } });
      toast.success("Password changed.");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof ClientError ? err.message : "Could not change password.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      {error && <div role="alert" className="rounded-md bg-destructive-soft px-3.5 py-2.5 text-[13px] text-destructive">{error}</div>}
      <Field label={forced ? "Temporary / current password" : "Current password"} htmlFor="cur">
        <Input id="cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="New password" htmlFor="new">
        <Input id="new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="Confirm new password" htmlFor="conf">
        <Input id="conf" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-muted/60 p-3 text-[12.5px]">
        {rules.map((r) => (
          <li key={r.label} className={cn("flex items-center gap-1.5", r.ok ? "text-success" : "text-muted-foreground")}>
            {r.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />} {r.label}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" loading={busy} disabled={!valid} className="flex-1">Change password</Button>
        {!forced && <Link href="/dashboard" className="text-[13px] text-muted-foreground hover:underline">Cancel</Link>}
      </div>
    </form>
  );
}
