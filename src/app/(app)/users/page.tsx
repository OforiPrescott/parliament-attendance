import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, type Permission, type RoleCode } from "@/lib/permissions";
import { listUsers } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { LinkTabs } from "@/components/ui/tabs";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { UserManager } from "./user-manager";

export const metadata: Metadata = { title: "Users & roles" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireUser("users.manage");
  const tab = (await searchParams).tab === "roles" ? "roles" : "users";
  const users = await listUsers();
  const roles = Object.keys(ROLE_LABELS) as RoleCode[];
  return (
    <>
      <PageHeader eyebrow="Administration" title="Users & roles" description="Accounts that can sign in, and what each role is permitted to do." />
      <LinkTabs active={tab} tabs={[
        { key: "users", label: "User accounts", href: "/users", count: users.length },
        { key: "roles", label: "Role permissions", href: "/users?tab=roles" },
      ]} />
      {tab === "users" ? (
        <UserManager users={users} meId={me.id} roles={roles.map((r) => ({ code: r, label: ROLE_LABELS[r] }))} />
      ) : (
        <Card>
          <Table>
            <THead>
              <tr><TH>Permission</TH>{roles.map((r) => <TH key={r} className="text-center">{ROLE_LABELS[r]}</TH>)}</tr>
            </THead>
            <TBody>
              {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
                <TR key={p}>
                  <TD><div className="font-medium">{PERMISSIONS[p]}</div><div className="font-mono text-[11.5px] text-muted-foreground">{p}</div></TD>
                  {roles.map((r) => (
                    <TD key={r} className="text-center">
                      {ROLE_PERMISSIONS[r].includes(p) ? <Check className="mx-auto size-4 text-success" /> : <Minus className="mx-auto size-4 text-muted-foreground/40" />}
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
          <p className="border-t px-5 py-3 text-[12.5px] text-muted-foreground">
            Permissions are defined in the application code (<code>src/lib/permissions.ts</code>) so that every change is reviewed and versioned.
            Segregation of duties is also enforced: nobody can approve a register or correction they submitted themselves.
          </p>
        </Card>
      )}
    </>
  );
}
