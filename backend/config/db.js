const mysql = require('mysql2/promise');

const pool = mysql.createPool({ 
  host: process.env.DB_HOST || 'localhost', 
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '2409', 
  database: process.env.DB_NAME || 'termosync',
  waitForConnections: true,
  connectionLimit: 20
});

async function verificarBanco() {
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
    } catch (e) {}

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
      } catch (seedErr) {}
      console.log('✅ Tabelas de Auditoria (SOC) e Operação operacionais!');
    } catch (e) { console.log('⚠️ Aviso ao criar tabelas SOC:', e.message); }

    try {
      await pool.execute('CREATE INDEX idx_equip_data ON leituras(equipamento_id, data_hora)');
      await pool.execute('CREATE INDEX idx_data_hora ON leituras(data_hora)');
    } catch (e) {}
    
  } catch(e) { 
    console.log('❌ Erro Crítico: Banco de dados não encontrado ou offline.', e.message); 
  }
}
verificarBanco();

module.exports = pool;
