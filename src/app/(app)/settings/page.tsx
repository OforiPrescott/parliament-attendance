import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/misc";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "System settings" };

export default async function SettingsPage() {
  await requireUser("settings.manage");
  const [s, db] = await Promise.all([
    getSettings(),
    one<{ version: string; size_mb: number; attendance: number; audit: number }>(
      `SELECT 'PostgreSQL ' || current_setting('server_version') version,
              ROUND(pg_database_size(current_database()) / 1048576.0, 1) size_mb,
              (SELECT COUNT(*) FROM attendance) attendance,
              (SELECT COUNT(*) FROM audit_logs) audit`,
    ),
  ]);
  return (
    <>
      <PageHeader eyebrow="Administration" title="System settings" description="Institution details, attendance rules and security policy. Every change is recorded in the audit trail." />
      <SettingsForm initial={s} system={{
        db: db?.version ?? "unknown", sizeMb: db?.size_mb ?? 0, attendance: db?.attendance ?? 0, audit: db?.audit ?? 0,
        node: process.version, env: process.env.NODE_ENV ?? "development",
      }} />
    </>
  );
}
