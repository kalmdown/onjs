// src\utils\errors.js
/**
 * Custom error classes for the Onshape client
 */

/**
 * Base error class for all Onshape client errors
 */
class OnshapeError extends Error {
    /**
     * @param {string} message Error message
     */
    constructor(message) {
      super(message);
      this.name = this.constructor.name;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Error for API request failures
   */
  class OnshapeApiError extends OnshapeError {
    /**
     * @param {string} message Error message
     * @param {Object} [response=null] HTTP response object
     */
    constructor(message, response = null) {
      super(message);
      this.response = response;
      
      // Extract more details if available
      if (response?.data) {
        this.details = response.data;
      }
    }
  
    /**
     * Return a formatted string representation of the error
     * 
     * @returns {string} Formatted error string
     */
    toString() {
      let result = `${this.name}: ${this.message}`;
      
      if (this.response) {
        result += `\nStatus: ${this.response.status}`;
        if (this.details) {
          result += `\nDetails: ${JSON.stringify(this.details, null, 2)}`;
        }
      }
      
      return result;
    }
  }
  
  /**
   * Error for authentication failures
   */
  class OnshapeAuthError extends OnshapeError {
    /**
     * @param {string} message Error message
     * @param {Error} [originalError=null] Original error that caused this error
     */
    constructor(message, originalError = null) {
      super(message);
      this.originalError = originalError;
    }
  }
  
  /**
   * Error for invalid parameters
   */
  class OnshapeParameterError extends OnshapeError {
    /**
     * @param {string} message Error message
     * @param {string} [paramName=null] Name of the parameter that caused the error
     */
    constructor(message, paramName = null) {
      super(message);
      this.paramName = paramName;
    }
  }
  
  /**
   * Error for feature operation failures
   */
  class OnshapeFeatureError extends OnshapeError {
    /**
     * @param {string} message Error message
     * @param {Object} [details=null] Additional details about the failure
     */
    constructor(message, details = null) {
      super(message);
      this.details = details;
    }
  }
  
  module.exports = {
    OnshapeError,
    OnshapeApiError,
    OnshapeAuthError,
    OnshapeParameterError,
    OnshapeFeatureError
  };