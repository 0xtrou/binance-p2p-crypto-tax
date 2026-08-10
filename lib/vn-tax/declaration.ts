// Tờ khai thuế TNCN — mô hình dòng tiền, KHÔNG phải lãi vốn.
//
// Thực tế: file CSV P2P (Binance/Remitano) là dòng tiền MUA/BÁN crypto lấy
// VND. Mỗi dòng là một giao dịch độc lập:
//   - MUA: chi VND để nhận crypto → dòng tiền RA, không chịu thuế
//   - BÁN: nhận VND khi bán crypto → dòng tiền VÀO, chịu thuế
//
// Không ghép lô FIFO (như chứng khoán) vì P2P không phải đầu tư lãi vốn.
// Người dùng mua USDT giá 26k rồi bán giá 27k — đó là spread P2P, không phải
// lãi vốn đầu tư.
//
// Thuế áp dụng:
//   1. Thuế chuyển nhượng 0,1% trên TỔNG doanh thu bán (sau 27/03/2026)
//   2. Thuế thu nhập khác 10% trên lợi nhuận ròng (doanh thu bán − chi phí mua)
//      nếu characterize là thu nhập — tính theo năm, trên VND
//
// Lợi nhuận ròng = tổng VND bán − tổng VND mua (cùng tài sản, cùng năm).
// Nếu bán > mua → lãi ròng → chịu thuế 10%.
// Nếu mua > bán → lỗ → không có thuế thu nhập khác.

import { CIRCULAR_32_EFFECTIVE, PIT_RATE } from "./constants";
import { CLAUSES, type RegulationClause } from "./regulation";
import type { ParsedTrade } from "./schema";

export type DeclBucket = "transfer" | "other-income" | "buy";

export interface DeclarationRow {
  date: Date;
  pair: string;
  side: "BUY" | "SELL";
  gross: number;
  /** Thuế phải nộp trên giao dịch này (VND). */
  taxOwed: number;
  bucket: DeclBucket;
  clause: RegulationClause;
  /** Nguồn: "Remitano" hoặc "Binance". */
  source: string;
}

export interface YearSummary {
  year: number;
  /** Tổng VND bán (tất cả tài sản). */
  soldVnd: number;
  /** Tổng VND mua (tất cả tài sản). */
  boughtVnd: number;
  /** Lợi nhuận ròng = soldVnd - boughtVnd. */
  netVnd: number;
  /** Thuế chuyển nhượng 0,1% trên tổng bán (chỉ từ 27/03/2026). */
  transferTax: number;
  /** Thuế thu nhập khác 10% trên lợi nhuận ròng (nếu dương). */
  otherIncomeTax: number;
  /** Tổng thuế năm. */
  totalTax: number;
}

export interface AssetFlow {
  asset: string;
  boughtVnd: number;
  soldVnd: number;
  netVnd: number;
}

export interface DeclarationResult {
  rows: DeclarationRow[];
  totals: {
    transferTax: number;
    otherIncomeTax: number;
    totalTax: number;
    totalSoldVnd: number;
    totalBoughtVnd: number;
    totalNetVnd: number;
    totalBuyCount: number;
    totalSellCount: number;
    unmatchedCount: number;
  };
  yearSummaries: YearSummary[];
  assetFlows: AssetFlow[];
}

const OTHER_INCOME_RATE = 0.1;

/**
 * Xây tờ khai theo mô hình dòng tiền. Mỗi lệnh BÁN chịu thuế chuyển nhượng
 * 0,1% (sau 27/03/2026). Lợi nhuận ròng năm (bán - mua) chịu thuế thu nhập
 * khác 10% nếu dương. KHÔNG ghép lô FIFO.
 */
