/**
 * Helper functions to create mock objects for testing
 */
const { UnitSystem } = require('../../src/utils/misc');

/**
 * Create a mock part studio
 * @param {Object} options - Customization options
 * @returns {Object} Mock part studio object
 */
function createMockPartStudio(options = {}) {
  const defaultApiEndpoints = {
    addFeature: jest.fn().mockResolvedValue({
      feature: {
        featureId: 'mock-feature-id',
        featureType: 'SKETCH',
        featureStatus: 'OK'
      }
    }),
    updateFeature: jest.fn().mockResolvedValue({
      feature: {
        featureId: 'mock-feature-id', 
        featureStatus: 'OK'
      }
    }),
    evalFeaturescript: jest.fn().mockResolvedValue({
      result: {
        value: [{ value: 'mock-face-id' }]
      }
    })
  };

  return {
    document: {
      id: options.documentId || 'mock-document-id',
      defaultWorkspace: {
        id: options.workspaceId || 'mock-workspace-id'
      }
    },
    id: options.partStudioId || 'mock-partstudio-id',
    _api: {
      endpoints: options.apiEndpoints || defaultApiEndpoints
    },
    _client: {
      unitSystem: options.unitSystem || UnitSystem.METER
    },
    _features: []
  };
}

/**
 * Create a mock plane
 * @param {Object} options - Customization options
 * @returns {Object} Mock plane object
 */
function createMockPlane(options = {}) {
  if (options.useTransientId) {
    return {
      transientId: options.transientId || 'mock-plane-id'
    };
  }
  
  return {
    getTransientIds: jest.fn().mockResolvedValue(
      options.planeIds || ['mock-plane-id']
    )
  };
}

module.exports = {
  createMockPartStudio,
  createMockPlane
};