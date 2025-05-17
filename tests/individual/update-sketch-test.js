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
    const baseUrl = process.env.ONSHAPE_BASE_URL || config.onshape.baseUrl;
    // Ensure base URL doesn't include /api/v10 and doesn't end with a slash
    const cleanBaseUrl = baseUrl.replace(/\/api\/v\d+$/, '').replace(/\/$/, '');
    logger.info(`Using API base URL: ${cleanBaseUrl}`);
    
    // Create auth manager with API_KEY method
    process.env.ONSHAPE_AUTH_METHOD = 'API_KEY';
    
    const authManager = new AuthManager({
      baseUrl: cleanBaseUrl,
      accessKey: process.env.ONSHAPE_ACCESS_KEY,
      secretKey: process.env.ONSHAPE_SECRET_KEY
    });
    
    logger.info(`Using authentication method: ${authManager.getMethod()}`);
    
    // Create OnshapeClient with auth manager
    const client = new OnshapeClient({
      baseUrl: cleanBaseUrl,
      apiUrl: `${cleanBaseUrl}/api/v10`,
      authManager: authManager
    });
    
    logger.info(`Client configured with baseUrl: ${client.baseUrl}, apiUrl: ${client.apiUrl}`);
    return client;
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
  // Get all features to find the sketch
  const getPath = `/partstudios/d/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}/features`;
  logger.info('GET Features Request:', {
    url: `${client.apiUrl}${getPath}`,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': 'Basic [REDACTED]'
    }
  });
  
  const featuresResponse = await client.request('GET', getPath);
  logger.info('GET Features Response:', featuresResponse);
  
  // Find the sketch feature in the features array
  const sketchFeature = featuresResponse.features.find(f => 
    f.type === 151 && // BTMSketch type
    f.message && 
    f.message.featureId === sketchId
  );
  
  if (!sketchFeature) {
    throw new Error(`Sketch feature ${sketchId} not found in document. Available features: ${JSON.stringify(featuresResponse.features.map(f => f.message?.featureId))}`);
  }
  
  // The entities are in the sketch feature's message.entities array
  if (!sketchFeature.message.entities || !Array.isArray(sketchFeature.message.entities)) {
    throw new Error(`No entities found in sketch feature ${sketchId}`);
  }
  
  // Log the first entity to see its structure
  logger.info('First entity structure:', JSON.stringify(sketchFeature.message.entities[0], null, 2));
  
  // Map the entities to the format needed for the update
  const entities = sketchFeature.message.entities.map(entity => {
    // Handle text entities differently
    if (entity.type === 1761) { // BTMSketchTextEntity
      return {
        type: entity.type,
        typeName: entity.typeName,
        message: {
          ...entity.message,
          parameters: entity.message.parameters.map(param => ({
            type: param.type,
            typeName: param.typeName,
            message: param.message
          }))
        }
      };
    }
    
    // Handle regular sketch entities
    return {
      type: entity.type,
      typeName: entity.typeName,
      message: {
        geometry: entity.message.geometry,
        isConstruction: entity.message.isConstruction || false,
        isFromSplineHandle: entity.message.isFromSplineHandle || false,
        isFromSplineControlPolygon: entity.message.isFromSplineControlPolygon || false,
        isFromEndpointSplineHandle: entity.message.isFromEndpointSplineHandle || false,
        centerId: entity.message.centerId,
        internalIds: entity.message.internalIds || [],
        namespace: entity.message.namespace || "",
        index: entity.message.index,
        parameters: entity.message.parameters || [],
        nodeId: entity.message.nodeId,
        entityId: entity.message.entityId
      }
    };
  });
  
  logger.info(`Found ${entities.length} entities in sketch ${sketchId}`);
  return entities;
}

function mapConstraint(constraint) {
  if (!constraint || !constraint.message) {
    logger.warn('Invalid constraint structure:', constraint);
    return null;
  }

  const { constraintType, parameters = [] } = constraint.message;
  
  // Map constraint parameters based on type
  const mappedParams = parameters.map(param => ({
    btType: "BTMParameterString-149",
    value: param.message?.value || "",
    expression: param.message?.expression || "",
    parameterId: param.message?.parameterId || "",
    localFirst: param.message?.localFirst || false,
    length: param.message?.length || 0,
    labelRatio: param.message?.labelRatio || 0.5,
    labelAngle: param.message?.labelAngle || 0,
    entityId: param.message?.entityId || ""
  }));

  return {
    btType: "BTMSketchConstraint-2",
    constraintType: constraintType,
    parameters: mappedParams
  };
}

