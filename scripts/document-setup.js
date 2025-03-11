/**
 * Helper script to create and set up a public test document
 */
require('dotenv').config();
const OnshapeAuth = require('../src/auth/onshape-auth');

async function setupTestDocument() {
  const auth = new OnshapeAuth({
    accessKey: process.env.ONSHAPE_ACCESS_KEY,
    secretKey: process.env.ONSHAPE_SECRET_KEY
  });
  
  console.log('Creating public test document...');
  
  try {
    // Create a public document
    const doc = await auth.createPublicDocument('ONJS Test Document');
    console.log(`Document created: ${doc.name} (${doc.id})`);
    
    // Get default workspace
    const workspaceId = doc.defaultWorkspace?.id;
    if (!workspaceId) {
      console.error('Failed to get workspace ID');
      return;
    }
    
    // Get elements from the document
    const elements = await auth.get(
      `/documents/d/${doc.id}/w/${workspaceId}/elements`
    );
    
    // Find the part studio
    const partStudio = elements.find(elem => elem.type === 'PARTSTUDIO');
    if (!partStudio) {
      console.error('Failed to find part studio');
      return;
    }
    
    console.log('Test document setup complete:');
    console.log('Document ID:', doc.id);
    console.log('Workspace ID:', workspaceId);
    console.log('Part Studio ID:', partStudio.id);
    console.log('\nAdd these to your .env file:');
    console.log(`ONSHAPE_TEST_DOCUMENT_ID=${doc.id}`);
    console.log(`ONSHAPE_TEST_WORKSPACE_ID=${workspaceId}`);
    console.log(`ONSHAPE_TEST_ELEMENT_ID=${partStudio.id}`);
    
    // Save to a config file as well
    console.log('\nDocument URL:');
    console.log(`https://cad.onshape.com/documents/${doc.id}/w/${workspaceId}/e/${partStudio.id}`);
  } catch (error) {
    console.error('Failed to set up test document:', error.message);
    
    // Provide guidance for Free account users
    if (error.message.includes('403')) {
      console.log('\nFree account limitations:');
      console.log('1. All documents must be public');
      console.log('2. API access may be limited');
      console.log('3. You may need to create documents manually in the UI');
    }
  }
}

setupTestDocument();