// config/exchanges.js
module.exports = {
    cex: {
        binance: {
            apiKey: process.env.BINANCE_API_KEY,
            secret: process.env.BINANCE_SECRET,
            options: {
                defaultType: 'spot'
            }
        },
        kraken: {
            apiKey: process.env.KRAKEN_API_KEY,
            secret: process.env.KRAKEN_SECRET
        }
    },
    dex: {
        uniswap: {
            subgraphUrl: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
            supportedPairs: ['ETH/USDT', 'BTC/USDT']
        },
        sushiswap: {
            subgraphUrl: 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
            supportedPairs: ['ETH/USDT', 'BTC/USDT']
        },
        oneinch: {
            apiUrl: 'https://api.1inch.io/v5.0',
            supportedChains: ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism'],
            supportedPairs: ['ETH/USDT', 'BTC/USDT', 'SOL/USDT']
        }
    }
};