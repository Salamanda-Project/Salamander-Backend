//Mongodb configuration
const mongoose = require('mongoose');

// Connect to MongoDB
const MongoDBuri = 'mongodb://localhost:27017/coinmarket';
const option = {
    useNewUrlParser: true,
    useUnifiedTopology: true
};

mongoose.connect(MongoDBuri, option)
    .then(() => {
        console.log('Connected to MongoDB');
    }).catch((err) => {
        console.log('Error: ', err.message);
    });


const db = mongoose.connection;
db.on("error", (error) => {
    console.log("mongodb connection error", error);
});
db.once("open", () => {
    console.log("mongodb connected");
});
db.on("disconnected", () => {
    console.log("mongodb disconnected");
});

process.on('SIGINT', () => {
    mongoose.connection.close(() => {
        console.log('Mongoose connection is disconnected due to application termination');
        process.exit(0);
    });
});

module.exports = mongoose;