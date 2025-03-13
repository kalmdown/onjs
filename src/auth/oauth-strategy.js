// src\auth\oauth-strategy.js
const path = require('path');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const logger = require('../utils/logger');

// Explicitly load .env from the project root (two levels up)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const clientID = process.env.OAUTH_CLIENT_ID;
const clientSecret = process.env.OAUTH_CLIENT_SECRET;
const callbackURL = process.env.OAUTH_CALLBACK_URL;
const oauthUrl = process.env.OAUTH_URL || 'https://oauth.onshape.com';
// Using Onshape's passport scope format (note: if you require delete, update the string accordingly)
const scope = 'OAuth2ReadPII OAuth2Read OAuth2Write OAuth2Delete';

if (!clientID) {
  logger.error('Error: OAUTH_CLIENT_ID is not defined.');
}

passport.use('onshape-oauth', new OAuth2Strategy({
  authorizationURL: `${oauthUrl}/oauth/authorize`,
  tokenURL: `${oauthUrl}/oauth/token`,
  clientID,
  clientSecret,
  callbackURL,
  scope
}, (accessToken, refreshToken, profile, done) => {
  if (!accessToken) {
    return done(new Error('Missing access token'));
  }
  const user = { accessToken, refreshToken, profile };
  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;