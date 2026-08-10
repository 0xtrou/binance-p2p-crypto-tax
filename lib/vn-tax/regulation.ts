// Structured citations to the primary legal sources backing each computation
// step. Kept separate from the component so the mapping is auditable and
// unit-testable. Every clause below is quoted or paraphrased from the official
// English translation of Circular 32/2026/TT-BTC read in full (ssc.gov.vn), or
// from Resolution 05/2025/NQ-CP via the government portal.

export interface RegulationClause {
  /** Short handle, e.g. "Art. 5". */
  id: string;
  /** Full instrument reference. */
  instrument: string;
  /** Effective date or period. */
  effective: string;
  /** Verbatim or close paraphrase of the operative text. */
  text: string;
}

export const CLAUSES = {
  rate: {
    id: "Art. 5",
    instrument: "Circular 32/2026/TT-BTC (Bộ Tài chính)",
    effective: "27 March 2026, for the pilot period",
    text: 'Individual investors (regardless of whether they are residents or non-residents) who transfer crypto assets through a crypto asset service provider are subject to personal income tax at a rate of 0.1% on the transfer price for each transaction.',
  },
  base: {
    id: "Art. 5",
    instrument: "Circular 32/2026/TT-BTC (Bộ Tài chính)",
    effective: "27 March 2026",
    text: 'Circular 32 levies 0.1% on the "transfer price" (giá chuyển nhượng) but does NOT define the term precisely. Tool reads it as gross quote-currency value received, by analogy to Vietnam securities transfer tax (0.1% of gross transaction value). This reading is defensible but not explicit in the Circular — confirm with a VN tax advisor.',
  },
  effectiveDate: {
    id: "Art. 7.1",
    instrument: "Circular 32/2026/TT-BTC (Bộ Tài chính)",
    effective: "27 March 2026",
    text: "This Circular takes effect from 27 March 2026 and applies for the pilot period stipulated in Resolution 05/2025/NQ-CP, or until a dedicated crypto market tax policy is in place.",
  },
  vat: {
    id: "Art. 3.1",
    instrument: "Circular 32/2026/TT-BTC (Bộ Tài chính)",
    effective: "27 March 2026",
    text: "The transfer and trading of crypto assets are not subject to value-added tax.",
  },
  pilot: {
    id: "Resolution 05/2025/NQ-CP",
    instrument: "Government of Vietnam",
    effective: "9 September 2025, 5-year pilot",
    text: 'Authorizes a five-year pilot of the crypto asset market. "The tax policy for crypto asset transactions will temporarily be the same as that for securities until authorities issue separate regulations."',
  },
  citDomestic: {
    id: "Art. 4.1",
    instrument: "Circular 32/2026/TT-BTC (Bộ Tài chính)",
    effective: "27 March 2026",
    text: "Vietnamese corporate sellers are subject to 20% CIT. Taxable income = selling price minus purchase cost and valid transfer-related expenses. (Not applied here — this tool computes individual PIT only.)",
  },
  notTaxpayer: {
    id: "—",
    instrument: "Pre-pilot (no crypto-specific PIT law)",
    effective: "Before 27 March 2026",
    text: "Vietnam had no crypto-specific personal income tax law before the pilot. Official guidance was limited to MoF Official Letter 4536/BTC-TCT (2016). Sells dated before the Circular's effective date are not within its scope.",
  },
  notTransfer: {
    id: "—",
    instrument: "Art. 5 reading",
    effective: "27 March 2026",
    text: 'The 0.1% PIT applies to those who "transfer crypto assets." A BUY is an acquisition, not a transfer — not taxed. (Defensible reading of the Circular; Circular 32 does not explicitly enumerate buy-side treatment.)',
  },
  bizExemption: {
    id: "PIT Law 2025",
    instrument: "Law on Personal Income Tax 2025 (eff. 1 July 2026)",
    effective: "1 July 2026",
    text: "Household/individual business income with annual revenue of VND 500 million or less is exempt from PIT (raised from the prior VND 100M threshold). Applies IF your crypto trading is characterized as a business (thu nhập từ kinh doanh).",
  },
  bizRate: {
    id: "PIT Law 2025",
    instrument: "Law on Personal Income Tax 2025 (eff. 1 July 2026)",
    effective: "1 July 2026",
    text: "Above VND 500M annual revenue, business income is taxed on net profit. The exact rate is unsettled: PwC cites 15-20%, but the PIT Law 2025 also implements a 5-bracket progressive schedule (5/10/20/30/35%) which may apply to registered household businesses. Tool shows 15-20% band as a working estimate — the true rate depends on registration status and implementing decrees. Confirm with a VN tax advisor.",
  },
  bizCharacterization: {
    id: "—",
    instrument: "Unresolved interaction",
    effective: "As of 2026",
    text: 'Whether full-time crypto trading (sole revenue) pays ONLY the 0.1% final transfer tax, or ALSO the 15-20% business-income PIT above 500M revenue, is NOT addressed by Circular 32. The 0.1% is "final" for securities; crypto-as-livelihood is untested. Consult a VN tax advisor.',
  },
  otherIncome: {
    id: "PIT Law (thu nhập khác)",
    instrument: "Law on Personal Income Tax — Other Income",
    effective: "General PIT framework",
    text: 'Income not specifically categorized falls under "other income" (thu nhập khác) at 10%. The base is typically assessable income (revenue minus deductible expenses), but for ad-hoc income the General Department of Taxation often applies 10% on gross or on a presumptive basis. Tool applies 10% to FIFO net profit as a defensible middle reading; actual base may differ. Fallback for crypto cashouts Circular 32 does not reach (Binance, foreign platforms, pre-pilot). No 500M exemption.',
  },
} as const;

