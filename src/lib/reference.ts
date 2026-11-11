import "server-only";
import { rows } from "./db";

export type RefData = {
  parties: { id: number; abbreviation: string; name: string; color: string; is_active: number }[];
  regions: { id: number; name: string }[];
  constituencies: { id: number; name: string; region_id: number; region_name: string }[];
  parliaments: { id: number; name: string; start_date: string; is_current: number }[];
};

/** Dropdown data shared by forms and filters. */
export async function getRefData(): Promise<RefData> {
  const [parties, regions, constituencies, parliaments] = await Promise.all([
    rows<RefData["parties"][number]>("SELECT id, abbreviation, name, color, is_active FROM parties ORDER BY abbreviation"),
    rows<RefData["regions"][number]>("SELECT id, name FROM regions ORDER BY name"),
    rows<RefData["constituencies"][number]>(
      "SELECT c.id, c.name, c.region_id, r.name region_name FROM constituencies c JOIN regions r ON r.id = c.region_id WHERE c.is_active = 1 ORDER BY c.name",
    ),
    rows<RefData["parliaments"][number]>("SELECT id, name, start_date, is_current FROM parliaments ORDER BY number DESC"),
  ]);
  return { parties, regions, constituencies, parliaments };
}
