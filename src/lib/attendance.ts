import "server-only";
import { one, rows, type Executor, pool } from "./db";

export type Sitting = {
  id: number;
  meeting_id: number | null;
  meeting_name: string | null;
  session_name: string | null;
  sitting_type: "PLENARY" | "COMMITTEE" | "OTHER";
  committee_id: number | null;
  committee_name: string | null;
  title: string;
  sitting_date: string;
  start_time: string;
  end_time: string | null;
  venue: string | null;
  status: "SCHEDULED" | "HELD" | "ADJOURNED" | "CANCELLED";
  register_status: "NOT_STARTED" | "DRAFT" | "SUBMITTED" | "RETURNED" | "APPROVED";
  submitted_by: number | null;
  submitted_by_name: string | null;
  submitted_at: string | null;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
};

export async function getSitting(id: number, ex: Executor = pool) {
  return one<Sitting>(
    `SELECT s.*, m.name meeting_name, ps.name session_name, c.name committee_name,
            su.full_name submitted_by_name, ru.full_name reviewed_by_name
       FROM sittings s
       LEFT JOIN meetings m ON m.id = s.meeting_id
       LEFT JOIN parliament_sessions ps ON ps.id = m.session_id
       LEFT JOIN committees c ON c.id = s.committee_id
       LEFT JOIN users su ON su.id = s.submitted_by
       LEFT JOIN users ru ON ru.id = s.reviewed_by
      WHERE s.id = ?`,
    [id],
    ex,
  );
}

export type RegisterRow = {
  mp_id: number;
  parliamentary_id: string;
  title: string | null;
  full_name: string;
  photo: number;
  party_id: number;
  party_abbr: string;
  party_color: string;
  constituency_id: number;
  constituency_name: string;
  region_name: string;
  attendance_id: number | null;
  status: string | null;
  arrival_time: string | null;
  remarks: string | null;
  pending_correction: number;
};

/**
 * The MPs expected at a sitting:
 *  - PLENARY / OTHER: every MP whose membership covers the sitting date.
 *  - COMMITTEE: committee members on that date (with a valid membership).
 * Party and constituency come from the membership in force ON THAT DATE.
 * MPs who already have a record are always included (e.g. if membership
 * data was corrected after capture), so no record is ever hidden.
 */
export async function getRegister(
  s: Pick<Sitting, "id" | "sitting_type" | "committee_id" | "sitting_date">,
  ex: Executor = pool,
): Promise<RegisterRow[]> {
  const isCommittee = s.sitting_type === "COMMITTEE";
  const expected = await rows<RegisterRow>(
    `SELECT mp.id mp_id, mp.parliamentary_id, mp.title,
            CONCAT_WS(' ', mp.first_name, mp.other_names, mp.last_name) full_name,
            (mp.photo_path IS NOT NULL) photo,
            p.id party_id, p.abbreviation party_abbr, p.color party_color,
            c.id constituency_id, c.name constituency_name, r.name region_name,
            NULL attendance_id, NULL status, NULL arrival_time, NULL remarks, 0 pending_correction
       FROM mps mp
       JOIN mp_memberships ms ON ms.mp_id = mp.id AND ms.start_date <= ? AND (ms.end_date IS NULL OR ms.end_date >= ?)
       ${isCommittee ? "JOIN committee_members cm ON cm.mp_id = mp.id AND cm.committee_id = ? AND cm.start_date <= ? AND (cm.end_date IS NULL OR cm.end_date >= ?)" : ""}
       JOIN parties p ON p.id = ms.party_id
       JOIN constituencies c ON c.id = ms.constituency_id
       JOIN regions r ON r.id = c.region_id`,
    isCommittee
      ? [s.sitting_date, s.sitting_date, s.committee_id, s.sitting_date, s.sitting_date]
      : [s.sitting_date, s.sitting_date],
    ex,
  );

  // Recorded rows carry their own party/constituency snapshot.
  const recorded = await rows<RegisterRow>(
    `SELECT mp.id mp_id, mp.parliamentary_id, mp.title,
            CONCAT_WS(' ', mp.first_name, mp.other_names, mp.last_name) full_name,
            (mp.photo_path IS NOT NULL) photo,
            p.id party_id, p.abbreviation party_abbr, p.color party_color,
            c.id constituency_id, c.name constituency_name, r.name region_name,
            a.id attendance_id, a.status, a.arrival_time, a.remarks,
            (SELECT COUNT(*) FROM attendance_corrections ac WHERE ac.attendance_id = a.id AND ac.status = 'PENDING') pending_correction
       FROM attendance a
       JOIN mps mp ON mp.id = a.mp_id
       LEFT JOIN parties p ON p.id = a.party_id
       LEFT JOIN constituencies c ON c.id = a.constituency_id
       LEFT JOIN regions r ON r.id = c.region_id
      WHERE a.sitting_id = ?`,
    [s.id],
    ex,
  );

  const byMp = new Map<number, RegisterRow>();
  for (const e of expected) byMp.set(e.mp_id, e);
  for (const r of recorded) byMp.set(r.mp_id, { ...byMp.get(r.mp_id), ...r });
  return [...byMp.values()].sort((a, b) => (a.constituency_name ?? "").localeCompare(b.constituency_name ?? ""));
}

export const EDITABLE_REGISTER: Sitting["register_status"][] = ["NOT_STARTED", "DRAFT", "RETURNED"];
