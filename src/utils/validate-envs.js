// Create a new file: src/utils/validate-env.js
const logger = require('./logger');
const log = logger.scope('Environment');

function validateEnvironment() {
  const requiredVars = {
    common: [
      'PORT'
    ],
    oauth: [
      'OAUTH_CLIENT_ID',
      'OAUTH_CLIENT_SECRET',
      'OAUTH_CALLBACK_URL'
    ],
    apikey: [
      'ONSHAPE_ACCESS_KEY',
      'ONSHAPE_SECRET_KEY'
    ]
  };
  
  const missing = {
    common: [],
    oauth: [],
    apikey: []
  };
  
  // Additional validation results
  const validation = {
    apiKeyFormat: true, // Will be set to false if format issues are detected
    oauthFormat: true,
    warnings: []
  };
  
  // Check common required variables
  requiredVars.common.forEach(varName => {
    if (!process.env[varName]) {
      missing.common.push(varName);
    }
  });
  
  // Check auth method specific variables
  const authMethod = process.env.ONSHAPE_AUTH_METHOD || 'oauth';
  if (authMethod.toLowerCase() === 'oauth') {
    requiredVars.oauth.forEach(varName => {
      if (!process.env[varName]) {
        missing.oauth.push(varName);
      }
    });
  } else if (authMethod.toLowerCase() === 'apikey' || authMethod.toLowerCase() === 'api_key') {
    requiredVars.apikey.forEach(varName => {
      if (!process.env[varName]) {
        missing.apikey.push(varName);
      }
    });
  }
  
  // Report missing variables
  if (missing.common.length > 0) {
    log.warn(`Missing common environment variables: ${missing.common.join(', ')}`);
  }
  
  if (authMethod.toLowerCase() === 'oauth' && missing.oauth.length > 0) {
    log.error(`Missing OAuth environment variables: ${missing.oauth.join(', ')}`);
    log.error('OAuth authentication will not work without these variables');
  }
  
  if ((authMethod.toLowerCase() === 'apikey' || authMethod.toLowerCase() === 'api_key') && missing.apikey.length > 0) {
    log.error(`Missing API key environment variables: ${missing.apikey.join(', ')}`);
    log.error('API key authentication will not work without these variables');
  }
  
  // Check if we can authenticate at all
  const canUseOAuth = !missing.oauth.length && requiredVars.oauth.every(v => !!process.env[v]);
  const canUseApiKey = !missing.apikey.length && requiredVars.apikey.every(v => !!process.env[v]);
  
  // Validate API key format if present
  if (process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY) {
    const accessKey = process.env.ONSHAPE_ACCESS_KEY;
    const secretKey = process.env.ONSHAPE_SECRET_KEY;
    
    // Check for common formatting issues
    if (accessKey.trim() !== accessKey || secretKey.trim() !== secretKey) {
      log.warn('API key credentials contain leading/trailing whitespace');
      validation.warnings.push('API keys contain whitespace');
      validation.apiKeyFormat = false;
    }
    
    // Check for reasonable length
    if (accessKey.length < 20 || secretKey.length < 20) {
      log.warn('API key credentials appear to be too short', {
        accessKeyLength: accessKey.length,
        secretKeyLength: secretKey.length
      });
      validation.warnings.push('API keys may be truncated or incomplete');
      validation.apiKeyFormat = false;
    }
    
    // Log masked key info for debugging
    log.debug('API key credentials', {
      accessKeyLength: accessKey.length,
      secretKeyLength: secretKey.length,
      accessKeyStart: accessKey.substring(0, 4) + '...',
      accessKeyEnd: '...' + accessKey.substring(accessKey.length - 4),
    });
  }
  
  // Determine preferred auth method based on environment variables and explicit setting
  let preferredMethod = null;
  const explicitMethod = process.env.ONSHAPE_AUTH_METHOD?.toLowerCase();
  
  if (explicitMethod === 'apikey' || explicitMethod === 'api_key') {
    preferredMethod = canUseApiKey ? 'apikey' : null;
    if (!canUseApiKey) {
      log.warn('API key authentication explicitly requested but not properly configured');
    }
  } else if (explicitMethod === 'oauth') {
    preferredMethod = canUseOAuth ? 'oauth' : null;
    if (!canUseOAuth) {
      log.warn('OAuth authentication explicitly requested but not properly configured');
    }
  } else {
    // Auto-determine based on available credentials
    if (canUseOAuth) {
      preferredMethod = 'oauth';
    } else if (canUseApiKey) {
      preferredMethod = 'apikey';
    }
  }
  
  if (!canUseOAuth && !canUseApiKey) {
    log.error('No valid authentication method available - application may not function correctly');
    log.error('Please set either OAuth or API key environment variables');
  } else {
    log.info(`Environment validated. Available auth methods: ${canUseOAuth ? 'OAuth' : ''}${canUseOAuth && canUseApiKey ? ' and ' : ''}${canUseApiKey ? 'API Key' : ''}`);
    if (preferredMethod) {
      log.info(`Using preferred authentication method: ${preferredMethod}`);
    }
  }
  
  return {
    isValid: missing.common.length === 0 && (canUseOAuth || canUseApiKey),
    missing,
    canUseOAuth,
    canUseApiKey,
    preferredMethod,
    validation
  };
}

module.exports = validateEnvironment;