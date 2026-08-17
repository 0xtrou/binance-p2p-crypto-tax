import assert from "node:assert/strict";
import test from "node:test";
import { CIRCULAR_32_EFFECTIVE } from "./constants";
import { classifyTrade, OFFICIAL_SOURCES } from "./regulation";

test("classifies a buy as not taxed by the estimator", () => {
  const classification = classifyTrade({ date: CIRCULAR_32_EFFECTIVE, side: "BUY", grossValue: 1_000 });
  assert.equal(classification.bucket, "buy");
  assert.equal(classification.payment, 0);
  assert.match(classification.reason, /Lệnh mua/);
});

test("classifies a pre-effective sell as a zero-tax review item", () => {
  const classification = classifyTrade({ date: new Date("2026-03-26T00:00:00Z"), side: "SELL", grossValue: 1_000 });
  assert.equal(classification.bucket, "grey-zone");
  assert.equal(classification.payment, 0);
  assert.equal(classification.clause.id, "Giai đoạn trước 27/03/2026");
});

test("classifies a sell on the effective date at 0.1%", () => {
  const classification = classifyTrade({ date: CIRCULAR_32_EFFECTIVE, side: "SELL", grossValue: 5_000_000 });
  assert.equal(classification.bucket, "taxable");
  assert.equal(classification.payment, 5_000);
  assert.equal(classification.clause.id, "Thông tư 32/2026/TT-BTC");
});

test("retains official source links for the published notice", () => {
  assert.equal(OFFICIAL_SOURCES.length, 3);
  assert.ok(OFFICIAL_SOURCES.every((source) => source.url.startsWith("https://")));
});
