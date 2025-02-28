const mongoose = require('mongoose');

const arbitrageOpportunitySchema = new mongoose.Schema({
    pair: String,
    type: String,
    buyExchange: String,
    sellExchange: String,
    buyPrice: Number,
    sellPrice: Number,
    profitPercentage: Number,
    timestamp: Date,
    analyzed: Boolean,
    executed: Boolean
});

const arbitrageOpportunity = mongoose.model('ArbitrageOpportunity', arbitrageOpportunitySchema);

module.exports = arbitrageOpportunity;