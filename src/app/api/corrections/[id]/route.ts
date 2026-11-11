import { ApiError, body, intParam, notFound, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec, one, transaction } from "@/lib/db";
import { reviewSchema } from "@/lib/validation";

export const POST = route<{ id: string }>({ permission: "corrections.review" }, async ({ req, user, params }) => {
  const id = intParam(params.id);
  const { action, comment } = await body(req, reviewSchema);
  if (action === "reject" && !comment) throw new ApiError(400, "Give a reason for rejecting.", { fields: { comment: "Required" } });

  await transaction(async (tx) => {
    const c = await one<{ id: number; attendance_id: number; status: string; requested_by: number | null; old_status: string; new_status: string; new_remarks: string | null; current_status: string; mp: string; title: string }>(
      `SELECT ac.*, a.status current_status, CONCAT_WS(' ', m.first_name, m.last_name) mp, s.title
         FROM attendance_corrections ac JOIN attendance a ON a.id = ac.attendance_id
         JOIN mps m ON m.id = a.mp_id JOIN sittings s ON s.id = a.sitting_id
        WHERE ac.id = ? FOR UPDATE OF ac, a`,
      [id],
      tx,
    );
    if (!c) notFound("Correction request");
    if (c.status !== "PENDING") throw new ApiError(409, "This request has already been reviewed.");
    if (c.requested_by === user.id) throw new ApiError(403, "Segregation of duties: you cannot review your own correction request.");
    if (action === "approve" && c.current_status !== c.old_status)
      throw new ApiError(409, "The record has changed since this request was made. Reject it and ask for a fresh request.");

    await exec(
      "UPDATE attendance_corrections SET status = ?, reviewed_by = ?, reviewed_at = LOCALTIMESTAMP, review_comment = ? WHERE id = ?",
      [action === "approve" ? "APPROVED" : "REJECTED", user.id, comment ?? null, id],
      tx,
    );
    if (action === "approve") {
      await exec(
        "UPDATE attendance SET status = ?, remarks = ?, arrival_time = CASE WHEN ?::text IN ('PRESENT','LATE') THEN arrival_time END, updated_by = ?, updated_at = LOCALTIMESTAMP WHERE id = ?",
        [c.new_status, c.new_remarks, c.new_status, user.id, c.attendance_id],
        tx,
      );
    }
    await audit(user, {
      action: action === "approve" ? "CORRECTION_APPROVE" : "CORRECTION_REJECT", entityType: "attendance", entityId: c.attendance_id,
      summary: `${action === "approve" ? "Approved" : "Rejected"} correction for ${c.mp} at '${c.title}' (${c.old_status} → ${c.new_status})${comment ? `: ${comment}` : ""}`,
      before: { status: c.old_status }, after: action === "approve" ? { status: c.new_status, remarks: c.new_remarks } : undefined,
    }, tx);
  });
  return { ok: true };
});
