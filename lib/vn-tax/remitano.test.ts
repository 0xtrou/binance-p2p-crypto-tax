import assert from "node:assert/strict";
import test from "node:test";
import { parseBinanceCsv } from "./parse-binance-csv";

const REM_HEADER =
  "ref,coin currency,buy or sell,seller username,buyer username,coin amount,fiat amount,created at,paid at,released at,payment details";

test("detects Remitano format", () => {
  const csv = `${REM_HEADER}\n2009696T75928196,vndr,sell,khangtd,ngocqn91,-98006264.0,98006264.0,2024-09-30 08:11:38 +0700,2024-09-30 08:14:04 +0700,2024-09-30 08:16:45 +0700,""`;
  const { format, trades } = parseBinanceCsv(csv);
  assert.equal(format, "remitano");
  assert.equal(trades.length, 1);
});

test("parses VNDR sell with positive fiat as gross VND", () => {
  const csv = `${REM_HEADER}\n2009696T75928196,vndr,sell,khangtd,ngocqn91,-98006264.0,98006264.0,2024-09-30 08:11:38 +0700,2024-09-30 08:14:04 +0700,2024-09-30 08:16:45 +0700,""`;
  const { trades } = parseBinanceCsv(csv);
  assert.equal(trades[0].side, "SELL");
  assert.equal(trades[0].base, "VNDR");
  assert.equal(trades[0].quote, "VND");
  assert.equal(trades[0].pair, "VNDRVND");
  assert.equal(trades[0].grossValue, 98_006_264);
  assert.equal(trades[0].quantity, 98_006_264);
});

test("parses buy with negative fiat (abs taken for gross)", () => {
  const csv = `${REM_HEADER}\n1879749T27714831,vndr,buy,tad92,khangtd,15000000.0,-15000000.0,2023-11-29 10:11:15 +0700,2023-11-29 10:12:58 +0700,2023-11-29 10:13:06 +0700,""`;
  const { trades } = parseBinanceCsv(csv);
  assert.equal(trades[0].side, "BUY");
  assert.equal(trades[0].grossValue, 15_000_000);
});

test("parses ETH/USDT/BTC rows with VND quote", () => {
  const csv = [
    REM_HEADER,
    '134823T00138332,eth,sell,khangtd,baobinh,-0.99100826,3209908.0,2020-03-21 10:19:40 +0700,2020-03-21 10:19:40 +0700,2020-03-21 10:19:41 +0700,""',
    '899681T37035516,usdt,sell,khangtd,bietdoixekhongkinh8888,-99.35,2428225.0,2020-03-21 10:18:01 +0700,2020-03-21 10:18:01 +0700,2020-03-21 10:18:01 +0700,""',
    '260512T39449852,btc,sell,khangtd,nhamnv,-0.0924,12883857.0,2018-06-27 13:01:50 +0700,2018-06-27 13:01:50 +0700,2018-06-27 13:01:50 +0700,""',
  ].join("\n");
  const { trades } = parseBinanceCsv(csv);
  assert.equal(trades[0].base, "ETH");
  assert.equal(trades[0].pair, "ETHVND");
  assert.equal(trades[0].quantity, 0.99100826);
  assert.equal(trades[1].base, "USDT");
  assert.equal(trades[2].base, "BTC");
});

test("timezone offset +0700 correctly converted to UTC instant", () => {
  // 2024-09-30 08:16:45 +0700 = 2024-09-30 01:16:45 UTC
  const csv = `${REM_HEADER}\n2009696T75928196,vndr,sell,khangtd,ngocqn91,-98006264.0,98006264.0,2024-09-30 08:11:38 +0700,2024-09-30 08:14:04 +0700,2024-09-30 08:16:45 +0700,""`;
  const { trades } = parseBinanceCsv(csv);
  const expected = new Date("2024-09-30T01:16:45Z");
  assert.equal(trades[0].date.getTime(), expected.getTime());
});

test("multiline quoted payment_details does not break row parsing", () => {
  // Real Remitano rows have 5-line payment_details with embedded newlines.
  const csv = [
    REM_HEADER,
    '2009696T75928196,vndr,sell,khangtd,ngocqn91,-98006264.0,98006264.0,2024-09-30 08:11:38 +0700,2024-09-30 08:14:04 +0700,2024-09-30 08:16:45 +0700,"bank_name: Vietcombank\npayment_method: local_bank\nbank_account_name: TRAN DINH KHANG\nbank_account_number: 0461000538115"',
  ].join("\n");
  const { trades, skipped } = parseBinanceCsv(csv);
  assert.equal(skipped.length, 0);
  assert.equal(trades.length, 1);
  assert.equal(trades[0].grossValue, 98_006_264);
});

test("escaped quotes inside payment_details handled", () => {
  const csv = `${REM_HEADER}\n1,vndr,sell,a,b,-1000.0,1000.0,2024-01-01 00:00:00 +0700,2024-01-01 00:00:00 +0700,2024-01-01 00:00:00 +0700,"note: ""important"""`;
  const { trades } = parseBinanceCsv(csv);
  assert.equal(trades.length, 1);
});

test("skips rows with unrecognized side", () => {
  const csv = `${REM_HEADER}\n1,vndr,trade,a,b,-1000.0,1000.0,2024-01-01 00:00:00 +0700,2024-01-01 00:00:00 +0700,2024-01-01 00:00:00 +0700,""`;
  const { skipped } = parseBinanceCsv(csv);
  assert.equal(skipped[0].reason, "unrecognized side");
});

test("skips rows with invalid date", () => {
  const csv = `${REM_HEADER}\n1,vndr,sell,a,b,-1000.0,1000.0,not-a-date,not-a-date,not-a-date,""`;
  const { skipped } = parseBinanceCsv(csv);
  assert.equal(skipped[0].reason, "invalid date");
});

test("falls back to created at when released at blank", () => {
  const csv = `${REM_HEADER}\n1,vndr,sell,a,b,-1000.0,1000.0,2024-01-01 00:00:00 +0700,,,""`;
  const { trades } = parseBinanceCsv(csv);
  assert.equal(trades.length, 1);
  assert.equal(trades[0].date.getTime(), new Date("2023-12-31T17:00:00Z").getTime());
});

test("CRLF line endings handled with multiline quotes", () => {
  const csv = [
    REM_HEADER,
    '1,vndr,sell,a,b,-1000.0,1000.0,2024-01-01 00:00:00 +0700,2024-01-01 00:00:00 +0700,2024-01-01 00:00:00 +0700,"bank_name: VCB\r\nbank_account_name: KHANG"',
    '2,vndr,sell,a,b,-2000.0,2000.0,2024-01-02 00:00:00 +0700,2024-01-02 00:00:00 +0700,2024-01-02 00:00:00 +0700,""',
  ].join("\r\n");
  const { trades } = parseBinanceCsv(csv);
  assert.equal(trades.length, 2);
  assert.equal(trades[0].grossValue, 1000);
  assert.equal(trades[1].grossValue, 2000);
});
