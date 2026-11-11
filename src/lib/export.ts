import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import type { ReportData } from "./reports";

const BRAND = { primary: [11, 83, 55] as [number, number, number], gold: [196, 150, 46] as [number, number, number] };
const LOGO_PATH = join(process.cwd(), "public", "branding", "parliament-logo.png");

function cell(v: unknown, kind?: string): string {
  if (v === null || v === undefined) return "";
  if (kind === "percent" && typeof v === "number") return `${(v * 100).toFixed(1)}%`;
  if (kind === "number" && typeof v === "number") return v.toLocaleString("en-GB");
  return String(v);
}

export function toPdf(r: ReportData, meta: { institution: string; generatedBy: string }): Buffer {
  const doc = new jsPDF({ orientation: r.columns.length > 6 ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const generated = new Date().toLocaleString("en-GB", { timeZone: "Africa/Accra" });

  const header = () => {
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, 0, W, 70, "F");
    doc.setFillColor(...BRAND.gold);
    doc.rect(0, 70, W, 3, "F");
    let x = 40;
    if (existsSync(LOGO_PATH)) {
      try {
        doc.addImage(readFileSync(LOGO_PATH).toString("base64"), "PNG", 36, 11, 48, 48);
        x = 96;
      } catch {
        /* logo unreadable — continue without it */
      }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(meta.institution.toUpperCase(), x, 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("MP Attendance Management System", x, 50);
  };

  header();
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(r.title, 40, 100, { maxWidth: W - 80 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(r.subtitle, 40, 116, { maxWidth: W - 80 });

  let y = 134;
  if (r.summary.length) {
    const boxW = (W - 80 - (r.summary.length - 1) * 8) / r.summary.length;
    r.summary.forEach((s, i) => {
      const bx = 40 + i * (boxW + 8);
      doc.setDrawColor(225, 225, 225);
      doc.setFillColor(248, 247, 243);
      doc.roundedRect(bx, y, boxW, 42, 4, 4, "FD");
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(s.label.toUpperCase(), bx + 10, y + 15);
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.text(s.value, bx + 10, y + 33);
      doc.setFont("helvetica", "normal");
    });
    y += 58;
  }

  autoTable(doc, {
    startY: y,
    head: [r.columns.map((c) => c.label)],
    body: r.rows.map((row) => r.columns.map((c) => cell(row[c.key], c.kind))),
    styles: { fontSize: 8, cellPadding: 4, lineColor: [230, 230, 230], lineWidth: 0.5 },
    headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 246] },
    columnStyles: Object.fromEntries(r.columns.map((c, i) => [i, { halign: c.align ?? "left" }])),
    margin: { top: 90, left: 40, right: 40, bottom: 40 },
    didDrawPage: (d) => {
      if (d.pageNumber > 1) header();
    },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated ${generated} by ${meta.generatedBy} · Based on approved registers only`, 40, H - 20);
    doc.text(`Page ${i} of ${pages}`, W - 40, H - 20, { align: "right" });
  }
  return Buffer.from(doc.output("arraybuffer"));
}

export async function toXlsx(r: ReportData, meta: { institution: string; generatedBy: string }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.generatedBy;
  wb.created = new Date();
  const ws = wb.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 6 }] });
  const n = r.columns.length;

  ws.mergeCells(1, 1, 1, n);
  ws.getCell(1, 1).value = meta.institution;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF0B5337" } };
  ws.mergeCells(2, 1, 2, n);
  ws.getCell(2, 1).value = r.title;
  ws.getCell(2, 1).font = { bold: true, size: 12 };
  ws.mergeCells(3, 1, 3, n);
  ws.getCell(3, 1).value = r.subtitle;
  ws.getCell(3, 1).font = { italic: true, color: { argb: "FF6B7280" } };
  ws.mergeCells(4, 1, 4, n);
  ws.getCell(4, 1).value = r.summary.map((s) => `${s.label}: ${s.value}`).join("   |   ");

  const head = ws.getRow(6);
  r.columns.forEach((c, i) => {
    const cl = head.getCell(i + 1);
    cl.value = c.label;
    cl.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B5337" } };
    cl.alignment = { horizontal: c.align ?? "left", vertical: "middle" };
    cl.border = { bottom: { style: "medium", color: { argb: "FFC4962E" } } };
  });
  head.height = 20;

  r.rows.forEach((row, ri) => {
    const xr = ws.getRow(7 + ri);
    r.columns.forEach((c, ci) => {
      const v = row[c.key];
      const cl = xr.getCell(ci + 1);
      cl.value = v === null || v === undefined ? "" : (v as string | number);
      if (c.kind === "percent") cl.numFmt = "0.0%";
      if (c.kind === "number") cl.numFmt = "#,##0";
      if (c.align) cl.alignment = { horizontal: c.align };
    });
  });

  ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6 + r.rows.length, column: n } };
  r.columns.forEach((c, i) => {
    const longest = Math.max(c.label.length, ...r.rows.slice(0, 300).map((row) => String(row[c.key] ?? "").length));
    ws.getColumn(i + 1).width = Math.min(48, Math.max(10, longest + 2));
  });
  ws.addRow([]);
  ws.addRow([`Generated ${new Date().toLocaleString("en-GB", { timeZone: "Africa/Accra" })} by ${meta.generatedBy}. Based on approved registers only.`]).font = { italic: true, size: 9, color: { argb: "FF6B7280" } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function fileName(title: string, ext: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${slug}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
