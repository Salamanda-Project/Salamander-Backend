const ethereumAdapter = require('./chain-adapters/ethereum');
const bnbAdapter = require('./chain-adapters/bnb');
// const polygonAdapter = require('./chain-adapters/polygon');
const arbitrumAdapter = require('./chain-adapters/arbitrum');
const baseAdapter = require('./chain-adapters/base');
// const optimismAdapter = require('./chain-adapters/optimism');
const logger = require('../../utils/logger');

/**
 * DEX Service - Manages DEX price data across multiple chains
 */
class DEXService {
  constructor() {
    this.adapters = {
      ethereum: ethereumAdapter,
      bnb: bnbAdapter,
      // polygon: polygonAdapter,
      arbitrum: arbitrumAdapter,
      base: baseAdapter,
      // optimism: optimismAdapter
    };
  }

  /**
   * Get adapter for specified blockchain
   * @param {string} blockchain - Blockchain name
   * @returns {Object} Chain adapter
   */
  getAdapter(blockchain) {
    const adapter = this.adapters[blockchain.toLowerCase()];
    if (!adapter) {
      throw new Error(`No adapter found for blockchain: ${blockchain}`);
    }
    return adapter;
  }

  /**
   * Get all supported DEXes for a blockchain
   * @param {string} blockchain - Blockchain name
   * @returns {Promise<Array>} List of DEXes
   */
  async getDexesForBlockchain(blockchain) {
    const adapter = this.getAdapter(blockchain);
    return adapter.getAllDexes();
  }

  /**
   * Get trading pairs for a specific DEX on a blockchain
   * @param {string} blockchain - Blockchain name
   * @param {string} dexName - Name of the DEX
   * @param {number} limit - Number of pairs to fetch
   * @returns {Promise<Array>} Trading pairs
   */
  async getTradingPairsForDex(blockchain, dexName, limit = 100) {
    const adapter = this.getAdapter(blockchain);
    return adapter.getTradingPairsForDex(dexName, limit);
  }

  /**
   * Get active trading pairs from all DEXes on a specific blockchain
   * @param {string} blockchain - Blockchain name
   * @param {number} limit - Number of pairs to fetch per DEX
   * @returns {Promise<Array>} Active trading pairs
   */
  async getActiveTradingPairs(blockchain, limit = 20) {
    const adapter = this.getAdapter(blockchain);
    return adapter.getActiveTradingPairs(limit);
  }


/**
 * Get trading pairs that exist on multiple exchanges across all queried blockchains
 * @param {number} minExchanges - Minimum number of exchanges a pair must be listed on
 * @returns {Promise<Array>} Common trading pairs across blockchains
 */
async getCommonPairs(minExchanges = 2) {
  const pairDataMap = new Map(); // Map to store all data for each pair
  const exchangeCountMap = new Map(); // Map to count exchanges per pair
  
  logger.info(`Starting getCommonPairs with minExchanges=${minExchanges}`);

  try {
    // Step 1: Collect all pairs from all blockchains
    for (const [blockchain, adapter] of Object.entries(this.adapters)) {
      try {
        logger.info(`Fetching active pairs from ${blockchain}...`);
        // Get DEXes on this blockchain
        const dexes = await adapter.getAllDexes();
        logger.info(`Found ${dexes.length} DEXes on ${blockchain}`);
        
        // For each DEX, get trading pairs
        for (const dex of dexes.slice(0, 5)) { // Limit to top 5 DEXes for performance
          const pairs = await adapter.getTradingPairsForDex(dex, 30);
          logger.info(`Retrieved ${pairs.length} pairs from ${dex} on ${blockchain}`);
          
          pairs.forEach(pair => {
            // Skip invalid pairs
            if (!pair?.Trade?.Currency?.Symbol || !pair?.Trade?.Side?.Currency?.Symbol) {
              return;
            }
            
            // Normalize symbols
            const baseSymbol = pair.Trade.Currency.Symbol.toUpperCase();
            const quoteSymbol = pair.Trade.Side.Currency.Symbol.toUpperCase();
            const pairKey = `${baseSymbol}/${quoteSymbol}`;
            
            // Create composite key for exchange-specific tracking
            const exchangeKey = `${blockchain}-${dex}-${pairKey}`;
            
            // Store exchange data for this pair
            if (!exchangeCountMap.has(pairKey)) {
              exchangeCountMap.set(pairKey, new Set());
            }
            exchangeCountMap.get(pairKey).add(exchangeKey);
            
            // Store full pair data
            if (!pairDataMap.has(pairKey)) {
              pairDataMap.set(pairKey, {
                pair: pairKey,
                exchanges: [],
                blockchains: new Set(),
                baseToken: {
                  symbol: baseSymbol,
                  name: pair.Trade.Currency.Name || 'Unknown',
                  address: pair.Trade.Currency.SmartContract || 'Unknown'
                },
                quoteToken: {
                  symbol: quoteSymbol,
                  name: pair.Trade.Side.Currency?.Name || 'Unknown',
                  address: pair.Trade.Side.Currency?.SmartContract || 'Unknown'
                },
                priceData: {
                  current: pair.Trade.price_usd || 0,
                  tenMinAgo: pair.Trade.price_10min_ago || null,
                  oneHourAgo: pair.Trade.price_1h_ago || null
                },
                volumeTotal: 0
              });
            }
            
            // Update pair data
            const pairData = pairDataMap.get(pairKey);
            
            // Add blockchain
            pairData.blockchains.add(blockchain);
            
            // Add exchange if not already there
            if (!pairData.exchanges.includes(dex)) {
              pairData.exchanges.push(dex);
            }
            
            // Add volume
            pairData.volumeTotal += (pair.usd || 0);
          });
        }
      } catch (error) {
        logger.error(`Error processing ${blockchain}:`, error.message);
      }
    }
    
    // Step 2: Convert to array and filter by minimum exchanges
    const results = [];
    
    for (const [pairKey, pairData] of pairDataMap.entries()) {
      // Get distinct exchange count
      const exchangeCount = exchangeCountMap.get(pairKey).size;
      
      // Convert blockchain set to array
      pairData.blockchains = Array.from(pairData.blockchains);
      
      logger.info(`Pair ${pairKey} found on ${exchangeCount} exchanges`);
      
      // Only include pairs that meet the minimum exchange threshold
      if (exchangeCount >= minExchanges) {
        results.push(pairData);
      }
    }
    
    // Step 3: Sort by number of exchanges (descending)
    results.sort((a, b) => {
      const aCount = exchangeCountMap.get(a.pair).size;
      const bCount = exchangeCountMap.get(b.pair).size;
      return bCount - aCount;
    });
    
    logger.info(`Found ${results.length} common pairs across ${minExchanges} or more exchanges`);
    return results;
  } catch (error) {
    logger.error(`Error in getCommonPairs:`, error.message);
    throw error;
  }
}

