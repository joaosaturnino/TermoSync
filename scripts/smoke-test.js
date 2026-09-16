const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Executa a etapa read env value usada em verificacoes ou automacoes do projeto.
 */
function readEnvValue(key) {
  const envPath = path.resolve(__dirname, '..', 'backend', '.env');
  if (!fs.existsSync(envPath)) return '';
  const line = fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '') : '';
}

const detectedPort = process.env.PORT || readEnvValue('PORT') || '3000';
const baseUrl = process.env.SMOKE_BASE_URL || process.env.API_BASE_URL || `http://localhost:${detectedPort}`;
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 8000);

/**
 * Executa a etapa request json usada em verificacoes ou automacoes do projeto.
 */
function requestJson(pathname) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, baseUrl);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, { method: 'GET', timeout: timeoutMs }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let body = null;
        try { body = raw ? JSON.parse(raw) : null; } catch (error) { return reject(new Error(`${pathname} retornou JSON invalido: ${error.message}`)); }
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('timeout', () => req.destroy(new Error(`${pathname} excedeu ${timeoutMs}ms`)));
    req.on('error', reject);
    req.end();
  });
}

/**
 * Executa a etapa main usada em verificacoes ou automacoes do projeto.
 */
async function main() {
  console.log(`TermoSync smoke test: ${baseUrl}`);
  const health = await requestJson('/api/health');
  if (![200, 503].includes(health.status)) {
    throw new Error(`/api/health retornou HTTP ${health.status}`);
  }
  if (!health.body || typeof health.body.ok !== 'boolean') {
    throw new Error('/api/health nao retornou payload esperado.');
  }

  const systemHealth = await requestJson('/api/system/health');
  if (![200, 503].includes(systemHealth.status)) {
    throw new Error(`/api/system/health retornou HTTP ${systemHealth.status}`);
  }
  if (!systemHealth.body || typeof systemHealth.body.ok !== 'boolean') {
    throw new Error('/api/system/health nao retornou payload esperado.');
  }

  console.log(`Health: ${health.body.ok ? 'OK' : 'DEGRADADO'}`);
  console.log(`System health: ${systemHealth.body.ok ? 'OK' : 'DEGRADADO'}`);
  console.log('Smoke test concluido.');
}

main().catch((error) => {
  console.error(`Smoke test falhou: ${error.message || error.code || String(error)}`);
  process.exit(1);
});
