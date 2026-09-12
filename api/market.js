function yahooUrl(symbol, range = "6mo", interval = "1d") {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${interval}&events=div%2Csplits`;
}

async function getJson(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!r.ok) {
    throw new Error(`Yahoo HTTP ${r.status}`);
  }

  return r.json();
}

function normalizeYahoo(j) {
  const result = j?.chart?.result?.[0];

  if (!result) {
    throw new Error("Yahoo returned no data");
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};

  return timestamps
    .map((t, i) => ({
      time: t * 1000,
      open: quote.open?.[i],
      high: quote.high?.[i],
      low: quote.low?.[i],
      close: quote.close?.[i],
      volume: quote.volume?.[i] || 0
    }))
    .filter(
      x =>
        Number.isFinite(x.open) &&
        Number.isFinite(x.high) &&
        Number.isFinite(x.low) &&
        Number.isFinite(x.close)
    );
}

export default async function handler(req, res) {
  const symbol = String(req.query.symbol || "").trim();

  const range = String(req.query.range || "6mo");
  const interval = String(req.query.interval || "1d");

  if (!symbol) {
    return res.status(400).json({
      ok: false,
      error: "symbol required"
    });
  }

  try {
    const url = yahooUrl(symbol, range, interval);
    const data = await getJson(url);

    const candles = normalizeYahoo(data);

    if (!candles.length) {
      return res.status(404).json({
        ok: false,
        symbol,
        error: "No market data returned",
        candles: []
      });
    }

    const meta = data?.chart?.result?.[0]?.meta || {};

    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=300"
    );

    return res.status(200).json({
      ok: true,
      symbol,
      source: "Yahoo Finance",
      currency: meta.currency || null,
      exchange: meta.exchangeName || null,
      price: meta.regularMarketPrice || candles.at(-1)?.close || null,
      candles
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      symbol,
      source: "Yahoo Finance",
      error: error.message,
      candles: []
    });
  }
}
