import { z } from "zod";

/** A single trade row parsed and validated from a Binance CSV export. */
export const ParsedTrade = z.object({
  /** Order/trade execution time, parsed from the `Date(UTC)` column as UTC. */
  date: z.date(),
  /** Raw pair string, e.g. "BTCUSDT". */
  pair: z.string(),
  /** Base asset ticker, e.g. "BTC". */
  base: z.string(),
  /** Quote asset ticker, e.g. "USDT". */
  quote: z.string(),
  side: z.enum(["BUY", "SELL"]),
  /** Gross quote-currency value of the fill (the `Total` column). Always > 0. */
  grossValue: z.number().positive(),
  /** Base-asset quantity filled (e.g. BTC count). Used for FIFO lot matching
   *  in the business-income calc. Null when the CSV variant lacks a quantity
   *  column — falling back to quote-value matching in that case. */
  quantity: z.number().positive().nullable(),
});
export type ParsedTrade = z.infer<typeof ParsedTrade>;

/** A row that could not be parsed, kept for the audit trail in the UI. */
export interface SkippedRow {
  /** 1-based index into the CSV body (after the header). */
  rowIndex: number;
  raw: Record<string, string>;
  reason: string;
}

/** Result of parsing a CSV blob. */
export interface ParseResult {
  trades: ParsedTrade[];
  skipped: SkippedRow[];
  /** Detected CSV variant; null when headers do not match any known format. */
  format: CsvFormat | null;
}

export type CsvFormat = "order-history" | "trade-history" | "p2p-history";
