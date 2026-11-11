import { z } from "zod";
import { body, query, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec, transaction } from "@/lib/db";
import { listMps } from "@/lib/queries";
import { mpCreateSchema } from "@/lib/validation";

const listQuery = z.object({
  q: z.string().max(100).optional(),
  partyId: z.coerce.number().int().positive().optional(),
  regionId: z.coerce.number().int().positive().optional(),
  constituencyId: z.coerce.number().int().positive().optional(),
  status: z.string().max(20).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(500).optional(),
});

export const GET = route({ permission: "mps.view" }, async ({ req }) => listMps(query(req, listQuery)));

export const POST = route({ permission: "mps.manage" }, async ({ req, user }) => {
  const d = await body(req, mpCreateSchema);
  const id = await transaction(async (tx) => {
    const r = await exec(
      `INSERT INTO mps (parliamentary_id, title, first_name, other_names, last_name, gender, email, phone, status, current_party_id, current_constituency_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [d.parliamentaryId, d.title, d.firstName, d.otherNames, d.lastName, d.gender, d.email ?? null, d.phone, d.status, d.partyId, d.constituencyId],
      tx,
    );
    await exec(
      "INSERT INTO mp_memberships (mp_id, parliament_id, party_id, constituency_id, start_date) VALUES (?,?,?,?,?)",
      [r.insertId, d.parliamentId, d.partyId, d.constituencyId, d.termStart],
      tx,
    );
    await audit(user, { action: "MP_CREATE", entityType: "mp", entityId: r.insertId, summary: `Added MP ${d.firstName} ${d.lastName} (${d.parliamentaryId})`, after: d }, tx);
    return r.insertId;
  });
  return { id };
});
