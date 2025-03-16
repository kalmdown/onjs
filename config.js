// config.js - Configuration for the application
// Configuration settings loaded from environment variables

module.exports = {
  port: process.env.PORT || 3000,
  session: {
    name: process.env.SESSION_NAME || 'onshape-session',
    secret: process.env.SESSION_SECRET || 'default-secret-key-change-in-production',
    secure: process.env.SESSION_SECURE === 'true',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000')
  },
  onshape: {
    baseUrl: process.env.BASE_URL || 'https://cad.onshape.com/',
    apiUrl: process.env.API_URL || 'https://cad.onshape.com/api/v10',
    oauthUrl: process.env.OAUTH_URL || 'https://oauth.onshape.com',
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    callbackUrl: process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000/oauthRedirect',
    scope: process.env.ONSHAPE_OAUTH_SCOPE || 'OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete',
    // Explicitly define these at the correct level as expected by middleware
    authorizationURL: process.env.OAUTH_URL ? `${process.env.OAUTH_URL}/oauth/authorize` : 'https://oauth.onshape.com/oauth/authorize',
    tokenURL: process.env.OAUTH_URL ? `${process.env.OAUTH_URL}/oauth/token` : 'https://oauth.onshape.com/oauth/token'
  },
  // Add top-level duplicates in case middleware looks here
  authorizationURL: process.env.OAUTH_URL ? `${process.env.OAUTH_URL}/oauth/authorize` : 'https://oauth.onshape.com/oauth/authorize',
  tokenURL: process.env.OAUTH_URL ? `${process.env.OAUTH_URL}/oauth/token` : 'https://oauth.onshape.com/oauth/token'
};