const ethereumAdapter = require('./chain-adapters/ethereum');
const bnbAdapter = require('./chain-adapters/bnb');
const polygonAdapter = require('./chain-adapters/polygon');
const arbitrumAdapter = require('./chain-adapters/arbitrum');
const baseAdapter = require('./chain-adapters/base');
const optimismAdapter = require('./chain-adapters/optimism');
const logger = require('../../utils/logger');

/**
 * DEX Service - Manages DEX price data across multiple chains
 */
class DEXService {
  constructor() {
    this.adapters = {
      ethereum: ethereumAdapter,
      bnb: bnbAdapter,
      polygon: polygonAdapter,
      arbitrum: arbitrumAdapter,
      base: baseAdapter,
      optimism: optimismAdapter
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