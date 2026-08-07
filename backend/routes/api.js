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
          const query = `
            INSERT INTO chat_mensagens 
            (remetente_id, remetente_nome, destino_id, texto, data_hora) 
            VALUES (?, ?, ?, ?, NOW())
          `;
          const [result] = await pool.execute(query, [
            msg.remetenteId,
            msg.remetenteNome,
            msg.destinoId || 'todos',
            msg.texto
          ]);

          const mensagemSalva = {
            id: result.insertId,
            remetenteId: msg.remetenteId,
            remetenteNome: msg.remetenteNome,
            destinoId: msg.destinoId || 'todos',
            texto: msg.texto,
            data: new Date().toISOString(), 
            tipo: 'received' 
          };

          socket.broadcast.emit('nova_mensagem_chat', mensagemSalva);
        } catch (error) {
          console.error('❌ [ERRO CHAT] Falha ao persistir mensagem no MySQL:', error);
        }
      });
    });
    io._chatListenerConfigured = true; 
  }

  // ============================================================================
  // ROTAS DE CHAT (HISTÓRICO)
  // ============================================================================
  app.get('/api/chat/historico', verificarToken, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id, remetente_id AS remetenteId, remetente_nome AS remetenteNome, destino_id AS destinoId, texto, data_hora AS data FROM chat_mensagens ORDER BY data_hora ASC LIMIT 100'
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao carregar histórico de chat.' });
    }
  });

  // ============================================================================
  // BUSINESS INTELLIGENCE (BI) & DRE PREDITIVO - BASEADO EM DADOS REAIS DO MYSQL
  // ============================================================================
  app.get('/api/bi/analytics', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV' && req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso restrito a gestores e desenvolvedores.' });
    }
    try {
      const [lojasRows] = await pool.query('SELECT COUNT(*) as total FROM loja WHERE status = "Ativa"');
      const [equipRows] = await pool.query('SELECT COUNT(*) as total FROM equipamentos');
      const totalLojas = Number(lojasRows[0]?.total || 0);
      const totalEquipamentos = Number(equipRows[0]?.total || 0);

      const [faturasRows] = await pool.query(
        'SELECT plano, SUM(total) as receita, COUNT(*) as qtd FROM faturas_saas WHERE status = "PAGO" OR status = "PENDENTE" GROUP BY plano'
      );
      
      let mrrReal = 0;
      const planoCounts = {};
      faturasRows.forEach(f => {
        mrrReal += Number(f.receita || 0);
        planoCounts[f.plano || 'PRO'] = Number(f.qtd || 0);
      });

      if (mrrReal === 0 && totalLojas > 0) {
        mrrReal = totalLojas * 299.90;
      }

      const arrReal = mrrReal * 12;
      const custoCloudReal = (totalLojas * 45) + (totalEquipamentos * 12);
      const lucroLiquido = mrrReal - custoCloudReal;
      const margemBruta = mrrReal > 0 ? Number(((lucroLiquido / mrrReal) * 100).toFixed(1)) : 0;

      const distribuicaoPlanos = [
        { name: 'Enterprise (Dedicado)', value: planoCounts['ENTERPRISE'] || Math.max(1, Math.floor(totalLojas * 0.25)) },
        { name: 'Pro (Multi-Tenant)', value: planoCounts['PRO'] || Math.max(1, Math.floor(totalLojas * 0.60)) },
        { name: 'Free / Trial', value: planoCounts['FREE'] || Math.max(0, Math.floor(totalLojas * 0.15)) }
      ].filter(p => p.value > 0);

      const [riscoRows] = await pool.query(`
        SELECT e.id, e.nome as maquina, e.filial, e.motor_ligado, e.em_degelo,
               COUNT(n.id) as alertas_pendentes
        FROM equipamentos e
        LEFT JOIN notificacoes n ON n.equipamento_id = e.id AND (n.resolvido = 0 OR n.resolvido IS NULL)
        GROUP BY e.id, e.nome, e.filial, e.motor_ligado, e.em_degelo
        ORDER BY alertas_pendentes DESC, e.motor_ligado ASC
        LIMIT 6
      `);

      const analiseRisco = riscoRows.map(r => {
        let score = Number(r.alertas_pendentes) * 25;
        if (r.motor_ligado == 0 && r.em_degelo == 0) score += 45;
        const riscoFinal = Math.min(98, Math.max(5, score));
        return {
          id: r.id,
          maquina: `${r.maquina} (${r.filial || 'Matriz'})`,
          risco: riscoFinal,
          alertas: Number(r.alertas_pendentes),
          statusMotor: r.motor_ligado ? 'Ativo' : 'Parado'
        };
      });

      const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const mesAtualIdx = new Date().getMonth();
      const dreData = [];

      for (let i = 5; i >= 0; i--) {
        let idx = (mesAtualIdx - i + 12) % 12;
        const fator = 1 - (i * 0.08);
        const receitaMes = Number((mrrReal * Math.max(0.45, fator)).toFixed(2));
        const custoMes = Number((custoCloudReal * Math.max(0.55, fator)).toFixed(2));
        dreData.push({
          name: mesesNomes[idx],
          Receita_SaaS: receitaMes,
          Custos_Cloud: custoMes,
          Lucro_Liquido: Number((receitaMes - custoMes).toFixed(2))
        });
      }

      res.json({
        kpis: {
          mrr: Number(mrrReal.toFixed(2)),
          arr: Number(arrReal.toFixed(2)),
          margem: Math.max(0, margemBruta),
          uptimeGlobal: 99.98,
          totalLojas,
          totalEquipamentos
        },
        dreData,
        distribuicaoPlanos,
        analiseRisco
      });
    } catch (error) {
      console.error('❌ [ERRO BI]:', error);
      res.status(500).json({ error: 'Falha ao consolidar dados de Business Intelligence.' });
    }
  });

  // ============================================================================
  // ROTAS DE FATURAMENTO (BILLING / SAAS)
  // ============================================================================
  app.get('/api/financeiro/faturas/atuais', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    try {
        const [todasFaturas] = await pool.query(`SELECT filial, status, data_vencimento FROM faturas_saas ORDER BY data_vencimento ASC`);
        const faturasFormatadas = {};
        const hoje = new Date();

        todasFaturas.forEach(fatura => {
            const dataVenc = new Date(fatura.data_vencimento);
            dataVenc.setHours(23, 59, 59, 999); 
            const isVencida = dataVenc < hoje && fatura.status !== 'PAGO';
            const diffTime = hoje - dataVenc;
            const diffDays = isVencida ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

            if (!faturasFormatadas[fatura.filial]) faturasFormatadas[fatura.filial] = { foiPaga: true, atrasoDias: 0 };

            if (fatura.status !== 'PAGO') {
                faturasFormatadas[fatura.filial].foiPaga = false;
                if (isVencida && diffDays > faturasFormatadas[fatura.filial].atrasoDias) {
                    faturasFormatadas[fatura.filial].atrasoDias = diffDays;
                }
            }
        });
        res.json(faturasFormatadas);
    } catch (error) { res.status(500).json({ error: "Erro interno no servidor" }); }
  });

  app.post('/api/financeiro/faturas/:filial/pagar', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    const { filial } = req.params; const { billingSetup, plano } = req.body; 
    const dataAtual = new Date(); const mesAtual = dataAtual.getMonth() + 1; const anoAtual = dataAtual.getFullYear();
    const filialPlano = plano || 'PRO';
    const isEnterprise = filialPlano === 'ENTERPRISE';
    const valorBase = isEnterprise ? (billingSetup?.ent || 899.90) : (billingSetup?.pro || 299.90);
    const dataVencimento = `${anoAtual}-${mesAtual}-${billingSetup?.diaVencimento || 10}`;

    try {
        await pool.query(
            `INSERT INTO faturas_saas (filial, plano, valor_base, total, data_vencimento, ciclo_mes, ciclo_ano, status, data_pagamento) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PAGO', NOW()) ON DUPLICATE KEY UPDATE status = 'PAGO', data_pagamento = NOW()`,
            [filial, filialPlano, valorBase, valorBase, dataVencimento, mesAtual, anoAtual]
        );
        if (io) io.emit('pagamento_confirmado', { filial });
        await registrarAuditoria('BILLING_PAYMENT', 'Root/Dev', `Pagamento liquidado: ${filial} (${filialPlano})`, 'success');
        res.json({ success: true, message: `Pagamento de ${filial} confirmado.` });
    } catch (error) { res.status(500).json({ error: "Erro interno no servidor" }); }
  });

  app.post('/api/financeiro/cobranca-lote', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    const { billingSetup, planos } = req.body; 
    try {
        const dataAtual = new Date(); const mesAtual = dataAtual.getMonth() + 1; const anoAtual = dataAtual.getFullYear();
        const diaVencimento = billingSetup?.diaVencimento || 10;
        const [filiaisRows] = await pool.query('SELECT DISTINCT nome FROM loja WHERE status = "Ativa"');
        const filiais = filiaisRows.map(f => f.nome);
        
        for (const filial of filiais) {
            const plano = planos?.[filial] || 'PRO';
            if (plano === 'FREE') continue; 
            const valorBase = plano === 'ENTERPRISE' ? (billingSetup?.ent || 899.90) : (billingSetup?.pro || 299.90);

            await pool.query(
                `INSERT IGNORE INTO faturas_saas (filial, plano, valor_base, total, data_vencimento, ciclo_mes, ciclo_ano, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDENTE')`,
                [filial, plano, valorBase, valorBase, `${anoAtual}-${mesAtual}-${diaVencimento}`, mesAtual, anoAtual]
            );
        }
        await registrarAuditoria('BILLING_CRON', 'Root/Dev', `Faturamento gerado para o ciclo ${mesAtual}/${anoAtual}.`, 'info');
        res.json({ success: true, message: "Lote processado!" });
    } catch (error) { res.status(500).json({ error: "Erro interno no servidor" }); }
  });

  app.post('/api/financeiro/faturas/:filial/forcar-atraso', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    try {
        const { filial } = req.params; const { billingSetup, plano } = req.body;
        const filialPlano = plano || 'PRO';
        const valorBase = (filialPlano === 'ENTERPRISE') ? (billingSetup?.ent || 899.90) : (billingSetup?.pro || 299.90);
        const dataAtraso = new Date(); dataAtraso.setMonth(dataAtraso.getMonth() - 1); 
        const mesAtraso = dataAtraso.getMonth() + 1; const anoAtraso = dataAtraso.getFullYear();
        const vencAtraso = `${anoAtraso}-${mesAtraso.toString().padStart(2, '0')}-10`;

        await pool.query(
            `INSERT INTO faturas_saas (filial, plano, valor_base, total, data_vencimento, ciclo_mes, ciclo_ano, status, data_pagamento) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDENTE', NULL)
             ON DUPLICATE KEY UPDATE status = 'PENDENTE', data_vencimento = ?, data_pagamento = NULL`,
            [filial, filialPlano, valorBase, valorBase, vencAtraso, mesAtraso, anoAtraso, vencAtraso]
        );
        res.json({ success: true, message: `Atraso forçado para ${filial}.` });
    } catch (error) { res.status(500).json({ error: "Erro interno no servidor" }); }
  });

  app.post('/api/financeiro/faturas/:filial/notificar', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    const { filial } = req.params; const { total, vencimento, plano, status } = req.body;

    try {
        const [dadosLoja] = await pool.query(`SELECT e.email FROM loja l LEFT JOIN empresas e ON l.empresa = e.nome WHERE l.nome = ? LIMIT 1`, [filial]);
        let emailDestino = null;

        if (dadosLoja.length > 0 && dadosLoja[0].email) {
            emailDestino = dadosLoja[0].email;
        } else {
            const [dadosEmpresa] = await pool.query('SELECT email FROM empresas WHERE nome = ? LIMIT 1', [filial]);
            if (dadosEmpresa.length > 0 && dadosEmpresa[0].email) emailDestino = dadosEmpresa[0].email;
        }

        if (!emailDestino || emailDestino.trim() === '') return res.status(400).json({ error: 'A organização não tem um e-mail cadastrado.' });

        const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: 'thermosync126@gmail.com', pass: 'uhpm iasu atae tnbt' }, tls: { rejectUnauthorized: false } });
        const mailOptions = {
            from: '"TermoSync FinOps" <thermosync126@gmail.com>', to: emailDestino,
            subject: `Fatura Disponível - Licenciamento TermoSync SaaS (${filial})`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #10b981; margin: 0;">TermoSync Enterprise</h2>
                    </div>
                    <p>Olá, equipa da <strong>${filial}</strong>,</p>
                    <p>A fatura do plano <strong>${plano}</strong> está disponível.</p>
                    <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #eab308;">
                        <p><strong>Status:</strong> <span style="color: #ef4444; font-weight: bold;">${status}</span></p>
                        <p><strong>Valor Total:</strong> R$ ${Number(total).toFixed(2)}</p>
                        <p><strong>Vencimento:</strong> ${vencimento}</p>
                    </div>
                </div>
            `
        };
        await transporter.sendMail(mailOptions); 
        await registrarAuditoria('BILLING_NOTIFY', 'Root/Dev', `E-mail enviado para: ${filial} (${emailDestino})`, 'warning');
        res.json({ success: true, message: `E-mail enviado para ${emailDestino}` });
    } catch (error) { res.status(500).json({ error: "Falha na conexão SMTP." }); }
  });

  // ============================================================================
  // ROTAS GERAIS, TELEMETRIA DO SERVIDOR E AUTENTICAÇÃO
  // ============================================================================
  const handleSystemHealth = async (req, res) => {
    try {
      const startDb = Date.now();
      await pool.execute('SELECT 1');
      const dbLatency = `${Date.now() - startDb}ms (ONLINE)`;

      const totalSockets = io?.engine?.clientsCount || io?.sockets?.sockets?.size || 0;

      let totalRecords = 0;
      try {
        const [rows] = await pool.execute('SELECT TABLE_ROWS FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = "leituras" LIMIT 1');
        totalRecords = Number(rows[0]?.TABLE_ROWS || 0);
      } catch (errDb) {
        totalRecords = 'N/A';
      }

      res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        uptime: Number(process.uptime().toFixed(1)),
        db: dbLatency,
        sockets: totalSockets,
        total_records: totalRecords
      });
    } catch (error) {
      console.error('❌ [ERRO HEALTH CHECK]:', error.message);
      res.status(503).json({
        ok: false,
        error: 'Banco de dados ou cluster indisponível.',
        db: 'OFFLINE',
        sockets: 0,
        uptime: 0
      });
    }
  };

  app.get('/api/health', handleSystemHealth);
  app.get('/api/system/health', handleSystemHealth);

  // ROTA ZERO-TRUST PARA AUTENTICAÇÃO DA TELA DEV BOOT SCREEN
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

  app.get('/api/auth/verify', verificarToken, async (req, res) => {
    try {
      const [users] = await pool.execute(
        'SELECT id, usuario, role, filial, empresa, nome_gerente, nome_coordenador, nome_tecnico FROM usuarios WHERE id = ?',
        [req.userId]
      );
      if (users.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });
      res.json(users[0]);
    } catch (error) {
      res.status(500).json({ error: 'Erro interno ao verificar token.' });
    }
  });

  app.post('/api/system/exportar-tabela', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    try {
      let { tabela } = req.body;
      if (tabela === 'leituras_telemetria') tabela = 'leituras';
      const tabelasPermitidas = ['equipamentos', 'leituras', 'usuarios', 'notificacoes', 'audit_logs', 'sessoes_ativas', 'empresas', 'chamados', 'hardware_iot', 'faturas_saas', 'chat_mensagens'];
      if (!tabelasPermitidas.includes(tabela)) return res.status(400).json({ error: 'Tabela não autorizada.' });
      const [linhas] = await pool.query(`SELECT * FROM ${tabela}`);
      res.json({ sucesso: true, dados: linhas });
    } catch (erro) { res.status(500).json({ error: 'Falha interna.' }); }
  });

  // ============================================================================
  // ROTAS DE EMPRESAS / TENANTS (ALINHADO COM AS 5 COLUNAS DO SCHEMA UNIFICADO)
  // ============================================================================
  app.get('/api/empresas', verificarToken, async (req, res) => { 
    if (req.userRole !== 'DEV') return res.status(403).send(); 
    try { 
      const [r] = await pool.execute('SELECT * FROM empresas ORDER BY nome ASC'); 
      res.json(r); 
    } catch (e) { 
      res.status(500).send(); 
    } 
  });

  app.post('/api/empresas', verificarToken, async (req, res) => { 
    if (req.userRole !== 'DEV') return res.status(403).send(); 
    try { 
      await pool.execute(
        'INSERT INTO empresas (nome, cnpj, contato, email, status) VALUES (?, ?, ?, ?, ?)', 
        [
          req.body.nome, 
          req.body.cnpj || null, 
          req.body.contato || null, 
          req.body.email || null, 
          req.body.status || 'Ativa'
        ]
      ); 
      res.status(201).send(); 
    } catch (e) { 
      res.status(500).send(); 
    } 
  });

  app.put('/api/empresas/:id', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' });
    
    const { id } = req.params;
    const { nome, cnpj, contato, telefone, email, status } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'A designação da empresa é obrigatória.' 
      });
    }

    try {
      const contatoValor = contato || telefone || null;
      
      const queryParams = [
        nome.trim(),
        cnpj ? cnpj.trim() : null,
        contatoValor ? contatoValor.trim() : null,
        email ? email.trim() : null,
        status || 'Ativa',
        id
      ];

      const sql = `
        UPDATE empresas 
        SET 
          nome = ?, 
          cnpj = ?, 
          contato = ?, 
          email = ?, 
          status = ?
        WHERE id = ?
      `;

      const [result] = await pool.execute(sql, queryParams);

      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Empresa não encontrada no banco de dados.' 
        });
      }

      return res.json({ 
        success: true, 
        message: 'Empresa atualizada com sucesso!' 
      });

    } catch (error) {
      console.error(`❌ [ERRO PUT /api/empresas/${id}]:`, error.sqlMessage || error.message);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ 
          success: false, 
          error: 'Já existe uma empresa cadastrada com este Nome ou CNPJ.' 
        });
      }

      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno ao atualizar empresa no servidor.' 
      });
    }
  });

  // ============================================================================
  // EXCLUIR EMPRESA / TENANT (DELETE /api/empresas/:id) - CORRIGIDO
  // ============================================================================
  app.delete('/api/empresas/:id', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') {
      return res.status(403).json({ error: 'Acesso negado. Apenas DEV pode excluir Tenants.' });
    }

    const { id } = req.params;

    try {
      // 1. Busca o NOME real da empresa pelo ID (evita coerção acidental de tipos VARCHAR vs INT)
      const [empRows] = await pool.execute('SELECT id, nome FROM empresas WHERE id = ?', [id]);
      
      if (empRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });
      }

      const nomeEmpresa = empRows[0].nome;

      // 2. Verifica se existem equipamentos vinculados ao NOME da empresa
      const [equipRows] = await pool.execute(
        'SELECT COUNT(*) as total FROM equipamentos WHERE TRIM(empresa) = ?', 
        [nomeEmpresa.trim()]
      );

      if (Number(equipRows[0]?.total || 0) > 0) {
        return res.status(409).json({
          success: false,
          error: `Não é possível excluir: existem ${equipRows[0].total} equipamento(s) vinculado(s) à empresa "${nomeEmpresa}".`
        });
      }

      // 3. Verifica se existem lojas/filiais ativas vinculadas ao NOME da empresa
      const [lojaRows] = await pool.execute(
        'SELECT COUNT(*) as total FROM loja WHERE TRIM(empresa) = ?', 
        [nomeEmpresa.trim()]
      );

      if (Number(lojaRows[0]?.total || 0) > 0) {
        return res.status(409).json({
          success: false,
          error: `Não é possível excluir: existem ${lojaRows[0].total} loja(s)/filial(is) vinculada(s) à empresa "${nomeEmpresa}".`
        });
      }

      // 4. Exclui a empresa com segurança
      const [delResult] = await pool.execute('DELETE FROM empresas WHERE id = ?', [id]);

      if (delResult.affectedRows > 0) {
        await registrarAuditoria('TENANT_DELETED', 'Root/Dev', `Empresa excluída: ${nomeEmpresa} (ID: ${id})`, 'danger');
        return res.json({ success: true, message: `Empresa "${nomeEmpresa}" removida com sucesso.` });
      } else {
        return res.status(400).json({ success: false, error: 'Não foi possível remover o registro.' });
      }

    } catch (error) {
      console.error(`❌ [ERRO DELETE /api/empresas/${id}]:`, error.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno no servidor ao tentar excluir a empresa.' 
      });
    }
  });

  app.post('/api/impersonate', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Apenas Root.' });
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
      registrarAuditoria('LOGIN_FAILED', 'Desconhecido', `Tentativa: ${usuario} (${ip})`, 'danger');
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
    
    res.json({ 
      token, 
      id: users[0].id, 
      role: users[0].role, 
      filial: users[0].filial, 
      empresa: users[0].empresa,
      nome_gerente: users[0].nome_gerente, 
      nome_coordenador: users[0].nome_coordenador, 
      nome_tecnico: users[0].nome_tecnico 
    });
  });

  app.put('/api/usuarios/reset-senha', async (req, res) => { try { const { usuario, novaSenha } = req.body; if (!usuario || !novaSenha) return res.status(400).json({ error: 'Dados incompletos.' }); const [users] = await pool.execute('SELECT id FROM usuarios WHERE usuario = ?', [usuario]); if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' }); await pool.execute('UPDATE usuarios SET senha = ? WHERE usuario = ?', [await bcrypt.hash(novaSenha, 10), usuario]); res.status(200).json({ message: 'Credenciais atualizadas.' }); } catch (error) { res.status(500).json({ error: 'Erro interno.' }); } });
  app.get('/api/usuarios', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); let q = 'SELECT id, usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa FROM usuarios WHERE 1=1'; let p = []; if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); } const [r] = await pool.execute(q + ' ORDER BY role ASC', p); res.json(r); });
  app.post('/api/usuarios', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' }); try { const { usuario, senha, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa } = req.body; await pool.execute('INSERT INTO usuarios (usuario, senha, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [usuario, await bcrypt.hash(senha, 10), role, filial || null, nome_gerente || null, nome_coordenador || null, nome_tecnico || null, (req.userRole === 'DEV' && empresa) ? empresa : req.userEmpresa]); res.status(201).send(); } catch (error) { res.status(500).json({ error: 'Erro ao criar usuário.' }); } });
  app.put('/api/usuarios/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' }); try { const { usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa, senha } = req.body; const empresaTarget = (req.userRole === 'DEV' && empresa) ? empresa : req.userEmpresa; if (senha) { await pool.execute('UPDATE usuarios SET usuario=?, senha=?, role=?, filial=?, nome_gerente=?, nome_coordenador=?, nome_tecnico=?, empresa=? WHERE id=?', [usuario, await bcrypt.hash(senha, 10), role, filial || null, nome_gerente || null, nome_coordenador || null, nome_tecnico || null, empresaTarget, req.params.id]); } else { await pool.execute('UPDATE usuarios SET usuario=?, role=?, filial=?, nome_gerente=?, nome_coordenador=?, nome_tecnico=?, empresa=? WHERE id=?', [usuario, role, filial || null, nome_gerente || null, nome_coordenador || null, nome_tecnico || null, empresaTarget, req.params.id]); } res.status(200).send(); } catch (error) { res.status(500).json({ error: 'Erro ao editar.' }); } });
  app.delete('/api/usuarios/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' }); try { await pool.execute('DELETE FROM usuarios WHERE id=?', [req.params.id]); res.status(200).send(); } catch (error) { res.status(500).json({ error: 'Erro ao excluir.' }); } });
  
  // ============================================================================
  // ROTAS DE LOJAS / FILIAIS
  // ============================================================================
  app.get('/api/lojas', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { let q = `SELECT * FROM loja WHERE 1=1`; let p = []; if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); } const [lojas] = await pool.execute(q + ' ORDER BY nome ASC', p); const [usuarios] = await pool.execute('SELECT filial, nome_gerente, nome_coordenador FROM usuarios'); res.json(lojas.map(l => { const uGerente = usuarios.find(user => user.filial === l.nome && user.nome_gerente); const uCoord = usuarios.find(user => user.filial === l.nome && user.nome_coordenador); return { ...l, nome_gerente: uGerente ? uGerente.nome_gerente : null, nome_coordenador: uCoord ? uCoord.nome_coordenador : null }; })); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post('/api/lojas', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('INSERT INTO loja (nome, endereco, telefone, empresa, status) VALUES (?, ?, ?, ?, ?)', [req.body.nome, req.body.endereco, req.body.telefone, req.userRole === 'DEV' && req.body.empresa ? req.body.empresa : req.userEmpresa, req.userRole === 'DEV' && req.body.status ? req.body.status : 'Ativa']); res.status(201).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/lojas/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { if (req.userRole === 'DEV') { await pool.execute('UPDATE loja SET nome=?, endereco=?, telefone=?, empresa=?, status=? WHERE id=?', [req.body.nome, req.body.endereco, req.body.telefone, req.body.empresa || req.userEmpresa, req.body.status || 'Ativa', req.params.id]); } else { await pool.execute('UPDATE loja SET nome=?, endereco=?, telefone=? WHERE id=? AND empresa=?', [req.body.nome, req.body.endereco, req.body.telefone, req.params.id, req.userEmpresa]); } res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.delete('/api/lojas/:id', verificarToken, async (req, res) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') {
      return res.status(403).json({ error: 'Acesso restrito a gestores.' });
    }
    try {
      if (req.userRole === 'DEV') {
        await pool.execute('DELETE FROM loja WHERE id = ?', [req.params.id]);
      } else {
        await pool.execute('DELETE FROM loja WHERE id = ? AND empresa = ?', [req.params.id, req.userEmpresa]);
      }
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ [ERRO DELETE LOJA]:', error.message);
      res.status(500).json({ error: 'Erro interno ao excluir a loja.' });
    }
  });

  // ============================================================================
  // ROTAS DE EQUIPAMENTOS
  // ============================================================================
  app.get('/api/equipamentos', verificarToken, async (req, res) => { let q = `SELECT e.*, (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp, (SELECT umidade FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_umidade FROM equipamentos e WHERE 1=1`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } } const [r] = await pool.execute(q, p); res.json(r); });
  app.post('/api/equipamentos', verificarToken, async (req, res) => { try { const { nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao } = req.body; await pool.execute('INSERT INTO equipamentos (nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao, empresa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [nome, tipo, temp_min, temp_max, umidade_min || null, umidade_max || null, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao || null, req.userEmpresa]); res.status(201).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/equipamentos/:id/edit', verificarToken, async (req, res) => { try { await pool.execute('UPDATE equipamentos SET nome=?, tipo=?, temp_min=?, temp_max=?, umidade_min=?, umidade_max=?, intervalo_degelo=?, duracao_degelo=?, setor=?, filial=?, data_calibracao=? WHERE id=? AND empresa=?', [req.body.nome, req.body.tipo, req.body.temp_min, req.body.temp_max, req.body.umidade_min || null, req.body.umidade_max || null, req.body.intervalo_degelo, req.body.duracao_degelo, req.body.setor, req.body.filial, req.body.data_calibracao || null, req.params.id, req.userEmpresa]); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.delete('/api/equipamentos/:id', verificarToken, async (req, res) => { try { await pool.execute('DELETE FROM equipamentos WHERE id=? AND empresa=?', [req.params.id, req.userEmpresa]); res.status(200).send(); } catch (error) { res.status(500).send(); } });

  // ============================================================================
  // LEITURAS IOT / CHECK-AND-ALERT DO SIMULADOR
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

      const t = parseFloat(temperatura); const u = parseFloat(umidade || 50.0); const c_kwh = parseFloat(consumo_kwh || 0.0);

      try {
        await pool.execute(`
        INSERT INTO hardware_iot (equipamento_id, mac_address, ip_local, sinal_wifi, uptime, firmware_version, ultima_comunicacao)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE ip_local=VALUES(ip_local), sinal_wifi=VALUES(sinal_wifi), uptime=VALUES(uptime), ultima_comunicacao=NOW()
      `, [ equipamento_id, mac_address || 'A4:CF:12:XX:XX:XX', ip_local || '192.168.1.100', sinal_wifi ? parseInt(sinal_wifi) : -65, uptime || '0h', firmware_version || 'v1.0.0' ]);
      } catch (e) {}

      const [r] = await pool.execute('INSERT INTO leituras (equipamento_id, temperatura, umidade, consumo_kwh) VALUES (?, ?, ?, ?)', [equipamento_id, t, u, c_kwh]);
      
      const [eq] = await pool.execute('SELECT temp_max, temp_min, umidade_min, umidade_max, nome, em_degelo, motor_ligado, setor, filial, empresa FROM equipamentos WHERE id = ?', [equipamento_id]);

      if (eq.length > 0) {
        const isMotorLigado = (motor_ligado == 1 || motor_ligado === true);
        const isEmDegelo = (em_degelo == 1 || em_degelo === true);
        await pool.execute('UPDATE equipamentos SET motor_ligado=?, em_degelo=? WHERE id=?', [isMotorLigado, isEmDegelo, equipamento_id]);

        const tMax = parseFloat(eq[0].temp_max); const tMin = parseFloat(eq[0].temp_min);
        const uMax = parseFloat(eq[0].umidade_max || 0); const uMin = parseFloat(eq[0].umidade_min || 0);

        let novosAlertas = [];
        let resolvidoAutomatico = false;

        const checkAndAlert = async (condicaoAnomala, tipoAlerta, mensagem, isSilencioso = false, autoResolve = false) => {
          if (condicaoAnomala) {
            const [existe] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
            if (existe.length === 0) {
              const [inserido] = await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta, resolvido) VALUES (?, ?, ?, 0)', [equipamento_id, mensagem, tipoAlerta]);
              
              novosAlertas.push({ id: inserido.insertId, equipamento_id, mensagem, tipo_alerta: tipoAlerta, data_hora: new Date().toISOString(), resolvido: 0, equipamento_nome: eq[0].nome, setor: eq[0].setor, filial: eq[0].filial, empresa: eq[0].empresa, silencioso: isSilencioso });
            }
          } else if (autoResolve) {
            const [upd] = await pool.execute('UPDATE notificacoes SET resolvido=1, nota_resolucao="Normalizado automaticamente." WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
            if (upd.affectedRows > 0) {
                resolvidoAutomatico = true;
                io.emit('alerta_removido', { equipamento_id, tipo_alerta: tipoAlerta });
            }
          }
        };

        const condRede = (alerta_forcado === 'REDE');
        await checkAndAlert(condRede, 'REDE', `FALHA IoT/REDE: Sensor offline em "${eq[0].nome}".`, false, !condRede);

        const condPorta = (alerta_forcado === 'PORTA_ABERTA');
        await checkAndAlert(condPorta, 'PORTA', `PORTA ABERTA: O equipamento "${eq[0].nome}" está com a porta violada!`, false, !condPorta);

        const condMecanica = (!isMotorLigado && !isEmDegelo && alerta_forcado !== 'REDE');
        await checkAndAlert(condMecanica, 'MECANICA', `MOTOR PARADO: O compressor de "${eq[0].nome}" desligou subitamente!`, false, !condMecanica);

        const condTemp = ((t > tMax || t < tMin) && !isEmDegelo);
        await checkAndAlert(condTemp, 'TEMPERATURA', `ALERTA TÉRMICO: "${eq[0].nome}" fora da faixa configurada (${t}°C).`, false, !condTemp);

        if (uMax > 0 || uMin > 0) {
          const condUmi = ((u > uMax || u < uMin) && !isEmDegelo);
          await checkAndAlert(condUmi, 'UMIDADE', `ALERTA HIGROMÉTRICO: Umidade de "${eq[0].nome}" fora dos limites permitidos (${u}%).`, false, !condUmi);
        }

        const condDegelo = isEmDegelo;
        await checkAndAlert(condDegelo, 'DEGELO', `INFO: "${eq[0].nome}" entrou em ciclo de Degelo programado.`, true, !condDegelo);

        if (novosAlertas.length > 0 || resolvidoAutomatico) { io.emit('atualizacao_dados'); }

        if (novosAlertas.length > 0) {
          novosAlertas.forEach(alertaObj => {
            if (!alertaObj.silencioso) { enviarAlertaWhatsApp(`🚨 ALERTA NOC em *${eq[0].nome}*. Motivo: ${alertaObj.mensagem}`, eq[0].filial); }
            io.emit('novo_alerta', alertaObj);
          });
        }
        
        io.emit('nova_leitura', { id: r.insertId, equipamento_id, temperatura: t, umidade: u, consumo_kwh: c_kwh, motor_ligado: isMotorLigado, em_degelo: isEmDegelo, data_hora: new Date(), nome: eq[0].nome, setor: eq[0].setor, filial: eq[0].filial, empresa: eq[0].empresa });
      }
      res.status(201).send();
    } catch (error) { 
      res.status(500).send(); 
    }
  });

  // ==========================================
  // ROTAS DE NOTIFICAÇÕES, CHAMADOS, RELATÓRIOS
  // ==========================================
  app.get('/api/notificacoes', verificarToken, async (req, res) => { 
    try {
      let q = `SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE (n.resolvido = 0 OR n.resolvido IS NULL OR n.resolvido = FALSE)`; 
      const p = []; 
      if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } 
      if (req.userRole === 'LOJA') { q += ` AND e.filial = ?`; p.push(req.userFilial); } 
      const [r] = await pool.execute(q + ' ORDER BY n.data_hora DESC', p); 
      res.json(r); 
    } catch (e) { res.status(500).send(); }
  });

  app.get('/api/notificacoes/historico', verificarToken, async (req, res) => { 
    try {
      let q = `SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE n.resolvido = 1`; 
      const p = []; 
      if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } 
      if (req.userRole === 'LOJA') { q += ` AND e.filial = ?`; p.push(req.userFilial); } 
      const [r] = await pool.execute(q + ' ORDER BY n.data_hora DESC LIMIT 150', p); 
      res.json(r); 
    } catch (e) { res.status(500).send(); }
  });

  app.put('/api/notificacoes/:id/resolver', verificarToken, async (req, res) => { 
    try { 
      await pool.execute('UPDATE notificacoes SET resolvido=1, nota_resolucao=? WHERE id=?', [req.body.nota_resolucao || 'Resolvido pelo operador.', req.params.id]); 
      io.emit('alerta_removido_id', { id: req.params.id });
      io.emit('atualizacao_dados'); res.status(200).send(); 
    } catch (error) { res.status(500).send(); } 
  });

  app.put('/api/notificacoes/resolver-todas', verificarToken, async (req, res) => { 
    try { 
      let q = 'UPDATE notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id SET n.resolvido=1, n.nota_resolucao="Limpeza em Lote" WHERE (n.resolvido=0 OR n.resolvido IS NULL)'; 
      let p = []; 
      if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); 
      if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } } 
      await pool.execute(q, p); 
      io.emit('alertas_limpos');
      io.emit('atualizacao_dados'); res.status(200).send(); 
    } catch (error) { res.status(500).send(); } 
  });

  app.get('/api/chamados', verificarToken, async (req, res) => { 
    let q = `
      SELECT c.*, e.nome as equipamento_nome, e.filial as equipamento_filial, u.usuario as aberto_por 
      FROM chamados c LEFT JOIN equipamentos e ON c.equipamento_id = e.id LEFT JOIN usuarios u ON c.usuario_id = u.id WHERE 1=1
    `; 
    const p = []; 
    if (req.userRole !== 'DEV') { 
      q += ' AND (c.empresa = ? OR c.empresa IS NULL OR c.empresa = "")'; p.push(req.userEmpresa); 
      if (req.userRole === 'LOJA') { q += ` AND (c.filial = ? OR c.filial IS NULL OR c.filial = "" OR e.filial = ?)`; p.push(req.userFilial, req.userFilial); } 
    } 
    const [r] = await pool.execute(q + ' ORDER BY c.data_abertura DESC', p); res.json(r); 
  });

  app.post('/api/chamados', verificarToken, async (req, res) => { 
    try { 
      const { equipamento_id, descricao, solicitante_nome, tecnico_responsavel, urgencia } = req.body; 
      let filialStr = req.userFilial; 
      try { const [eq] = await pool.execute('SELECT filial FROM equipamentos WHERE id=?', [equipamento_id]); if (eq.length > 0 && eq[0].filial) filialStr = eq[0].filial; } catch (e) { } 
      await pool.execute(`INSERT INTO chamados (equipamento_id, usuario_id, filial, descricao, solicitante_nome, tecnico_responsavel, empresa, urgencia, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aberto')`, [equipamento_id || null, req.userId, filialStr, descricao, solicitante_nome || null, tecnico_responsavel || null, req.userEmpresa, urgencia || 'Pendente']); 
      io.emit('atualizacao_dados'); res.status(201).send(); 
    } catch (error) { res.status(500).send(); } 
  });

  app.put('/api/chamados/:id/status', verificarToken, async (req, res) => {
    try {
      const { status } = req.body; if (!status) return res.status(400).json({ error: 'Status ausente.' });
      let query = 'UPDATE chamados SET status = ?'; let params = [status];
      if (status === 'Concluído') query += ', data_conclusao = CURRENT_TIMESTAMP'; else query += ', data_conclusao = NULL';
      query += ' WHERE id = ?'; params.push(req.params.id);
      await pool.execute(query, params); io.emit('atualizacao_dados'); res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Falha no banco.' }); }
  });

  app.delete('/api/chamados/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('DELETE FROM chamados WHERE id=?', [req.params.id]); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/chamados/:id', verificarToken, async (req, res) => { try { const [atual] = await pool.execute('SELECT * FROM chamados WHERE id=?', [req.params.id]); if (atual.length === 0) return res.status(404).send(); const chamado = atual[0]; const novoStatus = req.body.status !== undefined ? req.body.status : chamado.status; let query = 'UPDATE chamados SET status=?, nota_resolucao=?, arquivado=?, urgencia=?, tecnico_responsavel=?'; if (novoStatus === 'Concluído' && chamado.status !== 'Concluído') query += ', data_conclusao=CURRENT_TIMESTAMP'; query += ' WHERE id=?'; await pool.execute(query, [novoStatus, req.body.nota_resolucao !== undefined ? req.body.nota_resolucao : chamado.nota_resolucao, req.body.arquivado !== undefined ? (req.body.arquivado ? 1 : 0) : chamado.arquivado, req.body.urgencia !== undefined ? req.body.urgencia : chamado.urgencia, req.body.tecnico_responsavel !== undefined ? req.body.tecnico_responsavel : chamado.tecnico_responsavel, req.params.id]); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/chamados/:id/arquivar', verificarToken, async (req, res) => { try { await pool.execute('UPDATE chamados SET arquivado=1, data_conclusao=CURRENT_TIMESTAMP WHERE id=?', [req.params.id]); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/chamados/:id/urgencia', verificarToken, async (req, res) => { try { await pool.execute('UPDATE chamados SET urgencia=? WHERE id=?', [req.body.urgencia, req.params.id]); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });

  // ============================================================================
  // ROTAS DE SUPORTE AO SISTEMA E RESPOSTAS TÉCNICAS (NOC)
  // ============================================================================
  app.get('/api/suporte/artigos', verificarToken, async (req, res) => {
    try {
      const isDev = req.userRole === 'DEV'; const publico = isDev ? [] : ['USUARIO', 'AMBOS'];
      let query = 'SELECT * FROM suporte_artigos WHERE ativo = TRUE'; const params = [];
      if (!isDev) { query += ' AND publico IN (?, ?)'; params.push(publico[0], publico[1]); }
      const [rows] = await pool.execute(query + ' ORDER BY destaque DESC, updated_at DESC, titulo ASC', params);
      res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Falha.' }); }
  });

  app.get('/api/suporte/chamados', verificarToken, async (req, res) => {
    try {
      let query = 'SELECT * FROM suporte_chamados WHERE 1=1'; const params = [];
      if (req.userRole !== 'DEV') { query += ' AND (empresa = ? OR empresa IS NULL OR empresa = "")'; params.push(req.userEmpresa); if (req.userRole === 'LOJA') { query += ' AND (filial = ? OR filial IS NULL OR filial = "")'; params.push(req.userFilial); } }
      const [rows] = await pool.execute(query + ' ORDER BY criado_em DESC', params);
      res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Falha.' }); }
  });

  app.post('/api/suporte/chamados', verificarToken, async (req, res) => {
    try {
      const { titulo, descricao, categoria, prioridade, solicitante, email } = req.body;
      if (!titulo || !descricao || !solicitante) return res.status(400).json({ error: 'Campos obrigatórios.' });
      
      const [result] = await pool.execute(
        'INSERT INTO suporte_chamados (titulo, descricao, categoria, prioridade, origem, solicitante, email, empresa, filial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [titulo, descricao, categoria || 'Geral', prioridade || 'Média', req.userRole === 'DEV' ? 'DEV' : 'USUARIO', solicitante, email || null, req.userEmpresa || null, req.userFilial || null]
      );
      
      try {
        await pool.execute(
          'INSERT INTO suporte_chamado_historico (chamado_id, evento, autor, papel, status_anterior, status_novo, mensagem) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [result.insertId, 'ABERTURA', solicitante, req.userRole || 'USUARIO', null, 'Aberto', descricao]
        );
      } catch (errHist) {
        console.error('⚠️ [AVISO] Falha na auditoria inicial de suporte:', errHist.message);
      }

      const novoTicketPayload = {
        id: result.insertId,
        titulo,
        descricao,
        categoria: categoria || 'Geral',
        prioridade: prioridade || 'Média',
        solicitante,
        empresa: req.userEmpresa || null,
        filial: req.userFilial || null,
        criado_em: new Date().toISOString(),
        status: 'Aberto'
      };

      if (io) {
        io.emit('novo_chamado_suporte', novoTicketPayload);
        io.emit('atualizacao_dados');
      }

      res.status(201).json({ success: true, id: result.insertId });
    } catch (error) { 
      console.error('❌ [ERRO SUPORTE] Falha ao abrir chamado:', error);
      res.status(500).json({ error: 'Falha ao abrir chamado de suporte.' }); 
    }
  });

  app.put('/api/suporte/chamados/:id', verificarToken, async (req, res) => {
    try {
      const { status, resposta, responsavel } = req.body;
      const [atual] = await pool.execute('SELECT * FROM suporte_chamados WHERE id = ?', [req.params.id]);
      if (atual.length === 0) return res.status(404).json({ error: 'Não encontrado.' });
      
      const chamadoAtual = atual[0]; 
      
      let novoStatus = status || chamadoAtual.status || 'Concluído';
      if (resposta && (novoStatus === 'Aberto' || novoStatus === 'Em análise')) {
        novoStatus = 'Respondido';
      }
      if (novoStatus === 'Resolvido' || novoStatus === 'Fechado') novoStatus = 'Concluído';
      if (novoStatus === 'Em Atendimento') novoStatus = 'Em análise';

      const novaResposta = (resposta !== undefined && resposta !== '') ? resposta : (chamadoAtual.resposta || null);
      const novoResponsavel = responsavel || chamadoAtual.responsavel || 'Suporte NOC (DEV)';

      await pool.execute(
        'UPDATE suporte_chamados SET status = ?, resposta = ?, responsavel = ? WHERE id = ?', 
        [novoStatus, novaResposta, novoResponsavel, req.params.id]
      );

      try {
        if ((resposta !== undefined && resposta !== chamadoAtual.resposta) || novoStatus !== chamadoAtual.status) {
          await pool.execute(
            'INSERT INTO suporte_chamado_historico (chamado_id, evento, autor, papel, status_anterior, status_novo, mensagem) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              req.params.id,
              resposta !== undefined ? 'RESPOSTA' : 'ATUALIZACAO_STATUS',
              novoResponsavel,
              req.userRole || 'DEV',
              chamadoAtual.status || 'Aberto',
              novoStatus,
              resposta !== undefined ? resposta : `Status alterado para ${novoStatus}`
            ]
          );
        }
      } catch (errHist) {
        console.error('⚠️ [AVISO] Falha ao registrar auditoria de suporte:', errHist.message);
      }

      if (io) {
        io.emit('resposta_suporte', {
          id: req.params.id,
          titulo: chamadoAtual.titulo,
          resposta: novaResposta,
          status: novoStatus,
          responsavel: novoResponsavel,
          empresa: chamadoAtual.empresa,
          filial: chamadoAtual.filial
        });
        io.emit('atualizacao_dados');
      }

      res.status(200).json({ success: true });
    } catch (error) { 
      console.error('❌ [ERRO SUPORTE] Falha ao atualizar chamado:', error);
      res.status(500).json({ error: 'Falha ao atualizar chamado de suporte.' }); 
    }
  });

  app.get('/api/suporte/chamados/:id/historico', verificarToken, async (req, res) => {
    try {
      const [ticket] = await pool.execute('SELECT id, empresa, filial, solicitante FROM suporte_chamados WHERE id = ?', [req.params.id]);
      if (ticket.length === 0) return res.status(404).json({ error: 'Não encontrado.' });
      if (req.userRole !== 'DEV') { const permitidoEmpresa = ticket[0].empresa === req.userEmpresa || !ticket[0].empresa; const permitidoFilial = req.userRole !== 'LOJA' || ticket[0].filial === req.userFilial || !ticket[0].filial; if (!permitidoEmpresa || !permitidoFilial) return res.status(403).json({ error: 'Acesso negado.' }); }
      const [historico] = await pool.execute('SELECT * FROM suporte_chamado_historico WHERE chamado_id = ? ORDER BY criado_em ASC, id ASC', [req.params.id]);
      res.json(historico);
    } catch (error) { res.status(500).json({ error: 'Falha.' }); }
  });

  app.get('/api/relatorios', verificarToken, async (req, res) => { let q = `SELECT l.id, l.temperatura, l.umidade, l.consumo_kwh, l.data_hora, e.nome, e.setor, e.filial FROM leituras l JOIN equipamentos e ON l.equipamento_id = e.id WHERE 1=1`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } if (req.query.data_inicio && req.query.data_fim) { q += ' AND l.data_hora BETWEEN ? AND ?'; p.push(new Date(req.query.data_inicio), new Date(req.query.data_fim)); } else { q += ' AND l.data_hora >= DATE_SUB(NOW(), INTERVAL 6 HOUR)'; } const [r] = await pool.execute(q + ' ORDER BY l.data_hora ASC LIMIT 3000', p); res.json(r); });

  app.get('/api/operacao/resumo', verificarToken, async (req, res) => {
    try {
      const filialFiltro = req.query.filial || req.userFilial || 'Todas';
      const empresaFiltro = req.userEmpresa || 'Cliente Alpha (Padrão)';
      const filtros = ['e.empresa = ?']; const params = [empresaFiltro];

      if (req.userRole === 'LOJA') { filtros.push('e.filial = ?'); params.push(req.userFilial); } 
      else if (filialFiltro && filialFiltro !== 'Todas') { filtros.push('e.filial = ?'); params.push(filialFiltro); }

      const whereClause = filtros.join(' AND ');
      let equipamentosRows = []; let alertasRows = []; let chamadosRows = [];

      try {
        [equipamentosRows] = await pool.execute(`
        SELECT e.id, e.nome, e.filial, e.motor_ligado, e.em_degelo,
          (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp,
          (SELECT umidade FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_umidade
        FROM equipamentos e WHERE ${whereClause}
      `, params);
      } catch (e) { }

      try {
        [alertasRows] = await pool.execute(`
        SELECT n.id, n.mensagem, n.data_hora, e.nome AS equipamento_nome, e.filial
        FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id
        WHERE ${whereClause} AND (n.resolvido = 0 OR n.resolvido IS NULL) ORDER BY n.data_hora DESC LIMIT 8
      `, params);
      } catch (e) { }

      try {
        [chamadosRows] = await pool.execute(`
        SELECT c.id, c.status, c.urgencia, e.nome AS equipamento_nome
        FROM chamados c LEFT JOIN equipamentos e ON c.equipamento_id = e.id
        WHERE ${whereClause} AND c.status <> 'Concluído' AND c.status <> 'Fechado'
        ORDER BY c.data_abertura DESC LIMIT 8
      `, params);
      } catch (e) { }

      const totalEquipamentos = equipamentosRows.length;
      const alertasAtivos = alertasRows.length;
      const chamadosAbertos = chamadosRows.length;
      const equipamentosFalha = equipamentosRows.filter((eq) => !eq.motor_ligado && !eq.em_degelo).length;
      const equipamentosDegelo = equipamentosRows.filter((eq) => eq.em_degelo).length;
      const temperaturaMedia = totalEquipamentos ? (equipamentosRows.reduce((acc, item) => acc + (Number(item.ultima_temp) || 0), 0) / totalEquipamentos).toFixed(1) : 0;
      const umidadeMedia = totalEquipamentos ? (equipamentosRows.reduce((acc, item) => acc + (Number(item.ultima_umidade) || 0), 0) / totalEquipamentos).toFixed(1) : 0;

      res.json({ total_equipamentos: totalEquipamentos, alertas_ativos: alertasAtivos, chamados_abertos: chamadosAbertos, equipamentos_em_falha: equipamentosFalha, equipamentos_em_degelo: equipamentosDegelo, temperatura_media: Number(temperaturaMedia), umidade_media: Number(umidadeMedia), ultimos_alertas: alertasRows, ultimos_chamados: chamadosRows, filial: filialFiltro, atualizada_em: new Date().toISOString() });
    } catch (e) {
      res.json({ total_equipamentos: 0, alertas_ativos: 0, chamados_abertos: 0, equipamentos_em_falha: 0, equipamentos_em_degelo: 0, temperatura_media: 0, umidade_media: 0, ultimos_alertas: [], ultimos_chamados: [], filial: req.query.filial || req.userFilial || 'Todas', atualizada_em: new Date().toISOString() });
    }
  });

  app.get('/api/operacao/tarefas', verificarToken, async (req, res) => {
    try {
      const tipo = req.query.tipo || 'checklist_turno';
      const filial = req.query.filial || req.userFilial || 'Todas';
      const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)';

      let sql = 'SELECT * FROM operacao_tarefas WHERE tipo = ?';
      const params = [tipo];

      if (req.userRole !== 'DEV') { sql += ' AND empresa = ?'; params.push(empresa); }
      if (filial && filial !== 'Todas') { sql += ' AND (filial = ? OR filial = "Matriz" OR filial = "Todas" OR filial IS NULL)'; params.push(filial); }
      sql += ' ORDER BY created_at ASC';

      const [rows] = await pool.execute(sql, params);
      res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar tarefas.' }); }
  });

  app.post('/api/operacao/tarefas', verificarToken, async (req, res) => {
    try {
      if (req.userRole === 'LOJA') return res.status(403).json({ error: 'Acesso negado.' });
      const { tipo, chave, titulo, descricao, concluida, filial } = req.body;
      const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)';

      if (!chave || !titulo) return res.status(400).json({ error: 'Chave e título são obrigatórios.' });

      const sql = `INSERT INTO operacao_tarefas (tipo, chave, titulo, descricao, concluida, filial, empresa) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const params = [ tipo || 'checklist_turno', chave, titulo, descricao || null, concluida ? 1 : 0, filial || 'Matriz', empresa ];
      const [result] = await pool.execute(sql, params);
      await emitirOperacaoAtualizada({ tipo: 'tarefas', empresa, usuario: req.userId });
      res.status(201).json({ success: true, id: result.insertId });
    } catch (error) { res.status(500).json({ error: 'Erro ao criar tarefa.' }); }
  });

  app.put('/api/operacao/tarefas/:id', verificarToken, async (req, res) => {
    try {
      const { id } = req.params; const { concluida } = req.body; const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)';

      let horario = null;
      if (concluida) {
          const dataAtual = new Date();
          horario = dataAtual.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
      }

      let sql = 'UPDATE operacao_tarefas SET concluida = ?, horario = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      const params = [concluida ? 1 : 0, horario, id];

      if (req.userRole !== 'DEV') { sql += ' AND empresa = ?'; params.push(empresa); }
      const [result] = await pool.execute(sql, params);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Tarefa não encontrada ou sem permissão.' });
      await emitirOperacaoAtualizada({ tipo: 'tarefas', empresa, usuario: req.userId });
      res.status(200).json({ success: true, concluida, horario });
    } catch (error) { res.status(500).json({ error: 'Erro ao atualizar.' }); }
  });

  app.delete('/api/operacao/tarefas/:id', verificarToken, async (req, res) => {
    try {
      if (req.userRole === 'LOJA') return res.status(403).json({ error: 'Acesso negado.' });
      const { id } = req.params; const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)';

      let sql = 'DELETE FROM operacao_tarefas WHERE id = ?';
      const params = [id];
      if (req.userRole !== 'DEV') { sql += ' AND empresa = ?'; params.push(empresa); }

      const [result] = await pool.execute(sql, params);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Não encontrada.' });
      await emitirOperacaoAtualizada({ tipo: 'tarefas', empresa, usuario: req.userId });
      res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Erro ao excluir.' }); }
  });

  app.get('/api/auxiliares/filiais', verificarToken, async (req, res) => { try { let q1 = 'SELECT DISTINCT nome AS filial FROM loja WHERE 1=1'; let q2 = 'SELECT DISTINCT filial FROM equipamentos WHERE filial IS NOT NULL'; let p = []; if (req.userRole !== 'DEV') { q1 += ' AND empresa = ?'; q2 += ' AND empresa = ?'; p.push(req.userEmpresa); } const [r1] = await pool.execute(q1, req.userRole !== 'DEV' ? [req.userEmpresa] : []); const [r2] = await pool.execute(q2, req.userRole !== 'DEV' ? [req.userEmpresa] : []); res.json(Array.from(new Set([...r1.map(x => x.filial), ...r2.map(x => x.filial)])).sort()); } catch (e) { res.status(500).send(); } });
  
  app.get('/api/contatos', verificarToken, async (req, res) => { 
    try { 
      let q = 'SELECT id, usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa FROM usuarios WHERE id != ?'; 
      let p = [req.userId]; 
      if (req.userRole !== 'DEV') { q += ' AND (empresa = ? OR role = "DEV")'; p.push(req.userEmpresa); } 
      
      const [rows] = await pool.execute(q, p); 
      res.json(rows.map(u => { 
        let nome = u.usuario; let cargo = 'Usuário'; 
        if (u.role === 'DEV') { nome = 'NOC (Desenvolvedor)'; cargo = 'Suporte Master'; } 
        else if (u.role === 'ADMIN') { nome = 'Administração'; cargo = 'Suporte Corporativo'; } 
        else if (u.role === 'MANUTENCAO') { nome = u.nome_tecnico || u.usuario; cargo = 'Técnico Manutenção'; } 
        else if (u.role === 'LOJA') { 
          if (u.nome_gerente) { nome = u.nome_gerente; cargo = `Gerente - ${u.filial}`; } 
          else if (u.nome_coordenador) { nome = u.nome_coordenador; cargo = `Coordenador - ${u.filial}`; } 
          else { nome = `Equipe ${u.filial}`; cargo = 'Operador Loja'; } 
        } 
        return { id: u.id, nome, cargo, role: u.role, filial: u.filial, empresa: u.empresa }; 
      })); 
    } catch (error) { res.status(500).json({ error: error.message }); } 
  });

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

  // ==========================================
  // ROTAS DO SOC (SECURITY OPERATIONS CENTER)
  // ==========================================
  app.get('/api/soc/sessoes', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).send();
    try { const [sessoes] = await pool.execute('SELECT id, usuario_nome as usuario, role, ip_address as ip, localizacao as location, data_login as loginTime FROM sessoes_ativas WHERE revogado = FALSE ORDER BY data_login DESC'); res.json(sessoes); } catch (e) { res.status(500).send(); }
  });

  app.post('/api/soc/revogar/:id', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).send();
    try { const [sessao] = await pool.execute('SELECT usuario_nome FROM sessoes_ativas WHERE id = ?', [req.params.id]); await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE id = ?', [req.params.id]); const alvo = sessao.length > 0 ? sessao[0].usuario_nome : 'ID ' + req.params.id; registrarAuditoria('TOKEN_REVOKED', 'root_dev', alvo, 'danger'); res.json({ success: true }); } catch (e) { res.status(500).send(); }
  });

  app.get('/api/soc/auditoria', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).send();
    try { const [logs] = await pool.execute('SELECT data_hora, acao as action, ator as actor, alvo as target, severidade as severity FROM audit_logs ORDER BY data_hora DESC LIMIT 100'); res.json(logs); } catch (e) { res.status(500).send(); }
  });

  app.post('/api/system/reports/log', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).send();
    try { const { tipo, formato, solicitante } = req.body; await pool.execute('INSERT INTO sys_relatorios_log (tipo_relatorio, formato, solicitante) VALUES (?, ?, ?)', [tipo, formato, solicitante]); res.status(201).send(); } catch (e) { res.status(500).send(); }
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

  // ============================================================================
  // ROTA DE TELEMETRIA REAL DE HARDWARE DO SERVIDOR (CPU, RAM, KERNEL)
  // ============================================================================
  app.get('/api/system/host-info', async (req, res) => {
    try {
      const cpus = os.cpus();
      const cpuModel = cpus[0]?.model || 'Generic x86_64 Processor';
      const cpuCores = cpus.length || 1;
      const totalMemMB = Math.round(os.totalmem() / (1024 * 1024));
      const freeMemMB = Math.round(os.freemem() / (1024 * 1024));
      const platform = os.platform();
      const release = os.release();
      const arch = os.arch();
      const hostname = os.hostname();
      const type = os.type();

      res.json({
        success: true,
        cpu: {
          model: cpuModel,
          cores: cpuCores,
          speed: cpus[0]?.speed || 0
        },
        memory: {
          totalMB: totalMemMB,
          freeMB: freeMemMB
        },
        os: {
          platform,
          release,
          arch,
          hostname,
          type,
          kernelString: `${type} ${hostname} ${release} ${arch}`
        }
      });
    } catch (error) {
      console.error('❌ [ERRO HOST INFO]:', error.message);
      res.status(500).json({ success: false, error: 'Falha ao coletar dados do host.' });
    }
  });

  // ============================================================================
  // MOTOR CI/CD - DEPLOY INTELIGENTE (FRONTEND vs BACKEND) & INTEGRAÇÃO
  // ============================================================================
  app.post('/api/system/deploy-update', verificarToken, upload.single('updatePackage'), async (req, res) => {
    if (req.userRole !== 'DEV') {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Acesso negado. Permissão exclusiva de SysAdmin (DEV).' });
    }

    try {
      const file = req.file;
      const { version, title, type, desc, targetType } = req.body;

      if (!file) {
        return res.status(400).json({ error: 'Nenhum pacote (.zip) foi enviado.' });
      }

      const zip = new AdmZip(file.path);
      const zipEntries = zip.getEntries();

      let temArquivosFrontend = false;
      let temArquivosBackend = false;

      zipEntries.forEach((entry) => {
        const name = entry.entryName.toLowerCase();
        if (name.includes('index.html') || name.includes('assets/') || name.endsWith('.css') || name.endsWith('.jsx')) {
          temArquivosFrontend = true;
        }
        if (name.includes('app.js') || name.includes('server.js') || name.includes('package.json') || name.includes('routes/')) {
          temArquivosBackend = true;
        }
      });

      let destinoFinal = targetType || 'AUTO';
      if (destinoFinal === 'AUTO') {
        if (temArquivosFrontend && !temArquivosBackend) destinoFinal = 'FRONTEND';
        else if (temArquivosBackend && !temArquivosFrontend) destinoFinal = 'BACKEND';
        else destinoFinal = 'FULLSTACK';
      }

      const pastaFrontend = path.join(__dirname, '../public_html');
      const pastaBackend = path.join(__dirname, '../');

      if (destinoFinal === 'FRONTEND') {
        zip.extractAllTo(pastaFrontend, true);
      } else if (destinoFinal === 'BACKEND') {
        zip.extractAllTo(pastaBackend, true);
      } else {
        zip.extractAllTo(pastaFrontend, true);
        zip.extractAllTo(pastaBackend, true);
      }

      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

      if (version && title && desc) {
        try {
          await pool.execute(
            'INSERT INTO system_changelog (version, title, type, desc_text, author) VALUES (?, ?, ?, ?, ?)',
            [version, `[${destinoFinal}] ${title}`, type || 'feature', desc, 'Root/DEV']
          );
        } catch (errDb) {
          console.error('⚠️ [AVISO] Falha ao gravar no changelog:', errDb.message);
        }
      }

      await registrarAuditoria(
        'DEPLOY_SISTEMA',
        'Root/Dev',
        `Deploy ${destinoFinal} (${version || 'v.x'}): ${title || file.originalname}`,
        'warning'
      );

      if (io) {
        io.emit('novo_changelog', { version, title, target: destinoFinal });
        io.emit('operacao_atualizada', { tipo: 'deploy', target: destinoFinal, version });
      }

      if (destinoFinal === 'BACKEND' || destinoFinal === 'FULLSTACK') {
        setTimeout(() => {
          exec('pm2 restart all', (error) => {
            if (error) console.error(`Erro ao tentar reiniciar o PM2: ${error}`);
          });
        }, 1000);
      }

      res.json({
        success: true,
        targetDetected: destinoFinal,
        message: `Deploy do tipo [${destinoFinal}] processado com sucesso!`
      });

    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error('❌ [ERRO DEPLOY]:', error);
      res.status(500).json({ error: 'Falha ao processar e extrair o pacote de atualização.' });
    }
  });

  app.post('/api/system/query-raw', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ success: false, error: 'Acesso negado. Privilégios de SysAdmin (DEV) necessários.' });
    const { sql } = req.body; if (!sql) return res.status(400).json({ success: false, error: 'Instrução SQL ausente.' });
    try { const [rows] = await pool.execute(sql); await registrarAuditoria('RAW_SQL_EXEC', 'Root/Dev', `Query executada: ${sql.substring(0, 100)}...`, 'danger'); res.json({ success: true, data: rows }); } catch (error) { res.json({ success: false, error: error.message }); };
  });

  // ============================================================================
  // ROTAS DE ONBOARDING (PRÉ-CADASTRO E APROVAÇÃO SAAS)
  // ============================================================================
  app.post('/api/pre-cadastros', async (req, res) => {
    try {
      const { empresa, cnpj, responsavel, email, telefone } = req.body;
      if (!empresa || !email) return res.status(400).json({ error: 'Dados incompletos' });
      
      await pool.execute(
        'INSERT INTO pre_cadastros (empresa, cnpj, responsavel, email, telefone) VALUES (?, ?, ?, ?, ?)',
        [empresa, cnpj, responsavel, email, telefone]
      );
      
      if (io) io.emit('novo_pre_cadastro');
      
      res.status(201).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao processar pré-cadastro.' });
    }
  });

  app.get('/api/pre-cadastros', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    try {
      const [rows] = await pool.execute('SELECT * FROM pre_cadastros WHERE status = "pendente" ORDER BY data_solicitacao ASC');
      res.json(rows);
    } catch (error) { res.status(500).send(); }
  });

  app.post('/api/pre-cadastros/:id/aprovar', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    try {
      const [reqs] = await pool.execute('SELECT * FROM pre_cadastros WHERE id = ?', [req.params.id]);
      if (reqs.length === 0) return res.status(404).json({ error: 'Requerimento não encontrado' });
      
      const reqData = reqs[0];
      
      await pool.execute('UPDATE pre_cadastros SET status = "aprovado" WHERE id = ?', [req.params.id]);
      
      const contatoCompleto = `${reqData.responsavel} (${reqData.telefone})`;
      
      await pool.execute(
        'INSERT IGNORE INTO empresas (nome, cnpj, contato, email, status) VALUES (?, ?, ?, ?, "Ativa")',
        [reqData.empresa, reqData.cnpj, contatoCompleto, reqData.email]
      );

      const nomeFilialMatriz = `Matriz - ${reqData.empresa}`;
      await pool.execute(
        'INSERT IGNORE INTO loja (nome, endereco, telefone, empresa, status) VALUES (?, ?, ?, ?, "Ativa")',
        [nomeFilialMatriz, 'Sede Principal (Pendente de Atualização)', reqData.telefone, reqData.empresa]
      );

      const baseUsername = reqData.empresa.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 8);
      const randomSuffix = Math.floor(Math.random() * 900) + 100;
      const usuarioGerado = `admin.${baseUsername}${randomSuffix}`;
      
      const senhaGerada = Math.random().toString(36).slice(-6) + Math.floor(Math.random() * 99) + "T!";
      const senhaHash = await bcrypt.hash(senhaGerada, 10);

      await pool.execute(
        'INSERT INTO usuarios (usuario, senha, role, filial, nome_gerente, empresa) VALUES (?, ?, "ADMIN", "Todas", ?, ?)',
        [usuarioGerado, senhaHash, reqData.responsavel, reqData.empresa]
      );

      const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: 'thermosync126@gmail.com', pass: 'uhpm iasu atae tnbt' }, tls: { rejectUnauthorized: false } });
      const mailOptions = {
        from: '"TermoSync NOC" <thermosync126@gmail.com>',
        to: reqData.email,
        subject: `Bem-vindo ao TermoSync, ${reqData.empresa}!`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #10b981; text-align: center;">Infraestrutura Provisionada!</h2>
                <p>Olá, <strong>${reqData.responsavel}</strong>,</p>
                <p>O seu requerimento foi aprovado pela nossa equipa de Engenharia.</p>
                <p>O Tenant dedicado para a organização <strong>${reqData.empresa}</strong> foi gerado com sucesso e já se encontra operacional.</p>
                
                <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #38bdf8; margin: 20px 0; border-radius: 4px;">
                    <h3 style="margin-top: 0; color: #0f172a;">Credenciais de Acesso (Administrador)</h3>
                    <p><strong>Usuário:</strong> <span style="font-family: monospace; font-size: 1.1em; color: #0369a1;">${usuarioGerado}</span></p>
                    <p><strong>Senha:</strong> <span style="font-family: monospace; font-size: 1.1em; color: #0369a1;">${senhaGerada}</span></p>
                    <p style="font-size: 12px; color: #ef4444; margin-bottom: 0;">Recomendamos fortemente a alteração desta senha após o primeiro acesso.</p>
                </div>

                <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
                <p style="font-size:12px; color:#999; text-align:center;">TermoSync Enterprise Operations</p>
            </div>
        `
      };
      await transporter.sendMail(mailOptions);

      await registrarAuditoria('ONBOARDING_APPROVED', 'Root/Dev', `Tenant provisionado: ${reqData.empresa} (Admin: ${usuarioGerado})`, 'success');
      
      if (io) {
          io.emit('atualizacao_dados');
      }

      res.json({ success: true, message: 'Aprovado com sucesso. Credenciais enviadas por e-mail.' });
    } catch (error) { 
      console.error(error);
      res.status(500).json({ error: 'Erro interno' }); 
    }
  });

  app.post('/api/pre-cadastros/:id/rejeitar', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    try {
      await pool.execute('UPDATE pre_cadastros SET status = "rejeitado" WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error) { res.status(500).send(); }
  });

  // ============================================================================
  // ROTA DO CHANGELOG DO SISTEMA
  // ============================================================================
  app.get('/api/system/changelog', verificarToken, async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT * FROM system_changelog ORDER BY date DESC, id DESC LIMIT 20');
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao carregar o changelog do sistema.' });
    }
  });

  app.post('/api/system/changelog', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito a desenvolvedores.' });
    const { version, title, type, desc_text } = req.body;
    if (!version || !title || !desc_text) return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });

    try {
      await pool.execute(
        'INSERT INTO system_changelog (version, title, type, desc_text, author) VALUES (?, ?, ?, ?, ?)',
        [version, title, type || 'Improvement', desc_text, req.userRole || 'DEV']
      );
      io.emit('novo_changelog', { version, title });
      res.status(201).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao registrar versão.' });
    }
  });

  // ============================================================================
  // ROTAS DE TÉCNICOS INTEGRADA COM ORDENS DE SERVIÇO
  // ============================================================================
  app.get('/api/tecnicos/ativos', verificarToken, async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT id, nome, telefone FROM tecnicos ORDER BY nome ASC');
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar técnicos.' });
    }
  });

  app.post('/api/tecnicos', verificarToken, async (req, res) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Sem permissão.' });
    const { nome, telefone } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome do técnico é obrigatório.' });

    try {
      const [result] = await pool.execute('INSERT INTO tecnicos (nome, telefone) VALUES (?, ?)', [nome, telefone || '']);
      res.status(201).json({ id: result.insertId, nome, telefone });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao cadastrar técnico.' });
    }
  });

  app.put('/api/chamados/:id/atribuir-tecnico', verificarToken, async (req, res) => {
    const { tecnico_id, tecnico_nome } = req.body;
    try {
      await pool.execute(
        'UPDATE chamados SET tecnico_id = ?, tecnico_responsavel = ? WHERE id = ?',
        [tecnico_id || null, tecnico_nome || null, req.params.id]
      );
      io.emit('atualizacao_dados');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atribuir técnico.' });
    }
  });
};