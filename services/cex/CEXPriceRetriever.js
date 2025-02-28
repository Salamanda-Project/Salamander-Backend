const PriceRetriever = require('../../price-retriever/base/PriceRetriever');
const ccxt = require('ccxt');
const logger = require('../../utils/logger');

class CEXPriceRetriever extends PriceRetriever {
  constructor(options = {}) {
    super();
    this.exchanges = {};
    this.topExchanges = options.topExchanges || 25;
    this.topPairs = options.topPairs || 25;
    this.defaultQuote = options.defaultQuote || 'USDT';
    this.timeout = options.timeout || 30000; // 30s timeout
    this.initialized = false;
    
    // Market data cache
    this.marketData = {
      exchanges: [],
      pairs: [],
      lastUpdated: null
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    logger.info('Initializing CEX Price Retriever...');
    await this.initializeExchanges();
    this.initialized = true;
  }

  async initializeExchanges() {
    // Get all available exchanges from ccxt
    const allExchangeIds = ccxt.exchanges;
    
    // Filter for exchanges that support fetchTickers (for efficiency)
    const viableExchanges = [];
    
    for (const id of allExchangeIds) {
      try {
        // Dynamically create exchange instance
        const exchange = new ccxt[id]({
          timeout: this.timeout,
          enableRateLimit: true
        });
        
        // Check if the exchange supports the required methods
        if (exchange.has.fetchTickers && exchange.has.fetchTicker && !exchange.has.CORS) {
          viableExchanges.push({
            id,
            exchange,
            volumeUSD: 0 // Will be populated later
          });
        }
      } catch (error) {
        logger.debug(`Could not initialize ${id}: ${error.message}`);
      }
    }
    
    logger.info(`Found ${viableExchanges.length} viable exchanges`);
    
    // Initialize exchanges (limited to top N by volume)
    const topExchanges = await this.getTopExchangesByVolume(viableExchanges);
    this.marketData.exchanges = topExchanges;
    
    for (const exchangeInfo of topExchanges) {
      this.exchanges[exchangeInfo.id] = exchangeInfo.exchange;
    }
    
    logger.info(`Initialized top ${Object.keys(this.exchanges).length} exchanges`);
  }
  
  async getTopExchangesByVolume(viableExchanges) {
    // This would ideally use an API to get real volume data 
    // For now, we'll use a sample list of known high-volume exchanges
    const knownHighVolumeExchanges = [
      'binance', 'coinbase', 'okx', 'bybit', 'kucoin', 
      'kraken', 'bitstamp', 'bitfinex', 'huobi', 'gateio',
      'mexc', 'bitget', 'crypto_com', 'htx', 'bingx',
      'deribit', 'phemex', 'gemini', 'bitmart', 'whitebit',
      'lbank', 'bittrex', 'upbit', 'coinex', 'bitflyer',
      'wazirx', 'exmo', 'coincheck', 'poloniex', 'coinone'
    ];
    
    // Sort exchanges with known high-volume ones first
    const sortedExchanges = viableExchanges.sort((a, b) => {
      const aIndex = knownHighVolumeExchanges.indexOf(a.id);
      const bIndex = knownHighVolumeExchanges.indexOf(b.id);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    });
    
    // Take the top N exchanges
    return sortedExchanges.slice(0, this.topExchanges).map(e => ({
      id: e.id,
      exchange: e.exchange,
      name: e.exchange.name || e.id
    }));
  }

  async loadMarkets() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    logger.info('Loading markets for all exchanges...');
    const loadPromises = [];
    
    for (const [exchangeId, exchange] of Object.entries(this.exchanges)) {
      loadPromises.push(
        exchange.loadMarkets()
          .then(() => {
            logger.debug(`Loaded markets for ${exchangeId}`);
            return { exchangeId, success: true };
          })
          .catch(error => {
            logger.error(`Failed to load markets for ${exchangeId}: ${error.message}`);
            return { exchangeId, success: false, error: error.message };
          })
      );
    }
    
    const results = await Promise.all(loadPromises);
    const failedExchanges = results.filter(r => !r.success).map(r => r.exchangeId);
    
    if (failedExchanges.length > 0) {
      logger.warn(`Failed to load markets for ${failedExchanges.length} exchanges: ${failedExchanges.join(', ')}`);
      // Remove failed exchanges
      failedExchanges.forEach(id => delete this.exchanges[id]);
    }
    
    // After loading markets, identify top trading pairs
    await this.identifyTopPairs();
    
    this.marketData.lastUpdated = new Date();
    logger.info('Market loading complete');
  }

