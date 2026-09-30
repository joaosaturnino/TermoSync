/**
 * Módulo: backend/config/db.js
 * Responsabilidade: Centraliza as responsabilidades do módulo db.
 */

const mysql = require('mysql2/promise');
const { procedimentos } = require('../data/operationalDefaults');

const pool = mysql.createPool({ 
  host: process.env.DB_HOST || 'localhost', 
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '2409', 
  database: process.env.DB_NAME || 'termosync',
  waitForConnections: true,
  connectionLimit: 20
});

/**
 * Mantém as relações adicionadas pelas migrações também em instalações antigas.
 * A rotina não remove dados órfãos: quando encontra inconsistências, registra o
 * problema e preserva os registros para uma correção supervisionada.
 *
 * @returns {Promise<void>} Finaliza após validar todas as relações conhecidas.
 */
async function reconciliarRelacionamentos() {
  const relacionamentos = [
    ['hardware_iot', 'equipamento_id', 'equipamentos', 'id', 'fk_hwiot_equipamento', 'CASCADE', 'CASCADE'],
    ['suporte_chamado_historico', 'chamado_id', 'suporte_chamados', 'id', 'fk_suporte_hist_chamado', 'CASCADE', 'CASCADE'],
    ['sessoes_ativas', 'usuario_id', 'usuarios', 'id', 'fk_sessao_usuario', 'CASCADE', 'CASCADE'],
    ['equipamento_ultima_leitura', 'equipamento_id', 'equipamentos', 'id', 'fk_ultima_equipamento', 'CASCADE', 'CASCADE'],
    ['equipamento_ultima_leitura', 'leitura_id', 'leituras', 'id', 'fk_ultima_leitura', 'CASCADE', 'CASCADE'],
    ['chamados_comentarios', 'chamado_id', 'chamados', 'id', 'fk_chamados_comentarios_chamado', 'CASCADE', 'CASCADE'],
    ['user_preferences', 'usuario_id', 'usuarios', 'id', 'fk_user_preferences_usuario', 'CASCADE', 'CASCADE'],
    ['chat_mensagens', 'remetente_id', 'usuarios', 'id', 'fk_chat_remetente', 'SET NULL', 'CASCADE'],
    ['saas_tenant_settings', 'filial', 'loja', 'nome', 'fk_saas_tenant_filial', 'CASCADE', 'CASCADE'],
    ['saas_trial_events', 'actor_id', 'usuarios', 'id', 'fk_trial_event_actor', 'SET NULL', 'CASCADE'],
    ['network_probe_agents', 'filial', 'loja', 'nome', 'fk_probe_agent_filial', 'CASCADE', 'CASCADE'],
    ['rede_scans', 'agent_id', 'network_probe_agents', 'agent_id', 'fk_rede_scan_agent', 'SET NULL', 'CASCADE'],
    ['rede_scans', 'equipamento_id', 'equipamentos', 'id', 'fk_rede_scan_equipamento', 'SET NULL', 'CASCADE'],
    ['scanner_jobs', 'agent_id', 'network_probe_agents', 'agent_id', 'fk_scanner_job_agent', 'SET NULL', 'CASCADE'],
    ['sessoes_ativas', 'impersonated_by', 'usuarios', 'id', 'fk_sessao_impersonated_by', 'SET NULL', 'CASCADE'],
    ['sessoes_ativas', 'impersonated_filial', 'loja', 'nome', 'fk_sessao_impersonated_filial', 'SET NULL', 'CASCADE'],
    ['chamados', 'empresa', 'empresas', 'nome', 'fk_chamado_empresa', 'SET NULL', 'CASCADE'],
    ['chamados', 'filial', 'loja', 'nome', 'fk_chamado_filial', 'SET NULL', 'CASCADE'],
    ['suporte_chamados', 'empresa', 'empresas', 'nome', 'fk_suporte_empresa', 'SET NULL', 'CASCADE'],
    ['suporte_chamados', 'filial', 'loja', 'nome', 'fk_suporte_filial', 'SET NULL', 'CASCADE'],
    ['operacao_tarefas', 'empresa', 'empresas', 'nome', 'fk_operacao_empresa', 'SET NULL', 'CASCADE'],
    ['chamados', 'equipamento_id', 'equipamentos', 'id', 'fk_chamado_equipamento', 'SET NULL', 'CASCADE'],
    ['chamados', 'usuario_id', 'usuarios', 'id', 'fk_chamado_usuario', 'SET NULL', 'CASCADE']
  ];

  const [tabelasRows] = await pool.execute(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
  );
  const tabelas = new Set(tabelasRows.map((row) => row.TABLE_NAME));
  const [colunasRows] = await pool.execute(
    'SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()'
  );
  const colunas = new Set(colunasRows.map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}`));
  const [fkRows] = await pool.execute(`
    SELECT k.TABLE_NAME, k.COLUMN_NAME, k.CONSTRAINT_NAME,
           k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
           r.DELETE_RULE, r.UPDATE_RULE
      FROM information_schema.KEY_COLUMN_USAGE k
      JOIN information_schema.REFERENTIAL_CONSTRAINTS r
        ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
       AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       AND r.TABLE_NAME = k.TABLE_NAME
     WHERE k.CONSTRAINT_SCHEMA = DATABASE()
       AND k.REFERENCED_TABLE_NAME IS NOT NULL
  `);

  for (const [tabela, coluna, tabelaPai, colunaPai, nome, aoExcluir, aoAtualizar] of relacionamentos) {
    if (!tabelas.has(tabela) || !tabelas.has(tabelaPai)) continue;
    if (!colunas.has(`${tabela}.${coluna}`) || !colunas.has(`${tabelaPai}.${colunaPai}`)) continue;

    const existente = fkRows.find((fk) => fk.TABLE_NAME === tabela && fk.COLUMN_NAME === coluna);
    const correta = existente
      && existente.REFERENCED_TABLE_NAME === tabelaPai
      && existente.REFERENCED_COLUMN_NAME === colunaPai
      && existente.DELETE_RULE === aoExcluir
      && existente.UPDATE_RULE === aoAtualizar;
    if (correta) continue;

    const [orfaosRows] = await pool.query(`
      SELECT COUNT(*) AS total
        FROM \`${tabela}\` filho
        LEFT JOIN \`${tabelaPai}\` pai ON pai.\`${colunaPai}\` = filho.\`${coluna}\`
       WHERE filho.\`${coluna}\` IS NOT NULL AND pai.\`${colunaPai}\` IS NULL
    `);
    const totalOrfaos = Number(orfaosRows[0]?.total || 0);
    if (totalOrfaos > 0) {
      console.log(`⚠️ Relação ${tabela}.${coluna} pendente: ${totalOrfaos} registro(s) órfão(s).`);
      continue;
    }

    try {
      if (existente) {
        await pool.query(`ALTER TABLE \`${tabela}\` DROP FOREIGN KEY \`${existente.CONSTRAINT_NAME}\``);
      }
      await pool.query(`
        ALTER TABLE \`${tabela}\`
        ADD CONSTRAINT \`${nome}\` FOREIGN KEY (\`${coluna}\`)
        REFERENCES \`${tabelaPai}\` (\`${colunaPai}\`)
        ON DELETE ${aoExcluir} ON UPDATE ${aoAtualizar}
      `);
      console.log(`✅ Relação ${nome} reconciliada.`);
    } catch (erro) {
      console.log(`⚠️ Não foi possível reconciliar ${nome}:`, erro.message);
    }
  }
}

