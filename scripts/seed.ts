/**
 * DEMONSTRATION DATA ONLY.
 * Regions and constituency names are real; every MP name, parliamentary ID,
 * party allocation, sitting date and attendance record is FICTIONAL and
 * randomly generated. Never run this against the production database —
 * load the real roster with the CSV import on the Members page instead.
 *
 *   npm run db:seed            (wipes and reloads demo data)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectionConfig, execOn, pg, rowsOn } from "../src/lib/sql";

// ---------- deterministic PRNG so every demo install looks the same ----------
let seed = 20250107;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

const REGIONS: Record<string, string[]> = {
  "Greater Accra": ["Ablekuma North", "Ablekuma South", "Ayawaso West Wuogon", "Ayawaso Central", "Odododiodio", "Okaikwei Central", "Klottey Korle", "Dade Kotopon", "Tema East", "Tema West", "Ashaiman", "Madina", "Adenta", "Weija-Gbawe", "Krowor", "Ledzokuku"],
  Ashanti: ["Bantama", "Manhyia South", "Manhyia North", "Subin", "Asawase", "Kwadaso", "Oforikrom", "Suame", "Ejura-Sekyedumase", "Obuasi West", "Obuasi East", "Bekwai"],
  Western: ["Sekondi", "Takoradi", "Essikado-Ketan", "Tarkwa-Nsuaem", "Prestea-Huni Valley"],
  Central: ["Cape Coast North", "Cape Coast South", "Komenda-Edina-Eguafo-Abirem", "Awutu Senya East", "Effutu"],
  Eastern: ["New Juaben South", "New Juaben North", "Akim Oda", "Abuakwa South", "Nkawkaw"],
  Volta: ["Ho Central", "Ho West", "Keta", "Ketu South", "Hohoe"],
  Northern: ["Tamale Central", "Tamale South", "Tamale North", "Yendi", "Savelugu"],
  "Upper East": ["Bolgatanga Central", "Bawku Central", "Navrongo Central"],
  "Upper West": ["Wa Central", "Wa West", "Lawra"],
  Bono: ["Sunyani East", "Sunyani West", "Wenchi", "Berekum East"],
  "Bono East": ["Techiman South", "Kintampo North", "Atebubu-Amantin"],
  Ahafo: ["Asunafo North", "Tano South"],
  "Western North": ["Sefwi Wiawso", "Bibiani-Anhwiaso-Bekwai"],
  Oti: ["Krachi West", "Nkwanta South", "Buem"],
  Savannah: ["Damongo", "Bole", "Salaga South"],
  "North East": ["Nalerigu-Gambaga", "Walewale", "Bunkpurugu"],
};

const MALE = ["Kwame", "Kofi", "Kwabena", "Kwaku", "Yaw", "Kojo", "Kwesi", "Fiifi", "Ebo", "Nii", "Edem", "Selorm", "Mawuli", "Senyo", "Ibrahim", "Alhassan", "Fuseini", "Abdul-Rahman", "Issahaku", "Emmanuel", "Samuel", "Joseph", "Daniel", "Richard", "Francis", "Isaac", "Bernard"];
const FEMALE = ["Ama", "Akosua", "Abena", "Afua", "Adwoa", "Yaa", "Efua", "Esi", "Naa", "Dzifa", "Mavis", "Comfort", "Gifty", "Patience", "Felicia", "Elizabeth", "Rahinatu", "Hawa", "Zenabu", "Sedinam"];
const SURNAMES = ["Mensah", "Owusu", "Boateng", "Asante", "Osei", "Agyeman", "Ofori", "Darko", "Amoah", "Addo", "Quaye", "Tetteh", "Lamptey", "Antwi", "Sarpong", "Frimpong", "Ansah", "Acquah", "Nyarko", "Gyamfi", "Adjei", "Bonsu", "Kumi", "Dogbe", "Agbeko", "Kpodo", "Amenyo", "Abdulai", "Iddrisu", "Mahama", "Seidu", "Yakubu", "Bawa", "Atinga", "Ayamga", "Dery", "Kanton", "Baah", "Opoku", "Wiredu", "Arthur", "Eshun", "Quansah"];

const PARTIES = [
  { name: "National Democratic Congress", abbreviation: "NDC", color: "#1E7B3E" },
  { name: "New Patriotic Party", abbreviation: "NPP", color: "#1F4E9E" },
  { name: "Independent", abbreviation: "IND", color: "#6B7280" },
];

// Meeting periods (fictional, for demonstration)
const MEETINGS = [
  { session: 1, number: 1, start: "2025-01-07", end: "2025-03-28" },
  { session: 1, number: 2, start: "2025-05-13", end: "2025-08-01" },
  { session: 1, number: 3, start: "2025-10-21", end: "2025-12-19" },
  { session: 2, number: 1, start: "2026-01-27", end: "2026-03-27" },
  { session: 2, number: 2, start: "2026-05-19", end: "2026-07-31" },
  { session: 2, number: 3, start: "2026-10-20", end: "2026-12-18" },
];
const ORD = ["", "First", "Second", "Third", "Fourth"];

const COMMITTEES = [
  { name: "Finance Committee", type: "STANDING", weekday: 3, time: "14:00:00" },
  { name: "Health Committee", type: "SELECT", weekday: 4, time: "14:00:00" },
  { name: "Public Accounts Committee", type: "STANDING", weekday: 2, time: "14:30:00" },
  { name: "Food, Agriculture and Cocoa Affairs Committee", type: "SELECT", weekday: 3, time: "15:00:00" },
];

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

async function main() {
  const db = new pg.Client(connectionConfig());
  await db.connect();
  const q = (sql: string, params: unknown[] = []) => execOn(db, sql, params);

  console.log("Clearing demo tables…");
  // RESTART IDENTITY resets ids to 1 (the fixed user ids below rely on it).
  await q(
    `TRUNCATE TABLE ${["attendance_corrections", "attendance", "sittings", "committee_members", "committees", "mp_memberships", "mps", "meetings", "parliament_sessions", "parliaments", "constituencies", "regions", "parties", "user_sessions", "audit_logs", "users"].join(", ")} RESTART IDENTITY CASCADE`,
  );
  await q("UPDATE settings SET updated_by = NULL");

  // ---- users -------------------------------------------------------------
  const roleRows = await rowsOn<{ id: number; code: string }>(db, "SELECT id, code FROM roles");
  const roleId = (c: string) => roleRows.find((r) => r.code === c)!.id as number;
  const demoHash = await bcrypt.hash("Demo@Parl2026", 12);
  const users = [
    ["admin", "admin@demo.parliament.gh", "Akua Sarpong-Mensah", "ADMIN"],
    ["officer", "officer@demo.parliament.gh", "Kofi Adu-Boahen", "OFFICER"],
    ["officer2", "officer2@demo.parliament.gh", "Esi Quainoo", "OFFICER"],
    ["approver", "approver@demo.parliament.gh", "Yaw Ofosu-Darko", "APPROVER"],
    ["management", "management@demo.parliament.gh", "Abena Owusu-Ansah", "MANAGEMENT"],
    ["viewer", "viewer@demo.parliament.gh", "Selorm Kpodo", "VIEWER"],
  ];
  for (const [u, e, n, r] of users) {
    await q(
      "INSERT INTO users (username,email,full_name,role_id,password_hash,must_change_password,password_changed_at) VALUES (?,?,?,?,?,0,LOCALTIMESTAMP)",
      [u, e, n, roleId(r), demoHash],
    );
  }
  const OFFICER = 2, APPROVER = 4;

  // ---- reference data ----------------------------------------------------
  const constituencies: { id: number; name: string }[] = [];
  for (const [region, list] of Object.entries(REGIONS)) {
    const r = await q("INSERT INTO regions (name) VALUES (?)", [region]);
    for (const c of list) {
      const res = await q("INSERT INTO constituencies (name, region_id) VALUES (?,?)", [c, r.insertId]);
      constituencies.push({ id: res.insertId, name: c });
    }
  }
  const partyIds: number[] = [];
  for (const p of PARTIES) partyIds.push((await q("INSERT INTO parties (name,abbreviation,color) VALUES (?,?,?)", [p.name, p.abbreviation, p.color])).insertId);
  const [NDC, NPP, IND] = partyIds;

  const parl = (await q("INSERT INTO parliaments (number,name,start_date,is_current) VALUES (9,'Ninth Parliament of the Fourth Republic','2025-01-07',1)")).insertId;
  const s1 = (await q("INSERT INTO parliament_sessions (parliament_id,number,name,start_date,end_date) VALUES (?,1,'First Session','2025-01-07','2025-12-31')", [parl])).insertId;
  const s2 = (await q("INSERT INTO parliament_sessions (parliament_id,number,name,start_date) VALUES (?,2,'Second Session','2026-01-01')", [parl])).insertId;
  const meetingIds: { id: number; start: string; end: string }[] = [];
  for (const m of MEETINGS) {
    const sid = m.session === 1 ? s1 : s2;
    const id = (await q("INSERT INTO meetings (session_id,number,name,start_date,end_date) VALUES (?,?,?,?,?)", [sid, m.number, `${ORD[m.number]} Meeting`, m.start, m.end])).insertId;
    meetingIds.push({ id, start: m.start, end: m.end });
  }

  // ---- MPs ---------------------------------------------------------------
  type MP = { id: number; constituencyId: number; partyId: number; propensity: number; start: string; end: string | null };
  const mps: MP[] = [];
  let seq = 1;
  const usedNames = new Set<string>();
  const makeMp = async (constituencyId: number, partyId: number, start: string, status = "ACTIVE") => {
    const female = rand() < 0.22;
    let first: string, last: string;
    do { first = pick(female ? FEMALE : MALE); last = pick(SURNAMES); } while (usedNames.has(first + last));
    usedNames.add(first + last);
    const other = rand() < 0.4 ? pick(female ? FEMALE : MALE) : null;
    const pid = `MP9-${String(seq++).padStart(3, "0")}`;
    const title = pick(female ? ["Hon. Mrs.", "Hon. Ms.", "Hon. Dr.", "Hon."] : ["Hon.", "Hon.", "Hon. Dr.", "Hon. Prof."]);
    const res = await q(
      `INSERT INTO mps (parliamentary_id,title,first_name,other_names,last_name,gender,email,phone,status,current_party_id,current_constituency_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [pid, title, first, other, last, female ? "F" : "M", `${first}.${last}@demo.parliament.gh`.toLowerCase(), `+233 24 ${Math.floor(100 + rand() * 899)} ${Math.floor(1000 + rand() * 8999)}`, status, partyId, constituencyId],
    );
    const roll = rand();
    const propensity = roll < 0.07 ? 0.5 + rand() * 0.15 : 0.78 + rand() * 0.2;
    const mp: MP = { id: res.insertId, constituencyId, partyId, propensity, start, end: null };
    mps.push(mp);
    return mp;
  };

  for (const c of constituencies) {
    const r = rand();
    const party = r < 0.66 ? NDC : r < 0.97 ? NPP : IND;
    const mp = await makeMp(c.id, party, "2025-01-07");
    await q("INSERT INTO mp_memberships (mp_id,parliament_id,party_id,constituency_id,start_date) VALUES (?,?,?,?,?)", [mp.id, parl, party, c.id, "2025-01-07"]);
  }

  // History example 1: an MP dies mid-term; by-election winner sworn in later.
  const vacated = mps[10];
  await q("UPDATE mps SET status='DECEASED' WHERE id=?", [vacated.id]);
  await q("UPDATE mp_memberships SET end_date='2025-07-14', end_reason='Deceased' WHERE mp_id=?", [vacated.id]);
  vacated.end = "2025-07-14";
  const successor = await makeMp(vacated.constituencyId, vacated.partyId, "2025-10-21");
  await q("INSERT INTO mp_memberships (mp_id,parliament_id,party_id,constituency_id,start_date) VALUES (?,?,?,?,'2025-10-21')", [successor.id, parl, vacated.partyId, vacated.constituencyId]);
  await q("UPDATE mps SET current_constituency_id=NULL WHERE id=?", [vacated.id]);

  // History example 2: an independent MP joins a party.
  const indMp = mps.find((m) => m.partyId === IND && m.end === null);
  if (indMp) {
    await q("UPDATE mp_memberships SET end_date='2026-02-28', end_reason='Joined NDC caucus' WHERE mp_id=? AND end_date IS NULL", [indMp.id]);
    await q("INSERT INTO mp_memberships (mp_id,parliament_id,party_id,constituency_id,start_date) VALUES (?,?,?,?,'2026-03-01')", [indMp.id, parl, NDC, indMp.constituencyId]);
    await q("UPDATE mps SET current_party_id=? WHERE id=?", [NDC, indMp.id]);
  }

  // ---- committees ----------------------------------------------------------
  const committeeMembers = new Map<number, number[]>();
  const committeeIds: number[] = [];
  for (const c of COMMITTEES) {
    const id = (await q("INSERT INTO committees (name,type) VALUES (?,?)", [c.name, c.type])).insertId;
    committeeIds.push(id);
    const pool = mps.filter((m) => m.end === null && m.start === "2025-01-07").sort(() => rand() - 0.5).slice(0, 13);
    committeeMembers.set(id, pool.map((m) => m.id));
    for (const [i, m] of pool.entries()) {
      await q("INSERT INTO committee_members (committee_id,mp_id,role,start_date) VALUES (?,?,?,'2025-01-07')", [id, m.id, i === 0 ? "CHAIR" : i === 1 ? "VICE_CHAIR" : i === 2 ? "RANKING" : "MEMBER"]);
    }
  }

  // ---- sittings & attendance ----------------------------------------------
  const today = new Date(fmt(new Date()) + "T00:00:00Z");
  const pastSittingIds: number[] = [];
  let sittingNo = 0;
  const attRows: unknown[][] = [];
  const flush = async () => {
    if (!attRows.length) return;
    await rowsOn(
      db,
      "INSERT INTO attendance (sitting_id,mp_id,party_id,constituency_id,status,arrival_time,remarks,recorded_by,recorded_at) VALUES ?",
      [attRows.splice(0)],
    );
  };

  const statusFor = (p: number): [string, string | null, string | null] => {
    if (rand() < p) {
      if (rand() < 0.1) return ["LATE", `10:${String(31 + Math.floor(rand() * 28)).padStart(2, "0")}:00`, null];
      return ["PRESENT", null, null];
    }
    const r = rand();
    if (r < 0.5) return ["ABSENT", null, null];
    if (r < 0.8) return ["EXCUSED", null, "Permission granted by the Speaker"];
    return ["OFFICIAL_DUTY", null, pick(["Parliamentary delegation abroad", "Committee working visit", "ECOWAS Parliament session"])];
  };
  const mpParty = (mp: MP, date: string) => (indMp && mp.id === indMp.id && date >= "2026-03-01" ? NDC : mp.partyId);
  const activeOn = (mp: MP, date: string) => mp.start <= date && (mp.end === null || mp.end >= date);

  for (const m of meetingIds) {
    for (let d = new Date(m.start + "T00:00:00Z"); fmt(d) <= m.end; d = addDays(d, 1)) {
      const dow = d.getUTCDay();
      if (dow < 2 || dow > 5) continue; // plenary Tuesday–Friday
      const date = fmt(d);
      const past = d < today;
      sittingNo++;
      const res = await q(
        `INSERT INTO sittings (meeting_id,sitting_type,title,sitting_date,start_time,end_time,venue,status,register_status,created_by)
         VALUES (?, 'PLENARY', ?, ?, '10:00:00', ?, 'Chamber, Parliament House', ?, ?, 1)`,
        [m.id, `Plenary Sitting No. ${sittingNo}`, date, past ? "15:00:00" : null, past ? "HELD" : "SCHEDULED", past ? "APPROVED" : "NOT_STARTED"],
      );
      if (past) {
        pastSittingIds.push(res.insertId);
        for (const mp of mps) {
          if (!activeOn(mp, date)) continue;
          const [st, arr, rem] = statusFor(mp.propensity);
          attRows.push([res.insertId, mp.id, mpParty(mp, date), mp.constituencyId, st, arr, rem, OFFICER, `${date} 10:45:00`]);
        }
        await q("UPDATE sittings SET submitted_by=?, submitted_at=?, reviewed_by=?, reviewed_at=? WHERE id=?", [OFFICER, `${date} 15:30:00`, APPROVER, `${date} 17:00:00`, res.insertId]);
      }
      // committee sittings on their weekday
      for (const [i, c] of COMMITTEES.entries()) {
        if (c.weekday !== dow || rand() < 0.35) continue;
        const cid = committeeIds[i];
        const cres = await q(
          `INSERT INTO sittings (meeting_id,sitting_type,committee_id,title,sitting_date,start_time,venue,status,register_status,created_by,submitted_by,submitted_at,reviewed_by,reviewed_at)
           VALUES (?, 'COMMITTEE', ?, ?, ?, ?, 'Committee Room, Job 600', ?, ?, 1, ?, ?, ?, ?)`,
          [m.id, cid, `${c.name} Meeting`, date, c.time, past ? "HELD" : "SCHEDULED", past ? "APPROVED" : "NOT_STARTED",
            past ? OFFICER : null, past ? `${date} 17:00:00` : null, past ? APPROVER : null, past ? `${date} 18:00:00` : null],
        );
        if (past) {
          for (const mpId of committeeMembers.get(cid)!) {
            const mp = mps.find((x) => x.id === mpId)!;
            if (!activeOn(mp, date)) continue;
            const [st, arr, rem] = statusFor(Math.min(0.98, mp.propensity + 0.02));
            attRows.push([cres.insertId, mp.id, mpParty(mp, date), mp.constituencyId, st, st === "LATE" ? c.time.replace(":00:00", ":35:00") : arr, rem, OFFICER, `${date} 16:00:00`]);
          }
        }
      }
      if (attRows.length > 2000) await flush();
    }
  }
  await flush();

  // Leave the most recent registers in the workflow for demonstration
  const last = pastSittingIds.slice(-3);
  if (last.length === 3) {
    await q("UPDATE sittings SET register_status='SUBMITTED', reviewed_by=NULL, reviewed_at=NULL WHERE id IN (?,?)", [last[1], last[2]]);
    await q("UPDATE sittings SET register_status='RETURNED', review_comment='Please confirm the status of the members marked LATE — arrival times look inconsistent with the Votes and Proceedings.' WHERE id=?", [last[0]]);
  }

  // A pending correction request on an approved sitting
  const corrTarget = await rowsOn<{ id: number; status: string; remarks: string | null }>(
    db,
    "SELECT a.id, a.status, a.remarks FROM attendance a JOIN sittings s ON s.id=a.sitting_id WHERE s.register_status='APPROVED' AND a.status='ABSENT' ORDER BY s.sitting_date DESC LIMIT 2",
  );
  for (const r of corrTarget) {
    await q(
      "INSERT INTO attendance_corrections (attendance_id,old_status,new_status,old_remarks,new_remarks,reason,requested_by,requested_at) VALUES (?,?,?,?,?,?,?,LOCALTIMESTAMP)",
      [r.id, r.status, "EXCUSED", r.remarks, "Speaker's permission letter received late", "Member's permission letter was received by the Clerk's office after the register was approved.", OFFICER],
    );
  }

  await q("INSERT INTO audit_logs (username,action,entity_type,summary) VALUES ('system','SEED','system','Demonstration data loaded')");
  const [{ n }] = await rowsOn<{ n: number }>(db, "SELECT COUNT(*) n FROM attendance");
  await db.end();
  console.log(`✔ Demo data loaded: ${mps.length} MPs, ${sittingNo} plenary sitting dates, ${n} attendance records.`);
  console.log("  Demo logins (password Demo@Parl2026): admin, officer, approver, management, viewer");
}

main().catch((e) => { console.error(e); process.exit(1); });
