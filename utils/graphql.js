const { createClient } = require('@urql/core');

class GraphQLClient {
    constructor(url) {
        this.client = createClient({
            url: url
        });
    }

    async query(queryString, variables = {}) {
        try {
            const result = await this.client.query(queryString, variables).toPromise();
            if (result.error) {
                throw new Error(result.error.message);
            }
            return result.data;
        } catch (error) {
            throw new Error(`GraphQL query error: ${error.message}`);
        }
    }
}

module.exports = GraphQLClient;