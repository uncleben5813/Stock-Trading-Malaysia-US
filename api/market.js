function yahoo(symbol, range="3mo", interval="1d"){
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&events=div%2Csplits`;
}
function td(symbol, interval="1day", outputsize=200){
  const key = process.env.TWELVE_DATA_API_KEY;
  if(!key) return null;
  const clean = symbol.endsWith(".KL") ? symbol.replace(".KL","") : symbol;
  const s = symbol.endsWith(".KL") ? `${clean}:KLSE` : clean;
  return `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(s)}&interval=${interval}&outputsize=${outputsize}&apikey=${key}`;
}
async function getJson(url){
  const r=await fetch(url,{headers:{"User-Agent":"USMYStockRadar/1.0"}});
  if(!r.ok) throw new Error("HTTP "+r.status);
  return r.json();
}
function normalizeYahoo(j){
  const q=j.chart?.result?.[0]; if(!q) throw new Error("No Yahoo data");
  const ts=q.timestamp||[], c=q.indicators?.quote?.[0]||{};
  return ts.map((t,i)=>({time:t*1000,open:c.open?.[i],high:c.high?.[i],low:c.low?.[i],close:c.close?.[i],volume:c.volume?.[i]}))
    .filter(x=>x.close!=null);
}
function normalizeTD(j){
  return (j.values||[]).slice().reverse().map(x=>({time:new Date(x.datetime).getTime(),open:+x.open,high:+x.high,low:+x.low,close:+x.close,volume:+x.volume||0}));
}
export default async function handler(req,res){
  const symbol=req.query.symbol;
  const range=req.query.range||"6mo";
  const interval=req.query.interval||"1d";
  if(!symbol) return res.status(400).json({ok:false,error:"symbol required"});
  try{
    let candles;
    const u=td(symbol, interval==="1d"?"1day":interval, 300);
    if(u){
      try{ candles=normalizeTD(await getJson(u)); }catch(e){}
    }
    if(!candles?.length) candles=normalizeYahoo(symbol,range,interval);
    res.setHeader("Cache-Control","s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ok:true,symbol,candles,source:u?"twelvedata/yahoo":"yahoo"});
  }catch(e){ return res.status(500).json({ok:false,error:e.message}); }
}
