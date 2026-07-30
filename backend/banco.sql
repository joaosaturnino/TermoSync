CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data_hora` datetime DEFAULT CURRENT_TIMESTAMP,
  `acao` varchar(100) DEFAULT NULL,
  `ator` varchar(100) DEFAULT NULL,
  `alvo` varchar(255) DEFAULT NULL,
  `severidade` varchar(20) DEFAULT 'info',
  PRIMARY KEY (`id`)
);

CREATE TABLE `chamados` (
  `id` int NOT NULL AUTO_INCREMENT,
  `equipamento_id` int DEFAULT NULL,
  `usuario_id` int DEFAULT NULL,
  `tecnico_id` int DEFAULT NULL,
  `filial` varchar(100) DEFAULT NULL,
  `descricao` text,
  `solicitante_nome` varchar(150) DEFAULT NULL,
  `tecnico_responsavel` varchar(150) DEFAULT NULL,
  `urgencia` enum('Pendente','Baixa','Média','Alta','Crítica') DEFAULT 'Pendente',
  `status` varchar(50) DEFAULT 'Aberto',
  `data_abertura` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `data_conclusao` timestamp NULL DEFAULT NULL,
  `nota_resolucao` text,
  `arquivado` tinyint(1) DEFAULT '0',
  `empresa` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `equipamento_id` (`equipamento_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `chamados_ibfk_1` FOREIGN KEY (`equipamento_id`) REFERENCES `equipamentos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chamados_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
);

CREATE TABLE `chat_mensagens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `remetente_id` int DEFAULT NULL,
  `remetente_nome` varchar(150) DEFAULT NULL,
  `destino_id` varchar(50) DEFAULT NULL,
  `texto` longtext,
  `data_hora` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE `empresas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(150) NOT NULL,
  `cnpj` varchar(20) DEFAULT NULL,
  `contato` varchar(150) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `status` enum('Ativa','Suspensa') DEFAULT 'Ativa',
  `data_cadastro` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nome` (`nome`)
);

CREATE TABLE `equipamentos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `tipo` varchar(100) DEFAULT NULL,
  `temp_min` decimal(5,2) DEFAULT NULL,
  `temp_max` decimal(5,2) DEFAULT NULL,
  `umidade_min` decimal(5,2) DEFAULT NULL,
  `umidade_max` decimal(5,2) DEFAULT NULL,
  `motor_ligado` tinyint(1) DEFAULT '1',
  `intervalo_degelo` int DEFAULT '6',
  `duracao_degelo` int DEFAULT '30',
  `em_degelo` tinyint(1) DEFAULT '0',
  `setor` varchar(100) DEFAULT NULL,
  `filial` varchar(100) DEFAULT NULL,
  `data_calibracao` date DEFAULT NULL,
  `empresa` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `faturas_saas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filial` varchar(100) NOT NULL,
  `plano` varchar(50) NOT NULL DEFAULT 'PRO',
  `valor_base` decimal(10,2) NOT NULL,
  `multa` decimal(10,2) DEFAULT '0.00',
  `juros` decimal(10,2) DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL,
  `status` enum('PENDENTE','PAGO','ATRASADA','VENCIDA') DEFAULT 'PENDENTE',
  `data_vencimento` date NOT NULL,
  `data_pagamento` datetime DEFAULT NULL,
  `ciclo_mes` int NOT NULL,
  `ciclo_ano` int NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_fatura_mes` (`filial`,`ciclo_mes`,`ciclo_ano`),
  CONSTRAINT `faturas_saas_ibfk_1` FOREIGN KEY (`filial`) REFERENCES `loja` (`nome`) ON DELETE CASCADE ON UPDATE CASCADE
);


CREATE TABLE `hardware_iot` (
  `equipamento_id` int NOT NULL,
  `mac_address` varchar(20) DEFAULT '00:00:00:00:00:00',
  `ip_local` varchar(15) DEFAULT '0.0.0.0',
  `sinal_wifi` int DEFAULT '-100',
  `uptime` varchar(50) DEFAULT '0h',
  `firmware_version` varchar(20) DEFAULT 'v1.0.0',
  `ultima_comunicacao` datetime DEFAULT NULL,
  PRIMARY KEY (`equipamento_id`)
);

CREATE TABLE `leituras` (
  `id` int NOT NULL AUTO_INCREMENT,
  `equipamento_id` int DEFAULT NULL,
  `temperatura` decimal(5,2) DEFAULT NULL,
  `umidade` decimal(5,2) DEFAULT '50.00',
  `consumo_kwh` decimal(8,2) DEFAULT '0.00',
  `data_hora` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_equip_data` (`equipamento_id`,`data_hora`),
  KEY `idx_data_hora` (`data_hora`),
  CONSTRAINT `leituras_ibfk_1` FOREIGN KEY (`equipamento_id`) REFERENCES `equipamentos` (`id`) ON DELETE CASCADE
);

CREATE TABLE `loja` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) DEFAULT NULL,
  `endereco` varchar(255) DEFAULT NULL,
  `telefone` varchar(50) DEFAULT NULL,
  `status` enum('Ativa','Suspensa') DEFAULT 'Ativa',
  `empresa` varchar(150) DEFAULT NULL,
  `data_cadastro` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nome` (`nome`)
);

