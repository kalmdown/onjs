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
    log.warn('Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET environment variables to enable OAuth.');
    return false;
  }

  // Configure OAuth2 strategy for Onshape
  log.info('Configuring OAuth2 strategy with:', {
    authorizationURL: config.onshape.authorizationURL,
    tokenURL: config.onshape.tokenURL,
    clientID: config.onshape.clientId ? 'Set' : 'Not set',
    callbackURL: config.onshape.callbackUrl,
  });

  try {
    // Use a specific name for the strategy ('oauth2')
    passport.use('oauth2',
      new OAuth2Strategy(
        {
          authorizationURL: config.onshape.authorizationURL,
          tokenURL: config.onshape.tokenURL,
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
  
  // Enhanced debugging - log detailed auth state
  const authMethod = authManager.getMethod();
  log.debug(`Auth check: method=${authMethod}, path=${req.path}, session=${!!req.session}, user=${!!req.user}`);
  
  // Log API key details when using API key authentication
  if (authMethod === 'apikey') {
    log.debug('API Key auth details:', {
      hasAccessKey: !!authManager.accessKey,
      hasSecretKey: !!authManager.secretKey,
      accessKeyLength: authManager.accessKey ? authManager.accessKey.length : 0,
      envAccessKey: !!process.env.ONSHAPE_ACCESS_KEY,
      envSecretKey: !!process.env.ONSHAPE_SECRET_KEY,
      keysMatch: authManager.accessKey === process.env.ONSHAPE_ACCESS_KEY
    });
  }
  
  // Log OAuth token details when using OAuth authentication
  if (authMethod === 'oauth' || (!authMethod && (req.user?.accessToken || req.session?.oauthToken))) {
    log.debug('OAuth details:', {
      hasUserToken: !!req.user?.accessToken,
      userTokenLength: req.user?.accessToken ? req.user.accessToken.length : 0,
      hasSessionToken: !!req.session?.oauthToken,
      sessionTokenLength: req.session?.oauthToken ? req.session.oauthToken.length : 0,
      hasRefreshToken: !!(req.user?.refreshToken || req.session?.refreshToken)
    });
  }
  
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
  
  // If we reach here, authentication failed - log additional details
  log.warn(`Authentication failed for ${req.path}. Auth method: ${authMethod}`, {
    isXHR: !!req.xhr,
    isAPIRequest: req.path.startsWith('/api/'),
    hasSession: !!req.session,
    authAvailable: {
      oauth: !!config.onshape.clientId,
      apikey: !!(process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY)
    }
  });
  
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
 * Create an API client from the request
 * @param {Object} req - Express request object
 * @param {Function} ClientClass - Client class constructor (e.g. OnshapeClient)
 * @returns {Object} Configured API client instance
 */
function createClientFromRequest(req, ClientClass) {
  try {
    // Get the auth manager from app
    const authManager = req.app.get('authManager');
    
    if (!authManager) {
      log.error('No auth manager found in app context');
      return null;
    }
    
    // Log detailed info for debugging
    log.debug(`Creating client from request: authMethod=${authManager.getMethod()}`, {
      hasUserToken: !!req.user?.accessToken,
      hasSessionToken: !!req.session?.oauthToken,
      hasManagerToken: !!authManager.accessToken,
      authMethod: authManager.getMethod()
    });
    
    // For OAuth method, ensure we have the latest token from user or session
    if (req.user && req.user.accessToken && authManager.getMethod() === 'oauth') {
      authManager.accessToken = req.user.accessToken;
      authManager.refreshToken = req.user.refreshToken || null;
      log.debug('Updated auth manager with user OAuth token');
    } else if (req.session && req.session.oauthToken && authManager.getMethod() === 'oauth') {
      authManager.accessToken = req.session.oauthToken;
      authManager.refreshToken = req.session.refreshToken || null;
      log.debug('Updated auth manager with session OAuth token');
    }
    
    // Create a new client instance - ClientClass should be the constructor (like OnshapeClient)
    // The correct way to instantiate a class is with 'new', not calling a static method
    const client = new ClientClass({ authManager });
    
    log.debug('Client created successfully');
    return client;
  } catch (error) {
    log.error(`Error creating client from request: ${error.message}`);
    return null;
  }
}

module.exports = {
  configureOAuth,
  isAuthenticated,
  createClientFromRequest,
  passport
};