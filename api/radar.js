export default async function handler(req, res) {
  const market = String(req.query.market || "US").toUpperCase();

  const US = [
    ["NVDA","NVIDIA","Semiconductors"],
    ["AMD","AMD","Semiconductors"],
    ["AVGO","Broadcom","Semiconductors"],
    ["TSM","TSMC","Semiconductors"],
    ["MU","Micron","Semiconductors"],
    ["AAPL","Apple","Technology Hardware"],
    ["MSFT","Microsoft","Software"],
    ["GOOGL","Alphabet","Internet"],
    ["AMZN","Amazon","Internet"],
    ["META","Meta","Internet"],
    ["ORCL","Oracle","Software"],
    ["CRM","Salesforce","Software"],
    ["PLTR","Palantir","Software"],
    ["NFLX","Netflix","Media"],
    ["TSLA","Tesla","Automobiles"],
    ["LLY","Eli Lilly","Pharmaceuticals"],
    ["UNH","UnitedHealth","Healthcare"],
    ["XOM","Exxon Mobil","Energy"],
    ["CVX","Chevron","Energy"],
    ["JPM","JPMorgan","Banks"],
    ["BAC","Bank of America","Banks"],
    ["V","Visa","Financial Services"],
    ["MA","Mastercard","Financial Services"],
    ["WMT","Walmart","Retail"],
    ["COST","Costco","Retail"],
    ["CAT","Caterpillar","Industrials"],
    ["GE","GE Aerospace","Industrials"],
    ["RTX","RTX","Aerospace & Defense"],
    ["LIN","Linde","Chemicals"],
    ["ADBE","Adobe","Software"],
    ["INTC","Intel","Semiconductors"],
    ["IBM","IBM","IT Services"],
    ["UBER","Uber","Transport"],
    ["COIN","Coinbase","Financial Services"],
    ["CRWD","CrowdStrike","Cybersecurity"]
  ];

  const MY = [
    ["1023.KL","CIMB","Banks"],
    ["1155.KL","Maybank","Banks"],
    ["1295.KL","Public Bank","Banks"],
    ["5819.KL","Hong Leong Bank","Banks"],
    ["4863.KL","Telekom Malaysia","Telecommunications"],
    ["6012.KL","Maxis","Telecommunications"],
    ["6947.KL","CelcomDigi","Telecommunications"],
    ["3042.KL","Petronas Gas","Utilities"],
    ["7089.KL","YTL Power","Utilities"],
    ["4677.KL","YTL Corp","Utilities"],
    ["5183.KL","Petronas Dagangan","Consumer Fuels"],
    ["5681.KL","Petronas Chemicals","Chemicals"],
    ["5347.KL","GAMUDA","Construction"],
    ["5398.KL","IJM","Construction"],
    ["5211.KL","Sunway","Construction"],
    ["4197.KL","Sime Darby Plantation","Plantation"],
    ["1961.KL","IOI","Plantation"],
    ["8869.KL","Dialog","Oil & Gas Services"],
    ["3816.KL","MISC","Marine Transport"],
    ["4707.KL","Nestle Malaysia","Food"],
    ["7084.KL","QL Resources","Food"],
    ["5225.KL","IHH Healthcare","Healthcare"],
    ["7153.KL","Kossan","Rubber Products"],
    ["7113.KL","Top Glove","Rubber Products"],
    ["7086.KL","Hartalega","Healthcare Equipment"],
    ["0166.KL","Frontken","Semiconductors"],
    ["0097.KL","Greatech","Semiconductors"],
    ["5285.KL","Sime Darby","Industrial"],
    ["4065.KL","PPB","Food"],
    ["2445.KL","KLK","Plantation"]
  ];

  const list = market === "MY" ? MY : US;

  function sma(values, n) {
    if (values.length < n) return null;

    const a = values.slice(-n);

    return a.reduce((sum, v) => sum + v, 0) / n;
  }

  function atr(candles, n = 14) {
    if (candles.length < n + 1) return 0;

    const tr = [];

    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const p = candles[i - 1];

      tr.push(
        Math.max(
          c.high - c.low,
          Math.abs(c.high - p.close),
          Math.abs(c.low - p.close)
        )
      );
    }

    return sma(tr, n) || 0;
  }

  function rsi(candles, n = 14) {
    if (candles.length < n + 1) return 50;

    let gain = 0;
    let loss = 0;

    for (let i = candles.length - n; i < candles.length; i++) {
      const change =
        candles[i].close - candles[i - 1].close;

      if (change > 0) gain += change;
      else loss -= change;
    }

    if (loss === 0) return 100;

    const rs = gain / loss;

    return 100 - 100 / (1 + rs);
  }

  function analyze(item, candles) {
    if (!candles || candles.length < 20) {
      return {
        symbol: item[0],
        name: item[1],
        sector: item[2],
        score: 0,
        signal: "NO DATA",
        price: null,
        entry: null,
        sl: null,
        tp1: null,
        tp2: null,
        tp3: null
      };
    }

    const price = candles.at(-1).close;

    const closes = candles.map(x => x.close);

    const ma20 = sma(closes, 20);
    const ma50 = sma(closes, 50);

    const r = rsi(candles);
    const a = atr(candles);

    let score = 50;

    // Trend
    if (ma20 !== null) {
      score += price > ma20 ? 10 : -10;
    }

    if (ma50 !== null) {
      score += price > ma50 ? 10 : -10;
    }

    if (ma20 !== null && ma50 !== null) {
      score += ma20 > ma50 ? 10 : -10;
    }

    // RSI momentum
    if (r >= 60) score += 10;
    else if (r >= 55) score += 5;
    else if (r <= 40) score -= 10;
    else if (r <= 45) score -= 5;

    // 20-session momentum
    const old = closes[Math.max(0, closes.length - 21)];

    if (old > 0) {
      const ret = (price / old - 1) * 100;

      if (ret >= 8) score += 10;
      else if (ret >= 3) score += 5;
      else if (ret <= -8) score -= 10;
      else if (ret <= -3) score -= 5;
    }

    score = Math.max(
      0,
      Math.min(100, Math.round(score))
    );

    let signal = "WATCH";

    if (
      score >= 70 &&
      ma20 !== null &&
      ma50 !== null &&
      price > ma20 &&
      ma20 > ma50 &&
      r >= 52
    ) {
      signal = "BUY";
    }

    if (
      score <= 35 &&
      ma20 !== null &&
      ma50 !== null &&
      price < ma20 &&
      ma20 < ma50 &&
      r <= 48
    ) {
      signal = "SELL";
    }

    let entry = price;
    let sl = null;
    let tp1 = null;
    let tp2 = null;
    let tp3 = null;

    const volatility = a || price * 0.015;

    if (signal === "BUY") {
      sl = price - volatility * 1.35;
      tp1 = price + volatility;
      tp2 = price + volatility * 2;
      tp3 = price + volatility * 3;
    }

    if (signal === "SELL") {
      sl = price + volatility * 1.35;
      tp1 = price - volatility;
      tp2 = price - volatility * 2;
      tp3 = price - volatility * 3;
    }

    return {
      symbol: item[0],
      name: item[1],
      sector: item[2],

      score,
      signal,

      price,
      entry,
      sl,
      tp1,
      tp2,
      tp3,

      rsi: Number(r.toFixed(2)),
      ma20,
      ma50,
      atr: volatility,

      return20:
        old > 0
          ? Number(((price / old - 1) * 100).toFixed(2))
          : 0
    };
  }

  async function getCandles(symbol) {
    try {
      const url =
        `${getBaseUrl(req)}/api/market` +
        `?symbol=${encodeURIComponent(symbol)}` +
        `&range=6mo&interval=1d`;

      const response = await fetch(url);

      if (!response.ok) return [];

      const data = await response.json();

      if (!data.ok || !Array.isArray(data.candles)) {
        return [];
      }

      return data.candles.filter(c =>
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close)
      );

    } catch {
      return [];
    }
  }

  const results = [];

  // Small batches to avoid hammering the API
  for (let i = 0; i < list.length; i += 5) {
    const batch = list.slice(i, i + 5);

    const batchResults = await Promise.all(
      batch.map(async item => {
        const candles = await getCandles(item[0]);

        return analyze(item, candles);
      })
    );

    results.push(...batchResults);
  }

  const valid = results.filter(
    x => x.signal !== "NO DATA"
  );

  // -------------------------
  // SECTOR RANKING
  // -------------------------

  const sectorMap = {};

  for (const x of valid) {
    if (!sectorMap[x.sector]) {
      sectorMap[x.sector] = [];
    }

    sectorMap[x.sector].push(x);
  }

  const sectors = Object.entries(sectorMap)
    .map(([sector, items]) => {

      const score =
        items.reduce(
          (sum, x) => sum + x.score,
          0
        ) / items.length;

      const buyCount =
        items.filter(x => x.signal === "BUY").length;

      return {
        sector,
        score: Math.round(score),
        counters: items.length,
        buyCount
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((x, i) => ({
      rank: i + 1,
      ...x
    }));

  // -------------------------
  // COUNTER RANKING
  // -------------------------

  const focus = valid
    .sort((a, b) => {

      // Score first
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      // Then momentum
      return b.return20 - a.return20;

    })
    .slice(0, 12)
    .map((x, i) => ({
      rank: i + 1,
      ...x
    }));

  // -------------------------
  // MARKET SCORE
  // -------------------------

  const marketScore = valid.length
    ? Math.round(
        valid.reduce(
          (sum, x) => sum + x.score,
          0
        ) / valid.length
      )
    : 0;

  res.setHeader(
    "Cache-Control",
    "s-maxage=300, stale-while-revalidate=600"
  );

  return res.status(200).json({
    ok: true,

    market,

    updated:
      new Date().toISOString(),

    marketScore,

    totalCounters: list.length,

    countersWithData: valid.length,

    sectors,

    focus
  });
}


// Build current Vercel URL
function getBaseUrl(req) {

  const proto =
    req.headers["x-forwarded-proto"] ||
    "https";

  const host =
    req.headers["x-forwarded-host"] ||
    req.headers.host;

  return `${proto}://${host}`;
}
