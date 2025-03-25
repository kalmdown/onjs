// src/app.js

const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const env = require('./utils/load-env');
const { initLogging } = require('./utils/logging');
const { initPassport } = require('./utils/passport');
const { initRoutes } = require('./routes');

// Initialize logging
initLogging();

// Initialize passport
initPassport(passport);

// Set up middleware
app.use(morgan('dev'));
app.use(helmet());
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: env.getSessionSecret(),
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Set up static file serving
app.use(express.static(path.join(__dirname, 'public')));

// Set up view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Import route handlers
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const documentsRouter = require('./routes/documents');
const partstudiosRouter = require('./routes/partstudios');

// Mount routes
app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/partstudios', partstudiosRouter);

// Error handling
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: app.get('env') === 'development' ? err : {}
  });
});

module.exports = app;