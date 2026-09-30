# TermoSync Mobile

Aplicativo Expo com a versao web completa do TermoSync dentro de uma shell nativa com visual de app iOS.

A WebView continua carregando a aplicacao React/Vite completa, mantendo as mesmas telas, login, regras e funcionalidades da web. A camada nativa foi desenhada para parecer um aplicativo, nao uma pagina aberta em navegador:

- cabecalho de app com nome do produto e modulo ativo;
- abas inferiores nativas para Inicio, Monitor, Chamados, Chat e Ajustes;
- os atalhos das abas sincronizam a tela ativa da versao web;
- indicador de progresso discreto no topo;
- folha modal iOS para configurar URL da web e da API;
- tela de erro nativa para falhas de conexao;
- area segura para notch, status bar e home indicator.

No celular, somente uma conta com perfil ROOT (`DEV`) ve o formulario compacto de credencial ROOT apos o login, inclusive depois do MFA. As demais contas entram diretamente no dashboard, sem essa verificacao. A tela de boot em formato CMD fica restrita ao desktop.

## Rodar no Expo Go

Para iniciar a API, o frontend e o Expo juntos, execute na raiz do projeto:

```bash
npm run dev:mobile
```

Como alternativa, os serviços podem ser iniciados separadamente. Primeiro, inicie a API normalmente, com o backend ouvindo em `0.0.0.0:3001`. Depois, inicie o frontend web aceitando acesso pela rede local:

```bash
npm run dev --prefix frontend -- --host 0.0.0.0
```

Por fim, inicie o app Expo:

```bash
npm run mobile:start
```

Escaneie o QR Code no Expo Go.

Se o Expo Go ainda mostrar uma tela antiga depois de ajustes no app, feche o app no celular e escaneie novamente o QR Code.

No primeiro acesso, confirme as URLs:

```text
Web: http://IP-DA-SUA-MAQUINA:5173
API: http://IP-DA-SUA-MAQUINA:3001
```

Nao use `127.0.0.1` no celular, porque esse endereco aponta para o proprio aparelho. O app detecta o IPv4 anunciado pelo Expo e migra automaticamente configuracoes antigas. Nesta maquina, o fallback atual usa `http://192.168.200.27:5173` para a web e `http://192.168.200.27:3001` para a API.
