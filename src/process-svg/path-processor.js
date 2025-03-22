}

/**
 * Approximate an elliptical arc with line segments
 * @param {Array} p0 - Start point [x, y]
 * @param {Array} p1 - End point [x, y]
 * @param {number} rx - X radius
 * @param {number} ry - Y radius
 * @param {number} xAxisRotation - Rotation of the x-axis in degrees
 * @param {boolean} largeArcFlag - Use large arc (true) or small arc (false)
 * @param {boolean} sweepFlag - Sweep clockwise (true) or counterclockwise (false)
 * @returns {Array} - Array of points forming the approximated arc
 * @private
 */
_approximateArc(p0, p1, rx, ry, xAxisRotation, largeArcFlag, sweepFlag) {
  // Implementation based on SVG specification
  // Convert from endpoint to center parameterization
  // See: https://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter
  
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  
  // Step 1: Compute the half distance between the current and the end point
  const dx = (p0[0] - p1[0]) / 2.0;
  const dy = (p0[1] - p1[1]) / 2.0;
  
  // Step 2: Convert from degrees to radians
  const radians = (xAxisRotation * Math.PI) / 180.0;
  const cosAngle = Math.cos(radians);
  const sinAngle = Math.sin(radians);
  
  // Step 3: Compute transformed point
  const x1 = cosAngle * dx + sinAngle * dy;
  const y1 = -sinAngle * dx + cosAngle * dy;
  
  // Step 4: Ensure radii are large enough
  rx = Math.max(rx, 0.001); // Avoid division by zero
  ry = Math.max(ry, 0.001);
  
  // Step 5: Check if radii are large enough
  const x1Squared = x1 * x1;
  const y1Squared = y1 * y1;
  const radiiCheck = x1Squared / (rx * rx) + y1Squared / (ry * ry);
  
  if (radiiCheck > 1) {
    // Scale up rx and ry
    rx = Math.sqrt(radiiCheck) * rx;
    ry = Math.sqrt(radiiCheck) * ry;
  }
  
  // Step 6: Compute center parameters
  const sign = largeArcFlag !== sweepFlag ? 1 : -1;
  const sq = ((rx * rx * ry * ry) - (rx * rx * y1Squared) - (ry * ry * x1Squared)) / 
             ((rx * rx * y1Squared) + (ry * ry * x1Squared));
  const coef = sign * Math.sqrt(Math.max(0, sq));
  
  const cx1 = coef * ((rx * y1) / ry);
  const cy1 = coef * -((ry * x1) / rx);
  
  // Step 7: Compute the center point
  const sx2 = (p0[0] + p1[0]) / 2.0;
  const sy2 = (p0[1] + p1[1]) / 2.0;
  const cx = sx2 + (cosAngle * cx1 - sinAngle * cy1);
  const cy = sy2 + (sinAngle * cx1 + cosAngle * cy1);
  
  // Step 8: Calculate the start and sweep angles
  const ux = (x1 - cx1) / rx;
  const uy = (y1 - cy1) / ry;
  const vx = (-x1 - cx1) / rx;
  const vy = (-y1 - cy1) / ry;
  
  // Start angle
  let startAngle = this._calcAngle(1, 0, ux, uy);
  
  // Sweep angle
  let sweepAngle = this._calcAngle(ux, uy, vx, vy);
  
  if (!sweepFlag && sweepAngle > 0) {
    sweepAngle -= 2 * Math.PI;
  } else if (sweepFlag && sweepAngle < 0) {
    sweepAngle += 2 * Math.PI;
  }
  
  // Clamp sweep angle
  sweepAngle %= 2 * Math.PI;
  
  // Approximate the arc with line segments
  const numSegments = Math.max(2, Math.ceil(Math.abs(sweepAngle) * Math.max(rx, ry) / this.options.curveResolution));
  const angleStep = sweepAngle / numSegments;
  
  const points = [];
  
  for (let i = 1; i <= numSegments; i++) {
    const angle = startAngle + i * angleStep;
    
    // Calculate point on the arc
    const x = cx + rx * Math.cos(angle) * cosAngle - ry * Math.sin(angle) * sinAngle;
    const y = cy + rx * Math.cos(angle) * sinAngle + ry * Math.sin(angle) * cosAngle;
    
    points.push([x, y]);
  }
  
  return points;
}

/**
 * Calculate angle between two vectors
 * @param {number} ux - First vector x component
 * @param {number} uy - First vector y component
 * @param {number} vx - Second vector x component
 * @param {number} vy - Second vector y component
 * @returns {number} - Angle in radians
 * @private
 */
_calcAngle(ux, uy, vx, vy) {
  const dot = ux * vx + uy * vy;
  const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
  
  // Clamp the value to prevent numerical errors
  let angle = Math.acos(Math.min(1, Math.max(-1, dot / len)));
  
  if (ux * vy - uy * vx < 0) {
    angle = -angle;
  }
  
  return angle;
}

/**
 * Estimate length of a cubic bezier curve
 * @param {Array} p0 - Start point [x, y]
 * @param {Array} p1 - First control point [x, y]
 * @param {Array} p2 - Second control point [x, y]
 * @param {Array} p3 - End point [x, y]
 * @returns {number} - Approximate curve length
 * @private
 */
_estimateCurveLength(p0, p1, p2, p3) {
  // Approximate curve length using chord length
  const chord = Math.sqrt(
    Math.pow(p3[0] - p0[0], 2) + 
    Math.pow(p3[1] - p0[1], 2)
  );
  
  // Control polygon length
  const controlPolygon = 
    Math.sqrt(Math.pow(p1[0] - p0[0], 2) + Math.pow(p1[1] - p0[1], 2)) +
    Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2)) +
    Math.sqrt(Math.pow(p3[0] - p2[0], 2) + Math.pow(p3[1] - p2[1], 2));
  
  // Use weighted average
  return (chord + controlPolygon) / 2.0;
}

/**
 * Estimate length of a quadratic bezier curve
 * @param {Array} p0 - Start point [x, y]
 * @param {Array} p1 - Control point [x, y]
 * @param {Array} p2 - End point [x, y]
 * @returns {number} - Approximate curve length
 * @private
 */
_estimateQuadraticCurveLength(p0, p1, p2) {
  // Approximate curve length using chord length
  const chord = Math.sqrt(
    Math.pow(p2[0] - p0[0], 2) + 
    Math.pow(p2[1] - p0[1], 2)
  );
  
  // Control polygon length
  const controlPolygon = 
    Math.sqrt(Math.pow(p1[0] - p0[0], 2) + Math.pow(p1[1] - p0[1], 2)) +
    Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
  
  // Use weighted average
  return (chord + controlPolygon) / 2.0;
}
}

module.exports = PathProcessor;// src/utils/svg/path-processor.js
const logger = require('../logger');
const log = logger.scope('PathProcessor');

