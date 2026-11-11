import { describe, expect, it } from "vitest";
import { parseCsv, safeCell } from "../src/lib/csv";
import { passwordProblems } from "../src/lib/password-policy";
import { can, permissionsFor, ROLE_PERMISSIONS } from "../src/lib/permissions";
import { initials, pct, rateTone } from "../src/lib/utils";

describe("role permissions", () => {
  it("gives administrators every permission", () => {
    expect(permissionsFor("ADMIN").length).toBeGreaterThanOrEqual(15);
  });
  it("keeps capture and approval with different roles (segregation of duties)", () => {
    expect(can(ROLE_PERMISSIONS.OFFICER, "attendance.capture")).toBe(true);
    expect(can(ROLE_PERMISSIONS.OFFICER, "attendance.review")).toBe(false);
    expect(can(ROLE_PERMISSIONS.APPROVER, "attendance.review")).toBe(true);
    expect(can(ROLE_PERMISSIONS.APPROVER, "attendance.capture")).toBe(false);
  });
  it("makes Report Viewer read-only", () => {
    const writes = ["mps.manage", "attendance.capture", "attendance.review", "users.manage", "settings.manage", "sittings.manage"] as const;
    for (const p of writes) expect(can(ROLE_PERMISSIONS.VIEWER, p)).toBe(false);
  });
  it("returns no permissions for an unknown role", () => {
    expect(permissionsFor("HACKER")).toEqual([]);
  });
});

describe("password policy", () => {
  it("accepts a strong password", () => {
    expect(passwordProblems("Accra#Ridge2026", 10, "kmensah")).toEqual([]);
  });
  it("lists every missing element", () => {
    expect(passwordProblems("short", 10)).toEqual(
      expect.arrayContaining(["at least 10 characters", "an uppercase letter", "a number", "a symbol"]),
    );
  });
  it("rejects passwords containing the username", () => {
    expect(passwordProblems("Kmensah#2026xx", 10, "kmensah")).toContain("must not contain your username");
  });
});

describe("CSV import parser", () => {
  it("handles quotes, embedded commas and CRLF", () => {
    const rows = parseCsv('parliamentary_id,first_name,last_name\r\nMP9-001,"Ama, Jnr","O""Neil"\r\n\r\nMP9-002,Kofi,Mensah');
    expect(rows).toEqual([
      { parliamentary_id: "MP9-001", first_name: "Ama, Jnr", last_name: 'O"Neil' },
      { parliamentary_id: "MP9-002", first_name: "Kofi", last_name: "Mensah" },
    ]);
  });
  it("normalises header names", () => {
    expect(parseCsv("Parliamentary ID,First-Name\nX,Y")[0]).toEqual({ parliamentary_id: "X", first_name: "Y" });
  });
  it("neutralises spreadsheet formulas", () => {
    expect(safeCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(safeCell("Accra")).toBe("Accra");
  });
});

describe("formatting helpers", () => {
  it("formats rates", () => {
    expect(pct(0.8567)).toBe("85.7%");
    expect(pct(null)).toBe("—");
  });
  it("bands attendance rates", () => {
    expect(rateTone(0.9)).toBe("success");
    expect(rateTone(0.75)).toBe("warning");
    expect(rateTone(0.5)).toBe("destructive");
  });
  it("strips honorifics from initials", () => {
    expect(initials("Hon. Dr. Ama Mensah")).toBe("AM");
  });
});
