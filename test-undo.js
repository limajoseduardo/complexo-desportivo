const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
  await page.evaluate(() => localStorage.setItem('mock_role', 'admin'));
  await page.reload({ waitUntil: "networkidle2" });
  
  // Click 'Acessos'
  const buttons = await page.$$("button");
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.innerText, btn);
    if (text.includes("Acessos")) await btn.click();
  }
  await new Promise(r => setTimeout(r, 2000));
  
  // Change filter to 'Saíram'
  const selects = await page.$$("select");
  if (selects.length > 0) {
    await selects[0].select("left");
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Find undo button
  const undoBtns = await page.$$("button[title*='desfazer']");
  console.log("Undo buttons found:", undoBtns.length);
  if (undoBtns.length > 0) {
    page.on('dialog', async dialog => {
      console.log("Dialog msg:", dialog.message());
      await dialog.accept();
    });
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await undoBtns[0].click();
    await new Promise(r => setTimeout(r, 2000));
  }
  
  await browser.close();
})();