/**
* PathProcessor module that processes SVG path data into a format suitable
* for conversion to Onshape features.
*/
class PathProcessor {
/**
 * Create a new PathProcessor instance
 * @param {Object} options - Processor configuration options
 */
constructor(options = {}) {
  this.options = {
    // Maximum error for path simplification
    simplifyTolerance: options.simplifyTolerance || 0.1,
    // Whether to simplify paths
    simplifyPaths: options.simplifyPaths !== false,
    // Target units for path coordinates
    targetUnits: options.targetUnits || 'mm',
    // Whether to convert curved paths to line segments for easier processing
    approximateCurves: options.approximateCurves !== false,
    // Resolution for curve approximation
    curveResolution: options.curveResolution || 0.5,
    // Whether to close nearly-closed paths
    autoClosePaths: options.autoClosePaths !== false,
    // Tolerance for auto-closing paths
    closePathTolerance: options.closePathTolerance || 0.1,
    // Whether to apply constraints to paths
    applyConstraints: options.applyConstraints !== false,
    // Tolerance for identifying constraints
    constraintTolerance: options.constraintTolerance || 0.01,
    // Whether to detect and process dashed lines as construction lines
    processDashedLines: options.processDashedLines !== false,
    // Whether to extract name processing tags
    parseNameTags: options.parseNameTags !== false,
    // Default stroke width to use if not specified
    defaultStrokeWidth: options.defaultStrokeWidth || 1,
    // Maximum decimal precision for coordinates
    decimalPrecision: options.decimalPrecision || 4
  }

/**
 * Process a polyline element as a path
 * @param {Object} polyline - SVG polyline element
 * @param {number} index - Element index
 * @returns {Object} - Processed path data
 * @private
 */
_processPolyline(polyline, index) {
  const polylineId = polyline.id || `polyline-${index}`;
  log.debug(`Processing polyline: ${polylineId}`);
  
  // Process element style
  const style = this._processStyle(polyline.style);
  
  // Extract special tags from name
  const nameInfo = this._parseNameTags(polyline.name);
  
  // Create line segments from points
  const segments = [];
  const points = polyline.points;
  
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({
      type: 'line',
      x1: points[i].x,
      y1: points[i].y,
      x2: points[i + 1].x,
      y2: points[i + 1].y
    });
  }
  
  // Check if this is a closed polyline
  let isClosed = false;
  if (points.length > 2) {
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    
    // Calculate distance between first and last points
    const distance = Math.sqrt(
      Math.pow(lastPoint.x - firstPoint.x, 2) + 
      Math.pow(lastPoint.y - firstPoint.y, 2)
    );
    
    // If distance is within tolerance, consider it closed
    isClosed = distance <= this.options.closePathTolerance;
    
    // If closed or forced closure, add closing segment
    if (isClosed || nameInfo.closed) {
      segments.push({
        type: 'line',
        x1: lastPoint.x,
        y1: lastPoint.y,
        x2: firstPoint.x,
        y2: firstPoint.y,
        isClosingSegment: true
      });
    }
  }
  
  // Determine if element is a construction line
  const isConstruction = polyline.isConstruction || style.isConstruction || nameInfo.isConstruction;
  
  // Return processed polyline as path
  return {
    id: polylineId,
    name: nameInfo.name,
    originalName: polyline.name,
    segments,
    closed: isClosed || nameInfo.closed,
    style,
    isConstruction,
    specialProcessing: nameInfo.specialProcessing,
    type: 'polyline',
    data: polyline.data || {}
  };
}

/**
 * Process a polygon element as a path
 * @param {Object} polygon - SVG polygon element
 * @param {number} index - Element index
 * @returns {Object} - Processed path data
 * @private
 */
_processPolygon(polygon, index) {
  const polygonId = polygon.id || `polygon-${index}`;
  log.debug(`Processing polygon: ${polygonId}`);
  
  // Process element style
  const style = this._processStyle(polygon.style);
  
  // Extract special tags from name
  const nameInfo = this._parseNameTags(polygon.name);
  
  // Create line segments from points
  const segments = [];
  const points = polygon.points;
  
  for (let i = 0; i < points.length; i++) {
    const nextIndex = (i + 1) % points.length;
    segments.push({
      type: 'line',
      x1: points[i].x,
      y1: points[i].y,
      x2: points[nextIndex].x,
      y2: points[nextIndex].y,
      isClosingSegment: i === points.length - 1 // Mark last segment as closing
    });
  }
  
  // Determine if element is a construction line
  const isConstruction = polygon.isConstruction || style.isConstruction || nameInfo.isConstruction;
  
  // Return processed polygon as path
  return {
    id: polygonId,
    name: nameInfo.name,
    originalName: polygon.name,
    segments,
    closed: true, // Polygons are always closed
    style,
    isConstruction,
    specialProcessing: nameInfo.specialProcessing,
    type: 'polygon',
    data: polygon.data || {}
  };
}

/**
 * Process a rectangle element as a path
 * @param {Object} rect - SVG rectangle element
 * @param {number} index - Element index
 * @returns {Object} - Processed path data
 * @private
 */
_processRect(rect, index) {
  const rectId = rect.id || `rect-${index}`;
  log.debug(`Processing rectangle: ${rectId}`);
  
  // Process element style
  const style = this._processStyle(rect.style);
  
  // Extract special tags from name
  const nameInfo = this._parseNameTags(rect.name);
  
  // Create segments for the rectangle
  let segments = [];
  
  if (rect.rx > 0 || rect.ry > 0) {
    // Rectangle with rounded corners
    segments = this._generateRoundedRectSegments(
      rect.x, rect.y, rect.width, rect.height, rect.rx, rect.ry
    );
  } else {
    // Standard rectangle
    segments = [
      // Top edge
      {
        type: 'line',
        x1: rect.x,
        y1: rect.y,
        x2: rect.x + rect.width,
        y2: rect.y
      },
      // Right edge
      {
        type: 'line',
        x1: rect.x + rect.width,
        y1: rect.y,
        x2: rect.x + rect.width,
        y2: rect.y + rect.height
      },
      // Bottom edge
      {
        type: 'line',
        x1: rect.x + rect.width,
        y1: rect.y + rect.height,
        x2: rect.x,
        y2: rect.y + rect.height
      },
      // Left edge (closing)
      {
        type: 'line',
        x1: rect.x,
        y1: rect.y + rect.height,
        x2: rect.x,
        y2: rect.y,
        isClosingSegment: true
      }
    ];
  }
  
  // Determine if element is a construction line
  const isConstruction = rect.isConstruction || style.isConstruction || nameInfo.isConstruction;
  
  // Return processed rectangle as path
  return {
    id: rectId,
    name: nameInfo.name,
    originalName: rect.name,
    segments,
    closed: true, // Rectangles are always closed
    style,
    isConstruction,
    specialProcessing: nameInfo.specialProcessing,
    type: 'rect',
    data: rect.data || {}
  };
}

/**
 * Generate segments for a rounded rectangle
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Rectangle width
 * @param {number} height - Rectangle height
 * @param {number} rx - X corner radius
 * @param {number} ry - Y corner radius
 * @returns {Array} - Rectangle segments
 * @private
 */
_generateRoundedRectSegments(x, y, width, height, rx, ry) {
  // Ensure rx and ry are not too large for the rectangle
  rx = Math.min(rx, width / 2);
  ry = Math.min(ry, height / 2);
  
  // If approximating curves, generate line segments
  if (this.options.approximateCurves) {
    // Calculate number of segments for each corner
    const cornerSegments = Math.max(4, Math.ceil(Math.PI * rx / 2 / this.options.curveResolution));
    const segments = [];
    
    // Helper function to add corner segments
    const addCorner = (centerX, centerY, startAngle, endAngle) => {
      const angleStep = (endAngle - startAngle) / cornerSegments;
      
      for (let i = 0; i < cornerSegments; i++) {
        const angle1 = startAngle + i * angleStep;
        const angle2 = startAngle + (i + 1) * angleStep;
        
        segments.push({
          type: 'line',
          x1: centerX + rx * Math.cos(angle1),
          y1: centerY + ry * Math.sin(angle1),
          x2: centerX + rx * Math.cos(angle2),
          y2: centerY + ry * Math.sin(angle2)
        });
      }
    };
    
    // Top-right corner
    addCorner(x + width - rx, y + ry, -Math.PI / 2, 0);
    
    // Right edge
    segments.push({
      type: 'line',
      x1: x + width,
      y1: y + ry,
      x2: x + width,
      y2: y + height - ry
    });
    
    // Bottom-right corner
    addCorner(x + width - rx, y + height - ry, 0, Math.PI / 2);
    
    // Bottom edge
    segments.push({
      type: 'line',
      x1: x + width - rx,
      y1: y + height,
      x2: x + rx,
      y2: y + height
    });
    
    // Bottom-left corner
    addCorner(x + rx, y + height - ry, Math.PI / 2, Math.PI);
    
    // Left edge
    segments.push({
      type: 'line',
      x1: x,
      y1: y + height - ry,
      x2: x,
      y2: y + ry
    });
    
    // Top-left corner
    addCorner(x + rx, y + ry, Math.PI, 3 * Math.PI / 2);
    
    // Top edge
    segments.push({
      type: 'line',
      x1: x + rx,
      y1: y,
      x2: x + width - rx,
      y2: y,
      isClosingSegment: true
    });
    
    return segments;
  } else {
    // Use cubic bezier curves for corners
    const segments = [];
    const kappa = 0.5522848; // Magic number for optimal cubic bezier approximation of quarter circle
    const ox = rx * kappa;   // X offset for control points
    const oy = ry * kappa;   // Y offset for control points
    
    // Top-right corner
    segments.push({
      type: 'line',
      x1: x + rx,
      y1: y,
      x2: x + width - rx,
      y2: y
    });
    segments.push({
      type: 'cubic',
      x1: x + width - rx,
      y1: y,
      cx1: x + width - rx + ox,
      cy1: y,
      cx2: x + width,
      cy2: y + ry - oy,
      x2: x + width,
      y2: y + ry
    });
    
    // Right edge
    segments.push({
      type: 'line',
      x1: x + width,
      y1: y + ry,
      x2: x + width,
      y2: y + height - ry
    });
    
    // Bottom-right corner
    segments.push({
      type: 'cubic',
      x1: x + width,
      y1: y + height - ry,
      cx1: x + width,
      cy1: y + height - ry + oy,
      cx2: x + width - rx + ox,
      cy2: y + height,
      x2: x + width - rx,
      y2: y + height
    });
    
    // Bottom edge
    segments.push({
      type: 'line',
      x1: x + width - rx,
      y1: y + height,
      x2: x + rx,
      y2: y + height
    });
    
    // Bottom-left corner
    segments.push({
      type: 'cubic',
      x1: x + rx,
      y1: y + height,
      cx1: x + rx - ox,
      cy1: y + height,
      cx2: x,
      cy2: y + height - ry + oy,
      x2: x,
      y2: y + height - ry
    });
    
    // Left edge
    segments.push({
      type: 'line',
      x1: x,
      y1: y + height - ry,
      x2: x,
      y2: y + ry
    });
    
    // Top-left corner (closing)
    segments.push({
      type: 'cubic',
      x1: x,
      y1: y + ry,
      cx1: x,
      cy1: y + ry - oy,
      cx2: x + rx - ox,
      cy2: y,
      x2: x + rx,
      y2: y,
      isClosingSegment: true
    });
    
    return segments;
  }
}

/**
 * Approximate a cubic bezier curve with line segments
 * @param {Array} p0 - Start point [x, y]
 * @param {Array} p1 - First control point [x, y]
 * @param {Array} p2 - Second control point [x, y]
 * @param {Array} p3 - End point [x, y]
 * @returns {Array} - Array of points forming the approximated curve
 * @private
 */
_approximateCubicBezier(p0, p1, p2, p3) {
  // Calculate curve length (approximately)
  const length = this._estimateCurveLength(p0, p1, p2, p3);
  
  // Calculate number of segments based on curve resolution
  const numSegments = Math.max(2, Math.ceil(length / this.options.curveResolution));
  
  // Generate points along the curve
  const points = [];
  
  for (let i = 1; i <= numSegments; i++) {
    const t = i / numSegments;
    
    // Cubic Bezier formula
    const x = Math.pow(1 - t, 3) * p0[0] + 
              3 * Math.pow(1 - t, 2) * t * p1[0] + 
              3 * (1 - t) * Math.pow(t, 2) * p2[0] + 
              Math.pow(t, 3) * p3[0];
    
    const y = Math.pow(1 - t, 3) * p0[1] + 
              3 * Math.pow(1 - t, 2) * t * p1[1] + 
              3 * (1 - t) * Math.pow(t, 2) * p2[1] + 
              Math.pow(t, 3) * p3[1];
    
    points.push([x, y]);
  }
  
  return points;
}

/**
 * Approximate a quadratic bezier curve with line segments
 * @param {Array} p0 - Start point [x, y]
 * @param {Array} p1 - Control point [x, y]
 * @param {Array} p2 - End point [x, y]
 * @returns {Array} - Array of points forming the approximated curve
 * @private
 */
_approximateQuadraticBezier(p0, p1, p2) {
  // Calculate curve length (approximately)
  const length = this._estimateQuadraticCurveLength(p0, p1, p2);
  
  // Calculate number of segments based on curve resolution
  const numSegments = Math.max(2, Math.ceil(length / this.options.curveResolution));
  
  // Generate points along the curve
  const points = [];
  
  for (let i = 1; i <= numSegments; i++) {
    const t = i / numSegments;
    
    // Quadratic Bezier formula
    const x = Math.pow(1 - t, 2) * p0[0] + 
              2 * (1 - t) * t * p1[0] + 
              Math.pow(t, 2) * p2[0];
    
    const y = Math.pow(1 - t, 2) * p0[1] + 
              2 * (1 - t) * t * p1[1] + 
              Math.pow(t, 2) * p2[1];
    
    points.push([x, y]);
  }
  
  return points;
}

/**
 * Process a circle element as a path
 * @param {Object} circle - SVG circle element
 * @param {number} index - Element index
 * @returns {Object} - Processed path data
 * @private
 */
_processCircle(circle, index) {
  const circleId = circle.id || `circle-${index}`;
  log.debug(`Processing circle: ${circleId}`);
  
  // Process element style
  const style = this._processStyle(circle.style);
  
  // Extract special tags from name
  const nameInfo = this._parseNameTags(circle.name);
  
  // Generate segments representing the circle
  const segments = this._generateCircleSegments(circle.cx, circle.cy, circle.r);
  
  // Determine if element is a construction line
  const isConstruction = circle.isConstruction || style.isConstruction || nameInfo.isConstruction;
  
  // Return processed circle as path
  return {
    id: circleId,
    name: nameInfo.name,
    originalName: circle.name,
    segments,
    closed: true, // Circles are always closed
    style,
    isConstruction,
    specialProcessing: nameInfo.specialProcessing,
    type: 'circle',
    data: circle.data || {}
  };
}

/**
 * Generate segments for a circle
 * @param {number} cx - Center X coordinate
 * @param {number} cy - Center Y coordinate
 * @param {number} r - Radius
 * @returns {Array} - Circle segments
 * @private
 */
_generateCircleSegments(cx, cy, r) {
  const segments = [];
  
  if (this.options.approximateCurves) {
    // Approximate circle with straight line segments
    const numSegments = Math.max(8, Math.ceil(2 * Math.PI * r / this.options.curveResolution));
    const angleStep = 2 * Math.PI / numSegments;
    
    for (let i = 0; i < numSegments; i++) {
      const startAngle = i * angleStep;
      const endAngle = (i + 1) * angleStep;
      
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      
      segments.push({
        type: 'line',
        x1,
        y1,
        x2,
        y2
      });
    }
  } else {
    // Use cubic bezier curves to represent the circle
    // A circle can be approximated with 4 cubic bezier curves
    const kappa = 0.5522848; // Magic number for optimal cubic bezier approximation of a circle
    const ox = r * kappa;    // X offset for control points
    const oy = r * kappa;    // Y offset for control points
    
    // Top right quadrant
    segments.push({
      type: 'cubic',
      x1: cx + r,
      y1: cy,
      cx1: cx + r,
      cy1: cy - oy,
      cx2: cx + ox,
      cy2: cy - r,
      x2: cx,
      y2: cy - r
    });
    
    // Top left quadrant
    segments.push({
      type: 'cubic',
      x1: cx,
      y1: cy - r,
      cx1: cx - ox,
      cy1: cy - r,
      cx2: cx - r,
      cy2: cy - oy,
      x2: cx - r,
      y2: cy
    });
    
    // Bottom left quadrant
    segments.push({
      type: 'cubic',
      x1: cx - r,
      y1: cy,
      cx1: cx - r,
      cy1: cy + oy,
      cx2: cx - ox,
      cy2: cy + r,
      x2: cx,
      y2: cy + r
    });
    
    // Bottom right quadrant
    segments.push({
      type: 'cubic',
      x1: cx,
      y1: cy + r,
      cx1: cx + ox,
      cy1: cy + r,
      cx2: cx + r,
      cy2: cy + oy,
      x2: cx + r,
      y2: cy
    });
  }
  
  return segments;
}

/**
 * Process an ellipse element as a path
 * @param {Object} ellipse - SVG ellipse element
 * @param {number} index - Element index
 * @returns {Object} - Processed path data
 * @private
 */
_processEllipse(ellipse, index) {
  const ellipseId = ellipse.id || `ellipse-${index}`;
  log.debug(`Processing ellipse: ${ellipseId}`);
  
  // Process element style
  const style = this._processStyle(ellipse.style);
  
  // Extract special tags from name
  const nameInfo = this._parseNameTags(ellipse.name);
  
  // Generate segments representing the ellipse
  const segments = this._generateEllipseSegments(ellipse.cx, ellipse.cy, ellipse.rx, ellipse.ry);
  
  // Determine if element is a construction line
  const isConstruction = ellipse.isConstruction || style.isConstruction || nameInfo.isConstruction;
  
  // Return processed ellipse as path
  return {
    id: ellipseId,
    name: nameInfo.name,
    originalName: ellipse.name,
    segments,
    closed: true, // Ellipses are always closed
    style,
    isConstruction,
    specialProcessing: nameInfo.specialProcessing,
    type: 'ellipse',
    data: ellipse.data || {}
  };
}

/**
 * Generate segments for an ellipse
 * @param {number} cx - Center X coordinate
 * @param {number} cy - Center Y coordinate
 * @param {number} rx - X radius
 * @param {number} ry - Y radius
 * @returns {Array} - Ellipse segments
 * @private
 */
_generateEllipseSegments(cx, cy, rx, ry) {
  const segments = [];
  
  if (this.options.approximateCurves) {
    // Approximate ellipse with straight line segments
    const circumference = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    const numSegments = Math.max(8, Math.ceil(circumference / this.options.curveResolution));
    const angleStep = 2 * Math.PI / numSegments;
    
    for (let i = 0; i < numSegments; i++) {
      const startAngle = i * angleStep;
      const endAngle = (i + 1) * angleStep;
      
      const x1 = cx + rx * Math.cos(startAngle);
      const y1 = cy + ry * Math.sin(startAngle);
      const x2 = cx + rx * Math.cos(endAngle);
      const y2 = cy + ry * Math.sin(endAngle);
      
      segments.push({
        type: 'line',
        x1,
        y1,
        x2,
        y2
      });
    }
  } else {
    // Use cubic bezier curves to represent the ellipse
    // An ellipse can be approximated with 4 cubic bezier curves
    const kappa = 0.5522848; // Magic number for optimal cubic bezier approximation
    const ox = rx * kappa;   // X offset for control points
    const oy = ry * kappa;   // Y offset for control points
    
    // Top right quadrant
    segments.push({
      type: 'cubic',
      x1: cx + rx,
      y1: cy,
      cx1: cx + rx,
      cy1: cy - oy,
      cx2: cx + ox,
      cy2: cy - ry,
      x2: cx,
      y2: cy - ry
    });
    
    // Top left quadrant
    segments.push({
      type: 'cubic',
      x1: cx,
      y1: cy - ry,
      cx1: cx - ox,
      cy1: cy - ry,
      cx2: cx - rx,
      cy2: cy - oy,
      x2: cx - rx,
      y2: cy
    });
    
    // Bottom left quadrant
    segments.push({
      type: 'cubic',
      x1: cx - rx,
      y1: cy,
      cx1: cx - rx,
      cy1: cy + oy,
      cx2: cx - ox,
      cy2: cy + ry,
      x2: cx,
      y2: cy + ry
    });
    
    // Bottom right quadrant
    segments.push({
      type: 'cubic',
      x1: cx,
      y1: cy + ry,
      cx1: cx + ox,
      cy1: cy + ry,
      cx2: cx + rx,
      cy2: cy + oy,
      x2: cx + rx,
      y2: cy
    });
  }
  
  return segments;
}

/**
 * Process a line element as a path
 * @param {Object} line - SVG line element
 * @param {number} index - Element index
 * @returns {Object} - Processed path data
 * @private
 */
_processLine(line, index) {
  const lineId = line.id || `line-${index}`;
  log.debug(`Processing line: ${lineId}`);
  
  // Process element style
  const style = this._processStyle(line.style);
  
  // Extract special tags from name
  const nameInfo = this._parseNameTags(line.name);
  
  // Create a single line segment
  const segments = [{
    type: 'line',
    x1: line.x1,
    y1: line.y1,
    x2: line.x2,
    y2: line.y2
  }];
  
  // Determine if element is a construction line
  const isConstruction = line.isConstruction || style.isConstruction || nameInfo.isConstruction;
  
  // Return processed line as path
  return {
    id: lineId,
    name: nameInfo.name,
    originalName: line.name,
    segments,
    closed: false, // Lines are not closed
    style,
    isConstruction,
    specialProcessing: nameInfo.specialProcessing,
    type: 'line',
    data: line.data || {}
  };
};

