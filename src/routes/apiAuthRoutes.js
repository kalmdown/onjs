// src/routes/apiAuthRoutes.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const log = logger.scope('Auth');

module.exports = function(app, auth) {
  // Get the authentication method
  router.get('/method', (req, res) => {
    const authManager = req.app.get('authManager');
    const method = authManager ? authManager.getMethod() : 'none';
    
    log.info(`Auth method requested: ${method}`);
    
    res.json({
      method: method || 'none'
    });
  });

  // Test authentication endpoint
  router.get('/test', auth.isAuthenticated, (req, res) => {
    const authManager = req.app.get('authManager');
    const method = authManager ? authManager.getMethod() : 'none';
    
    log.info(`Auth test requested, method: ${method}`);
    
    res.json({
      success: true,
      method: method,
      message: 'Authentication successful'
    });
  });

  // Authentication status endpoint
  router.get('/status', (req, res) => {
    const authManager = req.app.get('authManager');
    const isAuthenticated = req.isAuthenticated && req.isAuthenticated() || 
                           (authManager && authManager.getMethod() === 'apikey');
    
    res.json({
      authenticated: isAuthenticated,
      method: authManager ? authManager.getMethod() : 'none'
    });
  });

  /**
   * @route GET /api/auth/debug
   * @description Test client configuration and API connectivity
   * @access Private
   */
  router.get('/debug', auth.isAuthenticated, async (req, res) => {
    try {
      // Get auth manager info
      const authManager = req.app.get('authManager');
      const authMethod = authManager ? authManager.getMethod() : 'none';
      
      // Check if client is available
      if (!req.onshapeClient) {
        log.error('No Onshape client available on request');
        return res.status(500).json({
          error: 'Client not initialized',
          authMethod,
          isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false
        });
      }
      
      // Return detailed diagnostic information
      res.json({
        success: true,
        authMethod,
        isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
        requestInfo: {
          hasClient: !!req.onshapeClient,
          clientType: req.onshapeClient ? req.onshapeClient.constructor.name : 'none',
          clientHasGet: typeof req.onshapeClient.get === 'function',
          clientHasRequest: typeof req.onshapeClient.request === 'function'
        }
      });
    } catch (error) {
      log.error('Debug endpoint error:', error);
      res.status(500).json({
        error: error.message,
        stack: error.stack
      });
    }
  });

  /**
   * @route GET /api/auth/test-api-key
   * @description Test API key authentication
   * @access Public
   */
  router.get('/test-api-key', (req, res) => {
    const authManager = req.app.get('authManager');
    
    if (!authManager) {
      log.error('Auth manager not available');
      return res.status(500).json({
        success: false,
        message: 'Auth manager not available'
      });
    }
    
    const accessKey = authManager.accessKey;
    const secretKey = authManager.secretKey;
    
    if (!accessKey || !secretKey) {
      log.error('API key credentials not available');
      return res.status(400).json({
        success: false,
        message: 'API key credentials not available'
      });
    }
    
    try {
      // Create Basic Auth header for debugging
      const credentials = Buffer.from(`${accessKey}:${secretKey}`).toString('base64');
      
      res.json({
        success: true,
        method: authManager.getMethod(),
        accessKeyLength: accessKey.length,
        secretKeyLength: secretKey.length,
        headers: {
          basicAuth: {
            format: `Basic ${accessKey.substring(0, 4)}...${accessKey.substring(accessKey.length - 4)}:***`,
            ready: !!credentials
          }
        }
      });
    } catch (error) {
      log.error('Error testing API key:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  /**
   * @route GET /api/auth/test-direct-call
   * @description Test direct API calls using different auth methods
   * @access Public
   */
  router.get('/test-direct-call', async (req, res) => {
    const axios = require('axios');
    const authManager = req.app.get('authManager');
    
    if (!authManager) {
      log.error('Auth manager not available');
      return res.status(500).json({
        success: false,
        message: 'Auth manager not available'
      });
    }
    
    const accessKey = authManager.accessKey;
    const secretKey = authManager.secretKey;
    
    if (!accessKey || !secretKey) {
      log.error('API key credentials not available');
      return res.status(400).json({
        success: false,
        message: 'API key credentials not available'
      });
    }
    
    // Get the base URL from config
    const config = req.app.get('config');
    const baseUrl = config?.onshape?.baseUrl || 'https://cad.onshape.com';
    
    // Test endpoint path
    const testPath = '/api/v6/users/sessioninfo';
    const testUrl = `${baseUrl}${testPath}`;
    
    // Results object
    const results = {
      baseUrl,
      testUrl,
      basicAuth: { success: false },
      currentAuth: { success: false }
    };
    
    log.debug(`Testing API calls to ${testUrl}`);
    
    // Test with Basic Auth (like permissions-test.js)
    try {
      log.debug('Testing with Basic Auth');
      
      // Create Basic Auth header
      const credentials = Buffer.from(`${accessKey}:${secretKey}`).toString('base64');
      const basicAuthHeaders = {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      const basicAuthResponse = await axios({
        method: 'GET',
        url: testUrl,
        headers: basicAuthHeaders,
        timeout: 10000 // 10 second timeout
      });
      
      results.basicAuth = {
        success: true,
        status: basicAuthResponse.status,
        hasData: !!basicAuthResponse.data,
        dataType: typeof basicAuthResponse.data
      };
      
      // If response includes OAuth scopes, analyze them
      if (basicAuthResponse.data && basicAuthResponse.data.oauth2Scopes) {
        const scopes = basicAuthResponse.data.oauth2Scopes;
        results.basicAuth.scopes = {
          raw: scopes,
          formattedScopes: typeof scopes === 'string' ? scopes : null
        };
      }
    } catch (error) {
      log.error(`Basic Auth test failed: ${error.message}`);
      results.basicAuth = {
        success: false,
        status: error.response?.status,
        error: error.response?.data?.message || error.message
      };
    }
    
    // Test with current auth implementation
    try {
      log.debug('Testing with current auth implementation');
      
      // Get headers using current implementation
      const currentAuthHeaders = authManager.getAuthHeaders('GET', testPath);
      
      const currentAuthResponse = await axios({
        method: 'GET',
        url: testUrl,
        headers: currentAuthHeaders,
        timeout: 10000 // 10 second timeout
      });
      
      results.currentAuth = {
        success: true,
        status: currentAuthResponse.status,
        hasData: !!currentAuthResponse.data,
        dataType: typeof currentAuthResponse.data
      };
      
      // If response includes OAuth scopes, analyze them
      if (currentAuthResponse.data && currentAuthResponse.data.oauth2Scopes) {
        const scopes = currentAuthResponse.data.oauth2Scopes;
        results.currentAuth.scopes = {
          raw: scopes,
          formattedScopes: typeof scopes === 'string' ? scopes : null
        };
      }
    } catch (error) {
      log.error(`Current auth test failed: ${error.message}`);
      results.currentAuth = {
        success: false,
        status: error.response?.status,
        error: error.response?.data?.message || error.message
      };
    }
    
    // Compare the results
    results.comparison = {
      bothSucceeded: results.basicAuth.success && results.currentAuth.success,
      onlyBasicAuthSucceeded: results.basicAuth.success && !results.currentAuth.success,
      onlyCurrentAuthSucceeded: !results.basicAuth.success && results.currentAuth.success,
      bothFailed: !results.basicAuth.success && !results.currentAuth.success
    };
    
    // Log the results
    const summary = results.comparison.bothSucceeded ? 'Both auth methods succeeded' :
                   results.comparison.onlyBasicAuthSucceeded ? 'Only Basic Auth succeeded' :
                   results.comparison.onlyCurrentAuthSucceeded ? 'Only current auth succeeded' :
                   'Both auth methods failed';
    
    log.info(`Direct API call test results: ${summary}`);
    
    // Return results
    res.json(results);
  });

  router.source = __filename;
  
  return router;
};