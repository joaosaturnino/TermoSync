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

## Rodar no Expo Go

1. Inicie a API normalmente, com o backend ouvindo em `0.0.0.0:3000`.
2. Inicie o frontend web aceitando acesso pela rede local:

```bash
npm run dev --prefix frontend -- --host 0.0.0.0
```

3. Inicie o app Expo:

```bash
npm run mobile:start
```

4. Escaneie o QR Code no Expo Go.

Se o Expo Go ainda mostrar uma tela antiga depois de ajustes no app, feche o app no celular e escaneie novamente o QR Code.

No primeiro acesso, confirme as URLs:

```text
Web: http://IP-DA-SUA-MAQUINA:5173
API: http://IP-DA-SUA-MAQUINA:3000
```

Nao use `127.0.0.1` no celular, porque esse endereco aponta para o proprio aparelho. Nesta maquina, a configuracao padrao usa `http://172.16.0.81:5173` para a web e `http://172.16.0.81:3000` para a API.
