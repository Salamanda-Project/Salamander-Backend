const { SUPPORTED_PAIRS } = require('../config/constants');

class Validation {
    static validatePair(pair) {
        if (!SUPPORTED_PAIRS.includes(pair)) {
            throw new Error(`Unsupported trading pair: ${pair}`);
        }
        return true;
    }

    static validatePrice(price) {
        if (typeof price !== 'number' || price <= 0) {
            throw new Error('Invalid price value');
        }
        return true;
    }

    static validateOpportunity(opportunity) {
        const requiredFields = ['pair', 'type', 'buyExchange', 'sellExchange', 'buyPrice', 'sellPrice'];
        for (const field of requiredFields) {
            if (!opportunity[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        return true;
    }
}

module.exports = Validation;