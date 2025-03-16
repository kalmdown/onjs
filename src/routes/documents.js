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
    log.info('Fetching documents for authenticated user');
    
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
    
    // Refresh token if needed (only applies to OAuth)
    try {
      await client.refreshTokenIfNeeded();
    } catch (refreshError) {
      log.warn(`Token refresh failed: ${refreshError.message}`);
      // Continue anyway - might be using API key auth
    }
    
    // Get documents
    try {
      log.info('Making API call to Onshape to fetch documents');
      const documents = await client.documents.getDocuments();
      log.info(`Successfully fetched ${documents.items?.length || 0} documents`);
      
      res.json(documents);
    } catch (apiError) {
      log.error(`Onshape API error: ${apiError.message}`, apiError);
      
      if (apiError.response?.status === 401) {
        return res.status(401).json({ 
          error: 'Authentication failed with Onshape API',
          details: apiError.message
        });
      }
      
      return res.status(apiError.response?.status || 500).json({
        error: 'Error fetching documents from Onshape API',
        details: apiError.message
      });
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