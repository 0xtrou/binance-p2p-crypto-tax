"use client";

import { AlertTriangle, BookOpen, Download, FileUp, FileSpreadsheet, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildDeclaration } from "@/lib/vn-tax/declaration";
import { exportComplianceCsv, exportComplianceXlsx, exportDeclarationCsv, exportDeclarationXlsx } from "@/lib/vn-tax/export";
import { computeTax } from "@/lib/vn-tax/compute-tax";
import { formatAmount, formatDate } from "@/lib/vn-tax/format";
import { parseBinanceCsv } from "@/lib/vn-tax/parse-binance-csv";
import { classifyTrade, CLAUSES } from "@/lib/vn-tax/regulation";

const STORAGE_KEY = "vn-tax-crypto-sources";

interface Sources {
  remitano: string;
  binance: string;
}

const EMPTY_SOURCES: Sources = { remitano: "", binance: "" };

function loadSources(): Sources {
  if (typeof window === "undefined") return EMPTY_SOURCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SOURCES;
    const parsed = JSON.parse(raw);
    return {
      remitano: typeof parsed.remitano === "string" ? parsed.remitano : "",
      binance: typeof parsed.binance === "string" ? parsed.binance : "",
    };
  } catch {
    return EMPTY_SOURCES;
  }
}

const SAMPLE_BINANCE = [
  "Order Number,Order Type,Asset,Fiat Type,Total Price,Price,Quantity,Exchange rate,Maker Fee,Taker Fee,Counterparty,Status,Created Time",
  "22919067578433670001,Buy,USDT,VND,2300000,26426,87.03,,,0.08,GiaoDichTuDong_247,Completed,2026-01-15 09:30:00",
  "22919067578433670002,Sell,USDT,VND,2400000,27586,87.03,,,0.08,GiaoDichTuDong_247,Completed,2026-03-26 11:00:00",
  "22919067578433670003,Sell,USDT,VND,5000000,28000,178.57,,,0.08,GiaoDichTuDong_247,Completed,2026-04-02 16:45:00",
].join("\n");

