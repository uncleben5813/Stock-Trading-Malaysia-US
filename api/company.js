async function fetchJSON(url){
 const r=await fetch(url,{headers:{"User-Agent":"USMYStockRadar contact=stock-radar@example.com"}});
 if(!r.ok) throw Error("HTTP "+r.status); return r.json();
}
const cikMap={
 AAPL:"0000320193",MSFT:"0000789019",NVDA:"0001045810",AMZN:"0001018724",GOOGL:"0001652044",
 META:"0001326801",TSLA:"0001318605",JPM:"0000019617",V:"0001403161",MA:"0001141391",
 AMD:"0000002488",AVGO:"0001730168",NFLX:"0001065280",ORCL:"0001341439",CRM:"0001108524",
 COST:"0000909832",WMT:"0000104169",KO:"0000021344",PEP:"0000077476",XOM:"0000034088",
 CVX:"0000093410",BAC:"0000070858",GS:"0000886982",LLY:"0000059478",JNJ:"0000200406",
 UNH:"0000731766",MRK:"0000310158",ADBE:"0000796343",INTC:"0000050863",IBM:"0000051143",
 UBER:"0001543151",COIN:"0001679788",PLTR:"0001321655",CRWD:"0001535527"
};
export default async function handler(req,res){
 const symbol=(req.query.symbol||"").toUpperCase().replace(".KL","");
 if(!symbol)return res.status(400).json({ok:false,error:"symbol required"});
 const us=!!cikMap[symbol];
 const result={ok:true,symbol,market:us?"US":"MY",documents:[],announcements:[]};
 if(us){
  const cik=cikMap[symbol];
  try{
   const s=await fetchJSON(`https://data.sec.gov/submissions/CIK${cik}.json`);
   const recent=s.filings?.recent||{};
   const forms=recent.form||[], dates=recent.filingDate||[], acc=recent.accessionNumber||[], docs=recent.primaryDocument||[];
   for(let i=0;i<Math.min(forms.length,40);i++){
    if(["10-K","10-Q","8-K","20-F","6-K"].includes(forms[i])){
      const base=`https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc[i].replaceAll("-","")}/${docs[i]}`;
      result.documents.push({type:forms[i],date:dates[i],url:base,filing:`${forms[i]} • ${dates[i]}`});
    }
   }
   result.documents=result.documents.slice(0,20);
   result.announcements=result.documents.filter(x=>x.type==="8-K"||x.type==="6-K").slice(0,10);
  }catch(e){result.error=e.message;}
 }else{
  const code=symbol.replace(".KL","");
  result.documents=[
   {type:"Bursa Announcements",url:`https://www.bursamalaysia.com/market_information/announcements/company_announcement?company=${code}`,filing:"Search Bursa announcements"},
   {type:"Annual Reports",url:`https://www.google.com/search?q=${encodeURIComponent(symbol+" annual report investor relations")}`,filing:"Company annual report search"},
   {type:"Quarterly Results",url:`https://www.google.com/search?q=${encodeURIComponent(symbol+" quarterly results Bursa Malaysia")}`,filing:"Quarterly results search"},
   {type:"Prospectus",url:`https://www.google.com/search?q=${encodeURIComponent(symbol+" prospectus Bursa Malaysia")}`,filing:"Prospectus search"}
  ];
  result.announcements=result.documents.slice(0,1);
 }
 res.setHeader("Cache-Control","s-maxage=900, stale-while-revalidate=3600");
 return res.json(result);
}
