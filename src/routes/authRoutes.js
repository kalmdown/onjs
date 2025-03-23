// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const passport = require('passport');
const logger = require('../utils/logger');
const config = require('../../config');
const { createFallbackAuthRoutes } = require('../middleware/fix-auth');

// Create a scoped logger
const log = logger.scope('Auth');

/**
 * @route GET /oauth/login
 * @description Initiate OAuth login flow with Onshape
 * @access Public
 */
router.get("/login", function(req, res, next) {
  const authManager = req.app.get('authManager');
  log.info('OAuth login initiated from: ' + req.headers.referer);
  log.info('Redirect URL will be: ' + config.onshape.callbackUrl);
  
  // If we're using API key auth, just redirect with a success message
  if (authManager.getMethod() === 'apikey') {
    log.info('Using API key authentication - no OAuth needed');
    return res.redirect('/?auth=apikey&status=success');
  }
  
  // For OAuth method, proceed with the authentication
  log.info('Starting OAuth flow with config:', {
    clientId: config.onshape.clientId ? 'Set (masked)' : 'Not set',
    callbackUrl: config.onshape.callbackUrl,
    authUrl: config.onshape.authorizationURL
  });
  
  // Directly build the authorization URL and redirect the user
  const authUrl = `${config.onshape.authorizationURL}?client_id=${config.onshape.clientId}&response_type=code&redirect_uri=${encodeURIComponent(config.onshape.callbackUrl)}`;
  log.info('Redirecting to auth URL: ' + authUrl);
  
  return res.redirect(authUrl);
}, passport.authenticate("oauth2"));

/**
 * @route GET /oauth/callback
 * @description Handle OAuth callback
 * @access Public
 */
router.get('/callback', function(req, res, next) {
  log.info('OAuth callback received at /oauth/callback path');
  log.info('Code present:', !!req.query.code);
  log.info('State present:', !!req.query.state);
  
  // Store authentication code for use in the next middleware
  req.authCode = req.query.code;
  
  next();
}, passport.authenticate('oauth2', { 
  failureRedirect: '/?error=auth_failed',
  session: true
}), async function(req, res) {
  log.info('OAuth authentication successful');
  
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
  } else if (req.authCode) {
    // If we don't have user tokens but we have the auth code, try to exchange it manually
    log.info('No user tokens available, attempting to exchange code manually');
    try {
      const authManager = req.app.get('authManager');
      if (!authManager) {
        throw new Error('No auth manager available');
      }
      
      const tokenResponse = await authManager.exchangeCodeForToken(req.authCode);
      
      if (tokenResponse && tokenResponse.accessToken) {
        log.info('Successfully exchanged code for token manually');
        
        // Store in session
        req.session.oauthToken = tokenResponse.accessToken;
        req.session.refreshToken = tokenResponse.refreshToken || null;
        
        // Redirect with token
        const redirectUrl = `/?token=${encodeURIComponent(tokenResponse.accessToken)}&refresh=${encodeURIComponent(tokenResponse.refreshToken || '')}`;
        return res.redirect(redirectUrl);
      } else {
        log.error('Failed to exchange code for token manually');
        return res.redirect('/?error=token_exchange_failed');
      }
    } catch (error) {
      log.error('Error exchanging code for token:', error.message);
      return res.redirect('/?error=token_exchange_error');
    }
  } else {
    log.error('Missing tokens in user object after OAuth authentication');
    res.redirect('/?error=missing_tokens');
  }
});

/**
 * @route GET /oauthRedirect - Direct callback from Onshape
 * @description OAuth callback endpoint that matches what Onshape is using
 * @access Public
 */
router.get('/oauthRedirect', function(req, res, next) {
  log.info('OAuth callback received at /oauthRedirect path');
  log.info('Request URL: ' + req.originalUrl);
  log.info('Auth code present: ' + (req.query.code ? 'YES' : 'NO'));
  log.info('State param: ' + (req.query.state || 'none'));
  log.info('Error param: ' + (req.query.error || 'none'));
  
  // If there's an error, redirect with error
  if (req.query.error) {
    return res.redirect(`/?error=${encodeURIComponent(req.query.error)}`);
  }
  
  // If no code, redirect with error
  if (!req.query.code) {
    return res.redirect('/?error=no_code_provided');
  }
  
  // Store code for use in passport authentication or manual exchange
  req.authCode = req.query.code;
  
  next();
}, passport.authenticate('oauth2', { 
  failureRedirect: '/?error=auth_failed',
  session: true
}), async function(req, res) {
  // Same logic as the /callback route
  log.info('OAuth authentication successful through /oauthRedirect');
  
  if (req.user && req.user.accessToken) {
    // Store tokens in session
    req.session.oauthToken = req.user.accessToken;
    req.session.refreshToken = req.user.refreshToken || null;
    
    // Update auth manager
    const authManager = req.app.get('authManager');
    if (authManager) {
      authManager.accessToken = req.user.accessToken;
      authManager.refreshToken = req.user.refreshToken || null;
      authManager.setMethod('oauth');
    }
    
    // Redirect with tokens
    const redirectUrl = `/?token=${encodeURIComponent(req.user.accessToken)}&refresh=${encodeURIComponent(req.user.refreshToken || '')}`;
    return res.redirect(redirectUrl);
  } else if (req.authCode) {
    // Try manual exchange
    try {
      const authManager = req.app.get('authManager');
      if (!authManager) {
        throw new Error('No auth manager available');
      }
      
      const tokenResponse = await authManager.exchangeCodeForToken(req.authCode);
      
      if (tokenResponse && tokenResponse.accessToken) {
        // Store in session
        req.session.oauthToken = tokenResponse.accessToken;
        req.session.refreshToken = tokenResponse.refreshToken || null;
        
        // Redirect with token
        const redirectUrl = `/?token=${encodeURIComponent(tokenResponse.accessToken)}&refresh=${encodeURIComponent(tokenResponse.refreshToken || '')}`;
        return res.redirect(redirectUrl);
      } else {
        return res.redirect('/?error=token_exchange_failed');
      }
    } catch (error) {
      log.error('Error exchanging code for token:', error.message);
      return res.redirect('/?error=token_exchange_error');
    }
  } else {
    log.error('Missing tokens and auth code after OAuth authentication');
    res.redirect('/?error=missing_auth_data');
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

// Add this at the end of the file before the conditional export
router.source = __filename;

// Export either the OAuth routes or fallback routes
if (config.onshape.clientId && config.onshape.clientSecret) {
  module.exports = router;
} else {
  log.warn('Using fallback auth routes since OAuth is not configured');
  const fallbackRouter = createFallbackAuthRoutes();
  fallbackRouter.source = __filename + ' (fallback)';
  module.exports = fallbackRouter;
}