function mapSketchParameters(sourceSketch) {
  return [
    {
      btType: "BTMParameterQueryList-148",
      queries: [
        {
          btType: "BTMIndividualQuery-138",
          queryStatement: null,
          queryString: sourceSketch.message.parameters?.[0]?.message?.queries?.[0]?.message?.queryString || "",
          nodeId: sourceSketch.message.parameters?.[0]?.message?.queries?.[0]?.message?.nodeId || "",
          deterministicIds: sourceSketch.message.parameters?.[0]?.message?.queries?.[0]?.message?.geometryIds || [],
          hasUserCode: false,
          version: 0
        }
      ],
      parameterId: "sketchPlane",
      hasUserCode: false,
      version: 0
    },
    {
      btType: "BTMParameterBoolean-144",
      value: false,
      parameterId: "disableImprinting",
      hasUserCode: false,
      version: 0
    }
  ];
}

/**
 * Update a sketch with new entities
 * @param {Object} client - API client
 * @param {string} targetSketchId - Target sketch ID
 * @param {string} sourceSketchId - Source sketch ID
 * @returns {Promise<Object>} API response
 */
async function updateSketchEntities(client, sourceSketch, targetSketch, entities) {
  try {
    // Get feature details to ensure we have the latest data
    const getPath = `/partstudios/d/${sourceSketch.did}/${sourceSketch.wvm}/${sourceSketch.wvmid}/e/${sourceSketch.eid}/features`;
    const featureDetails = await client.request('GET', getPath);

    console.log('[SketchTest] Found sketch features:', {
      sourceId: sourceSketch.featureId,
      targetId: targetSketch.featureId
    });

    // Get the source sketch feature to get constraints
    const sourceSketchFeature = featureDetails.features.find(
      f => f.type === 151 && f.message.featureId === sourceSketch.featureId
    );

    if (!sourceSketchFeature) {
      throw new Error(`Source sketch feature ${sourceSketch.featureId} not found`);
    }

    console.log('[SketchTest] Source sketch constraints structure:', {
      hasConstraints: !!sourceSketchFeature.message.constraints,
      constraintsCount: sourceSketchFeature.message.constraints?.length || 0,
      firstConstraint: sourceSketchFeature.message.constraints?.[0]
    });

    // Map constraints with proper structure
    const constraints = sourceSketchFeature.message.constraints?.map(constraint => {
      if (!constraint || !constraint.message) return null;
      
      const { constraintType, parameters } = constraint.message;
      if (!constraintType || !parameters) return null;

      return {
        btType: 'BTMConstraint-152',
        constraintType,
        parameters: parameters.map(param => ({
          btType: 'BTMParameter-134',
          value: param.message?.value,
          expression: param.message?.expression,
          parameterId: param.message?.parameterId,
          localFirst: param.message?.localFirst,
          length: param.message?.length,
          labelRatio: param.message?.labelRatio,
          labelAngle: param.message?.labelAngle
        }))
      };
    }).filter(Boolean) || [];

    // Get sketch parameters
    const sketchParameters = mapSketchParameters(sourceSketchFeature);

    // Create feature update payload
    const payload = {
      feature: {
        btType: 'BTMSketch-151',
        subFeatures: [],
        parameters: sketchParameters,
        entities: entities.map(entity => ({
          btType: 'BTMSketchCurve-4',
          geometry: entity.geometry,
          isConstruction: entity.isConstruction,
          isFromSplineHandle: entity.isFromSplineHandle,
          isFromSplineControlPolygon: entity.isFromSplineControlPolygon,
          isFromEndpointSplineHandle: entity.isFromEndpointSplineHandle,
          centerId: entity.centerId,
          internalIds: entity.internalIds,
          namespace: entity.namespace,
          index: entity.index,
          parameters: entity.parameters,
          nodeId: entity.nodeId,
          entityId: entity.entityId
        })),
        constraints
      }
    };

    // Log payload structure without the full content
    console.log('[SketchTest] Payload structure:', {
      featureType: payload.feature.btType,
      entityCount: payload.feature.entities.length,
      constraintCount: payload.feature.constraints.length,
      parameterCount: payload.feature.parameters.length,
      firstEntity: {
        type: payload.feature.entities[0]?.btType,
        hasGeometry: !!payload.feature.entities[0]?.geometry,
        nodeId: payload.feature.entities[0]?.nodeId
      },
      firstConstraint: payload.feature.constraints[0],
      firstParameter: payload.feature.parameters[0]
    });

    // Log curl equivalent with truncated payload
    const curlCommand = `curl -X POST \\
      -H "Accept: application/json" \\
      -H "Content-Type: application/json" \\
      -H "Authorization: Basic [REDACTED]" \\
      -d '${JSON.stringify(payload).substring(0, 1000)}...' \\
      "https://cad.onshape.com/api/partstudios/d/${sourceSketch.did}/w/${sourceSketch.wvmid}/e/${sourceSketch.eid}/features/featureid/${targetSketch.featureId}"`;
    
    console.log('[SketchTest] Curl equivalent (truncated):', curlCommand);

    // Update the target sketch with the source sketch's entities and constraints
    const updatePath = `/partstudios/d/${targetSketch.did}/${targetSketch.wvm}/${targetSketch.wvmid}/e/${targetSketch.eid}/features/featureid/${targetSketch.featureId}`;
    const updateResponse = await client.request('POST', updatePath, {
      feature: {
        btType: 'BTMSketch-151',
        subFeatures: [],
        parameters: [
          {
            btType: 'BTMParameterQueryList-148',
            queries: [
              {
                btType: 'BTMIndividualQuery-138',
                queryStatement: null,
                queryString: '',
                nodeId: 'M0Idd0aJDuS/QndlH',
                deterministicIds: ['JMC'],
                hasUserCode: false,
                version: 0
              }
            ],
            parameterId: 'sketchPlane',
            hasUserCode: false,
            version: 0
          },
          {
            btType: 'BTMParameterBoolean-144',
            value: false,
            parameterId: 'disableImprinting',
            hasUserCode: false,
            version: 0
          }
        ],
        entities: entities,
        constraints: constraints
      }
    });

    console.log('[SketchTest] Sketch update completed successfully');
    return updateResponse;
  } catch (error) {
    console.error('[SketchTest] Error updating sketch:', error);
    throw error;
  }
}

