// src/routes/partstudios.js (renamed from elements.js)
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

module.exports = function(app, auth) {
  const { isAuthenticated } = auth;

  /**
   * @route GET /api/partstudios/d/:documentId/w/:workspaceId/e/:elementId/features
   * @description Get features for a part studio
   * @access Private
   */
  router.get('/d/:documentId/w/:workspaceId/e/:elementId/features', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      
      logger.debug(`Fetching features for document=${documentId}, workspace=${workspaceId}, element=${elementId}`);
      
      // Format path for part studio features
      const path = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
      
      // Call the API
      const response = await req.onshapeClient.get(path);
      
      res.json(response);
    } catch (error) {
      logger.error(`Error fetching features: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route POST /api/partstudios/d/:documentId/w/:workspaceId/e/:elementId/features
   * @description Create a feature in a part studio
   * @access Private
   */
  router.post('/d/:documentId/w/:workspaceId/e/:elementId/features', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      const featureData = req.body;
      
      logger.debug(`Creating feature in document=${documentId}, workspace=${workspaceId}, element=${elementId}`);
      
      // Send the feature data to the API
      const response = await req.onshapeClient.post(
        `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`, 
        featureData
      );
      
      res.json(response);
    } catch (error) {
      logger.error(`Error creating feature: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route POST /api/partstudios/d/:documentId/w/:workspaceId/e/:elementId/featurescript
   * @description Evaluate featurescript in a part studio
   * @access Private
   */
  router.post('/d/:documentId/w/:workspaceId/e/:elementId/featurescript', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      const scriptData = req.body;
      
      logger.debug(`Evaluating featurescript in document=${documentId}, workspace=${workspaceId}, element=${elementId}`);
      
      // Send the script data to the API
      const response = await req.onshapeClient.post(
        `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/featurescript`, 
        scriptData
      );
      
      res.json(response);
    } catch (error) {
      logger.error(`Error evaluating featurescript: ${error.message}`);
      next(error);
    }
  });

  return router;
};