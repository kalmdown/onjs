// src\utils\logger.js
/**
 * Logger utility for consistent logging across the application
 */
const fs = require('fs');
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.silent = options.silent || false;
    this.logLevel = options.logLevel || 'info';
    
    // Default to console logging only
    this.logToFile = options.logToFile || false;
    this.logDir = options.logDir || path.join(process.cwd(), 'logs');
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    // Create log directory if needed
    if (this.logToFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }
  
  shouldLog(level) {
    return !this.silent && this.levels[level] <= this.levels[this.logLevel];
  }
  
  info(message, ...args) {
    if (this.shouldLog('info')) {
      console.log(message, ...args);
      
      if (this.logToFile) {
        this._writeToFile('app.log', `INFO: ${message}`);
      }
    }
  }
  
  error(message, error) {
    if (this.shouldLog('error')) {
      console.error(message, error);
      
      if (this.logToFile) {
        this._writeToFile('error.log', `ERROR: ${message} ${error ? error.stack || error.toString() : ''}`);
      }
    }
  }
  
  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      console.warn(message, ...args);
      
      if (this.logToFile) {
        this._writeToFile('app.log', `WARN: ${message}`);
      }
    }
  }
  
  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      console.debug(message, ...args);
      
      if (this.logToFile) {
        this._writeToFile('debug.log', `DEBUG: ${message}`);
      }
    }
  }
  
  _writeToFile(filename, message) {
    const logFile = path.join(this.logDir, filename);
    const timestamp = new Date().toISOString();
    const entry = `${timestamp} - ${message}\n`;
    
    try {
      fs.appendFileSync(logFile, entry);
    } catch (err) {
      console.error(`Failed to write to log file: ${err.message}`);
    }
  }
  
  /**
   * Creates a scoped logger that prefixes messages
   * @param {string} scope - The scope name to prefix logs with
   * @returns {Object} - A scoped logger instance
   */
  scope(scope) {
    const scopedLogger = {};
    
    Object.keys(this.levels).forEach(level => {
      scopedLogger[level] = (message, ...args) => {
        this[level](`[${scope}] ${message}`, ...args);
      };
    });
    
    return scopedLogger;
  }
}

// Export a singleton instance
module.exports = new Logger();