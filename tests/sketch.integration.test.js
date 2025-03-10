const Sketch = require('../src/features/sketch');
const { UnitSystem } = require('../src/utils/misc');

// Integration tests that interact with the actual Onshape API
// These tests are skipped by default - run with: npm test -- -t "Sketch Integration"
describe.skip('Sketch Integration', () => {
  let client;
  let document;
  let partStudio;
  let plane;
  
  beforeAll(async () => {
    // Setup using environment variables
    const OnJS = require('../src/index');
    client = new OnJS.Client({ 
      accessKey: process.env.ONSHAPE_ACCESS_KEY,
      secretKey: process.env.ONSHAPE_SECRET_KEY,
      // If you have other environment configuration:
      // baseUrl: process.env.ONSHAPE_API_URL
    });
    
    // Create a test document
    document = await client.createDocument('Sketch Test Document');
    partStudio = await document.getDefaultPartStudio();
    plane = await partStudio.getPlanes().then(planes => planes.find(p => p.name === 'XY'));
  });
  
  afterAll(async () => {
    // Optional cleanup
    // if (document) await document.delete();
  });
  
  test('should create sketch and add circle', async () => {
    // Skip this test if setup wasn't completed
    if (!partStudio || !plane) return;
    
    const sketch = await Sketch.create({
      partStudio,
      plane,
      name: 'Integration Test Sketch'
    });
    
    expect(sketch.featureId).toBeTruthy();
    
    const circle = await sketch.addCircle([0, 0], 10);
    expect(circle.entityId).toBeTruthy();
    
    const entities = await sketch.getEntities();
    expect(entities.faceIds.length).toBeGreaterThan(0);
  });
  
  test('should create complex geometry', async () => {
    // Skip this test if setup wasn't completed
    if (!partStudio || !plane) return;
    
    const sketch = await Sketch.create({
      partStudio,
      plane,
      name: 'Complex Geometry Test'
    });
    
    // Add rectangle
    await sketch.addCornerRectangle([0, 0], [20, 10]);
    
    // Add circle
    await sketch.addCircle([10, 5], 3);
    
    // Verify entities were created
    const entities = await sketch.getEntities();
    expect(entities.faceIds.length).toBeGreaterThan(1);
  });
});