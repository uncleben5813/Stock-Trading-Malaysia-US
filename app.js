const $ = s => document.querySelector(s);

let mode = "US";
let chart = null;
let selected = null;
let rendering = false;

const us = [
  ["NVDA","NVIDIA","Semiconductors"],["AMD","AMD","Semiconductors"],["AVGO","Broadcom","Semiconductors"],
  ["TSM","TSMC","Semiconductors"],["MU","Micron","Semiconductors"],
  ["AAPL","Apple","Technology Hardware"],["MSFT","Microsoft","Software"],["GOOGL","Alphabet","Internet"],
  ["AMZN","Amazon","Internet"],["META","Meta","Internet"],["ORCL","Oracle","Software"],
  ["CRM","Salesforce","Software"],["PLTR","Palantir","Software"],["NFLX","Netflix","Media"],
  ["TSLA","Tesla","Automobiles"],["LLY","Eli Lilly","Pharmaceuticals"],["UNH","UnitedHealth","Healthcare"],
  ["XOM","Exxon Mobil","Energy"],["CVX","Chevron","Energy"],["JPM","JPMorgan","Banks"],
  ["BAC","Bank of America","Banks"],["V","Visa","Financial Services"],["MA","Mastercard","Financial Services"],
  ["WMT","Walmart","Retail"],["COST","Costco","Retail"],["CAT","Caterpillar","Industrials"],
  ["GE","GE Aerospace","Industrials"],["RTX","RTX","Aerospace & Defense"],["LIN","Linde","Chemicals"],
  ["ADBE","Adobe","Software"],["INTC","Intel","Semiconductors"],["IBM","IBM","IT Services"],
  ["UBER","Uber","Transport"],["COIN","Coinbase","Financial Services"],["CRWD","CrowdStrike","Cybersecurity"]
];

const my = [
  ["1023.KL","CIMB","Banks"],["1155.KL","Maybank","Banks"],["1295.KL","Public Bank","Banks"],
  ["5819.KL","Hong Leong Bank","Banks"],["4863.KL","Telekom Malaysia","Telecommunications"],
  ["6012.KL","Maxis","Telecommunications"],["6947.KL","CelcomDigi","Telecommunications"],
  ["3042.KL","Petronas Gas","Utilities"],["7089.KL","YTL Power","Utilities"],
  ["4677.KL","YTL Corp","Utilities"],["5183.KL","Petronas Dagangan","Consumer Fuels"],
  ["5681.KL","Petronas Chemicals","Chemicals"],["5347.KL","GAMUDA","Construction"],
  ["5398.KL","IJM","Construction"],["5211.KL","Sunway","Construction"],
  ["4197.KL","Sime Darby Plantation","Plantation"],["1961.KL","IOI","Plantation"],
  ["8869.KL","Dialog","Oil & Gas Services"],["3816.KL","MISC","Marine Transport"],
  ["4707.KL","Nestle Malaysia","Food"],["7084.KL","QL Resources","Food"],
  ["5225.KL","IHH Healthcare","Healthcare"],["7153.KL","Kossan","Rubber Products"],
  ["7113.KL","Top Glove","Rubber Products"],["7086.KL","Hartalega","Healthcare Equipment"],
  ["0166.KL","Frontken","Semiconductors"],["0097.KL","Greatech","Semiconductors"],
  ["5285.KL","Sime Darby","Industrial"],["4065.KL","PPB","Food"],["2445.KL","KLK","Plantation"]
];

const shariahSeed = {
  "5347.KL":1,"5398.KL":1,"5211.KL":1,"5285.KL":1,
  "4197.KL":1,"1961.KL":1,"8869.KL":1,"3816.KL":1,
  "7089.KL":1,"4677.KL":1,"7084.KL":1,"5225.KL":1,
  "7153.KL":1,"7113.KL":1,"7086.KL":1,"0166.KL":1,"0097.KL":1
};

/* =========================================================
   HELPERS
   ========================================================= */

function fmt(n) {
  n = Number(n);

  if (!Number.isFinite(n)) return "—";

  return n > 100
    ? n.toFixed(2)
    : n.toFixed(3);
}

