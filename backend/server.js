/**
 * Servidor Backend - TermoSync Enterprise (Ultimate Edition)
 * ATUALIZADO: Auto-Patch no Banco de Dados + Correção de Erros Mascarados
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
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] } });

app.use(cors());
app.use(express.json({ limit: '1mb' })); 

const pool = mysql.createPool({ 
  host: process.env.DB_HOST || 'localhost', 
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '2409', 
  database: process.env.DB_NAME || 'friomonitor_db',
  waitForConnections: true,
  connectionLimit: 20
});

const SECRET_KEY = process.env.JWT_SECRET || 'chave_super_secreta_termosync_node';
const PORT = process.env.PORT || 3000;

/* ====================================================
   AUTO-SEIDER E CRIAÇÃO DAS TABELAS
   ==================================================== */
async function inicializarMassaDeDados() {
  try {
    await pool.execute(`CREATE TABLE IF NOT EXISTS tecnicos (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(150) NOT NULL, telefone VARCHAR(50), data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS lojas (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100) UNIQUE, endereco VARCHAR(255), telefone VARCHAR(50), data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS usuarios (id INT AUTO_INCREMENT PRIMARY KEY, usuario VARCHAR(50) UNIQUE NOT NULL, senha VARCHAR(255) NOT NULL, role ENUM('ADMIN', 'MANUTENCAO', 'LOJA') DEFAULT 'LOJA', filial VARCHAR(100), nome_gerente VARCHAR(150) NULL, nome_coordenador VARCHAR(150) NULL, nome_tecnico VARCHAR(150) NULL, tecnico_id INT NULL)`);
    
    // TABELAS DE PARÂMETROS
    await pool.execute(`CREATE TABLE IF NOT EXISTS setores (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100) UNIQUE NOT NULL)`);
    
    // TABELA DE TIPOS INICIAL
    await pool.execute(`CREATE TABLE IF NOT EXISTS tipos_refrigeracao (
      id INT AUTO_INCREMENT PRIMARY KEY, 
      nome VARCHAR(100) UNIQUE NOT NULL
    )`);

    // 🔴 AUTO-PATCH: Atualiza as tabelas antigas injetando as novas colunas da ANVISA (ignora se já existirem)
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
    const dtCalib = new Date().toISOString().split('T')[0];

    const [adminMasterCheck] = await pool.execute('SELECT id FROM usuarios WHERE usuario = "admin_master"');
    if (adminMasterCheck.length === 0) {
      await pool.execute('INSERT INTO usuarios (usuario, senha, role, filial) VALUES (?, ?, ?, ?)', ['admin_master', defaultPassword, 'ADMIN', 'Todas']);
    }

    const [checkSetores] = await pool.execute('SELECT id FROM setores LIMIT 1');
    if (checkSetores.length === 0) {
      const defaultSetores = ['Açougue', 'Congelados', 'FLV', 'Frios e Laticínios', 'Farmácia / Vacinas', 'Bebidas'];
      for (let s of defaultSetores) await pool.execute('INSERT IGNORE INTO setores (nome) VALUES (?)', [s]);
    }

    // INJEÇÃO DOS TIPOS COM AS REGRAS DA ANVISA
    const [checkTipos] = await pool.execute('SELECT id FROM tipos_refrigeracao LIMIT 1');
    if (checkTipos.length === 0) {
      const defaultTipos = [
        { n: 'Câmara Frigorífica (Resfriados)', tMin: 0, tMax: 8, uMin: 60, uMax: 85, iD: 6, dD: 30 },
        { n: 'Ilha de Congelados', tMin: -24, tMax: -18, uMin: 60, uMax: 80, iD: 6, dD: 30 },
        { n: 'Balcão Refrigerado Aberto', tMin: 2, tMax: 10, uMin: 60, uMax: 85, iD: 4, dD: 20 },
        { n: 'Câmara de Vacinas / Fármacos', tMin: 2, tMax: 8, uMin: 35, uMax: 65, iD: 12, dD: 15 }
      ];
      for (let t of defaultTipos) {
        await pool.execute(
          'INSERT IGNORE INTO tipos_refrigeracao (nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo) VALUES (?, ?, ?, ?, ?, ?, ?)', 
          [t.n, t.tMin, t.tMax, t.uMin, t.uMax, t.iD, t.dD]
        );
      }
    }

    const [lojasCheck] = await pool.execute('SELECT id FROM lojas LIMIT 1');
    if (lojasCheck.length === 0) {
      const lojasInfo = [{ n: 'Loja Marília Sul', e: 'Av. Tiradentes', t: '(14) 3433' }];
      await pool.execute('INSERT INTO lojas (nome, endereco, telefone) VALUES (?, ?, ?)', [lojasInfo[0].n, lojasInfo[0].e, lojasInfo[0].t]);
    }
  } catch (err) {}
}
inicializarMassaDeDados();

