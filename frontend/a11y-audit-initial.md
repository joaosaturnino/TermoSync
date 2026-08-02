# Auditoria de Acessibilidade — Varredura Inicial

Data: 2026-08-01
Escopo: frontend/ (varredura estática rápida por padrões comuns: `onClick`, `aria-`, `role=`, `alt=`, `tabIndex`)

Resumo rápido
- Ocorrências detectadas: 340 correspondências em 38 arquivos (varredura por padrões heurísticos).
- Arquivos mais afetados (exemplos): `src/App.jsx`, `src/components/Header.jsx`, `src/components/Sidebar.jsx`, `src/pages/Chat/Chat.jsx`, `src/pages/Suporte/Suporte.jsx`, `src/pages/Monitoramento/Monitoramento.jsx`, `src/pages/Simulador/Simulador.jsx`, `src/pages/GestaoLoja/GestaoLojas.jsx`, `src/pages/Equipamentos/Equipamentos.jsx`, `src/pages/Metrologia/Metrologia.jsx`, `src/pages/HistoricoLogs/HistoricoLogs.jsx`, `src/pages/Suporte/SuporteTriagem.jsx`, `src/pages/Suporte/SuporteAcompanhamento.jsx`, entre outros.

Problemas heurísticos encontrados (exemplos a investigar)
- Uso extensivo de `onClick` em elementos que nem sempre são `button` (divs, spans) — requer roles, `tabIndex` e handlers de teclado (`onKeyDown`) para acessibilidade por teclado.
- Modais e overlays com `onClick` em divs — verificar `role="dialog"`, `aria-modal`, foco inicial e retorno de foco (focus trap).
- Elementos decorativos (ícones) precisam de `aria-hidden="true"` quando não informativos; imagens devem ter `alt` apropriado ou `alt=""` se decorativas.
- Alguns elementos usam `tabIndex="-1"` ou `tabIndex` manualmente; revisar finalidade e usabilidade por teclado.
- Alguns botões usam `button` corretamente — estes são bons exemplos a replicar.

Recomendações imediatas (ação sugerida)
1. Executar localmente `eslint` com `eslint-plugin-jsx-a11y` para gerar relatório detalhado e aplicar `--fix` quando seguro.
2. Priorizar correções de baixo risco:
   - Adicionar `aria-hidden="true"` a ícones puramente decorativos.
   - Substituir `div`/`span` clicáveis por `button` onde aplicável.
   - Para casos onde mudança para `button` não é possível, adicionar `role="button"`, `tabIndex="0"` e handler `onKeyDown` (Enter/Space).
   - Garantir que modais tenham `role="dialog"`, `aria-modal="true"` e gerenciamento de foco.
3. Gerar um PR com correções automáticas apenas para padrões triviais (ícones decorativos, atributos `aria-hidden`, e conversões simples `div` -> `button`) — pedir revisão humana antes do merge.
4. Testes: rodar `axe-core` (ex.: `axe-core` + Puppeteer ou `jest-axe`) em páginas críticas (Monitoramento, Chat, Suporte, Equipamentos) para validar problemas de contraste, foco e landmarks.

Limitações desta varredura
- Heurística baseada em busca de padrões; não detecta automaticamente imagens sem `alt` (apenas presença de `alt=`), nem verifica contraste de cores, nem interações dinâmicas complexas.
- Correções automáticas podem introduzir mudanças de comportamento — recomenda-se revisão manual e testes locais.

Próximos passos que posso executar para você
- Gerar PR com correções automáticas seguras (ícones decorativos + aria-hidden e `alt=""`).
- Criar configuração de `eslint` com `jsx-a11y` e instruções de execução (`package.json` scripts), sem instalar dependências locais.
- Marcar automaticamente arquivos que usam `onClick` em elementos não-button e criar checklist detalhado por arquivo.

Quer que eu: (responda o número)
1) Gere um PR com correções automáticas seguras agora (ícones decorativos e `aria-hidden`, pequenas mudanças triviais). 
2) Crie as configurações e instruções para rodar `eslint --fix` localmente e gere um relatório detalhado por arquivo (lista de ocorrências).
3) Apenas continue com a auditoria manual detalhada e gere checklist por arquivo (sem aplicar mudanças).
4) Cancelar/pausar auditoria (não fazer mais alterações agora).

---
Relatório gerado automaticamente pelo agente — revise e diga qual ação prefere seguir.