function pct(n) {
  n = Number(n);

  if (!Number.isFinite(n)) return "—";

  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/* =========================================================
   MARKET DATA
   ========================================================= */

async function candles(symbol, interval = "1d") {
  try {
    const r = await fetch(
      `/api/market?symbol=${encodeURIComponent(symbol)}&range=6mo&interval=${interval}`,
      {
        cache: "no-store"
      }
    );

    if (!r.ok) return [];

    const j = await r.json();

    if (!j || !j.ok || !Array.isArray(j.candles)) {
      return [];
    }

    return j.candles.filter(x =>
      Number.isFinite(Number(x.close)) &&
      Number.isFinite(Number(x.high)) &&
      Number.isFinite(Number(x.low))
    );

  } catch (e) {
    console.warn("Market API failed:", symbol, e);
    return [];
  }
}

/* =========================================================
   INDICATORS
   ========================================================= */

function sma(a, n) {
  if (!Array.isArray(a) || a.length < n) {
    return null;
  }

  const values = a.slice(-n).filter(Number.isFinite);

  if (values.length < n) {
    return null;
  }

  return values.reduce((x, y) => x + y, 0) / n;
}

function atr(c, n = 14) {
  if (!Array.isArray(c) || c.length < n + 1) {
    return 0;
  }

  const tr = [];

  for (let i = 1; i < c.length; i++) {
    const current = c[i];
    const previous = c[i - 1];

    tr.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      )
    );
  }

  return sma(tr, n) || 0;
}

function rsi(c, n = 14) {
  if (!Array.isArray(c) || c.length < n + 1) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (let i = c.length - n; i < c.length; i++) {
    const d = c[i].close - c[i - 1].close;

    if (d > 0) {
      gains += d;
    } else {
      losses -= d;
    }
  }

  if (losses === 0) {
    return 100;
  }

  const rs = gains / losses;

  return 100 - 100 / (1 + rs);
}

/* =========================================================
   MOMENTUM
   ========================================================= */

function returnPct(c, periods) {
  if (!c || c.length <= periods) {
    return 0;
  }

  const latest = c.at(-1).close;
  const previous = c[c.length - 1 - periods].close;

  if (!previous) {
    return 0;
  }

  return (latest / previous - 1) * 100;
}

function momentumScore(c) {
  if (!c || c.length < 25) {
    return 0;
  }

  const r5 = returnPct(c, 5);
  const r20 = returnPct(c, 20);
  const r60 = returnPct(c, Math.min(60, c.length - 1));

  let score = 50;

  score += Math.max(-15, Math.min(15, r5 * 2));
  score += Math.max(-15, Math.min(15, r20));
  score += Math.max(-10, Math.min(10, r60 / 2));

  return Math.max(0, Math.min(100, Math.round(score)));
}

/* =========================================================
   TECHNICAL SCORE
   ========================================================= */

function score(c) {
  if (!c || c.length < 20) {
    return 0;
  }

  const closes = c.map(x => Number(x.close));
  const last = closes.at(-1);

  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const r = rsi(c);

  if (!Number.isFinite(last)) {
    return 0;
  }

  let x = 50;

  if (s20 !== null) {
    x += last > s20 ? 10 : -10;
  }

  if (s50 !== null) {
    x += last > s50 ? 12 : -12;
  }

  if (s50 !== null && s20 !== null) {
    x += s20 > s50 ? 8 : -8;
  }

  x += r > 55
    ? 8
    : r < 45
      ? -8
      : 0;

  const oldIndex = Math.max(0, closes.length - 21);
  const old = closes[oldIndex];

  if (old > 0) {
    const ret = (last / old - 1) * 100;

    x += ret > 0 ? 10 : -10;
  }

  return Math.max(0, Math.min(100, Math.round(x)));
}

/* =========================================================
   TRADE SETUP
   ========================================================= */