export function VnTaxCalculator() {
  // Client-only lazy init avoids SSR/CSR mismatch + effect-setState lint.
  const [sources, setSources] = useState<Sources>(() => (typeof window === "undefined" ? EMPTY_SOURCES : loadSources()));
  const [showSkipped, setShowSkipped] = useState(false);

  // Persist on change.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
    } catch {
      // Quota or privacy mode — ignore.
    }
  }, [sources]);

  // Parse each source independently; concat trades for unified declaration.
  const result = useMemo(() => {
    const parsedResults = {
      remitano: sources.remitano.trim() ? parseBinanceCsv(sources.remitano) : null,
      binance: sources.binance.trim() ? parseBinanceCsv(sources.binance) : null,
    };
    const hasAny = parsedResults.remitano || parsedResults.binance;
    if (!hasAny) return null;

    const trades = [
      ...(parsedResults.remitano?.trades ?? []),
      ...(parsedResults.binance?.trades ?? []),
    ];
    const skipped = [
      ...(parsedResults.remitano?.skipped ?? []),
      ...(parsedResults.binance?.skipped ?? []),
    ];
    // Tag source on each skipped row for clarity.
    const skippedTagged = skipped.map((s, i) => ({
      ...s,
      rowIndex: i + 1,
      source: (i < (parsedResults.remitano?.skipped.length ?? 0) ? "Remitano" : "Binance") as string,
    }));

    const parsed = { trades, skipped: skippedTagged, format: null as null };
    return { parsed, tax: computeTax(trades), perSource: parsedResults };
  }, [sources]);

  const setSource = (key: keyof Sources, value: string) => {
    setSources((prev) => ({ ...prev, [key]: value }));
  };

  const onFile = (key: keyof Sources) => (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setSource(key, String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const clearSource = (key: keyof Sources) => {
    setSources((prev) => ({ ...prev, [key]: "" }));
  };

  const clearAll = () => {
    setSources(EMPTY_SOURCES);
    setShowSkipped(false);
  };

  const totalRows = (sources.remitano.trim() ? sources.remitano.split(/\r?\n/).length - 1 : 0)
    + (sources.binance.trim() ? sources.binance.split(/\r?\n/).length - 1 : 0);

  return (
    <main className="min-h-screen bg-[#071018] text-[#cfd9e3] terminal-shell">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <header className="mb-6">
          <p className="terminal-label mb-2">VN TAX / CRYPTO</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-white sm:text-4xl">
            Crypto Tax Estimator
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#8aa0b5]">
            Add your Remitano + Binance CSV exports. Estimates VN PIT under Circular 32/2026/TT-BTC
            (0.1% transfer tax) and general PIT (10% other income). Data persists in your browser only.
          </p>
        </header>

        <Disclaimer />

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SourcePanel
            title="Remitano CSV"
            accent="#67a9f5"
            value={sources.remitano}
            onChange={(v) => setSource("remitano", v)}
            onUpload={onFile("remitano")}
            onClear={() => clearSource("remitano")}
            placeholder="Paste Remitano trade export CSV here…"
            parsed={result?.perSource.remitano ?? null}
          />
          <SourcePanel
            title="Binance CSV"
            accent="#f0c97a"
            value={sources.binance}
            onChange={(v) => setSource("binance", v)}
            onUpload={onFile("binance")}
            onClear={() => clearSource("binance")}
            onSample={() => setSource("binance", SAMPLE_BINANCE)}
            placeholder="Paste Binance Order/Trade/P2P History CSV here…"
            parsed={result?.perSource.binance ?? null}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">
            {totalRows > 0 ? `${totalRows} row(s) loaded` : "No data"}
          </span>
          {totalRows > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="terminal-icon-button inline-flex items-center gap-2 text-[#aab9c8]"
            >
              <Trash2 size={13} /> Clear all
            </button>
          ) : null}
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#4d6478]">
            persisted locally
          </span>
        </div>

        {result ? (
          <Results
            result={result}
            showSkipped={showSkipped}
            setShowSkipped={setShowSkipped}
          />
        ) : (
          <p className="mt-6 px-1 text-xs text-[#6c8094]">
            No data yet. Paste a CSV or load the sample to begin.
          </p>
        )}
      </div>
    </main>
  );
}

interface SourcePanelProps {
  title: string;
  accent: string;
  value: string;
  onChange: (v: string) => void;
  onUpload: (file: File) => void;
  onClear: () => void;
  onSample?: () => void;
  placeholder: string;
  parsed: ReturnType<typeof parseBinanceCsv> | null;
}

