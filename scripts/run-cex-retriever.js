const CEXPriceRetriever = require('../services/cex/CEXPriceRetriever'); // Adjust path accordingly

// Define color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

// Helper function to format prices
function formatPrice(price) {
  if (!price) return 'N/A';
  return price < 0.1 ? price.toFixed(6) : price.toFixed(2);
}

// Helper function to format dates
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toISOString().replace('T', ' ').substr(0, 19);
}

// Helper function to print tables
function printTable(data, columns) {
  // Calculate column widths
  const widths = columns.map(col => 
    Math.max(
      col.header.length,
      ...data.map(row => String(row[col.key] || '').length)
    ) + 2
  );
  
  // Print header
  let header = '';
  columns.forEach((col, i) => {
    header += colors.bright + col.header.padEnd(widths[i]) + colors.reset;
  });
  console.log(header);
  
  // Print separator
  let separator = '';
  widths.forEach(width => {
    separator += '-'.repeat(width);
  });
  console.log(separator);
  
  // Print rows
  data.forEach(row => {
    let line = '';
    columns.forEach((col, i) => {
      const value = row[col.key] !== undefined ? String(row[col.key]) : 'N/A';
      const formatted = col.format ? col.format(row[col.key], row) : value;
      line += formatted.padEnd(widths[i]);
    });
    console.log(line);
  });
}

(async () => {
  console.log(colors.bright + colors.cyan + 'Initializing Advanced CEX Price Retriever...' + colors.reset);
  
  // Create retriever with options
  const retriever = new CEXPriceRetriever({
    topExchanges: 25,
    topPairs: 25,
    timeout: 45000 // 45 seconds timeout
  });
  
  try {
    // Initialize the retriever
    await retriever.initialize();
    
    // Load all markets
    console.log(colors.bright + 'Loading markets from top exchanges...' + colors.reset);
    await retriever.loadMarkets();
    
    // Get and display exchange status
    const status = retriever.getExchangeStatus();
    console.log(`\n${colors.bright}Connected to ${colors.green}${status.totalExchanges}${colors.reset}${colors.bright} exchanges with ${colors.green}${status.topPairsCount}${colors.reset}${colors.bright} top pairs${colors.reset}`);
    console.log(`Exchanges: ${status.exchanges.join(', ')}`);
    
    // 1. Single Pair Test
    console.log(`\n${colors.bright}${colors.yellow}Testing Single Pair: BTC/USDT${colors.reset}`);
    const prices = await retriever.getPrice('BTC/USDT');
    
    // Format and display results
    const priceData = Object.entries(prices).map(([exchange, data]) => ({
      exchange: exchange.toUpperCase(),
      price: data.price,
      bid: data.bid,
      ask: data.ask,
      spread: data.spread,
      volume: data.volume,
      quoteVolume: data.quoteVolume,
      timestamp: data.timestamp
    }));
    
    if (priceData.length > 0) {
      printTable(priceData, [
        { key: 'exchange', header: 'EXCHANGE' },
        { key: 'price', header: 'PRICE', format: val => formatPrice(val) },
        { key: 'bid', header: 'BID', format: val => formatPrice(val) },
        { key: 'ask', header: 'ASK', format: val => formatPrice(val) },
        { key: 'spread', header: 'SPREAD %', format: val => val ? val + '%' : 'N/A' },
        { key: 'volume', header: 'VOLUME', format: val => val ? val.toFixed(2) : 'N/A' },
        { key: 'timestamp', header: 'TIMESTAMP', format: val => formatDate(val) }
      ]);
      
      // Calculate and show average price
      const priceValues = priceData.map(p => p.price).filter(p => p);
      const avgPrice = priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length;
      console.log(`\n${colors.bright}Average price across ${priceValues.length} exchanges: ${colors.green}$${avgPrice.toFixed(2)}${colors.reset}`);
    } else {
      console.log(colors.red + 'No prices available for BTC/USDT from configured exchanges.' + colors.reset);
    }
    
    // 2. Price Comparison across top pairs
    console.log(`\n${colors.bright}${colors.yellow}Top 5 Pairs Price Comparison${colors.reset}`);
    const comparison = await retriever.getPriceComparison(retriever.marketData.pairs.slice(0, 5));
    
    const comparisonData = Object.entries(comparison).map(([pair, data]) => ({
      pair,
      avgPrice: data.avgPrice,
      minPrice: data.minPrice,
      maxPrice: data.maxPrice,
      spread: data.spreadPercent,
      exchanges: data.numExchanges
    }));
    
    if (comparisonData.length > 0) {
      printTable(comparisonData, [
        { key: 'pair', header: 'PAIR' },
        { key: 'avgPrice', header: 'AVG PRICE', format: val => formatPrice(val) },
        { key: 'minPrice', header: 'MIN PRICE', format: val => formatPrice(val) },
        { key: 'maxPrice', header: 'MAX PRICE', format: val => formatPrice(val) },
        { key: 'spread', header: 'SPREAD %', format: val => val.toFixed(3) + '%' },
        { key: 'exchanges', header: 'EXCHANGES' }
      ]);
    } else {
      console.log(colors.red + 'No comparison data available.' + colors.reset);
    }
    
    // 3. Find arbitrage opportunities
    console.log(`\n${colors.bright}${colors.yellow}Potential Arbitrage Opportunities${colors.reset}`);
    const opportunities = await retriever.getArbitragePotentials(0.5); // 0.5% minimum spread
    
    const opportunityData = opportunities.slice(0, 10).map(opp => ({
      pair: opp.pair,
      profit: opp.potentialProfit,
      buy: opp.minExchange,
      buyPrice: opp.minPrice,
      sell: opp.maxExchange,
      sellPrice: opp.maxPrice
    }));
    
    if (opportunityData.length > 0) {
      printTable(opportunityData, [
        { key: 'pair', header: 'PAIR' },
        { key: 'profit', header: 'EST. PROFIT %', format: val => colors.green + val.toFixed(2) + '%' + colors.reset },
        { key: 'buy', header: 'BUY AT' },
        { key: 'buyPrice', header: 'BUY PRICE', format: val => formatPrice(val) },
        { key: 'sell', header: 'SELL AT' },
        { key: 'sellPrice', header: 'SELL PRICE', format: val => formatPrice(val) }
      ]);
    } else {
      console.log(colors.red + 'No significant arbitrage opportunities found.' + colors.reset);
    }
    
    // 4. Run full test on multiple pairs
    console.log(`\n${colors.bright}${colors.yellow}Would you like to run a full test on all pairs? Run:${colors.reset}`);
    console.log(`
retriever.getMultiplePrices().then(data => {
  const totalPairs = Object.keys(data).length;
  const totalExchanges = new Set(
    Object.values(data).flatMap(exchangeData => Object.keys(exchangeData))
  ).size;
  console.log(\`Retrieved prices for \${totalPairs} pairs across \${totalExchanges} exchanges\`);
});`);
    
  } catch (error) {
    console.error(colors.red + 'Error in price retrieval process:' + colors.reset, error);
  }
})();