/**
 * Servidor Backend - PharmaX Telemetry Node
 * Inclui API REST, WebSockets, e Watchdog de Monitorização de Rede IoT.
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

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
});

app.use(cors());
app.use(express.json());

// Ajuste as credenciais de acordo com o seu ambiente local
const dbConfig = { host: 'localhost', user: 'root', password: '2409', database: 'friomonitor_db' };
const SECRET_KEY = 'chave_super_secreta_pharmax_node';

io.on('connection', (socket) => {
  console.log(`[Socket] Novo cliente conectado: ${socket.id}`);
  socket.on('medir_latencia', (timestamp, callback) => {
    if (typeof callback === 'function') callback(timestamp);
  });
  socket.on('disconnect', () => {
    console.log(`[Socket] Cliente desconectado: ${socket.id}`);
  });
});

const verificarToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'Acesso negado. Token ausente.' });
  
  jwt.verify(token.split(' ')[1], SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido ou expirado.' });
    req.userId = decoded.id;
    next();
  });
};

/* ====================================================
   WATCHDOG DE REDE IoT (MONITORIZAÇÃO DE HEARTBEAT)
   ==================================================== */
setInterval(async () => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(`
      SELECT e.id, e.nome, e.setor, MAX(l.data_hora) as ultima_leitura
      FROM equipamentos e
      LEFT JOIN leituras l ON e.id = l.equipamento_id
      GROUP BY e.id
    `);

    const agora = new Date();
    for (const eq of rows) {
      if (eq.ultima_leitura) {
        const diffSegundos = (agora - new Date(eq.ultima_leitura)) / 1000;
        
        // Timeout de 20 segundos para considerar o sensor offline
        if (diffSegundos > 20) { 
          const msg = `FALHA DE REDE: Perda de comunicação com o sensor "${eq.nome}". Timeout de pacotes excedido.`;
          const [alertasAtivos] = await connection.execute('SELECT id FROM notificacoes WHERE equipamento_id = ? AND resolvido = FALSE AND mensagem = ?', [eq.id, msg]);
          
          if (alertasAtivos.length === 0) {
            await connection.execute('INSERT INTO notificacoes (equipamento_id, mensagem) VALUES (?, ?)', [eq.id, msg]);
            io.emit('atualizacao_dados');
            console.log(`[WATCHDOG] Alerta disparado: Sensor ${eq.id} offline.`);
          }
        }
      }
    }
    await connection.end();
  } catch (error) {
    console.error("[WATCHDOG] Erro na varredura de rede:", error.message);
  }
}, 15000); 

/* ====================================================
   ROTAS DA API REST
   ==================================================== */
app.post('/api/setup', async (req, res) => {
  try {
    const hash = await bcrypt.hash('admin123', 10);
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('INSERT IGNORE INTO usuarios (usuario, senha) VALUES (?, ?)', ['admin', hash]);
    await connection.end();
    res.send('Utilizador "admin" criado com a palavra-passe "admin123"');
  } catch (error) {
    res.status(500).json({ error: 'Erro ao configurar base de dados' });
  }
});

app.post('/api/login', async (req, res) => {
  const { usuario, senha } = req.body;
  const connection = await mysql.createConnection(dbConfig);
  const [users] = await connection.execute('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
  await connection.end();

  if (users.length === 0) return res.status(401).json({ error: 'Utilizador não encontrado' });

  const senhaValida = await bcrypt.compare(senha, users[0].senha);
  if (!senhaValida) return res.status(401).json({ error: 'Palavra-passe incorreta' });

  const token = jwt.sign({ id: users[0].id }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ token });
});

app.get('/api/equipamentos', verificarToken, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.execute(`
    SELECT e.*, 
    (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp,
    (SELECT umidade FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_umidade
    FROM equipamentos e
  `);
  await connection.end();
  res.json(rows);
});

