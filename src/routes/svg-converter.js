// src/routes/svg-converter.js
// src/routes/svg-converter.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const logger = require('../utils/logger');
const SVGParser = require('../utils/svg/parser');
const PathProcessor = require('../utils/svg/path-processor');
const FeatureBuilder = require('../utils/svg/feature-builder');
const { ValidationError } = require('../utils/errors');

// Create scoped logger
const log = logger.scope('SVGConverterRoute');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {