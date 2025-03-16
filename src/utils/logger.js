// src/utils/logger.js
const fs = require('fs');
const path = require('path');

/**
 * Custom logger that provides scoped logging capabilities
 */
class Logger {
  constructor(options = {}) {
    this.buffer = [];
    this.logLevel = options.logLevel || process.env.LOG_LEVEL || 'info';
    this.logToFile = options.logToFile || process.env.LOG_TO_FILE === 'true';
    this.logDir = options.logDir || 'logs';
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    // Configure filters for different log types
    this.filters = options.filters || {
      server: {
        enabled: process.env.LOG_SERVER !== 'false', // Default to true unless explicitly disabled
        levels: ['info', 'warn', 'error'], // By default, filter out debug but keep others
      },
      auth: {
        enabled: true,
        levels: ['debug', 'info', 'warn', 'error'],
      },
      api: {
        enabled: true,
        levels: ['debug', 'info', 'warn', 'error'],
      },
      // Add more scopes as needed
    };
    
    // Ensure log directory exists if logging to file
    if (this.logToFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Use buffered logs in test environment
    this.useBufferedLogs = process.env.NODE_ENV === 'test';
  }

  /**
   * Check if the message should be logged based on filters and log level
   */
  shouldLog(level, message = '') {
    // First check the log level
    if (this.logLevels[level] < this.logLevels[this.logLevel]) {
      return false;
    }
    
    // Check scope-based filters
    if (message.includes('[Server]')) {
      // Apply server filter
      const serverFilter = this.filters.server;
      if (!serverFilter.enabled || !serverFilter.levels.includes(level)) {
        return false;
      }
      
      // Special case for GET requests
      if (level === 'debug' && message.includes('GET')) {
        return this.filters.server.showGetRequests !== true;
      }
    } 
    else if (message.includes('[Auth]') || message.includes('[AUTH]')) {
      // Apply auth filter
      const authFilter = this.filters.auth;
      if (!authFilter.enabled || !authFilter.levels.includes(level)) {
        return false;
      }
    }
    else if (message.includes('[API]')) {
      // Apply API filter
      const apiFilter = this.filters.api;
      if (!apiFilter.enabled || !apiFilter.levels.includes(level)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Set filter configuration for a specific scope
   * @param {string} scope - The scope to configure (server, auth, api, etc.)
   * @param {object} config - Filter configuration { enabled: boolean, levels: string[] }
   */
  setFilter(scope, config) {
    if (!this.filters[scope]) {
      this.filters[scope] = {
        enabled: true,
        levels: ['debug', 'info', 'warn', 'error'],
      };
    }
    
    if (config.enabled !== undefined) {
      this.filters[scope].enabled = !!config.enabled;
    }
    
    if (config.levels) {
      this.filters[scope].levels = config.levels;
    }
    
    if (scope === 'server' && config.showGetRequests !== undefined) {
      this.filters.server.showGetRequests = !!config.showGetRequests;
    }
    
    return this.filters[scope];
  }
  
  /**
   * Get the current filter configuration
   * @param {string} scope - Optional scope to get filters for
   * @returns {object} - The current filters
   */
  getFilters(scope) {
    if (scope) {
      return this.filters[scope];
    }
    return this.filters;
  }

  /**
   * Log an info message
   */
  info(message, ...args) {
    if (this.shouldLog('info', message)) {
      if (this.useBufferedLogs) {
        this.buffer.push({ level: 'info', message, args, timestamp: new Date() });
      } else {
        console.log(`[INFO] ${message}`, ...args);
      }
      
      if (this.logToFile) {
        this._writeToFile('info.log', `INFO: ${message}`);
      }
    }
  }

  /**
   * Log a debug message
   */
  debug(message, ...args) {
    if (this.shouldLog('debug', message)) {
      if (this.useBufferedLogs) {
        this.buffer.push({ level: 'debug', message, args, timestamp: new Date() });
      } else {
        console.debug(`[DEBUG] ${message}`, ...args);
      }
      
      if (this.logToFile) {
        this._writeToFile('debug.log', `DEBUG: ${message}`);
      }
    }
  }

  /**
   * Log an error message
   */
  error(message, error) {
    if (this.shouldLog('error', message)) {
      if (this.useBufferedLogs) {
        this.buffer.push({ 
          level: 'error', 
          message, 
          error: error ? (error.stack || error.toString()) : undefined, 
          timestamp: new Date() 
        });
      } else {
        console.error(`[ERROR] ${message}`, error);
      }
      
      if (this.logToFile) {
        this._writeToFile('error.log', `ERROR: ${message} ${error ? error.stack || error.toString() : ''}`);
      }
    }
  }

  /**
   * Log a warning message
   */
  warn(message, ...args) {
    if (this.shouldLog('warn', message)) {
      if (this.useBufferedLogs) {
        this.buffer.push({ level: 'warn', message, args, timestamp: new Date() });
      } else {
        console.warn(`[WARN] ${message}`, ...args);
      }
      
      if (this.logToFile) {
        this._writeToFile('warn.log', `WARN: ${message}`);
      }
    }
  }

  /**
   * Log an authentication message (orange color)
   */
  auth(message, ...args) {
    if (this.shouldLog('info', message)) {  // Using info level for auth messages
      if (this.useBufferedLogs) {
        this.buffer.push({ level: 'auth', message, args, timestamp: new Date() });
      } else {
        console.log(`%c[AUTH] ${message}`, 'color: #FF8C00', ...args);  // Orange color in console
      }
      
      if (this.logToFile) {
        this._writeToFile('auth.log', `AUTH: ${message}`);
      }
    }
  }

  /**
   * Write to log file
   * @private
   */
  _writeToFile(filename, content) {
    try {
      fs.appendFileSync(
        path.join(this.logDir, filename),
        `${new Date().toISOString()} - ${content}\n`
      );
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }

  /**
   * Create a scoped logger that prefixes all messages with a scope name
   */
  scope(scopeName) {
    const scopedLogger = {};
    
    // Create scoped versions of all logger methods
    ['debug', 'info', 'warn', 'error', 'auth'].forEach(method => {
      scopedLogger[method] = (...args) => {
        if (args[0] && typeof args[0] === 'string') {
          return this[method](`[${scopeName}] ${args[0]}`, ...args.slice(1));
        } else {
          return this[method](`[${scopeName}]`, ...args);
        }
      };
    });
    
    return scopedLogger;
  }

  /**
   * Flush buffered logs
   */
  flush(options = {}) {
    if (!this.buffer.length) return;
    
    const { toConsole = true, toFile = false, filename = 'buffered-logs.log' } = options;
    
    if (toConsole) {
      this.buffer.forEach(log => {
        switch (log.level) {
          case 'debug':
            console.debug(`[DEBUG] ${log.message}`, ...(log.args || []));
            break;
          case 'info':
            console.log(`[INFO] ${log.message}`, ...(log.args || []));
            break;
          case 'warn':
            console.warn(`[WARN] ${log.message}`, ...(log.args || []));
            break;
          case 'error':
            console.error(`[ERROR] ${log.message}`, log.error);
            break;
        }
      });
    }
    
    if (toFile) {
      const logContent = this.buffer.map(log => 
        `${log.timestamp.toISOString()} [${log.level.toUpperCase()}] ${log.message}`
      ).join('\n');
      
      this._writeToFile(filename, logContent);
    }
    
    // Clear the buffer after flushing
    this.buffer = [];
  }
}

// Export a singleton instance
const logger = new Logger();

// Example of setting filters
// Uncomment these to change default filtering behavior
// logger.setFilter('server', { enabled: true, levels: ['info', 'warn', 'error'], showGetRequests: false });
// logger.setFilter('auth', { enabled: true, levels: ['debug', 'info', 'warn', 'error'] });

module.exports = logger;