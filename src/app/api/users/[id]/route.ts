import { ApiError, body, intParam, notFound, route } from "@/lib/api";
import { audit, diff } from "@/lib/audit";
import { generateTempPassword, hashPassword } from "@/lib/auth";
import { exec, one, transaction } from "@/lib/db";
import { userUpdateSchema } from "@/lib/validation";

type P = { id: string };

export const PATCH = route<P>({ permission: "users.manage" }, async ({ req, user, params }) => {
  const id = intParam(params.id);
  const d = await body(req, userUpdateSchema);
  const before = await one<{ username: string; email: string; full_name: string; role_code: string; role_id: number; is_active: number }>(
    "SELECT u.username, u.email, u.full_name, r.code role_code, u.role_id, u.is_active FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?",
    [id],
  );
  if (!before) notFound("User");
  if (id === user.id && (d.isActive === false || (d.role && d.role !== "ADMIN")))
    throw new ApiError(400, "You cannot deactivate yourself or remove your own administrator role.");
  if (before.role_code === "ADMIN" && (d.isActive === false || (d.role && d.role !== "ADMIN"))) {
    const admins = await one<{ n: number }>("SELECT COUNT(*) n FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code='ADMIN' AND u.is_active=1");
    if ((admins?.n ?? 0) <= 1) throw new ApiError(400, "At least one active System Administrator must remain.");
  }

  const roleId = d.role ? (await one<{ id: number }>("SELECT id FROM roles WHERE code = ?", [d.role]))?.id : undefined;
  const after: Record<string, unknown> = {};
  if (d.email !== undefined) after.email = d.email.toLowerCase();
  if (d.fullName !== undefined) after.full_name = d.fullName;
  if (roleId !== undefined) after.role_id = roleId;
  if (d.isActive !== undefined) after.is_active = d.isActive ? 1 : 0;
  const ch = diff(before as unknown as Record<string, unknown>, after);

  await transaction(async (tx) => {
    if (ch.changed.length)
      await exec(`UPDATE users SET ${ch.changed.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, [...ch.changed.map((c) => ch.after[c]), id], tx);
    if (d.unlock) await exec("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?", [id], tx);
    // Role change or deactivation ends existing sessions immediately
    if (ch.changed.includes("role_id") || d.isActive === false)
      await exec("UPDATE user_sessions SET revoked_at = LOCALTIMESTAMP WHERE user_id = ? AND revoked_at IS NULL", [id], tx);
    await audit(user, {
      action: "USER_UPDATE", entityType: "user", entityId: id,
      summary: `Updated user '${before.username}'${d.role && d.role !== before.role_code ? ` — role ${before.role_code} → ${d.role}` : ""}${d.isActive === false ? " — deactivated" : d.isActive === true && !before.is_active ? " — reactivated" : ""}${d.unlock ? " — unlocked" : ""}`,
      before: ch.before, after: ch.after,
    }, tx);
  });
  return { ok: true };
});

/** POST = reset password: issues a one-time password and signs the user out everywhere. */
export const POST = route<P>({ permission: "users.manage" }, async ({ user, params }) => {
  const id = intParam(params.id);
  const u = await one<{ username: string }>("SELECT username FROM users WHERE id = ?", [id]);
  if (!u) notFound("User");
  const password = generateTempPassword();
  await transaction(async (tx) => {
    await exec(
      "UPDATE users SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL, password_changed_at = LOCALTIMESTAMP WHERE id = ?",
      [await hashPassword(password), id], tx,
    );
    await exec("UPDATE user_sessions SET revoked_at = LOCALTIMESTAMP WHERE user_id = ? AND revoked_at IS NULL", [id], tx);
    await audit(user, { action: "PASSWORD_RESET", entityType: "user", entityId: id, summary: `Reset password for '${u.username}'` }, tx);
  });
  return { temporaryPassword: password };
});
