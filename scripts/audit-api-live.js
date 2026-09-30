/** Auditoria somente leitura das rotas HTTP usadas pelas telas do TermoSync. */

const { readFileSync } = require('node:fs');
const path = require('node:path');

const source = readFileSync(path.resolve(__dirname, '../backend/routes/api.js'), 'utf8');
const baseUrl = process.env.API_AUDIT_BASE_URL || 'http://127.0.0.1:3001';
const username = process.env.API_AUDIT_USER;
const password = process.env.API_AUDIT_PASSWORD;
const timeoutMs = Number(process.env.API_AUDIT_TIMEOUT_MS || 20000);

const skippedStaticRoutes = new Set([
  '/api/system/backup-json',
  '/api/network-scan',
  '/api/soc/scanner/agent/iot-targets',
  '/api/soc/scanner/agent/work'
]);

function staticGetRoutes() {
  const pattern = /app\.get\(\s*(['"])([^'"]+)\1/g;
  return [...source.matchAll(pattern)]
    .map((match) => match[2])
    .filter((route) => !route.includes(':') && !skippedStaticRoutes.has(route));
}

async function request(pathname, { token, method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(new URL(pathname, baseUrl), {
      method,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();
    let payload = raw;
    if (contentType.includes('application/json') && raw) {
      try {
        payload = JSON.parse(raw);
      } catch (error) {
        throw new Error(`${pathname} retornou JSON inválido: ${error.message}`);
      }
    }
    return { path: pathname, status: response.status, durationMs: Date.now() - startedAt, payload };
  } finally {
    clearTimeout(timeout);
  }
}

async function runPool(items, worker, concurrency = 4) {
  const results = [];
  let cursor = 0;
  async function consume() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        results[index] = { path: items[index], status: 0, durationMs: timeoutMs, error: error.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, consume));
  return results;
}

function firstId(payload) {
  return Array.isArray(payload) && payload.length ? payload[0]?.id : null;
}

async function main() {
  if (!username || !password) {
    throw new Error('Defina API_AUDIT_USER e API_AUDIT_PASSWORD para executar a auditoria autenticada.');
  }

  const login = await request('/api/login', { method: 'POST', body: { usuario: username, senha: password } });
  if (login.status !== 200 || !login.payload?.token) throw new Error(`Login de auditoria falhou com HTTP ${login.status}.`);
  const token = login.payload.token;

  try {
    const routes = staticGetRoutes();
    const results = await runPool(routes, (route) => request(route, { token }));
    const byPath = new Map(results.map((result) => [result.path, result]));
    const dynamicRoutes = [
      '/api/financeiro/faturas/Todas/historico',
      '/api/user/preferences/api-audit',
      '/api/soc/scanner/jobs/Todas',
      '/api/public/live/Todas'
    ];

    const chamadoId = firstId(byPath.get('/api/chamados')?.payload);
    if (chamadoId) dynamicRoutes.push(`/api/chamados/${chamadoId}/comentarios`);
    const suporteId = firstId(byPath.get('/api/suporte/chamados')?.payload);
    if (suporteId) dynamicRoutes.push(`/api/suporte/chamados/${suporteId}/historico`);
    const equipamentoId = firstId(byPath.get('/api/equipamentos')?.payload);
    if (equipamentoId) dynamicRoutes.push(`/api/relatorios/anvisa/${equipamentoId}`);

    results.push(...await runPool(dynamicRoutes, (route) => request(route, { token })));

    const unauthorizedLogs = await request('/logs');
    const unauthorizedRoot = await request('/api/system/verify-root-passcode', {
      method: 'POST',
      body: { passcode: 'invalid-api-audit-passcode' }
    });
    if (![401, 403].includes(unauthorizedLogs.status)) {
      results.push({ ...unauthorizedLogs, error: 'Endpoint /logs aceitou acesso sem sessão DEV.' });
    }
    if (![401, 403].includes(unauthorizedRoot.status)) {
      results.push({ ...unauthorizedRoot, error: 'Validação ROOT aceitou tentativa sem sessão DEV.' });
    }

    const failures = results.filter((result) => {
      if (result.error) return true;
      if (result.path === '/api/health' || result.path === '/api/system/health') return ![200, 503].includes(result.status);
      if (result.path === '/api/user/preferences/api-audit') return ![200, 404].includes(result.status);
      return result.status < 200 || result.status >= 300;
    });
    const slow = results.filter((result) => result.durationMs >= 2000)
      .sort((left, right) => right.durationMs - left.durationMs);

    console.log(JSON.stringify({
      baseUrl,
      checked: results.length,
      passed: results.length - failures.length,
      failed: failures,
      slow: slow.map(({ path: route, status, durationMs }) => ({ path: route, status, durationMs }))
    }, null, 2));

    if (failures.length) process.exitCode = 1;
  } finally {
    await request('/api/auth/logout', { token, method: 'POST' }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(`Auditoria da API falhou: ${error.message}`);
  process.exit(1);
});

