// src/services/priceComparisonEngine.js
const dexService = require('./dex');
const cexService = require('./cex');
const { arbitrageEventModel } = require('../models/arbitrageEvent');
const gasFeeEstimator = require('../utils/gasFeeEstimator');
const logger = require('../utils/logger');

/**
 * Price Comparison Engine - Compares prices across CEX and DEX platforms
 */
class PriceComparisonEngine {
  constructor() {
    this.minimumArbitrageThreshold = process.env.MIN_ARBITRAGE_THRESHOLD || 1.5; // Percentage
  }

  /**
   * Set minimum threshold for arbitrage opportunities
   * @param {number} percentage - Threshold percentage
   */
  setArbitrageThreshold(percentage) {
    this.minimumArbitrageThreshold = percentage;
    logger.info(`Arbitrage threshold set to ${percentage}%`);
  }

  /**
   * Compare prices for a token pair across DEXes and CEXes
   * @param {string} baseToken - Base token symbol (e.g., 'ETH')
   * @param {string} quoteToken - Quote token symbol (e.g., 'USDT')
   * @returns {Promise<Array>} Arbitrage opportunities
   */
  async comparePrices(baseToken, quoteToken) {
    try {
      // 1. Get prices from DEXes
      const dexPrices = await dexService.getPricesForTradingPair(baseToken, quoteToken);
      
      // 2. Get prices from CEXes
      const cexPrices = await cexService.getPricesForTradingPair(baseToken, quoteToken);
      
      // 3. Find arbitrage opportunities
      const opportunities = this.findArbitrageOpportunities(dexPrices, cexPrices);
      
      // 4. Store opportunities in database
      if (opportunities.length > 0) {
        await this.storeArbitrageOpportunities(opportunities);
      }
      
      return opportunities;
    } catch (error) {
      logger.error(`Failed to compare prices for ${baseToken}/${quoteToken}:`, error);
      throw error;
    }
  }

  /**
   * Find arbitrage opportunities between DEX and CEX prices
   * @param {Array} dexPrices - DEX price data
   * @param {Array} cexPrices - CEX price data
   * @returns {Array} Arbitrage opportunities
   */
  findArbitrageOpportunities(dexPrices, cexPrices) {
    const opportunities = [];
    
    // Compare each DEX price with each CEX price
    for (const dexPrice of dexPrices) {
      for (const cexPrice of cexPrices) {
        // Ensure we're comparing the same token pair
        if (dexPrice.baseToken.symbol !== cexPrice.baseToken.symbol || 
            dexPrice.quoteToken.symbol !== cexPrice.quoteToken.symbol) {
          continue;
        }
        
        // Calculate price difference percentage
        const priceDiff = Math.abs(dexPrice.price - cexPrice.price);
        const percentageDiff = (priceDiff / Math.min(dexPrice.price, cexPrice.price)) * 100;
        
        // Check if difference meets threshold
        if (percentageDiff >= this.minimumArbitrageThreshold) {
          // Determine buy and sell exchanges
          const buyExchange = dexPrice.price < cexPrice.price ? dexPrice : cexPrice;
          const sellExchange = dexPrice.price < cexPrice.price ? cexPrice : dexPrice;
          
          // Calculate gas fees for DEX transactions
          const gasFees = buyExchange.exchangeType === 'dex' || sellExchange.exchangeType === 'dex'
            ? gasFeeEstimator.estimateGasFees(buyExchange.blockchain || sellExchange.blockchain)
            : 0;
          
          // Calculate potential profit
          const potentialProfit = (priceDiff * 1) - gasFees; // Assuming 1 unit transaction
          
          // Only add if profitable after fees
          if (potentialProfit > 0) {
            opportunities.push({
              baseToken: dexPrice.baseToken.symbol,
              quoteToken: dexPrice.quoteToken.symbol,
              buyExchange: {
                name: buyExchange.exchange,
                type: buyExchange.exchangeType,
                blockchain: buyExchange.blockchain,
                price: buyExchange.price
              },
              sellExchange: {
                name: sellExchange.exchange,
                type: sellExchange.exchangeType,
                blockchain: sellExchange.blockchain,
                price: sellExchange.price
              },
              priceDifferencePercent: percentageDiff,
              estimatedGasFees: gasFees,
              potentialProfit,
              timestamp: new Date()
            });
          }
        }
      }
    }
    
    // Sort by potential profit (highest first)
    return opportunities.sort((a, b) => b.potentialProfit - a.potentialProfit);
  }

  /**
   * Store arbitrage opportunities in database
   * @param {Array} opportunities - Arbitrage opportunities
   * @returns {Promise<void>}
   */
  async storeArbitrageOpportunities(opportunities) {
    try {
      await arbitrageEventModel.insertMany(opportunities);
      logger.info(`Stored ${opportunities.length} arbitrage opportunities`);
    } catch (error) {
      logger.error('Failed to store arbitrage opportunities:', error);
      throw error;
    }
  }

  /**
   * Compare prices across all popular trading pairs
   * @returns {Promise<Array>} Arbitrage opportunities
   */
  async compareAllPopularPairs() {
    const popularPairs = [
      { base: 'ETH', quote: 'USDT' },
      { base: 'BTC', quote: 'USDT' },
      { base: 'BNB', quote: 'USDT' },
      { base: 'SOL', quote: 'USDT' },
      { base: 'ETH', quote: 'USDC' },
      { base: 'BTC', quote: 'USDC' },
      // Add more popular pairs here
    ];
    
    const allOpportunities = [];
    
    for (const pair of popularPairs) {
      try {
        const opportunities = await this.comparePrices(pair.base, pair.quote);
        allOpportunities.push(...opportunities);
      } catch (error) {
        logger.error(`Failed to compare prices for ${pair.base}/${pair.quote}:`, error);
      }
    }
    
    return allOpportunities;
  }
}

module.exports = new PriceComparisonEngine();