/* --- SEGURANÇA E AUTH --- */
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'Acesso negado.' });
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido.' });
    req.userId = decoded.id; req.userRole = decoded.role; req.userFilial = decoded.filial; next();
  });
};

app.post('/api/login', async (req, res) => {
  const { usuario, senha } = req.body;
  const [users] = await pool.execute('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
  if (users.length === 0) return res.status(401).json({ error: 'Utilizador não encontrado' });
  const senhaValida = await bcrypt.compare(senha, users[0].senha);
  if (!senhaValida) return res.status(401).json({ error: 'Palavra-passe incorreta' });
  
  const token = jwt.sign({ id: users[0].id, role: users[0].role, filial: users[0].filial }, SECRET_KEY, { expiresIn: '12h' });
  res.json({ token, role: users[0].role, filial: users[0].filial, nome_gerente: users[0].nome_gerente, nome_coordenador: users[0].nome_coordenador, nome_tecnico: users[0].nome_tecnico });
});

/* ====================================================
   ROTAS: GESTÃO DE SETORES E TIPOS (ADMIN)
   ==================================================== */

// SETORES
app.get('/api/setores', verificarToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, nome FROM setores ORDER BY nome ASC');
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/setores', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  try {
    await pool.execute('INSERT INTO setores (nome) VALUES (?)', [req.body.nome]);
    io.emit('atualizacao_dados'); res.status(201).send();
  } catch (error) { 
    // 🔴 Exibindo o erro real do SQL, caso ocorra, em vez de mensagem genérica
    res.status(500).json({ error: error.message }); 
  }
});

app.put('/api/setores/:id', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  try {
    const [antigo] = await pool.execute('SELECT nome FROM setores WHERE id=?', [req.params.id]);
    if(antigo.length > 0 && antigo[0].nome !== req.body.nome) {
      await pool.execute('UPDATE equipamentos SET setor=? WHERE setor=?', [req.body.nome, antigo[0].nome]);
      await pool.execute('UPDATE setores SET nome=? WHERE id=?', [req.body.nome, req.params.id]);
      io.emit('atualizacao_dados');
    }
    res.send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/setores/:id', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  try {
    await pool.execute('DELETE FROM setores WHERE id=?', [req.params.id]);
    io.emit('atualizacao_dados'); res.send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// TIPOS DE REFRIGERAÇÃO COM NORMAS ANVISA
app.get('/api/tipos-refrigeracao', verificarToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM tipos_refrigeracao ORDER BY nome ASC');
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/tipos-refrigeracao', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  try {
    const { nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo } = req.body;
    
    // Prevenção extra: Se o front falhar ao mandar o número, o backend assume o valor padrão e salva de qualquer jeito.
    const tMin = temp_min !== undefined ? temp_min : 0;
    const tMax = temp_max !== undefined ? temp_max : 8;
    const uMin = umidade_min !== undefined ? umidade_min : 60;
    const uMax = umidade_max !== undefined ? umidade_max : 85;
    const intDeg = intervalo_degelo !== undefined ? intervalo_degelo : 6;
    const durDeg = duracao_degelo !== undefined ? duracao_degelo : 30;

    await pool.execute(
      'INSERT INTO tipos_refrigeracao (nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo) VALUES (?, ?, ?, ?, ?, ?, ?)', 
      [nome, tMin, tMax, uMin, uMax, intDeg, durDeg]
    );
    io.emit('atualizacao_dados'); res.status(201).send();
  } catch (error) { 
    // 🔴 Exibindo o erro real do SQL, caso ocorra (Removemos a mensagem hardcoded que mascarava)
    res.status(500).json({ error: error.message }); 
  }
});

