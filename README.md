# US + Malaysia Stock Radar

Minimal daily stock dashboard for:
- US equities
- Bursa Malaysia equities
- Daily sector ranking
- Focus-counter shortlist
- Technical entry / TP1 / TP2 / TP3 / SL
- Fundamental health snapshot
- Quarterly / annual filing links
- Latest company announcement links
- Bursa Shariah status support

## Deploy

1. Upload this repository to GitHub.
2. Import the repo into Vercel.
3. No build command is required.
4. Optional: add `TWELVE_DATA_API_KEY` in Vercel for more reliable market data. Without it, the dashboard uses Yahoo Finance chart data where available.
5. Open the deployed URL.

## Important

The dashboard is a research/radar tool, not financial advice. Prices, filings and announcements can change. "BUY/SELL" levels are algorithmic reference levels and must be independently checked before trading.

## Architecture

- `index.html` — UI
- `app.js` — dashboard logic
- `styles.css` — minimal UI
- `api/market.js` — market candles
- `api/company.js` — company research / filing links
- `api/quote.js` — quote
- `data/universe.js` — US/Bursa universe and sectors
- `data/shariah.js` — Bursa Shariah status cache structure

For Malaysia, Shariah status is intended to follow the Securities Commission Malaysia SAC list. The SC updates the official list twice yearly.
