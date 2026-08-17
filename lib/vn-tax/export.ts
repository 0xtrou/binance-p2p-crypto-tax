import * as XLSX from "xlsx";
import type { DeclarationResult } from "./declaration";
import type { ParseResult } from "./schema";
import { classifyTrade, OFFICIAL_SOURCES } from "./regulation";
import { formatDate } from "./format";

function csvCell(value: string | number): string {
  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue) || /^\s|\s$/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const timestamp = () => new Date().toISOString().slice(0, 10);

const LEGAL_NOTICE_ROWS: (string | number)[][] = [
  ["LƯU Ý PHÁP LÝ — TỔNG HỢP TỪ CHATGPT VÀ NGUỒN CHÍNH PHỦ"],
  ["Ngày xuất", new Date().toISOString()],
  ["Không phải tư vấn pháp lý hoặc hướng dẫn kê khai chính thức."],
  ["Từ 27/03/2026", "Công cụ ước tính 0,1% trên giá chuyển nhượng từng lần theo Thông tư 32/2026/TT-BTC. Không chờ hướng dẫn thêm chỉ vì chưa có hướng dẫn."],
  ["2019–26/03/2026", "Không tự áp mức 0,1% hoặc 10%. Không dùng file này làm tờ khai cuối cùng; giữ chứng từ và xin ý kiến bằng văn bản từ cơ quan thuế/cố vấn thuế có giấy phép trước khi kê khai hoặc điều chỉnh."],
  ["Hồi tố", "Không thấy căn cứ trong các nguồn dưới đây để áp ngược mức Thông tư 32 cho giao dịch trước 27/03/2026."],
  [],
  ["NGUỒN CHÍNH PHỦ", "Đường dẫn", "Ghi chú"],
  ...OFFICIAL_SOURCES.map((source) => [source.title, source.url, source.note]),
];

function declarationRows(declaration: DeclarationResult): (string | number)[][] {
  const header = ["Ngày", "Nguồn", "Cặp", "Chiều", "Tổng VND", "Nhóm", "Điều khoản", "Thuế giao dịch VND", "Thuế năm VND"];
  const yearTaxMap = new Map<number, number>();
  for (const year of declaration.yearSummaries) yearTaxMap.set(year.year, year.totalTax);

  const data = declaration.rows.map((row) => {
    const yearTax = row.side === "SELL" ? (yearTaxMap.get(row.date.getUTCFullYear()) ?? 0) : 0;
    return [
      formatDate(row.date), row.source, row.pair, row.side, row.gross, row.bucket, row.clause.id,
      row.taxOwed, yearTax,
    ];
  });
  const totals = ["TỔNG", "", "", "", declaration.totals.totalSoldVnd, "", "", declaration.totals.totalTax, declaration.totals.totalTax];
  return [header, ...data, totals];
}

function complianceRows(parsed: ParseResult): (string | number)[][] {
  const header = ["Ngày", "Nguồn", "Cặp", "Chiều", "Tổng VND", "Phân loại", "Điều khoản", "Lý do", "Thuế suất ước tính"];
  const rows = [...parsed.trades]
    .sort((first, second) => second.date.getTime() - first.date.getTime())
    .map((trade) => {
      const classification = classifyTrade(trade);
      return [
        formatDate(trade.date), trade.source, trade.pair, trade.side, trade.grossValue,
        classification.bucket, classification.clause.id, classification.reason, classification.payment,
      ];
    });
  if (parsed.skipped.length > 0) {
    rows.push(["", "", "", "", "", "bỏ qua", "", `${parsed.skipped.length} dòng bỏ qua`, ""]);
  }
  return [header, ...rows];
}

function declarationSummaryRows(declaration: DeclarationResult): (string | number)[][] {
  return [
    ["Chỉ số", "Giá trị VND"],
    ["Tổng thuế TNCN ước tính", declaration.totals.totalTax],
    ["Thuế chuyển nhượng 0,1% (từ 27/03/2026)", declaration.totals.transferTax],
    ["Giao dịch trước 27/03/2026", "Không tự tính thuế — xem sheet Lưu ý pháp lý"],
    ["Tổng bán", declaration.totals.totalSoldVnd],
    ["Tổng mua", declaration.totals.totalBoughtVnd],
    ["Lợi nhuận ròng", declaration.totals.totalNetVnd],
    [],
    ["Tóm tắt theo năm"],
    ["Năm", "Tổng mua", "Tổng bán", "Lợi nhuận ròng", "Thuế chuyển nhượng", "Bán trước 27/03/2026", "Tổng thuế ước tính"],
    ...declaration.yearSummaries.map((year) => [year.year, year.boughtVnd, year.soldVnd, year.netVnd, year.transferTax, year.historicReviewSoldVnd, year.totalTax]),
    [],
    ["Dòng tiền theo tài sản"],
    ["Tài sản", "Tổng mua", "Tổng bán", "Lợi nhuận ròng"],
    ...declaration.assetFlows.map((flow) => [flow.asset, flow.boughtVnd, flow.soldVnd, flow.netVnd]),
  ];
}

export function exportDeclarationCsv(declaration: DeclarationResult): void {
  const rows = [...LEGAL_NOTICE_ROWS, [], ...declarationRows(declaration)];
  download(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }), `pit-declaration-${timestamp()}.csv`);
}

export function exportDeclarationXlsx(declaration: DeclarationResult): void {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(declarationRows(declaration)), "Tờ khai dự thảo");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(declarationSummaryRows(declaration)), "Tóm tắt");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(LEGAL_NOTICE_ROWS), "Lưu ý pháp lý");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `pit-declaration-${timestamp()}.xlsx`);
}

export function exportComplianceCsv(parsed: ParseResult): void {
  const rows = [...LEGAL_NOTICE_ROWS, [], ...complianceRows(parsed)];
  download(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }), `compliance-breakdown-${timestamp()}.csv`);
}

export function exportComplianceXlsx(parsed: ParseResult): void {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(complianceRows(parsed)), "Compliance Breakdown");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(LEGAL_NOTICE_ROWS), "Lưu ý pháp lý");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `compliance-breakdown-${timestamp()}.xlsx`);
}
