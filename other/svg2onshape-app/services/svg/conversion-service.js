import fetch from 'node-fetch';
import { parse } from 'svg-parser';
import { onshapeApiUrl } from '../../config.js';
import { parseString } from 'xml2js';
import path from 'path';
import { debugLog } from '../../utils/debug.js';

/**
 * Service for converting SVG files to Onshape sketches
 */
class ConversionService {
    /**
     * Create a ConversionService instance
     * @param {Object} onshapeApiService - Onshape API service instance for API calls
     */
    constructor(onshapeApiService) {
        if (!onshapeApiService) {
            throw new Error('Onshape API service is required for ConversionService');
        }
        this.onshapeApi = onshapeApiService;
        // Note: No 'logger' property is defined; we'll use debugLog throughout.
    }

    /**
     * Converts SVG data to sketch entities for Onshape
     * @param {string} svgData Raw SVG content
     * @returns {Promise<Array>} Array of sketch entities
     */
    async convertSVGtoSketchEntities(svgData) {
        try {
            // Enhanced validation for SVG data
            if (!svgData || typeof svgData !== 'string') {
                throw new Error('Invalid SVG data: data is missing or not a string');
            }
            
            if (!svgData.includes('<svg')) {
                throw new Error('Invalid SVG data: missing <svg> tag');
            }
            
            // Log SVG data for debugging (truncated to avoid massive logs)
            debugLog('conversionService', 'Processing SVG data', {
                length: svgData.length,
                snippet: svgData.substring(0, 100) + '...',
                containsSVGTag: svgData.includes('<svg'),
                containsPathTag: svgData.includes('<path'),
                containsValidXML: svgData.trim().startsWith('<?xml') || svgData.trim().startsWith('<svg')
            });
            
            let parsedSVG;
            try {
                // Use the parse function from svg-parser with defensive approach
                parsedSVG = parse(svgData);
            } catch (parseError) {
                // More specific error for parsing failures
                debugLog('error', 'SVG parser error', {
                    error: parseError.message,
                    stack: parseError.stack
                });
                throw new Error(`SVG parser error: ${parseError.message}`);
            }
            
            // More detailed validation for parsed SVG structure
            if (!parsedSVG) {
                throw new Error('SVG parsing resulted in null or undefined');
            }
            
            if (!parsedSVG.children || !Array.isArray(parsedSVG.children)) {
                debugLog('error', 'Invalid SVG structure', {
                    parsedSVG: JSON.stringify(parsedSVG).substring(0, 200)
                });
                throw new Error('Invalid SVG structure: missing or invalid children array');
            }
            
            debugLog('conversionService', 'Successfully parsed SVG data', {
                childrenCount: parsedSVG.children.length,
                type: parsedSVG.type,
                tagName: parsedSVG.tagName
            });
            
            return this.processNodes(parsedSVG.children);
        } catch (error) {
            debugLog('error', 'SVG parsing error:', {
                error: error.message,
                stack: error.stack
            });
            throw new Error(`Failed to parse SVG data: ${error.message}`);
        }
    }

