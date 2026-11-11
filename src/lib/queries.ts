import "server-only";
import { one, rows } from "./db";

// ---------------------------------------------------------------- MPs
export type MpListItem = {
  id: number; parliamentary_id: string; title: string | null; first_name: string; other_names: string | null; last_name: string;
  full_name: string; gender: "M" | "F"; email: string | null; phone: string | null; status: string; photo: number;
  party_id: number | null; party_abbr: string | null; party_color: string | null;
  constituency_id: number | null; constituency_name: string | null; region_id: number | null; region_name: string | null;
};

export type MpFilters = { q?: string; partyId?: number; regionId?: number; constituencyId?: number; status?: string; page?: number; pageSize?: number };

export async function listMps(f: MpFilters = {}) {
  const w: string[] = ["1=1"];
  const p: unknown[] = [];
  if (f.q) {
    w.push("(mp.first_name ILIKE ? OR mp.last_name ILIKE ? OR mp.other_names ILIKE ? OR mp.parliamentary_id ILIKE ? OR c.name ILIKE ?)");
    const like = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    p.push(like, like, like, like, like);
  }
  if (f.partyId) { w.push("mp.current_party_id = ?"); p.push(f.partyId); }
  if (f.constituencyId) { w.push("mp.current_constituency_id = ?"); p.push(f.constituencyId); }
  if (f.regionId) { w.push("c.region_id = ?"); p.push(f.regionId); }
  if (f.status) { w.push("mp.status = ?"); p.push(f.status); }
  const pageSize = Math.min(f.pageSize ?? 25, 500);
  const page = Math.max(1, f.page ?? 1);
  const from = `FROM mps mp
     LEFT JOIN parties pa ON pa.id = mp.current_party_id
     LEFT JOIN constituencies c ON c.id = mp.current_constituency_id
     LEFT JOIN regions r ON r.id = c.region_id
    WHERE ${w.join(" AND ")}`;
  const [items, total] = await Promise.all([
    rows<MpListItem>(
      `SELECT mp.id, mp.parliamentary_id, mp.title, mp.first_name, mp.other_names, mp.last_name,
              CONCAT_WS(' ', mp.first_name, mp.other_names, mp.last_name) full_name,
              mp.gender, mp.email, mp.phone, mp.status, (mp.photo_path IS NOT NULL) photo,
              pa.id party_id, pa.abbreviation party_abbr, pa.color party_color,
              c.id constituency_id, c.name constituency_name, r.id region_id, r.name region_name
         ${from}
        ORDER BY mp.status = 'ACTIVE' DESC, mp.last_name, mp.first_name
        LIMIT ? OFFSET ?`,
      [...p, pageSize, (page - 1) * pageSize],
    ),
    one<{ n: number }>(`SELECT COUNT(*) n ${from}`, p),
  ]);
  return { items, total: total?.n ?? 0, page, pageSize };
}

export async function getMp(id: number) {
  const mp = await one<MpListItem & { photo_path: string | null; created_at: string; updated_at: string }>(
    `SELECT mp.*, CONCAT_WS(' ', mp.first_name, mp.other_names, mp.last_name) full_name, (mp.photo_path IS NOT NULL) photo,
            pa.id party_id, pa.abbreviation party_abbr, pa.color party_color,
            c.id constituency_id, c.name constituency_name, r.id region_id, r.name region_name
       FROM mps mp
       LEFT JOIN parties pa ON pa.id = mp.current_party_id
       LEFT JOIN constituencies c ON c.id = mp.current_constituency_id
       LEFT JOIN regions r ON r.id = c.region_id
      WHERE mp.id = ?`,
    [id],
  );
  if (!mp) return null;
  const memberships = await rows<{
    id: number; parliament: string; party: string; party_color: string; constituency: string; region: string;
    start_date: string; end_date: string | null; end_reason: string | null;
  }>(
    `SELECT ms.id, pl.name parliament, pa.abbreviation party, pa.color party_color, c.name constituency, r.name region,
            ms.start_date, ms.end_date, ms.end_reason
       FROM mp_memberships ms
       JOIN parliaments pl ON pl.id = ms.parliament_id
       JOIN parties pa ON pa.id = ms.party_id
       JOIN constituencies c ON c.id = ms.constituency_id
       JOIN regions r ON r.id = c.region_id
      WHERE ms.mp_id = ? ORDER BY ms.start_date DESC`,
    [id],
  );
  const committees = await rows<{ name: string; role: string; start_date: string; end_date: string | null }>(
    `SELECT co.name, cm.role, cm.start_date, cm.end_date FROM committee_members cm JOIN committees co ON co.id = cm.committee_id
      WHERE cm.mp_id = ? ORDER BY cm.end_date IS NULL DESC, co.name`,
    [id],
  );
  return { ...mp, memberships, committees };
}

