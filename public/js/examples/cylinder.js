// public/js/examples/cylinder.js
import { apiCall } from '../api.js';
import { isAuthenticated } from '../clientAuth.js';
import { getSelectedDocument, getDocumentName, getSelectedPartStudio, getSelectedPlane } from '../ui.js';
import { logInfo, logError, logDebug, logToTerminal } from '../utils/logging.js';
import { getWorkspaces, fetchElementsForDocument } from '../api.js';

/**
 * Example 1: Create a Cylinder
 * 
 * This example creates a circle sketch and extrudes it to create a cylinder.
 */
export async function runExample1() {
  // Add detailed debug logging when example is clicked
  logDebug('Cylinder example clicked - starting execution');
  logToTerminal('cylinder.js', 'Example 1: Create a Cylinder - execution started', 'info');
  
  // Additional log data for API tracking
  const requestId = Math.random().toString(36).substring(2, 8);
  
  // Replace token check with more robust authentication check
  if (!isAuthenticated()) {
    logError('Please authenticate first');
    logToTerminal('cylinder.js', 'Authentication check failed - user not authenticated', 'error');
    return;
  }
  
  logInfo('Running Example 1: Create a Cylinder');
  
  try {
    // Log the beginning of document selection/creation
    logToTerminal('cylinder.js', `Starting document selection/creation (requestId: ${requestId})`, 'debug');
    
    // Step 1: Get or create a document
    let onshapeDocument;
    const selectedDocument = getSelectedDocument();
    if (selectedDocument) {
      onshapeDocument = selectedDocument;
      logInfo(`Using existing document: ${onshapeDocument.name}`);
    } else {
      const newName = getDocumentName() || 'Cylinder Example';
      onshapeDocument = await apiCall('documents', 'POST', { name: newName });
      logInfo(`Created new document: ${newName}`);
    }
    
    // Step 2: Get workspaces
    logInfo('Accessing part studio...');
    try {
      const workspaces = await getWorkspaces(onshapeDocument.id);
      const defaultWorkspace = workspaces[0];
      
      if (!defaultWorkspace) {
        throw new Error('No workspaces found for document');
      }
      
      // Step 3: Get or create a part studio element
      let partStudioId;
      const selectedPartStudio = getSelectedPartStudio();
      
      if (selectedPartStudio && selectedPartStudio.documentId === onshapeDocument.id) {
        partStudioId = selectedPartStudio.id;
        logInfo(`Using selected part studio: ${selectedPartStudio.name}`);
      } else {
        const elements = await fetchElementsForDocument(onshapeDocument.id);
        partStudioId = elements.find(el => el.type === 'PARTSTUDIO')?.id;
        
        if (!partStudioId) {
          logInfo('Creating new part studio...');
          const newElement = await apiCall(
            `documents/d/${onshapeDocument.id}/w/${defaultWorkspace.id}/elements`, 
            'POST', 
            { name: 'Part Studio', elementType: 'PARTSTUDIO' }
          );
          partStudioId = newElement.id;
        }
      }
      
      // Step 4: Determine which plane to use and get its ID
      let sketchPlane = {
        id: "JHD", // Default to TOP plane
        name: "TOP",
        type: "STANDARD"
      };
      
      const selectedPlane = getSelectedPlane();
      if (selectedPlane) {
        // First check if this is a standard plane with a special name format
        if (selectedPlane.id && selectedPlane.id.includes('_TOP')) {
          sketchPlane = { id: "JHD", name: "TOP", type: "STANDARD" };
        } else if (selectedPlane.id && selectedPlane.id.includes('_FRONT')) {
          sketchPlane = { id: "JFD", name: "FRONT", type: "STANDARD" };
        } else if (selectedPlane.id && selectedPlane.id.includes('_RIGHT')) {
          sketchPlane = { id: "JGD", name: "RIGHT", type: "STANDARD" };
        }
        // Then check by name as a fallback
        else if (selectedPlane.name.toUpperCase() === "TOP" || selectedPlane.name.toLowerCase().includes("top plane")) {
          sketchPlane = { id: "JHD", name: "TOP", type: "STANDARD" };
        } else if (selectedPlane.name.toUpperCase() === "FRONT" || selectedPlane.name.toLowerCase().includes("front plane")) {
          sketchPlane = { id: "JFD", name: "FRONT", type: "STANDARD" };
        } else if (selectedPlane.name.toUpperCase() === "RIGHT" || selectedPlane.name.toLowerCase().includes("right plane")) {
          sketchPlane = { id: "JGD", name: "RIGHT", type: "STANDARD" };
        } else {
          // Custom plane
          sketchPlane = { 
            id: selectedPlane.id, 
            name: selectedPlane.name || "Custom Plane", 
            type: "PLANE" 
          };
        }
        
        logInfo(`Using selected sketch plane: ${sketchPlane.name} (ID: ${sketchPlane.id}, Type: ${sketchPlane.type})`);
      } else {
        logInfo('Using default TOP plane');
      }

      // Helper function to log Onshape API calls (for debugging only)
      const logOnshapeApiCall = (endpoint, method, payload) => {
        const onshapeApiUrl = 'https://cad.onshape.com/api/v10';
        const fullOnshapeUrl = `${onshapeApiUrl}/${endpoint}`;
        const localProxyUrl = `/api/${endpoint}`;
        
        logInfo(`------ ONSHAPE API DEBUG INFO ------`);
        logInfo(`URL: ${method} ${localProxyUrl}`);
        logInfo(`Equivalent Onshape URL: ${method} ${fullOnshapeUrl}`);
        if (payload) {
          logInfo(`Payload: ${JSON.stringify(payload, null, 2)}`);
        }
        logInfo(`-----------------------------------`);
      };

      // Get the actual plane ID using featurescript
      const fsScript = `function(context is Context, queries) { 
        return transientQueriesToStrings(evaluateQuery(context, qCreatedBy(makeId("${sketchPlane.name}"), EntityType.FACE))); 
      }`;

      const planeIdEndpoint = `partstudios/d/${onshapeDocument.id}/w/${defaultWorkspace.id}/e/${partStudioId}/featurescript?rollbackBarIndex=-1`;
      logOnshapeApiCall(planeIdEndpoint, 'POST', { script: fsScript });
      
      const fsResponse = await apiCall(
        planeIdEndpoint,
        'POST',
        { script: fsScript }
      );

      // Log the full response for debugging
      logInfo('Featurescript response:', JSON.stringify(fsResponse, null, 2));

      // Extract the actual plane ID from the response with proper error handling
      let actualPlaneId;
      try {
        if (!fsResponse || !fsResponse.result || !fsResponse.result.value || !Array.isArray(fsResponse.result.value)) {
          throw new Error('Invalid response structure from featurescript');
        }
        
        const valueArray = fsResponse.result.value;
        if (valueArray.length === 0) {
          throw new Error('No plane ID found in response');
        }
        
        actualPlaneId = valueArray[0].value;
        if (!actualPlaneId) {
          throw new Error('Invalid plane ID in response');
        }
        
        logInfo(`Got actual plane ID: ${actualPlaneId}`);
      } catch (error) {
        logError(`Failed to get plane ID: ${error.message}`);
        // Fall back to using the default plane ID if we can't get the actual one
        actualPlaneId = sketchPlane.id;
        logInfo(`Using fallback plane ID: ${actualPlaneId}`);
      }
      
      // Step 5: Create a sketch on the selected plane
      logInfo(`Creating sketch on ${sketchPlane.name} plane...`);
      
      // Create a sketch feature with proper format for Onshape API
      const sketchFeature = {
        feature: {
          name: "New Sketch",
          featureType: "newSketch",  // Must be "newSketch" according to docs
          suppressed: false,
          parameters: [
            {
              btType: "BTMParameterQueryList-148",
              queries: [
                {
                  btType: "BTMIndividualQuery-138",
                  deterministicIds: [actualPlaneId]  // Use the actual plane ID from featurescript
                }
              ],
              parameterId: "sketchPlane"
            },
            {
              btType: "BTMParameterBoolean-144",
              value: true,
              parameterId: "disableImprinting"
            }
          ],
          btType: "BTMSketch-151",  // Must be BTMSketch-151 according to docs
          constraints: [],
          entities: []
        }
      };
      
      // Use Onshape API endpoint format directly
      const sketchEndpoint = `partstudios/d/${onshapeDocument.id}/w/${defaultWorkspace.id}/e/${partStudioId}/features`;
      logOnshapeApiCall(sketchEndpoint, 'POST', sketchFeature);
      
      const sketchFeatureResponse = await apiCall(
        sketchEndpoint, 
        'POST',
        sketchFeature
      );
      
      const sketchId = sketchFeatureResponse.feature?.featureId;
      logInfo(`Created sketch with ID: ${sketchId}`);
      
      // Step 6: Draw a circle in the sketch by updating the sketch feature
      logInfo('Drawing circle with radius 0.5 inches at origin...');
      
      // Generate a unique ID for the circle entity
      const circleEntityId = `circle_${Date.now().toString(36)}`;
      
      // Create circle update payload
      const circleUpdatePayload = {
        feature: {
          name: "New Sketch",
          featureType: "newSketch",
          suppressed: false,
          parameters: sketchFeatureResponse.feature.parameters,
          featureId: sketchId,
          btType: "BTMSketch-151",
          constraints: [],
          entities: [
            {
              btType: "BTMSketchCurve-4",
              entityId: circleEntityId,
              geometry: {
                btType: "BTCurveGeometryCircle-115",
                radius: 0.0127, // 0.5 inches in meters
                xCenter: 0.0,
                yCenter: 0.0,
                xDir: 1,
                yDir: 0,
                clockwise: false
              },
              centerId: `${circleEntityId}.center`
            }
          ]
        }
      };
      
      // Use Onshape API endpoint format directly
      const circleEndpoint = `partstudios/d/${onshapeDocument.id}/w/${defaultWorkspace.id}/e/${partStudioId}/features/featureid/${sketchId}`;
      logOnshapeApiCall(circleEndpoint, 'POST', circleUpdatePayload);
      
      const circleResponse = await apiCall(
        circleEndpoint, 
        'POST', 
        circleUpdatePayload
      );
      
      logInfo(`Circle added to sketch.`);
      
      // Optional: Add the FeatureScript query to identify sketch regions
      const fsQueryPayload = {
        script: "\n\nfunction(context is Context, queries){\n\n    // Combine all transient ids into one query\n    const transient_ids = ['IF', 'JFB', 'JFD', 'JFH', 'JGB', 'JGC', 'JGD'];\n    var element_queries is array = makeArray(size(transient_ids));\n\n    var idx = 0;\n    for (var tid in transient_ids)\n    {\n        var query = { \"queryType\" : QueryType.TRANSIENT, \"transientId\" : tid } as Query;\n        element_queries[idx] = query;\n        idx += 1;\n    }\n\n    var cumulative_query = qUnion(element_queries);\n\n    // Apply specific query\n    var specific_query = qEntityFilter(cumulative_query, EntityType.FACE);\n    var matching_entities = evaluateQuery(context, specific_query);\n    return transientQueriesToStrings(matching_entities);\n\n}\n\n"
      };
      
      // Use Onshape API endpoint format directly
      const fsEndpoint = `partstudios/d/${onshapeDocument.id}/w/${defaultWorkspace.id}/e/${partStudioId}/featurescript`;
      logOnshapeApiCall(fsEndpoint, 'POST', fsQueryPayload);
      
      await apiCall(
        fsEndpoint, 
        'POST', 
        fsQueryPayload
      );
      
      // Step 8: Extrude the sketch to create the cylinder
      logInfo('Extruding circle to create cylinder with height 1 inch...');
      const extrudeFeature = {
        feature: {
          name: "New Extrude",
          featureType: "extrude",
          suppressed: false,
          parameters: [
            {
              btType: "BTMParameterEnum-145",
              parameterId: "bodyType",
              value: "SOLID",
              enumName: "ExtendedToolBodyType"
            },
            {
              btType: "BTMParameterEnum-145",
              value: "NEW",
              enumName: "NewBodyOperationType",
              parameterId: "operationType"
            },
            {
              btType: "BTMParameterQueryList-148",
              queries: [
                {
                  btType: "BTMIndividualQuery-138",
                  deterministicIds: [
                    "JGC"
                  ]
                }
              ],
              parameterId: "entities"
            },
            {
              btType: "BTMParameterEnum-145",
              enumName: "BoundingType",
              value: "BLIND",
              parameterId: "endBound"
            },
            {
              btType: "BTMParameterQuantity-147",
              expression: "1 in",
              parameterId: "depth"
            },
            {
              btType: "BTMParameterQueryList-148",
              queries: [
                {
                  btType: "BTMIndividualQuery-138",
                  deterministicIds: []
                }
              ],
              parameterId: "booleanScope"
            }
          ],
          btType: "BTMFeature-134"
        }
      };
      
      // Use Onshape API endpoint format directly
      const extrudeEndpoint = `partstudios/d/${onshapeDocument.id}/w/${defaultWorkspace.id}/e/${partStudioId}/features`;
      logOnshapeApiCall(extrudeEndpoint, 'POST', extrudeFeature);
      
      const extrudeResponse = await apiCall(
        extrudeEndpoint,
        'POST',
        extrudeFeature
      );
      
      logInfo(`Extrude completed.`);
      
      logInfo('Successfully created cylinder in Onshape!');
      
      const onshapeLink = `https://cad.onshape.com/documents/${onshapeDocument.id}`;
      const linkDiv = document.createElement('div');
      linkDiv.innerHTML = `<a href="${onshapeLink}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">Open in Onshape</a>`;
      document.getElementById('logOutput').appendChild(linkDiv);
      
      // After creating features, log success
      logToTerminal('cylinder.js', 'Successfully created cylinder in Onshape', 'info', {
        documentId: onshapeDocument.id,
        link: `https://cad.onshape.com/documents/${onshapeDocument.id}`
      });
      
    } catch (error) {
      logError(`Failed to access Onshape document: ${error.message}`);
      throw error; // Rethrow to be caught by the main try/catch
    }
    
  } catch (error) {
    logError(`Error: ${error.message}`);
    logToTerminal('cylinder.js', `Error in cylinder example: ${error.message}`, 'error', { 
      stack: error.stack,
      requestId
    });
    console.error('Full error:', error);
  }
}

export async function runCylinderExample() {
  if (!isAuthenticated()) {
    logError('Please authenticate first');
    return;
  }

  try {
    // ... rest of existing code ...
  } catch (error) {
    logError(`Failed to access Onshape document: ${error.message}`);
    throw error;
  }
}