// src/middleware/fix-auth.js
const express = require('express');
const logger = require('../utils/logger');

const log = logger.scope('Auth');

function createFallbackAuthRoutes() {
  const router = express.Router();
  
  // Create a fallback login route when OAuth is not configured
  router.get("/login", (req, res) => {
    log.warn('OAuth authentication not configured');
    return res.status(503).json({
      error: 'Authentication unavailable',
      message: 'OAuth authentication is not configured. Set ONSHAPE_CLIENT_ID and ONSHAPE_CLIENT_SECRET environment variables.'
    });
  });
  
  // Handle callback routes
  router.get('/callback', (req, res) => {
    return res.redirect('/?error=oauth_not_configured');
  });
  
  router.get('/oauthRedirect', (req, res) => {
    return res.redirect('/?error=oauth_not_configured');
  });
  
  // Status endpoint
  router.get("/status", (req, res) => {
    res.json({ 
      authenticated: false,
      method: 'none',
      message: 'OAuth authentication is not configured'
    });
  });
  
  return router;
}

module.exports = { createFallbackAuthRoutes };