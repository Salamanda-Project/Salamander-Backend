const { Router } = require('express');
const controller = require('../controllers/marketData');
const app = Router();

//get requests
app.get("/api/get", controller.getMarketData);//get data
app.get("/api/getPriceByPairAndDex", controller.getPriceByPairAndDex); //get data by pair and dex
app.get("/api/getAllPricesForPair", controller.getAllPricesForPair); //get all prices for pair

app.post("/api/savePairs", controller.addMarketData); //populate data
app.post("/api/addDexprice", controller.addDexPrice); //populate data
app.patch("/api/updatePrice", controller.updateDexPrices); //update data


module.exports = app;