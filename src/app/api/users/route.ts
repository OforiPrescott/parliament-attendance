import { ApiError, body, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { generateTempPassword, hashPassword } from "@/lib/auth";
import { exec, one } from "@/lib/db";
import { listUsers } from "@/lib/queries";
import { userCreateSchema } from "@/lib/validation";

export const GET = route({ permission: "users.manage" }, async () => listUsers());

/** Creates a user with a one-time password shown once to the administrator. */
export const POST = route({ permission: "users.manage" }, async ({ req, user }) => {
  const d = await body(req, userCreateSchema);
  const role = await one<{ id: number }>("SELECT id FROM roles WHERE code = ?", [d.role]);
  if (!role) throw new ApiError(400, "Unknown role.");
  const password = generateTempPassword();
  const r = await exec(
    "INSERT INTO users (username, email, full_name, role_id, password_hash, must_change_password, password_changed_at) VALUES (?,?,?,?,?,1,LOCALTIMESTAMP)",
    [d.username, d.email.toLowerCase(), d.fullName, role.id, await hashPassword(password)],
  );
  await audit(user, { action: "USER_CREATE", entityType: "user", entityId: r.insertId, summary: `Created user '${d.username}' as ${d.role}`, after: d });
  return { id: r.insertId, temporaryPassword: password };
});