  // Configuration option to handle unit conversion
  this.unitConversionFactor = 1.0;
  if (this.options.targetUnits === 'mm' || this.options.targetUnits === 'millimeter') {
    // Most SVGs use 'px' which we'll assume to be approximately equal to mm
    this.unitConversionFactor = 1.0;
  } else if (this.options.targetUnits === 'inch' || this.options.targetUnits === 'in') {
    // Convert mm to inches
    this.unitConversionFactor = 0.0393701;
  }
}

/**
 * Process all paths from parsed SVG data
 * @param {Object} svgData - Parsed SVG data from SVGParser
 * @returns {Object} - Processed path data
 */
process(svgData) {
  const pathElements = svgData.elements.paths || [];
  log.debug(`Processing ${pathElements.length} SVG paths`);

  const processedPaths = [];
  
  // Process each path
  pathElements.forEach((path, index) => {
    try {
      const processedPath = this._processPath(path, index);
      if (processedPath) {
        processedPaths.push(processedPath);
      }
    } catch (error) {
      log.error(`Error processing path ${path.id}: ${error.message}`, error);
    }
  });

  // Also process other element types as paths
  this._processNonPathElements(svgData, processedPaths);

  log.debug(`Successfully processed ${processedPaths.length} paths`);
  
  return {
    paths: processedPaths
  };
}

