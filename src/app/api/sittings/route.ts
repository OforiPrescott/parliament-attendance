import { z } from "zod";
import { ApiError, body, query, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec, one, rows, transaction } from "@/lib/db";
import { listSittings } from "@/lib/queries";
import { sittingBulkSchema, sittingSchema } from "@/lib/validation";

const listQuery = z.object({
  from: z.string().optional(), to: z.string().optional(), type: z.string().optional(), registerStatus: z.string().optional(),
  meetingId: z.coerce.number().int().positive().optional(), q: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().optional(), pageSize: z.coerce.number().int().positive().max(200).optional(),
});

export const GET = route({ permission: "sittings.view" }, async ({ req }) => listSittings(query(req, listQuery)));

/** Creates one sitting, or — with ?bulk=1 — every sitting day in a meeting on the chosen weekdays. */
export const POST = route({ permission: "sittings.manage" }, async ({ req, user }) => {
  if (req.nextUrl.searchParams.get("bulk") === "1") {
    const d = await body(req, sittingBulkSchema);
    const m = await one<{ name: string; start_date: string; end_date: string | null }>("SELECT name, start_date, end_date FROM meetings WHERE id = ?", [d.meetingId]);
    if (!m) throw new ApiError(404, "Meeting not found.");
    if (!m.end_date) throw new ApiError(400, "Set the meeting's end date before generating sittings.");
    const existing = new Set(
      (await rows<{ sitting_date: string }>("SELECT sitting_date FROM sittings WHERE meeting_id = ? AND sitting_type = 'PLENARY'", [d.meetingId])).map((r) => r.sitting_date),
    );
    const dates: string[] = [];
    for (let t = Date.parse(`${m.start_date}T00:00:00Z`); t <= Date.parse(`${m.end_date}T00:00:00Z`); t += 86400000) {
      const dt = new Date(t);
      const iso = dt.toISOString().slice(0, 10);
      if (d.weekdays.includes(dt.getUTCDay()) && !existing.has(iso)) dates.push(iso);
    }
    if (dates.length > 200) throw new ApiError(400, "That would create more than 200 sittings. Shorten the meeting period.");
    await transaction(async (tx) => {
      const count = (await one<{ n: number }>("SELECT COUNT(*) n FROM sittings WHERE sitting_type='PLENARY'", [], tx))?.n ?? 0;
      let i = count;
      for (const date of dates) {
        i++;
        await exec(
          "INSERT INTO sittings (meeting_id, sitting_type, title, sitting_date, start_time, venue, created_by) VALUES (?, 'PLENARY', ?, ?, ?, ?, ?)",
          [d.meetingId, `Plenary Sitting No. ${i}`, date, d.startTime, d.venue, user.id],
          tx,
        );
      }
      await audit(user, { action: "SITTING_BULK_CREATE", entityType: "sitting", summary: `Generated ${dates.length} plenary sittings for ${m.name}` }, tx);
    });
    return { created: dates.length };
  }

  const d = await body(req, sittingSchema);
  const clash = await one<{ id: number }>(
    "SELECT id FROM sittings WHERE sitting_date = ? AND start_time = ? AND sitting_type = ? AND committee_id IS NOT DISTINCT FROM ?::int AND status <> 'CANCELLED'",
    [d.sittingDate, d.startTime, d.sittingType, d.sittingType === "COMMITTEE" ? d.committeeId : null],
  );
  if (clash) throw new ApiError(409, "A sitting of this type already exists at that date and time.");
  const r = await exec(
    `INSERT INTO sittings (meeting_id, sitting_type, committee_id, title, sitting_date, start_time, end_time, venue, status, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [d.meetingId, d.sittingType, d.sittingType === "COMMITTEE" ? d.committeeId : null, d.title, d.sittingDate, d.startTime, d.endTime, d.venue, d.status, user.id],
  );
  await audit(user, { action: "SITTING_CREATE", entityType: "sitting", entityId: r.insertId, summary: `Scheduled '${d.title}' on ${d.sittingDate}`, after: d });
  return { id: r.insertId };
});