function setup(c) {
  if (!c || !c.length) {
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
      ma50: null
    };
  }

  const p = c.at(-1).close;
  const a = atr(c) || p * 0.015;

  const closes = c.map(x => x.close);

  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);

  const r = rsi(c);

  const bull =
    ma20 !== null &&
    ma50 !== null &&
    p > ma20 &&
    ma20 > ma50 &&
    r >= 52;

  const bear =
    ma20 !== null &&
    ma50 !== null &&
    p < ma20 &&
    ma20 < ma50 &&
    r <= 48;

  const dir =
    bull
      ? "BUY"
      : bear
        ? "SELL"
        : "WAIT";

  let sl = p;
  let tp1 = p;
  let tp2 = p;
  let tp3 = p;

  if (dir === "BUY") {
    sl = p - 1.35 * a;
    tp1 = p + 1 * a;
    tp2 = p + 2 * a;
    tp3 = p + 3 * a;
  }

  if (dir === "SELL") {
    sl = p + 1.35 * a;
    tp1 = p - 1 * a;
    tp2 = p - 2 * a;
    tp3 = p - 3 * a;
  }

  return {
    dir,
    entry: p,
    sl,
    tp1,
    tp2,
    tp3,
    atr: a,
    rsi: r,
    ma20,
    ma50
  };
}

/* =========================================================
   RISK
   ========================================================= */

function riskLevel(set) {
  if (!set || set.dir === "WAIT") {
    return "NO TRADE";
  }

  const entry = Number(set.entry);
  const sl = Number(set.sl);
  const atrValue = Number(set.atr);

  if (!entry || !sl || !atrValue) {
    return "MEDIUM";
  }

  const distance = Math.abs(entry - sl);
  const atrRatio = distance / atrValue;

  if (atrRatio <= 1.1) {
    return "LOW";
  }

  if (atrRatio <= 1.6) {
    return "MEDIUM";
  }

  return "HIGH";
}

/* =========================================================
   FULL COUNTER ANALYSIS
   ========================================================= */

async function analyze(x) {
  const c = await candles(x[0]);

  if (!c.length) {
    return {
      ...x,
      c: [],
      score: 0,
      momentum: 0,
      return5: 0,
      return20: 0,
      return60: 0,
      set: setup([]),
      risk: "NO DATA"
    };
  }

  const set = setup(c);

  return {
    ...x,
    c,

    score: score(c),

    momentum: momentumScore(c),

    return5: returnPct(c, 5),
    return20: returnPct(c, 20),
    return60: returnPct(c, Math.min(60, c.length - 1)),

    set,

    risk: riskLevel(set)
  };
}

/* =========================================================
   BATCH ANALYSIS
   ========================================================= */

async function analyzeAll(list) {
  const results = [];

  for (let i = 0; i < list.length; i += 5) {
    const batch = list.slice(i, i + 5);

    const result = await Promise.all(
      batch.map(x => analyze(x))
    );

    results.push(...result);
  }

  return results;
}

/* =========================================================
   SECTOR RANKING
   ========================================================= */

function sectorsFromResults(results) {
  const map = {};

  results.forEach(x => {
    const sector = x[2];

    if (!map[sector]) {
      map[sector] = [];
    }

    map[sector].push(x);
  });

  return Object.entries(map)
    .map(([name, items]) => {

      const scores = items
        .map(x => Number(x.score))
        .filter(Number.isFinite);

      const momentum = items
        .map(x => Number(x.momentum))
        .filter(Number.isFinite);

      const avgScore =
        scores.length
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0;

      const avgMomentum =
        momentum.length
          ? momentum.reduce((a, b) => a + b, 0) / momentum.length
          : 0;

      const buyCount =
        items.filter(x => x.set?.dir === "BUY").length;

      const sellCount =
        items.filter(x => x.set?.dir === "SELL").length;

      const finalScore =
        avgScore * 0.65 +
        avgMomentum * 0.35;

      return {
        name,
        score: Math.round(finalScore),
        avgScore: Math.round(avgScore),
        momentum: Math.round(avgMomentum),
        buyCount,
        sellCount,
        count: items.length,
        items
      };
    })
    .sort((a, b) => b.score - a.score);
}

/* =========================================================
   SECTOR UI
   ========================================================= */

function renderSectors(id, arr) {
  const el = $(id);

  if (!el) return;

  if (!arr.length) {
    el.innerHTML =
      `<div class="muted">No sector data.</div>`;
    return;
  }

  el.innerHTML = arr.map((x, i) => `
    <div class="sector">
      <b>#${i + 1}</b>

      <span>
        ${x.name}

        <div class="bar">
          <i style="width:${Math.max(0, Math.min(100, x.score))}%"></i>
        </div>
      </span>

      <b>${x.score}</b>
    </div>
  `).join("");
}

/* =========================================================
   MARKET INTELLIGENCE
   ========================================================= */