/**
 * Concentra a logica de verificar banco para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência; registra informações de diagnóstico
 *
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
      // Bases antigas possuíam um trigger que criava uma notificação a cada
      // leitura fora da faixa. O backend já controla estabilidade, deduplicação
      // e reabertura dos alertas; o trigger deve manter somente o heartbeat.
      // O protocolo de prepared statements do MySQL não aceita CREATE TRIGGER.
      // Como estes comandos são DDL estáticos, query() é apropriado e seguro.
      await pool.query('DROP TRIGGER IF EXISTS tg_verifica_leitura_temperatura');
      await pool.query(`
        CREATE TRIGGER tg_verifica_leitura_temperatura
        AFTER INSERT ON leituras
        FOR EACH ROW
        UPDATE hardware_iot
        SET ultima_comunicacao = NEW.data_hora
        WHERE equipamento_id = NEW.equipamento_id
      `);
      console.log('✅ Trigger de telemetria ajustado para heartbeat sem alertas duplicados.');
    } catch (triggerError) {
      console.log('⚠️ Aviso ao ajustar trigger de telemetria:', triggerError.message);
    }

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
        ['last_seen', 'DATETIME DEFAULT NULL'],
        ['impersonated_filial', 'VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL'],
        ['impersonated_by', 'INT DEFAULT NULL']
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
        await pool.execute('UPDATE sessoes_ativas s LEFT JOIN usuarios u ON u.id = s.usuario_id SET s.revogado = TRUE WHERE u.id IS NULL AND s.usuario_id <> 9999');
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

      // Instalações antigas podiam manter equipamentos.empresa e equipamentos.filial
      // em utf8mb4_0900_ai_ci, embora as tabelas pai usem utf8mb4_unicode_ci. O
      // MySQL aceita a chave já existente, mas bloqueia alterações posteriores na
      // tabela. O ALTER único preserva atomicamente os relacionamentos e libera as
      // migrações incrementais abaixo.
      try {
        const [relationshipColumns] = await pool.execute(`
          SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND ((TABLE_NAME = 'equipamentos' AND COLUMN_NAME IN ('empresa', 'filial'))
              OR (TABLE_NAME = 'empresas' AND COLUMN_NAME = 'nome')
              OR (TABLE_NAME = 'loja' AND COLUMN_NAME = 'nome'))
        `);
        const columnCollation = Object.fromEntries(
          relationshipColumns.map((column) => [`${column.TABLE_NAME}.${column.COLUMN_NAME}`, column.COLLATION_NAME])
        );
        const equipmentRelationsNeedRepair =
          columnCollation['equipamentos.empresa'] !== columnCollation['empresas.nome']
          || columnCollation['equipamentos.filial'] !== columnCollation['loja.nome'];

        const [relationshipConstraints] = await pool.execute(`
          SELECT CONSTRAINT_NAME
          FROM information_schema.REFERENTIAL_CONSTRAINTS
          WHERE CONSTRAINT_SCHEMA = DATABASE()
            AND TABLE_NAME = 'equipamentos'
            AND CONSTRAINT_NAME IN ('fk_equip_empresa', 'fk_equip_filial')
        `);
        let constraintNames = new Set(relationshipConstraints.map((constraint) => constraint.CONSTRAINT_NAME));

        if (equipmentRelationsNeedRepair) {
          const constraintsToDrop = ['fk_equip_empresa', 'fk_equip_filial']
            .filter((constraintName) => constraintNames.has(constraintName));
          if (constraintsToDrop.length) {
            const dropClauses = constraintsToDrop.map((constraintName) => `DROP FOREIGN KEY ${constraintName}`).join(', ');
            await pool.query(`ALTER TABLE equipamentos ${dropClauses}`);
          }
          await pool.execute(`
            ALTER TABLE equipamentos
              MODIFY empresa VARCHAR(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
              MODIFY filial VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL
          `);
          constraintNames = new Set();
        }

        if (!constraintNames.has('fk_equip_empresa')) {
          await pool.execute('ALTER TABLE equipamentos ADD CONSTRAINT fk_equip_empresa FOREIGN KEY (empresa) REFERENCES empresas(nome) ON DELETE CASCADE ON UPDATE CASCADE');
        }
        if (!constraintNames.has('fk_equip_filial')) {
          await pool.execute('ALTER TABLE equipamentos ADD CONSTRAINT fk_equip_filial FOREIGN KEY (filial) REFERENCES loja(nome) ON DELETE CASCADE ON UPDATE CASCADE');
        }
      } catch (relationshipError) {
        console.log('⚠️ Aviso ao alinhar relacionamentos de equipamentos:', relationshipError.message);
      }

      // Trials ficam associados à empresa para que login, sessões e telemetria
      // compartilhem uma única fonte de verdade sobre modo e expiração.
      const trialColumns = [
        ['empresas', 'access_mode', "VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER'"],
        ['empresas', 'trial_started_at', 'DATETIME DEFAULT NULL'],
        ['empresas', 'trial_expires_at', 'DATETIME DEFAULT NULL'],
        ['empresas', 'trial_auto_block', 'BOOLEAN NOT NULL DEFAULT TRUE'],
        ['empresas', 'trial_warning_days', 'INT NOT NULL DEFAULT 3'],
        ['empresas', 'trial_warning_sent_at', 'DATETIME DEFAULT NULL'],
        ['empresas', 'trial_stage', "VARCHAR(24) NOT NULL DEFAULT 'NEW'"],
        ['empresas', 'trial_paused_at', 'DATETIME DEFAULT NULL'],
        ['empresas', 'trial_delete_at', 'DATETIME DEFAULT NULL'],
        ['empresas', 'trial_max_users', 'INT NOT NULL DEFAULT 3'],
        ['empresas', 'trial_max_stores', 'INT NOT NULL DEFAULT 1'],
        ['empresas', 'trial_max_equipment', 'INT NOT NULL DEFAULT 10'],
        ['pre_cadastros', 'tipo_acesso', "VARCHAR(20) NOT NULL DEFAULT 'COMERCIAL'"],
        ['pre_cadastros', 'legal_version', 'VARCHAR(20) DEFAULT NULL'],
        ['pre_cadastros', 'legal_accepted_at', 'DATETIME DEFAULT NULL'],
        ['equipamentos', 'is_virtual', 'BOOLEAN NOT NULL DEFAULT FALSE'],
        ['equipamentos', 'demo_base_temp', 'DECIMAL(5,2) DEFAULT NULL'],
        ['equipamentos', 'demo_base_humidity', 'DECIMAL(5,2) DEFAULT NULL'],
        ['equipamentos', 'demo_base_consumption', 'DECIMAL(8,2) DEFAULT NULL']
      ];

      for (const [table, column, definition] of trialColumns) {
        try {
          await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        } catch (alterErr) {
          if (!String(alterErr.message).includes('Duplicate column')) {
            console.log(`⚠️ Aviso ao ajustar ${table}.${column}:`, alterErr.message);
          }
        }
      }

      const userSecurityColumns = [
        ['email', 'VARCHAR(150) DEFAULT NULL'],
        ['telefone', 'VARCHAR(50) DEFAULT NULL'],
        ['mfa_secret', 'VARCHAR(80) DEFAULT NULL'],
        ['mfa_enabled', 'BOOLEAN DEFAULT FALSE'],
        ['mfa_required', 'BOOLEAN DEFAULT FALSE'],
        ['security_blocked', 'BOOLEAN DEFAULT FALSE'],
        ['password_changed_at', 'DATETIME DEFAULT NULL'],
        ['password_reset_code_hash', 'VARCHAR(255) DEFAULT NULL'],
        ['password_reset_expires_at', 'DATETIME DEFAULT NULL'],
        ['password_reset_attempts', 'INT DEFAULT 0'],
        ['password_reset_requested_at', 'DATETIME DEFAULT NULL'],
        ['must_change_password', 'BOOLEAN NOT NULL DEFAULT FALSE']
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

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS saas_tenant_settings (
          filial VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
          plano VARCHAR(30) NOT NULL DEFAULT 'FREE',
          retention_days INT NOT NULL DEFAULT 30,
          custom_monthly_price DECIMAL(10,2) DEFAULT NULL,
          billing_due_day INT DEFAULT NULL,
          api_key_hash VARCHAR(128) DEFAULT NULL,
          api_key_prefix VARCHAR(32) DEFAULT NULL,
          api_key_created_at DATETIME DEFAULT NULL,
          api_key_last_used_at DATETIME DEFAULT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_saas_tenant_plan (plano),
          INDEX idx_saas_tenant_updated (updated_at)
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS saas_trial_notifications (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          empresa VARCHAR(150) COLLATE utf8mb4_unicode_ci NOT NULL,
          milestone_days INT NOT NULL,
          recipient VARCHAR(180) DEFAULT NULL,
          sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_trial_notification (empresa, milestone_days),
          INDEX idx_trial_notification_date (sent_at)
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS trial_usage_events (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          empresa VARCHAR(150) COLLATE utf8mb4_unicode_ci NOT NULL,
          usuario_id INT DEFAULT NULL,
          screen_id VARCHAR(80) NOT NULL,
          duration_ms INT UNSIGNED NOT NULL DEFAULT 0,
          occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_trial_usage_company_date (empresa, occurred_at),
          INDEX idx_trial_usage_user_date (usuario_id, occurred_at)
        )
      `);

      // Mantém uma trilha funcional própria do ciclo gratuito. Diferente do log
      // técnico geral, esta tabela alimenta a linha do tempo exibida ao DEV e
      // preserva decisões comerciais, contatos, avisos e mudanças de acesso.
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS saas_trial_events (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          empresa VARCHAR(150) COLLATE utf8mb4_unicode_ci NOT NULL,
          event_type VARCHAR(40) NOT NULL,
          title VARCHAR(160) NOT NULL,
          detail TEXT DEFAULT NULL,
          actor_id INT DEFAULT NULL,
          actor_label VARCHAR(150) DEFAULT NULL,
          metadata JSON DEFAULT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          INDEX idx_trial_events_company_date (empresa, created_at),
          INDEX idx_trial_events_type_date (event_type, created_at)
        )
      `);
      await pool.execute('ALTER TABLE saas_tenant_settings MODIFY filial VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL');
      const saasCommercialColumns = [
        ['custom_monthly_price', 'DECIMAL(10,2) DEFAULT NULL'],
        ['billing_due_day', 'INT DEFAULT NULL']
      ];
      for (const [column, definition] of saasCommercialColumns) {
        try {
          await pool.execute(`ALTER TABLE saas_tenant_settings ADD COLUMN ${column} ${definition}`);
        } catch (alterErr) {
          if (!String(alterErr.message).includes('Duplicate column')) {
            console.log(`⚠️ Aviso ao ajustar saas_tenant_settings.${column}:`, alterErr.message);
          }
        }
      }

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS scanner_jobs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          filial VARCHAR(100) NOT NULL,
          ip_range VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'Pendente',
          agent_id VARCHAR(80) DEFAULT NULL,
          network_mode VARCHAR(20) DEFAULT 'AUTO',
          ports_json JSON DEFAULT NULL,
          source_cidr VARCHAR(50) DEFAULT NULL,
          claimed_at DATETIME DEFAULT NULL,
          completed_at DATETIME DEFAULT NULL,
          error_message VARCHAR(500) DEFAULT NULL,
          data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_scanner_jobs_queue (filial, status, data_criacao),
          INDEX idx_scanner_jobs_agent (agent_id, status)
        )
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS rede_scans (
          id INT AUTO_INCREMENT PRIMARY KEY,
          filial VARCHAR(100) NOT NULL,
          ip_alvo VARCHAR(50) NOT NULL,
          hostname VARCHAR(100) DEFAULT NULL,
          portas_abertas JSON DEFAULT NULL,
          status VARCHAR(20) DEFAULT 'Online',
          agent_id VARCHAR(80) DEFAULT NULL,
          equipamento_id INT DEFAULT NULL,
          mac_address VARCHAR(20) DEFAULT NULL,
          source_type VARCHAR(30) DEFAULT 'DISCOVERY',
          latency_ms INT DEFAULT NULL,
          source_address VARCHAR(45) DEFAULT NULL,
          data_scan DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_rede_scans_filial_data (filial, data_scan),
          INDEX idx_rede_scans_agent_data (agent_id, data_scan)
        )
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS network_probe_agents (
          agent_id VARCHAR(80) PRIMARY KEY,
          filial VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
          hostname VARCHAR(120) DEFAULT NULL,
          platform VARCHAR(40) DEFAULT NULL,
          architecture VARCHAR(40) DEFAULT NULL,
          agent_version VARCHAR(30) DEFAULT NULL,
          local_ip VARCHAR(45) DEFAULT NULL,
          gateway VARCHAR(45) DEFAULT NULL,
          detected_cidr VARCHAR(50) DEFAULT NULL,
          interfaces_json JSON DEFAULT NULL,
          metadata_json JSON DEFAULT NULL,
          first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_probe_agents_filial_seen (filial, last_seen_at)
        )
      `);

      const scannerJobColumns = [
        ['agent_id', 'VARCHAR(80) DEFAULT NULL'],
        ['network_mode', "VARCHAR(20) DEFAULT 'AUTO'"],
        ['ports_json', 'JSON DEFAULT NULL'],
        ['source_cidr', 'VARCHAR(50) DEFAULT NULL'],
        ['claimed_at', 'DATETIME DEFAULT NULL'],
        ['completed_at', 'DATETIME DEFAULT NULL'],
        ['error_message', 'VARCHAR(500) DEFAULT NULL']
      ];
      const networkScanColumns = [
        ['agent_id', 'VARCHAR(80) DEFAULT NULL'],
        ['equipamento_id', 'INT DEFAULT NULL'],
        ['mac_address', 'VARCHAR(20) DEFAULT NULL'],
        ['source_type', "VARCHAR(30) DEFAULT 'DISCOVERY'"],
        ['latency_ms', 'INT DEFAULT NULL'],
        ['source_address', 'VARCHAR(45) DEFAULT NULL']
      ];
      for (const [table, columns] of [['scanner_jobs', scannerJobColumns], ['rede_scans', networkScanColumns]]) {
        for (const [column, definition] of columns) {
          try {
            await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
          } catch (alterErr) {
            if (!String(alterErr.message).includes('Duplicate column')) {
              console.log(`⚠️ Aviso ao ajustar ${table}.${column}:`, alterErr.message);
            }
          }
        }
      }

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
          tipo VARCHAR(50) NOT NULL DEFAULT 'checklist_turno',
          chave VARCHAR(50) NOT NULL,
          titulo VARCHAR(255) NOT NULL,
          descricao TEXT,
          horario VARCHAR(10),
          concluida BOOLEAN DEFAULT FALSE,
          ordem INT DEFAULT 0,
          filial VARCHAR(100) NOT NULL DEFAULT 'Matriz',
          empresa VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_operacao_tarefas (tipo, empresa, filial)
        )
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS operacao_procedimentos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          chave VARCHAR(80) NOT NULL UNIQUE,
          titulo VARCHAR(180) NOT NULL,
          categoria VARCHAR(80) NOT NULL,
          severidade VARCHAR(30) NOT NULL,
          responsavel VARCHAR(120) NOT NULL,
          sla VARCHAR(100) NOT NULL,
          icone VARCHAR(50) NOT NULL,
          tipos_alerta JSON NOT NULL,
          rota VARCHAR(80) NOT NULL,
          gatilho TEXT NOT NULL,
          objetivo TEXT NOT NULL,
          etapas JSON NOT NULL,
          evidencias JSON NOT NULL,
          escalonamento TEXT NOT NULL,
          ativo BOOLEAN DEFAULT TRUE,
          ordem INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_operacao_procedimentos (ativo, ordem, categoria)
        )
      `);
      for (const [ordem, procedimento] of procedimentos.entries()) {
        await pool.execute(
          `INSERT INTO operacao_procedimentos
            (chave, titulo, categoria, severidade, responsavel, sla, icone, tipos_alerta, rota, gatilho, objetivo, etapas, evidencias, escalonamento, ordem)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             titulo = VALUES(titulo), categoria = VALUES(categoria), severidade = VALUES(severidade),
             responsavel = VALUES(responsavel), sla = VALUES(sla), icone = VALUES(icone),
             tipos_alerta = VALUES(tipos_alerta), rota = VALUES(rota), gatilho = VALUES(gatilho),
             objetivo = VALUES(objetivo), etapas = VALUES(etapas), evidencias = VALUES(evidencias),
             escalonamento = VALUES(escalonamento), ordem = VALUES(ordem)`,
          [
            procedimento.chave, procedimento.titulo, procedimento.categoria, procedimento.severidade,
            procedimento.responsavel, procedimento.sla, procedimento.icone,
            JSON.stringify(procedimento.tiposAlerta), procedimento.rota, procedimento.gatilho,
            procedimento.objetivo, JSON.stringify(procedimento.etapas), JSON.stringify(procedimento.evidencias),
            procedimento.escalonamento, ordem
          ]
        );
      }
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
          status ENUM('Aberto', 'Em análise', 'Em Atendimento', 'Respondido', 'Resolvido', 'Concluído', 'Fechado') DEFAULT 'Aberto',
          origem ENUM('USUARIO', 'DEV') DEFAULT 'USUARIO',
          solicitante VARCHAR(120) NOT NULL,
          email VARCHAR(120) DEFAULT NULL,
          empresa VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          filial VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS system_health_history (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          status VARCHAR(20) NOT NULL,
          database_status VARCHAR(20) NOT NULL,
          mqtt_status VARCHAR(20) NOT NULL,
          whatsapp_status VARCHAR(30) NOT NULL,
          response_time_ms INT UNSIGNED DEFAULT NULL,
          database_latency_ms INT UNSIGNED DEFAULT NULL,
          cpu_percent DECIMAL(7,2) DEFAULT NULL,
          event_loop_utilization DECIMAL(7,4) DEFAULT NULL,
          rss_mb DECIMAL(12,2) DEFAULT NULL,
          heap_used_mb DECIMAL(12,2) DEFAULT NULL,
          heap_total_mb DECIMAL(12,2) DEFAULT NULL,
          external_mb DECIMAL(12,2) DEFAULT NULL,
          socket_clients INT UNSIGNED DEFAULT 0,
          error_message VARCHAR(500) DEFAULT NULL,
          recorded_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
          INDEX idx_system_health_recorded_at (recorded_at),
          INDEX idx_system_health_status_time (status, recorded_at)
        )
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS system_deployments (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          version VARCHAR(40) NOT NULL,
          title VARCHAR(150) NOT NULL,
          type VARCHAR(30) NOT NULL,
          target VARCHAR(30) NOT NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'PROCESSING',
          package_name VARCHAR(255) NOT NULL,
          package_size BIGINT UNSIGNED DEFAULT 0,
          package_checksum VARCHAR(64) DEFAULT NULL,
          entry_count INT UNSIGNED DEFAULT 0,
          initiated_by VARCHAR(100) NOT NULL,
          error_message VARCHAR(500) DEFAULT NULL,
          created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
          completed_at DATETIME(3) DEFAULT NULL,
          INDEX idx_system_deployments_created (created_at),
          INDEX idx_system_deployments_status (status, created_at),
          INDEX idx_system_deployments_target (target, created_at)
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

    try {
      await reconciliarRelacionamentos();
    } catch (e) {
      console.log('⚠️ Aviso ao reconciliar relacionamentos do banco:', e.message);
    }

    // Índices de performance criados no startup. Cada índice é aplicado
    // individualmente para que um duplicado não impeça os próximos.
    const performanceIndexes = [
      'CREATE INDEX idx_equip_data ON leituras(equipamento_id, data_hora)',
      'CREATE INDEX idx_data_hora ON leituras(data_hora)',
      'CREATE INDEX idx_leituras_equip_id ON leituras(equipamento_id, id)',
      'CREATE INDEX idx_chamados_empresa_data ON chamados(empresa, data_abertura)',
      'CREATE INDEX idx_chamados_filial_data ON chamados(filial, data_abertura)',
      'CREATE INDEX idx_chamados_status_data ON chamados(status, data_abertura)',
      'CREATE INDEX idx_chamados_tenant_fila ON chamados(empresa, filial, arquivado, status, data_abertura)',
      'CREATE INDEX idx_chamados_data_abertura ON chamados(data_abertura)',
      'CREATE INDEX idx_suporte_tenant_fila ON suporte_chamados(empresa, filial, status, criado_em)',
      'CREATE INDEX idx_notificacoes_abertas ON notificacoes(equipamento_id, tipo_alerta, resolvido)',
      'CREATE INDEX idx_notificacoes_equip_resolvido ON notificacoes(equipamento_id, resolvido)',
      'CREATE INDEX idx_security_events_created ON security_events(created_at)',
      'CREATE INDEX idx_sessoes_revogado_expira ON sessoes_ativas(revogado, expires_at, data_login)',
      'CREATE INDEX idx_usuarios_role ON usuarios(role)',
      'CREATE INDEX idx_empresas_trial_expira ON empresas(access_mode, trial_expires_at)',
      'CREATE INDEX idx_equipamentos_virtual_tenant ON equipamentos(is_virtual, empresa, filial)',
      'CREATE INDEX idx_scanner_jobs_queue ON scanner_jobs(filial, status, data_criacao)',
      'CREATE INDEX idx_rede_scans_filial_data ON rede_scans(filial, data_scan)',
      'CREATE INDEX idx_rede_scans_agent_data ON rede_scans(agent_id, data_scan)'
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
