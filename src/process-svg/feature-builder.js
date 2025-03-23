// src/process-svg/feature-builder.js
const logger = require('../utils/logger');
const log = logger.scope('Features');

/**
 * FeatureBuilder module that converts processed SVG data into Onshape features
 */
class FeatureBuilder {
  /**
   * Create a new FeatureBuilder instance
   * @param {Object} options - Builder configuration options
   */
  constructor(options = {}) {
    this.options = {
      // Whether to create a separate sketch for each closed path
      separateSketches: options.separateSketches !== false,
      // Whether to create separate sketches for different groups
      groupsAsSketch: options.groupsAsSketch !== false,
      // Default extrusion depth when creating 3D models
      defaultExtrusion: options.defaultExtrusion || 10, // mm
      // Units for the model ('mm', 'inch')
      units: options.units || 'mm',
      // Whether to create 3D models by default
      create3D: options.create3D !== false,
      // Whether to preserve construction geometry
      preserveConstruction: options.preserveConstruction !== false,
      // Whether to try to apply constraints to the sketch
      applyConstraints: options.applyConstraints !== false,
      // Whether to separate open and closed paths into different sketches
      separateOpenClosed: options.separateOpenClosed !== false,
      // Whether to extrude open paths by giving them width
      extrudeOpenPaths: options.extrudeOpenPaths !== false,
      // Width to use when extruding open paths
      openPathWidth: options.openPathWidth || 1, // mm
      // Maximum decimal precision for coordinates
      decimalPrecision: options.decimalPrecision || 4
    };
  }

  /**
   * Build Onshape features from processed SVG data
   * @param {Object} processedData - Data from PathProcessor
   * @returns {Object} - Onshape features
   */
  build(processedData) {
    log.debug('Building Onshape features from processed SVG data');
    
    // Get paths from processed data
    const paths = processedData.paths || [];
    
    if (paths.length === 0) {
      log.warn('No paths found in processed data');
      return { features: [] };
    }
    
    // Split paths based on configuration
    const organizedPaths = this._organizePaths(paths);
    
    // Create sketches
    const sketches = this._createSketches(organizedPaths);
    
    // Create 3D features if needed
    const features3D = this.options.create3D ? 
      this._create3DFeatures(sketches, organizedPaths) : [];
    
    log.debug(`Created ${sketches.length} sketches and ${features3D.length} 3D features`);
    
    return {
      sketches,
      features3D,
      features: [...sketches, ...features3D]
    };
  }

  /**
   * Organize paths for feature creation
   * @param {Array} paths - Processed paths
   * @returns {Object} - Organized paths
   * @private
   */
  _organizePaths(paths) {
    // Base organization
    const organized = {
      closed: [],
      open: [],
      construction: []
    };
    
    // Filter paths into categories
    paths.forEach(path => {
      if (path.isConstruction && this.options.preserveConstruction) {
        organized.construction.push(path);
      } else if (path.closed) {
        organized.closed.push(path);
      } else {
        organized.open.push(path);
      }
    });
    
    // Group by special processing if needed
    if (this.options.groupsAsSketch) {
      // Group paths with similar special processing
      organized.bySpecialProcessing = this._groupBySpecialProcessing(paths);
    }
    
    log.debug(`Organized paths: ${organized.closed.length} closed, ${organized.open.length} open, ${organized.construction.length} construction`);
    return organized;
  }

  /**
   * Group paths by special processing tags
   * @param {Array} paths - Processed paths
   * @returns {Object} - Grouped paths
   * @private
   */
  _groupBySpecialProcessing(paths) {
    const groups = {
      default: []
    };
    
    paths.forEach(path => {
      if (path.specialProcessing && Object.keys(path.specialProcessing).length > 0) {
        // Get first special processing key
        const key = Object.keys(path.specialProcessing)[0];
        
        // Create group if it doesn't exist
        if (!groups[key]) {
          groups[key] = [];
        }
        
        groups[key].push(path);
      } else {
        groups.default.push(path);
      }
    });
    
    return groups;
  }

