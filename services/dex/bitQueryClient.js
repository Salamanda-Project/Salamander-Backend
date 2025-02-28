const axios = require('axios');
const { bitqueryConfig } = require('../../config/bitquery');
const logger = require('../../utils/logger');

class BitqueryClient {
  constructor() {
    this.endpoint = bitqueryConfig.endpoint;
    this.bearerToken = bitqueryConfig.apiKey;
    
    // Initialize axios client with proper headers
    this.httpClient = axios.create({
      baseURL: this.endpoint,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.bearerToken}`
      },
      // Add timeout to prevent hanging requests
      timeout: 30000
    });
  }

  /**
   * Execute a custom GraphQL query against Bitquery API
   * @param {string} query - GraphQL query
   * @param {Object} variables - Query variables
   * @returns {Promise<Object>} Query results
   */
  async executeCustomQuery(query, variables = {}) {
    try {
      // Log request for debugging (remove in production)
      logger.debug('Sending request to Bitquery API:', { 
        endpoint: this.endpoint,
        // Don't log the full token for security
        authHeader: this.bearerToken ? 'Bearer Token Set' : 'No Bearer Token',
        variables 
      });
      
      const response = await this.httpClient.post('', {
        query,
        variables
      });
      
      // Log response status for debugging
      logger.debug(`Bitquery API response status: ${response.status}`);
      
      if (response.data.errors) {
        logger.error('Bitquery API error:', response.data.errors);
        throw new Error(`Bitquery API error: ${response.data.errors[0].message}`);
      }
      
      return response.data.data;
    } catch (error) {
      // Enhanced error logging
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        logger.error('Bitquery API error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        // The request was made but no response was received
        logger.error('No response received from Bitquery API:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        logger.error('Error setting up Bitquery API request:', error.message);
      }
      
      throw error;
    }
  }
}

module.exports = new BitqueryClient();