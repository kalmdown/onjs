// Simple script to debug the module structure
console.log("Debugging OnJS module structure");

try {
  const onjs = require('../src/index');
  console.log("Index exports:", Object.keys(onjs));
  
  // Try different potential client paths
  const paths = [
    '../src/client',
    '../src/api/client',
    '../src/utils/client',
    '../src/onshape/client',
  ];
  
  paths.forEach(path => {
    try {
      const module = require(path);
      console.log(`Found module at ${path}:`, typeof module);
      if (typeof module === 'function') {
        console.log("  - Is constructor:", !!module.prototype);
      } else if (typeof module === 'object') {
        console.log("  - Exports:", Object.keys(module));
      }
    } catch(e) {
      console.log(`No module at ${path}`);
    }
  });
  
} catch(e) {
  console.error("Error importing index:", e);
}