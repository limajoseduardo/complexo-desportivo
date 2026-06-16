const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:5173/admin/logs');
  await new Promise(r => setTimeout(r, 3000));
  // Find and click the download PDF button
  // "Exportar PDF" button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const pdfBtn = buttons.find(b => b.textContent.includes('PDF'));
    if (pdfBtn) {
      pdfBtn.click();
    } else {
      console.log('PDF button not found');
    }
  });
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
