// src/middleware/authMiddleware.js
const passport = require('passport');
const ApiKeyStrategy = require('passport-headerapikey').HeaderAPIKeyStrategy;
const OnshapeClient = require('../api/client');
const AuthManager = require('../auth/auth-manager');
const config = require('../../config'); // Updated path to config module
const logger = require('../utils/logger');
const axios = require('axios');

// Scoped logger
const log = logger.scope('AuthMiddleware');

// Helper function to create Onshape client from request
const createClientFromRequest = (req, ClientClass = OnshapeClient) => {
  const authManager = req.app.get('authManager');
  if (!authManager) {
    log.error('No auth manager found in app context');
    return null;
  }

  try {
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

// Authentication check middleware
const isAuthenticated = (req, res, next) => {
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

/**
 * Authentication middleware
 */
module.exports = function(app) {
  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

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
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  // Configure OAuth function
  function configureOAuth(authManager) {
    app.get('/oauth/login', (req, res) => {
      const authUrl = `${config.onshape.authorizationURL}?client_id=${config.onshape.clientId}&redirect_uri=${config.onshape.callbackUrl}&response_type=code&scope=OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete`;
      res.redirect(authUrl);
    });

    app.get('/oauth/callback', async (req, res) => {
      const { code } = req.query;

      try {
        const tokenResponse = await axios.post(
          config.onshape.tokenURL,
          new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: config.onshape.clientId,
            client_secret: config.onshape.clientSecret,
            redirect_uri: config.onshape.callbackUrl,
            code: code,
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        const { access_token, refresh_token } = tokenResponse.data;

        log.info('OAuth callback successful');
        req.session.oauthToken = access_token;
        req.session.refreshToken = refresh_token;
        res.redirect('/');
      } catch (error) {
        log.error('OAuth callback failed', error);
        res.redirect('/oauth/login');
      }
    });
  }

  // Return middleware functions
  return {
    configureOAuth,
    isAuthenticated,
    createClientFromRequest
  };
};