import assert from "node:assert/strict";
import test from "node:test";
import { computeOtherIncome, OTHER_INCOME_RATE } from "./business-income";
import type { ParsedTrade } from "./schema";

const sell = (dateIso: string, gross: number, qty: number, quote = "VND"): ParsedTrade => ({
  date: new Date(dateIso),
  pair: `USDT${quote}`,
  base: "USDT",
  quote,
  side: "SELL",
  grossValue: gross,
  quantity: qty, source: "",
});
const buy = (dateIso: string, gross: number, qty: number, quote = "VND"): ParsedTrade => ({
  date: new Date(dateIso),
  pair: `USDT${quote}`,
  base: "USDT",
  quote,
  side: "BUY",
  grossValue: gross,
  quantity: qty, source: "",
});

test("flat 10% on net profit, no threshold", () => {
  // No matter how small the revenue, PIT applies. Unlike business income,
  // there is no 500M VND floor.
  const r = computeOtherIncome([
    buy("2026-04-01T00:00:00Z", 100_000, 100),
    sell("2026-04-02T00:00:00Z", 200_000, 100),
  ]);
  assert.equal(r.perYear.length, 1);
  // netProfit = 200k - 100k = 100k; PIT = 100k * 10% = 10k.
  assert.equal(r.perYear[0].netProfit, 100_000);
  assert.equal(r.perYear[0].pitRange[0], 10_000);
  assert.equal(r.perYear[0].pitRange[1], 10_000);
});

test("rate constant is 0.1", () => {
  assert.equal(OTHER_INCOME_RATE, 0.1);
});

test("pre-pilot sells included — no effective-date gate", () => {
  // Other income applies regardless of Circular 32 effective date.
  // Buy creates a year-2025 entry (no revenue), sell creates year-2026.
  const r = computeOtherIncome([
    buy("2025-12-01T00:00:00Z", 1_000_000, 100),
    sell("2026-01-15T00:00:00Z", 1_500_000, 100),
  ]);
  const y2026 = r.perYear.find((y) => y.year === 2026)!;
  assert.equal(y2026.netProfit, 500_000);
  assert.equal(y2026.pitRange[0], 50_000);
});

test("net loss floors PIT at zero", () => {
  const r = computeOtherIncome([
    buy("2026-04-01T00:00:00Z", 600_000, 100),
    sell("2026-04-02T00:00:00Z", 500_000, 100),
  ]);
  assert.equal(r.perYear[0].netProfit, -100_000);
  assert.equal(r.perYear[0].pitRange[0], 0);
});

test("FIFO matching same logic as business income", () => {
  const r = computeOtherIncome([
    buy("2026-04-01T00:00:00Z", 100_000, 50),
    buy("2026-04-02T00:00:00Z", 300_000, 50),
    sell("2026-04-03T00:00:00Z", 600_000, 100),
  ]);
  // costBasis = 100k + 300k = 400k; netProfit = 200k; PIT = 20k.
  assert.equal(r.perYear[0].costBasis, 400_000);
  assert.equal(r.perYear[0].netProfit, 200_000);
  assert.equal(r.perYear[0].pitRange[0], 20_000);
});

test("cross-year carryforward works", () => {
  const r = computeOtherIncome([
    buy("2025-12-30T00:00:00Z", 1_000_000, 100),
    sell("2026-01-05T00:00:00Z", 1_200_000, 100),
  ]);
  const y2026 = r.perYear.find((y) => y.year === 2026)!;
  assert.equal(y2026.costBasis, 1_000_000);
  assert.equal(y2026.netProfit, 200_000);
});

test("unmatched sell flagged", () => {
  const r = computeOtherIncome([sell("2026-04-02T00:00:00Z", 500_000, 100)]);
  assert.equal(r.unmatchedWarnings.length, 1);
  assert.equal(r.perYear[0].costBasis, 0);
});

test("non-VND quote computed in quote currency", () => {
  const r = computeOtherIncome([
    buy("2026-04-01T00:00:00Z", 1000, 0.025, "USDT"),
    sell("2026-04-02T00:00:00Z", 1500, 0.025, "USDT"),
  ]);
  assert.equal(r.perYear[0].quote, "USDT");
  assert.equal(r.perYear[0].netProfit, 500);
  assert.equal(r.perYear[0].pitRange[0], 50);
});

test("empty input yields zero totals", () => {
  const r = computeOtherIncome([]);
  assert.equal(r.perYear.length, 0);
  assert.equal(r.totals.pit, 0);
});
