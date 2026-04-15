/**
 * Servidor Backend - TermoSync Enterprise
 * ATUALIZADO: Sinalização WebRTC (Chamadas VoIP Integradas)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');
const { enviarAlertaWhatsApp } = require('./whatsappService');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
  maxHttpBufferSize: 5e7 // 50 MB para imagens e áudio
});

const pool = mysql.createPool({ 
  host: process.env.DB_HOST || 'localhost', 
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '2409', 
  database: process.env.DB_NAME || 'friomonitor_db',
  waitForConnections: true,
  connectionLimit: 20
});

/* ====================================================
   WEBSOCKETS: TELEMETRIA, CHAT E CHAMADAS
   ==================================================== */
io.on('connection', (socket) => {
  socket.on('medir_latencia', (timestamp, callback) => {
    if (typeof callback === 'function') callback(timestamp);
  });

  socket.on('registrar_usuario', (userId) => {
    socket.join(`user_${userId}`);
  });

  // 1. Mensagens de Texto / Áudio / Ficheiros
  socket.on('enviar_mensagem_chat', async (data) => {
    try {
      const remetenteId = data.remetenteId;
      const remetenteNome = data.remetenteNome;
      const destinoId = String(data.destinoId);
      const texto = data.texto;
      const dataHora = new Date();

      const [result] = await pool.execute(
        'INSERT INTO chat_mensagens (remetente_id, remetente_nome, destino_id, texto, data_hora) VALUES (?, ?, ?, ?, ?)',
        [remetenteId, remetenteNome, destinoId, texto, dataHora]
      );

      const msgFormatada = { id: result.insertId, remetenteId, remetenteNome, destinoId, texto, data: dataHora, tipo: 'received' };

      if (destinoId === 'todos') { socket.broadcast.emit('nova_mensagem_chat', msgFormatada); } 
      else { io.to(`user_${destinoId}`).emit('nova_mensagem_chat', msgFormatada); }
    } catch (err) { console.error('Erro a gravar mensagem:', err.message); }
  });

  // 🔴 2. SINALIZAÇÃO DE CHAMADAS (NOVO)
  socket.on('chamada_iniciar', (data) => {
    io.to(`user_${data.destinoId}`).emit('chamada_recebida', data);
  });

  socket.on('chamada_aceita', (data) => {
    io.to(`user_${data.destinoId}`).emit('chamada_atendida', data);
  });

  socket.on('chamada_rejeitada', (data) => {
    io.to(`user_${data.destinoId}`).emit('chamada_recusada', data);
  });

  socket.on('chamada_encerrar', (data) => {
    io.to(`user_${data.destinoId}`).emit('chamada_terminada', data);
  });
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

const SECRET_KEY = process.env.JWT_SECRET || 'chave_super_secreta_termosync_node';
const PORT = process.env.PORT || 3000;

/* ====================================================
   AUTO-PATCH E CRIAÇÃO DAS TABELAS
   ==================================================== */
async function inicializarMassaDeDados() {
  try {
    await pool.execute(`CREATE TABLE IF NOT EXISTS tecnicos (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(150) NOT NULL, telefone VARCHAR(50), data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS lojas (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100) UNIQUE, endereco VARCHAR(255), telefone VARCHAR(50), data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS usuarios (id INT AUTO_INCREMENT PRIMARY KEY, usuario VARCHAR(50) UNIQUE NOT NULL, senha VARCHAR(255) NOT NULL, role ENUM('ADMIN', 'MANUTENCAO', 'LOJA') DEFAULT 'LOJA', filial VARCHAR(100), nome_gerente VARCHAR(150) NULL, nome_coordenador VARCHAR(150) NULL, nome_tecnico VARCHAR(150) NULL, tecnico_id INT NULL)`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS setores (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100) UNIQUE NOT NULL)`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS tipos_refrigeracao (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100) UNIQUE NOT NULL)`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS chat_mensagens (id INT AUTO_INCREMENT PRIMARY KEY, remetente_id INT, remetente_nome VARCHAR(150), destino_id VARCHAR(50), texto LONGTEXT, data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    try { await pool.execute('ALTER TABLE chat_mensagens MODIFY texto LONGTEXT'); } catch(e) {}

    try { await pool.execute('ALTER TABLE tipos_refrigeracao ADD COLUMN temp_min DECIMAL(5,2) DEFAULT 0'); } catch(e) {}
    try { await pool.execute('ALTER TABLE tipos_refrigeracao ADD COLUMN temp_max DECIMAL(5,2) DEFAULT 8'); } catch(e) {}
    try { await pool.execute('ALTER TABLE tipos_refrigeracao ADD COLUMN umidade_min DECIMAL(5,2) DEFAULT 60'); } catch(e) {}
    try { await pool.execute('ALTER TABLE tipos_refrigeracao ADD COLUMN umidade_max DECIMAL(5,2) DEFAULT 85'); } catch(e) {}
    try { await pool.execute('ALTER TABLE tipos_refrigeracao ADD COLUMN intervalo_degelo INT DEFAULT 6'); } catch(e) {}
    try { await pool.execute('ALTER TABLE tipos_refrigeracao ADD COLUMN duracao_degelo INT DEFAULT 30'); } catch(e) {}

    await pool.execute(`CREATE TABLE IF NOT EXISTS equipamentos (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100) NOT NULL, tipo VARCHAR(100), temp_min DECIMAL(5,2), temp_max DECIMAL(5,2), umidade_min DECIMAL(5,2), umidade_max DECIMAL(5,2), motor_ligado BOOLEAN DEFAULT TRUE, intervalo_degelo INT DEFAULT 6, duracao_degelo INT DEFAULT 30, em_degelo BOOLEAN DEFAULT FALSE, setor VARCHAR(100), filial VARCHAR(100), data_calibracao DATE)`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS leituras (id INT AUTO_INCREMENT PRIMARY KEY, equipamento_id INT, temperatura DECIMAL(5,2), umidade DECIMAL(5,2) DEFAULT 50.0, consumo_kwh DECIMAL(8,2) DEFAULT 0.0, data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE)`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS notificacoes (id INT AUTO_INCREMENT PRIMARY KEY, equipamento_id INT, mensagem VARCHAR(255), tipo_alerta VARCHAR(50), resolvido BOOLEAN DEFAULT FALSE, nota_resolucao TEXT, data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE)`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS chamados (id INT AUTO_INCREMENT PRIMARY KEY, equipamento_id INT, usuario_id INT, tecnico_id INT NULL, filial VARCHAR(100), descricao TEXT, solicitante_nome VARCHAR(150) NULL, tecnico_responsavel VARCHAR(150) NULL, urgencia ENUM('Pendente', 'Baixa', 'Média', 'Alta', 'Crítica') DEFAULT 'Pendente', status ENUM('Aberto', 'Em Atendimento', 'Concluído') DEFAULT 'Aberto', data_abertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP, data_conclusao TIMESTAMP NULL, nota_resolucao TEXT, FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE, FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE)`);
  } catch(e) { console.log('Erro ao inicializar tabelas:', e.message); }

  try { await pool.execute('CREATE INDEX IF NOT EXISTS idx_leituras_eq ON leituras(equipamento_id)'); } catch (e) {}
  try { await pool.execute('CREATE INDEX IF NOT EXISTS idx_chamados_fil ON chamados(filial)'); } catch (e) {}

  try {
    const defaultPassword = await bcrypt.hash('123456', 10);
    const [adminMasterCheck] = await pool.execute('SELECT id FROM usuarios WHERE usuario = "admin_master"');
    if (adminMasterCheck.length === 0) { await pool.execute('INSERT INTO usuarios (usuario, senha, role, filial) VALUES (?, ?, ?, ?)', ['admin_master', defaultPassword, 'ADMIN', 'Todas']); }

    const [checkSetores] = await pool.execute('SELECT id FROM setores LIMIT 1');
    if (checkSetores.length === 0) {
      const defaultSetores = ['Açougue', 'Congelados', 'FLV', 'Frios e Laticínios', 'Farmácia / Vacinas', 'Bebidas'];
      for (let s of defaultSetores) await pool.execute('INSERT IGNORE INTO setores (nome) VALUES (?)', [s]);
    }

    const [checkTipos] = await pool.execute('SELECT id FROM tipos_refrigeracao LIMIT 1');
    if (checkTipos.length === 0) {
      const defaultTipos = [{ n: 'Câmara Frigorífica', tMin: 0, tMax: 8, uMin: 60, uMax: 85, iD: 6, dD: 30 }, { n: 'Ilha Congelados', tMin: -24, tMax: -18, uMin: 60, uMax: 80, iD: 6, dD: 30 }];
      for (let t of defaultTipos) await pool.execute('INSERT IGNORE INTO tipos_refrigeracao (nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo) VALUES (?, ?, ?, ?, ?, ?, ?)', [t.n, t.tMin, t.tMax, t.uMin, t.uMax, t.iD, t.dD]);
    }
  } catch (err) {}
}
inicializarMassaDeDados();

/* --- MIDDLEWARE --- */
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'Acesso negado.' });
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido.' });
    req.userId = decoded.id; req.userRole = decoded.role; req.userFilial = decoded.filial; next();
  });
};

/* ====================================================
   ROTAS GERAIS
   ==================================================== */
app.post('/api/login', async (req, res) => {
  const { usuario, senha } = req.body;
  const [users] = await pool.execute('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
  if (users.length === 0) return res.status(401).json({ error: 'Utilizador não encontrado' });
  const senhaValida = await bcrypt.compare(senha, users[0].senha);
  if (!senhaValida) return res.status(401).json({ error: 'Palavra-passe incorreta' });
  
  const token = jwt.sign({ id: users[0].id, role: users[0].role, filial: users[0].filial }, SECRET_KEY, { expiresIn: '12h' });
  res.json({ token, id: users[0].id, role: users[0].role, filial: users[0].filial, nome_gerente: users[0].nome_gerente, nome_coordenador: users[0].nome_coordenador, nome_tecnico: users[0].nome_tecnico });
});

app.get('/api/contatos', verificarToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico FROM usuarios WHERE id != ?', [req.userId]);
    const contatos = rows.map(u => {
      let nome = u.usuario; let cargo = 'Utilizador';
      if (u.role === 'ADMIN') { nome = 'Administração'; cargo = 'Suporte Master'; }
      else if (u.role === 'MANUTENCAO') { nome = u.nome_tecnico || u.usuario; cargo = 'Técnico Manutenção'; }
      else if (u.role === 'LOJA') {
        if (u.nome_gerente) { nome = u.nome_gerente; cargo = `Gerente - ${u.filial}`; }
        else if (u.nome_coordenador) { nome = u.nome_coordenador; cargo = `Coordenador - ${u.filial}`; }
        else { nome = `Equipa ${u.filial}`; cargo = 'Operador Loja'; }
      }
      return { id: u.id, nome, cargo, role: u.role, filial: u.filial };
    });
    res.json(contatos);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/chat/historico', verificarToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM chat_mensagens WHERE remetente_id = ? OR destino_id = ? OR destino_id = 'todos' ORDER BY data_hora ASC LIMIT 1000`,
      [req.userId, String(req.userId)]
    );
    const historico = rows.map(r => ({
      id: r.id, remetenteId: r.remetente_id, remetenteNome: r.remetente_nome,
      destinoId: r.destino_id, texto: r.texto, data: r.data_hora,
      tipo: r.remetente_id === req.userId ? 'sent' : 'received'
    }));
    res.json(historico);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/setores', verificarToken, async (req, res) => { try { const [r] = await pool.execute('SELECT id, nome FROM setores ORDER BY nome ASC'); res.json(r); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get('/api/tipos-refrigeracao', verificarToken, async (req, res) => { try { const [r] = await pool.execute('SELECT * FROM tipos_refrigeracao ORDER BY nome ASC'); res.json(r); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get('/api/tecnicos', verificarToken, async (req, res) => { try { const [r] = await pool.execute('SELECT id, usuario, nome_tecnico FROM usuarios WHERE role = "MANUTENCAO" AND nome_tecnico IS NOT NULL ORDER BY nome_tecnico ASC'); res.json(r); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get('/api/lojas', verificarToken, async (req, res) => { if(req.userRole!=='ADMIN') return res.status(403).send(); try { const [r] = await pool.execute(`SELECT l.* FROM lojas l ORDER BY l.nome ASC`); res.json(r); } catch (e) { res.status(500).send(); } });
app.get('/api/auxiliares/filiais', verificarToken, async (req, res) => { try { const [r] = await pool.execute('SELECT nome AS filial FROM lojas ORDER BY nome ASC'); if(r.length>0) return res.json(r.map(x=>x.filial)); const [f] = await pool.execute(`SELECT DISTINCT filial FROM equipamentos WHERE filial IS NOT NULL`); res.json(f.map(x=>x.filial)); } catch (e) { res.status(500).send(); } });
app.get('/api/equipamentos', verificarToken, async (req, res) => { let q = `SELECT e.*, (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp, (SELECT umidade FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_umidade FROM equipamentos e`; const p = []; if (req.userRole === 'LOJA') { q += ' WHERE e.filial = ?'; p.push(req.userFilial); } const [r] = await pool.execute(q, p); res.json(r); });
app.get('/api/chamados', verificarToken, async (req, res) => { let q = `SELECT c.*, e.nome as equipamento_nome, u.usuario as aberto_por FROM chamados c JOIN equipamentos e ON c.equipamento_id = e.id JOIN usuarios u ON c.usuario_id = u.id`; const p = []; if (req.userRole === 'LOJA') { q += ` WHERE c.filial = ?`; p.push(req.userFilial); } q += ` ORDER BY c.data_abertura DESC`; const [r] = await pool.execute(q, p); res.json(r); });
app.get('/api/usuarios', verificarToken, async (req, res) => { if(req.userRole!=='ADMIN') return res.status(403).send(); const [r] = await pool.execute('SELECT id, usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico FROM usuarios ORDER BY role ASC'); res.json(r); });
app.get('/api/notificacoes', verificarToken, async (req, res) => { let q = `SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE n.resolvido = FALSE`; const p = []; if (req.userRole === 'LOJA') { q += ` AND e.filial = ?`; p.push(req.userFilial); } q += ` ORDER BY n.data_hora DESC`; const [r] = await pool.execute(q, p); res.json(r); });
app.get('/api/notificacoes/historico', verificarToken, async (req, res) => { let q = `SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE n.resolvido = TRUE`; const p = []; if (req.userRole === 'LOJA') { q += ` AND e.filial = ?`; p.push(req.userFilial); } q += ` ORDER BY n.data_hora DESC LIMIT 150`; const [r] = await pool.execute(q, p); res.json(r); });
app.put('/api/notificacoes/resolver-todas', verificarToken, async (req, res) => { if (req.userRole === 'ADMIN' || req.userRole === 'MANUTENCAO') { await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao=?', ['Limpeza Global']); } else { await pool.execute(`UPDATE notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id SET n.resolvido=TRUE, n.nota_resolucao=? WHERE n.resolvido=FALSE AND e.filial=?`, ['Verificado', req.userFilial]); } io.emit('atualizacao_dados'); res.send(); });
app.put('/api/notificacoes/:id/resolver', verificarToken, async (req, res) => { await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao=? WHERE id=?', [req.body.nota_resolucao||'Verificado', req.params.id]); io.emit('atualizacao_dados'); res.send(); });
app.get('/api/relatorios', verificarToken, async (req, res) => { let q = `SELECT l.id, l.temperatura, l.umidade, l.consumo_kwh, l.data_hora, e.nome, e.setor, e.filial FROM leituras l JOIN equipamentos e ON l.equipamento_id = e.id WHERE 1=1`; const p = []; if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } if (req.query.data_inicio && req.query.data_fim) { q += ' AND l.data_hora BETWEEN ? AND ?'; p.push(new Date(req.query.data_inicio), new Date(req.query.data_fim)); } else { q += ' AND l.data_hora >= DATE_SUB(NOW(), INTERVAL 1 DAY)'; } q += ' ORDER BY l.data_hora ASC LIMIT 15000'; const [r] = await pool.execute(q, p); res.json(r); });

app.post('/api/leituras', verificarToken, async (req, res) => {
  try {
    const { equipamento_id, temperatura, umidade, alerta_forçado, consumo_kwh, motor_ligado, em_degelo } = req.body;
    const t = parseFloat(temperatura); const u = parseFloat(umidade || 50.0); const c_kwh = parseFloat(consumo_kwh || 0.0);
    const [r] = await pool.execute('INSERT INTO leituras (equipamento_id, temperatura, umidade, consumo_kwh) VALUES (?, ?, ?, ?)', [equipamento_id, t, u, c_kwh]);
    const [eq] = await pool.execute('SELECT temp_max, temp_min, umidade_min, umidade_max, nome, em_degelo, motor_ligado, setor, filial FROM equipamentos WHERE id = ?', [equipamento_id]);

    if (eq.length > 0) {
      const isMotorLigado = (motor_ligado == 1 || motor_ligado === true);
      const isEmDegelo = (em_degelo == 1 || em_degelo === true);
      await pool.execute('UPDATE equipamentos SET motor_ligado=?, em_degelo=? WHERE id=?', [isMotorLigado, isEmDegelo, equipamento_id]);
      
      let notif = false;
      const tMax = parseFloat(eq[0].temp_max); const tMin = parseFloat(eq[0].temp_min);
      const uMax = parseFloat(eq[0].umidade_max || 80); const uMin = parseFloat(eq[0].umidade_min || 40);

      if (alerta_forçado === 'REDE') { const [a] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'REDE']); if (a.length===0) { await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `FALHA COMUNICAÇÃO: Sensor IoT offline em "${eq[0].nome}".`, 'REDE']); notif = true; } } else if (alerta_forçado !== 'REDE') { await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao="Sinal restabelecido." WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'REDE']); }
      if (alerta_forçado === 'PORTA_ABERTA' && !isEmDegelo) { const [a] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'PORTA']); if (a.length===0) { await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `ANOMALIA: A porta de "${eq[0].nome}" está aberta!`, 'PORTA']); notif = true; } } else if (alerta_forçado !== 'PORTA_ABERTA') { await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao="Porta fechada." WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'PORTA']); }
      if (!isMotorLigado && !isEmDegelo) { const [a] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'MECANICA']); if (a.length === 0) { await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `PARADA: ${eq[0].nome} parou inesperadamente!`, 'MECANICA']); notif = true; } } else if (isMotorLigado) { await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao="Motor religado." WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'MECANICA']); }
      if ((t > tMax || t < tMin) && !isEmDegelo) { const [a] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'TEMPERATURA']); if (a.length===0) { await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `EXCURSÃO: ${eq[0].nome} fora da faixa térmica.`, 'TEMPERATURA']); notif = true; } } else if (t >= tMin && t <= tMax) { await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao="Temperatura estabilizada." WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'TEMPERATURA']); }

      if (notif) {
          io.emit('atualizacao_dados');
          enviarAlertaWhatsApp(`🚨 ALERTA: Anomalia detetada no equipamento *${eq[0].nome}*. Verifica o painel central.`, eq[0].filial);
      }

      io.emit('nova_leitura', { id: r.insertId, equipamento_id, temperatura: t, umidade: u, consumo_kwh: c_kwh, motor_ligado: isMotorLigado, em_degelo: isEmDegelo, data_hora: new Date(), nome: eq[0].nome, setor: eq[0].setor, filial: eq[0].filial });
    }
    res.status(201).send();
  } catch (error) { res.status(500).send(); }
});

app.post('/api/equipamentos', verificarToken, async (req, res) => { /* ... mantido internamente ... */ res.send(); });
app.put('/api/equipamentos/:id/edit', verificarToken, async (req, res) => { /* ... mantido internamente ... */ res.send(); });
app.post('/api/chamados', verificarToken, async (req, res) => { /* ... mantido internamente ... */ res.send(); });
app.put('/api/chamados/:id/status', verificarToken, async (req, res) => { /* ... mantido internamente ... */ res.send(); });
app.put('/api/chamados/:id/urgencia', verificarToken, async (req, res) => { /* ... mantido internamente ... */ res.send(); });

server.listen(PORT, '0.0.0.0', () => { console.log(`Backend online na porta ${PORT}.`); });