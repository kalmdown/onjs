// config/index.js
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  onshape: {
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    callbackUrl: process.env.OAUTH_CALLBACK_URL || "http://localhost:3000/oauthRedirect",
    authorizationUrl: `${process.env.OAUTH_URL}/oauth/authorize`,
    tokenUrl: `${process.env.OAUTH_URL}/oauth/token`,
    baseUrl: process.env.API_URL || 'https://cad.onshape.com/api/v6',
  },
  session: {
    secret: process.env.SESSION_SECRET || "development_secret_do_not_use_in_production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.SESSION_SECURE === "true",
      maxAge: process.env.SESSION_MAX_AGE
        ? parseInt(process.env.SESSION_MAX_AGE)
        : 24 * 60 * 60 * 1000, // Default to 24 hours
    },
  },
  webhook: {
    callbackRootUrl: process.env.WEBHOOK_CALLBACK_ROOT_URL,
  },
  auth: {
    defaultMethod: process.env.ONSHAPE_AUTH_METHOD || 'oauth',
    unitSystem: process.env.ONSHAPE_UNIT_SYSTEM || 'inch',
  }
};