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
  const entities = sketchFeature.message.entities.map((entity, index) => {
    console.log(`[SketchTest] Entity ${index} structure:`, JSON.stringify(entity, null, 2));
    
    // Check if entity has the expected structure
    if (!entity.message || !entity.message.geometry) {
      console.log(`[SketchTest] Entity ${index} missing expected structure:`, entity);
      return null;
    }
    
    // Return a simplified entity structure with only essential properties
    return {
      btType: entity.typeName,
      geometry: {
        btType: entity.message.geometry.typeName,
        ...entity.message.geometry.message
      },
      isConstruction: entity.message.isConstruction || false,
      entityId: entity.message.entityId
    };
  }).filter(Boolean); // Remove null entities
  
  logger.info(`Found ${entities.length} entities in sketch ${sketchId}`);
  return entities;
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
        btType: 'BTMSketchConstraint-2',
        constraintType,
        parameters: parameters.map(param => ({
          btType: 'BTMParameterString-149',
          value: param.message?.value || '',
          parameterId: param.message?.parameterId || ''
        }))
      };
    }).filter(Boolean) || [];

    // Use FeatureScript to copy sketch data - more compatible with Onshape
    const copySketchScript = {
      script: `
        function(context is Context, queries) {
          try {
            // Validate input parameters
            if ("${sourceSketch.featureId}" == "" || "${targetSketch.featureId}" == "") {
              throw new Error("Invalid sketch IDs provided");
            }
            
            // Get the source sketch feature
            const sourceSketch = getFeature(context, "${sourceSketch.featureId}");
            if (!sourceSketch) {
              throw new Error("Source sketch not found");
            }
            
            // Validate source sketch type
            if (getFeatureType(context, sourceSketch) != FeatureType.SKETCH) {
              throw new Error("Source feature is not a sketch");
            }
            
            // Get all entities from source sketch
            const sourceEntities = evaluateQuery(context, qSketchRegion(sourceSketch));
            if (size(sourceEntities) == 0) {
              throw new Error("No entities found in source sketch");
            }
            
            // Validate entity count (prevent infinite loops)
            const maxEntities = 1000;
            if (size(sourceEntities) > maxEntities) {
              throw new Error("Source sketch has too many entities (" + size(sourceEntities) + "). Maximum allowed: " + maxEntities);
            }
            
            // Create a new sketch on the same plane as the target sketch
            const targetSketch = getFeature(context, "${targetSketch.featureId}");
            if (!targetSketch) {
              throw new Error("Target sketch not found");
            }
            
            // Validate target sketch type
            if (getFeatureType(context, targetSketch) != FeatureType.SKETCH) {
              throw new Error("Target feature is not a sketch");
            }
            
            // Get the sketch plane from target sketch
            const targetPlane = qCreatedBy(targetSketch, EntityType.FACE);
            if (targetPlane == undefined || size(targetPlane) == 0) {
              throw new Error("Could not determine target sketch plane");
            }
            
            // Create new sketch with validation
            const newSketch = newSketch(context, "Copied Sketch", {
              "sketchPlane": targetPlane
            });
            
            if (newSketch == undefined) {
              throw new Error("Failed to create new sketch");
            }
            
            // Copy entities to new sketch with full type support
            var copiedCount = 0;
            var copiedEntities = [];
            var entityMapping = {}; // Map old entity IDs to new entity IDs for constraints
            var errorCount = 0;
            var skippedCount = 0;
            
            // Performance optimization: Process entities in batches
            const batchSize = 50;
            const totalEntities = size(sourceEntities);
            var processedCount = 0;
            
            console.log("Starting entity copy process. Total entities: " + totalEntities + ", Batch size: " + batchSize);
            
            for (var i = 0; i < totalEntities; i += 1) {
              const entity = sourceEntities[i];
              
              // Progress tracking
              if (i % batchSize == 0) {
                const progress = (i / totalEntities * 100).toFixed(1);
                console.log("Progress: " + progress + "% (" + i + "/" + totalEntities + " entities processed)");
              }
              
              // Validate entity
              if (entity == undefined) {
                console.log("Entity " + i + " is undefined, skipping");
                skippedCount += 1;
                continue;
              }
              
              const entityType = getEntityType(context, entity);
              if (entityType == undefined) {
                console.log("Entity " + i + " has undefined type, skipping");
                skippedCount += 1;
                continue;
              }
              
              const oldEntityId = entity.id;
              if (oldEntityId == undefined) {
                console.log("Entity " + i + " has no ID, skipping");
                skippedCount += 1;
                continue;
              }
              
              try {
                if (entityType == EntityType.EDGE) {
                  // Copy edge geometry - support all curve types
                  const edgeGeometry = getEdgeGeometry(context, entity);
                  if (edgeGeometry == undefined) {
                    console.log("Entity " + i + " has no geometry, skipping");
                    skippedCount += 1;
                    continue;
                  }
                  
                  var newEntity;
                  
                  if (edgeGeometry is Line) {
                    // Handle line segments
                    const startPoint = edgeGeometry.origin;
                    const direction = edgeGeometry.direction;
                    const length = edgeGeometry.length;
                    
                    // Validate line parameters
                    if (startPoint == undefined || direction == undefined || length == undefined || length <= 0) {
                      console.log("Entity " + i + " has invalid line parameters, skipping");
                      skippedCount += 1;
                      continue;
                    }
                    
                    newEntity = sketchLine(context, newSketch, {
                      "start": startPoint,
                      "end": startPoint + direction * length
                    });
                  } else if (edgeGeometry is Circle) {
                    // Handle circles
                    const center = edgeGeometry.center;
                    const radius = edgeGeometry.radius;
                    
                    // Validate circle parameters
                    if (center == undefined || radius == undefined || radius <= 0) {
                      console.log("Entity " + i + " has invalid circle parameters, skipping");
                      skippedCount += 1;
                      continue;
                    }
                    
                    newEntity = sketchCircle(context, newSketch, {
                      "center": center,
                      "radius": radius
                    });
                  } else if (edgeGeometry is Ellipse) {
                    // Handle ellipses
                    const center = edgeGeometry.center;
                    const majorAxis = edgeGeometry.majorAxis;
                    const minorAxis = edgeGeometry.minorAxis;
                    const majorRadius = edgeGeometry.majorRadius;
                    const minorRadius = edgeGeometry.minorRadius;
                    
                    // Validate ellipse parameters
                    if (center == undefined || majorAxis == undefined || minorAxis == undefined || 
                        majorRadius == undefined || minorRadius == undefined || 
                        majorRadius <= 0 || minorRadius <= 0) {
                      console.log("Entity " + i + " has invalid ellipse parameters, skipping");
                      skippedCount += 1;
                      continue;
                    }
                    
                    newEntity = sketchEllipse(context, newSketch, {
                      "center": center,
                      "majorAxis": majorAxis,
                      "minorAxis": minorAxis,
                      "majorRadius": majorRadius,
                      "minorRadius": minorRadius
                    });
                  } else if (edgeGeometry is Arc) {
                    // Handle arcs
                    const center = edgeGeometry.center;
                    const radius = edgeGeometry.radius;
                    const startAngle = edgeGeometry.startAngle;
                    const endAngle = edgeGeometry.endAngle;
                    
                    // Validate arc parameters
                    if (center == undefined || radius == undefined || radius <= 0 || 
                        startAngle == undefined || endAngle == undefined) {
                      console.log("Entity " + i + " has invalid arc parameters, skipping");
                      skippedCount += 1;
                      continue;
                    }
                    
                    newEntity = sketchArc(context, newSketch, {
                      "center": center,
                      "radius": radius,
                      "startAngle": startAngle,
                      "endAngle": endAngle
                    });
                  } else if (edgeGeometry is Spline) {
                    // Handle splines with control points
                    const controlPoints = edgeGeometry.controlPoints;
                    const knots = edgeGeometry.knots;
                    const degree = edgeGeometry.degree;
                    
                    // Validate spline parameters
                    if (controlPoints == undefined || size(controlPoints) < 2 || 
                        knots == undefined || degree == undefined || degree < 1) {
                      console.log("Entity " + i + " has invalid spline parameters, skipping");
                      skippedCount += 1;
                      continue;
                    }
                    
                    newEntity = sketchSpline(context, newSketch, {
                      "controlPoints": controlPoints,
                      "knots": knots,
                      "degree": degree
                    });
                  } else if (edgeGeometry is BSplineCurve) {
                    // Handle B-spline curves
                    const controlPoints = edgeGeometry.controlPoints;
                    const knots = edgeGeometry.knots;
                    const degree = edgeGeometry.degree;
                    
                    // Validate B-spline parameters
                    if (controlPoints == undefined || size(controlPoints) < 2 || 
                        knots == undefined || degree == undefined || degree < 1) {
                      console.log("Entity " + i + " has invalid B-spline parameters, skipping");
                      skippedCount += 1;
                      continue;
                    }
                    
                    newEntity = sketchBSpline(context, newSketch, {
                      "controlPoints": controlPoints,
                      "knots": knots,
                      "degree": degree
                    });
                  } else {
                    // Handle other curve types with generic approach
                    console.log("Unsupported curve type for entity " + i + ": " + edgeGeometry);
                    skippedCount += 1;
                    continue;
                  }
                  
                  if (newEntity != undefined) {
                    copiedEntities = append(copiedEntities, newEntity);
                    entityMapping[oldEntityId] = newEntity;
                    copiedCount += 1;
                  } else {
                    console.log("Failed to create new entity for entity " + i);
                    errorCount += 1;
                  }
                  
                } else if (entityType == EntityType.VERTEX) {
                  // Handle points/vertices
                  const point = getVertexPoint(context, entity);
                  if (point == undefined) {
                    console.log("Entity " + i + " has no point data, skipping");
                    skippedCount += 1;
                    continue;
                  }
                  
                  const newPoint = sketchPoint(context, newSketch, {
                    "point": point
                  });
                  
                  if (newPoint != undefined) {
                    copiedEntities = append(copiedEntities, newPoint);
                    entityMapping[oldEntityId] = newPoint;
                    copiedCount += 1;
                  } else {
                    console.log("Failed to create new point for entity " + i);
                    errorCount += 1;
                  }
                  
                } else if (entityType == EntityType.FACE) {
                  // Handle face entities (sketch regions)
                  const faceGeometry = getFaceGeometry(context, entity);
                  if (faceGeometry is SketchRegion) {
                    // Copy sketch region
                    const regionEntities = evaluateQuery(context, qSketchRegion(faceGeometry));
                    // Recursively copy region entities
                    for (var j = 0; j < size(regionEntities); j += 1) {
                      // This would need recursive handling
                      console.log("Sketch region found - would need recursive copying");
                    }
                  }
                } else {
                  console.log("Unsupported entity type for entity " + i + ": " + entityType);
                  skippedCount += 1;
                  continue;
                }
                
                processedCount += 1;
                
              } catch (entityError) {
                console.log("Error copying entity " + i + ": " + entityError.message);
                errorCount += 1;
                // Continue with next entity instead of failing completely
                continue;
              }
            }
            
            console.log("Entity copy process completed. Processed: " + processedCount + ", Copied: " + copiedCount + ", Errors: " + errorCount + ", Skipped: " + skippedCount);
            
            // Now copy constraints between entities
            var constraintCount = 0;
            try {
              // Get constraints from source sketch
              const sourceConstraints = getSketchConstraints(context, sourceSketch);
              if (sourceConstraints != undefined && size(sourceConstraints) > 0) {
                const totalConstraints = size(sourceConstraints);
                console.log("Starting constraint copy process. Total constraints: " + totalConstraints);
                
                // Performance optimization: Process constraints in batches
                const constraintBatchSize = 25;
                
                for (var k = 0; k < totalConstraints; k += 1) {
                  const constraint = sourceConstraints[k];
                  
                  // Progress tracking for constraints
                  if (k % constraintBatchSize == 0) {
                    const progress = (k / totalConstraints * 100).toFixed(1);
                    console.log("Constraint progress: " + progress + "% (" + k + "/" + totalConstraints + " constraints processed)");
                  }
                  
                  const constraintType = constraint.constraintType;
                  
                  try {
                    if (constraintType == "parallel") {
                      // Parallel constraint
                      const entities = constraint.entities;
                      if (size(entities) == 2) {
                        const entity1 = entityMapping[entities[0]];
                        const entity2 = entityMapping[entities[1]];
                        if (entity1 != undefined && entity2 != undefined) {
                          addConstraint(context, newSketch, {
                            "constraintType": "parallel",
                            "entities": [entity1, entity2]
                          });
                          constraintCount += 1;
                        }
                      }
                    } else if (constraintType == "perpendicular") {
                      // Perpendicular constraint
                      const entities = constraint.entities;
                      if (size(entities) == 2) {
                        const entity1 = entityMapping[entities[0]];
                        const entity2 = entityMapping[entities[1]];
                        if (entity1 != undefined && entity2 != undefined) {
                          addConstraint(context, newSketch, {
                            "constraintType": "perpendicular",
                            "entities": [entity1, entity2]
                          });
                          constraintCount += 1;
                        }
                      }
                    } else if (constraintType == "equal") {
                      // Equal constraint
                      const entities = constraint.entities;
                      if (size(entities) == 2) {
                        const entity1 = entityMapping[entities[0]];
                        const entity2 = entityMapping[entities[1]];
                        if (entity1 != undefined && entity2 != undefined) {
                          addConstraint(context, newSketch, {
                            "constraintType": "equal",
                            "entities": [entity1, entity2]
                          });
                          constraintCount += 1;
                        }
                      }
                    } else if (constraintType == "coincident") {
                      // Coincident constraint
                      const entities = constraint.entities;
                      if (size(entities) == 2) {
                        const entity1 = entityMapping[entities[0]];
                        const entity2 = entityMapping[entities[1]];
                        if (entity1 != undefined && entity2 != undefined) {
                          addConstraint(context, newSketch, {
                            "constraintType": "coincident",
                            "entities": [entity1, entity2]
                          });
                          constraintCount += 1;
                        }
                      }
                    } else if (constraintType == "distance") {
                      // Distance constraint
                      const entities = constraint.entities;
                      const distance = constraint.distance;
                      if (size(entities) == 2 && distance != undefined) {
                        const entity1 = entityMapping[entities[0]];
                        const entity2 = entityMapping[entities[1]];
                        if (entity1 != undefined && entity2 != undefined) {
                          addConstraint(context, newSketch, {
                            "constraintType": "distance",
                            "entities": [entity1, entity2],
                            "distance": distance
                          });
                          constraintCount += 1;
                        }
                      }
                    } else if (constraintType == "angle") {
                      // Angle constraint
                      const entities = constraint.entities;
                      const angle = constraint.angle;
                      if (size(entities) == 2 && angle != undefined) {
                        const entity1 = entityMapping[entities[0]];
                        const entity2 = entityMapping[entities[1]];
                        if (entity1 != undefined && entity2 != undefined) {
                          addConstraint(context, newSketch, {
                            "constraintType": "angle",
                            "entities": [entity1, entity2],
                            "angle": angle
                          });
                          constraintCount += 1;
                        }
                      }
                    } else if (constraintType == "radius") {
                      // Radius constraint
                      const entity = constraint.entity;
                      const radius = constraint.radius;
                      if (entity != undefined && radius != undefined) {
                        const newEntity = entityMapping[entity];
                        if (newEntity != undefined) {
                          addConstraint(context, newSketch, {
                            "constraintType": "radius",
                            "entity": newEntity,
                            "radius": radius
                          });
                          constraintCount += 1;
                        }
                      }
                    }
                  } catch (constraintError) {
                    console.log("Error copying constraint " + k + " (" + constraintType + "): " + constraintError.message);
                    // Continue with next constraint
                    continue;
                  }
                }
                
                console.log("Constraint copy process completed. Total constraints: " + totalConstraints + ", Successfully copied: " + constraintCount);
              }
            } catch (constraintsError) {
              console.log("Error accessing constraints: " + constraintsError.message);
            }
            
            return "Successfully copied " + copiedCount + " entities and " + constraintCount + " constraints to new sketch. Total entities processed: " + size(sourceEntities) + ". Errors: " + errorCount + ", Skipped: " + skippedCount;
          } catch (e) {
            throw new Error("Failed to copy sketch: " + e.message);
          }
        }
      `,
      queries: {}
    };

    console.log('[SketchTest] Using FeatureScript to copy sketch data...');
    console.log('[SketchTest] Script:', copySketchScript.script);
    
    // Execute the FeatureScript using the correct API path format
    const scriptPath = `/api/v10/partstudios/d/${targetSketch.did}/${targetSketch.wvm}/${targetSketch.wvmid}/e/${targetSketch.eid}/featurescript?rollbackBarIndex=-1`;
    const updateResponse = await client.request('POST', scriptPath, copySketchScript);

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


