/**
 * Servidor Backend - FrioMonitor
 * Responsável pela API REST, comunicação WebSocket em tempo real e conexão com o banco de dados.
 */

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Configuração do WebSocket com permissão de CORS
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
});

// Middlewares globais
app.use(cors());
app.use(express.json());

// Configurações de Ambiente (Idealmente, mover para um ficheiro .env)
const dbConfig = { host: 'localhost', user: 'root', password: '2409', database: 'friomonitor_db' };
const SECRET_KEY = 'chave_super_secreta_frio_monitor';

/* =========================================
   WEBSOCKETS (Comunicação em Tempo Real)
   ========================================= */
io.on('connection', (socket) => {
  console.log(`[Socket] Novo cliente conectado: ${socket.id}`);
  
  // Endpoint para medir latência da rede (Ping/Pong)
  socket.on('medir_latencia', (timestamp, callback) => {
    if (typeof callback === 'function') {
      callback(timestamp);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Cliente desconectado: ${socket.id}`);
  });
});

/* =========================================
   MIDDLEWARES
   ========================================= */
/**
 * Middleware para validar o JWT em rotas protegidas.
 */
const verificarToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'Acesso negado. Token ausente.' });
  
  // O token vem no formato "Bearer <token>"
  jwt.verify(token.split(' ')[1], SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido ou expirado.' });
    req.userId = decoded.id;
    next();
  });
};

/* =========================================
   ROTAS DE AUTENTICAÇÃO
   ========================================= */
app.post('/api/setup', async (req, res) => {
  try {
    const hash = await bcrypt.hash('admin123', 10);
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('INSERT IGNORE INTO usuarios (usuario, senha) VALUES (?, ?)', ['admin', hash]);
    await connection.end();
    res.send('Usuário "admin" criado com a senha "admin123"');
  } catch (error) {
    res.status(500).json({ error: 'Erro ao configurar banco de dados' });
  }
});

app.post('/api/login', async (req, res) => {
  const { usuario, senha } = req.body;
  const connection = await mysql.createConnection(dbConfig);
  const [users] = await connection.execute('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
  await connection.end();

  if (users.length === 0) {
    return res.status(401).json({ error: 'Usuário não encontrado' });
  }

  const senhaValida = await bcrypt.compare(senha, users[0].senha);
  if (!senhaValida) {
    return res.status(401).json({ error: 'Senha incorreta' });
  }

  const token = jwt.sign({ id: users[0].id }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ token });
});

/* =========================================
   ROTAS DE EQUIPAMENTOS
   ========================================= */
app.get('/api/equipamentos', verificarToken, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  // Busca equipamentos e a última leitura de temperatura registrada para cada um
  const [rows] = await connection.execute(`
    SELECT e.*, 
    (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp 
    FROM equipamentos e
  `);
  await connection.end();
  res.json(rows);
});

app.post('/api/equipamentos', verificarToken, async (req, res) => {
  const { nome, tipo, temp_min, temp_max, intervalo_degelo, duracao_degelo, setor } = req.body;
  const connection = await mysql.createConnection(dbConfig);
  
  await connection.execute(
    'INSERT INTO equipamentos (nome, tipo, temp_min, temp_max, motor_ligado, intervalo_degelo, duracao_degelo, em_degelo, setor) VALUES (?, ?, ?, ?, TRUE, ?, ?, FALSE, ?)', 
    [nome, tipo, temp_min, temp_max, intervalo_degelo || 6, duracao_degelo || 30, setor || 'Geral']
  );
  
  await connection.end();
  io.emit('atualizacao_dados'); // Notifica os clientes para atualizarem a interface
  res.status(201).json({ message: 'Equipamento adicionado' });
});

app.delete('/api/equipamentos/:id', verificarToken, async (req, res) => {
  const { id } = req.params;
  const connection = await mysql.createConnection(dbConfig);
  await connection.execute('DELETE FROM equipamentos WHERE id = ?', [id]);
  await connection.end();
  
  io.emit('atualizacao_dados');
  res.json({ message: 'Equipamento excluído' });
});

app.put('/api/equipamentos/:id/edit', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { nome, tipo, temp_min, temp_max, intervalo_degelo, duracao_degelo, setor } = req.body;
  const connection = await mysql.createConnection(dbConfig);
  
  await connection.execute(
    'UPDATE equipamentos SET nome = ?, tipo = ?, temp_min = ?, temp_max = ?, intervalo_degelo = ?, duracao_degelo = ?, setor = ? WHERE id = ?', 
    [nome, tipo, temp_min, temp_max, intervalo_degelo, duracao_degelo, setor, id]
  );
  
  await connection.end();
  io.emit('atualizacao_dados');
  res.json({ message: 'Equipamento atualizado' });
});

app.put('/api/equipamentos/:id/degelo', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { em_degelo } = req.body;
  const connection = await mysql.createConnection(dbConfig);
  
  await connection.execute('UPDATE equipamentos SET em_degelo = ? WHERE id = ?', [em_degelo, id]);
  await connection.end();
  
  io.emit('atualizacao_dados');
  res.json({ message: 'Status de degelo atualizado' });
});

// Atualização de estado do motor (Inclui lógica de detecção de falhas)
app.put('/api/equipamentos/:id', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { temp_min, temp_max, motor_ligado } = req.body;
  
  const connection = await mysql.createConnection(dbConfig);
  const [equipAtual] = await connection.execute('SELECT motor_ligado, nome, em_degelo FROM equipamentos WHERE id = ?', [id]);

  await connection.execute(
    'UPDATE equipamentos SET temp_min = ?, temp_max = ?, motor_ligado = ? WHERE id = ?', 
    [temp_min, temp_max, motor_ligado, id]
  );

  // Conversão de booleanos, pois o MySQL trata como 1/0 e o Frontend envia true/false
  const estavaLigado = equipAtual[0].motor_ligado == 1 || equipAtual[0].motor_ligado === true;
  const vaiDesligar = motor_ligado === 0 || motor_ligado === false;
  const emDegelo = equipAtual[0].em_degelo == 1 || equipAtual[0].em_degelo === true;

  // Lógica: Se o motor foi desligado de forma inesperada (fora do degelo), gera alerta
  if (estavaLigado && vaiDesligar && !emDegelo) {
    const msg = `PARAGEM CRÍTICA: O motor do equipamento "${equipAtual[0].nome}" parou de funcionar inesperadamente!`;
    const [alertasAtivos] = await connection.execute('SELECT id FROM notificacoes WHERE equipamento_id = ? AND resolvido = FALSE AND mensagem = ?', [id, msg]);
    
    if (alertasAtivos.length === 0) {
      await connection.execute('INSERT INTO notificacoes (equipamento_id, mensagem) VALUES (?, ?)', [id, msg]);
      io.emit('atualizacao_dados'); 
    }
  }
  
  await connection.end();
  io.emit('atualizacao_dados');
  res.json({ message: 'Equipamento atualizado' });
});

/* =========================================
   ROTAS DE NOTIFICAÇÕES & AUDITORIA
   ========================================= */
app.get('/api/notificacoes', verificarToken, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.execute(`
    SELECT n.*, e.nome AS equipamento_nome, e.setor 
    FROM notificacoes n 
    JOIN equipamentos e ON n.equipamento_id = e.id 
    WHERE n.resolvido = FALSE 
    ORDER BY n.data_hora DESC
  `);
  await connection.end();
  res.json(rows);
});

app.get('/api/notificacoes/historico', verificarToken, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.execute(`
    SELECT n.*, e.nome AS equipamento_nome, e.setor 
    FROM notificacoes n 
    JOIN equipamentos e ON n.equipamento_id = e.id 
    WHERE n.resolvido = TRUE 
    ORDER BY n.data_hora DESC 
    LIMIT 100
  `);
  await connection.end();
  res.json(rows);
});

app.put('/api/notificacoes/:id/resolver', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { nota_resolucao } = req.body;
  const connection = await mysql.createConnection(dbConfig);
  
  await connection.execute(
    'UPDATE notificacoes SET resolvido = TRUE, nota_resolucao = ? WHERE id = ?', 
    [nota_resolucao || 'Sem observações', id]
  );
  
  await connection.end();
  io.emit('atualizacao_dados');
  res.json({ message: 'Notificação resolvida' });
});

app.put('/api/notificacoes/resolver-todas', verificarToken, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  await connection.execute(
    'UPDATE notificacoes SET resolvido = TRUE, nota_resolucao = ? WHERE resolvido = FALSE', 
    ['Resolvido em massa pelo sistema']
  );
  await connection.end();
  io.emit('atualizacao_dados');
  res.json({ message: 'Todas as notificações resolvidas' });
});

/* =========================================
   ROTAS DE TELEMETRIA (LEITURAS E RELATÓRIOS)
   ========================================= */
app.get('/api/relatorios', verificarToken, async (req, res) => {
  const { data_inicio, data_fim } = req.query;
  const connection = await mysql.createConnection(dbConfig);
  
  let query = `
    SELECT l.id, l.temperatura, l.data_hora, e.nome, e.setor 
    FROM leituras l 
    JOIN equipamentos e ON l.equipamento_id = e.id 
    WHERE 1=1
  `;
  const params = [];
  
  if (data_inicio && data_fim) {
    query += ' AND l.data_hora BETWEEN ? AND ?';
    params.push(new Date(data_inicio), new Date(data_fim));
  } else {
    query += ' AND l.data_hora >= DATE_SUB(NOW(), INTERVAL 1 DAY)'; // Padrão: últimas 24h
  }
  
  query += ' ORDER BY l.data_hora ASC';
  const [rows] = await connection.execute(query, params);
  
  await connection.end();
  res.json(rows);
});

// Rota aberta (sem token) para permitir que os sensores enviem dados facilmente
app.post('/api/leituras', async (req, res) => {
  const { equipamento_id, temperatura } = req.body;
  const connection = await mysql.createConnection(dbConfig);
  
  // Insere a nova leitura
  const [result] = await connection.execute(
    'INSERT INTO leituras (equipamento_id, temperatura) VALUES (?, ?)', 
    [equipamento_id, temperatura]
  );
  
  const [equip] = await connection.execute('SELECT temp_max, nome, em_degelo, setor FROM equipamentos WHERE id = ?', [equipamento_id]);

  if (equip.length > 0) {
    const tAtual = parseFloat(temperatura);
    const tMax = parseFloat(equip[0].temp_max);
    const emDegelo = equip[0].em_degelo == 1 || equip[0].em_degelo === true;

    // Lógica de alerta de excesso de temperatura (ignorado se estiver em degelo)
    if (tAtual > tMax && !emDegelo) {
      const [alertasAtivos] = await connection.execute('SELECT id FROM notificacoes WHERE equipamento_id = ? AND resolvido = FALSE', [equipamento_id]);
      
      if (alertasAtivos.length === 0) {
        await connection.execute(
          'INSERT INTO notificacoes (equipamento_id, mensagem) VALUES (?, ?)', 
          [equipamento_id, `A temperatura do equipamento ${equip[0].nome} (${tAtual}°C) excedeu o limite máximo estipulado de ${tMax}°C.`]
        );
        io.emit('atualizacao_dados');
      }
    }
  }
  await connection.end();

  // Envia a leitura em tempo real para o frontend
  io.emit('nova_leitura', {
    id: result.insertId,
    equipamento_id,
    temperatura: parseFloat(temperatura),
    data_hora: new Date(),
    nome: equip[0]?.nome,
    setor: equip[0]?.setor
  });

  res.status(201).send();
});

// Inicialização do Servidor
server.listen(3001, () => {
  console.log('Backend rodando na porta 3001 com WebSockets ativados');
});