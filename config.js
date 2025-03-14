// config.js - Configuration for the application
module.exports = {
    // Server configuration
    port: process.env.PORT || 3000,
    
    // Session configuration
    session: {
      secret: process.env.SESSION_SECRET || 'svg-onshape-session-secret',
      name: 'svg-onshape.sid'
    },
    
    // Onshape API configuration
    onshape: {
      baseUrl: process.env.ONSHAPE_API_URL || 'https://cad.onshape.com/api/v10',
      
      // OAuth configuration - use oauthRedirect to match what Onshape is expecting
      callbackUrl: process.env.ONSHAPE_CALLBACK_URL || 'http://localhost:3000/oauthRedirect',
      authorizationUrl: process.env.ONSHAPE_AUTH_URL || 'https://oauth.onshape.com/oauth/authorize',
      tokenUrl: process.env.ONSHAPE_TOKEN_URL || 'https://oauth.onshape.com/oauth/token',
      
      // OAuth credentials - should be set in environment variables
      clientId: process.env.ONSHAPE_CLIENT_ID || null,
      clientSecret: process.env.ONSHAPE_CLIENT_SECRET || null
    },
    
    // Authentication configuration
    auth: {
      unitSystem: process.env.ONSHAPE_UNIT_SYSTEM || 'meter',  // Default unit system (inch or meter)
      defaultMethod: process.env.ONSHAPE_AUTH_METHOD || 'oauth' // Default auth method (oauth or apikey)
    }
  };