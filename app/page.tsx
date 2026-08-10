import type { Metadata } from "next";
import { VnTaxCalculator } from "@/components/vn-tax-calculator";

export const metadata: Metadata = {
  title: "VN Crypto Tax Estimator",
  description:
    "Paste a Binance Order or Trade History CSV and estimate the 0.1% personal income tax due under Vietnam's Circular 32/2026/TT-BTC.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return <VnTaxCalculator />;
}
