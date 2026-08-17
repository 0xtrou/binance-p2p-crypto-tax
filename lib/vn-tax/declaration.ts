import { CIRCULAR_32_EFFECTIVE, PIT_RATE } from "./constants";
import { CLAUSES, type RegulationClause } from "./regulation";
import type { ParsedTrade } from "./schema";

export type DeclBucket = "transfer" | "historic-review" | "buy";

export interface DeclarationRow {
  date: Date;
  pair: string;
  side: "BUY" | "SELL";
  gross: number;
  taxOwed: number;
  bucket: DeclBucket;
  clause: RegulationClause;
  source: string;
}

export interface YearSummary {
  year: number;
  soldVnd: number;
  boughtVnd: number;
  netVnd: number;
  preEffectiveSoldVnd: number;
  preEffectiveBoughtVnd: number;
  preEffectiveNetVnd: number;
  transferTax: number;
  historicReviewSoldVnd: number;
  totalTax: number;
}

export interface AssetFlow {
  asset: string;
  boughtVnd: number;
  soldVnd: number;
  netVnd: number;
}

export interface DeclarationResult {
  rows: DeclarationRow[];
  totals: {
    transferTax: number;
    historicReviewSoldVnd: number;
    totalTax: number;
    totalSoldVnd: number;
    totalBoughtVnd: number;
    totalNetVnd: number;
    totalBuyCount: number;
    totalSellCount: number;
    unmatchedCount: number;
  };
  yearSummaries: YearSummary[];
  assetFlows: AssetFlow[];
}

/**
 * Builds a working record, not a completed tax return.
 *
 * - From 27/03/2026: estimates 0.1% of each sell under Circular 32/2026/TT-BTC.
 * - Before 27/03/2026: records the sell for review but deliberately assigns no
 *   tax. No official source found supports auto-filing 0.1% or a 10% fallback.
 */
export function buildDeclaration(trades: ParsedTrade[]): DeclarationResult {
  const rows: DeclarationRow[] = [];
  const yearAgg = new Map<number, {
    soldVnd: number;
    boughtVnd: number;
    preSoldVnd: number;
    preBoughtVnd: number;
  }>();
  const assetMap = new Map<string, { boughtVnd: number; soldVnd: number }>();

  for (const trade of trades) {
    const year = trade.date.getUTCFullYear();
    if (!yearAgg.has(year)) yearAgg.set(year, { soldVnd: 0, boughtVnd: 0, preSoldVnd: 0, preBoughtVnd: 0 });
    const yearAggregate = yearAgg.get(year)!;

    if (!assetMap.has(trade.base)) assetMap.set(trade.base, { boughtVnd: 0, soldVnd: 0 });
    const assetFlow = assetMap.get(trade.base)!;
    const isPostEffective = trade.date.getTime() >= CIRCULAR_32_EFFECTIVE.getTime();

    if (trade.side === "BUY") {
      yearAggregate.boughtVnd += trade.grossValue;
      if (!isPostEffective) yearAggregate.preBoughtVnd += trade.grossValue;
      assetFlow.boughtVnd += trade.grossValue;
      rows.push({
        date: trade.date,
        pair: trade.pair,
        side: "BUY",
        gross: trade.grossValue,
        taxOwed: 0,
        bucket: "buy",
        clause: CLAUSES.rate,
        source: trade.source,
      });
      continue;
    }

    yearAggregate.soldVnd += trade.grossValue;
    assetFlow.soldVnd += trade.grossValue;
    if (!isPostEffective) yearAggregate.preSoldVnd += trade.grossValue;

    rows.push({
      date: trade.date,
      pair: trade.pair,
      side: "SELL",
      gross: trade.grossValue,
      taxOwed: isPostEffective ? roundCents(trade.grossValue * PIT_RATE) : 0,
      bucket: isPostEffective ? "transfer" : "historic-review",
      clause: isPostEffective ? CLAUSES.rate : CLAUSES.historicUncertainty,
      source: trade.source,
    });
  }

  rows.sort((first, second) => second.date.getTime() - first.date.getTime());

  const yearSummaries: YearSummary[] = [];
  for (const [year, yearAggregate] of yearAgg) {
    const transferTax = rows
      .filter((row) => row.bucket === "transfer" && row.date.getUTCFullYear() === year)
      .reduce((sum, row) => sum + row.taxOwed, 0);
    const preEffectiveNetVnd = yearAggregate.preSoldVnd - yearAggregate.preBoughtVnd;

    yearSummaries.push({
      year,
      soldVnd: roundCents(yearAggregate.soldVnd),
      boughtVnd: roundCents(yearAggregate.boughtVnd),
      netVnd: roundCents(yearAggregate.soldVnd - yearAggregate.boughtVnd),
      preEffectiveSoldVnd: roundCents(yearAggregate.preSoldVnd),
      preEffectiveBoughtVnd: roundCents(yearAggregate.preBoughtVnd),
      preEffectiveNetVnd: roundCents(preEffectiveNetVnd),
      transferTax: roundCents(transferTax),
      historicReviewSoldVnd: roundCents(yearAggregate.preSoldVnd),
      totalTax: roundCents(transferTax),
    });
  }
  yearSummaries.sort((first, second) => first.year - second.year);

  const assetFlows: AssetFlow[] = [...assetMap.entries()]
    .map(([asset, flow]) => ({
      asset,
      boughtVnd: roundCents(flow.boughtVnd),
      soldVnd: roundCents(flow.soldVnd),
      netVnd: roundCents(flow.soldVnd - flow.boughtVnd),
    }))
    .sort((first, second) => second.soldVnd - first.soldVnd);

  const allSold = rows.filter((row) => row.side === "SELL");
  const allBought = rows.filter((row) => row.side === "BUY");
  const totalSoldVnd = allSold.reduce((sum, row) => sum + row.gross, 0);
  const totalBoughtVnd = allBought.reduce((sum, row) => sum + row.gross, 0);
  const historicReviewSoldVnd = rows
    .filter((row) => row.bucket === "historic-review")
    .reduce((sum, row) => sum + row.gross, 0);
  const transferTax = rows
    .filter((row) => row.bucket === "transfer")
    .reduce((sum, row) => sum + row.taxOwed, 0);

  return {
    rows,
    totals: {
      transferTax: roundCents(transferTax),
      historicReviewSoldVnd: roundCents(historicReviewSoldVnd),
      totalTax: roundCents(transferTax),
      totalSoldVnd: roundCents(totalSoldVnd),
      totalBoughtVnd: roundCents(totalBoughtVnd),
      totalNetVnd: roundCents(totalSoldVnd - totalBoughtVnd),
      totalBuyCount: allBought.length,
      totalSellCount: allSold.length,
      unmatchedCount: 0,
    },
    yearSummaries,
    assetFlows,
  };
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
