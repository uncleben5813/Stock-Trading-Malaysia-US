// api/radar.js
// Vercel Serverless - US + Malaysia Stock Radar
// Safe mode: sequential batches, latest available data when market is closed.

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const US_SYMBOLS = [
    "KHC","SMR","INTC","NOK","SPCX","ORCL","NVDA","NU","AAL","BMNR",
    "GRAB","KVUE","SMCI","MARA","AAPL","T","PATH","ONDS","F","ABEV",
    "CIFR","NIO","HPE","AUR","RIG","PLUG","JOBY","SNAP","OPEN","IREN",
    "WULF","KEEL","TSLA","PCG","HPQ","AGNC","AMZN","BSX","BAC","PFE",
    "UBER","ITUB","HDB","SOFI","GOOGL","STLA","DNN","BBD","HL","NFLX",
    "CPRT","VG","CLSK","PURR","VALE","OKLO","AVGO","ACHR","HOOD","NKE",
    "MSTR","HBAN","RIVN","MU","AMD","CDE","PBR","CRWV","RKT","MRVL",
    "TENB","WMT","CAG","META","INFY","LUMN","CCL","CNH","AMC","CMCSA",
    "VZ","OWL","MRNA","BTG","PLTR","IONQ","NCLH","CCC","USAR","SLS",
    "SKHY","DELL","RGTI","CSCO","RKLB","GGB","MSFT","PINS","ERIC","LYG"
  ];

  const MY_SYMBOLS = [
    "1023.KL","1155.KL","1295.KL","5819.KL","4863.KL",
    "6012.KL","6947.KL","3042.KL","7089.KL","4677.KL",
    "5183.KL","5681.KL","5347.KL","5398.KL","5211.KL",
    "4197.KL","1961.KL","8869.KL","3816.KL","4707.KL",
    "7084.KL","5225.KL","7153.KL","7113.KL","7086.KL",
    "0166.KL","0097.KL","5285.KL","4065.KL","2445.KL"
  ];

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function safeNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function changePercent(price, previousClose) {
    price = safeNumber(price);
    previousClose = safeNumber(previousClose);

    if (!price || !previousClose) return 0;

    return ((price - previousClose) / previousClose) * 100;
  }

  async function getYahoo(symbol) {
    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(symbol) +
      "?range=5d&interval=1d&events=history";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return null;
      }

      const json = await response.json();

      const result = json?.chart?.result?.[0];

      if (!result) {
        return null;
      }

      const meta = result.meta || {};
      const quote = result.indicators?.quote?.[0] || {};

      const closes = Array.isArray(quote.close)
        ? quote.close.filter(v => Number.isFinite(Number(v)))
        : [];

      const volumes = Array.isArray(quote.volume)
        ? quote.volume.filter(v => Number.isFinite(Number(v)))
        : [];

      // IMPORTANT:
      // When market is closed, regularMarketPrice can still contain
      // the latest traded price.
      let price = safeNumber(meta.regularMarketPrice);

      if (!price && closes.length) {
        price = safeNumber(closes[closes.length - 1]);
      }

      let previousClose = safeNumber(meta.previousClose);

      // If previousClose is unavailable, calculate from last 2 candles.
      if (!previousClose && closes.length >= 2) {
        previousClose = safeNumber(closes[closes.length - 2]);
      }

      let volume = safeNumber(meta.regularMarketVolume);

      if (!volume && volumes.length) {
        volume = safeNumber(volumes[volumes.length - 1]);
      }

      const marketTime = meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : null;

      const marketState = meta.marketState || "CLOSED";

      const change = changePercent(price, previousClose);

      return {
        symbol,
        name: meta.longName || meta.shortName || symbol,
        price,
        previousClose,
        change,
        volume,
        marketCap: safeNumber(meta.marketCap),
        currency: meta.currency || null,
        exchange: meta.exchangeName || null,
        marketState,
        marketTime,
        available: price > 0
      };

    } catch (error) {
      return null;
    }
  }

  async function scanMarket(symbols, market) {
    const candidates = [];

    // Small batches prevent Vercel from being overloaded.
    const BATCH_SIZE = 5;

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(symbol => getYahoo(symbol))
      );

      for (const item of results) {
        if (item) {
          candidates.push(item);
        }
      }

      // Small pause between batches.
      if (i + BATCH_SIZE < symbols.length) {
        await sleep(100);
      }
    }

    // Sort by absolute movement first.
    candidates.sort((a, b) => {
      const moveA = Math.abs(safeNumber(a.change));
      const moveB = Math.abs(safeNumber(b.change));

      if (moveB !== moveA) {
        return moveB - moveA;
      }

      return safeNumber(b.volume) - safeNumber(a.volume);
    });

    return {
      ok: true,
      market,
      count: candidates.length,
      liveCount: candidates.filter(x =>
        x.marketState === "REGULAR"
      ).length,
      availableCount: candidates.filter(x =>
        x.available
      ).length,
      source: "yahoo",
      marketOpen: candidates.some(x =>
        x.marketState === "REGULAR"
      ),
      candidates
    };
  }

  try {
    const requestedMarket =
      String(req.query?.market || "ALL").toUpperCase();

    if (requestedMarket === "US") {
      const result = await scanMarket(US_SYMBOLS, "US");
      return res.status(200).json(result);
    }

    if (
      requestedMarket === "MY" ||
      requestedMarket === "MALAYSIA"
    ) {
      const result = await scanMarket(MY_SYMBOLS, "MY");
      return res.status(200).json(result);
    }

    // Default = both markets.
    const [us, my] = await Promise.all([
      scanMarket(US_SYMBOLS, "US"),
      scanMarket(MY_SYMBOLS, "MY")
    ]);

    return res.status(200).json({
      ok: true,
      market: "ALL",
      generatedAt: new Date().toISOString(),
      US: us,
      MY: my
    });

  } catch (error) {
    console.error("RADAR_ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "RADAR_FUNCTION_FAILED",
      message: error?.message || "Unknown server error"
    });
  }
}