app.post('/api/equipamentos', verificarToken, async (req, res) => {
  const { nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor } = req.body;
  const connection = await mysql.createConnection(dbConfig);
  
  await connection.execute(
    'INSERT INTO equipamentos (nome, tipo, temp_min, temp_max, umidade_min, umidade_max, motor_ligado, intervalo_degelo, duracao_degelo, em_degelo, setor) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?, FALSE, ?)', 
    [nome, tipo, temp_min || 2, temp_max || 8, umidade_min || 35, umidade_max || 65, intervalo_degelo || 6, duracao_degelo || 30, setor || 'Farmácia / Vacinas']
  );
  
  await connection.end();
  io.emit('atualizacao_dados'); 
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
  const { nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor } = req.body;
  const connection = await mysql.createConnection(dbConfig);
  await connection.execute(
    'UPDATE equipamentos SET nome = ?, tipo = ?, temp_min = ?, temp_max = ?, umidade_min = ?, umidade_max = ?, intervalo_degelo = ?, duracao_degelo = ?, setor = ? WHERE id = ?', 
    [nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor, id]
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

app.put('/api/equipamentos/:id', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { temp_min, temp_max, umidade_min, umidade_max, motor_ligado } = req.body;
  const connection = await mysql.createConnection(dbConfig);
  const [equipAtual] = await connection.execute('SELECT motor_ligado, nome, em_degelo FROM equipamentos WHERE id = ?', [id]);

  await connection.execute(
    'UPDATE equipamentos SET temp_min = ?, temp_max = ?, umidade_min = ?, umidade_max = ?, motor_ligado = ? WHERE id = ?', 
    [temp_min, temp_max, umidade_min, umidade_max, motor_ligado, id]
  );

  const estavaLigado = equipAtual[0].motor_ligado == 1 || equipAtual[0].motor_ligado === true;
  const vaiDesligar = motor_ligado === 0 || motor_ligado === false;
  const emDegelo = equipAtual[0].em_degelo == 1 || equipAtual[0].em_degelo === true;

  if (estavaLigado && vaiDesligar && !emDegelo) {
    const msg = `FALHA MECÂNICA: O motor do equipamento "${equipAtual[0].nome}" parou de funcionar inesperadamente!`;
    const [alertasAtivos] = await connection.execute('SELECT id FROM notificacoes WHERE equipamento_id = ? AND resolvido = FALSE AND mensagem = ?', [id, msg]);
    if (alertasAtivos.length === 0) {
      await connection.execute('INSERT INTO notificacoes (equipamento_id, mensagem) VALUES (?, ?)', [id, msg]);
    }
  }
  await connection.end();
  io.emit('atualizacao_dados');
  res.json({ message: 'Equipamento atualizado' });
});

app.get('/api/notificacoes', verificarToken, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.execute(`
    SELECT n.*, e.nome AS equipamento_nome, e.setor 
    FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id 
    WHERE n.resolvido = FALSE ORDER BY n.data_hora DESC
  `);
  await connection.end();
  res.json(rows);
});

app.get('/api/notificacoes/historico', verificarToken, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.execute(`
    SELECT n.*, e.nome AS equipamento_nome, e.setor 
    FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id 
    WHERE n.resolvido = TRUE ORDER BY n.data_hora DESC LIMIT 100
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
  await connection.execute('UPDATE notificacoes SET resolvido = TRUE, nota_resolucao = ? WHERE resolvido = FALSE', ['Resolvido em massa pelo sistema']);
  await connection.end();
  io.emit('atualizacao_dados');
  res.json({ message: 'Todas as notificações resolvidas' });
});

app.get('/api/relatorios', verificarToken, async (req, res) => {
  const { data_inicio, data_fim } = req.query;
  const connection = await mysql.createConnection(dbConfig);
  let query = `
    SELECT l.id, l.temperatura, l.umidade, l.data_hora, e.nome, e.setor 
    FROM leituras l JOIN equipamentos e ON l.equipamento_id = e.id WHERE 1=1
  `;
  const params = [];
  if (data_inicio && data_fim) {
    query += ' AND l.data_hora BETWEEN ? AND ?';
    params.push(new Date(data_inicio), new Date(data_fim));
  } else {
    query += ' AND l.data_hora >= DATE_SUB(NOW(), INTERVAL 1 DAY)'; 
  }
  query += ' ORDER BY l.data_hora ASC';
  const [rows] = await connection.execute(query, params);
  await connection.end();
  res.json(rows);
});

app.post('/api/leituras', async (req, res) => {
  const { equipamento_id, temperatura, umidade } = req.body;
  const connection = await mysql.createConnection(dbConfig);
  
  const [result] = await connection.execute(
    'INSERT INTO leituras (equipamento_id, temperatura, umidade) VALUES (?, ?, ?)', 
    [equipamento_id, temperatura, umidade || 50.0]
  );
  
  const [equip] = await connection.execute('SELECT temp_max, temp_min, umidade_min, umidade_max, nome, em_degelo, setor FROM equipamentos WHERE id = ?', [equipamento_id]);

  if (equip.length > 0) {
    const tAtual = parseFloat(temperatura);
    const uAtual = parseFloat(umidade || 50);
    const tMax = parseFloat(equip[0].temp_max);
    const tMin = parseFloat(equip[0].temp_min);
    const uMin = parseFloat(equip[0].umidade_min || 40);
    const uMax = parseFloat(equip[0].umidade_max || 80);
    const emDegelo = equip[0].em_degelo == 1 || equip[0].em_degelo === true;

    // Resolve automaticamente alertas de falha de rede se os dados voltarem a chegar
    await connection.execute('UPDATE notificacoes SET resolvido = TRUE, nota_resolucao = "Conexão restabelecida automaticamente." WHERE equipamento_id = ? AND resolvido = FALSE AND mensagem LIKE "%FALHA DE REDE%"', [equipamento_id]);

    if ((tAtual > tMax || tAtual < tMin) && !emDegelo) {
      const [alertasAtivos] = await connection.execute('SELECT id FROM notificacoes WHERE equipamento_id = ? AND resolvido = FALSE AND mensagem LIKE "%EXCURSÃO TÉRMICA%"', [equipamento_id]);
      if (alertasAtivos.length === 0) {
        await connection.execute(
          'INSERT INTO notificacoes (equipamento_id, mensagem) VALUES (?, ?)', 
          [equipamento_id, `EXCURSÃO TÉRMICA: O equipamento ${equip[0].nome} (${tAtual}°C) operou fora da faixa de ${tMin}°C a ${tMax}°C.`]
        );
      }
    }

    if ((uAtual < uMin || uAtual > uMax) && !emDegelo) {
      const [alertasUmidade] = await connection.execute('SELECT id FROM notificacoes WHERE equipamento_id = ? AND resolvido = FALSE AND mensagem LIKE "%ALERTA HIGROMÉTRICO%"', [equipamento_id]);
      if (alertasUmidade.length === 0) {
        await connection.execute(
          'INSERT INTO notificacoes (equipamento_id, mensagem) VALUES (?, ?)', 
          [equipamento_id, `ALERTA HIGROMÉTRICO: O equipamento ${equip[0].nome} registou ${uAtual}% (Limites: ${uMin}% a ${uMax}%).`]
        );
      }
    }
  }
  await connection.end();

  io.emit('nova_leitura', {
    id: result.insertId,
    equipamento_id,
    temperatura: parseFloat(temperatura),
    umidade: parseFloat(umidade || 50),
    data_hora: new Date(),
    nome: equip[0]?.nome,
    setor: equip[0]?.setor
  });

  res.status(201).send();
});

server.listen(3001, () => {
  console.log('PharmaX Telemetry Server a rodar na porta 3001');
});