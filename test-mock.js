const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  try {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });
    
    // Simulate login by setting localStorage
    await page.evaluate(() => {
      localStorage.setItem('cpx_test_login', JSON.stringify({
        id: "mock123",
        role: "utente",
        n: "Test User",
        isInside: true,
        termo_imagens: true,
        termo_responsabilidade: true
      }));
    });
    
    // We would need App.tsx to read this mock, but let's just see if any error shows up normally.
    await new Promise(r => setTimeout(r, 2000));
  } catch (err) {
    console.error('Test script error:', err);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
