import "server-only";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { exec, one } from "./db";
import { getSettings } from "./settings";
import { can, permissionsFor, type Permission, type RoleCode } from "./permissions";

export const SESSION_COOKIE = "pa_session";
const BCRYPT_ROUNDS = 12;
// Hash compared against when a username does not exist, so response time
// does not reveal which usernames are valid. Computed once per process.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hash(randomBytes(16).toString("hex"), BCRYPT_ROUNDS));

export type SessionUser = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: RoleCode;
  roleName: string;
  permissions: Permission[];
  mustChangePassword: boolean;
  passwordExpired: boolean;
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** One-time password meeting the policy; the user must change it at next sign-in. */
export const generateTempPassword = () => `Tp${randomBytes(9).toString("base64url")}7#`;

export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_ROUNDS);
export async function verifyPassword(pw: string, hash: string | null): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(pw, await getDummyHash());
    return false;
  }
  return bcrypt.compare(pw, hash);
}

export async function clientInfo() {
  const h = await headers();
  const trust = process.env.TRUST_PROXY === "true";
  const ip = (trust ? h.get("x-forwarded-for")?.split(",")[0]?.trim() : null) ?? h.get("x-real-ip") ?? null;
  return { ip: ip?.slice(0, 45) ?? null, userAgent: h.get("user-agent")?.slice(0, 255) ?? null };
}

export async function createSession(userId: number) {
  const s = await getSettings();
  const token = randomBytes(32).toString("base64url");
  const { ip, userAgent } = await clientInfo();
  await exec(
    `INSERT INTO user_sessions (id, user_id, created_at, last_seen_at, expires_at, ip_address, user_agent)
     VALUES (?, ?, LOCALTIMESTAMP, LOCALTIMESTAMP, LOCALTIMESTAMP + make_interval(hours => ?::int), ?, ?)`,
    [sha256(token), userId, s.session_max_hours, ip, userAgent],
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "strict",
    path: "/",
    maxAge: s.session_max_hours * 3600,
  });
}

export async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256(token) : null;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await exec("UPDATE user_sessions SET revoked_at = LOCALTIMESTAMP WHERE id = ?", [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

type SessionRow = {
  user_id: number; username: string; full_name: string; email: string; role_code: RoleCode; role_name: string;
  is_active: number; must_change_password: number; idle_seconds: number; password_age_days: number | null;
};

/** Returns the signed-in user or null. Enforces revocation, expiry and idle timeout. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = sha256(token);
  const s = await getSettings();
  const r = await one<SessionRow>(
    `SELECT u.id user_id, u.username, u.full_name, u.email, r.code role_code, r.name role_name, u.is_active,
            u.must_change_password,
            EXTRACT(EPOCH FROM (LOCALTIMESTAMP - us.last_seen_at))::int idle_seconds,
            (CURRENT_DATE - u.password_changed_at::date) password_age_days
       FROM user_sessions us
       JOIN users u ON u.id = us.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE us.id = ? AND us.revoked_at IS NULL AND us.expires_at > LOCALTIMESTAMP`,
    [id],
  );
  if (!r || !r.is_active) return null;
  if (r.idle_seconds > s.session_idle_minutes * 60) {
    await exec("UPDATE user_sessions SET revoked_at = LOCALTIMESTAMP WHERE id = ?", [id]);
    return null;
  }
  if (r.idle_seconds > 60) await exec("UPDATE user_sessions SET last_seen_at = LOCALTIMESTAMP WHERE id = ?", [id]);
  return {
    id: r.user_id,
    username: r.username,
    fullName: r.full_name,
    email: r.email,
    role: r.role_code,
    roleName: r.role_name,
    permissions: permissionsFor(r.role_code),
    mustChangePassword: !!r.must_change_password,
    passwordExpired: s.password_expiry_days > 0 && r.password_age_days !== null && r.password_age_days > s.password_expiry_days,
  };
});

/** For server components/pages. Redirects instead of throwing. */
export async function requireUser(permission?: Permission | Permission[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword || user.passwordExpired) redirect("/change-password");
  if (permission && !can(user.permissions, permission)) redirect("/forbidden");
  return user;
}