async function runTest() {
  try {
    // Create API client
    const client = createClient();
    
    // Step 1: Get all sketches in the part studio
    logger.info('Getting all sketches...');
    const sketchesPath = `/partstudios/d/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}/sketches`;
    logger.info('GET Sketches Request:', {
      url: `${client.apiUrl}${sketchesPath}`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Basic [REDACTED]'
      }
    });
    
    const sketchesResponse = await client.request('GET', sketchesPath);
    logger.info('GET Sketches Response:', sketchesResponse);
    
    // Find the source and target sketches
    if (!sketchesResponse || !sketchesResponse.sketches) {
      throw new Error('Failed to fetch sketches: Invalid response format');
    }
    
    const sketches = sketchesResponse.sketches;
    const sourceSketch = {
      ...sketches.find(sketch => sketch.sketch === SKETCH_NAME),
      did: TEST_DOCUMENT.id,
      wvm: 'w',
      wvmid: TEST_DOCUMENT.workspaceId,
      eid: TEST_DOCUMENT.elementId
    };
    const targetSketch = {
      ...sketches.find(sketch => sketch.sketch === UPDATE_SKETCH_NAME),
      did: TEST_DOCUMENT.id,
      wvm: 'w',
      wvmid: TEST_DOCUMENT.workspaceId,
      eid: TEST_DOCUMENT.elementId
    };
    
    if (!sourceSketch.featureId) {
      throw new Error(`Source sketch "${SKETCH_NAME}" not found in document ${TEST_DOCUMENT.id}`);
    }
    if (!targetSketch.featureId) {
      throw new Error(`Target sketch "${UPDATE_SKETCH_NAME}" not found in document ${TEST_DOCUMENT.id}`);
    }
    
    logger.info('Found sketches:', {
      source: sourceSketch.sketch,
      sourceId: sourceSketch.featureId,
      target: targetSketch.sketch,
      targetId: targetSketch.featureId
    });
    
    // Step 2: Get entities from source sketch
    logger.info(`Getting entities from source sketch "${SKETCH_NAME}"...`);
    const sourceEntities = await getSketchEntities(client, sourceSketch.featureId);
    
    if (!sourceEntities || !Array.isArray(sourceEntities)) {
      throw new Error(`Failed to fetch entities from source sketch "${SKETCH_NAME}"`);
    }
    
    logger.info(`Found ${sourceEntities.length} entities in source sketch`);
    
    // Step 3: Update target sketch with source entities
    logger.info(`Updating target sketch "${UPDATE_SKETCH_NAME}" with ${sourceEntities.length} entities...`);
    const updateResponse = await updateSketchEntities(client, sourceSketch, targetSketch, sourceEntities);
    
    if (!updateResponse) {
      throw new Error(`Failed to update target sketch "${UPDATE_SKETCH_NAME}"`);
    }
    
    logger.info('Sketch update completed successfully');
    logger.info('Document URL:', `https://cad.onshape.com/documents/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}`);
    return updateResponse;
    
  } catch (error) {
    logger.error('Test failed:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Run the test
runTest().catch(error => {
  logger.error('Test failed:', error);
  process.exit(1);
});


