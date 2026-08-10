// Business-income PIT calculation for an individual whose crypto trading may
// be characterized as a business (thu nhập từ kinh doanh) under the PIT Law
// 2025 (effective 1 July 2026).
//
// Rules verified from Vietnam Briefing + LuatVietnam + PwC Tax Summaries:
//   - Annual revenue <= VND 500 million  -> PIT exempt (household business).
//   - Annual revenue >  VND 500 million  -> net profit taxed at 15%–20%.
//   - Net profit = FIFO-matched proceeds minus cost basis (enterprise-style
//     expense deduction), per calendar year, per (base, quote) pair.
//
// IMPORTANT: The 500M threshold is denominated in VND REVENUE, not profit. For
// non-VND quotes we cannot apply the threshold without FX history, so the
// engine reports per-pair FIFO net profit and flags the threshold check as
// "VND only — FX required for other quotes."

import type { ParsedTrade } from "./schema";

/** A FIFO lot: remaining base-asset quantity available to match against sells. */
interface Lot {
  date: Date;
  /** Unit cost in the quote currency per 1 unit of base. */
  unitCost: number;
  /** Remaining base-asset quantity. */
  qty: number;
}

export interface YearResult {
  year: number;
  pair: string;
  quote: string;
  /** Sum of gross sell proceeds in the quote currency. */
  revenue: number;
  /** Sum of FIFO-matched buy costs in the quote currency. */
  costBasis: number;
  /** revenue - costBasis. Can be negative if the year had net losses. */
  netProfit: number;
  /** True when the 500M VND revenue threshold can be evaluated (quote === VND). */
  thresholdApplicable: boolean;
  /** Below-threshold (exempt) / above-threshold (15-20%) / unknown (non-VND). */
  status: "exempt" | "taxable" | "unknown-fx";
  /** Estimated PIT range. [low, high] in the quote currency. [0,0] if exempt. */
  pitRange: [number, number];
}

export interface BusinessIncomeResult {
  perYear: YearResult[];
  totals: {
    revenue: number;
    netProfit: number;
    pitLow: number;
    pitHigh: number;
  };
  /** Trades whose sells could not be fully matched (insufficient buy history). */
  unmatchedWarnings: { date: Date; pair: string; qtyMissing: number }[];
}

/** Lower and upper bound of the business-income PIT rate band. */
export const BIZ_PIT_RATE_LOW = 0.15;
export const BIZ_PIT_RATE_HIGH = 0.2;

/** Annual revenue threshold (VND) below which household business PIT is exempt. */
export const BIZ_REVENUE_EXEMPTION_VND = 500_000_000;

const EPSILON = 1e-9;

/**
 * Compute business-income PIT using FIFO matching on base-asset quantity,
 * grouped by (year, pair). Lots carry forward across calendar years.
 *
 * Pairs are decomposed as BASE/QUOTE (e.g. BTCUSDT -> base BTC, quote USDT).
 * For P2P rows the pair is reconstructed as ASSET+FIAT (e.g. USDTVND), so a
 * P2P VND sell is quote === "VND" and the 500M threshold applies directly.
 *
 * Requires the `quantity` field (base-asset units). When a trade lacks qty
 * (null), it cannot be lot-matched and is recorded as an unmatched warning;
 * its revenue still counts toward the threshold check.
 */
