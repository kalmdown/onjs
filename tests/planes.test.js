const express = require('express');
const request = require('supertest');
const planesRouter = require('../routes/planes');

// Mock dependencies
jest.mock('../utils/logger', () => ({
  scope: jest.fn().mockReturnValue({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('Planes API Routes', () => {
  let app;
  let mockAuth;
  let mockOnshapeClient;
  
  beforeEach(() => {
    // Setup express app
    app = express();
    
    // Mock auth middleware
    mockAuth = {
      isAuthenticated: jest.fn((req, res, next) => next()),
    };
    
    // Mock Onshape client
    mockOnshapeClient = {
      get: jest.fn(),
    };
    
    // Attach Onshape client to requests
    app.use((req, res, next) => {
      req.onshapeClient = mockOnshapeClient;
      next();
    });
    
    // Mount the router
    const planes = planesRouter(app, mockAuth);
    app.use('/api/planes', planes);
  });
  
  describe('GET /', () => {
    it('should return a working message', async () => {
      const res = await request(app).get('/api/planes');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: 'Planes API endpoint working' });
    });
  });
  
  describe('GET /documents/:documentId/elements/:elementId/planes', () => {
    it('should return 400 if workspaceId is missing', async () => {
      const res = await request(app)
        .get('/api/planes/documents/doc123/elements/elem123/planes');
        
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Missing workspaceId parameter');
    });
    
    it('should return planes when all parameters are provided', async () => {
      // Mock successful response for standard planes
      mockOnshapeClient.get.mockImplementation((path) => {
        if (path.includes('/planes')) {
          return Promise.resolve({
            status: 200,
            data: [
              { id: 'elem123_JHD', name: 'TOP', type: 'STANDARD', transientId: 'TOP' },
              { id: 'elem123_JFD', name: 'FRONT', type: 'STANDARD', transientId: 'FRONT' },
              { id: 'elem123_JGD', name: 'RIGHT', type: 'STANDARD', transientId: 'RIGHT' },
            ]
          });
        }
        return Promise.reject(new Error('Unexpected path'));
      });
      
      const res = await request(app)
        .get('/api/planes/documents/doc123/elements/elem123/planes?workspaceId=ws123');
        
      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(3);
      expect(res.body[0].name).toBe('TOP');
    });
    
    it('should fall back to default planes if API fails', async () => {
      // Mock failed response
      mockOnshapeClient.get.mockRejectedValue(new Error('API error'));
      
      const res = await request(app)
        .get('/api/planes/documents/doc123/elements/elem123/planes?workspaceId=ws123');
        
      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(3);
      expect(res.body.map(p => p.name)).toContain('TOP');
      expect(res.body.map(p => p.name)).toContain('FRONT');
      expect(res.body.map(p => p.name)).toContain('RIGHT');
    });
  });
  
  describe('GET /:documentId/w/:workspaceId/e/:elementId', () => {
    it('should return standard planes', async () => {
      // Mock successful response
      mockOnshapeClient.get.mockImplementation((path) => {
        if (path.includes('/planes')) {
          return Promise.resolve({
            status: 200,
            data: [
              { id: 'elem123_JHD', name: 'TOP', type: 'STANDARD', transientId: 'TOP' },
            ]
          });
        }
        return Promise.reject(new Error('Unexpected path'));
      });
      
      const res = await request(app)
        .get('/api/planes/doc123/w/ws123/e/elem123');
        
      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('TOP');
    });
    
    it('should include custom planes when requested', async () => {
      // Mock successful responses
      mockOnshapeClient.get.mockImplementation((path) => {
        if (path.includes('/planes')) {
          return Promise.resolve({
            status: 200,
            data: [
              { id: 'elem123_JHD', name: 'TOP', type: 'STANDARD', transientId: 'TOP' },
            ]
          });
        }
        if (path.includes('/features')) {
          return Promise.resolve({
            status: 200,
            data: {
              features: [
                { 
                  id: 'custom1', 
                  name: 'Custom Plane 1', 
                  featureType: 'plane'
                }
              ]
            }
          });
        }
        return Promise.reject(new Error('Unexpected path'));
      });
      
      const res = await request(app)
        .get('/api/planes/doc123/w/ws123/e/elem123?includeCustomPlanes=true');
        
      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0].name).toBe('TOP');
      expect(res.body[1].name).toBe('Custom Plane 1');
      expect(res.body[1].type).toBe('CUSTOM');
    });
  });
  
  describe('Error handling', () => {
    it('should return 500 if onshapeClient is not available', async () => {
      // Create a new app without the onshapeClient middleware
      const appWithoutClient = express();
      const planesWithoutClient = planesRouter(appWithoutClient, mockAuth);
      appWithoutClient.use('/api/planes', planesWithoutClient);
      
      const res = await request(appWithoutClient)
        .get('/api/planes/doc123/w/ws123/e/elem123');
        
      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Internal server error');
    });
    
    it('should handle unexpected errors in route handlers', async () => {
      // Mock an error in the handler
      mockOnshapeClient.get.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      // Mock the next function to capture errors
      const mockNext = jest.fn();
      app.use((err, req, res, next) => {
        expect(err).toBeDefined();
        res.status(500).json({ error: 'Server error' });
      });
      
      const res = await request(app)
        .get('/api/planes/doc123/w/ws123/e/elem123');
        
      expect(res.statusCode).toBe(500);
    });
    
    it('should return 404 for unknown routes', async () => {
      const res = await request(app)
        .get('/api/planes/unknown/route');
        
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Route not found');
    });
  });
});