    /**
     * Create a sketch from SVG content
     * @param {Object} params - Request parameters
     * @param {string} params.documentId - Document ID
     * @param {string} params.workspaceId - Workspace ID
     * @param {string} params.elementId - Element (Part Studio) ID
     * @param {string} params.planeId - Target plane ID
     * @param {string} params.svgContent - SVG content as string
     * @param {Object} [params.options] - Optional parameters for sketch creation
     * @returns {Promise<Object>} - Result of sketch creation
     */
    async createSketch(params) {
        debugLog('conversionService', 'Creating sketch from SVG content', {
            documentId: params.documentId,
            workspaceId: params.workspaceId,
            elementId: params.elementId,
            planeId: params.planeId
        });

        try {
            // Defensive validation of required parameters
            if (!params.documentId || !params.workspaceId || !params.elementId || !params.planeId) {
                throw new Error('Missing required parameters for sketch creation');
            }

            if (!params.svgContent) {
                throw new Error('SVG content is required');
            }

            // Optimize SVG if possible
            let svgContent = params.svgContent;
            if (typeof this.optimizeSvg === 'function') {
                try {
                    svgContent = await this.optimizeSvg(svgContent);
                    debugLog('conversionService', 'SVG optimized successfully', {
                        originalSize: params.svgContent.length,
                        optimizedSize: svgContent.length
                    });
                } catch (optimizeError) {
                    debugLog('warn', 'SVG optimization failed, using original', {
                        error: optimizeError.message
                    });
                    // Continue with original SVG if optimization fails
                }
            }

            // Call Onshape API to create sketch
            const result = await this.onshapeApi.createSketchFromSvg({
                documentId: params.documentId,
                workspaceId: params.workspaceId,
                elementId: params.elementId,
                planeId: params.planeId,
                svgContent: svgContent,
                options: {
                    sketchName: params.options?.sketchName || `SVG Import ${new Date().toLocaleTimeString()}`,
                    scale: params.options?.scale || 1.0,
                    units: params.options?.units || 'millimeter'
                }
            });

            debugLog('conversionService', 'Sketch created successfully', { 
                sketchId: result.id,
                elementUrl: result.href 
            });

            return {
                success: true,
                sketchId: result.id,
                elementUrl: result.href,
                message: 'Sketch created successfully'
            };
        } catch (error) {
            debugLog('error', 'Failed to create sketch', {
                error: error.message,
                stack: error.stack
            });

            throw new Error(`Failed to create sketch: ${error.message}`);
        }
    }

    /**
     * Convert an SVG file to a sketch in Onshape
     * 
     * @param {Object} file - The uploaded file object
     * @param {string} accessToken - Onshape OAuth token
     * @param {Object} params - Parameters for conversion
     * @param {string} params.documentId - Onshape document ID
     * @param {string} params.workspaceId - Onshape workspace ID
     * @param {string} params.elementId - Onshape element ID
     * @param {string} params.planeId - Target plane ID
     * @returns {Promise<Object>} Conversion result
     */
    async convertSvgToSketch(file, accessToken, params) {
        debugLog('conversionService', 'Starting SVG conversion', { 
            fileName: file?.name || file?.originalname,
            fileType: file?.mimetype,
            fileSize: file?.size,
            hasData: !!file?.data,
            hasSvgContent: !!file?.svgContent,
            dataLength: file?.data?.length,
            svgContentLength: file?.svgContent?.length,
            tempFilePath: file?.tempFilePath || 'none'
        });

        if (!file) {
            throw new Error('No file provided');
        }

        try {
            // Get SVG data from file - prioritize pre-extracted content
            let svgData = null;
            
            if (file.svgContent) {
                svgData = file.svgContent;
                debugLog('conversionService', 'Using pre-extracted SVG content', {
                    length: svgData.length,
                    hasSvgTag: svgData.includes('<svg')
                });
            } else if (file.tempFilePath) {
                // Fallback to reading from temp file if available
                const fs = require('fs'); // This is safe here if running in CommonJS context on the server
                svgData = fs.readFileSync(file.tempFilePath, 'utf8');
                debugLog('conversionService', 'Read SVG from temp file', {
                    path: file.tempFilePath,
                    length: svgData.length
                });
            } else if (file.data) {
                svgData = file.data.toString('utf8');
                debugLog('conversionService', 'Extracted SVG data from buffer', {
                    length: svgData.length
                });
            } else if (file.buffer) {
                svgData = file.buffer.toString('utf8');
                debugLog('conversionService', 'Extracted SVG data from file.buffer', {
                    length: svgData.length
                });
            }
            
            // Validate SVG data
            if (!svgData) {
                throw new Error('Empty SVG data');
            }
            
            if (typeof svgData !== 'string') {
                debugLog('conversionService', 'Invalid SVG data type', {
                    type: typeof svgData
                });
                throw new Error('Invalid SVG data type');
            }
            
            if (svgData.length === 0) {
                throw new Error('SVG data is empty');
            }
            
            if (!svgData.includes('<svg')) {
                debugLog('error', 'Invalid SVG format', {
                    preview: svgData.substring(0, 200)
                });
                throw new Error('Invalid SVG file format: missing <svg> tag');
            }
            
            debugLog('conversionService', 'SVG data validated successfully', {
                length: svgData.length,
                hasSvgTag: svgData.includes('<svg'),
                hasPathTag: svgData.includes('<path')
            });
            
            // Convert SVG data to sketch entities
            const sketchEntities = await this.convertSVGtoSketchEntities(svgData);
            debugLog('conversionService', 'Generated sketch entities', {
                count: sketchEntities?.length || 0
            });
            
            // Create sketch in Onshape using the conversion service's createSketch method
            const result = await this.createSketch({
                ...params,
                svgContent: svgData,
                accessToken
            });
            
            return result;
        } catch (error) {
            debugLog('error', 'conversionService', {
                error: error.message,
                stack: error.stack
            });
            throw new Error(`Failed to convert SVG to sketch: ${error.message}`);
        }
    }

