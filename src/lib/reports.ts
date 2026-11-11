import "server-only";
import { one, rows } from "./db";
import { aggSelect, rate, whereFor, type Agg } from "./stats";
import type { ReportFilters, ReportType } from "./validation";

export type Column = { key: string; label: string; align?: "left" | "right" | "center"; kind?: "percent" | "number" | "text" | "date" };
export type ReportData = {
  title: string;
  subtitle: string;
  columns: Column[];
  rows: Record<string, string | number | null>[];
  summary: { label: string; value: string }[];
};

export const REPORT_LABELS: Record<ReportType, string> = {
  daily: "Daily attendance",
  weekly: "Weekly attendance",
  monthly: "Monthly attendance",
  quarterly: "Quarterly attendance",
  annual: "Annual attendance",
  mp: "Individual MP attendance",
  party: "Political party attendance",
  constituency: "Constituency attendance",
  region: "Regional attendance",
  sitting: "Parliamentary sitting attendance",
};

// Fixed allow-list of GROUP BY expressions — never derived from user input
const PERIOD: Record<string, { key: string; label: string }> = {
  daily: { key: "to_char(s.sitting_date, 'YYYY-MM-DD')", label: "Date" },
  weekly: { key: "to_char(s.sitting_date, 'IYYY-\"W\"IW')", label: "ISO week" },
  monthly: { key: "to_char(s.sitting_date, 'YYYY-MM')", label: "Month" },
  quarterly: { key: "to_char(s.sitting_date, 'YYYY-\"Q\"Q')", label: "Quarter" },
  annual: { key: "to_char(s.sitting_date, 'YYYY')", label: "Year" },
};

const AGG_COLUMNS: Column[] = [
  { key: "sittings", label: "Sittings", align: "right", kind: "number" },
  { key: "expected", label: "Expected", align: "right", kind: "number" },
  { key: "attended", label: "Attended", align: "right", kind: "number" },
  { key: "late", label: "Late", align: "right", kind: "number" },
  { key: "absent", label: "Absent", align: "right", kind: "number" },
  { key: "excused", label: "Excused", align: "right", kind: "number" },
  { key: "official", label: "Official duty", align: "right", kind: "number" },
  { key: "rate", label: "Attendance", align: "right", kind: "percent" },
];

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "Present", LATE: "Late", ABSENT: "Absent", EXCUSED: "Excused", OFFICIAL_DUTY: "Official duty",
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const withRate = <T extends Agg>(r: T) => ({ ...r, rate: rate(r) });

async function describeFilters(f: ReportFilters) {
  const parts: string[] = [];
  if (f.from || f.to) parts.push(`${f.from ?? "start"} to ${f.to ?? "today"}`);
  if (f.sittingType) parts.push(`${f.sittingType.toLowerCase()} sittings`);
  if (f.partyId) parts.push(`Party: ${(await one<{ n: string }>("SELECT abbreviation n FROM parties WHERE id=?", [f.partyId]))?.n ?? "?"}`);
  if (f.regionId) parts.push(`Region: ${(await one<{ n: string }>("SELECT name n FROM regions WHERE id=?", [f.regionId]))?.n ?? "?"}`);
  if (f.constituencyId) parts.push(`Constituency: ${(await one<{ n: string }>("SELECT name n FROM constituencies WHERE id=?", [f.constituencyId]))?.n ?? "?"}`);
  return parts.length ? parts.join(" · ") : "All approved registers";
}

function totalsSummary(list: Agg[]): ReportData["summary"] {
  const t = list.reduce(
    (a, r) => ({ expected: a.expected + r.expected, attended: a.attended + r.attended, absent: a.absent + r.absent, excused: a.excused + r.excused }),
    { expected: 0, attended: 0, absent: 0, excused: 0 },
  );
  return [
    { label: "Expected attendances", value: t.expected.toLocaleString("en-GB") },
    { label: "Attended", value: t.attended.toLocaleString("en-GB") },
    { label: "Unexcused absences", value: t.absent.toLocaleString("en-GB") },
    { label: "Overall attendance", value: pct(t.expected ? t.attended / t.expected : 0) },
  ];
}

