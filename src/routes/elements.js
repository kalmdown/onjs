const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const ElementsApi = require('../api/endpoints/elements');

const log = logger.scope('ElementRoutes');

module.exports = function(app, auth) {
  const { isAuthenticated } = auth;

  router.get('/', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId } = req.query;
      
      if (!documentId || !workspaceId) {
        return res.status(400).json({ 
          error: 'Missing required parameters',
          message: 'documentId and workspaceId are required'
        });
      }

      const elementsApi = new ElementsApi(req.onshapeClient);
      const elements = await elementsApi.getElements(documentId, workspaceId);
      
      res.json(elements);
    } catch (error) {
      log.error(`Error fetching elements: ${error.message}`);
      next(error);
    }
  });

  return router;
};