// src/routes/api.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const log = logger.scope('API');

module.exports = function(app, auth) {
  // Debug middleware for monitoring routes
  router.use((req, res, next) => {
    console.log(`[API Router] Processing: ${req.method} ${req.originalUrl}`);
    next();
  });

  // Mount auth routes with the correct prefix
  router.use('/auth', require('./apiAuthRoutes')(app, auth));
  
  // Mount document routes with clear logging
  console.log('Mounting document routes at /documents');
  router.use('/documents', function(req, res, next) {
    console.log(`[Document Router Pre] ${req.method} ${req.originalUrl}`);
    next();
  }, require('./documents')(app, auth));
  
  // Mount API-specific routes
  router.use('/partstudios', require('./partstudios')(app, auth));
  router.use('/features', require('./features')(app, auth));
  router.use('/planes', require('./planes')(app, auth));
  router.use('/svg', require('./svg-converter')(app, auth));
  router.use('/examples', require('./examples')(app, auth));
  
  // Debug endpoint
  router.get('/debug/auth', auth.isAuthenticated, (req, res) => {
    const authManager = req.app.get('authManager');
    res.json({
      isAuthenticated: true,
      authManager: {
        method: authManager.getMethod(),
        hasAccessKey: !!authManager.accessKey,
        hasSecretKey: !!authManager.secretKey,
        hasAccessToken: !!authManager.accessToken,
        hasRefreshToken: !!authManager.refreshToken
      },
      client: {
        type: req.onshapeClient?.constructor.name,
        baseUrl: req.onshapeClient?.baseUrl,
        apiUrl: req.onshapeClient?.apiUrl
      }
    });
  });

  // Add metrics endpoint
  router.get('/kd_metrics', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now()
    });
  });

  // Add a catch-all route for debugging unmatched API calls
  router.use('*', (req, res, next) => {
    if (req.originalUrl.includes('/documents/')) {
      console.log(`[API UNMATCHED] ${req.method} ${req.originalUrl}`);
    }
    next();
  });

  log.info('API routes initialized');
  return router;
};