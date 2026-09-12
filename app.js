const $=s=>document.querySelector(s);
let mode="US", chart=null, selected=null;
const us=[
["NVDA","NVIDIA","Semiconductors"],["AMD","AMD","Semiconductors"],["AVGO","Broadcom","Semiconductors"],["TSM","TSMC","Semiconductors"],["MU","Micron","Semiconductors"],
["AAPL","Apple","Technology Hardware"],["MSFT","Microsoft","Software"],["GOOGL","Alphabet","Internet"],["AMZN","Amazon","Internet"],["META","Meta","Internet"],
["ORCL","Oracle","Software"],["CRM","Salesforce","Software"],["PLTR","Palantir","Software"],["NFLX","Netflix","Media"],["TSLA","Tesla","Automobiles"],
["LLY","Eli Lilly","Pharmaceuticals"],["UNH","UnitedHealth","Healthcare"],["XOM","Exxon Mobil","Energy"],["CVX","Chevron","Energy"],["JPM","JPMorgan","Banks"],
["BAC","Bank of America","Banks"],["V","Visa","Financial Services"],["MA","Mastercard","Financial Services"],["WMT","Walmart","Retail"],["COST","Costco","Retail"],
["CAT","Caterpillar","Industrials"],["GE","GE Aerospace","Industrials"],["RTX","RTX","Aerospace & Defense"],["LIN","Linde","Chemicals"],["ADBE","Adobe","Software"],
["INTC","Intel","Semiconductors"],["IBM","IBM","IT Services"],["UBER","Uber","Transport"],["COIN","Coinbase","Financial Services"],["CRWD","CrowdStrike","Cybersecurity"]
];
const my=[
["1023.KL","CIMB","Banks"],["1155.KL","Maybank","Banks"],["1295.KL","Public Bank","Banks"],["5819.KL","Hong Leong Bank","Banks"],
["4863.KL","Telekom Malaysia","Telecommunications"],["6012.KL","Maxis","Telecommunications"],["6947.KL","CelcomDigi","Telecommunications"],
["3042.KL","Petronas Gas","Utilities"],["7089.KL","YTL Power","Utilities"],["4677.KL","YTL Corp","Utilities"],["5183.KL","Petronas Dagangan","Consumer Fuels"],
["5681.KL","Petronas Chemicals","Chemicals"],["5347.KL","GAMUDA","Construction"],["5398.KL","IJM","Construction"],["5211.KL","Sunway","Construction"],
["4197.KL","Sime Darby Plantation","Plantation"],["1961.KL","IOI","Plantation"],["8869.KL","Dialog","Oil & Gas Services"],["3816.KL","MISC","Marine Transport"],
["4707.KL","Nestle Malaysia","Food"],["7084.KL","QL Resources","Food"],["5225.KL","IHH Healthcare","Healthcare"],["7153.KL","Kossan","Rubber Products"],
["7113.KL","Top Glove","Rubber Products"],["7086.KL","Hartalega","Healthcare Equipment"],["0166.KL","Frontken","Semiconductors"],["0097.KL","Greatech","Semiconductors"],
["5285.KL","Sime Darby","Industrial"],["4065.KL","PPB","Food"],["2445.KL","KLK","Plantation"]
];
const shariahSeed={"5347.KL":1,"5398.KL":1,"5211.KL":1,"5285.KL":1,"4197.KL":1,"1961.KL":1,"8869.KL":1,"3816.KL":1,"7089.KL":1,"4677.KL":1,"7084.KL":1,"5225.KL":1,"7153.KL":1,"7113.KL":1,"7086.KL":1,"0166.KL":1,"0097.KL":1};