  /**
   * Create Onshape sketches from organized paths
   * @param {Object} organizedPaths - Organized paths
   * @returns {Array} - Sketch features
   * @private
   */
  _createSketches(organizedPaths) {
    const sketches = [];
    
    if (this.options.separateOpenClosed) {
      // Create separate sketches for open and closed paths
      
      // Create sketch for closed paths
      if (organizedPaths.closed.length > 0) {
        sketches.push(this._createSketch('ClosedPaths', organizedPaths.closed));
      }
      
      // Create sketch for open paths
      if (organizedPaths.open.length > 0) {
        sketches.push(this._createSketch('OpenPaths', organizedPaths.open));
      }
    } else if (this.options.separateSketches) {
      // Create separate sketch for each path
      [...organizedPaths.closed, ...organizedPaths.open].forEach((path, index) => {
        const sketchName = path.name || `Sketch${index + 1}`;
        sketches.push(this._createSketch(sketchName, [path]));
      });
    } else {
      // Create a single sketch with all paths
      const allPaths = [...organizedPaths.closed, ...organizedPaths.open];
      
      if (allPaths.length > 0) {
        sketches.push(this._createSketch('AllPaths', allPaths));
      }
    }
    
    // Add construction geometry to each sketch
    if (organizedPaths.construction.length > 0 && sketches.length > 0) {
      // Add construction geometry to the first sketch
      sketches[0].entities.push(...this._createConstructionEntities(organizedPaths.construction));
    }
    
    return sketches;
  }

  /**
   * Create a single sketch feature
   * @param {string} name - Sketch name
   * @param {Array} paths - Paths to include in the sketch
   * @returns {Object} - Sketch feature
   * @private
   */
  _createSketch(name, paths) {
    log.debug(`Creating sketch "${name}" with ${paths.length} paths`);
    
    const sketch = {
      feature: 'sketch',
      name,
      entities: []
    };
    
    // Add path entities to the sketch
    paths.forEach(path => {
      sketch.entities.push(...this._createEntitiesForPath(path));
    });
    
    // Add constraints if enabled
    if (this.options.applyConstraints) {
      sketch.constraints = this._createConstraints(paths);
    }
    
    return sketch;
  }

  /**
   * Create entities for a path
   * @param {Object} path - Path to create entities for
   * @returns {Array} - Sketch entities
   * @private
   */
  _createEntitiesForPath(path) {
    const entities = [];
    const segments = path.segments || [];
    
    if (segments.length === 0) {
      return entities;
    }
    
    // Track points to avoid duplication
    const points = new Map();
    
    // Create entities for each segment
    segments.forEach((segment, index) => {
      switch (segment.type) {
        case 'line':
          entities.push(this._createLineEntity(segment, path.isConstruction));
          break;
          
        case 'cubic':
          entities.push(this._createCubicEntity(segment, path.isConstruction));
          break;
          
        case 'quadratic':
          entities.push(this._createQuadraticEntity(segment, path.isConstruction));
          break;
          
        case 'arc':
          entities.push(this._createArcEntity(segment, path.isConstruction));
          break;
          
        default:
          log.warn(`Unsupported segment type: ${segment.type}`);
          break;
      }
    });
    
    return entities;
  }

  /**
   * Create a line entity
   * @param {Object} segment - Line segment
   * @param {boolean} isConstruction - Whether the line is construction geometry
   * @returns {Object} - Line entity
   * @private
   */
  _createLineEntity(segment, isConstruction) {
    return {
      type: 'line',
      startPoint: {
        x: this._formatCoordinate(segment.x1),
        y: this._formatCoordinate(segment.y1)
      },
      endPoint: {
        x: this._formatCoordinate(segment.x2),
        y: this._formatCoordinate(segment.y2)
      },
      isConstruction
    };
  }

