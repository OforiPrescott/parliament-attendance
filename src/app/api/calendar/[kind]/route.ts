import { ApiError, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exec, transaction } from "@/lib/db";
import { getCalendar } from "@/lib/queries";
import { kindOf, validate } from "../_shared";

export const GET = route<{ kind: string }>({ permission: "sittings.view" }, async () => getCalendar());

export const POST = route<{ kind: string }>({ permission: "sittings.manage" }, async ({ req, user, params }) => {
  const def = kindOf(params.kind);
  const cols = validate(params.kind, await req.json().catch(() => { throw new ApiError(400, "Invalid JSON"); }));
  const id = await transaction(async (tx) => {
    if (def.table === "parliaments" && cols.is_current) await exec("UPDATE parliaments SET is_current = 0", [], tx);
    const keys = Object.keys(cols);
    const r = await exec(`INSERT INTO ${def.table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`, keys.map((k) => cols[k]), tx);
    await audit(user, { action: `${def.label.toUpperCase()}_CREATE`, entityType: def.table, entityId: r.insertId, summary: `Added ${def.label.toLowerCase()} '${cols.name}'`, after: cols }, tx);
    return r.insertId;
  });
  return { id };
});
