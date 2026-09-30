# Guia de manutenção do frontend

## Navegação

- `src/App.jsx` contém o catálogo de telas, permissões, badges e feature flags.
- `src/config/navigationPolicy.js` contém grupos contextuais, rotas e regras de deduplicação.
- Cada tela pode pertencer a somente uma área de `WORKSPACE_GROUPS`.
- Cada área possui no máximo uma entrada na sidebar; as outras telas são abertas pelas abas contextuais.
- `sidebar: false` remove apenas a entrada lateral. A rota e a permissão continuam válidas.
- Ao adicionar uma tela, inclua o identificador em `SCREEN_PATHS` e cubra a política em `test/navigationPolicy.test.js`.

## Responsividade

- `src/styles/mobile.css` concentra as garantias globais de largura e os breakpoints.
- Até `1366px`, tabelas não podem depender de rolagem horizontal.
- Até `768px`, tabelas com `td[data-label]` são apresentadas como cartões.
- Toda nova célula de tabela operacional deve receber `data-label` com um nome curto.
- Abas e filtros devem quebrar linha; quadros Kanban devem empilhar colunas no celular.
- Regras específicas de página podem ajustar aparência, mas não devem restaurar `min-width` fixo no mobile.

## Erros

- `ErrorBoundary` captura falhas de renderização e delega a apresentação a `SystemErrorScreen`.
- Falhas de módulo devem usar `scope="module"` para preservar o restante da aplicação.
- O diagnóstico copiado não deve incluir token, payload da API, senha ou dados pessoais.
- As prévias `previewError=module` e `previewError=app` funcionam somente em desenvolvimento.

## Comentários

- Comente responsabilidades, decisões, efeitos colaterais e regras de negócio.
- Evite comentários que apenas traduzem uma atribuição ou repetem o nome da função.
- Atualize o comentário quando alterar o contrato do bloco correspondente.
- Prefira JSDoc em funções compartilhadas e títulos de seção em arquivos extensos.
- Componentes, funções, classes e endpoints devem informar responsabilidade, fluxo principal, entradas, retorno e efeitos colaterais.
- Propriedades desestruturadas de componentes devem aparecer como `props.nomeDaPropriedade` no contrato JSDoc.
- O marcador `@maintenance-generated v3` identifica blocos que podem ser atualizados pelo automatizador sem apagar o resumo específico escrito manualmente.
- Execute `node scripts/add-maintenance-comments.js` na raiz depois de criar novos módulos ou funcionalidades.

## Verificação

Execute antes de entregar alterações no frontend:

```powershell
npm run test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Para mudanças de layout, valide pelo menos `390px`, `1024px` e `1440px` e verifique se `scrollWidth` não ultrapassa `clientWidth`.
