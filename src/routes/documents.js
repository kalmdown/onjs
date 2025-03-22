// src/routes/documents.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const DocumentsApi = require('../api/endpoints/documents');
const ElementsApi = require('../api/endpoints/elements');

// Create a scoped logger
const log = logger.scope('DocumentRoutes');

// Export router configuration function
module.exports = function(app, auth) {
  const { isAuthenticated } = auth;

  /**
   * @route GET /api/documents
   * @description Get all documents
   * @access Private
   */
  router.get('/', isAuthenticated, async (req, res, next) => {
    const log = logger.scope('DocumentRoutes');
    const options = {
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0,
      sortColumn: req.query.sortColumn || 'modifiedAt',
      sortOrder: req.query.sortOrder || 'desc'
    };
    
    log.info(`Fetching documents: limit=${options.limit}, offset=${options.offset}, sort=${options.sortColumn}:${options.sortOrder}`);
    
    try {
      if (!req.onshapeClient) {
        log.error('No Onshape client available');
        return res.status(500).json({ error: 'API client not available' });
      }
      
      // Debug client capabilities
      log.debug('Client info:', {
        type: req.onshapeClient.constructor.name,
        hasGetMethod: typeof req.onshapeClient.get === 'function',
        methods: Object.keys(req.onshapeClient).filter(k => typeof req.onshapeClient[k] === 'function')
      });
      
      // Use direct client method instead of documentsApi
      const documentsPath = '/documents';
      const queryParams = {
        limit: options.limit,
        offset: options.offset,
        sortColumn: options.sortColumn,
        sortOrder: options.sortOrder
      };
      
      // Call the API directly
      const documents = await req.onshapeClient.get(documentsPath, { params: queryParams });
      log.debug(`Retrieved documents API response`);
      
      res.json(documents);
    } catch (error) {
      log.error(`Error fetching documents: ${error.message}`, error);
      next(error);
    }
  });

  /**
   * @route GET /api/documents/:documentId
   * @description Get a specific document
   * @access Private
   */
  router.get('/:documentId', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId } = req.params;
      const path = `/documents/${documentId}`;
      const document = await req.onshapeClient.get(path);
      res.json(document);
    } catch (error) {
      log.error(`Error fetching document ${req.params.documentId}: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route GET /api/documents/:documentId/workspaces
   * @description Get workspaces for a document
   * @access Private
   */
  router.get('/:documentId/workspaces', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId } = req.params;
      const path = `/documents/${documentId}/workspaces`;
      const workspaces = await req.onshapeClient.get(path);
      res.json(workspaces);
    } catch (error) {
      log.error(`Error fetching workspaces for document ${req.params.documentId}: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route GET /api/documents/:documentId/w/:workspaceId/elements
   * @description Get elements in a specific document and workspace
   * @access Private
   */
  router.get('/:documentId/w/:workspaceId/elements', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId } = req.params;
      
      if (!documentId || !workspaceId) {
        return res.status(400).json({ 
          error: 'Missing required parameters',
          message: 'documentId and workspaceId are required'
        });
      }
      
      log.debug(`Fetching elements for document ${documentId} workspace ${workspaceId}`);

      // Use direct client.get instead of elementsApi
      const path = `/documents/d/${documentId}/w/${workspaceId}/elements`;
      const response = await req.onshapeClient.get(path);
      
      res.json(response);
    } catch (error) {
      log.error(`Error fetching elements: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route POST /api/documents
   * @description Create a new document
   * @access Private
   */
  router.post('/', isAuthenticated, async (req, res, next) => {
    try {
      const { name, description, isPublic } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Document name is required" });
      }

      const data = {
        name,
        description: description || "Created with Onshape JavaScript client",
        isPublic: isPublic || false
      };

      const document = await req.onshapeClient.post('/documents', data);
      res.json(document);
    } catch (error) {
      log.error(`Error creating document: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route DELETE /api/documents/:documentId
   * @description Delete a document
   * @access Private
   */
  router.delete('/:documentId', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId } = req.params;
      const forever = req.query.forever === 'true';
      
      const queryParams = { forever };
      await req.onshapeClient.delete(`/documents/${documentId}`, { params: queryParams });
      
      res.json({
        success: true,
        message: `Document ${documentId} deleted successfully`
      });
    } catch (error) {
      log.error(`Error deleting document ${req.params.documentId}: ${error.message}`);
      next(error);
    }
  });

  // src/routes/documents.js - Update with new route

/**
 * @route POST /api/documents/:documentId/w/:workspaceId/elements/:elementId/features
 * @description Create a feature in a part studio
 * @access Private
 */
router.post('/:documentId/w/:workspaceId/elements/:elementId/features', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId, workspaceId, elementId } = req.params;
      const featureData = req.body;
      
      if (!documentId || !workspaceId || !elementId) {
        return res.status(400).json({ 
          error: 'Missing required parameters',
          message: 'documentId, workspaceId, and elementId are required'
        });
      }
      
      if (!featureData) {
        return res.status(400).json({
          error: 'Missing request body',
          message: 'Feature data is required'
        });
      }
      
      log.debug(`Creating feature in document=${documentId}, workspace=${workspaceId}, element=${elementId}`);
      
      // Format path for part studio features
      const path = `/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
      
      // Send the feature data to the API
      const response = await req.onshapeClient.post(path, featureData);
      
      res.json(response);
    } catch (error) {
      log.error(`Error creating feature: ${error.message}`);
      next(error);
    }
  });

  return router;
};

