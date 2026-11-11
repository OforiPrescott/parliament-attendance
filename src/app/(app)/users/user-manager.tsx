"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Lock, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { api, ClientError, run } from "@/lib/client";
import { fmtDateTime, initials } from "@/lib/utils";

type U = { id: number; username: string; email: string; full_name: string; role_code: string; role_name: string; is_active: number; must_change_password: number; locked: number; last_login_at: string | null; active_sessions: number };

export function UserManager({ users, meId, roles }: { users: U[]; meId: number; roles: { code: string; label: string }[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<U | "new" | null>(null);
  const [secret, setSecret] = useState<{ username: string; password: string } | null>(null);

  return (
    <Card>
      <div className="flex justify-end border-b p-4"><Button onClick={() => setEditing("new")}><UserPlus />Add user</Button></div>
      <Table>
        <THead><tr><TH>User</TH><TH>Role</TH><TH>Status</TH><TH>Last sign-in</TH><TH /></tr></THead>
        <TBody>
          {users.map((u) => (
            <TR key={u.id} className={u.is_active ? "" : "opacity-60"}>
              <TD>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary">{initials(u.full_name)}</span>
                  <div>
                    <div className="font-medium">{u.full_name}{u.id === meId && <span className="ml-2 text-[12px] text-muted-foreground">(you)</span>}</div>
                    <div className="text-[12px] text-muted-foreground">{u.username} · {u.email}</div>
                  </div>
                </div>
              </TD>
              <TD><Badge tone={u.role_code === "ADMIN" ? "gold" : "primary"}>{u.role_name}</Badge></TD>
              <TD>
                <div className="flex flex-wrap gap-1.5">
                  {u.is_active ? <Badge tone="success" dot>Active</Badge> : <Badge dot>Disabled</Badge>}
                  {!!u.locked && <Badge tone="destructive"><Lock className="size-3" />Locked</Badge>}
                  {!!u.must_change_password && <Badge tone="warning">Temp. password</Badge>}
                </div>
              </TD>
              <TD className="text-[13px] text-muted-foreground">{u.last_login_at ? fmtDateTime(u.last_login_at) : "Never"}{u.active_sessions > 0 && <div className="text-[12px] text-success">{u.active_sessions} active session(s)</div>}</TD>
              <TD className="whitespace-nowrap text-right">
                <Button variant="ghost" size="sm" onClick={async () => {
                  if ((await confirm({ title: `Reset password for ${u.username}?`, confirmLabel: "Reset", message: "A one-time password will be generated and the user will be signed out of every device. They must choose a new password at next sign-in." })) === false) return;
                  const r = await run(() => api<{ temporaryPassword: string }>(`/api/users/${u.id}`, { method: "POST" }));
                  if (r) { setSecret({ username: u.username, password: r.temporaryPassword }); router.refresh(); }
                }}><KeyRound />Reset</Button>
                <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(u)}><Pencil /></Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {editing && <UserDialog user={editing === "new" ? null : editing} roles={roles} isMe={editing !== "new" && editing.id === meId}
        onClose={() => setEditing(null)} onCreated={(username, password) => setSecret({ username, password })} />}
      {secret && (
        <Dialog open onClose={() => setSecret(null)} size="sm" title="One-time password"
          description="Give this to the user through a secure channel. It is shown only once and is not stored in readable form."
          footer={<Button onClick={() => setSecret(null)}>Done</Button>}>
          <div className="text-[13px] text-muted-foreground">Username</div>
          <div className="mb-3 font-mono text-[15px]">{secret.username}</div>
          <div className="text-[13px] text-muted-foreground">Temporary password</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-[15px]">{secret.password}</code>
            <Button variant="secondary" size="icon" aria-label="Copy" onClick={() => { navigator.clipboard.writeText(secret.password); toast.success("Copied."); }}><Copy /></Button>
          </div>
        </Dialog>
      )}
    </Card>
  );
}

function UserDialog({ user, roles, isMe, onClose, onCreated }: {
  user: U | null; roles: { code: string; label: string }[]; isMe: boolean; onClose: () => void; onCreated: (u: string, p: string) => void;
}) {
  const router = useRouter();
  const [v, setV] = useState({ username: user?.username ?? "", email: user?.email ?? "", fullName: user?.full_name ?? "", role: user?.role_code ?? "OFFICER", isActive: user ? !!user.is_active : true, unlock: false });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      if (user) {
        await api(`/api/users/${user.id}`, { method: "PATCH", body: { email: v.email, fullName: v.fullName, role: v.role, isActive: v.isActive, unlock: v.unlock } });
        toast.success("User updated.");
      } else {
        const r = await api<{ temporaryPassword: string }>("/api/users", { body: { username: v.username, email: v.email, fullName: v.fullName, role: v.role } });
        onCreated(v.username, r.temporaryPassword);
      }
      onClose();
      router.refresh();
    } catch (e) { if (e instanceof ClientError) { setErr(e.fields); toast.error(e.message); } } finally { setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title={user ? `Edit ${user.username}` : "Add user"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>{user ? "Save" : "Create user"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Username" required error={err.username} hint={user ? "Usernames cannot be changed" : "Lowercase, e.g. k.mensah"}>
          <Input value={v.username} disabled={!!user} onChange={(e) => setV({ ...v, username: e.target.value.toLowerCase() })} />
        </Field>
        <Field label="Full name" required error={err.fullName}><Input value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} /></Field>
        <Field label="Official email" required error={err.email}><Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field label="Role" required>
          <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} disabled={isMe}>
            {roles.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </Select>
        </Field>
        {user && (
          <div className="flex flex-col gap-3 sm:col-span-2">
            {!isMe && <Switch checked={v.isActive} onChange={(isActive) => setV({ ...v, isActive })} label="Account active (disabling signs the user out immediately)" />}
            {!!user.locked && <Switch checked={v.unlock} onChange={(unlock) => setV({ ...v, unlock })} label="Unlock account" />}
          </div>
        )}
      </div>
    </Dialog>
  );
}
