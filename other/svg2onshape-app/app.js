import dotenv from 'dotenv';

// Load environment variables from .env file
// This should be at the very top of the file, before using any env variables
dotenv.config();

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import express from 'express';
import session from 'express-session';
// import bodyParser from 'body-parser'; // Unused import removed
import cors from 'cors';
import flash from 'connect-flash';
import passport from 'passport';
import OnshapeStrategy from 'passport-onshape';
import { OAuth2 } from 'oauth';
import cookieParser from 'cookie-parser';
import dns from 'dns';
import logger from 'morgan';
import compression from 'compression';
import helmet from 'helmet';

// ES module equivalent for __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Add near the top with other imports
import OnshapeApiService from './services/onshape-api.js';
import ConversionService from './services/svg/conversion-service.js';

// Import debugLog directly instead of using dynamic import
import { debugLog } from './utils/debug.js';

// Configuration from environment variables - no conditional defaults here
// All defaults should be in .env file
const config = {
    port: process.env.PORT,
    apiUrl: process.env.API_URL,
    oauthCallbackUrl: process.env.OAUTH_CALLBACK_URL,
    oauthClientId: process.env.OAUTH_CLIENT_ID,
    oauthClientSecret: process.env.OAUTH_CLIENT_SECRET,
    oauthUrl: process.env.OAUTH_URL,
    sessionSecret: process.env.SESSION_SECRET,
    webhookCallbackRootUrl: process.env.WEBHOOK_CALLBACK_ROOT_URL
};

// Log configuration (with sensitive info redacted)
debugLog('env', 'Configuration:', {
    port: config.port,
    apiUrl: config.apiUrl,
    oauthCallbackUrl: config.oauthCallbackUrl,
    oauthClientId: config.oauthClientId ? '***REDACTED***' : 'not set',
    oauthClientSecret: config.oauthClientSecret ? '***REDACTED***' : 'not set',
    oauthUrl: config.oauthUrl
});

// Log environment settings - these should all be from .env file
debugLog('env', 'Environment settings:', {
    NODE_ENV: process.env.NODE_ENV || 'not set',
    COMPREHENSIVE_PLANE_SEARCH: process.env.COMPREHENSIVE_PLANE_SEARCH
});

// Initialize Express app
const app = express();

// Initialize services BEFORE any middleware
const onshapeApi = new OnshapeApiService(config.apiUrl);
debugLog('env', 'OnshapeApiService initialized');

const conversionService = new ConversionService(onshapeApi);
debugLog('env', 'ConversionService initialized');

// Make services available to the router IMMEDIATELY after initialization
app.set('onshapeApi', onshapeApi);
app.set('conversionService', conversionService);
debugLog('env', 'Services registered with app');

