/**
 * Testes mínimos de renderização para componentes usados durante a inicialização.
 * Esses componentes precisam funcionar antes que qualquer módulo lazy seja exibido;
 * uma referência ausente aqui transforma um carregamento comum em falha global.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Percorre o código-fonte para validar contratos CSS que afetam todas as telas.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} directory - Valor de directory consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const listFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolutePath = path.join(directory, entry.name);
  if (entry.isDirectory()) return listFiles(absolutePath);
  return entry.isFile() ? [absolutePath] : [];
});

test('Loader renderiza enquanto um módulo lazy é carregado', async () => {
  // O servidor Vite transforma JSX e CSS exatamente como na aplicação, mas sem abrir uma porta.
  const vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false }
  });

  try {
    const { default: Loader } = await vite.ssrLoadModule('/src/components/Loader.jsx');
    const html = renderToString(React.createElement(Loader, { message: 'Carregando módulo de teste' }));

    assert.match(html, /Carregando módulo de teste/);
    assert.match(html, /ts-loader-container/);
  } finally {
    await vite.close();
  }
});

test('DevBoot carrega seu contrato visual e renderiza o terminal administrativo', async () => {
  const source = readFileSync(path.join(frontendRoot, 'src/components/DevBootScreen.jsx'), 'utf8');
  const css = readFileSync(path.join(frontendRoot, 'src/components/DevBootScreen.css'), 'utf8');
  assert.match(source, /import ['"]\.\/DevBootScreen\.css['"]/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /grid-template-rows:\s*48px minmax\(0, 1fr\) auto/);

  const vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false }
  });

  try {
    const { default: DevBootScreen } = await vite.ssrLoadModule('/src/components/DevBootScreen.jsx');
    const html = renderToString(React.createElement(DevBootScreen, { onComplete: () => {}, authToken: '' }));
    assert.match(html, /dev-boot dev-boot-cyan/);
    assert.match(html, /TermoSync Developer Console/);
    assert.match(html, /dev-boot-terminal/);
  } finally {
    await vite.close();
  }
});

test('Hardware IoT renderiza antes da primeira resposta da API', async () => {
  const vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false }
  });

  try {
    const { default: HardwareIoT } = await vite.ssrLoadModule('/src/pages/HardwareIoT/HardwareIoT.jsx');
    const html = renderToString(React.createElement(HardwareIoT, {
      showToast: () => {},
      isOffline: false,
      socket: null,
      setModalConfig: () => {}
    }));

    assert.match(html, /Hardware IoT/);
    assert.match(html, /Sincronizando frota/);
    assert.match(html, /Sem versões reportadas/);
    assert.match(html, /Nenhum evento recente/);
  } finally {
    await vite.close();
  }
});

test('Console SQL carrega o catálogo de tabelas ao abrir', () => {
  const source = readFileSync(path.join(frontendRoot, 'src/pages/PainelDesenvolvedor/PainelDesenvolvedor.jsx'), 'utf8');

  assert.match(source, /api\.get\('\/system\/sql-console\/metadata'\)/);
  assert.match(source, /useEffect\(\(\) => \{\s*carregarMetadados\(\);\s*\}, \[carregarMetadados\]\);/);
  assert.match(source, /Array\.isArray\(payload\.tables\)/);
  assert.match(source, /sql-schema-error/);
});

test('Sidebar não exibe nem mantém o menu de recentes', () => {
  const sidebarSource = readFileSync(path.join(frontendRoot, 'src/components/Sidebar.jsx'), 'utf8');
  const appSource = readFileSync(path.join(frontendRoot, 'src/App.jsx'), 'utf8');

  assert.doesNotMatch(sidebarSource, /recentScreenIds|sidebar-recents|>\s*Recentes\s*</);
  assert.doesNotMatch(appSource, /recentScreenIds|termosync_recent_screens/);
});

test('paleta operacional preserva quatro níveis de alerta sem variáveis circulares', () => {
  const globalCss = readFileSync(path.join(frontendRoot, 'src/styles/global.css'), 'utf8');

  assert.match(globalCss, /--alert-green:\s*#10b981/);
  assert.match(globalCss, /--alert-yellow:\s*#fbbf24/);
  assert.match(globalCss, /--alert-orange:\s*#f59e0b/);
  assert.match(globalCss, /--alert-red:\s*#ef4444/);

  const circularVariable = /--([a-zA-Z0-9-]+)\s*:\s*var\(--\1\)/;
  const invalidFiles = listFiles(path.join(frontendRoot, 'src'))
    .filter((file) => file.endsWith('.css'))
    .filter((file) => circularVariable.test(readFileSync(file, 'utf8')));

  assert.deepEqual(invalidFiles, []);
});

test('folhas de estilo reutilizam os tokens canônicos de cor', () => {
  const globalPath = path.join(frontendRoot, 'src/styles/global.css');
  // Cores de estado e neutros recorrentes pertencem ao contrato global. Este teste
  // impede que uma tela volte a criar uma cópia local difícil de manter.
  const duplicatedPalette = /#(?:fff(?:fff)?|f8fafc|f1f5f9|e2e8f0|cbd5e1|334155|071318|0b1b21|10242b|e5edf7|c5d2df|8fa3b5|60778b|aebbd0|27c6a0|10b981|34d399|fbbf24|f59e0b|ef4444|f87171|38bdf8|22d3ee|a855f7|94a3b8|020617|0f172a|0b1120|1e293b)\b/i;
  const invalidFiles = listFiles(path.join(frontendRoot, 'src'))
    .filter((file) => file.endsWith('.css') && file !== globalPath)
    .filter((file) => duplicatedPalette.test(readFileSync(file, 'utf8')));

  assert.deepEqual(invalidFiles, []);
});

test('telas com estilos dedicados importam seus próprios contratos visuais', () => {
  const styledScreens = [
    ['components/ActionCenter.jsx', './ActionCenter.css'],
    ['components/CentralAjudaModal.jsx', './CentralAjudaModal.css'],
    ['components/CommandPalette.jsx', './CommandPalette.css'],
    ['components/LegalModal.jsx', './LegalModal.css'],
    ['components/LockScreen.jsx', './LockScreen.css'],
    ['components/SystemErrorScreen.jsx', './SystemErrorScreen.css'],
    ['pages/Documentacao/Documentacao.jsx', './Documentacao.css'],
    ['pages/Privacidade/Privacidade.jsx', './Privacidade.css'],
    ['pages/MapaCalor/MapaCalor.jsx', './MapaCalor.css'],
    ['pages/PortalPublico/PortalPublico.jsx', './PortalPublico.css'],
    ['pages/PainelDesenvolvedor/LiveFirehose.jsx', './LiveFirehose.css'],
    ['pages/PainelDesenvolvedor/NetworkProbe.jsx', './NetworkProbe.css'],
    ['pages/PainelDesenvolvedor/SerialEdgeMonitor.jsx', './SerialEdgeMonitor.css']
  ];

  for (const [sourcePath, cssImport] of styledScreens) {
    const source = readFileSync(path.join(frontendRoot, 'src', sourcePath), 'utf8');
    assert.ok(source.includes(`import '${cssImport}';`), `${sourcePath} deve importar ${cssImport}`);
  }
});
