// src/routes/features.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const routeTracker = require('../utils/route-tracker');

const log = logger.scope('Features');

// Export a function that returns the router
module.exports = function(app, auth) {
  // This is the file and line number that's initializing the route
  const source = __filename;
  
  // Check if already initialized with better logging
  if (routeTracker.isRouteInitialized('features')) {
    log.debug('Feature routes already initialized, skipping');
    return router;
  }
  
  log.info('Initializing features API routes');
  
  const { isAuthenticated } = auth;

  /**
   * @route GET /api/features
   * @description Get features for a part studio
   * @access Private
   */
  router.get('/features', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, elementId, workspaceId } = req.query;
      
      if (!documentId || !elementId || !workspaceId) {
        return res.status(400).json({ 
          error: 'Missing required parameters',
          message: 'documentId, elementId, and workspaceId are required'
        });
      }
      
      log.debug(`Fetching features for document=${documentId}, workspace=${workspaceId}, element=${elementId}`);
      
      // Format path for part studio features
      const path = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
      
      // Call the API
      const response = await req.onshapeClient.get(path);
      
      res.json(response);
    } catch (error) {
      log.error(`Error fetching features: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route POST /api/features/create
   * @description Create a feature in a part studio
   * @access Private
   */
  router.post('/features/create', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId, feature } = req.body;
      
      if (!documentId || !workspaceId || !elementId || !feature) {
        return res.status(400).json({ 
          error: 'Missing required parameters',
          message: 'documentId, workspaceId, elementId, and feature are required'
        });
      }
      
      log.debug(`Creating feature in document=${documentId}, workspace=${workspaceId}, element=${elementId}`);
      
      // Format path for part studio features
      const path = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
      
      // Send the feature data to the API
      const response = await req.onshapeClient.post(path, { feature });
      
      res.json(response);
    } catch (error) {
      log.error(`Error creating feature: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route GET /api/features/:documentId/w/:workspaceId/e/:elementId
   * @description Get features for a part studio (path-based)
   * @access Private
   */
  router.get('/features/d/:documentId/w/:workspaceId/e/:elementId', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      
      log.debug(`Fetching features for document=${documentId}, workspace=${workspaceId}, element=${elementId}`);
      
      // Format path for part studio features
      const path = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
      
      // Call the API
      const response = await req.onshapeClient.get(path);
      
      res.json(response);
    } catch (error) {
      log.error(`Error fetching features: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route POST /api/features/:documentId/w/:workspaceId/e/:elementId
   * @description Create a feature in a part studio (path-based)
   * @access Private
   */
  router.post('/features/d/:documentId/w/:workspaceId/e/:elementId', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      const { feature } = req.body;
      
      if (!feature) {
        return res.status(400).json({
          error: 'Missing request body',
          message: 'Feature data is required'
        });
      }
      
      log.debug(`Creating feature in document=${documentId}, workspace=${workspaceId}, element=${elementId}`);
      
      // Format path for part studio features
      const path = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
      
      // Send the feature data to the API
      const response = await req.onshapeClient.post(path, { feature });
      
      res.json(response);
    } catch (error) {
      log.error(`Error creating feature: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route POST /api/features/:documentId/w/:workspaceId/e/:elementId/sketches/:sketchId/entities
   * @description Add an entity to a sketch
   * @access Private
   */
  router.post('/features/d/:documentId/w/:workspaceId/e/:elementId/sketches/:sketchId/entities', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId, sketchId } = req.params;
      const entityData = req.body;
      
      log.debug(`Adding entity to sketch=${sketchId} in element=${elementId}`);
      
      // Format path for sketch entities
      const path = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/sketches/${sketchId}/entities`;
      
      // Send the entity data to the API
      const response = await req.onshapeClient.post(path, entityData);
      
      res.json(response);
    } catch (error) {
      log.error(`Error adding sketch entity: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route POST /api/features/:documentId/w/:workspaceId/e/:elementId/sketches/:sketchId
   * @description Perform an action on a sketch (like close)
   * @access Private
   */
  router.post('/features/d/:documentId/w/:workspaceId/e/:elementId/sketches/:sketchId', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId, sketchId } = req.params;
      const { action } = req.body;
      
      if (!action) {
        return res.status(400).json({
          error: 'Missing action',
          message: 'Action is required'
        });
      }
      
      log.debug(`Performing action=${action} on sketch=${sketchId} in element=${elementId}`);
      
      // Format path for sketch actions
      const path = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/sketches/${sketchId}`;
      
      // Send the action to the API
      const response = await req.onshapeClient.post(path, { action });
      
      res.json(response);
    } catch (error) {
      log.error(`Error performing sketch action: ${error.message}`);
      next(error);
    }
  });

  // Mark this route as initialized with source file info
  routeTracker.markRouteInitialized('features', source);
  
  return router;
};