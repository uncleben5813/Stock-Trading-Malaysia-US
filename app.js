const $ = s => document.querySelector(s);

let mode = "US";
let chart = null;
let selected = null;
let rendering = false;

/* =========================================================
   WATCHLIST
========================================================= */

const us = [
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

const my = [
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

const shariahSeed = {
  "5347.KL":1,
  "5398.KL":1,
  "5211.KL":1,
  "5285.KL":1,
  "4197.KL":1,
  "1961.KL":1,
  "8869.KL":1,
  "3816.KL":1,
  "7089.KL":1,
  "4677.KL":1,
  "7084.KL":1,
  "5225.KL":1,
  "7153.KL":1,
  "7113.KL":1,
  "7086.KL":1,
  "0166.KL":1,
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
   MARKET DATA
========================================================= */

async function candles(symbol, interval = "1d") {

  try {

    const url =
      `/api/market?symbol=${encodeURIComponent(symbol)}` +
      `&range=6mo&interval=${interval}`;

    const r = await fetch(url, {
      cache: "no-store"
    });

    if (!r.ok) return [];

    const j = await r.json();

    if (
      !j ||
      !j.ok ||
      !Array.isArray(j.candles)
    ) {
      return [];
    }

    return j.candles.filter(x =>
      Number.isFinite(Number(x.close)) &&
      Number.isFinite(Number(x.high)) &&
      Number.isFinite(Number(x.low)) &&
      Number.isFinite(Number(x.volume))
    );

  } catch (e) {

    console.warn(
      "Market API failed:",
      symbol,
      e
    );

    return [];
  }
}

/* =========================================================
   SMA
========================================================= */

function sma(values, n) {

  if (
    !Array.isArray(values) ||
    values.length < n
  ) {
    return null;
  }

  const arr = values.slice(-n);

  if (
    arr.length < n ||
    arr.some(v => !Number.isFinite(Number(v)))
  ) {
    return null;
  }

  return arr.reduce(
    (a,b) => a + Number(b),
    0
  ) / n;
}

/* =========================================================
   EMA
========================================================= */

function ema(values, n) {

  if (
    !Array.isArray(values) ||
    values.length < n
  ) {
    return null;
  }

  const k = 2 / (n + 1);

  let result = sma(values.slice(0,n), n);

  if (result === null) return null;

  for (
    let i = n;
    i < values.length;
    i++
  ) {

    result =
      Number(values[i]) * k +
      result * (1 - k);
  }

  return result;
}

/* =========================================================
   ATR
========================================================= */

function atr(c, n = 14) {

  if (
    !Array.isArray(c) ||
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

    const current = c[i];
    const previous = c[i - 1];

    const high = Number(current.high);
    const low = Number(current.low);
    const prevClose = Number(previous.close);

    tr.push(
      Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      )
    );
  }

  return sma(tr,n) || 0;
}

/* =========================================================
   RSI
========================================================= */

function rsi(c, n = 14) {

  if (
    !Array.isArray(c) ||
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

    const diff =
      Number(c[i].close) -
      Number(c[i - 1].close);

    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  if (losses === 0) return 100;

  const rs = gains / losses;

  return 100 -
    100 / (1 + rs);
}

/* =========================================================
   RETURN
========================================================= */

function returnPct(c, n) {

  if (
    !Array.isArray(c) ||
    c.length <= n
  ) {
    return 0;
  }

  const old =
    Number(c[c.length - 1 - n].close);

  const current =
    Number(c[c.length - 1].close);

  if (!old) return 0;

  return (
    (current / old - 1) * 100
  );
}

/* =========================================================
   VOLUME MOMENTUM
========================================================= */

function volumeRatio(c, n = 20) {

  if (
    !Array.isArray(c) ||
    c.length < n + 1
  ) {
    return 1;
  }

  const recent =
    Number(c.at(-1).volume);

  const previous =
    c.slice(-n - 1, -1)
      .map(x => Number(x.volume))
      .filter(Number.isFinite);

  if (!previous.length) return 1;

  const avg =
    previous.reduce(
      (a,b) => a + b,
      0
    ) / previous.length;

  if (!avg) return 1;

  return recent / avg;
}

/* =========================================================
   PRICE POSITION
========================================================= */

function pricePosition(c, n = 20) {

  if (
    !Array.isArray(c) ||
    c.length < n
  ) {
    return 50;
  }

  const arr = c.slice(-n);

  const high =
    Math.max(
      ...arr.map(x => Number(x.high))
    );

  const low =
    Math.min(
      ...arr.map(x => Number(x.low))
    );

  const price =
    Number(c.at(-1).close);

  if (high === low) return 50;

  return (
    (price - low) /
    (high - low)
  ) * 100;
}

/* =========================================================
   TECHNICAL SCORE
========================================================= */

function score(c) {

  if (
    !Array.isArray(c) ||
    c.length < 50
  ) {
    return 0;
  }

  const closes =
    c.map(x => Number(x.close));

  const price =
    closes.at(-1);

  const ma20 =
    sma(closes,20);

  const ma50 =
    sma(closes,50);

  const ema20 =
    ema(closes,20);

  const r =
    rsi(c);

  const ret5 =
    returnPct(c,5);

  const ret20 =
    returnPct(c,20);

  const vol =
    volumeRatio(c,20);

  let score = 50;

  /* Trend */

  if (ma20 !== null) {
    score +=
      price > ma20
        ? 10
        : -10;
  }

  if (ma50 !== null) {
    score +=
      price > ma50
        ? 12
        : -12;
  }

  if (
    ma20 !== null &&
    ma50 !== null
  ) {

    score +=
      ma20 > ma50
        ? 10
        : -10;
  }

  /* EMA momentum */

  if (ema20 !== null) {

    score +=
      price > ema20
        ? 5
        : -5;
  }

  /* RSI */

  if (r >= 60) {
    score += 8;
  }
  else if (r >= 52) {
    score += 4;
  }
  else if (r <= 40) {
    score -= 8;
  }
  else if (r <= 48) {
    score -= 4;
  }

  /* Short momentum */

  if (ret5 > 3) {
    score += 7;
  }
  else if (ret5 > 0) {
    score += 3;
  }
  else if (ret5 < -3) {
    score -= 7;
  }
  else if (ret5 < 0) {
    score -= 3;
  }

  /* Medium momentum */

  if (ret20 > 8) {
    score += 8;
  }
  else if (ret20 > 0) {
    score += 4;
  }
  else if (ret20 < -8) {
    score -= 8;
  }
  else if (ret20 < 0) {
    score -= 4;
  }

  /* Volume confirmation */

  if (vol >= 1.5) {
    score += 8;
  }
  else if (vol >= 1.15) {
    score += 4;
  }
  else if (vol < 0.7) {
    score -= 3;
  }

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
    !Array.isArray(c) ||
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
      volumeRatio: 1
    };
  }

  const price =
    Number(c.at(-1).close);

  const a =
    atr(c) ||
    price * 0.015;

  const closes =
    c.map(x => Number(x.close));

  const ma20 =
    sma(closes,20);

  const ma50 =
    sma(closes,50);

  const r =
    rsi(c);

  const vr =
    volumeRatio(c,20);

  const ret5 =
    returnPct(c,5);

  const ret20 =
    returnPct(c,20);

  /*
    BUY:
    Trend aligned + momentum positive
  */

  const bull =
    ma20 !== null &&
    ma50 !== null &&
    price > ma20 &&
    ma20 > ma50 &&
    r >= 52 &&
    ret5 > 0;

  /*
    SELL:
    Trend aligned + momentum negative
  */

  const bear =
    ma20 !== null &&
    ma50 !== null &&
    price < ma20 &&
    ma20 < ma50 &&
    r <= 48 &&
    ret5 < 0;

  let dir = "WAIT";

  if (bull) {
    dir = "BUY";
  }
  else if (bear) {
    dir = "SELL";
  }

  /*
    Avoid extremely weak volume
  */

  if (
    dir !== "WAIT" &&
    vr < 0.55
  ) {
    dir = "WAIT";
  }

  const entry = price;

  let sl = price;
  let tp1 = price;
  let tp2 = price;
  let tp3 = price;

  if (dir === "BUY") {

    sl =
      price -
      1.35 * a;

    tp1 =
      price +
      1.00 * a;

    tp2 =
      price +
      2.00 * a;

    tp3 =
      price +
      3.00 * a;
  }

  if (dir === "SELL") {

    sl =
      price +
      1.35 * a;

    tp1 =
      price -
      1.00 * a;

    tp2 =
      price -
      2.00 * a;

    tp3 =
      price -
      3.00 * a;
  }

  return {
    dir,
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    atr: a,
    rsi: r,
    ma20,
    ma50,
    volumeRatio: vr,
    return5: ret5,
    return20: ret20
  };
}

/* =========================================================
   ANALYZE ONE COUNTER
========================================================= */

async function analyze(x) {

  const c =
    await candles(x[0]);

  if (!c.length) {

    return {
      ...x,
      c: [],
      score: 0,
      set: setup([])
    };
  }

  const set =
    setup(c);

  return {
    ...x,
    c,
    score: score(c),
    set
  };
}

/* =========================================================
   ANALYZE ALL
========================================================= */

async function analyzeAll(list) {

  const results = [];

  /*
    Small batches.
    Avoid hammering API.
  */

  for (
    let i = 0;
    i < list.length;
    i += 5
  ) {

    const batch =
      list.slice(i,i + 5);

    const result =
      await Promise.all(
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

    if (
      Number.isFinite(x.score) &&
      x.score > 0
    ) {

      map[sector].push(x.score);
    }
  });

  return Object.entries(map)

    .map(([name,values]) => {

      const average =
        values.length
          ? values.reduce(
              (a,b) => a + b,
              0
            ) / values.length
          : 0;

      return {
        name,
        score: Math.round(average),
        count: values.length
      };
    })

    .sort(
      (a,b) =>
        b.score - a.score
    );
}

/* =========================================================
   RENDER SECTORS
========================================================= */

function renderSectors(id,arr) {

  const el = $(id);

  if (!el) return;

  if (!arr.length) {

    el.innerHTML =
      `<div class="muted">
        No sector data.
      </div>`;

    return;
  }

  el.innerHTML =
    arr.map((x,i) => `

      <div class="sector">

        <b>#${i + 1}</b>

        <span>

          ${x.name}

          <div class="bar">
            <i style="width:${x.score}%"></i>
          </div>

        </span>

        <b>${x.score}</b>

      </div>

    `).join("");
}

/* =========================================================
   MAIN RENDER
========================================================= */

async function render() {

  if (rendering) return;

  rendering = true;

  try {

    if ($("#stamp")) {

      $("#stamp").textContent =
        `Scanning ${mode} market...`;
    }

    const list =
      mode === "US"
        ? us
        : my;

    const ranked =
      await analyzeAll(list);

    /*
      Highest score first
    */

    ranked.sort(
      (a,b) =>
        b.score - a.score
    );

    /*
      Sector ranking
    */

    const sectors =
      sectorsFromResults(ranked);

    renderSectors(
      mode === "US"
        ? "#usSectors"
        : "#mySectors",
      sectors
    );

    /*
      Market mood
    */

    const strongestSector =
      sectors[0];

    if (mode === "US") {

      if ($("#usMood")) {

        $("#usMood").textContent =
          strongestSector
            ? strongestSector.name
            : "—";
      }

    }
    else {

      if ($("#myMood")) {

        $("#myMood").textContent =
          strongestSector
            ? strongestSector.name
            : "—";
      }
    }

    /*
      TOP FOCUS
      Not fixed NVDA.
      Whatever scores highest appears first.
    */

    const focus =
      ranked
        .filter(x => x.score > 0)
        .slice(0,12);

    const focusEl =
      $("#focus");

    if (focusEl) {

      if (!focus.length) {

        focusEl.innerHTML =
          `<div class="muted">
            No market candidates found.
          </div>`;

      }
      else {

        focusEl.innerHTML =
          focus.map((x,i) => `

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
                ${
                  x.set.entry !== null
                    ? fmt(x.set.entry)
                    : "—"
                }
              </span>

              <span class="hideM">
                ${
                  x.set.sl !== null
                    ? fmt(x.set.sl)
                    : "—"
                }
              </span>

            </div>

          `).join("");
      }
    }

    /*
      CLICK COUNTER
    */

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

    /*
      Automatically open #1
    */

    if (focus[0]) {

      await openCounter(
        focus[0][0],
        focus[0]
      );
    }

    if ($("#stamp")) {

      $("#stamp").textContent =
        `Updated ${new Date().toLocaleString()}`;
    }

  }
  catch (e) {

    console.error(
      "Dashboard render error:",
      e
    );

    if ($("#stamp")) {

      $("#stamp").textContent =
        "Data error — press Refresh";
    }

  }
  finally {

    rendering = false;
  }
}

/* =========================================================
   COUNTER DETAIL
========================================================= */

async function openCounter(symbol,x) {

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

    /* =====================================================
       TRADE BOX
    ===================================================== */

    if ($("#tradeBox")) {

      $("#tradeBox").innerHTML = [

        ["Signal",s.dir],

        ["Entry",fmt(s.entry)],

        [
          "TP1 / TP2 / TP3",
          `${fmt(s.tp1)} / ${fmt(s.tp2)} / ${fmt(s.tp3)}`
        ],

        ["Stop loss",fmt(s.sl)],

        [
          "Risk/Reward",
          s.dir === "WAIT"
            ? "—"
            : "~1:1 / 1:1.5 / 1:2.2"
        ]

      ]
      .map(a => `

        <div class="metric">

          <small>${a[0]}</small>

          <b>${a[1]}</b>

        </div>

      `)
      .join("");
    }

    /* =====================================================
       TECHNICAL
    ===================================================== */

    if ($("#technical")) {

      $("#technical").innerHTML = `

        <div class="analysis">

          <div class="line">
            <span>Trend</span>
            <b>${s.dir}</b>
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
            <span>5-session momentum</span>
            <b>${Number(s.return5 || 0).toFixed(2)}%</b>
          </div>

          <div class="line">
            <span>20-session momentum</span>
            <b>${Number(s.return20 || 0).toFixed(2)}%</b>
          </div>

          <div class="line">
            <span>Volume vs average</span>
            <b>${Number(s.volumeRatio || 1).toFixed(2)}x</b>
          </div>

          <div class="line">
            <span>Method</span>
            <b>Trend + Momentum + Volume + ATR</b>
          </div>

        </div>
      `;
    }

    /* =====================================================
       FUNDAMENTAL / MARKET HEALTH
    ===================================================== */

    const latest =
      Number(c.at(-1)?.close || 0);

    const growth =
      returnPct(c,20);

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
            <span>Company health</span>

            <b>
              ${
                x.score >= 75
                  ? "STRONG"
                  : x.score >= 60
                    ? "WATCH"
                    : x.score >= 45
                      ? "NEUTRAL"
                      : "WEAK"
              }
            </b>

          </div>

          <div class="line">
            <span>Market decision</span>

            <b>
              ${
                x.score >= 75
                  ? "FOCUS"
                  : x.score >= 60
                    ? "MONITOR"
                    : "WAIT"
              }
            </b>

          </div>

          <div class="line">
            <span>Data source</span>
            <b>Yahoo Market Data</b>
          </div>

        </div>
      `;
    }

    /* =====================================================
       CHART
    ===================================================== */

    draw(c,symbol);

    /* =====================================================
       DOCUMENTS
    ===================================================== */

    try {

      const r =
        await fetch(
          `/api/company?symbol=${encodeURIComponent(symbol)}`,
          {
            cache:"no-store"
          }
        );

      if (!r.ok) {
        throw new Error(
          "Company API failed"
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
                ${d.type}
                ·
                ${d.date || ""}
              </a>

            `)
            .join("")
          ||
          "<span class='muted'>No documents returned.</span>";
      }

    }
    catch (e) {

      if ($("#docs")) {

        $("#docs").innerHTML =
          "<span class='muted'>Company data unavailable.</span>";
      }
    }

  }
  catch (e) {

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

function draw(c,symbol) {

  if (!$("#chart")) return;

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
      Number(x.close)
    );

  chart =
    new Chart(
      $("#chart"),
      {
        type:"line",

        data:{
          labels,

          datasets:[{

            label:symbol,

            data:prices,

            borderWidth:2,

            pointRadius:0,

            tension:0.2

          }]
        },

        options:{

          responsive:true,

          maintainAspectRatio:false,

          plugins:{

            legend:{
              display:false
            }
          },

          scales:{

            x:{
              ticks:{
                display:false
              }
            },

            y:{
              grid:{
                color:"#252b33"
              }
            }
          }
        }
      }
    );
}

/* =========================================================
   MARKET TABS
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
