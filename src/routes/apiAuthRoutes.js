// src/routes/apiAuthRoutes.js
const express = require('express');
const router = express.Router();
const { isAuthenticated, createClientFromRequest } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const { OnshapeClient } = require('../api/client');

// Create a scoped logger
const log = logger.scope('ApiAuthRoutes');

/**
 * @route GET /api/auth/status
 * @description Check authentication status
 * @access Public
 */
router.get('/status', (req, res) => {
  const authenticated = req.isAuthenticated() || (req.session && !!req.session.oauthToken);
  
  // Get auth method from auth manager
  const authManager = req.app.get('authManager');
  const authMethod = authManager ? authManager.getMethod() : null;
  
  res.json({ 
    authenticated,
    method: authMethod || 'none'
  });
});

/**
 * @route GET /api/auth/method
 * @description Get current authentication method
 * @access Public
 */
router.get('/method', (req, res) => {
  const authManager = req.app.get('authManager');
  log.debug('Authentication method requested by client');
  
  res.json({
    method: authManager.getMethod(),
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false
  });
});

/**
 * @route GET /api/auth/token-debug
 * @description Debug endpoint to verify token state across different sources
 * @access Public
 */
router.get('/token-debug', (req, res) => {
  // Check session
  const sessionToken = req.session?.oauthToken;
  // Check passport user
  const passportToken = req.user?.accessToken;
  // Check auth manager
  const authManager = req.app.get('authManager');
  const managerToken = authManager?.accessToken;
  const authMethod = authManager?.getMethod();
  
  // For API key auth, we're authenticated if the manager has an API key
  const apiKeyAuthenticated = 
    authMethod === 'apikey' && 
    Boolean(authManager?.accessKey) && 
    Boolean(authManager?.secretKey);
  
  // Consider authenticated if either:
  // 1. Using OAuth and have a valid token
  // 2. Using API key and have valid API key credentials
  const isAuthenticated = 
    (req.isAuthenticated && req.isAuthenticated()) || 
    (authMethod === 'apikey' && apiKeyAuthenticated);
  
  res.json({
    authenticated: Boolean(isAuthenticated),
    authMethod: authMethod || 'none',
    hasSessionToken: !!sessionToken,
    sessionTokenLength: sessionToken ? sessionToken.length : 0,
    hasPassportToken: !!passportToken,
    passportTokenLength: passportToken ? passportToken.length : 0,
    hasManagerToken: !!managerToken,
    managerTokenLength: managerToken ? managerToken.length : 0,
    // API key specific info (only showing presence, not the actual keys)
    hasApiKey: authMethod === 'apikey' && !!authManager?.accessKey,
    apiKeyAuthenticated: Boolean(apiKeyAuthenticated),
    // Only show token fragments for security
    tokenFirstChars: managerToken ? managerToken.substring(0, 5) + '...' : null,
    tokenLastChars: managerToken ? '...' + managerToken.substring(managerToken.length - 5) : null,
  });
});

/**
 * @route GET /api/auth/test
 * @description Test the authentication with a simple API call
 * @access Private
 */
router.get('/test', isAuthenticated, async (req, res) => {
  try {
    // Get auth manager
    const authManager = req.app.get('authManager');
    if (!authManager) {
      return res.status(500).json({ 
        success: false, 
        error: 'Auth manager not found in app context' 
      });
    }
    
    // Get auth method and create client
    const authMethod = authManager.getMethod();
    log.info(`Testing authentication with method: ${authMethod}`);
    
    // Create client using authMiddleware helper
    const client = createClientFromRequest(req, OnshapeClient);
    if (!client) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create Onshape client' 
      });
    }
    
    // Test auth by making a simple API call
    log.info('Making test API call to Onshape');
    
    try {
      // Try a simple API call to test authentication
      const result = await client.api.get('/users/sessioninfo');
      
      // Log success and return detailed response
      log.info('Authentication test successful');
      return res.json({
        success: true,
        method: authMethod,
        message: 'Authentication test successful',
        response: result
      });
    } catch (apiError) {
      log.error(`API call failed: ${apiError.message}`, apiError);
      
      // Return detailed error information
      return res.status(apiError.response?.status || 500).json({
        success: false,
        error: 'Test API call failed',
        details: {
          message: apiError.message,
          statusCode: apiError.response?.status,
          statusText: apiError.response?.statusText,
          data: apiError.response?.data
        }
      });
    }
  } catch (error) {
    log.error('Error during authentication test:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Authentication test failed',
      details: error.message 
    });
  }
});

module.exports = router;