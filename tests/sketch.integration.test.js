require('dotenv').config();
const OnshapeAuth = require('../src/auth/onshape-auth');
const SimpleRestApi = require('../src/api/simple-rest-api');
const Sketch = require('../src/features/sketch');
const { UnitSystem } = require('../src/utils/misc');

// Set longer timeout for API operations
jest.setTimeout(45000);

// Check for required environment variables
const hasDocumentAccess = process.env.ONSHAPE_TEST_DOCUMENT_ID && 
                         process.env.ONSHAPE_TEST_WORKSPACE_ID && 
                         process.env.ONSHAPE_TEST_ELEMENT_ID;

// Skip tests if no document access
(hasDocumentAccess ? describe : describe.skip)('Sketch & Feature API Integration', () => {
  let auth;
  let documentId;
  let workspaceId;
  let elementId;
  
  beforeAll(() => {
    // Initialize auth
    auth = new OnshapeAuth({
      accessKey: process.env.ONSHAPE_ACCESS_KEY,
      secretKey: process.env.ONSHAPE_SECRET_KEY
    });
  });
  
  beforeAll(async () => {
    try {
      console.log('Setting up integration test with direct API access');
      
      // Create API client directly
      api = new SimpleRestApi({
        accessKey: process.env.ONSHAPE_ACCESS_KEY,
        secretKey: process.env.ONSHAPE_SECRET_KEY
      });
      
      // Create document directly
      const docResponse = await api.post('/documents', { 
        name: 'Sketch Integration Test' 
      });
      
      documentId = docResponse.id;
      workspaceId = docResponse.defaultWorkspaceId || docResponse.workspaces[0].id;
      
      console.log(`Created document: ${docResponse.name} (${documentId})`);
      
      // Get elements to find part studio
      const elementsResponse = await api.get(
        `/documents/d/${documentId}/w/${workspaceId}/elements`
      );
      
      // Find the part studio element
      const partStudioElement = elementsResponse.find(elem => 
        elem.type === 'PARTSTUDIO'
      );
      
      if (!partStudioElement) {
        throw new Error('Could not find part studio in document');
      }
      
      partStudioId = partStudioElement.id;
      console.log(`Using part studio: ${partStudioId}`);
      
      // Build a minimal document and part studio object for testing
      document = {
        id: documentId,
        name: docResponse.name,
        defaultWorkspace: { id: workspaceId },
        _api: {
          get: (path, options) => api.get(path, options?.queryParams),
          post: (path, data, options) => api.post(path, data, options?.queryParams),
          delete: (path, options) => api.delete(path, options?.queryParams),
          
          // Add endpoints object to match client structure
          endpoints: {
            getPlanes: (docId, params, elemId) => {
              return api.get(
                `/partstudios/d/${docId}/${params.wvm}/${params.wvmid}/e/${elemId}/features`
              ).then(response => {
                // Return simplified plane objects for the test
                return [
                  { name: 'XY', transientId: 'JHD' },
                  { name: 'YZ', transientId: 'JFD' },
                  { name: 'XZ', transientId: 'JGD' }
                ];
              });
            },
            addFeature: (docId, params, elemId, feature) => {
              return api.post(
                `/partstudios/d/${docId}/${params.wvm}/${params.wvmid}/e/${elemId}/features`,
                feature
              );
            },
            evalFeaturescript: (docId, params, elemId, script) => {
              return api.post(
                `/partstudios/d/${docId}/${params.wvm}/${params.wvmid}/e/${elemId}/featurescript`,
                { script }
              );
            }
          }
        }
      };
      
      // Create part studio object for tests
      const partStudio = {
        id: partStudioId,
        document: document,
        _api: document._api,
        _features: [],
        
        // Add necessary methods
        getPlanes: async () => {
          const planes = [
            { name: 'XY', transientId: 'JHD' },
            { name: 'YZ', transientId: 'JFD' },
            { name: 'XZ', transientId: 'JGD' }
          ];
          return planes;
        }
      };
      
      // Set part studio for tests
      global.partStudio = partStudio;
      
      // Get a plane for tests
      plane = { name: 'XY', transientId: 'JHD' };
      
      console.log('Setup complete, running tests...');
    } catch (error) {
      console.error("API Setup Failed:", error);
      throw error;
    }
  });
  
  afterAll(async () => {
    // Clean up the document after testing
    if (documentId) {
      try {
        await api.delete(`/documents/${documentId}`);
        console.log("Test document deleted successfully");
      } catch (err) {
        console.error("Failed to delete test document:", err);
      }
    }
  });
  
  test('should create an empty sketch', async () => {
    const sketch = await Sketch.create({
      partStudio: global.partStudio,
      plane,
      name: 'Basic Test Sketch'
    });
    
    expect(sketch).toBeTruthy();
    expect(sketch.featureId).toBeTruthy();
    expect(sketch.name).toBe('Basic Test Sketch');
  });
  
  test('should add a circle to sketch', async () => {
    const sketch = await Sketch.create({
      partStudio: global.partStudio,
      plane,
      name: 'Circle Test Sketch'
    });
    
    const circle = await sketch.addCircle([0, 0], 10);
    
    expect(circle).toBeTruthy();
    expect(circle.type).toBe('circle');
    expect(circle.radius).toBe(10);
  });
});