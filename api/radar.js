export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const market = String(req.query?.market || "US").toUpperCase() === "MY"
    ? "MY"
    : "US";

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

  const fallback =
    market === "MY"
      ? MY_FALLBACK
      : US_FALLBACK;

  function fallbackCandidates() {
    return fallback.map(symbol => ({
      symbol,
      name: symbol,
      price: 0,
      change: 0,
      volume: 0,
      marketCap: 0
    }));
  }

  async function yahoo(url) {
    try {
      const controller = new AbortController();

      const timer = setTimeout(() => {
        controller.abort();
      }, 8000);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        },
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        return [];
      }

      const json = await response.json();

      return (
        json?.finance?.result?.[0]?.quotes || []
      );
    } catch (error) {
      console.warn(
        "Yahoo radar request failed:",
        error?.message || error
      );

      return [];
    }
  }

  try {
    /*
      Yahoo screener.
      Kalau Yahoo gagal, function TIDAK crash.
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

    /*
      Request satu-satu.
      Elak Promise.all yang boleh buat behaviour
      serverless lebih susah dikawal.
    */

    for (const url of urls) {
      const quotes = await yahoo(url);

      for (const q of quotes) {
        try {
          const symbol = String(q?.symbol || "");

          if (!symbol) continue;

          /*
            Malaysia:
            hanya .KL
          */
          if (
            market === "MY" &&
            !symbol.endsWith(".KL")
          ) {
            continue;
          }

          /*
            US:
            buang .KL
          */
          if (
            market === "US" &&
            symbol.endsWith(".KL")
          ) {
            continue;
          }

          /*
            Buang index / forex / futures pelik
          */
          if (
            symbol.includes("^") ||
            symbol.includes("=") ||
            symbol.includes("-")
          ) {
            continue;
          }

          candidates.set(symbol, {
            symbol,

            name:
              q.longName ||
              q.shortName ||
              symbol,

            price: Number(
              q.regularMarketPrice || 0
            ),

            change: Number(
              q.regularMarketChangePercent || 0
            ),

            volume: Number(
              q.regularMarketVolume || 0
            ),

            marketCap: Number(
              q.marketCap || 0
            )
          });
        } catch (error) {
          console.warn(
            "Radar quote skipped:",
            error?.message || error
          );
        }
      }
    }

    /*
      Yahoo tak bagi data?
      Jangan return 500.
      Guna fallback.
    */

    let clean = [...candidates.values()];

    if (!clean.length) {
      clean = fallbackCandidates();
    }

    /*
      Hadkan kepada 100 counter.
    */

    clean = clean
      .filter(x => x && x.symbol)
      .slice(0, 100);

    return res.status(200).json({
      ok: true,
      market,
      count: clean.length,
      source:
        candidates.size > 0
          ? "yahoo"
          : "fallback",
      candidates: clean
    });

  } catch (error) {
    /*
      PENTING:
      Apa-apa unexpected error pun jangan
      biarkan serverless function mati.
    */

    console.error(
      "RADAR HANDLER ERROR:",
      error?.message || error
    );

    return res.status(200).json({
      ok: true,
      market,
      count: fallback.length,
      source: "fallback-error",
      warning:
        error?.message ||
        "Yahoo radar unavailable",
      candidates: fallbackCandidates()
    });
  }
}
