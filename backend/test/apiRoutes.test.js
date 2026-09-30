/** Verifica contratos estruturais mínimos das rotas HTTP antes de subir o servidor. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { auditApiContract } = require('../../scripts/audit-api-contract');
const { requireRoles } = require('../middlewares/security');

const apiSource = readFileSync(path.resolve(__dirname, '../routes/api.js'), 'utf8');
const authSource = readFileSync(path.resolve(__dirname, '../middlewares/auth.js'), 'utf8');
const routePattern = /app\.(get|post|put|patch|delete)\(\s*(['"])([^'"]+)\2/g;

function listRoutes() {
  return [...apiSource.matchAll(routePattern)].map((match) => ({
    method: match[1].toUpperCase(),
    path: match[3]
  }));
}

function listRouteRegistrations() {
  const registrationPattern = /app\.(get|post|put|patch|delete)\(\s*(['"])([^'"]+)\2\s*,([\s\S]*?)=>/g;
  return [...apiSource.matchAll(registrationPattern)].map((match) => ({
    method: match[1].toUpperCase(),
    path: match[3],
    middleware: match[4]
  }));
}

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('requireRoles bloqueia perfis não autorizados e libera os permitidos', () => {
  const denyResponse = createResponseRecorder();
  let deniedNextCalls = 0;

  requireRoles('DEV')(
    { userRole: 'LOJA', security: { requestId: 'request-test' } },
    denyResponse,
    () => { deniedNextCalls += 1; }
  );

  assert.equal(denyResponse.statusCode, 403);
  assert.equal(denyResponse.body.requestId, 'request-test');
  assert.equal(deniedNextCalls, 0);

  const allowResponse = createResponseRecorder();
  let allowedNextCalls = 0;

  requireRoles('DEV')(
    { userRole: 'DEV', security: { requestId: 'request-test' } },
    allowResponse,
    () => { allowedNextCalls += 1; }
  );

  assert.equal(allowResponse.statusCode, 200);
  assert.equal(allowResponse.body, undefined);
  assert.equal(allowedNextCalls, 1);
});

test('não registra duas vezes a mesma combinação de método e caminho', () => {
  const routes = listRoutes();
  const signatures = routes.map((route) => `${route.method} ${route.path}`);
  const duplicates = signatures.filter((signature, index) => signatures.indexOf(signature) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test('endpoints auxiliares de telemetria exigem sessão DEV', () => {
  assert.match(apiSource, /app\.get\('\/logs', verificarToken, requireRoles\('DEV'\)/);
  assert.match(apiSource, /app\.post\('\/clear', verificarToken, requireRoles\('DEV'\)/);
});

test('validação da credencial root exige sessão DEV além do limitador', () => {
  assert.match(
    apiSource,
    /app\.post\('\/api\/system\/verify-root-passcode', rootPasscodeLimiter, verificarToken, requireRoles\('DEV'\)/
  );
});

test('deploy web aplica autorização e controles críticos antes do processamento', () => {
  assert.match(
    apiSource,
    /app\.post\('\/api\/system\/deploy-update', verificarToken, requireRoles\('DEV'\), rootPasscodeLimiter, requireWebDeployEnabled, upload\.single\('updatePackage'\)/
  );
  assert.match(apiSource, /Deploy não pode ser executado durante uma sessão impersonada/);
  assert.match(apiSource, /REQUIRE_DEPLOY_MFA/);
  assert.match(apiSource, /confirmacaoEsperada = `DEPLOY \$\{ambiente\}`/);
  assert.match(apiSource, /gerarBackupJson\(\{ actor: `pre-deploy:\$\{validated\.actor\}`, persistToDisk: true \}\)/);
  assert.match(apiSource, /Pacotes full-stack devem conter as pastas frontend\/ e backend\/ na raiz/);
});

test('cadastro e exclusão de equipamentos exigem perfil administrativo', () => {
  assert.match(apiSource, /app\.post\('\/api\/equipamentos', verificarToken, requireRoles\('ADMIN', 'DEV'\)/);
  assert.match(apiSource, /app\.delete\('\/api\/equipamentos\/:id', verificarToken, requireRoles\('ADMIN', 'DEV'\)/);
});

test('fluxo técnico de chamados exige manutenção, administração ou desenvolvimento', () => {
  const protectedRoutes = [
    '/api/chamados/:id/status',
    '/api/chamados/:id',
    '/api/chamados/:id/arquivar',
    '/api/chamados/:id/urgencia',
    '/api/chamados/:id/atribuir-tecnico'
  ];

  protectedRoutes.forEach((route) => {
    const escapedRoute = route.replace(/[/:]/g, (character) => `\\${character}`);
    assert.match(
      apiSource,
      new RegExp(`app\\.put\\('${escapedRoute}', verificarToken, requireRoles\\('MANUTENCAO', 'ADMIN', 'DEV'\\)`),
      `${route} deve exigir um perfil técnico`
    );
  });
});

test('cadastro de rotinas e diretório de técnicos não ficam disponíveis para loja', () => {
  assert.match(apiSource, /app\.post\('\/api\/operacao\/tarefas', verificarToken, requireRoles\('MANUTENCAO', 'ADMIN', 'DEV'\)/);
  assert.match(apiSource, /app\.delete\('\/api\/operacao\/tarefas\/:id', verificarToken, requireRoles\('MANUTENCAO', 'ADMIN', 'DEV'\)/);
  assert.match(apiSource, /app\.get\('\/api\/tecnicos', verificarToken, requireRoles\('MANUTENCAO', 'ADMIN', 'DEV'\)/);
  assert.match(apiSource, /app\.get\('\/api\/tecnicos\/ativos', verificarToken, requireRoles\('DEV'\)/);
  assert.match(apiSource, /app\.post\('\/api\/tecnicos', verificarToken, requireRoles\('DEV'\)/);
});

test('gestão de trials e conversão comercial ficam restritas ao desenvolvedor', () => {
  assert.match(
    apiSource,
    /app\.get\('\/api\/pre-cadastros\/overview', verificarToken, requireRoles\('DEV'\)/
  );
  assert.match(
    apiSource,
    /app\.patch\('\/api\/saas\/trials\/:empresa', verificarToken, requireRoles\('DEV'\)/
  );
  assert.match(
    apiSource,
    /app\.get\('\/api\/saas\/trials\/:empresa\/history', verificarToken, requireRoles\('DEV'\)/
  );
  assert.match(
    apiSource,
    /app\.delete\('\/api\/saas\/trials\/:empresa\/accounts\/:accountId', verificarToken, requireRoles\('DEV'\)/
  );
  assert.match(apiSource, /app\.delete\('\/api\/saas\/trials\/:empresa', verificarToken, requireRoles\('DEV'\)/);
  assert.match(apiSource, /app\.post\('\/api\/saas\/trials\/:empresa\/accounts\/:accountId\/reset-password', verificarToken, requireRoles\('DEV'\)/);
  assert.match(apiSource, /app\.post\('\/api\/saas\/trials\/usage', verificarToken/);
  assert.match(apiSource, /'pause', 'resume', 'reset', 'limits', 'schedule_delete', 'cancel_delete'/);
  assert.match(apiSource, /trial_auto_block = TRUE/);
  assert.match(apiSource, /DATEDIFF\(DATE\(trial_expires_at\), CURDATE\(\)\) IN \(7, 3, 1\)/);
  assert.match(apiSource, /TRIAL_EXPIRATION_WARNING_SENT/);
  assert.match(apiSource, /TRIAL_CONVERTED/);
  assert.match(apiSource, /TRIAL_NOTE/);
});

test('teste gratuito e cadastro definitivo usam contratos públicos separados', () => {
  assert.match(apiSource, /app\.post\('\/api\/pre-cadastros\/teste-gratis', preCadastroLimiter, receivePreRegistration\('TRIAL'\)\)/);
  assert.match(apiSource, /app\.post\('\/api\/pre-cadastros\/cadastro-definitivo', preCadastroLimiter, receivePreRegistration\('COMERCIAL'\)\)/);
  assert.match(apiSource, /legalVersion !== '1\.0'/);
  assert.match(apiSource, /legal_accepted_at/);
  assert.match(apiSource, /app\.post\('\/api\/pre-cadastros\/manual', verificarToken, requireRoles\('DEV'\)/);
  assert.match(apiSource, /const requestedAccess = reqData\.tipo_acesso === 'COMERCIAL' \? 'CUSTOMER' : 'TRIAL'/);
});

test('execução de tarefas pela loja permanece limitada à própria filial', () => {
  assert.match(apiSource, /req\.userRole === 'LOJA'[\s\S]*?req\.userFilial \|\| 'Matriz'/);
  assert.match(apiSource, /if \(req\.userRole === 'LOJA'\) \{ sql \+= ' AND filial = \?'; params\.push\(req\.userFilial\); \}/);
});

test('triagem de suporte e rotas legadas da sonda exigem sessão DEV', () => {
  assert.match(apiSource, /app\.put\('\/api\/suporte\/chamados\/:id', verificarToken, requireRoles\('DEV'\)/);
  assert.match(apiSource, /app\.get\('\/api\/soc\/scanner\/jobs\/:filial', verificarToken, requireRoles\('DEV'\)/);
  assert.match(apiSource, /app\.post\('\/api\/soc\/scanner\/jobs\/:id\/concluir', verificarToken, requireRoles\('DEV'\)/);
  assert.match(apiSource, /app\.post\('\/api\/soc\/scanner\/resultado', verificarToken, requireRoles\('DEV'\)/);
});

test('consultas multi-tenant não compartilham registros sem empresa ou filial', () => {
  assert.doesNotMatch(apiSource, /empresa = \? OR empresa IS NULL/);
  assert.doesNotMatch(apiSource, /filial = \? OR filial IS NULL/);
  assert.match(apiSource, /const permitidoEmpresa = ticket\[0\]\.empresa === req\.userEmpresa/);
  assert.match(apiSource, /const permitidoFilial = req\.userRole !== 'LOJA' \|\| ticket\[0\]\.filial === req\.userFilial/);
});

test('requisição protegida sem token responde 401', () => {
  assert.match(
    authSource,
    /if \(!authHeader\) return res\.status\(401\)\.json\(\{ error: 'Autenticação necessária\.'/
  );
});

test('toda rota possui autenticação explícita ou contrato público conhecido', () => {
  const publicRoutes = new Set([
    'GET /api/health',
    'GET /api/system/health',
    'GET /api/system-config/public',
    'POST /api/auth/password-reset/request',
    'POST /api/auth/password-reset/confirm',
    'POST /api/login',
    'POST /api/login/mfa',
    'POST /api/auth/impersonate/exchange',
    'POST /api/leituras',
    'POST /api/pre-cadastros/teste-gratis',
    'POST /api/pre-cadastros/cadastro-definitivo'
  ]);
  const missingAuthentication = listRouteRegistrations()
    .filter((route) => !/(verificarToken|verificarAgenteSonda)/.test(route.middleware))
    .map((route) => `${route.method} ${route.path}`)
    .filter((signature) => !publicRoutes.has(signature));

  assert.deepEqual(missingAuthentication, []);
});

test('toda chamada estática do frontend possui rota correspondente no backend', () => {
  const result = auditApiContract();
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.unresolved, []);
});