// Add a cSpell ignore comment for "gstatic" at line 88
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"], // cspell:ignore gstatic
      imgSrc: ["'self'", "data:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Rest of your middleware setup
app.use(compression());
app.use(logger('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1); // To allow to run correctly behind Heroku

/*
app.use((req, res, next) => {
    console.log('Request:', {
        url: req.url,
        cookies: req.cookies,
        session: req.session,
        headers: req.headers
    });

    console.log('Session Debug:', {
        sessionID: req.sessionID,
        hasSession: !!req.session,
        cookieSettings: req.session?.cookie,
        headers: {
            origin: req.headers.origin,
            cookie: req.headers.cookie
        }
    });

    console.log('OAuth Debug:', {
        url: req.url,
        method: req.method,
        sessionID: req.sessionID,
        session: req.session,
        user: req.user,
        cookies: req.cookies
    });

    next();
});
*/

app.use((req, res, next) => {
    res.set({
        'Access-Control-Allow-Origin': req.headers.origin || 'https://cad.onshape.com',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
        'Access-Control-Expose-Headers': 'Set-Cookie'
    });

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Add CORS configuration before session middleware
app.use(cors({
    origin: ['https://cad.onshape.com', 'https://oauth.onshape.com'],
    credentials: true
}));

// Move cookie-parser before session middleware
app.use(cookieParser(config.sessionSecret)); // Use same secret as session

// Update session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true, // Changed to true to ensure session updates
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

// Add this before your routes
dns.lookup('cad.onshape.com', (err, address, family) => {
    debugLog('DNS', {
        stage: 'lookup',
        host: 'cad.onshape.com',
        error: err?.message,
        address,
        family
    });
});

// Update Passport strategy configuration
passport.use(new OnshapeStrategy({
    clientID: config.oauthClientId,
    clientSecret: config.oauthClientSecret,
    callbackURL: config.oauthCallbackUrl,
    authorizationURL: `${config.oauthUrl}/oauth/authorize`,
    tokenURL: `${config.oauthUrl}/oauth/token`,
    userProfileURL: 'https://cad.onshape.com/api/users/sessioninfo',
    passReqToCallback: true,
    proxy: true,
    state: false, // We're handling state manually
    scope: 'OAuth2ReadPII OAuth2Read OAuth2Write', // Onshape's specific scope format
    customHeaders: {
        'User-Agent': 'svg2onshape-app'
    },
    // Disable verbose logging
    _oauth2: {
        ...OAuth2.prototype,
        _request: function(method, url, headers, post_body, access_token, callback) {
            // Silent request logging
            OAuth2.prototype._request.call(this, method, url, headers, post_body, access_token, callback);
        }
    }
},
async (req, accessToken, refreshToken, params, profile, done) => {
    try {
        // Silent profile fetch
        const response = await fetch('https://cad.onshape.com/api/users/sessioninfo', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            return done(new Error('Profile fetch failed'));
        }

        const userProfile = await response.json();
        profile = userProfile;
        profile.accessToken = accessToken;
        profile.refreshToken = refreshToken;
        profile.extraData = req.session?.extraData;

        return done(null, profile);
    } catch (error) {
        return done(error);
    }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Replace the two check-cookies routes with this single one
app.get('/check-cookies', (req, res) => {
    console.log('Cookie Debug:', {
        cookies: req.cookies,
        signedCookies: req.signedCookies,
        sessionID: req.sessionID,
        sessionExists: !!req.session,
        sessionCookie: req.session?.cookie,
        headers: {
            cookie: req.headers.cookie,
            origin: req.headers.origin
        }
    });

    if (req.session && req.session.cookie) {
        res.json({
            cookiesEnabled: true,
            sessionExists: true,
            cookieSettings: req.session.cookie,
            sessionID: req.sessionID
        });
    } else {
        res.json({
            cookiesEnabled: false,
            sessionExists: false,
            sessionID: req.sessionID
        });
    }
});

app.get('/test-cookies', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html', 'cookie-test.html'));
});

// Then update the OAuth routes
app.get('/oauthSignin', (req, res, next) => {
    const state = uuidv4();
    const params = {
        documentId: req.query.documentId,
        workspaceId: req.query.workspaceId,
        elementId: req.query.elementId,
        state: state
    };
    
    req.session.extraData = params;
    req.session.oauthState = state;

    req.session.save(() => {
        passport.authenticate('onshape', {
            scope: 'OAuth2ReadPII OAuth2Read OAuth2Write',
            state: state
        })(req, res, next);
    });
});

// Update the OAuth redirect callback to use state parameter or prefix with underscore at line 298
app.get('/oauthRedirect', (req, res, next) => {
    const _savedState = req.session.oauthState; // Prefix with underscore since it's not used
    const savedParams = req.session.extraData;

    passport.authenticate('onshape', (err, user) => {
        if (err || !user) {
            return res.redirect('/?error=auth_failed');
        }

        req.logIn(user, (loginErr) => {
            if (loginErr) {
                return res.redirect('/?error=login_failed');
            }

            const redirectUrl = `/?documentId=${savedParams.documentId}&workspaceId=${savedParams.workspaceId}&elementId=${savedParams.elementId}`;
            res.redirect(redirectUrl);
        });
    })(req, res, next);
});

app.get('/grantDenied', (req, res) => {
    const errors = req.flash('error');
    const errorMessage = errors.length ? errors[0] : 'Access denied';
    res.status(403).send(`Authentication failed: ${errorMessage}`);
});

// Update static file serving middleware
app.use('/static', express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path, _stat) => {
        if (path.endsWith('.css')) {
            res.set('Content-Type', 'text/css');
        }
    }
}));

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'public')));

// Add after existing middleware setup
app.use('/app', express.static(path.join(__dirname, 'app'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            // Ensure JavaScript files are served with correct MIME type
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

/****
 * After landing on the home page, we check if a user had already signed in.
 * If no user has signed in, we redirect the request to the OAuth sign-in page.
 * If a user had signed in previously, we will attempt to refresh the access token of the user.
 * After successfully refreshing the access token, we will simply take the user to the landing page of the app.
 * If the refresh token request fails, we will redirect the user to the OAuth sign-in page again.
 */
app.get('/', (req, res) => {
    if (!req.user) {
        return res.redirect(`/oauthSignin${req._parsedUrl.search ? req._parsedUrl.search : ""}`);
    } else {
        refreshAccessToken(req.user).then((tokenJson) => {
            // Dereference the user object and update the access token and refresh token in the in-memory object.
            let usrObj = JSON.parse(JSON.stringify(req.user));
            usrObj.accessToken = tokenJson.access_token;
            usrObj.refreshToken = tokenJson.refresh_token;
            // Update the user object in PassportJS. No redirections will happen here, this is a purely internal operation.
            req.login(usrObj, () => {
                return res.sendFile(path.join(__dirname, 'public', 'html', 'index.html'));
            });
        }).catch(() => {
            // Refresh token failed, take the user to OAuth sign in page.
            return res.redirect(`/oauthSignin${req._parsedUrl.search ? req._parsedUrl.search : ""}`);
        });
    }
});

// Update API router import and configuration
import apiRouter from './api/apiRouter.js';

// Configure API routes with proper error handling
app.use('/api', (req, res, next) => {
    // Ensure services are available
    if (!req.app.get('onshapeApi') || !req.app.get('conversionService')) {
        debugLog('error', 'Required services not initialized');
        return res.status(500).json({ 
            error: 'Server configuration error' 
        });
    }
    next();
}, apiRouter);

// Move debug endpoint configuration to environment
const enableDebugEndpoints = process.env.ENABLE_DEBUG_ENDPOINTS === 'true' || 
                           process.env.NODE_ENV === 'development';

if (enableDebugEndpoints) {
    debugLog('config', 'Debug endpoints enabled');
}

const refreshAccessToken = async (user) => {
    const body = `grant_type=refresh_token&refresh_token=${user.refreshToken}&client_id=${config.oauthClientId}&client_secret=${config.oauthClientSecret}`;
    const res = await fetch(`${config.oauthUrl}/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
    });
       
    if (res.ok) {
        return await res.json();
    } else {
        throw new Error("Could not refresh access token, please sign in again.");
    }
};

// Add error handling for API routes
app.use('/api', (err, req, res, _next) => {
    debugLog('error', 'API error:', err);
    res.status(500).json({
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Add error handling middleware
app.use((err, req, res, _next) => {
    console.error('Application error:', err);
    res.status(500).json({
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Log startup information
debugLog('env', 'Starting app in environment:', process.env.NODE_ENV);

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

export default app;