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
  router.get('', isAuthenticated, async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;
      const sortColumn = req.query.sortColumn || 'modifiedAt';
      const sortOrder = req.query.sortOrder || 'desc';
      
      log.debug(`Fetching documents with limit=${limit}, offset=${offset}, sort=${sortColumn}:${sortOrder}`);
      
      const path = '/documents';
      const queryParams = { limit, offset, sortColumn, sortOrder };
      
      const documents = await req.onshapeClient.get(path, { params: queryParams });
      res.json(documents);
    } catch (error) {
      log.error(`Error fetching documents: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route GET /api/documents/d/:documentId
   * @description Get a specific document by ID
   * @access Private
   */
  router.get('/d/:documentId', isAuthenticated, async (req, res, next) => {
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
   * @route GET /api/documents/d/:documentId/workspaces
   * @description Get workspaces for a document
   * @access Private
   */
  router.get('/d/:documentId/workspaces', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId } = req.params;
      log.debug(`Fetching workspaces for document ${documentId}`);
      
      const path = `/documents/${documentId}/workspaces`;
      const workspaces = await req.onshapeClient.get(path);
      res.json(workspaces);
    } catch (error) {
      log.error(`Error fetching workspaces for document ${req.params.documentId}: ${error.message}`);
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
   * @route POST /api/documents
   * @description Create a new document
   * @access Private
   */
  router.post('', isAuthenticated, async (req, res, next) => {
    // Implementation for creating a document...
  });

  /**
   * @route DELETE /api/documents/d/:documentId
   * @description Delete a document
   * @access Private
   */
  router.delete('/d/:documentId', isAuthenticated, async (req, res, next) => {
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