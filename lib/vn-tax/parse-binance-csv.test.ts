import assert from "node:assert/strict";
import test from "node:test";
import { parseBinanceCsv } from "./parse-binance-csv";

const ORDER_HEADER =
  "Date(UTC),Pair,Type,Side,Average Price,Price,Executed,Amount,Total,status";

const TRADE_HEADER =
  "Date(UTC),Pair,Type,Order Amount,Average Price,Filled Amount,Total,status";

const P2P_HEADER =
  "Order Number,Order Type,Asset,Fiat Type,Total Price,Price,Quantity,Exchange rate,Maker Fee,Taker Fee,Counterparty,Status,Created Time";

test("parses Order History rows with BUY and SELL sides", () => {
  const csv = [
    ORDER_HEADER,
    "2026-03-28 10:00:00,BTCUSDT,LIMIT,BUY,40000,40000,0.001,0.001,40.00,FILLED",
    "2026-03-29 11:30:00,BTCUSDT,LIMIT,SELL,42000,42000,0.001,0.001,42.00,FILLED",
  ].join("\n");
  const { trades, skipped, format } = parseBinanceCsv(csv);
  assert.equal(format, "order-history");
  assert.equal(trades.length, 2);
  assert.equal(skipped.length, 0);
  assert.equal(trades[0].side, "BUY");
  assert.equal(trades[0].base, "BTC");
  assert.equal(trades[0].quote, "USDT");
  assert.equal(trades[0].grossValue, 40);
  assert.equal(trades[1].side, "SELL");
  assert.equal(trades[1].grossValue, 42);
});

test("derives side from Type for Trade History variant", () => {
  const csv = [
    TRADE_HEADER,
    "2026-03-28 10:00:00,BTCUSDT,BUY,0.001,40000,0.001,40.00,Filled",
    "2026-03-29 11:30:00,BTCUSDT,SELL,0.001,42000,0.001,42.00,Filled",
  ].join("\n");
  const { trades, format } = parseBinanceCsv(csv);
  assert.equal(format, "trade-history");
  assert.equal(trades[0].side, "BUY");
  assert.equal(trades[1].side, "SELL");
});

test("splits pair preferring longest known quote (USDT not USD)", () => {
  const csv = `${ORDER_HEADER}\n2026-03-28 10:00:00,BTCUSDT,LIMIT,BUY,40000,40000,0.001,0.001,40.00,FILLED`;
  const { trades } = parseBinanceCsv(csv);
  assert.equal(trades[0].quote, "USDT");
  assert.equal(trades[0].base, "BTC");
});

test("splits FDUSD pairs before USDC/USD", () => {
  const csv = `${ORDER_HEADER}\n2026-03-28 10:00:00,BTCFDUSD,LIMIT,BUY,40000,40000,0.001,0.001,40.00,FILLED`;
  const { trades } = parseBinanceCsv(csv);
  assert.equal(trades[0].quote, "FDUSD");
});

test("skips rows with invalid date", () => {
  const csv = [
    ORDER_HEADER,
    "not-a-date,BTCUSDT,LIMIT,SELL,42000,42000,0.001,0.001,42.00,FILLED",
  ].join("\n");
  const { trades, skipped } = parseBinanceCsv(csv);
  assert.equal(trades.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /invalid date/);
});

test("skips rows with negative or zero total", () => {
  const csv = [
    ORDER_HEADER,
    "2026-03-28 10:00:00,BTCUSDT,LIMIT,SELL,42000,42000,0.001,0.001,0.00,FILLED",
    "2026-03-28 10:00:00,BTCUSDT,LIMIT,SELL,42000,42000,0.001,0.001,-5.00,FILLED",
  ].join("\n");
  const { trades, skipped } = parseBinanceCsv(csv);
  assert.equal(trades.length, 0);
  assert.equal(skipped.length, 2);
  assert.equal(skipped[0].reason, "invalid total");
});

test("skips rows with unrecognized pair", () => {
  const csv = [
    ORDER_HEADER,
    "2026-03-28 10:00:00,???,LIMIT,SELL,42000,42000,0.001,0.001,42.00,FILLED",
  ].join("\n");
  const { trades, skipped } = parseBinanceCsv(csv);
  assert.equal(trades.length, 0);
  assert.equal(skipped[0].reason, "unrecognized pair");
});

test("skips rows with unrecognized side (Order History)", () => {
  const csv = [
    ORDER_HEADER,
    "2026-03-28 10:00:00,BTCUSDT,LIMIT,WAT,42000,42000,0.001,0.001,42.00,FILLED",
  ].join("\n");
  const { trades, skipped } = parseBinanceCsv(csv);
  assert.equal(trades.length, 0);
  assert.equal(skipped[0].reason, "unrecognized side");
});

