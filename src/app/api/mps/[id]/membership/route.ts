import { ApiError, body, intParam, notFound, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec, one, transaction } from "@/lib/db";
import { membershipChangeSchema } from "@/lib/validation";

/**
 * Records a change in an MP's seat or party (floor-crossing, new Parliament,
 * by-election return). Closes the open membership the day before the
 * effective date and opens a new one, preserving full history.
 */
export const POST = route<{ id: string }>({ permission: "mps.manage" }, async ({ req, user, params }) => {
  const id = intParam(params.id);
  const d = await body(req, membershipChangeSchema);
  const mp = await one<{ first_name: string; last_name: string }>("SELECT first_name, last_name FROM mps WHERE id = ?", [id]);
  if (!mp) notFound("MP");
  const open = await one<{ id: number; start_date: string }>(
    "SELECT id, start_date FROM mp_memberships WHERE mp_id = ? AND end_date IS NULL ORDER BY start_date DESC LIMIT 1",
    [id],
  );
  if (open && open.start_date >= d.effectiveDate)
    throw new ApiError(400, `The effective date must be after the current membership began (${open.start_date}).`);

  // Attendance already recorded on/after the effective date keeps its snapshot; warn the user.
  const affected = await one<{ n: number }>(
    "SELECT COUNT(*) n FROM attendance a JOIN sittings s ON s.id = a.sitting_id WHERE a.mp_id = ? AND s.sitting_date >= ?",
    [id, d.effectiveDate],
  );

  await transaction(async (tx) => {
    if (open)
      await exec("UPDATE mp_memberships SET end_date = ?::date - 1, end_reason = ? WHERE id = ?", [d.effectiveDate, d.reason, open.id], tx);
    await exec(
      "INSERT INTO mp_memberships (mp_id, parliament_id, party_id, constituency_id, start_date) VALUES (?,?,?,?,?)",
      [id, d.parliamentId, d.partyId, d.constituencyId, d.effectiveDate],
      tx,
    );
    await exec("UPDATE mps SET current_party_id = ?, current_constituency_id = ?, status = 'ACTIVE' WHERE id = ?", [d.partyId, d.constituencyId, id], tx);
    await audit(user, {
      action: "MP_MEMBERSHIP_CHANGE", entityType: "mp", entityId: id,
      summary: `Membership change for ${mp.first_name} ${mp.last_name} effective ${d.effectiveDate}: ${d.reason}`,
      after: d,
    }, tx);
  });
  return { ok: true, recordsOnOrAfter: affected?.n ?? 0 };
});
