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

// Remitano trade export. Note: `payment details` is a multiline quoted field
// (embedded newlines for bank_name, bank_account_name, etc.) — the RFC 4180
// parser in parseCsv handles this. All exported rows are completed (no Status).
const REMITANO_HEADERS = [
  "ref",
  "coin currency",
  "buy or sell",
  "seller username",
  "buyer username",
  "coin amount",
  "fiat amount",
  "created at",
  "paid at",
  "released at",
  "payment details",
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

/** Parse a date with explicit timezone offset, e.g. Remitano's
 *  "2024-09-30 08:11:38 +0700". Returns the corresponding UTC instant. */
const parseDateWithOffset = (raw: string): Date | null => {
  // Normalize the space between date and time to "T", then parse.
  // "2024-09-30 08:11:38 +0700" -> "2024-09-30T08:11:38+07:00"
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})\s*([+-]\d{2})(\d{2})?$/.exec(raw.trim());
  if (m) {
    const [, yyyy, mm, dd, hh, mi, ss, offH, offM] = m;
    const tz = `${offH}:${offM ?? "00"}`;
    const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${tz}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Fallback: offset absent — try plain Date parse.
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseNumber = (raw: string): number => {
  // Binance totals/prices ship as plain decimals (e.g. "2300000", "87.03").
  // Some Binance locale exports use comma decimals (e.g. "875881,55").
  // If the string has a comma but no dot, treat comma as decimal separator.
  const trimmed = raw.trim();
  if (trimmed === "") return Number.NaN;
  const normalized = trimmed.includes(",") && !trimmed.includes(".")
    ? trimmed.replace(",", ".")
    : trimmed;
  const n = Number(normalized);
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
  if (headersMatch(headerCells, REMITANO_HEADERS)) {
    return { format: "remitano", headers: REMITANO_HEADERS };
  }
  return null;
};

/** Normalize one row object into a ParsedTrade, or null with a reason. */
function parseRow(
  raw: Record<string, string>,
  format: CsvFormat,
): { trade: ParsedTrade } | { reason: string } {
  // Remitano is structurally different — handle it separately for clarity.
  if (format === "remitano") return parseRemitanoRow(raw);

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
      source: "",
    },
  };
}

/** Parse a Remitano trade row. Schema notes:
 *  - `coin currency` = base (vndr/usdt/eth/btc). "vndr" = Remitano's VND-pegged
 *    stablecoin; treated as base with quote VND for FIFO + tax.
 *  - `buy or sell` = side (from the taxpayer's perspective).
 *  - `fiat amount` = signed VND; abs() = grossValue.
 *  - `coin amount` = signed base units; abs() = quantity.
 *  - `released at` = settlement timestamp with +0700 offset (when crypto left).
 *  - All exported rows are completed (no Status column).
 *
 *  Remitano is a foreign P2P platform — same licensed-provider gap as Binance.
 *  Same tax treatment: other-income 10% fallback (pre-effective) or transfer
 *  0.1% (post-effective, if Circular 32 reaches the platform).
 */
function parseRemitanoRow(raw: Record<string, string>): { trade: ParsedTrade } | { reason: string } {
  // Settlement date = "released at" (crypto actually moved). Fall back to
  // "created at" if released is blank.
  const dateRaw = raw["released at"] || raw["created at"];
  const date = parseDateWithOffset(dateRaw);
  if (!date) return { reason: "invalid date" };

  const side = (raw["buy or sell"] ?? "").toLowerCase().trim();
  if (side !== "buy" && side !== "sell") return { reason: "unrecognized side" };

  const coin = (raw["coin currency"] ?? "").toLowerCase().trim();
  if (!/^[a-z0-9]+$/.test(coin)) return { reason: "unrecognized coin currency" };

  // VNDR is Remitano's VND stablecoin. Map base/quote:
  //   vndr -> base VNDR, quote VND (1:1, settled in VND)
  //   usdt/eth/btc -> base <coin>, quote VND (fiat leg is VND)
  const base = coin === "vndr" ? "VNDR" : coin.toUpperCase();
  const quote = "VND";
  const pair = `${base}${quote}`;

  // Fiat amount is signed: positive for sells (received VND), negative for
  // buys (spent VND). Gross value is always positive.
  const fiatRaw = (raw["fiat amount"] ?? "").trim();
  const fiat = parseNumber(fiatRaw);
  if (Number.isNaN(fiat) || fiat === 0) return { reason: "invalid fiat amount" };
  const grossValue = Math.abs(fiat);

  // Coin amount is signed; absolute value is the quantity.
  const coinRaw = (raw["coin amount"] ?? "").trim();
  const coinAmt = parseNumber(coinRaw);
  const quantity = Number.isNaN(coinAmt) || coinAmt === 0 ? null : Math.abs(coinAmt);

  return {
    trade: {
      date,
      pair,
      base,
      quote,
      side: side.toUpperCase() as "BUY" | "SELL",
      grossValue,
      quantity,
      source: "",
    },
  };
}

/** Parse a raw CSV string into validated trades + a skipped audit.
 *  Supports Binance (Order/Trade/P2P History) and Remitano trade exports. */
export function parseBinanceCsv(input: string): ParseResult {
  // Strip UTF-8 BOM (U+FEFF) if present — Binance/Excel exports often prepend
  // one, which would shift the first header cell and break format detection.
  const bomStripped = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const text = bomStripped.trim();
  if (text === "") return { trades: [], skipped: [], format: null };

  const records = parseCsv(text);
  if (records.length === 0) return { trades: [], skipped: [], format: null };

  const headerCells = records[0];
  const detected = detectFormat(headerCells);

  const trades: ParsedTrade[] = [];
  const skipped: SkippedRow[] = [];

  if (!detected) {
    for (let i = 1; i < records.length; i++) {
      const cells = records[i];
      if (cells.every((c) => c.trim() === "")) continue;
      skipped.push({
        rowIndex: i,
        raw: rowToObject(
          cells,
          headerCells.length ? headerCells : cells.map((_, idx) => `col${idx}`),
        ),
        reason: "unrecognized CSV format — expected Binance Order/Trade/P2P History or Remitano trades",
      });
    }
    return { trades, skipped, format: null };
  }

  for (let i = 1; i < records.length; i++) {
    const cells = records[i];
    if (cells.every((c) => c.trim() === "")) continue;
    const raw = rowToObject(cells, detected.headers);
    const result = parseRow(raw, detected.format);
    if ("trade" in result) trades.push(result.trade);
    else skipped.push({ rowIndex: i, raw, reason: result.reason });
  }

  return { trades, skipped, format: detected.format };
}

/**
 * RFC 4180 CSV parser. Returns one record (array of cells) per logical row.
 * Handles quoted fields containing commas, newlines, and escaped ("") quotes.
 * Replaces the older splitCsvLines + splitCsvLine pair, which broke on
 * multiline quoted fields like Remitano's `payment details` column.
 */
function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // Escaped quote inside quoted field.
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    // Not in quotes.
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\r") {
      // CRLF or lone CR — flush field then record.
      record.push(field);
      field = "";
      records.push(record);
      record = [];
      if (text[i + 1] === "\n") i++; // consume the LF of CRLF
    } else if (ch === "\n") {
      record.push(field);
      field = "";
      records.push(record);
      record = [];
    } else {
      field += ch;
    }
  }

  // Flush trailing field/record only if the input didn't end on a newline.
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  // Drop trailing empty record (e.g. final newline).
  if (records.length > 0) {
    const last = records[records.length - 1];
    if (last.length === 1 && last[0] === "") records.pop();
  }

  return records;
}
