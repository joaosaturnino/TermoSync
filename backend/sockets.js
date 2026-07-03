const pool = require('./config/db');

module.exports = (io) => {
  io.on('connection', (socket) => {
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
};