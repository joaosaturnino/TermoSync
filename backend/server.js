/**
 * Servidor Backend - TermoSync Telemetry Node (Production Ready)
 * Otimizado com Connection Pooling para Alta Performance e Correções de Segurança.
 */

require('dotenv').config();
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

// Connection Pool em vez de conexões individuais
const pool = mysql.createPool({ 
  host: process.env.DB_HOST || 'localhost', 
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '2409', 
  database: process.env.DB_NAME || 'friomonitor_db',
  waitForConnections: true,
  connectionLimit: 20, 
  queueLimit: 0
});

const SECRET_KEY = process.env.JWT_SECRET || 'chave_super_secreta_termosync_node';
const PORT = process.env.PORT || 3001;

/* ====================================================
   WATCHDOG E AUDITORIA CONTÍNUA (A CADA 15s)
   ==================================================== */
const sensoresAtivos = new Map();

setInterval(async () => {
  let gerouAlerta = false;
  const agora = Date.now();

  // 1. AUDITORIA DE REDE: Verifica perda de comunicação com sensores
  if (sensoresAtivos.size > 0) {
    for (const [equipId, ultimoSinal] of sensoresAtivos.entries()) {
      const diffSegundos = (agora - ultimoSinal) / 1000;
      
      if (diffSegundos > 20) { 
        try {
          const [equip] = await pool.execute('SELECT nome FROM equipamentos WHERE id = ?', [equipId]);
          if (equip.length > 0) {
            const msg = `FALHA DE REDE: Perda de comunicação com o sensor "${equip[0].nome}". Timeout excedido.`;
            const [alertasAtivos] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id = ? AND resolvido = FALSE AND tipo_alerta = ?', [equipId, 'REDE']);
            
            if (alertasAtivos.length === 0) {
              await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipId, msg, 'REDE']);
              gerouAlerta = true;
            }
          }
        } catch (error) {
          console.error("[WATCHDOG REDE] Erro:", error.message);
        }
        sensoresAtivos.delete(equipId);
      }
    }
  }

  // 2. AUDITORIA MECÂNICA: Verifica se há motores parados FORA do degelo
  try {
    const [motoresParados] = await pool.execute(
      'SELECT id, nome FROM equipamentos WHERE motor_ligado = FALSE AND em_degelo = FALSE'
    );
    
    for (const eq of motoresParados) {
      const [alertasAtivos] = await pool.execute(
        'SELECT id FROM notificacoes WHERE equipamento_id = ? AND resolvido = FALSE AND tipo_alerta = ?', 
        [eq.id, 'MECANICA']
      );
      
      // Se encontrou um motor parado e ainda não alertou, dispara a notificação
      if (alertasAtivos.length === 0) {
        const msg = `ALERTA MECÂNICO CONTÍNUO: O motor do equipamento "${eq.nome}" encontra-se PARADO fora do ciclo de degelo!`;
        await pool.execute(
          'INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', 
          [eq.id, msg, 'MECANICA']
        );
        gerouAlerta = true;
      }
    }
  } catch (error) {
    console.error("[WATCHDOG MOTOR] Erro ao verificar motores:", error.message);
  }

  // Se gerou qualquer alerta novo, atualiza os ecrãs de todos os utilizadores
  if (gerouAlerta) io.emit('atualizacao_dados');

}, 15000); 

/* ====================================================
   MIDDLEWARES & WEBSOCKETS
   ==================================================== */
io.on('connection', (socket) => {
  socket.on('medir_latencia', (timestamp, callback) => {
    if (typeof callback === 'function') callback(timestamp);
  });
});

// Middleware corrigido para extrair o token em segurança
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'Acesso negado. Token ausente.' });
  
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido ou expirado.' });
    req.userId = decoded.id;
    next();
  });
};

/* ====================================================
   ROTAS DE AUTENTICAÇÃO E EQUIPAMENTOS
   ==================================================== */