export function buildDeclaration(trades: ParsedTrade[]): DeclarationResult {
  const rows: DeclarationRow[] = [];
  const yearAgg = new Map<number, { soldVnd: number; boughtVnd: number }>();
  const assetMap = new Map<string, { boughtVnd: number; soldVnd: number }>();

  for (const t of trades) {
    const year = t.date.getUTCFullYear();
    if (!yearAgg.has(year)) yearAgg.set(year, { soldVnd: 0, boughtVnd: 0 });
    const ya = yearAgg.get(year)!;

    // Asset flow (group by base asset).
    if (!assetMap.has(t.base)) assetMap.set(t.base, { boughtVnd: 0, soldVnd: 0 });
    const af = assetMap.get(t.base)!;

    if (t.side === "BUY") {
      ya.boughtVnd += t.grossValue;
      af.boughtVnd += t.grossValue;
      rows.push({
        date: t.date,
        pair: t.pair,
        side: "BUY",
        gross: t.grossValue,
        taxOwed: 0,
        bucket: "buy",
        clause: CLAUSES.notTransfer,
        source: t.source,
      });
      continue;
    }

    // SELL — chịu thuế chuyển nhượng 0,1% nếu sau 27/03/2026.
    ya.soldVnd += t.grossValue;
    af.soldVnd += t.grossValue;
    const isPostEffective = t.date.getTime() >= CIRCULAR_32_EFFECTIVE.getTime();

    let taxOwed = 0;
    let bucket: DeclBucket;
    let clause: RegulationClause;

    if (isPostEffective) {
      // Thuế chuyển nhượng 0,1% trên tổng giá trị giao dịch.
      taxOwed = roundCents(t.grossValue * PIT_RATE);
      bucket = "transfer";
      clause = CLAUSES.rate;
    } else {
      // Trước 27/03/2026 — không có thuế chuyển nhượng. Thuế thu nhập khác
      // 10% được tính theo NĂM (xem yearSummaries), không theo từng giao dịch.
      bucket = "other-income";
      clause = CLAUSES.otherIncome;
    }

    rows.push({
      date: t.date,
      pair: t.pair,
      side: "SELL",
      gross: t.grossValue,
      taxOwed,
      bucket,
      clause,
      source: t.source,
    });
  }

  // Sort newest-first.
  rows.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Year summaries — thuế thu nhập khác 10% trên lợi nhuận ròng năm.
  const yearSummaries: YearSummary[] = [];
  for (const [year, ya] of yearAgg) {
    const netVnd = ya.soldVnd - ya.boughtVnd;
    // Thuế chuyển nhượng: chỉ tính trên các lệnh bán sau 27/03/2026 trong năm.
    const transferTax = rows
      .filter((r) => r.bucket === "transfer" && r.date.getUTCFullYear() === year)
      .reduce((s, r) => s + r.taxOwed, 0);
    // Thuế thu nhập khác 10% trên lợi nhuận ròng năm (nếu dương).
    const otherIncomeTax = netVnd > 0 ? roundCents(netVnd * OTHER_INCOME_RATE) : 0;
    yearSummaries.push({
      year,
      soldVnd: roundCents(ya.soldVnd),
      boughtVnd: roundCents(ya.boughtVnd),
      netVnd: roundCents(netVnd),
      transferTax,
      otherIncomeTax,
      totalTax: roundCents(transferTax + otherIncomeTax),
    });
  }
  yearSummaries.sort((a, b) => a.year - b.year);

  // Asset flows.
  const assetFlows: AssetFlow[] = [...assetMap.entries()]
    .map(([asset, f]) => ({
      asset,
      boughtVnd: roundCents(f.boughtVnd),
      soldVnd: roundCents(f.soldVnd),
      netVnd: roundCents(f.soldVnd - f.boughtVnd),
    }))
    .sort((a, b) => b.soldVnd - a.soldVnd);

  const allSold = rows.filter((r) => r.side === "SELL");
  const allBought = rows.filter((r) => r.side === "BUY");
  const totalSoldVnd = allSold.reduce((s, r) => s + r.gross, 0);
  const totalBoughtVnd = allBought.reduce((s, r) => s + r.gross, 0);

  return {
    rows,
    totals: {
      transferTax: roundCents(allSold.filter((r) => r.bucket === "transfer").reduce((s, r) => s + r.taxOwed, 0)),
      otherIncomeTax: roundCents(yearSummaries.reduce((s, y) => s + y.otherIncomeTax, 0)),
      totalTax: roundCents(yearSummaries.reduce((s, y) => s + y.totalTax, 0)),
      totalSoldVnd: roundCents(totalSoldVnd),
      totalBoughtVnd: roundCents(totalBoughtVnd),
      totalNetVnd: roundCents(totalSoldVnd - totalBoughtVnd),
      totalBuyCount: allBought.length,
      totalSellCount: allSold.length,
      unmatchedCount: 0, // mô hình dòng tiền — không có "unmatched"
    },
    yearSummaries,
    assetFlows,
  };
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
