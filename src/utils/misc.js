// src\utils\misc.js
/**
 * Miscellaneous utilities for Onshape client
 */

/**
 * Unit system constants
 */
const UnitSystem = {
    INCH: 'inch',
    METRIC: 'metric',
    
    /**
     * Get the extension of a unit system
     * 
     * @param {string} system Unit system name
     * @returns {string} Unit extension (e.g., 'in' for inches)
     */
    getExtension(system) {
      const extensions = {
        [this.INCH]: 'in',
        [this.METRIC]: 'm'
      };
      return extensions[system] || 'in';
    },
    
    /**
     * Get the FeatureScript name of a unit system
     * 
     * @param {string} system Unit system name
     * @returns {string} Unit FeatureScript name
     */
    getFeatureScriptName(system) {
      const names = {
        [this.INCH]: 'inch',
        [this.METRIC]: 'meter'
      };
      return names[system] || 'inch';
    }
  };
  
  /**
   * 2D Point class
   */
  class Point2D {
    /**
     * @param {number} x X-coordinate
     * @param {number} y Y-coordinate
     */
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
  
    /**
     * Create a Point2D from a tuple
     * 
     * @param {Array<number>} tuple [x, y] coordinates
     * @returns {Point2D} New Point2D instance
     */
    static fromPair(tuple) {
      return new Point2D(tuple[0], tuple[1]);
    }
  
    /**
     * Scale the point by a factor
     * 
     * @param {number} factor Scale factor
     * @returns {Point2D} New scaled point
     */
    scale(factor) {
      return new Point2D(this.x * factor, this.y * factor);
    }
  
    /**
     * Add another point to this one
     * 
     * @param {Point2D} other Other point
     * @returns {Point2D} New point representing the sum
     */
    add(other) {
      return new Point2D(this.x + other.x, this.y + other.y);
    }
  
    /**
     * Subtract another point from this one
     * 
     * @param {Point2D} other Other point
     * @returns {Point2D} New point representing the difference
     */
    subtract(other) {
      return new Point2D(this.x - other.x, this.y - other.y);
    }
  
    /**
     * Check if two points are approximately equal
     * 
     * @param {Point2D} point1 First point
     * @param {Point2D} point2 Second point
     * @param {number} [epsilon=1e-8] Tolerance
     * @returns {boolean} True if points are approximately equal
     */
    static approx(point1, point2, epsilon = 1e-8) {
      const distance = Math.sqrt(
        Math.pow(point1.x - point2.x, 2) + 
        Math.pow(point1.y - point2.y, 2)
      );
      return distance < epsilon;
    }
  
    /**
     * Get the tuple representation
     * 
     * @returns {Array<number>} [x, y] tuple
     */
    get asTuple() {
      return [this.x, this.y];
    }
  
    /**
     * Calculate the distance to another point
     * 
     * @param {Point2D} other Other point
     * @returns {number} Distance between points
     */
    distanceTo(other) {
      return Math.sqrt(
        Math.pow(this.x - other.x, 2) + 
        Math.pow(this.y - other.y, 2)
      );
    }
  }
  
  /**
   * Find an item by name or ID
   * 
   * @template T
   * @param {string|null} targetId ID to search for
   * @param {string|null} name Name to search for
   * @param {Array<T>} items List of items to search through
   * @returns {T|null} Found item or null
   */
  function findByNameOrId(targetId, name, items) {
    if (!name && !targetId) {
      throw new Error('A name or id is required to fetch');
    }
  
    if (items.length === 0) {
      return null;
    }
  
    let candidate = null;
  
    if (name) {
      const filtered = items.filter(item => item.name === name);
      if (filtered.length > 1) {
        throw new Error(`Duplicate names '${name}'. Use id instead to fetch.`);
      }
      if (filtered.length > 0) {
        candidate = filtered[0];
      }
    }
  
    if (targetId) {
      const found = items.find(item => item.id === targetId);
      if (found) {
        candidate = found;
      }
    }
  
    return candidate;
  }
  
  /**
   * Convert inches to meters
   * 
   * @param {number} inches Value in inches
   * @returns {number} Value in meters
   */
  function inchesToMeters(inches) {
    return inches * 0.0254;
  }
  
  /**
   * Convert meters to inches
   * 
   * @param {number} meters Value in meters
   * @returns {number} Value in inches
   */
  function metersToInches(meters) {
    return meters / 0.0254;
  }
  
  module.exports = {
    UnitSystem,
    Point2D,
    findByNameOrId,
    inchesToMeters,
    metersToInches
  };