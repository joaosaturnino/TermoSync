-- TermoSync - integridade relacional
-- Gerado a partir do dump de 30/09/2026 e validado contra o banco ativo.
-- Execute uma unica vez, depois de gerar um backup completo do banco termosync.
-- MySQL confirma comandos DDL automaticamente; ROLLBACK nao desfaz ALTER TABLE.

USE termosync;
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 1. Preflight: todos os resultados devem ser zero, exceto preferencia_usuario.
-- ---------------------------------------------------------------------------

SELECT 'ultima_equipamento' AS verificacao, COUNT(*) AS orfaos
FROM equipamento_ultima_leitura c
LEFT JOIN equipamentos p ON p.id = c.equipamento_id
WHERE p.id IS NULL
UNION ALL
SELECT 'ultima_leitura', COUNT(*)
FROM equipamento_ultima_leitura c
LEFT JOIN leituras p ON p.id = c.leitura_id
WHERE p.id IS NULL
UNION ALL
SELECT 'comentario_chamado', COUNT(*)
FROM chamados_comentarios c
LEFT JOIN chamados p ON p.id = c.chamado_id
WHERE p.id IS NULL
UNION ALL
SELECT 'preferencia_usuario', COUNT(*)
FROM user_preferences c
LEFT JOIN usuarios p ON p.id = c.usuario_id
WHERE p.id IS NULL
UNION ALL
SELECT 'chat_remetente', COUNT(*)
FROM chat_mensagens c
LEFT JOIN usuarios p ON p.id = c.remetente_id
WHERE c.remetente_id IS NOT NULL AND p.id IS NULL
UNION ALL
SELECT 'tenant_filial', COUNT(*)
FROM saas_tenant_settings c
LEFT JOIN loja p ON p.nome = c.filial
WHERE p.id IS NULL
UNION ALL
SELECT 'trial_ator', COUNT(*)
FROM saas_trial_events c
LEFT JOIN usuarios p ON p.id = c.actor_id
WHERE c.actor_id IS NOT NULL AND p.id IS NULL
UNION ALL
SELECT 'scan_agente', COUNT(*)
FROM rede_scans c
LEFT JOIN network_probe_agents p ON p.agent_id = c.agent_id
WHERE c.agent_id IS NOT NULL AND p.agent_id IS NULL
UNION ALL
SELECT 'scan_equipamento', COUNT(*)
FROM rede_scans c
LEFT JOIN equipamentos p ON p.id = c.equipamento_id
WHERE c.equipamento_id IS NOT NULL AND p.id IS NULL
UNION ALL
SELECT 'job_agente', COUNT(*)
FROM scanner_jobs c
LEFT JOIN network_probe_agents p ON p.agent_id = c.agent_id
WHERE c.agent_id IS NOT NULL AND p.agent_id IS NULL
UNION ALL
SELECT 'sessao_impersonador', COUNT(*)
FROM sessoes_ativas c
LEFT JOIN usuarios p ON p.id = c.impersonated_by
WHERE c.impersonated_by IS NOT NULL AND p.id IS NULL
UNION ALL
SELECT 'sessao_filial_impersonada', COUNT(*)
FROM sessoes_ativas c
LEFT JOIN loja p ON p.nome = c.impersonated_filial
WHERE c.impersonated_filial IS NOT NULL AND p.id IS NULL;

-- Valores especiais que impedem uma FK direta com loja.
SELECT 'rede_scans' AS tabela, filial, COUNT(*) AS total
FROM rede_scans
WHERE filial IN ('Todas', 'Matriz', 'Loja Matriz')
GROUP BY filial
UNION ALL
SELECT 'scanner_jobs', filial, COUNT(*)
FROM scanner_jobs
WHERE filial IN ('Todas', 'Matriz', 'Loja Matriz')
GROUP BY filial
UNION ALL
SELECT 'operacao_tarefas', filial, COUNT(*)
FROM operacao_tarefas
WHERE filial IN ('Todas', 'Matriz', 'Loja Matriz')
GROUP BY filial;

-- ---------------------------------------------------------------------------
-- 2. Preserva e remove preferencias cujo usuario ja nao existe.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS migration_20260930_user_preferences_orphans
LIKE user_preferences;

INSERT IGNORE INTO migration_20260930_user_preferences_orphans
SELECT pref.*
FROM user_preferences pref
LEFT JOIN usuarios usr ON usr.id = pref.usuario_id
WHERE usr.id IS NULL;

-- O dump auditado possui exatamente o registro orfao id=120/usuario_id=118.
-- A igualdade pela chave primaria permite a execucao com SQL_SAFE_UPDATES ativo.
DELETE FROM user_preferences
WHERE id = 120
  AND usuario_id = 118
  AND NOT EXISTS (
    SELECT 1 FROM usuarios WHERE id = 118
  );

-- ---------------------------------------------------------------------------
-- 3. Normaliza colunas textuais que passam a referenciar tabelas catalogo.
-- ---------------------------------------------------------------------------

ALTER TABLE network_probe_agents
  MODIFY filial VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

ALTER TABLE chamados
  MODIFY empresa VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  MODIFY filial VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;

ALTER TABLE suporte_chamados
  MODIFY empresa VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  MODIFY filial VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;

