const $ = s => document.querySelector(s);

let mode = "US";
let chart = null;
let selected = null;
let rendering = false;

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
"/api/radar?market=${encodeURIComponent(market)}",
{
cache: "no-store"
}
);

if (!r.ok) {
  throw new Error(`Radar HTTP ${r.status}`);
}

const j = await r.json();

if (!j?.ok || !Array.isArray(j.candidates)) {
  throw new Error("Invalid radar response");
}

return j.candidates;

} catch (e) {

console.error("Radar API:", e);

return [];

}
}

/* =========================================================
MARKET CANDLES
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

const a = values.slice(-n);

if (
a.some(v =>
!Number.isFinite(Number(v))
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

function momentum(
c,
period = 20
) {

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

function volumeStrength(
c,
n = 20
) {

if (
!c ||
c.length < n + 1
) {
return 0;
}

const volumes =
c
.slice(-(n + 1), -1)
.map(x =>
Number(x.volume)
)
.filter(Number.isFinite);

const latest =
Number(
c.at(-1).volume
);

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
c.map(x =>
Number(x.close)
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

/* TREND */

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
}

else if (
r >= 45 &&
r < 55
) {
score += 2;
}

else if (r < 40) {
score -= 7;
}

else if (r > 75) {
score -= 4;
}

/* MOMENTUM */

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

/* VOLUME */

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
c.map(x =>
Number(x.close)
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
  entry - risk * 1.35;

tp1 =
  entry + risk;

tp2 =
  entry + risk * 2;

tp3 =
  entry + risk * 3;

}

