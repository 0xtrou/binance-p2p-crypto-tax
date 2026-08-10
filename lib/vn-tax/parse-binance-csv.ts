import { KNOWN_QUOTE_TICKERS } from "./constants";
import type { CsvFormat, ParseResult, ParsedTrade, SkippedRow } from "./schema";

// Binance CSV exports come in three known variants, each with stable headers:
//
//   Order History  -> `Side` column carries literal BUY / SELL
//   Trade History  -> no `Side`; `Type` carries the verb (buy/sell)
//   P2P History    -> `Order Type` carries Buy/Sell; asset + fiat split;
//                     `Total Price` is the gross fiat amount; native VND common
//
// Detection matches the header row exactly (after trimming whitespace). An
// unrecognized header marks every body row as skipped with a single reason.

const ORDER_HISTORY_HEADERS = [
  "Date(UTC)",
  "Pair",
  "Type",
  "Side",
  "Average Price",
  "Price",
  "Executed",
  "Amount",
  "Total",
  "status",
] as const;

const TRADE_HISTORY_HEADERS = [
  "Date(UTC)",
  "Pair",
  "Type",
  "Order Amount",
  "Average Price",
  "Filled Amount",
  "Total",
  "status",
] as const;

const P2P_HISTORY_HEADERS = [
  "Order Number",
  "Order Type",
  "Asset",
  "Fiat Type",
  "Total Price",
  "Price",
  "Quantity",
  "Exchange rate",
  "Maker Fee",
  "Taker Fee",
  "Counterparty",
  "Status",
  "Created Time",
] as const;

const headersMatch = (line: string[], expected: readonly string[]): boolean =>
  line.length === expected.length &&
  line.every((cell, i) => cell.trim() === expected[i]);

/** Parse one Binance CSV row into cells keyed by header, tolerating rows
 *  shorter than the header (trailing commas / blank tail). */
function rowToObject(
  cells: string[],
  headers: readonly string[],
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) obj[headers[i]] = (cells[i] ?? "").trim();
  return obj;
}

const splitPair = (pair: string): { base: string; quote: string } | null => {
  const upper = pair.toUpperCase();
  for (const quote of KNOWN_QUOTE_TICKERS) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      const base = upper.slice(0, -quote.length);
      if (/^[A-Z0-9]+$/.test(base)) return { base, quote };
    }
  }
  return null;
};

