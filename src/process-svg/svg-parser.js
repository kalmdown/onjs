// src/process-svg/svg-parser.js
const { DOMParser } = require('xmldom');
const logger = require('../utils/logger');
const log = logger.scope('SVGParser');

/**
 * SVG Parser module that transforms SVG content into a structured format
 * for further processing and conversion to Onshape features
 */
class SVGParser {
  /**
   * Create a new SVG Parser instance
   * @param {Object} options - Parser configuration options
   */
  constructor(options = {}) {
    this.options = {
      // Whether to flatten transformations into coordinates
      flattenTransforms: options.flattenTransforms !== false,
      // Target unit system for coordinates ('mm', 'inch')
      targetUnits: options.targetUnits || 'mm',
      // Whether to normalize all coordinates to a common origin
      normalizeOrigin: options.normalizeOrigin !== false,
      // Scale factor to apply to the SVG
      scale: options.scale || 1.0,
      // Whether to convert text to paths
      convertTextToPaths: options.convertTextToPaths !== false,
      // Whether to parse stroke width information
      parseStrokeWidth: options.parseStrokeWidth !== false,
      // Default color for strokes if not specified
      defaultStrokeColor: options.defaultStrokeColor || '#000000',
      // Default fill for regions if not specified
      defaultFillColor: options.defaultFillColor || 'none',
      // Whether to include the parsing of style tags and classes
      parseStyleElements: options.parseStyleElements !== false,
      // Maximum decimal precision for coordinates
      decimalPrecision: options.decimalPrecision || 4
    };
    
    this.svgDoc = null;
    this.viewBox = { x: 0, y: 0, width: 100, height: 100 };
    this.elements = {
      paths: [],
      circles: [],
      ellipses: [],
      lines: [],
      polylines: [],
      polygons: [],
      rects: [],
      texts: [],
      groups: []
    };
    
    // Track the global transforms
    this.transforms = [];
    
    // Style information
    this.styles = {
      classes: {},
      inline: {}
    };
  }

  /**
   * Parse SVG content
   * @param {string} svgContent - Raw SVG content
   * @returns {Object} Parsed SVG structure
   */
  parse(svgContent) {
    try {
      log.debug('Beginning SVG parsing');
      
      // Parse the SVG document
      const parser = new DOMParser();
      this.svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      
      // Extract basic SVG information
      this._extractViewBox();
      
      // Parse styles if option is enabled
      if (this.options.parseStyleElements) {
        this._parseStyles();
      }
      
      // Extract SVG elements
      this._extractElements();
      
      // Process transformations if needed
      if (this.options.flattenTransforms) {
        this._flattenTransformations();
      }
      
      // Normalize coordinates to common origin if needed
      if (this.options.normalizeOrigin) {
        this._normalizeOrigin();
      }
      
      // Scale the elements if needed
      if (this.options.scale !== 1.0) {
        this._applyScaling();
      }
      
      // Return the parsed structure
      return {
        viewBox: this.viewBox,
        elements: this.elements,
        styles: this.styles,
        metadata: this._extractMetadata()
      };
    } catch (error) {
      log.error(`SVG parsing error: ${error.message}`, error);
      throw new Error(`Failed to parse SVG: ${error.message}`);
    }
  }

  /**
   * Extract the viewBox from the SVG
   * @private
   */
  _extractViewBox() {
    const svgElement = this.svgDoc.documentElement;
    
    // Process the viewBox attribute
    if (svgElement.hasAttribute('viewBox')) {
      const viewBoxAttr = svgElement.getAttribute('viewBox');
      const [x, y, width, height] = viewBoxAttr.split(/[\s,]+/).map(parseFloat);
      
      this.viewBox = { x, y, width, height };
      log.debug(`Extracted viewBox: ${JSON.stringify(this.viewBox)}`);
    } else {
      // Try to get width and height attributes
      const width = svgElement.hasAttribute('width') ? 
        this._parseUnitValue(svgElement.getAttribute('width')) : 100;
      
      const height = svgElement.hasAttribute('height') ? 
        this._parseUnitValue(svgElement.getAttribute('height')) : 100;
      
      this.viewBox = { x: 0, y: 0, width, height };
      log.debug(`No viewBox attribute, using width/height: ${JSON.stringify(this.viewBox)}`);
    }
    
    // Validate viewBox dimensions
    if (this.viewBox.width <= 0 || this.viewBox.height <= 0) {
      log.warn('Invalid viewBox dimensions, using defaults');
      this.viewBox = { x: 0, y: 0, width: 100, height: 100 };
    }
  }

