// api/market.js
// Stable Yahoo Finance market-data endpoint
// Used by app.js for counter charts.
//
// Example:
// /api/market?symbol=NVDA&range=6mo&interval=1d
// /api/market?symbol=1023.KL&range=6mo&interval=1d

function cleanSymbol(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "");
}

function allowedRange(value) {
  const ranges = [
    "1d",
    "5d",
    "1mo",
    "3mo",
    "6mo",
    "1y",
    "2y",
    "5y",
    "10y",
    "max"
  ];

  return ranges.includes(value)
    ? value
    : "6mo";
}

function allowedInterval(value) {
  const intervals = [
    "1m",
    "2m",
    "5m",
    "15m",
    "30m",
    "60m",
    "90m",
    "1h",
    "1d",
    "5d",
    "1wk",
    "1mo",
    "3mo"
  ];

  return intervals.includes(value)
    ? value
    : "1d";
}

function yahooUrl(symbol, range, interval) {
  return (
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(symbol) +
    "?range=" +
    encodeURIComponent(range) +
    "&interval=" +
    encodeURIComponent(interval) +
    "&events=div%2Csplits"
  );
}

async function fetchWithTimeout(
  url,
  timeoutMs = 8000
) {
  const controller =
    new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",

      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

        Accept:
          "application/json,text/plain,*/*"
      },

      signal: controller.signal
    });

    const text =
      await response.text();

    if (!response.ok) {
      throw new Error(
        `Yahoo HTTP ${response.status}: ${text.slice(
          0,
          200
        )}`
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        "Yahoo returned invalid JSON"
      );
    }

  } finally {
    clearTimeout(timer);
  }
}

function toNumber(value) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}

function normalizeYahoo(json) {
  const result =
    json?.chart?.result?.[0];

  if (!result) {
    return [];
  }

  const timestamps =
    Array.isArray(result.timestamp)
      ? result.timestamp
      : [];

  const quote =
    result.indicators?.quote?.[0] || {};

  const opens =
    Array.isArray(quote.open)
      ? quote.open
      : [];

  const highs =
    Array.isArray(quote.high)
      ? quote.high
      : [];

  const lows =
    Array.isArray(quote.low)
      ? quote.low
      : [];

  const closes =
    Array.isArray(quote.close)
      ? quote.close
      : [];

  const volumes =
    Array.isArray(quote.volume)
      ? quote.volume
      : [];

  const candles = [];

  for (
    let i = 0;
    i < timestamps.length;
    i++
  ) {
    const open =
      toNumber(opens[i]);

    const high =
      toNumber(highs[i]);

    const low =
      toNumber(lows[i]);

    const close =
      toNumber(closes[i]);

    if (
      open === null ||
      high === null ||
      low === null ||
      close === null
    ) {
      continue;
    }

    candles.push({
      time:
        Number(timestamps[i]) * 1000,

      open,
      high,
      low,
      close,

      volume:
        toNumber(volumes[i]) || 0
    });
  }

  return candles;
}

export default async function handler(
  req,
  res
) {
  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "s-maxage=60, stale-while-revalidate=300"
  );

  try {
    const symbol =
      cleanSymbol(
        req?.query?.symbol
      );

    if (!symbol) {
      return res.status(400).json({
        ok: false,
        error: "symbol required",
        candles: []
      });
    }

    const range =
      allowedRange(
        String(
          req?.query?.range || "6mo"
        )
      );

    const interval =
      allowedInterval(
        String(
          req?.query?.interval || "1d"
        )
      );

    const url =
      yahooUrl(
        symbol,
        range,
        interval
      );

    const json =
      await fetchWithTimeout(
        url,
        8000
      );

    const result =
      json?.chart?.result?.[0];

    const meta =
      result?.meta || {};

    const candles =
      normalizeYahoo(json);

    if (!candles.length) {
      return res.status(200).json({
        ok: true,
        symbol,
        source: "Yahoo Finance",
        range,
        interval,
        currency:
          meta.currency || null,
        exchange:
          meta.exchangeName || null,
        price:
          toNumber(
            meta.regularMarketPrice
          ) ||
          null,
        candles: []
      });
    }

    const last =
      candles[candles.length - 1];

    const price =
      toNumber(
        meta.regularMarketPrice
      ) ??
      last.close;

    return res.status(200).json({
      ok: true,

      symbol,

      source:
        "Yahoo Finance",

      range,

      interval,

      currency:
        meta.currency || null,

      exchange:
        meta.exchangeName || null,

      marketState:
        meta.marketState ||
        "CLOSED",

      price,

      candles
    });

  } catch (error) {
    console.error(
      "MARKET API ERROR:",
      error
    );

    return res.status(200).json({
      ok: false,

      error:
        error?.message ||
        "Market API failed",

      candles: []
    });
  }
}
