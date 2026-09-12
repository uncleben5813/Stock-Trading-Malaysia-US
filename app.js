const $ = s => document.querySelector(s);

let mode = "US";
let chart = null;
let selected = null;
let rendering = false;

/* =========================
   STOCK UNIVERSE
========================= */

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

/* =========================
   SHARIAH SEED
========================= */

const shariahSeed = {
  "5347.KL": 1,
  "5398.KL": 1,
  "5211.KL": 1,
  "5285.KL": 1,
  "4197.KL": 1,
  "1961.KL": 1,
  "8869.KL": 1,
  "3816.KL": 1,
  "7089.KL": 1,
  "4677.KL": 1,
  "7084.KL": 1,
  "5225.KL": 1,
  "7153.KL": 1,
  "7113.KL": 1,
  "7086.KL": 1,
  "0166.KL": 1,
  "0097.KL": 1
};

/* =========================
   FORMAT
========================= */

function fmt(n) {
  if (!Number.isFinite(Number(n))) {
    return "—";
  }

  n = Number(n);

  return n > 100
    ? n.toFixed(2)
    : n.toFixed(3);
}

/* =========================
   MARKET API
========================= */

async function candles(symbol, interval = "1d") {

  try {

    const url =
      `/api/market?symbol=${encodeURIComponent(symbol)}` +
      `&range=6mo&interval=${interval}`;

    const r = await fetch(url, {
      cache: "no-store"
    });

    if (!r.ok) {
      console.warn(
        "Market API HTTP error:",
        symbol,
        r.status
      );

      return [];
    }

    const j = await r.json();

    if (
      !j ||
      !j.ok ||
      !Array.isArray(j.candles)
    ) {
      console.warn(
        "Invalid market response:",
        symbol,
        j
      );

      return [];
    }

    return j.candles.filter(x =>

      Number.isFinite(Number(x.close)) &&
      Number.isFinite(Number(x.high)) &&
      Number.isFinite(Number(x.low))

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

/* =========================
   SMA
========================= */

function sma(a, n) {

  if (
    !Array.isArray(a) ||
    a.length < n
  ) {
    return null;
  }

  const values = a
    .slice(-n)
    .map(Number)
    .filter(Number.isFinite);

  if (values.length < n) {
    return null;
  }

  return (
    values.reduce(
      (x, y) => x + y,
      0
    ) / n
  );
}

/* =========================
   ATR
========================= */

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

    tr.push(
      Math.max(
        current.high - current.low,

        Math.abs(
          current.high -
          previous.close
        ),

        Math.abs(
          current.low -
          previous.close
        )
      )
    );
  }

  return sma(tr, n) || 0;
}

/* =========================
   RSI
========================= */

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

    const d =
      c[i].close -
      c[i - 1].close;

    if (d > 0) {
      gains += d;
    } else {
      losses -= d;
    }
  }

  if (losses === 0) {
    return 100;
  }

  const rs =
    gains / losses;

  return (
    100 -
    100 / (1 + rs)
  );
}

/* =========================
   SCORE
========================= */

function score(c) {

  if (
    !Array.isArray(c) ||
    c.length < 20
  ) {
    return 0;
  }

  const closes =
    c.map(x => Number(x.close));

  const last =
    closes.at(-1);

  if (!Number.isFinite(last)) {
    return 0;
  }

  const s20 =
    sma(closes, 20);

  const s50 =
    sma(closes, 50);

  const r =
    rsi(c);

  let x = 50;

  if (s20 !== null) {
    x +=
      last > s20
        ? 10
        : -10;
  }

  if (s50 !== null) {
    x +=
      last > s50
        ? 12
        : -12;
  }

  if (
    s50 !== null &&
    s20 !== null
  ) {

    x +=
      s20 > s50
        ? 8
        : -8;
  }

  x +=
    r > 55
      ? 8
      : r < 45
        ? -8
        : 0;

  const oldIndex =
    Math.max(
      0,
      closes.length - 21
    );

  const old =
    closes[oldIndex];

  if (old > 0) {

    const ret =
      (last / old - 1) * 100;

    x +=
      ret > 0
        ? 10
        : -10;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(x)
    )
  );
}

/* =========================
   TRADING SETUP
========================= */

