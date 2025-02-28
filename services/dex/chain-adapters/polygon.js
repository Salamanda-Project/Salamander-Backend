// src/services/dex/chainAdapters/ethereum.js
const bitqueryClient = require('../bitqueryClient');
const Market = require('../../../dbmodel/marketCollection')
const logger = require('../../../utils/logger');

/**
 * Polygon Chain Adapter - Handles Polygon DEX interactions
 */
class PolygonAdapter {
  constructor() {
    this.networkName = 'matic';
    this.marketModel = Market;
  }

  /**
   * Get all DEXes on Polygon network
   * @returns {Promise<Array>} List of DEXes
   */
  async getAllDexes() {
    const query = `
      query DexMarkets($network: evm_network) {
        EVM(network: $network) {
          DEXTradeByTokens {
            Trade {
              Dex {
                ProtocolFamily
              }
            }
            buyers: uniq(of: Trade_Buyer)
            sellers: uniq(of: Trade_Sender)
            count(if: {Trade: {Side: {Type: {is: buy}}}})
          }
        }
      }
    `;

    const variables = {
      network: this.networkName
    };

    try {
      const data = await bitqueryClient.executeCustomQuery(query, variables);
      const dexes = data.EVM.DEXTradeByTokens
        .filter(item => item.Trade && item.Trade.Dex && item.Trade.Dex.ProtocolFamily)
        .map(item => item.Trade.Dex.ProtocolFamily);
      
      // Get unique DEX names
      return [...new Set(dexes)];
    } catch (error) {
      logger.error('Failed to fetch DEXes from Polygon:', error);
      throw error;
    }
  }

  /**
   * Get trading pairs for a specific DEX
   * @param {string} dexName - Name of the DEX
   * @param {number} limit - Number of pairs to fetch (default: 200)
   * @returns {Promise<Array>} Trading pairs with price data
   */
  async getTradingPairsForDex(dexName, limit = 200) {
    // Calculate time variables
    const now = new Date();
    const time10MinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const time1hAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const time3hAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();

    const query = `
      query DexMarkets($network: evm_network, $market: String, $time_10min_ago: DateTime, $time_1h_ago: DateTime, $time_3h_ago: DateTime) {
        EVM(network: $network) {
          DEXTradeByTokens(
            orderBy: {descendingByField: "usd"}
            where: {Trade: {Dex: {ProtocolFamily: {is: $market}}}, Block: {Time: {after: $time_3h_ago}}}
            limit: {count: ${limit}}
          ) {
            Trade {
              Currency {
                Symbol
                Name
                SmartContract
                Fungible
              }
              Side {
                Currency {
                  Symbol
                  Name
                  SmartContract
                }
              }
              price_usd: PriceInUSD(maximum: Block_Number)
              price_last: Price(maximum: Block_Number)
              price_10min_ago: Price(
                maximum: Block_Number
                if: {Block: {Time: {before: $time_10min_ago}}}
              )
              price_1h_ago: Price(
                maximum: Block_Number
                if: {Block: {Time: {before: $time_1h_ago}}}
              )
              price_3h_ago: PriceInUSD(minimum: Block_Number)
            }
            usd: sum(of: Trade_AmountInUSD)
            count
          }
        }
      }
    `;

    const variables = {
      network: this.networkName,
      market: dexName,
      time_10min_ago: time10MinAgo,
      time_1h_ago: time1hAgo,
      time_3h_ago: time3hAgo
    };

    try {
      const data = await bitqueryClient.executeCustomQuery(query, variables);
      return data.EVM.DEXTradeByTokens;
    } catch (error) {
      logger.error(`Failed to fetch trading pairs for ${dexName} on Polygon:`, error);
      throw error;
    }
  }

