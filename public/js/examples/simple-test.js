// public/js/tests/sketch-test.js
import { apiCall } from '../api.js';
import { isAuthenticated } from '../clientAuth.js';
import { logInfo, logError } from '../utils/logging.js';

// Constants for the public document we'll use
const TEST_DOCUMENT = {
  id: '4eb4f5f4368123036ba2d017',
  workspaceId: '9b7966852ea238ca8cbd51e6',
  elementId: '3ea82d686e96a639c7f77453'
};

/**
 * Test 1: Create a sketch on the Top plane
 * This is the simplest possible test - just create a sketch on the Top plane
 */
export async function testSketchFront() {
  if (!isAuthenticated()) {
    logError('Please authenticate first');
    return;
  }

  try {
    // First, get the Top plane ID
    const planesResponse = await apiCall(
      `planes/d/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}`,
      'GET'
    );

    logInfo('Planes response type:', typeof planesResponse);
    logInfo('Planes response:', JSON.stringify(planesResponse, null, 2));

    // For now, let's use the standard Top plane ID directly
    const topPlaneId = "JHD"; // Standard Onshape Top plane ID

    // Create a sketch on the Top plane
    const sketchFeature = {
      feature: {
        name: "Test Sketch",
        featureType: "newSketch",
        suppressed: false,
        parameters: [
          {
            btType: "BTMParameterQueryList-148",
            queries: [
              {
                btType: "BTMIndividualQuery-138",
                deterministicIds: [topPlaneId]
              }
            ],
            parameterId: "sketchPlane"
          }
        ],
        btType: "BTMSketch-151",
        constraints: [],
        entities: []
      }
    };

    const response = await apiCall(
      `partstudios/d/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}/features`,
      'POST',
      sketchFeature
    );

    logInfo('Sketch creation response:', JSON.stringify(response, null, 2));

  } catch (error) {
    logError(`Test failed: ${error.message}`);
  }
} 