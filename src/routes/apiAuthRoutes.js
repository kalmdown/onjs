// src/routes/apiAuthRoutes.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const log = logger.scope('ApiAuthRoutes');

module.exports = function(app, auth) {
  const { isAuthenticated } = auth;

  router.get('/status', isAuthenticated, async (req, res, next) => {
    try {
      const authManager = req.app.get('authManager');
      res.json({
        authenticated: true,
        method: authManager.getMethod()
      });
    } catch (error) {
      log.error(`Error checking auth status: ${error.message}`);
      next(error);
    }
  });

  return router;
};