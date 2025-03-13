// src\auth\onshape-auth.js
/**
 * Onshape authentication utilities that work with Free accounts
 */
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

class OnshapeAuth {
  /**
   * Create authentication helper
   * @param {Object} options Authentication options
   * @param {string} options.accessKey API access key
   * @param {string} options.secretKey API secret key
   * @param {string} [options.baseUrl='https://cad.onshape.com/api'] API base URL
   */
  constructor(options) {
    this.accessKey = options.accessKey || process.env.ONSHAPE_ACCESS_KEY;
    this.secretKey = options.secretKey || process.env.ONSHAPE_SECRET_KEY;
    this.baseUrl = options.baseUrl || 'https://cad.onshape.com/api';
    this.logger = logger.scope('OnshapeAuth');
    
    // Check for valid credentials
    if (!this.accessKey || !this.secretKey) {
      throw new Error('OnshapeAuth requires accessKey and secretKey');
    }
    
    // Remove trailing slash if present
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
    
    // Create axios instance with defaults
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }
  
  /**
   * Build authentication headers for Onshape API
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} [queryParams={}] - Query parameters
   * @param {string} [body=''] - Request body for POST/PUT requests
   * @returns {Object} - Authentication headers
   */
  buildAuthHeaders(method, path, queryParams = {}, body = '') {
    // Current date in RFC format
    const date = new Date().toUTCString();
    
    // Build query string - must be sorted alphabetically
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
    
    // Generate nonce
    const nonce = crypto.randomBytes(16).toString('base64');
    
    // Content length
    const contentLength = Buffer.byteLength(body || '').toString();
    
    // Build string to sign, including body for all requests
    // This is the critical part that must match Onshape's expected format
    const stringToSign = [
      method.toUpperCase(),
      fullPath,
      date,
      nonce,
      contentLength,
      body || ''
    ].join('\n');
    
    // Generate signature
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(stringToSign)
      .digest('base64');
    
    this.logger.debug('Signature generated', {
      method,
      path,
      contentLength,
      hasBody: !!body
    });
    
    // Return auth headers
    return {
      'Date': date,
      'On-Nonce': nonce,
      'Content-Length': contentLength,
      'Authorization': `On ${this.accessKey}:${signature}`
    };
  }
  
  /**
   * Make authenticated request to Onshape API
   * @param {string} method HTTP method
   * @param {string} path API path
   * @param {Object} options Request options
   * @returns {Promise<Object>} Response data
   */
  async request(method, path, options = {}) {
    const { query = {}, body = null } = options;
    
    try {
      // Generate auth headers
      const headers = this.buildAuthHeaders(method, path, query, body);
      
      // Make request
      const response = await this.client({
        method: method,
        url: path,
        params: query,
        headers: headers,
        data: body
      });
      
      return response.data;
    } catch (error) {
      // Enhanced error handling
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 403) {
        console.error('Permission denied - Free account limitations may apply');
      }
      
      this.logger.error(`API request failed: ${message}`, {
        status,
        method,
        path
      });
      
      throw new Error(`API request failed (${status}): ${message}`);
    }
  }
  
  /**
   * Convenience methods for common HTTP verbs
   */
  async get(path, queryParams = {}) {
    try {
      // Create a safe copy of query parameters
      const safeParams = {};
      Object.keys(queryParams || {}).forEach(key => {
        safeParams[key] = queryParams[key] === undefined ? '' : String(queryParams[key]);
      });
      
      this.logger.debug(`Making GET request to ${path}`, { 
        params: safeParams,
        hasParams: Object.keys(safeParams).length > 0
      });
      
      return this.request('GET', path, safeParams);
    } catch (error) {
      this.logger.error(`GET request to ${path} failed:`, error);
      throw error;
    }
  }
  
  async post(path, body, query = {}) {
    return this.request('POST', path, { query, body });
  }
  
  async put(path, body, query = {}) {
    return this.request('PUT', path, { query, body });
  }
  
  async delete(path, query = {}) {
    return this.request('DELETE', path, { query });
  }
  
  /**
   * Create a public document (works with Free accounts)
   * @param {string} name Document name
   * @returns {Promise<Object>} Created document
   */
  async createPublicDocument(name) {
    return this.post('/documents', {
      name: name,
      isPublic: true // Required for Free accounts
    });
  }
  
  /**
   * Find public documents by name (useful for Free accounts)
   * @param {string} name Document name to search for
   * @returns {Promise<Array>} Matching documents
   */
  async findPublicDocuments(name) {
    // This uses the public documents search which works with Free accounts
    return this.get('/documents', {
      q: name,
      filter: 0 // Public documents
    });
  }
  
  /**
   * Find public documents by search query
   * @param {string} query - Search query
   * @returns {Promise<Object>} Search results
   */
  async findPublicDocuments(query) {
    // Use the global search API with the public flag
    const queryParams = {
      q: query,
      filter: 'public',
      limit: 20
    };
    
    this.logger.debug('Finding public documents with query:', query);
    return this.get('/documents', queryParams);
  }
  
  /**
   * Sign request
   * @param {string} method HTTP method
   * @param {string} path API path
   * @param {string} [body=''] Request body
   * @returns {Object} Signed request details
   */
  signRequest(method, path, body = '') {
    const date = new Date().toUTCString();
    const nonce = crypto.randomBytes(16).toString('base64');

    // Ensure body is a string
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const contentLength = Buffer.byteLength(bodyString).toString();

    // Build the string to sign
    const stringToSign = [
        method.toUpperCase(),
        path,
        date,
        nonce,
        contentLength,
        bodyString
    ].join("\n");

    const signature = crypto
        .createHmac('sha256', this.secretKey)
        .update(stringToSign)
        .digest('base64');

    return { date, nonce, contentLength, signature };
  }
}

module.exports = OnshapeAuth;