// ---------------------------------------------------------------- reference
export const listParties = () =>
  rows<{ id: number; name: string; abbreviation: string; color: string; is_active: number; mps: number }>(
    `SELECT p.*, (SELECT COUNT(*) FROM mps WHERE current_party_id = p.id AND status='ACTIVE') mps
       FROM parties p ORDER BY p.is_active DESC, p.abbreviation`,
  );

export const listRegions = () =>
  rows<{ id: number; name: string; code: string | null; constituencies: number }>(
    `SELECT r.*, (SELECT COUNT(*) FROM constituencies WHERE region_id = r.id) constituencies FROM regions r ORDER BY r.name`,
  );

export const listConstituencies = () =>
  rows<{ id: number; name: string; code: string | null; region_id: number; region_name: string; is_active: number; member: string | null; member_id: number | null; party_abbr: string | null; party_color: string | null }>(
    `SELECT c.*, r.name region_name,
            (SELECT CONCAT_WS(' ', m.title, m.first_name, m.last_name) FROM mps m WHERE m.current_constituency_id = c.id AND m.status='ACTIVE' LIMIT 1) member,
            (SELECT m.id FROM mps m WHERE m.current_constituency_id = c.id AND m.status='ACTIVE' LIMIT 1) member_id,
            (SELECT p.abbreviation FROM mps m JOIN parties p ON p.id=m.current_party_id WHERE m.current_constituency_id = c.id AND m.status='ACTIVE' LIMIT 1) party_abbr,
            (SELECT p.color FROM mps m JOIN parties p ON p.id=m.current_party_id WHERE m.current_constituency_id = c.id AND m.status='ACTIVE' LIMIT 1) party_color
       FROM constituencies c JOIN regions r ON r.id = c.region_id
      ORDER BY r.name, c.name`,
  );

// ---------------------------------------------------------------- calendar
export async function getCalendar() {
  const [parliaments, sessions, meetings, committees] = await Promise.all([
    rows<{ id: number; number: number; name: string; start_date: string; end_date: string | null; is_current: number }>(
      "SELECT * FROM parliaments ORDER BY number DESC",
    ),
    rows<{ id: number; parliament_id: number; number: number; name: string; start_date: string; end_date: string | null; parliament_name: string }>(
      "SELECT ps.*, pl.name parliament_name FROM parliament_sessions ps JOIN parliaments pl ON pl.id = ps.parliament_id ORDER BY ps.start_date DESC",
    ),
    rows<{ id: number; session_id: number; number: number; name: string; start_date: string; end_date: string | null; session_name: string; sittings: number }>(
      `SELECT m.*, ps.name session_name, (SELECT COUNT(*) FROM sittings s WHERE s.meeting_id = m.id) sittings
         FROM meetings m JOIN parliament_sessions ps ON ps.id = m.session_id ORDER BY m.start_date DESC`,
    ),
    rows<{ id: number; name: string; type: string; is_active: number; members: number; chair: string | null }>(
      `SELECT co.*, (SELECT COUNT(*) FROM committee_members cm WHERE cm.committee_id = co.id AND cm.end_date IS NULL) members,
              (SELECT CONCAT_WS(' ', m.title, m.first_name, m.last_name) FROM committee_members cm JOIN mps m ON m.id = cm.mp_id
                WHERE cm.committee_id = co.id AND cm.role='CHAIR' AND cm.end_date IS NULL LIMIT 1) chair
         FROM committees co ORDER BY co.is_active DESC, co.name`,
    ),
  ]);
  return { parliaments, sessions, meetings, committees };
}