    /**
     * Parse SVG data into structured object
     * @private
     * @param {Buffer|string} svgData - SVG data
     * @returns {Promise<Object>} - Parsed SVG structure
     */
    async _parseSvg(svgData) {
        return new Promise((resolve, reject) => {
            try {
                // Convert Buffer to string if necessary
                const svgString = svgData instanceof Buffer 
                    ? svgData.toString('utf8') 
                    : svgData;
                
                // Validate the SVG content
                if (!svgString || !svgString.includes('<svg')) {
                    return reject(new Error('Invalid SVG content'));
                }
                
                parseString(svgString, (err, result) => {
                    if (err) {
                        return reject(new Error(`Failed to parse SVG: ${err.message}`));
                    }
                    resolve(result);
                });
            } catch (error) {
                reject(new Error(`SVG parsing error: ${error.message}`));
            }
        });
    }

    /**
     * Convert parsed SVG to Onshape sketch format
     * @private
     * @param {Object} parsedSvg - Parsed SVG structure
     * @param {string} planeId - Target sketch plane ID
     * @returns {Object} - Sketch data in Onshape format
     */
    _convertToSketchFormat(parsedSvg, planeId) {
        try {
            // Simplified placeholder conversion logic
            const svg = parsedSvg?.svg;
            if (!svg) {
                throw new Error('Invalid SVG structure');
            }
            const width = parseFloat(svg.$.width || 100);
            const height = parseFloat(svg.$.height || 100);
            return {
                name: 'SVG Import',
                planeId: planeId,
                units: 'millimeter',
                viewScale: 1.0,
                bounds: {
                    width,
                    height
                },
                entities: []  // Real implementation would populate this from SVG paths
            };
        } catch (error) {
            console.error('Error converting SVG to sketch format:', error);
            return {
                name: 'SVG Import (Error)',
                planeId: planeId,
                entities: []
            };
        }
    }

    /**
     * Processes SVG nodes recursively to generate sketch entities
     * @private
     * @param {Array} nodes SVG nodes to process
     * @returns {Array} Sketch entities
     */
    processNodes(nodes) {
        const entities = [];
        for (const node of nodes) {
            switch (node.tagName) {
                case 'path':
                    entities.push(...this.convertPath(node));
                    break;
                case 'circle':
                    entities.push(this.convertCircle(node));
                    break;
                case 'rect':
                    entities.push(...this.convertRect(node));
                    break;
                case 'line':
                    entities.push(this.convertLine(node));
                    break;
            }
            if (node.children) {
                entities.push(...this.processNodes(node.children));
            }
        }
        return entities;
    }

    /**
     * Convert SVG path to sketch entities
     * @private
     * @param {Object} node SVG path node
     * @returns {Array} Array of sketch entities
     */
    convertPath(node) {
        const entities = [];
        try {
            // Extract path data
            const pathData = node.properties?.d;
            if (!pathData) return entities;

            // Convert path commands to sketch entities
            const commands = this._parsePathCommands(pathData);
            for (const cmd of commands) {
                switch (cmd.type) {
                    case 'M': // Move
                        entities.push({
                            type: 'point',
                            x: cmd.x,
                            y: cmd.y
                        });
                        break;
                    case 'L': // Line
                        entities.push({
                            type: 'line',
                            startPoint: cmd.start,
                            endPoint: { x: cmd.x, y: cmd.y }
                        });
                        break;
                    case 'C': // Cubic Bezier
                        entities.push({
                            type: 'spline',
                            points: [
                                cmd.start,
                                { x: cmd.x1, y: cmd.y1 },
                                { x: cmd.x2, y: cmd.y2 },
                                { x: cmd.x, y: cmd.y }
                            ]
                        });
                        break;
                }
            }
        } catch (error) {
            debugLog('error', 'Error converting path:', error);
        }
        return entities;
    }

