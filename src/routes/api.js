// src/routes/api.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const log = logger.scope('API');

module.exports = function(app, auth) {
  // Mount auth routes
  router.use('/auth', require('./apiAuthRoutes')(app, auth));
  
  // Mount document routes
  router.use('/documents', require('./documents')(app, auth));
  
  // Mount feature-related routes without additional prefix
  router.use(require('./partstudios')(app, auth));
  router.use(require('./features')(app, auth));
  router.use(require('./planes')(app, auth));
  
  // Mount SVG converter routes
  router.use(require('./svg-converter')(app, auth));
  
  // Mount examples routes
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

  log.info('API routes initialized');
  return router;
};