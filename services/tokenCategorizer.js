// src/services/tokenCategorizer.js
const { tokenModel } = require('../models/token');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Token Categorizer - Categorizes tokens into Main, Alt, and Meme categories
 */
class TokenCategorizer {
  constructor() {
    // Define category criteria
    this.categories = {
      MAIN: 'Main',
      ALT: 'Alt',
      MEME: 'Meme'
    };
    
    // Pre-define some known tokens by category
    this.knownTokens = {
      // Main coins from the PRD
      MAIN: ['BTC', 'ETH', 'BNB', 'XRP', 'LTC', 'SOL', 'XLM', 'XMR', 'EOS', 'MIOTA', 'NEO', 'DASH', 'ZEC', 'FIL'],
      
      // Alt coins from the PRD
      ALT: ['ADA', 'DOT', 'AVAX', 'LINK', 'UNI', 'ALGO', 'ATOM', 'XTZ', 'HBAR', 'EGLD', 'LUNA', 'FTM', 'MANA', 'THETA'],
      
      // Meme coins from the PRD
      MEME: ['DOGE', 'SHIB', 'ELON', 'FLOKI', 'SAMO', 'KISHU', 'HOGE', 'DOGEDASH', 'SAFEMOON', 'ELONGATE', 'PIT', 'DOGEFATHER', 'DOGEGF']
    };
  }

  /**
   * Categorize a token based on its symbol and market data
   * @param {string} symbol - Token symbol
   * @param {Object} tokenData - Token market data
   * @returns {string} Category (Main, Alt, or Meme)
   */
  categorizeToken(symbol, tokenData = {}) {
    // Check if it's a known token
    for (const [category, tokens] of Object.entries(this.knownTokens)) {
      if (tokens.includes(symbol)) {
        return this.categories[category];
      }
    }
    
    // Otherwise categorize based on market data
    const marketCap = tokenData.marketCap || 0;
    const volume = tokenData.volume || 0;
    
    // Check if it's a meme coin (often has 'dog', 'shib', 'inu' in the name)
    const name = (tokenData.name || '').toLowerCase();
    if (
      name.includes('dog') || 
      name.includes('shib') || 
      name.includes('inu') || 
      name.includes('elon') || 
      name.includes('moon') ||
      name.includes('safe')
    ) {
      return this.categories.MEME;
    }
    
    // Categorize based on market cap
    if (marketCap > 10000000000) { // $10B+
      return this.categories.MAIN;
    } else {
      return this.categories.ALT;
    }
  }

  /**
   * Fetch token metadata from CoinGecko or similar API
   * @param {string} symbol - Token symbol
   * @returns {Promise<Object>} Token metadata
   */
  async fetchTokenMetadata(symbol) {
    try {
      // Using CoinGecko API for demonstration
      const response = await axios.get(`https://api.coingecko.com/api/v3/coins/markets`, {
        params: {
          vs_currency: 'usd',
          ids: symbol.toLowerCase(),
          per_page: 1,
          page: 1
        }
      });
      
      if (response.data && response.data.length > 0) {
        const tokenData = response.data[0];
        return {
          name: tokenData.name,
          symbol: tokenData.symbol.toUpperCase(),
          marketCap: tokenData.market_cap,
          volume: tokenData.total_volume,
          image: tokenData.image,
          currentPrice: tokenData.current_price
        };
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to fetch metadata for token ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Process and categorize a token, then save to database
   * @param {string} symbol - Token symbol
   * @param {string} address - Token contract address
   * @param {string} blockchain - Blockchain name
   * @returns {Promise<Object>} Processed token data
   */
  async processToken(symbol, address, blockchain) {
    try {
      // Check if token already exists in database
      let token = await tokenModel.findOne({ 
        symbol, 
        address,
        blockchain
      });
      
      if (token) {
        return token;
      }
      
      // Fetch token metadata
      const metadata = await this.fetchTokenMetadata(symbol);
      
      // Categorize token
      const category = this.categorizeToken(symbol, metadata);
      
      // Create token document
      token = await tokenModel.create({
        symbol,
        name: metadata?.name || symbol,
        address,
        blockchain,
        category,
        marketCap: metadata?.marketCap || 0,
        volume: metadata?.volume || 0,
        image: metadata?.image || '',
        lastUpdated: new Date()
      });
      
      logger.info(`Categorized token ${symbol} as ${category}`);
      return token;
    } catch (error) {
      logger.error(`Failed to process token ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Categorize multiple tokens in batch
   * @param {Array<Object>} tokens - Array of token objects with symbol, address, blockchain
   * @returns {Promise<Array>} Processed token data
   */
  async categorizeTokens(tokens) {
    const results = [];
    
    for (const token of tokens) {
      try {
        const result = await this.processToken(token.symbol, token.address, token.blockchain);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to categorize token ${token.symbol}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Update token categories and metadata for existing tokens
   * @returns {Promise<number>} Number of updated tokens
   */
  async updateAllTokenCategories() {
    try {
      const tokens = await tokenModel.find();
      let updatedCount = 0;
      
      for (const token of tokens) {
        try {
          // Fetch updated metadata
          const metadata = await this.fetchTokenMetadata(token.symbol);
          
          if (metadata) {
            // Re-categorize if needed
            const category = this.categorizeToken(token.symbol, metadata);
            
            // Update token data
            token.name = metadata.name || token.name;
            token.category = category;
            token.marketCap = metadata.marketCap || token.marketCap;
            token.volume = metadata.volume || token.volume;
            token.image = metadata.image || token.image;
            token.lastUpdated = new Date();
            
            await token.save();
            updatedCount++;
          }
        } catch (error) {
          logger.error(`Failed to update token ${token.symbol}:`, error);
        }
      }
      
      logger.info(`Updated ${updatedCount} tokens out of ${tokens.length}`);
      return updatedCount;
    } catch (error) {
      logger.error('Failed to update token categories:', error);
      throw error;
    }
  }
}

module.exports = new TokenCategorizer();