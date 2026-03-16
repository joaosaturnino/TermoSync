const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

// ATENÇÃO: Coloque a sua senha do banco de dados aqui novamente
const dbConfig = { host: 'localhost', user: 'root', password: '2409', database: 'friomonitor_db' };
const SECRET_KEY = 'chave_super_secreta_frio_monitor'; 

// --- AUTENTICAÇÃO ---
app.post('/api/setup', async (req, res) => {
    const hash = await bcrypt.hash('admin123', 10);
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('INSERT IGNORE INTO usuarios (usuario, senha) VALUES (?, ?)', ['admin', hash]);
    await connection.end();
    res.send('Usuário "admin" criado com a senha "admin123"');
});

app.post('/api/login', async (req, res) => {
    const { usuario, senha } = req.body;
    const connection = await mysql.createConnection(dbConfig);
    const [users] = await connection.execute('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
    await connection.end();

    if (users.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });

    const senhaValida = await bcrypt.compare(senha, users[0].senha);
    if (!senhaValida) return res.status(401).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ id: users[0].id }, SECRET_KEY, { expiresIn: '8h' });
    res.json({ token });
});

const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'Acesso negado.' });
    jwt.verify(token.split(' ')[1], SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Token inválido.' });
        req.userId = decoded.id;
        next();
    });
};

// --- ROTAS DA API ---
app.get('/api/equipamentos', verificarToken, async (req, res) => {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM equipamentos');
    await connection.end();
    res.json(rows);
});

app.post('/api/equipamentos', verificarToken, async (req, res) => {
    const { nome, tipo, temp_min, temp_max, intervalo_degelo, duracao_degelo } = req.body;
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
        'INSERT INTO equipamentos (nome, tipo, temp_min, temp_max, motor_ligado, intervalo_degelo, duracao_degelo, em_degelo) VALUES (?, ?, ?, ?, TRUE, ?, ?, FALSE)',
        [nome, tipo, temp_min, temp_max, intervalo_degelo || 6, duracao_degelo || 30]
    );
    await connection.end();
    res.status(201).json({ message: 'Equipamento adicionado com sucesso' });
});

app.delete('/api/equipamentos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('DELETE FROM equipamentos WHERE id = ?', [id]);
    await connection.end();
    res.json({ message: 'Equipamento excluído com sucesso' });
});

app.put('/api/equipamentos/:id/edit', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { nome, tipo, temp_min, temp_max } = req.body;
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
        'UPDATE equipamentos SET nome = ?, tipo = ?, temp_min = ?, temp_max = ? WHERE id = ?',
        [nome, tipo, temp_min, temp_max, id]
    );
    await connection.end();
    res.json({ message: 'Equipamento atualizado com sucesso' });
});

// NOVA ROTA: Atualizar apenas o status do Degelo
app.put('/api/equipamentos/:id/degelo', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { em_degelo } = req.body;
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('UPDATE equipamentos SET em_degelo = ? WHERE id = ?', [em_degelo, id]);
    await connection.end();
    res.json({ message: 'Status de degelo atualizado' });
});

app.put('/api/equipamentos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { temp_min, temp_max, motor_ligado } = req.body;
    const connection = await mysql.createConnection(dbConfig);
    
    const [equipAtual] = await connection.execute('SELECT motor_ligado, nome, em_degelo FROM equipamentos WHERE id = ?', [id]);
    
    await connection.execute(
        'UPDATE equipamentos SET temp_min = ?, temp_max = ?, motor_ligado = ? WHERE id = ?',
        [temp_min, temp_max, motor_ligado, id]
    );

    // Só envia notificação de "Motor Parou" se não estiver em degelo
    if (equipAtual.length > 0 && equipAtual[0].motor_ligado == true && motor_ligado == false && equipAtual[0].em_degelo == false) {
        const msg = `O motor do equipamento "${equipAtual[0].nome}" parou de funcionar inesperadamente!`;
        await connection.execute('INSERT INTO notificacoes (equipamento_id, mensagem) VALUES (?, ?)', [id, msg]);
    }

    await connection.end();
    res.json({ message: 'Equipamento atualizado' });
});

app.get('/api/notificacoes', verificarToken, async (req, res) => {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM notificacoes WHERE resolvido = FALSE ORDER BY data_hora DESC');
    await connection.end();
    res.json(rows);
});

app.put('/api/notificacoes/:id/resolver', verificarToken, async (req, res) => {
    const { id } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('UPDATE notificacoes SET resolvido = TRUE WHERE id = ?', [id]);
    await connection.end();
    res.json({ message: 'Notificação resolvida' });
});

app.get('/api/relatorios', verificarToken, async (req, res) => {
    const { periodo } = req.query;
    let limitDays = periodo === 'semanal' ? 7 : periodo === 'mensal' ? 30 : periodo === 'anual' ? 365 : 1;
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(`SELECT l.id, l.temperatura, l.data_hora, e.nome FROM leituras l JOIN equipamentos e ON l.equipamento_id = e.id WHERE l.data_hora >= DATE_SUB(NOW(), INTERVAL ? DAY) ORDER BY l.data_hora ASC`, [limitDays]);
    await connection.end();
    res.json(rows);
});

// Receber leituras e validar degelo
app.post('/api/leituras', async (req, res) => {
    const { equipamento_id, temperatura } = req.body;
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('INSERT INTO leituras (equipamento_id, temperatura) VALUES (?, ?)', [equipamento_id, temperatura]);
    
    const [equip] = await connection.execute('SELECT temp_max, nome, em_degelo FROM equipamentos WHERE id = ?', [equipamento_id]);
    
    // Regra da temperatura alta: SÓ ALERTA SE NÃO ESTIVER EM DEGELO!
    if (equip.length > 0 && temperatura > equip[0].temp_max && equip[0].em_degelo == false) {
        
        // Evita flood: só insere se já não houver alerta ativo
        const [alertasAtivos] = await connection.execute('SELECT id FROM notificacoes WHERE equipamento_id = ? AND resolvido = FALSE', [equipamento_id]);
        if (alertasAtivos.length === 0) {
            await connection.execute('INSERT INTO notificacoes (equipamento_id, mensagem) VALUES (?, ?)', [equipamento_id, `A temperatura do ${equip[0].nome} (${temperatura}°C) excedeu o limite máximo.`]);
        }
    }
    await connection.end();
    res.status(201).send();
});

app.listen(3001, () => console.log('Backend rodando na porta 3001'));