# Market Data API

This is a Node.js backend service that provides API endpoints for storing, updating, and retrieving market data from multiple decentralized exchanges (DEXs). The project uses MongoDB as the database.

## Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or later recommended)
- [MongoDB](https://www.mongodb.com/) (running locally on default port `27017`)

## Installation

1. Clone the repository:

   ```sh
   git clone <repository-url>
   cd <repository-folder>
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

## Database Configuration

Make sure MongoDB is running on your local machine. 

Ensure your MongoDB connection settings are correctly configured in `mongooseConfig/dbConnect.js`.

## Running the Application

Start the server:

```sh
node app.js
```

The server should be running at:

```
http://localhost:3000
```

## API Endpoints

### 1. Get Market Data

- **Endpoint:** `GET /api/get`
- **Description:** Retrieves all market data.

### 2. Add a Market Pair

- **Endpoint:** `POST /api/savePairs`
- **Description:** Adds a new market pair.
- **Payload:**
  ```json
  {
    "pair": "ETH/USDT"
  }
  ```

### 3. Add a DEX Price for a Market Pair

- **Endpoint:** `POST /api/dexprice`
- **Description:** Adds a DEX and its price to an existing market pair.
- **Payload:**
  ```json
  {
    "dex": "Uniswap",
    "pair": "ETH/USDT",
    "price": 2500.50
  }
  ```

### 4. Update DEX Prices

- **Endpoint:** `PATCH /api/update`
- **Description:** Updates the price of a market pair for a specific DEX.
- **Payload:**
  ```json
  {
    "pair": "ETH/USDT",
    "dex": "Uniswap",
    "price": 2550.75
  }
  ```

## Notes
- The API will return errors if duplicate market pairs or DEXs are added.
- Ensure MongoDB is running before starting the application.
- Use tools like Postman to test API endpoints.
- While testing with Postman please ensure that all values of the key-value-pair must be capitalized



