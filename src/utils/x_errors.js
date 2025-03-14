// src\utils\x_errors.js
/**
 * Error classes for the Onshape client
 */

/**
 * Base error class for Onshape client
 */
class OnshapeError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error for invalid parameters
 */
class OnshapeParameterError extends OnshapeError {
  constructor(message) {
    super(`Parameter error: ${message}`);
  }
}

/**
 * Error for API responses
 */
class OnshapeApiError extends OnshapeError {
  constructor(message, originalError) {
    super(`API error: ${message}`);
    this.originalError = originalError;
  }
}

/**
 * Error for feature operations
 */
class OnshapeFeatureError extends OnshapeError {
  constructor(message, originalError) {
    super(`Feature error: ${message}`);
    this.originalError = originalError;
  }
}

module.exports = {
  OnshapeError,
  OnshapeParameterError,
  OnshapeApiError,
  OnshapeFeatureError
};