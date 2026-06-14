const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  // Listen to console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  console.log('Navigating to http://localhost:3101');
  await page.goto('http://localhost:3101', { waitUntil: 'networkidle2' });

  console.log('Waiting for the tabs to render...');
  await page.waitForSelector('button');
  
  // Find the button with text "Relatórios & Estatísticas"
  const buttons = await page.$$('button');
  let targetButton = null;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Relatórios & Estatísticas') || text.includes('Estatísticas')) {
      targetButton = btn;
      break;
    }
  }

  if (targetButton) {
    console.log('Clicking the "Relatórios & Estatísticas" tab...');
    await targetButton.click();
    console.log('Clicked. Waiting a bit to catch errors...');
    await page.waitForTimeout(2000); // Wait 2s for crash
  } else {
    console.log('Could not find the tab button.');
  }

  await browser.close();
})();
