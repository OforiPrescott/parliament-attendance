import "server-only";
import { cache } from "react";
import { rows } from "./db";

export type Settings = {
  institution_name: string;
  system_name: string;
  default_sitting_start: string;
  late_after_minutes: number;
  absence_alert_threshold: number;
  count_official_duty_present: boolean;
  session_idle_minutes: number;
  session_max_hours: number;
  max_failed_logins: number;
  lockout_minutes: number;
  password_min_length: number;
  password_expiry_days: number;
};

export const SETTING_DEFAULTS: Settings = {
  institution_name: "Parliament of Ghana",
  system_name: "MP Attendance Management System",
  default_sitting_start: "10:00",
  late_after_minutes: 30,
  absence_alert_threshold: 15,
  count_official_duty_present: true,
  session_idle_minutes: 30,
  session_max_hours: 12,
  max_failed_logins: 5,
  lockout_minutes: 15,
  password_min_length: 10,
  password_expiry_days: 90,
};

export const getSettings = cache(async (): Promise<Settings> => {
  const out: Record<string, unknown> = { ...SETTING_DEFAULTS };
  let list: { setting_key: string; setting_value: string }[] = [];
  try {
    list = await rows("SELECT setting_key, setting_value FROM settings");
  } catch {
    return SETTING_DEFAULTS;
  }
  for (const { setting_key, setting_value } of list) {
    const def = (SETTING_DEFAULTS as Record<string, unknown>)[setting_key];
    if (def === undefined) continue;
    out[setting_key] =
      typeof def === "number" ? Number(setting_value) || def : typeof def === "boolean" ? setting_value === "true" : setting_value;
  }
  return out as Settings;
});
