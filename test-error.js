const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  try {
    await page.goto('http://localhost:4174/', { waitUntil: 'networkidle0' });
    console.log('Page loaded');
    await new Promise(r => setTimeout(r, 2000));
  } catch (err) {
    console.error('Test script error:', err);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
