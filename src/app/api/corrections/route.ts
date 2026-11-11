import { z } from "zod";
import { ApiError, body, query, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec, one } from "@/lib/db";
import { listCorrections } from "@/lib/queries";
import { correctionSchema } from "@/lib/validation";

export const GET = route({ permission: ["corrections.request", "corrections.review"] }, async ({ req }) => {
  const { status } = query(req, z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED", "ALL"]).default("PENDING") }));
  return listCorrections(status);
});

/** Corrections apply only to APPROVED registers; drafts are edited directly. */
export const POST = route({ permission: "corrections.request" }, async ({ req, user }) => {
  const d = await body(req, correctionSchema);
  const a = await one<{ id: number; status: string; remarks: string | null; register_status: string; title: string; mp: string; pending: number }>(
    `SELECT a.id, a.status, a.remarks, s.register_status, s.title, CONCAT_WS(' ', m.first_name, m.last_name) mp,
            (SELECT COUNT(*) FROM attendance_corrections c WHERE c.attendance_id = a.id AND c.status = 'PENDING') pending
       FROM attendance a JOIN sittings s ON s.id = a.sitting_id JOIN mps m ON m.id = a.mp_id WHERE a.id = ?`,
    [d.attendanceId],
  );
  if (!a) throw new ApiError(404, "Attendance record not found.");
  if (a.register_status !== "APPROVED") throw new ApiError(409, "This register is not approved yet — edit it directly instead.");
  if (a.pending) throw new ApiError(409, "A correction for this record is already awaiting review.");
  if (a.status === d.newStatus && (a.remarks ?? null) === (d.newRemarks ?? null)) throw new ApiError(400, "The correction does not change anything.");
  const r = await exec(
    `INSERT INTO attendance_corrections (attendance_id, old_status, new_status, old_remarks, new_remarks, reason, requested_by, requested_at)
     VALUES (?,?,?,?,?,?,?, LOCALTIMESTAMP)`,
    [a.id, a.status, d.newStatus, a.remarks, d.newRemarks, d.reason, user.id],
  );
  await audit(user, {
    action: "CORRECTION_REQUEST", entityType: "attendance", entityId: a.id,
    summary: `Requested correction for ${a.mp} at '${a.title}': ${a.status} → ${d.newStatus}`, after: d,
  });
  return { id: r.insertId };
});
