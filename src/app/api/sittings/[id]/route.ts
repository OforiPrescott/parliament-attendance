import { ApiError, body, intParam, notFound, route } from "@/lib/api";
import { audit, diff } from "@/lib/audit";
import { exec, one } from "@/lib/db";
import { getSitting } from "@/lib/attendance";
import { sittingSchema } from "@/lib/validation";

type P = { id: string };

export const GET = route<P>({ permission: "sittings.view" }, async ({ params }) => (await getSitting(intParam(params.id))) ?? notFound("Sitting"));

export const PATCH = route<P>({ permission: "sittings.manage" }, async ({ req, user, params }) => {
  const id = intParam(params.id);
  const s = await getSitting(id);
  if (!s) notFound("Sitting");
  const d = await body(req, sittingSchema);
  const hasRecords = (await one<{ n: number }>("SELECT COUNT(*) n FROM attendance WHERE sitting_id = ?", [id]))?.n ?? 0;
  // Once attendance exists, the date/type/committee define who was expected — lock them.
  if (hasRecords && (d.sittingDate !== s.sitting_date || d.sittingType !== s.sitting_type || (d.committeeId ?? null) !== s.committee_id))
    throw new ApiError(409, "Attendance has been recorded for this sitting, so its date, type and committee can no longer change.");
  if (s.register_status === "APPROVED" && d.status === "CANCELLED")
    throw new ApiError(409, "An approved sitting cannot be cancelled.");

  const after = {
    meeting_id: d.meetingId, sitting_type: d.sittingType, committee_id: d.sittingType === "COMMITTEE" ? d.committeeId : null,
    title: d.title, sitting_date: d.sittingDate, start_time: d.startTime.length === 5 ? `${d.startTime}:00` : d.startTime,
    end_time: d.endTime ? (d.endTime.length === 5 ? `${d.endTime}:00` : d.endTime) : null, venue: d.venue, status: d.status,
  };
  const ch = diff(s as unknown as Record<string, unknown>, after);
  if (!ch.changed.length) return { ok: true };
  await exec(`UPDATE sittings SET ${ch.changed.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, [...ch.changed.map((c) => ch.after[c]), id]);
  await audit(user, { action: "SITTING_UPDATE", entityType: "sitting", entityId: id, summary: `Updated '${d.title}' (${ch.changed.join(", ")})`, before: ch.before, after: ch.after });
  return { ok: true };
});

export const DELETE = route<P>({ permission: "sittings.manage" }, async ({ user, params }) => {
  const id = intParam(params.id);
  const s = await getSitting(id);
  if (!s) notFound("Sitting");
  const n = (await one<{ n: number }>("SELECT COUNT(*) n FROM attendance WHERE sitting_id = ?", [id]))?.n ?? 0;
  if (n) throw new ApiError(409, `This sitting has ${n} attendance records. Mark it as cancelled or adjourned instead of deleting.`);
  await exec("DELETE FROM sittings WHERE id = ?", [id]);
  await audit(user, { action: "SITTING_DELETE", entityType: "sitting", entityId: id, summary: `Deleted '${s.title}' (${s.sitting_date})` });
  return { ok: true };
});
