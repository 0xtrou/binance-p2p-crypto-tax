import assert from "node:assert/strict";
import test from "node:test";
import { computeBusinessIncome, BIZ_REVENUE_EXEMPTION_VND } from "./business-income";
import type { ParsedTrade } from "./schema";

const vndSell = (dateIso: string, gross: number, qty: number): ParsedTrade => ({
  date: new Date(dateIso),
  pair: "USDTVND",
  base: "USDT",
  quote: "VND",
  side: "SELL",
  grossValue: gross,
  quantity: qty, source: "",
});
const vndBuy = (dateIso: string, gross: number, qty: number): ParsedTrade => ({
  date: new Date(dateIso),
  pair: "USDTVND",
  base: "USDT",
  quote: "VND",
  side: "BUY",
  grossValue: gross,
  quantity: qty, source: "",
});

test("exempt when VND revenue <= 500M", () => {
  const r = computeBusinessIncome([
    vndBuy("2026-04-01T00:00:00Z", 100_000_000, 100),
    vndSell("2026-04-02T00:00:00Z", 100_000_000, 100),
  ]);
  assert.equal(r.perYear.length, 1);
  assert.equal(r.perYear[0].status, "exempt");
  assert.deepEqual(r.perYear[0].pitRange, [0, 0]);
});

test("taxable when VND revenue > 500M; PIT on net profit (15-20%)", () => {
  // Buy 100 USDT for 400M VND (400k/USDT). Sell 100 USDT for 600M VND.
  // revenue 600M > 500M threshold; costBasis 400M; netProfit 200M.
  // PIT: 200M * 15% = 30M, * 20% = 40M.
  const r = computeBusinessIncome([
    vndBuy("2026-04-01T00:00:00Z", 400_000_000, 100),
    vndSell("2026-04-02T00:00:00Z", 600_000_000, 100),
  ]);
  assert.equal(r.perYear[0].status, "taxable");
  assert.equal(r.perYear[0].netProfit, 200_000_000);
  assert.equal(r.perYear[0].pitRange[0], 30_000_000);
  assert.equal(r.perYear[0].pitRange[1], 40_000_000);
});

test("FIFO consumes oldest lot first across multiple buys", () => {
  // Buy lot1: 50 USDT @ 2M/USDT = 100M. Buy lot2: 50 USDT @ 4M/USDT = 200M.
  // Sell 100 USDT for 600M. FIFO cost = 100M (lot1) + 200M (lot2) = 300M.
  const r = computeBusinessIncome([
    vndBuy("2026-04-01T00:00:00Z", 100_000_000, 50),
    vndBuy("2026-04-02T00:00:00Z", 200_000_000, 50),
    vndSell("2026-04-03T00:00:00Z", 600_000_000, 100),
  ]);
  assert.equal(r.perYear[0].costBasis, 300_000_000);
  assert.equal(r.perYear[0].netProfit, 300_000_000);
});

test("cross-year FIFO: Dec 2025 buy matches Jan 2026 sell", () => {
  const r = computeBusinessIncome([
    vndBuy("2025-12-30T00:00:00Z", 500_000_000, 100),
    vndSell("2026-01-05T00:00:00Z", 600_000_000, 100),
  ]);
  // 2025 has only the buy — no revenue, no lot consumed -> not in perYear (empty agg skipped? no, buy creates agg).
  // 2026 revenue 600M > 500M; costBasis 500M; netProfit 100M.
  const y2026 = r.perYear.find((y) => y.year === 2026)!;
  assert.equal(y2026.status, "taxable");
  assert.equal(y2026.costBasis, 500_000_000);
  assert.equal(y2026.netProfit, 100_000_000);
});

test("partial lot consumption leaves remainder for next sell", () => {
  // Buy 100 USDT @ 2M/USDT = 200M total.
  // Sell 1: 50 USDT for 300M. Sell 2: 50 USDT for 350M. Total revenue 650M > 500M.
  // FIFO cost: 50*2M + 50*2M = 200M. netProfit = 650M - 200M = 450M.
  const r = computeBusinessIncome([
    vndBuy("2026-04-01T00:00:00Z", 200_000_000, 100),
    vndSell("2026-04-02T00:00:00Z", 300_000_000, 50),
    vndSell("2026-04-03T00:00:00Z", 350_000_000, 50),
  ]);
  assert.equal(r.perYear[0].costBasis, 200_000_000);
  assert.equal(r.perYear[0].netProfit, 450_000_000);
});

test("sell without matching buy qty is flagged unmatched", () => {
  const r = computeBusinessIncome([vndSell("2026-04-02T00:00:00Z", 600_000_000, 100)]);
  assert.equal(r.unmatchedWarnings.length, 1);
  assert.equal(r.perYear[0].costBasis, 0);
  assert.equal(r.perYear[0].netProfit, 600_000_000);
});

test("non-VND quote flagged as unknown-fx (threshold not evaluated)", () => {
  const r = computeBusinessIncome([
    { date: new Date("2026-04-01T00:00:00Z"), pair: "BTCUSDT", base: "BTC", quote: "USDT", side: "BUY", grossValue: 1000, quantity: 0.025, source: "" },
    { date: new Date("2026-04-02T00:00:00Z"), pair: "BTCUSDT", base: "BTC", quote: "USDT", side: "SELL", grossValue: 1200, quantity: 0.025, source: "" },
  ]);
  assert.equal(r.perYear[0].status, "unknown-fx");
  assert.equal(r.perYear[0].quote, "USDT");
  // netProfit = 1200 - 1000 = 200; PIT 200*15-20% = 30-40.
  assert.deepEqual(r.perYear[0].pitRange, [30, 40]);
});

test("net loss year: PIT floored at zero (no negative tax)", () => {
  // Buy 100 USDT @ 5M/USDT = 500M. Sell 100 USDT @ 4M/USDT = 400M.
  // revenue 400M <= 500M -> exempt regardless. netProfit = 400M - 500M = -100M.
  const r = computeBusinessIncome([
    vndBuy("2026-04-01T00:00:00Z", 500_000_000, 100),
    vndSell("2026-04-02T00:00:00Z", 400_000_000, 100),
  ]);
  assert.equal(r.perYear[0].netProfit, -100_000_000);
  assert.equal(r.perYear[0].status, "exempt");
  assert.deepEqual(r.perYear[0].pitRange, [0, 0]);
});

test("boundary: revenue exactly 500M is exempt", () => {
  const r = computeBusinessIncome([
    vndBuy("2026-04-01T00:00:00Z", 500_000_000, 100),
    vndSell("2026-04-02T00:00:00Z", 500_000_000, 100),
  ]);
  assert.equal(r.perYear[0].revenue, BIZ_REVENUE_EXEMPTION_VND);
  assert.equal(r.perYear[0].status, "exempt");
});

test("taxable loss still floors PIT at zero (netProfit negative)", () => {
  // revenue > 500M but net loss -> taxable status, PIT [0,0].
  // Buy 100 USDT @ 6M = 600M. Sell 100 USDT @ 5.5M = 550M (revenue > 500M).
  // costBasis 600M, netProfit -50M -> PIT floored at 0.
  const r = computeBusinessIncome([
    vndBuy("2026-04-01T00:00:00Z", 600_000_000, 100),
    vndSell("2026-04-02T00:00:00Z", 550_000_000, 100),
  ]);
  assert.equal(r.perYear[0].status, "taxable");
  assert.equal(r.perYear[0].netProfit, -50_000_000);
  assert.deepEqual(r.perYear[0].pitRange, [0, 0]);
});
