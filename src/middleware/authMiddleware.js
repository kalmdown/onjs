// src/middleware/authMiddleware.js
const passport = require('passport');
const ApiKeyStrategy = require('passport-headerapikey').HeaderAPIKeyStrategy;
const OnshapeClient = require('../api/client');
const logger = require('../utils/logger');

// Create scoped logger
const log = logger.scope('AuthMiddleware');

/**
 * Helper function to create Onshape client from request
 */
const createClientFromRequest = (req) => {
    const authManager = req.app.get('authManager');
    const config = req.app.get('config');
    
    if (!authManager) {
        log.error('No auth manager found in app context');
        return null;
    }

    try {
        // Get baseUrl from config or auth manager
        let baseUrl = null;
        if (config?.onshape?.baseUrl) {
            baseUrl = config.onshape.baseUrl;
        } else if (authManager.baseUrl) {
            baseUrl = authManager.baseUrl;
        }
        
        if (!baseUrl) {
            throw new Error('Base URL is required');
        }
        
        const clientOptions = {
            baseUrl,
            authManager
        };
        
        const client = new OnshapeClient(clientOptions);
        log.debug(`Created Onshape client with ${authManager.getMethod()} authentication`);
        return client;
    } catch (error) {
        log.error(`Failed to create Onshape client: ${error.message}`);
        return null;
    }
};

/**
 * Authentication middleware factory
 */
module.exports = function(app) {
    // Initialize Passport
    app.use(passport.initialize());
    app.use(passport.session());

    // Passport session serialization
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));

    /**
     * Authentication check middleware
     */
    const isAuthenticated = (req, res, next) => {
        const authManager = req.app.get('authManager');
        const authMethod = authManager ? authManager.getMethod() : null;
        
        if (!authManager) {
            log.error('No authentication manager found');
            return res.status(500).json({ 
                error: 'Server Error', 
                message: 'Authentication not configured' 
            });
        }

        if (req.isAuthenticated() || 
            authMethod === 'apikey' || 
            (req.session && req.session.oauthToken)) {
            
            if (!req.onshapeClient) {
                const client = createClientFromRequest(req);
                if (!client) {
                    return res.status(500).json({ 
                        error: 'Server Error', 
                        message: 'Failed to initialize client' 
                    });
                }
                req.onshapeClient = client;
            }
            
            log.debug(`User authenticated via ${authMethod || 'session'}`);
            return next();
        }

        if (req.xhr || req.path.startsWith('/api/')) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Authentication required' 
            });
        }

        res.redirect('/oauth/login');
    };

    /**
     * Configure OAuth routes and handlers
     */
    function configureOAuth(authManager) {
        const config = app.get('config');
        
        // Login route
        app.get('/oauth/login', (req, res) => {
            if (authManager.getMethod() === 'apikey') {
                return res.redirect('/?auth=apikey&status=success');
            }
            
            const authUrl = authManager.getAuthorizationUrl();
            log.info(`Redirecting to OAuth URL: ${authUrl}`);
            res.redirect(authUrl);
        });

        // OAuth callback
        app.get('/oauth/callback', async (req, res) => {
            const { code } = req.query;
            
            if (!code) {
                return res.redirect('/?error=no_code_provided');
            }

            try {
                const tokenResponse = await authManager.exchangeCodeForToken(code);
                
                // Store tokens in session
                req.session.oauthToken = tokenResponse.accessToken;
                req.session.refreshToken = tokenResponse.refreshToken || null;
                
                // Redirect with tokens
                res.redirect(`/?token=${encodeURIComponent(tokenResponse.accessToken)}&refresh=${encodeURIComponent(tokenResponse.refreshToken || '')}`);
            } catch (error) {
                log.error('OAuth callback failed', error);
                res.redirect(`/?error=${encodeURIComponent(error.message || 'Authentication failed')}`);
            }
        });
        
        // Logout route
        app.get('/oauth/logout', (req, res) => {
            if (req.session) {
                delete req.session.oauthToken;
                delete req.session.refreshToken;
            }
            
            if (req.logout) {
                req.logout((err) => {
                    if (err) log.error('Error during logout:', err);
                    res.redirect("/");
                });
            } else {
                res.redirect("/");
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