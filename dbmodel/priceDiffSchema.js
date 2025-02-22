const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const priceDiffSchema = new Schema({
    pair: String,
    dexFrom: String,
    dexTo: String,
    buyPrice: Number,
    sellPrice: Number,
    profitPercentage: Number,
    profit_amount: Number,
    tradeDate: Date
});