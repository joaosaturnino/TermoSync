-- ==============================================================================
-- TERMOSYNC - SCRIPT COMPLETO DE TUNING E PERFORMANCE (23 TABELAS)
-- Objetivo: Acelerar tempo de resposta, BI, Chat, Telemetria IoT e Multi-Tenant
-- ==============================================================================

-- ==============================================================================
-- 1. EMPRESAS (1/23)
-- Acelera filtros por status e consultas administrativas
-- ==============================================================================
ALTER TABLE `empresas`
  ADD INDEX `idx_emp_status` (`status`);

-- ==============================================================================
-- 2. LOJA (2/23)
-- Elimina lentidão em seleções de filiais por empresa e status
-- ==============================================================================
ALTER TABLE `loja`
  ADD INDEX `idx_loja_empresa_status` (`empresa`, `status`),
  ADD INDEX `idx_loja_status` (`status`);

-- ==============================================================================
-- 3. SETORES (3/23)
-- (Tabela enxuta: a UNIQUE KEY `nome` já garante busca instantânea)[cite: 6]
-- ==============================================================================
-- Nenhum índice adicional necessário.

-- ==============================================================================
-- 4. TIPOS_REFRIGERACAO (4/23)
-- (Tabela de referência: a UNIQUE KEY `nome` cobre todas as buscas)[cite: 6]
-- ==============================================================================
-- Nenhum índice adicional necessário.

-- ==============================================================================
-- 5. TECNICOS (5/23)
-- Acelera listagens em ordem alfabética no momento de abrir ordens de serviço
-- ==============================================================================
ALTER TABLE `tecnicos`
  ADD INDEX `idx_tecnicos_nome` (`nome`);

