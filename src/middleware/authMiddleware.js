// src\middleware\authMiddleware.js
const passport = require('passport');
const { Strategy: OAuth2Strategy } = require("passport-oauth2");
const logger = require('../utils/logger');
const config = require('../../config');
const { AuthenticationError } = require('../utils/errors');

// Create a scoped logger
const log = logger.scope('AuthMiddleware');

/**
 * Configure OAuth2 strategy
 * @param {Object} authManager - Auth manager instance
 */
function configureOAuth(authManager) {
  // Check if we have OAuth credentials before configuring
  if (!config.onshape.clientId || !config.onshape.clientSecret) {
    log.warn('OAuth credentials not found. OAuth authentication will not be available.');
    log.warn('Set ONSHAPE_CLIENT_ID and ONSHAPE_CLIENT_SECRET environment variables to enable OAuth.');
    return;
  }

  // Configure OAuth2 strategy for Onshape
  log.info('Configuring OAuth2 strategy with:', {
    authorizationURL: config.onshape.authorizationUrl,
    tokenURL: config.onshape.tokenUrl,
    clientID: config.onshape.clientId ? 'Set' : 'Not set',
    callbackURL: config.onshape.callbackUrl,
  });

  try {
    passport.use(
      new OAuth2Strategy(
        {
          authorizationURL: config.onshape.authorizationUrl,
          tokenURL: config.onshape.tokenUrl,
          clientID: config.onshape.clientId,
          clientSecret: config.onshape.clientSecret,
          callbackURL: config.onshape.callbackUrl,
          scope: 'OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete',
          state: true // Enable state parameter for CSRF protection
        },
        function (accessToken, refreshToken, profile, done) {
          log.debug('OAuth tokens received:', !!accessToken, !!refreshToken);
          log.debug('Token length:', accessToken ? accessToken.length : 0);
     
          // Store tokens with the user profile
          return done(null, {
            accessToken,
            refreshToken,
          });
        }
      )
    );

    // Serialize user to session
    passport.serializeUser((user, done) => {
      log.debug('Serializing user to session');
      done(null, user);
    });

    // Deserialize user from session
    passport.deserializeUser((user, done) => {
      log.debug('Deserializing user from session');
      done(null, user);
    });
    
    return true;
  } catch (error) {
    log.error(`Error configuring OAuth: ${error.message}`);
    return false;
  }
}

/**
 * Middleware to check if user is authenticated
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function isAuthenticated(req, res, next) {
  // Get the auth manager from app
  const authManager = req.app.get('authManager');
  
  if (!authManager) {
    log.error('No auth manager found in app context');
    return res.status(500).json({ error: 'Authentication configuration error' });
  }
  
  // Check auth method and credentials
  const authMethod = authManager.getMethod();
  log.debug(`Current auth method: ${authMethod || 'none'}`);
  
  // Handle different authentication scenarios
  if (authMethod === 'oauth') {
    if (req.user && req.user.accessToken) {
      // Update auth manager with user's OAuth token if needed
      if (authManager.accessToken !== req.user.accessToken) {
        authManager.accessToken = req.user.accessToken;
        authManager.refreshToken = req.user.refreshToken || null;
        authManager.setMethod('oauth');
        log.debug('Updated auth manager with user OAuth tokens from req.user');
      }
      return next();
    } else if (req.session && req.session.oauthToken) {
      // Alternative: check for token in session
      if (authManager.accessToken !== req.session.oauthToken) {
        authManager.accessToken = req.session.oauthToken;
        authManager.refreshToken = req.session.refreshToken || null;
        authManager.setMethod('oauth');
        log.debug('Updated auth manager with OAuth tokens from session');
      }
      return next();
    }
  } else if (authMethod === 'apikey' && 
             process.env.ONSHAPE_ACCESS_KEY && 
             process.env.ONSHAPE_SECRET_KEY) {
    // Verify that API key credentials are actually present
    if (authManager.accessKey !== process.env.ONSHAPE_ACCESS_KEY) {
      authManager.accessKey = process.env.ONSHAPE_ACCESS_KEY;
      authManager.secretKey = process.env.ONSHAPE_SECRET_KEY;
      log.debug('Updated auth manager with latest API key credentials');
    }
    return next();
  }
  
  // If we reach here, redirect to OAuth login for web requests
  // or return 401 for API requests
  if (req.xhr || req.path.startsWith('/api/')) {
    log.info('API request not authenticated, returning 401');
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please authenticate to access this resource'
    });
  } else {
    log.info('User not authenticated, redirecting to OAuth login');
    
    // Check if OAuth is available before redirecting
    if (!config.onshape.clientId) {
      return res.status(503).json({
        error: 'Authentication unavailable',
        message: 'OAuth authentication is not configured. Set ONSHAPE_CLIENT_ID and ONSHAPE_CLIENT_SECRET environment variables.'
      });
    }
    
    return res.redirect('/oauth/login');
  }
}

/**
 * Create an Onshape client for the current user
 * @param {Object} req - Express request object
 * @param {Object} onshapeClient - Onshape client factory
 * @returns {Object} Configured Onshape client
 */
function createClientFromRequest(req, onshapeClient) {
  // Get application's authManager
  const authManager = req.app.get('authManager');
  
  if (!authManager) {
    throw new AuthenticationError('No auth manager found in app context');
  }
  
  // Set authentication credentials based on request
  if (req.user && req.user.accessToken) {
    // Use OAuth token from req.user
    authManager.accessToken = req.user.accessToken;
    authManager.refreshToken = req.user.refreshToken || null;
    authManager.setMethod('oauth');
    log.debug('Using OAuth token from req.user');
  } else if (req.session && req.session.oauthToken) {
    // Use token from session
    authManager.accessToken = req.session.oauthToken;
    authManager.refreshToken = req.session.refreshToken || null;
    authManager.setMethod('oauth');
    log.debug('Using OAuth token from session');
  } else if (process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY) {
    // Only fall back to API key if we have valid credentials and no OAuth tokens
    authManager.accessKey = process.env.ONSHAPE_ACCESS_KEY;
    authManager.secretKey = process.env.ONSHAPE_SECRET_KEY;
    authManager.setMethod('apikey');
    log.debug('Using API key authentication as fallback');
  } else {
    // Log warning if no valid authentication method is available
    log.warn('No valid authentication credentials available');
  }
  
  // Create client with the configured auth manager
  return onshapeClient.createClient({
    authManager: authManager,
    unitSystem: config.auth.unitSystem || "inch",
    baseUrl: config.onshape.baseUrl
  });
}

module.exports = {
  configureOAuth,
  isAuthenticated,
  createClientFromRequest,
  passport
};