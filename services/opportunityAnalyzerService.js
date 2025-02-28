const logger = require('../../utils/logger');
const { MINIMUM_LIQUIDITY } = require('../../config/constants');

class OpportunityAnalyzer {
    constructor() {
        this.minimumLiquidity = MINIMUM_LIQUIDITY;
    }

    async analyzeOpportunity(opportunity) {
        try {
            const analysis = {
                isViable: true,
                reasons: [],
                estimatedNetProfit: 0
            };

            // Check liquidity
            if (!this.checkLiquidity(opportunity)) {
                analysis.isViable = false;
                analysis.reasons.push('Insufficient liquidity');
            }

            // Calculate fees and estimate net profit
            const { netProfit, fees } = this.calculateNetProfit(opportunity);
            analysis.estimatedNetProfit = netProfit;
            analysis.fees = fees;

            if (netProfit <= 0) {
                analysis.isViable = false;
                analysis.reasons.push('Negative profit after fees');
            }

            return analysis;
        } catch (error) {
            logger.error('Error analyzing opportunity:', error);
            return null;
        }
    }

    checkLiquidity(opportunity) {
        return opportunity.liquidity >= this.minimumLiquidity;
    }

    calculateNetProfit(opportunity) {
        const fees = {
            trading: (opportunity.buyPrice * 0.001) + (opportunity.sellPrice * 0.001), // 0.1% trading fee
            gas: 0, // Estimate gas fees for DEX transactions
            slippage: opportunity.profitPercentage * 0.1 // Estimate 10% slippage
        };

        const totalFees = Object.values(fees).reduce((a, b) => a + b, 0);
        const netProfit = opportunity.profitPercentage - totalFees;

        return { netProfit, fees };
    }
}

module.exports = new OpportunityAnalyzer();