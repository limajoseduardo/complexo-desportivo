const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  try {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });
    console.log('Page loaded');
    await new Promise(r => setTimeout(r, 2000));
  } catch (err) {
    console.error('Test script error:', err);
  } finally {
    await browser.close();
  }
})();
