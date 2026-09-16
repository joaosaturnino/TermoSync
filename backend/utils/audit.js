const pool = require('../config/db');
const crypto = require('crypto');

/**
 * Registra registrar auditoria para auditoria, historico ou diagnostico.
 */
async function registrarAuditoria(acao, ator, alvo, severidade = 'info') {
  try {
    const [previousRows] = await pool.execute('SELECT event_hash FROM audit_logs WHERE event_hash IS NOT NULL ORDER BY id DESC LIMIT 1');
    const previousHash = previousRows[0]?.event_hash || null;
    const payload = JSON.stringify({ acao, ator, alvo, severidade, previousHash, at: new Date().toISOString() });
    const eventHash = crypto.createHash('sha256').update(payload).digest('hex');
    await pool.execute(
      'INSERT INTO audit_logs (acao, ator, alvo, severidade, previous_hash, event_hash) VALUES (?, ?, ?, ?, ?, ?)',
      [acao, ator, alvo, severidade, previousHash, eventHash]
    );
  } catch (e) { 
    try {
      await pool.execute(
        'INSERT INTO audit_logs (acao, ator, alvo, severidade) VALUES (?, ?, ?, ?)',
        [acao, ator, alvo, severidade]
      );
    } catch (fallbackErr) {
      console.error('Erro de Audit Log:', fallbackErr.message || e.message);
    }
  }
}

/**
 * Registra registrar evento seguranca para auditoria, historico ou diagnostico.
 */
async function registrarEventoSeguranca({ eventType, actor = null, ip = null, userAgent = null, severity = 'info', detail = null }) {
  try {
    await pool.execute(
      'INSERT INTO security_events (event_type, actor, ip_address, user_agent, severity, detail) VALUES (?, ?, ?, ?, ?, ?)',
      [eventType, actor, ip, userAgent, severity, detail]
    );
  } catch (e) {
    console.error('Erro de Security Event:', e.message);
  }
}

/**
 * Registra registrar historico suporte para auditoria, historico ou diagnostico.
 */
async function registrarHistoricoSuporte({ chamadoId, evento, autor, papel = null, statusAnterior = null, statusNovo = null, mensagem = null }) {
  try {
    await pool.execute(
      'INSERT INTO suporte_chamado_historico (chamado_id, evento, autor, papel, status_anterior, status_novo, mensagem) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [chamadoId, evento, autor, papel, statusAnterior, statusNovo, mensagem]
    );
  } catch (e) {
    console.error('Erro de Histórico de Suporte:', e.message);
  }
}

module.exports = {
  registrarAuditoria,
  registrarEventoSeguranca,
  registrarHistoricoSuporte
};
