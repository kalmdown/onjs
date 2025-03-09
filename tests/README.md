# Automated Tests for svg2onshape

This directory contains automated test scripts to verify the functionality of the svg2onshape application.

## Requirements

- Node.js 16+ installed
- The svg2onshape application running on `http://localhost:3000`
- A valid Onshape account for authentication
- A document named "svg2onshape Test" with at least one part studio named "Part Studio 1" containing a custom plane named "Funky Plane"

## Setup

1. Install dependencies:
   ```
   npm install
   ```

## Running Tests

To run the cylinder creation test:
```
npm test
```

This will:
1. Launch a browser
2. Navigate to the app
3. Authenticate with Onshape
4. Select "svg2onshape Test" document
5. Select "Part Studio 1"
6. Select the custom plane "Funky Plane"
7. Run "Example 1: Create a Basic Cylinder"
8. Verify successful completion

A screenshot will be saved to `test-results.png` for verification.

## Test Preconditions

The test requires the following to be set up in your Onshape account:
- A document named "svg2onshape Test"
- A part studio named "Part Studio 1" within that document
- A custom plane named "Funky Plane" in that part studio

The test will fail if any of these preconditions are not met.

## Troubleshooting

- If authentication fails, make sure you're logged into Onshape in your regular browser
- If the test can't find "svg2onshape Test", create a document with this name in your Onshape account
- If the test can't find "Part Studio 1", create a part studio with this name in your test document
- If the test can't find "Funky Plane", create a custom plane with this name in your part studio