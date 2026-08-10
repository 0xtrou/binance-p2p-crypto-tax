import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ variable: "--signal-sans", subsets: ["latin"] });
const mono = DM_Mono({ variable: "--signal-mono", subsets: ["latin"], weight: ["400", "500"] });
const display = Fraunces({ variable: "--signal-display", subsets: ["latin"], weight: ["600", "700"] });

const siteName = "VN Crypto Tax Estimator";
const description =
  "Estimate Vietnam personal income tax on Binance trades under Circular 32/2026/TT-BTC. Paste a CSV export; 0.1% PIT on each sell dated on/after 27 March 2026.";

export const metadata: Metadata = {
  title: { default: `${siteName}`, template: `%s | ${siteName}` },
  description,
  applicationName: siteName,
  referrer: "strict-origin-when-cross-origin",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title: siteName,
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#071018",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
