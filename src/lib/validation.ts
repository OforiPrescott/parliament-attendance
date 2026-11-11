import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);
const required = (max: number, label = "This field") => z.string().trim().min(1, `${label} is required`).max(max);
const optional = (max: number) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().trim().max(max).nullable());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");
const optDate = z.preprocess((v) => (v === "" || v === undefined ? null : v), date.nullable());
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use the format HH:MM");
const optTime = z.preprocess((v) => (v === "" || v === undefined ? null : v), time.nullable());
const id = z.coerce.number().int().positive();
const optId = z.preprocess((v) => (v === "" || v === undefined || v === null ? null : v), id.nullable());

export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED", "OFFICIAL_DUTY"] as const;
export const MP_STATUSES = ["ACTIVE", "SUSPENDED", "RESIGNED", "DECEASED", "VACATED", "FORMER"] as const;
export const SITTING_TYPES = ["PLENARY", "COMMITTEE", "OTHER"] as const;
export const SITTING_STATUSES = ["SCHEDULED", "HELD", "ADJOURNED", "CANCELLED"] as const;

export const loginSchema = z.object({ username: required(50, "Username"), password: z.string().min(1, "Password is required").max(128) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(1).max(128) });

export const mpCreateSchema = z.object({
  parliamentaryId: required(30, "Parliamentary ID").regex(/^[A-Za-z0-9\-\/]+$/, "Letters, numbers, - and / only"),
  title: optional(30),
  firstName: required(80, "First name"),
  otherNames: optional(120),
  lastName: required(80, "Last name"),
  gender: z.enum(["M", "F"]),
  email: z.preprocess((v) => (v === "" ? null : v), z.string().trim().email("Enter a valid email").max(150).nullable().optional()),
  phone: optional(30),
  status: z.enum(MP_STATUSES).default("ACTIVE"),
  partyId: id,
  constituencyId: id,
  parliamentId: id,
  termStart: date,
});
export const mpUpdateSchema = z.object({
  parliamentaryId: required(30, "Parliamentary ID").regex(/^[A-Za-z0-9\-\/]+$/).optional(),
  title: optional(30).optional(),
  firstName: required(80).optional(),
  otherNames: optional(120).optional(),
  lastName: required(80).optional(),
  gender: z.enum(["M", "F"]).optional(),
  email: z.preprocess((v) => (v === "" ? null : v), z.string().trim().email().max(150).nullable()).optional(),
  phone: optional(30).optional(),
  status: z.enum(MP_STATUSES).optional(),
  statusDate: optDate.optional(),
  statusReason: optional(120).optional(),
});
export const membershipChangeSchema = z.object({
  partyId: id,
  constituencyId: id,
  parliamentId: id,
  effectiveDate: date,
  reason: required(120, "Reason"),
});

export const partySchema = z.object({
  name: required(150, "Name"),
  abbreviation: required(20, "Abbreviation").transform((s) => s.toUpperCase()),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a colour"),
  isActive: z.boolean().default(true),
});
export const regionSchema = z.object({ name: required(80, "Name"), code: optional(10) });
export const constituencySchema = z.object({
  name: required(150, "Name"),
  regionId: id,
  code: optional(20),
  isActive: z.boolean().default(true),
});

export const parliamentSchema = z.object({
  number: z.coerce.number().int().min(1).max(99),
  name: required(120, "Name"),
  startDate: date,
  endDate: optDate,
  isCurrent: z.boolean().default(false),
});
export const sessionSchema = z.object({
  parliamentId: id,
  number: z.coerce.number().int().min(1).max(20),
  name: required(120, "Name"),
  startDate: date,
  endDate: optDate,
});
export const meetingSchema = z.object({
  sessionId: id,
  number: z.coerce.number().int().min(1).max(10),
  name: required(120, "Name"),
  startDate: date,
  endDate: optDate,
});
export const committeeSchema = z.object({
  name: required(150, "Name"),
  type: z.enum(["STANDING", "SELECT", "AD_HOC"]),
  isActive: z.boolean().default(true),
});
export const committeeMembersSchema = z.object({
  members: z.array(z.object({ mpId: id, role: z.enum(["CHAIR", "VICE_CHAIR", "RANKING", "MEMBER"]) })).max(100),
  effectiveDate: date,
});

