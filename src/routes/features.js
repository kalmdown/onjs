// src\routes\features.js
// src/routes/features.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const FeaturesApi = require('../api/endpoints/features');

const log = logger.scope('FeatureRoutes');

module.exports = function(app, auth) {
  const { isAuthenticated } = auth;

  router.get('/', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId } = req.query;
      
      if (!documentId || !workspaceId || !elementId) {
        return res.status(400).json({ 
          error: 'Missing required parameters',
          message: 'documentId, workspaceId, and elementId are required'
        });
      }

      const featuresApi = new FeaturesApi(req.onshapeClient);
      const features = await featuresApi.getFeatures(documentId, workspaceId, elementId);
      
      res.json(features);
    } catch (error) {
      log.error(`Error fetching features: ${error.message}`);
      next(error);
    }
  });

  return router;
};