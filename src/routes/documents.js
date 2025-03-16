// src\routes\documents.js
const express = require('express');
const router = express.Router();
const { isAuthenticated, createClientFromRequest } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const { OnshapeClient } = require('../api/client');

// Create a scoped logger
const log = logger.scope('DocumentRoutes');

/**
 * @route GET /api/documents
 * @description Get all documents
 * @access Private
 */
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    log.info('Documents route: Authentication check passed');
    log.info(`User session: ${req.session ? 'Present' : 'None'}`);
    log.info(`Auth method: ${req.app.get('authManager')?.getMethod()}`);

    // Log authentication method
    const authManager = req.app.get('authManager');
    if (authManager) {
      log.info(`Using auth method: ${authManager.getMethod()}`);
    }
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    if (!client) {
      log.error('Failed to create Onshape client');
      return res.status(500).json({ error: 'Failed to create Onshape client' });
    }
    
    // Get documents with pagination
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    try {
      // Get documents
      log.info('Making API call to Onshape to fetch documents');
      const documents = await client.documents.getDocuments({ 
        limit, 
        offset,
        sortColumn: req.query.sortColumn || 'modifiedAt',
        sortOrder: req.query.sortOrder || 'desc'
      });
      
      // Defensive check for documents response
      if (!documents) {
        log.warn('No documents returned from API');
        return res.json([]);
      }
      
      log.info(`Successfully fetched ${Array.isArray(documents) ? documents.length : '?'} documents`);
      
      // Return the documents - handle both array and object formats
      return res.json(documents);
    } catch (error) {
      log.error(`Onshape API error: ${error.message}`, error);
      return res.status(500).json({ error: error.message });
    }
  } catch (error) {
    log.error(`Unexpected error in document route handler: ${error.message}`, error);
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
    const documentId = req.params.documentId;
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Get document
    const document = await client.documents.getDocument(documentId);
    
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
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Create document
    const document = await client.documents.createDocument({
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
    const documentId = req.params.documentId;
    const forever = req.query.forever === 'true';
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Delete document
    await client.documents.deleteDocument(documentId, forever);
    
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
    const documentId = req.params.documentId;
    
    // Create client from request
    const client = createClientFromRequest(req, OnshapeClient);
    
    // Refresh token if needed
    await client.refreshTokenIfNeeded();
    
    // Get workspaces
    const workspaces = await client.documents.getWorkspaces(documentId);
    
    res.json(workspaces);
  } catch (error) {
    next(error);
  }
});

module.exports = router;