  /**
   * Update prices across all supported blockchains
   * @returns {Promise<Object>} Results of price updates
   */
  async updateAllPrices() {
    const results = {};
    const promises = [];

    for (const [blockchain, adapter] of Object.entries(this.adapters)) {
      promises.push(
        adapter.updateAllPrices()
          .then(data => {
            results[blockchain] = {
              success: true,
              count: data.length
            };
          })
          .catch(error => {
            logger.error(`Failed to update prices for ${blockchain}:`, error);
            results[blockchain] = {
              success: false,
              error: error.message
            };
          })
      );
    }

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Get prices for a specific trading pair across all supported blockchains
   * @param {string} baseTokenSymbol - Base token symbol (e.g., 'ETH')
   * @param {string} quoteTokenSymbol - Quote token symbol (e.g., 'USDT')
   * @returns {Promise<Array>} Price data for the pair across blockchains
   */
  async getPricesForTradingPair(baseTokenSymbol, quoteTokenSymbol) {
    const results = [];
    const promises = [];

    for (const [blockchain, adapter] of Object.entries(this.adapters)) {
      promises.push(
        adapter.getActiveTradingPairs()
          .then(pairs => {
            // Filter and format pairs by symbols
            const matchingPairs = pairs.filter(pair => 
              pair.Trade && 
              pair.Trade.Currency && 
              pair.Trade.Side && 
              pair.Trade.Side.Currency &&
              pair.Trade.Currency.Symbol === baseTokenSymbol && 
              pair.Trade.Side.Currency.Symbol === quoteTokenSymbol
            ).map(pair => adapter.formatPairForStorage(pair));
            
            if (matchingPairs.length > 0) {
              results.push(...matchingPairs);
            }
          })
          .catch(error => {
            logger.error(`Failed to get ${baseTokenSymbol}/${quoteTokenSymbol} prices on ${blockchain}:`, error);
          })
      );
    }

    await Promise.allSettled(promises);
    return results;
  }
}

module.exports = new DEXService();


