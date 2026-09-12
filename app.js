const $ = s => document.querySelector(s);

let mode = "US";
let chart = null;
let selected = null;
let rendering = false;

/* =========================================================
   FALLBACK UNIVERSE
   ========================================================= */

const usFallback = [
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

const myFallback = [
  ["1023.KL","CIMB","Banks"],["1155.KL","Maybank","Banks"],
  ["1295.KL","Public Bank","Banks"],["5819.KL","Hong Leong Bank","Banks"],
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

const shariahSeed = {
  "5347.KL":1,"5398.KL":1,"5211.KL":1,"5285.KL":1,
  "4197.KL":1,"1961.KL":1,"8869.KL":1,"3816.KL":1,
  "7089.KL":1,"4677.KL":1,"7084.KL":1,"5225.KL":1,
  "7153.KL":1,"7113.KL":1,"7086.KL":1,"0166.KL":1,
  "0097.KL":1
};

/* =========================================================
   FORMAT
   ========================================================= */

function fmt(n) {
  n = Number(n);

  if (!Number.isFinite(n)) return "—";

  return n > 100
    ? n.toFixed(2)
    : n.toFixed(3);
}

/* =========================================================
   RADAR API
   ========================================================= */

async function radar(market) {

  try {

    const r = await fetch(
      `/api/radar?market=${encodeURIComponent(market)}`,
      { cache: "no-store" }
    );

    if (!r.ok) {
      throw new Error("Radar API HTTP " + r.status);
    }

    const j = await r.json();

    if (!j?.ok || !Array.isArray(j.candidates)) {
      throw new Error("Invalid radar response");
    }

    console.log(
      `[RADAR ${market}]`,
      j.count,
      "candidates"
    );

    return j.candidates;

  } catch (e) {

    console.warn(
      `[RADAR ${market}] failed:`,
      e.message
    );

    return [];
  }
}

/* =========================================================
   NORMALISE RADAR → APP FORMAT
   ========================================================= */

function normaliseCandidates(candidates, market) {

  const fallback =
    market === "US"
      ? usFallback
      : myFallback;

  const fallbackMap =
    new Map(
      fallback.map(x => [x[0], x])
    );

  if (!candidates.length) {
    return fallback;
  }

  return candidates.map(x => {

    const old =
      fallbackMap.get(x.symbol);

    return [
      x.symbol,

      x.name ||
      old?.[1] ||
      x.symbol,

      old?.[2] ||
      inferSector(x.name || x.symbol),

      {
        radarPrice: Number(x.price || 0),
        radarChange: Number(x.change || 0),
        radarVolume: Number(x.volume || 0),
        marketCap: Number(x.marketCap || 0)
      }
    ];

  });

}

/* =========================================================
   SECTOR INFERENCE
   ========================================================= */

function inferSector(name) {

  const n =
    String(name || "").toLowerCase();

  if (
    n.includes("bank") ||
    n.includes("financial") ||
    n.includes("capital")
  ) return "Financial Services";

  if (
    n.includes("semiconductor") ||
    n.includes("chip")
  ) return "Semiconductors";

  if (
    n.includes("software") ||
    n.includes("technology")
  ) return "Technology";

  if (
    n.includes("energy") ||
    n.includes("oil") ||
    n.includes("gas")
  ) return "Energy";

  if (
    n.includes("health") ||
    n.includes("pharma")
  ) return "Healthcare";

  if (
    n.includes("retail") ||
    n.includes("consumer")
  ) return "Consumer";

  if (
    n.includes("industrial") ||
    n.includes("aerospace")
  ) return "Industrials";

  return "Other";
}

/* =========================================================
   MARKET CANDLES
   ========================================================= */

async function candles(symbol, interval = "1d") {

  try {

    const r = await fetch(
      `/api/market?symbol=${encodeURIComponent(symbol)}&range=6mo&interval=${interval}`,
      { cache: "no-store" }
    );

    if (!r.ok) return [];

    const j = await r.json();

    if (
      !j?.ok ||
      !Array.isArray(j.candles)
    ) {
      return [];
    }

    return j.candles.filter(x =>
      Number.isFinite(Number(x.close)) &&
      Number.isFinite(Number(x.high)) &&
      Number.isFinite(Number(x.low))
    );

  } catch (e) {

    console.warn(
      "Market API:",
      symbol,
      e
    );

    return [];
  }
}

/* =========================================================
   INDICATORS
   ========================================================= */

function sma(values, n) {

  if (
    !Array.isArray(values) ||
    values.length < n
  ) {
    return null;
  }

  const a =
    values.slice(-n);

  if (
    a.some(
      v => !Number.isFinite(Number(v))
    )
  ) {
    return null;
  }

  return (
    a.reduce(
      (sum, v) =>
        sum + Number(v),
      0
    ) / n
  );
}

function atr(c, n = 14) {

  if (
    !c ||
    c.length < n + 1
  ) {
    return 0;
  }

  const tr = [];

  for (
    let i = 1;
    i < c.length;
    i++
  ) {

    const h =
      Number(c[i].high);

    const l =
      Number(c[i].low);

    const pc =
      Number(c[i - 1].close);

    tr.push(
      Math.max(
        h - l,
        Math.abs(h - pc),
        Math.abs(l - pc)
      )
    );
  }

  return sma(tr, n) || 0;
}

function rsi(c, n = 14) {

  if (
    !c ||
    c.length < n + 1
  ) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (
    let i = c.length - n;
    i < c.length;
    i++
  ) {

    const change =
      Number(c[i].close) -
      Number(c[i - 1].close);

    if (change > 0) {
      gains += change;
    }

    if (change < 0) {
      losses -= change;
    }
  }

  if (losses === 0) {
    return gains > 0
      ? 100
      : 50;
  }

  const rs =
    gains / losses;

  return (
    100 -
    (100 / (1 + rs))
  );
}

function momentum(c, period = 20) {

  if (
    !c ||
    c.length <= period
  ) {
    return 0;
  }

  const now =
    Number(c.at(-1).close);

  const old =
    Number(
      c.at(-1 - period).close
    );

  if (!old) return 0;

  return (
    (now / old - 1) * 100
  );
}

function volumeStrength(c, n = 20) {

  if (
    !c ||
    c.length < n + 1
  ) {
    return 0;
  }

  const volumes =
    c
      .slice(-(n + 1), -1)
      .map(
        x => Number(x.volume)
      )
      .filter(
        Number.isFinite
      );

  const latest =
    Number(c.at(-1).volume);

  if (
    !volumes.length ||
    !Number.isFinite(latest)
  ) {
    return 0;
  }

  const avg =
    volumes.reduce(
      (a, b) => a + b,
      0
    ) / volumes.length;

  if (!avg) return 0;

  return latest / avg;
}

/* =========================================================
   TECHNICAL SCORE
   ========================================================= */

function technicalScore(c) {

  if (
    !c ||
    c.length < 50
  ) {
    return 0;
  }

  const closes =
    c.map(
      x => Number(x.close)
    );

  const price =
    closes.at(-1);

  const ma20 =
    sma(closes, 20);

  const ma50 =
    sma(closes, 50);

  const r =
    rsi(c);

  const mom =
    momentum(c, 20);

  const vol =
    volumeStrength(c);

  if (
    !Number.isFinite(price) ||
    ma20 === null ||
    ma50 === null
  ) {
    return 0;
  }

  let score = 50;

  /* Trend */

  if (price > ma20)
    score += 8;
  else
    score -= 8;

  if (price > ma50)
    score += 10;
  else
    score -= 10;

  if (ma20 > ma50)
    score += 8;
  else
    score -= 8;

  /* RSI */

  if (
    r >= 55 &&
    r <= 70
  ) {
    score += 8;
  } else if (
    r >= 45 &&
    r < 55
  ) {
    score += 2;
  } else if (
    r < 40
  ) {
    score -= 7;
  } else if (
    r > 75
  ) {
    score -= 4;
  }

  /* Momentum */

  if (mom > 8)
    score += 10;
  else if (mom > 3)
    score += 7;
  else if (mom > 0)
    score += 3;
  else if (mom < -8)
    score -= 10;
  else if (mom < -3)
    score -= 7;
  else
    score -= 3;

  /* Volume */

  if (vol >= 1.5)
    score += 6;
  else if (vol >= 1.15)
    score += 3;
  else if (vol < 0.7)
    score -= 3;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(score)
    )
  );
}