  /**
   * Parse unit value from SVG attribute
   * @param {string} value - SVG dimension value (e.g., "100px", "10in", etc.)
   * @returns {number} - Value in pixels
   * @private
   */
  _parseUnitValue(value) {
    if (!value) return 0;
    
    // Strip unit and convert to number
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 0;
    
    // Extract unit (default to px if not specified)
    const unitMatch = value.match(/([0-9.]+)([a-z%]+)?/i);
    const unit = unitMatch && unitMatch[2] ? unitMatch[2].toLowerCase() : 'px';
    
    // Convert to target units based on SVG specifications
    // https://www.w3.org/TR/SVG11/coords.html#Units
    const unitFactors = {
      'px': 1,         // 1px = 1px
      'pt': 1.25,      // 1pt = 1.25px
      'pc': 15,        // 1pc = 15px
      'mm': 3.543307,  // 1mm = 3.543307px
      'cm': 35.43307,  // 1cm = 35.43307px
      'in': 90,        // 1in = 90px
      '%': 0           // percentage needs special handling
    };
    
    if (unit === '%') {
      // Handle percentages based on context (usually viewBox dimension)
      // This is a simplified approach - proper handling would depend on context
      log.warn('Percentage units in SVG dimensions may not be handled correctly');
      return numValue; // Just return the numeric value for now
    }
    
    // Convert to pixels
    const pixelValue = numValue * (unitFactors[unit] || 1);
    
    // For target unit conversion to happen here, we'd need to convert from pixels to target units
    // For example, to convert to mm: pixelValue / unitFactors['mm']
    // This is a simplified handling that may need enhancement based on specific requirements
    
    return pixelValue;
  }

  /**
   * Extract and parse CSS styles from the SVG
   * @private
   */
  _parseStyles() {
    // Parse <style> elements
    const styleElements = this.svgDoc.getElementsByTagName('style');
    for (let i = 0; i < styleElements.length; i++) {
      const styleContent = styleElements[i].textContent;
      this._parseStyleContent(styleContent);
    }
    
    log.debug(`Parsed ${Object.keys(this.styles.classes).length} CSS classes`);
  }

  /**
   * Parse CSS style content into class definitions
   * @param {string} styleContent - CSS style content
   * @private
   */
  _parseStyleContent(styleContent) {
    // This is a very simplified CSS parser that extracts basic class definitions
    // A more robust implementation would use a proper CSS parser
    try {
      // Extract class definitions using regex
      const classRegex = /\.([^\s{]+)\s*{([^}]*)}/g;
      let match;
      
      while ((match = classRegex.exec(styleContent)) !== null) {
        const className = match[1].trim();
        const styleText = match[2].trim();
        
        // Parse the style properties
        const styleProps = {};
        styleText.split(';').forEach(prop => {
          const [key, value] = prop.split(':').map(s => s.trim());
          if (key && value) {
            styleProps[key] = value;
          }
        });
        
        // Store in styles.classes
        this.styles.classes[className] = styleProps;
      }
    } catch (error) {
      log.warn(`Error parsing CSS styles: ${error.message}`);
    }
  }

  /**
   * Extract all SVG elements
   * @private
   */
  _extractElements() {
    const svgElement = this.svgDoc.documentElement;
    
    // Process root-level elements
    this._processChildElements(svgElement, this.transforms);
    
    // Log extraction results
    log.debug(`Extracted SVG elements: ` + 
      `${this.elements.paths.length} paths, ` +
      `${this.elements.circles.length} circles, ` +
      `${this.elements.ellipses.length} ellipses, ` +
      `${this.elements.lines.length} lines, ` +
      `${this.elements.polylines.length} polylines, ` +
      `${this.elements.polygons.length} polygons, ` +
      `${this.elements.rects.length} rects, ` +
      `${this.elements.texts.length} texts, ` +
      `${this.elements.groups.length} groups`);
  }

