// src\routes\documents.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const DocumentsApi = require('../api/endpoints/documents');

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
      
      // Initialize API endpoint
      const documentsApi = new DocumentsApi(req.onshapeClient);
      
      const documents = await documentsApi.getDocuments(options);
      log.debug(`Retrieved ${documents.items?.length || 0} documents`);
      
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
      const documentsApi = new DocumentsApi(req.onshapeClient);
      const document = await documentsApi.getDocument(documentId);
      res.json(document);
    } catch (error) {
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

      const documentsApi = new DocumentsApi(req.onshapeClient);
      const document = await documentsApi.createDocument({
        name,
        description: description || "Created with Onshape JavaScript client",
        isPublic: isPublic || false
      });

      res.json(document);
    } catch (error) {
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
      const documentsApi = new DocumentsApi(req.onshapeClient);
      
      await documentsApi.deleteDocument(documentId, forever);
      res.json({
        success: true,
        message: `Document ${documentId} deleted successfully`
      });
    } catch (error) {
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
      const documentsApi = new DocumentsApi(req.onshapeClient);
      const workspaces = await documentsApi.getWorkspaces(documentId);
      res.json(workspaces);
    } catch (error) {
      next(error);
    }
  });

  return router;
};