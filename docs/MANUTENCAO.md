# Guia de Manutencao do TermoSync

Este documento resume os blocos principais do sistema para orientar futuras manutencoes. Os comentarios no codigo explicam os pontos mais sensiveis; use este guia como mapa de navegacao.

## Como navegar no projeto

Comece por estes arquivos quando precisar entender um fluxo:

1. `frontend/src/App.jsx` para saber quais dados globais e telas existem.
2. `frontend/src/pages/<Modulo>/<Modulo>.jsx` para a regra visual da tela.
3. `backend/routes/api.js` para localizar o endpoint consumido pela tela.
4. `backend/config/db.js` para entender tabelas, migracoes e indices.
5. `backend/middlewares/auth.js` e `backend/middlewares/security.js` para conferir permissao, tenant e auditoria.

Evite procurar regra de negocio em CSS. Os estilos devem tratar apresentacao; filtro, permissao, calculo e persistencia ficam em JS/backend.

## Backend

### `backend/server.js`

Ponto de entrada do backend. Configura Express, CORS, Socket.io, headers de seguranca, logs HTTP, rate limit geral e rate limit especifico para telemetria IoT.

Ao alterar este arquivo, mantenha a ordem dos middlewares: contexto de seguranca, logs, headers, CORS, rate limit, parser JSON e por fim rotas.

### `backend/config/db.js`

Inicializa o pool MySQL e executa migracoes idempotentes. O arquivo foi feito para subir sobre bases antigas, entao muitos `ALTER TABLE` ignoram coluna duplicada.

Ao adicionar indice ou coluna, prefira blocos tolerantes a duplicidade para evitar crash em ambientes ja provisionados.

### `backend/middlewares/auth.js`

Valida JWT e confirma a sessao no banco. A autenticacao e fail-closed: se o banco nao confirma a sessao, a API rejeita a request.

Ao criar novas rotas protegidas, use `verificarToken` antes do handler.

### `backend/middlewares/security.js`

Concentra headers, contexto de request, logs lentos, rate limit, politicas de senha e autorizacao por papel/permissao.

Ao criar rota sensivel, prefira `requireRoles` ou `requirePermission` em vez de checagens soltas.

### `backend/routes/api.js`

Arquivo principal de endpoints. Os blocos estao divididos por dominio:

- Saude e diagnostico.
- Chat, BI e financeiro.
- Login, MFA, sessoes e senha.
- Empresas, usuarios, lojas, equipamentos e hardware IoT.
- Leituras, notificacoes, chamados, suporte e relatorios.
- SOC, auditoria, purge, deploy, SQL controlado e onboarding.
- MQTT, scanner de rede e portal publico.

Cuidados principais:

- Sempre aplicar escopo por empresa/filial em dados de tenant.
- Evitar retorno sem `LIMIT` em tabelas historicas.
- Nao fazer queries em loop quando for possivel buscar em lote.
- Registrar evento de seguranca em acao administrativa ou falha sensivel.

### `backend/services/systemHealthService.js`

Centraliza diagnosticos de saude do servidor, banco e recursos locais. Use este servico para novas checagens operacionais em vez de espalhar probes por rotas diferentes.

### `backend/sockets.js`

Concentra eventos em tempo real. Ao adicionar evento novo, documente nome, payload esperado e quem consome no frontend.

### `backend/simulador.js`

Gera telemetria local para teste. Nao use como referencia de autenticacao de sensores reais sem conferir `IOT_INGEST_TOKEN` e limites de ingestao.

## Frontend

### `frontend/src/App.jsx`

Orquestrador principal da aplicacao. Mantem sessao, tema, densidade visual, dados compartilhados, sockets, notificacoes, badges e roteamento de telas.

Ao alterar dados compartilhados, verifique quais telas recebem a prop correspondente antes de mudar o formato.

### `frontend/src/hooks/useSecurity.jsx`

Valida a sessao contra o backend ao abrir/recarregar o app. Se a sessao foi revogada, limpa o navegador e chama logout.

### `frontend/src/hooks/useSystemCore.js`

Controla matriz de UI, features por papel/usuario, planos SaaS e modo manutencao local. DEV deve continuar enxergando todos os modulos.

### `frontend/src/components/Header.jsx`

Cabecalho global. Exibe breadcrumb, notificacoes, estado do sistema, comando rapido, som, densidade visual, fullscreen e tema.

### `frontend/src/pages/Kanban/Kanban.jsx`

Tela de Gestao Agil. Usa agrupamento em uma passada, cards memoizados e renderizacao incremental para nao travar com muitos chamados.

### `frontend/src/pages/HistoricoChamados/HistoricoChamados.jsx`

