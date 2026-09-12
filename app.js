const $ = s => document.querySelector(s);

let mode = "US";
let chart = null;
let selected = null;
let rendering = false;

const us = [
  ["NVDA","NVIDIA","Semiconductors"],["AMD","AMD","Semiconductors"],
  ["AVGO","Broadcom","Semiconductors"],["TSM","TSMC","Semiconductors"],
  ["MU","Micron","Semiconductors"],["AAPL","Apple","Technology Hardware"],
  ["MSFT","Microsoft","Software"],["GOOGL","Alphabet","Internet"],
  ["AMZN","Amazon","Internet"],["META","Meta","Internet"],
  ["ORCL","Oracle","Software"],["CRM","Salesforce","Software"],
  ["PLTR","Palantir","Software"],["NFLX","Netflix","Media"],
  ["TSLA","Tesla","Automobiles"],["LLY","Eli Lilly","Pharmaceuticals"],
  ["UNH","UnitedHealth","Healthcare"],["XOM","Exxon Mobil","Energy"],
  ["CVX","Chevron","Energy"],["JPM","JPMorgan","Banks"],
  ["BAC","Bank of America","Banks"],["V","Visa","Financial Services"],
  ["MA","Mastercard","Financial Services"],["WMT","Walmart","Retail"],
  ["COST","Costco","Retail"],["CAT","Caterpillar","Industrials"],
  ["GE","GE Aerospace","Industrials"],["RTX","RTX","Aerospace & Defense"],
  ["LIN","Linde","Chemicals"],["ADBE","Adobe","Software"],
  ["INTC","Intel","Semiconductors"],["IBM","IBM","IT Services"],
  ["UBER","Uber","Transport"],["COIN","Coinbase","Financial Services"],
  ["CRWD","CrowdStrike","Cybersecurity"]
];

