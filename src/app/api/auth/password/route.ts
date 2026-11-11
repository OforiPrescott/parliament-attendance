import { ApiError, body, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { currentSessionId, hashPassword, verifyPassword } from "@/lib/auth";
import { exec, one } from "@/lib/db";
import { passwordProblems } from "@/lib/password-policy";
import { getSettings } from "@/lib/settings";
import { changePasswordSchema } from "@/lib/validation";

export const POST = route({ allowPasswordChange: true }, async ({ req, user }) => {
  const { currentPassword, newPassword } = await body(req, changePasswordSchema);
  const s = await getSettings();
  const row = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", [user.id]);
  if (!row || !(await verifyPassword(currentPassword, row.password_hash)))
    throw new ApiError(400, "Your current password is incorrect.", { fields: { currentPassword: "Incorrect password" } });
  const problems = passwordProblems(newPassword, s.password_min_length, user.username);
  if (problems.length) throw new ApiError(400, `New password needs ${problems.join(", ")}.`);
  if (await verifyPassword(newPassword, row.password_hash)) throw new ApiError(400, "Choose a password different from your current one.");

  await exec(
    "UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = LOCALTIMESTAMP WHERE id = ?",
    [await hashPassword(newPassword), user.id],
  );
  // Sign out every other device
  await exec(
    "UPDATE user_sessions SET revoked_at = LOCALTIMESTAMP WHERE user_id = ? AND id <> ? AND revoked_at IS NULL",
    [user.id, (await currentSessionId()) ?? ""],
  );
  await audit(user, { action: "PASSWORD_CHANGE", entityType: "user", entityId: user.id, summary: "Changed own password" });
  return { ok: true };
});
