const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const ElementsApi = require('../api/endpoints/elements');

const log = logger.scope('ElementRoutes');

module.exports = function(app, auth) {
  const { isAuthenticated } = auth;

  /**
   * @route GET /api/elements
   * @description Get elements using query parameters
   * @access Private
   */
  router.get('/', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId } = req.query;
      
      if (!documentId || !workspaceId) {
        return res.status(400).json({ 
          error: 'Missing required parameters',
          message: 'documentId and workspaceId are required'
        });
      }
      
      log.debug(`Fetching elements via query params: doc=${documentId}, workspace=${workspaceId}`);

      const elementsApi = new ElementsApi(req.onshapeClient);
      const elements = await elementsApi.getElements(documentId, workspaceId);
      
      res.json(elements);
    } catch (error) {
      log.error(`Error fetching elements: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route GET /api/elements/:documentId/w/:workspaceId
   * @description Get elements using path parameters
   * @access Private
   */
  router.get('/:documentId/w/:workspaceId', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId } = req.params;
      
      if (!documentId || !workspaceId) {
        return res.status(400).json({ 
          error: 'Missing required parameters',
          message: 'documentId and workspaceId are required'
        });
      }
      
      log.debug(`Fetching elements via path params: doc=${documentId}, workspace=${workspaceId}`);

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