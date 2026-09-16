const crypto = require('crypto');

const requestBuckets = new Map();
const failedLoginBuckets = new Map();

// Matriz simples de permissões por papel. Rotas sensíveis devem preferir
// requirePermission/requireRoles em vez de checagens soltas dentro do handler.
const ROLE_PERMISSIONS = {
  DEV: ['*'],
  ADMIN: [
    'empresas:read',
    'lojas:manage',
    'usuarios:manage',
    'equipamentos:manage',
    'notificacoes:manage',
    'chamados:manage',
    'operacao:manage',
    'relatorios:read'
  ],
  MANUTENCAO: [
    'equipamentos:read',
    'hardware:command',
    'notificacoes:manage',
    'chamados:manage',
    'operacao:read',
    'relatorios:read'
  ],
  LOJA: [
    'equipamentos:read',
    'notificacoes:manage',
    'chamados:manage',
    'operacao:read',
    'relatorios:read'
  ]
};

/**
 * Executa o middleware get Client Ip antes da rota continuar.
 */
function getClientIp(req) {
  // Em proxy/reverse proxy, x-forwarded-for contém uma cadeia de IPs.
  // O primeiro item representa o cliente original.
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'Desconhecido';
}

/**
 * Executa o middleware get User Agent antes da rota continuar.
 */
function getUserAgent(req) {
  return String(req.headers['user-agent'] || 'Desconhecido').slice(0, 500);
}

/**
 * Executa o middleware add Security Headers antes da rota continuar.
 */
function addSecurityHeaders(req, res, next) {
  // Headers defensivos padrão para reduzir exposição a sniffing, clickjacking
  // e permissões inesperadas no navegador.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cache-Control', 'no-store');

  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  if (process.env.NODE_ENV === 'production' || proto === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  next();
}

/**
 * Executa o middleware attach Security Context antes da rota continuar.
 */
function attachSecurityContext(req, res, next) {
  // Cada request recebe um ID rastreável usado nos logs e nas respostas de erro.
  const requestId = crypto.randomUUID();
  req.security = {
    requestId,
    ip: getClientIp(req),
    userAgent: getUserAgent(req)
  };
  res.setHeader('X-Request-Id', requestId);
  next();
}

/**
 * Executa o middleware log Http Request antes da rota continuar.
 */
function logHttpRequest(req, res, next) {
  // Loga apenas falhas ou requests lentos para manter o terminal útil durante
  // alto volume de telemetria.
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (res.statusCode >= 400 || durationMs > Number(process.env.SLOW_REQUEST_MS || 1200)) {
      const level = res.statusCode >= 500 ? 'error' : 'warn';
      console[level](`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${durationMs.toFixed(0)}ms requestId=${req.security?.requestId || '-'}`);
    }
  });
  next();
}

/**
 * Executa o middleware create Rate Limiter antes da rota continuar.
 */
function createRateLimiter({ windowMs, max, message, keyPrefix = 'global', keyGenerator }) {
  // Limitador em memória por janela deslizante. Para múltiplas instâncias em
  // produção, substituir por Redis ou outro storage compartilhado.
  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${keyGenerator ? keyGenerator(req) : getClientIp(req)}`;
    const bucket = (requestBuckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs);

    if (bucket.length >= max) {
      const retryAfterMs = windowMs - (now - bucket[0]);
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      return res.status(429).json({
        error: message || 'Muitas solicitações. Tente novamente em alguns minutos.',
        requestId: req.security?.requestId
      });
    }

    bucket.push(now);
    requestBuckets.set(key, bucket);
    next();
  };
}

/**
 * Executa o middleware record Failed Login antes da rota continuar.
 */
function recordFailedLogin(key) {
  // Conta tentativas falhas e aplica bloqueio temporário quando ultrapassa
  // o limite. A chave pode combinar IP + usuário.
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const lockMs = 30 * 60 * 1000;
  const current = failedLoginBuckets.get(key) || { attempts: [], lockedUntil: 0 };
  const attempts = current.attempts.filter((timestamp) => now - timestamp < windowMs);
  attempts.push(now);

  const lockedUntil = attempts.length >= 5 ? now + lockMs : current.lockedUntil;
  failedLoginBuckets.set(key, { attempts, lockedUntil });
  return { attempts: attempts.length, lockedUntil };
}

/**
 * Executa o middleware clear Failed Login antes da rota continuar.
 */
function clearFailedLogin(key) {
  failedLoginBuckets.delete(key);
}

/**
 * Executa o middleware is Login Locked antes da rota continuar.
 */
function isLoginLocked(key) {
  const now = Date.now();
  const current = failedLoginBuckets.get(key);
  if (!current || !current.lockedUntil) return false;
  if (current.lockedUntil <= now) {
    failedLoginBuckets.delete(key);
    return false;
  }
  return true;
}

/**
 * Executa o middleware normalize Credential antes da rota continuar.
 */
function normalizeCredential(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength);
}

/**
 * Executa o middleware is Strong Password antes da rota continuar.
 */
function isStrongPassword(password) {
  // Política mínima de senha para usuários administrativos e alterações de senha.
  const value = String(password || '');
  return value.length >= 10
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}

/**
 * Executa o middleware require Roles antes da rota continuar.
 */
function requireRoles(...roles) {
  // Middleware de autorização por papel para rotas administrativas.
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Acesso restrito.', requestId: req.security?.requestId });
    }
    next();
  };
}

/**
 * Executa o middleware has Permission antes da rota continuar.
 */
function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}

/**
 * Executa o middleware require Permission antes da rota continuar.
 */
function requirePermission(permission) {
  // Middleware de autorização granular baseado em ROLE_PERMISSIONS.
  return (req, res, next) => {
    if (!hasPermission(req.userRole, permission)) {
      return res.status(403).json({ error: 'Permissão insuficiente.', requestId: req.security?.requestId });
    }
    next();
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  addSecurityHeaders,
  attachSecurityContext,
  clearFailedLogin,
  createRateLimiter,
  getClientIp,
  getUserAgent,
  isLoginLocked,
  isStrongPassword,
  logHttpRequest,
  normalizeCredential,
  recordFailedLogin,
  hasPermission,
  requirePermission,
  requireRoles
};