  /**
   * Get active trading pairs from all Polygon DEXes
   * @param {number} limit - Number of pairs to fetch per DEX
   * @returns {Promise<Array>} Active trading pairs
   */
  async getActiveTradingPairs(limit = 20) {
    try {
      // 1. Get all DEXes
      const dexes = await this.getAllDexes();
      
      // 2. Get trading pairs for each DEX (limit to top 5 DEXes for performance)
      const topDexes = dexes.slice(0, 5);
      const allPairs = [];
      
      for (const dex of topDexes) {
        const pairs = await this.getTradingPairsForDex(dex, limit);
        allPairs.push(...pairs);
      }
      
      return allPairs;
    } catch (error) {
      logger.error('Failed to fetch active trading pairs from Polygon:', error);
      throw error;
    }
  }

  /**
   * Format trading pair for storage
   * @param {Object} pairData - Trading pair data
   * @returns {Object} Formatted pair data
   */
  formatPairForStorage(pairData) {
    if (!pairData.Trade || !pairData.Trade.Currency || !pairData.Trade.Side || !pairData.Trade.Side.Currency) {
      logger.warn('Incomplete pair data received:', JSON.stringify(pairData));
      return null;
    }

    const baseToken = pairData.Trade.Currency;
    const quoteToken = pairData.Trade.Side.Currency;
    
    return {
      pair: `${baseToken.Symbol}/${quoteToken.Symbol}`,
      market: [{
        dex: pairData.Trade.Dex?.ProtocolFamily || 'UNKNOWN',
        network: this.networkName.toUpperCase(),
        price: pairData.Trade.price_usd || 0
      }],
      timestamp: new Date(),
      baseToken: {
        symbol: baseToken.Symbol,
        name: baseToken.Name,
        address: baseToken.SmartContract
      },
      quoteToken: {
        symbol: quoteToken.Symbol,
        name: quoteToken.Name,
        address: quoteToken.SmartContract
      },
      priceData: {
        current: pairData.Trade.price_usd,
        tenMinAgo: pairData.Trade.price_10min_ago,
        oneHourAgo: pairData.Trade.price_1h_ago,
        threeHoursAgo: pairData.Trade.price_3h_ago
      },
      volume: pairData.usd || 0,
      tradeCount: pairData.count || 0
    };
  }

  /**
   * Save price data to database
   * @param {Array} pairsData - Array of formatted pair data objects
   * @returns {Promise<void>}
   */
  async savePriceData(pairsData) {
    try {
      // Filter out any null entries
      const validPairs = pairsData.filter(pair => pair !== null);
      
      if (validPairs.length === 0) {
        logger.warn('No valid pairs to save for Polygon');
        return;
      }
      
      const operations = validPairs.map(pair => ({
        updateOne: {
          filter: { pair: pair.pair },
          update: { 
            $set: { 
              timestamp: new Date(),
              baseToken: pair.baseToken,
              quoteToken: pair.quoteToken,
              priceData: pair.priceData,
              volume: pair.volume,
              tradeCount: pair.tradeCount
            },
            $push: { market: { $each: pair.market } }
          },
          upsert: true
        }
      }));
      
      await this.marketModel.bulkWrite(operations);
      logger.info(`Saved ${validPairs.length} price records for Polygon`);
    } catch (error) {
      logger.error('Failed to save Polygon price data:', error);
      throw error;
    }
  }

  /**
   * Update prices for all active trading pairs
   * @returns {Promise<Array>} Formatted price data
   */
  async updateAllPrices() {
    try {
      // 1. Get active trading pairs
      const activePairs = await this.getActiveTradingPairs();
      
      // 2. Format pairs for storage
      const formattedPairs = activePairs.map(pair => this.formatPairForStorage(pair));
      
      // 3. Save price data
      if (formattedPairs.length > 0) {
        await this.savePriceData(formattedPairs);
      }
      
      return formattedPairs;
    } catch (error) {
      logger.error('Failed to update Polygon prices:', error);
      throw error;
    }
  }
}

module.exports = new PolygonAdapter();