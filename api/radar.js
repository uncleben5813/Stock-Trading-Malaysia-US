// api/radar.js
// US + Malaysia Stock Radar
// Yahoo Finance
// Sector Ranking + Counter Ranking + Focus List

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "s-maxage=60, stale-while-revalidate=120"
  );

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  // =========================================================
  // SYMBOLS
  // =========================================================

  const US_SYMBOLS = [
    "KHC","SMR","INTC","NOK","SPCX","ORCL","NVDA","NU","AAL","BMNR",
    "GRAB","KVUE","SMCI","MARA","AAPL","T","PATH","ONDS","F","ABEV",
    "CIFR","NIO","HPE","AUR","RIG","PLUG","JOBY","SNAP","OPEN","IREN",
    "WULF","KEEL","TSLA","PCG","HPQ","AGNC","AMZN","BSX","BAC","PFE",
    "UBER","ITUB","HDB","SOFI","GOOGL","STLA","DNN","BBD","HL","NFLX",
    "CPRT","VG","CLSK","PURR","VALE","OKLO","AVGO","ACHR","HOOD","NKE",
    "MSTR","HBAN","RIVN","MU","AMD","CDE","PBR","CRWV","RKT","MRVL",
    "TENB","WMT","CAG","META","LUMN","CCL","CNH","AMC","CMCSA","VZ",
    "OWL","MRNA","BTG","PLTR","IONQ","NCLH","CCC","USAR","SLS","SKHY",
    "DELL","RGTI","CSCO","RKLB","GGB","MSFT","PINS","ERIC","LYG","ORCL"
  ];

  const MY_SYMBOLS = [
    "1023.KL",
    "1155.KL",
    "1295.KL",
    "5819.KL",
    "4863.KL",
    "6012.KL",
    "6947.KL",
    "3042.KL",
    "7089.KL",
    "4677.KL",
    "5183.KL",
    "5681.KL",
    "5347.KL",
    "5398.KL",
    "5211.KL",
    "4197.KL",
    "1961.KL",
    "8869.KL",
    "3816.KL",
    "4707.KL",
    "7084.KL",
    "5225.KL",
    "7153.KL",
    "7113.KL",
    "7086.KL",
    "0166.KL",
    "0097.KL",
    "5285.KL",
    "4065.KL",
    "2445.KL"
  ];

  // =========================================================
  // SECTOR MAP
  // =========================================================

  const SECTORS = {

    // -------------------------
    // US TECHNOLOGY
    // -------------------------

    AAPL: "Technology",
    MSFT: "Technology",
    NVDA: "Technology",
    AMD: "Technology",
    AVGO: "Technology",
    ORCL: "Technology",
    INTC: "Technology",
    CSCO: "Technology",
    DELL: "Technology",
    HPQ: "Technology",
    HPE: "Technology",
    SMCI: "Technology",
    MRVL: "Technology",
    MU: "Technology",
    PLTR: "Technology",
    CRWV: "Technology",
    PATH: "Technology",
    TENB: "Technology",
    CCC: "Technology",
    NOK: "Technology",
    ERIC: "Technology",
    SKHY: "Technology",
    ONDS: "Technology",

    // Semiconductors
    IONQ: "Semiconductors",
    RGTI: "Semiconductors",

    // Communication
    GOOGL: "Communication",
    META: "Communication",
    SNAP: "Communication",
    T: "Communication",
    VZ: "Communication",
    CMCSA: "Communication",
    PINS: "Communication",

    // Consumer
    AMZN: "Consumer",
    WMT: "Consumer",
    NKE: "Consumer",
    CAG: "Consumer",
    KHC: "Consumer",
    AAL: "Consumer",
    CCL: "Consumer",
    NCLH: "Consumer",
    AMC: "Consumer",
    KVUE: "Consumer",
    ABEV: "Consumer",

    // Automotive
    TSLA: "Automotive",
    RIVN: "Automotive",
    STLA: "Automotive",
    F: "Automotive",
    NIO: "Automotive",

    // Financial
    BAC: "Financial",
    HOOD: "Financial",
    SOFI: "Financial",
    NU: "Financial",
    HDB: "Financial",
    ITUB: "Financial",
    BBD: "Financial",
    HBAN: "Financial",
    AGNC: "Financial",
    OWL: "Financial",
    LYG: "Financial",

    // Energy
    PLUG: "Energy",
    PCG: "Energy",
    IREN: "Energy",
    WULF: "Energy",
    MARA: "Energy",
    CLSK: "Energy",
    RIG: "Energy",
    PBR: "Energy",
    VALE: "Energy",
    CNH: "Energy",
    VG: "Energy",

    // Nuclear
    SMR: "Nuclear",
    OKLO: "Nuclear",

    // Mining
    DNN: "Mining",
    HL: "Mining",
    CDE: "Mining",
    BTG: "Mining",
    GGB: "Mining",
    USAR: "Mining",

    // Aerospace
    RKLB: "Aerospace",
    JOBY: "Aerospace",
    ACHR: "Aerospace",
    AUR: "Aerospace",
    SPCX: "Aerospace",

    // Healthcare
    MRNA: "Healthcare",
    PFE: "Healthcare",
    BSX: "Healthcare",
    SLS: "Healthcare",

    // Real Estate
    OPEN: "Real Estate",
    RKT: "Real Estate",

    // Internet
    UBER: "Internet",
    GRAB: "Internet",

    // Telecom
    LUMN: "Telecom",

    // Crypto
    PURR: "Crypto",
    MSTR: "Crypto",
    BMNR: "Crypto",
    CIFR: "Crypto",

    // Infrastructure
    KEEL: "Infrastructure",

    // Industrial
    CPRT: "Industrial",

    // -------------------------
    // MALAYSIA
    // -------------------------

    "1023.KL": "Financial",
    "1155.KL": "Financial",
    "1295.KL": "Financial",
    "5819.KL": "Financial",
    "4863.KL": "Technology",
    "6012.KL": "Financial",
    "6947.KL": "Technology",
    "3042.KL": "Technology",
    "7089.KL": "Consumer",
    "4677.KL": "Plantation",
    "5183.KL": "Industrial",
    "5681.KL": "Plantation",
    "5347.KL": "Financial",
    "5398.KL": "Industrial",
    "5211.KL": "Utilities",
    "4197.KL": "Plantation",
    "1961.KL": "Industrial",
    "8869.KL": "Healthcare",
    "3816.KL": "Energy",
    "4707.KL": "Technology",
    "7084.KL": "Consumer",
    "5225.KL": "Construction",
    "7153.KL": "Technology",
    "7113.KL": "Industrial",
    "7086.KL": "Financial",
    "0166.KL": "Technology",
    "0097.KL": "Industrial",
    "5285.KL": "Financial",
    "4065.KL": "Consumer",
    "2445.KL": "Technology"
  };

  // =========================================================
  // HELPERS
  // =========================================================

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round(number(value) * factor) / factor;
  }

  function sectorOf(symbol) {
    return SECTORS[symbol] || "Other";
  }

  function changePercent(price, previousClose) {
    price = number(price);
    previousClose = number(previousClose);

    if (!price || !previousClose) {
      return 0;
    }

    return ((price - previousClose) / previousClose) * 100;
  }

  // =========================================================
  // YAHOO FETCH
  // =========================================================

  async function getYahoo(symbol) {
    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(symbol) +
      "?range=5d&interval=1d&events=history";

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 7000);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        return null;
      }

      const json = await response.json();

      const result =
        json?.chart?.result?.[0];

      if (!result) {
        return null;
      }

      const meta =
        result.meta || {};

      const quote =
        result.indicators?.quote?.[0] || {};

      const closes =
        Array.isArray(quote.close)
          ? quote.close
              .map(number)
              .filter(v => v > 0)
          : [];

      const volumes =
        Array.isArray(quote.volume)
          ? quote.volume
              .map(number)
              .filter(v => v > 0)
          : [];

      let price =
        number(meta.regularMarketPrice);

      if (!price && closes.length) {
        price =
          closes[closes.length - 1];
      }

      let previousClose =
        number(meta.previousClose);

      if (!previousClose && closes.length >= 2) {
        previousClose =
          closes[closes.length - 2];
      }

      let volume =
        number(meta.regularMarketVolume);

      if (!volume && volumes.length) {
        volume =
          volumes[volumes.length - 1];
      }

      if (!price) {
        return null;
      }

      const change =
        changePercent(
          price,
          previousClose
        );

      const marketTime =
        meta.regularMarketTime
          ? new Date(
              meta.regularMarketTime * 1000
            ).toISOString()
          : null;

      return {
        symbol,

        name:
          meta.longName ||
          meta.shortName ||
          symbol,

        price: round(price),

        previousClose:
          round(previousClose),

        change:
          round(change),

        volume,

        marketCap:
          number(meta.marketCap),

        currency:
          meta.currency || null,

        exchange:
          meta.exchangeName || null,

        marketState:
          meta.marketState ||
          "CLOSED",

        marketTime,

        sector:
          sectorOf(symbol),

        available: true
      };

    } catch (error) {
      return null;

    } finally {
      clearTimeout(timeout);
    }
  }

  // =========================================================
  // SCAN MARKET
  // =========================================================

  async function scanMarket(
    symbols,
    market
  ) {
    const candidates = [];

    // Smaller batch avoids Yahoo throttling
    const BATCH_SIZE = 4;

    for (
      let i = 0;
      i < symbols.length;
      i += BATCH_SIZE
    ) {

      const batch =
        symbols.slice(
          i,
          i + BATCH_SIZE
        );

      const results =
        await Promise.all(
          batch.map(
            symbol =>
              getYahoo(symbol)
          )
        );

      for (const item of results) {
        if (item) {
          candidates.push(item);
        }
      }
    }

    // =======================================================
    // VOLUME NORMALIZATION
    // =======================================================

    const volumes =
      candidates
        .map(x => number(x.volume))
        .filter(v => v > 0);

    const maxVolume =
      volumes.length
        ? Math.max(...volumes)
        : 1;

    // =======================================================
    // COUNTER SCORE
    // =======================================================

    for (const item of candidates) {

      const movement =
        Math.abs(
          number(item.change)
        );

      const directionScore =
        item.change > 0
          ? clamp(
              item.change * 5,
              0,
              40
            )
          : clamp(
              Math.abs(item.change) * 3,
              0,
              25
            );

      const volumeScore =
        maxVolume > 0
          ? clamp(
              (item.volume /
                maxVolume) * 30,
              0,
              30
            )
          : 0;

      const movementScore =
        clamp(
          movement * 3,
          0,
          30
        );

      const liquidityBonus =
        item.volume >= 10000000
          ? 10
          : item.volume >= 5000000
            ? 7
            : item.volume >= 1000000
              ? 4
              : 0;

      item.momentumScore =
        Math.round(
          clamp(
            movementScore +
            volumeScore +
            directionScore +
            liquidityBonus,
            0,
            100
          )
        );

      item.direction =
        item.change > 0.25
          ? "BULLISH"
          : item.change < -0.25
            ? "BEARISH"
            : "NEUTRAL";

      item.movement =
        round(movement);
    }

    // =======================================================
    // SECTOR GROUPING
    // =======================================================

    const sectorMap = {};

    for (const item of candidates) {

      const sector =
        item.sector || "Other";

      if (!sectorMap[sector]) {
        sectorMap[sector] = [];
      }

      sectorMap[sector].push(item);
    }

    // =======================================================
    // SECTOR RANKING
    // =======================================================

    const sectorRanking =
      Object.entries(sectorMap)
        .map(
          ([sector, stocks]) => {

            const valid =
              stocks.filter(
                x => x.available
              );

            if (!valid.length) {
              return null;
            }

            const avgChange =
              valid.reduce(
                (sum, x) =>
                  sum +
                  number(x.change),
                0
              ) / valid.length;

            const bullish =
              valid.filter(
                x =>
                  x.direction ===
                  "BULLISH"
              ).length;

            const bearish =
              valid.filter(
                x =>
                  x.direction ===
                  "BEARISH"
              ).length;

            const total =
              valid.length;

            const breadth =
              total
                ? (
                    (bullish -
                      bearish) /
                    total
                  ) * 100
                : 0;

            const avgMomentum =
              valid.reduce(
                (sum, x) =>
                  sum +
                  number(
                    x.momentumScore
                  ),
                0
              ) / total;

            const sectorScore =
              clamp(
                avgMomentum * 0.55 +
                clamp(
                  avgChange * 4,
                  -25,
                  25
                ) +
                clamp(
                  breadth * 0.20,
                  -20,
                  20
                ),
                0,
                100
              );

            const sorted =
              [...valid].sort(
                (a, b) =>
                  b.momentumScore -
                  a.momentumScore
              );

            return {
              rank: 0,

              sector,

              score:
                Math.round(
                  sectorScore
                ),

              averageChange:
                round(
                  avgChange
                ),

              breadth:
                Math.round(
                  breadth
                ),

              bullish,

              bearish,

              stockCount:
                total,

              topCounters:
                sorted
                  .slice(0, 5)
                  .map(x => ({
                    symbol:
                      x.symbol,

                    name:
                      x.name,

                    price:
                      x.price,

                    change:
                      x.change,

                    volume:
                      x.volume,

                    momentumScore:
                      x.momentumScore,

                    direction:
                      x.direction
                  }))
            };
          }
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            b.score -
            a.score
        );

    sectorRanking.forEach(
      (sector, index) => {
        sector.rank =
          index + 1;
      }
    );

    // =======================================================
    // FOCUS LIST
    // =======================================================

    const sectorRankMap = {};

    const sectorScoreMap = {};

    sectorRanking.forEach(
      sector => {

        sectorRankMap[
          sector.sector
        ] =
          sector.rank;

        sectorScoreMap[
          sector.sector
        ] =
          sector.score;
      }
    );

    const focusList =
      candidates
        .filter(
          x => x.available
        )
        .map(x => {

          const sectorRank =
            sectorRankMap[
              x.sector
            ] || 999;

          const sectorScore =
            sectorScoreMap[
              x.sector
            ] || 0;

          const focusScore =
            clamp(
              x.momentumScore * 0.65 +
              sectorScore * 0.35 -
              Math.max(
                sectorRank - 5,
                0
              ) * 2,
              0,
              100
            );

          return {
            ...x,

            sectorRank,

            sectorScore,

            focusScore:
              Math.round(
                focusScore
              ),

            priority:
              sectorRank <= 3 &&
              x.momentumScore >= 45
                ? "HIGH"
                : sectorRank <= 6 &&
                    x.momentumScore >= 35
                  ? "MEDIUM"
                  : "LOW"
          };
        })
        .sort(
          (a, b) =>
            b.focusScore -
            a.focusScore
        )
        .slice(0, 15);

    // =======================================================
    // GENERAL SORT
    // =======================================================

    candidates.sort(
      (a, b) => {

        if (
          b.momentumScore !==
          a.momentumScore
        ) {
          return (
            b.momentumScore -
            a.momentumScore
          );
        }

        return (
          Math.abs(
            b.change
          ) -
          Math.abs(
            a.change
          )
        );
      }
    );

    // =======================================================
    // MARKET STATUS
    // =======================================================

    const liveCount =
      candidates.filter(
        x =>
          x.marketState ===
          "REGULAR"
      ).length;

    const availableCount =
      candidates.filter(
        x =>
          x.available
      ).length;

    return {
      ok: true,

      market,

      count:
        candidates.length,

      liveCount,

      availableCount,

      source:
        "yahoo",

      marketOpen:
        liveCount > 0,

      sectorCount:
        sectorRanking.length,

      sectorRanking,

      focusList,

      candidates
    };
  }

  // =========================================================
  // REQUEST
  // =========================================================

  try {

    const requestedMarket =
      String(
        req.query?.market ||
        "ALL"
      ).toUpperCase();

    // =======================================================
    // US
    // =======================================================

    if (
      requestedMarket ===
      "US"
    ) {

      const result =
        await scanMarket(
          US_SYMBOLS,
          "US"
        );

      return res
        .status(200)
        .json(result);
    }

    // =======================================================
    // MALAYSIA
    // =======================================================

    if (
      requestedMarket === "MY" ||
      requestedMarket === "MALAYSIA"
    ) {

      const result =
        await scanMarket(
          MY_SYMBOLS,
          "MY"
        );

      return res
        .status(200)
        .json(result);
    }

    // =======================================================
    // ALL
    // =======================================================

    if (
      requestedMarket === "ALL"
    ) {

      const [
        us,
        my
      ] = await Promise.all([
        scanMarket(
          US_SYMBOLS,
          "US"
        ),
        scanMarket(
          MY_SYMBOLS,
          "MY"
        )
      ]);

      return res
        .status(200)
        .json({
          ok: true,
          market: "ALL",
          source: "yahoo",
          US: us,
          MY: my
        });
    }

    return res
      .status(400)
      .json({
        ok: false,
        error:
          "Invalid market. Use US, MY or ALL."
      });

  } catch (error) {

    console.error(
      "RADAR ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        ok: false,
        error:
          "Radar serverless function crashed",
        message:
          error?.message ||
          String(error)
      });
  }
}
