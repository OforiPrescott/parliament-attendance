import { ApiError, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";
import { exec, one, rows, transaction } from "@/lib/db";

/**
 * Bulk import / update of the MP roster from CSV. Expected columns:
 *   parliamentary_id, title, first_name, other_names, last_name, gender (M/F),
 *   party (abbreviation), constituency, region, email, phone, term_start (YYYY-MM-DD)
 * Unknown parties are rejected; unknown constituencies are created in the
 * named region. Existing MPs (matched by parliamentary_id) are updated.
 * Pass ?dryRun=1 to validate without saving.
 */
export const POST = route({ permission: "mps.manage" }, async ({ req, user }) => {
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose a CSV file.");
  if (file.size > 2 * 1024 * 1024) throw new ApiError(413, "CSV must be 2 MB or smaller.");
  const records = parseCsv(await file.text());
  if (!records.length) throw new ApiError(400, "The file has no data rows.");
  if (records.length > 1000) throw new ApiError(400, "Import at most 1,000 rows at a time.");

  const parliament = await one<{ id: number; start_date: string }>("SELECT id, start_date FROM parliaments WHERE is_current = 1 LIMIT 1");
  if (!parliament) throw new ApiError(400, "Set a current Parliament on the Sittings › Calendar screen first.");
  const parties = new Map((await rows<{ id: number; abbreviation: string }>("SELECT id, abbreviation FROM parties")).map((p) => [p.abbreviation.toUpperCase(), p.id]));
  const regions = new Map((await rows<{ id: number; name: string }>("SELECT id, name FROM regions")).map((r) => [r.name.toLowerCase(), r.id]));
  const consts = new Map((await rows<{ id: number; name: string }>("SELECT id, name FROM constituencies")).map((c) => [c.name.toLowerCase(), c.id]));

  const errors: { row: number; message: string }[] = [];
  const valid: Record<string, string>[] = [];
  const seen = new Set<string>();
  records.forEach((r, i) => {
    const line = i + 2;
    const problems: string[] = [];
    if (!/^[A-Za-z0-9\-/]{1,30}$/.test(r.parliamentary_id ?? "")) problems.push("parliamentary_id missing or invalid");
    if (seen.has(r.parliamentary_id)) problems.push("duplicate parliamentary_id in file");
    if (!r.first_name || !r.last_name) problems.push("first_name and last_name are required");
    if (!["M", "F"].includes((r.gender ?? "").toUpperCase())) problems.push("gender must be M or F");
    if (!parties.has((r.party ?? "").toUpperCase())) problems.push(`unknown party '${r.party ?? ""}'`);
    if (!r.constituency) problems.push("constituency is required");
    if (r.constituency && !consts.has(r.constituency.toLowerCase()) && !regions.has((r.region ?? "").toLowerCase()))
      problems.push(`new constituency '${r.constituency}' needs a known region`);
    if (r.term_start && !/^\d{4}-\d{2}-\d{2}$/.test(r.term_start)) problems.push("term_start must be YYYY-MM-DD");
    if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) problems.push("invalid email");
    seen.add(r.parliamentary_id);
    if (problems.length) errors.push({ row: line, message: problems.join("; ") });
    else valid.push(r);
  });

  if (dryRun || errors.length) return { dryRun, total: records.length, valid: valid.length, errors, saved: 0 };

  let created = 0, updated = 0;
  await transaction(async (tx) => {
    for (const r of valid) {
      let cid = consts.get(r.constituency.toLowerCase());
      if (!cid) {
        const newId: number = (await exec("INSERT INTO constituencies (name, region_id) VALUES (?, ?)", [r.constituency, regions.get(r.region.toLowerCase())!], tx)).insertId;
        consts.set(r.constituency.toLowerCase(), newId);
        cid = newId;
      }
      const pid = parties.get(r.party.toUpperCase())!;
      const existing = await one<{ id: number }>("SELECT id FROM mps WHERE parliamentary_id = ?", [r.parliamentary_id], tx);
      const vals = [r.title || null, r.first_name, r.other_names || null, r.last_name, r.gender.toUpperCase(), r.email || null, r.phone || null];
      if (existing) {
        await exec("UPDATE mps SET title=?, first_name=?, other_names=?, last_name=?, gender=?, email=?, phone=? WHERE id=?", [...vals, existing.id], tx);
        updated++;
      } else {
        const id = (await exec(
          "INSERT INTO mps (title, first_name, other_names, last_name, gender, email, phone, parliamentary_id, current_party_id, current_constituency_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
          [...vals, r.parliamentary_id, pid, cid],
          tx,
        )).insertId;
        await exec(
          "INSERT INTO mp_memberships (mp_id, parliament_id, party_id, constituency_id, start_date) VALUES (?,?,?,?,?)",
          [id, parliament.id, pid, cid, r.term_start || parliament.start_date],
          tx,
        );
        created++;
      }
    }
    await audit(user, { action: "MP_IMPORT", entityType: "mp", summary: `CSV import '${file.name}': ${created} created, ${updated} updated` }, tx);
  });
  return { dryRun: false, total: records.length, valid: valid.length, errors: [], created, updated };
});
