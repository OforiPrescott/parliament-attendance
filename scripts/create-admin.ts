/**
 * Creates the first System Administrator for a PRODUCTION install.
 * Prints a one-time random password; the admin must change it at first login.
 *   npm run db:create-admin
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { connectionConfig, execOn, PG, pg, rowsOn } from "../src/lib/sql";

async function main() {
  const client = new pg.Client(connectionConfig());
  await client.connect();
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const email = process.env.ADMIN_EMAIL ?? "admin@parliament.gh";
  const fullName = process.env.ADMIN_FULL_NAME ?? "System Administrator";
  // 18 chars, guaranteed to include each character class
  const password = `Pa${randomBytes(9).toString("base64url")}9!x`;
  const hash = await bcrypt.hash(password, 12);

  try {
    const roles = await rowsOn<{ id: number }>(client, "SELECT id FROM roles WHERE code='ADMIN'");
    if (!roles.length) throw new Error("Run `npm run db:migrate` first.");

    await execOn(
      client,
      `INSERT INTO users (username, email, full_name, role_id, password_hash, must_change_password, password_changed_at)
       VALUES (?, ?, ?, ?, ?, 1, LOCALTIMESTAMP)`,
      [username, email.toLowerCase(), fullName, roles[0].id, hash],
    );
    await execOn(
      client,
      `INSERT INTO audit_logs (username, action, entity_type, summary) VALUES ('system', 'USER_CREATE', 'user', ?)`,
      [`Initial administrator '${username}' created from command line`],
    );
  } finally {
    await client.end();
  }
  console.log(`\n✔ Administrator created\n  username: ${username}\n  one-time password: ${password}\n  (must be changed at first login)\n`);
}

main().catch((e) => {
  console.error(e.code === PG.UNIQUE_VIOLATION ? "That username or email already exists." : e);
  process.exit(1);
});