export function computeBusinessIncome(trades: ParsedTrade[]): BusinessIncomeResult {
  // Group by pair (base+quote) so FIFO lots don't mix across assets.
  const byPair = new Map<string, ParsedTrade[]>();
  for (const t of trades) {
    if (!byPair.has(t.pair)) byPair.set(t.pair, []);
    byPair.get(t.pair)!.push(t);
  }

  const perYear: YearResult[] = [];
  const unmatchedWarnings: BusinessIncomeResult["unmatchedWarnings"] = [];

  for (const [pair, pairTrades] of byPair) {
    pairTrades.sort((a, b) => a.date.getTime() - b.date.getTime());
    const lots: Lot[] = [];
    const yearAgg = new Map<number, { revenue: number; costBasis: number }>();

    for (const t of pairTrades) {
      const year = t.date.getUTCFullYear();
      if (!yearAgg.has(year)) yearAgg.set(year, { revenue: 0, costBasis: 0 });
      const agg = yearAgg.get(year)!;

      if (t.side === "BUY") {
        if (t.quantity === null) {
          // Buy without qty — skip lot creation (cannot price per unit).
          continue;
        }
        const unitCost = t.grossValue / t.quantity;
        lots.push({ date: t.date, unitCost, qty: t.quantity });
        continue;
      }

      // SELL: consume FIFO lots in base-asset units.
      if (t.quantity === null) {
        // Sell without qty — record revenue but cannot match cost.
        agg.revenue += t.grossValue;
        unmatchedWarnings.push({ date: t.date, pair: t.pair, qtyMissing: 0 });
        continue;
      }
      let remaining = t.quantity;
      let matchedCost = 0;
      while (remaining > EPSILON && lots.length > 0) {
        const lot = lots[0];
        const take = Math.min(remaining, lot.qty);
        matchedCost += take * lot.unitCost;
        lot.qty -= take;
        remaining -= take;
        if (lot.qty <= EPSILON) lots.shift();
      }
      if (remaining > EPSILON) {
        unmatchedWarnings.push({ date: t.date, pair: t.pair, qtyMissing: remaining });
      }
      agg.revenue += t.grossValue;
      agg.costBasis += matchedCost;
    }

    const quote = pairTrades[0].quote;
    for (const [year, agg] of yearAgg) {
      const netProfit = agg.revenue - agg.costBasis;
      const thresholdApplicable = quote === "VND";
      let status: YearResult["status"];
      let pitRange: [number, number];
      if (thresholdApplicable) {
        if (agg.revenue <= BIZ_REVENUE_EXEMPTION_VND) {
          status = "exempt";
          pitRange = [0, 0];
        } else {
          status = "taxable";
          // PIT applies to NET PROFIT (if positive), not revenue.
          const base = Math.max(0, netProfit);
          pitRange = [roundCents(base * BIZ_PIT_RATE_LOW), roundCents(base * BIZ_PIT_RATE_HIGH)];
        }
      } else {
        status = "unknown-fx";
        // Cannot evaluate the VND threshold without FX; show the rate-band
        // estimate on net profit for reference, flagged as needing FX check.
        const base = Math.max(0, netProfit);
        pitRange = [roundCents(base * BIZ_PIT_RATE_LOW), roundCents(base * BIZ_PIT_RATE_HIGH)];
      }
      perYear.push({
        year,
        pair,
        quote,
        revenue: roundCents(agg.revenue),
        costBasis: roundCents(agg.costBasis),
        netProfit: roundCents(netProfit),
        thresholdApplicable,
        status,
        pitRange,
      });
    }
  }

  perYear.sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.pair.localeCompare(b.pair),
  );

  return {
    perYear,
    totals: {
      revenue: roundCents(perYear.reduce((s, r) => s + r.revenue, 0)),
      netProfit: roundCents(perYear.reduce((s, r) => s + r.netProfit, 0)),
      pitLow: roundCents(perYear.reduce((s, r) => s + r.pitRange[0], 0)),
      pitHigh: roundCents(perYear.reduce((s, r) => s + r.pitRange[1], 0)),
    },
    unmatchedWarnings,
  };
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

// "Other income" (thu nhập khác) PIT — flat 10% on net profit, no threshold.
// Applied to crypto cashouts not covered by the licensed-provider 0.1% flow
// (e.g. Binance, foreign platforms, pre-pilot sells). General PIT Law fallback.
// Shares the FIFO engine with computeBusinessIncome but strips the 500M
// threshold (it doesn't apply to "other income") and applies a flat 10%.

