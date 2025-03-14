// src\middleware\error.js
// src/middleware/error.js
const logger = require('../utils/logger');
const { OnshapeError, AuthenticationError } = require('../utils/errors');

// Create a scoped logger
const log = logger.scope('ErrorMiddleware');

/**
 * Global error handling middleware
 * Handles different types of errors and returns appropriate responses
 */
function errorMiddleware(err, req, res, next) {
  // Extract useful information from the error
  let statusCode = err.statusCode || err.response?.status || 500;
  let message = err.message || 'Internal server error';
  let errorType = err.name || 'Error';
  
  // Create error details object
  const errorDetails = {
    message,
    status: statusCode,
    type: errorType,
    path: req.path
  };
  
  // Add more details for debugging in development mode
  if (process.env.NODE_ENV !== 'production') {
    errorDetails.stack = err.stack;
    
    // Add original error details if available
    if (err.originalError) {
      errorDetails.originalError = {
        message: err.originalError.message,
        name: err.originalError.name
      };
    }
    
    // Add response data if available
    if (err.response?.data) {
      errorDetails.responseData = err.response.data;
    }
  }
  
  // Log the error with appropriate severity
  if (statusCode >= 500) {
    log.error(`Server Error (${statusCode}): ${message}`, err);
  } else {
    log.warn(`Client Error (${statusCode}): ${message}`);
  }
  
  // Handle authentication errors
  if (statusCode === 401 || err instanceof AuthenticationError) {
    // Clear any invalid tokens from session
    if (req.session) {
      delete req.session.oauthToken;
      delete req.session.refreshToken;
    }
    
    // For API requests, return JSON error
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Your session has expired or is invalid. Please log in again.'
      });
    }
    
    // For browser requests, redirect to login
    return res.redirect('/oauth/login');
  }
  
  // Handle not found errors
  if (statusCode === 404) {
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(404).json({
        error: 'Not found',
        message: message
      });
    }
    
    // For HTML requests, render a nice 404 page (if we had a view engine)
    // For now, just return a simple 404 message
    return res.status(404).send('Not Found: ' + message);
  }
  
  // Handle validation errors
  if (statusCode === 400) {
    return res.status(400).json({
      error: 'Validation error',
      message: message
    });
  }
  
  // Handle other errors
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Server error' : 'Request error',
    message,
    details: process.env.NODE_ENV !== 'production' ? errorDetails : undefined
  });
}

module.exports = errorMiddleware;