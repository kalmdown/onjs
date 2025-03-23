// public/js/utils/logging.js

/**
 * Client-side logging utility with scope, level and server-side integration support
 */
class ClientLogger {
  constructor(options = {}) {
    this.remoteLogging = options.remoteLogging !== false;
    this.remoteLogLevel = options.remoteLogLevel || 'warn';
    this.consoleOutput = options.consoleOutput !== false;
    
    // Log levels with numerical values for comparison
    this.logLevels = {
      off: -1,
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    // Default to info level if not configured
    this.globalLogLevel = options.logLevel || 'info';
    this.scopeLogLevels = options.scopeLogLevels || {};
    
    // Set default scope levels
    if (!this.scopeLogLevels.Auth) {
      this.scopeLogLevels.Auth = 'error';
    }
    
    if (!this.scopeLogLevels.Documents) {
      this.scopeLogLevels.Documents = 'error';
    }
    
    // DOM element for log output
    this.outputElement = null;
    
    // Initialize DOM elements when ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initDomElements());
    } else {
      this.initDomElements();
    }
    
    // Initialize from server config if available
    this.initFromServerConfig();
  }
  
  /**
   * Find and store DOM elements for logging
   */
  initDomElements() {
    this.outputElement = document.getElementById('logOutput');
  }
  
  /**
   * Initialize logging configuration from server-provided settings
   */
  initFromServerConfig() {
    if (window.GLOBAL_LOGGING) {
      // If GLOBAL_LOGGING is a string, it's a level
      if (typeof window.GLOBAL_LOGGING === 'string') {
        this.globalLogLevel = window.GLOBAL_LOGGING.toLowerCase();
      } 
      // If it's an object with configuration
      else if (typeof window.GLOBAL_LOGGING === 'object') {
        if (window.GLOBAL_LOGGING.globalLevel) {
          this.globalLogLevel = window.GLOBAL_LOGGING.globalLevel;
        }
        
        if (window.GLOBAL_LOGGING.scopeLevels) {
          this.scopeLogLevels = {
            ...this.scopeLogLevels,
            ...window.GLOBAL_LOGGING.scopeLevels
          };
        }
      }
      
      // Only log if debug is enabled for global scope
      if (this.globalLogLevel === 'debug') {
        console.debug(`ClientLogger initialized with global level: ${this.globalLogLevel}`);
        console.debug(`Scope levels:`, this.scopeLogLevels);
      }
    }
  }

  /**
   * Set log level for a specific scope
   */
  setLogLevel(scope, level) {
    if (!this.logLevels.hasOwnProperty(level)) {
      console.error(`Invalid log level: ${level}`);
      return;
    }
    
    this.scopeLogLevels[scope] = level;
  }
  
  /**
   * Get log level for a specific scope
   */
  getLogLevel(scope) {
    return this.scopeLogLevels[scope] || this.globalLogLevel;
  }

  /**
   * Determine if a message should be logged based on level and scope
   */
  shouldLog(level, scope = null) {
    // Get the effective log level for this scope
    const effectiveLevel = scope ? this.getLogLevel(scope) : this.globalLogLevel;
    
    // If level is 'off', nothing should be logged
    if (effectiveLevel === 'off') {
      return false;
    }
    
    // Check if the message's level meets the minimum threshold
    return this.logLevels[level] >= this.logLevels[effectiveLevel];
  }

  /**
   * Determine if a message should be sent to the server
   */
  shouldSendToServer(level) {
    return this.remoteLogging && this.logLevels[level] >= this.logLevels[this.remoteLogLevel];
  }

  /**
   * Add a log entry to the DOM output element
   */
  logToDOM(level, message, meta = {}) {
    if (!this.outputElement) return;
    
    try {
      const logEntry = document.createElement('div');
      logEntry.classList.add('log-entry', `log-${level}`);
      
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      
      // Add source file if available
      const sourceMarkup = meta.source ? `<span class="log-source">${meta.source}</span>` : '';
      
      logEntry.innerHTML = `
        <span class="log-time">${timestamp}</span>
        <span class="log-level">[${level.toUpperCase()}]</span>
        <span class="log-message">${message}</span>
        ${sourceMarkup}
      `;
      
      this.outputElement.appendChild(logEntry);
      this.outputElement.scrollTop = this.outputElement.scrollHeight;
    } catch (err) {
      console.error('Error writing to log DOM:', err);
    }
  }

