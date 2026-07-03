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
module.exports = (app, io) => {
  const SECRET_KEY = process.env.JWT_SECRET || 'chave_super_secreta_termosync_node';
  async function emitirOperacaoAtualizada(payload = {}) { try { io.emit('operacao_atualizada', payload); } catch (e) { } }
  app.post('/api/system/query-raw', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') {
      return res.status(403).json({ success: false, error: 'Acesso negado. Privilégios exclusivos ROOT (DEV).' });
    }

    const { sql } = req.body;
    if (!sql) return res.status(400).json({ success: false, error: 'Nenhuma diretiva instrucional estruturada foi declarada.' });

    try {
      const [rows] = await pool.execute(sql);

      // Registo de log persistente e imutável para conformidade do SOC
      await registrarAuditoria('RAW_SQL_EXEC', 'Root/Dev', `Query compilada: ${sql.substring(0, 120)}...`, 'danger');

      res.json({ success: true, data: rows });
    } catch (error) {
      res.json({ success: false, error: error.message });
    }
  });

  // ============================================================================
  // ROTA EXCLUSIVA DO PAINEL DEV: EXPORTAÇÃO DE DADOS (DUMP)
  // ============================================================================
  app.get('/api/health', async (req, res) => {
    try {
      await pool.execute('SELECT 1');
      res.json({ ok: true, timestamp: new Date().toISOString(), uptime: Number(process.uptime().toFixed(1)) });
    } catch (error) {
      res.status(503).json({ ok: false, error: 'Banco indisponível.' });
    }
  });

  app.post('/api/system/exportar-tabela', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    try {
      let { tabela } = req.body;
      if (tabela === 'leituras_telemetria') tabela = 'leituras';

      const tabelasPermitidas = [
        'equipamentos', 'leituras', 'usuarios',
        'notificacoes', 'audit_logs', 'sessoes_ativas',
        'empresas', 'chamados', 'hardware_iot'
      ];

      if (!tabelasPermitidas.includes(tabela)) {
        return res.status(400).json({ error: 'Tentativa de acesso a tabela não autorizada.' });
      }

      const [linhas] = await pool.query(`SELECT * FROM ${tabela}`);
      res.json({ sucesso: true, dados: linhas });
    } catch (erro) {
      console.error(`[ERRO MYSQL] Falha na extração:`, erro);
      res.status(500).json({ error: 'Falha interna do servidor ao gerar o dump.' });
    }
  });

  /* --- ROTAS BÁSICAS MANTIDAS --- */
  app.get('/api/empresas', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { const [r] = await pool.execute('SELECT * FROM empresas ORDER BY nome ASC'); res.json(r); } catch (e) { res.status(500).send(); } });
  app.post('/api/empresas', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('INSERT INTO empresas (nome, cnpj, contato, email, status) VALUES (?, ?, ?, ?, ?)', [req.body.nome, req.body.cnpj || null, req.body.contato || null, req.body.email || null, req.body.status || 'Ativa']); res.status(201).send(); } catch (e) { res.status(500).send(); } });
  app.put('/api/empresas/:id', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('UPDATE empresas SET nome=?, cnpj=?, contato=?, email=?, status=? WHERE id=?', [req.body.nome, req.body.cnpj, req.body.contato, req.body.email, req.body.status, req.params.id]); res.status(200).send(); } catch (e) { res.status(500).send(); } });

  app.post('/api/impersonate', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Permissão negada. Apenas Root.' });
    let empresaDestino = 'Cliente Alpha (Padrão)';
    const [lojas] = await pool.execute('SELECT empresa FROM loja WHERE nome = ? LIMIT 1', [req.body.filialDestino]);
    if (lojas.length > 0 && lojas[0].empresa) { empresaDestino = lojas[0].empresa; }
    else { const [eqs] = await pool.execute('SELECT empresa FROM equipamentos WHERE filial = ? LIMIT 1', [req.body.filialDestino]); if (eqs.length > 0 && eqs[0].empresa) empresaDestino = eqs[0].empresa; }

    registrarAuditoria('IMPERSONATE', 'Root/Dev', `Acesso remoto a: ${req.body.filialDestino}`, 'warning');
    res.json({ token: jwt.sign({ id: 9999, role: 'ADMIN', filial: 'Todas', empresa: empresaDestino }, SECRET_KEY, { expiresIn: '1h' }), empresa: empresaDestino });
  });

  app.post('/api/login', async (req, res) => {
    const { usuario, senha } = req.body;
    const [users] = await pool.execute('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
    const ip = req.ip || req.socket?.remoteAddress || 'Desconhecido';

    if (users.length === 0) {
      registrarAuditoria('LOGIN_FAILED', 'Desconhecido', `Tentativa com usuário: ${usuario} (${ip})`, 'danger');
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const senhaValida = await bcrypt.compare(senha, users[0].senha);
    if (!senhaValida) {
      registrarAuditoria('LOGIN_FAILED', usuario, `Senha Incorreta (${ip})`, 'danger');
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    const token = jwt.sign({ id: users[0].id, role: users[0].role, filial: users[0].filial, empresa: users[0].empresa }, SECRET_KEY, { expiresIn: '12h' });
    await pool.execute('INSERT INTO sessoes_ativas (usuario_id, usuario_nome, role, token, ip_address) VALUES (?, ?, ?, ?, ?)', [users[0].id, usuario, users[0].role, token, ip]);
    registrarAuditoria('LOGIN_SUCCESS', usuario, `Autenticação bem-sucedida (${ip})`, 'success');
    res.json({ token, id: users[0].id, role: users[0].role, filial: users[0].filial, nome_gerente: users[0].nome_gerente, nome_coordenador: users[0].nome_coordenador, nome_tecnico: users[0].nome_tecnico });
  });

  app.put('/api/usuarios/reset-senha', async (req, res) => { try { const { usuario, novaSenha } = req.body; if (!usuario || !novaSenha) { return res.status(400).json({ error: 'Dados incompletos.' }); } const [users] = await pool.execute('SELECT id FROM usuarios WHERE usuario = ?', [usuario]); if (users.length === 0) { return res.status(404).json({ error: 'Usuário não encontrado no sistema.' }); } await pool.execute('UPDATE usuarios SET senha = ? WHERE usuario = ?', [await bcrypt.hash(novaSenha, 10), usuario]); res.status(200).json({ message: 'Credenciais atualizadas com sucesso.' }); } catch (error) { res.status(500).json({ error: 'Erro interno ao redefinir a senha.' }); } });
  app.get('/api/usuarios', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); let q = 'SELECT id, usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa FROM usuarios WHERE 1=1'; let p = []; if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); } const [r] = await pool.execute(q + ' ORDER BY role ASC', p); res.json(r); });
  app.post('/api/usuarios', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' }); try { const { usuario, senha, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa } = req.body; await pool.execute('INSERT INTO usuarios (usuario, senha, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [usuario, await bcrypt.hash(senha, 10), role, filial || null, nome_gerente || null, nome_coordenador || null, nome_tecnico || null, (req.userRole === 'DEV' && empresa) ? empresa : req.userEmpresa]); res.status(201).send(); } catch (error) { res.status(500).json({ error: 'Erro ao criar usuário.' }); } });
  app.put('/api/usuarios/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' }); try { const { usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa, senha } = req.body; const empresaTarget = (req.userRole === 'DEV' && empresa) ? empresa : req.userEmpresa; if (senha) { await pool.execute('UPDATE usuarios SET usuario=?, senha=?, role=?, filial=?, nome_gerente=?, nome_coordenador=?, nome_tecnico=?, empresa=? WHERE id=?', [usuario, await bcrypt.hash(senha, 10), role, filial || null, nome_gerente || null, nome_coordenador || null, nome_tecnico || null, empresaTarget, req.params.id]); } else { await pool.execute('UPDATE usuarios SET usuario=?, role=?, filial=?, nome_gerente=?, nome_coordenador=?, nome_tecnico=?, empresa=? WHERE id=?', [usuario, role, filial || null, nome_gerente || null, nome_coordenador || null, nome_tecnico || null, empresaTarget, req.params.id]); } res.status(200).send(); } catch (error) { res.status(500).json({ error: 'Erro ao editar usuário.' }); } });
  app.delete('/api/usuarios/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' }); try { await pool.execute('DELETE FROM usuarios WHERE id=?', [req.params.id]); res.status(200).send(); } catch (error) { res.status(500).json({ error: 'Erro ao excluir usuário.' }); } });
  app.get('/api/lojas', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { let q = `SELECT * FROM loja WHERE 1=1`; let p = []; if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); } const [lojas] = await pool.execute(q + ' ORDER BY nome ASC', p); const [usuarios] = await pool.execute('SELECT filial, nome_gerente, nome_coordenador FROM usuarios'); res.json(lojas.map(l => { const uGerente = usuarios.find(user => user.filial === l.nome && user.nome_gerente); const uCoord = usuarios.find(user => user.filial === l.nome && user.nome_coordenador); return { ...l, nome_gerente: uGerente ? uGerente.nome_gerente : null, nome_coordenador: uCoord ? uCoord.nome_coordenador : null }; })); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post('/api/lojas', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('INSERT INTO loja (nome, endereco, telefone, empresa, status) VALUES (?, ?, ?, ?, ?)', [req.body.nome, req.body.endereco, req.body.telefone, req.userRole === 'DEV' && req.body.empresa ? req.body.empresa : req.userEmpresa, req.userRole === 'DEV' && req.body.status ? req.body.status : 'Ativa']); res.status(201).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/lojas/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { if (req.userRole === 'DEV') { await pool.execute('UPDATE loja SET nome=?, endereco=?, telefone=?, empresa=?, status=? WHERE id=?', [req.body.nome, req.body.endereco, req.body.telefone, req.body.empresa || req.userEmpresa, req.body.status || 'Ativa', req.params.id]); } else { await pool.execute('UPDATE loja SET nome=?, endereco=?, telefone=? WHERE id=? AND empresa=?', [req.body.nome, req.body.endereco, req.body.telefone, req.params.id, req.userEmpresa]); } res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.get('/api/equipamentos', verificarToken, async (req, res) => { let q = `SELECT e.*, (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp, (SELECT umidade FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_umidade FROM equipamentos e WHERE 1=1`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } } const [r] = await pool.execute(q, p); res.json(r); });
  app.post('/api/equipamentos', verificarToken, async (req, res) => { try { const { nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao } = req.body; await pool.execute('INSERT INTO equipamentos (nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao, empresa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [nome, tipo, temp_min, temp_max, umidade_min || null, umidade_max || null, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao || null, req.userEmpresa]); res.status(201).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/equipamentos/:id/edit', verificarToken, async (req, res) => { try { await pool.execute('UPDATE equipamentos SET nome=?, tipo=?, temp_min=?, temp_max=?, umidade_min=?, umidade_max=?, intervalo_degelo=?, duracao_degelo=?, setor=?, filial=?, data_calibracao=? WHERE id=? AND empresa=?', [req.body.nome, req.body.tipo, req.body.temp_min, req.body.temp_max, req.body.umidade_min || null, req.body.umidade_max || null, req.body.intervalo_degelo, req.body.duracao_degelo, req.body.setor, req.body.filial, req.body.data_calibracao || null, req.params.id, req.userEmpresa]); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.delete('/api/equipamentos/:id', verificarToken, async (req, res) => { try { await pool.execute('DELETE FROM equipamentos WHERE id=? AND empresa=?', [req.params.id, req.userEmpresa]); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.get('/api/chamados', verificarToken, async (req, res) => { let q = `SELECT c.*, e.nome as equipamento_nome, u.usuario as aberto_por FROM chamados c LEFT JOIN equipamentos e ON c.equipamento_id = e.id LEFT JOIN usuarios u ON c.usuario_id = u.id WHERE 1=1`; const p = []; if (req.userRole !== 'DEV') { q += ' AND c.empresa = ?'; p.push(req.userEmpresa); if (req.userRole === 'LOJA') { q += ` AND c.filial = ?`; p.push(req.userFilial); } } const [r] = await pool.execute(q + ' ORDER BY c.data_abertura DESC', p); res.json(r); });
  app.post('/api/chamados', verificarToken, async (req, res) => { try { const { equipamento_id, descricao, solicitante_nome, tecnico_responsavel, urgencia } = req.body; let filialStr = null; try { const [eq] = await pool.execute('SELECT filial FROM equipamentos WHERE id=?', [equipamento_id]); if (eq.length > 0) filialStr = eq[0].filial; } catch (e) { } await pool.execute(`INSERT INTO chamados (equipamento_id, usuario_id, filial, descricao, solicitante_nome, tecnico_responsavel, empresa, urgencia, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aberto')`, [equipamento_id || null, req.userId, filialStr, descricao, solicitante_nome || null, tecnico_responsavel || null, req.userEmpresa, urgencia || 'Pendente']); io.emit('atualizacao_dados'); res.status(201).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/chamados/:id/status', verificarToken, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) return res.status(400).json({ error: 'Status ausente.' });
      let query = 'UPDATE chamados SET status = ?';
      let params = [status];
      if (status === 'Concluído') {
        query += ', data_conclusao = CURRENT_TIMESTAMP';
      } else {
        query += ', data_conclusao = NULL';
      }
      query += ' WHERE id = ?';
      params.push(req.params.id);
      await pool.execute(query, params);
      io.emit('atualizacao_dados');
      res.status(200).json({ success: true, message: `Status alterado para ${status}` });
    } catch (error) {
      console.error(`\n❌ [ERRO KANBAN] Falha no banco de dados:`, error.message);
      res.status(500).json({ error: 'Falha no banco de dados ao mover o card.' });
    }
  });
  app.delete('/api/chamados/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('DELETE FROM chamados WHERE id=?', [req.params.id]); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/chamados/:id', verificarToken, async (req, res) => { try { const [atual] = await pool.execute('SELECT * FROM chamados WHERE id=?', [req.params.id]); if (atual.length === 0) return res.status(404).send(); const chamado = atual[0]; const novoStatus = req.body.status !== undefined ? req.body.status : chamado.status; let query = 'UPDATE chamados SET status=?, nota_resolucao=?, arquivado=?, urgencia=?, tecnico_responsavel=?'; if (novoStatus === 'Concluído' && chamado.status !== 'Concluído') query += ', data_conclusao=CURRENT_TIMESTAMP'; query += ' WHERE id=?'; await pool.execute(query, [novoStatus, req.body.nota_resolucao !== undefined ? req.body.nota_resolucao : chamado.nota_resolucao, req.body.arquivado !== undefined ? (req.body.arquivado ? 1 : 0) : chamado.arquivado, req.body.urgencia !== undefined ? req.body.urgencia : chamado.urgencia, req.body.tecnico_responsavel !== undefined ? req.body.tecnico_responsavel : chamado.tecnico_responsavel, req.params.id]); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/chamados/:id/arquivar', verificarToken, async (req, res) => { try { await pool.execute('UPDATE chamados SET arquivado=1, data_conclusao=CURRENT_TIMESTAMP WHERE id=?', [req.params.id]); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/chamados/:id/urgencia', verificarToken, async (req, res) => { try { await pool.execute('UPDATE chamados SET urgencia=? WHERE id=?', [req.body.urgencia, req.params.id]); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });

  app.get('/api/suporte/artigos', verificarToken, async (req, res) => {
    try {
      const isDev = req.userRole === 'DEV';
      const publico = isDev ? [] : ['USUARIO', 'AMBOS'];
      let query = 'SELECT * FROM suporte_artigos WHERE ativo = TRUE';
      const params = [];
      if (!isDev) {
        query += ' AND publico IN (?, ?)';
        params.push(publico[0], publico[1]);
      }
      const [rows] = await pool.execute(query + ' ORDER BY destaque DESC, updated_at DESC, titulo ASC', params);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Falha ao listar artigos.' });
    }
  });

  app.get('/api/suporte/chamados', verificarToken, async (req, res) => {
    try {
      let query = 'SELECT * FROM suporte_chamados WHERE 1=1';
      const params = [];
      if (req.userRole !== 'DEV') {
        query += ' AND (empresa = ? OR empresa IS NULL OR empresa = "")';
        params.push(req.userEmpresa);
        if (req.userRole === 'LOJA') {
          query += ' AND (filial = ? OR filial IS NULL OR filial = "")';
          params.push(req.userFilial);
        }
      }
      const [rows] = await pool.execute(query + ' ORDER BY criado_em DESC', params);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Falha ao listar chamados de suporte.' });
    }
  });

  app.post('/api/suporte/chamados', verificarToken, async (req, res) => {
    try {
      const { titulo, descricao, categoria, prioridade, solicitante, email } = req.body;
      if (!titulo || !descricao || !solicitante) return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
      const [result] = await pool.execute(
        'INSERT INTO suporte_chamados (titulo, descricao, categoria, prioridade, origem, solicitante, email, empresa, filial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [titulo, descricao, categoria || 'Geral', prioridade || 'Média', req.userRole === 'DEV' ? 'DEV' : 'USUARIO', solicitante, email || null, req.userEmpresa || null, req.userFilial || null]
      );
      await registrarHistoricoSuporte({
        chamadoId: result.insertId,
        evento: 'ABERTURA',
        autor: solicitante,
        papel: req.userRole,
        statusAnterior: null,
        statusNovo: 'Aberto',
        mensagem: descricao
      });
      io.emit('atualizacao_dados');
      res.status(201).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao abrir chamado de suporte.' });
    }
  });

  app.put('/api/suporte/chamados/:id', verificarToken, async (req, res) => {
    try {
      const { status, resposta, responsavel } = req.body;
      const [atual] = await pool.execute('SELECT * FROM suporte_chamados WHERE id = ?', [req.params.id]);
      if (atual.length === 0) return res.status(404).json({ error: 'Chamado não encontrado.' });

      const chamadoAtual = atual[0];
      const novoStatus = status || chamadoAtual.status;

      await pool.execute(
        'UPDATE suporte_chamados SET status = ?, resposta = ?, responsavel = ? WHERE id = ?',
        [novoStatus, resposta !== undefined ? resposta : chamadoAtual.resposta, responsavel !== undefined ? responsavel : chamadoAtual.responsavel, req.params.id]
      );
      if ((resposta !== undefined && resposta !== chamadoAtual.resposta) || novoStatus !== chamadoAtual.status) {
        await registrarHistoricoSuporte({
          chamadoId: req.params.id,
          evento: resposta !== undefined ? 'RESPOSTA' : 'ATUALIZACAO_STATUS',
          autor: responsavel || req.userRole || 'Sistema',
          papel: req.userRole,
          statusAnterior: chamadoAtual.status,
          statusNovo: novoStatus,
          mensagem: resposta !== undefined ? resposta : `Status alterado para ${novoStatus}`
        });
      }
      io.emit('atualizacao_dados');
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao atualizar chamado de suporte.' });
    }
  });

  app.get('/api/suporte/chamados/:id/historico', verificarToken, async (req, res) => {
    try {
      const [ticket] = await pool.execute('SELECT id, empresa, filial, solicitante FROM suporte_chamados WHERE id = ?', [req.params.id]);
      if (ticket.length === 0) return res.status(404).json({ error: 'Chamado não encontrado.' });

      if (req.userRole !== 'DEV') {
        const permitidoEmpresa = ticket[0].empresa === req.userEmpresa || !ticket[0].empresa;
        const permitidoFilial = req.userRole !== 'LOJA' || ticket[0].filial === req.userFilial || !ticket[0].filial;
        if (!permitidoEmpresa || !permitidoFilial) {
          return res.status(403).json({ error: 'Acesso negado.' });
        }
      }

      const [historico] = await pool.execute(
        'SELECT * FROM suporte_chamado_historico WHERE chamado_id = ? ORDER BY criado_em ASC, id ASC',
        [req.params.id]
      );
      res.json(historico);
    } catch (error) {
      res.status(500).json({ error: 'Falha ao listar histórico do chamado.' });
    }
  });

  app.get('/api/notificacoes', verificarToken, async (req, res) => { let q = `SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE n.resolvido = FALSE`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } if (req.userRole === 'LOJA') { q += ` AND e.filial = ?`; p.push(req.userFilial); } const [r] = await pool.execute(q + ' ORDER BY n.data_hora DESC', p); res.json(r); });
  app.get('/api/notificacoes/historico', verificarToken, async (req, res) => { let q = `SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE n.resolvido = TRUE`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } if (req.userRole === 'LOJA') { q += ` AND e.filial = ?`; p.push(req.userFilial); } const [r] = await pool.execute(q + ' ORDER BY n.data_hora DESC LIMIT 150', p); res.json(r); });
  app.put('/api/notificacoes/:id/resolver', verificarToken, async (req, res) => { try { await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao=? WHERE id=?', [req.body.nota_resolucao || 'Resolvido pelo operador.', req.params.id]); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/notificacoes/resolver-todas', verificarToken, async (req, res) => { try { let q = 'UPDATE notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id SET n.resolvido=TRUE, n.nota_resolucao="Limpeza em Lote" WHERE n.resolvido=FALSE'; let p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } } await pool.execute(q, p); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.get('/api/relatorios', verificarToken, async (req, res) => { let q = `SELECT l.id, l.temperatura, l.umidade, l.consumo_kwh, l.data_hora, e.nome, e.setor, e.filial FROM leituras l JOIN equipamentos e ON l.equipamento_id = e.id WHERE 1=1`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } if (req.query.data_inicio && req.query.data_fim) { q += ' AND l.data_hora BETWEEN ? AND ?'; p.push(new Date(req.query.data_inicio), new Date(req.query.data_fim)); } else { q += ' AND l.data_hora >= DATE_SUB(NOW(), INTERVAL 6 HOUR)'; } const [r] = await pool.execute(q + ' ORDER BY l.data_hora ASC LIMIT 3000', p); res.json(r); });
  app.get('/api/operacao/resumo', verificarToken, async (req, res) => {
    try {
      const filialFiltro = req.query.filial || req.userFilial || 'Todas';
      const empresaFiltro = req.userEmpresa || 'Cliente Alpha (Padrão)';
      const filtros = ['e.empresa = ?'];
      const params = [empresaFiltro];

      if (req.userRole === 'LOJA') {
        filtros.push('e.filial = ?');
        params.push(req.userFilial);
      } else if (filialFiltro && filialFiltro !== 'Todas') {
        filtros.push('e.filial = ?');
        params.push(filialFiltro);
      }

      const whereClause = filtros.join(' AND ');

      let equipamentosRows = [];
      let alertasRows = [];
      let chamadosRows = [];

      try {
        [equipamentosRows] = await pool.execute(`
        SELECT e.id, e.nome, e.filial, e.motor_ligado, e.em_degelo,
          (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp,
          (SELECT umidade FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_umidade
        FROM equipamentos e
        WHERE ${whereClause}
      `, params);
      } catch (e) { }

      try {
        [alertasRows] = await pool.execute(`
        SELECT n.id, n.mensagem, n.data_hora, e.nome AS equipamento_nome, e.filial
        FROM notificacoes n
        JOIN equipamentos e ON n.equipamento_id = e.id
        WHERE ${whereClause} AND n.resolvido = FALSE
        ORDER BY n.data_hora DESC
        LIMIT 8
      `, params);
      } catch (e) { }

      try {
        [chamadosRows] = await pool.execute(`
        SELECT c.id, c.status, c.urgencia, e.nome AS equipamento_nome
        FROM chamados c
        LEFT JOIN equipamentos e ON c.equipamento_id = e.id
        WHERE ${whereClause} AND c.status <> 'Concluído' AND c.status <> 'Fechado'
        ORDER BY c.data_abertura DESC
        LIMIT 8
      `, params);
      } catch (e) { }

      const totalEquipamentos = equipamentosRows.length;
      const alertasAtivos = alertasRows.length;
      const chamadosAbertos = chamadosRows.length;
      const equipamentosFalha = equipamentosRows.filter((eq) => !eq.motor_ligado && !eq.em_degelo).length;
      const equipamentosDegelo = equipamentosRows.filter((eq) => eq.em_degelo).length;
      const temperaturaMedia = totalEquipamentos
        ? (equipamentosRows.reduce((acc, item) => acc + (Number(item.ultima_temp) || 0), 0) / totalEquipamentos).toFixed(1)
        : 0;
      const umidadeMedia = totalEquipamentos
        ? (equipamentosRows.reduce((acc, item) => acc + (Number(item.ultima_umidade) || 0), 0) / totalEquipamentos).toFixed(1)
        : 0;

      res.json({
        total_equipamentos: totalEquipamentos,
        alertas_ativos: alertasAtivos,
        chamados_abertos: chamadosAbertos,
        equipamentos_em_falha: equipamentosFalha,
        equipamentos_em_degelo: equipamentosDegelo,
        temperatura_media: Number(temperaturaMedia),
        umidade_media: Number(umidadeMedia),
        ultimos_alertas: alertasRows,
        ultimos_chamados: chamadosRows,
        filial: filialFiltro,
        atualizada_em: new Date().toISOString()
      });
    } catch (e) {
      res.json({
        total_equipamentos: 0,
        alertas_ativos: 0,
        chamados_abertos: 0,
        equipamentos_em_falha: 0,
        equipamentos_em_degelo: 0,
        temperatura_media: 0,
        umidade_media: 0,
        ultimos_alertas: [],
        ultimos_chamados: [],
        filial: req.query.filial || req.userFilial || 'Todas',
        atualizada_em: new Date().toISOString()
      });
    }
  });

  app.get('/api/operacao/tarefas', verificarToken, async (req, res) => {
    try {
      const tipo = req.query.tipo || 'checklist_turno';
      const filial = req.query.filial || req.userFilial || 'Todas';
      const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)';
      let rows = [];

      try {
        const [dbRows] = await pool.execute('SELECT * FROM operacao_tarefas WHERE tipo = ? AND empresa = ? AND (filial IS NULL OR filial = ? OR filial = "Todas" OR ? = "Todas") ORDER BY ordem, id', [tipo, empresa, filial, filial]);
        rows = dbRows;
      } catch (e) {
        rows = [];
      }

      if (!rows.length) {
        const defaults = tipo === 'plano_dia'
          ? [
            { chave: 'plano-1', titulo: 'Revisar alertas críticos', descricao: 'Verificar anomalias prioritárias', horario: '08:00' },
            { chave: 'plano-2', titulo: 'Validar temperaturas das áreas prioritárias', descricao: 'Acompanhar desvios térmicos', horario: '09:00' },
            { chave: 'plano-3', titulo: 'Acompanhar chamados em andamento', descricao: 'Escalar pendências relevantes', horario: '11:00' }
          ]
          : [
            { chave: 'pre-turno', titulo: 'Confirmar status geral do painel e das notificações.', descricao: 'Validações iniciais antes de iniciar a operação.', horario: '08:00' },
            { chave: 'operacao', titulo: 'Validar temperatura e umidade das áreas críticas.', descricao: 'Acompanhar desvios operacionais', horario: '10:00' },
            { chave: 'encerramento', titulo: 'Registrar ocorrências relevantes no histórico da operação.', descricao: 'Encerrar o turno com contexto', horario: '16:00' }
          ];

        try {
          for (const [index, item] of defaults.entries()) {
            await pool.execute('INSERT INTO operacao_tarefas (tipo, chave, titulo, descricao, horario, ordem, filial, empresa, concluida) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [tipo, item.chave, item.titulo, item.descricao || null, item.horario || null, index + 1, filial, empresa, 0]);
          }
        } catch (e) { }

        return res.json(defaults.map((item, index) => ({
          id: `fallback-${tipo}-${index + 1}`,
          tipo,
          chave: item.chave,
          titulo: item.titulo,
          descricao: item.descricao,
          horario: item.horario,
          concluida: false,
          ordem: index + 1,
          filial,
          empresa
        })));
      }

      res.json(rows);
    } catch (e) {
      res.json([]);
    }
  });

  app.put('/api/operacao/tarefas/:id', verificarToken, async (req, res) => {
    try {
      const { concluida } = req.body;
      const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)';
      await pool.execute('UPDATE operacao_tarefas SET concluida = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND empresa = ?', [concluida ? 1 : 0, req.params.id, empresa]);
      await emitirOperacaoAtualizada({ tipo: 'tarefas', empresa, usuario: req.userId });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Falha ao atualizar tarefa.' });
    }
  });
  app.get('/api/auxiliares/filiais', verificarToken, async (req, res) => { try { let q1 = 'SELECT DISTINCT nome AS filial FROM loja WHERE 1=1'; let q2 = 'SELECT DISTINCT filial FROM equipamentos WHERE filial IS NOT NULL'; let p = []; if (req.userRole !== 'DEV') { q1 += ' AND empresa = ?'; q2 += ' AND empresa = ?'; p.push(req.userEmpresa); } const [r1] = await pool.execute(q1, req.userRole !== 'DEV' ? [req.userEmpresa] : []); const [r2] = await pool.execute(q2, req.userRole !== 'DEV' ? [req.userEmpresa] : []); res.json(Array.from(new Set([...r1.map(x => x.filial), ...r2.map(x => x.filial)])).sort()); } catch (e) { res.status(500).send(); } });
  app.get('/api/contatos', verificarToken, async (req, res) => { try { let q = 'SELECT id, usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico FROM usuarios WHERE id != ?'; let p = [req.userId]; if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); } const [rows] = await pool.execute(q, p); res.json(rows.map(u => { let nome = u.usuario; let cargo = 'Usuário'; if (u.role === 'ADMIN' || u.role === 'DEV') { nome = 'Administração'; cargo = 'Suporte Master'; } else if (u.role === 'MANUTENCAO') { nome = u.nome_tecnico || u.usuario; cargo = 'Técnico Manutenção'; } else if (u.role === 'LOJA') { if (u.nome_gerente) { nome = u.nome_gerente; cargo = `Gerente - ${u.filial}`; } else if (u.nome_coordenador) { nome = u.nome_coordenador; cargo = `Coordenador - ${u.filial}`; } else { nome = `Equipe ${u.filial}`; cargo = 'Operador Loja'; } } return { id: u.id, nome, cargo, role: u.role, filial: u.filial }; })); } catch (error) { res.status(500).json({ error: error.message }); } });
  app.get('/api/chat/historico', verificarToken, async (req, res) => { try { const [r] = await pool.execute('SELECT * FROM chat_mensagens ORDER BY data_hora ASC LIMIT 150'); res.json(r); } catch (e) { res.status(500).send(); } });
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

  app.post('/api/leituras', async (req, res) => {
    try {
      const [sys] = await pool.execute('SELECT valor FROM configuracoes WHERE chave = "maintenanceMode"');
      if (sys.length > 0 && sys[0].valor === '1') {
        return res.status(503).json({ error: 'Sistema em Manutenção. Operações offline.' });
      }

      const {
        equipamento_id, temperatura, umidade, alerta_forcado, consumo_kwh,
        motor_ligado, em_degelo,
        mac_address, ip_local, sinal_wifi, uptime, firmware_version
      } = req.body;

      const t = parseFloat(temperatura); const u = parseFloat(umidade || 50.0); const c_kwh = parseFloat(consumo_kwh || 0.0);

      try {
        await pool.execute(`
        INSERT INTO hardware_iot (equipamento_id, mac_address, ip_local, sinal_wifi, uptime, firmware_version, ultima_comunicacao)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
        ip_local = VALUES(ip_local), sinal_wifi = VALUES(sinal_wifi), uptime = VALUES(uptime), ultima_comunicacao = NOW()
      `, [
          equipamento_id,
          mac_address || 'A4:CF:12:XX:XX:XX',
          ip_local || '192.168.1.100',
          sinal_wifi ? parseInt(sinal_wifi) : -65,
          uptime || '0h',
          firmware_version || 'v1.0.0'
        ]);
      } catch (e) {
        console.log('Aviso (Hardware IoT):', e.message);
      }

      const [r] = await pool.execute('INSERT INTO leituras (equipamento_id, temperatura, umidade, consumo_kwh) VALUES (?, ?, ?, ?)', [equipamento_id, t, u, c_kwh]);
      const [eq] = await pool.execute('SELECT temp_max, temp_min, umidade_min, umidade_max, nome, em_degelo, motor_ligado, setor, filial FROM equipamentos WHERE id = ?', [equipamento_id]);

      if (eq.length > 0) {
        const isMotorLigado = (motor_ligado == 1 || motor_ligado === true);
        const isEmDegelo = (em_degelo == 1 || em_degelo === true);
        await pool.execute('UPDATE equipamentos SET motor_ligado=?, em_degelo=? WHERE id=?', [isMotorLigado, isEmDegelo, equipamento_id]);

        const tMax = parseFloat(eq[0].temp_max);
        const tMin = parseFloat(eq[0].temp_min);
        const uMax = parseFloat(eq[0].umidade_max || 0);
        const uMin = parseFloat(eq[0].umidade_min || 0);

        let novosAlertas = [];
        let resolvidoAutomatico = false;

        const checkAndAlert = async (condicaoAnomala, tipoAlerta, mensagem, isSilencioso = false) => {
          if (condicaoAnomala) {
            const [existe] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
            if (existe.length === 0) {
              const [inserido] = await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta) VALUES (?, ?, ?)', [equipamento_id, mensagem, tipoAlerta]);
              novosAlertas.push({ id: inserido.insertId, equipamento_id, mensagem, tipo_alerta: tipoAlerta, data_hora: new Date().toISOString(), resolvido: 0, equipamento_nome: eq[0].nome, setor: eq[0].setor, filial: eq[0].filial, silencioso: isSilencioso });
            }
          } else {
            const [upd] = await pool.execute('UPDATE notificacoes SET resolvido=TRUE, nota_resolucao="Normalizado automaticamente." WHERE equipamento_id=? AND resolvido=FALSE AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
            if (upd.affectedRows > 0) resolvidoAutomatico = true;
          }
        };

        await checkAndAlert(alerta_forcado === 'REDE', 'REDE', `FALHA IoT/REDE: Sensor offline em "${eq[0].nome}".`);
        await checkAndAlert(alerta_forcado === 'PORTA_ABERTA', 'PORTA', `PORTA ABERTA: O equipamento "${eq[0].nome}" está com a porta violada!`);
        await checkAndAlert(!isMotorLigado && !isEmDegelo && alerta_forcado !== 'REDE', 'MECANICA', `MOTOR PARADO: O compressor de "${eq[0].nome}" desligou subitamente!`);
        await checkAndAlert((t > tMax || t < tMin) && !isEmDegelo, 'TEMPERATURA', `ALERTA TÉRMICO: "${eq[0].nome}" fora da faixa configurada (${t}°C).`);

        if (uMax > 0 || uMin > 0) {
          await checkAndAlert((u > uMax || u < uMin) && !isEmDegelo, 'UMIDADE', `ALERTA HIGROMÉTRICO: Umidade de "${eq[0].nome}" fora dos limites permitidos (${u}%).`);
        }

        await checkAndAlert(isEmDegelo, 'DEGELO', `INFO: "${eq[0].nome}" entrou em ciclo de Degelo programado.`, true);

        if (novosAlertas.length > 0 || resolvidoAutomatico) { io.emit('atualizacao_dados'); }

        if (novosAlertas.length > 0) {
          novosAlertas.forEach(alertaObj => {
            if (!alertaObj.silencioso) { enviarAlertaWhatsApp(`🚨 ALERTA NOC em *${eq[0].nome}*. Motivo: ${alertaObj.mensagem}`, eq[0].filial); }
            io.emit('novo_alerta', alertaObj);
          });
        }

        io.emit('nova_leitura', { id: r.insertId, equipamento_id, temperatura: t, umidade: u, consumo_kwh: c_kwh, motor_ligado: isMotorLigado, em_degelo: isEmDegelo, data_hora: new Date(), nome: eq[0].nome, setor: eq[0].setor, filial: eq[0].filial });
      }
      res.status(201).send();
    } catch (error) { res.status(500).send(); }
  });

  app.get('/api/system/health', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).send();
    try {
      const [rows] = await pool.execute('SELECT COUNT(*) as total FROM leituras');
      res.json({
        db: 'ONLINE',
        sockets: io.engine.clientsCount,
        total_records: rows[0].total,
        uptime: process.uptime()
      });
    } catch (e) { res.status(500).send(); }
  });

  app.post('/api/system/purge', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).send();
    const { dias } = req.body;
    try {
      const [resPurge] = await pool.execute(`DELETE FROM leituras WHERE data_hora < DATE_SUB(NOW(), INTERVAL ? DAY)`, [dias]);
      registrarAuditoria('DB_PURGE', 'Root/Dev', `Limpeza da tabela de leituras (> ${dias} dias)`, 'danger');
      res.json({ deleted: resPurge.affectedRows });
    } catch (e) { res.status(500).send(); }
  });

  // ==========================================
  // ROTAS DO SOC (SECURITY OPERATIONS CENTER)
  // ==========================================
  app.get('/api/soc/sessoes', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).send();
    try {
      const [sessoes] = await pool.execute('SELECT id, usuario_nome as usuario, role, ip_address as ip, localizacao as location, data_login as loginTime FROM sessoes_ativas WHERE revogado = FALSE ORDER BY data_login DESC');
      res.json(sessoes);
    } catch (e) { res.status(500).send(); }
  });

  app.post('/api/soc/revogar/:id', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).send();
    try {
      const [sessao] = await pool.execute('SELECT usuario_nome FROM sessoes_ativas WHERE id = ?', [req.params.id]);
      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE id = ?', [req.params.id]);

      const alvo = sessao.length > 0 ? sessao[0].usuario_nome : 'ID ' + req.params.id;
      registrarAuditoria('TOKEN_REVOKED', 'root_dev', alvo, 'danger');

      res.json({ success: true });
    } catch (e) { res.status(500).send(); }
  });

  app.get('/api/soc/auditoria', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).send();
    try {
      const [logs] = await pool.execute('SELECT data_hora, acao as action, ator as actor, alvo as target, severidade as severity FROM audit_logs ORDER BY data_hora DESC LIMIT 100');
      res.json(logs);
    } catch (e) { res.status(500).send(); }
  });

  // Rota para registrar a geração de um relatório executivo
  app.post('/api/system/reports/log', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).send();
    try {
      const { tipo, formato, solicitante } = req.body;
      await pool.execute(
        'INSERT INTO sys_relatorios_log (tipo_relatorio, formato, solicitante) VALUES (?, ?, ?)',
        [tipo, formato, solicitante]
      );
      res.status(201).send();
    } catch (e) { res.status(500).send(); }
  });


  // ============================================================================
  // NOVA ROTA DO SISTEMA: DEPLOY E ATUALIZAÇÃO VIA ARQUIVO .ZIP DO PAINEL DEV
  // ============================================================================
  app.post('/api/system/deploy-update', verificarToken, upload.single('updatePackage'), (req, res) => {

    // 1. Bloqueia qualquer pessoa que não seja o DEV
    if (req.userRole !== 'DEV') {
      if (req.file) fs.unlinkSync(req.file.path); // Apaga ficheiro se foi enviado
      return res.status(403).json({ error: 'Acesso negado. Permissão exclusiva de SysAdmin (DEV).' });
    }

    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'Nenhum pacote (.zip) foi enviado.' });

      // 2. ⚠️ ATENÇÃO: DEFINA AQUI A PASTA ONDE FICA O FRONTEND (REACT) NO SEU SERVIDOR
      // Exemplo cPanel: path.join(__dirname, '../public_html')
      // Exemplo VPS Padrão: path.join(__dirname, '../frontend/build')
      const pastaPublicaInterface = path.join(__dirname, '../public_html');

      // 3. Extrai o conteúdo sobrescrevendo os ficheiros antigos
      const zip = new AdmZip(file.path);
      zip.extractAllTo(pastaPublicaInterface, true);

      // 4. Limpa o ficheiro zip temporário do servidor
      fs.unlinkSync(file.path);

      registrarAuditoria('DEPLOY_SISTEMA', 'Root/Dev', `Nova versão injetada via Painel NOC`, 'warning');

      // 5. Retorna sucesso para a interface ANTES de derrubar o servidor
      res.json({ success: true, message: 'Ficheiros extraídos e atualizados com sucesso.' });

      // 6. Reinicia a API (Derruba os sockets e aplica novo código Node se houver)
      setTimeout(() => {
        console.log('⚠️ ALERTA: A reiniciar o sistema via atualização do Painel Dev...');

        // Se usar PM2, altere "all" para o nome do seu processo, ex: "pm2 restart termosync"
        exec('pm2 restart all', (error) => {
          if (error) console.error(`Erro ao tentar reiniciar o PM2: ${error}`);
        });
      }, 1000);

    } catch (error) {
      console.error('❌ Erro crítico no Deploy:', error);
      if (req.file) fs.unlinkSync(req.file.path); // Garante que não deixa lixo no servidor em caso de erro
      res.status(500).json({ error: 'Falha ao processar o pacote de atualização.' });
    }
  });


  // ============================================================================
  // NOVA ROTA DO SISTEMA: EXECUTOR DE QUERIES RAW (CONSOLE SQL)
  // ============================================================================
  app.post('/api/system/query-raw', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') {
      return res.status(403).json({ success: false, error: 'Acesso negado. Privilégios de SysAdmin (DEV) necessários.' });
    }

    const { sql } = req.body;
    if (!sql) return res.status(400).json({ success: false, error: 'Instrução SQL ausente.' });

    try {
      const [rows] = await pool.execute(sql);

      // Registo na auditoria SOC para fins de conformidade e segurança zero-trust
      await registrarAuditoria('RAW_SQL_EXEC', 'Root/Dev', `Query executada: ${sql.substring(0, 100)}...`, 'danger');

      res.json({ success: true, data: rows });
    } catch (error) {
      res.json({ success: false, error: error.message });
    };
});
};