function setup(c) {

  if (
    !Array.isArray(c) ||
    !c.length
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
      ma50: null
    };
  }

  const p =
    Number(c.at(-1).close);

  const a =
    atr(c) ||
    p * 0.015;

  const closes =
    c.map(x => Number(x.close));

  const ma20 =
    sma(closes, 20);

  const ma50 =
    sma(closes, 50);

  const r =
    rsi(c);

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

  const entry = p;

  let sl = p;
  let tp1 = p;
  let tp2 = p;
  let tp3 = p;

  if (dir === "BUY") {

    sl =
      p - 1.35 * a;

    tp1 =
      p + 1 * a;

    tp2 =
      p + 2 * a;

    tp3 =
      p + 3 * a;
  }

  if (dir === "SELL") {

    sl =
      p + 1.35 * a;

    tp1 =
      p - 1 * a;

    tp2 =
      p - 2 * a;

    tp3 =
      p - 3 * a;
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
    ma50
  };
}

/* =========================
   ANALYZE ONE STOCK
========================= */

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

  return {
    ...x,
    c,
    score: score(c),
    set: setup(c)
  };
}

/* =========================
   ANALYZE ALL
========================= */

async function analyzeAll(list) {

  const results = [];

  for (
    let i = 0;
    i < list.length;
    i += 5
  ) {

    const batch =
      list.slice(i, i + 5);

    const result =
      await Promise.all(
        batch.map(x =>
          analyze(x)
        )
      );

    results.push(
      ...result
    );
  }

  return results;
}

/* =========================
   SECTOR RANKING
========================= */

function sectorsFromResults(results) {

  const map = {};

  results.forEach(x => {

    const sector =
      x[2];

    if (!map[sector]) {
      map[sector] = [];
    }

    if (
      Number.isFinite(x.score)
    ) {
      map[sector].push(
        x.score
      );
    }
  });

  return Object.entries(map)

    .map(
      ([name, values]) => ({

        name,

        score:
          values.length
            ? Math.round(
                values.reduce(
                  (a, b) => a + b,
                  0
                ) /
                values.length
              )
            : 0
      })
    )

    .sort(
      (a, b) =>
        b.score - a.score
    );
}

/* =========================
   RENDER SECTORS
========================= */

function renderSectors(
  id,
  arr
) {

  const el =
    $(id);

  if (!el) {
    return;
  }

  if (!arr.length) {

    el.innerHTML =
      `<div class="muted">
        No sector data.
      </div>`;

    return;
  }

  el.innerHTML =
    arr.map(
      (x, i) => `

      <div class="sector">

        <b>#${i + 1}</b>

        <span>

          ${x.name}

          <div class="bar">
            <i
              style="width:${x.score}%"
            ></i>
          </div>

        </span>

        <b>${x.score}</b>

      </div>

    `
    ).join("");
}

/* =========================
   MAIN RENDER
========================= */

