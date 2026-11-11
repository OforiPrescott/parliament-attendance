import { body, intParam, notFound, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec, one, rows, transaction } from "@/lib/db";
import { getCommitteeMembers } from "@/lib/queries";
import { committeeMembersSchema } from "@/lib/validation";

type P = { id: string };

export const GET = route<P>({ permission: "sittings.view" }, async ({ params }) => getCommitteeMembers(intParam(params.id)));

/**
 * Replaces the current membership list. Members removed get an end date;
 * new members start on the effective date; role changes close the old row
 * and open a new one. History is never deleted.
 */
export const PUT = route<P>({ permission: "sittings.manage" }, async ({ req, user, params }) => {
  const id = intParam(params.id);
  const { members, effectiveDate } = await body(req, committeeMembersSchema);
  const c = await one<{ name: string }>("SELECT name FROM committees WHERE id = ?", [id]);
  if (!c) notFound("Committee");

  const result = await transaction(async (tx) => {
    const current = await rows<{ id: number; mp_id: number; role: string }>(
      "SELECT id, mp_id, role FROM committee_members WHERE committee_id = ? AND end_date IS NULL",
      [id],
      tx,
    );
    const wanted = new Map(members.map((m) => [m.mpId, m.role]));
    let added = 0, removed = 0, changed = 0;
    for (const cur of current) {
      const role = wanted.get(cur.mp_id);
      if (role === cur.role) { wanted.delete(cur.mp_id); continue; }
      await exec("UPDATE committee_members SET end_date = ?::date - 1 WHERE id = ?", [effectiveDate, cur.id], tx);
      if (role) changed++; else removed++;
    }
    for (const [mpId, role] of wanted) {
      await exec(
        "INSERT INTO committee_members (committee_id, mp_id, role, start_date) VALUES (?,?,?,?) ON CONFLICT (committee_id, mp_id, start_date) DO UPDATE SET role = EXCLUDED.role, end_date = NULL",
        [id, mpId, role, effectiveDate],
        tx,
      );
      if (!current.some((x) => x.mp_id === mpId)) added++;
    }
    await audit(user, {
      action: "COMMITTEE_MEMBERS", entityType: "committee", entityId: id,
      summary: `${c.name} membership from ${effectiveDate}: ${added} added, ${removed} removed, ${changed} role changes`,
      after: members,
    }, tx);
    return { added, removed, changed };
  });
  return result;
});
