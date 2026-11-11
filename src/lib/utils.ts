import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const pct = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : `${(n * 100).toFixed(digits)}%`;

export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-GB");

export function fmtDate(d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!d) return "—";
  const iso = d.length === 10 ? `${d}T00:00:00Z` : d.replace(" ", "T") + (d.includes("Z") ? "" : "Z");
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}

export function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d.replace(" ", "T") + (d.includes("Z") ? "" : "Z"));
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" });
}

export const time5 = (t: string | null | undefined) => (t ? t.slice(0, 5) : "—");

export function initials(name: string) {
  return name
    .replace(/^(?:(?:Rt|Hon|Dr|Prof|Mrs|Ms|Mr)\.?\s+)+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

/** Colour band for an attendance rate (0–1). */
export function rateTone(r: number) {
  if (r >= 0.85) return "success" as const;
  if (r >= 0.7) return "warning" as const;
  return "destructive" as const;
}

export const STATUS_META = {
  PRESENT: { label: "Present", short: "P", tone: "success" },
  LATE: { label: "Late", short: "L", tone: "warning" },
  ABSENT: { label: "Absent", short: "A", tone: "destructive" },
  EXCUSED: { label: "Excused", short: "E", tone: "info" },
  OFFICIAL_DUTY: { label: "Official duty", short: "OD", tone: "gold" },
} as const;
export type AttendanceStatus = keyof typeof STATUS_META;

export const REGISTER_META = {
  NOT_STARTED: { label: "Not started", tone: "muted" },
  DRAFT: { label: "Draft", tone: "info" },
  SUBMITTED: { label: "Awaiting approval", tone: "warning" },
  RETURNED: { label: "Returned", tone: "destructive" },
  APPROVED: { label: "Approved", tone: "success" },
} as const;

export const MP_STATUS_META = {
  ACTIVE: { label: "Active", tone: "success" },
  SUSPENDED: { label: "Suspended", tone: "warning" },
  RESIGNED: { label: "Resigned", tone: "muted" },
  DECEASED: { label: "Deceased", tone: "muted" },
  VACATED: { label: "Seat vacated", tone: "destructive" },
  FORMER: { label: "Former member", tone: "muted" },
} as const;
