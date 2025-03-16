// src/middleware/authMiddleware.js
const passport = require('passport');
const OnshapeStrategy = require('passport-onshape').Strategy;
const ApiKeyStrategy = require('passport-headerapikey').HeaderAPIKeyStrategy;
const OnshapeClient = require('../api/client');
const AuthManager = require('../auth/auth-manager');
const config = require('../config');
const logger = require('../utils/logger');

// Scoped logger
const log = logger.scope('AuthMiddleware');

/**
 * Authentication middleware
 */
module.exports = function(app) {
  // Passport configuration
  passport.use(new OnshapeStrategy({
      clientID: config.onshape.oauthClientId,
      clientSecret: config.onshape.oauthClientSecret,
      callbackURL: config.onshape.callbackUrl,
      authorizationURL: config.onshape.authorizationUrl,
      tokenURL: config.onshape.tokenUrl,
      userURL: config.onshape.userUrl,
      scope: 'OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete'
    },
    function(accessToken, refreshToken, profile, done) {
      // asynchronous verification, for effect...
      process.nextTick(function () {

        // To keep the example simple, the user's Onshape profile is supplied to
        // the route handler after being serialized to the session.  In a real
        // application, the Onshape profile would typically be used to find or
        // create a user record, and associate the Onshape account with that
        // user.
        profile.accessToken = accessToken;
        profile.refreshToken = refreshToken;
        return done(null, profile);
      });
    }
  ));

  // API Key strategy
  passport.use(new ApiKeyStrategy({ header: 'Authorization', prefix: 'On ' },
    false,
    async (apiKey, done) => {
      try {
        // Validate the API key
        const [accessKey, signature] = apiKey.split(':HmacSHA256:');
        if (!accessKey || !signature) {
          return done(null, false, { message: 'Invalid API key format' });
        }

        // Verify the API key against stored credentials (replace with your actual verification logic)
        const authManager = app.get('authManager');
        if (!authManager || authManager.accessKey !== accessKey) {
          return done(null, false, { message: 'Invalid API key' });
        }

        // API key is valid, create a user object
        const user = {
          accessKey: accessKey,
          apiKey: apiKey,
          method: 'apikey'
        };
        return done(null, user);
      } catch (error) {
        log.error('API Key authentication error:', error);
        return done(error);
      }
    }
  ));

  // Passport session serialization/deserialization
  passport.serializeUser(function(user, done) {
    done(null, user);
  });

  passport.deserializeUser(function(user, done) {
    done(null, user);
  });

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Authentication check middleware
  app.use(function(req, res, next) {
    // Check if the user is authenticated
    if (req.isAuthenticated() || (req.user && req.user.method === 'apikey')) {
      return next();
    }

    // For API requests, return a 401 Unauthorized response
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    // For non-API requests, redirect to the login page
    res.redirect('/oauth/login');
  });

  // Helper function to create Onshape client from request
  global.createClientFromRequest = (req, ClientClass = OnshapeClient) => {
    const authManager = req.app.get('authManager');
    if (!authManager) {
      log.error('No auth manager found in app context');
      return null;
    }

    try {
      // Create client based on authentication method
      const clientOptions = {
        baseurl: config.onshape.baseUrl,
        authManager: authManager,
        debug: config.debug
      };
      const client = new ClientClass(clientOptions);
      log.info(`Initialized ${ClientClass.name} with ${authManager.getMethod()} authentication`);
      return client;
    } catch (error) {
      log.error(`Failed to create Onshape client: ${error.message}`, error);
      return null;
    }
  };

  // Is authenticated middleware
  global.isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated() || (req.user && req.user.method === 'apikey')) {
      return next();
    }

    // For API requests, return a 401 Unauthorized response
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    // For non-API requests, redirect to the login page
    res.redirect('/oauth/login');
  };
};