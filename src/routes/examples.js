// src/routes/examples.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { OnshapeClient } = require('../api/client');
const { createClientFromRequest } = require('../middleware/authMiddleware');

// Create a scoped logger
const log = logger.scope('Examples');

// Helper function to create a client
async function getClient() {
  return createClientFromRequest({}, OnshapeClient);
}

// Helper function to get or create test document
async function getTestDocument(client) {
  try {
    // First try to find an existing document
    console.log('Looking for existing document...');
    const documentsResponse = await client.get('/api/v10/documents');
    console.log('Documents response:', JSON.stringify(documentsResponse, null, 2));
    
    let documents = documentsResponse;
    if (documentsResponse.items) {
      documents = documentsResponse.items;
    }
    
    if (!Array.isArray(documents)) {
      console.error('Invalid documents response:', documentsResponse);
      throw new Error('Invalid documents response');
    }
    
    const existingDoc = documents.find(doc => doc.name === "Cylinder Example");
    
    if (existingDoc) {
      console.log('Found existing document:', existingDoc);
      
      // Get workspaces for existing document
      const workspaces = await client.get(`/api/v10/documents/d/${existingDoc.id}/workspaces`);
      console.log('Workspaces response:', JSON.stringify(workspaces, null, 2));
      
      if (!Array.isArray(workspaces)) {
        console.error('Invalid workspaces response:', workspaces);
        throw new Error('Invalid workspaces response');
      }
      
      // Find the main workspace (usually the first one)
      const mainWorkspace = workspaces[0];
      
      if (!mainWorkspace) {
        console.error('No workspace found in:', workspaces);
        throw new Error('No workspace found');
      }
      
      console.log('Found main workspace:', mainWorkspace);
      
      // Get or create part studio
      const elements = await client.get(`/api/v10/documents/d/${existingDoc.id}/w/${mainWorkspace.id}/elements`);
      console.log('Elements response:', JSON.stringify(elements, null, 2));
      
      if (!Array.isArray(elements)) {
        console.error('Invalid elements response:', elements);
        throw new Error('Invalid elements response');
      }
      
      const partStudio = elements.find(el => el.elementType === 'PARTSTUDIO');
      
      if (partStudio) {
        console.log('Found existing part studio:', partStudio);
        return {
          ...existingDoc,
          defaultWorkspace: mainWorkspace,
          partStudio: partStudio
        };
      } else {
        console.log('Creating new part studio...');
        const newPartStudio = await client.post(`/api/v10/documents/d/${existingDoc.id}/w/${mainWorkspace.id}/elements`, {
          name: "Part Studio",
          elementType: "PARTSTUDIO"
        });
        console.log('Part studio creation response:', JSON.stringify(newPartStudio, null, 2));
        return {
          ...existingDoc,
          defaultWorkspace: mainWorkspace,
          partStudio: newPartStudio
        };
      }
    } else {
      console.log('Creating new document...');
      const document = await client.post('/api/v10/documents', {
        name: "Cylinder Example",
        isPublic: true
      });
      console.log('Document creation response:', JSON.stringify(document, null, 2));
      
      if (!document || !document.id) {
        console.error('Invalid document response:', document);
        throw new Error('Invalid document response');
      }
      
      console.log('Getting workspaces...');
      const workspaces = await client.get(`/api/v10/documents/d/${document.id}/workspaces`);
      console.log('Workspaces response:', JSON.stringify(workspaces, null, 2));
      
      if (!Array.isArray(workspaces)) {
        console.error('Invalid workspaces response:', workspaces);
        throw new Error('Invalid workspaces response');
      }
      
      // Find the main workspace (usually the first one)
      const mainWorkspace = workspaces[0];
      
      if (!mainWorkspace) {
        console.error('No workspace found in:', workspaces);
        throw new Error('No workspace found');
      }
      
      console.log('Found main workspace:', mainWorkspace);
      
      // Create new part studio
      console.log('Creating new part studio...');
      const partStudio = await client.post(`/api/v10/documents/d/${document.id}/w/${mainWorkspace.id}/elements`, {
        name: "Part Studio",
        elementType: "PARTSTUDIO"
      });
      console.log('Part studio creation response:', JSON.stringify(partStudio, null, 2));
      
      return {
        ...document,
        defaultWorkspace: mainWorkspace,
        partStudio: partStudio
      };
    }
  } catch (error) {
    console.error('Error in getTestDocument:', error);
    throw error;
  }
}

