const express = require('express');
//const mongoose = require('mongoose');
const cors = require('cors');
const market = require("./dbmodel/marketCollection.js");
const routes = require('./routes/marketData.js');
const app = express();

require('dotenv').config();
const database = require('./config/database.js');
const ArbitrageService = require('./services/arbitrageService');
const logger = require('./utils/logger');

//Mongodb configuration
// Connect to MongoDB
require('./mongooseConfig/dbConnect');

app.use(cors());
app.use(express.json());
app.use(routes);


async function startApplication() {
    try {
        // Connect to database
        await database.connect();

        // Initialize arbitrage service
        const arbitrageService = new ArbitrageService();
        await arbitrageService.startMonitoring();

        logger.info('Arbitrage monitoring service started successfully');
    } catch (error) {
        logger.error('Application startup error:', error);
        process.exit(1);
    }
}


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

startApplication();