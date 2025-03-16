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
    
    // Get auth manager and log its state
    const authManager = req.app.get('authManager');
    if (!authManager) {
      log.error('No auth manager found in app context');
      return res.status(500).json({ error: 'Server configuration error: Missing auth manager' });
    }
    
    const authMethod = authManager.getMethod();
    log.info(`Using auth method: ${authMethod || 'none'}`);
    
    // Log additional authentication details based on method
    if (authMethod === 'apikey') {
      log.debug('API key authentication details', {
        hasAccessKey: !!authManager.accessKey,
        accessKeyLength: authManager.accessKey?.length || 0,
        hasSecretKey: !!authManager.secretKey
      });
    } else if (authMethod === 'oauth') {
      log.debug('OAuth authentication details', {
        hasToken: !!authManager.accessToken,
        tokenLength: authManager.accessToken?.length || 0,
        hasRefreshToken: !!authManager.refreshToken
      });
    }
    
    // Create client from request with explicit error handling
    const client = createClientFromRequest(req, OnshapeClient);
    if (!client) {
      log.error('Failed to create Onshape client');
      return res.status(500).json({ error: 'Failed to create Onshape client' });
    }
    
    // Get documents with pagination
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const sortColumn = req.query.sortColumn || 'modifiedAt';
    const sortOrder = req.query.sortOrder || 'desc';
    
    log.info(`Fetching documents: limit=${limit}, offset=${offset}, sort=${sortColumn}:${sortOrder}`);
    
    try {
      // Get documents
      log.info('Making API call to Onshape to fetch documents');
      const documentsResponse = await client.documents.getDocuments({ 
        limit, 
        offset,
        sortColumn,
        sortOrder
      });
      
      // Handle empty or null response
      if (!documentsResponse) {
        log.warn('No documents returned from API');
        return res.json([]);
      }
      
      // Normalize the response to handle different formats from Onshape API
      let documents;
      
      if (Array.isArray(documentsResponse)) {
        // Direct array format
        documents = documentsResponse;
        log.info(`Successfully fetched ${documents.length} documents (array format)`);
      } else if (documentsResponse.items && Array.isArray(documentsResponse.items)) {
        // Object with items array (standard Onshape format)
        documents = documentsResponse.items;
        log.info(`Successfully fetched ${documents.length} of ${documentsResponse.totalCount || '?'} total documents`);
      } else {
        // Unknown format - log details and return empty array
        log.warn('Unexpected document response format', {
          type: typeof documentsResponse,
          keys: Object.keys(documentsResponse || {}),
          isObject: documentsResponse && typeof documentsResponse === 'object'
        });
        documents = [];
      }
      
      // Return the normalized documents array
      return res.json(documents);
    } catch (error) {
      log.error(`Onshape API error: ${error.message}`);
      
      // Log API response data if available
      if (error.response?.data) {
        log.error('API error response:', error.response.data);
      } else {
        log.error('No API response data available');
      }
      
      // Log the full error object for debugging
      log.error('Full error object:', error);
      
      // Return appropriate status code based on error
      if (error.statusCode === 401 || error.response?.status === 401) {
        return res.status(401).json({ 
          error: 'Authentication failed with Onshape API',
          message: 'Your session has expired or is invalid. Please log in again.',
          details: process.env.NODE_ENV !== 'production' ? {
            authError: error.message,
            suggestedAction: 'Check API key format or refresh OAuth token'
          } : undefined
        });
      } else if (error.statusCode === 403 || error.response?.status === 403) {
        return res.status(403).json({ 
          error: 'Permission denied',
          message: 'You do not have permission to access these documents'
        });
      }
      
      return res.status(error.statusCode || error.response?.status || 500).json({ 
        error: 'Failed to fetch documents',
        message: error.message
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