const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/coinmarket', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

const Schema = mongoose.Schema;

// Define subdocument schema for DEX
const dexSchema = new Schema({
  dex: { type: String, uppercase: true, required: true },
  network: { type: String, uppercase: true, required: true },
  price: { type: Number, required: false },
});

// Define main Market schema
const marketSchema = new Schema({
  pair: { type: String, required: true },
  market: [dexSchema], // Embeds dex documents as an array
  timestamp: { type: Date, default: Date.now },
});

// Model (collection will be pluralized, so 'Dex' => 'dexes')
const Market = mongoose.model('Dex', marketSchema);

console.log("Mongoose Host: " + mongoose.connection.host)

// Example: Insert sample data
const sampleData = new Market({
  pair: 'ETH/USDT',
  market: [
    { dex: 'Uniswap', network: 'Ethereum', price: 2800 },
    { dex: 'Sushiswap', network: 'Ethereum', price: 2795 },
  ],
});

sampleData.save()
  .then(() => console.log('✅ Sample data saved'))
  .catch((err) => console.error('❌ Error saving data:', err));
