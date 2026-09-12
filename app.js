const $ = s => document.querySelector(s);

let mode = "US";
let chart = null;
let selected = null;
let rendering = false;

function fmt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v > 100 ? v.toFixed(2) : v.toFixed(3);
}

function fmtPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function signalClass(signal) {
  if (signal === "BUY") return "up";
  if (signal === "SELL") return "down";
  return "";
}

async function getRadar(market) {
  try {
    const r = await fetch(
      `/api/radar?market=${encodeURIComponent(market)}`,
      { cache: "no-store" }
    );

    if (!r.ok) {
      throw new Error(`Radar HTTP ${r.status}`);
    }

    const j = await r.json();

    if (!j || !j.ok) {
      throw new Error("Radar returned invalid data");
    }

    return j;
  } catch (e) {
    console.error("Radar error:", market, e);
    return null;
  }
}

async function getCandles(symbol) {
  try {
    const r = await fetch(
      `/api/market?symbol=${encodeURIComponent(symbol)}&range=6mo&interval=1d`,
      { cache: "no-store" }
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
    console.warn("Market data error:", symbol, e);
    return [];
  }
}

function renderSectors(id, sectors) {
  const el = $(id);

  if (!el) return;

  if (!Array.isArray(sectors) || !sectors.length) {
    el.innerHTML =
      `<div class="muted">No sector data.</div>`;
    return;
  }

  el.innerHTML = sectors.map(x => `
    <div class="sector">
      <b>#${x.rank}</b>

      <span>
        ${x.sector}

        <div class="bar">
          <i style="width:${Math.max(
            0,
            Math.min(100, Number(x.score) || 0)
          )}%"></i>
        </div>
      </span>

      <b>${x.score}</b>
    </div>
  `).join("");
}

function renderFocus(focus) {
  const el = $("#focus");

  if (!el) return;

  if (!Array.isArray(focus) || !focus.length) {
    el.innerHTML =
      `<div class="muted">No market data available.</div>`;
    return;
  }

  el.innerHTML = focus.map(x => `
    <div
      class="focusrow"
      data-symbol="${x.symbol}"
    >

      <b>#${x.rank}</b>

      <div>
        <b>${x.symbol}</b>

        <div class="muted">
          ${x.name} · ${x.sector}
        </div>
      </div>

      <span>
        ${x.score}
      </span>

      <span class="${signalClass(x.signal)}">
        ${x.signal}
      </span>

      <span class="hideM">
        ${fmt(x.entry)}
      </span>

      <span class="hideM">
        ${fmt(x.sl)}
      </span>

    </div>
  `).join("");

  document
    .querySelectorAll(".focusrow")
    .forEach(row => {

      row.onclick = async () => {

        const symbol =
          row.dataset.symbol;

        const item =
          focus.find(x =>
            x.symbol === symbol
          );

        if (item) {
          await openCounter(item);
        }
      };
    });
}

async function openCounter(x) {
  if (!x) return;

  selected = x;

  const symbol = x.symbol;

  const c = await getCandles(symbol);

  if ($("#dMarket")) {
    $("#dMarket").textContent =
      mode === "US"
        ? "US EQUITY"
        : "BURSA MALAYSIA";
  }

  if ($("#dName")) {
    $("#dName").textContent =
      `${x.symbol} · ${x.name}`;
  }

  if ($("#dShariah")) {
    if (mode === "MY") {
      $("#dShariah").textContent =
        "SHARIAH: CHECK SC LIST";
    } else {
      $("#dShariah").textContent =
        "US: CHECK SCREEN";
    }
  }

  if ($("#tradeBox")) {

    $("#tradeBox").innerHTML = [

      ["Signal", x.signal],

      ["Entry", fmt(x.entry)],

      [
        "TP1 / TP2 / TP3",
        `${fmt(x.tp1)} / ${fmt(x.tp2)} / ${fmt(x.tp3)}`
      ],

      ["Stop loss", fmt(x.sl)],

      [
        "Risk/Reward",
        x.signal === "BUY" ||
        x.signal === "SELL"
          ? "1:1 / 1:1.5 / 1:2.2"
          : "—"
      ]

    ].map(a => `
      <div class="metric">
        <small>${a[0]}</small>
        <b>${a[1]}</b>
      </div>
    `).join("");
  }

  if ($("#technical")) {

    $("#technical").innerHTML = `

      <div class="analysis">

        <div class="line">
          <span>Signal</span>
          <b>${x.signal}</b>
        </div>

        <div class="line">
          <span>Radar Score</span>
          <b>${x.score}/100</b>
        </div>

        <div class="line">
          <span>Price</span>
          <b>${fmt(x.price)}</b>
        </div>

        <div class="line">
          <span>RSI(14)</span>
          <b>${fmt(x.rsi)}</b>
        </div>

        <div class="line">
          <span>MA20</span>
          <b>${fmt(x.ma20)}</b>
        </div>

        <div class="line">
          <span>MA50</span>
          <b>${fmt(x.ma50)}</b>
        </div>

        <div class="line">
          <span>ATR(14)</span>
          <b>${fmt(x.atr)}</b>
        </div>

        <div class="line">
          <span>20-session momentum</span>
          <b>${fmtPct(x.return20)}</b>
        </div>

        <div class="line">
          <span>Sector</span>
          <b>${x.sector}</b>
        </div>

      </div>
    `;
  }

  if ($("#fundamental")) {

    const health =
      Number(x.score) >= 70
        ? "STRONG"
        : Number(x.score) >= 55
          ? "WATCH"
          : "WEAK";

    const decision =
      Number(x.score) >= 70
        ? "FOCUS"
        : Number(x.score) >= 55
          ? "MONITOR"
          : "AVOID FOR NOW";

    $("#fundamental").innerHTML = `

      <div class="analysis">

        <div class="line">
          <span>Company</span>
          <b>${x.name}</b>
        </div>

        <div class="line">
          <span>Sector</span>
          <b>${x.sector}</b>
        </div>

        <div class="line">
          <span>20-session return</span>
          <b>${fmtPct(x.return20)}</b>
        </div>

        <div class="line">
          <span>Market score</span>
          <b>${x.score}/100</b>
        </div>

        <div class="line">
          <span>Company health</span>
          <b>${health}</b>
        </div>

        <div class="line">
          <span>Decision</span>
          <b>${decision}</b>
        </div>

        <div class="line">
          <span>Data source</span>
          <b>Yahoo Market Data</b>
        </div>

      </div>
    `;
  }

  draw(c, symbol);

  await loadDocuments(symbol);
}

async function loadDocuments(symbol) {

  if (!$("#docs")) return;

  $("#docs").innerHTML =
    "<span class='muted'>Loading documents...</span>";

  try {

    const r = await fetch(
      `/api/company?symbol=${encodeURIComponent(symbol)}`,
      { cache: "no-store" }
    );

    if (!r.ok) {
      throw new Error("Company API failed");
    }

    const j = await r.json();

    const docs =
      Array.isArray(j.documents)
        ? j.documents
        : [];

    $("#docs").innerHTML =
      docs.map(d => `

        <a
          target="_blank"
          rel="noopener"
          href="${d.url}"
        >
          ${d.type || "Document"}
          ${d.date ? ` · ${d.date}` : ""}
        </a>

      `).join("")
      ||
      "<span class='muted'>No documents returned.</span>";

  } catch (e) {

    console.warn(
      "Company data unavailable:",
      symbol,
      e
    );

    $("#docs").innerHTML =
      "<span class='muted'>Company data unavailable.</span>";
  }
}

function draw(c, symbol) {

  if (!$("#chart")) return;

  if (chart) {
    chart.destroy();
    chart = null;
  }

  if (!Array.isArray(c) || !c.length) {
    return;
  }

  const data = c.slice(-80);

  const labels = data.map(x =>
    new Date(x.time).toLocaleDateString()
  );

  const prices = data.map(x =>
    Number(x.close)
  );

  chart = new Chart(
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

async function render() {

  if (rendering) return;

  rendering = true;

  try {

    if ($("#stamp")) {
      $("#stamp").textContent =
        `Loading ${mode} radar...`;
    }

    const radar =
      await getRadar(mode);

    if (!radar) {

      if ($("#stamp")) {
        $("#stamp").textContent =
          `${mode} radar unavailable`;
      }

      return;
    }

    // -------------------------
    // MARKET MOOD
    // -------------------------

    const sectors =
      Array.isArray(radar.sectors)
        ? radar.sectors
        : [];

    if (mode === "US") {

      if ($("#usMood")) {
        $("#usMood").textContent =
          sectors[0]?.sector || "—";
      }

    } else {

      if ($("#myMood")) {
        $("#myMood").textContent =
          sectors[0]?.sector || "—";
      }
    }

    // -------------------------
    // SECTOR RANKING
    // -------------------------

    if (mode === "US") {

      renderSectors(
        "#usSectors",
        sectors
      );

    } else {

      renderSectors(
        "#mySectors",
        sectors
      );
    }

    // -------------------------
    // FOCUS COUNTERS
    // -------------------------

    const focus =
      Array.isArray(radar.focus)
        ? radar.focus
        : [];

    renderFocus(focus);

    // -------------------------
    // FIRST COUNTER
    // -------------------------

    if (focus.length) {

      await openCounter(
        focus[0]
      );

    } else {

      if ($("#dName")) {
        $("#dName").textContent =
          "No qualifying counters";
      }

      if ($("#tradeBox")) {
        $("#tradeBox").innerHTML =
          "<div class='muted'>No market setup.</div>";
      }
    }

    if ($("#stamp")) {

      $("#stamp").textContent =
        `${mode} · ` +
        `${radar.countersWithData || 0}/` +
        `${radar.totalCounters || 0} counters · ` +
        `Market Score ${radar.marketScore ?? "—"} · ` +
        `Updated ${new Date(
          radar.updated || Date.now()
        ).toLocaleString()}`;
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

// -------------------------
// MARKET TABS
// -------------------------

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
        button.dataset.m === "MY"
          ? "MY"
          : "US";

      await render();
    };
  });

// -------------------------
// REFRESH
// -------------------------

if ($("#refresh")) {
  $("#refresh").onclick = render;
}

// -------------------------
// INITIAL LOAD
// -------------------------

render();
