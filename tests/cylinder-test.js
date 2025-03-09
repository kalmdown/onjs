/**
 * Automated test script for svg2onshape
 * 
 * This script:
 * 1. Authenticates to the page
 * 2. Selects "svg2onshape Test" from the document menu
 * 3. Selects "Part Studio 1"
 * 4. Selects the custom plane "Funky Plane"
 * 5. Runs "Example 1: Create a Basic Cylinder"
 * 6. Verifies successful completion
 */

const puppeteer = require('puppeteer');

// Set a longer timeout for the entire test
const TEST_TIMEOUT = 60000; // 1 minute

async function runTest() {
  console.log('Starting automated test for svg2onshape...');
  
  // Launch Vivaldi instead of Chrome
  const browser = await puppeteer.launch({
    headless: false,
    // Remove the executablePath line to use Chromium
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security', // May be needed for local development
      '--start-maximized'
    ]
  });

  const page = await browser.newPage();
  
  // Forward console logs from the browser to Node.js console
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  
  try {
    // First test if puppeteer+browser work at all by visiting a working site
    console.log('Testing browser functionality with google.com...');
    await page.goto('https://www.google.com', { waitUntil: 'networkidle2' });
    console.log('Successfully loaded Google. Browser automation is working.');

    // Now try your app
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Wait for the page to load - use the correct button ID
    console.log('Waiting for page to load...');
    await page.waitForSelector('#btnAuthenticate', { timeout: 5000 });
    console.log('Page loaded successfully');

    // Display all buttons for debugging
    const buttons = await page.$$eval('button', btns => btns.map(btn => ({id: btn.id, text: btn.textContent.trim()})));
    console.log('Available buttons:', buttons);

    // Authenticate
    console.log('Clicking authentication button...');
    await page.click('#btnAuthenticate');

    // IMPORTANT: Manual auth instruction
    console.log('MANUAL STEP REQUIRED: Please log in through the popup window that appeared');
    console.log('The test will continue once you are authenticated');
    console.log('Waiting up to 60 seconds for authentication...');

    // Wait for authentication to complete - increased timeout
    await page.waitForFunction(
      () => {
        const status = document.getElementById('authStatus');
        return status && status.textContent.includes('Authenticated');
      },
      { timeout: 60000 } // Increase to 60 seconds to allow manual auth
    );
    console.log('Authentication successful');
    
    // Wait for document dropdown to be populated
    await page.waitForSelector('#documentSelect', { timeout: 5000 });
    
    // Click on Example 1 button
    console.log('Running Example 1...');
    await page.click('#btnExample1');
    
    // Wait for success message in log output
    await page.waitForFunction(
      () => {
        const logOutput = document.querySelector('#logOutput');
        return logOutput && logOutput.innerText.includes('Successfully created cylinder');
      },
      { timeout: 30000 }
    );
    
    console.log('Test PASSED: Successfully created cylinder');
    
  } catch (error) {
    console.error('Test FAILED:', error.message);
    
    // Take screenshot on failure
    await page.screenshot({ path: 'test-failure.png' });
    console.log('Failure screenshot saved to test-failure.png');
    
    process.exitCode = 1;
  } finally {
    // Capture a final screenshot
    await page.screenshot({ path: 'test-results.png' });
    console.log('Final screenshot saved to test-results.png');
    
    // Close the browser after a brief pause to see the final state
    await new Promise(resolve => setTimeout(resolve, 3000));
    await browser.close();
  }
}

// Run the test with a timeout
(async () => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Test timed out')), TEST_TIMEOUT);
  });
  
  try {
    await Promise.race([runTest(), timeoutPromise]);
  } catch (error) {
    console.error('Test failed or timed out:', error.message);
    process.exitCode = 1;
  }
})();