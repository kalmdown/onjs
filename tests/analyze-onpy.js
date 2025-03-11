/**
 * Analyze onpy API calls to find patterns
 */
const fs = require('fs');
const path = require('path');

// Read the onpy test file
const onpyTestsPath = path.join(__dirname, '../other/onpy/TESTS_API_CALLS.txt');

try {
  console.log(`Reading file: ${onpyTestsPath}`);
  const content = fs.readFileSync(onpyTestsPath, 'utf8');
  
  console.log('\nAnalyzing onpy API calls...');
  
  // Look for patterns in headers, URLs, etc.
  const requestLines = content.match(/^(GET|POST|DELETE|PUT) .+/gm) || [];
  console.log(`Found ${requestLines.length} API requests`);
  
  // Look for auth headers
  const authLines = content.match(/^Authorization: .+/gm) || [];
  console.log(`Found ${authLines.length} auth headers`);
  
  // Look for date headers
  const dateLines = content.match(/^Date: .+/gm) || [];
  console.log(`Found ${dateLines.length} date headers`);
  
  // Find create document calls
  const createDocCalls = content.match(/POST.*\/documents/g) || [];
  console.log(`Found ${createDocCalls.length} document creation calls`);
  
  // Extract some examples for reference
  if (createDocCalls.length > 0) {
    console.log('\nDocument creation examples:');
    createDocCalls.slice(0, 3).forEach((call, i) => {
      const callIndex = content.indexOf(call);
      const example = content.substring(callIndex, callIndex + 500); // Show a portion
      console.log(`\nExample ${i+1}:`);
      console.log(example.substring(0, example.indexOf('\n\n') > 0 ? example.indexOf('\n\n') : example.length));
    });
  }
  
  // Extract auth header examples
  if (authLines.length > 0) {
    console.log('\nAuth header examples:');
    authLines.slice(0, 3).forEach((header, i) => {
      console.log(`Example ${i+1}: ${header}`);
    });
  }
  
  // Analyze URL paths
  console.log('\nURL path patterns:');
  const paths = requestLines
    .map(line => line.split(' ')[1])
    .filter(Boolean);
  
  const pathsWithSlash = paths.filter(p => p.startsWith('/'));
  console.log(`Paths starting with slash: ${pathsWithSlash.length} of ${paths.length}`);
  
  console.log('\nAnalysis complete!');
} catch (error) {
  console.error('Error analyzing onpy file:', error.message);
}