if (dir === "SELL") {

sl =
  entry + risk * 1.35;

tp1 =
  entry - risk;

tp2 =
  entry - risk * 2;

tp3 =
  entry - risk * 3;

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
RADAR → TECHNICAL ANALYSIS
========================================================= */

async function analyze(item) {

const symbol =
item.symbol;

const c =
await candles(symbol);

if (!c.length) {

return {
  ...item,
  c: [],
  score: 0,
  set: setup([])
};

}

const set =
setup(c);

return {
...item,
c,
score: technicalScore(c),
set
};
}

async function analyzeAll(list) {

const results = [];

/*
Limit kepada 12 counter
untuk elak terlalu banyak
request ke market API.
*/

const sorted =
[...list]
.sort(
(a, b) =>
Math.abs(
Number(b.change || 0)
) -
Math.abs(
Number(a.change || 0)
)
)
.slice(0, 12);

for (
let i = 0;
i < sorted.length;
i += 4
) {

const batch =
  sorted.slice(
    i,
    i + 4
  );

const rows =
  await Promise.all(
    batch.map(analyze)
  );

results.push(
  ...rows
);

}

return results;
}

/* =========================================================
SECTOR DETECTION
========================================================= */

function sectorName(symbol, name) {

const s =
String(symbol)
.toUpperCase();

const n =
String(name || "")
.toLowerCase();

if (
/NVDA|AMD|AVGO|TSM|MU|INTC|ASML|QCOM|AMAT|LRCX/
.test(s)
)
return "Semiconductors";

if (
/AAPL|MSFT|ORCL|CRM|ADBE|IBM|PLTR/
.test(s)
)
return "Technology";

if (
/GOOGL|META|AMZN|NFLX/
.test(s)
)
return "Internet & Media";

if (
/TSLA/
.test(s)
)
return "Automobiles";

if (
/LLY|UNH/
.test(s)
)
return "Healthcare";

if (
/XOM|CVX/
.test(s)
)
return "Energy";

if (
/JPM|BAC|V|MA|COIN/
.test(s)
)
return "Financial Services";

if (
/WMT|COST/
.test(s)
)
return "Retail";

if (
/CAT|GE|RTX|LIN/
.test(s)
)
return "Industrials";

if (
/UBER/
.test(s)
)
return "Transport";

if (s.endsWith(".KL")) {

if (
  /BANK|CIMB|MAYBANK|PUBLIC BANK|HONG LEONG/
    .test(n)
)
  return "Banks";

if (
  /TELCO|MAXIS|CELCOM|TELEKOM/
    .test(n)
)
  return "Telecommunications";

if (
  /POWER|UTILITY|GAS/
    .test(n)
)
  return "Utilities";

if (
  /GAMUDA|IJM|SUNWAY/
    .test(n)
)
  return "Construction";

if (
  /PLANTATION|IOI|SIME|KLK/
    .test(n)
)
  return "Plantation";

if (
  /PETRONAS|DIALOG|MISC/
    .test(n)
)
  return "Oil & Gas";

if (
  /IHH|HEALTH|KOSSAN|TOP GLOVE|HARTALEGA/
    .test(n)
)
  return "Healthcare";

if (
  /FRONTKEN|GREATECH/
    .test(n)
)
  return "Semiconductors";

if (
  /NESTLE|QL|PPB/
    .test(n)
)
  return "Consumer";

return "Other";

}

return "Other";
}

/* =========================================================
SECTOR RANKING
========================================================= */

function sectorRanking(results) {

const groups = {};

for (
const x of results
) {

const sector =
  sectorName(
    x.symbol,
    x.name
  );

if (!groups[sector]) {

  groups[sector] = [];
}

if (x.score > 0) {

  groups[sector]
    .push(x.score);
}

}

return Object.entries(
groups
)
.map(
([name, values]) => ({

    name,

    score:
      values.length
        ? Math.round(
            values.reduce(
              (a, b) =>
                a + b,
              0
            ) /
            values.length
          )
        : 0,

    count:
      values.length
  })
)
.sort(
  (a, b) =>
    b.score -
    a.score
);

}

/* =========================================================
RENDER SECTORS
========================================================= */

function renderSectors(
id,
sectors
) {

const el =
$(id);

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
FOCUS RANKING
========================================================= */

function focusRanking(
results
) {

return results

.filter(
  x =>
    x.c?.length
)

.sort(
  (a, b) => {

    let sa =
      Number(a.score || 0);

    let sb =
      Number(b.score || 0);

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

    const am =
      Math.abs(
        a.set.momentum || 0
      );

    const bm =
      Math.abs(
        b.set.momentum || 0
      );

    sa +=
      Math.min(am, 10);

    sb +=
      Math.min(bm, 10);

    return sb - sa;
  }
)

.slice(0, 12);

}

/* =========================================================
RENDER FOCUS
========================================================= */

function renderFocus(
focus
) {

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

      return `

        <div
          class="focusrow"
          data-symbol="${x.symbol}"
        >

          <b>
            #${i + 1}
          </b>

          <div>

            <b>
              ${x.symbol}
            </b>

            <div class="muted">

              ${x.name || x.symbol}
              ·
              ${sectorName(
                x.symbol,
                x.name
              )}

            </div>

          </div>

          <span>
            ${x.score}
          </span>

          <span class="${cls}">
            ${x.set.dir}
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
          x.symbol === symbol
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

  $("#stamp")
    .textContent =
      `Scanning ${mode} radar…`;
}

/*
  1. Ambil candidate daripada radar
*/

const candidates =
  await radar(mode);

if (!candidates.length) {

  throw new Error(
    "Radar returned no candidates"
  );
}

/*
  2. Technical analysis
*/

const ranked =
  await analyzeAll(
    candidates
  );

/*
  3. Sector ranking
*/

const sectors =
  sectorRanking(
    ranked
  );

renderSectors(
  mode === "US"
    ? "#usSectors"
    : "#mySectors",
  sectors
);

/*
  4. Market mood
*/

if (mode === "US") {

  if ($("#usMood")) {

    $("#usMood")
      .textContent =
        sectors[0]?.name ||
        "—";
  }

} else {

  if ($("#myMood")) {

    $("#myMood")
      .textContent =
        sectors[0]?.name ||
        "—";
  }
}

/*
  5. Focus counters
*/

const focus =
  focusRanking(
    ranked
  );

renderFocus(
  focus
);

/*
  6. Auto open top counter
*/

if (focus[0]) {

  await openCounter(
    focus[0].symbol,
    focus[0]
  );
}

if ($("#stamp")) {

  $("#stamp")
    .textContent =
      `Updated ${new Date().toLocaleString()}`;
}

} catch (e) {

console.error(
  "Radar render:",
  e
);

if ($("#stamp")) {

  $("#stamp")
    .textContent =
      "Market data error";
}

} finally {

rendering = false;

}
}

/* =========================================================
COUNTER DETAIL
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
    : await candles(
        symbol
      );

if (!c.length) {

  if ($("#dName")) {

    $("#dName")
      .textContent =
        `${symbol} · NO DATA`;
  }

  return;
}

const s =
  setup(c);

if ($("#dMarket")) {

  $("#dMarket")
    .textContent =
      mode === "US"
        ? "US EQUITY"
        : "BURSA MALAYSIA";
}

if ($("#dName")) {

  $("#dName")
    .textContent =
      `${symbol} · ${x.name || symbol}`;
}

if ($("#dShariah")) {

  $("#dShariah")
    .textContent =
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

  $("#tradeBox")
    .innerHTML = [

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
          : `${fmt(s.tp1)} / ${fmt(s.tp2)} / ${fmt(s.tp3)}`
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

/* TECHNICAL */

if ($("#technical")) {

  $("#technical")
    .innerHTML = `

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
          <span>Method</span>
          <b>
            Trend + Momentum + Volume + ATR
          </b>
        </div>

      </div>
    `;
}

/* FUNDAMENTAL */

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

if ($("#fundamental")) {

  $("#fundamental")
    .innerHTML = `

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
          <span>Radar change</span>
          <b>
            ${Number(x.change || 0).toFixed(2)}%
          </b>
        </div>

        <div class="line">
          <span>Market data</span>
          <b>Yahoo Finance</b>
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

draw(
  c,
  symbol
);

/* COMPANY DOCUMENTS */

try {

  const r =
    await fetch(
      `/api/company?symbol=${encodeURIComponent(symbol)}`,
      {
        cache: "no-store"
      }
    );

  if (!r.ok)
    throw new Error(
      "Company API"
    );

  const j =
    await r.json();

  if ($("#docs")) {

    $("#docs")
      .innerHTML =
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

        "<span class='muted'>No documents returned.</span>";
  }

} catch {

  if ($("#docs")) {

    $("#docs")
      .innerHTML =
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

if (!canvas)
return;

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
            x.classList
              .remove(
                "active"
              )
        );

      button.classList
        .add(
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