function marketMood(sectors) {
  if (!sectors.length) {
    return "—";
  }

  const s = sectors[0].score;

  if (s >= 70) {
    return "STRONG";
  }

  if (s >= 55) {
    return "POSITIVE";
  }

  if (s >= 45) {
    return "NEUTRAL";
  }

  if (s >= 30) {
    return "WEAK";
  }

  return "BEARISH";
}

function setupPriority(x) {
  if (!x) return -999;

  let value = Number(x.score) || 0;

  if (x.set?.dir === "BUY") {
    value += 12;
  }

  if (x.set?.dir === "SELL") {
    value += 8;
  }

  value += (Number(x.momentum) || 0) * 0.15;

  if (x.risk === "HIGH") {
    value -= 8;
  }

  return value;
}

/* =========================================================
   MAIN RENDER
   ========================================================= */

async function render() {
  if (rendering) return;

  rendering = true;

  try {
    const stamp = $("#stamp");

    if (stamp) {
      stamp.textContent =
        `Scanning ${mode} market...`;
    }

    const list =
      mode === "US"
        ? us
        : my;

    const ranked =
      await analyzeAll(list);

    ranked.sort(
      (a, b) => setupPriority(b) - setupPriority(a)
    );

    const sectors =
      sectorsFromResults(ranked);

    renderSectors(
      mode === "US"
        ? "#usSectors"
        : "#mySectors",
      sectors
    );

    /* MARKET MOOD */

    if (mode === "US") {
      if ($("#usMood")) {
        $("#usMood").textContent =
          marketMood(sectors);
      }
    } else {
      if ($("#myMood")) {
        $("#myMood").textContent =
          marketMood(sectors);
      }
    }

    /* TOP COUNTERS */

    const focus =
      ranked.slice(0, 12);

    const focusEl =
      $("#focus");

    if (focusEl) {

      focusEl.innerHTML =
        focus.map((x, i) => `

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

            <span class="${
              x.set.dir === "BUY"
                ? "up"
                : x.set.dir === "SELL"
                  ? "down"
                  : ""
            }">
              ${x.set.dir}
            </span>

            <span class="hideM">
              ${x.set.entry != null
                ? fmt(x.set.entry)
                : "—"}
            </span>

            <span class="hideM">
              ${x.set.sl != null
                ? fmt(x.set.sl)
                : "—"}
            </span>

          </div>

        `).join("");
    }

    /* CLICK COUNTER */

    document
      .querySelectorAll(".focusrow")
      .forEach(el => {

        el.onclick = () => {

          const symbol =
            el.dataset.symbol;

          const item =
            ranked.find(
              x => x[0] === symbol
            );

          if (item) {
            openCounter(
              symbol,
              item
            );
          }
        };

      });

    /* DEFAULT COUNTER */

    if (focus[0]) {
      await openCounter(
        focus[0][0],
        focus[0]
      );
    }

    if (stamp) {
      stamp.textContent =
        `Updated ${new Date().toLocaleString()}`;
    }

  } catch (e) {

    console.error(
      "Dashboard render error:",
      e
    );

    if ($("#stamp")) {
      $("#stamp").textContent =
        "Data error — press Refresh";
    }

  } finally {
    rendering = false;
  }
}

/* =========================================================
   COUNTER DETAIL
   ========================================================= */

