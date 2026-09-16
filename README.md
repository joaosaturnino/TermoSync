# TermoSync

Sistema para monitoramento de refrigeracao, gestao operacional de cameras frias, chamados tecnicos, telemetria IoT, BI executivo e apoio a operacao de lojas.

## Visao geral

O projeto e dividido em quatro frentes principais:

- `backend/`: API Express, autenticacao, Socket.io, MQTT, regras de seguranca, integracoes de e-mail/SMS/WhatsApp e persistencia MySQL.
- `frontend/`: aplicacao React/Vite com dashboard operacional, gestao de chamados, BI, inventario IoT, energia, seguranca de conta e telas administrativas.
- `mobile/`: app Expo/React Native que encapsula a experiencia mobile.
- `scripts/`: rotinas auxiliares de verificacao, smoke test e manutencao de comentarios.

## Requisitos

- Node.js 20 ou superior.
- MySQL/MariaDB acessivel ao backend.
- NPM.
- Navegador moderno para o frontend.
- Expo, quando for rodar o app mobile.

## Instalacao

Na raiz do projeto:

```bash
npm run install:all
npm run mobile:install
```

Crie o arquivo de ambiente do backend a partir do exemplo:

```bash
copy .env.example backend\.env
```

Depois revise banco, JWT, CORS, MQTT, SMTP, SMS e tokens de ingestao conforme o ambiente.

## Desenvolvimento

Para subir backend e frontend juntos:

```bash
npm run dev
```

Para incluir o simulador de telemetria:

```bash
npm run dev:simulador
```

Scripts uteis:

- `npm run check`: valida sintaxe do backend, lint e build do frontend.
- `npm run check:env`: valida variaveis importantes para producao.
- `npm run predeploy`: roda validacao de ambiente e build antes de publicar.
- `npm run smoke`: executa teste rapido contra uma API ja online.
- `npm run mobile:start`: inicia o Expo em modo offline na porta configurada.
- `npm run mobile:tunnel`: inicia o Expo com tunel.

## Estrutura de codigo

Backend:

- `backend/server.js`: inicializacao do servidor, middlewares globais, Socket.io, MQTT e rotas.
- `backend/routes/api.js`: endpoints REST da aplicacao.
- `backend/config/db.js`: conexao MySQL e migracoes idempotentes.
- `backend/middlewares/`: autenticacao, autorizacao, headers e limites.
- `backend/services/`: servicos reutilizaveis de saude e operacao.
- `backend/utils/`: auditoria, MFA e utilitarios.

Frontend:

- `frontend/src/App.jsx`: orquestracao global, sessao, roteamento interno e dados compartilhados.
- `frontend/src/components/`: componentes globais como header, sidebar, modais e estados vazios.
- `frontend/src/pages/`: telas de negocio e operacao.
- `frontend/src/hooks/`: hooks compartilhados de seguranca e nucleo do sistema.
- `frontend/src/config/api.js`: descoberta da URL da API para web e mobile.
- `frontend/src/styles/`: tokens, responsividade e ajustes mobile.

Mobile:

- `mobile/App.js`: entrada visual do app Expo.
- `mobile/index.js`: registro da aplicacao.
- `mobile/assets/`: icones e splash.

## Documentacao

- [Guia de manutencao](docs/MANUTENCAO.md): mapa do codigo, boas praticas por modulo e checklist de entrega.
- [Guia de producao](docs/PRODUCAO.md): variaveis, deploy, backup, smoke test e rollback.

## Rotina recomendada antes de entregar

1. Revise se a mudanca respeita escopo de empresa/filial.
2. Rode `npm run check`.
3. Valide a tela alterada em desktop e mobile.
4. Para producao, rode `npm run predeploy`.
5. Registre no guia de manutencao qualquer regra nova que nao seja obvia pelo codigo.

## Observacoes de manutencao

Os arquivos `.js` e `.jsx` possuem comentarios curtos nas funcoes principais para facilitar manutencao futura. Para reaplicar comentarios de forma idempotente nos pontos ainda sem descricao:

```bash
node scripts/add-maintenance-comments.js
```

O script ignora dependencias, builds, caches, sessoes do WhatsApp e pastas geradas.
