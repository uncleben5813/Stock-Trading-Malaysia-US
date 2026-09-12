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
      =========================================================
      US RADAR
      =========================================================
    */

    if (market === "US") {
      const candidates = new Map();

      const urls = [
        "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&count=100",
        "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=100"
      ];

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
            const symbol = String(q.symbol || "");

            if (!symbol) continue;

            /*
              Buang benda pelik / foreign listing.
            */

            if (
              symbol.includes("^") ||
              symbol.includes("=") ||
              symbol.includes("-") ||
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
                Number(
                  q.regularMarketChangePercent || 0
                ),
              volume:
                Number(
                  q.regularMarketVolume || 0
                ),
              marketCap:
                Number(q.marketCap || 0)
            });
          }
        } catch (e) {
          console.warn(
            "US screener failed:",
            e.message
          );
        }
      }

      /*
        Kalau Yahoo US gagal,
        guna universe asal.
      */

      if (!candidates.size) {
        for (const symbol of US_FALLBACK) {
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

      const clean = [...candidates.values()]
        .slice(0, 100);

      return res.status(200).json({
        ok: true,
        market: "US",
        count: clean.length,
        source:
          clean.some(x => x.price > 0)
            ? "yahoo"
            : "fallback",
        candidates: clean
      });
    }

    /*
      =========================================================
      MALAYSIA RADAR
      =========================================================

      Yahoo predefined screener memang tidak reliable
      untuk Bursa Malaysia.

      Jadi kita terus ambil quote untuk universe kita.
    */

    if (market === "MY") {
      const symbols = MY_FALLBACK.join(",");

      let quotes = [];

      try {
        const url =
          "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
          encodeURIComponent(symbols);

        const r = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        });

        if (r.ok) {
          const j = await r.json();

          quotes =
            j?.quoteResponse?.result || [];
        }
      } catch (e) {
        console.warn(
          "MY quote failed:",
          e.message
        );
      }

      const quoteMap = new Map();

      for (const q of quotes) {
        if (!q?.symbol) continue;

        quoteMap.set(q.symbol, {
          symbol: q.symbol,
          name:
            q.longName ||
            q.shortName ||
            q.symbol,
          price:
            Number(
              q.regularMarketPrice || 0
            ),
          change:
            Number(
              q.regularMarketChangePercent || 0
            ),
          volume:
            Number(
              q.regularMarketVolume || 0
            ),
          marketCap:
            Number(q.marketCap || 0)
        });
      }

      /*
        Pastikan semua 30 counter kekal wujud.
      */

      const candidates =
        MY_FALLBACK.map(symbol => {

          const live =
            quoteMap.get(symbol);

          if (live) {
            return live;
          }

          return {
            symbol,
            name: symbol,
            price: 0,
            change: 0,
            volume: 0,
            marketCap: 0
          };
        });

      const liveCount =
        candidates.filter(
          x => x.price > 0
        ).length;

      return res.status(200).json({
        ok: true,
        market: "MY",
        count: candidates.length,
        liveCount,
        source:
          liveCount > 0
            ? "yahoo_quote"
            : "fallback",
        candidates
      });
    }

    /*
      =========================================================
      INVALID MARKET
      =========================================================
    */

    return res.status(400).json({
      ok: false,
      error:
        "Invalid market. Use US or MY."
    });

  } catch (e) {
    console.error(
      "Radar error:",
      e
    );

    return res.status(500).json({
      ok: false,
      error:
        e?.message ||
        "Radar server error"
    });
  }
}