const my = [
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

function fmt(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return "—";
  return n >= 100 ? n.toFixed(2) : n.toFixed(3);
}

async function candles(symbol, interval = "1d") {
  try {
    const url =
      `/api/market?symbol=${encodeURIComponent(symbol)}` +
      `&range=6mo&interval=${interval}`;

    const r = await fetch(url, { cache:"no-store" });

    if (!r.ok) return [];

    const j = await r.json();

    if (!j?.ok || !Array.isArray(j.candles)) return [];

    return j.candles.filter(x =>
      Number.isFinite(Number(x.open)) &&
      Number.isFinite(Number(x.high)) &&
      Number.isFinite(Number(x.low)) &&
      Number.isFinite(Number(x.close)) &&
      Number.isFinite(Number(x.volume))
    );

  } catch(e) {
    console.warn("Market error:", symbol, e);
    return [];
  }
}

/* =========================
   TECHNICAL ENGINE
========================= */

function sma(values, n) {
  if (!values || values.length < n) return null;

  const a = values.slice(-n);

  return a.reduce((x,y) => x + y, 0) / n;
}

function ema(values, n) {
  if (!values || values.length < n) return null;

  const k = 2 / (n + 1);
  let e = values.slice(0,n)
    .reduce((a,b) => a+b,0) / n;

  for(let i=n;i<values.length;i++) {
    e = values[i] * k + e * (1-k);
  }

  return e;
}

function atr(c,n=14) {
  if(!c || c.length < n+1) return 0;

  const tr=[];

  for(let i=1;i<c.length;i++) {

    const h=Number(c[i].high);
    const l=Number(c[i].low);
    const pc=Number(c[i-1].close);

    tr.push(
      Math.max(
        h-l,
        Math.abs(h-pc),
        Math.abs(l-pc)
      )
    );
  }

  return sma(tr,n) || 0;
}

function rsi(c,n=14) {
  if(!c || c.length < n+1) return 50;

  let gain=0;
  let loss=0;

  for(let i=c.length-n;i<c.length;i++) {

    const d =
      Number(c[i].close) -
      Number(c[i-1].close);

    if(d>0) gain+=d;
    else loss-=d;
  }

  if(loss===0) return 100;

  const rs=gain/loss;

  return 100-(100/(1+rs));
}

function volumeRatio(c) {
  if(!c || c.length < 21) return 1;

  const current=Number(c.at(-1).volume);

  const avg=sma(
    c.slice(0,-1).map(x=>Number(x.volume)),
    20
  );

  if(!avg) return 1;

  return current/avg;
}

function momentum(c,n=20) {
  if(!c || c.length<n+1) return 0;

  const now=Number(c.at(-1).close);
  const old=Number(c.at(-1-n).close);

  if(!old) return 0;

  return ((now/old)-1)*100;
}

/* =========================
   MARKET SCORE
========================= */

function analyzeSetup(c) {

  if(!c || c.length<30) {

    return {
      dir:"WAIT",
      score:0,
      entry:null,
      sl:null,
      tp1:null,
      tp2:null,
      tp3:null,
      atr:0,
      rsi:50,
      ma20:null,
      ma50:null,
      ema20:null,
      volumeRatio:1,
      momentum:0,
      breakout:false
    };
  }

  const closes=c.map(x=>Number(x.close));

  const p=closes.at(-1);

  const ma20=sma(closes,20);
  const ma50=sma(closes,50);

  const ema20=ema(closes,20);

  const a=atr(c,14);

  const r=rsi(c,14);

  const vr=volumeRatio(c);

  const mom=momentum(c,20);

  const recentHigh=Math.max(
    ...c.slice(-21,-1).map(x=>Number(x.high))
  );

  const recentLow=Math.min(
    ...c.slice(-21,-1).map(x=>Number(x.low))
  );

  const breakoutUp=p>recentHigh;

  const breakoutDown=p<recentLow;

  let score=50;

  /* trend */

  if(ma20 && p>ma20) score+=8;
  else score-=8;

  if(ma50 && p>ma50) score+=10;
  else score-=10;

  if(ma20 && ma50 && ma20>ma50) score+=8;
  else score-=8;

  /* RSI */

  if(r>=55 && r<=70) score+=8;
  else if(r>=45 && r<55) score+=2;
  else if(r<45) score-=8;

  /* momentum */

  if(mom>0) score+=8;
  else score-=8;

  /* volume */

  if(vr>=1.5) score+=7;
  else if(vr>=1.15) score+=3;

  /* breakout */

  if(breakoutUp) score+=10;
  if(breakoutDown) score-=10;

  score=Math.max(
    0,
    Math.min(100,Math.round(score))
  );

  let dir="WAIT";

  if(
    p>ma20 &&
    ma20>ma50 &&
    r>=52 &&
    mom>0
  ) {
    dir="BUY";
  }

  if(
    p<ma20 &&
    ma20<ma50 &&
    r<=48 &&
    mom<0
  ) {
    dir="SELL";
  }

  const entry=p;

  let sl=null;
  let tp1=null;
  let tp2=null;
  let tp3=null;

  if(dir==="BUY") {

    sl=p-(1.35*a);
    tp1=p+(1*a);
    tp2=p+(2*a);
    tp3=p+(3*a);

  }

  if(dir==="SELL") {

    sl=p+(1.35*a);
    tp1=p-(1*a);
    tp2=p-(2*a);
    tp3=p-(3*a);

  }

  return {
    dir,
    score,
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    atr:a,
    rsi:r,
    ma20,
    ma50,
    ema20,
    volumeRatio:vr,
    momentum:mom,
    breakout:breakoutUp || breakoutDown
  };
}

async function analyze(x) {

  const c=await candles(x[0]);

  if(!c.length) {

    return {
      ...x,
      c:[],
      set:analyzeSetup([]),
      score:0
    };
  }

  const set=analyzeSetup(c);

  return {
    ...x,
    c,
    set,
    score:set.score
  };
}

async function analyzeAll(list) {

  const results=[];

  for(let i=0;i<list.length;i+=5) {

    const batch=list.slice(i,i+5);

    const r=await Promise.all(
      batch.map(analyze)
    );

    results.push(...r);
  }

  return results;
}

/* =========================
   SECTOR ENGINE
========================= */

function sectorRanking(results) {

  const map={};

  results.forEach(x=>{

    if(!x.c?.length) return;

    const sector=x[2];

    if(!map[sector]) {
      map[sector]=[];
    }

    map[sector].push(x);

  });

  return Object.entries(map)
    .map(([name,items])=>{

      const avg=
        items.reduce(
          (a,b)=>a+b.score,
          0
        )/items.length;

      const buyCount=
        items.filter(
          x=>x.set.dir==="BUY"
        ).length;

      const positiveMomentum=
        items.filter(
          x=>x.set.momentum>0
        ).length;

      return {

        name,

        score:Math.round(avg),

        buyCount,

        momentumRatio:
          positiveMomentum/items.length,

        count:items.length
      };

    })
    .sort((a,b)=>{

      if(b.score!==a.score)
        return b.score-a.score;

      return b.momentumRatio-a.momentumRatio;

    });
}

function renderSectors(id,arr) {

  const el=$(id);

  if(!el) return;

  if(!arr.length) {

    el.innerHTML=
      `<div class="muted">No sector data.</div>`;

    return;
  }

  el.innerHTML=arr
    .map((x,i)=>`

      <div class="sector">

        <b>#${i+1}</b>

        <span>

          ${x.name}

          <div class="bar">
            <i style="width:${x.score}%"></i>
          </div>

        </span>

        <b>${x.score}</b>

      </div>

    `)
    .join("");
}

/* =========================
   COUNTER RANKING
========================= */

function counterRank(a,b) {

  const scoreA=
    a.score +
    (a.set.breakout ? 8 : 0) +
    (a.set.volumeRatio>=1.5 ? 6 : 0);

  const scoreB=
    b.score +
    (b.set.breakout ? 8 : 0) +
    (b.set.volumeRatio>=1.5 ? 6 : 0);

  return scoreB-scoreA;
}

/* =========================
   MAIN RENDER
========================= */

async function render() {

  if(rendering) return;

  rendering=true;

  try {

    if($("#stamp")) {

      $("#stamp").textContent=
        `Scanning ${mode} market...`;
    }

    const list=
      mode==="US"
        ? us
        : my;

    const ranked=
      await analyzeAll(list);

    ranked.sort(counterRank);

    const sectors=
      sectorRanking(ranked);

    if(mode==="US") {

      renderSectors(
        "#usSectors",
        sectors
      );

      if($("#usMood")) {

        $("#usMood").textContent=
          sectors[0]?.name || "—";
      }

    } else {

      renderSectors(
        "#mySectors",
        sectors
      );

      if($("#myMood")) {

        $("#myMood").textContent=
          sectors[0]?.name || "—";
      }
    }

    /* focus only stocks with usable data */

    const focus=
      ranked
        .filter(x=>x.c?.length)
        .slice(0,12);

    const focusEl=$("#focus");

    if(focusEl) {

      focusEl.innerHTML=

        focus.map((x,i)=>`

          <div
            class="focusrow"
            data-symbol="${x[0]}"
          >

            <b>#${i+1}</b>

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
              x.set.dir==="BUY"
                ? "up"
                : x.set.dir==="SELL"
                  ? "down"
                  : ""
            }">

              ${x.set.dir}

            </span>

            <span class="hideM">

              ${
                x.set.entry!=null
                  ? fmt(x.set.entry)
                  : "—"
              }

            </span>

            <span class="hideM">

              ${
                x.set.sl!=null
                  ? fmt(x.set.sl)
                  : "—"
              }

            </span>

          </div>

        `).join("");

    }

    document
      .querySelectorAll(".focusrow")
      .forEach(el=>{

        el.onclick=()=>{

          const symbol=
            el.dataset.symbol;

          const item=
            ranked.find(
              x=>x[0]===symbol
            );

          if(item)
            openCounter(symbol,item);

        };

      });

    if(focus[0]) {

      await openCounter(
        focus[0][0],
        focus[0]
      );

    }

    if($("#stamp")) {

      $("#stamp").textContent=
        `Updated ${new Date().toLocaleString()}`;

    }

  } catch(e) {

    console.error(
      "Dashboard render error:",
      e
    );

    if($("#stamp")) {

      $("#stamp").textContent=
        "Data error — press Refresh";
    }

  } finally {

    rendering=false;

  }
}

/* =========================
   COUNTER DETAIL
========================= */

async function openCounter(symbol,x) {

  try {

    selected=x;

    const c=
      x.c?.length
        ? x.c
        : await candles(symbol);

    if(!c.length) {

      if($("#dName"))
        $("#dName").textContent=
          `${symbol} · NO DATA`;

      return;
    }

    const s=
      analyzeSetup(c);

    if($("#dMarket"))
      $("#dMarket").textContent=
        mode==="US"
          ? "US EQUITY"
          : "BURSA MALAYSIA";

    if($("#dName"))
      $("#dName").textContent=
        `${x[0]} · ${x[1]}`;

    if($("#dShariah")) {

      $("#dShariah").textContent=

        mode==="MY"

          ? (
              shariahSeed[symbol]
                ? "SHARIAH ✓"
                : "SHARIAH: CHECK SC LIST"
            )

          : "US: CHECK SCREEN";
    }

    if($("#tradeBox")) {

      $("#tradeBox").innerHTML=[

        ["Signal",s.dir],

        ["Score",`${s.score}/100`],

        ["Entry",fmt(s.entry)],

        [
          "TP1 / TP2 / TP3",
          `${fmt(s.tp1)} / ${fmt(s.tp2)} / ${fmt(s.tp3)}`
        ],

        ["Stop loss",fmt(s.sl)],

        [
          "Risk/Reward",
          s.dir==="WAIT"
            ? "—"
            : "ATR based"
        ]

      ]

      .map(a=>`

        <div class="metric">

          <small>${a[0]}</small>

          <b>${a[1]}</b>

        </div>

      `)
      .join("");

    }

    if($("#technical")) {

      $("#technical").innerHTML=`

        <div class="analysis">

          <div class="line">
            <span>Trend</span>
            <b>${s.dir}</b>
          </div>

          <div class="line">
            <span>Score</span>
            <b>${s.score}/100</b>
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
            <span>ATR(14)</span>
            <b>${fmt(s.atr)}</b>
          </div>

          <div class="line">
            <span>20-session momentum</span>
            <b>${s.momentum.toFixed(2)}%</b>
          </div>

          <div class="line">
            <span>Volume vs average</span>
            <b>${s.volumeRatio.toFixed(2)}x</b>
          </div>

          <div class="line">
            <span>Breakout</span>
            <b>${s.breakout ? "YES" : "NO"}</b>
          </div>

          <div class="line">
            <span>Method</span>
            <b>
              Trend + Momentum + Volume + Breakout
            </b>
          </div>

        </div>

      `;
    }

    const latest=
      Number(c.at(-1)?.close)||0;

    const base=
      c.slice(-20)
       .map(z=>Number(z.close));

    const growth=
      base.length>1 && base[0]
        ? ((latest/base[0])-1)*100
        : 0;

    if($("#fundamental")) {

      $("#fundamental").innerHTML=`

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
            <span>Volume ratio</span>
            <b>${s.volumeRatio.toFixed(2)}x</b>
          </div>

          <div class="line">
            <span>Market score</span>
            <b>${x.score}/100</b>
          </div>

          <div class="line">
            <span>Company health</span>
            <b>
              ${
                x.score>=70
                  ? "STRONG"
                  : x.score>=55
                    ? "WATCH"
                    : "WEAK"
              }
            </b>
          </div>

          <div class="line">
            <span>Decision</span>
            <b>
              ${
                x.score>=70
                  ? "FOCUS"
                  : x.score>=55
                    ? "MONITOR"
                    : "AVOID FOR NOW"
              }
            </b>
          </div>

        </div>

      `;
    }

    draw(c,symbol);

    /* company / filing endpoint */

    try {

      const r=
        await fetch(
          `/api/company?symbol=${encodeURIComponent(symbol)}`,
          {cache:"no-store"}
        );

      const j=
        await r.json();

      if($("#docs")) {

        $("#docs").innerHTML=

          (j.documents||[])
            .map(d=>`

              <a
                target="_blank"
                rel="noopener"
                href="${d.url}"
              >
                ${d.type} · ${d.date||""}
              </a>

            `)
            .join("")

          ||

          "<span class='muted'>No documents returned.</span>";
      }

    } catch(e) {

      if($("#docs")) {

        $("#docs").innerHTML=
          "<span class='muted'>Company data unavailable.</span>";
      }

    }

  } catch(e) {

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

function draw(c,symbol) {

  if(!$("#chart")) return;

  if(chart) {

    chart.destroy();
    chart=null;

  }

  const data=
    c.slice(-80);

  const labels=
    data.map(x=>
      new Date(x.time)
        .toLocaleDateString()
    );

  const prices=
    data.map(x=>Number(x.close));

  chart=
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

            tension:.2

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

/* =========================
   TABS
========================= */

document
  .querySelectorAll(".tab")
  .forEach(button=>{

    button.onclick=async()=>{

      document
        .querySelectorAll(".tab")
        .forEach(x=>
          x.classList.remove("active")
        );

      button.classList.add("active");

      mode=
        button.dataset.m || "US";

      await render();

    };

  });

/* =========================
   REFRESH
========================= */

if($("#refresh")) {

  $("#refresh").onclick=render;

}

/* =========================
   START
========================= */

render();
