const { ArbitrageOpportunity } = require('../dbmodel/index');
const CEXPriceRetriever = require('../price-retriever/cex/CEXPriceRetriever');
const DEXPriceRetriever = require('../price-retriever/dex/DEXPriceRetriever');
const { SUPPORTED_PAIRS, PROFIT_THRESHOLD } = require('../config/constants');
const logger = require('../../utils/logger');

class ArbitrageService {
    constructor() {
        this.cexRetriever = new CEXPriceRetriever();
        this.dexRetriever = new DEXPriceRetriever();
        this.supportedPairs = SUPPORTED_PAIRS;
    }

    async findArbitrageOpportunities(pair) {
        try {
            // Fetch prices from both CEX and DEX
            const cexPrices = await this.cexRetriever.getPrice(pair);
            const dexPrices = await this.dexRetriever.getPrice(pair);

            // Combine all prices for comparison
            const allPrices = {
                cex: cexPrices,
                dex: dexPrices
            };

            // Find arbitrage opportunities
            const opportunities = [];
            
            // Check CEX-to-CEX opportunities
            opportunities.push(...this.findOpportunitiesInCategory(cexPrices, 'CEX'));
            
            // Check DEX-to-DEX opportunities
            opportunities.push(...this.findOpportunitiesInCategory(dexPrices, 'DEX'));
            
            // Check CEX-to-DEX opportunities
            opportunities.push(...this.findCrossPlatformOpportunities(cexPrices, dexPrices));

            return opportunities;
        } catch (error) {
            logger.error(`Error finding arbitrage opportunities for ${pair}:`, error);
            return [];
        }
    }

    findOpportunitiesInCategory(prices, category) {
        const opportunities = [];
        const exchanges = Object.entries(prices);

        for (let i = 0; i < exchanges.length; i++) {
            for (let j = i + 1; j < exchanges.length; j++) {
                const [exchange1, data1] = exchanges[i];
                const [exchange2, data2] = exchanges[j];

                const priceDiff = Math.abs(data1.price - data2.price);
                const profitPercentage = (priceDiff / Math.min(data1.price, data2.price)) * 100;

                if (profitPercentage >= PROFIT_THRESHOLD) {
                    opportunities.push({
                        type: `${category}-to-${category}`,
                        buyExchange: data1.price < data2.price ? exchange1 : exchange2,
                        sellExchange: data1.price < data2.price ? exchange2 : exchange1,
                        buyPrice: Math.min(data1.price, data2.price),
                        sellPrice: Math.max(data1.price, data2.price),
                        profitPercentage,
                        timestamp: Date.now()
                    });
                }
            }
        }

        return opportunities;
    }

    findCrossPlatformOpportunities(cexPrices, dexPrices) {
        const opportunities = [];

        for (const [cexName, cexData] of Object.entries(cexPrices)) {
            for (const [dexName, dexData] of Object.entries(dexPrices)) {
                const priceDiff = Math.abs(cexData.price - dexData.price);
                const profitPercentage = (priceDiff / Math.min(cexData.price, dexData.price)) * 100;

                if (profitPercentage >= PROFIT_THRESHOLD) {
                    opportunities.push({
                        type: 'CEX-to-DEX',
                        buyExchange: cexData.price < dexData.price ? cexName : dexName,
                        sellExchange: cexData.price < dexData.price ? dexName : cexName,
                        buyPrice: Math.min(cexData.price, dexData.price),
                        sellPrice: Math.max(cexData.price, dexData.price),
                        profitPercentage,
                        timestamp: Date.now()
                    });
                }
            }
        }

        return opportunities;
    }

    async saveOpportunities(pair, opportunities) {
        try {
            await ArbitrageOpportunity.insertMany(
                opportunities.map(opp => ({
                    ...opp,
                    pair,
                    analyzed: false,
                    executed: false
                }))
            );
            logger.info(`Saved ${opportunities.length} opportunities for ${pair}`);
        } catch (error) {
            logger.error('Error saving opportunities:', error);
        }
    }

    notifyOpportunities(opportunities) {
        opportunities.forEach(opp => {
            logger.info(`Arbitrage Opportunity Found:
                Type: ${opp.type}
                Pair: ${opp.pair}
                Buy from ${opp.buyExchange} at ${opp.buyPrice}
                Sell on ${opp.sellExchange} at ${opp.sellPrice}
                Potential profit: ${opp.profitPercentage.toFixed(2)}%
            `);
        });
    }

    async startMonitoring() {
        logger.info('Starting arbitrage monitoring...');
        
        setInterval(async () => {
            for (const pair of this.supportedPairs) {
                try {
                    const opportunities = await this.findArbitrageOpportunities(pair);
                    if (opportunities.length > 0) {
                        await this.saveOpportunities(pair, opportunities);
                        this.notifyOpportunities(opportunities);
                    }
                } catch (error) {
                    logger.error(`Error monitoring ${pair}:`, error);
                }
            }
        }, 1000); // Check every second
    }
}

module.exports = ArbitrageService;