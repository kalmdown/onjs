// src\api\rest-api.js
/**
 * Onshape REST API client
 */
const axios = require('axios');
const crypto = require('crypto');
const { OnshapeApiError } = require('../utils/errors');
const logger = require('../utils/logger');

// Create a scoped logger
const log = logger.scope('RestApi');

class RestApi {
  /**
   * Create a new REST API client
   * @param {Object} options - API options
   * @param {string} options.accessKey - Onshape access key
   * @param {string} options.secretKey - Onshape secret key
   * @param {string} [options.baseUrl='https://cad.onshape.com/api'] - Base URL for API
   */
  constructor({ accessKey, secretKey, baseUrl = 'https://cad.onshape.com/api' }) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    // Initialize axios instance with defaults
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    log.debug('RestApi initialized');
  }
  
  /**
   * Build authentication headers for Onshape API
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} [queryParams={}] - Query parameters
   * @returns {Object} - Authentication headers
   */
  buildAuthHeaders(method, path, queryParams = {}) {
    // Current date in RFC format
    const date = new Date();
    const dateString = date.toUTCString();
    
    // Build query string
    const queryString = Object.keys(queryParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');
    
    // Build the full path
    let fullPath = path;
    if (!fullPath.startsWith('/')) {
      fullPath = '/' + fullPath;
    }
    fullPath = queryString ? `${fullPath}?${queryString}` : fullPath;
    
    // Build string to sign
    const stringToSign = [
      method.toLowerCase(),
      fullPath.toLowerCase(),
      dateString.toLowerCase()
    ].join('\n');
    
    // Generate signature
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(stringToSign);
    const signature = hmac.digest('base64');
    
    // Generate nonce
    const nonce = crypto.randomBytes(16).toString('base64');
    
    // Return auth headers
    return {
      'Date': dateString,
      'On-Nonce': nonce,
      'Authorization': `On ${this.accessKey}:${signature}`
    };
  }
  
  /**
   * Make authenticated request to Onshape API
   * @private
   */
  async _request(method, path, options = {}) {
    const { data, queryParams = {} } = options;
    
    try {
      // Generate auth headers
      const authHeaders = this.buildAuthHeaders(method, path, queryParams);
      
      // Make request with auth headers
      const response = await this.client.request({
        method,
        url: path,
        params: queryParams,
        data,
        headers: authHeaders
      });
      
      return response.data;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || 'Unknown API error';
        log.error(`API error ${status}: ${message}`, { path, method, status });
        throw new OnshapeApiError(`API error (${status}): ${message}`, error);
      }
      
      log.error(`API request failed: ${error.message}`);
      throw new OnshapeApiError('API request failed', error);
    }
  }
  
  /**
   * Make GET request
   */
  get(path, options = {}) {
    return this._request('GET', path, options);
  }
  
  /**
   * Make POST request
   */
  post(path, data, options = {}) {
    return this._request('POST', path, { ...options, data });
  }
  
  /**
   * Make PUT request
   */
  put(path, data, options = {}) {
    return this._request('PUT', path, { ...options, data });
  }
  
  /**
   * Make DELETE request
   */
  delete(path, options = {}) {
    return this._request('DELETE', path, options);
  }
}

module.exports = RestApi;