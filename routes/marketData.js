const { Router } = require('express');
const controller = require('../controllers/marketData');
const app = Router();

//get requests
app.get("/api/get", controller.getMarketData);//get data

app.post("/api/savePairs", controller.addMarketData); //populate data
app.post("/api/dexprice", controller.addDexPrice); //populate data
app.patch("/api/update", controller.updateDexPrices); //update data


module.exports = app;