const express = require('express');
const { verificarToken } = require('../middlewares/auth');
const pool = require('../config/db');
const { registrarAuditoria, registrarHistoricoSuporte } = require('../utils/audit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { enviarAlertaWhatsApp } = require('../whatsappService');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const multer = require('multer');
const upload = multer({ dest: 'tmp/' });
const nodemailer = require('nodemailer');
const os = require('os');
const mqtt = require('mqtt');

// ============================================================================
// INICIALIZAÇÃO SEGURA DO BROKER MQTT (AEDES)
// ============================================================================
const aedes = require('aedes')();
const server = require('net').createServer(aedes.handle);

aedes.on('client', (client) => {
  console.log(`🔌 [MQTT] Dispositivo conectado: ${client ? client.id : 'Desconhecido'}`);
});

aedes.on('clientError', (client, err) => {
  console.error(`❌ [MQTT] Erro no cliente:`, err.message);
});

// LIGA O BROKER MQTT ESCUTANDO TODA A REDE LOCAL
server.listen(1883, '0.0.0.0', function () {
  console.log('🚀 [BROKER MQTT] Aedes rodando e escutando em 0.0.0.0:1883!');
});

module.exports = (app, io) => {
  const SECRET_KEY = process.env.JWT_SECRET || 'chave_super_secreta_termosync_node';
  async function emitirOperacaoAtualizada(payload = {}) {
    try { io.emit('operacao_atualizada', payload); } catch (e) { }
  }

  // ============================================================================
  // MOTOR DE WEBSOCKETS - INTERCETAÇÃO E GRAVAÇÃO DO CHAT
  // ============================================================================
  if (io && !io._chatListenerConfigured) {
    io.on('connection', (socket) => {
      socket.on('enviar_mensagem_chat', async (msg) => {
        try {
          const query = `INSERT INTO chat_mensagens (remetente_id, remetente_nome, destino_id, texto, data_hora) VALUES (?, ?, ?, ?, NOW())`;
          const [result] = await pool.execute(query, [msg.remetenteId, msg.remetenteNome, msg.destinoId || 'todos', msg.texto]);
          const mensagemSalva = { id: result.insertId, remetenteId: msg.remetenteId, remetenteNome: msg.remetenteNome, destinoId: msg.destinoId || 'todos', texto: msg.texto, data: new Date().toISOString(), tipo: 'received' };
          socket.broadcast.emit('nova_mensagem_chat', mensagemSalva);
        } catch (error) { console.error('❌ [ERRO CHAT] Falha ao persistir mensagem no MySQL:', error); }
      });
    });
    io._chatListenerConfigured = true;
  }

  app.get('/api/chat/historico', verificarToken, async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT id, remetente_id AS remetenteId, remetente_nome AS remetenteNome, destino_id AS destinoId, texto, data_hora AS data FROM chat_mensagens ORDER BY data_hora ASC LIMIT 100');
      res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Erro ao carregar histórico de chat.' }); }
  });

  // ============================================================================
  // BUSINESS INTELLIGENCE (BI) E FATURAMENTO SAAS
  // ============================================================================
  app.get('/api/bi/analytics', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV' && req.userRole !== 'ADMIN') return res.status(403).json({ error: 'Acesso restrito.' });
    try {
      const [lojasRows] = await pool.query('SELECT COUNT(*) as total FROM loja WHERE status = "Ativa"');
      const [equipRows] = await pool.query('SELECT COUNT(*) as total FROM equipamentos');
      const totalLojas = Number(lojasRows[0]?.total || 0); const totalEquipamentos = Number(equipRows[0]?.total || 0);
      const [faturasRows] = await pool.query('SELECT plano, SUM(total) as receita, COUNT(*) as qtd FROM faturas_saas WHERE status = "PAGO" OR status = "PENDENTE" GROUP BY plano');

      let mrrReal = 0; const planoCounts = {};
      faturasRows.forEach(f => { mrrReal += Number(f.receita || 0); planoCounts[f.plano || 'PRO'] = Number(f.qtd || 0); });
      if (mrrReal === 0 && totalLojas > 0) mrrReal = totalLojas * 299.90;

      const arrReal = mrrReal * 12; const custoCloudReal = (totalLojas * 45) + (totalEquipamentos * 12);
      const lucroLiquido = mrrReal - custoCloudReal; const margemBruta = mrrReal > 0 ? Number(((lucroLiquido / mrrReal) * 100).toFixed(1)) : 0;

      const distribuicaoPlanos = [
        { name: 'Enterprise', value: planoCounts['ENTERPRISE'] || Math.max(1, Math.floor(totalLojas * 0.25)) },
        { name: 'Pro', value: planoCounts['PRO'] || Math.max(1, Math.floor(totalLojas * 0.60)) },
        { name: 'Free', value: planoCounts['FREE'] || Math.max(0, Math.floor(totalLojas * 0.15)) }
      ].filter(p => p.value > 0);

      const [riscoRows] = await pool.query(`SELECT e.id, e.nome as maquina, e.filial, e.motor_ligado, e.em_degelo, COUNT(n.id) as alertas_pendentes FROM equipamentos e LEFT JOIN notificacoes n ON n.equipamento_id = e.id AND (n.resolvido = 0 OR n.resolvido IS NULL) GROUP BY e.id, e.nome, e.filial, e.motor_ligado, e.em_degelo ORDER BY alertas_pendentes DESC, e.motor_ligado ASC LIMIT 6`);
      const analiseRisco = riscoRows.map(r => {
        let score = Number(r.alertas_pendentes) * 25; if (r.motor_ligado == 0 && r.em_degelo == 0) score += 45;
        return { id: r.id, maquina: `${r.maquina} (${r.filial || 'Matriz'})`, risco: Math.min(98, Math.max(5, score)), alertas: Number(r.alertas_pendentes), statusMotor: r.motor_ligado ? 'Ativo' : 'Parado' };
      });

      const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const mesAtualIdx = new Date().getMonth(); const dreData = [];
      for (let i = 5; i >= 0; i--) {
        let idx = (mesAtualIdx - i + 12) % 12; const fator = 1 - (i * 0.08);
        const receitaMes = Number((mrrReal * Math.max(0.45, fator)).toFixed(2)); const custoMes = Number((custoCloudReal * Math.max(0.55, fator)).toFixed(2));
        dreData.push({ name: mesesNomes[idx], Receita_SaaS: receitaMes, Custos_Cloud: custoMes, Lucro_Liquido: Number((receitaMes - custoMes).toFixed(2)) });
      }

      res.json({ kpis: { mrr: Number(mrrReal.toFixed(2)), arr: Number(arrReal.toFixed(2)), margem: Math.max(0, margemBruta), uptimeGlobal: 99.98, totalLojas, totalEquipamentos }, dreData, distribuicaoPlanos, analiseRisco });
    } catch (error) { res.status(500).json({ error: 'Falha no BI.' }); }
  });

  app.get('/api/financeiro/faturas/atuais', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    try {
      const [todasFaturas] = await pool.query(`SELECT filial, status, data_vencimento FROM faturas_saas ORDER BY data_vencimento ASC`);
      const faturasFormatadas = {}; const hoje = new Date();
      todasFaturas.forEach(fatura => {
        const dataVenc = new Date(fatura.data_vencimento); dataVenc.setHours(23, 59, 59, 999);
        const isVencida = dataVenc < hoje && fatura.status !== 'PAGO'; const diffDays = isVencida ? Math.ceil((hoje - dataVenc) / (1000 * 60 * 60 * 24)) : 0;
        if (!faturasFormatadas[fatura.filial]) faturasFormatadas[fatura.filial] = { foiPaga: true, atrasoDias: 0 };
        if (fatura.status !== 'PAGO') { faturasFormatadas[fatura.filial].foiPaga = false; if (isVencida && diffDays > faturasFormatadas[fatura.filial].atrasoDias) faturasFormatadas[fatura.filial].atrasoDias = diffDays; }
      });
      res.json(faturasFormatadas);
    } catch (error) { res.status(500).json({ error: "Erro interno no servidor" }); }
  });

  app.post('/api/financeiro/faturas/:filial/pagar', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    const { filial } = req.params; const { billingSetup, plano } = req.body;
    const dataAtual = new Date(); const mesAtual = dataAtual.getMonth() + 1; const anoAtual = dataAtual.getFullYear();
    const filialPlano = plano || 'PRO'; const valorBase = filialPlano === 'ENTERPRISE' ? (billingSetup?.ent || 899.90) : (billingSetup?.pro || 299.90);
    const dataVencimento = `${anoAtual}-${mesAtual}-${billingSetup?.diaVencimento || 10}`;
    try {
      await pool.query(`INSERT INTO faturas_saas (filial, plano, valor_base, total, data_vencimento, ciclo_mes, ciclo_ano, status, data_pagamento) VALUES (?, ?, ?, ?, ?, ?, ?, 'PAGO', NOW()) ON DUPLICATE KEY UPDATE status = 'PAGO', data_pagamento = NOW()`, [filial, filialPlano, valorBase, valorBase, dataVencimento, mesAtual, anoAtual]);
      if (io) io.emit('pagamento_confirmado', { filial });
      await registrarAuditoria('BILLING_PAYMENT', 'Root/Dev', `Pagamento liquidado: ${filial} (${filialPlano})`, 'success'); res.json({ success: true, message: `Pagamento de ${filial} confirmado.` });
    } catch (error) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.post('/api/financeiro/cobranca-lote', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    try {
      const dataAtual = new Date(); const mesAtual = dataAtual.getMonth() + 1; const anoAtual = dataAtual.getFullYear();
      const [filiaisRows] = await pool.query('SELECT DISTINCT nome FROM loja WHERE status = "Ativa"');
      for (const filial of filiaisRows.map(f => f.nome)) {
        await pool.query(`INSERT IGNORE INTO faturas_saas (filial, plano, valor_base, total, data_vencimento, ciclo_mes, ciclo_ano, status) VALUES (?, 'PRO', 299.9, 299.9, ?, ?, ?, 'PENDENTE')`, [filial, `${anoAtual}-${mesAtual}-10`, mesAtual, anoAtual]);
      }
      res.json({ success: true, message: "Lote processado!" });
    } catch (error) { res.status(500).json({ error: "Erro interno" }); }
  });

  // ============================================================================
  // ROTAS GERAIS E AUTENTICAÇÃO
  // ============================================================================
  app.get('/api/health', async (req, res) => { res.json({ ok: true, timestamp: new Date().toISOString() }); });
  app.get('/api/system/health', async (req, res) => { res.json({ ok: true, timestamp: new Date().toISOString() }); });

  app.post('/api/login', async (req, res) => {
    const { usuario, senha } = req.body; const ip = req.ip || 'Desconhecido';
    const [users] = await pool.execute('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
    if (users.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });
    const senhaValida = await bcrypt.compare(senha, users[0].senha);
    if (!senhaValida) return res.status(401).json({ error: 'Senha incorreta' });
    const token = jwt.sign({ id: users[0].id, role: users[0].role, filial: users[0].filial, empresa: users[0].empresa }, SECRET_KEY, { expiresIn: '12h' });
    res.json({ token, id: users[0].id, role: users[0].role, filial: users[0].filial, empresa: users[0].empresa, nome_gerente: users[0].nome_gerente, nome_coordenador: users[0].nome_coordenador, nome_tecnico: users[0].nome_tecnico });
  });

  app.get('/api/auth/verify', verificarToken, async (req, res) => {
    try {
      // =========================================================
      // MÁGICA DO IMPERSONATE: Se for a conta de Suporte (ID 9999)
      // devolvemos as permissões diretamente, sem buscar no banco!
      // =========================================================
      if (req.userId === 9999) {
        return res.json({
          id: 9999,
          usuario: 'Acesso Remoto (NOC)',
          role: req.userRole,       // Retorna 'ADMIN'
          filial: req.userFilial,   // Retorna 'Todas'
          empresa: req.userEmpresa, // Retorna o nome da empresa do cliente
          nome_gerente: 'Suporte',
          nome_coordenador: null,
          nome_tecnico: null
        });
      }

      // Fluxo normal para usuários reais do banco de dados
      const [users] = await pool.execute(
        'SELECT id, usuario, role, filial, empresa, nome_gerente, nome_coordenador, nome_tecnico FROM usuarios WHERE id = ?',
        [req.userId]
      );

      if (users.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });

      res.json(users[0]);
    } catch (error) {
      res.status(500).json({ error: 'Erro interno.' });
    }
  });

  // ============================================================================
  // ROTAS DE EMPRESAS, LOJAS E USUÁRIOS
  // ============================================================================
  app.get('/api/empresas', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json([]);
    try { const [r] = await pool.execute('SELECT * FROM empresas ORDER BY nome ASC'); res.json(r); } catch (e) { res.status(500).json([]); }
  });
  app.post('/api/empresas', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('INSERT INTO empresas (nome, cnpj, contato, email, status) VALUES (?, ?, ?, ?, ?)', [req.body.nome, req.body.cnpj || null, req.body.contato || null, req.body.email || null, req.body.status || 'Ativa']); res.status(201).send(); } catch (e) { res.status(500).send(); } });
  app.delete('/api/empresas/:id', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('DELETE FROM empresas WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (error) { res.status(500).send(); } });

  app.get('/api/usuarios', verificarToken, async (req, res) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json([]);
    try {
      let q = 'SELECT id, usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa FROM usuarios WHERE 1=1'; let p = [];
      if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); }
      const [r] = await pool.execute(q + ' ORDER BY role ASC', p); res.json(r);
    } catch (error) { res.status(500).json([]); }
  });

  app.get('/api/lojas', verificarToken, async (req, res) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json([]);
    try {
      let q = 'SELECT * FROM loja WHERE 1=1'; let p = [];
      if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); }
      const [lojas] = await pool.execute(q + ' ORDER BY nome ASC', p);
      const [usuarios] = await pool.execute('SELECT filial, nome_gerente, nome_coordenador FROM usuarios');
      res.json(lojas.map(l => {
        const uGerente = usuarios.find(user => user.filial === l.nome && user.nome_gerente);
        const uCoord = usuarios.find(user => user.filial === l.nome && user.nome_coordenador);
        return { ...l, nome_gerente: uGerente ? uGerente.nome_gerente : null, nome_coordenador: uCoord ? uCoord.nome_coordenador : null };
      }));
    } catch (e) { res.status(500).json([]); }
  });

  // ============================================================================
  // ROTAS DE EQUIPAMENTOS
  // ============================================================================
  app.get('/api/equipamentos', verificarToken, async (req, res) => { let q = `SELECT e.*, (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp, (SELECT umidade FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_umidade FROM equipamentos e WHERE 1=1`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } } const [r] = await pool.execute(q, p); res.json(r); });

  app.post('/api/equipamentos', verificarToken, async (req, res) => { 
    try { 
      const { nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao } = req.body; 
      
      // Correção: Trata valores zerados corretamente para não virarem "null"
      const uMinVal = (umidade_min === '' || umidade_min === undefined) ? null : parseFloat(umidade_min);
      const uMaxVal = (umidade_max === '' || umidade_max === undefined) ? null : parseFloat(umidade_max);

      await pool.execute('INSERT INTO equipamentos (nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao, empresa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [nome, tipo, temp_min, temp_max, uMinVal, uMaxVal, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao || null, req.userEmpresa]
      ); 
      res.status(201).send(); 
    } catch (error) { 
      res.status(500).send(); 
    } 
  });

  app.get('/api/hardware', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).send();
    try {
      const [r] = await pool.execute(`
      SELECT e.id, e.nome, e.filial, e.motor_ligado, e.em_degelo,
            h.mac_address AS mac, h.ip_local AS ip, h.sinal_wifi AS signal_dbm, 
            h.uptime, h.firmware_version AS fwVersion, h.ultima_comunicacao
      FROM equipamentos e
      LEFT JOIN hardware_iot h ON e.id = h.equipamento_id
    `);
      res.json(r);
    } catch (e) { res.status(500).send(); }
  });

  // ============================================================================
  // ROTA PARA EDITAR EQUIPAMENTOS (BLINDADA CONTRA ERROS DO MYSQL E TRATANDO O ZERO)
  // ============================================================================
  app.put('/api/equipamentos/:id/edit', verificarToken, async (req, res) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') {
      return res.status(403).json({ error: 'Acesso restrito.' });
    }

    const { id } = req.params;
    const { nome, temp_max, temp_min, umidade_max, umidade_min, setor, filial } = req.body;

    try {
      // 🛡️ PROTEÇÃO 1: Garante que o zero (0) não seja considerado "vazio/falso"
      const parseNumero = (valor, fallback) => {
        return (valor !== undefined && valor !== '' && valor !== null && !isNaN(valor)) ? parseFloat(valor) : fallback;
      };

      const valNome = nome || 'Equipamento Edge';
      const valTempMax = parseNumero(temp_max, 30.0);
      const valTempMin = parseNumero(temp_min, 15.0);
      const valUmidMax = parseNumero(umidade_max, 80.0);
      const valUmidMin = parseNumero(umidade_min, 20.0);
      const valSetor = setor || 'Geral';
      const valFilial = filial || 'Matriz';

      const queryParams = [valNome, valTempMax, valTempMin, valUmidMax, valUmidMin, valSetor, valFilial, id];

      // 🛡️ PROTEÇÃO 2: Executa o Update no Banco
      let sql = `UPDATE equipamentos SET 
                 nome=?, temp_max=?, temp_min=?, umidade_max=?, umidade_min=?, setor=?, filial=? 
                 WHERE id=?`;

      if (req.userRole !== 'DEV') {
        sql += ` AND empresa=?`;
        queryParams.push(req.userEmpresa);
      }

      const [result] = await pool.execute(sql, queryParams);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Equipamento não encontrado ou acesso negado.' });
      }

      // 3. MÁGICA PLUG & PLAY: Notifica o ESP32 instantaneamente
      try {
        const mqtt = require('mqtt');
        const clientTemp = mqtt.connect('mqtt://localhost:1883');
        clientTemp.on('connect', () => {
          const payloadConfig = JSON.stringify({
            acao: "CONFIG",
            temp_critica: valTempMax,
            temp_atencao: valTempMax - 2.0
          });
          clientTemp.publish(`termosync/comandos/${id}`, payloadConfig);
          clientTemp.end();
        });
      } catch (mqttErr) { }

      res.json({ success: true, message: 'Equipamento atualizado com sucesso!' });

    } catch (error) {
      console.error('❌ [ERRO UPDATE EQUIPAMENTO]:', error);
      res.status(500).json({ error: `Falha no Banco de Dados: ${error.message}` });
    }
  });

  app.post('/api/system/verify-root-passcode', async (req, res) => {
    const { passcode } = req.body;
    if (!passcode) {
      return res.status(400).json({ success: false, error: 'Credencial ausente.' });
    }

    const ip = req.ip || req.socket?.remoteAddress || 'Desconhecido';

    try {
      const [configRows] = await pool.execute(
        'SELECT valor FROM configuracoes WHERE chave = "master_root_hash" LIMIT 1'
      );

      if (configRows.length > 0 && configRows[0].valor) {
        const isMatch = await bcrypt.compare(passcode, configRows[0].valor);
        if (isMatch) {
          await registrarAuditoria('ROOT_BOOT_SUCCESS', 'Root/Dev', `Desbloqueio de terminal bem-sucedido (${ip})`, 'success');
          return res.json({ success: true });
        }
      }

      const [devUsers] = await pool.execute(
        'SELECT usuario, senha FROM usuarios WHERE role = "DEV" LIMIT 5'
      );

      for (const user of devUsers) {
        const isMatch = await bcrypt.compare(passcode, user.senha);
        if (isMatch) {
          await registrarAuditoria('ROOT_BOOT_SUCCESS', user.usuario, `Acesso ao terminal root via credencial DEV (${ip})`, 'success');
          return res.json({ success: true, usuario: user.usuario });
        }
      }

      await registrarAuditoria('ROOT_BOOT_FAILED', 'Desconhecido', `Falha ao tentar desbloquear terminal Root (${ip})`, 'danger');
      return res.status(401).json({ success: false, error: 'Credencial Root inválida.' });
    } catch (error) {
      console.error('❌ [ERRO ROOT BOOT]:', error);
      return res.status(500).json({ success: false, error: 'Erro de validação no servidor.' });
    }
  });

  // ============================================================================
  // ROTAS RESTAURADAS: IMPERSONATE (ACESSO REMOTO) E CRUD DE ADMINISTRAÇÃO
  // ============================================================================

  // 1. Rota de Impersonate (Acesso Remoto) Blindada
  app.post('/api/impersonate', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Apenas Root.' });

    // 🛡️ PROTEÇÃO 1: Evita "undefined" no banco capturando qualquer variação de nome
    const alvo = req.body.filialDestino || req.body.filial || req.body.empresa || 'Todas';
    let empresaDestino = 'Cliente Alpha (Padrão)';
    const ip = req.ip || req.socket?.remoteAddress || 'Desconhecido';

    try {
      const [lojas] = await pool.execute('SELECT empresa FROM loja WHERE nome = ? LIMIT 1', [alvo]);
      if (lojas.length > 0 && lojas[0].empresa) {
        empresaDestino = lojas[0].empresa;
      } else {
        const [eqs] = await pool.execute('SELECT empresa FROM equipamentos WHERE filial = ? LIMIT 1', [alvo]);
        if (eqs.length > 0 && eqs[0].empresa) empresaDestino = eqs[0].empresa;
      }

      const SECRET_KEY = process.env.JWT_SECRET || 'chave_super_secreta_termosync_node';
      const token = jwt.sign({ id: 9999, role: 'ADMIN', filial: 'Todas', empresa: empresaDestino }, SECRET_KEY, { expiresIn: '1h' });

      // 🛡️ PROTEÇÃO 2: Try-Catch isolado no SOC. 
      // Se a tabela não existir ou faltar coluna, ele ignora e não quebra o seu login!
      try {
        await pool.execute(
          'INSERT INTO sessoes_ativas (usuario_id, usuario_nome, role, ip_address) VALUES (?, ?, ?, ?)',
          [9999, `Impersonate: ${empresaDestino}`, 'ADMIN', ip]
        );
      } catch (socErr) {
        console.log('⚠️ [AVISO SOC]: Sessão ativa não registrada. Motivo:', socErr.message);
      }

      try {
        await registrarAuditoria('IMPERSONATE', 'Root/Dev', `Acesso remoto a: ${alvo}`, 'warning');
      } catch (e) { }

      res.json({ token, empresa: empresaDestino });
    } catch (error) {
      console.error('❌ [ERRO IMPERSONATE]:', error);
      res.status(500).json({ error: 'Falha ao gerar sessão de acesso remoto.' });
    }
  });

  // 2. Rotas Restauradas: Atualizar Empresa
  app.put('/api/empresas/:id', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' });
    const { id } = req.params; const { nome, cnpj, contato, telefone, email, status } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ success: false, error: 'A designação da empresa é obrigatória.' });
    try {
      const contatoValor = contato || telefone || null;
      const queryParams = [nome.trim(), cnpj ? cnpj.trim() : null, contatoValor ? contatoValor.trim() : null, email ? email.trim() : null, status || 'Ativa', id];
      const sql = `UPDATE empresas SET nome = ?, cnpj = ?, contato = ?, email = ?, status = ? WHERE id = ?`;
      const [result] = await pool.execute(sql, queryParams);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });
      return res.json({ success: true, message: 'Empresa atualizada com sucesso!' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Erro interno.' }); }
  });

  // 3. Rotas Restauradas: Usuários (POST, PUT, DELETE)
  app.post('/api/usuarios', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' }); try { const { usuario, senha, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa } = req.body; await pool.execute('INSERT INTO usuarios (usuario, senha, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [usuario, await bcrypt.hash(senha, 10), role, filial || null, nome_gerente || null, nome_coordenador || null, nome_tecnico || null, (req.userRole === 'DEV' && empresa) ? empresa : req.userEmpresa]); res.status(201).send(); } catch (error) { res.status(500).json({ error: 'Erro ao criar usuário.' }); } });
  app.put('/api/usuarios/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' }); try { const { usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa, senha } = req.body; const empresaTarget = (req.userRole === 'DEV' && empresa) ? empresa : req.userEmpresa; if (senha) { await pool.execute('UPDATE usuarios SET usuario=?, senha=?, role=?, filial=?, nome_gerente=?, nome_coordenador=?, nome_tecnico=?, empresa=? WHERE id=?', [usuario, await bcrypt.hash(senha, 10), role, filial || null, nome_gerente || null, nome_coordenador || null, nome_tecnico || null, empresaTarget, req.params.id]); } else { await pool.execute('UPDATE usuarios SET usuario=?, role=?, filial=?, nome_gerente=?, nome_coordenador=?, nome_tecnico=?, empresa=? WHERE id=?', [usuario, role, filial || null, nome_gerente || null, nome_coordenador || null, nome_tecnico || null, empresaTarget, req.params.id]); } res.status(200).send(); } catch (error) { res.status(500).json({ error: 'Erro ao editar.' }); } });
  app.delete('/api/usuarios/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' }); try { await pool.execute('DELETE FROM usuarios WHERE id=?', [req.params.id]); res.status(200).send(); } catch (error) { res.status(500).json({ error: 'Erro ao excluir.' }); } });

  // 4. Rotas Restauradas: Lojas (POST, PUT, DELETE)
  app.post('/api/lojas', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('INSERT INTO loja (nome, endereco, telefone, empresa, status) VALUES (?, ?, ?, ?, ?)', [req.body.nome, req.body.endereco, req.body.telefone, req.userRole === 'DEV' && req.body.empresa ? req.body.empresa : req.userEmpresa, req.userRole === 'DEV' && req.body.status ? req.body.status : 'Ativa']); res.status(201).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/lojas/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { if (req.userRole === 'DEV') { await pool.execute('UPDATE loja SET nome=?, endereco=?, telefone=?, empresa=?, status=? WHERE id=?', [req.body.nome, req.body.endereco, req.body.telefone, req.body.empresa || req.userEmpresa, req.body.status || 'Ativa', req.params.id]); } else { await pool.execute('UPDATE loja SET nome=?, endereco=?, telefone=? WHERE id=? AND empresa=?', [req.body.nome, req.body.endereco, req.body.telefone, req.params.id, req.userEmpresa]); } res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.delete('/api/lojas/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' }); try { if (req.userRole === 'DEV') { await pool.execute('DELETE FROM loja WHERE id = ?', [req.params.id]); } else { await pool.execute('DELETE FROM loja WHERE id = ? AND empresa = ?', [req.params.id, req.userEmpresa]); } res.status(200).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Erro interno.' }); } });

  // ============================================================================
  
  // ============================================================================
  // COMANDOS REMOTOS (FRONTEND -> HARDWARE FÍSICO)
  // ============================================================================
  app.post('/api/hardware/:id/comando', verificarToken, async (req, res) => {
    try {
      const { id } = req.params; const { acao, estado } = req.body;
      const topico = `termosync/comandos/${id}`; const payload = JSON.stringify({ acao, estado });
      const mqttClientCmd = mqtt.connect('mqtt://localhost:1883');
      mqttClientCmd.on('connect', () => {
        mqttClientCmd.publish(topico, payload, { qos: 0, retain: false }, (err) => {
          if (err) { mqttClientCmd.end(); return res.status(500).json({ error: 'Falha ao comunicar com o equipamento.' }); }
          console.log(`⚡ [MQTT COMANDO] Enviado para Equipamento ${id}: ${payload}`); mqttClientCmd.end(); res.json({ success: true, message: `Comando enviado com sucesso.` });
        });
      });
    } catch (error) { res.status(500).json({ error: 'Erro interno ao processar comando.' }); }
  });

  // ============================================================================
  // LEITURAS HTTP (SIMULADOR DE CAOS) E INTEGRAÇÃO SEGURA DO BD
  // ============================================================================
  app.post('/api/leituras', async (req, res) => {
    try {
      let isMaintenance = false;
      try {
        const [sys] = await pool.execute('SELECT valor FROM configuracoes WHERE chave = "maintenanceMode"');
        if (sys.length > 0 && sys[0].valor === '1') isMaintenance = true;
      } catch (err) {}

      if (isMaintenance) return res.status(503).json({ error: 'Sistema em Manutenção.' });

      const {
        equipamento_id, temperatura, umidade, alerta_forcado, consumo_kwh,
        motor_ligado, em_degelo, mac_address, ip_local, sinal_wifi, uptime, firmware_version
      } = req.body;

      const t = parseFloat(temperatura);
      const u = parseFloat(umidade || 50.0);
      const c_kwh = parseFloat(consumo_kwh || 0.0);

      // TRATAMENTO ANTI-ERRO: Corta as strings maiores que o limite do banco!
      const hw_mac = (mac_address || 'A4:CF:12:XX:XX:XX').substring(0, 20);
      const hw_ip = (ip_local || '192.168.1.100').substring(0, 15);
      const hw_wifi = sinal_wifi ? parseInt(sinal_wifi) : -65;
      const hw_up = (uptime || '0h').substring(0, 50);
      const hw_fw = (firmware_version || 'v1.0.0').substring(0, 20);

      // 🛡️ ESCUDO: O simulador HTTP está PROIBIDO de alterar o Hardware IoT do Equipamento 1
      if (String(equipamento_id) !== "1") {
        try {
          await pool.execute(`
            INSERT INTO hardware_iot (equipamento_id, mac_address, ip_local, sinal_wifi, uptime, firmware_version, ultima_comunicacao)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
              mac_address = ?, ip_local = ?, sinal_wifi = ?, uptime = ?, firmware_version = ?, ultima_comunicacao = NOW()
          `, [
            equipamento_id, hw_mac, hw_ip, hw_wifi, hw_up, hw_fw, 
            hw_mac, hw_ip, hw_wifi, hw_up, hw_fw  
          ]);
        } catch (e) { 
          console.error("❌ ERRO BD HARDWARE (HTTP):", e.message); 
        }
      }

      const [r] = await pool.execute('INSERT INTO leituras (equipamento_id, temperatura, umidade, consumo_kwh) VALUES (?, ?, ?, ?)', [equipamento_id, t, u, c_kwh]);
      
      const [eq] = await pool.execute('SELECT temp_max, temp_min, umidade_min, umidade_max, nome, em_degelo, motor_ligado, setor, filial, empresa FROM equipamentos WHERE id = ?', [equipamento_id]);

      if (eq.length > 0) {
        const isMotorLigado = (motor_ligado == 1 || motor_ligado === true);
        const isEmDegelo = (em_degelo == 1 || em_degelo === true);
        await pool.execute('UPDATE equipamentos SET motor_ligado=?, em_degelo=? WHERE id=?', [isMotorLigado, isEmDegelo, equipamento_id]);

        // =======================================================
        // VARIÁVEIS RESTAURADAS AQUI! Evita "uMax is not defined"
        // =======================================================
        const tMax = parseFloat(eq[0].temp_max); 
        const tMin = parseFloat(eq[0].temp_min);
        const uMax = parseFloat(eq[0].umidade_max || 0); 
        const uMin = parseFloat(eq[0].umidade_min || 0);

        let novosAlertas = [];

        const checkAndAlert = async (condicaoAnomala, tipoAlerta, mensagem) => {
          if (condicaoAnomala) {
            const [existe] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
            if (existe.length === 0) {
              const [inserido] = await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta, resolvido) VALUES (?, ?, ?, 0)', [equipamento_id, mensagem, tipoAlerta]);
              novosAlertas.push({ id: inserido.insertId, equipamento_id, mensagem, tipo_alerta: tipoAlerta });
              
              // ==============================================================
              // [NOVIDADE] DISPARO DE WHATSAPP / SMS AQUI
              // ==============================================================
              if (tipoAlerta === 'MECANICA' || tipoAlerta === 'TEMPERATURA') {
                 console.log(`📱 [WHATSAPP] Enviando alerta para gerência da loja ${eq[0].filial}: ${mensagem}`);
                 // enviarAlertaWhatsApp(mensagem, telefoneGerente); // <-- Descomente quando plugar a API do Whats
              }
            }
          } else {
            await pool.execute('UPDATE notificacoes SET resolvido=1 WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
          }
        };

        const condRede = (alerta_forcado === 'REDE');
        await checkAndAlert(condRede, 'REDE', `FALHA IoT/REDE: Sensor offline em "${eq[0].nome}".`);
        const condPorta = (alerta_forcado === 'PORTA_ABERTA');
        await checkAndAlert(condPorta, 'PORTA', `PORTA ABERTA: O equipamento "${eq[0].nome}" está com a porta violada!`);
        
        // CORREÇÃO DA REGRA DE OURO: O alerta de falha mecânica só dispara se o motor parar E a temperatura ficar alta!
        const condMecanica = (!isMotorLigado && !isEmDegelo && alerta_forcado !== 'REDE' && t >= (tMax + 10.0));
        await checkAndAlert(condMecanica, 'MECANICA', `MOTOR PARADO: O compressor de "${eq[0].nome}" falhou e a temperatura subiu!`);
        
        const condTemp = ((t > tMax || t < tMin) && !isEmDegelo);
        await checkAndAlert(condTemp, 'TEMPERATURA', `ALERTA TÉRMICO: "${eq[0].nome}" fora da faixa configurada (${t}°C).`);

        if (uMax > 0 || uMin > 0) {
          const condUmi = ((u > uMax || u < uMin) && !isEmDegelo);
          await checkAndAlert(condUmi, 'UMIDADE', `ALERTA HIGROMÉTRICO: Umidade de "${eq[0].nome}" fora dos limites permitidos (${u}%).`);
        }

        if (novosAlertas.length > 0) { io.emit('atualizacao_dados'); novosAlertas.forEach(a => io.emit('novo_alerta', a)); }
        io.emit('nova_leitura', { id: r.insertId, equipamento_id, temperatura: t, umidade: u, consumo_kwh: c_kwh, motor_ligado: isMotorLigado, em_degelo: isEmDegelo, data_hora: new Date(), nome: eq[0].nome, setor: eq[0].setor, filial: eq[0].filial, empresa: eq[0].empresa });
      }
      res.status(201).send();
    } catch (error) { res.status(500).send(); }
  });

  // ==========================================
  // ROTAS DE NOTIFICAÇÕES E CHAMADOS (ORIGINAIS)
  // ==========================================
  app.get('/api/notificacoes', verificarToken, async (req, res) => { try { let q = `SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE (n.resolvido = 0 OR n.resolvido IS NULL OR n.resolvido = FALSE)`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } if (req.userRole === 'LOJA') { q += ` AND e.filial = ?`; p.push(req.userFilial); } const [r] = await pool.execute(q + ' ORDER BY n.data_hora DESC', p); res.json(r); } catch (e) { res.status(500).send(); } });
  app.get('/api/notificacoes/historico', verificarToken, async (req, res) => { try { let q = `SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE n.resolvido = 1`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } if (req.userRole === 'LOJA') { q += ` AND e.filial = ?`; p.push(req.userFilial); } const [r] = await pool.execute(q + ' ORDER BY n.data_hora DESC LIMIT 150', p); res.json(r); } catch (e) { res.status(500).send(); } });
  app.put('/api/notificacoes/:id/resolver', verificarToken, async (req, res) => { try { await pool.execute('UPDATE notificacoes SET resolvido=1, nota_resolucao=? WHERE id=?', [req.body.nota_resolucao || 'Resolvido pelo operador.', req.params.id]); io.emit('alerta_removido_id', { id: req.params.id }); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/notificacoes/resolver-todas', verificarToken, async (req, res) => { try { let q = 'UPDATE notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id SET n.resolvido=1, n.nota_resolucao="Limpeza em Lote" WHERE (n.resolvido=0 OR n.resolvido IS NULL)'; let p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } } await pool.execute(q, p); io.emit('alertas_limpos'); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });

  app.get('/api/chamados', verificarToken, async (req, res) => { let q = `SELECT c.*, e.nome as equipamento_nome, e.filial as equipamento_filial, u.usuario as aberto_por FROM chamados c LEFT JOIN equipamentos e ON c.equipamento_id = e.id LEFT JOIN usuarios u ON c.usuario_id = u.id WHERE 1=1`; const p = []; if (req.userRole !== 'DEV') { q += ' AND (c.empresa = ? OR c.empresa IS NULL OR c.empresa = "")'; p.push(req.userEmpresa); if (req.userRole === 'LOJA') { q += ` AND (c.filial = ? OR c.filial IS NULL OR c.filial = "" OR e.filial = ?)`; p.push(req.userFilial, req.userFilial); } } const [r] = await pool.execute(q + ' ORDER BY c.data_abertura DESC', p); res.json(r); });
  app.post('/api/chamados', verificarToken, async (req, res) => { try { const { equipamento_id, descricao, solicitante_nome, tecnico_responsavel, urgencia } = req.body; let filialStr = req.userFilial; try { const [eq] = await pool.execute('SELECT filial FROM equipamentos WHERE id=?', [equipamento_id]); if (eq.length > 0 && eq[0].filial) filialStr = eq[0].filial; } catch (e) { } await pool.execute(`INSERT INTO chamados (equipamento_id, usuario_id, filial, descricao, solicitante_nome, tecnico_responsavel, empresa, urgencia, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aberto')`, [equipamento_id || null, req.userId, filialStr, descricao, solicitante_nome || null, tecnico_responsavel || null, req.userEmpresa, urgencia || 'Pendente']); io.emit('atualizacao_dados'); res.status(201).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/chamados/:id/status', verificarToken, async (req, res) => { try { const { status } = req.body; if (!status) return res.status(400).json({ error: 'Status ausente.' }); let query = 'UPDATE chamados SET status = ?'; let params = [status]; if (status === 'Concluído') query += ', data_conclusao = CURRENT_TIMESTAMP'; else query += ', data_conclusao = NULL'; query += ' WHERE id = ?'; params.push(req.params.id); await pool.execute(query, params); io.emit('atualizacao_dados'); res.status(200).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Falha no banco.' }); } });
  app.delete('/api/chamados/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('DELETE FROM chamados WHERE id=?', [req.params.id]); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/chamados/:id', verificarToken, async (req, res) => { try { const [atual] = await pool.execute('SELECT * FROM chamados WHERE id=?', [req.params.id]); if (atual.length === 0) return res.status(404).send(); const chamado = atual[0]; const novoStatus = req.body.status !== undefined ? req.body.status : chamado.status; let query = 'UPDATE chamados SET status=?, nota_resolucao=?, arquivado=?, urgencia=?, tecnico_responsavel=?'; if (novoStatus === 'Concluído' && chamado.status !== 'Concluído') query += ', data_conclusao=CURRENT_TIMESTAMP'; query += ' WHERE id=?'; await pool.execute(query, [novoStatus, req.body.nota_resolucao !== undefined ? req.body.nota_resolucao : chamado.nota_resolucao, req.body.arquivado !== undefined ? (req.body.arquivado ? 1 : 0) : chamado.arquivado, req.body.urgencia !== undefined ? req.body.urgencia : chamado.urgencia, req.body.tecnico_responsavel !== undefined ? req.body.tecnico_responsavel : chamado.tecnico_responsavel, req.params.id]); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/chamados/:id/arquivar', verificarToken, async (req, res) => { try { await pool.execute('UPDATE chamados SET arquivado=1, data_conclusao=CURRENT_TIMESTAMP WHERE id=?', [req.params.id]); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/chamados/:id/urgencia', verificarToken, async (req, res) => { try { await pool.execute('UPDATE chamados SET urgencia=? WHERE id=?', [req.body.urgencia, req.params.id]); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });

  app.get('/api/suporte/artigos', verificarToken, async (req, res) => { try { const isDev = req.userRole === 'DEV'; const publico = isDev ? [] : ['USUARIO', 'AMBOS']; let query = 'SELECT * FROM suporte_artigos WHERE ativo = TRUE'; const params = []; if (!isDev) { query += ' AND publico IN (?, ?)'; params.push(publico[0], publico[1]); } const [rows] = await pool.execute(query + ' ORDER BY destaque DESC, updated_at DESC, titulo ASC', params); res.json(rows); } catch (error) { res.status(500).json({ error: 'Falha.' }); } });
  app.get('/api/suporte/chamados', verificarToken, async (req, res) => { try { let query = 'SELECT * FROM suporte_chamados WHERE 1=1'; const params = []; if (req.userRole !== 'DEV') { query += ' AND (empresa = ? OR empresa IS NULL OR empresa = "")'; params.push(req.userEmpresa); if (req.userRole === 'LOJA') { query += ' AND (filial = ? OR filial IS NULL OR filial = "")'; params.push(req.userFilial); } } const [rows] = await pool.execute(query + ' ORDER BY criado_em DESC', params); res.json(rows); } catch (error) { res.status(500).json({ error: 'Falha.' }); } });
  app.post('/api/suporte/chamados', verificarToken, async (req, res) => { try { const { titulo, descricao, categoria, prioridade, solicitante, email } = req.body; if (!titulo || !descricao || !solicitante) return res.status(400).json({ error: 'Campos obrigatórios.' }); const [result] = await pool.execute('INSERT INTO suporte_chamados (titulo, descricao, categoria, prioridade, origem, solicitante, email, empresa, filial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [titulo, descricao, categoria || 'Geral', prioridade || 'Média', req.userRole === 'DEV' ? 'DEV' : 'USUARIO', solicitante, email || null, req.userEmpresa || null, req.userFilial || null]); try { await pool.execute('INSERT INTO suporte_chamado_historico (chamado_id, evento, autor, papel, status_anterior, status_novo, mensagem) VALUES (?, ?, ?, ?, ?, ?, ?)', [result.insertId, 'ABERTURA', solicitante, req.userRole || 'USUARIO', null, 'Aberto', descricao]); } catch (errHist) { console.error('⚠️ [AVISO] Falha na auditoria inicial de suporte:', errHist.message); } const novoTicketPayload = { id: result.insertId, titulo, descricao, categoria: categoria || 'Geral', prioridade: prioridade || 'Média', solicitante, empresa: req.userEmpresa || null, filial: req.userFilial || null, criado_em: new Date().toISOString(), status: 'Aberto' }; if (io) { io.emit('novo_chamado_suporte', novoTicketPayload); io.emit('atualizacao_dados'); } res.status(201).json({ success: true, id: result.insertId }); } catch (error) { res.status(500).json({ error: 'Falha ao abrir chamado de suporte.' }); } });
  app.put('/api/suporte/chamados/:id', verificarToken, async (req, res) => { try { const { status, resposta, responsavel } = req.body; const [atual] = await pool.execute('SELECT * FROM suporte_chamados WHERE id = ?', [req.params.id]); if (atual.length === 0) return res.status(404).json({ error: 'Não encontrado.' }); const chamadoAtual = atual[0]; let novoStatus = status || chamadoAtual.status || 'Concluído'; if (resposta && (novoStatus === 'Aberto' || novoStatus === 'Em análise')) { novoStatus = 'Respondido'; } if (novoStatus === 'Resolvido' || novoStatus === 'Fechado') novoStatus = 'Concluído'; if (novoStatus === 'Em Atendimento') novoStatus = 'Em análise'; const novaResposta = (resposta !== undefined && resposta !== '') ? resposta : (chamadoAtual.resposta || null); const novoResponsavel = responsavel || chamadoAtual.responsavel || 'Suporte NOC (DEV)'; await pool.execute('UPDATE suporte_chamados SET status = ?, resposta = ?, responsavel = ? WHERE id = ?', [novoStatus, novaResposta, novoResponsavel, req.params.id]); try { if ((resposta !== undefined && resposta !== chamadoAtual.resposta) || novoStatus !== chamadoAtual.status) { await pool.execute('INSERT INTO suporte_chamado_historico (chamado_id, evento, autor, papel, status_anterior, status_novo, mensagem) VALUES (?, ?, ?, ?, ?, ?, ?)', [req.params.id, resposta !== undefined ? 'RESPOSTA' : 'ATUALIZACAO_STATUS', novoResponsavel, req.userRole || 'DEV', chamadoAtual.status || 'Aberto', novoStatus, resposta !== undefined ? resposta : `Status alterado para ${novoStatus}`]); } } catch (errHist) { console.error('⚠️ [AVISO] Falha ao registrar auditoria de suporte:', errHist.message); } if (io) { io.emit('resposta_suporte', { id: req.params.id, titulo: chamadoAtual.titulo, resposta: novaResposta, status: novoStatus, responsavel: novoResponsavel, empresa: chamadoAtual.empresa, filial: chamadoAtual.filial }); io.emit('atualizacao_dados'); } res.status(200).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Falha ao atualizar chamado de suporte.' }); } });
  app.get('/api/suporte/chamados/:id/historico', verificarToken, async (req, res) => { try { const [ticket] = await pool.execute('SELECT id, empresa, filial, solicitante FROM suporte_chamados WHERE id = ?', [req.params.id]); if (ticket.length === 0) return res.status(404).json({ error: 'Não encontrado.' }); if (req.userRole !== 'DEV') { const permitidoEmpresa = ticket[0].empresa === req.userEmpresa || !ticket[0].empresa; const permitidoFilial = req.userRole !== 'LOJA' || ticket[0].filial === req.userFilial || !ticket[0].filial; if (!permitidoEmpresa || !permitidoFilial) return res.status(403).json({ error: 'Acesso negado.' }); } const [historico] = await pool.execute('SELECT * FROM suporte_chamado_historico WHERE chamado_id = ? ORDER BY criado_em ASC, id ASC', [req.params.id]); res.json(historico); } catch (error) { res.status(500).json({ error: 'Falha.' }); } });
  app.get('/api/relatorios', verificarToken, async (req, res) => { let q = `SELECT l.id, l.temperatura, l.umidade, l.consumo_kwh, l.data_hora, e.nome, e.setor, e.filial FROM leituras l JOIN equipamentos e ON l.equipamento_id = e.id WHERE 1=1`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } if (req.query.data_inicio && req.query.data_fim) { q += ' AND l.data_hora BETWEEN ? AND ?'; p.push(new Date(req.query.data_inicio), new Date(req.query.data_fim)); } else { q += ' AND l.data_hora >= DATE_SUB(NOW(), INTERVAL 6 HOUR)'; } const [r] = await pool.execute(q + ' ORDER BY l.data_hora ASC LIMIT 3000', p); res.json(r); });

  app.get('/api/operacao/resumo', verificarToken, async (req, res) => { try { const filialFiltro = req.query.filial || req.userFilial || 'Todas'; const empresaFiltro = req.userEmpresa || 'Cliente Alpha (Padrão)'; const filtros = ['e.empresa = ?']; const params = [empresaFiltro]; if (req.userRole === 'LOJA') { filtros.push('e.filial = ?'); params.push(req.userFilial); } else if (filialFiltro && filialFiltro !== 'Todas') { filtros.push('e.filial = ?'); params.push(filialFiltro); } const whereClause = filtros.join(' AND '); let equipamentosRows = []; let alertasRows = []; let chamadosRows = []; try { [equipamentosRows] = await pool.execute(`SELECT e.id, e.nome, e.filial, e.motor_ligado, e.em_degelo, (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp, (SELECT umidade FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_umidade FROM equipamentos e WHERE ${whereClause}`, params); } catch (e) { } try { [alertasRows] = await pool.execute(`SELECT n.id, n.mensagem, n.data_hora, e.nome AS equipamento_nome, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE ${whereClause} AND (n.resolvido = 0 OR n.resolvido IS NULL) ORDER BY n.data_hora DESC LIMIT 8`, params); } catch (e) { } try { [chamadosRows] = await pool.execute(`SELECT c.id, c.status, c.urgencia, e.nome AS equipamento_nome FROM chamados c LEFT JOIN equipamentos e ON c.equipamento_id = e.id WHERE ${whereClause} AND c.status <> 'Concluído' AND c.status <> 'Fechado' ORDER BY c.data_abertura DESC LIMIT 8`, params); } catch (e) { } const totalEquipamentos = equipamentosRows.length; const alertasAtivos = alertasRows.length; const chamadosAbertos = chamadosRows.length; const equipamentosFalha = equipamentosRows.filter((eq) => !eq.motor_ligado && !eq.em_degelo).length; const equipamentosDegelo = equipamentosRows.filter((eq) => eq.em_degelo).length; const temperaturaMedia = totalEquipamentos ? (equipamentosRows.reduce((acc, item) => acc + (Number(item.ultima_temp) || 0), 0) / totalEquipamentos).toFixed(1) : 0; const umidadeMedia = totalEquipamentos ? (equipamentosRows.reduce((acc, item) => acc + (Number(item.ultima_umidade) || 0), 0) / totalEquipamentos).toFixed(1) : 0; res.json({ total_equipamentos: totalEquipamentos, alertas_ativos: alertasAtivos, chamados_abertos: chamadosAbertos, equipamentos_em_falha: equipamentosFalha, equipamentos_em_degelo: equipamentosDegelo, temperatura_media: Number(temperaturaMedia), umidade_media: Number(umidadeMedia), ultimos_alertas: alertasRows, ultimos_chamados: chamadosRows, filial: filialFiltro, atualizada_em: new Date().toISOString() }); } catch (e) { res.json({ total_equipamentos: 0, alertas_ativos: 0, chamados_abertos: 0, equipamentos_em_falha: 0, equipamentos_em_degelo: 0, temperatura_media: 0, umidade_media: 0, ultimos_alertas: [], ultimos_chamados: [], filial: req.query.filial || req.userFilial || 'Todas', atualizada_em: new Date().toISOString() }); } });
  app.get('/api/operacao/tarefas', verificarToken, async (req, res) => { try { const tipo = req.query.tipo || 'checklist_turno'; const filial = req.query.filial || req.userFilial || 'Todas'; const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)'; let sql = 'SELECT * FROM operacao_tarefas WHERE tipo = ?'; const params = [tipo]; if (req.userRole !== 'DEV') { sql += ' AND empresa = ?'; params.push(empresa); } if (filial && filial !== 'Todas') { sql += ' AND (filial = ? OR filial = "Matriz" OR filial = "Todas" OR filial IS NULL)'; params.push(filial); } sql += ' ORDER BY created_at ASC'; const [rows] = await pool.execute(sql, params); res.json(rows); } catch (error) { res.status(500).json({ error: 'Erro ao buscar tarefas.' }); } });
  app.post('/api/operacao/tarefas', verificarToken, async (req, res) => { try { if (req.userRole === 'LOJA') return res.status(403).json({ error: 'Acesso negado.' }); const { tipo, chave, titulo, descricao, concluida, filial } = req.body; const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)'; if (!chave || !titulo) return res.status(400).json({ error: 'Chave e título são obrigatórios.' }); const sql = `INSERT INTO operacao_tarefas (tipo, chave, titulo, descricao, concluida, filial, empresa) VALUES (?, ?, ?, ?, ?, ?, ?)`; const params = [tipo || 'checklist_turno', chave, titulo, descricao || null, concluida ? 1 : 0, filial || 'Matriz', empresa]; const [result] = await pool.execute(sql, params); await emitirOperacaoAtualizada({ tipo: 'tarefas', empresa, usuario: req.userId }); res.status(201).json({ success: true, id: result.insertId }); } catch (error) { res.status(500).json({ error: 'Erro ao criar tarefa.' }); } });
  app.put('/api/operacao/tarefas/:id', verificarToken, async (req, res) => { try { const { id } = req.params; const { concluida } = req.body; const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)'; let horario = null; if (concluida) { const dataAtual = new Date(); horario = dataAtual.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }); } let sql = 'UPDATE operacao_tarefas SET concluida = ?, horario = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'; const params = [concluida ? 1 : 0, horario, id]; if (req.userRole !== 'DEV') { sql += ' AND empresa = ?'; params.push(empresa); } const [result] = await pool.execute(sql, params); if (result.affectedRows === 0) return res.status(404).json({ error: 'Tarefa não encontrada ou sem permissão.' }); await emitirOperacaoAtualizada({ tipo: 'tarefas', empresa, usuario: req.userId }); res.status(200).json({ success: true, concluida, horario }); } catch (error) { res.status(500).json({ error: 'Erro ao atualizar.' }); } });
  app.delete('/api/operacao/tarefas/:id', verificarToken, async (req, res) => { try { if (req.userRole === 'LOJA') return res.status(403).json({ error: 'Acesso negado.' }); const { id } = req.params; const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)'; let sql = 'DELETE FROM operacao_tarefas WHERE id = ?'; const params = [id]; if (req.userRole !== 'DEV') { sql += ' AND empresa = ?'; params.push(empresa); } const [result] = await pool.execute(sql, params); if (result.affectedRows === 0) return res.status(404).json({ error: 'Não encontrada.' }); await emitirOperacaoAtualizada({ tipo: 'tarefas', empresa, usuario: req.userId }); res.status(200).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Erro ao excluir.' }); } });
  app.get('/api/auxiliares/filiais', verificarToken, async (req, res) => { try { let q1 = 'SELECT DISTINCT nome AS filial FROM loja WHERE 1=1'; let q2 = 'SELECT DISTINCT filial FROM equipamentos WHERE filial IS NOT NULL'; let p = []; if (req.userRole !== 'DEV') { q1 += ' AND empresa = ?'; q2 += ' AND empresa = ?'; p.push(req.userEmpresa); } const [r1] = await pool.execute(q1, req.userRole !== 'DEV' ? [req.userEmpresa] : []); const [r2] = await pool.execute(q2, req.userRole !== 'DEV' ? [req.userEmpresa] : []); res.json(Array.from(new Set([...r1.map(x => x.filial), ...r2.map(x => x.filial)])).sort()); } catch (e) { res.status(500).send(); } });
  app.get('/api/contatos', verificarToken, async (req, res) => { try { let q = 'SELECT id, usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa FROM usuarios WHERE id != ?'; let p = [req.userId]; if (req.userRole !== 'DEV') { q += ' AND (empresa = ? OR role = "DEV")'; p.push(req.userEmpresa); } const [rows] = await pool.execute(q, p); res.json(rows.map(u => { let nome = u.usuario; let cargo = 'Usuário'; if (u.role === 'DEV') { nome = 'NOC (Desenvolvedor)'; cargo = 'Suporte Master'; } else if (u.role === 'ADMIN') { nome = 'Administração'; cargo = 'Suporte Corporativo'; } else if (u.role === 'MANUTENCAO') { nome = u.nome_tecnico || u.usuario; cargo = 'Técnico Manutenção'; } else if (u.role === 'LOJA') { if (u.nome_gerente) { nome = u.nome_gerente; cargo = `Gerente - ${u.filial}`; } else if (u.nome_coordenador) { nome = u.nome_coordenador; cargo = `Coordenador - ${u.filial}`; } else { nome = `Equipe ${u.filial}`; cargo = 'Operador Loja'; } } return { id: u.id, nome, cargo, role: u.role, filial: u.filial, empresa: u.empresa }; })); } catch (error) { res.status(500).json({ error: error.message }); } });
  app.get('/api/tecnicos', verificarToken, async (req, res) => { try { let q = 'SELECT id, usuario, nome_tecnico, empresa FROM usuarios WHERE role = "MANUTENCAO" AND nome_tecnico IS NOT NULL'; const p = []; if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); } q += ' ORDER BY nome_tecnico ASC'; const [r] = await pool.execute(q, p); res.json(r); } catch (e) { res.status(500).send(); } });
  app.get('/api/auxiliares/equipamentos-abertura', verificarToken, async (req, res) => { try { let q = 'SELECT id, nome, setor, filial, empresa FROM equipamentos WHERE 1=1'; const p = []; if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); } q += ' ORDER BY filial ASC, setor ASC, nome ASC'; const [r] = await pool.execute(q, p); res.json(r); } catch (e) { res.status(500).send(); } });
  app.get('/api/setores', verificarToken, async (req, res) => { try { const [r] = await pool.execute('SELECT id, nome FROM setores ORDER BY nome ASC'); res.json(r); } catch (e) { res.status(500).send(); } });
  app.post('/api/setores', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('INSERT INTO setores (nome) VALUES (?)', [req.body.nome]); res.status(201).send(); } catch (e) { res.status(500).send(); } });
  app.put('/api/setores/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('UPDATE setores SET nome=? WHERE id=?', [req.body.nome, req.params.id]); res.status(200).send(); } catch (e) { res.status(500).send(); } });
  app.delete('/api/setores/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('DELETE FROM setores WHERE id=?', [req.params.id]); res.status(200).send(); } catch (e) { res.status(500).send(); } });
  app.get('/api/tipos-refrigeracao', verificarToken, async (req, res) => { try { const [r] = await pool.execute('SELECT * FROM tipos_refrigeracao ORDER BY nome ASC'); res.json(r); } catch (e) { res.status(500).send(); } });
  app.post('/api/tipos-refrigeracao', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { const { nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo } = req.body; const parseNum = (v) => (v === '' || v === undefined || v === null) ? null : parseFloat(v); await pool.execute('INSERT INTO tipos_refrigeracao (nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo) VALUES (?, ?, ?, ?, ?, ?, ?)', [nome, parseNum(temp_min), parseNum(temp_max), parseNum(umidade_min), parseNum(umidade_max), parseNum(intervalo_degelo) || 6, parseNum(duracao_degelo) || 30]); res.status(201).send(); } catch (e) { res.status(500).send(); } });
  app.put('/api/tipos-refrigeracao/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { const { nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo } = req.body; const parseNum = (v) => (v === '' || v === undefined || v === null) ? null : parseFloat(v); await pool.execute('UPDATE tipos_refrigeracao SET nome=?, temp_min=?, temp_max=?, umidade_min=?, umidade_max=?, intervalo_degelo=?, duracao_degelo=? WHERE id=?', [nome, parseNum(temp_min), parseNum(temp_max), parseNum(umidade_min), parseNum(umidade_max), parseNum(intervalo_degelo) || 6, parseNum(duracao_degelo) || 30, req.params.id]); res.status(200).send(); } catch (error) { res.status(500).json({ error: 'Erro ao editar usuário.' }); } });
  app.delete('/api/tipos-refrigeracao/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('DELETE FROM tipos_refrigeracao WHERE id=?', [req.params.id]); res.status(200).send(); } catch (e) { res.status(500).send(); } });

  app.get('/api/hardware', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).send();
    try {
      const [r] = await pool.execute(`
      SELECT e.id, e.nome, e.filial, e.motor_ligado, e.em_degelo,
            h.mac_address AS mac, h.ip_local AS ip, h.sinal_wifi AS signal_dbm, 
            h.uptime, h.firmware_version AS fwVersion, h.ultima_comunicacao
      FROM equipamentos e
      LEFT JOIN hardware_iot h ON e.id = h.equipamento_id
    `);
      res.json(r);
    } catch (e) { res.status(500).send(); }
  });

  // ============================================================================
  // COMANDOS REMOTOS (FRONTEND -> HARDWARE FÍSICO)
  // ============================================================================
  app.post('/api/hardware/:id/comando', verificarToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { acao, estado } = req.body;

      const topico = `termosync/comandos/${id}`;
      const payload = JSON.stringify({ acao, estado });

      const mqttClientCmd = mqtt.connect('mqtt://localhost:1883');
      mqttClientCmd.on('connect', () => {
        mqttClientCmd.publish(topico, payload, { qos: 0, retain: false }, (err) => {
          if (err) {
            console.error('❌ Erro ao enviar comando MQTT:', err);
            mqttClientCmd.end();
            return res.status(500).json({ error: 'Falha ao comunicar com o equipamento.' });
          }
          console.log(`⚡ [MQTT COMANDO] Enviado para Equipamento ${id}: ${payload}`);
          mqttClientCmd.end();
          res.json({ success: true, message: `Comando enviado com sucesso.` });
        });
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro interno ao processar comando.' });
    }
  });

  // ==========================================
  // ROTAS DO SOC (SECURITY OPERATIONS CENTER) E RELATÓRIOS
  // ==========================================
  app.get('/api/soc/sessoes', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { const [sessoes] = await pool.execute('SELECT id, usuario_nome as usuario, role, ip_address as ip, localizacao as location, data_login as loginTime FROM sessoes_ativas WHERE revogado = FALSE ORDER BY data_login DESC'); res.json(sessoes); } catch (e) { res.status(500).send(); } });
  app.post('/api/soc/revogar/:id', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { const [sessao] = await pool.execute('SELECT usuario_nome FROM sessoes_ativas WHERE id = ?', [req.params.id]); await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE id = ?', [req.params.id]); const alvo = sessao.length > 0 ? sessao[0].usuario_nome : 'ID ' + req.params.id; registrarAuditoria('TOKEN_REVOKED', 'root_dev', alvo, 'danger'); res.json({ success: true }); } catch (e) { res.status(500).send(); } });
  app.get('/api/soc/auditoria', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { const [logs] = await pool.execute('SELECT data_hora, acao as action, ator as actor, alvo as target, severidade as severity FROM audit_logs ORDER BY data_hora DESC LIMIT 100'); res.json(logs); } catch (e) { res.status(500).send(); } });
  app.post('/api/system/reports/log', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { const { tipo, formato, solicitante } = req.body; await pool.execute('INSERT INTO sys_relatorios_log (tipo_relatorio, formato, solicitante) VALUES (?, ?, ?)', [tipo, formato, solicitante]); res.status(201).send(); } catch (e) { res.status(500).send(); } });
  app.post('/api/system/purge', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); const { dias } = req.body; try { const [resPurge] = await pool.execute(`DELETE FROM leituras WHERE data_hora < DATE_SUB(NOW(), INTERVAL ? DAY)`, [dias]); registrarAuditoria('DB_PURGE', 'Root/Dev', `Limpeza da tabela de leituras (> ${dias} dias)`, 'danger'); res.json({ deleted: resPurge.affectedRows }); } catch (e) { res.status(500).send(); } });
  app.get('/api/system/host-info', async (req, res) => { try { const cpus = os.cpus(); const cpuModel = cpus[0]?.model || 'Generic x86_64 Processor'; const cpuCores = cpus.length || 1; const totalMemMB = Math.round(os.totalmem() / (1024 * 1024)); const freeMemMB = Math.round(os.freemem() / (1024 * 1024)); const platform = os.platform(); const release = os.release(); const arch = os.arch(); const hostname = os.hostname(); const type = os.type(); res.json({ success: true, cpu: { model: cpuModel, cores: cpuCores, speed: cpus[0]?.speed || 0 }, memory: { totalMB: totalMemMB, freeMB: freeMemMB }, os: { platform, release, arch, hostname, type, kernelString: `${type} ${hostname} ${release} ${arch}` } }); } catch (error) { res.status(500).json({ success: false, error: 'Falha ao coletar dados do host.' }); } });
  app.post('/api/system/deploy-update', verificarToken, upload.single('updatePackage'), async (req, res) => { if (req.userRole !== 'DEV') { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); return res.status(403).json({ error: 'Acesso negado. Permissão exclusiva de SysAdmin (DEV).' }); } try { const file = req.file; const { version, title, type, desc, targetType } = req.body; if (!file) { return res.status(400).json({ error: 'Nenhum pacote (.zip) foi enviado.' }); } const zip = new AdmZip(file.path); const zipEntries = zip.getEntries(); let temArquivosFrontend = false; let temArquivosBackend = false; zipEntries.forEach((entry) => { const name = entry.entryName.toLowerCase(); if (name.includes('index.html') || name.includes('assets/') || name.endsWith('.css') || name.endsWith('.jsx')) { temArquivosFrontend = true; } if (name.includes('app.js') || name.includes('server.js') || name.includes('package.json') || name.includes('routes/')) { temArquivosBackend = true; } }); let destinoFinal = targetType || 'AUTO'; if (destinoFinal === 'AUTO') { if (temArquivosFrontend && !temArquivosBackend) destinoFinal = 'FRONTEND'; else if (temArquivosBackend && !temArquivosFrontend) destinoFinal = 'BACKEND'; else destinoFinal = 'FULLSTACK'; } const pastaFrontend = path.join(__dirname, '../public_html'); const pastaBackend = path.join(__dirname, '../'); if (destinoFinal === 'FRONTEND') { zip.extractAllTo(pastaFrontend, true); } else if (destinoFinal === 'BACKEND') { zip.extractAllTo(pastaBackend, true); } else { zip.extractAllTo(pastaFrontend, true); zip.extractAllTo(pastaBackend, true); } if (fs.existsSync(file.path)) fs.unlinkSync(file.path); if (version && title && desc) { try { await pool.execute('INSERT INTO system_changelog (version, title, type, desc_text, author) VALUES (?, ?, ?, ?, ?)', [version, `[${destinoFinal}] ${title}`, type || 'feature', desc, 'Root/DEV']); } catch (errDb) { } } await registrarAuditoria('DEPLOY_SISTEMA', 'Root/Dev', `Deploy ${destinoFinal} (${version || 'v.x'}): ${title || file.originalname}`, 'warning'); if (io) { io.emit('novo_changelog', { version, title, target: destinoFinal }); io.emit('operacao_atualizada', { tipo: 'deploy', target: destinoFinal, version }); } if (destinoFinal === 'BACKEND' || destinoFinal === 'FULLSTACK') { setTimeout(() => { exec('pm2 restart all', (error) => { if (error) console.error(`Erro ao tentar reiniciar o PM2: ${error}`); }); }, 1000); } res.json({ success: true, targetDetected: destinoFinal, message: `Deploy do tipo [${destinoFinal}] processado com sucesso!` }); } catch (error) { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); res.status(500).json({ error: 'Falha ao processar e extrair o pacote de atualização.' }); } });
  app.post('/api/system/query-raw', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).json({ success: false, error: 'Acesso negado. Privilégios de SysAdmin (DEV) necessários.' }); const { sql } = req.body; if (!sql) return res.status(400).json({ success: false, error: 'Instrução SQL ausente.' }); try { const [rows] = await pool.execute(sql); await registrarAuditoria('RAW_SQL_EXEC', 'Root/Dev', `Query executada: ${sql.substring(0, 100)}...`, 'danger'); res.json({ success: true, data: rows }); } catch (error) { res.json({ success: false, error: error.message }); }; });

  app.post('/api/pre-cadastros', async (req, res) => { try { const { empresa, cnpj, responsavel, email, telefone } = req.body; if (!empresa || !email) return res.status(400).json({ error: 'Dados incompletos' }); await pool.execute('INSERT INTO pre_cadastros (empresa, cnpj, responsavel, email, telefone) VALUES (?, ?, ?, ?, ?)', [empresa, cnpj, responsavel, email, telefone]); if (io) io.emit('novo_pre_cadastro'); res.status(201).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Erro ao processar pré-cadastro.' }); } });
  app.get('/api/pre-cadastros', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' }); try { const [rows] = await pool.execute('SELECT * FROM pre_cadastros WHERE status = "pendente" ORDER BY data_solicitacao ASC'); res.json(rows); } catch (error) { res.status(500).send(); } });
  app.post('/api/pre-cadastros/:id/aprovar', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' }); try { const [reqs] = await pool.execute('SELECT * FROM pre_cadastros WHERE id = ?', [req.params.id]); if (reqs.length === 0) return res.status(404).json({ error: 'Requerimento não encontrado' }); const reqData = reqs[0]; await pool.execute('UPDATE pre_cadastros SET status = "aprovado" WHERE id = ?', [req.params.id]); const contatoCompleto = `${reqData.responsavel} (${reqData.telefone})`; await pool.execute('INSERT IGNORE INTO empresas (nome, cnpj, contato, email, status) VALUES (?, ?, ?, ?, "Ativa")', [reqData.empresa, reqData.cnpj, contatoCompleto, reqData.email]); const nomeFilialMatriz = `Matriz - ${reqData.empresa}`; await pool.execute('INSERT IGNORE INTO loja (nome, endereco, telefone, empresa, status) VALUES (?, ?, ?, ?, "Ativa")', [nomeFilialMatriz, 'Sede Principal (Pendente de Atualização)', reqData.telefone, reqData.empresa]); const baseUsername = reqData.empresa.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 8); const randomSuffix = Math.floor(Math.random() * 900) + 100; const usuarioGerado = `admin.${baseUsername}${randomSuffix}`; const senhaGerada = Math.random().toString(36).slice(-6) + Math.floor(Math.random() * 99) + "T!"; const senhaHash = await bcrypt.hash(senhaGerada, 10); await pool.execute('INSERT INTO usuarios (usuario, senha, role, filial, nome_gerente, empresa) VALUES (?, ?, "ADMIN", "Todas", ?, ?)', [usuarioGerado, senhaHash, reqData.responsavel, reqData.empresa]); const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: 'thermosync126@gmail.com', pass: 'uhpm iasu atae tnbt' }, tls: { rejectUnauthorized: false } }); const mailOptions = { from: '"TermoSync NOC" <thermosync126@gmail.com>', to: reqData.email, subject: `Bem-vindo ao TermoSync, ${reqData.empresa}!`, html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;"><h2 style="color: #10b981; text-align: center;">Infraestrutura Provisionada!</h2><p>Olá, <strong>${reqData.responsavel}</strong>,</p><p>O seu requerimento foi aprovado pela nossa equipa de Engenharia.</p><p>O Tenant dedicado para a organização <strong>${reqData.empresa}</strong> foi gerado com sucesso e já se encontra operacional.</p><div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #38bdf8; margin: 20px 0; border-radius: 4px;"><h3 style="margin-top: 0; color: #0f172a;">Credenciais de Acesso (Administrador)</h3><p><strong>Usuário:</strong> <span style="font-family: monospace; font-size: 1.1em; color: #0369a1;">${usuarioGerado}</span></p><p><strong>Senha:</strong> <span style="font-family: monospace; font-size: 1.1em; color: #0369a1;">${senhaGerada}</span></p><p style="font-size: 12px; color: #ef4444; margin-bottom: 0;">Recomendamos fortemente a alteração desta senha após o primeiro acesso.</p></div><hr style="border:none; border-top:1px solid #eee; margin:20px 0;"><p style="font-size:12px; color:#999; text-align:center;">TermoSync Enterprise Operations</p></div>` }; await transporter.sendMail(mailOptions); await registrarAuditoria('ONBOARDING_APPROVED', 'Root/Dev', `Tenant provisionado: ${reqData.empresa} (Admin: ${usuarioGerado})`, 'success'); if (io) { io.emit('atualizacao_dados'); } res.json({ success: true, message: 'Aprovado com sucesso. Credenciais enviadas por e-mail.' }); } catch (error) { res.status(500).json({ error: 'Erro interno' }); } });
  app.post('/api/pre-cadastros/:id/rejeitar', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' }); try { await pool.execute('UPDATE pre_cadastros SET status = "rejeitado" WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (error) { res.status(500).send(); } });
  app.get('/api/system/changelog', verificarToken, async (req, res) => { try { const [rows] = await pool.execute('SELECT * FROM system_changelog ORDER BY date DESC, id DESC LIMIT 20'); res.json(rows); } catch (error) { res.status(500).json({ error: 'Erro ao carregar o changelog do sistema.' }); } });
  app.post('/api/system/changelog', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito a desenvolvedores.' }); const { version, title, type, desc_text } = req.body; if (!version || !title || !desc_text) return res.status(400).json({ error: 'Campos obrigatórios ausentes.' }); try { await pool.execute('INSERT INTO system_changelog (version, title, type, desc_text, author) VALUES (?, ?, ?, ?, ?)', [version, title, type || 'Improvement', desc_text, req.userRole || 'DEV']); io.emit('novo_changelog', { version, title }); res.status(201).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Falha ao registrar versão.' }); } });
  app.get('/api/tecnicos/ativos', verificarToken, async (req, res) => { try { const [rows] = await pool.execute('SELECT id, nome, telefone FROM tecnicos ORDER BY nome ASC'); res.json(rows); } catch (error) { res.status(500).json({ error: 'Erro ao listar técnicos.' }); } });
  app.post('/api/tecnicos', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Sem permissão.' }); const { nome, telefone } = req.body; if (!nome) return res.status(400).json({ error: 'Nome do técnico é obrigatório.' }); try { const [result] = await pool.execute('INSERT INTO tecnicos (nome, telefone) VALUES (?, ?)', [nome, telefone || '']); res.status(201).json({ id: result.insertId, nome, telefone }); } catch (error) { res.status(500).json({ error: 'Falha ao cadastrar técnico.' }); } });
  app.put('/api/chamados/:id/atribuir-tecnico', verificarToken, async (req, res) => { const { tecnico_id, tecnico_nome } = req.body; try { await pool.execute('UPDATE chamados SET tecnico_id = ?, tecnico_responsavel = ? WHERE id = ?', [tecnico_id || null, tecnico_nome || null, req.params.id]); io.emit('atualizacao_dados'); res.json({ success: true }); } catch (error) { res.status(500).json({ error: 'Erro ao atribuir técnico.' }); } });

  // ============================================================================
  // MOTOR MQTT - RECEPÇÃO DE TELEMETRIA E SINCRONIZAÇÃO DE HARDWARE
  // ============================================================================
  const mqttClientRecv = mqtt.connect('mqtt://localhost:1883');

  mqttClientRecv.on('connect', () => {
    console.log('🟢 [MQTT] Backend conectado ao Broker. Escutando ESP32...');
    mqttClientRecv.subscribe('termosync/telemetria');
    mqttClientRecv.subscribe('termosync/hardware/+/pedir_config');
  });

  mqttClientRecv.on('message', async (topic, message) => {

    // 1. ESP32 PEDINDO CONFIGURAÇÃO DO BANCO DE DADOS (PLUG & PLAY)
    if (topic.startsWith('termosync/hardware/') && topic.endsWith('/pedir_config')) {
      const idEquipamento = topic.split('/')[2];
      try {
        const [eq] = await pool.execute('SELECT temp_max FROM equipamentos WHERE id = ?', [idEquipamento]);
        if (eq.length > 0) {
          const tMax = parseFloat(eq[0].temp_max) || 30.0;
          const tAtencao = tMax - 2.0;
          const payloadConfig = JSON.stringify({
            acao: "CONFIG",
            temp_critica: tMax,
            temp_atencao: tAtencao
          });
          mqttClientRecv.publish(`termosync/comandos/${idEquipamento}`, payloadConfig);
          console.log(`📡 [MQTT] Banco de Dados -> ESP32 ID ${idEquipamento}: Temp Máx atualizada para ${tMax}°C`);
        }
      } catch (err) {
        console.error('❌ [ERRO BD] Falha ao buscar config para ESP32:', err.message);
      }
      return;
    }

    // 2. RECEBENDO LEITURAS DE TELEMETRIA NORMAIS
    if (topic === 'termosync/telemetria') {
      try {
        const payload = JSON.parse(message.toString());

        let isMaintenance = false;
        try {
          const [sys] = await pool.execute('SELECT valor FROM configuracoes WHERE chave = "maintenanceMode"');
          if (sys.length > 0 && sys[0].valor === '1') isMaintenance = true;
        } catch (err) { }

        if (isMaintenance) return;

        const {
          equipamento_id, temperatura, umidade, alerta_forcado, consumo_kwh,
          motor_ligado, em_degelo, mac_address, ip_local, sinal_wifi, uptime, firmware_version
        } = payload;

        const t = parseFloat(temperatura);
        const u = parseFloat(umidade || 50.0);
        const c_kwh = parseFloat(consumo_kwh || 0.0);

        const hw_mac = (mac_address || 'A4:CF:12:XX:XX:XX').substring(0, 20);
        const hw_ip = (ip_local || '192.168.1.100').substring(0, 15);
        const hw_wifi = sinal_wifi ? parseInt(sinal_wifi) : -65;
        const hw_up = (uptime || '0h').substring(0, 50);
        const hw_fw = (firmware_version || 'v1.0.0').substring(0, 20);

        try {
          await pool.execute(`
            INSERT INTO hardware_iot (equipamento_id, mac_address, ip_local, sinal_wifi, uptime, firmware_version, ultima_comunicacao)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
              mac_address = ?, ip_local = ?, sinal_wifi = ?, uptime = ?, firmware_version = ?, ultima_comunicacao = NOW()
          `, [
            equipamento_id, hw_mac, hw_ip, hw_wifi, hw_up, hw_fw,
            hw_mac, hw_ip, hw_wifi, hw_up, hw_fw
          ]);
        } catch (e) {
          console.error("❌ ERRO BD HARDWARE (MQTT):", e.message);
        }

        const [r] = await pool.execute('INSERT INTO leituras (equipamento_id, temperatura, umidade, consumo_kwh) VALUES (?, ?, ?, ?)', [equipamento_id, t, u, c_kwh]);
        const [eq] = await pool.execute('SELECT temp_max, temp_min, umidade_min, umidade_max, nome, em_degelo, motor_ligado, setor, filial, empresa FROM equipamentos WHERE id = ?', [equipamento_id]);

        if (eq.length > 0) {
          const isMotorLigado = (motor_ligado == 1 || motor_ligado === true);
          const isEmDegelo = (em_degelo == 1 || em_degelo === true);
          await pool.execute('UPDATE equipamentos SET motor_ligado=?, em_degelo=? WHERE id=?', [isMotorLigado, isEmDegelo, equipamento_id]);

          const tMax = parseFloat(eq[0].temp_max);
          const tMin = parseFloat(eq[0].temp_min);
          const uMax = parseFloat(eq[0].umidade_max || 0);
          const uMin = parseFloat(eq[0].umidade_min || 0);

          let novosAlertas = [];

          const checkAndAlert = async (condicaoAnomala, tipoAlerta, mensagem) => {
            if (condicaoAnomala) {
              const [existe] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
              if (existe.length === 0) {
                const [inserido] = await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta, resolvido) VALUES (?, ?, ?, 0)', [equipamento_id, mensagem, tipoAlerta]);
                novosAlertas.push({ id: inserido.insertId, equipamento_id, mensagem, tipo_alerta: tipoAlerta });
                
                // ==============================================================
                // [NOVIDADE] DISPARO DE WHATSAPP / SMS AQUI (MÓDULO MQTT)
                // ==============================================================
                if (tipoAlerta === 'MECANICA' || tipoAlerta === 'TEMPERATURA') {
                   console.log(`📱 [WHATSAPP - MQTT] Enviando alerta para gerência da loja ${eq[0].filial}: ${mensagem}`);
                   // enviarAlertaWhatsApp(mensagem, telefoneGerente); // <-- Descomente quando integrar a API
                }
              }
            } else {
              await pool.execute('UPDATE notificacoes SET resolvido=1 WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
            }
          };

          const condRede = (alerta_forcado === 'REDE');
          await checkAndAlert(condRede, 'REDE', `FALHA IoT/REDE: Sensor offline em "${eq[0].nome}".`);

          const condPorta = (alerta_forcado === 'PORTA_ABERTA');
          await checkAndAlert(condPorta, 'PORTA', `PORTA ABERTA: O equipamento "${eq[0].nome}" está com a porta violada!`);

          // CORREÇÃO DA REGRA DE OURO: O alerta de falha mecânica só dispara se o motor parar E a temperatura ficar alta!
          const condMecanica = (!isMotorLigado && !isEmDegelo && alerta_forcado !== 'REDE' && t >= (tMax + 10.0));
          await checkAndAlert(condMecanica, 'MECANICA', `MOTOR PARADO: O compressor de "${eq[0].nome}" falhou e a temperatura subiu!`);

          const condTemp = ((t > tMax || t < tMin) && !isEmDegelo);
          await checkAndAlert(condTemp, 'TEMPERATURA', `ALERTA TÉRMICO: "${eq[0].nome}" fora da faixa (${t}°C).`);

          if (uMax > 0 || uMin > 0) {
            const condUmi = ((u > uMax || u < uMin) && !isEmDegelo);
            await checkAndAlert(condUmi, 'UMIDADE', `ALERTA HIGROMÉTRICO: Umidade de "${eq[0].nome}" fora dos limites permitidos (${u}%).`);
          }

          if (novosAlertas.length > 0) { io.emit('atualizacao_dados'); novosAlertas.forEach(a => io.emit('novo_alerta', a)); }
          io.emit('nova_leitura', { id: r.insertId, equipamento_id, temperatura: t, umidade: u, consumo_kwh: c_kwh, motor_ligado: isMotorLigado, em_degelo: isEmDegelo, data_hora: new Date(), nome: eq[0].nome, setor: eq[0].setor, filial: eq[0].filial, empresa: eq[0].empresa });
        }
      } catch (error) {
        console.error('❌ [ERRO MQTT]: Falha ao processar payload', error.message);
      }
    }
  });
  // ============================================================================
  // NOVAS ROTAS DA FASE 1: PORTAL PÚBLICO E RELATÓRIO ANVISA
  // ============================================================================
  
  // A) Portal Público (Visão Cliente / Vigilância Sanitária na TV)
  // ============================================================================
  // NOVAS ROTAS DA FASE 1: PORTAL PÚBLICO E RELATÓRIO ANVISA
  // ============================================================================
  
  // A) Portal Público (Visão Cliente / Vigilância Sanitária na TV)
  app.get('/api/public/live/:filial', async (req, res) => {
    try {
      const filialReq = req.params.filial.replace(/-/g, ' '); 
      
      let query = `
        SELECT e.nome, e.filial, e.setor, e.motor_ligado, e.em_degelo, e.temp_max, e.temp_min,
        (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp,
        (SELECT data_hora FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS atualizado_em
        FROM equipamentos e
      `;
      let params = [];
      
      if (filialReq.toLowerCase() !== 'todas') {
        query += ` WHERE e.filial LIKE ?`;
        params.push(`%${filialReq}%`);
      }

      const [r] = await pool.execute(query, params);
      res.json({ success: true, unidade: filialReq, equipamentos: r });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Falha ao carregar portal público.' });
    }
  });

  // B) Relatório ANVISA / MAPA (Máximas e Mínimas Diárias)
  app.get('/api/relatorios/anvisa/:equipamento_id', verificarToken, async (req, res) => {
    const { equipamento_id } = req.params;
    try {
      const [rows] = await pool.execute(`
        SELECT DATE(data_hora) as data_registro, 
               MAX(temperatura) as temp_maxima, 
               MIN(temperatura) as temp_minima,
               AVG(temperatura) as temp_media
        FROM leituras 
        WHERE equipamento_id = ? AND data_hora >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(data_hora)
        ORDER BY data_registro DESC
      `, [equipamento_id]);
      
      const [eq] = await pool.execute('SELECT nome, filial, setor FROM equipamentos WHERE id = ?', [equipamento_id]);
      res.json({ success: true, equipamento: eq[0], historico_diario: rows });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Falha ao processar laudo oficial.' });
    }
  });

  // ============================================================================
  // WATCHDOG: MOTOR AUTÔNOMO DE DETECÇÃO DE QUEDA DE HARDWARE
  // ============================================================================
  setInterval(async () => {
    try {
      const [hardwaresMortos] = await pool.execute(`
        SELECT h.equipamento_id, h.ultima_comunicacao, e.nome, e.setor, e.filial, e.empresa
        FROM hardware_iot h JOIN equipamentos e ON h.equipamento_id = e.id
        WHERE h.ultima_comunicacao < DATE_SUB(NOW(), INTERVAL 3 MINUTE)
      `);

      for (const hw of hardwaresMortos) {
        const [alertaAberto] = await pool.execute(`SELECT id FROM notificacoes WHERE equipamento_id = ? AND tipo_alerta = 'REDE' AND (resolvido = 0 OR resolvido IS NULL)`, [hw.equipamento_id]);
        if (alertaAberto.length === 0) {
          const msg = `FALHA CRÍTICA (TIMEOUT): O sensor físico em "${hw.nome}" parou de transmitir dados há mais de 3 minutos!`;
          await pool.execute(`INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta, resolvido) VALUES (?, ?, 'REDE', 0)`, [hw.equipamento_id, msg]);
          if (io) io.emit('atualizacao_dados');
        }
      }
    } catch (error) { }
  }, 60000);

};