    /**
     * Convert SVG circle to sketch entity
     * @private
     * @param {Object} node SVG circle node
     * @returns {Object} Circle sketch entity
     */
    convertCircle(node) {
        try {
            const cx = parseFloat(node.properties?.cx || 0);
            const cy = parseFloat(node.properties?.cy || 0);
            const r = parseFloat(node.properties?.r || 0);

            return {
                type: 'circle',
                center: { x: cx, y: cy },
                radius: r
            };
        } catch (error) {
            debugLog('error', 'Error converting circle:', error);
            return null;
        }
    }

    /**
     * Convert SVG rectangle to sketch entities
     * @private
     * @param {Object} node SVG rect node
     * @returns {Array} Array of line entities forming rectangle
     */
    convertRect(node) {
        const entities = [];
        try {
            const x = parseFloat(node.properties?.x || 0);
            const y = parseFloat(node.properties?.y || 0);
            const width = parseFloat(node.properties?.width || 0);
            const height = parseFloat(node.properties?.height || 0);

            // Create four lines for rectangle
            const points = [
                { x, y },
                { x: x + width, y },
                { x: x + width, y: y + height },
                { x, y: y + height }
            ];

            // Create line entities
            for (let i = 0; i < points.length; i++) {
                const start = points[i];
                const end = points[(i + 1) % points.length];
                entities.push({
                    type: 'line',
                    startPoint: start,
                    endPoint: end
                });
            }
        } catch (error) {
            debugLog('error', 'Error converting rectangle:', error);
        }
        return entities;
    }

    /**
     * Convert SVG line to sketch entity
     * @private
     * @param {Object} node SVG line node
     * @returns {Object} Line sketch entity
     */
    convertLine(node) {
        try {
            const x1 = parseFloat(node.properties?.x1 || 0);
            const y1 = parseFloat(node.properties?.y1 || 0);
            const x2 = parseFloat(node.properties?.x2 || 0);
            const y2 = parseFloat(node.properties?.y2 || 0);

            return {
                type: 'line',
                startPoint: { x: x1, y: y1 },
                endPoint: { x: x2, y: y2 }
            };
        } catch (error) {
            debugLog('error', 'Error converting line:', error);
            return null;
        }
    }

    /**
     * Parse SVG path commands into structured data
     * @private
     * @param {string} pathData SVG path data string
     * @returns {Array} Array of parsed commands
     */
    _parsePathCommands(pathData) {
        debugLog('conversionService', 'Parsing SVG path data', { pathData });
        const commands = [];
        let currentPoint = { x: 0, y: 0 };
        
        // Basic SVG path command regex
        const commandRegex = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g;
        let match;

        while ((match = commandRegex.exec(pathData)) !== null) {
            const [_, command, params] = match;
            const numbers = params.trim().split(/[\s,]+/).map(Number);
            
            switch (command.toUpperCase()) {
                case 'M': // Move to
                    currentPoint = { x: numbers[0], y: numbers[1] };
                    commands.push({
                        type: 'M',
                        x: numbers[0],
                        y: numbers[1]
                    });
                    break;
                    
                case 'L': // Line to
                    commands.push({
                        type: 'L',
                        start: { ...currentPoint },
                        x: numbers[0],
                        y: numbers[1]
                    });
                    currentPoint = { x: numbers[0], y: numbers[1] };
                    break;
                    
                case 'C': // Cubic bezier
                    if (numbers.length >= 6) {
                        commands.push({
                            type: 'C',
                            start: { ...currentPoint },
                            x1: numbers[0],
                            y1: numbers[1],
                            x2: numbers[2],
                            y2: numbers[3],
                            x: numbers[4],
                            y: numbers[5]
                        });
                        currentPoint = { x: numbers[4], y: numbers[5] };
                    }
                    break;
            }
        }
        
        debugLog('conversionService', 'Parsed path commands', { 
            commandCount: commands.length,
            commands 
        });
        
        return commands;
    }
}

// Add a custom error class
export class SVGConversionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SVGConversionError';
    this.code = code;
  }
}

export default ConversionService;