app.post('/api/setup', async (req, res) => {
  try {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.execute('INSERT IGNORE INTO usuarios (usuario, senha) VALUES (?, ?)', ['admin', hash]);
    res.send('Utilizador "admin" configurado com sucesso.');
  } catch (error) {
    res.status(500).json({ error: 'Erro ao configurar base de dados' });
  }
});

app.post('/api/login', async (req, res) => {
  const { usuario, senha } = req.body;
  const [users] = await pool.execute('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);

  if (users.length === 0) return res.status(401).json({ error: 'Utilizador não encontrado' });
  const senhaValida = await bcrypt.compare(senha, users[0].senha);
  if (!senhaValida) return res.status(401).json({ error: 'Palavra-passe incorreta' });

  const token = jwt.sign({ id: users[0].id }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ token });
});

app.get('/api/equipamentos', verificarToken, async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT e.*, 
    (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp,
    (SELECT umidade FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_umidade
    FROM equipamentos e
  `);
  res.json(rows);
});

app.post('/api/equipamentos', verificarToken, async (req, res) => {
  const { nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor } = req.body;
  
  const tMin = temp_min !== undefined && temp_min !== '' ? parseFloat(temp_min) : 2;
  const tMax = temp_max !== undefined && temp_max !== '' ? parseFloat(temp_max) : 8;
  const uMin = umidade_min !== undefined && umidade_min !== '' ? parseFloat(umidade_min) : 35;
  const uMax = umidade_max !== undefined && umidade_max !== '' ? parseFloat(umidade_max) : 65;

  await pool.execute(
    'INSERT INTO equipamentos (nome, tipo, temp_min, temp_max, umidade_min, umidade_max, motor_ligado, intervalo_degelo, duracao_degelo, em_degelo, setor) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?, FALSE, ?)', 
    [nome, tipo, tMin, tMax, uMin, uMax, intervalo_degelo || 6, duracao_degelo || 30, setor || 'Farmácia / Vacinas']
  );
  
  io.emit('atualizacao_dados'); 
  res.status(201).json({ message: 'Equipamento adicionado em conformidade.' });
});

app.delete('/api/equipamentos/:id', verificarToken, async (req, res) => {
  await pool.execute('DELETE FROM equipamentos WHERE id = ?', [req.params.id]);
  io.emit('atualizacao_dados');
  res.json({ message: 'Equipamento excluído' });
});

// Rota com conversão segura de floats e try/catch
app.put('/api/equipamentos/:id/edit', verificarToken, async (req, res) => {
  const { nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor } = req.body;
  
  const tMin = temp_min !== undefined && temp_min !== '' ? parseFloat(temp_min) : 2;
  const tMax = temp_max !== undefined && temp_max !== '' ? parseFloat(temp_max) : 8;
  const uMin = umidade_min !== undefined && umidade_min !== '' ? parseFloat(umidade_min) : 35;
  const uMax = umidade_max !== undefined && umidade_max !== '' ? parseFloat(umidade_max) : 65;

  try {
    await pool.execute(
      'UPDATE equipamentos SET nome = ?, tipo = ?, temp_min = ?, temp_max = ?, umidade_min = ?, umidade_max = ?, intervalo_degelo = ?, duracao_degelo = ?, setor = ? WHERE id = ?', 
      [nome, tipo, tMin, tMax, uMin, uMax, intervalo_degelo || 6, duracao_degelo || 30, setor, req.params.id]
    );
    io.emit('atualizacao_dados');
    res.json({ message: 'Equipamento atualizado' });
  } catch (error) {
    console.error("[ERRO DB]", error);
    res.status(500).json({ error: 'Falha ao atualizar o hardware.' });
  }
});

app.put('/api/equipamentos/:id/degelo', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { em_degelo } = req.body;
  
  const [equipAtual] = await pool.execute('SELECT nome FROM equipamentos WHERE id = ?', [id]);
  await pool.execute('UPDATE equipamentos SET em_degelo = ? WHERE id = ?', [em_degelo, id]);

  if (em_degelo === true || em_degelo === 1) {
    const msg = `INFORMAÇÃO: O equipamento "${equipAtual[0].nome}" entrou no ciclo de DEGELO.`;
    const [alertasAtivos] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id = ? AND resolvido = FALSE AND tipo_alerta = ?', [id, 'DEGELO']);
    if (alertasAtivos.length === 0) {
      await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [id, msg, 'DEGELO']);
    }
  } else {
    await pool.execute('UPDATE notificacoes SET resolvido = TRUE, nota_resolucao = "Ciclo de degelo finalizado." WHERE equipamento_id = ? AND resolvido = FALSE AND tipo_alerta = ?', [id, 'DEGELO']);
  }

  io.emit('atualizacao_dados');
  res.json({ message: 'Status de degelo atualizado' });
});

app.put('/api/equipamentos/:id', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { temp_min, temp_max, umidade_min, umidade_max, motor_ligado } = req.body;
  
  try {
    const [equipAtual] = await pool.execute('SELECT motor_ligado, nome, em_degelo FROM equipamentos WHERE id = ?', [id]);

    await pool.execute(
      'UPDATE equipamentos SET temp_min = ?, temp_max = ?, umidade_min = ?, umidade_max = ?, motor_ligado = ? WHERE id = ?', 
      [temp_min, temp_max, umidade_min, umidade_max, motor_ligado, id]
    );

    const estavaLigado = equipAtual[0].motor_ligado == 1 || equipAtual[0].motor_ligado === true;
    const vaiDesligar = motor_ligado === 0 || motor_ligado === false;
    const emDegelo = equipAtual[0].em_degelo == 1 || equipAtual[0].em_degelo === true;

    // 1. Gera o alerta se o motor parar fora do degelo
    if (estavaLigado && vaiDesligar && !emDegelo) {
      const msg = `FALHA MECÂNICA: O motor do equipamento "${equipAtual[0].nome}" parou de funcionar inesperadamente!`;
      const [alertasAtivos] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id = ? AND resolvido = FALSE AND tipo_alerta = ?', [id, 'MECANICA']);
      if (alertasAtivos.length === 0) {
        await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [id, msg, 'MECANICA']);
      }
    }
    
    // 2. Resolve o alerta automaticamente se o motor for religado
    if (!estavaLigado && !vaiDesligar) {
      await pool.execute('UPDATE notificacoes SET resolvido = TRUE, nota_resolucao = "Motor religado (Ação detetada pelo sistema)." WHERE equipamento_id = ? AND resolvido = FALSE AND tipo_alerta = ?', [id, 'MECANICA']);
    }
    
    io.emit('atualizacao_dados');
    res.json({ message: 'Equipamento atualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao processar status do motor' });
  }
});

app.get('/api/notificacoes', verificarToken, async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT n.*, e.nome AS equipamento_nome, e.setor 
    FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id 
    WHERE n.resolvido = FALSE ORDER BY n.data_hora DESC
  `);
  res.json(rows);
});