  /**
   * Create a cubic bezier curve entity
   * @param {Object} segment - Cubic bezier segment
   * @param {boolean} isConstruction - Whether the curve is construction geometry
   * @returns {Object} - Cubic bezier entity
   * @private
   */
  _createCubicEntity(segment, isConstruction) {
    return {
      type: 'cubic',
      startPoint: {
        x: this._formatCoordinate(segment.x1),
        y: this._formatCoordinate(segment.y1)
      },
      endPoint: {
        x: this._formatCoordinate(segment.x2),
        y: this._formatCoordinate(segment.y2)
      },
      controlPoint1: {
        x: this._formatCoordinate(segment.cx1),
        y: this._formatCoordinate(segment.cy1)
      },
      controlPoint2: {
        x: this._formatCoordinate(segment.cx2),
        y: this._formatCoordinate(segment.cy2)
      },
      isConstruction
    };
  }

  /**
   * Create a quadratic bezier curve entity
   * @param {Object} segment - Quadratic bezier segment
   * @param {boolean} isConstruction - Whether the curve is construction geometry
   * @returns {Object} - Quadratic bezier entity converted to cubic
   * @private
   */
  _createQuadraticEntity(segment, isConstruction) {
    // Convert quadratic to cubic
    // P0 = start point
    // P1 = control point
    // P2 = end point
    // 
    // Cubic control points:
    // CP1 = P0 + 2/3 * (P1 - P0)
    // CP2 = P2 + 2/3 * (P1 - P2)
    
    const p0x = segment.x1;
    const p0y = segment.y1;
    const p1x = segment.cx;
    const p1y = segment.cy;
    const p2x = segment.x2;
    const p2y = segment.y2;
    
    const cp1x = p0x + (2/3) * (p1x - p0x);
    const cp1y = p0y + (2/3) * (p1y - p0y);
    const cp2x = p2x + (2/3) * (p1x - p2x);
    const cp2y = p2y + (2/3) * (p1y - p2y);
    
    return {
      type: 'cubic',
      startPoint: {
        x: this._formatCoordinate(p0x),
        y: this._formatCoordinate(p0y)
      },
      endPoint: {
        x: this._formatCoordinate(p2x),
        y: this._formatCoordinate(p2y)
      },
      controlPoint1: {
        x: this._formatCoordinate(cp1x),
        y: this._formatCoordinate(cp1y)
      },
      controlPoint2: {
        x: this._formatCoordinate(cp2x),
        y: this._formatCoordinate(cp2y)
      },
      isConstruction
    };
  }

  /**
   * Create an arc entity
   * @param {Object} segment - Arc segment
   * @param {boolean} isConstruction - Whether the arc is construction geometry
   * @returns {Object} - Arc entity
   * @private
   */
  _createArcEntity(segment, isConstruction) {
    // Note: This is a simplified conversion that doesn't properly handle all arc parameters
    // A proper implementation would calculate the arc center and angles
    
    return {
      type: 'arc',
      startPoint: {
        x: this._formatCoordinate(segment.x1),
        y: this._formatCoordinate(segment.y1)
      },
      endPoint: {
        x: this._formatCoordinate(segment.x2),
        y: this._formatCoordinate(segment.y2)
      },
      radius: this._formatCoordinate(Math.max(segment.rx, segment.ry)),
      isConstruction
    };
  }

  /**
   * Create construction entities
   * @param {Array} constructionPaths - Construction paths
   * @returns {Array} - Construction entities
   * @private
   */
  _createConstructionEntities(constructionPaths) {
    const entities = [];
    
    constructionPaths.forEach(path => {
      entities.push(...this._createEntitiesForPath(path));
    });
    
    return entities;
  }

  /**
   * Create constraints for sketch entities
   * @param {Array} paths - Paths to create constraints for
   * @returns {Array} - Sketch constraints
   * @private
   */
  _createConstraints(paths) {
    const constraints = [];
    
    // This is a placeholder for constraint generation
    // A proper implementation would detect various geometric constraints:
    // - Horizontal/vertical lines
    // - Parallel/perpendicular lines
    // - Tangent arcs/curves
    // - Equal length/radius
    // - Symmetry
    // - etc.
    
    log.debug('Constraint generation not fully implemented');
    
    return constraints;
  }

