/**
 * Módulo: backend/utils/audit.js
 * Responsabilidade: Centraliza as responsabilidades do módulo audit.
 */

const pool = require('../config/db');
const crypto = require('crypto');

/**
 * Registra registrar auditoria para auditoria, historico ou diagnostico.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência; registra informações de diagnóstico
 *
 * @param {unknown} acao - Valor de acao consumido por esta rotina.
 * @param {unknown} ator - Valor de ator consumido por esta rotina.
 * @param {unknown} alvo - Valor de alvo consumido por esta rotina.
 * @param {unknown} severidade - Valor de severidade consumido por esta rotina.
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência; registra informações de diagnóstico
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.eventType - Propriedade eventType usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.actor - Propriedade actor usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.ip - Propriedade ip usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.userAgent - Propriedade userAgent usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.severity - Propriedade severity usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.detail - Propriedade detail usada para configurar dados ou comportamento do componente.
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência; registra informações de diagnóstico
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.chamadoId - Propriedade chamadoId usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.evento - Propriedade evento usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.autor - Propriedade autor usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.papel - Propriedade papel usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.statusAnterior - Propriedade statusAnterior usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.statusNovo - Propriedade statusNovo usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.mensagem - Propriedade mensagem usada para configurar dados ou comportamento do componente.
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
