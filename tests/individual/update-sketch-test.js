/**
 * Update Sketch Test - try to copy sketch data from one sketch to another
 * Use the current auth and api utlities
 * 
 * Use this Onshape document
 * https://cad.onshape.com/documents/398a82c2e197a5efee277cf7/w/a71572336b87355a5929aba6/e/f0c841cca00dfe25a0308421
 * Copy sketch data from "Sketch on AFP"
 * And add it to "Update Sketch"
 * 
 * Use the direct api to do this
 */

const TEST_DOCUMENT = {
    id: '398a82c2e197a5efee277cf7',
    workspaceId: 'a71572336b87355a5929aba6',
    elementId: 'f0c841cca00dfe25a0308421'
};

const SKETCH_NAME = "Sketch on AFP";
const UPDATE_SKETCH_NAME = "Update Sketch";

// Import required modules
const logger = require('../../src/utils/logger').scope('SketchTest');
const AuthManager = require('../../src/auth/auth-manager');
const OnshapeClient = require('../../src/api/client');
const config = require('../../config');

// Create API client using project's auth system
function createClient() {
  try {
    // Use the base URL without any API version prefix
    const baseUrl = process.env.ONSHAPE_API_URL || config.onshape.baseUrl;
    logger.info(`Using API base URL: ${baseUrl}`);
    
    // Create auth manager with API_KEY method
    process.env.ONSHAPE_AUTH_METHOD = 'API_KEY';
    
    const authManager = new AuthManager({
      baseUrl: baseUrl,
      accessKey: process.env.ONSHAPE_ACCESS_KEY,
      secretKey: process.env.ONSHAPE_SECRET_KEY
    });
    
    logger.info(`Using authentication method: ${authManager.getMethod()}`);
    
    // Create OnshapeClient with auth manager and explicit API URL
    return new OnshapeClient({
      baseUrl: baseUrl,
      apiUrl: baseUrl, // Use the same base URL to avoid double prefixing
      authManager: authManager
    });
  } catch (error) {
    logger.error(`Failed to create client: ${error.message}`);
    throw error;
  }
}

/**
 * Get all entities from a sketch
 * @param {Object} client - API client
 * @param {string} sketchId - Sketch ID
 * @returns {Promise<Array>} Sketch entities
 */
async function getSketchEntities(client, sketchId) {
  const response = await client.request(
    'GET',
    `/api/v10/partstudios/d/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}/sketches/${sketchId}/entities`
  );
  return response.data;
}

/**
 * Update a sketch with new entities
 * @param {Object} client - API client
 * @param {string} sketchId - Sketch ID
 * @param {Array} entities - Entities to add
 * @returns {Promise<Object>} API response
 */
async function updateSketchEntities(client, sketchId, entities) {
  // First get the current sketch feature to preserve its properties
  const sketchResponse = await client.request(
    'GET',
    `/api/v10/partstudios/d/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}/sketches/${sketchId}`
  );
  
  const sketchFeature = sketchResponse.data;
  
  // Create the update payload
  const updatePayload = {
    feature: {
      ...sketchFeature,
      entities: entities,
      // Ensure we're not creating a new sketch
      featureType: "sketch",
      btType: "BTMSketch-151"
    }
  };
  
  // Update the sketch
  return client.request(
    'POST',
    `/api/v10/partstudios/d/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}/features/featureid/${sketchId}`,
    updatePayload
  );
}

async function runTest() {
  try {
    // Create API client
    const client = createClient();
    
    // Step 1: Get all sketches in the part studio
    logger.info('Getting all sketches...');
    const sketchesResponse = await client.request(
      'GET',
      `/api/v10/partstudios/d/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}/sketches`
    );
    
    // Find the source and target sketches
    const sourceSketch = sketchesResponse.data.find(sketch => sketch.name === SKETCH_NAME);
    const targetSketch = sketchesResponse.data.find(sketch => sketch.name === UPDATE_SKETCH_NAME);
    
    if (!sourceSketch) {
      throw new Error(`Source sketch "${SKETCH_NAME}" not found`);
    }
    if (!targetSketch) {
      throw new Error(`Target sketch "${UPDATE_SKETCH_NAME}" not found`);
    }
    
    logger.info(`Found source sketch: ${sourceSketch.name} (${sourceSketch.id})`);
    logger.info(`Found target sketch: ${targetSketch.name} (${targetSketch.id})`);
    
    // Step 2: Get entities from both sketches
    logger.info('Getting entities from both sketches...');
    const sourceEntities = await getSketchEntities(client, sourceSketch.id);
    const targetEntities = await getSketchEntities(client, targetSketch.id);
    
    logger.info(`Found ${sourceEntities.length} entities in source sketch`);
    logger.info(`Found ${targetEntities.length} entities in target sketch`);
    
    // Step 3: Combine entities, ensuring unique IDs
    const combinedEntities = [...targetEntities];
    const existingIds = new Set(targetEntities.map(e => e.entityId));
    
    // Add source entities with new IDs if they conflict
    for (const entity of sourceEntities) {
      if (existingIds.has(entity.entityId)) {
        // Generate new ID for conflicting entity
        const newId = `imported_${entity.entityId}_${Date.now()}`;
        combinedEntities.push({
          ...entity,
          entityId: newId,
          // Update any references to the old ID
          centerId: entity.centerId?.replace(entity.entityId, newId),
          startId: entity.startId?.replace(entity.entityId, newId),
          endId: entity.endId?.replace(entity.entityId, newId)
        });
      } else {
        combinedEntities.push(entity);
      }
    }
    
    logger.info(`Combined entities: ${combinedEntities.length} total`);
    
    // Step 4: Update the target sketch with combined entities
    logger.info('Updating target sketch with combined entities...');
    const updateResponse = await updateSketchEntities(client, targetSketch.id, combinedEntities);
    
    logger.info('Successfully updated target sketch');
    logger.info('Document URL:', `https://cad.onshape.com/documents/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}`);
    
  } catch (error) {
    logger.error('Test failed:', error.message);
    if (error.response) {
      logger.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Run the test
runTest().catch(error => {
  logger.error('Test failed:', error);
  process.exit(1);
});