async function openCounter(symbol, x) {

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

    const scoreValue =
      Number(x.score) || score(c);

    const momentum =
      Number(x.momentum) ||
      momentumScore(c);

    const risk =
      x.risk ||
      riskLevel(s);

    /* HEADER */

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

    /* SHARIAH */

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

    /* TRADE BOX */

    if ($("#tradeBox")) {

      $("#tradeBox").innerHTML = [

        ["Signal", s.dir],

        ["Entry", fmt(s.entry)],

        [
          "TP1 / TP2 / TP3",
          `${fmt(s.tp1)} / ${fmt(s.tp2)} / ${fmt(s.tp3)}`
        ],

        ["Stop loss", fmt(s.sl)],

        [
          "Risk",
          risk
        ]

      ].map(a => `

        <div class="metric">

          <small>
            ${a[0]}
          </small>

          <b>
            ${a[1]}
          </b>

        </div>

      `).join("");
    }

    /* TECHNICAL */

    if ($("#technical")) {

      $("#technical").innerHTML = `

        <div class="analysis">

          <div class="line">
            <span>Signal</span>
            <b>${s.dir}</b>
          </div>

          <div class="line">
            <span>Technical score</span>
            <b>${scoreValue}/100</b>
          </div>

          <div class="line">
            <span>Momentum</span>
            <b>${momentum}/100</b>
          </div>

          <div class="line">
            <span>RSI(14)</span>
            <b>${Number(s.rsi).toFixed(1)}</b>
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
            <span>ATR(14)</span>
            <b>${fmt(s.atr)}</b>
          </div>

          <div class="line">
            <span>5-session return</span>
            <b>${pct(x.return5)}</b>
          </div>

          <div class="line">
            <span>20-session return</span>
            <b>${pct(x.return20)}</b>
          </div>

          <div class="line">
            <span>Risk profile</span>
            <b>${risk}</b>
          </div>

          <div class="line">
            <span>Method</span>
            <b>Trend + Momentum + ATR</b>
          </div>

        </div>

      `;
    }

    /* FUNDAMENTAL / MARKET HEALTH */

    const latest =
      c.at(-1)?.close || 0;

    const base =
      c.slice(-20)
        .map(z => z.close);

    const growth =
      base.length > 1 && base[0]
        ? (latest / base[0] - 1) * 100
        : 0;

    let health =
      "WEAK";

    if (scoreValue >= 70) {
      health = "STRONG";
    } else if (scoreValue >= 55) {
      health = "WATCH";
    }

    let decision =
      "AVOID FOR NOW";

    if (
      scoreValue >= 70 &&
      s.dir !== "WAIT"
    ) {
      decision = "FOCUS";
    } else if (
      scoreValue >= 55
    ) {
      decision = "MONITOR";
    }

    if ($("#fundamental")) {

      $("#fundamental").innerHTML = `

        <div class="analysis">

          <div class="line">
            <span>Current price</span>
            <b>${fmt(latest)}</b>
          </div>

          <div class="line">
            <span>20-session return</span>
            <b>${pct(growth)}</b>
          </div>

          <div class="line">
            <span>Market score</span>
            <b>${scoreValue}/100</b>
          </div>

          <div class="line">
            <span>Company health</span>
            <b>${health}</b>
          </div>

          <div class="line">
            <span>Market position</span>
            <b>${decision}</b>
          </div>

          <div class="line">
            <span>Data coverage</span>
            <b>Yahoo Market Data</b>
          </div>

        </div>

      `;
    }

    /* CHART */

    draw(
      c,
      symbol
    );

    /* DOCUMENTS */

    try {

      const r =
        await fetch(
          `/api/company?symbol=${encodeURIComponent(symbol)}`,
          {
            cache: "no-store"
          }
        );

      if (!r.ok) {
        throw new Error(
          "Company endpoint failed"
        );
      }

      const j =
        await r.json();

      if ($("#docs")) {

        $("#docs").innerHTML =
          (j.documents || [])
            .map(d => `

              <a
                target="_blank"
                rel="noopener"
                href="${d.url}"
              >
                ${d.type} · ${d.date || ""}
              </a>

            `)
            .join("")
          ||
          "<span class='muted'>No documents returned.</span>";
      }

    } catch (e) {

      console.warn(
        "Company data unavailable:",
        e
      );

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

function draw(c, symbol) {

  if (!$("#chart")) {
    return;
  }

  if (chart) {
    chart.destroy();
    chart = null;
  }

  const data =
    c.slice(-80);

  const labels =
    data.map(x =>
      new Date(
        x.time
      ).toLocaleDateString()
    );

  const prices =
    data.map(x =>
      x.close
    );

  chart =
    new Chart(
      $("#chart"),
      {
        type: "line",

        data: {

          labels,

          datasets: [{

            label: symbol,

            data: prices,

            borderWidth: 2,

            pointRadius: 0,

            tension: 0.2

          }]
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
   MARKET SWITCH
   ========================================================= */

document
  .querySelectorAll(".tab")
  .forEach(button => {

    button.onclick = async () => {

      document
        .querySelectorAll(".tab")
        .forEach(z =>
          z.classList.remove("active")
        );

      button.classList.add("active");

      mode =
        button.dataset.m || "US";

      await render();
    };

  });

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
