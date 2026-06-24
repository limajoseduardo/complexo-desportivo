/**
 * portal-sync.cjs
 * Script de sincronização com o Portal Municipal de Vila de Rei
 * Extrai dados dos utentes para preencher perfis no Complexo Desportivo
 *
 * Uso:
 *   node scripts/portal-sync.cjs --user <utilizador> --pass <password> --search <nome|nif|cc>
 *   node scripts/portal-sync.cjs --user <utilizador> --pass <password> --batch <caminho_para_json>
 *
 * Saída: JSON com dados do utente no stdout
 */

'use strict';

const puppeteer = require('puppeteer');
const https = require('https');
const http = require('http');

const PORTAL_URL = 'https://srv-airc-portal.cm-viladerei.pt:8443/web/guest/adm.site';
const LOGIN_URL = 'https://srv-airc-portal.cm-viladerei.pt:8443/c/portal/login';

// Mapeia campos do portal para campos do sistema do complexo
const FIELD_MAP = {
  nome: 'nome',
  nif: 'nif',
  data_nasc: 'data_nasc',
  cc: 'cc',
  cc_validade: 'cc_validade',
  num_utente: 'num_utente',
  telefone: 'telefone',
  telemovel: 'telemovel',
  endereco: 'endereco',
  cod_postal: 'cod_postal',
  localidade: 'localidade',
  cartao_municipal: 'cartao_municipal',
  cartao_tipo: 'cartao_tipo',
  cartao_numero: 'cartao_numero',
  cartao_validade: 'cartao_validade',
  municipio_cartao: 'municipio_cartao',
};

// Helper: sleep compatível com Puppeteer v22+
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      result[args[i].slice(2)] = args[i + 1] || true;
      i++;
    }
  }
  return result;
}

/**
 * Faz login no portal municipal (Liferay 7) e devolve a sessão (browser + page)
 */
async function loginPortal(browser, username, password) {
  const page = await browser.newPage();

  // Ignorar erros de certificado SSL auto-assinado
  await page.setBypassCSP(true);

  // Navegar para a página de login do portal
  await page.goto(PORTAL_URL, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  const currentUrl = page.url();
  console.error(`[INFO] URL inicial: ${currentUrl}`);

  // Aguardar um pouco para o Liferay carregar completamente
  await sleep(2000);

  // ─── ESTRATÉGIA 1: Seletores Liferay 7 (namespace completo) ───
  // Liferay 7 usa o nome completo do portlet como prefixo dos campos
  const liferay7Selectors = [
    // Namespace Liferay 7 com portlet completo
    {
      user: 'input[name="_com_liferay_login_web_portlet_LoginPortlet_login"]',
      pass: 'input[name="_com_liferay_login_web_portlet_LoginPortlet_password"]',
    },
    // ID baseado no namespace Liferay 7
    {
      user: '#_com_liferay_login_web_portlet_LoginPortlet_login',
      pass: '#_com_liferay_login_web_portlet_LoginPortlet_password',
    },
    // Liferay 6 / versões antigas (portlet ID numérico)
    { user: '#_58_login',      pass: '#_58_password' },
    { user: '#_82_login',      pass: '#_82_password' },
    { user: '#_3_login',       pass: '#_3_password' },
    // Genérico por atributo
    { user: 'input[name*="_login"][type!="hidden"]', pass: 'input[name*="_password"][type="password"]' },
    { user: 'input[id*="login"]:not([type="hidden"])', pass: 'input[id*="password"]' },
    // Muito genérico
    { user: 'input[type="text"]', pass: 'input[type="password"]' },
    { user: 'input[autocomplete="username"]', pass: 'input[autocomplete="current-password"]' },
  ];

  let filled = false;
  for (const sel of liferay7Selectors) {
    try {
      const userInput = await page.$(sel.user);
      const passInput = await page.$(sel.pass);
      if (userInput && passInput) {
        console.error(`[INFO] Formulário encontrado com: ${sel.user}`);

        // Limpar e preencher utilizador
        await userInput.click({ clickCount: 3 });
        await userInput.type(username, { delay: 60 });

        // Limpar e preencher password
        await passInput.click({ clickCount: 3 });
        await passInput.type(password, { delay: 60 });

        filled = true;
        console.error('[INFO] Campos preenchidos.');
        break;
      }
    } catch (e) {
      // Continua para o próximo seletor
    }
  }

  if (!filled) {
    // Debug: mostrar todos os inputs encontrados na página
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(el => ({
        type: el.type, name: el.name, id: el.id, placeholder: el.placeholder
      }));
    });
    console.error('[DEBUG] Inputs encontrados:', JSON.stringify(inputs));
    throw new Error('Não foi possível encontrar o formulário de login na página.');
  }

  // ─── SUBMETER O FORMULÁRIO ───
  // Para Liferay, pressionar Enter no campo password é mais fiável
  try {
    const passInputForSubmit = await page.$('input[type="password"]');
    if (passInputForSubmit) {
      console.error('[INFO] A submeter com Enter no campo password...');
      await passInputForSubmit.press('Enter');
    } else {
      // Fallback: clicar no botão
      const submitBtn = await page.$('button[type="submit"], .btn-primary');
      if (submitBtn) {
        console.error('[INFO] A clicar no botão Iniciar sessão...');
        await submitBtn.click();
      }
    }
  } catch (e) {
    console.error(`[AVISO] Erro na submissão: ${e.message}`);
  }

  // Aguardar 6 segundos para a página reagir (Liferay pode ser lento)
  console.error('[INFO] A aguardar resposta do portal...');
  await sleep(6000);

  const afterUrl = page.url();
  console.error(`[INFO] URL após login: ${afterUrl}`);

  // Tirar screenshot sempre para debug
  await page.screenshot({ path: '/tmp/login-after.png' });
  console.error('[DEBUG] Screenshot guardado: /tmp/login-after.png');

  // Capturar mensagens de erro da página
  const pageInfo = await page.evaluate(() => {
    const errorEl = document.querySelector(
      '.portlet-msg-error, .alert-danger, .alert-error, [class*="error"]:not(script), .login-error, .portlet-msg-alert'
    );
    const passField = document.querySelector('input[type="password"]');
    const isOnLoginPage = !!(passField && passField.offsetParent !== null);
    return {
      errorMessage: errorEl ? errorEl.textContent?.trim().substring(0, 200) : null,
      isOnLoginPage,
      pageTitle: document.title,
      bodyText: document.body.innerText.substring(0, 300),
    };
  });

  console.error('[DEBUG] Info da página:', JSON.stringify(pageInfo));

  if (pageInfo.isOnLoginPage) {
    await page.screenshot({ path: '/tmp/login-debug.png' });
    if (pageInfo.errorMessage) {
      throw new Error(`Login falhou — Portal diz: "${pageInfo.errorMessage}"`);
    }
    // Verificar se a URL mudou pelo menos
    if (afterUrl === PORTAL_URL || afterUrl.includes('login%2Flogin')) {
      throw new Error(
        'Login falhou — O portal não aceitou as credenciais. ' +
        'Possíveis causas: (1) password incorreta, (2) acesso só dentro da rede municipal, ' +
        '(3) conta bloqueada. Tenta fazer login manualmente no browser para confirmar.'
      );
    }
  }

  console.error('[OK] Login efetuado com sucesso!');
  return page;

}


