// src\utils\errors.js
/**
 * Base error class for Onshape client
 */
class OnshapeError extends Error {
    constructor(message, statusCode = 500) {
      super(message);
      this.name = this.constructor.name;
      this.statusCode = statusCode;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Error for authentication issues
   */
  class AuthenticationError extends OnshapeError {
    constructor(message) {
      super(`Authentication error: ${message}`, 401);
    }
  }
  
  /**
   * Error for invalid parameters
   */
  class ValidationError extends OnshapeError {
    constructor(message) {
      super(`Validation error: ${message}`, 400);
    }
  }
  
  /**
   * Error for API responses
   */
  class ApiError extends OnshapeError {
    constructor(message, statusCode = 500, originalError = null) {
      super(`API error: ${message}`, statusCode);
      this.originalError = originalError;
      this.responseData = originalError?.response?.data;
    }
  }
  
  /**
   * Error for not found resources
   */
  class NotFoundError extends OnshapeError {
    constructor(resource, id) {
      super(`${resource} not found with id: ${id}`, 404);
      this.resource = resource;
      this.resourceId = id;
    }
  }
  
  /**
   * Error for feature operations
   */
  class FeatureError extends OnshapeError {
    constructor(message, originalError = null) {
      super(`Feature error: ${message}`, originalError?.statusCode || 500);
      this.originalError = originalError;
    }
  }
  
  module.exports = {
    OnshapeError,
    AuthenticationError,
    ValidationError,
    ApiError,
    NotFoundError,
    FeatureError
  };