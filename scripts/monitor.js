// scripts/monitor.js
const cron = require('node-cron');
const ArbitrageService = require('../src/services/arbitrage/ArbitrageService');
const logger = require('../utils/logger');

const arbitrageService = new ArbitrageService();

// Run every minute
cron.schedule('* * * * *', async () => {
    try {
        logger.info('Starting arbitrage opportunity check');
        for (const pair of arbitrageService.supportedPairs) {
            const opportunities = await arbitrageService.findArbitrageOpportunities(pair);
            if (opportunities.length > 0) {
                await arbitrageService.saveOpportunities(pair, opportunities);
                arbitrageService.notifyOpportunities(opportunities);
            }
        }
    } catch (error) {
        logger.error('Error in arbitrage monitoring:', error);
    }
});