-- ==============================================================================
-- 6. USUARIOS (6/23)
-- Otimiza autenticação de login, filtragem por empresa/papel e lista de contatos[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `usuarios`
  ADD INDEX `idx_usr_empresa_role` (`empresa`, `role`),
  ADD INDEX `idx_usr_filial_role` (`filial`, `role`),
  ADD INDEX `idx_usr_manutencao` (`role`, `nome_tecnico`);

-- ==============================================================================
-- 7. EQUIPAMENTOS (7/23) - [PRIORIDADE CRÍTICA]
-- Resolve lentidão no carregamento de lojas, Resumo Operacional e gráficos de BI[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `equipamentos`
  ADD INDEX `idx_equip_empresa_filial` (`empresa`, `filial`),
  ADD INDEX `idx_equip_filial_setor` (`filial`, `setor`),
  ADD INDEX `idx_equip_status_mecanico` (`motor_ligado`, `em_degelo`),
  ADD INDEX `idx_equip_nome` (`nome`);

-- ==============================================================================
-- 8. HARDWARE_IOT (8/23)
-- Acelera o monitoramento de dispositivos offline/online e status de conexão[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `hardware_iot`
  ADD INDEX `idx_hw_ultima_comunicacao` (`ultima_comunicacao`),
  ADD INDEX `idx_hw_ip_local` (`ip_local`);

-- ==============================================================================
-- 9. CONFIGURACOES (9/23)
-- (A UNIQUE KEY `idx_chave` já otimiza as verificações Zero-Trust e Manutenção)[cite: 5, 6]
-- ==============================================================================
-- Nenhum índice adicional necessário.

-- ==============================================================================
-- 10. SESSOES_ATIVAS (10/23)
-- Evita travamento na tela do SOC (Security Operations Center) ao listar sessões[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `sessoes_ativas`
  ADD INDEX `idx_sess_revogado_login` (`revogado`, `data_login`),
  ADD INDEX `idx_sess_usuario` (`usuario_id`, `revogado`);

-- ==============================================================================
-- 11. AUDIT_LOGS (11/23)
-- Otimiza a ordenação das últimas 100 ações na tela de auditoria[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `audit_logs`
  ADD INDEX `idx_audit_data_hora` (`data_hora`),
  ADD INDEX `idx_audit_acao` (`acao`, `data_hora`);

-- ==============================================================================
-- 12. PRE_CADASTROS (12/23)
-- Acelera o painel de aprovações pendentes do Onboarding[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `pre_cadastros`
  ADD INDEX `idx_precad_status_data` (`status`, `data_solicitacao`),
  ADD INDEX `idx_precad_cnpj` (`cnpj`);

-- ==============================================================================
-- 13. CHAT_MENSAGENS (13/23)
-- Acelera abertura instantânea do Chat e filtragem de conversas ponto a ponto[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `chat_mensagens`
  ADD INDEX `idx_chat_data_hora` (`data_hora`),
  ADD INDEX `idx_chat_conversas` (`destino_id`, `remetente_id`, `data_hora`);

-- ==============================================================================
-- 14. NOTIFICACOES (14/23) - [PRIORIDADE CRÍTICA]
-- Acaba com o gargalo que ocorria a cada requisição POST /api/leituras[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `notificacoes`
  ADD INDEX `idx_notif_check_alerta` (`equipamento_id`, `resolvido`, `tipo_alerta`),
  ADD INDEX `idx_notif_resolvido_data` (`resolvido`, `data_hora`);

-- ==============================================================================
-- 15. LEITURAS (15/23)
-- (Tabela de alto volume: `idx_equip_data` e `idx_data_hora` já estão presentes[cite: 6]. 
--  Adicionamos índice composto para consumo elétrico no BI)[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `leituras`
  ADD INDEX `idx_leituras_consumo` (`data_hora`, `consumo_kwh`);

-- ==============================================================================
-- 16. CHAMADOS (16/23)
-- Elimina lentidão ao abrir o painel operacional da loja e listagem por urgência[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `chamados`
  ADD INDEX `idx_chamados_empresa_filial` (`empresa`, `filial`, `status`),
  ADD INDEX `idx_chamados_status_abertura` (`status`, `data_abertura`),
  ADD INDEX `idx_chamados_tecnico` (`tecnico_id`, `status`);

-- ==============================================================================
-- 17. FATURAS_SAAS (17/23)
-- Otimiza o cálculo financeiro, MRR/ARR e verificação de vencimento[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `faturas_saas`
  ADD INDEX `idx_faturas_status_plano` (`status`, `plano`),
  ADD INDEX `idx_faturas_vencimento` (`data_vencimento`);

-- ==============================================================================
-- 18. OPERACAO_TAREFAS (18/23)
-- Acelera o carregamento do checklist de turno nas lojas e filtragem de status[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `operacao_tarefas`
  ADD INDEX `idx_tarefas_filial_ordem` (`filial`, `created_at`),
  ADD INDEX `idx_tarefas_concluida` (`concluida`);

-- ==============================================================================
-- 19. SUPORTE_ARTIGOS (19/23)
-- Acelera a ordenação da Central de Ajuda por destaque e data[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `suporte_artigos`
  ADD INDEX `idx_artigos_ordem` (`ativo`, `destaque`, `updated_at`);

-- ==============================================================================
-- 20. SUPORTE_CHAMADOS (20/23)
-- Acelera a abertura do histórico de tickets de suporte por filial/empresa[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `suporte_chamados`
  ADD INDEX `idx_sup_empresa_criado` (`empresa`, `filial`, `criado_em`);

-- ==============================================================================
-- 21. SUPORTE_CHAMADO_HISTORICO (21/23)
-- (A KEY `idx_suporte_chamado_historico_chamado` já cobre a leitura cronológica)[cite: 6]
-- ==============================================================================
-- Nenhum índice adicional necessário.

-- ==============================================================================
-- 22. SYS_RELATORIOS_LOG (22/23)
-- Otimiza consultas aos relatórios exportados no sistema[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `sys_relatorios_log`
  ADD INDEX `idx_sysrel_data_geracao` (`data_geracao`);

-- ==============================================================================
-- 23. SYSTEM_CHANGELOG (23/23)
-- Acelera o carregamento das últimas 20 versões publicadas[cite: 5, 6]
-- ==============================================================================
ALTER TABLE `system_changelog`
  ADD INDEX `idx_changelog_date` (`date`, `id`);