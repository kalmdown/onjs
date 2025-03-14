// src\routes\authRoutes.js
const express = require('express');
const router = express.Router();
const { passport } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// Create a scoped logger
const log = logger.scope('AuthRoutes');

/**
 * @route GET /oauth/login
 * @description Initiate OAuth login flow with Onshape
 * @access Public
 */
router.get("/login", passport.authenticate("oauth2"));

/**
 * @route GET /oauth/callback
 * @description OAuth callback endpoint
 * @access Public
 */
router.get('/callback', function(req, res, next) {
  log.info('OAuth callback received, code:', req.query.code ? 'Present (length: ' + req.query.code.length + ')' : 'Missing');
  log.info('Full URL:', req.originalUrl);
  log.info('Query string:', JSON.stringify(req.query));
  
  // For debugging, log query parameters without actual values
  if (process.env.NODE_ENV === 'development') {
    log.debug('Query parameters:', Object.keys(req.query));
  }
  
  next();
}, passport.authenticate('oauth2', { 
  failureRedirect: '/?error=auth_failed',
  session: true
}), function(req, res) {
  log.info('OAuth authentication successful');
  log.info('User object:', req.user ? 'Present' : 'Missing');
  log.info('Access token:', req.user?.accessToken ? 'Present (length: ' + req.user.accessToken.length + ')' : 'Missing');
  
  if (req.user && req.user.accessToken) {
    log.debug('Token length:', req.user.accessToken.length);
    log.debug('Refresh token present:', !!req.user.refreshToken);
    
    // Store tokens in session for non-passport requests
    req.session.oauthToken = req.user.accessToken;
    req.session.refreshToken = req.user.refreshToken || null;
    
    // Update the auth manager with tokens
    const authManager = req.app.get('authManager');
    if (authManager) {
      authManager.accessToken = req.user.accessToken;
      authManager.refreshToken = req.user.refreshToken || null;
      authManager.setMethod('oauth');
      log.info('Updated global auth manager with OAuth tokens');
    } else {
      log.warn('No auth manager found in app context');
    }
    
    // Include tokens in URL for client-side
    const redirectUrl = `/?token=${encodeURIComponent(req.user.accessToken)}&refresh=${encodeURIComponent(req.user.refreshToken || '')}`;
    log.info('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } else {
    log.error('Missing tokens in user object after OAuth authentication');
    res.redirect('/?error=missing_tokens');
  }
});

/**
 * @route GET /oauth/logout
 * @description Log out user and clear session
 * @access Public
 */
router.get("/logout", (req, res) => {
  // Clear the auth tokens from session
  if (req.session) {
    delete req.session.oauthToken;
    delete req.session.refreshToken;
  }
  
  // Use Passport's logout function if available
  if (req.logout) {
    req.logout(() => {
      log.info('User logged out');
      res.redirect("/");
    });
  } else {
    log.info('User logged out (without passport)');
    res.redirect("/");
  }
});

/**
 * @route GET /oauth/status
 * @description Check authentication status
 * @access Public
 */
router.get("/status", (req, res) => {
  const authenticated = req.isAuthenticated() || (req.session && !!req.session.oauthToken);
  
  // Get auth method from auth manager
  const authManager = req.app.get('authManager');
  const authMethod = authManager ? authManager.getMethod() : null;
  
  res.json({ 
    authenticated,
    method: authMethod || 'none'
  });
});

module.exports = router;