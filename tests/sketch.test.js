const Sketch = require('../src/features/sketch');
const { UnitSystem, Point2D, inchesToMeters } = require('../src/utils/misc');
const { OnshapeFeatureError, OnshapeParameterError } = require('../src/utils/errors');
const logger = require('../src/utils/logger');

// Mock dependencies
jest.mock('../src/api/schema', () => ({
  generateId: jest.fn().mockReturnValue('test-entity-id'),
  createSketch: jest.fn(options => ({ ...options, parameters: [] })),
  createCircle: jest.fn(options => options),
  createLine: jest.fn(options => options)
}));

describe('Sketch', () => {
  let mockPartStudio;
  let mockPlane;
  let wasLoggerSilent;
  
  beforeEach(() => {
    // Silence logger during tests
    wasLoggerSilent = logger.silent;
    logger.silent = true;
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock part studio
    mockPartStudio = {
      document: {
        id: 'doc123',
        defaultWorkspace: { id: 'workspace123' }
      },
      id: 'ps123',
      _api: {
        endpoints: {
          addFeature: jest.fn().mockResolvedValue({
            feature: {
              featureId: 'test-feature-id',
              featureType: 'SKETCH',
              featureStatus: 'OK'
            }
          }),
          updateFeature: jest.fn().mockResolvedValue({
            feature: {
              featureId: 'test-feature-id',
              featureStatus: 'OK'
            }
          }),
          evalFeaturescript: jest.fn().mockResolvedValue({
            result: {
              value: [
                { value: 'face-id-1' },
                { value: 'face-id-2' }
              ]
            }
          })
        }
      },
      _client: { unitSystem: UnitSystem.METER },
      _features: []
    };
    
    // Mock plane
    mockPlane = {
      getTransientIds: jest.fn().mockResolvedValue(['plane-id-123'])
    };
  });
  
  afterEach(() => {
    // Restore logger state
    logger.silent = wasLoggerSilent;
  });
  
  // Basic test - sketch creation
  test('should create a sketch instance with proper properties', async () => {
    const sketch = new Sketch({
      partStudio: mockPartStudio,
      plane: mockPlane,
      name: 'Test Sketch'
    });
    
    expect(sketch.partStudio).toBe(mockPartStudio);
    expect(sketch.plane).toBe(mockPlane);
    expect(sketch.name).toBe('Test Sketch');
    expect(sketch.featureId).toBeNull();
    expect(sketch.items.size).toBe(0);
  });
  
  // Full initialization test
  test('should initialize sketch with feature ID during create()', async () => {
    const sketch = await Sketch.create({
      partStudio: mockPartStudio,
      plane: mockPlane,
      name: 'Test Create Sketch'
    });
    
    expect(mockPartStudio._api.endpoints.addFeature).toHaveBeenCalledTimes(1);
    expect(sketch.featureId).toBe('test-feature-id');
    expect(mockPartStudio._features).toContain(sketch);
  });

  // Add more tests here...
});