/**
 * Process a single SVG path
 * @param {Object} pathElement - SVG path data
 * @param {number} index - Path index
 * @returns {Object} - Processed path data
 * @private
 */
_processPath(pathElement, index) {
  const pathId = pathElement.id || `path-${index}`;
  log.debug(`Processing path: ${pathId}`);
  
  // Parse the path data
  const commands = this._parsePath(pathElement.path);
  if (!commands || commands.length === 0) {
    log.warn(`Path ${pathId} has no valid commands, skipping`);
    return null;
  }
  
  // Extract segments from commands
  const segments = this._extractSegments(commands);
  if (segments.length === 0) {
    log.warn(`Path ${pathId} has no segments, skipping`);
    return null;
  }
  
  // Apply transformations if needed
  const transformedSegments = this._applyTransforms(segments, pathElement.transforms);
  
  // Check if path is closed
  const isClosed = this._isPathClosed(transformedSegments);
  
  // Auto-close path if needed
  const finalSegments = this._autoClosePath(transformedSegments, isClosed);
  
  // Process path style
  const style = this._processStyle(pathElement.style);
  
  // Determine if path is a construction line
  const isConstruction = pathElement.isConstruction || style.isConstruction;
  
  // Extract special tags from name
  const nameInfo = this._parseNameTags(pathElement.name);
  
  // Combine all processed data
  return {
    id: pathId,
    name: nameInfo.name,
    originalName: pathElement.name,
    segments: finalSegments,
    closed: isClosed || nameInfo.closed,
    style,
    isConstruction: isConstruction || nameInfo.isConstruction,
    specialProcessing: nameInfo.specialProcessing,
    type: 'path',
    data: pathElement.data || {}
  };
}

