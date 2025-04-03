// src/routes/index.js

const env = require('../utils/load-env');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const log = logger.scope('Routes');

// Track if routes have been initialized
let routesInitialized = false;

/**
 * Safely require a route module
 * @param {string} routeName - Name of the route file (without extension)
 * @param {Object} app - Express app instance
 * @param {Object} auth - Auth middleware
 * @returns {Object|null} - Router if found, null if not
 */
function safeRequireRoute(routeName, app, auth) {
  const routePath = path.join(__dirname, `${routeName}.js`);
  
  try {
    // Check if the file exists first
    if (fs.existsSync(routePath)) {
      log.debug(`Loading route module: ${routeName}`);
      return require(`./${routeName}`)(app, auth);
    } else {
      log.warn(`Route module not found: ${routeName} (expected at ${routePath})`);
      return null;
    }
  } catch (error) {
    log.error(`Error loading route module ${routeName}: ${error.message}`);
    return null;
  }
}

/**
 * Initialize all routes for the application
 * @param {Object} app - Express app instance
 * @param {Object} auth - Auth middleware
 */
function initializeAllRoutes(app, auth) {
  if (routesInitialized) {
    log.debug('Routes already initialized, skipping');
    return;
  }
  
  log.info('Initializing all application routes');
  
  // Mount OAuth routes
  app.use('/oauth', require('./authRoutes'));
  
  // Mount API routes
  app.use('/api', require('./api')(app, auth));
  app.use('/api/auth', require('./apiAuthRoutes')(app, auth));
  
  // Mount other API routes - safely require each one
  const documentRoutes = safeRequireRoute('documents', app, auth);
  const partStudioRoutes = safeRequireRoute('partStudios', app, auth);
  const featureRoutes = safeRequireRoute('features', app, auth);
  const planeRoutes = safeRequireRoute('planes', app, auth);
  const exampleRoutes = safeRequireRoute('examples', app, auth);
  const svgConverterRoutes = safeRequireRoute('svgConverter', app, auth);
  const svgRoutes = safeRequireRoute('svg', app, auth);
  
  // Only use routes that were successfully loaded
  if (documentRoutes) app.use('/api', documentRoutes);
  if (partStudioRoutes) app.use('/api', partStudioRoutes);
  if (featureRoutes) app.use('/api', featureRoutes);
  if (exampleRoutes) app.use('/api', exampleRoutes);
  if (planeRoutes) app.use('/api', planeRoutes);
  if (svgConverterRoutes) app.use('/api', svgConverterRoutes);
  if (svgRoutes) app.use('/api', svgRoutes);
  
  // Add logs route if needed
  if (fs.existsSync(path.join(__dirname, 'logs.js'))) {
    app.use('/api/logs', require('./logs'));
  }
  
  // Attach client-side logging configuration
  // Note: This enhances the existing root route defined in app.js
  const origRootHandler = app._router.stack.find(
    layer => layer.route && layer.route.path === '/'
  );
  
  if (origRootHandler) {
    log.debug('Found existing root route handler, enhancing with logging config');
    
    // The root route is already defined in app.js, so we'll add middleware to it
    app.use('/', (req, res, next) => {
      try {
        // Get logging configuration
        const loggingConfig = env.getLoggingConfig();
        
        // Prepare configuration for client
        const clientLoggingConfig = {
          globalLevel: loggingConfig.GLOBAL.level,
          scopeLevels: {}
        };
        
        // Copy scope levels (excluding GLOBAL which is handled separately)
        Object.entries(loggingConfig).forEach(([scope, config]) => {
          if (scope !== 'GLOBAL' && config.level) {
            clientLoggingConfig.scopeLevels[scope] = config.level;
          }
        });
        
        // Make logging config available to all views
        res.locals.loggingConfig = JSON.stringify(clientLoggingConfig);
      } catch (error) {
        log.error('Error setting up logging configuration:', error);
      }
      next();
    });
  }
  
  routesInitialized = true;
  log.info('All routes initialized successfully');
}

module.exports = {
  initializeAllRoutes
};