  /**
   * Create 3D features from sketches
   * @param {Array} sketches - Sketch features
   * @param {Object} organizedPaths - Organized paths
   * @returns {Array} - 3D features
   * @private
   */
  _create3DFeatures(sketches, organizedPaths) {
    const features = [];
    
    // Process closed paths for extrusion
    if (organizedPaths.closed.length > 0) {
      features.push(...this._createExtrusionsForClosedPaths(sketches, organizedPaths.closed));
    }
    
    // Process open paths if extrudeOpenPaths is enabled
    if (this.options.extrudeOpenPaths && organizedPaths.open.length > 0) {
      features.push(...this._createExtrusionsForOpenPaths(sketches, organizedPaths.open));
    }
    
    // Process special features
    if (organizedPaths.bySpecialProcessing) {
      // Handle special extrusions
      if (organizedPaths.bySpecialProcessing.extrude) {
        features.push(...this._createCustomExtrusions(sketches, organizedPaths.bySpecialProcessing.extrude));
      }
      
      // Handle revolutions
      if (organizedPaths.bySpecialProcessing.revolve) {
        features.push(...this._createRevolutions(sketches, organizedPaths.bySpecialProcessing.revolve));
      }
      
      // Handle patterns
      if (organizedPaths.bySpecialProcessing.pattern) {
        features.push(...this._createPatterns(sketches, organizedPaths.bySpecialProcessing.pattern));
      }
      
      // Handle mirrors
      if (organizedPaths.bySpecialProcessing.mirror) {
        features.push(...this._createMirrors(sketches, organizedPaths.bySpecialProcessing.mirror));
      }
    }
    
    return features;
  }

  /**
   * Create extrusions for closed paths
   * @param {Array} sketches - Sketch features
   * @param {Array} closedPaths - Closed paths
   * @returns {Array} - Extrusion features
   * @private
   */
  _createExtrusionsForClosedPaths(sketches, closedPaths) {
    const extrusions = [];
    
    // If separate sketches, create an extrusion for each one
    if (this.options.separateSketches) {
      sketches.forEach((sketch, index) => {
        // Only create extrusion if the sketch corresponds to a closed path
        if (index < closedPaths.length) {
          const path = closedPaths[index];
          const depth = this._getExtrusionDepth(path);
          
          extrusions.push(this._createExtrusion(sketch.name, depth));
        }
      });
    } else {
      // Create a single extrusion for the sketch with closed paths
      const closedSketch = sketches.find(sketch => sketch.name === 'ClosedPaths' || sketch.name === 'AllPaths');
      
      if (closedSketch) {
        extrusions.push(this._createExtrusion(closedSketch.name, this.options.defaultExtrusion));
      }
    }
    
    return extrusions;
  }

  /**
   * Create extrusions for open paths
   * @param {Array} sketches - Sketch features
   * @param {Array} openPaths - Open paths
   * @returns {Array} - Extrusion features
   * @private
   */
  _createExtrusionsForOpenPaths(sketches, openPaths) {
    // This is a placeholder for open path extrusion
    // A proper implementation would:
    // 1. Create an offset curve for each open path
    // 2. Close the path with lines between endpoints
    // 3. Create an extrusion from the closed path
    
    log.debug('Open path extrusion not fully implemented');
    
    return [];
  }

  /**
   * Create an extrusion feature
   * @param {string} sketchName - Sketch name
   * @param {number} depth - Extrusion depth
   * @returns {Object} - Extrusion feature
   * @private
   */
  _createExtrusion(sketchName, depth) {
    return {
      feature: 'extrude',
      name: `Extrude_${sketchName}`,
      sketchName,
      depth,
      operation: 'new'
    };
  }

  /**
   * Get extrusion depth for a path
   * @param {Object} path - Path to get extrusion depth for
   * @returns {number} - Extrusion depth
   * @private
   */
  _getExtrusionDepth(path) {
    // Check for special extrusion depth
    if (path.specialProcessing && path.specialProcessing.extrude) {
      const extrude = path.specialProcessing.extrude;
      let depth = extrude.depth;
      
      // Convert units if needed
      if (extrude.units === 'in' && this.options.units === 'mm') {
        depth *= 25.4;
      } else if (extrude.units === 'mm' && this.options.units === 'in') {
        depth /= 25.4;
      }
      
      return depth;
    }
    
    // Use default extrusion depth
    return this.options.defaultExtrusion;
  }

