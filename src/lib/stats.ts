import "server-only";
import { one, rows } from "./db";
import { getSettings } from "./settings";

/**
 * Attendance metrics are computed only from APPROVED registers, so figures
 * never move until a reviewer has signed off.
 *
 *   expected  = attendance records for the sittings in scope
 *   attended  = PRESENT + LATE (+ OFFICIAL_DUTY when that setting is on)
 *   rate      = attended / expected
 *   unexcused = ABSENT only (EXCUSED = absent with the Speaker's permission)
 */
export type Agg = {
  expected: number;
  attended: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  official: number;
  sittings: number;
};

export async function attendedSql() {
  const s = await getSettings();
  return s.count_official_duty_present ? "a.status IN ('PRESENT','LATE','OFFICIAL_DUTY')" : "a.status IN ('PRESENT','LATE')";
}

export async function aggSelect() {
  const att = await attendedSql();
  return `COUNT(a.id) expected,
          COUNT(a.id) FILTER (WHERE ${att}) attended,
          COUNT(a.id) FILTER (WHERE a.status='PRESENT') present,
          COUNT(a.id) FILTER (WHERE a.status='LATE') late,
          COUNT(a.id) FILTER (WHERE a.status='ABSENT') absent,
          COUNT(a.id) FILTER (WHERE a.status='EXCUSED') excused,
          COUNT(a.id) FILTER (WHERE a.status='OFFICIAL_DUTY') official,
          COUNT(DISTINCT s.id) sittings`;
}

export const rate = (a: Pick<Agg, "attended" | "expected">) => (a.expected ? a.attended / a.expected : 0);

export type Filters = {
  from?: string | null;
  to?: string | null;
  partyId?: number | null;
  constituencyId?: number | null;
  regionId?: number | null;
  mpId?: number | null;
  sittingId?: number | null;
  sittingType?: "PLENARY" | "COMMITTEE" | "OTHER" | null;
};

/** Builds a WHERE clause over `sittings s` + `attendance a` (+ `constituencies c` when filtering region). */
export function whereFor(f: Filters) {
  const w = ["s.register_status = 'APPROVED'"];
  const p: unknown[] = [];
  if (f.from) { w.push("s.sitting_date >= ?"); p.push(f.from); }
  if (f.to) { w.push("s.sitting_date <= ?"); p.push(f.to); }
  if (f.partyId) { w.push("a.party_id = ?"); p.push(f.partyId); }
  if (f.constituencyId) { w.push("a.constituency_id = ?"); p.push(f.constituencyId); }
  if (f.regionId) { w.push("a.constituency_id IN (SELECT id FROM constituencies WHERE region_id = ?)"); p.push(f.regionId); }
  if (f.mpId) { w.push("a.mp_id = ?"); p.push(f.mpId); }
  if (f.sittingId) { w.push("s.id = ?"); p.push(f.sittingId); }
  if (f.sittingType) { w.push("s.sitting_type = ?"); p.push(f.sittingType); }
  return { sql: w.join(" AND "), params: p };
}

