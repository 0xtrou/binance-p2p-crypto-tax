"use client";

import { AlertTriangle, BookOpen, Download, FileUp, FileSpreadsheet, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildDeclaration } from "@/lib/vn-tax/declaration";
import { exportComplianceCsv, exportComplianceXlsx, exportDeclarationCsv, exportDeclarationXlsx } from "@/lib/vn-tax/export";
import { computeTax } from "@/lib/vn-tax/compute-tax";
import { formatAmount, formatDate } from "@/lib/vn-tax/format";
import { parseBinanceCsv } from "@/lib/vn-tax/parse-binance-csv";
import { classifyTrade, CLAUSES } from "@/lib/vn-tax/regulation";
import { S } from "@/lib/vn-tax/strings";

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
  // Start empty on both server and client (avoids hydration mismatch #418).
  // Load from localStorage after mount.
  const [sources, setSources] = useState<Sources>(EMPTY_SOURCES);
  const [mounted, setMounted] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  // One-shot hydration from localStorage after mount.
  useEffect(() => {
    setSources(loadSources());
    setMounted(true);
  }, []);

  // Persist on change (only after mount to avoid clobbering pre-hydration).
  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
    } catch {
      // Quota or privacy mode — ignore.
    }
  }, [sources, mounted]);

  // Parse each source independently; concat trades for unified declaration.
  const result = useMemo(() => {
    const parsedResults = {
      remitano: sources.remitano.trim() ? parseBinanceCsv(sources.remitano) : null,
      binance: sources.binance.trim() ? parseBinanceCsv(sources.binance) : null,
    };
    const hasAny = parsedResults.remitano || parsedResults.binance;
    if (!hasAny) return null;

    const trades = [
      ...(parsedResults.remitano?.trades.map((t) => ({ ...t, source: "Remitano" })) ?? []),
      ...(parsedResults.binance?.trades.map((t) => ({ ...t, source: "Binance" })) ?? []),
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

    const mergedFormat = parsedResults.binance?.format ?? parsedResults.remitano?.format ?? null;
    const parsed = { trades, skipped: skippedTagged, format: mergedFormat };
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
          <p className="terminal-label mb-2">{S.badge}</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-white sm:text-4xl">
            {S.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#8aa0b5]">
            {S.subtitle}
          </p>
        </header>

        <Disclaimer />

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SourcePanel
            title={S.remitanoCsv}
            accent="#67a9f5"
            value={sources.remitano}
            onChange={(v) => setSource("remitano", v)}
            onUpload={onFile("remitano")}
            onClear={() => clearSource("remitano")}
            placeholder={S.remitanoPlaceholder}
            parsed={result?.perSource.remitano ?? null}
          />
          <SourcePanel
            title={S.binanceCsv}
            accent="#f0c97a"
            value={sources.binance}
            onChange={(v) => setSource("binance", v)}
            onUpload={onFile("binance")}
            onClear={() => clearSource("binance")}
            onSample={() => setSource("binance", SAMPLE_BINANCE)}
            placeholder={S.binancePlaceholder}
            parsed={result?.perSource.binance ?? null}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">
            {totalRows > 0 ? `${totalRows} ${S.rowsLoaded}` : S.noData}
          </span>
          {totalRows > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="terminal-icon-button inline-flex items-center gap-2 text-[#aab9c8]"
            >
              <Trash2 size={13} /> {S.clearAll}
            </button>
          ) : null}
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#4d6478]">
            {S.persistedLocally}
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
            {S.noDataPrompt}
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
          {lineCount > 0 ? `${lineCount} ${S.lines}` : S.empty}
          {fmt ? ` · ${fmt}` : ""}
          {tradeCount > 0 ? ` · ${tradeCount} ${S.trades}` : ""}
          {skipCount > 0 ? ` · ${skipCount} ${S.skipped}` : ""}
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
          <FileUp size={12} /> {S.upload}
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
            <FileUp size={12} /> {S.sample}
          </button>
        ) : null}
        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="terminal-icon-button inline-flex items-center gap-1.5 text-[#aab9c8]"
          >
            <Trash2 size={12} /> {S.clear}
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
        <AlertTriangle size={14} /> {S.disclaimerTitle}
      </p>
      <p className="text-[#c2a05a]">
        {S.disclaimerBody}
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
          <AlertTriangle size={14} /> Không nhận dạng được định dạng CSV
        </p>
        <p className="mt-1 text-[#c2a05a]">
          Yêu cầu dữ liệu xuất Binance Order/Trade/P2P History hoặc Remitano. Đã bỏ qua
          {" "}{parsed.skipped.length} dòng.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label={S.totalPit} value={formatAmount(decl.totals.totalTax, "VND")} accent />
        <Card label={S.transfer01} value={formatAmount(decl.totals.transferTax, "VND")} />
        <Card label={S.otherIncome10} value={formatAmount(decl.totals.otherIncomeTax, "VND")} />
        <Card label="Lợi nhuận ròng" value={formatAmount(decl.totals.totalNetVnd, "VND")} />
        <Card label={S.totalBuyVnd} value={formatAmount(decl.totals.totalBoughtVnd, "VND")} />
        <Card label={S.totalSellVnd} value={formatAmount(decl.totals.totalSoldVnd, "VND")} />
        <Card label={S.buyCount} value={String(decl.totals.totalBuyCount)} />
        <Card label={S.sellCount} value={String(decl.totals.totalSellCount)} />
      </div>

      <AssetFlowTable decl={decl} />

      <Tabs
        tabs={[
          {
            label: S.tabDeclaration,
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
            label: S.tabBreakdown,
            content: (
              <div className="space-y-4">
                <ComplianceTable result={result} />
                {parsed.skipped.length > 0 ? (
                  <Collapsible
                    open={showSkipped}
                    onToggle={() => setShowSkipped(!showSkipped)}
                    label={`${S.skipped} (${parsed.skipped.length})`}
                  >
                    <div className="border border-[#1b2d3e] bg-[#0a1622]">
                      {parsed.skipped.map((s) => (
                        <div key={s.rowIndex} className="border-b border-[#13212e] px-4 py-2 last:border-b-0">
                          <p className="font-[family-name:var(--font-mono)] text-[11px] text-[#ff8972]">
                            dòng {s.rowIndex} — {s.reason}{ "source" in s ? ` [${(s as { source: string }).source}]` : ""}
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
  const { parsed } = result;
  const [sortKey, setSortKey] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (parsed.trades.length === 0) {
    return <p className="text-xs text-[#6c8094]">Không có giao dịch.</p>;
  }

  const rows = [...parsed.trades].sort((a, b) => {
    let cmp = 0;
    const av: string | number = sortKey === "date" ? a.date.getTime()
      : sortKey === "gross" ? a.grossValue
      : (a as unknown as Record<string, unknown>)[sortKey] as string | number;
    const bv: string | number = sortKey === "date" ? b.date.getTime()
      : sortKey === "gross" ? b.grossValue
      : (b as unknown as Record<string, unknown>)[sortKey] as string | number;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPayment = rows.reduce((s, t) => s + classifyTrade(t).payment, 0);
  const onSort = (key: string) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const sortArrow = (key: string) => key === sortKey ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  const Th = ({ k, label, right }: { k: string; label: string; right?: boolean }) => (
    <th className={`${right ? "text-right " : ""}cursor-pointer hover:text-[#cfd9e3]`} onClick={() => onSort(k)}>
      {label}{sortArrow(k)}
    </th>
  );

  return (
    <div>
      <h2 className="terminal-label mb-2">{S.complianceTitle}</h2>
      <div className="overflow-x-auto border border-[#1b2d3e] bg-[#0a1622]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#1b2d3e] text-[#6c8094]">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium select-none">
              <Th k="date" label={S.date} />
              <Th k="source" label="Nguồn" />
              <Th k="pair" label={S.pair} />
              <Th k="side" label={S.side} />
              <Th k="gross" label={S.gross} right />
              <Th k="bucket" label={S.classification} />
              <Th k="clause" label={S.clause} />
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const c = classifyTrade(t);
              return (
                <tr key={i} className="border-b border-[#13212e] last:border-b-0 [&>td]:px-3 [&>td]:py-2 [&>td]:align-top">
                  <td className="whitespace-nowrap font-[family-name:var(--font-mono)] text-[11px] text-[#8aa0b5]">{formatDate(t.date)}</td>
                  <td className="whitespace-nowrap text-[10px]">
                    <span className={t.source === "Remitano" ? "text-[#67a9f5]" : "text-[#f0c97a]"}>{t.source || "—"}</span>
                  </td>
                  <td className="whitespace-nowrap font-[family-name:var(--font-mono)] text-[11px] text-[#cfd9e3]">{t.pair}</td>
                  <td className="whitespace-nowrap font-[family-name:var(--font-mono)] text-[11px]">
                    <span className={t.side === "SELL" ? "text-[#ff8972]" : "text-[#67a9f5]"}>{t.side === "SELL" ? S.sell : S.buy}</span>
                  </td>
                  <td className="text-right font-[family-name:var(--font-mono)] text-[11px] text-[#cfd9e3]">{formatAmount(t.grossValue, t.quote)}</td>
                  <td className="text-[#a9b8c7]">
                    <span className={bucketColor(c.bucket)}>{bucketLabel(c.bucket)}</span>
                  </td>
                  <td className="font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">{c.clause.id}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#1b2d3e] bg-[#0d1924] [&>td]:px-3 [&>td]:py-2 [&>td]:font-[family-name:var(--font-mono)] [&>td]:text-[11px]">
              <td colSpan={6} className="text-right text-[#8aa0b5]">{S.totalPitToDeclare}</td>
              <td className="text-right text-[#76e1b0]">{formatAmount(totalPayment, "VND")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
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
        {S.howComputed}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open ? (
        <div className="mt-2 space-y-4 border border-[#1b2d3e] bg-[#0a1622] px-4 py-4 text-xs leading-relaxed text-[#a9b8c7]">
          <section>
            <h3 className="terminal-label mb-2">{S.twoBuckets}</h3>
            <p className="mb-2 text-[#8aa0b5]">
              {S.bucketAssignmentRule}
            </p>
            <div className="space-y-3">
              <div className="border-l-2 border-[#76e1b0] pl-3">
                <p className="font-semibold text-[#76e1b0]">{S.transferBucketTitle}</p>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-[#cfd9e3]">
                  {S.transferFormula}
                </p>
                {firstTransfer ? (
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">
                    vd {formatDate(firstTransfer.date)} {firstTransfer.pair}:{" "}
                    {formatAmount(firstTransfer.gross, "VND")} × 0,001 ={" "}
                    {formatAmount(firstTransfer.taxOwed, "VND")}
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] text-[#6c8094]">
                  {S.transferBucketNote}
                </p>
              </div>
              <div className="border-l-2 border-[#f0c97a] pl-3">
                <p className="font-semibold text-[#f0c97a]">{S.otherBucketTitle}</p>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-[#cfd9e3]">
                  {S.otherFormula}
                </p>
                {firstOther ? (
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[#6c8094]">
                    vd: tổng bán năm − tổng mua năm × 0,1 = thuế thu nhập khác năm đó
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] text-[#6c8094]">
                  {S.otherBucketNote}
                </p>
              </div>
            </div>
          </section>

          <section className="border-t border-[#13212e] pt-3">
            <h3 className="terminal-label mb-2">{S.clauseMapping}</h3>
            <ul className="space-y-3">
              <ClauseRow step="Thuế suất chuyển nhượng 0,1% (từ 27/03/2026)" clause={CLAUSES.rate} />
              <ClauseRow step="Giá chuyển nhượng = tổng giá trị (cách hiểu)" clause={CLAUSES.base} />
              <ClauseRow step="Thu nhập khác 10% (phương án dự phòng trước ngày hiệu lực)" clause={CLAUSES.otherIncome} />
              <ClauseRow step="Thông tư 32 hiệu lực 27/03/2026, không hồi tố" clause={CLAUSES.effectiveDate} />
              <ClauseRow step="Không chịu thuế GTGT" clause={CLAUSES.vat} />
              <ClauseRow step="Quy định tạm thời tương tự chứng khoán (thí điểm)" clause={CLAUSES.pilot} />
              <ClauseRow step="Thu nhập kinh doanh 15-20% (phân loại thay thế, >500 triệu/năm)" clause={CLAUSES.bizRate} />
              <ClauseRow step="Chưa rõ: nhóm nào cho người giao dịch toàn thời gian?" clause={CLAUSES.bizCharacterization} />
            </ul>
          </section>

          <section className="border-t border-[#13212e] pt-3">
            <h3 className="terminal-label mb-2">{S.caveatsTitle}</h3>
            <ul className="list-disc space-y-1 pl-4 text-[#8aa0b5]">
              <li>{S.caveatLicensed}</li>
              <li>{S.caveatPrice}</li>
              <li>{S.caveatOtherBase}</li>
              <li>{S.caveatBizRange}</li>
              <li>{S.caveatCost}</li>
              <li>{S.caveatNoBuyTax}</li>
              <li>{S.caveatNotAdvice}</li>
            </ul>
          </section>

          <section className="border-t border-[#13212e] pt-3">
            <h3 className="terminal-label mb-2">{S.outOfScopeTitle}</h3>
            <p className="text-[#8aa0b5]">
              {S.outOfScope}
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
  const [showAll, setShowAll] = useState(true);
  const [sortKey, setSortKey] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (decl.rows.length === 0) {
    return (
      <div>
        <h2 className="terminal-label mb-2 flex items-center gap-2">
          <FileSpreadsheet size={13} /> {S.declarationTitle}
        </h2>
        <p className="text-xs text-[#6c8094]">Không có giao dịch.</p>
      </div>
    );
  }

  const sorted = [...decl.rows].sort((a, b) => {
    let cmp = 0;
    const av: string | number = sortKey === "date" ? a.date.getTime()
      : sortKey === "gross" ? a.gross
      : sortKey === "taxOwed" ? a.taxOwed
      : (a as unknown as Record<string, unknown>)[sortKey] as string | number;
    const bv: string | number = sortKey === "date" ? b.date.getTime()
      : sortKey === "gross" ? b.gross
      : sortKey === "taxOwed" ? b.taxOwed
      : (b as unknown as Record<string, unknown>)[sortKey] as string | number;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const visibleRows = showAll ? sorted : sorted.slice(0, 12);
  const hiddenCount = sorted.length - visibleRows.length;
  const onSort = (key: string) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const sortArrow = (key: string) => key === sortKey ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  const Th = ({ k, label, right }: { k: string; label: string; right?: boolean }) => (
    <th className={`${right ? "text-right " : ""}cursor-pointer hover:text-[#cfd9e3]`} onClick={() => onSort(k)}>
      {label}{sortArrow(k)}
    </th>
  );

  return (
    <div>
      <h2 className="terminal-label mb-2 flex items-center gap-2">
        <FileSpreadsheet size={13} /> {S.declarationTitle}
      </h2>

      <div className="overflow-x-auto border border-[#1b2d3e] bg-[#0a1622]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#1b2d3e] text-[#6c8094]">
            <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:font-medium select-none">
              <Th k="date" label={S.date} />
              <Th k="source" label="Nguồn" />
              <Th k="pair" label={S.pair} />
              <Th k="side" label={S.side} />
              <Th k="gross" label={S.gross} right />
              <Th k="bucket" label={S.bucket} />
              <Th k="clause" label={S.clause} />
              <Th k="taxOwed" label={S.taxOwed} right />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r, i) => (
              <tr key={i} className="border-b border-[#13212e] last:border-b-0 [&>td]:px-2 [&>td]:py-1.5 [&>td]:align-top [&>td]:font-[family-name:var(--font-mono)] [&>td]:text-[10px]">
                <td className="whitespace-nowrap text-[#8aa0b5]">{formatDate(r.date)}</td>
                <td className="whitespace-nowrap">
                  <span className={r.source === "Remitano" ? "text-[#67a9f5]" : "text-[#f0c97a]"}>{r.source || "—"}</span>
                </td>
                <td className="whitespace-nowrap text-[#cfd9e3]">{r.pair}</td>
                <td className="whitespace-nowrap">
                  <span className={r.side === "SELL" ? "text-[#ff8972]" : "text-[#67a9f5]"}>{r.side === "SELL" ? S.sell : S.buy}</span>
                </td>
                <td className="text-right text-[#cfd9e3]">{formatAmount(r.gross, "VND")}</td>
                <td className="whitespace-nowrap"><span className={bucketColor(r.bucket)}>{bucketLabel(r.bucket)}</span></td>
                <td className="whitespace-nowrap text-[#6c8094]">{r.clause.id}</td>
                <td className="text-right">
                  {r.taxOwed > 0 ? <span className="text-[#76e1b0]">{formatAmount(r.taxOwed, "VND")}</span> : <span className="text-[#6c8094]">{r.side === "SELL" ? "× năm" : "—"}</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#1b2d3e] bg-[#0d1924] [&>td]:px-2 [&>td]:py-2 [&>td]:font-[family-name:var(--font-mono)] [&>td]:text-[11px]">
              <td colSpan={7} className="text-right text-[#8aa0b5]">{S.totalPitToDeclare}</td>
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
          <ChevronDown size={13} /> {S.showMore} {hiddenCount} {S.moreTrades}
        </button>
      ) : showAll && decl.rows.length > 12 ? (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="terminal-icon-button mt-2 text-[#aab9c8]"
        >
          <ChevronUp size={13} /> {S.collapse}
        </button>
      ) : null}

      {decl.yearSummaries.length > 0 ? (
        <div className="mt-3 border border-[#1b2d3e] bg-[#0a1622] px-3 py-2 text-[11px]">
          <p className="terminal-label mb-2">Tóm tắt theo năm</p>
          <table className="w-full text-left font-[family-name:var(--font-mono)] text-[10px]">
            <thead className="text-[#6c8094]">
              <tr>
                <th className="py-1">Năm</th>
                <th className="text-right">Tổng mua</th>
                <th className="text-right">Tổng bán</th>
                <th className="text-right">Lợi nhuận ròng</th>
                <th className="text-right">Thuế chuyển nhượng 0,1%</th>
                <th className="text-right">Thu nhập khác 10%</th>
                <th className="text-right">Tổng thuế</th>
              </tr>
            </thead>
            <tbody>
              {decl.yearSummaries.map((y) => (
                <tr key={y.year} className="border-t border-[#13212e] [&>td]:py-1">
                  <td className="text-[#cfd9e3]">{y.year}</td>
                  <td className="text-right text-[#67a9f5]">{formatAmount(y.boughtVnd, "VND")}</td>
                  <td className="text-right text-[#ff8972]">{formatAmount(y.soldVnd, "VND")}</td>
                  <td className={`text-right ${y.netVnd > 0 ? "text-[#76e1b0]" : "text-[#6c8094]"}`}>{formatAmount(y.netVnd, "VND")}</td>
                  <td className="text-right text-[#76e1b0]">{formatAmount(y.transferTax, "VND")}</td>
                  <td className="text-right text-[#f0c97a]">{formatAmount(y.otherIncomeTax, "VND")}</td>
                  <td className="text-right font-semibold text-[#76e1b0]">{formatAmount(y.totalTax, "VND")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-relaxed text-[#6c8094]">
        {S.estNotFiling}
      </p>
    </div>
  );
}

function AssetFlowTable({ decl }: { decl: ReturnType<typeof buildDeclaration> }) {
  if (decl.assetFlows.length === 0) return null;
  return (
    <div>
      <h2 className="terminal-label mb-2">{S.assetFlowTitle}</h2>
      <div className="overflow-x-auto border border-[#1b2d3e] bg-[#0a1622]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#1b2d3e] text-[#6c8094]">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>{S.assetCol}</th>
              <th className="text-right">{S.boughtCol}</th>
              <th className="text-right">{S.soldCol}</th>
              <th className="text-right">{S.gapCol}</th>
            </tr>
          </thead>
          <tbody>
            {decl.assetFlows.map((f) => {
              const gap = f.soldVnd - f.boughtVnd;
              return (
                <tr key={f.asset} className="border-b border-[#13212e] last:border-b-0 [&>td]:px-3 [&>td]:py-2 [&>td]:font-[family-name:var(--font-mono)] [&>td]:text-[11px]">
                  <td className="text-[#cfd9e3]">{f.asset}</td>
                  <td className="text-right text-[#67a9f5]">{formatAmount(f.boughtVnd, "VND")}</td>
                  <td className="text-right text-[#ff8972]">{formatAmount(f.soldVnd, "VND")}</td>
                  <td className={`text-right ${gap > 0 ? "text-[#f0c97a]" : "text-[#6c8094]"}`}>
                    {gap > 0 ? "+" : ""}{formatAmount(gap, "VND")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[#6c8094]">{S.assetFlowNote}</p>
    </div>
  );
}

function bucketLabel(bucket: string): string {
  switch (bucket) {
    case "transfer": return S.bucketTransfer;
    case "other-income": return S.bucketOther;
    case "buy": return S.buy;
    case "taxable": return S.bucketTransfer;
    case "grey-zone": return S.bucketOther;
    default: return bucket;
  }
}

