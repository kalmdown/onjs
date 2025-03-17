// src\routes\documents.js
const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const DocumentsApi = require('../api/endpoints/documents');

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

    // Initialize DocumentsApi with the authenticated client
    const documentsApi = new DocumentsApi(req.onshapeClient);

    // Get documents with pagination
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const sortColumn = req.query.sortColumn || 'modifiedAt';
    const sortOrder = req.query.sortOrder || 'desc';

    log.info(`Fetching documents: limit=${limit}, offset=${offset}, sort=${sortColumn}:${sortOrder}`);

    // Get documents
    const documentsResponse = await documentsApi.getDocuments({
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

    // Normalize the response
    const documents = Array.isArray(documentsResponse) 
      ? documentsResponse 
      : (documentsResponse.items || []);

    return res.json(documents);

  } catch (error) {
    log.error(`Error fetching documents: ${error.message}`);
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

module.exports = router;