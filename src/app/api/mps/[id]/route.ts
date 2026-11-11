import { ApiError, body, intParam, notFound, route } from "@/lib/api";
import { audit, diff } from "@/lib/audit";
import { exec, one, transaction } from "@/lib/db";
import { getMp } from "@/lib/queries";
import { deletePhoto } from "@/lib/uploads";
import { mpUpdateSchema } from "@/lib/validation";

type P = { id: string };

export const GET = route<P>({ permission: "mps.view" }, async ({ params }) => (await getMp(intParam(params.id))) ?? notFound("MP"));

const COLS: Record<string, string> = {
  parliamentaryId: "parliamentary_id", title: "title", firstName: "first_name", otherNames: "other_names",
  lastName: "last_name", gender: "gender", email: "email", phone: "phone", status: "status",
};

export const PATCH = route<P>({ permission: "mps.manage" }, async ({ req, user, params }) => {
  const id = intParam(params.id);
  const d = await body(req, mpUpdateSchema);
  const before = await one<Record<string, unknown>>("SELECT * FROM mps WHERE id = ?", [id]);
  if (!before) notFound("MP");

  const mapped: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(COLS)) if ((d as Record<string, unknown>)[k] !== undefined) mapped[col] = (d as Record<string, unknown>)[k];
  const { before: b, after: a, changed } = diff(before, mapped);
  if (!changed.length) return { ok: true, unchanged: true };

  // Leaving office closes the open membership so the MP drops off future registers.
  const leaving = d.status && d.status !== "ACTIVE" && d.status !== "SUSPENDED" && before.status !== d.status;
  if (leaving && !d.statusDate) throw new ApiError(400, "Give the date the member left office.", { fields: { statusDate: "Required" } });

  await transaction(async (tx) => {
    await exec(`UPDATE mps SET ${changed.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, [...changed.map((c) => a[c]), id], tx);
    if (leaving) {
      await exec(
        "UPDATE mp_memberships SET end_date = ?, end_reason = ? WHERE mp_id = ? AND end_date IS NULL",
        [d.statusDate, d.statusReason ?? d.status!.toLowerCase(), id],
        tx,
      );
      await exec("UPDATE committee_members SET end_date = ? WHERE mp_id = ? AND end_date IS NULL", [d.statusDate, id], tx);
    }
    await audit(user, { action: "MP_UPDATE", entityType: "mp", entityId: id, summary: `Updated MP ${before.first_name} ${before.last_name}: ${changed.join(", ")}`, before: b, after: a }, tx);
  });
  return { ok: true };
});

export const DELETE = route<P>({ permission: "mps.manage" }, async ({ user, params }) => {
  const id = intParam(params.id);
  const mp = await one<{ first_name: string; last_name: string; photo_path: string | null; n: number }>(
    "SELECT first_name, last_name, photo_path, (SELECT COUNT(*) FROM attendance WHERE mp_id = mps.id) n FROM mps WHERE id = ?",
    [id],
  );
  if (!mp) notFound("MP");
  if (mp.n > 0)
    throw new ApiError(409, `This MP has ${mp.n} attendance records and cannot be deleted. Change their status to 'Former member' instead.`);
  await transaction(async (tx) => {
    await exec("DELETE FROM mps WHERE id = ?", [id], tx);
    await audit(user, { action: "MP_DELETE", entityType: "mp", entityId: id, summary: `Deleted MP ${mp.first_name} ${mp.last_name} (no attendance history)` }, tx);
  });
  await deletePhoto(mp.photo_path);
  return { ok: true };
});
