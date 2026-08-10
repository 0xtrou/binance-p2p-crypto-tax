/** Formatting helpers for the tax tool. Keep deterministic — no Intl side effects. */

const GROUP = /\B(?=(\d{3})+(?!\d))/g;

/** Format a quote-currency amount with thousands separators and 2 decimals.
 *  Quote tickers like USDT are 2-decimal priced; we display the tax the same way. */
export function formatAmount(n: number, ticker?: string): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n).toFixed(2);
  const [whole, frac] = abs.split(".");
  const grouped = whole.replace(GROUP, ",");
  return ticker ? `${sign}${grouped}.${frac} ${ticker}` : `${sign}${grouped}.${frac}`;
}

/** Short ISO date (YYYY-MM-DD) in the trade's original UTC. */
export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Short ISO date-time (YYYY-MM-DD HH:MM:SS) in UTC. */
export function formatDateTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}