  /**
   * Process child elements recursively
   * @param {Element} parentElement - Parent DOM element
   * @param {Array} parentTransforms - Array of parent transforms
   * @private
   */
  _processChildElements(parentElement, parentTransforms) {
    const children = parentElement.childNodes;
    
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      
      // Skip non-element nodes
      if (child.nodeType !== 1) continue;
      
      // Get element transform
      const transform = this._getTransform(child);
      const elementTransforms = [...parentTransforms];
      if (transform) {
        elementTransforms.push(transform);
      }
      
      // Process element based on tag name
      const tagName = child.tagName.toLowerCase();
      
      switch (tagName) {
        case 'path':
          this._processPath(child, elementTransforms);
          break;
        case 'circle':
          this._processCircle(child, elementTransforms);
          break;
        case 'ellipse':
          this._processEllipse(child, elementTransforms);
          break;
        case 'line':
          this._processLine(child, elementTransforms);
          break;
        case 'polyline':
          this._processPolyline(child, elementTransforms);
          break;
        case 'polygon':
          this._processPolygon(child, elementTransforms);
          break;
        case 'rect':
          this._processRect(child, elementTransforms);
          break;
        case 'text':
          this._processText(child, elementTransforms);
          break;
        case 'g':
          this._processGroup(child, elementTransforms);
          break;
        default:
          // Skip unsupported elements but process their children
          this._processChildElements(child, elementTransforms);
          break;
      }
    }
  }

  /**
   * Get transformation information from an element
   * @param {Element} element - SVG DOM element
   * @returns {Object|null} - Transform object or null if no transform
   * @private
   */
  _getTransform(element) {
    if (!element.hasAttribute('transform')) {
      return null;
    }
    
    const transformAttr = element.getAttribute('transform');
    // This is a simplified transform parser
    // A proper implementation would parse all SVG transforms
    // (translate, scale, rotate, skewX, skewY, matrix)
    
    // Capture structure like translate(10, 20) or matrix(a, b, c, d, e, f)
    const regex = /(translate|scale|rotate|skewX|skewY|matrix)\s*\(\s*([^)]+)\)/g;
    const transforms = [];
    
    let match;
    while ((match = regex.exec(transformAttr)) !== null) {
      const type = match[1];
      const params = match[2].split(/[\s,]+/).map(parseFloat);
      
      transforms.push({ type, params });
    }
    
    return transforms.length ? { transforms } : null;
  }

  /**
   * Extract style attributes from an element
   * @param {Element} element - SVG DOM element
   * @returns {Object} - Style attributes
   * @private
   */
  _getStyleAttributes(element) {
    const style = {};
    
    // Check for style attribute
    if (element.hasAttribute('style')) {
      const styleAttr = element.getAttribute('style');
      
      // Parse inline style
      styleAttr.split(';').forEach(prop => {
        const [key, value] = prop.split(':').map(s => s.trim());
        if (key && value) {
          style[key] = value;
        }
      });
    }
    
    // Check for class attribute and merge class styles
    if (element.hasAttribute('class') && this.options.parseStyleElements) {
      const classNames = element.getAttribute('class').trim().split(/\s+/);
      
      classNames.forEach(className => {
        const classStyle = this.styles.classes[className];
        if (classStyle) {
          // Merge class style (inline styles have priority)
          Object.keys(classStyle).forEach(key => {
            if (!style[key]) {
              style[key] = classStyle[key];
            }
          });
        }
      });
    }
    
    // Get direct style attributes (stroke, fill, etc.)
    const directStyleAttrs = [
      'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
      'stroke-dasharray', 'fill', 'fill-opacity', 'fill-rule', 'opacity'
    ];
    
    directStyleAttrs.forEach(attr => {
      if (element.hasAttribute(attr)) {
        style[attr] = element.getAttribute(attr);
      }
    });
    
    // Set default values if not specified
    if (!style['stroke'] && !style['fill']) {
      style['stroke'] = this.options.defaultStrokeColor;
    }
    
    if (!style['fill']) {
      style['fill'] = this.options.defaultFillColor;
    }
    
    return style;
  }

  /**
   * Process a path element
   * @param {Element} element - Path element
   * @param {Array} transforms - Array of transforms
   * @private
   */
  _processPath(element, transforms) {
    if (!element.hasAttribute('d')) {
      log.warn('Path element missing "d" attribute, skipping');
      return;
    }
    
    const d = element.getAttribute('d');
    const id = element.getAttribute('id') || `path-${this.elements.paths.length + 1}`;
    const name = element.getAttribute('name') || id;
    const style = this._getStyleAttributes(element);
    
    // Detect if path is a construction line (from style)
    const isConstruction = this._isConstructionElement(element, style);
    
    this.elements.paths.push({
      id,
      name,
      type: 'path',
      path: d,
      style,
      transforms: [...transforms],
      isConstruction,
      // Extract special attributes like data-* attributes
      data: this._extractDataAttributes(element)
    });
  }

  /**
   * Process a circle element
   * @param {Element} element - Circle element
   * @param {Array} transforms - Array of transforms
   * @private
   */
  _processCircle(element, transforms) {
    const cx = parseFloat(element.getAttribute('cx') || '0');
    const cy = parseFloat(element.getAttribute('cy') || '0');
    const r = parseFloat(element.getAttribute('r') || '0');
    
    if (r <= 0) {
      log.warn('Circle element has invalid radius, skipping');
      return;
    }
    
    const id = element.getAttribute('id') || `circle-${this.elements.circles.length + 1}`;
    const name = element.getAttribute('name') || id;
    const style = this._getStyleAttributes(element);
    const isConstruction = this._isConstructionElement(element, style);
    
    this.elements.circles.push({
      id,
      name,
      type: 'circle',
      cx,
      cy,
      r,
      style,
      transforms: [...transforms],
      isConstruction,
      data: this._extractDataAttributes(element)
    });
  }

  /**
   * Process an ellipse element
   * @param {Element} element - Ellipse element
   * @param {Array} transforms - Array of transforms
   * @private
   */
  _processEllipse(element, transforms) {
    const cx = parseFloat(element.getAttribute('cx') || '0');
    const cy = parseFloat(element.getAttribute('cy') || '0');
    const rx = parseFloat(element.getAttribute('rx') || '0');
    const ry = parseFloat(element.getAttribute('ry') || '0');
    
    if (rx <= 0 || ry <= 0) {
      log.warn('Ellipse element has invalid radius, skipping');
      return;
    }
    
    const id = element.getAttribute('id') || `ellipse-${this.elements.ellipses.length + 1}`;
    const name = element.getAttribute('name') || id;
    const style = this._getStyleAttributes(element);
    const isConstruction = this._isConstructionElement(element, style);
    
    this.elements.ellipses.push({
      id,
      name,
      type: 'ellipse',
      cx,
      cy,
      rx,
      ry,
      style,
      transforms: [...transforms],
      isConstruction,
      data: this._extractDataAttributes(element)
    });
  }

  /**
   * Process a line element
   * @param {Element} element - Line element
   * @param {Array} transforms - Array of transforms
   * @private
   */
  _processLine(element, transforms) {
    const x1 = parseFloat(element.getAttribute('x1') || '0');
    const y1 = parseFloat(element.getAttribute('y1') || '0');
    const x2 = parseFloat(element.getAttribute('x2') || '0');
    const y2 = parseFloat(element.getAttribute('y2') || '0');
    
    const id = element.getAttribute('id') || `line-${this.elements.lines.length + 1}`;
    const name = element.getAttribute('name') || id;
    const style = this._getStyleAttributes(element);
    const isConstruction = this._isConstructionElement(element, style);
    
    this.elements.lines.push({
      id,
      name,
      type: 'line',
      x1,
      y1,
      x2,
      y2,
      style,
      transforms: [...transforms],
      isConstruction,
      data: this._extractDataAttributes(element)
    });
  }

  /**
   * Process a polyline element
   * @param {Element} element - Polyline element
   * @param {Array} transforms - Array of transforms
   * @private
   */
  _processPolyline(element, transforms) {
    if (!element.hasAttribute('points')) {
      log.warn('Polyline element missing "points" attribute, skipping');
      return;
    }
    
    const pointsAttr = element.getAttribute('points');
    const points = this._parsePoints(pointsAttr);
    
    if (points.length < 2) {
      log.warn('Polyline element has insufficient points, skipping');
      return;
    }
    
    const id = element.getAttribute('id') || `polyline-${this.elements.polylines.length + 1}`;
    const name = element.getAttribute('name') || id;
    const style = this._getStyleAttributes(element);
    const isConstruction = this._isConstructionElement(element, style);
    
    this.elements.polylines.push({
      id,
      name,
      type: 'polyline',
      points,
      style,
      transforms: [...transforms],
      isConstruction,
      data: this._extractDataAttributes(element)
    });
  }

  /**
   * Process a polygon element
   * @param {Element} element - Polygon element
   * @param {Array} transforms - Array of transforms
   * @private
   */
  _processPolygon(element, transforms) {
    if (!element.hasAttribute('points')) {
      log.warn('Polygon element missing "points" attribute, skipping');
      return;
    }
    
    const pointsAttr = element.getAttribute('points');
    const points = this._parsePoints(pointsAttr);
    
    if (points.length < 3) {
      log.warn('Polygon element has insufficient points, skipping');
      return;
    }
    
    const id = element.getAttribute('id') || `polygon-${this.elements.polygons.length + 1}`;
    const name = element.getAttribute('name') || id;
    const style = this._getStyleAttributes(element);
    const isConstruction = this._isConstructionElement(element, style);
    
    this.elements.polygons.push({
      id,
      name,
      type: 'polygon',
      points,
      style,
      transforms: [...transforms],
      isConstruction,
      data: this._extractDataAttributes(element)
    });
  }

  /**
   * Parse a points attribute string into an array of {x, y} objects
   * @param {string} pointsString - SVG points attribute string
   * @returns {Array} - Array of point objects
   * @private
   */
  _parsePoints(pointsString) {
    const points = [];
    
    // Remove commas and replace with spaces, then split
    const pointPairs = pointsString.trim().replace(/,/g, ' ').split(/\s+/);
    
    for (let i = 0; i < pointPairs.length - 1; i += 2) {
      const x = parseFloat(pointPairs[i]);
      const y = parseFloat(pointPairs[i + 1]);
      
      if (!isNaN(x) && !isNaN(y)) {
        points.push({ x, y });
      }
    }
    
    return points;
  }

  /**
   * Process a rectangle element
   * @param {Element} element - Rectangle element
   * @param {Array} transforms - Array of transforms
   * @private
   */
  _processRect(element, transforms) {
    const x = parseFloat(element.getAttribute('x') || '0');
    const y = parseFloat(element.getAttribute('y') || '0');
    const width = parseFloat(element.getAttribute('width') || '0');
    const height = parseFloat(element.getAttribute('height') || '0');
    const rx = element.hasAttribute('rx') ? parseFloat(element.getAttribute('rx')) : 0;
    const ry = element.hasAttribute('ry') ? parseFloat(element.getAttribute('ry')) : rx;
    
    if (width <= 0 || height <= 0) {
      log.warn('Rectangle element has invalid dimensions, skipping');
      return;
    }
    
    const id = element.getAttribute('id') || `rect-${this.elements.rects.length + 1}`;
    const name = element.getAttribute('name') || id;
    const style = this._getStyleAttributes(element);
    const isConstruction = this._isConstructionElement(element, style);
    
    this.elements.rects.push({
      id,
      name,
      type: 'rect',
      x,
      y,
      width,
      height,
      rx,
      ry,
      style,
      transforms: [...transforms],
      isConstruction,
      data: this._extractDataAttributes(element)
    });
  }

  /**
   * Process a text element
   * @param {Element} element - Text element
   * @param {Array} transforms - Array of transforms
   * @private
   */
  _processText(element, transforms) {
    const x = parseFloat(element.getAttribute('x') || '0');
    const y = parseFloat(element.getAttribute('y') || '0');
    const content = element.textContent || '';
    
    const id = element.getAttribute('id') || `text-${this.elements.texts.length + 1}`;
    const name = element.getAttribute('name') || id;
    const style = this._getStyleAttributes(element);
    
    // Additional text attributes
    const fontSize = element.getAttribute('font-size') || style['font-size'] || '12px';
    const fontFamily = element.getAttribute('font-family') || style['font-family'] || 'sans-serif';
    const textAnchor = element.getAttribute('text-anchor') || style['text-anchor'] || 'start';
    
    // Add text element
    this.elements.texts.push({
      id,
      name,
      type: 'text',
      x,
      y,
      content,
      fontSize,
      fontFamily,
      textAnchor,
      style,
      transforms: [...transforms],
      data: this._extractDataAttributes(element)
    });
    
    // Process any nested tspan elements
    const tspans = element.getElementsByTagName('tspan');
    for (let i = 0; i < tspans.length; i++) {
      this._processTspan(tspans[i], x, y, transforms, id);
    }
  }

  /**
   * Process a tspan element within text
   * @param {Element} element - Tspan element
   * @param {number} parentX - Parent text x coordinate
   * @param {number} parentY - Parent text y coordinate
   * @param {Array} transforms - Array of transforms
   * @param {string} parentId - Parent text element ID
   * @private
   */
  _processTspan(element, parentX, parentY, transforms, parentId) {
    // Get position, using parent coordinates if not specified
    const x = element.hasAttribute('x') ? parseFloat(element.getAttribute('x')) : parentX;
    const y = element.hasAttribute('y') ? parseFloat(element.getAttribute('y')) : parentY;
    const dx = element.hasAttribute('dx') ? parseFloat(element.getAttribute('dx')) : 0;
    const dy = element.hasAttribute('dy') ? parseFloat(element.getAttribute('dy')) : 0;
    
    const content = element.textContent || '';
    const id = element.getAttribute('id') || `tspan-${this.elements.texts.length + 1}`;
    const name = element.getAttribute('name') || id;
    const style = this._getStyleAttributes(element);
    
    // Add as a text element with reference to parent
    this.elements.texts.push({
      id,
      name,
      type: 'tspan',
      x: x + dx,
      y: y + dy,
      content,
      parentId,
      style,
      transforms: [...transforms],
      data: this._extractDataAttributes(element)
    });
  }

  /**
   * Process a group element
   * @param {Element} element - Group element
   * @param {Array} transforms - Array of transforms
   * @private
   */
  _processGroup(element, transforms) {
    const id = element.getAttribute('id') || `group-${this.elements.groups.length + 1}`;
    const name = element.getAttribute('name') || id;
    const style = this._getStyleAttributes(element);
    const isConstruction = this._isConstructionElement(element, style);
    
    // Create group entry
    const groupIndex = this.elements.groups.length;
    this.elements.groups.push({
      id,
      name,
      type: 'group',
      style,
      transforms: [...transforms],
      isConstruction,
      children: [],
      data: this._extractDataAttributes(element)
    });
    
    // Track current counts before processing children
    const countsBefore = this._getElementCounts();
    
    // Process children of the group
    this._processChildElements(element, transforms);
    
    // Calculate which elements were added during child processing
    const countsAfter = this._getElementCounts();
    const childIndices = this._getAddedElementIndices(countsBefore, countsAfter);
    
    // Add references to these elements to the group's children array
    Object.keys(childIndices).forEach(type => {
      childIndices[type].forEach(index => {
        this.elements.groups[groupIndex].children.push({
          type,
          index
        });
      });
    });
  }

  /**
   * Get current counts of all element types
   * @returns {Object} - Object with counts of each element type
   * @private
   */
  _getElementCounts() {
    const counts = {};
    Object.keys(this.elements).forEach(type => {
      counts[type] = this.elements[type].length;
    });
    return counts;
  }

  /**
   * Get indices of elements added between two count states
   * @param {Object} before - Element counts before
   * @param {Object} after - Element counts after
   * @returns {Object} - Object with arrays of indices for each type
   * @private
   */
  _getAddedElementIndices(before, after) {
    const indices = {};
    
    Object.keys(before).forEach(type => {
      const added = after[type] - before[type];
      
      if (added > 0) {
        indices[type] = [];
        for (let i = before[type]; i < after[type]; i++) {
          indices[type].push(i);
        }
      }
    });
    
    return indices;
  }

  /**
   * Check if an element should be treated as construction geometry
   * @param {Element} element - SVG element
   * @param {Object} style - Element style object
   * @returns {boolean} - Whether the element is construction geometry
   * @private
   */
  _isConstructionElement(element, style) {
    // Check for explicit construction tag in name or ID
    const id = element.getAttribute('id') || '';
    const name = element.getAttribute('name') || id;
    
    if (name.endsWith('#const') || name.includes('#construction') || 
        id.endsWith('_construction') || id.includes('_const_')) {
      return true;
    }
    
    // Check style for dashed line
    if (style['stroke-dasharray'] && style['stroke-dasharray'] !== 'none') {
      return this.options.dashedLinesAsConstruction !== false;
    }
    
    // Check data attributes
    if (element.hasAttribute('data-construction') || 
        element.hasAttribute('data-const') ||
        element.getAttribute('data-type') === 'construction') {
      return true;
    }
    
    return false;
  }

  /**
   * Extract all data-* attributes from an element
   * @param {Element} element - SVG element
   * @returns {Object} - Object with data attributes
   * @private
   */
  _extractDataAttributes(element) {
    const data = {};
    
    const attributes = element.attributes;
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];
      if (attr.name.startsWith('data-')) {
        // Convert kebab-case to camelCase (data-some-value -> someValue)
        const key = attr.name.substring(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        data[key] = attr.value;
      }
    }
    
    return data;
  }

  /**
   * Flatten all transformations into absolute coordinates
   * @private
   */
  _flattenTransformations() {
    // This is a placeholder for transform flattening
    // A proper implementation would apply all transformation matrices
    // to the element coordinates
    log.debug('Transform flattening not fully implemented');
    
    // For a complete implementation, we would:
    // 1. Convert all transforms to matrices
    // 2. Multiply matrices to get final transformation
    // 3. Apply to all coordinates of the element
    
    // Currently, transformations are stored with elements
    // and would need to be processed by the path processor
  }

  /**
   * Normalize coordinates to a common origin
   * @private
   */
  _normalizeOrigin() {
    // Shift all coordinates based on viewBox
    if (this.viewBox.x !== 0 || this.viewBox.y !== 0) {
      log.debug(`Normalizing coordinates by shifting (${this.viewBox.x}, ${this.viewBox.y})`);
      
      // Process each element type
      this._normalizePathOrigin();
      this._normalizeCircleOrigin();
      this._normalizeEllipseOrigin();
      this._normalizeLineOrigin();
      this._normalizePolylineOrigin();
      this._normalizePolygonOrigin();
      this._normalizeRectOrigin();
      this._normalizeTextOrigin();
    }
  }

  /**
   * Normalize path coordinates
   * @private
   */
  _normalizePathOrigin() {
    // Path normalization requires parsing the path data
    // This is a complex operation that requires a path parser
    log.debug('Path origin normalization not fully implemented');
    
    // For a complete implementation, we would:
    // 1. Parse the path data into commands
    // 2. Adjust all absolute coordinates by viewBox.x and viewBox.y
    // 3. Reassemble the path
  }

  /**
   * Normalize circle coordinates
   * @private
   */
  _normalizeCircleOrigin() {
    this.elements.circles.forEach(circle => {
      circle.cx -= this.viewBox.x;
      circle.cy -= this.viewBox.y;
    });
  }

  /**
   * Normalize ellipse coordinates
   * @private
   */
  _normalizeEllipseOrigin() {
    this.elements.ellipses.forEach(ellipse => {
      ellipse.cx -= this.viewBox.x;
      ellipse.cy -= this.viewBox.y;
    });
  }

  /**
   * Normalize line coordinates
   * @private
   */
  _normalizeLineOrigin() {
    this.elements.lines.forEach(line => {
      line.x1 -= this.viewBox.x;
      line.y1 -= this.viewBox.y;
      line.x2 -= this.viewBox.x;
      line.y2 -= this.viewBox.y;
    });
  }

  /**
   * Normalize polyline coordinates
   * @private
   */
  _normalizePolylineOrigin() {
    this.elements.polylines.forEach(polyline => {
      polyline.points.forEach(point => {
        point.x -= this.viewBox.x;
        point.y -= this.viewBox.y;
      });
    });
  }

  /**
   * Normalize polygon coordinates
   * @private
   */
  _normalizePolygonOrigin() {
    this.elements.polygons.forEach(polygon => {
      polygon.points.forEach(point => {
        point.x -= this.viewBox.x;
        point.y -= this.viewBox.y;
      });
    });
  }

  /**
   * Normalize rectangle coordinates
   * @private
   */
  _normalizeRectOrigin() {
    this.elements.rects.forEach(rect => {
      rect.x -= this.viewBox.x;
      rect.y -= this.viewBox.y;
    });
  }

  /**
   * Normalize text coordinates
   * @private
   */
  _normalizeTextOrigin() {
    this.elements.texts.forEach(text => {
      text.x -= this.viewBox.x;
      text.y -= this.viewBox.y;
    });
  }

  /**
   * Apply scaling to all elements
   * @private
   */
  _applyScaling() {
    const scale = this.options.scale;
    
    if (scale === 1.0) return;
    
    log.debug(`Applying scaling factor: ${scale}`);
    
    // Scale each element type
    this._scaleElements();
  }

  /**
   * Scale all element coordinates
   * @private
   */
  _scaleElements() {
    const scale = this.options.scale;
    
    // Scale circles
    this.elements.circles.forEach(circle => {
      circle.cx *= scale;
      circle.cy *= scale;
      circle.r *= scale;
    });
    
    // Scale ellipses
    this.elements.ellipses.forEach(ellipse => {
      ellipse.cx *= scale;
      ellipse.cy *= scale;
      ellipse.rx *= scale;
      ellipse.ry *= scale;
    });
    
    // Scale lines
    this.elements.lines.forEach(line => {
      line.x1 *= scale;
      line.y1 *= scale;
      line.x2 *= scale;
      line.y2 *= scale;
    });
    
    // Scale polylines
    this.elements.polylines.forEach(polyline => {
      polyline.points.forEach(point => {
        point.x *= scale;
        point.y *= scale;
      });
    });
    
    // Scale polygons
    this.elements.polygons.forEach(polygon => {
      polygon.points.forEach(point => {
        point.x *= scale;
        point.y *= scale;
      });
    });
    
    // Scale rectangles
    this.elements.rects.forEach(rect => {
      rect.x *= scale;
      rect.y *= scale;
      rect.width *= scale;
      rect.height *= scale;
      rect.rx *= scale;
      rect.ry *= scale;
    });
    
    // Scale texts
    this.elements.texts.forEach(text => {
      text.x *= scale;
      text.y *= scale;
    });
    
    // Path scaling requires parsing the path data
    // This is left as a placeholder
  }

  /**
   * Extract metadata from the SVG
   * @returns {Object} - SVG metadata
   * @private
   */
  _extractMetadata() {
    const metadata = {
      title: '',
      description: '',
      keywords: [],
      author: '',
      created: null,
      modified: null
    };
    
    // Extract <title> element
    const titleElements = this.svgDoc.getElementsByTagName('title');
    if (titleElements.length > 0) {
      metadata.title = titleElements[0].textContent || '';
    }
    
    // Extract <desc> element
    const descElements = this.svgDoc.getElementsByTagName('desc');
    if (descElements.length > 0) {
      metadata.description = descElements[0].textContent || '';
    }
    
    // Extract metadata from <metadata> element if present
    const metadataElements = this.svgDoc.getElementsByTagName('metadata');
    if (metadataElements.length > 0) {
      // Process RDF metadata if present (used in some SVG editors)
      // This is a simplified implementation
      const rdfElements = metadataElements[0].getElementsByTagNameNS('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'RDF');
      if (rdfElements.length > 0) {
        // Process RDF metadata
        // Implementation would depend on specific RDF schema used
      }
    }
    
    return metadata;
  }
}

module.exports = SVGParser;