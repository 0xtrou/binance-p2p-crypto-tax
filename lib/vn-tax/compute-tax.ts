import { CIRCULAR_32_EFFECTIVE, PIT_RATE } from "./constants";
import type { ParsedTrade } from "./schema";

/** A sell that falls under Circular 32/2026/TT-BTC and carries 0.1% PIT. */
export interface TaxedTrade {
  date: Date;
  pair: string;
  base: string;
  quote: string;
  grossValue: number;
  /** grossValue * PIT_RATE. */
  tax: number;
}

/** Totals for one quote currency (e.g. all USDT-priced sells grouped). */
export interface QuoteTotals {
  grossProceeds: number;
  tax: number;
  count: number;
}

export interface TaxResult {
  /** Sells on or after the Circular 32 effective date — taxed at 0.1%. */
  taxable: TaxedTrade[];
  /** Sells before the effective date — $0 tax, pre-pilot grey zone. */
  greyZone: ParsedTrade[];
  /** BUY rows — not taxed, retained for the audit table. */
  buys: ParsedTrade[];
  /** Tax + gross grouped by quote currency. */
  totalsByQuote: Record<string, QuoteTotals>;
  totals: {
    taxableSellCount: number;
    greyZoneCount: number;
    buyCount: number;
  };
}

/**
 * Compute Vietnam PIT on a list of parsed trades under Circular 32/2026/TT-BTC.
 *
 * Art. 5 levies 0.1% on the *transfer price* of each sale by an individual,
 * applied only to transfers dated on or after 27 Mar 2026 (the Circular's
 * effective date). Buys are acquisitions, not transfers — not taxed. Pre-
 * effective-date sells fall outside the Circular and land in the grey-zone
 * bucket at $0 tax.
 *
 * This is a pure function: same input → same output, no side effects.
 */
export function computeTax(trades: ParsedTrade[]): TaxResult {
  const taxable: TaxedTrade[] = [];
  const greyZone: ParsedTrade[] = [];
  const buys: ParsedTrade[] = [];
  const totalsByQuote: Record<string, QuoteTotals> = {};

  for (const t of trades) {
    if (t.side === "BUY") {
      buys.push(t);
      continue;
    }
    if (t.date.getTime() < CIRCULAR_32_EFFECTIVE.getTime()) {
      greyZone.push(t);
      continue;
    }
    const tax = roundCents(t.grossValue * PIT_RATE);
    taxable.push({
      date: t.date,
      pair: t.pair,
      base: t.base,
      quote: t.quote,
      grossValue: t.grossValue,
      tax,
    });
    const bucket = totalsByQuote[t.quote] ?? { grossProceeds: 0, tax: 0, count: 0 };
    bucket.grossProceeds = roundCents(bucket.grossProceeds + t.grossValue);
    bucket.tax = roundCents(bucket.tax + tax);
    bucket.count += 1;
    totalsByQuote[t.quote] = bucket;
  }

  return {
    taxable,
    greyZone,
    buys,
    totalsByQuote,
    totals: {
      taxableSellCount: taxable.length,
      greyZoneCount: greyZone.length,
      buyCount: buys.length,
    },
  };
}

/** Round to the currency's minor unit (cent-equivalent) to absorb float noise. */
function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
