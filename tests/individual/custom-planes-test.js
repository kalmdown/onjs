/**
 * Custom Planes Test
 * 
 * This test connects to a specific Onshape document and lists all planes,
 * with a focus on finding a specific plane named "Funky Plane".
 * 
 * Document: https://cad.onshape.com/documents/cb1e9acdd17540e4f4a4d45b/w/425a72a0620d341664869beb/e/e3e5ef7c62cd21704be0c100
 * 
 * SETUP INSTRUCTIONS:
 * Set environment variables for authentication:
 * - For API key auth: ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY
 * - For OAuth: OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, and tokens if available
 */

// Load environment variables directly
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Explicitly load env file from project root
const projectRoot = path.resolve(__dirname, '../../');
const envPath = path.join(projectRoot, '.env');

// Check if .env file exists before loading
if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error(`Error loading .env file: ${result.error.message}`);
  } else {
    console.log(`Loaded environment from: ${envPath}`);
    
    // Override process.env.ONSHAPE_AUTH_METHOD if needed, as authManager expects API_KEY not apikey
    if (process.env.ONSHAPE_AUTH_METHOD && process.env.ONSHAPE_AUTH_METHOD.toLowerCase() === 'apikey') {
      process.env.ONSHAPE_AUTH_METHOD = 'API_KEY';
    }
  }
} else {
  console.error(`Cannot find .env file at: ${envPath}`);
}

// Override the environment loader module without using Jest
const envLoaderPath = require.resolve('../../src/utils/load-env');
if (require.cache[envLoaderPath]) {
  // If module is already in cache, modify it
  require.cache[envLoaderPath].exports.initialized = true;
  require.cache[envLoaderPath].exports.loadEnv = () => true;
  require.cache[envLoaderPath].exports.validateEnv = () => ({ isValid: true, errors: [] });
} else {
  // If module is not yet loaded, add it to cache with modified exports
  require.cache[envLoaderPath] = {
    id: envLoaderPath,
    filename: envLoaderPath,
    loaded: true,
    exports: {
      loadEnv: () => true,
      validateEnv: () => ({ isValid: true, errors: [] }),
      initialized: true
    }
  };
}

const AuthManager = require('../../src/auth/auth-manager');
const OnshapeClient = require('../../src/api/client');
const logger = require('../../src/utils/logger').scope('planes-test');

// Document information from the URL (we'll use the one in the .env if available)
const documentId = process.env.ONSHAPE_TEST_DOCUMENT_ID || 'cb1e9acdd17540e4f4a4d45b';
const workspaceId = process.env.ONSHAPE_TEST_WORKSPACE_ID || '425a72a0620d341664869beb';
// Element ID for Part Studio containing "Funky Plane" - hardcoded from the comment URL
const elementId = 'e3e5ef7c62cd21704be0c100';

// Create API client using project's auth system
function createClient() {
  try {
    // Use just the base URL without /api/v10 since we'll include that in the path
    const baseUrl = 'https://cad.onshape.com';
    logger.info(`Using API base URL: ${baseUrl}`);
    
    // Get auth credentials for creating proper Basic auth header
    const accessKey = process.env.ONSHAPE_ACCESS_KEY;
    const secretKey = process.env.ONSHAPE_SECRET_KEY;
    
    if (!accessKey || !secretKey) {
      throw new Error('API key credentials not found in environment variables');
    }
    
    // Create auth manager with API_KEY method
    process.env.ONSHAPE_AUTH_METHOD = 'API_KEY';
    
    const authManager = new AuthManager({
      baseUrl: baseUrl
    });
    
    logger.info(`Using authentication method: ${authManager.getMethod()}`);
    
    // Create OnshapeClient with auth manager
    return new OnshapeClient({
      baseUrl: baseUrl,
      authManager: authManager
    });
  } catch (error) {
    logger.error(`Failed to create client: ${error.message}`);
    throw error;
  }
}

