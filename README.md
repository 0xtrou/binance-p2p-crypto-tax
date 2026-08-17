# VN Crypto Tax Estimator

Browser-only working-record tool for Vietnam crypto transactions from Binance and Remitano CSV exports.

## Scope and legal notice

- **From 27 March 2026:** estimates **0.1% personal income tax** on each sell using Circular `32/2026/TT-BTC` as announced by the Ministry of Finance.
- **2019 through 26 March 2026:** marks sells for review and assigns **no automatic tax**. The tool does not treat an assumed 0.1% or 10% rate as a filing rule for this period.
- **No automatic retroactivity:** this is a ChatGPT-assisted synthesis of public sources, not legal advice or official tax guidance. Keep source records and get written advice from the tax authority or a licensed Vietnam tax adviser before filing or amending historic periods.
- **Exports:** CSV exports prepend this notice and official-source links; XLSX exports include a `Lưu ý pháp lý` sheet.

Official sources:

- [Ministry of Finance: Circular 32/2026/TT-BTC](https://www.mof.gov.vn/tin-tuc-tai-chinh/tin-tuc-su-kien-8/bo-tai-chinh-ban-hanh-thong-tu-so-322026tt-btc-ve-chinh-sach-thue-doi-voi-tai-san-ma-hoa)
- [Government Gazette: Personal Income Tax Law 109/2025/QH15](https://congbao.chinhphu.vn/van-ban/luat-so-109-2025-qh15-468671/61623.htm)
- [Government portal: Law 64/2025/QH15](https://vanban.chinhphu.vn/?classid=1&docid=213327&pageid=27160)

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, then paste a CSV or click **Load sample**.

## Scripts

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run test:tax` — parser and tax-engine tests

## Stack

- Next.js 16 (App Router)
- TypeScript, React 19
- Tailwind CSS 4
- Zod 4
- Fully client-side — trade data never leaves the browser