CREATE TABLE `notificacoes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `equipamento_id` int DEFAULT NULL,
  `mensagem` varchar(255) DEFAULT NULL,
  `tipo_alerta` varchar(50) DEFAULT NULL,
  `resolvido` tinyint(1) DEFAULT '0',
  `nota_resolucao` text,
  `data_hora` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `equipamento_id` (`equipamento_id`),
  CONSTRAINT `notificacoes_ibfk_1` FOREIGN KEY (`equipamento_id`) REFERENCES `equipamentos` (`id`) ON DELETE CASCADE
);

CREATE TABLE `operacao_tarefas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo` varchar(50) NOT NULL DEFAULT 'checklist_turno',
  `chave` varchar(50) NOT NULL COMMENT 'pre-turno, operacao, ou encerramento',
  `titulo` varchar(255) NOT NULL,
  `descricao` text,
  `concluida` tinyint(1) DEFAULT '0',
  `horario` varchar(10) DEFAULT NULL COMMENT 'Hora da conclusao',
  `ordem` int DEFAULT '1',
  `filial` varchar(100) NOT NULL DEFAULT 'Matriz',
  `empresa` varchar(150) DEFAULT 'Cliente Alpha (Padrão)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tipo_filial_empresa` (`tipo`,`filial`,`empresa`)
);

CREATE TABLE `pre_cadastros` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa` varchar(255) NOT NULL,
  `cnpj` varchar(50) NOT NULL,
  `responsavel` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `telefone` varchar(50) NOT NULL,
  `status` enum('pendente','aprovado','rejeitado') DEFAULT 'pendente',
  `data_solicitacao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE `sessoes_ativas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int DEFAULT NULL,
  `usuario_nome` varchar(100) DEFAULT NULL,
  `role` varchar(50) DEFAULT NULL,
  `token` varchar(500) DEFAULT NULL,
  `ip_address` varchar(50) DEFAULT NULL,
  `localizacao` varchar(100) DEFAULT 'Desconhecida',
  `data_login` datetime DEFAULT CURRENT_TIMESTAMP,
  `revogado` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_token` (`token`(255))
);

CREATE TABLE `setores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nome` (`nome`)
);

CREATE TABLE `suporte_artigos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titulo` varchar(180) NOT NULL,
  `conteudo` text NOT NULL,
  `categoria` varchar(80) DEFAULT 'Geral',
  `publico` enum('USUARIO','DEV','AMBOS') DEFAULT 'USUARIO',
  `destaque` tinyint(1) DEFAULT '0',
  `ativo` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_suporte_artigos_publico` (`publico`,`ativo`)
);

CREATE TABLE `suporte_chamado_historico` (
  `id` int NOT NULL AUTO_INCREMENT,
  `chamado_id` int NOT NULL,
  `evento` varchar(80) NOT NULL,
  `autor` varchar(120) NOT NULL,
  `papel` varchar(40) DEFAULT NULL,
  `status_anterior` varchar(40) DEFAULT NULL,
  `status_novo` varchar(40) DEFAULT NULL,
  `mensagem` text,
  `criado_em` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_suporte_chamado_historico_chamado` (`chamado_id`,`criado_em`),
  KEY `idx_suporte_chamado_historico_evento` (`evento`)
);

CREATE TABLE `suporte_chamados` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titulo` varchar(180) NOT NULL,
  `descricao` text NOT NULL,
  `categoria` varchar(80) DEFAULT 'Geral',
  `prioridade` enum('Baixa','Média','Alta','Crítica') DEFAULT 'Média',
  `status` enum('Aberto','Em análise','Respondido','Concluído') DEFAULT 'Aberto',
  `origem` enum('USUARIO','DEV') DEFAULT 'USUARIO',
  `solicitante` varchar(120) NOT NULL,
  `email` varchar(120) DEFAULT NULL,
  `empresa` varchar(120) DEFAULT NULL,
  `filial` varchar(120) DEFAULT NULL,
  `resposta` text,
  `responsavel` varchar(120) DEFAULT NULL,
  `criado_em` datetime DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_suporte_chamados_status` (`status`,`prioridade`),
  KEY `idx_suporte_chamados_empresa` (`empresa`,`filial`)
);

CREATE TABLE `sys_relatorios_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data_geracao` datetime DEFAULT CURRENT_TIMESTAMP,
  `tipo_relatorio` varchar(100) DEFAULT NULL,
  `formato` varchar(10) DEFAULT NULL,
  `solicitante` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `system_changelog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `version` varchar(20) NOT NULL,
  `title` varchar(150) NOT NULL,
  `type` varchar(50) NOT NULL,
  `desc_text` text NOT NULL,
  `author` varchar(50) NOT NULL,
  `date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE `tecnicos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(150) NOT NULL,
  `telefone` varchar(50) DEFAULT NULL,
  `data_cadastro` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE `tipos_refrigeracao` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `temp_min` decimal(5,2) DEFAULT '0.00',
  `temp_max` decimal(5,2) DEFAULT '8.00',
  `umidade_min` decimal(5,2) DEFAULT '60.00',
  `umidade_max` decimal(5,2) DEFAULT '85.00',
  `intervalo_degelo` int DEFAULT '6',
  `duracao_degelo` int DEFAULT '30',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nome` (`nome`)
);

CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario` varchar(50) NOT NULL,
  `senha` varchar(255) NOT NULL,
  `role` enum('ADMIN','MANUTENCAO','LOJA','DEV') DEFAULT 'LOJA',
  `filial` varchar(100) DEFAULT NULL,
  `nome_gerente` varchar(150) DEFAULT NULL,
  `nome_coordenador` varchar(150) DEFAULT NULL,
  `nome_tecnico` varchar(150) DEFAULT NULL,
  `tecnico_id` int DEFAULT NULL,
  `empresa` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuario` (`usuario`)
);