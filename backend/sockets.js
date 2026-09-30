/**
 * Módulo: backend/sockets.js
 * Responsabilidade: Centraliza as responsabilidades do módulo sockets.
 */

const jwt = require('jsonwebtoken');
const pool = require('./config/db');
const { SECRET_KEY } = require('./middlewares/auth');

/**
 * Concentra a logica de join developer health room para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: troca eventos em tempo real; acessa a camada de persistência
 *
 * @param {unknown} socket - Valor de socket consumido por esta rotina.
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function joinDeveloperHealthRoom(socket) {
  const token = String(socket.handshake?.auth?.token || '');
  if (!token || token.length > 2000) return;
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    if (decoded.role !== 'DEV') return;
    const [sessions] = await pool.execute(
      'SELECT id FROM sessoes_ativas WHERE token = ? AND revogado = FALSE AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1',
      [token]
    );
    if (sessions.length) socket.join('system_health_dev');
  } catch {
    // A conexão continua para recursos públicos, mas não entra no canal DEV.
  }
}

module.exports = (io) => {
  if (io._baseSocketConfigured) return;
  io._baseSocketConfigured = true;

  io.on('connection', (socket) => {
    joinDeveloperHealthRoom(socket);
    socket.on('medir_latencia', (timestamp, callback) => { 
      if (typeof callback === 'function') callback(timestamp); 
    });

    socket.on('registrar_usuario', (userId) => { 
      socket.join(`user_${userId}`); 
    });

    socket.on('enviar_mensagem_chat', async (data) => {
      try {
        const { remetenteId, remetenteNome, destinoId, texto } = data;
        const dataHora = new Date();
        const [result] = await pool.execute('INSERT INTO chat_mensagens (remetente_id, remetente_nome, destino_id, texto, data_hora) VALUES (?, ?, ?, ?, ?)', [remetenteId, remetenteNome, String(destinoId), texto, dataHora]);
        const msgFormatada = { id: result.insertId, remetenteId, remetenteNome, destinoId: String(destinoId), texto, data: dataHora, tipo: 'received' };
        
        if (String(destinoId) === 'todos') { 
          socket.broadcast.emit('nova_mensagem_chat', msgFormatada); 
        } else { 
          io.to(`user_${destinoId}`).emit('nova_mensagem_chat', msgFormatada); 
        }
      } catch (err) {
        console.error('Erro ao processar mensagem do chat:', err.message);
      }
    });
  });

  io._chatListenerConfigured = true;
};