/** Flat rate on net profit for "other income" under general PIT Law. */
export const OTHER_INCOME_RATE = 0.1;

export interface OtherIncomeResult {
  perYear: YearResult[];
  totals: {
    revenue: number;
    netProfit: number;
    pit: number;
  };
  unmatchedWarnings: { date: Date; pair: string; qtyMissing: number }[];
}

/**
 * Compute "other income" 10% PIT using FIFO net profit, no exemption threshold.
 * Mirrors computeBusinessIncome's lot matching but applies a flat 10% to net
 * profit whenever positive, for every (year, pair) — no 500M carve-out.
 *
 * Use this for sells the Circular 32 licensed-provider flow does not reach:
 * foreign-exchange trades (Binance), pre-pilot sells, or any case where you
 * self-declare under general PIT rather than rely on provider withholding.
 */
export function computeOtherIncome(trades: ParsedTrade[]): OtherIncomeResult {
  const byPair = new Map<string, ParsedTrade[]>();
  for (const t of trades) {
    if (!byPair.has(t.pair)) byPair.set(t.pair, []);
    byPair.get(t.pair)!.push(t);
  }

  const perYear: YearResult[] = [];
  const unmatchedWarnings: OtherIncomeResult["unmatchedWarnings"] = [];

  for (const [pair, pairTrades] of byPair) {
    pairTrades.sort((a, b) => a.date.getTime() - b.date.getTime());
    const lots: Lot[] = [];
    const yearAgg = new Map<number, { revenue: number; costBasis: number }>();

    for (const t of pairTrades) {
      const year = t.date.getUTCFullYear();
      if (!yearAgg.has(year)) yearAgg.set(year, { revenue: 0, costBasis: 0 });
      const agg = yearAgg.get(year)!;

      if (t.side === "BUY") {
        if (t.quantity === null) continue;
        const unitCost = t.grossValue / t.quantity;
        lots.push({ date: t.date, unitCost, qty: t.quantity });
        continue;
      }

      if (t.quantity === null) {
        agg.revenue += t.grossValue;
        unmatchedWarnings.push({ date: t.date, pair: t.pair, qtyMissing: 0 });
        continue;
      }
      let remaining = t.quantity;
      let matchedCost = 0;
      while (remaining > EPSILON && lots.length > 0) {
        const lot = lots[0];
        const take = Math.min(remaining, lot.qty);
        matchedCost += take * lot.unitCost;
        lot.qty -= take;
        remaining -= take;
        if (lot.qty <= EPSILON) lots.shift();
      }
      if (remaining > EPSILON) {
        unmatchedWarnings.push({ date: t.date, pair: t.pair, qtyMissing: remaining });
      }
      agg.revenue += t.grossValue;
      agg.costBasis += matchedCost;
    }

    const quote = pairTrades[0].quote;
    for (const [year, agg] of yearAgg) {
      const netProfit = agg.revenue - agg.costBasis;
      const base = Math.max(0, netProfit);
      const pit = roundCents(base * OTHER_INCOME_RATE);
      perYear.push({
        year,
        pair,
        quote,
        revenue: roundCents(agg.revenue),
        costBasis: roundCents(agg.costBasis),
        netProfit: roundCents(netProfit),
        // Threshold concept doesn't apply to "other income" — but the field is
        // part of the shared YearResult shape; mark not-applicable.
        thresholdApplicable: false,
        status: "taxable",
        pitRange: [pit, pit],
      });
    }
  }

  perYear.sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.pair.localeCompare(b.pair),
  );

  return {
    perYear,
    totals: {
      revenue: roundCents(perYear.reduce((s, r) => s + r.revenue, 0)),
      netProfit: roundCents(perYear.reduce((s, r) => s + r.netProfit, 0)),
      pit: roundCents(perYear.reduce((s, r) => s + r.pitRange[0], 0)),
    },
    unmatchedWarnings,
  };
}