/**
 * Extrai todos os dados possíveis de um utente a partir de uma página de detalhe
 */
async function extractUtenteData(page) {
  return await page.evaluate(() => {
    const data = {};
    const text = (el) => (el ? el.textContent.trim() : '');
    const val = (el) => (el ? el.value.trim() : '');

    // Tentar extrair de formulários/inputs
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach((inp) => {
      const name = (inp.name || inp.id || '').toLowerCase();
      const value = inp.tagName === 'SELECT'
        ? inp.options[inp.selectedIndex]?.text || inp.value
        : inp.value;

      if (!value || value.trim() === '') return;

      // Mapeamento de nomes de campos comuns em portais Liferay/AIRC
      if (/nome|name/i.test(name) && !/username|user_name/i.test(name)) data.nome = value;
      if (/nif|contribuinte|fiscal/i.test(name)) data.nif = value;
      if (/nascimento|birth|nasc/i.test(name)) data.data_nasc = value;
      if (/cartao.cidadao|citizen|cc_num|bi_num|bilhete/i.test(name)) data.cc = value;
      if (/validade.cc|cc_val|bi_val/i.test(name)) data.cc_validade = value;
      if (/utente|sns|saude|health/i.test(name)) data.num_utente = value;
      if (/telef|phone|fixo/i.test(name) && !/tel[eé]m/i.test(name)) data.telefone = value;
      if (/telem|mobile|celular/i.test(name)) data.telemovel = value;
      if (/morada|endereco|address|rua|street/i.test(name)) data.endereco = value;
      if (/postal|zip|codigo.postal/i.test(name)) data.cod_postal = value;
      if (/localidade|cidade|city|locality/i.test(name)) data.localidade = value;
      if (/cartao.municipal|municipio|cartao_tipo/i.test(name)) data.cartao_tipo = value;
      if (/num.*cartao|cartao.*num|card.*num/i.test(name)) data.cartao_numero = value;
      if (/val.*cartao|cartao.*val|card.*exp/i.test(name)) data.cartao_validade = value;
    });

    // Tentar extrair de labels e seus textos adjacentes (tabelas de detalhe)
    const rows = document.querySelectorAll('tr, .field-row, .form-row, dl dt, .detail-label');
    rows.forEach((row) => {
      const label = (row.querySelector('th, dt, label, .label, .field-label') || row).textContent.toLowerCase().trim();
      const valueEl = row.querySelector('td, dd, .value, .field-value, span:not(.label)');
      const value = valueEl ? valueEl.textContent.trim() : '';

      if (!value) return;

      if (/nome completo|full name/i.test(label)) data.nome = data.nome || value;
      if (/nif|contribuinte|n[uú]mero fiscal/i.test(label)) data.nif = data.nif || value;
      if (/data.*nasc|nascimento|data de nasc/i.test(label)) data.data_nasc = data.data_nasc || value;
      if (/cart[aã]o.*cidad|cc|bilhete/i.test(label)) data.cc = data.cc || value;
      if (/validade.*cc|validade.*bi|validade.*cartao/i.test(label)) data.cc_validade = data.cc_validade || value;
      if (/n[uú]mero.*utente|utente.*sns|n[uú]mero.*sns/i.test(label)) data.num_utente = data.num_utente || value;
      if (/telef[oe]ne|telefone fixo/i.test(label)) data.telefone = data.telefone || value;
      if (/telem[oó]vel|m[oó]vel/i.test(label)) data.telemovel = data.telemovel || value;
      if (/morada|endere[cç]o|rua|address/i.test(label)) data.endereco = data.endereco || value;
      if (/c[oó]digo postal|cp|zip/i.test(label)) data.cod_postal = data.cod_postal || value;
      if (/localidade|concelho|cidade/i.test(label)) data.localidade = data.localidade || value;
      if (/tipo.*cart[aã]o|cart[aã]o.*tipo/i.test(label)) data.cartao_tipo = data.cartao_tipo || value;
      if (/n[uú]mero.*cart[aã]o|cart[aã]o.*n[uú]mero/i.test(label)) data.cartao_numero = data.cartao_numero || value;
      if (/validade.*cart[aã]o|cart[aã]o.*validade/i.test(label)) data.cartao_validade = data.cartao_validade || value;
    });

    // Tentar extrair de listas de definições (dl/dt/dd)
    document.querySelectorAll('dl').forEach((dl) => {
      const dts = dl.querySelectorAll('dt');
      const dds = dl.querySelectorAll('dd');
      dts.forEach((dt, i) => {
        const label = dt.textContent.toLowerCase().trim();
        const value = dds[i] ? dds[i].textContent.trim() : '';
        if (!value) return;

        if (/nome/i.test(label)) data.nome = data.nome || value;
        if (/nif|contribuinte/i.test(label)) data.nif = data.nif || value;
        if (/nasc/i.test(label)) data.data_nasc = data.data_nasc || value;
        if (/cart[aã]o.*cidad|cc/i.test(label)) data.cc = data.cc || value;
        if (/telef.*fixo|telefone(?!.*m)/i.test(label)) data.telefone = data.telefone || value;
        if (/telem/i.test(label)) data.telemovel = data.telemovel || value;
        if (/morada|endere/i.test(label)) data.endereco = data.endereco || value;
        if (/c[oó]d.*postal|cp/i.test(label)) data.cod_postal = data.cod_postal || value;
        if (/localidade/i.test(label)) data.localidade = data.localidade || value;
      });
    });

    // Capturar HTML da página para debug
    data._pageTitle = document.title;
    data._pageUrl = window.location.href;

    return data;
  });
}

