const mongoose = require('mongoose');

const Schema = mongoose.Schema;

// Define schema
const dexSchema = new Schema({
    dex: { type: String, uppercase: true, required: true },
    price: { type: Number, required: false }
});

const marketSchema = new Schema({
    pair: { type: String, required: true },
    market: [dexSchema], // Corrected schema name
    timestamp: { type: Date, default: Date.now }
});





// Define model (Collection should be singular form)
const market = mongoose.model('Dex', marketSchema); // Corrected model name

//Create a new document
const newMarket = new market({
    pair: 'DEMO/USDT',
    market: [{
        dex: 'DEMOPAIR',
        price: 100
    }]
    // timestamp is auto-filled due to default
});

if (market.findOne({ pair: 'DEMO/USDT' })) {
    return ({ error: 'Market data already exists' });
}
// Save document
newMarket.save()
    .then(() => {
        console.log('Market data saved');
    })
    .catch((err) => {
        console.log('Error:', err.message);
    });

// Export the model correctly
module.exports = market; // Corrected export name