  /**
   * Send a log to the server
   */
  sendToServer(level, message, meta = {}) {
    if (!this.shouldSendToServer(level)) return;
    
    try {
      fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          level,
          message,
          source: meta.source || window.location.pathname,
          stack: meta.stack || null,
          timestamp: new Date().toISOString()
        })
      }).catch(err => {
        console.error('Failed to send log to server:', err);
      });
    } catch (err) {
      console.error('Error sending log to server:', err);
    }
  }

  /**
   * Log a debug message
   */
  debug(message, meta = {}, scope = null) {
    if (!this.shouldLog('debug', scope)) return;
    
    if (this.consoleOutput) {
      console.debug(message);
    }
    this.logToDOM('debug', message, meta);
    this.sendToServer('debug', message, meta);
  }

  /**
   * Log an info message
   */
  info(message, meta = {}, scope = null) {
    if (!this.shouldLog('info', scope)) return;
    
    if (this.consoleOutput) {
      console.info('%c[INFO] ' + message, 'color: #4CAF50');
    }
    this.logToDOM('info', message, meta);
    this.sendToServer('info', message, meta);
  }

  /**
   * Log a success message (special case of info)
   * This uses the info log level for filtering
   */
  success(message, meta = {}, scope = null) {
    // Important: Use 'info' level check since success is just a styled version of info
    if (!this.shouldLog('info', scope)) return;
    
    if (this.consoleOutput) {
      console.info('%c[SUCCESS] ' + message, 'color: #2E7D32');
    }
    this.logToDOM('success', message, meta);
    this.sendToServer('info', message, {...meta, type: 'success'});
  }

  /**
   * Log a warning message
   */
  warn(message, meta = {}, scope = null) {
    if (!this.shouldLog('warn', scope)) return;
    
    if (this.consoleOutput) {
      console.warn('%c[WARN] ' + message, 'color: #FF9800');
    }
    this.logToDOM('warn', message, meta);
    this.sendToServer('warn', message, meta);
  }

  /**
   * Log an error message
   */
  error(message, meta = {}, scope = null) {
    if (!this.shouldLog('error', scope)) return;
    
    if (this.consoleOutput) {
      console.error('%c[ERROR] ' + message, 'color: #F44336');
    }
    
    // Include stack trace if available
    if (meta.error instanceof Error) {
      meta.stack = meta.error.stack;
    }
    
    this.logToDOM('error', message, meta);
    this.sendToServer('error', message, meta);
  }

  /**
   * Create a scoped logger
   */
  scope(scopeName) {
    const scopedLogger = {};
    const methods = ['debug', 'info', 'success', 'warn', 'error'];
    
    methods.forEach(method => {
      scopedLogger[method] = (message, meta = {}) => {
        return this[method](`[${scopeName}] ${message}`, {
          ...meta,
          scope: scopeName
        }, scopeName);
      };
    });
    
    // Add methods to get/set log level for this scope
    scopedLogger.setLogLevel = (level) => {
      this.setLogLevel(scopeName, level);
    };
    
    scopedLogger.getLogLevel = () => {
      return this.getLogLevel(scopeName);
    };
    
    return scopedLogger;
  }
}

// Create global instance
const clientLogger = new ClientLogger();

// Make logger available globally
window.clientLogger = clientLogger;

// Error handlers
window.addEventListener('error', (event) => {
  clientLogger.error(event.message || 'Uncaught error', {
    error: event.error,
    source: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  clientLogger.error('Unhandled Promise rejection: ' + 
    (event.reason?.message || 'Unknown reason'), {
    error: event.reason,
    stack: event.reason?.stack
  });
});

// Helper function to get the calling file name
function getCallerFile() {
  try {
    const err = new Error();
    const stack = err.stack.split('\n');
    // Find the first line that's not in logging.js
    for (let i = 3; i < stack.length; i++) {
      const line = stack[i];
      if (line.includes('/') && !line.includes('logging.js')) {
        const parts = line.split('/');
        return parts[parts.length - 1].split(':')[0]; // Extract filename
      }
    }
    return 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

// Export functions that use the client logger
/**
 * Initialize the logger
 */
export function initLogger() {
  clientLogger.initDomElements();
}

/**
 * Log messages to the output panel
 */
export function log(message, type = 'info', scope = null) {
  const sourceFile = getCallerFile();
  const scopedMessage = scope ? `[${scope}] ${message}` : message;
  
  switch(type) {
    case 'success':
      clientLogger.success(scopedMessage, { source: sourceFile }, scope);
      break;
    case 'error':
      clientLogger.error(scopedMessage, { source: sourceFile }, scope);
      break;
    case 'info':
    default:
      clientLogger.info(scopedMessage, { source: sourceFile }, scope);
      break;
  }
}

/**
 * Log an info message
 */
export function logInfo(message, scope = null) {
  const sourceFile = getCallerFile();
  const scopedMessage = scope ? `[${scope}] ${message}` : message;
  return clientLogger.info(scopedMessage, { source: sourceFile }, scope);
}

/**
 * Log a debug message
 */
export function logDebug(message, data, scope = null) {
  const sourceFile = getCallerFile();
  // Handle the case where data is actually a scope string
  if (typeof data === 'string') {
    scope = data;
    data = undefined;
  }
  
  const scopedMessage = scope ? `[${scope}] ${message}` : message;
  const meta = { source: sourceFile };
  
  if (data !== undefined) {
    meta.data = data;
  }
  
  return clientLogger.debug(scopedMessage, meta, scope);
}

/**
 * Log a warning message
 */
export function logWarn(message, data, scope = null) {
  const sourceFile = getCallerFile();
  // Handle the case where data is actually a scope string
  if (typeof data === 'string') {
    scope = data;
    data = undefined;
  }
  
  const scopedMessage = scope ? `[${scope}] ${message}` : message;
  const meta = { source: sourceFile };
  
  if (data !== undefined) {
    meta.data = data;
  }
  
  return clientLogger.warn(scopedMessage, meta, scope);
}

/**
 * Log an error message
 */
export function logError(message, meta = {}, scope = null) {
  const sourceFile = getCallerFile();
  // Handle the case where meta is actually a scope string
  if (typeof meta === 'string') {
    scope = meta;
    meta = {};
  }
  
  const scopedMessage = scope ? `[${scope}] ${message}` : message;
  return clientLogger.error(scopedMessage, { ...meta, source: sourceFile }, scope);
}

// Export the logger instance
export default clientLogger;