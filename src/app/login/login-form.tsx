"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { api, ClientError } from "@/lib/client";

export function LoginForm({ next }: { next: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ mustChangePassword: boolean }>("/api/auth/login", { body: { username: username.trim(), password } });
      window.location.href = r.mustChangePassword ? "/change-password" : next;
    } catch (err) {
      setError(err instanceof ClientError ? err.message : "Unable to sign in. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
      {error && (
        <div role="alert" className="rounded-md border border-destructive/25 bg-destructive-soft px-3.5 py-2.5 text-[13px] text-destructive">
          {error}
        </div>
      )}
      <Field label="Username" htmlFor="username">
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username}
            onChange={(e) => setUsername(e.target.value)} className="h-11 pl-9" required />
        </div>
      </Field>
      <Field label="Password" htmlFor="password">
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className="h-11 pl-9 pr-10" required />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!username || !password}>
        Sign in
      </Button>
    </form>
  );
}
