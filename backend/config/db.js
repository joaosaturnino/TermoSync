const mysql = require('mysql2/promise');

const pool = mysql.createPool({ 
  host: process.env.DB_HOST || 'localhost', 
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '2409', 
  database: process.env.DB_NAME || 'termosync',
  waitForConnections: true,
  connectionLimit: 20
});

/**
 * Concentra a logica de verificar banco para manter o restante do modulo mais legivel.
 */
async function verificarBanco() {
  // Bootstrap idempotente do banco. O sistema pode subir sobre bases antigas;
  // por isso cada ALTER/CREATE é tolerante a objetos já existentes.
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sys_relatorios_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        data_geracao DATETIME DEFAULT CURRENT_TIMESTAMP,
        tipo_relatorio VARCHAR(100),
        formato VARCHAR(10),
        solicitante VARCHAR(100)
      )
    `);
    console.log('✅ Tabela de Auditoria de Relatórios (BI) operacional!');
  } catch (e) {
    console.log('⚠️ Aviso ao criar tabela de relatórios:', e.message);
  }
  try {
    await pool.execute('SELECT 1');
    console.log('✅ Conexão com o Banco de Dados "termosync" verificada.');
    
    try {
      await pool.execute(`
        ALTER TABLE tipos_refrigeracao 
        ADD COLUMN temp_min DECIMAL(5,2), ADD COLUMN temp_max DECIMAL(5,2), 
        ADD COLUMN umidade_min DECIMAL(5,2), ADD COLUMN umidade_max DECIMAL(5,2), 
        ADD COLUMN intervalo_degelo INT DEFAULT 6, ADD COLUMN duracao_degelo INT DEFAULT 30
      `);
    } catch (e) {
      if (!String(e.message).includes('Duplicate column')) {
        console.log('⚠️ Aviso ao ajustar tipos_refrigeracao:', e.message);
      }
    }

    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS hardware_iot (
          equipamento_id INT PRIMARY KEY,
          mac_address VARCHAR(20) DEFAULT '00:00:00:00:00:00',
          ip_local VARCHAR(15) DEFAULT '0.0.0.0',
          sinal_wifi INT DEFAULT -100,
          uptime VARCHAR(50) DEFAULT '0h',
          firmware_version VARCHAR(20) DEFAULT 'v1.0.0',
          ultima_comunicacao DATETIME
        )
      `);
      console.log('✅ Tabela de Frota "hardware_iot" operacional!');
    } catch (e) { console.log('⚠️ Aviso ao criar hardware_iot:', e.message); }

    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
          acao VARCHAR(100),
          ator VARCHAR(100),
          alvo VARCHAR(255),
          severidade VARCHAR(20) DEFAULT 'info'
        )
      `);
      
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS sessoes_ativas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT,
          usuario_nome VARCHAR(100),
          role VARCHAR(50),
          token VARCHAR(500),
          ip_address VARCHAR(50),
          localizacao VARCHAR(100) DEFAULT 'Desconhecida',
          data_login DATETIME DEFAULT CURRENT_TIMESTAMP,
          revogado BOOLEAN DEFAULT FALSE,
          INDEX idx_token (token(255))
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS security_events (
          id INT AUTO_INCREMENT PRIMARY KEY,
          event_type VARCHAR(100) NOT NULL,
          actor VARCHAR(120) DEFAULT NULL,
          ip_address VARCHAR(80) DEFAULT NULL,
          user_agent VARCHAR(500) DEFAULT NULL,
          severity VARCHAR(20) DEFAULT 'info',
          detail TEXT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_security_events_type (event_type, created_at),
          INDEX idx_security_events_ip (ip_address, created_at)
        )
      `);

      const sessionColumns = [
        ['user_agent', 'VARCHAR(500) DEFAULT NULL'],
        ['expires_at', 'DATETIME DEFAULT NULL'],
        ['last_seen', 'DATETIME DEFAULT NULL']
      ];

      for (const [column, definition] of sessionColumns) {
        try {
          await pool.execute(`ALTER TABLE sessoes_ativas ADD COLUMN ${column} ${definition}`);
        } catch (alterErr) {
          if (!String(alterErr.message).includes('Duplicate column')) {
            console.log(`⚠️ Aviso ao ajustar sessoes_ativas.${column}:`, alterErr.message);
          }
        }
      }

      try {
        const ttlHours = Number(process.env.JWT_EXPIRES_HOURS || 12);
        await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
        await pool.execute('UPDATE sessoes_ativas SET expires_at = DATE_ADD(data_login, INTERVAL ? HOUR) WHERE expires_at IS NULL AND data_login IS NOT NULL', [ttlHours]);
        await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE revogado = FALSE AND expires_at IS NOT NULL AND expires_at < NOW()');
        await pool.execute('UPDATE sessoes_ativas s LEFT JOIN usuarios u ON u.id = s.usuario_id SET s.revogado = TRUE WHERE u.id IS NULL');
        await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
      } catch (sessionCleanupErr) {
        try { await pool.execute('SET FOREIGN_KEY_CHECKS = 1'); } catch (fkErr) { console.log('⚠️ Aviso ao reativar FKs após limpeza de sessões:', fkErr.message); }
        console.log('⚠️ Aviso ao reconciliar sessões antigas:', sessionCleanupErr.message);
      }

      let foreignKeyChecksDisabled = false;
      try {
        await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
        foreignKeyChecksDisabled = true;
        await pool.execute('ALTER TABLE usuarios DROP FOREIGN KEY fk_usr_empresa');
      } catch (fkErr) {
        if (!String(fkErr.message).includes("check that column/key exists")) {
          console.log('⚠️ Aviso ao remover FK usuarios.empresa:', fkErr.message);
        }
      }

      try {
        await pool.execute('ALTER TABLE usuarios DROP FOREIGN KEY fk_usr_filial');
      } catch (fkErr) {
        if (!String(fkErr.message).includes("check that column/key exists")) {
          console.log('⚠️ Aviso ao remover FK usuarios.filial:', fkErr.message);
        }
      }

      try {
        await pool.execute('ALTER TABLE usuarios MODIFY empresa VARCHAR(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL');
        await pool.execute('ALTER TABLE usuarios MODIFY filial VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL');
      } catch (collationErr) {
        console.log('⚠️ Aviso ao alinhar collation de usuarios:', collationErr.message);
      }

      if (foreignKeyChecksDisabled) {
        try {
          await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
        } catch (fkErr) {
          console.log('⚠️ Aviso ao reativar checagem de FKs:', fkErr.message);
        }
      }

      try {
        await pool.execute(`
          INSERT INTO empresas (nome, status)
          SELECT DISTINCT u.empresa, 'Ativa'
          FROM usuarios u
          LEFT JOIN empresas e ON e.nome = u.empresa
          WHERE u.empresa IS NOT NULL AND u.empresa <> '' AND e.nome IS NULL
        `);
      } catch (seedErr) {
        console.log('⚠️ Aviso ao reconciliar empresas de usuários:', seedErr.message);
      }

      try {
        await pool.execute('ALTER TABLE usuarios ADD CONSTRAINT fk_usr_empresa FOREIGN KEY (empresa) REFERENCES empresas(nome) ON DELETE SET NULL ON UPDATE CASCADE');
      } catch (fkErr) {
        if (!String(fkErr.message).includes('Duplicate key name')) {
          console.log('⚠️ Aviso ao recriar FK usuarios.empresa:', fkErr.message);
        }
      }

      try {
        await pool.execute('ALTER TABLE usuarios ADD CONSTRAINT fk_usr_filial FOREIGN KEY (filial) REFERENCES loja(nome) ON DELETE SET NULL ON UPDATE CASCADE');
      } catch (fkErr) {
        if (!String(fkErr.message).includes('Duplicate key name')) {
          console.log('⚠️ Aviso ao recriar FK usuarios.filial:', fkErr.message);
        }
      }

      const userSecurityColumns = [
        ['email', 'VARCHAR(150) DEFAULT NULL'],
        ['telefone', 'VARCHAR(50) DEFAULT NULL'],
        ['mfa_secret', 'VARCHAR(80) DEFAULT NULL'],
        ['mfa_enabled', 'BOOLEAN DEFAULT FALSE'],
        ['mfa_required', 'BOOLEAN DEFAULT FALSE'],
        ['password_changed_at', 'DATETIME DEFAULT NULL'],
        ['password_reset_code_hash', 'VARCHAR(255) DEFAULT NULL'],
        ['password_reset_expires_at', 'DATETIME DEFAULT NULL'],
        ['password_reset_attempts', 'INT DEFAULT 0'],
        ['password_reset_requested_at', 'DATETIME DEFAULT NULL']
      ];

      for (const [column, definition] of userSecurityColumns) {
        try {
          await pool.execute(`ALTER TABLE usuarios ADD COLUMN ${column} ${definition}`);
        } catch (alterErr) {
          if (!String(alterErr.message).includes('Duplicate column')) {
            console.log(`⚠️ Aviso ao ajustar usuarios.${column}:`, alterErr.message);
          }
        }
      }

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS iot_api_keys (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(120) NOT NULL,
          token_hash VARCHAR(128) NOT NULL,
          ativo BOOLEAN DEFAULT TRUE,
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
          ultimo_uso DATETIME DEFAULT NULL,
          INDEX idx_iot_token_hash (token_hash),
          INDEX idx_iot_ativo (ativo)
        )
      `);

      const auditColumns = [
        ['event_hash', 'VARCHAR(128) DEFAULT NULL'],
        ['previous_hash', 'VARCHAR(128) DEFAULT NULL']
      ];

      for (const [column, definition] of auditColumns) {
        try {
          await pool.execute(`ALTER TABLE audit_logs ADD COLUMN ${column} ${definition}`);
        } catch (alterErr) {
          if (!String(alterErr.message).includes('Duplicate column')) {
            console.log(`⚠️ Aviso ao ajustar audit_logs.${column}:`, alterErr.message);
          }
        }
      }

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS operacao_tarefas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tipo VARCHAR(30) NOT NULL,
          chave VARCHAR(100),
          titulo VARCHAR(255) NOT NULL,
          descricao TEXT,
          horario VARCHAR(20),
          concluida BOOLEAN DEFAULT FALSE,
          ordem INT DEFAULT 0,
          filial VARCHAR(100),
          empresa VARCHAR(100),
          usuario_id INT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_operacao_tarefas (tipo, empresa, filial, usuario_id)
        )
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS suporte_artigos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          titulo VARCHAR(180) NOT NULL,
          conteudo TEXT NOT NULL,
          categoria VARCHAR(80) DEFAULT 'Geral',
          publico ENUM('USUARIO', 'DEV', 'AMBOS') DEFAULT 'USUARIO',
          destaque BOOLEAN DEFAULT FALSE,
          ativo BOOLEAN DEFAULT TRUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_suporte_artigos_publico (publico, ativo)
        )
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS suporte_chamados (
          id INT AUTO_INCREMENT PRIMARY KEY,
          titulo VARCHAR(180) NOT NULL,
          descricao TEXT NOT NULL,
          categoria VARCHAR(80) DEFAULT 'Geral',
          prioridade ENUM('Baixa', 'Média', 'Alta', 'Crítica') DEFAULT 'Média',
          status ENUM('Aberto', 'Em análise', 'Respondido', 'Concluído') DEFAULT 'Aberto',
          origem ENUM('USUARIO', 'DEV') DEFAULT 'USUARIO',
          solicitante VARCHAR(120) NOT NULL,
          email VARCHAR(120) DEFAULT NULL,
          empresa VARCHAR(120) DEFAULT NULL,
          filial VARCHAR(120) DEFAULT NULL,
          resposta TEXT DEFAULT NULL,
          responsavel VARCHAR(120) DEFAULT NULL,
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
          atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_suporte_chamados_status (status, prioridade),
          INDEX idx_suporte_chamados_empresa (empresa, filial)
        )
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS suporte_chamado_historico (
          id INT AUTO_INCREMENT PRIMARY KEY,
          chamado_id INT NOT NULL,
          evento VARCHAR(80) NOT NULL,
          autor VARCHAR(120) NOT NULL,
          papel VARCHAR(40) DEFAULT NULL,
          status_anterior VARCHAR(40) DEFAULT NULL,
          status_novo VARCHAR(40) DEFAULT NULL,
          mensagem TEXT DEFAULT NULL,
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_suporte_chamado_historico_chamado (chamado_id, criado_em),
          INDEX idx_suporte_chamado_historico_evento (evento)
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS chamados_comentarios (
          id INT AUTO_INCREMENT PRIMARY KEY,
          chamado_id INT NOT NULL,
          autor VARCHAR(120) NOT NULL,
          papel VARCHAR(40) DEFAULT NULL,
          tipo ENUM('COMENTARIO', 'REABERTURA', 'ANEXO', 'ASSINATURA') DEFAULT 'COMENTARIO',
          mensagem TEXT NOT NULL,
          anexo_url VARCHAR(500) DEFAULT NULL,
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_chamados_comentarios_chamado (chamado_id, criado_em),
          INDEX idx_chamados_comentarios_tipo (tipo)
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          pref_key VARCHAR(120) NOT NULL,
          pref_value JSON NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_user_preferences_key (usuario_id, pref_key),
          INDEX idx_user_preferences_usuario (usuario_id)
        )
      `);
      try {
        const [artigosExistentes] = await pool.execute('SELECT COUNT(*) AS total FROM suporte_artigos');
        if (!artigosExistentes[0] || Number(artigosExistentes[0].total) === 0) {
          await pool.execute(
            'INSERT INTO suporte_artigos (titulo, conteudo, categoria, publico, destaque) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
            [
              'Como abrir um chamado ao DEV', 'Use a central de suporte para relatar falhas do sistema, erros de tela, permissões ou integrações. Inclua o módulo afetado e o impacto percebido.', 'Primeiros Passos', 'USUARIO', true,
              'Como acompanhar o retorno', 'Depois de abrir um chamado, acompanhe o status na própria tela de suporte. Quando o desenvolvedor responder, a orientação ficará visível no histórico do ticket.', 'Acompanhamento', 'USUARIO', true,
              'Triagem técnica', 'O modo DEV mostra todos os tickets de sistema, respostas e métricas de fila. Use essa visão para priorização, categorização e registro do atendimento.', 'Operação Interna', 'DEV', true
            ]
          );
        }
      } catch (seedErr) {
        console.log('⚠️ Aviso ao popular artigos de suporte:', seedErr.message);
      }
      console.log('✅ Tabelas de Auditoria (SOC) e Operação operacionais!');
    } catch (e) { console.log('⚠️ Aviso ao criar tabelas SOC:', e.message); }

    // Índices de performance criados no startup. Cada índice é aplicado
    // individualmente para que um duplicado não impeça os próximos.
    const performanceIndexes = [
      'CREATE INDEX idx_equip_data ON leituras(equipamento_id, data_hora)',
      'CREATE INDEX idx_data_hora ON leituras(data_hora)',
      'CREATE INDEX idx_leituras_equip_id ON leituras(equipamento_id, id)',
      'CREATE INDEX idx_chamados_empresa_data ON chamados(empresa, data_abertura)',
      'CREATE INDEX idx_chamados_filial_data ON chamados(filial, data_abertura)',
      'CREATE INDEX idx_chamados_status_data ON chamados(status, data_abertura)',
      'CREATE INDEX idx_notificacoes_abertas ON notificacoes(equipamento_id, tipo_alerta, resolvido)'
    ];

    for (const indexSql of performanceIndexes) {
      try {
        await pool.execute(indexSql);
      } catch (e) {
        if (!String(e.message).includes('Duplicate key name')) {
          console.log('⚠️ Aviso ao criar índice de performance:', e.message);
        }
      }
    }
    
  } catch(e) { 
    console.log('❌ Erro Crítico: Banco de dados não encontrado ou offline.', e.message); 
  }
}
verificarBanco();

module.exports = pool;
