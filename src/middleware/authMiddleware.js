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
        // Get baseUrl from various sources with detailed logging
        let baseUrl = null;
        
        // Try to get from config object
        if (config?.onshape?.baseUrl) {
            baseUrl = config.onshape.baseUrl;
            log.debug(`Using baseUrl from config: ${baseUrl}`);
        } 
        // Try to get from auth manager
        else if (authManager.baseUrl) {
            baseUrl = authManager.baseUrl;
            log.debug(`Using baseUrl from authManager: ${baseUrl}`);
        }
        
        // Extended debug logging to diagnose the issue
        log.debug('Auth configuration debug:', {
            hasConfig: !!config,
            hasOnshapeConfig: !!(config && config.onshape),
            configKeys: config ? Object.keys(config) : [],
            onshapeConfigKeys: config?.onshape ? Object.keys(config.onshape) : [],
            configBaseUrl: config?.onshape?.baseUrl || 'undefined',
            authManagerBaseUrl: authManager.baseUrl || 'undefined',
            authManagerMethod: authManager.getMethod()
        });
        
        // Validate baseUrl exists and is a non-empty string
        if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
            log.error('Base URL not found in config or auth manager');
            log.error('Verify that config.onshape.baseUrl is set correctly');
            throw new Error('Base URL is required');
        }
        
        // Trim and normalize the base URL (remove trailing slash if present)
        baseUrl = baseUrl.trim();
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }
        
        // Create client with explicit options
        const client = new OnshapeClient({
            baseUrl: baseUrl,
            authManager: authManager
        });
        
        log.debug(`Successfully created Onshape client with ${authManager.getMethod()} authentication`);
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
        const log = logger.scope('AuthMiddleware');
        
        if (!authManager) {
            log.error('No auth manager found in application');
            return res.status(500).json({ error: 'Authentication service unavailable' });
        }
      
        // Check authentication based on method
        const authMethod = authManager.getMethod();
      
        if (authMethod === 'oauth') {
            // For OAuth, use Passport's isAuthenticated
            if (!req.isAuthenticated || !req.isAuthenticated()) {
                log.debug('OAuth authentication failed: Not authenticated');
                return res.status(401).json({ error: 'Not authenticated' });
            }
        } else if (authMethod === 'apikey') {
            // API Key auth is considered pre-authenticated
            log.debug('Using API key authentication');
        } else {
            // No valid auth method
            log.error('No valid authentication method configured');
            return res.status(401).json({ error: 'No authentication method available' });
        }
      
        // Authentication successful, create client for this request
        try {
            req.onshapeClient = createClientFromRequest(req);
            
            // Add extra debug info
            log.debug('Client attached to request', {
                hasClient: !!req.onshapeClient,
                clientType: req.onshapeClient?.constructor.name,
                hasGetMethod: typeof req.onshapeClient?.get === 'function'
            });
            
            if (!req.onshapeClient) {
                log.error('Failed to create Onshape client');
                return res.status(500).json({ error: 'Failed to initialize API client' });
            }
            
            next();
        } catch (error) {
            log.error(`Error creating client: ${error.message}`);
            return res.status(500).json({ error: 'Error initializing API client' });
        }
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

    // Add this helper method to verify headers are being applied
    async function testHeaders() {
        const headers = this.getAuthHeaders('GET', '/documents');
        log.debug('Generated auth headers:', {
            hasAuth: !!headers.Authorization,
            authType: headers.Authorization ? headers.Authorization.split(' ')[0] : 'none',
            contentType: headers['Content-Type'],
            accept: headers.Accept
        });
        return headers;
    }

    // Add debug endpoint to test client
    app.get('/api/debug/client-test', async (req, res) => {
        try {
            const client = createClientFromRequest(req);
            if (!client) {
                return res.status(500).json({ error: 'Failed to create client' });
            }
            
            // Test headers
            const authManager = req.app.get('authManager');
            const headers = authManager.getAuthHeaders('GET', '/documents');
            
            // Test client methods
            const hasGetMethod = typeof client.get === 'function';
            const hasPostMethod = typeof client.post === 'function';
            
            res.json({
                baseUrl: client.baseUrl,
                authMethod: authManager.getMethod(),
                headers: {
                    hasAuth: !!headers.Authorization,
                    authType: headers.Authorization ? headers.Authorization.split(' ')[0] : 'none',
                    contentType: headers['Content-Type']
                },
                clientMethods: {
                    hasGet: hasGetMethod,
                    hasPost: hasPostMethod
                }
            });
        } catch (error) {
            res.status(500).json({
                error: error.message,
                stack: error.stack
            });
        }
    });

    // Return middleware functions
    return {
        configureOAuth,
        isAuthenticated,
        createClientFromRequest,
        testHeaders
    };
};