# Auditoria de fontes de dados

## Objetivo

Esta auditoria separa dados operacionais, que devem vir do backend, de constantes
de interface, como filtros, rótulos, permissões e cenários deliberados do simulador.

## Fluxos corrigidos

- A Central de Procedimentos lê `operacao_procedimentos` e salva favoritos e
  progresso em `user_preferences`.
- Checklist de turno e Plano do Dia são provisionados pelo backend e sempre
  retornados de `operacao_tarefas`, com isolamento por empresa e filial.
- Configurações globais, módulos, recursos, manutenção e parâmetros financeiros
  são lidos de `configuracoes`; planos ficam em `saas_tenant_settings`.
- O Core Financeiro não cria faturas, históricos ou séries temporais no cliente
  quando a API falha. A tela exibe somente registros de `faturas_saas`.
- PDFs financeiros usam ID, CNPJ, endereço e valores cadastrados, sem documentos
  aleatórios.
- A rota legada `/logs` consulta `leituras`, `equipamentos` e `hardware_iot`.
- O chat não fabrica transcrições. Sem um provedor configurado, informa que o
  recurso está indisponível.

## Constantes mantidas intencionalmente

- Opções de filtro, categorias, colunas Kanban e metadados de layout.
- Conteúdo institucional, documentação e política de privacidade.
- Cenários da tela Simulador e aleatoriedade do processo `simulador.js`, cuja
  finalidade é gerar telemetria de laboratório.
- Estados vazios e valores zero usados antes da primeira resposta da API.

## Verificação

- O bootstrap do backend cria e popula tabelas de forma idempotente.
- APIs protegidas mantêm o escopo de empresa e filial.
- O frontend possui estados explícitos de carregamento, vazio e falha.
- O build de produção deve ser executado após mudanças em contratos da API.