export const sittingSchema = z
  .object({
    meetingId: optId,
    sittingType: z.enum(SITTING_TYPES),
    committeeId: optId,
    title: required(200, "Title"),
    sittingDate: date,
    startTime: time,
    endTime: optTime,
    venue: optional(150),
    status: z.enum(SITTING_STATUSES).default("SCHEDULED"),
  })
  .refine((s) => s.sittingType !== "COMMITTEE" || s.committeeId, { message: "Select the committee", path: ["committeeId"] })
  .refine((s) => !s.endTime || s.endTime > s.startTime, { message: "End time must be after start time", path: ["endTime"] });

export const sittingBulkSchema = z.object({
  meetingId: id,
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Choose at least one weekday"),
  startTime: time,
  venue: optional(150),
});

export const registerSaveSchema = z.object({
  rows: z
    .array(
      z.object({
        mpId: id,
        status: z.enum(ATTENDANCE_STATUSES),
        arrivalTime: optTime,
        remarks: optional(255),
      }),
    )
    .min(1)
    .max(1000),
});
export const registerActionSchema = z.object({
  action: z.enum(["submit", "approve", "return", "reopen"]),
  comment: optional(500),
});

export const correctionSchema = z.object({
  attendanceId: id,
  newStatus: z.enum(ATTENDANCE_STATUSES),
  newRemarks: optional(255),
  reason: required(500, "Reason").min(10, "Explain the reason in at least 10 characters"),
});
export const reviewSchema = z.object({ action: z.enum(["approve", "reject"]), comment: optional(500) });

export const userCreateSchema = z.object({
  username: required(50, "Username").regex(/^[a-z0-9._-]{3,50}$/, "3–50 lowercase letters, numbers, . _ -"),
  email: z.string().trim().email("Enter a valid email").max(150),
  fullName: required(150, "Full name"),
  role: z.enum(["ADMIN", "OFFICER", "APPROVER", "MANAGEMENT", "VIEWER"]),
});
export const userUpdateSchema = z.object({
  email: z.string().trim().email().max(150).optional(),
  fullName: required(150).optional(),
  role: z.enum(["ADMIN", "OFFICER", "APPROVER", "MANAGEMENT", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
  unlock: z.boolean().optional(),
});

export const settingsSchema = z
  .object({
    institution_name: required(150),
    system_name: required(150),
    default_sitting_start: time,
    late_after_minutes: z.coerce.number().int().min(0).max(240),
    absence_alert_threshold: z.coerce.number().int().min(1).max(100),
    count_official_duty_present: z.boolean(),
    session_idle_minutes: z.coerce.number().int().min(5).max(480),
    session_max_hours: z.coerce.number().int().min(1).max(72),
    max_failed_logins: z.coerce.number().int().min(3).max(20),
    lockout_minutes: z.coerce.number().int().min(1).max(1440),
    password_min_length: z.coerce.number().int().min(8).max(64),
    password_expiry_days: z.coerce.number().int().min(0).max(730),
  })
  .partial();

export const REPORT_TYPES = ["daily", "weekly", "monthly", "quarterly", "annual", "mp", "party", "constituency", "region", "sitting"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const reportFilterSchema = z.object({
  type: z.enum(REPORT_TYPES).default("monthly"),
  from: optDate.optional(),
  to: optDate.optional(),
  partyId: optId.optional(),
  constituencyId: optId.optional(),
  regionId: optId.optional(),
  mpId: optId.optional(),
  sittingId: optId.optional(),
  sittingType: z.enum(SITTING_TYPES).optional(),
  format: z.enum(["json", "pdf", "xlsx"]).default("json"),
});
export type ReportFilters = z.infer<typeof reportFilterSchema>;

export { trimmed };