/* =========================================================
   TRADE SETUP
   ========================================================= */

function setup(c) {

  if (
    !c ||
    c.length < 50
  ) {

    return {
      dir: "WAIT",
      entry: null,
      sl: null,
      tp1: null,
      tp2: null,
      tp3: null,
      atr: 0,
      rsi: 50,
      ma20: null,
      ma50: null,
      momentum: 0,
      volumeRatio: 0
    };
  }

  const price =
    Number(c.at(-1).close);

  const closes =
    c.map(
      x => Number(x.close)
    );

  const ma20 =
    sma(closes, 20);

  const ma50 =
    sma(closes, 50);

  const a =
    atr(c);

  const r =
    rsi(c);

  const mom =
    momentum(c, 20);

  const vol =
    volumeStrength(c);

  let dir = "WAIT";

  const bullish =
    price > ma20 &&
    ma20 > ma50 &&
    r >= 52 &&
    mom > 0;

  const bearish =
    price < ma20 &&
    ma20 < ma50 &&
    r <= 48 &&
    mom < 0;

  if (bullish)
    dir = "BUY";

  if (bearish)
    dir = "SELL";

  if (
    technicalScore(c) < 58
  ) {
    dir = "WAIT";
  }

  const risk =
    a ||
    price * 0.015;

  let entry = price;
  let sl = null;
  let tp1 = null;
  let tp2 = null;
  let tp3 = null;

  if (dir === "BUY") {

    sl =
      entry -
      risk * 1.35;

    tp1 =
      entry +
      risk;

    tp2 =
      entry +
      risk * 2;

    tp3 =
      entry +
      risk * 3;
  }

  if (dir === "SELL") {

    sl =
      entry +
      risk * 1.35;

    tp1 =
      entry -
      risk;

    tp2 =
      entry -
      risk * 2;

    tp3 =
      entry -
      risk * 3;
  }

  return {
    dir,
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    atr: risk,
    rsi: r,
    ma20,
    ma50,
    momentum: mom,
    volumeRatio: vol
  };
}

