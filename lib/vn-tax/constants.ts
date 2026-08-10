// Vietnam pilot crypto tax constants.
// Source: Circular No. 32/2026/TT-BTC (Ministry of Finance), official English
// translation read in full. Effective 27 March 2026 for the duration of the
// crypto asset market pilot under Resolution 05/2025/NQ-CP.

/** PIT rate on crypto asset transfers for individuals. Art. 5: 0.1%. */
export const PIT_RATE = 0.001;

/**
 * Effective date of Circular 32/2026/TT-BTC, Art. 7.1: 27 March 2026, ICT.
 * Trades on or after this instant fall under the interim securities-analog
 * PIT rule; earlier trades live in a pre-pilot grey zone.
 */
export const CIRCULAR_32_EFFECTIVE = new Date("2026-03-27T00:00:00+07:00");

/** Quote tickers Binance pairs are known to end with. Longest-first so that
 *  "BTCUSDT" splits into base "BTC" + quote "USDT", not "BTCU" + "SDT". */
export const KNOWN_QUOTE_TICKERS = [
  "FDUSD",
  "USDT",
  "USDC",
  "TUSD",
  "BUSD",
  "USD",
  "EUR",
  "VND",
  "BTC",
  "ETH",
  "BNB",
] as const;

export type Side = "BUY" | "SELL";
