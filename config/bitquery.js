module.exports = {
    bitqueryConfig: {
      endpoint: process.env.BITQUERY_ENDPOINT || 'https://streaming.bitquery.io/graphql',
      apiKey: process.env.BITQUERY_API_KEY || 'ory_at_VFSOt_3zPppe9b5VMVIEAkKZ_oZcoe_ePcJpQFbY47c.d4_NS7dyDptcbMnp72x5I4ALRZw7Mo-4NGVq5kgyvqI'
    },
    // bitqueryConfig: {
    //   endpoint: 'https://streaming.bitquery.io/graphql',
    //   apiToken: process.env.BITQUERY_API_TOKEN || 'your_default_token_here' // The Bearer token from Bitquery
    // }
};