Tela de laudos e historico. Usa busca diferida, filtro otimizado e botao "Mostrar mais" para evitar renderizacao massiva.

### `frontend/src/pages/Chat/Chat.jsx`

Normaliza mensagens vindas do MySQL e Socket.io. Mantem compatibilidade entre historico local e historico global do `App.jsx`.

### `frontend/src/pages/PainelDesenvolvedor/PainelDesenvolvedor.jsx`

Terminal administrativo com subtelas de NOC, Sistema, SaaS, Billing, SOC, BI, Atualizacoes, SQL, WebSocket e Edge/ESP32.

Ao alterar esta tela, preserve as protecoes de timeout em chamadas diretas a IPs de hardware.

### `frontend/src/config/api.js`

Resolve automaticamente a URL do backend para web, localhost, subdominios `.localhost` e mobile/Capacitor. Se mudar porta ou estrategia de deploy, atualize este arquivo e o `.env.example`.

### `frontend/src/pages/CentroInteligenciaBI/CentroInteligenciaBI.jsx`

Painel executivo de DRE, FinOps e risco IoT. Cria OS preventiva a partir de ativo de alto risco. Ao alterar, preserve a diferenca entre atualizacao silenciosa e carregamento inicial.

### `frontend/src/pages/GestaoEnergetica/GestaoEnergetica.jsx`

Calcula consumo, custo estimado, carbono, pico de demanda e ranking de equipamentos. Se trocar fonte de dados, mantenha o retorno agregado compativel com os graficos.

### `frontend/src/components/DevBootScreen.jsx`

Terminal visual de acesso administrativo. A autenticacao real acontece no backend; comandos publicos sao apenas auxiliares visuais. Nunca coloque credenciais fixas neste componente.

## Mobile

### `mobile/App.js`

Entrada do app Expo. Deve continuar simples e resiliente, porque o mobile depende de URL do backend configuravel e pode abrir em redes diferentes.

### `mobile/README.md`

Contem instrucoes especificas do app mobile. Atualize quando alterar porta, modo tunnel/offline ou empacotamento.

## Estilos

### `frontend/src/App.css`

Base visual do sistema: layout principal, header, sidebar, cards, formularios, tabelas, modais, toasts e responsividade global.

### `frontend/src/styles/mobile.css`

Camada mobile/native. Garante safe-area, toque minimo, grids fluidos, tabelas com scroll e modais responsivos.

### `frontend/src/styles/global.css`

Design tokens, temas, animacoes, scrollbars e utilitarios globais.

## Checklist antes de entregar mudancas

1. Rodar `npm run check`.
2. Para entrega em producao, rodar tambem `npm run check:env` e seguir `docs/PRODUCAO.md`.
3. Conferir se rotas novas respeitam empresa/filial.
4. Evitar requests em loop e listas historicas sem limite.
5. Testar telas em largura mobile, tablet e desktop.

## Padroes para novas funcoes

- Escreva um comentario curto acima de funcoes exportadas, componentes, hooks, handlers complexos e calculos memoizados.
- Prefira comentarios que expliquem a responsabilidade da funcao, nao cada linha.
- Se a funcao acessa banco, API externa, permissao ou dado sensivel, cite essa dependencia no comentario.
- Mantenha nomes descritivos. Comentario nao deve compensar nome confuso.
- Para telas React, separe carregamento de dados, derivacoes `useMemo`, handlers de acao e renderizacao.

## Seguranca e multi-tenant

- Toda rota protegida deve passar por autenticacao antes de consultar ou alterar dados.
- Dados de loja, empresa, usuario, equipamento, chamados e leituras precisam respeitar escopo de tenant.
- Acoes administrativas devem registrar auditoria.
- Nunca exponha tokens, senha, QR code, `.env` ou backup no frontend.
- Evite mensagens de erro que revelem estrutura interna do banco.

## Performance

- Use `LIMIT`, paginacao ou filtros de data em historicos.
- No frontend, use `useMemo` apenas para derivacoes custosas ou listas grandes.
- Evite `setState` em loop; agregue dados primeiro e atualize uma vez.
- Em graficos, reduza a serie quando houver muitos pontos.
- Para chamadas de rede frequentes, preserve debounce, polling moderado ou atualizacao via socket.

## Comentarios de manutencao

Para reaplicar comentarios basicos em funcoes ainda sem descricao:

```bash
node scripts/add-maintenance-comments.js
```

O script e idempotente: ele verifica se ja existe comentario imediatamente acima da funcao antes de inserir outro. Ele tambem ignora `node_modules`, builds, caches, `.expo` e sessoes do WhatsApp.
