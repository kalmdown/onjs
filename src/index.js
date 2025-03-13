// src\index.js
/**
 * OnJS - Onshape JavaScript API Client
 */

// Core client
const OnshapeClient = require('./client');

// Feature classes
const Sketch = require('./features/sketch');
const PartStudio = require('./features/partStudio');

// Utilities
const { UnitSystem, Point2D } = require('./utils/misc');

// Export the library
module.exports = {
  // Main client constructor
  Client: OnshapeClient,
  
  // Feature classes
  Sketch,
  PartStudio,
  
  // Utilities
  UnitSystem,
  Point2D,
  
  // Factory methods
  createClient: (options) => new OnshapeClient(options)
};