  async identifyTopPairs() {
    logger.info('Identifying top trading pairs...');
    const pairVolumeMap = new Map();
    
    // Gather volume data from all exchanges
    for (const [exchangeId, exchange] of Object.entries(this.exchanges)) {
      try {
        // Some exchanges support fetchTickers to get all tickers at once
        if (exchange.has.fetchTickers) {
          const tickers = await exchange.fetchTickers();
          
          for (const [symbol, ticker] of Object.entries(tickers)) {
            if (!ticker.quoteVolume && !ticker.baseVolume) continue;
            
            // Normalize pair format to BASE/QUOTE
            const parts = symbol.split('/');
            if (parts.length !== 2) continue;
            
            const volumeUSD = ticker.quoteVolume || ticker.baseVolume;
            
            // Skip pairs with very low volume
            if (!volumeUSD || volumeUSD < 10000) continue;
            
            // Update the total volume for this pair
            const currentVolume = pairVolumeMap.get(symbol) || 0;
            pairVolumeMap.set(symbol, currentVolume + volumeUSD);
          }
        }
      } catch (error) {
        logger.error(`Error fetching tickers from ${exchangeId}: ${error.message}`);
      }
    }
    
    // Convert to array and sort by volume
    const pairVolumeArray = Array.from(pairVolumeMap.entries())
      .map(([pair, volume]) => ({ pair, volume }))
      .sort((a, b) => b.volume - a.volume);
    
    // Get the top pairs
    this.marketData.pairs = pairVolumeArray
      .slice(0, this.topPairs)
      .map(item => item.pair);
    
    // If we couldn't find enough pairs, add some default ones
    if (this.marketData.pairs.length < this.topPairs) {
      const defaultPairs = [
        'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
        'ADA/USDT', 'AVAX/USDT', 'DOGE/USDT', 'DOT/USDT', 'SHIB/USDT',
        'LINK/USDT', 'MATIC/USDT', 'UNI/USDT', 'LTC/USDT', 'ATOM/USDT',
        'ETC/USDT', 'BCH/USDT', 'FIL/USDT', 'XLM/USDT', 'NEAR/USDT',
        'ALGO/USDT', 'APE/USDT', 'AXS/USDT', 'MANA/USDT', 'SAND/USDT'
      ];
      
      // Add default pairs that aren't already in the list
      for (const pair of defaultPairs) {
        if (!this.marketData.pairs.includes(pair)) {
          this.marketData.pairs.push(pair);
          if (this.marketData.pairs.length >= this.topPairs) break;
        }
      }
    }
    
    logger.info(`Identified top ${this.marketData.pairs.length} trading pairs`);
  }

  async getPrice(pair) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.marketData.pairs.length === 0) {
      await this.loadMarkets();
    }
    
    const prices = {};
    const fetchPromises = [];
    
    for (const [exchangeName, exchange] of Object.entries(this.exchanges)) {
      // Check if the exchange supports this pair
      if (!exchange.markets || !exchange.markets[pair]) {
        continue;
      }
      
      fetchPromises.push(
        exchange.fetchTicker(pair)
          .then(ticker => {
            prices[exchangeName] = {
              price: ticker.last,
              bid: ticker.bid,
              ask: ticker.ask,
              spread: ticker.ask && ticker.bid ? 
                     ((ticker.ask - ticker.bid) / ticker.ask * 100).toFixed(3) : null,
              volume: ticker.baseVolume,
              quoteVolume: ticker.quoteVolume,
              timestamp: ticker.timestamp
            };
          })
          .catch(error => {
            logger.debug(`Error fetching ${pair} price from ${exchangeName}: ${error.message}`);
          })
      );
    }
    
    await Promise.allSettled(fetchPromises);
    return prices;
  }

  async getMultiplePrices(pairs = null) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.marketData.pairs.length === 0) {
      await this.loadMarkets();
    }
    
    // Use top pairs if none specified
    const pairsToFetch = pairs || this.marketData.pairs;
    
    const results = {};
    for (const pair of pairsToFetch) {
      results[pair] = await this.getPrice(pair);
    }
    
    return results;
  }

  async getPriceComparison(pairs = null) {
    const allPrices = await this.getMultiplePrices(pairs);
    const comparison = {};
    
    for (const [pair, exchangePrices] of Object.entries(allPrices)) {
      // Skip pairs with no data
      if (Object.keys(exchangePrices).length === 0) continue;
      
      // Calculate statistics
      const prices = Object.values(exchangePrices)
        .filter(data => data.price)
        .map(data => data.price);
      
      if (prices.length === 0) continue;
      
      // Calculate min, max, avg prices
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const spread = ((max - min) / avg) * 100; // Percentage spread across exchanges
      
      // Find exchanges with min and max prices
      const minExchange = Object.entries(exchangePrices)
        .find(([, data]) => data.price === min)?.[0] || 'unknown';
      const maxExchange = Object.entries(exchangePrices)
        .find(([, data]) => data.price === max)?.[0] || 'unknown';
      
      comparison[pair] = {
        avgPrice: avg,
        minPrice: min,
        maxPrice: max,
        spreadPercent: spread,
        minExchange,
        maxExchange,
        numExchanges: prices.length,
        timestamp: Date.now()
      };
    }
    
    return comparison;
  }

  async getArbitragePotentials(minSpreadPercent = 1.0) {
    const comparison = await this.getPriceComparison();
    
    // Filter for pairs with significant spread
    const opportunities = Object.entries(comparison)
      .filter(([, data]) => data.spreadPercent >= minSpreadPercent)
      .map(([pair, data]) => ({
        pair,
        ...data,
        potentialProfit: data.spreadPercent - 0.5 // Subtract estimated fees
      }))
      .sort((a, b) => b.potentialProfit - a.potentialProfit);
    
    return opportunities;
  }

  getExchangeStatus() {
    return {
      totalExchanges: Object.keys(this.exchanges).length,
      topPairsCount: this.marketData.pairs.length,
      exchanges: Object.keys(this.exchanges),
      lastUpdated: this.marketData.lastUpdated
    };
  }
}

module.exports = CEXPriceRetriever;