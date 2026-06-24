'use strict';
const puppeteer = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const USER = 'jlima';
const PASS = 'jVtS*80831416';
const BASE = 'https://srv-airc-portal.cm-viladerei.pt:8443';
const PORTAL_URL = `${BASE}/web/guest/adm.site`;

async function login(page) {
  // Navegar para adm.site — redireciona para login automaticamente
  await page.goto(PORTAL_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2000);
  const u = await page.$('input[name="_com_liferay_login_web_portlet_LoginPortlet_login"]');
  const p = await page.$('input[type="password"]');
  if (!u || !p) throw new Error('Formulário não encontrado — URL: ' + page.url());
  await u.click({ clickCount: 3 });
  await u.type(USER, { delay: 50 });
  await p.click({ clickCount: 3 });
  await p.type(PASS, { delay: 50 });
  await p.press('Enter');
  await sleep(6000);
  const url = page.url();
  if (url.includes('login%2Flogin')) throw new Error('Login falhou: ' + url);
  console.error('[OK] Login:', url);
}

async function explore(page, label) {
  await sleep(2000);
  await page.screenshot({ path: `/tmp/explore-${label}.png` });
  const baseHost = BASE.replace('https://', '');
  const data = await page.evaluate((host) => ({
    title: document.title,
    url: location.href,
    text: document.body.innerText.substring(0, 1000),
    links: Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ t: a.textContent.trim().replace(/\s+/g, ' ').substring(0, 80), h: a.href }))
      .filter(a => a.t.length > 1 && a.h.includes(host)),
    tables: Array.from(document.querySelectorAll('table')).map(t => ({
      headers: Array.from(t.querySelectorAll('th')).map(h => h.textContent.trim()),
      rows: Array.from(t.querySelectorAll('tbody tr')).slice(0, 5).map(r =>
        Array.from(r.querySelectorAll('td')).map(c => c.textContent.trim())
      ),
    })),
  }), baseHost);
  console.error(`[${label}] Título: ${data.title}`);
  console.error(`[${label}] Links (${data.links.length}): ${data.links.slice(0,5).map(l=>l.t).join(', ')}`);
  return data;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  try {
    const page = await browser.newPage();
    await page.setBypassCSP(true);
    page.setDefaultTimeout(20000);

    await login(page);

    const results = {};

    // 1. Página principal adm.site
    results['adm-site'] = await explore(page, 'adm-site');

    // 2. Clicar em "Inscrições" tab
    try {
      const inscricoes = await page.$x('//a[contains(text(),"Inscrições")] | //button[contains(text(),"Inscrições")] | //span[contains(text(),"Inscrições")]');
      if (inscricoes.length > 0) {
        await inscricoes[0].click();
        await sleep(3000);
        results['inscricoes'] = await explore(page, 'inscricoes');
      } else {
        console.error('[AVISO] Tab Inscrições não encontrado');
      }
    } catch(e) { console.error('[AVISO] Inscrições:', e.message); }

    // 3. Atendimento menu
    try {
      await page.goto(`${BASE}/web/guest/atendimento`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      results['atendimento'] = await explore(page, 'atendimento');
    } catch(e) {
      console.error('[AVISO] Atendimento:', e.message);
      results['atendimento'] = { error: e.message };
    }

    // 4. Utilizadores internet
    try {
      // Tentar clicar no link
      await page.goto(`${BASE}/web/guest/adm.site`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);
      const utilLink = await page.$('a::-p-text("Utilizadores internet")');
      if (utilLink) {
        const href = await page.evaluate(el => el.href, utilLink);
        console.error('[INFO] Utilizadores internet URL:', href);
        await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 15000 });
        results['utilizadores'] = await explore(page, 'utilizadores');
      } else {
        console.error('[AVISO] Link Utilizadores internet não encontrado');
      }
    } catch(e) {
      console.error('[AVISO] Utilizadores:', e.message);
      results['utilizadores'] = { error: e.message };
    }

    console.log(JSON.stringify(results, null, 2));

  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error('ERRO FATAL:', e.message);
  process.exit(1);
});