/**
 * Pesquisa um utente no portal por nome, NIF ou CC
 */
async function searchUtente(page, searchTerm) {
  console.error(`[INFO] A pesquisar utente: "${searchTerm}"`);

  // Tentar encontrar campo de pesquisa
  const searchSelectors = [
    'input[name="keywords"]',
    'input[placeholder*="pesquis" i]',
    'input[placeholder*="search" i]',
    'input[placeholder*="nome" i]',
    'input[placeholder*="nif" i]',
    '#search-input',
    '.search-input',
    'input[type="search"]',
    'input[name="q"]',
  ];

  let searchInput = null;
  for (const sel of searchSelectors) {
    searchInput = await page.$(sel);
    if (searchInput) {
      console.error(`[INFO] Campo de pesquisa encontrado: ${sel}`);
      break;
    }
  }

  if (!searchInput) {
    // Tentar navegar para uma página de pesquisa específica do AIRC
    const searchUrls = [
      page.url().replace(/\/[^\/]*$/, '/pesquisa'),
      page.url() + '?keywords=' + encodeURIComponent(searchTerm),
    ];

    for (const url of searchUrls) {
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
        searchInput = await page.$('input[name="keywords"], input[type="search"]');
        if (searchInput) break;
      } catch (e) { /* continua */ }
    }
  }

  if (searchInput) {
    await searchInput.click({ clickCount: 3 });
    await searchInput.type(searchTerm, { delay: 50 });

    // Submeter pesquisa
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      searchInput.press('Enter'),
    ]);
  }

  // Aguardar resultados
  await sleep(1500);

  // Extrair lista de resultados
  const results = await page.evaluate((term) => {
    const links = Array.from(document.querySelectorAll('a, button, tr[onclick], .result-item, .list-item'));
    const matches = links.filter(el => {
      const text = el.textContent.toLowerCase();
      return text.includes(term.toLowerCase().substring(0, 4));
    });

    return matches.map(el => ({
      text: el.textContent.trim().substring(0, 100),
      href: el.href || el.getAttribute('onclick') || '',
      tag: el.tagName,
    }));
  }, searchTerm);

  console.error(`[INFO] Encontrados ${results.length} resultados possíveis.`);
  return results;
}

