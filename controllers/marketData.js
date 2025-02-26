const marketData = require("../dbmodel/marketCollection.js");


//function to add market Pair and related data
module.exports.addMarketData = async (req, res) => {
    let { pair } = req.body; //get data from request body

    try {

        //check for possible duplicate market data
        let marketDataExist = await marketData.findOne({ pair });
        if (marketDataExist) {
            return res.status(400).json({ error: 'Market data already exists' });
        }

        let newSaveMarket = await marketData.create({ pair: pair });
        console.log(' Market data saved:', newSaveMarket);
        console.log('Market data saved');
        res.send(newSaveMarket);
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
}


//function to add DEX and its price to a market pair 
module.exports.addDexPrice = async (req, res) => {
    let { pair, network, dex, price } = req.body; //get data from request body

    try { //check for duplicate DEX before adding to market data
        let marketDataExist = await marketData.findOne({ pair });

        //DEX duplicate check
        if (marketDataExist) {
            if (marketDataExist.market.find((data) => data.dex === dex) && marketDataExist.market.find((data) => data.network)) {
                return res.status(400).json({ error: 'DEX and Network data already exists' });
            }

            marketDataExist.market.push({ dex, network, price });
            await marketDataExist.save();
            console.log('Market data updated:', marketDataExist);
            res.send(marketDataExist);
        } else {
            res.status(404).json({ error: 'Market data not found' });
        }
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message })
    }
}



//Function to update Prices of Pairs in different Dexs
module.exports.updateDexPrices = async (req, res) => {
    let { pair, network, dex, price } = req.body; //get data from request body

    try {
        let marketDataExist = await marketData.findOne({ pair });
        if (marketDataExist) {
            let marketInfoDex = marketDataExist.market.find((data) => data.dex === dex && data.network === network);
            //let marketInfoNetwork = marketDataExist.market.find((data) => data.network === network);
            if (marketInfoDex) {
                marketInfoDex.price = price;
                await marketDataExist.save();
                console.log('Market data updated:', marketDataExist);
                res.send(marketDataExist);
            } else {
                res.status(404).json({ error: 'Dex not found' });
            }
        } else {
            res.status(404).json({ error: 'Market data not found' });
        }
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
}




//Get Requests

//get price by pair and dex
module.exports.getPriceByPairAndDex = async (req, res) => {
    let { pair, network, dex } = req.body;
    try {
        let data = await marketData.findOne({ pair });
        if (data) {
            let marketInfo = data.market.find((data) => data.dex === dex && data.network === network);

            if (marketInfo) {
                res.json({ result: marketInfo.price });
            } else {
                res.status(404).json({ error: 'Dex and Network not found' });
            }
        } else {
            res.status(404).json({ error: 'Market data not found' });
        }
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
}

//get all market prices
module.exports.getAllPricesForPair = async (req, res) => {
    let { pair } = req.body;
    try {
        let data = await marketData.findOne({ pair });

        let allPrices = data.market.map((data) => {
            return { dex: data.dex, dex: data.dex.network, price: data.price };
        });
        res.json({ allPrices: allPrices });
    } catch (error) {

    }
}

// get all market data
module.exports.getMarketData = async (req, res) => {
    try {
        let data = await marketData.find();
        res.send(data);
    } catch (error) {
        res.send(error);
    }
}