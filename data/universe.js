export const US = [
  ["NVDA","NVIDIA","Semiconductors"],["AMD","AMD","Semiconductors"],["AVGO","Broadcom","Semiconductors"],
  ["TSM","Taiwan Semiconductor","Semiconductors"],["MU","Micron","Semiconductors"],["QCOM","Qualcomm","Semiconductors"],
  ["AAPL","Apple","Technology Hardware"],["MSFT","Microsoft","Software"],["GOOGL","Alphabet","Internet"],
  ["AMZN","Amazon","Internet Retail"],["META","Meta Platforms","Internet"],["ORCL","Oracle","Software"],
  ["CRM","Salesforce","Software"],["PLTR","Palantir","Software"],["NFLX","Netflix","Media"],
  ["TSLA","Tesla","Automobiles"],["LLY","Eli Lilly","Pharmaceuticals"],["JNJ","Johnson & Johnson","Pharmaceuticals"],
  ["UNH","UnitedHealth","Healthcare"],["MRK","Merck","Pharmaceuticals"],["XOM","Exxon Mobil","Energy"],
  ["CVX","Chevron","Energy"],["COP","ConocoPhillips","Energy"],["JPM","JPMorgan Chase","Banks"],
  ["BAC","Bank of America","Banks"],["GS","Goldman Sachs","Capital Markets"],["V","Visa","Financial Services"],
  ["MA","Mastercard","Financial Services"],["WMT","Walmart","Retail"],["COST","Costco","Retail"],
  ["HD","Home Depot","Retail"],["MCD","McDonald's","Restaurants"],["KO","Coca-Cola","Beverages"],
  ["PEP","PepsiCo","Beverages"],["CAT","Caterpillar","Industrials"],["GE","GE Aerospace","Industrials"],
  ["RTX","RTX","Aerospace & Defense"],["BA","Boeing","Aerospace & Defense"],["PLD","Prologis","REIT"],
  ["AMT","American Tower","REIT"],["LIN","Linde","Chemicals"],["ADBE","Adobe","Software"],
  ["INTC","Intel","Semiconductors"],["IBM","IBM","IT Services"],["UBER","Uber","Transport"],
  ["SHOP","Shopify","Software"],["COIN","Coinbase","Financial Services"],["CRWD","CrowdStrike","Cybersecurity"]
];

export const MY = [
  ["1155.KL","Malakoff","Utilities"],["1155.KL","Malakoff","Utilities"],
  ["1155.KL","Malakoff","Utilities"],["4863.KL","Telekom Malaysia","Telecommunications"],
  ["6947.KL","Digi","Telecommunications"],["6012.KL","Maxis","Telecommunications"],
  ["1023.KL","CIMB Group","Banks"],["1155.KL","Maybank","Banks"],["1066.KL","RHB Bank","Banks"],
  ["5819.KL","Hong Leong Bank","Banks"],["1295.KL","Public Bank","Banks"],
  ["5183.KL","Petronas Dagangan","Consumer Fuels"],["5681.KL","Petronas Chemicals","Chemicals"],
  ["3042.KL","Petronas Gas","Utilities"],["6033.KL","PBA Holdings","Utilities"],
  ["2445.KL","Kossan Rubber","Healthcare Equipment"],["7153.KL","Kossan","Rubber Products"],
  ["7113.KL","Top Glove","Rubber Products"],["7086.KL","Harta","Healthcare Equipment"],
  ["0166.KL","Frontken","Semiconductors"],["0097.KL","Greatech","Semiconductors"],
  ["5347.KL","GAMUDA","Construction"],["5398.KL","IJM","Construction"],
  ["5211.KL","Sunway","Construction"],["5285.KL","Sime Darby","Industrial"],
  ["4197.KL","Sime Darby Plantation","Plantation"],["1961.KL","IOI Corporation","Plantation"],
  ["2445.KL","KLK","Plantation"],["8869.KL","Dialog Group","Oil & Gas Services"],
  ["7277.KL","Dialog","Oil & Gas Services"],["3816.KL","MISC","Marine Transport"],
  ["4707.KL","Nestle Malaysia","Food"],["7084.KL","QL Resources","Food"],
  ["5681.KL","Sunway Healthcare","Healthcare"],["5225.KL","IHH Healthcare","Healthcare"],
  ["4197.KL","Press Metal","Industrial Metals"],["8869.KL","Yinson","Energy"],
  ["7089.KL","YTL Power","Utilities"],["4677.KL","YTL Corp","Utilities"],
  ["4065.KL","PPB Group","Food"],["1066.KL","Hong Leong Financial","Financial Services"]
];

// Deduplicate while preserving order.
function unique(arr){ return [...new Map(arr.map(x=>[x[0],x])).values()]; }
export const MY_UNIQUE = unique(MY);
