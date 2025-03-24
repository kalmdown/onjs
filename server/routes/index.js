const express = require('express');
const router = express.Router();

// Import controllers
const featureController = require('../controllers/featureController');
const featureDetailController = require('../controllers/featureDetailController');
const featureScriptController = require('../controllers/featureScriptController');
// ...existing controller imports...

// Middleware section - Add URL format handling middleware
router.use((req, res, next) => {
  // If URL is already in Onshape format, leave it alone
  if (req.url.includes('/partstudios/d/') || req.url.includes('/e/')) {
    // Already in Onshape format
    next();
    return;
  }

  // If it's in local format, see if we need to transform it to Onshape format (for logging/tracking)
  const originalUrl = req.url;
  
  // Check if it's a documents URL that should be rewritten to partstudios
  if (originalUrl.includes('/documents/') && originalUrl.includes('/elements/')) {
    // This is likely a local format URL for a part studio operation
    // Just log it for debugging
    console.log(`Detected local URL format: ${originalUrl} (allowing both formats)`);
  }
  
  next();
});

// Define routes that handle both Onshape and local patterns

// Features endpoints (support both formats)
// Onshape format: /partstudios/d/:documentId/w/:workspaceId/e/:elementId/features
// Local format: /documents/:documentId/w/:workspaceId/elements/:elementId/features
router.use([
  '/partstudios/d/:documentId/w/:workspaceId/e/:elementId/features',
  '/documents/:documentId/w/:workspaceId/elements/:elementId/features'
], (req, res, next) => {
  // Extract parameters regardless of which format was used
  const documentId = req.params.documentId;
  const workspaceId = req.params.workspaceId;
  const elementId = req.params.elementId;
  
  // Log which format was detected
  const isOnshapeFormat = req.path.includes('/partstudios/d/');
  console.log(`Features request using ${isOnshapeFormat ? 'Onshape' : 'local'} format`);
  
  // Now call your existing feature controller
  featureController(req, res, next);
});

// Feature by ID endpoints (support both formats)
router.use([
  '/partstudios/d/:documentId/w/:workspaceId/e/:elementId/features/featureid/:featureId',
  '/documents/:documentId/w/:workspaceId/elements/:elementId/features/featureid/:featureId'
], featureDetailController);

// FeatureScript endpoints (support both formats)
router.use([
  '/partstudios/d/:documentId/w/:workspaceId/e/:elementId/featurescript',
  '/documents/:documentId/w/:workspaceId/elements/:elementId/featurescript'
], featureScriptController);

// ...existing routes remain unchanged...

// Export the router
module.exports = router;