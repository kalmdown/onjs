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
    
    // Create Basic Auth header
    const auth = Buffer.from(`${this.accessKey}:${this.secretKey}`).toString('base64');
    this.basicAuth = `Basic ${auth}`;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8; qs=0.09',
        'Accept': 'application/json;charset=UTF-8; qs=0.09',
        'Authorization': this.basicAuth
      }
    });
    
    console.log('SimpleRestApi initialized with base URL:', this.baseUrl);
  }
  
  /**
   * Generate authentication headers for Onshape API
   */
  _generateAuthHeaders(method, path, queryParams = {}, content = null) {
    const headers = {
      'Content-Type': 'application/json;charset=UTF-8; qs=0.09',
      'Accept': 'application/json;charset=UTF-8; qs=0.09',
      'Authorization': this.basicAuth
    };
    
    if (method.toLowerCase() === 'post' && content) {
      const contentString = JSON.stringify(content);
      headers['Content-MD5'] = crypto.createHash('md5').update(contentString).digest('base64');
    }
    
    return headers;
  }
  
  /**
   * Make a request to the Onshape API
   */
  async request(method, path, data = null, queryParams = {}) {
    try {
      // Generate auth headers with content for POST requests
      const authHeaders = this._generateAuthHeaders(method, path, queryParams, data);
      
      // Log request details
      const fullUrl = `${this.baseUrl}${path}`;
      console.log('\nRequest details:');
      console.log('URL:', fullUrl);
      console.log('Headers:', JSON.stringify(authHeaders, null, 2));
      if (data) {
        console.log('Payload:', JSON.stringify(data, null, 2));
      }
      
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

module.exports = SimpleRestApi;
