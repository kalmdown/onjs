// src/routes/documents.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Create a scoped logger
const log = logger.scope('Documents');

// Export router configuration function
module.exports = function(app, auth) {
  const { isAuthenticated } = auth;

  /**
   * @route GET /api/documents
   * @description Get all documents
   * @access Private
   */
  router.get('/', isAuthenticated, async (req, res, next) => {
    const log = logger.scope('Documents');
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

  // Fix document by ID route
  router.get('/:documentId', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId } = req.params;
      log.debug(`Fetching document ${documentId}`);
      
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
      log.debug(`Fetching workspaces for document ${documentId} (without /d/ format)`);
      
      const path = `/documents/${documentId}/workspaces`;
      const workspaces = await req.onshapeClient.get(path);
      res.json(workspaces);
    } catch (error) {
      log.error(`Error fetching workspaces for document ${req.params.documentId}: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route GET /api/documents/d/:documentId/workspaces
   * @description Get workspaces for a document
   * @access Private
   */
  router.get('/d/:documentId/workspaces', isAuthenticated, async (req, res, next) => {
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
   * @route GET /api/documents/:documentId/elements
   * @description Get elements in a document (without /d/ format)
   * @access Private
   */
  router.get('/:documentId/elements', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId } = req.params;
      
      // Get default workspace
      log.debug(`Fetching workspaces for document ${documentId} to find default workspace`);
      const workspaces = await req.onshapeClient.get(`/documents/${documentId}/workspaces`);
      
      if (!workspaces || workspaces.length === 0) {
        return res.status(404).json({
          error: 'No workspaces found',
          message: `Document ${documentId} has no workspaces`
        });
      }
      
      const defaultWorkspace = workspaces[0];
      
      // Get elements in default workspace
      log.debug(`Fetching elements for document ${documentId} workspace ${defaultWorkspace.id}`);
      const path = `/documents/d/${documentId}/w/${defaultWorkspace.id}/elements`;
      const response = await req.onshapeClient.get(path);
      
      res.json(response);
    } catch (error) {
      log.error(`Error fetching elements: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route GET /api/documents/d/:documentId/w/:workspaceId/elements
   * @description Get elements in a specific document and workspace
   * @access Private
   */
  router.get('/d/:documentId/w/:workspaceId/elements', isAuthenticated, async (req, res, next) => {
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
   * @route GET /api/documents/:documentId/w/:workspaceId/elements
   * @description Get elements in a specific workspace (without /d/ format)
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
      
      log.debug(`Fetching elements for document ${documentId} workspace ${workspaceId} (without /d/ format)`);

      // Note: When calling Onshape API, we need to use /d/, but our route omits it
      const path = `/documents/d/${documentId}/w/${workspaceId}/elements`;
      log.debug(`Using Onshape path: ${path}`);
      
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

  return router;
};

