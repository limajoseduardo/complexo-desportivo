/**
 * portal-proxy.cjs
 * Servidor Express local que serve como ponte entre a app React (browser)
 * e o script Puppeteer de scraping do portal municipal.
 *
 * A app React não pode executar scripts Node.js diretamente (CORS/segurança),
 * então este servidor local aceita pedidos da app e executa o puppeteer.
 *
 * Uso: node scripts/portal-proxy.cjs
 * O servidor fica ativo em http://localhost:3101
 */

'use strict';

const http = require('http');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3101;
const SYNC_SCRIPT = path.join(__dirname, 'portal-sync.cjs');

// Verificar se o script de sync existe
if (!fs.existsSync(SYNC_SCRIPT)) {
  console.error(`[ERRO] Script não encontrado: ${SYNC_SCRIPT}`);
  process.exit(1);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    sendJSON(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    return;
  }

  // Endpoint principal: /api/portal-sync
  if (req.method === 'POST' && req.url === '/api/portal-sync') {
    let body;
    try {
      body = await parseBody(req);
    } catch {
      sendJSON(res, 400, { error: 'Corpo do pedido inválido' });
      return;
    }

    const { username, password, search } = body;

    if (!username || !password) {
      sendJSON(res, 400, { error: 'Utilizador e palavra-passe são obrigatórios' });
      return;
    }

    console.log(`[${new Date().toLocaleTimeString('pt-PT')}] Pedido de sync: "${search || 'list'}"`);

    // Construir argumentos do script
    const args = [
      SYNC_SCRIPT,
      '--user', username,
      '--pass', password,
    ];

    if (search && search !== '__test__') {
      args.push('--search', search);
    } else if (search === '__test__') {
      // Modo de teste: apenas verificar login
      args.push('--list');
    } else {
      args.push('--list');
    }

    // Executar script Puppeteer
    const child = spawn('node', args, {
      timeout: 90000, // 90 segundos
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' }, // Aceitar SSL auto-assinado
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => {
      stderr += data.toString();
      // Mostrar logs do Puppeteer em tempo real
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      console.log(`[${new Date().toLocaleTimeString('pt-PT')}] Script concluído (código ${code})`);

      if (code !== 0 && !stdout) {
        const errMsg = stderr.split('\n').filter(l => l.includes('[ERRO')).join('; ') || 'Erro desconhecido';
        sendJSON(res, 500, { error: errMsg, stderr: stderr.substring(0, 500) });
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          sendJSON(res, 422, result);
        } else {
          sendJSON(res, 200, result);
        }
      } catch {
        sendJSON(res, 500, {
          error: 'Resposta inválida do script',
          raw: stdout.substring(0, 200),
          stderr: stderr.substring(0, 200)
        });
      }
    });

    child.on('error', (err) => {
      console.error('[ERRO] Falha ao executar script:', err.message);
      sendJSON(res, 500, { error: `Falha ao executar o script: ${err.message}` });
    });

    return;
  }

  // 404
  sendJSON(res, 404, { error: 'Rota não encontrada' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║       Proxy do Portal Municipal - Vila de Rei         ║');
  console.log(`║       Ativo em http://localhost:${PORT}               ║`);
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  A aguardar pedidos da app do Complexo Desportivo...');
  console.log('  Para parar: Ctrl+C');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[ERRO] A porta ${PORT} já está em uso. O proxy já está a correr?`);
  } else {
    console.error('[ERRO] Erro no servidor:', err.message);
  }
  process.exit(1);
});