/** Classification bucket for a trade. */
export type Bucket = "taxable" | "grey-zone" | "buy" | "skipped";

export interface Classification {
  bucket: Bucket;
  /** Clause justifying the classification. */
  clause: RegulationClause;
  /** Tax owed on this trade, in the quote currency. 0 for non-taxable. */
  payment: number;
  /** One-line reason (shown in the table). */
  reason: string;
}

/** One step in the worked computation, tied to the clause(s) that justify it. */
export interface ExplanationStep {
  /** What this step does, in plain language. */
  label: string;
  /** The formula or rule applied, e.g. "taxable × 0.001". */
  rule: string;
  /** Clause(s) backing this step. */
  clauses: RegulationClause[];
}

import { CIRCULAR_32_EFFECTIVE, PIT_RATE } from "./constants";
import type { ParsedTrade } from "./schema";

/**
 * Classify one trade into its compliance bucket and compute the tax owed.
 * Mirrors the logic in computeTax.ts but exposes the clause + reason per row
 * so the compliance table can show the legal basis for each entry.
 */
export function classifyTrade(
  trade: Pick<ParsedTrade, "date" | "side" | "grossValue">,
): Classification {
  // Buys are acquisitions, not transfers — not taxed.
  if (trade.side === "BUY") {
    return {
      bucket: "buy",
      clause: CLAUSES.notTransfer,
      payment: 0,
      reason: "Buy — acquisition, not a transfer",
    };
  }

  // Pre-effective-date sells fall outside the Circular.
  if (trade.date.getTime() < CIRCULAR_32_EFFECTIVE.getTime()) {
    return {
      bucket: "grey-zone",
      clause: CLAUSES.notTaxpayer,
      payment: 0,
      reason: `Pre 27 Mar 2026 — outside Circular 32 scope`,
    };
  }

  // Taxable: 0.1% of gross transfer price.
  return {
    bucket: "taxable",
    clause: CLAUSES.rate,
    payment: roundCents(trade.grossValue * PIT_RATE),
    reason: `0.1% × gross transfer price`,
  };
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
