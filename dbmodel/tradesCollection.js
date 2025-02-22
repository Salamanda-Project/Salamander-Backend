const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tradeSchema = new Schema({
    pair: String,
    dexFrom: String,
    dexTo: String,
    buyPrice: Number,
    sellPrice: Number,
    profitPercentage: Number,
    profit_amount: Number,
    tc_hash: String,
    tradeDate: Date
});