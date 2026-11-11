/**
 * Role → permission matrix. This file is the single source of truth and is
 * shown read-only on the Users › Roles screen. Change it here, then redeploy.
 */
export const PERMISSIONS = {
  "dashboard.view": "View the dashboard",
  "mps.view": "View Members of Parliament",
  "mps.manage": "Create and edit MPs, membership history and photographs",
  "reference.manage": "Manage parties, regions and constituencies",
  "sittings.view": "View the parliamentary calendar and sittings",
  "sittings.manage": "Create and manage sittings, meetings, sessions and committees",
  "attendance.capture": "Capture and submit attendance registers",
  "attendance.review": "Approve or return submitted registers",
  "corrections.request": "Request corrections to approved attendance",
  "corrections.review": "Approve or reject correction requests",
  "reports.view": "View reports and analytics",
  "reports.export": "Export reports to PDF and Excel",
  "users.manage": "Manage user accounts and roles",
  "audit.view": "View the audit trail and activity logs",
  "settings.manage": "Change system settings",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export type RoleCode = "ADMIN" | "OFFICER" | "APPROVER" | "MANAGEMENT" | "VIEWER";

const ALL = Object.keys(PERMISSIONS) as Permission[];

export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  ADMIN: ALL,
  OFFICER: ["dashboard.view", "mps.view", "sittings.view", "attendance.capture", "corrections.request", "reports.view"],
  APPROVER: [
    "dashboard.view", "mps.view", "sittings.view", "sittings.manage",
    "attendance.review", "corrections.review", "reports.view", "reports.export",
  ],
  MANAGEMENT: ["dashboard.view", "mps.view", "sittings.view", "reports.view", "reports.export", "audit.view"],
  VIEWER: ["dashboard.view", "mps.view", "sittings.view", "reports.view", "reports.export"],
};

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: "System Administrator",
  OFFICER: "Attendance Officer",
  APPROVER: "Reviewer / Approver",
  MANAGEMENT: "Management",
  VIEWER: "Report Viewer",
};

export function permissionsFor(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as RoleCode] ?? [];
}

export function can(perms: readonly Permission[], needed: Permission | Permission[]): boolean {
  const list = Array.isArray(needed) ? needed : [needed];
  return list.some((p) => perms.includes(p));
}
