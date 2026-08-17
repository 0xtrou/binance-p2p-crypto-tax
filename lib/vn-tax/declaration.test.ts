import assert from "node:assert/strict";
import test from "node:test";
import { CIRCULAR_32_EFFECTIVE } from "./constants";
import { buildDeclaration } from "./declaration";
import type { ParsedTrade } from "./schema";

function trade(date: string, side: "BUY" | "SELL", grossValue: number, base = "USDT"): ParsedTrade {
  return {
    date: new Date(date),
    side,
    grossValue,
    base,
    quote: "VND",
    pair: `${base}VND`,
    source: "Binance",
    quantity: null,
  };
}

const buy = (date: string, grossValue: number, base?: string) => trade(date, "BUY", grossValue, base);
const sell = (date: string, grossValue: number, base?: string) => trade(date, "SELL", grossValue, base);

test("BUY row: taxOwed = 0, bucket = buy", () => {
  const result = buildDeclaration([buy("2025-01-01T00:00:00Z", 1_000_000)]);
  assert.equal(result.rows[0].bucket, "buy");
  assert.equal(result.rows[0].taxOwed, 0);
  assert.equal(result.totals.totalTax, 0);
});

test("SELL from 27/03/2026: estimates 0.1% on gross", () => {
  const result = buildDeclaration([sell(CIRCULAR_32_EFFECTIVE.toISOString(), 1_000_000)]);
  const row = result.rows[0];
  assert.equal(row.bucket, "transfer");
  assert.equal(row.taxOwed, 1_000);
  assert.equal(result.totals.transferTax, 1_000);
  assert.equal(result.totals.totalTax, 1_000);
});

test("SELL before 27/03/2026: records review item without auto-tax", () => {
  const result = buildDeclaration([sell("2024-01-01T00:00:00Z", 1_000_000)]);
  const row = result.rows[0];
  assert.equal(row.bucket, "historic-review");
  assert.equal(row.taxOwed, 0);
  assert.equal(result.totals.historicReviewSoldVnd, 1_000_000);
  assert.equal(result.totals.totalTax, 0);
});

test("historic sales never become a 10% tax estimate", () => {
  const result = buildDeclaration([
    buy("2024-01-01T00:00:00Z", 100_000_000),
    sell("2024-06-01T00:00:00Z", 600_000_000),
  ]);
  const year = result.yearSummaries[0];
  assert.equal(year.preEffectiveNetVnd, 500_000_000);
  assert.equal(year.historicReviewSoldVnd, 600_000_000);
  assert.equal(year.totalTax, 0);
});

test("year summary separates historical review amount from post-effective tax", () => {
  const result = buildDeclaration([
    sell("2024-01-01T00:00:00Z", 1_000_000),
    sell(CIRCULAR_32_EFFECTIVE.toISOString(), 2_000_000),
  ]);
  const historicYear = result.yearSummaries.find((year) => year.year === 2024)!;
  const currentYear = result.yearSummaries.find((year) => year.year === 2026)!;
  assert.equal(historicYear.transferTax, 0);
  assert.equal(historicYear.historicReviewSoldVnd, 1_000_000);
  assert.equal(currentYear.transferTax, 2_000);
  assert.equal(currentYear.historicReviewSoldVnd, 0);
});

test("asset flow totals purchases and sales by asset", () => {
  const result = buildDeclaration([
    buy("2024-01-01T00:00:00Z", 50_000_000, "USDT"),
    sell("2024-06-01T00:00:00Z", 80_000_000, "USDT"),
    buy("2024-01-01T00:00:00Z", 20_000_000, "ETH"),
    sell("2024-06-01T00:00:00Z", 30_000_000, "ETH"),
  ]);
  const usdt = result.assetFlows.find((flow) => flow.asset === "USDT")!;
  const eth = result.assetFlows.find((flow) => flow.asset === "ETH")!;
  assert.equal(usdt.netVnd, 30_000_000);
  assert.equal(eth.netVnd, 10_000_000);
});

test("empty input yields an empty working record", () => {
  const result = buildDeclaration([]);
  assert.equal(result.rows.length, 0);
  assert.equal(result.totals.totalTax, 0);
  assert.equal(result.totals.historicReviewSoldVnd, 0);
});
