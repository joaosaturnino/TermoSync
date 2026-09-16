const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { registrarEventoSeguranca } = require('../utils/audit');

const DEFAULT_DEV_SECRET = 'chave_super_secreta_termosync_node';
const SECRET_KEY = process.env.JWT_SECRET || DEFAULT_DEV_SECRET;

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
 */
const verificarToken = async (req, res, next) => {
  // 1. Extrai e valida formato do Bearer token antes de chamar jwt.verify.
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'Acesso negado.', requestId: req.security?.requestId });
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
    
    try {
      // 3. Validação fail-closed da sessão ativa no banco. Mesmo com JWT válido,
      // a sessão pode ter sido revogada, expirada ou removida pelo administrador.
      const [sessoes] = await pool.execute('SELECT revogado, expires_at FROM sessoes_ativas WHERE token = ?', [token]);
      if (sessoes.length === 0) {
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
      if (sessoes.length > 0 && sessoes[0].revogado) {
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
      if (sessoes[0].expires_at && new Date(sessoes[0].expires_at) < new Date()) {
        await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE token = ?', [token]);
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
      if (sessoes.length > 0) {
        await pool.execute('UPDATE sessoes_ativas SET last_seen = NOW() WHERE token = ?', [token]);
      }
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
    next();
  });
};

module.exports = {
  SECRET_KEY,
  verificarToken
};