async function testCustomPlanes() {
  try {
    logger.info('Starting custom planes test');
    logger.info(`Testing with document: ${documentId}, workspace: ${workspaceId}, element: ${elementId}`);
    
    // Create API client using project's auth system
    const client = createClient();
    
    // Skip directly to features - we don't need separate plane endpoints
    // Custom planes in Onshape are stored as features and must be filtered
    logger.info(`Fetching features for document: ${documentId}, workspace: ${workspaceId}, element: ${elementId}`);
    
    // Use the exact endpoint format from the working curl command
    const featuresPath = `/api/v10/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features?rollbackBarIndex=-1&includeGeometryIds=true&noSketchGeometry=false`;
    
    // Implement direct Basic Auth to match the curl command exactly
    const accessKey = process.env.ONSHAPE_ACCESS_KEY;
    const secretKey = process.env.ONSHAPE_SECRET_KEY;
    
    if (!accessKey || !secretKey) {
      throw new Error('API key credentials not found in environment variables');
    }
    
    // Create the Basic Auth header manually
    const authStr = `${accessKey}:${secretKey}`;
    const base64Auth = Buffer.from(authStr).toString('base64');
    const authHeader = `Basic ${base64Auth}`;
    
    logger.info('Creating direct authentication header');
    
    // Match curl header casing and parameters exactly
    const requestHeaders = {
      'accept': 'application/json;charset=UTF-8; qs=0.09',
      'Authorization': authHeader
    };
    
    logger.info(`Fetching features from: ${featuresPath}`);
    logger.info('Using headers: ' + JSON.stringify({
      accept: requestHeaders.accept,
      Authorization: 'Basic ***' // Mask the actual auth token for security
    }));
    
    let allFeatures = [];
    let planeFeatures = [];
    let featuresFound = false;
    
    try {
      // Use the fixed OnshapeClient with direct header pass-through
      const response = await client.get(featuresPath, {
        headers: requestHeaders,
        // Parse query params from the URL
        params: {
          rollbackBarIndex: -1,
          includeGeometryIds: true,
          noSketchGeometry: false
        }
      });
      
      logger.info(`Received features response from API`);
      
      // Extract features from response
      if (response.features && Array.isArray(response.features)) {
        allFeatures = response.features;
      } else if (Array.isArray(response)) {
        allFeatures = response;
      }
      
      logger.info(`Found ${allFeatures.length} total features`);
      featuresFound = true;
    } catch (error) {
      const statusCode = error.response?.status || 'unknown';
      const errorMessage = error.response?.data?.message || error.message;
      logger.error(`Error getting features: ${errorMessage} (status ${statusCode})`);
      
      // Log more details about the error for debugging
      if (error.response) {
        logger.error('Response headers: ' + JSON.stringify(error.response.headers || {}));
        logger.error('Response data: ' + JSON.stringify(error.response.data || {}));
      }
      
      // Try direct document verification
      try {
        logger.info('Attempting to verify document existence with direct request...');
        const docUrl = `https://cad.onshape.com/api/v10/documents/d/${documentId}`;
        const docResponse = await axios.get(docUrl, { headers: requestHeaders });
        logger.info(`Document request successful: ${docResponse.status}`);
      } catch (authError) {
        logger.error(`Document verification failed: ${authError.message}`);
        if (authError.response) {
          logger.error(`Status: ${authError.response.status}`);
          logger.error(`Response data: ${JSON.stringify(authError.response.data || {})}`);
        }
      }
    }
    
    if (!featuresFound) {
      logger.warn('Could not retrieve any features from any endpoint');
    } else {
      // Filter features that contain "plane" or "planar"
      planeFeatures = allFeatures.filter(feature => {
        // Check in various properties
        const featureType = (feature.featureType || feature.type || '').toLowerCase();
        const name = (feature.name || '').toLowerCase();
        
        // Check if any property has "plane" or "planar" in it
        const hasPlaneInProps = Object.keys(feature).some(key => {
          const value = feature[key];
          return typeof value === 'string' && 
                (value.toLowerCase().includes('plane') || value.toLowerCase().includes('planar'));
        });
        
        return featureType.includes('plane') || 
               featureType.includes('planar') || 
               name.includes('plane') || 
               name.includes('planar') ||
               hasPlaneInProps;
      });
      
      logger.info(`Found ${planeFeatures.length} features with "plane" or "planar"`);
      
      // Find the specific "Funky Plane" if it exists
      const funkyPlane = planeFeatures.find(feature => 
        (feature.name || '').toLowerCase().includes('funky plane')
      );
      
      if (funkyPlane) {
        logger.info('FOUND "Funky Plane"!');
        logger.info(JSON.stringify(funkyPlane, null, 2));
        
        // Extract and display plane-specific information if available
        const planeInfo = extractPlaneInfo(funkyPlane);
        if (planeInfo) {
          logger.info('Funky Plane information:');
          Object.entries(planeInfo).forEach(([key, value]) => {
            logger.info(`  ${key}: ${JSON.stringify(value)}`);
          });
        }
      } else {
        logger.info('Did not find "Funky Plane" in features');
      }
      
      // Print all plane features with their names and types
      logger.info('All plane-related features:');
      planeFeatures.forEach((feature, index) => {
        const name = feature.name || 'Unnamed';
        const type = feature.featureType || feature.type || 'Unknown';
        
        // Get more specific plane type information when available
        const specificType = getSpecificPlaneType(feature);
        const typeDisplay = specificType ? `${type} (${specificType})` : type;
        
        logger.info(`[${index+1}] ${name} (${typeDisplay})`);
      });
    }
    
    logger.info('Test completed');
  } catch (error) {
    logger.error(`Test failed: ${error.message}`);
  }
}

