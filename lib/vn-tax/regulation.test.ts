import assert from "node:assert/strict";
import test from "node:test";
import { classifyTrade } from "./regulation";
import { CIRCULAR_32_EFFECTIVE } from "./constants";

test("classifies a buy as not-taxed with the not-transfer clause", () => {
  const c = classifyTrade({ date: CIRCULAR_32_EFFECTIVE, side: "BUY", grossValue: 1000 });
  assert.equal(c.bucket, "buy");
  assert.equal(c.payment, 0);
  assert.equal(c.clause.id, "—");
  assert.match(c.reason, /Buy/);
});

test("classifies a pre-effective sell as grey-zone with $0 payment", () => {
  const before = new Date("2026-03-26T00:00:00Z");
  const c = classifyTrade({ date: before, side: "SELL", grossValue: 1000 });
  assert.equal(c.bucket, "grey-zone");
  assert.equal(c.payment, 0);
  assert.match(c.reason, /Pre 27 Mar 2026/);
});

test("classifies an on-effective sell as taxable at 0.1%", () => {
  const c = classifyTrade({
    date: CIRCULAR_32_EFFECTIVE,
    side: "SELL",
    grossValue: 5000000,
  });
  assert.equal(c.bucket, "taxable");
  assert.equal(c.payment, 5000); // 5,000,000 * 0.001
  assert.equal(c.clause.id, "Art. 5");
  assert.match(c.reason, /0.1%/);
});

test("taxable classification always cites Art. 5", () => {
  const c = classifyTrade({
    date: new Date("2026-08-07T22:33:10Z"),
    side: "SELL",
    grossValue: 2300000,
  });
  assert.equal(c.bucket, "taxable");
  assert.equal(c.clause.id, "Art. 5");
  assert.equal(c.payment, 2300);
});

test("buy classification applies regardless of date (even post-effective)", () => {
  const c = classifyTrade({
    date: new Date("2026-08-08T00:00:00Z"),
    side: "BUY",
    grossValue: 9999,
  });
  assert.equal(c.bucket, "buy");
  assert.equal(c.payment, 0);
});
