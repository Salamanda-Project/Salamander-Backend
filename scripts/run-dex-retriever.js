#!/usr/bin/env node
// src/scripts/runDexRetriever.js
require('dotenv').config();

const mongoose = require('mongoose');
const dexService = require('../services/dex/index');
const logger = require('../utils/logger');
const config = require('../config/database'); // Assume this has your database connection config

/**
 * Format number with commas for thousands and limit decimal places
 * @param {number} num - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number
 */
function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined) return 'N/A';
  return parseFloat(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Calculate price change percentage
 * @param {number} current - Current price
 * @param {number} previous - Previous price
 * @returns {number|null} Price change percentage or null if invalid input
 */
function calculatePriceChange(current, previous) {
  if (!current || !previous) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Format price change with directional indicator
 * @param {number|null} change - Price change percentage
 * @returns {string} Formatted price change
 */
function formatPriceChange(change) {
  if (change === null) return 'N/A';
  const formattedChange = change.toFixed(2) + '%';
  return change > 0 ? '▲ ' + formattedChange : '▼ ' + formattedChange;
}

/**
 * Create a simple ASCII table
 * @param {Array} headers - Table headers
 * @param {Array} rows - Table rows
 * @param {Array} colWidths - Column widths
 * @returns {string} Formatted table
 */
function createTable(headers, rows, colWidths) {
  // Create header row
  let table = '';
  
  // Create horizontal line
  const horizontalLine = colWidths.map(width => '-'.repeat(width + 2)).join('+');
  table += '+' + horizontalLine + '+\n';
  
  // Create header row
  table += '| ' + headers.map((header, i) => header.padEnd(colWidths[i])).join(' | ') + ' |\n';
  
  // Add separator
  table += '+' + horizontalLine + '+\n';
  
  // Add data rows
  for (const row of rows) {
    table += '| ' + row.map((cell, i) => String(cell).padEnd(colWidths[i])).join(' | ') + ' |\n';
  }
  
  // Add bottom line
  table += '+' + horizontalLine + '+\n';
  
  return table;
}

/**
 * Display DEX list for a blockchain
 * @param {string} blockchain - Blockchain name
 */
async function displayDexList(blockchain) {
  try {
    logger.info(`Fetching DEXes on ${blockchain}...`);
    const dexes = await dexService.getDexesForBlockchain(blockchain);
    logger.info(`Found ${dexes.length} DEXes on ${blockchain}`);
    
    const headers = ['#', 'DEX Name'];
    const colWidths = [3, 30];
    const rows = dexes.map((dex, index) => [index + 1, dex]);
    
    console.log(createTable(headers, rows, colWidths));
    return dexes;
  } catch (error) {
    logger.error(`Error fetching DEXes on ${blockchain}:`, error.message);
    return [];
  }
}

/**
 * Display trading pairs for a DEX
 * @param {string} blockchain - Blockchain name
 * @param {string} dexName - DEX name
 * @param {number} limit - Number of pairs to display
 */
async function displayTradingPairs(blockchain, dexName, limit = 20) {
  try {
    logger.info(`Fetching trading pairs for ${dexName} on ${blockchain}...`);
    const pairs = await dexService.getTradingPairsForDex(blockchain, dexName, limit);
    logger.info(`Found ${pairs.length} trading pairs for ${dexName} on ${blockchain}`);
    
    const headers = ['#', 'Pair', 'Price (USD)', '1h Change', 'Volume (USD)', 'Trades'];
    const colWidths = [3, 20, 15, 15, 15, 10];
    const rows = [];
    
    pairs.forEach((pair, index) => {
      if (!pair.Trade || !pair.Trade.Currency || !pair.Trade.Side || !pair.Trade.Side.Currency) {
        return;
      }
      
      const baseSymbol = pair.Trade.Currency.Symbol;
      const quoteSymbol = pair.Trade.Side.Currency.Symbol;
      const pairName = `${baseSymbol}/${quoteSymbol}`;
      const price = pair.Trade.price_usd;
      const priceOneHourAgo = pair.Trade.price_1h_ago;
      const change = calculatePriceChange(price, priceOneHourAgo);
      const volume = pair.usd;
      const tradeCount = pair.count;
      
      rows.push([
        index + 1,
        pairName,
        formatNumber(price, 6),
        formatPriceChange(change),
        formatNumber(volume, 2),
        formatNumber(tradeCount, 0)
      ]);
    });
    
    console.log(createTable(headers, rows, colWidths));
    return pairs;
  } catch (error) {
    logger.error(`Error fetching trading pairs for ${dexName} on ${blockchain}:`, error.message);
    return [];
  }
}

/**
 * Display results of price updates
 * @param {Object} results - Results of price updates
 */
function displayUpdateResults(results) {
  const headers = ['Blockchain', 'Status', 'Count/Error'];
  const colWidths = [12, 10, 40];
  const rows = [];
  
  for (const [blockchain, result] of Object.entries(results)) {
    rows.push([
      blockchain,
      result.success ? 'SUCCESS' : 'FAILED',
      result.success ? result.count : result.error
    ]);
  }
  
  console.log(createTable(headers, rows, colWidths));
}

/**
 * Get prices for a specific trading pair
 * @param {string} baseToken - Base token symbol
 * @param {string} quoteToken - Quote token symbol
 */
async function displayPricesForPair(baseToken, quoteToken) {
  try {
    logger.info(`Fetching prices for ${baseToken}/${quoteToken} across all blockchains...`);
    const prices = await dexService.getPricesForTradingPair(baseToken, quoteToken);
    
    if (prices.length === 0) {
      logger.info(`No prices found for ${baseToken}/${quoteToken}`);
      return;
    }
    
    logger.info(`Found ${prices.length} prices for ${baseToken}/${quoteToken}`);
    
    const headers = ['Network', 'DEX', 'Price (USD)', '10m Change', '1h Change', 'Volume (USD)'];
    const colWidths = [10, 15, 15, 15, 15, 15];
    const rows = [];
    
    prices.forEach(price => {
      const tenMinChange = calculatePriceChange(price.priceData.current, price.priceData.tenMinAgo);
      const oneHourChange = calculatePriceChange(price.priceData.current, price.priceData.oneHourAgo);
      
      rows.push([
        price.market[0].network,
        price.market[0].dex,
        formatNumber(price.priceData.current, 6),
        formatPriceChange(tenMinChange),
        formatPriceChange(oneHourChange),
        formatNumber(price.volume, 2)
      ]);
    });
    
    console.log(createTable(headers, rows, colWidths));
  } catch (error) {
    logger.error(`Error fetching prices for ${baseToken}/${quoteToken}:`, error.message);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (!command) {
      console.log(`
DEX Retriever - Command-line tool for DEX data retrieval

Usage:
  node runDexRetriever.js <command> [options]

Commands:
  list-dexes <blockchain>           List all DEXes on a blockchain
  list-pairs <blockchain> <dex>     List trading pairs for a DEX
  update-prices                     Update prices for all blockchains
  get-pair <baseToken> <quoteToken> Get prices for a specific trading pair
      `);
      process.exit(0);
    }
    
    switch (command) {
      case 'list-dexes':
        const blockchain = args[1];
        if (!blockchain) {
          logger.error('Blockchain name is required');
          process.exit(1);
        }
        await displayDexList(blockchain);
        break;
        
      case 'list-pairs':
        const dexBlockchain = args[1];
        const dexName = args[2];
        const limit = parseInt(args[3]) || 20;
        
        if (!dexBlockchain || !dexName) {
          logger.error('Blockchain name and DEX name are required');
          process.exit(1);
        }
        
        await displayTradingPairs(dexBlockchain, dexName, limit);
        break;
        
      case 'update-prices':
        logger.info('Updating prices for all blockchains...');
        const results = await dexService.updateAllPrices();
        displayUpdateResults(results);
        break;
        
      case 'get-pair':
        const baseToken = args[1];
        const quoteToken = args[2];
        
        if (!baseToken || !quoteToken) {
          logger.error('Base token and quote token are required');
          process.exit(1);
        }
        
        await displayPricesForPair(baseToken, quoteToken);
        break;
        
      default:
        logger.error(`Unknown command: ${command}`);
        process.exit(1);
    }
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();