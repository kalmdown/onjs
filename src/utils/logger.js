// src/utils/logger.js
const fs = require('fs');
const path = require('path');
const env = require('./load-env');

/**
 * Custom logger that provides scoped logging capabilities
 */
class Logger {
  constructor(options = {}) {
    this.buffer = [];
    this.logToFile = options.logToFile || process.env.LOG_TO_FILE === 'true';
    this.logDir = options.logDir || 'logs';
    
    // Define log levels with the same values as in env.LOG_LEVELS
    this.logLevels = {
      off: -1,
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    // Ensure log directory exists if logging to file
    if (this.logToFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Use buffered logs in test environment
    this.useBufferedLogs = process.env.NODE_ENV === 'test';
  }

  /**
   * Check if the message should be logged based on level and scope
   */
  shouldLog(level, message = '') {
    // Extract scope from message if it exists
    const scopeMatch = message.match(/\[(.*?)\]/);
    const scope = scopeMatch ? scopeMatch[1] : 'GLOBAL';
    
    // For debugging log level issues - enable temporarily if needed
    if (process.env.DEBUG_LOGGING === 'true') {
      console.debug(`[Logger] Checking if ${level} should log for scope ${scope} (configured level: ${env.getScopeLogLevel(scope)})`);
    }
    
    // Use the environment utility to check if this level should be logged for this scope
    return env.shouldLogLevel(scope, level);
  }

  /**
   * Set log level for a scope
   * @param {string} scope - The scope to configure
   * @param {string} level - Log level (off, debug, info, warn, error)
   * @returns {boolean} - Success or failure
   */
  setLogLevel(scope, level) {
    if (!this.logLevels.hasOwnProperty(level.toLowerCase())) {
      console.error(`Invalid log level: ${level}. Valid levels are: ${Object.keys(this.logLevels).join(', ')}`);
      return false;
    }
    
    return env.setScopeLogLevel(scope, level.toLowerCase());
  }

  /**
   * Get the current log level for a scope
   * @param {string} scope - The scope to check
   * @returns {string} - The current log level
   */
  getLogLevel(scope) {
    return env.getScopeLogLevel(scope);
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
    const methods = ['error', 'warn', 'info', 'debug'];
    
    methods.forEach(method => {
      scopedLogger[method] = (message, meta = {}) => {
        // Format the message with scope prefix first
        const scopedMessage = message.startsWith(`[${scopeName}]`) 
          ? message 
          : `[${scopeName}] ${message}`;
        
        // Call the original logger method which will do the level checking
        return this[method](scopedMessage, meta instanceof Object ? meta : {});
      };
    });
    
    // Add methods to control logging for this scope
    scopedLogger.setLogLevel = (level) => {
      return this.setLogLevel(scopeName, level);
    };
    
    scopedLogger.getLogLevel = () => {
      return this.getLogLevel(scopeName);
    };
    
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

// Set the initialized logger back in the env module
env.setLogger(logger.scope('Environment'));

// Export the logger functions
module.exports = logger;