export async function buildReport(f: ReportFilters): Promise<ReportData> {
  const sel = await aggSelect();
  const { sql, params } = whereFor(f);
  const base = `FROM attendance a JOIN sittings s ON s.id = a.sitting_id`;
  const subtitle = await describeFilters(f);
  const title = REPORT_LABELS[f.type];

  // ---- Period reports ------------------------------------------------------
  if (f.type in PERIOD) {
    const p = PERIOD[f.type];
    const list = await rows<{ period: string } & Agg>(
      `SELECT ${p.key} period, ${sel} ${base} WHERE ${sql} GROUP BY period ORDER BY period DESC LIMIT 1000`,
      params,
    );
    return {
      title, subtitle,
      columns: [{ key: "period", label: p.label }, ...AGG_COLUMNS],
      rows: list.map(withRate),
      summary: totalsSummary(list),
    };
  }

  // ---- Individual MP --------------------------------------------------------
  if (f.type === "mp") {
    if (f.mpId) {
      const mp = await one<{ name: string; parliamentary_id: string }>(
        "SELECT CONCAT_WS(' ', title, first_name, other_names, last_name) name, parliamentary_id FROM mps WHERE id=?",
        [f.mpId],
      );
      const list = await rows<Record<string, string | null>>(
        `SELECT s.sitting_date, s.title sitting, s.sitting_type, a.status, a.arrival_time, a.remarks,
                p.abbreviation party, c.name constituency
           ${base} LEFT JOIN parties p ON p.id = a.party_id LEFT JOIN constituencies c ON c.id = a.constituency_id
          WHERE ${sql} ORDER BY s.sitting_date DESC, s.start_time DESC LIMIT 2000`,
        params,
      );
      const agg = await one<Agg>(`SELECT ${sel} ${base} WHERE ${sql}`, params);
      return {
        title: `${title} — ${mp?.name ?? "Unknown"} (${mp?.parliamentary_id ?? ""})`,
        subtitle,
        columns: [
          { key: "sitting_date", label: "Date", kind: "date" },
          { key: "sitting", label: "Sitting" },
          { key: "sitting_type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "arrival_time", label: "Arrival" },
          { key: "party", label: "Party" },
          { key: "remarks", label: "Remarks" },
        ],
        rows: list.map((r) => ({ ...r, status: STATUS_LABEL[r.status ?? ""] ?? r.status, sitting_type: (r.sitting_type ?? "").toLowerCase(), arrival_time: r.arrival_time?.slice(0, 5) ?? "" })),
        summary: agg ? totalsSummary([agg]).concat([{ label: "Excused", value: String(agg.excused) }]) : [],
      };
    }
    const list = await rows<{ name: string; parliamentary_id: string; party: string; constituency: string; region: string } & Agg>(
      `SELECT CONCAT_WS(' ', mp.title, mp.first_name, mp.last_name) name, mp.parliamentary_id,
              p.abbreviation party, c.name constituency, r.name region, ${sel}
         ${base} JOIN mps mp ON mp.id = a.mp_id
         LEFT JOIN parties p ON p.id = mp.current_party_id
         LEFT JOIN constituencies c ON c.id = mp.current_constituency_id
         LEFT JOIN regions r ON r.id = c.region_id
        WHERE ${sql}
        GROUP BY mp.id, mp.title, mp.first_name, mp.last_name, mp.parliamentary_id, p.abbreviation, c.name, r.name
        ORDER BY mp.last_name, mp.first_name`,
      params,
    );
    return {
      title, subtitle,
      columns: [
        { key: "parliamentary_id", label: "ID" },
        { key: "name", label: "Member" },
        { key: "party", label: "Party" },
        { key: "constituency", label: "Constituency" },
        ...AGG_COLUMNS.filter((c) => c.key !== "expected"),
      ],
      rows: list.map(withRate),
      summary: totalsSummary(list),
    };
  }

  // ---- Grouped reports -----------------------------------------------------
  if (f.type === "party") {
    const list = await rows<{ party: string; name: string } & Agg>(
      `SELECT p.abbreviation party, p.name, COUNT(DISTINCT a.mp_id) members, ${sel}
         ${base} JOIN parties p ON p.id = a.party_id WHERE ${sql}
        GROUP BY p.id, p.abbreviation, p.name ORDER BY p.abbreviation`,
      params,
    );
    return {
      title, subtitle,
      columns: [{ key: "party", label: "Party" }, { key: "name", label: "Name" }, { key: "members", label: "Members", align: "right", kind: "number" }, ...AGG_COLUMNS],
      rows: list.map(withRate),
      summary: totalsSummary(list),
    };
  }

  if (f.type === "constituency") {
    const list = await rows<{ constituency: string; region: string; member: string } & Agg>(
      `SELECT c.name constituency, r.name region,
              (SELECT CONCAT_WS(' ', m2.title, m2.first_name, m2.last_name) FROM mps m2
                WHERE m2.current_constituency_id = c.id AND m2.status='ACTIVE' LIMIT 1) member,
              ${sel}
         ${base} JOIN constituencies c ON c.id = a.constituency_id JOIN regions r ON r.id = c.region_id
        WHERE ${sql}
        GROUP BY c.id, c.name, r.name ORDER BY r.name, c.name`,
      params,
    );
    return {
      title, subtitle,
      columns: [{ key: "constituency", label: "Constituency" }, { key: "region", label: "Region" }, { key: "member", label: "Current member" }, ...AGG_COLUMNS],
      rows: list.map(withRate),
      summary: totalsSummary(list),
    };
  }

  if (f.type === "region") {
    const list = await rows<{ region: string } & Agg>(
      `SELECT r.name region, COUNT(DISTINCT a.constituency_id) constituencies, ${sel}
         ${base} JOIN constituencies c ON c.id = a.constituency_id JOIN regions r ON r.id = c.region_id
        WHERE ${sql} GROUP BY r.id, r.name ORDER BY r.name`,
      params,
    );
    return {
      title, subtitle,
      columns: [{ key: "region", label: "Region" }, { key: "constituencies", label: "Constituencies", align: "right", kind: "number" }, ...AGG_COLUMNS],
      rows: list.map(withRate),
      summary: totalsSummary(list),
    };
  }

  // ---- Sitting -------------------------------------------------------------
  if (f.sittingId) {
    const s = await one<{ title: string; sitting_date: string; start_time: string; venue: string | null }>(
      "SELECT title, sitting_date, start_time, venue FROM sittings WHERE id=?",
      [f.sittingId],
    );
    const list = await rows<Record<string, string | null>>(
      `SELECT mp.parliamentary_id, CONCAT_WS(' ', mp.title, mp.first_name, mp.other_names, mp.last_name) name,
              p.abbreviation party, c.name constituency, a.status, a.arrival_time, a.remarks
         ${base} JOIN mps mp ON mp.id = a.mp_id
         LEFT JOIN parties p ON p.id = a.party_id LEFT JOIN constituencies c ON c.id = a.constituency_id
        WHERE ${sql} ORDER BY c.name`,
      params,
    );
    const agg = await one<Agg>(`SELECT ${sel} ${base} WHERE ${sql}`, params);
    return {
      title: `${s?.title ?? "Sitting"} — ${s?.sitting_date ?? ""}`,
      subtitle: `${s?.venue ?? ""} · starts ${s?.start_time?.slice(0, 5) ?? ""}`,
      columns: [
        { key: "parliamentary_id", label: "ID" },
        { key: "name", label: "Member" },
        { key: "party", label: "Party" },
        { key: "constituency", label: "Constituency" },
        { key: "status", label: "Status" },
        { key: "arrival_time", label: "Arrival" },
        { key: "remarks", label: "Remarks" },
      ],
      rows: list.map((r) => ({ ...r, status: STATUS_LABEL[r.status ?? ""] ?? r.status, arrival_time: r.arrival_time?.slice(0, 5) ?? "" })),
      summary: agg ? totalsSummary([agg]) : [],
    };
  }
  const list = await rows<{ sitting_date: string; title: string; sitting_type: string } & Agg>(
    `SELECT s.sitting_date, s.title, LOWER(s.sitting_type) sitting_type, ${sel}
       ${base} WHERE ${sql}
      GROUP BY s.id, s.sitting_date, s.title, s.sitting_type ORDER BY s.sitting_date DESC, s.start_time DESC LIMIT 1000`,
    params,
  );
  return {
    title, subtitle,
    columns: [
      { key: "sitting_date", label: "Date", kind: "date" },
      { key: "title", label: "Sitting" },
      { key: "sitting_type", label: "Type" },
      ...AGG_COLUMNS.filter((c) => c.key !== "sittings"),
    ],
    rows: list.map(withRate),
    summary: totalsSummary(list),
  };
}
