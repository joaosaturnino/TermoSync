/** Auditoria autenticada e somente leitura das telas registradas na navegação. */
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer');

const baseUrl = process.env.UI_AUDIT_BASE_URL || 'https://thermosync.com.br';
const apiUrl = process.env.UI_AUDIT_API_URL || 'http://127.0.0.1:3001';
const username = process.env.UI_AUDIT_USER;
const password = process.env.UI_AUDIT_PASSWORD;
const executablePath = process.env.UI_AUDIT_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function login() {
  const response = await fetch(`${apiUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: username, senha: password })
  });
  const data = await response.json();
  if (!response.ok || !data.token) throw new Error(`Login da auditoria falhou com HTTP ${response.status}.`);
  return data;
}

async function main() {
  if (!username || !password) {
    throw new Error('Defina UI_AUDIT_USER e UI_AUDIT_PASSWORD para executar a auditoria autenticada.');
  }

  const auth = await login();
  const navigationPath = path.resolve(__dirname, '../frontend/src/config/navigationPolicy.js');
  const { SCREEN_PATHS, DEV_WORKSPACE_IDS } = await import(pathToFileURL(navigationPath).href);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    acceptInsecureCerts: true,
    args: ['--disable-gpu', '--no-first-run']
  });

  const failures = [];
  const results = [];
  let activeRoute = '';

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on('pageerror', (error) => failures.push({ route: activeRoute, type: 'javascript', error: error.message }));
    page.on('response', (response) => {
      if (response.status() >= 500) failures.push({ route: activeRoute, type: 'http', status: response.status(), url: response.url() });
    });

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.evaluate((session) => {
      sessionStorage.setItem('token', session.token);
      sessionStorage.setItem('userId', String(session.id));
      sessionStorage.setItem('userRole', session.role || 'DEV');
      sessionStorage.setItem('userFilial', session.filial || 'Todas');
      sessionStorage.setItem('userEmpresa', session.empresa || '');
      sessionStorage.setItem('nomeLogado', session.nome || 'Auditoria');
      sessionStorage.setItem('papelLogado', 'SysAdmin / Root');
      sessionStorage.setItem('loginAtivo', session.usuario || 'api-audit');
      sessionStorage.setItem('devAuth', 'true');
      sessionStorage.setItem('terminalLocked', 'false');
    }, auth);

    for (const [screenId, slug] of Object.entries(SCREEN_PATHS)) {
      const prefix = DEV_WORKSPACE_IDS.has(screenId) ? 'dev' : 'sistema';
      activeRoute = `/${prefix}/${slug}`;
      const startedAt = Date.now();
      const response = await page.goto(`${baseUrl}${activeRoute}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await delay(250);
      await page.waitForFunction(
        () => !document.querySelector('.ts-loader-container'),
        { timeout: 8000 }
      ).catch(() => {});
      const state = await page.evaluate(() => ({
        textLength: document.body?.innerText?.trim().length || 0,
        hasErrorScreen: Boolean(document.querySelector('.system-error-screen')),
        title: document.querySelector('main h1')?.textContent?.trim() || document.title
      }));
      const result = { route: activeRoute, status: response?.status() || 0, durationMs: Date.now() - startedAt, ...state };
      results.push(result);
      if (result.status >= 400 || result.textLength === 0 || result.hasErrorScreen) {
        failures.push({ ...result, type: result.hasErrorScreen ? 'error-screen' : 'render' });
      }
    }

    const uniqueFailures = [...new Map(failures.map((failure) => [JSON.stringify(failure), failure])).values()];
    console.log(JSON.stringify({
      baseUrl,
      checked: results.length,
      passed: results.length - new Set(uniqueFailures.map((item) => item.route)).size,
      failed: uniqueFailures,
      slow: results.filter((item) => item.durationMs >= 3000)
    }, null, 2));
    if (uniqueFailures.length) process.exitCode = 1;
  } finally {
    await browser.close();
    await fetch(`${apiUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` }
    }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(`Auditoria das telas falhou: ${error.message}`);
  process.exit(1);
});
