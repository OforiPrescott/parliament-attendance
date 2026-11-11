import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Shell } from "@/components/layout/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const s = await getSettings();
  let approvals = 0;
  if (can(user.permissions, ["attendance.review", "corrections.review"])) {
    const r = await one<{ n: number }>(
      "SELECT (SELECT COUNT(*) FROM sittings WHERE register_status='SUBMITTED') + (SELECT COUNT(*) FROM attendance_corrections WHERE status='PENDING') n",
    );
    approvals = r?.n ?? 0;
  }
  return (
    <Shell
      user={{ fullName: user.fullName, username: user.username, roleName: user.roleName, permissions: user.permissions }}
      institution={s.institution_name}
      badges={{ approvals }}
      idleMinutes={s.session_idle_minutes}
    >
      {children}
    </Shell>
  );
}
