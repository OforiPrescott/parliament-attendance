import { z } from "zod";
import { ApiError } from "@/lib/api";
import { meetingSchema, parliamentSchema, sessionSchema } from "@/lib/validation";

/** Fixed mapping from URL segment to table and validator — identifiers never come from input. */
export const KINDS = {
  parliaments: {
    table: "parliaments",
    label: "Parliament",
    schema: parliamentSchema,
    cols: (d: z.infer<typeof parliamentSchema>) => ({ number: d.number, name: d.name, start_date: d.startDate, end_date: d.endDate, is_current: d.isCurrent ? 1 : 0 }),
  },
  sessions: {
    table: "parliament_sessions",
    label: "Session",
    schema: sessionSchema,
    cols: (d: z.infer<typeof sessionSchema>) => ({ parliament_id: d.parliamentId, number: d.number, name: d.name, start_date: d.startDate, end_date: d.endDate }),
  },
  meetings: {
    table: "meetings",
    label: "Meeting",
    schema: meetingSchema,
    cols: (d: z.infer<typeof meetingSchema>) => ({ session_id: d.sessionId, number: d.number, name: d.name, start_date: d.startDate, end_date: d.endDate }),
  },
} as const;

export type Kind = keyof typeof KINDS;

export function kindOf(k: string) {
  if (!(k in KINDS)) throw new ApiError(404, "Unknown calendar type.");
  return KINDS[k as Kind];
}

export function validate(k: string, raw: unknown): Record<string, unknown> {
  const def = kindOf(k);
  const d = def.schema.parse(raw);
  const cols = (def.cols as (x: unknown) => Record<string, unknown>)(d);
  if (cols.end_date && cols.start_date && String(cols.end_date) < String(cols.start_date))
    throw new ApiError(400, "End date must be on or after the start date.", { fields: { endDate: "Before start date" } });
  return cols;
}
