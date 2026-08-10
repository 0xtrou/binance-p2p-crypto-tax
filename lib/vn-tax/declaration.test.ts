import assert from "node:assert/strict";
import test from "node:test";
import { buildDeclaration } from "./declaration";
import { CIRCULAR_32_EFFECTIVE } from "./constants";
import type { ParsedTrade } from "./schema";

const buy = (iso: string, gross: number, base = "USDT", quote = "VND"): ParsedTrade => ({
  date: new Date(iso), pair: `${base}${quote}`, base, quote, side: "BUY", grossValue: gross, quantity: null, source: "",
});
const sell = (iso: string, gross: number, base = "USDT", quote = "VND"): ParsedTrade => ({
  date: new Date(iso), pair: `${base}${quote}`, base, quote, side: "SELL", grossValue: gross, quantity: null, source: "",
});

test("BUY row: taxOwed = 0, bucket = buy", () => {
  const r = buildDeclaration([buy("2025-01-01T00:00:00Z", 1_000_000)]);
  const b = r.rows[0];
  assert.equal(b.side, "BUY");
  assert.equal(b.taxOwed, 0);
  assert.equal(b.bucket, "buy");
});

test("SELL sau 27/03/2026: thuế chuyển nhượng 0,1% trên tổng", () => {
  const on = CIRCULAR_32_EFFECTIVE.toISOString();
  const r = buildDeclaration([sell(on, 1_000_000)]);
  const s = r.rows[0];
  assert.equal(s.bucket, "transfer");
  assert.equal(s.taxOwed, 1000);
});

test("SELL trước 27/03/2026: không thuế chuyển nhượng, taxOwed = 0", () => {
  const r = buildDeclaration([sell("2024-01-01T00:00:00Z", 1_000_000)]);
  const s = r.rows[0];
  assert.equal(s.bucket, "other-income");
  assert.equal(s.taxOwed, 0);
});

test("Year summary: lợi nhuận ròng = bán - mua", () => {
  const r = buildDeclaration([
    buy("2024-01-01T00:00:00Z", 100_000_000),
    sell("2024-06-01T00:00:00Z", 150_000_000),
  ]);
  const y = r.yearSummaries[0];
  assert.equal(y.year, 2024);
  assert.equal(y.boughtVnd, 100_000_000);
  assert.equal(y.soldVnd, 150_000_000);
  assert.equal(y.netVnd, 50_000_000);
});

test("Year summary: thuế thu nhập khác 10% trên lợi nhuận ròng dương (trên threshold 500tr)", () => {
  // Doanh thu 600tr > 500tr threshold → chịu thuế.
  const r = buildDeclaration([
    buy("2024-01-01T00:00:00Z", 100_000_000),
    sell("2024-06-01T00:00:00Z", 600_000_000),
  ]);
  const y = r.yearSummaries[0];
  assert.equal(y.underThreshold, false);
  // Lợi nhuận ròng = 600tr - 100tr = 500tr. 10% = 50tr.
  assert.equal(y.otherIncomeTax, 50_000_000);
});

test("Year summary: dưới threshold 500tr → miễn thuế thu nhập khác", () => {
  // Doanh thu 150tr ≤ 500tr → miễn (characterize hộ kinh doanh).
  const r = buildDeclaration([
    buy("2024-01-01T00:00:00Z", 100_000_000),
    sell("2024-06-01T00:00:00Z", 150_000_000),
  ]);
  const y = r.yearSummaries[0];
  assert.equal(y.underThreshold, true);
  assert.equal(y.otherIncomeTax, 0);
});

test("Year summary: lỗ ròng → thuế thu nhập khác = 0", () => {
  const r = buildDeclaration([
    buy("2024-01-01T00:00:00Z", 200_000_000),
    sell("2024-06-01T00:00:00Z", 100_000_000),
  ]);
  const y = r.yearSummaries[0];
  assert.equal(y.netVnd, -100_000_000);
  assert.equal(y.otherIncomeTax, 0);
});

test("Year summary: thuế chuyển nhượng chỉ cho bán sau 27/03/2026", () => {
  const on = CIRCULAR_32_EFFECTIVE.toISOString();
  const r = buildDeclaration([
    sell("2024-01-01T00:00:00Z", 1_000_000),
    sell(on, 2_000_000),
  ]);
  const y2024 = r.yearSummaries.find((y) => y.year === 2024)!;
  const y2026 = r.yearSummaries.find((y) => y.year === 2026)!;
  assert.equal(y2024.transferTax, 0);
  assert.equal(y2026.transferTax, 2000);
});

test("Asset flow: tổng mua/bán theo tài sản", () => {
  const r = buildDeclaration([
    buy("2024-01-01T00:00:00Z", 50_000_000, "USDT"),
    sell("2024-06-01T00:00:00Z", 80_000_000, "USDT"),
    buy("2024-01-01T00:00:00Z", 20_000_000, "ETH"),
    sell("2024-06-01T00:00:00Z", 30_000_000, "ETH"),
  ]);
  const usdt = r.assetFlows.find((f) => f.asset === "USDT")!;
  const eth = r.assetFlows.find((f) => f.asset === "ETH")!;
  assert.equal(usdt.boughtVnd, 50_000_000);
  assert.equal(usdt.soldVnd, 80_000_000);
  assert.equal(usdt.netVnd, 30_000_000);
  assert.equal(eth.netVnd, 10_000_000);
});

test("Totals: tổng bán, tổng mua, tổng thuế", () => {
  const on = CIRCULAR_32_EFFECTIVE.toISOString();
  const r = buildDeclaration([
    buy("2024-01-01T00:00:00Z", 100_000),
    sell("2024-06-01T00:00:00Z", 200_000),
    sell(on, 500_000),
  ]);
  assert.equal(r.totals.totalBoughtVnd, 100_000);
  assert.equal(r.totals.totalSoldVnd, 700_000);
  assert.equal(r.totals.totalNetVnd, 600_000);
  assert.equal(r.totals.transferTax, 500);
  assert.equal(r.totals.totalBuyCount, 1);
  assert.equal(r.totals.totalSellCount, 2);
  assert.equal(r.totals.unmatchedCount, 0);
});

test("empty input yields empty result", () => {
  const r = buildDeclaration([]);
  assert.equal(r.rows.length, 0);
  assert.equal(r.totals.totalTax, 0);
});
