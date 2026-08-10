// Unified PIT declaration builder. One row per trade, with FIFO-matched cost
// basis, bucket assignment, matched clause, and VND owed. This is THE
// declaration artifact — the table a taxpayer files.
//
// Bucket priority per SELL:
//   1. Post-27-Mar-2026 → Transfer 0.1% (Circular 32 Art. 5)
//   2. Pre-27-Mar-2026 → Other income 10% (thu nhập khác, general PIT fallback)
// Buys: not taxed, shown as cost-basis source.
//
// Business income 15-20% is annual (threshold check), not per-trade. It appears
// as a year-aggregate summary note, not per-row.

import { CIRCULAR_32_EFFECTIVE, PIT_RATE } from "./constants";
import { CLAUSES, type RegulationClause } from "./regulation";
import type { ParsedTrade } from "./schema";

export type DeclBucket = "transfer" | "other-income" | "buy";

export interface DeclarationRow {
  date: Date;
  pair: string;
  side: "BUY" | "SELL";
  gross: number;
  /** FIFO-matched cost in quote currency. 0 for buys (they ARE the cost). */
  matchedCost: number;
  /** gross - matchedCost. Negative = loss. */
  netProfit: number;
  bucket: DeclBucket;
  clause: RegulationClause;
  /** VND owed on this trade. 0 for buys. */
  taxOwed: number;
  /** True if sell had no matching buy lots (cost unknown from CSV). */
  unmatched: boolean;
}

export interface YearBusinessNote {
  year: number;
  revenue: number;
  netProfit: number;
  overThreshold: boolean;
  pitLow: number;
  pitHigh: number;
}

export interface DeclarationResult {
  rows: DeclarationRow[];
  totals: {
    transferTax: number;
    otherIncomeTax: number;
    totalTax: number;
    totalRevenue: number;
    totalCost: number;
    totalNetProfit: number;
    unmatchedCount: number;
  };
  businessNotes: YearBusinessNote[];
}

const BIZ_RATE_LOW = 0.15;
const BIZ_RATE_HIGH = 0.2;
const BIZ_THRESHOLD_VND = 500_000_000;
const OTHER_INCOME_RATE = 0.1;
const EPSILON = 1e-9;

interface Lot {
  unitCost: number;
  qty: number;
}

/**
 * Build the unified declaration: one row per trade with FIFO cost matching,
 * bucket assignment, clause, and VND owed. Also produces annual business-income
 * notes (the 15-20% alternative characterization above 500M VND revenue).
 */
export function buildDeclaration(trades: ParsedTrade[]): DeclarationResult {
  // Group by pair (base+quote) so FIFO lots don't mix across assets.
  const byPair = new Map<string, ParsedTrade[]>();
  for (const t of trades) {
    if (!byPair.has(t.pair)) byPair.set(t.pair, []);
    byPair.get(t.pair)!.push(t);
  }

  const rows: DeclarationRow[] = [];
  const unmatchedCount = { count: 0 };

  // Per-(year, pair) revenue + netProfit for business income annual check.
  const yearPairAgg = new Map<string, { revenue: number; netProfit: number; quote: string }>();

  for (const [, pairTrades] of byPair) {
    pairTrades.sort((a, b) => a.date.getTime() - b.date.getTime());
    const lots: Lot[] = [];

    for (const t of pairTrades) {
      if (t.side === "BUY") {
        if (t.quantity !== null) {
          lots.push({ unitCost: t.grossValue / t.quantity, qty: t.quantity });
        }
        rows.push({
          date: t.date,
          pair: t.pair,
          side: "BUY",
          gross: t.grossValue,
          matchedCost: 0,
          netProfit: 0,
          bucket: "buy",
          clause: CLAUSES.notTransfer,
          taxOwed: 0,
          unmatched: false,
        });
        continue;
      }

      // SELL: FIFO match.
      let matchedCost = 0;
      let unmatched = false;
      if (t.quantity === null) {
        unmatched = true;
      } else {
        let remaining = t.quantity;
        while (remaining > EPSILON && lots.length > 0) {
          const lot = lots[0];
          const take = Math.min(remaining, lot.qty);
          matchedCost += take * lot.unitCost;
          lot.qty -= take;
          remaining -= take;
          if (lot.qty <= EPSILON) lots.shift();
        }
        if (remaining > EPSILON) unmatched = true;
      }
      if (unmatched) unmatchedCount.count++;

      const netProfit = t.grossValue - matchedCost;
      const isPostEffective = t.date.getTime() >= CIRCULAR_32_EFFECTIVE.getTime();

      let bucket: DeclBucket;
      let clause: RegulationClause;
      let taxOwed: number;
      if (isPostEffective) {
        bucket = "transfer";
        clause = CLAUSES.rate;
        taxOwed = roundCents(t.grossValue * PIT_RATE);
      } else {
        bucket = "other-income";
        clause = CLAUSES.otherIncome;
        // 10% on net profit if positive; losses floor at 0.
        taxOwed = roundCents(Math.max(0, netProfit) * OTHER_INCOME_RATE);
      }

      rows.push({
        date: t.date,
        pair: t.pair,
        side: "SELL",
        gross: t.grossValue,
        matchedCost: roundCents(matchedCost),
        netProfit: roundCents(netProfit),
        bucket,
        clause,
        taxOwed,
        unmatched,
      });

      // Aggregate for business income annual check.
      const year = t.date.getUTCFullYear();
      const key = `${year}|${t.pair}`;
      const agg = yearPairAgg.get(key) ?? { revenue: 0, netProfit: 0, quote: t.quote };
      agg.revenue += t.grossValue;
      agg.netProfit += netProfit;
      yearPairAgg.set(key, agg);
    }
  }

  // Sort rows newest-first for display.
  rows.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Build business income notes: only VND pairs, only years above 500M revenue.
  const businessNotes: YearBusinessNote[] = [];
  for (const [key, agg] of yearPairAgg) {
    if (agg.quote !== "VND") continue;
    const [yearStr] = key.split("|");
    const year = Number(yearStr);
    const overThreshold = agg.revenue > BIZ_THRESHOLD_VND;
    if (!overThreshold) continue; // below threshold = exempt, no note needed
    const base = Math.max(0, agg.netProfit);
    businessNotes.push({
      year,
      revenue: roundCents(agg.revenue),
      netProfit: roundCents(agg.netProfit),
      overThreshold: true,
      pitLow: roundCents(base * BIZ_RATE_LOW),
      pitHigh: roundCents(base * BIZ_RATE_HIGH),
    });
  }
  businessNotes.sort((a, b) => a.year - b.year);

  const sells = rows.filter((r) => r.side === "SELL");
  const transferRows = sells.filter((r) => r.bucket === "transfer");
  const otherRows = sells.filter((r) => r.bucket === "other-income");

  return {
    rows,
    totals: {
      transferTax: roundCents(transferRows.reduce((s, r) => s + r.taxOwed, 0)),
      otherIncomeTax: roundCents(otherRows.reduce((s, r) => s + r.taxOwed, 0)),
      totalTax: roundCents(sells.reduce((s, r) => s + r.taxOwed, 0)),
      totalRevenue: roundCents(sells.reduce((s, r) => s + r.gross, 0)),
      totalCost: roundCents(sells.reduce((s, r) => s + r.matchedCost, 0)),
      totalNetProfit: roundCents(sells.reduce((s, r) => s + r.netProfit, 0)),
      unmatchedCount: unmatchedCount.count,
    },
    businessNotes,
  };
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