/* =========================================================
   ANALYSE COUNTER
   ========================================================= */

async function analyze(item) {

  const c =
    await candles(item[0]);

  if (!c.length) {

    return {
      ...item,
      c: [],
      score: 0,
      set: setup([]),
      radar: item[3] || {}
    };
  }

  return {
    ...item,
    c,
    score: technicalScore(c),
    set: setup(c),
    radar: item[3] || {}
  };
}

async function analyzeAll(list) {

  const results = [];

  /*
    Batch 5.
    Kekalkan supaya API tidak dibom.
  */

  for (
    let i = 0;
    i < list.length;
    i += 5
  ) {

    const batch =
      list.slice(i, i + 5);

    const rows =
      await Promise.all(
        batch.map(analyze)
      );

    results.push(...rows);
  }

  return results;
}

/* =========================================================
   SECTOR RANKING
   ========================================================= */

function sectorRanking(results) {

  const groups = {};

  for (const x of results) {

    const sector =
      x[2] || "Other";

    if (!groups[sector]) {
      groups[sector] = [];
    }

    if (x.score > 0) {
      groups[sector].push(x.score);
    }
  }

  return Object.entries(groups)
    .filter(
      ([, values]) =>
        values.length
    )
    .map(
      ([name, values]) => ({
        name,

        score:
          Math.round(
            values.reduce(
              (a, b) => a + b,
              0
            ) /
            values.length
          ),

        count:
          values.length
      })
    )
    .sort(
      (a, b) =>
        b.score - a.score
    );
}

/* =========================================================
   RENDER SECTORS
   ========================================================= */

function renderSectors(
  id,
  sectors
) {

  const el = $(id);

  if (!el) return;

  if (!sectors.length) {

    el.innerHTML =
      `<div class="muted">
        No market data.
      </div>`;

    return;
  }

  el.innerHTML =
    sectors
      .slice(0, 10)
      .map(
        (s, i) => `
          <div class="sector">

            <b>#${i + 1}</b>

            <span>
              ${s.name}

              <div class="bar">
                <i
                  style="width:${s.score}%"
                ></i>
              </div>
            </span>

            <b>${s.score}</b>

          </div>
        `
      )
      .join("");
}