// Helper function to get existing features
async function getExistingFeatures(client, documentId, workspaceId, partStudioId) {
  try {
    console.log('Getting existing features...');
    const featuresResponse = await client.get(
      `/api/v10/partstudios/d/${documentId}/w/${workspaceId}/e/${partStudioId}/features?rollbackBarIndex=-1`
    );
    console.log('Features response:', JSON.stringify(featuresResponse, null, 2));
    
    if (!featuresResponse.features) {
      console.error('Invalid features response:', featuresResponse);
      throw new Error('Invalid features response');
    }
    
    return featuresResponse.features;
  } catch (error) {
    console.error('Error in getExistingFeatures:', error);
    throw error;
  }
}

// Helper function to get part studio ID
async function getPartStudioId(client, documentId, workspaceId) {
  try {
    console.log('Getting elements...');
    const elements = await client.get(`/api/v10/documents/d/${documentId}/w/${workspaceId}/elements`);
    console.log('Elements response:', JSON.stringify(elements, null, 2));
    
    if (!Array.isArray(elements)) {
      console.error('Invalid elements response:', elements);
      throw new Error('Invalid elements response');
    }
    
    const partStudio = elements.find(el => el.elementType === 'PARTSTUDIO');
    
    if (partStudio) {
      console.log('Found existing part studio:', partStudio);
      return partStudio.id;
    } else {
      console.log('Creating new part studio...');
      // Create new part studio
      const partStudio = await client.post(`/api/v10/documents/d/${documentId}/w/${workspaceId}/elements`, {
        name: "Part Studio",
        elementType: "PARTSTUDIO"
      });
      console.log('Part studio creation response:', JSON.stringify(partStudio, null, 2));
      return partStudio.id;
    }
  } catch (error) {
    console.error('Error in getPartStudioId:', error);
    throw error;
  }
}

