import assert from "node:assert/strict";
import test from "node:test";
import { computeTax } from "./compute-tax";
import { CIRCULAR_32_EFFECTIVE } from "./constants";
import type { ParsedTrade } from "./schema";

const sell = (dateIso: string, quote: string, grossValue: number): ParsedTrade => {
  const base = "BTC";
  return {
    date: new Date(dateIso),
    pair: `${base}${quote}`,
    base,
    quote,
    side: "SELL",
    grossValue,
    quantity: 1,
  };
};

const buy = (dateIso: string, grossValue: number): ParsedTrade => ({
  date: new Date(dateIso),
  pair: "BTCUSDT",
  base: "BTC",
  quote: "USDT",
  side: "BUY",
  grossValue,
  quantity: 1,
});

test("taxes a sell on the effective date", () => {
  const on = CIRCULAR_32_EFFECTIVE.toISOString();
  const { taxable, greyZone, totals } = computeTax([sell(on, "USDT", 1000)]);
  assert.equal(taxable.length, 1);
  assert.equal(taxable[0].tax, 1); // 1000 * 0.001
  assert.equal(greyZone.length, 0);
  assert.equal(totals.taxableSellCount, 1);
  assert.equal(totals.greyZoneCount, 0);
});

test("a sell the day before effective lands in grey zone with $0 tax", () => {
  const before = "2026-03-26T00:00:00Z";
  const { taxable, greyZone, totals } = computeTax([sell(before, "USDT", 1000)]);
  assert.equal(taxable.length, 0);
  assert.equal(greyZone.length, 1);
  assert.equal(totals.greyZoneCount, 1);
  assert.equal(totals.taxableSellCount, 0);
});

test("buys are never taxed", () => {
  const on = CIRCULAR_32_EFFECTIVE.toISOString();
  const { taxable, buys, totals } = computeTax([buy(on, 5000), buy(on, 1000)]);
  assert.equal(taxable.length, 0);
  assert.equal(buys.length, 2);
  assert.equal(totals.buyCount, 2);
  assert.equal(totals.taxableSellCount, 0);
});

test("groups totals by quote currency", () => {
  const on = CIRCULAR_32_EFFECTIVE.toISOString();
  const { totalsByQuote } = computeTax([
    sell(on, "USDT", 1000),
    sell(on, "USDT", 2000),
    sell(on, "EUR", 500),
  ]);
  assert.deepEqual(totalsByQuote.USDT, { grossProceeds: 3000, tax: 3, count: 2 });
  assert.deepEqual(totalsByQuote.EUR, { grossProceeds: 500, tax: 0.5, count: 1 });
});

test("tax rate is exactly 0.1% of gross transfer price", () => {
  const on = CIRCULAR_32_EFFECTIVE.toISOString();
  const { taxable } = computeTax([sell(on, "USDT", 42000)]);
  assert.equal(taxable[0].tax, 42);
});

test("empty input yields zero totals", () => {
  const r = computeTax([]);
  assert.equal(r.taxable.length, 0);
  assert.equal(r.greyZone.length, 0);
  assert.equal(r.buys.length, 0);
  assert.deepEqual(r.totalsByQuote, {});
});

test("mixed dataset sorts into correct buckets", () => {
  const on = CIRCULAR_32_EFFECTIVE.toISOString();
  const { taxable, greyZone, buys, totals } = computeTax([
    buy("2026-03-01T00:00:00Z", 1000), // pre-effective buy
    buy(on, 2000), // post-effective buy
    sell("2026-03-26T00:00:00Z", "USDT", 3000), // grey-zone sell
    sell(on, "USDT", 4000), // taxable sell
  ]);
  assert.equal(totals.buyCount, 2);
  assert.equal(totals.greyZoneCount, 1);
  assert.equal(totals.taxableSellCount, 1);
  assert.equal(taxable[0].tax, 4);
  assert.equal(greyZone.length, 1);
  assert.equal(buys.length, 2);
});