/**
 * Extrai a lista completa de utentes da página atual
 */
async function extractUtentesList(page) {
  console.error('[INFO] A extrair lista de utentes...');

  // Tirar screenshot para debug
  await page.screenshot({ path: '/tmp/portal-debug.png' });
  console.error('[DEBUG] Screenshot guardado em /tmp/portal-debug.png');

  const listData = await page.evaluate(() => {
    const results = [];

    // Tentar extrair de tabelas
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      const rows = table.querySelectorAll('tr:not(:first-child)'); // Ignorar header
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const rowData = {
            text: row.textContent.trim(),
            cells: Array.from(cells).map(c => c.textContent.trim()),
            link: row.querySelector('a')?.href || '',
          };
          results.push(rowData);
        }
      });
    });

    // Tentar extrair de listas
    if (results.length === 0) {
      const listItems = document.querySelectorAll('li a, .list-item, .result-row');
      listItems.forEach(item => {
        results.push({
          text: item.textContent.trim(),
          link: item.href || item.querySelector('a')?.href || '',
          cells: [],
        });
      });
    }

    return {
      items: results.slice(0, 100), // Máximo 100 resultados
      pageTitle: document.title,
      pageUrl: window.location.href,
      totalText: document.body.innerText.substring(0, 500),
    };
  });

  return listData;
}

/**
 * Navega para a ficha de um utente e extrai todos os dados
 */
async function getUtenteDetails(page, link) {
  if (!link) return null;

  try {
    if (link.startsWith('http')) {
      await page.goto(link, { waitUntil: 'networkidle2', timeout: 15000 });
    } else {
      await page.click(`a[href="${link}"]`).catch(() => {});
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    }

    await sleep(1000);
    return await extractUtenteData(page);
  } catch (e) {
    console.error(`[ERRO] Falha ao aceder à ficha: ${e.message}`);
    return null;
  }
}

async function main() {
  const args = parseArgs();

  if (!args.user || !args.pass) {
    console.error('Uso: node portal-sync.cjs --user <utilizador> --pass <password> [--search <termo>] [--list]');
    console.error('  --search <termo>    Pesquisa um utente por nome/NIF/CC');
    console.error('  --list              Lista todos os utentes disponíveis na página atual');
    console.error('  --url <url>         URL específico a visitar após login');
    process.exit(1);
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      ignoreHTTPSErrors: true, // Aceitar certificados auto-assinados
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
      ],
    });

    const page = await loginPortal(browser, args.user, args.pass);

    // Se especificado URL, navegar para lá
    if (args.url) {
      await page.goto(args.url, { waitUntil: 'networkidle2', timeout: 20000 });
      await sleep(1000);
    }

    let output = {};

    if (args.search) {
      // Modo: pesquisar utente específico
      const results = await searchUtente(page, args.search);
      output = { mode: 'search', query: args.search, results };

      // Se encontrou exatamente um resultado com link, ir buscar detalhes
      if (results.length === 1 && results[0].link) {
        const details = await getUtenteDetails(page, results[0].link);
        if (details) {
          output.details = details;
        }
      }
    } else if (args.list || !args.search) {
      // Modo: listar utentes
      const listData = await extractUtentesList(page);
      output = { mode: 'list', ...listData };
    }

    // Output em JSON para stdout (para a app consumir)
    console.log(JSON.stringify(output, null, 2));

  } catch (err) {
    console.error(`[ERRO FATAL] ${err.message}`);
    console.log(JSON.stringify({ error: err.message, stack: err.stack }));
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

main();