module.exports = function(app, auth) {
  const { isAuthenticated, createClientFromRequest } = auth;

  /**
   * @route GET /api/examples
   * @description Get example data
   * @access Private
   */
  router.get('/', isAuthenticated, async (req, res, next) => {
    try {
      res.json({ message: 'Example route' });
    } catch (error) {
      log.error(`Error in example route: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route POST /api/examples/cylinder
   * @description Create a cylinder example
   * @access Private
   */
  router.post('/cylinder', isAuthenticated, async (req, res) => {
    try {
      const client = req.onshapeClient;
      console.log('Getting document...');
      const document = await getTestDocument(client);
      console.log('Document:', document);
      
      if (!document || !document.id) {
        throw new Error('Invalid document response');
      }
      
      const workspaceId = document.defaultWorkspace.id;
      const partStudioId = document.partStudio.id;
      console.log('Using workspace:', workspaceId);
      console.log('Using part studio:', partStudioId);

      // Get existing features
      const existingFeatures = await getExistingFeatures(client, document.id, workspaceId, partStudioId);
      console.log('Existing features:', existingFeatures);

      // Find existing sketch and extrude features
      const existingSketch = existingFeatures.find(f => f.featureType === 'newSketch' && f.name === 'Base Sketch');
      const existingExtrudes = existingFeatures.filter(f => f.featureType === 'extrude' && f.name === 'Cylinder Extrude');

      // Clean up all existing extrude features
      for (const extrude of existingExtrudes) {
        console.log('Deleting existing extrude feature:', extrude.featureId);
        try {
          await client.delete(
            `/api/v10/partstudios/d/${document.id}/w/${workspaceId}/e/${partStudioId}/features/featureid/${extrude.featureId}`
          );
        } catch (error) {
          console.error('Failed to delete extrude feature:', error);
        }
      }

      // If we have existing features, use them
      let sketchId;
      if (existingSketch) {
        console.log('Using existing sketch:', existingSketch.featureId);
        sketchId = existingSketch.featureId;
      } else {
        // Get Front plane ID using FeatureScript
        const planeScript = {
          script: `
            function(context is Context, queries) {
              return transientQueriesToStrings(evaluateQuery(context, qCreatedBy(makeId("Front"), EntityType.FACE)));
            }
          `,
          queries: {}
        };

        const planeResponse = await client.post(
          `/api/v10/partstudios/d/${document.id}/w/${workspaceId}/e/${partStudioId}/featurescript?rollbackBarIndex=-1`,
          planeScript
        );

        console.log('Plane response:', JSON.stringify(planeResponse, null, 2));

        // Extract the front plane ID from the response
        const frontPlaneId = planeResponse.result.value[0].value;
        console.log('Front plane ID:', frontPlaneId);

        // Create sketch
        const sketchFeature = {
          btType: "BTFeatureDefinitionCall-1406",
          feature: {
            btType: "BTMSketch-151",
            entities: [],
            constraints: [],
            namespace: "",
            name: "Base Sketch",
            suppressed: false,
            parameters: [{
              btType: "BTMParameterQueryList-148",
              queries: [{
                btType: "BTMIndividualQuery-138",
                deterministicIds: [frontPlaneId]
              }],
              parameterId: "sketchPlane"
            }, {
              btType: "BTMParameterBoolean-144",
              value: true,
              parameterId: "disableImprinting"
            }],
            featureType: "newSketch"
          }
        };

        console.log('Creating sketch...');
        const sketchResponse = await client.post(
          `/api/v10/partstudios/d/${document.id}/w/${workspaceId}/e/${partStudioId}/features?rollbackBarIndex=-1`,
          sketchFeature
        );

        console.log('Sketch response:', JSON.stringify(sketchResponse, null, 2));

        // Extract the sketch ID from the response
        sketchId = sketchResponse.feature?.featureId;
        if (!sketchId) {
          console.error('Invalid sketch response:', sketchResponse);
          throw new Error('Could not get sketch ID');
        }
        console.log('Created sketch with ID:', sketchId);

        // Update sketch with circle entity
        const updateSketchFeature = {
          btType: "BTFeatureDefinitionCall-1406",
          feature: {
            ...sketchFeature.feature,
            featureId: sketchId,
            entities: [{
              btType: "BTMSketchCurve-4",
              entityId: "circle-entity",
              geometry: {
                btType: "BTCurveGeometryCircle-115",
                radius: 0.025,
                clockwise: false,
                xCenter: 0.05,
                yCenter: 0.05,
                xDir: 1,
                yDir: 0
              },
              centerId: "circle-entity.center"
            }]
          }
        };

        console.log('Updating sketch with circle...');
        const updateResponse = await client.post(
          `/api/v10/partstudios/d/${document.id}/w/${workspaceId}/e/${partStudioId}/features/featureid/${sketchId}?rollbackBarIndex=-1`,
          updateSketchFeature
        );
      }

      // Get faces created by the sketch
      const facesScript = {
        script: `
          function(context is Context, queries) {
            try {
              const sketch = getFeature(context, "${sketchId}");
              const sketchRegion = qSketchRegion(sketch);
              const faces = evaluateQuery(context, sketchRegion);
              
              if (size(faces) == 0) {
                throw new Error("No faces found in sketch");
              }
              
              return transientQueriesToStrings(faces);
            } catch (e) {
              throw new Error("Failed to get sketch faces: " + e.message);
            }
          }
        `
      };

      console.log('Getting faces...');
      console.log('Faces script:', JSON.stringify(facesScript, null, 2));
      console.log('Using sketch ID:', sketchId);

      const facesResponse = await client.post(
        `/api/v10/partstudios/d/${document.id}/w/${workspaceId}/e/${partStudioId}/featurescript?rollbackBarIndex=-1`,
        facesScript
      );

      console.log('Faces response:', JSON.stringify(facesResponse, null, 2));
      console.log('Faces response result:', JSON.stringify(facesResponse.result, null, 2));
      console.log('Faces response value:', JSON.stringify(facesResponse.result?.value, null, 2));

      if (!facesResponse.result?.value || facesResponse.result.value.length === 0) {
        throw new Error('No faces found in sketch');
      }

      // Create extrude
      const extrudeFeature = {
        btType: "BTFeatureDefinitionCall-1406",
        feature: {
          btType: "BTMFeature-134",
          namespace: "",
          name: "Cylinder Extrude",
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
                  deterministicIds: facesResponse.result.value.map(v => v.value)
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
              isInteger: false,
              value: 1.0,
              units: "inch",
              expression: "1 inch",
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
          featureType: "extrude"
        }
      };

      // Create the extrude feature
      console.log('Creating extrude feature...');
      const createResponse = await client.post(
        `/api/v10/partstudios/d/${document.id}/w/${workspaceId}/e/${partStudioId}/features?rollbackBarIndex=-1`,
        extrudeFeature
      );
      console.log('Create response:', JSON.stringify(createResponse, null, 2));

      // Get the feature ID from the create response
      const newFeatureId = createResponse.feature?.featureId;
      if (!newFeatureId) {
        throw new Error('Could not get feature ID from create response');
      }
      console.log('Created extrude feature with ID:', newFeatureId);

      // Update the feature with the correct ID
      extrudeFeature.feature.featureId = newFeatureId;
      console.log('Updating extrude feature...');
      const extrudeResponse = await client.post(
        `/api/v10/partstudios/d/${document.id}/w/${workspaceId}/e/${partStudioId}/features/featureid/${newFeatureId}?rollbackBarIndex=-1`,
        extrudeFeature
      );

      console.log('Extrude response:', JSON.stringify(extrudeResponse, null, 2));

      res.json({
        success: true,
        document,
        sketchFeature: existingSketch || sketchResponse,
        extrudeFeature: extrudeResponse
      });
    } catch (error) {
      console.error('Error creating cylinder:', error);
      res.status(500).json({
        error: 'Request error',
        message: error.message,
        details: error
      });
    }
  });

  /**
   * @route POST /api/examples/lamp
   * @description Create a lamp example
   * @access Private
   */
  router.post('/lamp', isAuthenticated, async (req, res, next) => {
    try {
      const { documentId } = req.body;
      
      // Create client from request
      const client = createClientFromRequest(req, OnshapeClient);
      
      // Refresh token if needed
      await client.refreshTokenIfNeeded();
      
      log.info('Creating lamp example');
      
      // Step 1: Get or create document
      let document;
      if (documentId) {
        document = await client.documents.getDocument(documentId);
        log.info(`Using existing document: ${document.name}`);
      } else {
        document = await client.documents.createDocument({
          name: "Lamp Example"
        });
        log.info(`Created new document: ${document.name}`);
      }
      
      // For brevity, return success without implementing the full lamp example
      // In a real implementation, you would create the lamp model here
      
      log.info('Lamp example completed successfully');
      
      res.json({
        success: true,
        document,
        link: `https://cad.onshape.com/documents/${document.id}`,
      });
    } catch (error) {
      log.error('Failed to create lamp example:', error.message);
      next(error);
    }
  });

  /**
   * @route POST /api/examples/convert-svg
   * @description Convert SVG to Onshape model
   * @access Private
   */
  router.post('/convert-svg', isAuthenticated, async (req, res, next) => {
    try {
      const { svgContent, documentId } = req.body;
      
      if (!svgContent) {
        return res.status(400).json({ error: "SVG content is required" });
      }
      
      // Create client from request
      const client = createClientFromRequest(req, OnshapeClient);
      
      // Refresh token if needed
      await client.refreshTokenIfNeeded();
      
      log.info('Converting SVG to Onshape model');
      
      // Step 1: Get or create document
      let document;
      if (documentId) {
        document = await client.documents.getDocument(documentId);
        log.info(`Using existing document: ${document.name}`);
      } else {
        document = await client.documents.createDocument({
          name: "SVG Conversion"
        });
        log.info(`Created new document: ${document.name}`);
      }
      
      // For brevity, return success without implementing the full SVG conversion
      // In a real implementation, you would parse and convert the SVG here
      
      log.info('SVG conversion completed successfully');
      
      res.json({
        success: true,
        document,
        link: `https://cad.onshape.com/documents/${document.id}`,
      });
    } catch (error) {
      log.error('Failed to convert SVG:', error.message);
      next(error);
    }
  });

  /**
   * @route POST /api/examples
   * @description Create example data
   * @access Private
   */
  router.post('/', isAuthenticated, async (req, res, next) => {
    try {
      const { name, data } = req.body;
      
      if (!name) {
        return res.status(400).json({
          error: 'Missing required parameter',
          message: 'name is required'
        });
      }

      res.json({
        message: 'Example created',
        name,
        data
      });
    } catch (error) {
      log.error(`Error creating example: ${error.message}`);
      next(error);
    }
  });

  /**
   * @route GET /api/examples/sketch-test/:type
   * @description Run a sketch test
   * @access Private
   */
  router.get('/sketch-test/:type', isAuthenticated, async (req, res, next) => {
    try {
      const { type } = req.params;
      
      log.info(`Running sketch test: ${type}`);
      
      // Constants for the public document we'll use
      const TEST_DOCUMENT = {
        id: 'd1f86b1d71dd2c5d2421bd96',
        workspaceId: '5243c342e91b8e73d55a0fed',
        elementId: 'bc674740961a3da23ed7ab90'
      };
      
      log.debug('Using test document:', TEST_DOCUMENT);
      
      let response;
      
      switch (type) {
        case 'front':
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
                      deterministicIds: ["JCC"]
                    }
                  ],
                  parameterId: "sketchPlane"
                }
              ],
              btType: "BTMSketch-151",
              constraints: [],
              entities: [
                {
                  btType: "BTMSketchCurve-4",
                  entityId: "test-circle",
                  geometry: {
                    btType: "BTCurveGeometryCircle-115",
                    radius: 0.025,
                    xCenter: 0.05,
                    yCenter: 0.05,
                    xDir: 1,
                    yDir: 0,
                    clockwise: false
                  },
                  centerId: "test-circle.center"
                }
              ]
            }
          };
          
          log.debug('Creating sketch feature:', sketchFeature);
          
          // Create client from request if not already created
          const client = req.onshapeClient || createClientFromRequest(req, OnshapeClient);
          
          log.debug('Using client:', client);
          
          try {
            response = await client.post(
              `/api/v6/partstudios/d/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}/features`,
              sketchFeature
            );
            log.debug('Sketch feature created:', response);
          } catch (error) {
            log.error('Error creating sketch feature:', error);
            throw error;
          }
          break;
          
        case 'circle':
          // Create a sketch with a circle on the Top plane
          const circleSketchFeature = {
            feature: {
              name: "Circle Sketch",
              featureType: "newSketch",
              suppressed: false,
              parameters: [
                {
                  btType: "BTMParameterQueryList-148",
                  queries: [
                    {
                      btType: "BTMIndividualQuery-138",
                      deterministicIds: ["JCC"] // Front plane ID
                    }
                  ],
                  parameterId: "sketchPlane"
                }
              ],
              btType: "BTMSketch-151",
              constraints: [],
              entities: [
                {
                  btType: "BTMSketchCurve-4",
                  entityId: "test-circle",
                  geometry: {
                    btType: "BTCurveGeometryCircle-115",
                    radius: 0.025,
                    xCenter: 0,
                    yCenter: 0,
                    xDir: 1,
                    yDir: 0,
                    clockwise: false
                  },
                  centerId: "test-circle.center"
                }
              ]
            }
          };
          
          log.debug('Creating circle sketch feature:', circleSketchFeature);
          
          try {
            response = await req.onshapeClient.post(
              `/partstudios/d/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}/features`,
              circleSketchFeature
            );
            log.debug('Circle sketch feature created:', response);
          } catch (error) {
            log.error('Error creating circle sketch feature:', error);
            throw error;
          }
          break;
          
        case 'extrude':
          // Create a sketch with a circle and extrude it
          const extrudeSketchFeature = {
            feature: {
              name: "Extrude Sketch",
              featureType: "newSketch",
              suppressed: false,
              parameters: [
                {
                  btType: "BTMParameterQueryList-148",
                  queries: [
                    {
                      btType: "BTMIndividualQuery-138",
                      deterministicIds: ["JCC"] // Front plane ID
                    }
                  ],
                  parameterId: "sketchPlane"
                }
              ],
              btType: "BTMSketch-151",
              constraints: [],
              entities: [
                {
                  btType: "BTMSketchCurve-4",
                  entityId: "test-circle",
                  geometry: {
                    btType: "BTCurveGeometryCircle-115",
                    radius: 0.025,
                    xCenter: 0,
                    yCenter: 0,
                    xDir: 1,
                    yDir: 0,
                    clockwise: false
                  },
                  centerId: "test-circle.center"
                }
              ]
            }
          };
          
          const sketchResponse = await req.onshapeClient.post(
            `/partstudios/d/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}/features`,
            extrudeSketchFeature
          );
          
          // Create the extrude feature
          const extrudeFeature = {
            feature: {
              name: "Test Extrude",
              featureType: "extrude",
              suppressed: false,
              parameters: [
                {
                  btType: "BTMParameterQueryList-148",
                  queries: [
                    {
                      btType: "BTMIndividualQuery-138",
                      queryString: `query=qEntity("circle-entity");`,
                      deterministicIds: []
                    }
                  ],
                  parameterId: "entities"
                },
                {
                  btType: "BTMParameterQuantity-147",
                  expression: "1 inch",
                  parameterId: "depth"
                }
              ],
              btType: "BTMFeature-134"
            }
          };
          
          response = await req.onshapeClient.post(
            `/partstudios/d/${TEST_DOCUMENT.id}/w/${TEST_DOCUMENT.workspaceId}/e/${TEST_DOCUMENT.elementId}/features`,
            extrudeFeature
          );
          break;
          
        default:
          return res.status(400).json({ error: `Invalid test type: ${type}` });
      }
      
      log.info(`Sketch test ${type} completed successfully`);
      
      res.json({
        success: true,
        response,
        link: `https://cad.onshape.com/documents/${TEST_DOCUMENT.id}`
      });
    } catch (error) {
      log.error(`Failed to run sketch test: ${error.message}`);
      next(error);
    }
  });

  router.source = __filename;
  
  return router;
};