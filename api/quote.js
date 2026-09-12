async function j(url){const r=await fetch(url,{headers:{"User-Agent":"USMYStockRadar/1.0"}});if(!r.ok)throw Error("HTTP "+r.status);return r.json();}
export default async function handler(req,res){
 const symbol=req.query.symbol;if(!symbol)return res.status(400).json({ok:false,error:"symbol required"});
 try{
  const x=await j(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`);
  const q=x.chart.result[0];const m=q.meta||{};const last=(q.indicators.quote[0].close||[]).filter(Boolean).at(-1)||m.regularMarketPrice;
  res.setHeader("Cache-Control","s-maxage=30, stale-while-revalidate=60");
  return res.json({ok:true,symbol,price:last,previousClose:m.previousClose,currency:m.currency,exchange:m.exchange});
 }catch(e){return res.status(500).json({ok:false,error:e.message});}
}