/* =========================================================
   COUNTER RANKING
   ========================================================= */

function focusRanking(results) {

  return results
    .filter(
      x => x.c?.length
    )
    .sort(
      (a, b) => {

        let sa =
          a.score;

        let sb =
          b.score;

        /*
          Radar live change
        */

        const ac =
          Number(
            a.radar?.radarChange ||
            0
          );

        const bc =
          Number(
            b.radar?.radarChange ||
            0
          );

        sa +=
          Math.min(
            Math.abs(ac) * 1.5,
            10
          );

        sb +=
          Math.min(
            Math.abs(bc) * 1.5,
            10
          );

        /*
          Signal bonus
        */

        if (
          a.set.dir === "BUY" ||
          a.set.dir === "SELL"
        ) {
          sa += 5;
        }

        if (
          b.set.dir === "BUY" ||
          b.set.dir === "SELL"
        ) {
          sb += 5;
        }

        /*
          Momentum
        */

        sa +=
          Math.min(
            Math.abs(
              a.set.momentum || 0
            ),
            10
          );

        sb +=
          Math.min(
            Math.abs(
              b.set.momentum || 0
            ),
            10
          );

        return sb - sa;
      }
    )
    .slice(0, 12);
}

/* =========================================================
   RENDER FOCUS
   ========================================================= */

function renderFocus(focus) {

  const el =
    $("#focus");

  if (!el) return;

  if (!focus.length) {

    el.innerHTML =
      `<div class="muted">
        No counters available.
      </div>`;

    return;
  }

  el.innerHTML =
    focus
      .map(
        (x, i) => {

          const cls =
            x.set.dir === "BUY"
              ? "up"
              : x.set.dir === "SELL"
                ? "down"
                : "";

          const change =
            Number(
              x.radar?.radarChange ||
              0
            );

          return `

            <div
              class="focusrow"
              data-symbol="${x[0]}"
            >

              <b>#${i + 1}</b>

              <div>

                <b>${x[0]}</b>

                <div class="muted">
                  ${x[1]} · ${x[2]}
                </div>

              </div>

              <span>
                ${x.score}
              </span>

              <span class="${cls}">
                ${x.set.dir}
              </span>

              <span
                class="${
                  change >= 0
                    ? "up"
                    : "down"
                }"
              >
                ${
                  change >= 0
                    ? "+"
                    : ""
                }${change.toFixed(2)}%
              </span>

              <span class="hideM">
                ${fmt(x.set.entry)}
              </span>

              <span class="hideM">
                ${fmt(x.set.sl)}
              </span>

            </div>
          `;
        }
      )
      .join("");

  document
    .querySelectorAll(
      ".focusrow"
    )
    .forEach(el => {

      el.onclick = () => {

        const symbol =
          el.dataset.symbol;

        const item =
          focus.find(
            x =>
              x[0] === symbol
          );

        if (item) {
          openCounter(
            symbol,
            item
          );
        }
      };

    });
}

/* =========================================================
   MAIN RENDER
   ========================================================= */

async function render() {

  if (rendering)
    return;

  rendering = true;

  try {

    if ($("#stamp")) {

      $("#stamp").textContent =
        `Scanning ${mode} radar…`;
    }

    /*
      1. Ambil candidate LIVE
      daripada /api/radar.js
    */

    const candidates =
      await radar(mode);

    /*
      2. Kalau radar kosong,
      guna fallback universe.
    */

    const list =
      normaliseCandidates(
        candidates,
        mode
      );

    /*
      3. Technical analysis
    */

    const ranked =
      await analyzeAll(list);

    /*
      4. Sector ranking
    */

    const sectors =
      sectorRanking(ranked);

    renderSectors(
      mode === "US"
        ? "#usSectors"
        : "#mySectors",
      sectors
    );

    /*
      5. Market mood
    */

    if (
      mode === "US" &&
      $("#usMood")
    ) {

      $("#usMood").textContent =
        sectors[0]?.name ||
        "—";
    }

    if (
      mode === "MY" &&
      $("#myMood")
    ) {

      $("#myMood").textContent =
        sectors[0]?.name ||
        "—";
    }

    /*
      6. Counter focus
    */

    const focus =
      focusRanking(ranked);

    renderFocus(focus);

    /*
      7. Auto-open #1
    */

    if (focus[0]) {

      await openCounter(
        focus[0][0],
        focus[0]
      );
    }

    if ($("#stamp")) {

      $("#stamp").textContent =
        `Updated ${new Date().toLocaleString()} · ${mode} · ${ranked.length} counters`;
    }

  } catch (e) {

    console.error(
      "Render error:",
      e
    );

    if ($("#stamp")) {

      $("#stamp").textContent =
        "Market data error";
    }

  } finally {

    rendering = false;
  }
}