const parseDateUtc = (raw: string): Date | null => {
  // Binance writes e.g. "2026-03-28 13:45:10" or "2026-08-07 22:33:10".
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const [, yyyy, mm, dd, hh, mi, ss] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseNumber = (raw: string): number => {
  // Binance totals/prices ship as plain decimals (e.g. "2300000", "87.03");
  // no thousands separators. Coerce directly so a stray comma can't split a cell.
  const trimmed = raw.trim();
  if (trimmed === "") return Number.NaN;
  const n = Number(trimmed);
  return Number.isNaN(n) ? Number.NaN : n;
};

type HeaderSet = readonly string[];
interface FormatDef {
  format: CsvFormat;
  headers: HeaderSet;
}

const detectFormat = (headerCells: string[]): FormatDef | null => {
  if (headersMatch(headerCells, ORDER_HISTORY_HEADERS)) {
    return { format: "order-history", headers: ORDER_HISTORY_HEADERS };
  }
  if (headersMatch(headerCells, TRADE_HISTORY_HEADERS)) {
    return { format: "trade-history", headers: TRADE_HISTORY_HEADERS };
  }
  if (headersMatch(headerCells, P2P_HISTORY_HEADERS)) {
    return { format: "p2p-history", headers: P2P_HISTORY_HEADERS };
  }
  return null;
};

/** Normalize one row object into a ParsedTrade, or null with a reason. */
function parseRow(
  raw: Record<string, string>,
  format: CsvFormat,
): { trade: ParsedTrade } | { reason: string } {
  // Date column differs across formats.
  const dateCol = format === "p2p-history" ? "Created Time" : "Date(UTC)";
  const date = parseDateUtc(raw[dateCol]);
  if (!date) return { reason: "invalid date" };

  // Side.
  let side: "BUY" | "SELL" | null = null;
  if (format === "order-history") {
    const s = (raw["Side"] ?? "").toUpperCase();
    side = s === "BUY" || s === "SELL" ? s : null;
  } else if (format === "p2p-history") {
    const s = (raw["Order Type"] ?? "").toLowerCase();
    side = s.includes("sell") ? "SELL" : s.includes("buy") ? "BUY" : null;
  } else {
    // trade-history: derive from the Type verb.
    const t = (raw["Type"] ?? "").toLowerCase();
    side = t.includes("sell") ? "SELL" : t.includes("buy") ? "BUY" : null;
  }
  if (!side) return { reason: "unrecognized side" };

  // Filter out cancelled / non-completed orders. P2P rows carry Status
  // ("Completed" / "Cancelled"); Order/Trade History uses lowercase "status"
  // ("filled" / "canceled" / "expired"). A cancelled order never settled —
  // no transfer happened, so it must not enter tax or revenue.
  const statusCol = format === "p2p-history" ? "Status" : "status";
  const statusVal = (raw[statusCol] ?? "").toLowerCase().trim();
  if (statusVal === "cancelled" || statusVal === "canceled" || statusVal === "expired") {
    return { reason: `cancelled order (${raw[statusCol]})` };
  }

  // Base / quote / gross value differ across formats.
  let base: string;
  let quote: string;
  let grossValue: number;

  if (format === "p2p-history") {
    // Asset + Fiat are already split columns; no pair string to parse.
    const asset = (raw["Asset"] ?? "").trim().toUpperCase();
    const fiat = (raw["Fiat Type"] ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]+$/.test(asset) || !/^[A-Z0-9]+$/.test(fiat)) {
      return { reason: "unrecognized asset or fiat" };
    }
    base = asset;
    quote = fiat;
    grossValue = parseNumber(raw["Total Price"]);
  } else {
    const parts = splitPair(raw["Pair"]);
    if (!parts) return { reason: "unrecognized pair" };
    base = parts.base;
    quote = parts.quote;
    grossValue = parseNumber(raw["Total"]);
  }

  if (Number.isNaN(grossValue) || grossValue <= 0) return { reason: "invalid total" };

  // Quantity (base-asset units) — used for FIFO lot matching in the
  // business-income calc. Tolerate a missing/blank qty -> null.
  let qtyCol = "";
  if (format === "order-history") qtyCol = raw["Executed"];
  else if (format === "trade-history") qtyCol = raw["Filled Amount"];
  else if (format === "p2p-history") qtyCol = raw["Quantity"];
  let quantity: number | null = null;
  if (qtyCol && qtyCol.trim() !== "") {
    const q = parseNumber(qtyCol);
    quantity = Number.isNaN(q) || q <= 0 ? null : q;
  }

  return {
    trade: {
      date,
      pair: format === "p2p-history" ? `${base}${quote}` : raw["Pair"].toUpperCase(),
      base,
      quote,
      side,
      grossValue,
      quantity,
    },
  };
}

/** Parse a raw Binance CSV string into validated trades + a skipped audit. */
export function parseBinanceCsv(input: string): ParseResult {
  const text = input.trim();
  if (text === "") return { trades: [], skipped: [], format: null };

  const lines = splitCsvLines(text);
  if (lines.length === 0) return { trades: [], skipped: [], format: null };

  const headerCells = splitCsvLine(lines[0]);
  const detected = detectFormat(headerCells);

  const trades: ParsedTrade[] = [];
  const skipped: SkippedRow[] = [];

  if (!detected) {
    for (let i = 1; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i]);
      if (cells.every((c) => c.trim() === "")) continue;
      skipped.push({
        rowIndex: i,
        raw: rowToObject(
          cells,
          headerCells.length ? headerCells : cells.map((_, idx) => `col${idx}`),
        ),
        reason: "unrecognized CSV format — expected Binance Order History, Trade History, or P2P History",
      });
    }
    return { trades, skipped, format: null };
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.every((c) => c.trim() === "")) continue;
    const raw = rowToObject(cells, detected.headers);
    const result = parseRow(raw, detected.format);
    if ("trade" in result) trades.push(result.trade);
    else skipped.push({ rowIndex: i, raw, reason: result.reason });
  }

  return { trades, skipped, format: detected.format };
}

/** Split a CSV blob into logical lines, dropping a trailing empty line. */
function splitCsvLines(text: string): string[] {
  return text
    .split(/\r\n|\n|\r/)
    .filter((l, i, arr) => !(i === arr.length - 1 && l.trim() === ""));
}

/** Split a single CSV line into cells, honoring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}