async function render() {

  if (rendering) {
    return;
  }

  rendering = true;

  try {

    const stamp =
      $("#stamp");

    if (stamp) {

      stamp.textContent =
        "Loading " +
        mode +
        " · " +
        new Date()
          .toLocaleTimeString();
    }

    const list =
      mode === "US"
        ? us
        : my;

    const ranked =
      await analyzeAll(list);

    ranked.sort(
      (a, b) =>
        b.score - a.score
    );

    const sectors =
      sectorsFromResults(
        ranked
      );

    /* Sector ranking */

    renderSectors(
      mode === "US"
        ? "#usSectors"
        : "#mySectors",
      sectors
    );

    /* Market mood */

    if (mode === "US") {

      if ($("#usMood")) {

        $("#usMood").textContent =
          sectors[0]?.name ||
          "—";
      }

    } else {

      if ($("#myMood")) {

        $("#myMood").textContent =
          sectors[0]?.name ||
          "—";
      }
    }

    /* Focus counters */

    const focus =
      ranked.slice(0, 12);

    const focusEl =
      $("#focus");

    if (focusEl) {

      if (!focus.length) {

        focusEl.innerHTML =
          `<div class="muted">
            No market data available.
          </div>`;

      } else {

        focusEl.innerHTML =
          focus.map(
            (x, i) => `

            <div
              class="focusrow"
              data-symbol="${x[0]}"
            >

              <b>
                #${i + 1}
              </b>

              <div>

                <b>
                  ${x[0]}
                </b>

                <div class="muted">
                  ${x[1]}
                  ·
                  ${x[2]}
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

          `
          ).join("");
      }
    }

    /* Counter click */

    document
      .querySelectorAll(
        ".focusrow"
      )
      .forEach(el => {

        el.onclick = () => {

          const symbol =
            el.dataset.symbol;

          const item =
            ranked.find(
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

    /* Open highest ranked */

    if (focus[0]) {

      await openCounter(
        focus[0][0],
        focus[0]
      );
    }

    if (stamp) {

      stamp.textContent =
        "Updated " +
        new Date()
          .toLocaleString();
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

/* =========================
   COUNTER DETAIL
========================= */

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

    /* Header */

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

    /* Shariah */

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

    /* Trade box */

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
          `${fmt(s.tp1)} / ${fmt(s.tp2)} / ${fmt(s.tp3)}`
        ],

        [
          "Stop loss",
          fmt(s.sl)
        ],

        [
          "Risk/Reward",
          s.dir === "WAIT"
            ? "—"
            : "~1:1.0 / 1:1.5 / 1:2.2"
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

    /* Technical */

    if ($("#technical")) {

      $("#technical").innerHTML = `

        <div class="analysis">

          <div class="line">
            <span>Trend</span>
            <b>${s.dir}</b>
          </div>

          <div class="line">
            <span>RSI(14)</span>
            <b>
              ${Number(s.rsi).toFixed(1)}
            </b>
          </div>

          <div class="line">
            <span>MA20</span>
            <b>
              ${fmt(s.ma20)}
            </b>
          </div>

          <div class="line">
            <span>MA50</span>
            <b>
              ${fmt(s.ma50)}
            </b>
          </div>

          <div class="line">
            <span>ATR(14)</span>
            <b>
              ${fmt(s.atr)}
            </b>
          </div>

          <div class="line">
            <span>Method</span>
            <b>
              Trend + Momentum + ATR
            </b>
          </div>

        </div>

      `;
    }

    /* Fundamental / health */

    const latest =
      c.at(-1)?.close || 0;

    const base =
      c
        .slice(-20)
        .map(z => z.close);

    const growth =
      base.length > 1 &&
      base[0]

        ? (
            latest /
            base[0] -
            1
          ) * 100

        : 0;

    if ($("#fundamental")) {

      $("#fundamental").innerHTML = `

        <div class="analysis">

          <div class="line">
            <span>Price</span>
            <b>
              ${fmt(latest)}
            </b>
          </div>

          <div class="line">
            <span>20-session return</span>
            <b>
              ${growth.toFixed(2)}%
            </b>
          </div>

          <div class="line">
            <span>Company health</span>

            <b>

              ${
                x.score >= 70
                  ? "STRONG"
                  : x.score >= 55
                    ? "WATCH"
                    : "WEAK"
              }

            </b>

          </div>

          <div class="line">
            <span>Data coverage</span>
            <b>
              Yahoo Market Data
            </b>
          </div>

          <div class="line">
            <span>Decision</span>

            <b>

              ${
                x.score >= 70
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

    /* Chart */

    draw(
      c,
      symbol
    );

    /* Company documents */

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
          "Company API HTTP " +
          r.status
        );
      }

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

                ${d.type}
                ·
                ${d.date || ""}

              </a>

            `
            )
            .join("")

          ||

          "<span class='muted'>" +
          "No documents returned." +
          "</span>";
      }

    } catch (e) {

      console.warn(
        "Company API failed:",
        symbol,
        e
      );

      if ($("#docs")) {

        $("#docs").innerHTML =
          "<span class='muted'>" +
          "Company data unavailable." +
          "</span>";
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

/* =========================
   CHART
========================= */

function draw(
  c,
  symbol
) {

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
    data.map(
      x =>
        new Date(
          x.time
        ).toLocaleDateString()
    );

  const prices =
    data.map(
      x =>
        x.close
    );

  chart =
    new Chart(
      $("#chart"),
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

/* =========================
   MARKET TABS
========================= */

document
  .querySelectorAll(".tab")
  .forEach(button => {

    button.onclick =
      async () => {

        document
          .querySelectorAll(".tab")
          .forEach(
            z =>
              z.classList.remove(
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
  });

/* =========================
   REFRESH
========================= */

if ($("#refresh")) {

  $("#refresh").onclick =
    render;
}

/* =========================
   START
========================= */

render();