/* =========================================================
   DETAIL COUNTER
   ========================================================= */

async function openCounter(
  symbol,
  x
) {

  try {

    selected = x;

    const c =
      x.c?.length
        ? x.c
        : await candles(symbol);

    if (!c.length) {

      if ($("#dName")) {

        $("#dName").textContent =
          `${symbol} · ${x[1]} — NO DATA`;
      }

      return;
    }

    const s =
      setup(c);

    if ($("#dMarket")) {

      $("#dMarket").textContent =
        mode === "US"
          ? "US EQUITY"
          : "BURSA MALAYSIA";
    }

    if ($("#dName")) {

      $("#dName").textContent =
        `${x[0]} · ${x[1]}`;
    }

    if ($("#dShariah")) {

      $("#dShariah").textContent =
        mode === "MY"
          ? (
              shariahSeed[symbol]
                ? "SHARIAH ✓"
                : "SHARIAH: CHECK SC LIST"
            )
          : "US: CHECK SCREEN";
    }

    /*
      TRADE BOX
    */

    if ($("#tradeBox")) {

      $("#tradeBox").innerHTML = [

        [
          "Signal",
          s.dir
        ],

        [
          "Entry",
          fmt(s.entry)
        ],

        [
          "TP1 / TP2 / TP3",
          s.dir === "WAIT"
            ? "—"
            :
              `${fmt(s.tp1)} / ${fmt(s.tp2)} / ${fmt(s.tp3)}`
        ],

        [
          "Stop loss",
          s.dir === "WAIT"
            ? "—"
            : fmt(s.sl)
        ],

        [
          "Risk / Reward",
          s.dir === "WAIT"
            ? "—"
            : "1 : 1 / 1 : 1.5 / 1 : 2.2"
        ]

      ]
        .map(
          a => `
            <div class="metric">

              <small>
                ${a[0]}
              </small>

              <b>
                ${a[1]}
              </b>

            </div>
          `
        )
        .join("");
    }

    /*
      TECHNICAL
    */

    if ($("#technical")) {

      $("#technical").innerHTML = `

        <div class="analysis">

          <div class="line">
            <span>Trend</span>
            <b>${s.dir}</b>
          </div>

          <div class="line">
            <span>RSI(14)</span>
            <b>${s.rsi.toFixed(1)}</b>
          </div>

          <div class="line">
            <span>MA20</span>
            <b>${fmt(s.ma20)}</b>
          </div>

          <div class="line">
            <span>MA50</span>
            <b>${fmt(s.ma50)}</b>
          </div>

          <div class="line">
            <span>Momentum 20D</span>
            <b>${s.momentum.toFixed(2)}%</b>
          </div>

          <div class="line">
            <span>Volume ratio</span>
            <b>${s.volumeRatio.toFixed(2)}x</b>
          </div>

          <div class="line">
            <span>ATR(14)</span>
            <b>${fmt(s.atr)}</b>
          </div>

          <div class="line">
            <span>Radar change</span>
            <b>
              ${
                Number(
                  x.radar?.radarChange ||
                  0
                ).toFixed(2)
              }%
            </b>
          </div>

          <div class="line">
            <span>Radar volume</span>
            <b>
              ${
                Number(
                  x.radar?.radarVolume ||
                  0
                ).toLocaleString()
              }
            </b>
          </div>

          <div class="line">
            <span>Method</span>
            <b>
              Trend + Momentum + Volume + ATR + Radar
            </b>
          </div>

        </div>
      `;
    }

    /*
      FUNDAMENTAL / RADAR
    */

    const latest =
      Number(
        c.at(-1)?.close || 0
      );

    const base =
      c
        .slice(-20)
        .map(
          x =>
            Number(x.close)
        );

    const growth =
      base.length > 1 &&
      base[0]
        ? (
            (latest / base[0] - 1) *
            100
          )
        : 0;

    const radarChange =
      Number(
        x.radar?.radarChange ||
        0
      );

    const radarVolume =
      Number(
        x.radar?.radarVolume ||
        0
      );

    if ($("#fundamental")) {

      $("#fundamental").innerHTML = `

        <div class="analysis">

          <div class="line">
            <span>Price</span>
            <b>${fmt(latest)}</b>
          </div>

          <div class="line">
            <span>20-session return</span>
            <b>${growth.toFixed(2)}%</b>
          </div>

          <div class="line">
            <span>Radar score</span>
            <b>${x.score}/100</b>
          </div>

          <div class="line">
            <span>Live change</span>
            <b>
              ${
                radarChange >= 0
                  ? "+"
                  : ""
              }${radarChange.toFixed(2)}%
            </b>
          </div>

          <div class="line">
            <span>Market volume</span>
            <b>
              ${radarVolume.toLocaleString()}
            </b>
          </div>

          <div class="line">
            <span>Market cap</span>
            <b>
              ${
                Number(
                  x.radar?.marketCap ||
                  0
                )
                  ? Number(
                      x.radar.marketCap
                    ).toLocaleString()
                  : "—"
              }
            </b>
          </div>

          <div class="line">
            <span>Decision</span>
            <b>
              ${
                x.score >= 75
                  ? "HIGH PRIORITY"
                  : x.score >= 65
                    ? "FOCUS"
                    : x.score >= 55
                      ? "MONITOR"
                      : "AVOID FOR NOW"
              }
            </b>
          </div>

        </div>
      `;
    }

    /*
      CHART
    */

    draw(
      c,
      symbol
    );

    /*
      COMPANY DOCUMENTS
    */

    try {

      const r =
        await fetch(
          `/api/company?symbol=${encodeURIComponent(symbol)}`,
          { cache: "no-store" }
        );

      if (!r.ok)
        throw new Error(
          "Company API"
        );

      const j =
        await r.json();

      if ($("#docs")) {

        $("#docs").innerHTML =
          (j.documents || [])
            .map(
              d => `

                <a
                  target="_blank"
                  rel="noopener"
                  href="${d.url}"
                >
                  ${d.type} · ${d.date || ""}
                </a>

              `
            )
            .join("")
          ||
          "<span class='muted'>No documents returned.</span>";
      }

    } catch {

      if ($("#docs")) {

        $("#docs").innerHTML =
          "<span class='muted'>Company data unavailable.</span>";
      }
    }

  } catch (e) {

    console.error(
      "Counter error:",
      symbol,
      e
    );
  }
}

