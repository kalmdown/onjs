let logOutput;

export function initLogger() {
  logOutput = document.getElementById('logOutput');
}

/**
 * Log messages to the output panel
 * 
 * @param {string} message Message to log
 * @param {string} type Message type (info, success, error)
 */
export function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-${type}`;
  
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  
  logOutput.appendChild(entry);
  logOutput.scrollTop = logOutput.scrollHeight;
}

export function logInfo(message) {
  log(message, 'info');
}

export function logSuccess(message) {
  log(message, 'success');
}

export function logError(message) {
  log(message, 'error');
}

/**
 * Log debug message to console
 * @param {string} message The message to log
 * @param {any} [data] Optional data to include
 */
export function logDebug(message, data) {
  if (data !== undefined) {
    console.debug(`[DEBUG] ${message}`, data);
  } else {
    console.debug(`[DEBUG] ${message}`);
  }
}

/**
 * Client-side logging utility that can send logs to the server
 */
class ClientLogger {
  constructor(options = {}) {
    this.remoteLogging = options.remoteLogging !== false;
    this.remoteLogLevel = options.remoteLogLevel || 'warn'; // Only send warn+ to server by default
    this.consoleOutput = options.consoleOutput !== false;
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  /**
   * Determine if a message should be sent to the server
   */
  shouldSendToServer(level) {
    return this.remoteLogging && this.levels[level] >= this.levels[this.remoteLogLevel];
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
        // Silently fail if the log server is unavailable
        console.error('Failed to send log to server:', err);
      });
    } catch (err) {
      // Catch any JSON stringification errors
      console.error('Error sending log to server:', err);
    }
  }

  /**
   * Log a debug message
   */
  debug(message, meta) {
    if (this.consoleOutput) {
      console.debug(message);
    }
    this.sendToServer('debug', message, meta);
  }

  /**
   * Log an info message
   */
  info(message, meta) {
    if (this.consoleOutput) {
      console.info('%c[INFO] ' + message, 'color: #4CAF50');
    }
    this.sendToServer('info', message, meta);
  }

  /**
   * Log a warning message
   */
  warn(message, meta) {
    if (this.consoleOutput) {
      console.warn('%c[WARN] ' + message, 'color: #FF9800');
    }
    this.sendToServer('warn', message, meta);
  }

  /**
   * Log an error message
   */
  error(message, meta = {}) {
    if (this.consoleOutput) {
      console.error('%c[ERROR] ' + message, 'color: #F44336');
    }
    
    // Include stack trace if available
    if (meta.error instanceof Error) {
      meta.stack = meta.error.stack;
    }
    
    this.sendToServer('error', message, meta);
  }

  /**
   * Create a scoped logger
   */
  scope(scopeName) {
    const scopedLogger = {};
    const methods = ['debug', 'info', 'warn', 'error'];
    
    methods.forEach(method => {
      scopedLogger[method] = (message, meta = {}) => {
        return this[method](`[${scopeName}] ${message}`, {
          ...meta,
          scope: scopeName
        });
      };
    });
    
    return scopedLogger;
  }
}

// Capture uncaught errors
window.addEventListener('error', (event) => {
  if (window.clientLogger) {
    window.clientLogger.error(event.message || 'Uncaught error', {
      error: event.error,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  }
});

// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  if (window.clientLogger) {
    window.clientLogger.error('Unhandled Promise rejection: ' + 
      (event.reason?.message || 'Unknown reason'), {
      error: event.reason,
      stack: event.reason?.stack
    });
  }
});

// Create global instance
window.clientLogger = new ClientLogger();

// Export logger instance
export default window.clientLogger;