export const getCommitteeMembers = (committeeId: number) =>
  rows<{ mp_id: number; role: string; start_date: string; name: string; party: string | null; constituency: string | null }>(
    `SELECT cm.mp_id, cm.role, cm.start_date, CONCAT_WS(' ', m.title, m.first_name, m.last_name) name,
            p.abbreviation party, c.name constituency
       FROM committee_members cm JOIN mps m ON m.id = cm.mp_id
       LEFT JOIN parties p ON p.id = m.current_party_id LEFT JOIN constituencies c ON c.id = m.current_constituency_id
      WHERE cm.committee_id = ? AND cm.end_date IS NULL ORDER BY array_position(ARRAY['CHAIR','VICE_CHAIR','RANKING','MEMBER']::varchar[], cm.role), m.last_name`,
    [committeeId],
  );

// ---------------------------------------------------------------- sittings
export type SittingListItem = {
  id: number; title: string; sitting_date: string; start_time: string; end_time: string | null; venue: string | null;
  sitting_type: string; status: string; register_status: string; meeting_name: string | null; session_name: string | null;
  committee_name: string | null; recorded: number; attended: number;
};

export type SittingFilters = { from?: string; to?: string; type?: string; registerStatus?: string; meetingId?: number; q?: string; page?: number; pageSize?: number };

