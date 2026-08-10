// Client-side export helpers for declaration + compliance tables.
// CSV: hand-rolled (RFC 4180 quoting). XLSX: SheetJS.
// Both trigger browser downloads via Blob + anchor click.

import * as XLSX from "xlsx";
import type { DeclarationResult } from "./declaration";
import type { ParseResult } from "./schema";
import { classifyTrade } from "./regulation";
import { formatDate } from "./format";

/** Quote a CSV cell per RFC 4180: wrap in quotes if it contains comma, quote,
 *  newline, or leading/trailing whitespace. Escape embedded quotes by doubling. */
function csvCell(v: string | number): string {
  const s = String(v);
  if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Trigger browser download of a blob with given filename. */
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const ts = () => new Date().toISOString().slice(0, 10);

/** Build the declaration rows as a 2D array (header + data) for export. */
function declarationRows(decl: DeclarationResult): (string | number)[][] {
  const header = ["Ngày", "Cặp", "Chiều", "Tổng VND", "Nhóm", "Điều khoản", "Thuế VND"];
  const data = decl.rows.map((r) => [
    formatDate(r.date), r.pair, r.side, r.gross, r.bucket, r.clause.id, r.taxOwed,
  ]);
  const totals = ["TỔNG", "", "", decl.totals.totalSoldVnd, "", "", decl.totals.totalTax];
  return [header, ...data, totals];
}

/** Build compliance (per-trade classification) rows for export. */
function complianceRows(parsed: ParseResult): (string | number)[][] {
  const header = [
    "Date", "Pair", "Side", "Gross", "Classification", "Clause", "Reason", "Payment",
  ];
  const rows = [...parsed.trades]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((t) => {
      const c = classifyTrade(t);
      return [
        formatDate(t.date), t.pair, t.side, t.grossValue,
        c.bucket, c.clause.id, c.reason, c.payment,
      ];
    });
  if (parsed.skipped.length > 0) {
    rows.push(["", "", "", "", "skipped", "", `${parsed.skipped.length} rows skipped`, ""]);
  }
  return [header, ...rows];
}

export function exportDeclarationCsv(decl: DeclarationResult): void {
  const csv = toCsv(declarationRows(decl));
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `pit-declaration-${ts()}.csv`);
}

export function exportDeclarationXlsx(decl: DeclarationResult): void {
  const ws = XLSX.utils.aoa_to_sheet(declarationRows(decl));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tờ khai");
  // Year summary sheet.
  const summary: (string | number)[][] = [
    ["Chỉ số", "Giá trị VND"],
    ["Tổng thuế TNCN", decl.totals.totalTax],
    ["Thuế chuyển nhượng 0,1%", decl.totals.transferTax],
    ["Thuế thu nhập khác 10%", decl.totals.otherIncomeTax],
    ["Tổng bán", decl.totals.totalSoldVnd],
    ["Tổng mua", decl.totals.totalBoughtVnd],
    ["Lợi nhuận ròng", decl.totals.totalNetVnd],
    [],
    ["Tóm tắt theo năm"],
    ["Năm", "Tổng mua", "Tổng bán", "Lợi nhuận ròng", "Thuế chuyển nhượng", "Thu nhập khác", "Tổng thuế"],
    ...decl.yearSummaries.map((y) => [y.year, y.boughtVnd, y.soldVnd, y.netVnd, y.transferTax, y.otherIncomeTax, y.totalTax]),
    [],
    ["Dòng tiền theo tài sản"],
    ["Tài sản", "Tổng mua", "Tổng bán", "Lợi nhuận ròng"],
    ...decl.assetFlows.map((f) => [f.asset, f.boughtVnd, f.soldVnd, f.netVnd]),
  ];
  const sumWs = XLSX.utils.aoa_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, sumWs, "Tóm tắt");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `pit-declaration-${ts()}.xlsx`,
  );
}

export function exportComplianceCsv(parsed: ParseResult): void {
  const csv = toCsv(complianceRows(parsed));
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `compliance-breakdown-${ts()}.csv`);
}

export function exportComplianceXlsx(parsed: ParseResult): void {
  const ws = XLSX.utils.aoa_to_sheet(complianceRows(parsed));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Compliance Breakdown");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `compliance-breakdown-${ts()}.xlsx`,
  );
}
