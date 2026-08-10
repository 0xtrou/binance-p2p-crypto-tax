import assert from "node:assert/strict";
import test from "node:test";
import { buildDeclaration } from "./declaration";
import { CIRCULAR_32_EFFECTIVE } from "./constants";
import type { ParsedTrade } from "./schema";

const buy = (iso: string, gross: number, qty: number, quote = "VND"): ParsedTrade => ({
  date: new Date(iso), pair: `USDT${quote}`, base: "USDT", quote, side: "BUY", grossValue: gross, quantity: qty,
});
const sell = (iso: string, gross: number, qty: number, quote = "VND"): ParsedTrade => ({
  date: new Date(iso), pair: `USDT${quote}`, base: "USDT", quote, side: "SELL", grossValue: gross, quantity: qty,
});

test("post-effective sell -> transfer bucket, Art. 5, 0.1% gross", () => {
  const on = CIRCULAR_32_EFFECTIVE.toISOString();
  const r = buildDeclaration([sell(on, 1_000_000, 100)]);
  const s = r.rows.find((x) => x.side === "SELL")!;
  assert.equal(s.bucket, "transfer");
  assert.equal(s.clause.id, "Điều 5");
  assert.equal(s.taxOwed, 1000); // 1M * 0.1%
  assert.equal(s.unmatched, true); // no buy lot
});

test("pre-effective sell -> other-income bucket, 10% net profit", () => {
  const r = buildDeclaration([
    buy("2024-01-01T00:00:00Z", 500_000, 50),
    sell("2024-02-01T00:00:00Z", 1_000_000, 50),
  ]);
  const s = r.rows.find((x) => x.side === "SELL")!;
  assert.equal(s.bucket, "other-income");
  assert.equal(s.clause.id, "Luật Thuế TNCN (thu nhập khác)");
  // netProfit = 1M - 500k = 500k; 10% = 50k.
  assert.equal(s.netProfit, 500_000);
  assert.equal(s.taxOwed, 50_000);
});

test("pre-effective sell with net loss -> other income floors at 0", () => {
  const r = buildDeclaration([
    buy("2024-01-01T00:00:00Z", 1_000_000, 100),
    sell("2024-02-01T00:00:00Z", 500_000, 100),
  ]);
  const s = r.rows.find((x) => x.side === "SELL")!;
  assert.equal(s.bucket, "other-income");
  assert.equal(s.netProfit, -500_000);
  assert.equal(s.taxOwed, 0);
});

test("buy row -> buy bucket, $0 owed", () => {
  const r = buildDeclaration([buy("2024-01-01T00:00:00Z", 500_000, 50)]);
  const b = r.rows[0];
  assert.equal(b.bucket, "buy");
  assert.equal(b.taxOwed, 0);
  assert.equal(b.netProfit, 0);
});

test("FIFO cost matched across trades in chronological order", () => {
  const r = buildDeclaration([
    buy("2024-01-01T00:00:00Z", 100_000, 50), // 2000/USDT
    buy("2024-01-02T00:00:00Z", 300_000, 50), // 6000/USDT
    sell("2024-01-03T00:00:00Z", 600_000, 100),
  ]);
  const s = r.rows.find((x) => x.side === "SELL")!;
  assert.equal(s.matchedCost, 400_000); // 100k + 300k
  assert.equal(s.netProfit, 200_000);
});

test("cross-year FIFO lot carryforward", () => {
  const r = buildDeclaration([
    buy("2025-12-30T00:00:00Z", 500_000, 100),
    sell("2026-04-02T00:00:00Z", 700_000, 100), // post-effective
  ]);
  const s = r.rows.find((x) => x.side === "SELL")!;
  assert.equal(s.bucket, "transfer"); // post-effective wins
  assert.equal(s.taxOwed, 700); // 0.1% of 700k
  assert.equal(s.matchedCost, 500_000); // lot carried from 2025
});

test("business note only for VND years above 500M revenue", () => {
  const r = buildDeclaration([
    buy("2025-01-01T00:00:00Z", 100_000, 10),
    sell("2025-06-01T00:00:00Z", 600_000_000, 1000), // revenue > 500M
  ]);
  assert.equal(r.businessNotes.length, 1);
  assert.equal(r.businessNotes[0].year, 2025);
  assert.equal(r.businessNotes[0].overThreshold, true);
  assert.equal(r.businessNotes[0].pitLow, r.businessNotes[0].netProfit * 0.15);
});

test("no business note for years under 500M VND revenue", () => {
  const r = buildDeclaration([
    buy("2025-01-01T00:00:00Z", 100_000, 10),
    sell("2025-06-01T00:00:00Z", 400_000_000, 1000), // revenue < 500M
  ]);
  assert.equal(r.businessNotes.length, 0);
});

test("unmatched sell flagged", () => {
  const r = buildDeclaration([sell("2024-01-01T00:00:00Z", 500_000, 100)]);
  const s = r.rows[0];
  assert.equal(s.unmatched, true);
  assert.equal(r.totals.unmatchedCount, 1);
});

test("totals sum correctly across buckets", () => {
  const on = CIRCULAR_32_EFFECTIVE.toISOString();
  const r = buildDeclaration([
    buy("2024-01-01T00:00:00Z", 500_000, 50),
    sell("2024-02-01T00:00:00Z", 1_000_000, 50), // other income, 50k tax
    sell(on, 2_000_000, 0), // transfer (unmatched), 2000 tax
  ]);
  assert.equal(r.totals.transferTax, 2000);
  assert.equal(r.totals.otherIncomeTax, 50_000);
  assert.equal(r.totals.totalTax, 52_000);
});

test("empty input yields empty result", () => {
  const r = buildDeclaration([]);
  assert.equal(r.rows.length, 0);
  assert.equal(r.totals.totalTax, 0);
});
