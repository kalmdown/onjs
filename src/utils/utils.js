// src\utils\utils.js
/**
 * RestApi interface to the Onshape server.
 * 
 * Handles HTTP requests to Onshape's API with proper authentication and formatting.
 */

const axios = require('axios');
const { OnshapeApiError } = require('./errors');

class RestApi {
  /**
   * @param {Object} options Configuration options
   * @param {Function|Object} options.getAuthHeaders Function that returns authentication headers or AuthManager instance
   */
  constructor({ getAuthHeaders, authManager, baseUrl }) {
    this.baseUrl = baseUrl;
    
    if (authManager) {
      // Use the provided auth manager
      this.authManager = authManager;
      this.getAuthHeaders = async () => this.authManager.getAuthHeaders('GET', '', {});
    } else {
      // Use the provided function
      this.getAuthHeaders = getAuthHeaders;
    }
  }

  /**
   * Make an HTTP request to the Onshape API
   * 
   * @param {string} method HTTP method (GET, POST, etc.)
   * @param {string} endpoint API endpoint (e.g., '/documents')
   * @param {Object|null} [payload=null] Request payload for POST/PUT requests
   * @param {Object} [queryParams={}] Query parameters
   * @returns {Promise<Object>} Response data
   * @private
   */
  async _request(method, endpoint, payload = null, queryParams = {}) {
    if (!endpoint.startsWith('/')) {
      throw new Error(`Endpoint '${endpoint}' missing '/' prefix`);
    }

    const url = this.baseUrl + endpoint;
    const headers = await this.getAuthHeaders();
    const params = new URLSearchParams();
    
    // Add query parameters
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params.append(key, value);
      }
    });

    console.log(`${method} ${endpoint}`);
    
    try {
      const response = await axios({
        method,
        url,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...headers
        },
        data: payload,
        params: params.toString() ? params : undefined
      });
      
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new OnshapeApiError(
          `Error ${error.response.status}: ${error.response.statusText}`,
          error.response
        );
      }
      throw error;
    }
  }

  /**
   * Make a GET request to the Onshape API
   * 
   * @param {string} endpoint API endpoint
   * @param {Object} [queryParams={}] Query parameters
   * @returns {Promise<Object>} Response data
   */
  async get(endpoint, queryParams = {}) {
    return this._request('GET', endpoint, null, queryParams);
  }

  /**
   * Make a POST request to the Onshape API
   * 
   * @param {string} endpoint API endpoint
   * @param {Object} payload Request payload
   * @param {Object} [queryParams={}] Query parameters
   * @returns {Promise<Object>} Response data
   */
  async post(endpoint, payload, queryParams = {}) {
    return this._request('POST', endpoint, payload, queryParams);
  }

  /**
   * Make a DELETE request to the Onshape API
   * 
   * @param {string} endpoint API endpoint
   * @param {Object} [queryParams={}] Query parameters
   * @returns {Promise<Object>} Response data
   */
  async delete(endpoint, queryParams = {}) {
    return this._request('DELETE', endpoint, null, queryParams);
  }
}

module.exports = RestApi;