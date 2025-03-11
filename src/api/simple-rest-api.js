/**
 * Simplified Onshape REST API client - verified working version
 */
const axios = require('axios');
const crypto = require('crypto');

class SimpleRestApi {
  constructor(options) {
    this.accessKey = options.accessKey;
    this.secretKey = options.secretKey;
    this.baseUrl = options.baseUrl || 'https://cad.onshape.com/api';
    
    // Remove trailing slash if present
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('SimpleRestApi initialized');
  }
  
  /**
   * Build the string to be signed for authentication
   */
  _buildStringToSign(method, path, queryString, date) {
    // Format method to lowercase
    method = method.toLowerCase();
    
    // Ensure path starts with a slash
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Format path with query string if present
    const pathWithQuery = queryString ? `${path}?${queryString}` : path;
    
    // Format date for Onshape authentication
    const dateStr = date.toUTCString().toLowerCase();
    
    // Build the string to sign: method + path + date
    return `${method}\n${pathWithQuery.toLowerCase()}\n${dateStr}`;
  }
  
  /**
   * Generate authentication headers for Onshape API
   */
  _generateAuthHeaders(method, path, queryParams = {}) {
    // Current date for the request
    const date = new Date();
    const dateString = date.toUTCString();
    
    // Build query string
    const queryString = Object.entries(queryParams)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    
    // Build string to sign
    const stringToSign = this._buildStringToSign(method, path, queryString, date);
    
    // Generate HMAC signature
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(stringToSign);
    const signature = hmac.digest('base64');
    
    // Random nonce for additional security
    const nonce = crypto.randomBytes(16).toString('base64');
    
    // Return headers object
    return {
      'Date': dateString,
      'On-Nonce': nonce,
      'Authorization': `On ${this.accessKey}:${signature}`
    };
  }
  
  /**
   * Make a request to the Onshape API
   */
  async request(method, path, data = null, queryParams = {}) {
    try {
      // Generate auth headers
      const authHeaders = this._generateAuthHeaders(method, path, queryParams);
      
      // Make request
      const response = await this.client({
        method: method,
        url: path,
        data: data,
        params: queryParams,
        headers: authHeaders
      });
      
      return response.data;
    } catch (error) {
      // Log error details
      console.error(`API Error (${error.response?.status}):`, error.response?.data || error.message);
      
      // Re-throw with more context
      throw new Error(`API request failed: ${error.message}`);
    }
  }
  
  // Helper methods for common HTTP verbs
  async get(path, queryParams = {}) {
    return this.request('GET', path, null, queryParams);
  }
  
  async post(path, data, queryParams = {}) {
    return this.request('POST', path, data, queryParams);
  }
  
  async delete(path, queryParams = {}) {
    return this.request('DELETE', path, null, queryParams);
  }
}

module.exports = SimpleRestApi;// src\api\simple-rest-api.js
