/**
 * Logger utility for consistent logging across the application
 */
class Logger {
  constructor(options = {}) {
    this.silent = options.silent || false;
    this.logLevel = options.logLevel || 'info';
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }
  
  shouldLog(level) {
    return !this.silent && this.levels[level] <= this.levels[this.logLevel];
  }
  
  info(message, ...args) {
    if (this.shouldLog('info')) {
      console.log(message, ...args);
    }
  }
  
  error(message, error) {
    if (this.shouldLog('error')) {
      console.error(message, error);
    }
  }
  
  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      console.warn(message, ...args);
    }
  }
  
  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      console.debug(message, ...args);
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
module.exports = new Logger();// src\utils\logger.js
