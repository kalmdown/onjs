// src/middleware/authMiddleware.js
const passport = require('passport');
const logger = require('../utils/logger');
const OnshapeClient = require('../api/client');
const config = require('../../config');

// Create scoped logger
const log = logger.scope('Auth');

/**
 * Helper function to create Onshape client from request
 * @param {Object} req - Express request object
 * @returns {Object} - Onshape API client
 */
const createClientFromRequest = (req) => {
    try {
        const authManager = req.app.get('authManager');
        
        if (!authManager) {
            log.error('No auth manager found in app context');
            throw new Error('Authentication manager not available');
        }

        // Get baseUrl from config
        const baseUrl = config.onshape.baseUrl;
        const apiUrl = config.onshape.apiUrl;
        
        if (!baseUrl) {
            log.error('Base URL not found in config');
            throw new Error('Base URL is required');
        }
        
        // Create client with explicit options
        const client = new OnshapeClient({
            baseUrl: baseUrl,
            apiUrl: apiUrl,
            authManager: authManager,
            debug: process.env.NODE_ENV !== 'production'
        });
        
        log.debug(`Successfully created Onshape client with ${authManager.getMethod()} authentication`);
        return client;
    } catch (error) {
        log.error(`Failed to create Onshape client: ${error.message}`);
        throw error;
    }
};

/**
 * Authentication middleware factory
 */
module.exports = function(app) {
    /**
     * Authentication check middleware
     */
    const isAuthenticated = (req, res, next) => {
        const authManager = req.app.get('authManager');
        
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
            // Create a new client for each request
            const onshapeClient = createClientFromRequest(req);
            
            // Explicitly attach the client to the request object
            req.onshapeClient = onshapeClient;
            
            // Add extra debug info
            log.debug('Client attached to request', {
                hasClient: !!req.onshapeClient,
                clientType: req.onshapeClient.constructor.name,
                hasGetMethod: typeof req.onshapeClient.get === 'function'
            });
            
            if (!req.onshapeClient) {
                log.error('Failed to create Onshape client');
                return res.status(500).json({ error: 'Failed to initialize API client' });
            }
            
            next();
        } catch (error) {
            log.error(`Error creating client: ${error.message}`);
            return res.status(500).json({ error: 'Error initializing API client: ' + error.message });
        }
    };

    /**
     * Configure OAuth routes and handlers
     */
    function configureOAuth(authManager) {
        log.info('Configuring OAuth');
        
        // OAuth configuration handled in authRoutes.js
    }

    // Add debug endpoint to test client
    app.get('/api/kd_debug/client-test', async (req, res) => {
        try {
            const authManager = req.app.get('authManager');
            
            if (!authManager) {
                return res.status(500).json({ error: 'Auth manager not found' });
            }
            
            // Test headers
            const headers = authManager.getAuthHeaders('GET', '/documents');
            
            res.json({
                baseUrl: config.onshape.baseUrl,
                authMethod: authManager.getMethod(),
                headers: {
                    hasAuth: !!headers.Authorization,
                    authType: headers.Authorization ? headers.Authorization.split(' ')[0] : 'none',
                    contentType: headers['Content-Type']
                },
                config: {
                    env: process.env.NODE_ENV,
                    port: config.server.port || 3000
                }
            });
        } catch (error) {
            res.status(500).json({
                error: error.message
            });
        }
    });

    // Return middleware functions
    return {
        configureOAuth,
        isAuthenticated,
        createClientFromRequest
    };
};