export async function aggregate(f: Filters): Promise<Agg> {
  const { sql, params } = whereFor(f);
  return (await one<Agg>(
    `SELECT ${await aggSelect()} FROM attendance a JOIN sittings s ON s.id = a.sitting_id WHERE ${sql}`,
    params,
  ))!;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function getDashboard(rangeDays: number) {
  const settings = await getSettings();
  const today = new Date();
  const to = iso(today);
  const from = iso(new Date(today.getTime() - rangeDays * 86400000));
  const prevFrom = iso(new Date(today.getTime() - 2 * rangeDays * 86400000));
  const prevTo = iso(new Date(today.getTime() - (rangeDays + 1) * 86400000));
  const sel = await aggSelect();
  const range = { from, to, sittingType: "PLENARY" as const };

  const [totals, latest, current, previous, trend, byParty, byRegion, byConstituency, mpRanks, statusMix, yoy, pending] =
    await Promise.all([
      one<{ active: number; female: number; total: number }>(
        "SELECT COUNT(*) FILTER (WHERE status='ACTIVE') active, COUNT(*) FILTER (WHERE status='ACTIVE' AND gender='F') female, COUNT(*) total FROM mps",
      ),
      one<{ id: number; title: string; sitting_date: string; register_status: string }>(
        `SELECT id, title, sitting_date, register_status FROM sittings
          WHERE sitting_type='PLENARY' AND register_status IN ('SUBMITTED','APPROVED')
          ORDER BY sitting_date DESC, start_time DESC LIMIT 1`,
      ),
      aggregate(range),
      aggregate({ from: prevFrom, to: prevTo, sittingType: "PLENARY" }),
      rows<{ id: number; sitting_date: string; title: string } & Agg>(
        `SELECT * FROM (
           SELECT s.id, s.sitting_date, s.title, ${sel}
             FROM attendance a JOIN sittings s ON s.id = a.sitting_id
            WHERE ${whereFor(range).sql}
            GROUP BY s.id, s.sitting_date, s.title
            ORDER BY s.sitting_date DESC LIMIT 40) t
         ORDER BY sitting_date`,
        whereFor(range).params,
      ),
      rows<{ id: number; abbreviation: string; name: string; color: string } & Agg>(
        `SELECT p.id, p.abbreviation, p.name, p.color, ${sel}
           FROM attendance a JOIN sittings s ON s.id = a.sitting_id JOIN parties p ON p.id = a.party_id
          WHERE ${whereFor(range).sql}
          GROUP BY p.id, p.abbreviation, p.name, p.color ORDER BY expected DESC`,
        whereFor(range).params,
      ),
      rows<{ id: number; name: string } & Agg>(
        `SELECT r.id, r.name, ${sel}
           FROM attendance a JOIN sittings s ON s.id = a.sitting_id
           JOIN constituencies c ON c.id = a.constituency_id JOIN regions r ON r.id = c.region_id
          WHERE ${whereFor(range).sql}
          GROUP BY r.id, r.name`,
        whereFor(range).params,
      ),
      rows<{ id: number; name: string; region: string } & Agg>(
        `SELECT c.id, c.name, r.name region, ${sel}
           FROM attendance a JOIN sittings s ON s.id = a.sitting_id
           JOIN constituencies c ON c.id = a.constituency_id JOIN regions r ON r.id = c.region_id
          WHERE ${whereFor(range).sql}
          GROUP BY c.id, c.name, r.name`,
        whereFor(range).params,
      ),
      rows<{ id: number; name: string; parliamentary_id: string; party: string; party_color: string; constituency: string; photo: number } & Agg>(
        `SELECT mp.id, CONCAT_WS(' ', mp.title, mp.first_name, mp.last_name) name, mp.parliamentary_id,
                p.abbreviation party, p.color party_color, c.name constituency, (mp.photo_path IS NOT NULL) photo, ${sel}
           FROM attendance a JOIN sittings s ON s.id = a.sitting_id JOIN mps mp ON mp.id = a.mp_id
           LEFT JOIN parties p ON p.id = mp.current_party_id
           LEFT JOIN constituencies c ON c.id = mp.current_constituency_id
          WHERE ${whereFor(range).sql} AND mp.status = 'ACTIVE'
          GROUP BY mp.id, mp.title, mp.first_name, mp.last_name, mp.parliamentary_id, mp.photo_path, p.abbreviation, p.color, c.name
         HAVING COUNT(a.id) >= 3`,
        whereFor(range).params,
      ),
      aggregate({ from, to }),
      rows<{ yr: number; mo: number } & Agg>(
        `SELECT EXTRACT(YEAR FROM s.sitting_date)::int yr, EXTRACT(MONTH FROM s.sitting_date)::int mo, ${sel}
           FROM attendance a JOIN sittings s ON s.id = a.sitting_id
          WHERE s.register_status='APPROVED' AND s.sitting_type='PLENARY'
            AND s.sitting_date >= make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int - 1, 1, 1)
          GROUP BY yr, mo ORDER BY yr, mo`,
      ),
      one<{ submitted: number; returned: number; corrections: number; draft: number; overdue: number }>(
        `SELECT
           (SELECT COUNT(*) FROM sittings WHERE register_status='SUBMITTED') submitted,
           (SELECT COUNT(*) FROM sittings WHERE register_status='RETURNED') returned,
           (SELECT COUNT(*) FROM sittings WHERE register_status='DRAFT') draft,
           (SELECT COUNT(*) FROM attendance_corrections WHERE status='PENDING') corrections,
           (SELECT COUNT(*) FROM sittings WHERE sitting_date < CURRENT_DATE AND status IN ('SCHEDULED','HELD')
              AND register_status='NOT_STARTED') overdue`,
      ),
    ]);

  // Latest sitting snapshot (includes a SUBMITTED register so today's picture is visible early)
  let latestAgg: Agg | null = null;
  if (latest) {
    latestAgg = await one<Agg>(
      `SELECT ${sel} FROM attendance a JOIN sittings s ON s.id = a.sitting_id WHERE s.id = ?`,
      [latest.id],
    );
  }

  // Watch-list: unexcused absences in the current (or most recent) meeting vs the constitutional threshold
  const meeting = await one<{ id: number; name: string; session_name: string }>(
    `SELECT m.id, m.name, ps.name session_name FROM meetings m JOIN parliament_sessions ps ON ps.id = m.session_id
      WHERE m.start_date <= CURRENT_DATE ORDER BY m.start_date DESC LIMIT 1`,
  );
  const watch = meeting
    ? await rows<{ id: number; name: string; constituency: string; party: string; party_color: string; unexcused: number }>(
        `SELECT mp.id, CONCAT_WS(' ', mp.title, mp.first_name, mp.last_name) name, c.name constituency,
                p.abbreviation party, p.color party_color, COUNT(*) unexcused
           FROM attendance a JOIN sittings s ON s.id = a.sitting_id JOIN mps mp ON mp.id = a.mp_id
           LEFT JOIN constituencies c ON c.id = mp.current_constituency_id
           LEFT JOIN parties p ON p.id = mp.current_party_id
          WHERE s.meeting_id = ? AND s.sitting_type='PLENARY' AND s.register_status='APPROVED' AND a.status='ABSENT'
          GROUP BY mp.id, mp.title, mp.first_name, mp.last_name, c.name, p.abbreviation, p.color
         HAVING COUNT(*) >= ?
          ORDER BY unexcused DESC LIMIT 8`,
        [meeting.id, Math.max(1, Math.floor(settings.absence_alert_threshold / 3))],
      )
    : [];

  const thisYear = today.getUTCFullYear();
  const months = Array.from({ length: 12 }, (_, i) => {
    const cur = yoy.find((r) => r.yr === thisYear && r.mo === i + 1);
    const prev = yoy.find((r) => r.yr === thisYear - 1 && r.mo === i + 1);
    return {
      month: new Date(Date.UTC(2000, i, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" }),
      current: cur ? +(rate(cur) * 100).toFixed(1) : null,
      previous: prev ? +(rate(prev) * 100).toFixed(1) : null,
    };
  });

  const ranked = [...mpRanks].sort((a, b) => rate(b) - rate(a));
  const constRanked = [...byConstituency].sort((a, b) => rate(b) - rate(a));

  return {
    settings,
    range: { from, to, days: rangeDays },
    totals: totals ?? { active: 0, female: 0, total: 0 },
    latest: latest && latestAgg ? { ...latest, ...latestAgg } : null,
    current,
    previous,
    trend: trend.map((t) => ({ id: t.id, date: t.sitting_date, title: t.title, rate: +(rate(t) * 100).toFixed(1), attended: t.attended, absent: t.absent + t.excused })),
    byParty: byParty.map((p) => ({ ...p, rate: +(rate(p) * 100).toFixed(1) })),
    byRegion: byRegion.map((r) => ({ ...r, rate: +(rate(r) * 100).toFixed(1) })).sort((a, b) => b.rate - a.rate),
    topConstituencies: constRanked.slice(0, 5).map((c) => ({ ...c, rate: rate(c) })),
    bottomConstituencies: constRanked.slice(-5).reverse().map((c) => ({ ...c, rate: rate(c) })),
    topMps: ranked.slice(0, 5).map((m) => ({ ...m, rate: rate(m) })),
    bottomMps: ranked.slice(-5).reverse().map((m) => ({ ...m, rate: rate(m) })),
    statusMix,
    months,
    thisYear,
    pending: pending ?? { submitted: 0, returned: 0, corrections: 0, draft: 0, overdue: 0 },
    meeting,
    watch,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/** Per-MP statistics used on the MP profile page. */
export async function getMpStats(mpId: number) {
  const sel = await aggSelect();
  const [overall, plenary, committee, monthly, recent] = await Promise.all([
    aggregate({ mpId }),
    aggregate({ mpId, sittingType: "PLENARY" }),
    aggregate({ mpId, sittingType: "COMMITTEE" }),
    rows<{ ym: string } & Agg>(
      `SELECT to_char(s.sitting_date, 'YYYY-MM') ym, ${sel}
         FROM attendance a JOIN sittings s ON s.id = a.sitting_id
        WHERE s.register_status='APPROVED' AND a.mp_id = ?
        GROUP BY ym ORDER BY ym DESC LIMIT 18`,
      [mpId],
    ),
    rows<{ sitting_id: number; sitting_date: string; title: string; sitting_type: string; status: string; arrival_time: string | null; remarks: string | null; register_status: string }>(
      `SELECT s.id sitting_id, s.sitting_date, s.title, s.sitting_type, a.status, a.arrival_time, a.remarks, s.register_status
         FROM attendance a JOIN sittings s ON s.id = a.sitting_id
        WHERE a.mp_id = ? ORDER BY s.sitting_date DESC, s.start_time DESC LIMIT 25`,
      [mpId],
    ),
  ]);
  return {
    overall, plenary, committee, recent,
    monthly: monthly.reverse().map((m) => ({ month: m.ym, rate: +(rate(m) * 100).toFixed(1), attended: m.attended, expected: m.expected })),
  };
}
