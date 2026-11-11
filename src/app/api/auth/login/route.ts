import { NextResponse, type NextRequest } from "next/server";
import { ApiError, errorResponse } from "@/lib/api";
import { audit } from "@/lib/audit";
import { clientInfo, createSession, verifyPassword } from "@/lib/auth";
import { exec, one } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { loginSchema } from "@/lib/validation";

type U = {
  id: number; username: string; password_hash: string; is_active: number; failed_attempts: number;
  locked_seconds: number | null; must_change_password: number;
};

export async function POST(req: NextRequest) {
  try {
    const { ip } = await clientInfo();
    if (!rateLimit(`login:${ip ?? "unknown"}`, 20, 15 * 60_000))
      throw new ApiError(429, "Too many sign-in attempts from this network. Try again in 15 minutes.");

    const { username, password } = loginSchema.parse(await req.json().catch(() => ({})));
    const s = await getSettings();
    const user = await one<U>(
      `SELECT id, username, password_hash, is_active, failed_attempts, must_change_password,
              CASE WHEN locked_until > LOCALTIMESTAMP THEN EXTRACT(EPOCH FROM (locked_until - LOCALTIMESTAMP))::int END locked_seconds
         FROM users WHERE username = ?`,
      [username.toLowerCase()],
    );

    if (user?.locked_seconds) {
      await audit({ id: user.id, username: user.username }, { action: "LOGIN_BLOCKED", entityType: "user", entityId: user.id, summary: "Sign-in attempted while account locked" });
      throw new ApiError(423, `This account is temporarily locked. Try again in ${Math.ceil(user.locked_seconds / 60)} minute(s) or contact the administrator.`);
    }

    const ok = await verifyPassword(password, user?.password_hash ?? null);
    if (!user || !ok || !user.is_active) {
      if (user && !ok) {
        const attempts = user.failed_attempts + 1;
        const lock = attempts >= s.max_failed_logins;
        await exec(
          `UPDATE users SET failed_attempts = ?, locked_until = ${lock ? "LOCALTIMESTAMP + make_interval(mins => ?::int)" : "NULL"} WHERE id = ?`,
          lock ? [0, s.lockout_minutes, user.id] : [attempts, user.id],
        );
        await audit({ id: user.id, username: user.username }, {
          action: lock ? "ACCOUNT_LOCKED" : "LOGIN_FAILED", entityType: "user", entityId: user.id,
          summary: lock ? `Account locked after ${attempts} failed attempts` : `Failed sign-in (${attempts}/${s.max_failed_logins})`,
        });
      } else {
        await audit(null, { action: "LOGIN_FAILED", entityType: "user", summary: `Failed sign-in for '${username.slice(0, 50)}'${user && !user.is_active ? " (account disabled)" : ""}` });
      }
      throw new ApiError(401, "Invalid username or password.");
    }

    await exec("UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = LOCALTIMESTAMP WHERE id = ?", [user.id]);
    await createSession(user.id);
    await audit({ id: user.id, username: user.username }, { action: "LOGIN", entityType: "user", entityId: user.id, summary: "Signed in" });
    return NextResponse.json({ ok: true, mustChangePassword: !!user.must_change_password });
  } catch (e) {
    return errorResponse(e);
  }
}