test("skips rows when Trade History Type has no buy/sell verb", () => {
  const csv = [
    TRADE_HEADER,
    "2026-03-28 10:00:00,BTCUSDT,unknown,0.001,40000,0.001,40.00,Filled",
  ].join("\n");
  const { skipped } = parseBinanceCsv(csv);
  assert.equal(skipped[0].reason, "unrecognized side");
});

test("empty input returns empty result with null format", () => {
  const { trades, skipped, format } = parseBinanceCsv("");
  assert.deepEqual(trades, []);
  assert.deepEqual(skipped, []);
  assert.equal(format, null);
});

test("unrecognized header marks all body rows as skipped", () => {
  const csv = ["foo,bar", "a,b", "c,d"].join("\n");
  const { trades, skipped, format } = parseBinanceCsv(csv);
  assert.equal(format, null);
  assert.equal(trades.length, 0);
  assert.equal(skipped.length, 2);
  assert.match(skipped[0].reason, /unrecognized CSV format/);
});

test("parses large plain-decimal totals", () => {
  const csv = [
    ORDER_HEADER,
    "2026-03-28 10:00:00,BTCUSDT,LIMIT,SELL,42000,42000,1.0,1.0,42000.00,FILLED",
  ].join("\n");
  const { trades } = parseBinanceCsv(csv);
  assert.equal(trades.length, 1);
  assert.equal(trades[0].grossValue, 42000);
});

test("handles CRLF line endings", () => {
  const csv = [
    ORDER_HEADER,
    "2026-03-28 10:00:00,BTCUSDT,LIMIT,BUY,40000,40000,0.001,0.001,40.00,FILLED",
  ].join("\r\n");
  const { trades, format } = parseBinanceCsv(csv);
  assert.equal(format, "order-history");
  assert.equal(trades.length, 1);
});

test("quoted fields with embedded commas parse correctly", () => {
  // status values sometimes contain commas in some export variants.
  const csv = [
    ORDER_HEADER,
    '2026-03-28 10:00:00,BTCUSDT,LIMIT,SELL,42000,42000,0.001,0.001,42.00,"PARTIAL, FILLED"',
  ].join("\n");
  const { trades } = parseBinanceCsv(csv);
  assert.equal(trades.length, 1);
  assert.equal(trades[0].grossValue, 42);
});

test("parses P2P History rows — the user's exact Buy row", () => {
  const csv = [
    P2P_HEADER,
    "22919067578433675264,Buy,USDT,VND,2300000,26426,87.03,,,0.08,GiaoDichTuDong_247,Completed,2026-08-07 22:33:10",
  ].join("\n");
  const { trades, skipped, format } = parseBinanceCsv(csv);
  assert.equal(format, "p2p-history");
  assert.equal(skipped.length, 0);
  assert.equal(trades.length, 1);
  assert.equal(trades[0].side, "BUY");
  assert.equal(trades[0].base, "USDT");
  assert.equal(trades[0].quote, "VND");
  assert.equal(trades[0].grossValue, 2300000);
  assert.equal(trades[0].pair, "USDTVND");
});

test("P2P Sell uses Total Price as gross VND transfer value", () => {
  const csv = [
    P2P_HEADER,
    "22919067578433675270,Sell,USDT,VND,2400000,27586,87.03,,,0.08,GiaoDichTuDong_247,Completed,2026-08-08 10:05:22",
  ].join("\n");
  const { trades, format } = parseBinanceCsv(csv);
  assert.equal(format, "p2p-history");
  assert.equal(trades[0].side, "SELL");
  assert.equal(trades[0].grossValue, 2400000);
});

test("P2P empty fee cells do not break parsing", () => {
  const csv = [
    P2P_HEADER,
    "1,Sell,USDT,VND,1000000,25000,40,,,0.08,buyer123,Completed,2026-04-01 09:00:00",
  ].join("\n");
  const { trades, skipped } = parseBinanceCsv(csv);
  assert.equal(skipped.length, 0);
  assert.equal(trades[0].grossValue, 1000000);
});

test("P2P empty Total Price is skipped as invalid total", () => {
  const csv = [
    P2P_HEADER,
    "1,Sell,USDT,VND,,,40,,,0.08,buyer123,Completed,2026-04-01 09:00:00",
  ].join("\n");
  const { skipped } = parseBinanceCsv(csv);
  assert.equal(skipped[0].reason, "invalid total");
});

test("P2P row with unrecognized Order Type is skipped", () => {
  const csv = [
    P2P_HEADER,
    "1,Trade,USDT,VND,1000000,25000,40,,,0.08,buyer123,Completed,2026-04-01 09:00:00",
  ].join("\n");
  const { skipped } = parseBinanceCsv(csv);
  assert.equal(skipped[0].reason, "unrecognized side");
});
