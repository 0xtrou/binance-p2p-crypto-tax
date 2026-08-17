import type { Metadata } from "next";
import { VnTaxCalculator } from "@/components/vn-tax-calculator";

export const metadata: Metadata = {
  title: "VN Crypto Tax Estimator",
  description:
    "Create a working record for Vietnam crypto transactions. Estimates 0.1% only for sales from 27 March 2026 and flags earlier sales for professional review.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return <VnTaxCalculator />;
}
