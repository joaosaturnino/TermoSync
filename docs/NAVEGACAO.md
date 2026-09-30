# Navegação do ThermoSync

## Fonte de verdade

As rotas e áreas contextuais ficam em `frontend/src/config/navigationPolicy.js`.
O registro visual fica no array `NAVIGATION` de `frontend/src/App.jsx`, pois badges
e disponibilidade dependem de dados em tempo real. A autorização por perfil fica
em `ROLE_SCREEN_ACCESS`, na política central. Uma tela nova deve existir nos dois
registros.

## Categorias funcionais

- **Desenvolvimento:** ferramentas internas exclusivas do perfil `DEV`.
- **Operacional:** operação diária, rotinas, monitoramento e análises da operação;
  pode conter telas compartilhadas pelos quatro perfis.
- **Manutenção:** chamados, SLA, equipamentos, inventário IoT e metrologia. O perfil
  `LOJA` acessa apenas a abertura e o acompanhamento dos próprios chamados.
- **Administração:** cadastros, políticas e auditoria; exclusiva de `DEV` e `ADMIN`.
- **Usuário:** suporte, chat, segurança da conta, documentação e informações gerais;
  compartilhada pelos quatro perfis.

## Regras

- Cada tela autenticada possui um ID estável e um slug único em `SCREEN_PATHS`.
- Telas técnicas usam `/dev/:slug` somente para o perfil `DEV`; as demais usam
  `/sistema/:slug`.
- Uma tela pode pertencer a no máximo uma área em `WORKSPACE_GROUPS`.
- A primeira aba visível da área é o módulo pai no sidebar.
- Telas com `sidebar: false` são acessadas pelas tabs contextuais, busca global,
  links internos ou histórico recente, sem aumentar a navegação principal.
- A lista ativa sempre é filtrada por perfil, feature flag, módulo oculto e
  autenticação de desenvolvedor antes de montar tabs e breadcrumbs.
- Voltar e avançar no navegador devem restaurar a tela correspondente à URL.
- Filtros operacionais e a posição de rolagem são preservados para reduzir
  retrabalho ao alternar entre módulos.

## Checklist para nova tela

1. Adicionar ID, slug e área contextual.
2. Registrar label, ícone, perfis e visibilidade no `NAVIGATION`.
3. Renderizar o módulo dentro do boundary e do `Suspense` da aplicação.
4. Confirmar o item pai do sidebar e o breadcrumb.
5. Adicionar teste em `frontend/test/navigationPolicy.test.js`.
6. Rodar `npm test`, `npm run lint` e `npm run build` no frontend.
