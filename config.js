// config.js
module.exports = {
  onshape: {
    // Base URL for the Onshape API
    baseUrl: 'https://cad.onshape.com',
    
    // API version
    apiVersion: 'v6',
    
    // OAuth2 configuration
    oauth: {
      clientId: process.env.ONSHAPE_CLIENT_ID,
      clientSecret: process.env.ONSHAPE_CLIENT_SECRET,
      callbackUrl: process.env.ONSHAPE_CALLBACK_URL || 'http://localhost:3000/oauth/callback'
    },
    
    // API Key configuration
    apikey: {
      accessKey: process.env.ONSHAPE_ACCESS_KEY,
      secretKey: process.env.ONSHAPE_SECRET_KEY
    }
  },
  
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  }
}; 