ALTER TABLE operacao_tarefas
  MODIFY empresa VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;

-- ---------------------------------------------------------------------------
-- 4. Cria indices dedicados para as novas chaves estrangeiras.
-- ---------------------------------------------------------------------------

ALTER TABLE chat_mensagens
  ADD KEY idx_chat_remetente (remetente_id);

ALTER TABLE saas_trial_events
  ADD KEY idx_trial_events_actor (actor_id);

ALTER TABLE rede_scans
  ADD KEY idx_rede_scans_agent (agent_id),
  ADD KEY idx_rede_scans_equipamento (equipamento_id);

ALTER TABLE scanner_jobs
  ADD KEY idx_scanner_jobs_agent (agent_id);

ALTER TABLE sessoes_ativas
  ADD KEY idx_sessao_impersonated_by (impersonated_by),
  ADD KEY idx_sessao_impersonated_filial (impersonated_filial);

ALTER TABLE suporte_chamados
  ADD KEY idx_suporte_filial_fk (filial);

ALTER TABLE operacao_tarefas
  ADD KEY idx_operacao_empresa_fk (empresa);

-- ---------------------------------------------------------------------------
-- 5. Adiciona as relacoes que ja possuem dados consistentes.
-- ---------------------------------------------------------------------------

ALTER TABLE equipamento_ultima_leitura
  ADD CONSTRAINT fk_ultima_equipamento
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_ultima_leitura
    FOREIGN KEY (leitura_id) REFERENCES leituras(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE chamados_comentarios
  ADD CONSTRAINT fk_chamados_comentarios_chamado
    FOREIGN KEY (chamado_id) REFERENCES chamados(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE user_preferences
  ADD CONSTRAINT fk_user_preferences_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE chat_mensagens
  ADD CONSTRAINT fk_chat_remetente
    FOREIGN KEY (remetente_id) REFERENCES usuarios(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE saas_tenant_settings
  ADD CONSTRAINT fk_saas_tenant_filial
    FOREIGN KEY (filial) REFERENCES loja(nome)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE saas_trial_events
  ADD CONSTRAINT fk_trial_event_actor
    FOREIGN KEY (actor_id) REFERENCES usuarios(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE network_probe_agents
  ADD CONSTRAINT fk_probe_agent_filial
    FOREIGN KEY (filial) REFERENCES loja(nome)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE rede_scans
  ADD CONSTRAINT fk_rede_scan_agent
    FOREIGN KEY (agent_id) REFERENCES network_probe_agents(agent_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_rede_scan_equipamento
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE scanner_jobs
  ADD CONSTRAINT fk_scanner_job_agent
    FOREIGN KEY (agent_id) REFERENCES network_probe_agents(agent_id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE sessoes_ativas
  ADD CONSTRAINT fk_sessao_impersonated_by
    FOREIGN KEY (impersonated_by) REFERENCES usuarios(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_sessao_impersonated_filial
    FOREIGN KEY (impersonated_filial) REFERENCES loja(nome)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE chamados
  ADD CONSTRAINT fk_chamado_empresa
    FOREIGN KEY (empresa) REFERENCES empresas(nome)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_chamado_filial
    FOREIGN KEY (filial) REFERENCES loja(nome)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE suporte_chamados
  ADD CONSTRAINT fk_suporte_empresa
    FOREIGN KEY (empresa) REFERENCES empresas(nome)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_suporte_filial
    FOREIGN KEY (filial) REFERENCES loja(nome)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE operacao_tarefas
  ADD CONSTRAINT fk_operacao_empresa
    FOREIGN KEY (empresa) REFERENCES empresas(nome)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. Preserva chamados quando usuario ou equipamento forem removidos.
-- Os nomes abaixo correspondem ao dump e ao banco auditado em 30/09/2026.
-- ---------------------------------------------------------------------------

ALTER TABLE chamados
  DROP FOREIGN KEY chamados_ibfk_1,
  DROP FOREIGN KEY chamados_ibfk_2;

ALTER TABLE chamados
  ADD CONSTRAINT fk_chamado_equipamento
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_chamado_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 7. Pos-validacao: lista as FKs e confirma que nao restaram orfaos diretos.
-- ---------------------------------------------------------------------------

SELECT
  kcu.TABLE_NAME AS tabela,
  kcu.COLUMN_NAME AS coluna,
  kcu.REFERENCED_TABLE_NAME AS tabela_referenciada,
  kcu.REFERENCED_COLUMN_NAME AS coluna_referenciada,
  rc.DELETE_RULE,
  rc.UPDATE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS rc
JOIN information_schema.KEY_COLUMN_USAGE kcu
  ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
 AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
 AND kcu.TABLE_NAME = rc.TABLE_NAME
WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME;

SELECT COUNT(*) AS preferencias_orfas_restantes
FROM user_preferences pref
LEFT JOIN usuarios usr ON usr.id = pref.usuario_id
WHERE usr.id IS NULL;

-- Nao criar ainda FK para filial nestas tabelas:
--   rede_scans, scanner_jobs e operacao_tarefas.
-- Elas possuem os valores de escopo "Todas", "Matriz" ou "Loja Matriz".
-- Primeiro o backend deve migrar esses conceitos para loja_id + scope.