app.get('/api/notificacoes/historico', verificarToken, async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT n.*, e.nome AS equipamento_nome, e.setor 
    FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id 
    WHERE n.resolvido = TRUE ORDER BY n.data_hora DESC LIMIT 100
  `);
  res.json(rows);
});

app.put('/api/notificacoes/:id/resolver', verificarToken, async (req, res) => {
  await pool.execute('UPDATE notificacoes SET resolvido = TRUE, nota_resolucao = ? WHERE id = ?', [req.body.nota_resolucao || 'Sem observações', req.params.id]);
  io.emit('atualizacao_dados');
  res.json({ message: 'Notificação resolvida' });
});

app.put('/api/notificacoes/resolver-todas', verificarToken, async (req, res) => {
  await pool.execute('UPDATE notificacoes SET resolvido = TRUE, nota_resolucao = ? WHERE resolvido = FALSE', ['Resolvido em massa pelo sistema']);
  io.emit('atualizacao_dados');
  res.json({ message: 'Todas as notificações resolvidas' });
});

/* ====================================================
   ROTAS DE TELEMETRIA E RELATÓRIOS
   ==================================================== */
app.get('/api/relatorios', verificarToken, async (req, res) => {
  const { data_inicio, data_fim } = req.query;
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
  const [rows] = await pool.execute(query, params);
  res.json(rows);
});

app.post('/api/leituras', async (req, res) => {
  const { equipamento_id, temperatura, umidade } = req.body;
  sensoresAtivos.set(equipamento_id, Date.now());

  const [result] = await pool.execute(
    'INSERT INTO leituras (equipamento_id, temperatura, umidade) VALUES (?, ?, ?)', 
    [equipamento_id, temperatura, umidade || 50.0]
  );
  
  const [equip] = await pool.execute('SELECT temp_max, temp_min, umidade_min, umidade_max, nome, em_degelo, setor FROM equipamentos WHERE id = ?', [equipamento_id]);

  if (equip.length > 0) {
    const tAtual = parseFloat(temperatura);
    const uAtual = parseFloat(umidade || 50);
    const tMax = parseFloat(equip[0].temp_max);
    const tMin = parseFloat(equip[0].temp_min);
    const uMin = parseFloat(equip[0].umidade_min || 40);
    const uMax = parseFloat(equip[0].umidade_max || 80);
    const emDegelo = equip[0].em_degelo == 1 || equip[0].em_degelo === true;

    await pool.execute('UPDATE notificacoes SET resolvido = TRUE, nota_resolucao = "Conexão restabelecida automaticamente." WHERE equipamento_id = ? AND resolvido = FALSE AND tipo_alerta = ?', [equipamento_id, 'REDE']);

    let enviouNotificacao = false;

    if ((tAtual > tMax || tAtual < tMin) && !emDegelo) {
      const [alertasAtivos] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id = ? AND resolvido = FALSE AND tipo_alerta = ?', [equipamento_id, 'TEMPERATURA']);
      if (alertasAtivos.length === 0) {
        await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `EXCURSÃO TÉRMICA: O equipamento ${equip[0].nome} (${tAtual}°C) operou fora da faixa de ${tMin}°C a ${tMax}°C.`, 'TEMPERATURA']);
        enviouNotificacao = true;
      }
    }

    if ((uAtual < uMin || uAtual > uMax) && !emDegelo) {
      const [alertasUmidade] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id = ? AND resolvido = FALSE AND tipo_alerta = ?', [equipamento_id, 'UMIDADE']);
      if (alertasUmidade.length === 0) {
        await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `ALERTA HIGROMÉTRICO: O equipamento ${equip[0].nome} registou ${uAtual}% (Limites: ${uMin}% a ${uMax}%).`, 'UMIDADE']);
        enviouNotificacao = true;
      }
    }

    if (enviouNotificacao) io.emit('atualizacao_dados');
  }

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

app.post('/api/relatorios/mkt', verificarToken, (req, res) => {
  const { temperaturas } = req.body;
  if (!temperaturas || temperaturas.length === 0) return res.json({ mkt: '--' });
  
  const dH = 83.144;
  const R = 0.0083144;
  let somaExponencial = 0;
  
  temperaturas.forEach(t => {
    const kelvin = parseFloat(t) + 273.15;
    somaExponencial += Math.exp(-dH / (R * kelvin));
  });
  
  const mediaExponencial = somaExponencial / temperaturas.length;
  const mktKelvin = (dH / R) / (-Math.log(mediaExponencial));
  const mktCelsius = (mktKelvin - 273.15).toFixed(2);
  
  res.json({ mkt: mktCelsius });
});

server.listen(PORT, () => console.log(`TermoSync Telemetry Server a rodar na porta ${PORT}`));