export async function listSittings(f: SittingFilters = {}) {
  const w = ["1=1"];
  const p: unknown[] = [];
  if (f.from) { w.push("s.sitting_date >= ?"); p.push(f.from); }
  if (f.to) { w.push("s.sitting_date <= ?"); p.push(f.to); }
  if (f.type) { w.push("s.sitting_type = ?"); p.push(f.type); }
  if (f.registerStatus) { w.push("s.register_status = ?"); p.push(f.registerStatus); }
  if (f.meetingId) { w.push("s.meeting_id = ?"); p.push(f.meetingId); }
  if (f.q) { w.push("(s.title ILIKE ? OR co.name ILIKE ?)"); const l = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`; p.push(l, l); }
  const pageSize = Math.min(f.pageSize ?? 25, 200);
  const page = Math.max(1, f.page ?? 1);
  const from = `FROM sittings s
     LEFT JOIN meetings m ON m.id = s.meeting_id
     LEFT JOIN parliament_sessions ps ON ps.id = m.session_id
     LEFT JOIN committees co ON co.id = s.committee_id
    WHERE ${w.join(" AND ")}`;
  const [items, total] = await Promise.all([
    rows<SittingListItem>(
      `SELECT s.id, s.title, s.sitting_date, s.start_time, s.end_time, s.venue, s.sitting_type, s.status, s.register_status,
              m.name meeting_name, ps.name session_name, co.name committee_name,
              (SELECT COUNT(*) FROM attendance a WHERE a.sitting_id = s.id) recorded,
              (SELECT COUNT(*) FROM attendance a WHERE a.sitting_id = s.id AND a.status IN ('PRESENT','LATE','OFFICIAL_DUTY')) attended
         ${from}
        ORDER BY s.sitting_date DESC, s.start_time DESC LIMIT ? OFFSET ?`,
      [...p, pageSize, (page - 1) * pageSize],
    ),
    one<{ n: number }>(`SELECT COUNT(*) n ${from}`, p),
  ]);
  return { items, total: total?.n ?? 0, page, pageSize };
}

// ---------------------------------------------------------------- approvals
export const listSubmittedRegisters = () =>
  rows<{ id: number; title: string; sitting_date: string; sitting_type: string; committee_name: string | null; submitted_at: string; submitted_by_name: string | null; submitted_by: number | null; recorded: number; present: number; absent: number }>(
    `SELECT s.id, s.title, s.sitting_date, s.sitting_type, co.name committee_name, s.submitted_at, s.submitted_by, u.full_name submitted_by_name,
            (SELECT COUNT(*) FROM attendance a WHERE a.sitting_id = s.id) recorded,
            (SELECT COUNT(*) FROM attendance a WHERE a.sitting_id = s.id AND a.status IN ('PRESENT','LATE')) present,
            (SELECT COUNT(*) FROM attendance a WHERE a.sitting_id = s.id AND a.status = 'ABSENT') absent
       FROM sittings s LEFT JOIN committees co ON co.id = s.committee_id LEFT JOIN users u ON u.id = s.submitted_by
      WHERE s.register_status = 'SUBMITTED' ORDER BY s.sitting_date, s.start_time`,
  );

export const listCorrections = (status = "PENDING") =>
  rows<{
    id: number; attendance_id: number; old_status: string; new_status: string; old_remarks: string | null; new_remarks: string | null;
    reason: string; status: string; requested_at: string; requested_by: number | null; requested_by_name: string | null;
    reviewed_at: string | null; reviewed_by_name: string | null; review_comment: string | null;
    mp_name: string; mp_id: number; sitting_id: number; sitting_title: string; sitting_date: string;
  }>(
    `SELECT ac.*, ru.full_name requested_by_name, vu.full_name reviewed_by_name,
            CONCAT_WS(' ', m.title, m.first_name, m.last_name) mp_name, m.id mp_id,
            s.id sitting_id, s.title sitting_title, s.sitting_date
       FROM attendance_corrections ac
       JOIN attendance a ON a.id = ac.attendance_id
       JOIN mps m ON m.id = a.mp_id
       JOIN sittings s ON s.id = a.sitting_id
       LEFT JOIN users ru ON ru.id = ac.requested_by
       LEFT JOIN users vu ON vu.id = ac.reviewed_by
      WHERE (?::text = 'ALL' OR ac.status = ?)
      ORDER BY ac.requested_at DESC LIMIT 200`,
    [status, status],
  );

// ---------------------------------------------------------------- users & audit
export const listUsers = () =>
  rows<{ id: number; username: string; email: string; full_name: string; role_code: string; role_name: string; is_active: number; must_change_password: number; locked: number; last_login_at: string | null; created_at: string; active_sessions: number }>(
    `SELECT u.id, u.username, u.email, u.full_name, r.code role_code, r.name role_name, u.is_active, u.must_change_password,
            (u.locked_until IS NOT NULL AND u.locked_until > LOCALTIMESTAMP) locked, u.last_login_at, u.created_at,
            (SELECT COUNT(*) FROM user_sessions us WHERE us.user_id = u.id AND us.revoked_at IS NULL AND us.expires_at > LOCALTIMESTAMP) active_sessions
       FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.is_active DESC, u.full_name`,
  );

export type AuditFilters = { q?: string; action?: string; entityType?: string; userId?: number; from?: string; to?: string; page?: number; pageSize?: number };

export async function listAudit(f: AuditFilters = {}) {
  const w = ["1=1"];
  const p: unknown[] = [];
  if (f.q) { w.push("(summary ILIKE ? OR username ILIKE ? OR entity_id = ?)"); const l = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`; p.push(l, l, f.q); }
  if (f.action) { w.push("action = ?"); p.push(f.action); }
  if (f.entityType) { w.push("entity_type = ?"); p.push(f.entityType); }
  if (f.userId) { w.push("user_id = ?"); p.push(f.userId); }
  if (f.from) { w.push("created_at >= ?"); p.push(`${f.from} 00:00:00`); }
  if (f.to) { w.push("created_at <= ?"); p.push(`${f.to} 23:59:59.999`); }
  const pageSize = Math.min(f.pageSize ?? 50, 1000);
  const page = Math.max(1, f.page ?? 1);
  const where = w.join(" AND ");
  const [items, total, actions, entities] = await Promise.all([
    rows<{ id: number; user_id: number | null; username: string | null; action: string; entity_type: string; entity_id: string | null; summary: string; before_data: unknown; after_data: unknown; ip_address: string | null; user_agent: string | null; created_at: string }>(
      `SELECT * FROM audit_logs WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...p, pageSize, (page - 1) * pageSize],
    ),
    one<{ n: number }>(`SELECT COUNT(*) n FROM audit_logs WHERE ${where}`, p),
    rows<{ action: string }>("SELECT DISTINCT action FROM audit_logs ORDER BY action"),
    rows<{ entity_type: string }>("SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type"),
  ]);
  return { items, total: total?.n ?? 0, page, pageSize, actions: actions.map((a) => a.action), entities: entities.map((e) => e.entity_type) };
}
