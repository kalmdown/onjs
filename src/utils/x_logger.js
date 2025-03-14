// src\utils\x_logger.js
const fs = require('fs');
const path = require('path');

/**
 * Custom logger that buffers output and can write to file
 * to prevent asynchronous logging errors in tests
 */
class Logger {
  constructor(options = {}) {
    this.buffer = [];
    this.logLevel = options.logLevel || 'info';
    this.logToFile = options.logToFile || false;
    this.logDir = options.logDir || 'logs';
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    // Ensure log directory exists if logging to file
    if (this.logToFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Use buffered or direct logging based on environment
    // Buffer logs in test environment to prevent "Cannot log after tests are done" errors
    this.useBufferedLogs = process.env.NODE_ENV === 'test';
  }

  /**
   * Check if the level should be logged based on the configured log level
   */
  shouldLog(level) {
    return this.logLevels[level] >= this.logLevels[this.logLevel];
  }

  /**
   * Log an info message
   */
  info(message, ...args) {
    if (this.shouldLog('info')) {
      if (this.useBufferedLogs) {
        this.buffer.push({ level: 'info', message, args, timestamp: new Date() });
      } else {
        console.log(message, ...args);
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
    if (this.shouldLog('debug')) {
      if (this.useBufferedLogs) {
        this.buffer.push({ level: 'debug', message, args, timestamp: new Date() });
      } else {
        console.debug(message, ...args);
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
    if (this.shouldLog('error')) {
      if (this.useBufferedLogs) {
        this.buffer.push({ 
          level: 'error', 
          message, 
          error: error ? (error.stack || error.toString()) : undefined, 
          timestamp: new Date() 
        });
      } else {
        console.error(message, error);
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
    if (this.shouldLog('warn')) {
      if (this.useBufferedLogs) {
        this.buffer.push({ level: 'warn', message, args, timestamp: new Date() });
      } else {
        console.warn(message, ...args);
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
      // Create logs directory if it doesn't exist
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      
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
    ['debug', 'info', 'warn', 'error'].forEach(method => {
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
   * Call this after tests are complete or in an afterAll hook
   */
  flush(options = {}) {
    if (!this.buffer.length) return;
    
    const { toConsole = true, toFile = false, filename = 'buffered-logs.log' } = options;
    
    if (toConsole) {
      this.buffer.forEach(log => {
        switch (log.level) {
          case 'debug':
            console.debug(log.message, ...(log.args || []));
            break;
          case 'info':
            console.log(log.message, ...(log.args || []));
            break;
          case 'warn':
            console.warn(log.message, ...(log.args || []));
            break;
          case 'error':
            console.error(log.message, log.error);
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
module.exports = new Logger();