export default async function handler(req, res) {
  try {
    const market = String(req.query.market || "US").toUpperCase();

    const US_FALLBACK = [
      "NVDA","AMD","AVGO","TSM","MU","INTC",
      "AAPL","MSFT","GOOGL","AMZN","META","ORCL",
      "CRM","PLTR","NFLX","TSLA","LLY","UNH",
      "XOM","CVX","JPM","BAC","V","MA","WMT","COST",
      "CAT","GE","RTX","LIN","ADBE","IBM","UBER",
      "COIN","CRWD"
    ];

    const MY_FALLBACK = [
      "1023.KL","1155.KL","1295.KL","5819.KL",
      "4863.KL","6012.KL","6947.KL","3042.KL",
      "7089.KL","4677.KL","5183.KL","5681.KL",
      "5347.KL","5398.KL","5211.KL","4197.KL",
      "1961.KL","8869.KL","3816.KL","4707.KL",
      "7084.KL","5225.KL","7153.KL","7113.KL",
      "7086.KL","0166.KL","0097.KL","5285.KL",
      "4065.KL","2445.KL"
    ];

    /*
      Yahoo predefined screener.

      US:
      most_actives = saham yang paling aktif
      day_gainers = saham yang sedang naik
      day_losers = saham yang sedang turun

      Kita gabungkan supaya radar tidak bergantung
      kepada satu counter sahaja.
    */

    const urls =
      market === "MY"
        ? [
            "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&count=100"
          ]
        : [
            "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&count=100",
            "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=100"
          ];

    const candidates = new Map();

    for (const url of urls) {
      try {
        const r = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        });

        if (!r.ok) continue;

        const j = await r.json();

        const quotes =
          j?.finance?.result?.[0]?.quotes || [];

        for (const q of quotes) {
          const symbol = q.symbol;

          if (!symbol) continue;

          /*
            MY hanya ambil .KL
          */

          if (
            market === "MY" &&
            !symbol.endsWith(".KL")
          ) {
            continue;
          }

          /*
            US jangan ambil foreign .KL
          */

          if (
            market === "US" &&
            symbol.endsWith(".KL")
          ) {
            continue;
          }

          candidates.set(symbol, {
            symbol,
            name:
              q.longName ||
              q.shortName ||
              symbol,
            price:
              Number(q.regularMarketPrice || 0),
            change:
              Number(q.regularMarketChangePercent || 0),
            volume:
              Number(q.regularMarketVolume || 0),
            marketCap:
              Number(q.marketCap || 0)
          });
        }
      } catch (e) {
        console.warn("Screener failed:", e.message);
      }
    }

    /*
      Kalau Yahoo screener gagal,
      fallback kepada universe asal.
    */

    if (!candidates.size) {
      const fallback =
        market === "US"
          ? US_FALLBACK
          : MY_FALLBACK;

      for (const symbol of fallback) {
        candidates.set(symbol, {
          symbol,
          name: symbol,
          price: 0,
          change: 0,
          volume: 0,
          marketCap: 0
        });
      }
    }

    /*
      Buang ETF / index / benda pelik.
    */

    const clean = [...candidates.values()]
      .filter(x => {
        if (!x.symbol) return false;

        if (
          x.symbol.includes("^") ||
          x.symbol.includes("=") ||
          x.symbol.includes("-")
        ) {
          return false;
        }

        return true;
      })
      .slice(0, 100);

    return res.status(200).json({
      ok: true,
      market,
      count: clean.length,
      candidates: clean
    });

  } catch (e) {
    console.error("Radar error:", e);

    return res.status(500).json({
      ok: false,
      error: e.message
    });
  }
}
