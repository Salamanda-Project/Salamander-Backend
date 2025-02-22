const express = require('express');
//const mongoose = require('mongoose');
const cors = require('cors');
const market = require("./dbmodel/marketCollection.js");
const routes = require('./routes/marketData.js');
const app = express();

//Mongodb configuration
// Connect to MongoDB
require('./mongooseConfig/dbConnect');

app.use(cors());
app.use(express.json());
app.use(routes);




app.listen(3000, () => {
    console.log('Server is running on port 3000');
});