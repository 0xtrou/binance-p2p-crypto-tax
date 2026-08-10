"use client";

import { AlertTriangle, BookOpen, Briefcase, FileUp, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { computeBusinessIncome } from "@/lib/vn-tax/business-income";
import { computeTax } from "@/lib/vn-tax/compute-tax";
import { formatAmount, formatDate } from "@/lib/vn-tax/format";
import { parseBinanceCsv } from "@/lib/vn-tax/parse-binance-csv";
import { classifyTrade, CLAUSES } from "@/lib/vn-tax/regulation";

// Sample uses Binance P2P History format (the format the user exports).
// Native VND pricing, so tax output is directly in VND — no FX needed.
const SAMPLE_CSV = [
  "Order Number,Order Type,Asset,Fiat Type,Total Price,Price,Quantity,Exchange rate,Maker Fee,Taker Fee,Counterparty,Status,Created Time",
  // Pre-pilot buy (Jan 2026) — not taxed either way.
  "22919067578433670001,Buy,USDT,VND,2300000,26426,87.03,,,0.08,GiaoDichTuDong_247,Completed,2026-01-15 09:30:00",
  // Pre-pilot sell (Mar 26 2026) — before Circular 32 effective; grey zone, $0 tax.
  "22919067578433670002,Sell,USDT,VND,2400000,27586,87.03,,,0.08,GiaoDichTuDong_247,Completed,2026-03-26 11:00:00",
  // Taxable sell (Apr 2 2026) — on/after 27 Mar 2026; 0.1% PIT on 5,000,000 VND.
  "22919067578433670003,Sell,USDT,VND,5000000,28000,178.57,,,0.08,GiaoDichTuDong_247,Completed,2026-04-02 16:45:00",
].join("\n");

export function VnTaxCalculator() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const result = useMemo(() => {
    if (csv.trim() === "") return null;
    const parsed = parseBinanceCsv(csv);
    return { parsed, tax: computeTax(parsed.trades) };
  }, [csv]);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result ?? ""));
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  const clear = () => {
    setCsv("");
    setFileName(null);
    setShowSkipped(false);
  };

  const quoteCurrencies = result ? Object.keys(result.tax.totalsByQuote).sort() : [];
  const mixedQuotes = quoteCurrencies.length > 1;
  const firstQuote = quoteCurrencies[0] ?? "";

  return (
    <main className="min-h-screen bg-[#071018] text-[#cfd9e3] terminal-shell">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <header className="mb-6">
          <p className="terminal-label mb-2">VN TAX / CRYPTO</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-white sm:text-4xl">
            Crypto Tax Estimator
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#8aa0b5]">
            Paste a Binance Order or Trade History export. Estimates the 0.1% personal income tax
            under Circular 32/2026/TT-BTC for sells dated on/after 27 Mar 2026.
          </p>
        </header>

        <Disclaimer />

        <section className="mt-6 border border-[#1b2d3e] bg-[#0a1622]">
          <label className="terminal-label block px-4 pt-3">CSV input</label>
          <textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setFileName(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) onFile(f);
            }}
            onDragOver={(e) => e.preventDefault()}
            placeholder="Paste Binance Order History, Trade History, or P2P History CSV here, or drop a .csv file…"
            spellCheck={false}
            className="block h-48 w-full resize-y bg-transparent px-4 py-3 font-[family-name:var(--font-mono)] text-xs leading-relaxed text-[#cfd9e3] placeholder:text-[#4d6478] focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3 border-t border-[#1b2d3e] px-4 py-3 text-xs">
            <button
              type="button"
              onClick={() => {
                setCsv(SAMPLE_CSV);
                setFileName(null);
              }}
              className="terminal-icon-button inline-flex items-center gap-2 border border-[#294052] bg-[#0c1a26] px-3 text-[#aab9c8]"
            >
              <FileUp size={13} /> Load sample
            </button>
            <label className="terminal-icon-button inline-flex cursor-pointer items-center gap-2 border border-[#294052] bg-[#0c1a26] px-3 text-[#aab9c8]">
              <FileUp size={13} /> Upload .csv
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={clear}
              className="terminal-icon-button inline-flex items-center gap-2 border border-[#294052] bg-[#0c1a26] px-3 text-[#aab9c8]"
            >
              <Trash2 size={13} /> Clear
            </button>
            {fileName ? (
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">
                {fileName}
              </span>
            ) : null}
          </div>
        </section>

        {result ? (
          <Results
            result={result}
            quoteCurrencies={quoteCurrencies}
            firstQuote={firstQuote}
            mixedQuotes={mixedQuotes}
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
  result: { parsed: ReturnType<typeof parseBinanceCsv>; tax: ReturnType<typeof computeTax> };
  quoteCurrencies: string[];
  firstQuote: string;
  mixedQuotes: boolean;
  showSkipped: boolean;
  setShowSkipped: (v: boolean) => void;
}

function Results({
  result,
  quoteCurrencies,
  firstQuote,
  mixedQuotes,
  showSkipped,
  setShowSkipped,
}: ResultsProps) {
  const { parsed, tax } = result;
  const totalTax = quoteCurrencies.reduce((s, q) => s + tax.totalsByQuote[q].tax, 0);

  if (parsed.format === null) {
    return (
      <section className="mt-6 border border-[#3a2c12] bg-[#15110a] px-4 py-3 text-xs text-[#f0c97a]">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle size={14} /> Unrecognized CSV format
        </p>
        <p className="mt-1 text-[#c2a05a]">
          Expected a Binance Order History, Trade History, or P2P History export. All
          {" "}{parsed.skipped.length} body row(s) were skipped.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Total est. tax" value={formatAmount(totalTax, mixedQuotes ? undefined : firstQuote)} accent />
        <Card label="Taxable sells" value={String(tax.totals.taxableSellCount)} />
        <Card label="Grey-zone trades" value={String(tax.totals.greyZoneCount)} />
        <Card label="Skipped rows" value={String(parsed.skipped.length)} />
      </div>

      {mixedQuotes ? (
        <p className="rounded-sm border border-[#3a2c12] bg-[#15110a] px-3 py-2 text-xs text-[#f0c97a]">
          Mixed quote currencies detected ({quoteCurrencies.join(", ")}). Per-currency totals below;
          FX to VND is your responsibility.
        </p>
      ) : null}

      {quoteCurrencies.length > 0 ? (
        <div className="space-y-2">
          {quoteCurrencies.map((q) => (
            <div
              key={q}
              className="flex items-center justify-between border border-[#1b2d3e] bg-[#0a1622] px-4 py-2 text-xs"
            >
              <span className="font-[family-name:var(--font-mono)] text-[#8aa0b5]">{q}</span>
              <span className="text-[#6bcfa6]">
                gross {formatAmount(tax.totalsByQuote[q].grossProceeds)} · tax {formatAmount(tax.totalsByQuote[q].tax, q)} · {tax.totalsByQuote[q].count} sells
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#6c8094]">No taxable sells in this export.</p>
      )}

      <Explanation result={result} firstQuote={firstQuote} />

      <BusinessIncome result={result} />

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
                  row {s.rowIndex} — {s.reason}
                </p>
                <pre className="mt-1 overflow-x-auto font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">
                  {JSON.stringify(s.raw)}
                </pre>
              </div>
            ))}
          </div>
        </Collapsible>
      ) : null}
    </section>
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
      return "text-[#76e1b0] font-semibold";
    case "grey-zone":
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
  firstQuote: string;
}

function Explanation({ result, firstQuote }: ExplanationProps) {
  const { tax } = result;
  const firstTaxable = tax.taxable[0];
  const [open, setOpen] = useState(false);

  // Worked example uses the first taxable sell if present, else a placeholder
  // so the math is always legible. Falls back to 1.00 when nothing is taxable.
  const exGross = firstTaxable?.grossValue ?? 1;
  const exTax = firstTaxable?.tax ?? 0.001;
  const exPair = firstTaxable?.pair ?? "—";
  const exQuote = firstTaxable?.quote ?? firstQuote ?? "—";
  const exDate = firstTaxable ? formatDate(firstTaxable.date) : "—";

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
            <h3 className="terminal-label mb-2">Worked example</h3>
            <p className="mb-2 text-[#8aa0b5]">
              Using {exPair} sell on {exDate}:
            </p>
            <ol className="space-y-1 font-[family-name:var(--font-mono)] text-[11px] text-[#cfd9e3]">
              <li>1. transfer price (gross) = {formatAmount(exGross, exQuote)}</li>
              <li>2. PIT rate = 0.1% (0.001)</li>
              <li>3. tax = {formatAmount(exGross, exQuote)} × 0.001 = {formatAmount(exTax, exQuote)}</li>
            </ol>
          </section>

          <section>
            <h3 className="terminal-label mb-2">Step → clause mapping</h3>
            <ul className="space-y-3">
              <ClauseRow step="0.1% PIT rate" clause={CLAUSES.rate} />
              <ClauseRow step="tax base = gross transfer price (not gains)" clause={CLAUSES.base} />
              <ClauseRow step="only sells on/after 27 Mar 2026 counted" clause={CLAUSES.effectiveDate} />
              <ClauseRow step="VAT does not apply" clause={CLAUSES.vat} />
              <ClauseRow step="interim securities-analog rule (pilot)" clause={CLAUSES.pilot} />
            </ul>
          </section>

          <section className="border-t border-[#13212e] pt-3">
            <h3 className="terminal-label mb-2">Assumptions this tool makes</h3>
            <ul className="list-disc space-y-1 pl-4 text-[#8aa0b5]">
              <li>
                <strong className="text-[#cfd9e3]">Buys are not taxed.</strong> &quot;Transfer&quot; is read
                as a disposal/sale; buys are acquisitions. Only SELL rows bear 0.1%.
              </li>
              <li>
                <strong className="text-[#cfd9e3]">Licensed-provider caveat.</strong> Art. 5 applies to
                transfers <em>through a licensed crypto asset service provider</em>. Binance may not yet
                qualify under the pilot; P2P is person-to-person. Liability may differ — verify with a
                VN tax advisor.
              </li>
              <li>
                <strong className="text-[#cfd9e3]">Pre-27 Mar 2026 sells = grey zone.</strong> Circular 32
                is not retroactive; pre-pilot law was ambiguous. These land in the grey-zone bucket at
                $0 tax.
              </li>
              <li>
                <strong className="text-[#cfd9e3]">FX to VND is your job.</strong> Non-VND quotes show tax
                in the quote currency. Totals across mixed currencies are informational only.
              </li>
            </ul>
          </section>

          <section className="border-t border-[#13212e] pt-3">
            <h3 className="terminal-label mb-2">Out of scope</h3>
            <p className="text-[#8aa0b5]">
              This tool computes <strong className="text-[#cfd9e3]">individual PIT only</strong>. Domestic
              corporates face 20% CIT on net gains (proceeds − cost − expenses) under Art. 4.1. Foreign
              corporates face 0.1% CIT on gross transfer value. Wallet-to-wallet transfers, staking,
              airdrops, and futures are not handled — Circular 32 is silent on them.
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

function BusinessIncome({
  result,
}: {
  result: { parsed: ReturnType<typeof parseBinanceCsv>; tax: ReturnType<typeof computeTax> };
}) {
  const biz = useMemo(() => computeBusinessIncome(result.parsed.trades), [result]);
  const [open, setOpen] = useState(true);
  const hasData = biz.perYear.length > 0;
  const totalLow = biz.totals.pitLow;
  const totalHigh = biz.totals.pitHigh;
  const anyVndTaxable = biz.perYear.some((y) => y.status === "taxable");
  const anyUnknownFx = biz.perYear.some((y) => y.status === "unknown-fx");

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 border border-[#1b2d3e] bg-[#0a1622] px-4 py-2 text-left text-xs font-semibold text-[#8aa0b5]"
      >
        <Briefcase size={13} />
        Business-income PIT (if trading is your livelihood) — 15-20% on net profit above 500M VND revenue
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open ? (
        <div className="mt-2 space-y-4 border border-[#1b2d3e] bg-[#0a1622] px-4 py-4 text-xs">
          <div className="rounded-sm border border-[#3a2c12] bg-[#15110a] px-3 py-2 text-[11px] leading-relaxed text-[#f0c97a]">
            <p className="flex items-center gap-2 font-semibold text-[#f0c97a]">
              <AlertTriangle size={13} /> Unresolved — read before relying on this number
            </p>
            <p className="mt-1 text-[#c2a05a]">&quot;{CLAUSES.bizCharacterization.text}&quot;</p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">
              {CLAUSES.bizCharacterization.id} · {CLAUSES.bizCharacterization.effective}
            </p>
          </div>

          {!hasData ? (
            <p className="text-[#6c8094]">No sells to evaluate.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#1b2d3e] text-[#6c8094]">
                    <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                      <th>Year</th>
                      <th>Pair</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right">Cost (FIFO)</th>
                      <th className="text-right">Net profit</th>
                      <th>Status</th>
                      <th className="text-right">PIT (15-20%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {biz.perYear.map((y, i) => (
                      <tr key={i} className="border-b border-[#13212e] last:border-b-0 [&>td]:px-3 [&>td]:py-2 [&>td]:font-[family-name:var(--font-mono)] [&>td]:text-[11px]">
                        <td className="text-[#8aa0b5]">{y.year}</td>
                        <td className="text-[#cfd9e3]">{y.pair}</td>
                        <td className="text-right text-[#cfd9e3]">{formatAmount(y.revenue, y.quote)}</td>
                        <td className="text-right text-[#8aa0b5]">{formatAmount(y.costBasis, y.quote)}</td>
                        <td className={`text-right ${y.netProfit >= 0 ? "text-[#6bcfa6]" : "text-[#ff8972]"}`}>
                          {formatAmount(y.netProfit, y.quote)}
                        </td>
                        <td>
                          <span className={bizStatusColor(y.status)}>{y.status}</span>
                        </td>
                        <td className="text-right text-[#76e1b0]">
                          {y.pitRange[0] === 0 && y.pitRange[1] === 0
                            ? "0.00"
                            : `${formatAmount(y.pitRange[0])}–${formatAmount(y.pitRange[1], y.quote)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[#1b2d3e] bg-[#0d1924] [&>td]:px-3 [&>td]:py-2 [&>td]:font-[family-name:var(--font-mono)] [&>td]:text-[11px]">
                      <td colSpan={6} className="text-right text-[#8aa0b5]">Estimated business-income PIT (total)</td>
                      <td className="text-right text-[#76e1b0]">
                        {totalLow === 0 && totalHigh === 0 ? "0.00" : `${formatAmount(totalLow)}–${formatAmount(totalHigh)}`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {anyVndTaxable ? (
                <p className="text-[10px] text-[#6c8094]">
                  VND revenue exceeded 500M in at least one year → 15-20% PIT on net profit applies under the
                  business characterization. <strong className="text-[#f0c97a]">This is SEPARATE from the 0.1% transfer tax above.</strong>
                </p>
              ) : null}

              {anyUnknownFx ? (
                <p className="text-[10px] text-[#f0c97a]">
                  Non-VND quotes detected (e.g. USDT). The 500M VND revenue threshold cannot be checked without
                  FX history — per-quote net profit shown for reference only. Convert to VND at year-end rates
                  to determine if you cross the threshold.
                </p>
              ) : null}

              {biz.unmatchedWarnings.length > 0 ? (
                <p className="text-[10px] text-[#ff8972]">
                  {biz.unmatchedWarnings.length} sell(s) could not be fully matched to a buy lot (insufficient
                  purchase history in the export). Their full proceeds counted as profit, likely overstating
                  net income. Include your full buy history for an accurate basis.
                </p>
              ) : null}

              <div className="border-t border-[#13212e] pt-3 text-[11px] text-[#8aa0b5]">
                <p className="mb-1 terminal-label">Legal basis</p>
                <ClauseRow step="VND 500M/year revenue exemption threshold" clause={CLAUSES.bizExemption} />
                <div className="mt-2" />
                <ClauseRow step="15-20% on net profit above threshold" clause={CLAUSES.bizRate} />
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function bizStatusColor(status: string): string {
  switch (status) {
    case "exempt":
      return "text-[#76e1b0]";
    case "taxable":
      return "text-[#ff8972]";
    case "unknown-fx":
      return "text-[#f0c97a]";
    default:
      return "text-[#6c8094]";
  }
}
