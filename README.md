# VN Crypto Tax Estimator

Estimate Vietnam personal income tax (PIT) on Binance trades under **Circular 32/2026/TT-BTC**.

Paste a Binance Order History or Trade History CSV. The tool computes the **0.1% PIT** on each **sell** dated on/after **27 March 2026** (the Circular's effective date), groups totals by quote currency, and buckets pre-effective-date sells in a grey-zone list at $0 tax.

## What this computes

Per **Article 5** of Circular 32/2026/TT-BTC (official English translation read in full):

> Individual investors (regardless of whether they are residents or non-residents) who transfer crypto assets through a crypto asset service provider are subject to personal income tax at a rate of **0.1% on the transfer price for each transaction**.

- **Rate:** 0.1% of gross sell value (transfer price, not gains)
- **Effective:** 27 March 2026, for the duration of the crypto asset market pilot under Resolution 05/2025/NQ-CP
- **Taxed legs:** sells only (buys are acquisitions, not transfers)
- **VAT:** exempt (Art. 3.1)

## Caveats

This is an **estimate, not tax advice**. The 0.1% rate is written for transfers through *licensed* VN crypto asset service providers; Binance may not yet qualify under the pilot, so actual liability may differ. Verify with a VN tax advisor before filing. Pre-27 Mar 2026 sells fall outside the Circular and land in the grey-zone bucket.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, paste a CSV or click **Load sample**.

## Scripts

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm run lint` — eslint
- `npm run test:tax` — unit tests for the parser and tax engine (`lib/vn-tax`)

## Stack

- Next.js 16 (App Router)
- TypeScript, React 19
- Tailwind CSS 4
- Zod 4
- Fully client-side — trade data never leaves the browser
