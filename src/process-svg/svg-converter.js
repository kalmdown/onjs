// src/process-svg/svg-converter.js
const logger = require('../utils/logger');
const log = logger.scope('SVGConverter');
const SVGParser = require('./svg-parser');
const PathProcessor = require('./path-processor');
const FeatureBuilder = require('./feature-builder');
const apiUtils = require('../api/api-utils');

/**
 * Convert SVG content to Onshape features
 * @param {String|Buffer} svgInput - SVG content as string or buffer
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} - Conversion result with processed features
 */
async function convertSvg(svgInput, options = {}) {
  try {
    log.debug('Starting SVG conversion process');
    
    // Ensure svgInput is a string
    const svgContent = typeof svgInput === 'string' 
      ? svgInput 
      : svgInput instanceof Buffer 
        ? svgInput.toString('utf8')
        : String(svgInput);
    
    // Process the SVG on the server side
    const svgParser = new SVGParser(options);
    const parsedData = svgParser.parse(svgContent);
    
    const pathProcessor = new PathProcessor(options);
    const processedPaths = pathProcessor.process(parsedData);
    
    const featureBuilder = new FeatureBuilder(options);
    const features = featureBuilder.build(processedPaths);
    
    return features;
  } catch (error) {
    log.error(`Error converting SVG: ${error.message}`, error);
    throw new Error(`Error converting SVG: ${error.message}`);
  }
}

/**
 * Create features in Onshape using a previously processed conversion ID
 * @param {string} conversionId - ID of processed SVG data stored on server
 * @param {Object} options - Creation options
 * @returns {Promise<Object>} - Onshape API response
 */
async function createFeaturesFromConversionId(conversionId, options = {}) {
  try {
    log.debug(`Creating features from conversion ID: ${conversionId}`);
    
    const documentId = options.documentId;
    const workspaceId = options.workspaceId;
    const elementId = options.elementId;
    
    if (!documentId || !workspaceId || !elementId) {
      throw new Error('Missing required document parameters');
    }
    
    // API endpoint for creating features by reference ID
    const endpoint = '/api/svg/createFeatures';
    
    // Build request parameters with only the reference ID
    const params = {
      documentId,
      workspaceId,
      elementId,
      conversionId
    };
    
    // Make the API call
    const result = await apiUtils.apiCall('POST', endpoint, params);
    return result;
  } catch (error) {
    log.error(`Error creating features: ${error.message}`, error);
    throw error;
  }
}

/**
 * Create features in Onshape directly (only used by server-side route handlers)
 * @param {Object} features - Feature data to create in Onshape
 * @param {Object} options - Creation options
 * @returns {Promise<Object>} - Onshape API response
 */
async function createFeaturesInOnshape(features, options = {}) {
  try {
    log.debug('Creating features in Onshape directly');
    
    const documentId = options.documentId;
    const workspaceId = options.workspaceId;
    const elementId = options.elementId;
    
    if (!documentId || !workspaceId || !elementId) {
      throw new Error('Missing required document parameters');
    }
    
    // Make the direct API call to Onshape (this is the server-to-Onshape call)
    // You would replace this with your actual Onshape API integration code
    const result = await onshapeApiCall(documentId, workspaceId, elementId, features);
    return result;
  } catch (error) {
    log.error(`Error creating features in Onshape: ${error.message}`, error);
    throw error;
  }
}

/**
 * Call the Onshape API to create features (implementation depends on your Onshape integration)
 * @private
 */
async function onshapeApiCall(documentId, workspaceId, elementId, features) {
  // Actual implementation of your Onshape API call goes here
  // This is where the actual features get created in Onshape
  
  // For example:
  // return await onshapeApi.createFeatures(documentId, workspaceId, elementId, features);
  
  return {
    success: true,
    featureIds: ['feature1', 'feature2'] // Placeholder
  };
}

module.exports = {
  convertSvg,
  createFeaturesInOnshape,
  createFeaturesFromConversionId
};
