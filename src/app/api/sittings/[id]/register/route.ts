import { ApiError, body, intParam, notFound, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { EDITABLE_REGISTER, getRegister, getSitting } from "@/lib/attendance";
import { exec, rows, transaction } from "@/lib/db";
import { can } from "@/lib/permissions";
import { registerActionSchema, registerSaveSchema } from "@/lib/validation";

type P = { id: string };

export const GET = route<P>({ permission: ["attendance.capture", "attendance.review", "sittings.view"] }, async ({ params }) => {
  const s = await getSitting(intParam(params.id));
  if (!s) notFound("Sitting");
  return { sitting: s, rows: await getRegister(s) };
});

/** Save (draft) the register. Upserts — the UNIQUE(sitting_id, mp_id) key makes duplicates impossible. */
export const PUT = route<P>({ permission: "attendance.capture" }, async ({ req, user, params }) => {
  const id = intParam(params.id);
  const { rows: input } = await body(req, registerSaveSchema);

  const result = await transaction(async (tx) => {
    // Lock the sitting row so two officers cannot save/submit concurrently
    await rows("SELECT id FROM sittings WHERE id = ? FOR UPDATE", [id], tx);
    const s = await getSitting(id, tx);
    if (!s) notFound("Sitting");
    if (!EDITABLE_REGISTER.includes(s.register_status))
      throw new ApiError(409, s.register_status === "APPROVED"
        ? "This register is approved and locked. Use a correction request to change a record."
        : "This register has been submitted for approval and cannot be edited.");
    if (s.status === "CANCELLED") throw new ApiError(409, "Attendance cannot be recorded for a cancelled sitting.");
    if (s.sitting_date > new Date().toISOString().slice(0, 10)) throw new ApiError(409, "Attendance cannot be recorded before the sitting date.");

    const register = await getRegister(s, tx);
    const byMp = new Map(register.map((r) => [r.mp_id, r]));
    const unknown = input.filter((r) => !byMp.has(r.mpId));
    if (unknown.length) throw new ApiError(400, `${unknown.length} member(s) are not expected at this sitting.`);

    let changed = 0;
    const changes: { mp: string; from: string | null; to: string }[] = [];
    for (const r of input) {
      const cur = byMp.get(r.mpId)!;
      const arrival = r.status === "LATE" || r.status === "PRESENT" ? r.arrivalTime : null;
      if (cur.status === r.status && (cur.remarks ?? null) === (r.remarks ?? null) && (cur.arrival_time?.slice(0, 5) ?? null) === (arrival?.slice(0, 5) ?? null)) continue;
      changed++;
      if (cur.status && cur.status !== r.status) changes.push({ mp: cur.full_name, from: cur.status, to: r.status });
      await exec(
        `INSERT INTO attendance (sitting_id, mp_id, party_id, constituency_id, status, arrival_time, remarks, recorded_by, recorded_at)
         VALUES (?,?,?,?,?,?,?,?, LOCALTIMESTAMP)
         ON CONFLICT (sitting_id, mp_id) DO UPDATE SET status = EXCLUDED.status, arrival_time = EXCLUDED.arrival_time, remarks = EXCLUDED.remarks,
                                 updated_by = ?, updated_at = LOCALTIMESTAMP`,
        [id, r.mpId, cur.party_id, cur.constituency_id, r.status, arrival, r.remarks, user.id, user.id],
        tx,
      );
    }
    if (s.register_status === "NOT_STARTED") await exec("UPDATE sittings SET register_status = 'DRAFT' WHERE id = ?", [id], tx);
    if (changed)
      await audit(user, {
        action: "ATTENDANCE_SAVE", entityType: "sitting", entityId: id,
        summary: `Saved register for '${s.title}' (${s.sitting_date}): ${changed} record(s) changed`,
        after: changes.length ? { statusChanges: changes.slice(0, 100) } : undefined,
      }, tx);
    const recorded = register.filter((r) => r.status || input.some((i) => i.mpId === r.mp_id)).length;
    return { changed, recorded, expected: register.length };
  });
  return result;
});

/** Workflow transitions: submit → approve | return; admin may reopen an approved register. */
export const POST = route<P>({ permission: ["attendance.capture", "attendance.review", "settings.manage"] }, async ({ req, user, params }) => {
  const id = intParam(params.id);
  const { action, comment } = await body(req, registerActionSchema);

  return transaction(async (tx) => {
    await rows("SELECT id FROM sittings WHERE id = ? FOR UPDATE", [id], tx);
    const s = await getSitting(id, tx);
    if (!s) notFound("Sitting");
    const label = `'${s.title}' (${s.sitting_date})`;

    if (action === "submit") {
      if (!can(user.permissions, "attendance.capture")) throw new ApiError(403, "You cannot submit registers.");
      if (!["DRAFT", "RETURNED"].includes(s.register_status)) throw new ApiError(409, "Only a draft or returned register can be submitted.");
      const reg = await getRegister(s, tx);
      const missing = reg.filter((r) => !r.status).length;
      if (missing) throw new ApiError(400, `${missing} member(s) have no attendance status. Complete the register before submitting.`);
      await exec(
        "UPDATE sittings SET register_status='SUBMITTED', submitted_by=?, submitted_at=LOCALTIMESTAMP, review_comment=NULL, status=CASE WHEN status='SCHEDULED' THEN 'HELD' ELSE status END WHERE id=?",
        [user.id, id], tx,
      );
      await audit(user, { action: "REGISTER_SUBMIT", entityType: "sitting", entityId: id, summary: `Submitted register for ${label} (${reg.length} members)` }, tx);
      return { register_status: "SUBMITTED" };
    }

    if (action === "approve" || action === "return") {
      if (!can(user.permissions, "attendance.review")) throw new ApiError(403, "You cannot review registers.");
      if (s.register_status !== "SUBMITTED") throw new ApiError(409, "Only a submitted register can be reviewed.");
      if (s.submitted_by === user.id) throw new ApiError(403, "Segregation of duties: you cannot review a register you submitted.");
      if (action === "return" && !comment) throw new ApiError(400, "Explain what needs to be corrected.", { fields: { comment: "Required" } });
      const next = action === "approve" ? "APPROVED" : "RETURNED";
      await exec(
        "UPDATE sittings SET register_status=?, reviewed_by=?, reviewed_at=LOCALTIMESTAMP, review_comment=? WHERE id=?",
        [next, user.id, comment ?? null, id], tx,
      );
      await audit(user, {
        action: action === "approve" ? "REGISTER_APPROVE" : "REGISTER_RETURN", entityType: "sitting", entityId: id,
        summary: `${action === "approve" ? "Approved" : "Returned"} register for ${label}${comment ? `: ${comment}` : ""}`,
      }, tx);
      return { register_status: next };
    }

    // reopen
    if (!can(user.permissions, "settings.manage")) throw new ApiError(403, "Only a System Administrator can reopen an approved register.");
    if (s.register_status !== "APPROVED") throw new ApiError(409, "Only an approved register can be reopened.");
    if (!comment) throw new ApiError(400, "Give the reason for reopening.", { fields: { comment: "Required" } });
    await exec("UPDATE sittings SET register_status='DRAFT', review_comment=? WHERE id=?", [`Reopened: ${comment}`, id], tx);
    await audit(user, { action: "REGISTER_REOPEN", entityType: "sitting", entityId: id, summary: `Reopened approved register for ${label}: ${comment}` }, tx);
    return { register_status: "DRAFT" };
  });
});