  /**
   * Create custom extrusions
   * @param {Array} sketches - Sketch features
   * @param {Array} paths - Paths with custom extrusion
   * @returns {Array} - Custom extrusion features
   * @private
   */
  _createCustomExtrusions(sketches, paths) {
    // This is similar to createExtrusionsForClosedPaths but uses custom depths
    const extrusions = [];
    
    paths.forEach(path => {
      const depth = this._getExtrusionDepth(path);
      
      // Find matching sketch
      const sketch = this._findSketchForPath(sketches, path);
      
      if (sketch) {
        extrusions.push(this._createExtrusion(sketch.name, depth));
      }
    });
    
    return extrusions;
  }

  /**
   * Create revolution features
   * @param {Array} sketches - Sketch features
   * @param {Array} paths - Paths with revolution
   * @returns {Array} - Revolution features
   * @private
   */
  _createRevolutions(sketches, paths) {
    const revolutions = [];
    
    paths.forEach(path => {
      // Get revolution angle
      const angle = path.specialProcessing.revolve.angle || 360;
      
      // Find matching sketch
      const sketch = this._findSketchForPath(sketches, path);
      
      if (sketch) {
        revolutions.push({
          feature: 'revolve',
          name: `Revolve_${sketch.name}`,
          sketchName: sketch.name,
          angle,
          operation: 'new'
        });
      }
    });
    
    return revolutions;
  }

  /**
   * Create pattern features
   * @param {Array} sketches - Sketch features
   * @param {Array} paths - Paths with pattern
   * @returns {Array} - Pattern features
   * @private
   */
  _createPatterns(sketches, paths) {
    const patterns = [];
    
    paths.forEach(path => {
      // Get pattern dimensions
      const pattern = path.specialProcessing.pattern;
      
      if (!pattern || !pattern.x || !pattern.y) {
        return;
      }
      
      // Find matching feature (either sketch or extrusion)
      const sketch = this._findSketchForPath(sketches, path);
      
      if (sketch) {
        patterns.push({
          feature: 'pattern',
          name: `Pattern_${sketch.name}`,
          targetName: sketch.name,
          xCount: pattern.x,
          yCount: pattern.y,
          xSpacing: 20, // Default spacing in mm
          ySpacing: 20, // Default spacing in mm
          operation: 'new'
        });
      }
    });
    
    return patterns;
  }

  /**
   * Create mirror features
   * @param {Array} sketches - Sketch features
   * @param {Array} paths - Paths with mirror
   * @returns {Array} - Mirror features
   * @private
   */
  _createMirrors(sketches, paths) {
    const mirrors = [];
    
    paths.forEach(path => {
      // Find matching feature
      const sketch = this._findSketchForPath(sketches, path);
      
      if (sketch) {
        mirrors.push({
          feature: 'mirror',
          name: `Mirror_${sketch.name}`,
          targetName: sketch.name,
          plane: 'Front', // Default mirror plane
          operation: 'new'
        });
      }
    });
    
    return mirrors;
  }

  /**
   * Find a sketch for a path
   * @param {Array} sketches - Sketch features
   * @param {Object} path - Path to find sketch for
   * @returns {Object|null} - Matching sketch or null
   * @private
   */
  _findSketchForPath(sketches, path) {
    if (this.options.separateSketches) {
      // Find sketch with matching name
      return sketches.find(sketch => sketch.name === path.name);
    } else if (this.options.separateOpenClosed) {
      // Find sketch based on path type
      return sketches.find(sketch => 
        (path.closed && sketch.name === 'ClosedPaths') || 
        (!path.closed && sketch.name === 'OpenPaths') ||
        sketch.name === 'AllPaths'
      );
    } else {
      // Use the first sketch
      return sketches[0];
    }
  }

  /**
   * Format coordinate to specified precision
   * @param {number} value - Coordinate value
   * @returns {number} - Formatted coordinate
   * @private
   */
  _formatCoordinate(value) {
    return parseFloat(value.toFixed(this.options.decimalPrecision));
  }
}

module.exports = FeatureBuilder;