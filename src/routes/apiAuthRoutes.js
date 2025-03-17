// src/routes/apiAuthRoutes.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const log = logger.scope('ApiAuthRoutes');

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

  return router;
};