/**
 * Parse SVG path data string into command objects
 * @param {string} pathData - SVG path data string
 * @returns {Array} - Array of command objects
 * @private
 */
_parsePath(pathData) {
  // This is a simplified path parser
  // A complete implementation would handle all SVG path commands
  // See: https://www.w3.org/TR/SVG11/paths.html
  
  // Array to hold parsed commands
  const commands = [];
  
  // Regular expression to match path commands
  // Format: command letter followed by optional parameters
  const commandRegex = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g;
  let match;
  
  // Current position
  let currentX = 0;
  let currentY = 0;
  
  // Initial subpath position (for close path command)
  let initialX = 0;
  let initialY = 0;
  
  while ((match = commandRegex.exec(pathData)) !== null) {
    const commandLetter = match[1];
    const paramsStr = match[2].trim();
    
    // Parse parameters: split by comma or whitespace, filter out empty strings
    const params = paramsStr
      .split(/[\s,]+/)
      .map(param => parseFloat(param))
      .filter(param => !isNaN(param));
    
    // Process command based on letter
    switch (commandLetter) {
      case 'M': // Move to (absolute)
        // First moveto establishes a new subpath
        if (params.length >= 2) {
          currentX = params[0];
          currentY = params[1];
          initialX = currentX;
          initialY = currentY;
          
          commands.push({
            type: 'M',
            x: currentX,
            y: currentY
          });
          
          // Additional coordinate pairs are treated as lineto commands
          for (let i = 2; i < params.length; i += 2) {
            if (i + 1 < params.length) {
              currentX = params[i];
              currentY = params[i + 1];
              
              commands.push({
                type: 'L',
                x: currentX,
                y: currentY
              });
            }
          }
        }
        break;
        
      case 'T': // Smooth quadratic bezier curve (absolute)
        for (let i = 0; i < params.length; i += 2) {
          if (i + 1 < params.length) {
            // Calculate reflection of previous control point
            let controlX = currentX;
            let controlY = currentY;
            
            if (commands.length > 0 && (commands[commands.length - 1].type === 'Q' || 
                commands[commands.length - 1].type === 'T')) {
              controlX = 2 * currentX - commands[commands.length - 1].x1;
              controlY = 2 * currentY - commands[commands.length - 1].y1;
            }
            
            currentX = params[i];
            currentY = params[i + 1];
            
            if (this.options.approximateCurves) {
              // Approximate the curve with line segments
              const points = this._approximateQuadraticBezier(
                [commands[commands.length - 1].x, commands[commands.length - 1].y],
                [controlX, controlY],
                [currentX, currentY]
              );
              
              // Add line segments for approximation
              points.forEach(point => {
                commands.push({
                  type: 'L',
                  x: point[0],
                  y: point[1]
                });
              });
            } else {
              // Store the curve as a 'Q' command
              commands.push({
                type: 'Q',
                x1: controlX,
                y1: controlY,
                x: currentX,
                y: currentY
              });
            }
          }
        }
        break;
        
      case 't': // Smooth quadratic bezier curve (relative)
        for (let i = 0; i < params.length; i += 2) {
          if (i + 1 < params.length) {
            // Calculate reflection of previous control point
            let controlX = currentX;
            let controlY = currentY;
            
            if (commands.length > 0 && (commands[commands.length - 1].type === 'Q' || 
                commands[commands.length - 1].type === 'T')) {
              controlX = 2 * currentX - commands[commands.length - 1].x1;
              controlY = 2 * currentY - commands[commands.length - 1].y1;
            }
            
            const endX = currentX + params[i];
            const endY = currentY + params[i + 1];
            
            if (this.options.approximateCurves) {
              // Approximate the curve with line segments
              const points = this._approximateQuadraticBezier(
                [commands[commands.length - 1].x, commands[commands.length - 1].y],
                [controlX, controlY],
                [endX, endY]
              );
              
              // Add line segments for approximation
              points.forEach(point => {
                commands.push({
                  type: 'L',
                  x: point[0],
                  y: point[1]
                });
              });
            } else {
              // Store the curve as a 'Q' command
              commands.push({
                type: 'Q',
                x1: controlX,
                y1: controlY,
                x: endX,
                y: endY
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
        }
        break;
        
      case 'A': // Elliptical arc (absolute)
        for (let i = 0; i < params.length; i += 7) {
          if (i + 6 < params.length) {
            const rx = Math.abs(params[i]);
            const ry = Math.abs(params[i + 1]);
            const xAxisRotation = params[i + 2];
            const largeArcFlag = params[i + 3] !== 0;
            const sweepFlag = params[i + 4] !== 0;
            currentX = params[i + 5];
            currentY = params[i + 6];
            
            if (this.options.approximateCurves) {
              // Approximate the arc with line segments
              const points = this._approximateArc(
                [commands[commands.length - 1].x, commands[commands.length - 1].y],
                [currentX, currentY],
                rx, ry, xAxisRotation, largeArcFlag, sweepFlag
              );
              
              // Add line segments for approximation
              points.forEach(point => {
                commands.push({
                  type: 'L',
                  x: point[0],
                  y: point[1]
                });
              });
            } else {
              // Store the arc as an 'A' command
              commands.push({
                type: 'A',
                rx,
                ry,
                xAxisRotation,
                largeArcFlag,
                sweepFlag,
                x: currentX,
                y: currentY
              });
            }
          }
        }
        break;
        
      case 'a': // Elliptical arc (relative)
        for (let i = 0; i < params.length; i += 7) {
          if (i + 6 < params.length) {
            const rx = Math.abs(params[i]);
            const ry = Math.abs(params[i + 1]);
            const xAxisRotation = params[i + 2];
            const largeArcFlag = params[i + 3] !== 0;
            const sweepFlag = params[i + 4] !== 0;
            const endX = currentX + params[i + 5];
            const endY = currentY + params[i + 6];
            
            if (this.options.approximateCurves) {
              // Approximate the arc with line segments
              const points = this._approximateArc(
                [commands[commands.length - 1].x, commands[commands.length - 1].y],
                [endX, endY],
                rx, ry, xAxisRotation, largeArcFlag, sweepFlag
              );
              
              // Add line segments for approximation
              points.forEach(point => {
                commands.push({
                  type: 'L',
                  x: point[0],
                  y: point[1]
                });
              });
            } else {
              // Store the arc as an 'A' command
              commands.push({
                type: 'A',
                rx,
                ry,
                xAxisRotation,
                largeArcFlag,
                sweepFlag,
                x: endX,
                y: endY
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
        }
        break;
        
      case 'Z': // Close path
      case 'z':
        commands.push({
          type: 'Z',
          x: initialX,
          y: initialY
        });
        currentX = initialX;
        currentY = initialY;
        break;
    }
  }
  
  return commands;
}

/**
 * Extract line segments from path commands
 * @param {Array} commands - Array of path commands
 * @returns {Array} - Array of line segments
 * @private
 */
_extractSegments(commands) {
  const segments = [];
  let lastPoint = null;
  
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    
    if (cmd.type === 'M') {
      // Move command starts a new subpath
      lastPoint = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === 'L') {
      // Line command creates a line segment
      if (lastPoint) {
        segments.push({
          type: 'line',
          x1: lastPoint.x,
          y1: lastPoint.y,
          x2: cmd.x,
          y2: cmd.y
        });
        
        lastPoint = { x: cmd.x, y: cmd.y };
      }
    } else if (cmd.type === 'C') {
      // Cubic bezier curve segment
      if (lastPoint) {
        segments.push({
          type: 'cubic',
          x1: lastPoint.x,
          y1: lastPoint.y,
          cx1: cmd.x1,
          cy1: cmd.y1,
          cx2: cmd.x2,
          cy2: cmd.y2,
          x2: cmd.x,
          y2: cmd.y
        });
        
        lastPoint = { x: cmd.x, y: cmd.y };
      }
    } else if (cmd.type === 'Q') {
      // Quadratic bezier curve segment
      if (lastPoint) {
        segments.push({
          type: 'quadratic',
          x1: lastPoint.x,
          y1: lastPoint.y,
          cx: cmd.x1,
          cy: cmd.y1,
          x2: cmd.x,
          y2: cmd.y
        });
        
        lastPoint = { x: cmd.x, y: cmd.y };
      }
    } else if (cmd.type === 'A') {
      // Arc segment
      if (lastPoint) {
        segments.push({
          type: 'arc',
          x1: lastPoint.x,
          y1: lastPoint.y,
          rx: cmd.rx,
          ry: cmd.ry,
          xAxisRotation: cmd.xAxisRotation,
          largeArcFlag: cmd.largeArcFlag,
          sweepFlag: cmd.sweepFlag,
          x2: cmd.x,
          y2: cmd.y
        });
        
        lastPoint = { x: cmd.x, y: cmd.y };
      }
    } else if (cmd.type === 'Z') {
      // Close path - connect to the first point of the subpath
      // Find the most recent 'M' command
      let startPoint = null;
      for (let j = i - 1; j >= 0; j--) {
        if (commands[j].type === 'M') {
          startPoint = { x: commands[j].x, y: commands[j].y };
          break;
        }
      }
      
      if (startPoint && lastPoint) {
        segments.push({
          type: 'line',
          x1: lastPoint.x,
          y1: lastPoint.y,
          x2: startPoint.x,
          y2: startPoint.y,
          isClosingSegment: true
        });
        
        lastPoint = { x: startPoint.x, y: startPoint.y };
      }
    }
  }
  
  return segments;
}

/**
 * Apply transformations to path segments
 * @param {Array} segments - Array of path segments
 * @param {Array} transforms - Array of transformation objects
 * @returns {Array} - Transformed segments
 * @private
 */
_applyTransforms(segments, transforms) {
  // This is a simplified transformation handler
  if (!transforms || transforms.length === 0) {
    // No transformations to apply
    return segments;
  }
  
  // In a complete implementation, we would:
  // 1. Convert each transform to a matrix
  // 2. Multiply matrices to get final transformation
  // 3. Apply to all points in the segments
  
  // For now, return segments unchanged
  return segments;
}

/**
 * Check if a path is closed
 * @param {Array} segments - Array of path segments
 * @returns {boolean} - Whether the path is closed
 * @private
 */
_isPathClosed(segments) {
  if (segments.length === 0) {
    return false;
  }
  
  // Look for explicit closing segment
  for (const segment of segments) {
    if (segment.isClosingSegment) {
      return true;
    }
  }
  
  // Check if first and last points are close enough
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  
  const startPoint = { x: firstSegment.x1, y: firstSegment.y1 };
  const endPoint = { x: lastSegment.x2, y: lastSegment.y2 };
  
  // Calculate distance between start and end points
  const distance = Math.sqrt(
    Math.pow(endPoint.x - startPoint.x, 2) + 
    Math.pow(endPoint.y - startPoint.y, 2)
  );
  
  // Check if distance is within tolerance
  return distance <= this.options.closePathTolerance;
}

/**
 * Auto-close a path if needed
 * @param {Array} segments - Array of path segments
 * @param {boolean} isClosed - Whether the path is already closed
 * @returns {Array} - Segments with closing segment if needed
 * @private
 */
_autoClosePath(segments, isClosed) {
  if (!segments.length || isClosed || !this.options.autoClosePaths) {
    return segments;
  }
  
  // Get first and last points
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  
  const startPoint = { x: firstSegment.x1, y: firstSegment.y1 };
  const endPoint = { x: lastSegment.x2, y: lastSegment.y2 };
  
  // Calculate distance
  const distance = Math.sqrt(
    Math.pow(endPoint.x - startPoint.x, 2) + 
    Math.pow(endPoint.y - startPoint.y, 2)
  );
  
  // If distance is within auto-close tolerance, add a closing segment
  if (distance <= this.options.closePathTolerance) {
    segments.push({
      type: 'line',
      x1: endPoint.x,
      y1: endPoint.y,
      x2: startPoint.x,
      y2: startPoint.y,
      isClosingSegment: true
    });
    
    return segments;
  }
  
  return segments;
}

/**
 * Process style information
 * @param {Object} style - SVG style object
 * @returns {Object} - Processed style information
 * @private
 */
_processStyle(style) {
  const processedStyle = {
    stroke: style.stroke || 'none',
    strokeWidth: parseFloat(style['stroke-width']) || this.options.defaultStrokeWidth,
    strokeOpacity: parseFloat(style['stroke-opacity'] || 1),
    fill: style.fill || 'none',
    fillOpacity: parseFloat(style['fill-opacity'] || 1),
    isConstruction: false
  };
  
  // Check for dashed line indicating construction line
  if (this.options.processDashedLines && style['stroke-dasharray'] && 
      style['stroke-dasharray'] !== 'none') {
    processedStyle.isConstruction = true;
  }
  
  return processedStyle;
}

/**
 * Parse tags from element name
 * @param {string} name - Element name
 * @returns {Object} - Parsed name information
 * @private
 */
_parseNameTags(name) {
  if (!name || !this.options.parseNameTags) {
    return { name, specialProcessing: {} };
  }
  
  const nameInfo = {
    name: name,
    isConstruction: false,
    closed: false,
    specialProcessing: {}
  };
  
  // Check for special tags
  if (name.includes('#')) {
    const parts = name.split('#');
    nameInfo.name = parts[0].trim();
    
    // Process each tag
    for (let i = 1; i < parts.length; i++) {
      const tag = parts[i].trim().toLowerCase();
      
      if (tag === 'const' || tag === 'construction') {
        nameInfo.isConstruction = true;
      } else if (tag === 'closed') {
        nameInfo.closed = true;
      } else if (tag.startsWith('extrude=')) {
        // Parse extrusion depth
        const depthStr = tag.substring(8);
        const depth = parseFloat(depthStr);
        
        if (!isNaN(depth)) {
          nameInfo.specialProcessing.extrude = {
            depth,
            units: depthStr.includes('mm') ? 'mm' : 
                   depthStr.includes('in') ? 'in' : 
                   this.options.targetUnits
          };
        }
      } else if (tag.startsWith('revolve=')) {
        // Parse revolution angle
        const angleStr = tag.substring(8);
        const angle = parseFloat(angleStr);
        
        if (!isNaN(angle)) {
          nameInfo.specialProcessing.revolve = {
            angle
          };
        }
      } else if (tag.startsWith('pattern=')) {
        // Parse pattern dimensions (e.g., pattern=5x3)
        const patternStr = tag.substring(8);
        const match = patternStr.match(/(\d+)x(\d+)/);
        
        if (match) {
          nameInfo.specialProcessing.pattern = {
            x: parseInt(match[1], 10),
            y: parseInt(match[2], 10)
          };
        }
      } else if (tag === 'mirror') {
        nameInfo.specialProcessing.mirror = true;
      } else if (tag.startsWith('dim=')) {
        // Parse dimension value
        const dimStr = tag.substring(4);
        const dim = parseFloat(dimStr);
        
        if (!isNaN(dim)) {
          nameInfo.specialProcessing.dimension = dim;
        }
      }
    }
  }
  
  return nameInfo;
}

/**
 * Process other SVG elements as paths
 * @param {Object} svgData - Parsed SVG data
 * @param {Array} processedPaths - Array to add processed paths to
 * @private
 */
_processNonPathElements(svgData, processedPaths) {
  // Process circles
  if (svgData.elements.circles && svgData.elements.circles.length > 0) {
    svgData.elements.circles.forEach((circle, index) => {
      try {
        processedPaths.push(this._processCircle(circle, index));
      } catch (error) {
        log.error(`Error processing circle ${circle.id}: ${error.message}`, error);
      }
    });
  }
  
  // Process ellipses
  if (svgData.elements.ellipses && svgData.elements.ellipses.length > 0) {
    svgData.elements.ellipses.forEach((ellipse, index) => {
      try {
        processedPaths.push(this._processEllipse(ellipse, index));
      } catch (error) {
        log.error(`Error processing ellipse ${ellipse.id}: ${error.message}`, error);
      }
    });
  }
  
  // Process lines
  if (svgData.elements.lines && svgData.elements.lines.length > 0) {
    svgData.elements.lines.forEach((line, index) => {
      try {
        processedPaths.push(this._processLine(line, index));
      } catch (error) {
        log.error(`Error processing line ${line.id}: ${error.message}`, error);
      }
    });
  }
  
  // Process polylines
  if (svgData.elements.polylines && svgData.elements.polylines.length > 0) {
    svgData.elements.polylines.forEach((polyline, index) => {
      try {
        processedPaths.push(this._processPolyline(polyline, index));
      } catch (error) {
        log.error(`Error processing polyline ${polyline.id}: ${error.message}`, error);
      }
    });
  }
  
  // Process polygons
  if (svgData.elements.polygons && svgData.elements.polygons.length > 0) {
    svgData.elements.polygons.forEach((polygon, index) => {
      try {
        processedPaths.push(this._processPolygon(polygon, index));
      } catch (error) {
        log.error(`Error processing polygon ${polygon.id}: ${error.message}`, error);
      }
    });
  }
  
  // Process rectangles
  if (svgData.elements.rects && svgData.elements.rects.length > 0) {
    svgData.elements.rects.forEach((rect, index) => {
      try {
        processedPaths.push(this._processRect(rect, index));
      } catch (error) {
        log.error(`Error processing rect ${rect.id}: ${error.message}`, error);
      }
    });
  }
}
        
      case 'm': // Move to (relative)
        if (params.length >= 2) {
          currentX += params[0];
          currentY += params[1];
          initialX = currentX;
          initialY = currentY;
          
          commands.push({
            type: 'M',
            x: currentX,
            y: currentY
          });
          
          // Additional coordinate pairs are treated as lineto commands
          for (let i = 2; i < params.length; i += 2) {
            if (i + 1 < params.length) {
              currentX += params[i];
              currentY += params[i + 1];
              
              commands.push({
                type: 'L',
                x: currentX,
                y: currentY
              });
            }
          }
        }
        break;
        
      case 'L': // Line to (absolute)
        for (let i = 0; i < params.length; i += 2) {
          if (i + 1 < params.length) {
            currentX = params[i];
            currentY = params[i + 1];
            
            commands.push({
              type: 'L',
              x: currentX,
              y: currentY
            });
          }
        }
        break;
        
      case 'l': // Line to (relative)
        for (let i = 0; i < params.length; i += 2) {
          if (i + 1 < params.length) {
            currentX += params[i];
            currentY += params[i + 1];
            
            commands.push({
              type: 'L',
              x: currentX,
              y: currentY
            });
          }
        }
        break;
        
      case 'H': // Horizontal line to (absolute)
        for (let i = 0; i < params.length; i++) {
          currentX = params[i];
          
          commands.push({
            type: 'L',
            x: currentX,
            y: currentY
          });
        }
        break;
        
      case 'h': // Horizontal line to (relative)
        for (let i = 0; i < params.length; i++) {
          currentX += params[i];
          
          commands.push({
            type: 'L',
            x: currentX,
            y: currentY
          });
        }
        break;
        
      case 'V': // Vertical line to (absolute)
        for (let i = 0; i < params.length; i++) {
          currentY = params[i];
          
          commands.push({
            type: 'L',
            x: currentX,
            y: currentY
          });
        }
        break;
        
      case 'v': // Vertical line to (relative)
        for (let i = 0; i < params.length; i++) {
          currentY += params[i];
          
          commands.push({
            type: 'L',
            x: currentX,
            y: currentY
          });
        }
        break;
        
      case 'C': // Cubic bezier curve (absolute)
        for (let i = 0; i < params.length; i += 6) {
          if (i + 5 < params.length) {
            const control1X = params[i];
            const control1Y = params[i + 1];
            const control2X = params[i + 2];
            const control2Y = params[i + 3];
            currentX = params[i + 4];
            currentY = params[i + 5];
            
            if (this.options.approximateCurves) {
              // Approximate the curve with line segments
              const points = this._approximateCubicBezier(
                [commands[commands.length - 1].x, commands[commands.length - 1].y],
                [control1X, control1Y],
                [control2X, control2Y],
                [currentX, currentY]
              );
              
              // Add line segments for approximation
              points.forEach(point => {
                commands.push({
                  type: 'L',
                  x: point[0],
                  y: point[1]
                });
              });
            } else {
              // Store the curve as a 'C' command
              commands.push({
                type: 'C',
                x1: control1X,
                y1: control1Y,
                x2: control2X,
                y2: control2Y,
                x: endX,
                y: endY
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
        }
        break;
        
      case 'S': // Smooth cubic bezier curve (absolute)
        for (let i = 0; i < params.length; i += 4) {
          if (i + 3 < params.length) {
            // Calculate reflection of previous control point
            let control1X = currentX;
            let control1Y = currentY;
            
            if (commands.length > 0 && (commands[commands.length - 1].type === 'C' || 
                commands[commands.length - 1].type === 'S')) {
              control1X = 2 * currentX - commands[commands.length - 1].x2;
              control1Y = 2 * currentY - commands[commands.length - 1].y2;
            }
            
            const control2X = params[i];
            const control2Y = params[i + 1];
            currentX = params[i + 2];
            currentY = params[i + 3];
            
            if (this.options.approximateCurves) {
              // Approximate the curve with line segments
              const points = this._approximateCubicBezier(
                [commands[commands.length - 1].x, commands[commands.length - 1].y],
                [control1X, control1Y],
                [control2X, control2Y],
                [currentX, currentY]
              );
              
              // Add line segments for approximation
              points.forEach(point => {
                commands.push({
                  type: 'L',
                  x: point[0],
                  y: point[1]
                });
              });
            } else {
              // Store the curve as a 'C' command
              commands.push({
                type: 'C',
                x1: control1X,
                y1: control1Y,
                x2: control2X,
                y2: control2Y,
                x: currentX,
                y: currentY
              });
            }
          }
        }
        break;
        
      case 's': // Smooth cubic bezier curve (relative)
        for (let i = 0; i < params.length; i += 4) {
          if (i + 3 < params.length) {
            // Calculate reflection of previous control point
            let control1X = currentX;
            let control1Y = currentY;
            
            if (commands.length > 0 && (commands[commands.length - 1].type === 'C' || 
                commands[commands.length - 1].type === 'S')) {
              control1X = 2 * currentX - commands[commands.length - 1].x2;
              control1Y = 2 * currentY - commands[commands.length - 1].y2;
            }
            
            const control2X = currentX + params[i];
            const control2Y = currentY + params[i + 1];
            const endX = currentX + params[i + 2];
            const endY = currentY + params[i + 3];
            
            if (this.options.approximateCurves) {
              // Approximate the curve with line segments
              const points = this._approximateCubicBezier(
                [commands[commands.length - 1].x, commands[commands.length - 1].y],
                [control1X, control1Y],
                [control2X, control2Y],
                [endX, endY]
              );
              
              // Add line segments for approximation
              points.forEach(point => {
                commands.push({
                  type: 'L',
                  x: point[0],
                  y: point[1]
                });
              });
            } else {
              // Store the curve as a 'C' command
              commands.push({
                type: 'C',
                x1: control1X,
                y1: control1Y,
                x2: control2X,
                y2: control2Y,
                x: endX,
                y: endY
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
        }
        break;
        
      case 'Q': // Quadratic bezier curve (absolute)
        for (let i = 0; i < params.length; i += 4) {
          if (i + 3 < params.length) {
            const controlX = params[i];
            const controlY = params[i + 1];
            currentX = params[i + 2];
            currentY = params[i + 3];
            
            if (this.options.approximateCurves) {
              // Approximate the curve with line segments
              const points = this._approximateQuadraticBezier(
                [commands[commands.length - 1].x, commands[commands.length - 1].y],
                [controlX, controlY],
                [currentX, currentY]
              );
              
              // Add line segments for approximation
              points.forEach(point => {
                commands.push({
                  type: 'L',
                  x: point[0],
                  y: point[1]
                });
              });
            } else {
              // Store the curve as a 'Q' command
              commands.push({
                type: 'Q',
                x1: controlX,
                y1: controlY,
                x: currentX,
                y: currentY
              });
            }
          }
        }
        break;
        
      case 'q': // Quadratic bezier curve (relative)
        for (let i = 0; i < params.length; i += 4) {
          if (i + 3 < params.length) {
            const controlX = currentX + params[i];
            const controlY = currentY + params[i + 1];
            const endX = currentX + params[i + 2];
            const endY = currentY + params[i + 3];
            
            if (this.options.approximateCurves) {
              // Approximate the curve with line segments
              const points = this._approximateQuadraticBezier(
                [commands[commands.length - 1].x, commands[commands.length - 1].y],
                [controlX, controlY],
                [endX, endY]
              );
              
              // Add line segments for approximation
              points.forEach(point => {
                commands.push({
                  type: 'L',
                  x: point[0],
                  y: point[1]
                });
              });
            } else {
              // Store the curve as a 'Q' command
              commands.push({
                type: 'Q',
                x1: controlX,
                y1: controlY,
                x: endX,
                y: endY
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
        }
        break;
                x2: control2X,
                y2: control2Y,
                x: currentX,
                y: currentY
              });
            }
          }
        }
        break;
        
      case 'c': // Cubic bezier curve (relative)
        for (let i = 0; i < params.length; i += 6) {
          if (i + 5 < params.length) {
            const control1X = currentX + params[i];
            const control1Y = currentY + params[i + 1];
            const control2X = currentX + params[i + 2];
            const control2Y = currentY + params[i + 3];
            const endX = currentX + params[i + 4];
            const endY = currentY + params[i + 5];
            
            if (this.options.approximateCurves) {
              // Approximate the curve with line segments
              const points = this._approximateCubicBezier(
                [commands[commands.length - 1].x, commands[commands.length - 1].y],
                [control1X, control1Y],
                [control2X, control2Y],
                [endX, endY]
              );
              
              // Add line segments for approximation
              points.forEach(point => {
                commands.push({
                  type: 'L',
                  x: point[0],
                  y: point[1]
                });
              });
            } else {
              // Store the curve as a 'C' command
              commands.push({
                type: 'C',
                x1: control1X,
                y1: control1Y,