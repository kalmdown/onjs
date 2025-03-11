# Onshape API Client - Node.js Implementation

# SVG to Onshape Converter

This application allows you to convert SVG files to Onshape 3D models by leveraging the Onshape API. It provides both a web interface and a JavaScript library for programmatic interaction with Onshape.

## Features

- OAuth authentication with Onshape
- List and create Onshape documents
- Create basic 3D models from examples
- Convert SVG files to Onshape models
- JavaScript library for Onshape API interaction

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/svg-to-onshape.git
   cd svg-to-onshape
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with your Onshape API credentials:
   ```
   ONSHAPE_CLIENT_ID=your_client_id
   ONSHAPE_CLIENT_SECRET=your_client_secret
   ONSHAPE_CALLBACK_URL=http://localhost:3000/oauth/callback
   SESSION_SECRET=your_session_secret
   ```

   You can get your Onshape API credentials by creating an application in the [Onshape Developer Portal](https://dev-portal.onshape.com/).

## Usage

### Starting the Server

```
npm start
```

The application will be available at `http://localhost:3000`.

### Web Interface

1. Open your browser and navigate to `http://localhost:3000`
2. Click "Authenticate with Onshape" to connect to your Onshape account
3. Use the examples or upload an SVG file to convert

### Using the JavaScript Library

The Onshape client library can be used programmatically:

```javascript
const OnshapeClient = require('./src');

// Create a client instance
const client = new OnshapeClient({
  getAuthHeaders: () => ({
    'Authorization': `Bearer ${accessToken}`
  }),
  unitSystem: 'inch'
});

// Example: Create a document
async function createDocument() {
  const document = await client.createDocument('My Document', 'Created programmatically');
  console.log('Created document:', document);
  
  // Get a part studio
  const partStudio = await client.getPartStudio({ document });
  
  // Create a sketch
  const sketch = await Sketch.create({
    partStudio,
    plane: partStudio.features.topPlane,
    name: "Example Sketch"
  });
  
  // Add a circle to the sketch
  await sketch.addCircle([0, 0], 0.5);
  
  // Extrude the sketch
  const extrude = await Extrude.create({
    partStudio,
    faces: await sketch.getEntities(),
    distance: 1,
    name: "Example Extrude"
  });
}
```

## SVG Conversion Process

The SVG conversion process involves:

1. Parsing the SVG file
2. Converting SVG paths to Onshape sketch entities
3. Creating sketches in Onshape
4. Extruding the sketches to create 3D objects

Currently, the application supports:
- Basic shapes (circles, rectangles)
- Simple paths
- Basic transformations

## Integration Tests

To run integration tests that connect to the actual Onshape API:

1. Create a `.env` file in the project root with your Onshape API credentials:
   ```
   ONSHAPE_ACCESS_KEY=your_access_key_here
   ONSHAPE_SECRET_KEY=your_secret_key_here
   ```

2. Run the integration tests:
   ```bash
   npm run test:integration
   ```

**Note:** If credentials are not provided, integration tests will be skipped automatically.

## License

MIT

## Credits

This project uses the Onshape API. Learn more about Onshape at [onshape.com](https://www.onshape.com/).

## Project Structure
```
/onshape-client
  /src
    /api
      rest-api.js       // Core API functionality
      endpoints.js      // Endpoint definitions
      schema.js         // Data models/schema
    /features
      sketch.js         // Sketch feature implementation
      extrude.js        // Extrude feature implementation
      plane.js          // Plane implementations
    /entities
      entity.js         // Entity base and implementations
    /utils
      credentials.js    // Credential management
      misc.js           // Miscellaneous utilities
    index.js            // Main export
  package.json
  README.md
```

## Key Components

1. **REST API Client**: Core implementation for making HTTP requests to Onshape
2. **Feature Classes**: Implementations for Sketch, Extrude, etc.
3. **Entity Management**: Classes for entities like faces, edges, etc.
4. **Authentication**: OAuth integration
5. **Utilities**: Helper functions, error handling, etc.