function SourcePanel({
  title, accent, value, onChange, onUpload, onClear, onSample, placeholder, parsed,
}: SourcePanelProps) {
  const lineCount = value.trim() ? value.trim().split(/\r?\n/).length : 0;
  const tradeCount = parsed?.trades.length ?? 0;
  const skipCount = parsed?.skipped.length ?? 0;
  const fmt = parsed?.format;

  return (
    <section className="border border-[#1b2d3e] bg-[#0a1622]">
      <div className="flex items-center justify-between px-4 pt-3">
        <label className="terminal-label flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: accent }} />
          {title}
        </label>
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">
          {lineCount > 0 ? `${lineCount} lines` : "empty"}
          {fmt ? ` · ${fmt}` : ""}
          {tradeCount > 0 ? ` · ${tradeCount} trades` : ""}
          {skipCount > 0 ? ` · ${skipCount} skipped` : ""}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) onUpload(f);
        }}
        onDragOver={(e) => e.preventDefault()}
        placeholder={placeholder}
        spellCheck={false}
        className="block h-40 w-full resize-y bg-transparent px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[#cfd9e3] placeholder:text-[#4d6478] focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-[#1b2d3e] px-4 py-2 text-xs">
        <label className="terminal-icon-button inline-flex cursor-pointer items-center gap-1.5 text-[#aab9c8]">
          <FileUp size={12} /> Upload
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
        {onSample ? (
          <button
            type="button"
            onClick={onSample}
            className="terminal-icon-button inline-flex items-center gap-1.5 text-[#aab9c8]"
          >
            <FileUp size={12} /> Sample
          </button>
        ) : null}
        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="terminal-icon-button inline-flex items-center gap-1.5 text-[#aab9c8]"
          >
            <Trash2 size={12} /> Clear
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Disclaimer() {
  return (
    <aside className="border border-[#3a2c12] bg-[#15110a] px-4 py-3 text-xs leading-relaxed text-[#d8b870]">
      <p className="mb-1 flex items-center gap-2 font-semibold text-[#f0c97a]">
        <AlertTriangle size={14} /> Estimate only — not tax advice
      </p>
      <p className="text-[#c2a05a]">
        Computed under Circular 32/2026/TT-BTC Art. 5 (0.1% PIT on transfer price), the interim
        securities-analog rule from Resolution 05/2025/NQ-CP. This rate is written for transfers
        through <em>licensed</em> VN crypto asset service providers; Binance may not yet qualify, so
        actual liability may differ. Only sells dated on/after 27 Mar 2026 are counted; earlier
        sells fall in a pre-pilot grey zone. Verify with a VN tax advisor before filing.
      </p>
    </aside>
  );
}

interface ResultsProps {
  result: {
    parsed: ReturnType<typeof parseBinanceCsv>;
    tax: ReturnType<typeof computeTax>;
    perSource: { remitano: ReturnType<typeof parseBinanceCsv> | null; binance: ReturnType<typeof parseBinanceCsv> | null };
  };
  showSkipped: boolean;
  setShowSkipped: (v: boolean) => void;
}