app.put('/api/tipos-refrigeracao/:id', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  try {
    const { nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo } = req.body;
    const [antigo] = await pool.execute('SELECT nome FROM tipos_refrigeracao WHERE id=?', [req.params.id]);
    
    await pool.execute(
      'UPDATE tipos_refrigeracao SET nome=?, temp_min=?, temp_max=?, umidade_min=?, umidade_max=?, intervalo_degelo=?, duracao_degelo=? WHERE id=?', 
      [nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, req.params.id]
    );

    if(antigo.length > 0 && antigo[0].nome !== nome) {
      await pool.execute('UPDATE equipamentos SET tipo=? WHERE tipo=?', [nome, antigo[0].nome]);
    }
    io.emit('atualizacao_dados');
    res.send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/tipos-refrigeracao/:id', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  try {
    await pool.execute('DELETE FROM tipos_refrigeracao WHERE id=?', [req.params.id]);
    io.emit('atualizacao_dados'); res.send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

/* ====================================================
   RESTANTES ROTAS PADRÃO (Equipamentos, Leituras, etc)
   ==================================================== */

app.get('/api/tecnicos', verificarToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, usuario, nome_tecnico FROM usuarios WHERE role = "MANUTENCAO" AND nome_tecnico IS NOT NULL ORDER BY nome_tecnico ASC');
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/lojas', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  try {
    const query = `SELECT l.*, (SELECT nome_gerente FROM usuarios u WHERE u.filial = l.nome AND u.nome_gerente IS NOT NULL LIMIT 1) AS nome_gerente, (SELECT nome_coordenador FROM usuarios u WHERE u.filial = l.nome AND u.nome_coordenador IS NOT NULL LIMIT 1) AS nome_coordenador FROM lojas l ORDER BY l.nome ASC`;
    const [rows] = await pool.execute(query);
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/cadastrar-loja', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  const { filial, endereco_loja, telefone_loja, senha, nome_gerente, usuario_gerente, nome_coordenador, usuario_coordenador } = req.body;
  try {
    await pool.execute('INSERT IGNORE INTO lojas (nome, endereco, telefone) VALUES (?, ?, ?)', [filial, endereco_loja || '', telefone_loja || '']);
    const hash = await bcrypt.hash(senha, 10);
    if (usuario_gerente) await pool.execute('INSERT INTO usuarios (usuario, senha, role, filial, nome_gerente) VALUES (?, ?, ?, ?, ?)', [usuario_gerente, hash, 'LOJA', filial, nome_gerente || null]);
    if (usuario_coordenador) await pool.execute('INSERT INTO usuarios (usuario, senha, role, filial, nome_coordenador) VALUES (?, ?, ?, ?, ?)', [usuario_coordenador, hash, 'LOJA', filial, nome_coordenador || null]);
    res.status(201).json({ message: 'Loja cadastrada com sucesso!' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/lojas/:id', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  const novoNome = req.body.filial || req.body.nome; 
  const { endereco_loja, telefone_loja } = req.body;
  try {
    const [lojaAntiga] = await pool.execute('SELECT nome FROM lojas WHERE id = ?', [req.params.id]);
    if (lojaAntiga.length === 0) return res.status(404).send();
    const nomeAntigo = lojaAntiga[0].nome;
    await pool.execute('UPDATE lojas SET nome=?, endereco=?, telefone=? WHERE id=?', [novoNome, endereco_loja, telefone_loja, req.params.id]);
    if (nomeAntigo !== novoNome && novoNome) {
      await pool.execute('UPDATE usuarios SET filial=? WHERE filial=?', [novoNome, nomeAntigo]);
      await pool.execute('UPDATE equipamentos SET filial=? WHERE filial=?', [novoNome, nomeAntigo]);
      await pool.execute('UPDATE chamados SET filial=? WHERE filial=?', [novoNome, nomeAntigo]);
    }
    io.emit('atualizacao_dados'); res.send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/lojas/:id', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  const [loja] = await pool.execute('SELECT nome FROM lojas WHERE id = ?', [req.params.id]);
  if (loja.length > 0) {
    await pool.execute('DELETE FROM equipamentos WHERE filial = ?', [loja[0].nome]);
    await pool.execute('DELETE FROM usuarios WHERE filial = ?', [loja[0].nome]);
  }
  await pool.execute('DELETE FROM lojas WHERE id = ?', [req.params.id]); res.send();
});

app.get('/api/auxiliares/filiais', verificarToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT nome AS filial FROM lojas ORDER BY nome ASC');
    if(rows.length > 0) return res.json(rows.map(r => r.filial));
    const [fallback] = await pool.execute(`SELECT DISTINCT filial FROM usuarios WHERE filial != 'Todas' UNION SELECT DISTINCT filial FROM equipamentos WHERE filial IS NOT NULL AND filial != 'Todas' ORDER BY filial ASC`);
    res.json(fallback.map(r => r.filial));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/equipamentos', verificarToken, async (req, res) => {
  let query = `SELECT e.*, (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp, (SELECT umidade FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_umidade FROM equipamentos e`;
  const params = []; if (req.userRole === 'LOJA') { query += ' WHERE e.filial = ?'; params.push(req.userFilial); }
  const [rows] = await pool.execute(query, params); res.json(rows);
});

app.post('/api/equipamentos', verificarToken, async (req, res) => {
  const { nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao } = req.body;
  const fFinal = req.userRole === 'LOJA' ? req.userFilial : (filial || 'Loja Principal');
  try {
    await pool.execute('INSERT INTO equipamentos (nome, tipo, temp_min, temp_max, umidade_min, umidade_max, motor_ligado, intervalo_degelo, duracao_degelo, em_degelo, setor, filial, data_calibracao) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?, FALSE, ?, ?, ?)', 
    [nome, tipo, temp_min||2, temp_max||8, umidade_min||0, umidade_max||0, intervalo_degelo||6, duracao_degelo||30, setor, fFinal, data_calibracao || new Date().toISOString().split('T')[0]]);
    io.emit('atualizacao_dados'); res.status(201).json({ message: 'OK' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/equipamentos/:id/edit', verificarToken, async (req, res) => {
  const { nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao } = req.body;
  try {
    await pool.execute('UPDATE equipamentos SET nome=?, tipo=?, temp_min=?, temp_max=?, umidade_min=?, umidade_max=?, intervalo_degelo=?, duracao_degelo=?, setor=?, filial=?, data_calibracao=? WHERE id=?', 
    [nome, tipo, temp_min, temp_max, umidade_min||0, umidade_max||0, intervalo_degelo, duracao_degelo, setor, req.userRole === 'LOJA' ? req.userFilial : filial, data_calibracao, req.params.id]);
    io.emit('atualizacao_dados'); res.json({ message: 'Atualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/equipamentos/:id', verificarToken, async (req, res) => {
  await pool.execute('DELETE FROM equipamentos WHERE id = ?', [req.params.id]);
  io.emit('atualizacao_dados'); res.json({ message: 'Excluído' });
});

app.get('/api/chamados', verificarToken, async (req, res) => {
  let query = `SELECT c.*, e.nome as equipamento_nome, u.usuario as aberto_por, l.endereco AS loja_endereco, l.telefone AS loja_telefone FROM chamados c JOIN equipamentos e ON c.equipamento_id = e.id JOIN usuarios u ON c.usuario_id = u.id LEFT JOIN lojas l ON c.filial = l.nome`;
  const params = [];
  if (req.userRole === 'LOJA') { query += ` WHERE c.filial = ?`; params.push(req.userFilial); }
  query += ` ORDER BY c.data_abertura DESC`;
  const [rows] = await pool.execute(query, params); res.json(rows);
});

app.post('/api/chamados', verificarToken, async (req, res) => {
  const { equipamento_id, descricao, solicitante_nome, tecnico_responsavel } = req.body;
  try {
    const [eq] = await pool.execute('SELECT filial FROM equipamentos WHERE id = ?', [equipamento_id]);
    const filialCorreta = eq.length > 0 ? eq[0].filial : req.userFilial;
    await pool.execute('INSERT INTO chamados (equipamento_id, usuario_id, filial, descricao, solicitante_nome, tecnico_responsavel) VALUES (?, ?, ?, ?, ?, ?)', 
      [equipamento_id, req.userId, filialCorreta, descricao, solicitante_nome || 'Equipa da Loja', tecnico_responsavel || 'Não Atribuído']
    );
    io.emit('atualizacao_dados'); res.status(201).send();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/chamados/:id/urgencia', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  await pool.execute('UPDATE chamados SET urgencia = ? WHERE id = ?', [req.body.urgencia, req.params.id]);
  io.emit('atualizacao_dados'); res.send();
});

app.put('/api/chamados/:id/status', verificarToken, async (req, res) => {
  if (req.userRole === 'LOJA') return res.status(403).send();
  const { status, nota_resolucao } = req.body;
  await pool.execute('UPDATE chamados SET status = ?, nota_resolucao = ?, data_conclusao = ? WHERE id = ?', [status, nota_resolucao, status === 'Concluído' ? new Date() : null, req.params.id]);
  io.emit('atualizacao_dados'); res.send();
});

app.get('/api/usuarios', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  const [rows] = await pool.execute('SELECT id, usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico FROM usuarios ORDER BY role ASC');
  res.json(rows);
});

app.post('/api/usuarios', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  const { usuario, senha, role, filial, nome_gerente, nome_coordenador, nome_tecnico } = req.body;
  const hash = await bcrypt.hash(senha, 10);
  await pool.execute('INSERT INTO usuarios (usuario, senha, role, filial, nome_gerente, nome_coordenador, nome_tecnico) VALUES (?, ?, ?, ?, ?, ?, ?)', 
  [usuario, hash, role, filial || 'Todas', nome_gerente || null, nome_coordenador || null, nome_tecnico || null]);
  res.status(201).send();
});

app.put('/api/usuarios/:id', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  const { usuario, senha, role, filial, nome_gerente, nome_coordenador, nome_tecnico } = req.body;
  if (senha) {
    const hash = await bcrypt.hash(senha, 10);
    await pool.execute('UPDATE usuarios SET usuario=?, senha=?, role=?, filial=?, nome_gerente=?, nome_coordenador=?, nome_tecnico=? WHERE id=?', 
    [usuario, hash, role, filial, nome_gerente || null, nome_coordenador || null, nome_tecnico || null, req.params.id]);
  } else {
    await pool.execute('UPDATE usuarios SET usuario=?, role=?, filial=?, nome_gerente=?, nome_coordenador=?, nome_tecnico=? WHERE id=?', 
    [usuario, role, filial, nome_gerente || null, nome_coordenador || null, nome_tecnico || null, req.params.id]);
  }
  res.send();
});

app.delete('/api/usuarios/:id', verificarToken, async (req, res) => {
  if (req.userRole !== 'ADMIN') return res.status(403).send();
  await pool.execute('DELETE FROM usuarios WHERE id = ?', [req.params.id]); res.send();
});

app.get('/api/notificacoes', verificarToken, async (req, res) => {
  let q = `SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE n.resolvido = FALSE`;
  const p = []; if (req.userRole === 'LOJA') { q += ` AND e.filial = ?`; p.push(req.userFilial); }
  q += ` ORDER BY n.data_hora DESC`; const [r] = await pool.execute(q, p); res.json(r);
});

app.get('/api/notificacoes/historico', verificarToken, async (req, res) => {
  let q = `SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE n.resolvido = TRUE`;
  const p = []; if (req.userRole === 'LOJA') { q += ` AND e.filial = ?`; p.push(req.userFilial); }
  q += ` ORDER BY n.data_hora DESC LIMIT 150`; const [r] = await pool.execute(q, p); res.json(r);
});

app.put('/api/notificacoes/:id/resolver', verificarToken, async (req, res) => {
  await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao=? WHERE id=?', [req.body.nota_resolucao||'Verificado', req.params.id]);
  io.emit('atualizacao_dados'); res.send();
});

app.put('/api/notificacoes/resolver-todas', verificarToken, async (req, res) => {
  if (req.userRole === 'ADMIN' || req.userRole === 'MANUTENCAO') { 
    await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao=?', ['Limpeza Global']); 
  } else { 
    await pool.execute(`UPDATE notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id SET n.resolvido=TRUE, n.nota_resolucao=? WHERE n.resolvido=FALSE AND e.filial=?`, ['Verificado', req.userFilial]); 
  }
  io.emit('atualizacao_dados'); res.send();
});

app.get('/api/relatorios', verificarToken, async (req, res) => {
  let q = `SELECT l.id, l.temperatura, l.umidade, l.consumo_kwh, l.data_hora, e.nome, e.setor, e.filial FROM leituras l JOIN equipamentos e ON l.equipamento_id = e.id WHERE 1=1`;
  const p = []; if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); }
  if (req.query.data_inicio && req.query.data_fim) { q += ' AND l.data_hora BETWEEN ? AND ?'; p.push(new Date(req.query.data_inicio), new Date(req.query.data_fim)); } 
  else { q += ' AND l.data_hora >= DATE_SUB(NOW(), INTERVAL 1 DAY)'; }
  q += ' ORDER BY l.data_hora ASC LIMIT 15000'; const [r] = await pool.execute(q, p); res.json(r);
});

app.post('/api/leituras', async (req, res) => {
  try {
    const { equipamento_id, temperatura, umidade, alerta_forçado, consumo_kwh, motor_ligado, em_degelo } = req.body;
    
    const t = parseFloat(temperatura);
    const u = parseFloat(umidade || 50.0);
    const c_kwh = parseFloat(consumo_kwh || 0.0);

    const [r] = await pool.execute('INSERT INTO leituras (equipamento_id, temperatura, umidade, consumo_kwh) VALUES (?, ?, ?, ?)', [equipamento_id, t, u, c_kwh]);
    const [eq] = await pool.execute('SELECT temp_max, temp_min, umidade_min, umidade_max, nome, em_degelo, motor_ligado, setor, filial FROM equipamentos WHERE id = ?', [equipamento_id]);

    if (eq.length > 0) {
      const isMotorLigado = (motor_ligado == 1 || motor_ligado === true);
      const isEmDegelo = (em_degelo == 1 || em_degelo === true);
      await pool.execute('UPDATE equipamentos SET motor_ligado=?, em_degelo=? WHERE id=?', [isMotorLigado, isEmDegelo, equipamento_id]);
      
      let notif = false;
      const tMax = parseFloat(eq[0].temp_max); 
      const tMin = parseFloat(eq[0].temp_min);
      const uMax = parseFloat(eq[0].umidade_max || 80);
      const uMin = parseFloat(eq[0].umidade_min || 40);

      if (alerta_forçado === 'REDE') {
          const [a] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'REDE']);
          if (a.length===0) { await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `FALHA DE COMUNICAÇÃO: Sensor IoT offline ou sem Wi-Fi em "${eq[0].nome}".`, 'REDE']); notif = true; }
      } else if (alerta_forçado !== 'REDE') {
          const [resR] = await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao="Sinal restabelecido." WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'REDE']);
          if (resR.affectedRows > 0) notif = true;
      }
      if (alerta_forçado === 'METROLOGIA') {
          const [a] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'METROLOGIA']);
          if (a.length===0) { await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `AVISO RDC/ANVISA: Desvio de calibração detetado no sensor de "${eq[0].nome}".`, 'METROLOGIA']); notif = true; }
      }
      if (alerta_forçado === 'PORTA_ABERTA' && !isEmDegelo) {
          const [a] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'PORTA']);
          if (a.length===0) { await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `ANOMALIA: A porta de "${eq[0].nome}" está aberta!`, 'PORTA']); notif = true; }
      } else if (alerta_forçado !== 'PORTA_ABERTA') {
          const [resP] = await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao="Porta fechada pelo operador." WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'PORTA']);
          if (resP.affectedRows > 0) notif = true;
      }
      if (alerta_forçado === 'PERDA_EFICIENCIA' && !isEmDegelo) {
          const [a] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'PREDITIVO']);
          if (a.length===0) { await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `PREDITIVA: Compressor de "${eq[0].nome}" em esforço excessivo.`, 'PREDITIVO']); notif = true; }
      }
      if (!isMotorLigado && !isEmDegelo) { 
          const [a] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'MECANICA']);
          if (a.length === 0) { await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `PARADA TÉCNICA: ${eq[0].nome} parou inesperadamente!`, 'MECANICA']); notif = true; }
      } else if (isMotorLigado) {
          const [resM] = await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao="Motor religado." WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'MECANICA']);
          if (resM.affectedRows > 0) notif = true;
      }
      if (isEmDegelo && eq[0].em_degelo == 0) { 
          const [a] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'DEGELO']);
          if (a.length === 0) { await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `INFO: "${eq[0].nome}" entrou em DEGELO Automático.`, 'DEGELO']); notif = true; }
      } else if (!isEmDegelo && eq[0].em_degelo == 1) { 
          const [resD] = await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao="Degelo finalizado." WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'DEGELO']);
          if (resD.affectedRows > 0) notif = true;
      }

      if ((t > tMax || t < tMin) && !isEmDegelo) {
          const [a] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'TEMPERATURA']);
          if (a.length===0) { await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `EXCURSÃO TÉRMICA: ${eq[0].nome} fora da faixa.`, 'TEMPERATURA']); notif = true; }
      } else if (t >= tMin && t <= tMax) {
          const [resT] = await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao="Temperatura estabilizada." WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'TEMPERATURA']);
          if (resT.affectedRows > 0) notif = true;
      }
      if ((u < uMin || u > uMax) && !isEmDegelo) {
          const [a] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'UMIDADE']);
          if (a.length===0) { await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, `ALERTA HIGROMÉTRICO: Humidade de ${eq[0].nome} fora da faixa.`, 'UMIDADE']); notif = true; }
      } else if (u >= uMin && u <= uMax) {
          const [resU] = await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao="Humidade estabilizada." WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, 'UMIDADE']);
          if (resU.affectedRows > 0) notif = true;
      }

      if (notif) io.emit('atualizacao_dados');

      io.emit('nova_leitura', { 
        id: r.insertId, equipamento_id, temperatura: t, umidade: u, consumo_kwh: c_kwh, 
        motor_ligado: isMotorLigado, em_degelo: isEmDegelo, data_hora: new Date(), 
        nome: eq[0].nome, setor: eq[0].setor, filial: eq[0].filial 
      });
    }
    res.status(201).send();
  } catch (error) { res.status(500).send(); }
});

server.listen(PORT, '0.0.0.0', () => { console.log(`Backend online na porta ${PORT}.`); });