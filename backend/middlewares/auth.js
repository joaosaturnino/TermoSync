/**
 * Módulo: backend/middlewares/auth.js
 * Responsabilidade: Protege requisições e prepara o contexto do middleware auth.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { registrarEventoSeguranca } = require('../utils/audit');

const DEFAULT_DEV_SECRET = 'chave_super_secreta_termosync_node';
const SECRET_KEY = process.env.JWT_SECRET || DEFAULT_DEV_SECRET;
const SESSION_CACHE_TTL_MS = Math.max(1000, Number(process.env.AUTH_SESSION_CACHE_TTL_MS || 5000));
const LAST_SEEN_WRITE_INTERVAL_MS = Math.max(5000, Number(process.env.AUTH_LAST_SEEN_INTERVAL_MS || 60000));
const sessionCache = new Map();
const sessionLookups = new Map();
const lastSeenWrites = new Map();

/**
 * Executa o middleware get Session Cache Key antes da rota continuar.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {string} token - Código de verificação ou credencial temporária recebida pelo fluxo.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function getSessionCacheKey(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Remove uma sessão do cache imediatamente após logout ou revogação explícita.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {string} token - Código de verificação ou credencial temporária recebida pelo fluxo.
 * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function invalidateSessionCache(token) {
  if (!token) return;
  const key = getSessionCacheKey(token);
  sessionCache.delete(key);
  lastSeenWrites.delete(key);
}

/**
 * Remove do cache todas as sessões de um usuário que teve suas credenciais alteradas.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {string|number} userId - Identificador do registro ou recurso processado.
 * @param {unknown} exceptToken - Valor de except token consumido por esta rotina.
 * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function invalidateUserSessions(userId, exceptToken = null) {
  const exceptKey = exceptToken ? getSessionCacheKey(exceptToken) : null;
  for (const [key, entry] of sessionCache.entries()) {
    if (key !== exceptKey && Number(entry.session.usuario_id) === Number(userId)) {
      sessionCache.delete(key);
      lastSeenWrites.delete(key);
    }
  }
}

/**
 * Esvazia a validação local quando uma operação administrativa revoga várias sessões.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} exceptToken - Valor de except token consumido por esta rotina.
 * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function invalidateAllSessionCaches(exceptToken = null) {
  const exceptKey = exceptToken ? getSessionCacheKey(exceptToken) : null;
  for (const key of sessionCache.keys()) {
    if (key !== exceptKey) sessionCache.delete(key);
  }
  for (const key of lastSeenWrites.keys()) {
    if (key !== exceptKey) lastSeenWrites.delete(key);
  }
}

/**
 * Compartilha consultas simultâneas do mesmo token e mantém um cache curto. A janela de cinco
 * segundos reduz rajadas de leituras sem prolongar revogações; operações locais de logout e
 * bloqueio invalidam o cache imediatamente.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência
 *
 * @param {string} token - Código de verificação ou credencial temporária recebida pelo fluxo.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function loadSession(token) {
  const key = getSessionCacheKey(token);
  const cached = sessionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { key, session: cached.session };
  if (cached) sessionCache.delete(key);

  let lookup = sessionLookups.get(key);
  if (!lookup) {
    lookup = pool.execute(
      `SELECT s.usuario_id, s.role, s.revogado, s.expires_at, s.impersonated_filial,
              company.status AS company_status, company.access_mode, company.trial_expires_at,
              company.trial_auto_block
       FROM sessoes_ativas s
       LEFT JOIN usuarios user_account ON user_account.id = s.usuario_id
       LEFT JOIN empresas company ON company.nome = user_account.empresa
       WHERE s.token = ?
       LIMIT 1`,
      [token]
    ).then(([rows]) => rows[0] || null).finally(() => sessionLookups.delete(key));
    sessionLookups.set(key, lookup);
  }

  const session = await lookup;
  if (session && !session.revogado) {
    if (sessionCache.size >= 5000) sessionCache.delete(sessionCache.keys().next().value);
    sessionCache.set(key, { session, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
  }
  return { key, session };
}

/**
 * Atualiza atividade no máximo uma vez por minuto e não bloqueia a resposta HTTP.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: acessa a camada de persistência; registra informações de diagnóstico
 *
 * @param {string} token - Código de verificação ou credencial temporária recebida pelo fluxo.
 * @param {unknown} key - Valor de key consumido por esta rotina.
 * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function touchSessionLastSeen(token, key) {
  const now = Date.now();
  if (now - Number(lastSeenWrites.get(key) || 0) < LAST_SEEN_WRITE_INTERVAL_MS) return;
  lastSeenWrites.set(key, now);
  pool.execute('UPDATE sessoes_ativas SET last_seen = NOW() WHERE token = ?', [token])
    .catch((error) => {
      lastSeenWrites.delete(key);
      console.warn('[AUTH] Não foi possível atualizar last_seen:', error.message);
    });
}

// Em produção a chave JWT precisa vir do ambiente; a chave padrão existe apenas
// para facilitar desenvolvimento local.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET obrigatório em produção.');
}

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('[AUTH] JWT_SECRET ausente. Usando chave local apenas para desenvolvimento.');
}


/**
 * Executa o middleware verificar Token antes da rota continuar.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência; finaliza a resposta HTTP; registra informações de diagnóstico
 *
 * @param {import("express").Request} req - Requisição HTTP com parâmetros, corpo e contexto de autenticação.
 * @param {import("express").Response} res - Resposta HTTP usada para devolver o resultado ao cliente.
 * @param {import("express").NextFunction} next - Continuação da cadeia de middlewares do Express.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const verificarToken = async (req, res, next) => {
  // 1. Extrai e valida formato do Bearer token antes de chamar jwt.verify.
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Autenticação necessária.', requestId: req.security?.requestId });
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token || token.length > 2000 || token.split('.').length !== 3) {
    await registrarEventoSeguranca({
      eventType: 'AUTH_TOKEN_MALFORMED',
      ip: req.security?.ip,
      userAgent: req.security?.userAgent,
      severity: 'warning',
      detail: req.originalUrl
    });
    return res.status(401).json({ error: 'Token inválido ou expirado.', requestId: req.security?.requestId });
  }
  
  jwt.verify(token, SECRET_KEY, async (err, decoded) => {
    // 2. Assinatura/expiração JWT inválida encerra a request e registra evento SOC.
    if (err) {
      await registrarEventoSeguranca({
        eventType: 'AUTH_TOKEN_INVALID',
        ip: req.security?.ip,
        userAgent: req.security?.userAgent,
        severity: 'warning',
        detail: `${err.name}: ${req.originalUrl}`
      });
      return res.status(401).json({ error: 'Token inválido ou expirado.', requestId: req.security?.requestId });
    }
    
    let session;
    try {
      // 3. Validação fail-closed da sessão ativa no banco. Mesmo com JWT válido,
      // a sessão pode ter sido revogada, expirada ou removida pelo administrador.
      const loadedSession = await loadSession(token);
      const sessionKey = loadedSession.key;
      session = loadedSession.session;
      if (!session) {
        await registrarEventoSeguranca({
          eventType: 'AUTH_SESSION_NOT_FOUND',
          actor: decoded.id ? String(decoded.id) : null,
          ip: req.security?.ip,
          userAgent: req.security?.userAgent,
          severity: 'warning',
          detail: req.originalUrl
        });
        return res.status(401).json({ error: 'Sessão não encontrada ou expirada.', requestId: req.security?.requestId });
      }
      if (session.revogado) {
        await registrarEventoSeguranca({
          eventType: 'AUTH_REVOKED_SESSION_BLOCKED',
          actor: decoded.id ? String(decoded.id) : null,
          ip: req.security?.ip,
          userAgent: req.security?.userAgent,
          severity: 'danger',
          detail: req.originalUrl
        });
        return res.status(401).json({ error: 'SESSÃO REVOGADA PELO ADMINISTRADOR.', requestId: req.security?.requestId });
      }
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE token = ?', [token]);
        invalidateSessionCache(token);
        await registrarEventoSeguranca({
          eventType: 'AUTH_SESSION_EXPIRED',
          actor: decoded.id ? String(decoded.id) : null,
          ip: req.security?.ip,
          userAgent: req.security?.userAgent,
          severity: 'warning',
          detail: req.originalUrl
        });
        return res.status(401).json({ error: 'Sessão expirada.', requestId: req.security?.requestId });
      }
      if (session.role !== 'DEV' && !session.impersonated_filial && session.company_status && session.company_status !== 'Ativa') {
        return res.status(403).json({ error: 'Organização suspensa ou bloqueada.', requestId: req.security?.requestId });
      }
      if (session.role !== 'DEV' && !session.impersonated_filial && session.access_mode === 'TRIAL'
          && session.trial_auto_block !== 0 && session.trial_expires_at
          && new Date(session.trial_expires_at) <= new Date()) {
        await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE token = ?', [token]);
        invalidateSessionCache(token);
        return res.status(403).json({
          error: 'O período gratuito terminou. Entre em contato para converter a demonstração em uma conta ativa.',
          trialExpired: true,
          requestId: req.security?.requestId
        });
      }
      touchSessionLastSeen(token, sessionKey);
    } catch(e) {
      // Segurança acima de disponibilidade: se o banco não consegue confirmar
      // sessão ativa, a API retorna 503 em vez de aceitar um token sem checagem.
      console.warn('[AUTH] Não foi possível validar revogação de sessão:', e.message);
      await registrarEventoSeguranca({
        eventType: 'AUTH_SESSION_VALIDATION_UNAVAILABLE',
        actor: decoded.id ? String(decoded.id) : null,
        ip: req.security?.ip,
        userAgent: req.security?.userAgent,
        severity: 'danger',
        detail: e.message
      });
      return res.status(503).json({ error: 'Validação de segurança indisponível.', requestId: req.security?.requestId });
    }

    // 4. Contexto multi-tenant usado pelos handlers para filtrar empresa/filial.
    req.userId = decoded.id; 
    req.userRole = decoded.role; 
    req.userFilial = decoded.filial; 
    req.userEmpresa = decoded.empresa || 'Cliente Alpha (Padrão)'; 
    req.isImpersonated = decoded.impersonated === true;
    req.impersonatedBy = decoded.impersonatedBy || null;
    req.isTrial = !req.isImpersonated && ['TRIAL', 'DEMO'].includes(session.access_mode);
    req.demoLifetime = !req.isImpersonated && session.access_mode === 'DEMO';
    req.trialExpiresAt = req.isTrial ? session.trial_expires_at : null;
    next();
  });
};

module.exports = {
  SECRET_KEY,
  verificarToken,
  invalidateAllSessionCaches,
  invalidateSessionCache,
  invalidateUserSessions
};