function Results({
  result,
  showSkipped,
  setShowSkipped,
}: ResultsProps) {
  const { parsed } = result;
  const decl = useMemo(() => buildDeclaration(parsed.trades), [parsed]);

  if (parsed.format === null) {
    return (
      <section className="mt-6 border border-[#3a2c12] bg-[#15110a] px-4 py-3 text-xs text-[#f0c97a]">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle size={14} /> Unrecognized CSV format
        </p>
        <p className="mt-1 text-[#c2a05a]">
          Expected a Binance Order/Trade/P2P History or Remitano export. All
          {" "}{parsed.skipped.length} body row(s) were skipped.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Total PIT" value={formatAmount(decl.totals.totalTax, "VND")} accent />
        <Card label="Transfer 0.1%" value={formatAmount(decl.totals.transferTax, "VND")} />
        <Card label="Other income 10%" value={formatAmount(decl.totals.otherIncomeTax, "VND")} />
        <Card label="Unmatched sells" value={String(decl.totals.unmatchedCount)} />
      </div>

      <Tabs
        tabs={[
          {
            label: "Declaration",
            content: (
              <div className="space-y-4">
                <Explanation result={result} />
                <PitDeclarationTable result={result} />
                <ExportButtons
                  onCsv={() => exportDeclarationCsv(decl)}
                  onXlsx={() => exportDeclarationXlsx(decl)}
                  prefix="pit-declaration"
                />
              </div>
            ),
          },
          {
            label: "Breakdown",
            content: (
              <div className="space-y-4">
                <ComplianceTable result={result} />
                {parsed.skipped.length > 0 ? (
                  <Collapsible
                    open={showSkipped}
                    onToggle={() => setShowSkipped(!showSkipped)}
                    label={`Skipped rows (${parsed.skipped.length})`}
                  >
                    <div className="border border-[#1b2d3e] bg-[#0a1622]">
                      {parsed.skipped.map((s) => (
                        <div key={s.rowIndex} className="border-b border-[#13212e] px-4 py-2 last:border-b-0">
                          <p className="font-[family-name:var(--font-mono)] text-[11px] text-[#ff8972]">
                            row {s.rowIndex} — {s.reason}{ "source" in s ? ` [${(s as { source: string }).source}]` : ""}
                          </p>
                          <pre className="mt-1 overflow-x-auto font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">
                            {JSON.stringify(s.raw)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </Collapsible>
                ) : null}
                <ExportButtons
                  onCsv={() => exportComplianceCsv(parsed)}
                  onXlsx={() => exportComplianceXlsx(parsed)}
                  prefix="compliance-breakdown"
                />
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}

function Tabs({ tabs }: { tabs: { label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="mt-4">
      <div className="flex gap-1 border-b border-[#1b2d3e]">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setActive(i)}
            className={`tab-button relative px-4 py-2 text-xs font-semibold transition-colors ${
              active === i ? "tab-button-active text-[#e0e9f1]" : "text-[#818984] hover:text-[#cfd9e3]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{tabs[active].content}</div>
    </div>
  );
}

function ExportButtons({
  onCsv,
  onXlsx,
  prefix,
}: {
  onCsv: () => void;
  onXlsx: () => void;
  prefix: string;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onCsv}
        className="terminal-icon-button text-[#aab9c8]"
        aria-label={`Export ${prefix} as CSV`}
      >
        <Download size={13} /> CSV
      </button>
      <button
        type="button"
        onClick={onXlsx}
        className="terminal-icon-button text-[#aab9c8]"
        aria-label={`Export ${prefix} as XLSX`}
      >
        <Download size={13} /> XLSX
      </button>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="terminal-metric flex-col items-start !min-h-[60px]">
      <span className="terminal-label">{label}</span>
      <span className={`mt-1 font-[family-name:var(--font-mono)] text-lg ${accent ? "text-[#76e1b0]" : "text-[#cfd9e3]"}`}>
        {value}
      </span>
    </div>
  );
}

function ComplianceTable({
  result,
}: {
  result: { parsed: ReturnType<typeof parseBinanceCsv>; tax: ReturnType<typeof computeTax> };
}) {
  const { parsed, tax } = result;
  if (parsed.trades.length === 0) {
    return <p className="text-xs text-[#6c8094]">No trades to display.</p>;
  }

  // Sort newest-first for the audit view; original parse order preserved in `parsed.trades`.
  const rows = [...parsed.trades].sort((a, b) => b.date.getTime() - a.date.getTime());
  const totalPayment = rows.reduce((s, t) => s + classifyTrade(t).payment, 0);
  const totalQuote = rows[0]?.quote ?? "";

  return (
    <div>
      <h2 className="terminal-label mb-2">Compliance table — per-trade clause matching</h2>
      <div className="overflow-x-auto border border-[#1b2d3e] bg-[#0a1622]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#1b2d3e] text-[#6c8094]">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>Date</th>
              <th>Pair</th>
              <th>Side</th>
              <th className="text-right">Gross</th>
              <th>Classification</th>
              <th>Clause</th>
              <th className="text-right">Tax owed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const c = classifyTrade(t);
              return (
                <tr key={i} className="border-b border-[#13212e] last:border-b-0 [&>td]:px-3 [&>td]:py-2 [&>td]:align-top">
                  <td className="whitespace-nowrap font-[family-name:var(--font-mono)] text-[11px] text-[#8aa0b5]">{formatDate(t.date)}</td>
                  <td className="whitespace-nowrap font-[family-name:var(--font-mono)] text-[11px] text-[#cfd9e3]">{t.pair}</td>
                  <td className="whitespace-nowrap font-[family-name:var(--font-mono)] text-[11px]">
                    <span className={t.side === "SELL" ? "text-[#ff8972]" : "text-[#67a9f5]"}>{t.side}</span>
                  </td>
                  <td className="text-right font-[family-name:var(--font-mono)] text-[11px] text-[#cfd9e3]">{formatAmount(t.grossValue, t.quote)}</td>
                  <td className="text-[#a9b8c7]">
                    <span className={bucketColor(c.bucket)}>{c.bucket}</span>
                    <span className="block text-[10px] text-[#6c8094]">{c.reason}</span>
                  </td>
                  <td className="font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">
                    {c.clause.id}
                    <span className="block">{c.clause.instrument.replace("Circular 32/2026/TT-BTC (Bộ Tài chính)", "TT 32/2026")}</span>
                  </td>
                  <td className="text-right font-[family-name:var(--font-mono)] text-[11px]">
                    {c.payment > 0 ? (
                      <span className="text-[#76e1b0]">{formatAmount(c.payment, t.quote)}</span>
                    ) : (
                      <span className="text-[#6c8094]">0.00 {t.quote}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#1b2d3e] bg-[#0d1924] [&>td]:px-3 [&>td]:py-2 [&>td]:font-[family-name:var(--font-mono)] [&>td]:text-[11px]">
              <td colSpan={6} className="text-right text-[#8aa0b5]">Total tax owed</td>
              <td className="text-right text-[#76e1b0]">{formatAmount(totalPayment, totalQuote)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-[#6c8094]">
        {tax.totals.taxableSellCount} taxable · {tax.totals.greyZoneCount} grey-zone · {tax.totals.buyCount} buys
      </p>
    </div>
  );
}

function bucketColor(bucket: string): string {
  switch (bucket) {
    case "taxable":
    case "transfer":
      return "text-[#76e1b0] font-semibold";
    case "grey-zone":
    case "other-income":
      return "text-[#f0c97a]";
    case "buy":
      return "text-[#67a9f5]";
    default:
      return "text-[#6c8094]";
  }
}

function Collapsible({
  open,
  onToggle,
  label,
  warn,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-2 border border-[#1b2d3e] bg-[#0a1622] px-4 py-2 text-left text-xs font-semibold ${warn ? "text-[#f0c97a]" : "text-[#8aa0b5]"}`}
      >
      {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      {label}
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

interface ExplanationProps {
  result: { parsed: ReturnType<typeof parseBinanceCsv>; tax: ReturnType<typeof computeTax> };
}

function Explanation({ result }: ExplanationProps) {
  const { parsed } = result;
  const decl = useMemo(() => buildDeclaration(parsed.trades), [parsed]);
  const [open, setOpen] = useState(false);

  // Worked examples — pick first transfer-bucket sell + first other-income sell
  // so both bucket formulas are legible. Fall back to placeholders if absent.
  const firstTransfer = decl.rows.find((r) => r.bucket === "transfer");
  const firstOther = decl.rows.find((r) => r.bucket === "other-income");

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 border border-[#1b2d3e] bg-[#0a1622] px-4 py-2 text-left text-xs font-semibold text-[#8aa0b5]"
      >
        <BookOpen size={13} />
        How this is computed + regulation clauses
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open ? (
        <div className="mt-2 space-y-4 border border-[#1b2d3e] bg-[#0a1622] px-4 py-4 text-xs leading-relaxed text-[#a9b8c7]">
          <section>
            <h3 className="terminal-label mb-2">Two buckets, two formulas</h3>
            <p className="mb-2 text-[#8aa0b5]">
              Each SELL is assigned one bucket based on its date. Buys are not taxed (acquisitions).
            </p>
            <div className="space-y-3">
              <div className="border-l-2 border-[#76e1b0] pl-3">
                <p className="font-semibold text-[#76e1b0]">Transfer 0.1% — sells on/after 27 Mar 2026</p>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-[#cfd9e3]">
                  tax = gross transfer price × 0.001
                </p>
                {firstTransfer ? (
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">
                    e.g. {formatDate(firstTransfer.date)} {firstTransfer.pair}:{" "}
                    {formatAmount(firstTransfer.gross, "VND")} × 0.001 ={" "}
                    {formatAmount(firstTransfer.taxOwed, "VND")}
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] text-[#6c8094]">
                  Base = gross, not profit. Whether Circular 32 reaches Binance/Remitano (foreign, unlicensed)
                  is unsettled — see caveats below.
                </p>
              </div>
              <div className="border-l-2 border-[#f0c97a] pl-3">
                <p className="font-semibold text-[#f0c97a]">Other income 10% — sells before 27 Mar 2026</p>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-[#cfd9e3]">
                  tax = max(0, gross − FIFO cost) × 0.1
                </p>
                {firstOther ? (
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">
                    e.g. {formatDate(firstOther.date)} {firstOther.pair}: ({formatAmount(firstOther.gross)} −{" "}
                    {formatAmount(firstOther.matchedCost)}) × 0.1 = {formatAmount(firstOther.taxOwed, "VND")}
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] text-[#6c8094]">
                  Net-profit base. Requires matching buys; unmatched sells treat cost as 0 (overstates profit).
                </p>
              </div>
            </div>
          </section>

          <section className="border-t border-[#13212e] pt-3">
            <h3 className="terminal-label mb-2">Clause mapping</h3>
            <ul className="space-y-3">
              <ClauseRow step="0.1% transfer rate (post 27 Mar 2026)" clause={CLAUSES.rate} />
              <ClauseRow step="transfer price = gross value (interpretation)" clause={CLAUSES.base} />
              <ClauseRow step="10% other income (pre-effective fallback)" clause={CLAUSES.otherIncome} />
              <ClauseRow step="Circular 32 effective 27 Mar 2026, not retroactive" clause={CLAUSES.effectiveDate} />
              <ClauseRow step="VAT exempt" clause={CLAUSES.vat} />
              <ClauseRow step="interim securities-analog pilot" clause={CLAUSES.pilot} />
              <ClauseRow step="business income 15-20% (alternative, >500M VND/yr)" clause={CLAUSES.bizRate} />
              <ClauseRow step="unresolved: which bucket for sole-revenue traders?" clause={CLAUSES.bizCharacterization} />
            </ul>
          </section>

          <section className="border-t border-[#13212e] pt-3">
            <h3 className="terminal-label mb-2">Honest caveats — read before relying on any number</h3>
            <ul className="list-disc space-y-1 pl-4 text-[#8aa0b5]">
              <li>
                <strong className="text-[#f0c97a]">Licensed-provider gap.</strong> Art. 5 taxes transfers
                &quot;through a crypto asset service provider.&quot; Binance and Remitano are foreign platforms,
                not licensed VN providers under the pilot. Whether the 0.1% legally applies to trades on them
                is <strong className="text-[#cfd9e3]">unsettled</strong>. The tool computes it anyway because
                it&apos;s the only quantified rate in VN law — but the number may not be legally owed.
              </li>
              <li>
                <strong className="text-[#f0c97a]">Transfer price undefined.</strong> Circular 32 says
                &quot;transfer price&quot; without defining it. The tool reads it as gross quote value
                (securities analogy). A net-profit reading would change the number.
              </li>
              <li>
                <strong className="text-[#f0c97a]">Other-income base unsettled.</strong> General PIT applies
                10% to &quot;other income&quot; but the base (gross vs net vs presumptive) depends on how the
                tax authority characterizes the activity. Tool uses FIFO net profit as a middle reading.
              </li>
              <li>
                <strong className="text-[#f0c97a]">Business 15-20% is a range.</strong> PIT Law 2025 may apply
                a progressive schedule instead of a flat band, depending on registration status. Tool shows
                the band as a working estimate.
              </li>
              <li>
                <strong className="text-[#f0c97a]">Cost basis depends on your full history.</strong> If your
                CSV lacks buys for some sells, the tool treats those sells as zero-cost — overstating profit
                and tax. Add your full acquisition ledger (spot, convert, deposits) for accuracy.
              </li>
              <li>
                <strong className="text-[#f0c97a]">No buy-side tax.</strong> &quot;Transfer&quot; is read as
                disposal/sale. Buys are acquisitions, not taxed. This reading is defensible but not explicit
                in Circular 32.
              </li>
              <li>
                <strong className="text-[#f0c97a]">Not legal advice.</strong> Confirm characterization + final
                numbers with a licensed VN tax advisor before filing.
              </li>
            </ul>
          </section>

          <section className="border-t border-[#13212e] pt-3">
            <h3 className="terminal-label mb-2">Out of scope</h3>
            <p className="text-[#8aa0b5]">
              Individual PIT only. Domestic corporates: 20% CIT on net gains (Art. 4.1). Foreign corporates:
              0.1% CIT on gross. Not handled: wallet-to-wallet transfers, staking, airdrops, futures, crypto-to-crypto
              swaps — Circular 32 is silent on these.
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ClauseRow({
  step,
  clause,
}: {
  step: string;
  clause: { id: string; instrument: string; effective: string; text: string };
}) {
  return (
    <li className="border-l-2 border-[#376253] pl-3">
      <p className="text-[#cfd9e3]">{step}</p>
      <p className="mt-1 italic text-[#8aa0b5]">&quot;{clause.text}&quot;</p>
      <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">
        {clause.id} · {clause.instrument} · {clause.effective}
      </p>
    </li>
  );
}

function PitDeclarationTable({
  result,
}: {
  result: { parsed: ReturnType<typeof parseBinanceCsv>; tax: ReturnType<typeof computeTax> };
}) {
  const decl = useMemo(() => buildDeclaration(result.parsed.trades), [result]);
  const [showAll, setShowAll] = useState(false);

  if (decl.rows.length === 0) {
    return (
      <div>
        <h2 className="terminal-label mb-2 flex items-center gap-2">
          <FileSpreadsheet size={13} /> PIT declaration
        </h2>
        <p className="text-xs text-[#6c8094]">No trades to declare.</p>
      </div>
    );
  }

  const visibleRows = showAll ? decl.rows : decl.rows.slice(0, 12);
  const hiddenCount = decl.rows.length - visibleRows.length;

  return (
    <div>
      <h2 className="terminal-label mb-2 flex items-center gap-2">
        <FileSpreadsheet size={13} /> PIT declaration — one row per trade, matched clause, VND owed
      </h2>

      <div className="overflow-x-auto border border-[#1b2d3e] bg-[#0a1622]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#1b2d3e] text-[#6c8094]">
            <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:font-medium">
              <th>Date</th>
              <th>Pair</th>
              <th>Side</th>
              <th className="text-right">Gross</th>
              <th className="text-right">Cost (FIFO)</th>
              <th className="text-right">Net</th>
              <th>Bucket</th>
              <th>Clause</th>
              <th className="text-right">Tax owed</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r, i) => (
              <tr key={i} className="border-b border-[#13212e] last:border-b-0 [&>td]:px-2 [&>td]:py-1.5 [&>td]:align-top [&>td]:font-[family-name:var(--font-mono)] [&>td]:text-[10px]">
                <td className="whitespace-nowrap text-[#8aa0b5]">{formatDate(r.date)}</td>
                <td className="whitespace-nowrap text-[#cfd9e3]">{r.pair}</td>
                <td className="whitespace-nowrap">
                  <span className={r.side === "SELL" ? "text-[#ff8972]" : "text-[#67a9f5]"}>{r.side}</span>
                  {r.unmatched ? <span className="ml-1 text-[#ff8972]" title="no matching buy in CSV">⚠</span> : null}
                </td>
                <td className="text-right text-[#cfd9e3]">{formatAmount(r.gross, "VND")}</td>
                <td className="text-right text-[#8aa0b5]">{r.side === "SELL" ? formatAmount(r.matchedCost, "VND") : "—"}</td>
                <td className={`text-right ${r.netProfit > 0 ? "text-[#6bcfa6]" : r.netProfit < 0 ? "text-[#ff8972]" : "text-[#6c8094]"}`}>
                  {r.side === "SELL" ? formatAmount(r.netProfit, "VND") : "—"}
                </td>
                <td className="whitespace-nowrap"><span className={bucketColor(r.bucket)}>{bucketLabel(r.bucket)}</span></td>
                <td className="whitespace-nowrap text-[#6c8094]">{r.clause.id}</td>
                <td className="text-right">
                  {r.taxOwed > 0 ? <span className="text-[#76e1b0]">{formatAmount(r.taxOwed, "VND")}</span> : <span className="text-[#6c8094]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#1b2d3e] bg-[#0d1924] [&>td]:px-2 [&>td]:py-2 [&>td]:font-[family-name:var(--font-mono)] [&>td]:text-[11px]">
              <td colSpan={8} className="text-right text-[#8aa0b5]">Total PIT to declare</td>
              <td className="text-right text-[#76e1b0]">{formatAmount(decl.totals.totalTax, "VND")}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="terminal-icon-button mt-2 text-[#aab9c8]"
        >
          <ChevronDown size={13} /> Show {hiddenCount} more trade{hiddenCount > 1 ? "s" : ""}
        </button>
      ) : showAll && decl.rows.length > 12 ? (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="terminal-icon-button mt-2 text-[#aab9c8]"
        >
          <ChevronUp size={13} /> Collapse
        </button>
      ) : null}

      {decl.totals.unmatchedCount > 0 ? (
        <p className="mt-3 text-[10px] leading-relaxed text-[#ff8972]">
          <AlertTriangle size={11} className="mr-1 inline" />
          {decl.totals.unmatchedCount} sell(s) have no matching buy in this CSV (⚠). Their cost basis is unknown —
          tax shown treats them as zero-cost, which <strong>overstates net profit</strong>. Add your full
          Binance spot + convert + deposit history for accurate figures.
        </p>
      ) : null}

      {decl.businessNotes.length > 0 ? (
        <div className="mt-3 border border-[#3a2c12] bg-[#15110a] px-3 py-2 text-[11px] text-[#f0c97a]">
          <p className="mb-1 flex items-center gap-1 font-semibold">
            <AlertTriangle size={11} /> Alternative characterization — business income (thu nhập từ kinh doanh)
          </p>
          <p className="mb-2 text-[#c2a05a]">
            If your trading is characterized as a business, years above 500M VND revenue face 15-20% on net profit
            instead of the per-trade buckets above. Annual, not per-trade.
          </p>
          <table className="w-full text-left font-[family-name:var(--font-mono)] text-[10px]">
            <thead className="text-[#c2a05a]">
              <tr>
                <th className="py-1">Year</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Net profit</th>
                <th className="text-right">PIT 15-20%</th>
              </tr>
            </thead>
            <tbody className="text-[#f0c97a]">
              {decl.businessNotes.map((n) => (
                <tr key={n.year} className="border-t border-[#2a1f0d]">
                  <td className="py-1">{n.year}</td>
                  <td className="text-right">{formatAmount(n.revenue, "VND")}</td>
                  <td className="text-right">{formatAmount(n.netProfit, "VND")}</td>
                  <td className="text-right">{formatAmount(n.pitLow)}–{formatAmount(n.pitHigh, "VND")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-[#c2a05a]">
            <strong>CSV-only cost basis.</strong> Same unmatched-sell caveat applies — overstated if you have
            buys outside this export.
          </p>
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-relaxed text-[#6c8094]">
        <strong className="text-[#f0c97a]">Estimate, not filing advice.</strong> Bucket assignment: post-27-Mar-2026
        sells → transfer 0.1% (Circular 32 Art. 5, if it reaches your platform); pre-effective sells → other income
        10% (general PIT fallback). Which applies depends on your legal characterization — confirm with a VN tax advisor.
      </p>
    </div>
  );
}

function bucketLabel(bucket: string): string {
  switch (bucket) {
    case "transfer": return "Transfer 0.1%";
    case "other-income": return "Other 10%";
    case "buy": return "Buy";
    default: return bucket;
  }
}