async function candles(s,interval="1d"){let r=await fetch(`/api/market?symbol=${encodeURIComponent(s)}&range=6mo&interval=${interval}`);let j=await r.json();return j.candles||[]}
function sma(a,n){return a.length<n?null:a.slice(-n).reduce((x,y)=>x+y,0)/n}
function atr(c,n=14){if(c.length<n+1)return 0;let tr=[];for(let i=1;i<c.length;i++)tr.push(Math.max(c[i].high-c[i].low,Math.abs(c[i].high-c[i-1].close),Math.abs(c[i].low-c[i-1].close)));return sma(tr,n)}
function rsi(c,n=14){if(c.length<n+1)return 50;let g=0,l=0;for(let i=c.length-n;i<c.length;i++){let d=c[i].close-c[i-1].close;if(d>0)g+=d;else l-=d}return l?100-100/(1+g/l):100}
function score(c){let closes=c.map(x=>x.close), last=closes.at(-1), s20=sma(closes,20),s50=sma(closes,50),s200=sma(closes,200), r=rsi(c);let ret=(last/closes[Math.max(0,closes.length-21)]-1)*100;let x=50+(last>s20?10:-10)+(last>s50?12:-12)+(s50&&last>s50?8:-8)+(r>55?8:r<45?-8:0)+(ret>0?10:-10);return Math.max(0,Math.min(100,Math.round(x)))}
function setup(c){let p=c.at(-1).close,a=atr(c)||p*.015,s20=sma(c.map(x=>x.close),20),s50=sma(c.map(x=>x.close),50),r=rsi(c),bull=p>s20&&s20>s50&&r>=52,bear=p<s20&&s20<s50&&r<=48,dir=bull?"BUY":bear?"SELL":"WAIT";let entry=p,sl=dir==="BUY"?p-1.35*a:dir==="SELL"?p+1.35*a:p;let tp1=dir==="BUY"?p+1*a:dir==="SELL"?p-1*a:p,tp2=dir==="BUY"?p+2*a:dir==="SELL"?p-2*a:p,tp3=dir==="BUY"?p+3*a:dir==="SELL"?p-3*a:p;return {dir,entry,sl,tp1,tp2,tp3,atr:a,rsi:r,ma20:s20,ma50:s50}}
async function analyze(x){try{let c=await candles(x[0]);return {...x,c,score:score(c),set:setup(c)}}catch(e){return {...x,c:[],score:0,set:{dir:"WAIT"}}}}
async function sectors(list){let map={};let results=await Promise.all(list.map(analyze));results.forEach(x=>{if(!map[x[2]])map[x[2]]=[];map[x[2]].push(x.score)});return Object.entries(map).map(([name,a])=>({name,score:Math.round(a.reduce((x,y)=>x+y,0)/a.length)})).sort((a,b)=>b.score-a.score)}
function renderSectors(id,arr){$(id).innerHTML=arr.map((x,i)=>`<div class="sector"><b>#${i+1}</b><span>${x.name}<div class="bar"><i style="width:${x.score}%"></i></div></span><b>${x.score}</b></div>`).join("")}
async function render(){
 $("#stamp").textContent="Updated "+new Date().toLocaleString();
 let list=mode==="US"?us:my; let ranked=await Promise.all(list.map(analyze)); ranked.sort((a,b)=>b.score-a.score);
 let sec=await sectors(list);renderSectors(mode==="US"?"#usSectors":"#mySectors",sec);
 if(mode==="US")$("#usMood").textContent=sec[0]?.name||"—"; else $("#myMood").textContent=sec[0]?.name||"—";
 const focus=ranked.slice(0,12);$("#focus").innerHTML=focus.map((x,i)=>`<div class="focusrow" data-symbol="${x[0]}"><b>#${i+1}</b><div><b>${x[0]}</b><div class="muted">${x[1]} · ${x[2]}</div></div><span>${x.score}</span><span class="${x.set.dir==="BUY"?"up":x.set.dir==="SELL"?"down":""}">${x.set.dir}</span><span class="hideM">${x.set.entry?fmt(x.set.entry):"—"}</span><span class="hideM">${x.set.sl?fmt(x.set.sl):"—"}</span></div>`).join("");
 document.querySelectorAll(".focusrow").forEach(el=>el.onclick=()=>openCounter(el.dataset.symbol, list.find(x=>x[0]===el.dataset.symbol)));
 if(focus[0])openCounter(focus[0][0],focus[0]);
}
function fmt(n){return Number.isFinite(n)?n.toFixed(n>100?2:3):"—"}
async function openCounter(symbol,x){
 selected=x;let c=x.c?.length?x.c:await candles(symbol);let s=setup(c);$("#dMarket").textContent=mode==="US"?"US EQUITY":"BURSA MALAYSIA";$("#dName").textContent=`${x[0]} · ${x[1]}`;
 $("#dShariah").textContent=mode==="MY"?(shariahSeed[symbol]?"SHARIAH ✓":"SHARIAH: CHECK SC LIST"):"US: CHECK SCREEN";
 $("#tradeBox").innerHTML=[["Signal",s.dir],["Entry",fmt(s.entry)],["TP1 / TP2 / TP3",`${fmt(s.tp1)} / ${fmt(s.tp2)} / ${fmt(s.tp3)}`],["Stop loss",fmt(s.sl)],["Risk/Reward",s.dir==="WAIT"?"—":"~1:1.0 / 1:1.5 / 1:2.2"]].map(a=>`<div class="metric"><small>${a[0]}</small><b>${a[1]}</b></div>`).join("");
 let r=s.rsi||50, trend=s.dir, ma20=s.ma20,ma50=s.ma50;
 $("#technical").innerHTML=`<div class="analysis"><div class="line"><span>Trend</span><b>${trend}</b></div><div class="line"><span>RSI(14)</span><b>${r.toFixed(1)}</b></div><div class="line"><span>MA20</span><b>${fmt(ma20)}</b></div><div class="line"><span>MA50</span><b>${fmt(ma50)}</b></div><div class="line"><span>ATR(14)</span><b>${fmt(s.atr)}</b></div><div class="line"><span>Method</span><b>Trend + momentum + ATR</b></div></div>`;
 const latest=c.at(-1)?.close||0, base=c.slice(-20).map(z=>z.close), growth=base.length>1?(latest/base[0]-1)*100:0;
 $("#fundamental").innerHTML=`<div class="analysis"><div class="line"><span>Price</span><b>${fmt(latest)}</b></div><div class="line"><span>20-session return</span><b>${growth.toFixed(2)}%</b></div><div class="line"><span>Company health</span><b>${x.score>=70?"STRONG":x.score>=55?"WATCH":"WEAK"}</b></div><div class="line"><span>Data coverage</span><b>Market + filing hub</b></div><div class="line"><span>Decision</span><b>${x.score>=70?"FOCUS":x.score>=55?"MONITOR":"AVOID FOR NOW"}</b></div></div>`;
 draw(c,symbol);
 let j=await fetch(`/api/company?symbol=${encodeURIComponent(symbol)}`).then(r=>r.json());
 $("#docs").innerHTML=(j.documents||[]).map(d=>`<a target="_blank" rel="noopener" href="${d.url}">${d.type} · ${d.date||""}</a>`).join("")||"<span class='muted'>No documents returned.</span>";
}
function draw(c,symbol){if(chart)chart.destroy();let labels=c.slice(-80).map(x=>new Date(x.time).toLocaleDateString()),data=c.slice(-80).map(x=>x.close);chart=new Chart($("#chart"),{type:"line",data:{labels,datasets:[{label:symbol,data,borderWidth:2,pointRadius:0,tension:.2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{display:false}},y:{grid:{color:"#252b33"}}}}})}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(z=>z.classList.remove("active"));b.classList.add("active");mode=b.dataset.m;render()});
$("#refresh").onclick=render; render();