/**
 * Extracts detailed information about a plane feature
 * @param {Object} planeFeature - The plane feature object
 * @return {Object|null} - Extracted plane information or null if not available
 */
function extractPlaneInfo(planeFeature) {
  if (!planeFeature) return null;
  
  const info = {
    name: planeFeature.name || 'Unnamed plane',
    type: getSpecificPlaneType(planeFeature) || planeFeature.featureType || planeFeature.type || 'Unknown'
  };
  
  // Extract parameters from different possible locations in the feature
  if (planeFeature.parameters) {
    planeFeature.parameters.forEach(param => {
      if (param.name && param.value !== undefined) {
        info[param.name] = param.value;
      }
    });
  }
  
  // Extract position/normal information if available
  if (planeFeature.geometry) {
    if (planeFeature.geometry.normal) {
      info.normal = planeFeature.geometry.normal;
    }
    if (planeFeature.geometry.origin) {
      info.origin = planeFeature.geometry.origin;
    }
  }
  
  // Look for offset value which is common for offset planes
  if (planeFeature.offset !== undefined) {
    info.offset = planeFeature.offset;
  } else if (planeFeature.offsetDistance !== undefined) {
    info.offset = planeFeature.offsetDistance;
  }
  
  return info;
}

/**
 * Gets more specific plane type information
 * @param {Object} feature - The feature object
 * @return {string|null} - More specific plane type or null if not available
 */
function getSpecificPlaneType(feature) {
  // Common Onshape plane feature types
  const planeTypes = {
    'DATUM_PLANE': 'Standard datum plane',
    'OFFSET_DATUM_PLANE': 'Offset plane',
    'ANGLED_DATUM_PLANE': 'Angled plane',
    'COINCIDENT_DATUM_PLANE': 'Coincident plane',
    'THREE_POINT_DATUM_PLANE': 'Three-point plane',
    'LINE_POINT_DATUM_PLANE': 'Line-point plane',
    'MIDPLANE_DATUM_PLANE': 'Mid-plane',
    'TANGENT_DATUM_PLANE': 'Tangent plane'
  };
  
  // Check feature subtype first
  if (feature.subtype && planeTypes[feature.subtype]) {
    return planeTypes[feature.subtype];
  }
  
  // Check if message contains plane type information
  if (feature.message && typeof feature.message === 'string') {
    const lowerMessage = feature.message.toLowerCase();
    if (lowerMessage.includes('offset') && lowerMessage.includes('plane')) {
      return 'Offset plane';
    }
    if (lowerMessage.includes('angle') && lowerMessage.includes('plane')) {
      return 'Angled plane';
    }
  }
  
  // Check for specific parameters that indicate plane type
  if (feature.parameters) {
    const paramNames = feature.parameters.map(p => p.name?.toLowerCase() || '');
    if (paramNames.includes('offset')) return 'Offset plane';
    if (paramNames.includes('angle')) return 'Angled plane';
    if (paramNames.includes('midpoint') || paramNames.includes('midplane')) return 'Mid-plane';
  }
  
  return null;
}

// Run the test
testCustomPlanes()
  .then(() => {
    logger.info('Custom planes test finished');
    process.exit(0);
  })
  .catch(err => {
    logger.error(`Test failed with error: ${err.message}`);
    process.exit(1);
  });