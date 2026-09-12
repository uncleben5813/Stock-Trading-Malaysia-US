export default async function handler(req, res) {
  try {
    const market = String(req.query.market || "US").toUpperCase();

    const US = [
      ["NVDA","NVIDIA","Semiconductors"],["AMD","AMD","Semiconductors"],
      ["AVGO","Broadcom","Semiconductors"],["TSM","TSMC","Semiconductors"],
      ["MU","Micron","Semiconductors"],["INTC","Intel","Semiconductors"],
      ["AAPL","Apple","Technology Hardware"],["MSFT","Microsoft","Software"],
      ["GOOGL","Alphabet","Internet"],["AMZN","Amazon","Internet"],
      ["META","Meta","Internet"],["ORCL","Oracle","Software"],
      ["CRM","Salesforce","Software"],["PLTR","Palantir","Software"],
      ["NFLX","Netflix","Media"],["TSLA","Tesla","Automobiles"],
      ["LLY","Eli Lilly","Pharmaceuticals"],["UNH","UnitedHealth","Healthcare"],
      ["XOM","Exxon Mobil","Energy"],["CVX","Chevron","Energy"],
      ["JPM","JPMorgan","Banks"],["BAC","Bank of America","Banks"],
      ["V","Visa","Financial Services"],["MA","Mastercard","Financial Services"],
      ["WMT","Walmart","Retail"],["COST","Costco","Retail"],
      ["CAT","Caterpillar","Industrials"],["GE","GE Aerospace","Industrials"],
      ["RTX","RTX","Aerospace & Defense"],["LIN","Linde","Chemicals"],
      ["ADBE","Adobe","Software"],["IBM","IBM","IT Services"],
      ["UBER","Uber","Transport"],["COIN","Coinbase","Financial Services"],
      ["CRWD","CrowdStrike","Cybersecurity"]
    ];

    const MY = [
      ["1023.KL","CIMB","Banks"],["1155.KL","Maybank","Banks"],
      ["1295.KL","Public Bank","Banks"],["5819.KL","Hong Leong Bank","Banks"],
      ["4863.KL","Telekom Malaysia","Telecommunications"],
      ["6012.KL","Maxis","Telecommunications"],
      ["6947.KL","CelcomDigi","Telecommunications"],
      ["3042.KL","Petronas Gas","Utilities"],
      ["7089.KL","YTL Power","Utilities"],["4677.KL","YTL Corp","Utilities"],
      ["5183.KL","Petronas Dagangan","Consumer Fuels"],
      ["5681.KL","Petronas Chemicals","Chemicals"],
      ["5347.KL","GAMUDA","Construction"],["5398.KL","IJM","Construction"],
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
      ["4065.KL","PPB","Food"],["2445.KL","KLK","Plantation"]
    ];

    const universe = market === "MY" ? MY : US;

    function num(v, fallback = 0) {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    }

    function sma(values, n) {
      if (!values || values.length < n) return null;
      const a = values.slice(-n);
      return a.reduce((s, v) => s + v, 0) / n;
    }

    function rsi(c, n = 14) {
      if (!c || c.length < n + 1) return 50;

      let gain = 0;
      let loss = 0;

      for (let i = c.length - n; i < c.length; i++) {
        const change = num(c[i].close) - num(c[i - 1].close);

        if (change > 0) gain += change;
        if (change < 0) loss -= change;
      }

      if (loss === 0) return gain > 0 ? 100 : 50;

      const rs = gain / loss;
      return 100 - (100 / (1 + rs));
    }

    function atr(c, n = 14) {
      if (!c || c.length < n + 1) return 0;

      const tr = [];

      for (let i = 1; i < c.length; i++) {
        const high = num(c[i].high);
        const low = num(c[i].low);
        const prev = num(c[i - 1].close);

        tr.push(
          Math.max(
            high - low,
            Math.abs(high - prev),
            Math.abs(low - prev)
          )
        );
      }

      return sma(tr, n) || 0;
    }

    function momentum(c, period = 20) {
      if (!c || c.length <= period) return 0;

      const now = num(c.at(-1).close);
      const old = num(c.at(-1 - period).close);

      if (!old) return 0;

      return ((now / old) - 1) * 100;
    }

    function volumeRatio(c, n = 20) {
      if (!c || c.length < n + 1) return 0;

      const previous = c
        .slice(-(n + 1), -1)
        .map(x => num(x.volume))
        .filter(v => v > 0);

      const latest = num(c.at(-1).volume);

      if (!previous.length || !latest) return 0;

      const average =
        previous.reduce((a, b) => a + b, 0) /
        previous.length;

      return average ? latest / average : 0;
    }

    function analyze(c) {
      if (!c || c.length < 50) {
        return {
          score: 0,
          signal: "WAIT",
          entry: null,
          sl: null,
          tp1: null,
          tp2: null,
          tp3: null,
          rsi: 50,
          ma20: null,
          ma50: null,
          momentum: 0,
          volumeRatio: 0,
          atr: 0
        };
      }

      const closes = c.map(x => num(x.close));

      const price = closes.at(-1);
      const ma20 = sma(closes, 20);
      const ma50 = sma(closes, 50);

      const R = rsi(c);
      const M = momentum(c, 20);
      const V = volumeRatio(c);
      const A = atr(c);

      let score = 50;

      // TREND
      if (price > ma20) score += 8;
      else score -= 8;

      if (price > ma50) score += 10;
      else score -= 10;

      if (ma20 > ma50) score += 8;
      else score -= 8;

      // RSI
      if (R >= 55 && R <= 70) score += 8;
      else if (R >= 45 && R < 55) score += 2;
      else if (R < 40) score -= 7;
      else if (R > 75) score -= 4;

      // MOMENTUM
      if (M > 8) score += 10;
      else if (M > 3) score += 7;
      else if (M > 0) score += 3;
      else if (M < -8) score -= 10;
      else if (M < -3) score -= 7;
      else score -= 3;

      // VOLUME
      if (V >= 1.5) score += 6;
      else if (V >= 1.15) score += 3;
      else if (V < 0.7) score -= 3;

      score = Math.max(0, Math.min(100, Math.round(score)));

      let signal = "WAIT";

      const bullish =
        price > ma20 &&
        ma20 > ma50 &&
        R >= 52 &&
        M > 0;

      const bearish =
        price < ma20 &&
        ma20 < ma50 &&
        R <= 48 &&
        M < 0;

      if (bullish && score >= 58) signal = "BUY";
      if (bearish && score >= 58) signal = "SELL";

      const risk = A || price * 0.015;

      let entry = price;
      let sl = null;
      let tp1 = null;
      let tp2 = null;
      let tp3 = null;

      if (signal === "BUY") {
        sl = entry - risk * 1.35;
        tp1 = entry + risk;
        tp2 = entry + risk * 2;
        tp3 = entry + risk * 3;
      }

      if (signal === "SELL") {
        sl = entry + risk * 1.35;
        tp1 = entry - risk;
        tp2 = entry - risk * 2;
        tp3 = entry - risk * 3;
      }

      let priority = "AVOID";

      if (score >= 75) priority = "HIGH PRIORITY";
      else if (score >= 65) priority = "FOCUS";
      else if (score >= 55) priority = "MONITOR";

      return {
        score,
        signal,
        priority,
        entry,
        sl,
        tp1,
        tp2,
        tp3,
        rsi: R,
        ma20,
        ma50,
        momentum: M,
        volumeRatio: V,
        atr: risk
      };
    }

    async function getCandles(symbol) {
      try {
        const url =
          `${req.headers.host ? "" : ""}/api/market` +
          `?symbol=${encodeURIComponent(symbol)}` +
          `&range=6mo&interval=1d`;

        const origin =
          req.headers.host
            ? `https://${req.headers.host}`
            : "";

        const r = await fetch(origin + url, {
          headers: {
            "User-Agent": "Radar/1.0"
          }
        });

        if (!r.ok) return [];

        const j = await r.json();

        if (!j?.ok || !Array.isArray(j.candles)) {
          return [];
        }

        return j.candles.filter(x =>
          Number.isFinite(Number(x.close)) &&
          Number.isFinite(Number(x.high)) &&
          Number.isFinite(Number(x.low))
        );

      } catch (e) {
        console.warn("Candle error:", symbol, e.message);
        return [];
      }
    }

    const results = [];

    /*
      Scan universe in batches.
      Elak terlalu banyak request serentak.
    */

    for (let i = 0; i < universe.length; i += 5) {
      const batch = universe.slice(i, i + 5);

      const rows = await Promise.all(
        batch.map(async item => {
          const symbol = item[0];
          const name = item[1];
          const sector = item[2];

          const candles = await getCandles(symbol);

          const tech = analyze(candles);

          return {
            symbol,
            name,
            sector,
            ...tech
          };
        })
      );

      results.push(...rows);
    }

    /*
      SECTOR RANKING
    */

    const sectorMap = {};

    for (const x of results) {
      if (!sectorMap[x.sector]) {
        sectorMap[x.sector] = [];
      }

      sectorMap[x.sector].push(x.score);
    }

    const sectors = Object.entries(sectorMap)
      .map(([name, scores]) => ({
        name,
        score: Math.round(
          scores.reduce((a, b) => a + b, 0) /
          scores.length
        ),
        count: scores.length
      }))
      .sort((a, b) => b.score - a.score);

    /*
      COUNTER RANKING
    */

    const ranked = [...results]
      .sort((a, b) => {

        let A = a.score;
        let B = b.score;

        if (a.signal !== "WAIT") A += 5;
        if (b.signal !== "WAIT") B += 5;

        A += Math.min(Math.abs(a.momentum), 10);
        B += Math.min(Math.abs(b.momentum), 10);

        return B - A;
      });

    const top = ranked.slice(0, 12);

    return res.status(200).json({
      ok: true,
      radar: "V2",
      market,
      scanned: results.length,

      updatedAt: new Date().toISOString(),

      topSector:
        sectors[0]?.name || null,

      sectors,

      top,

      results
    });

  } catch (e) {
    console.error("Radar V2 error:", e);

    return res.status(500).json({
      ok: false,
      radar: "V2",
      error: e.message
    });
  }
}