/* =========================================================
   CHART
   ========================================================= */

function draw(
  c,
  symbol
) {

  const canvas =
    $("#chart");

  if (!canvas) return;

  if (chart) {

    chart.destroy();
    chart = null;
  }

  const data =
    c.slice(-80);

  const labels =
    data.map(
      x =>
        new Date(x.time)
          .toLocaleDateString()
    );

  const prices =
    data.map(
      x =>
        Number(x.close)
    );

  chart =
    new Chart(
      canvas,
      {
        type: "line",

        data: {

          labels,

          datasets: [
            {
              label: symbol,
              data: prices,
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.2
            }
          ]
        },

        options: {

          responsive: true,

          maintainAspectRatio: false,

          plugins: {

            legend: {
              display: false
            }
          },

          scales: {

            x: {

              ticks: {
                display: false
              }
            },

            y: {

              grid: {
                color: "#252b33"
              }
            }
          }
        }
      }
    );
}

/* =========================================================
   TABS
   ========================================================= */

document
  .querySelectorAll(".tab")
  .forEach(
    button => {

      button.onclick =
        async () => {

          document
            .querySelectorAll(".tab")
            .forEach(
              x =>
                x.classList.remove(
                  "active"
                )
            );

          button.classList.add(
            "active"
          );

          mode =
            button.dataset.m ||
            "US";

          await render();
        };
    }
  );

/* =========================================================
   REFRESH
   ========================================================= */

if ($("#refresh")) {

  $("#refresh").onclick =
    render;
}

/* =========================================================
   START
   ========================================================= */

render();
