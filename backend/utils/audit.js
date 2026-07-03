const pool = require('../config/db');

async function registrarAuditoria(acao, ator, alvo, severidade = 'info') {
  try {
    await pool.execute(
      'INSERT INTO audit_logs (acao, ator, alvo, severidade) VALUES (?, ?, ?, ?)',
      [acao, ator, alvo, severidade]
    );
  } catch (e) { 
    console.error('Erro de Audit Log:', e.message); 
  }
}

async function registrarHistoricoSuporte({ chamadoId, evento, autor, papel = null, statusAnterior = null, statusNovo = null, mensagem = null }) {
  try {
    await pool.execute(
      'INSERT INTO suporte_chamado_historico (chamado_id, evento, autor, papel, status_anterior, status_novo, mensagem) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [chamadoId, evento, autor, papel, statusAnterior, statusNovo, mensagem]
    );
  } catch (e) {}
}

module.exports = {
  registrarAuditoria,
  registrarHistoricoSuporte
};