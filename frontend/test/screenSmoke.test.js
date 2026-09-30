/** Garante que todas as telas lazy suportem o primeiro render antes das APIs responderem. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: (key) => values.delete(String(key)),
    clear: () => values.clear()
  };
};

// As telas são componentes de navegador. Estes stubs cobrem somente leituras feitas
// durante o primeiro render; efeitos e chamadas externas continuam sem execução no SSR.
globalThis.sessionStorage = createStorage();
globalThis.localStorage = createStorage();
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    language: 'pt-BR',
    platform: 'test',
    userAgent: 'TermoSync screen smoke test',
    userAgentData: null
  }
});
globalThis.window = {
  innerWidth: 1440,
  innerHeight: 900,
  location: {
    origin: 'https://thermosync.test',
    href: 'https://thermosync.test/',
    pathname: '/',
    search: '',
    hash: ''
  },
  screen: { width: 1440, height: 900, availWidth: 1440, availHeight: 860 },
  navigator: globalThis.navigator,
  sessionStorage: globalThis.sessionStorage,
  localStorage: globalThis.localStorage,
  atob: globalThis.atob,
  btoa: globalThis.btoa,
  console,
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  setTimeout,
  clearTimeout
};
globalThis.document = {
  title: 'TermoSync',
  fullscreenElement: null,
  documentElement: { requestFullscreen: async () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  exitFullscreen: async () => {}
};

const screens = [
  ['LandingPage', '/src/pages/LandingPage/LandingPage.jsx'],
  ['Register', '/src/pages/Register/Register.jsx'],
  ['Login', '/src/pages/Login/Login.jsx'],
  ['PortalPublico', '/src/pages/PortalPublico/PortalPublico.jsx'],
  ['Dashboard', '/src/pages/Dashboard/Dashboard.jsx'],
  ['AssistenteOperacao', '/src/pages/AssistenteOperacao/AssistenteOperacao.jsx'],
  ['ResumoLoja', '/src/pages/ResumoLoja/ResumoLoja.jsx'],
  ['CentralProcedimentos', '/src/pages/CentralProcedimentos/CentralProcedimentos.jsx'],
  ['ChecklistTurno', '/src/pages/ChecklistTurno/ChecklistTurno.jsx'],
  ['ResumoTurno', '/src/pages/ResumoTurno/ResumoTurno.jsx'],
  ['PlanoDia', '/src/pages/PlanoDia/PlanoDia.jsx'],
  ['ResumoExecutivo', '/src/pages/ResumoExecutivo/ResumoExecutivo.jsx'],
  ['CentralSaudeSistema', '/src/pages/CentralSaudeSistema/CentralSaudeSistema.jsx'],
  ['TimelineOperacional', '/src/pages/TimelineOperacional/TimelineOperacional.jsx'],
  ['InventarioIoT', '/src/pages/InventarioIoT/InventarioIoT.jsx'],
  ['SLAChamados', '/src/pages/SLAChamados/SLAChamados.jsx'],
  ['Suporte', '/src/pages/Suporte/Suporte.jsx'],
  ['CentroComando', '/src/pages/CentroComando/CentroComando.jsx'],
  ['MapaCalor', '/src/pages/MapaCalor/MapaCalor.jsx'],
  ['Kanban', '/src/pages/Kanban/Kanban.jsx'],
  ['Metrologia', '/src/pages/Metrologia/Metrologia.jsx'],
  ['Simulador', '/src/pages/Simulador/Simulador.jsx'],
  ['HardwareIoT', '/src/pages/HardwareIoT/HardwareIoT.jsx'],
  ['SegurancaConta', '/src/pages/SegurancaConta/SegurancaConta.jsx'],
  ['Sobre', '/src/pages/Sobre/Sobre.jsx'],
  ['Chat', '/src/pages/Chat/Chat.jsx'],
  ['Monitoramento', '/src/pages/Monitoramento/Monitoramento.jsx'],
  ['Equipamentos', '/src/pages/Equipamentos/Equipamentos.jsx'],
  ['Relatorios', '/src/pages/Relatorios/Relatorios.jsx'],
  ['GestaoEnergetica', '/src/pages/GestaoEnergetica/GestaoEnergetica.jsx'],
  ['HistoricoLogs', '/src/pages/HistoricoLogs/HistoricoLogs.jsx'],
  ['Chamados', '/src/pages/Chamados/Chamados.jsx'],
  ['HistoricoChamados', '/src/pages/HistoricoChamados/HistoricoChamados.jsx'],
  ['AprovacoesSaaS', '/src/pages/AprovacoesSaaS/AprovacoesSaaS.jsx'],
  ['GestaoLojas', '/src/pages/GestaoLoja/GestaoLojas.jsx'],
  ['GestaoUsuarios', '/src/pages/GestaoUsuarios/GestaoUsuarios.jsx'],
  ['ParametrosGlobais', '/src/pages/ParametrosGlobais/ParametrosGlobais.jsx'],
  ['CentroInteligenciaBI', '/src/pages/CentroInteligenciaBI/CentroInteligenciaBI.jsx'],
  ['PainelDesenvolvedor', '/src/pages/PainelDesenvolvedor/PainelDesenvolvedor.jsx'],
  ['Documentacao', '/src/pages/Documentacao/Documentacao.jsx'],
  ['Privacidade', '/src/pages/Privacidade/Privacidade.jsx'],
  ['LegalDocument', '/src/pages/Legal/LegalDocument.jsx']
];

const noop = () => {};
const apiResult = { data: [] };
const api = {
  get: async () => apiResult,
  post: async () => apiResult,
  put: async () => apiResult,
  patch: async () => apiResult,
  delete: async () => apiResult
};
const socket = { on: noop, off: noop, emit: noop };

const baseProps = {
  api,
  socket,
  showToast: noop,
  onNavigate: noop,
  setModalConfig: noop,
  carregarDadosBase: noop,
  carregarChamados: noop,
  carregarUsuarios: noop,
  carregarParametrosGerais: noop,
  editarEquipamento: noop,
  pedirExclusao: noop,
  pedirNotaResolucao: noop,
  resolverTodasNotificacoes: noop,
  gerarExportacao: noop,
  gerarLoteOS: noop,
  fazerLogout: noop,
  onAuthenticate: noop,
  onLogout: noop,
  updateSysConfig: noop,
  tocarAlarme: noop,
  setHistoricoChat: noop,
  setContatoAtivo: noop,
  setNaoLidasPorContato: noop,
  equipamentos: [],
  equipamentosDaFilial: [],
  equipamentosFiltradosLista: [],
  notificacoes: [],
  notificacoesDaFilial: [],
  historicoAlertas: [],
  historicoFiltradoLista: [],
  chamados: [],
  tecnicosDb: [],
  contatosDb: [],
  usuariosLista: [],
  filiaisDb: [],
  listaSetores: [],
  listaTipos: [],
  historicoChat: {},
  naoLidasPorContato: {},
  dadosDonutStatus: [],
  navigationCatalog: [],
  sysConfig: {},
  systemHealth: { status: 'online' },
  filialAtiva: 'Todas',
  userFilial: 'Todas',
  userRole: 'DEV',
  nomeLogado: 'Teste',
  userId: 1,
  qtdTotal: 0,
  qtdOperando: 0,
  qtdDegelo: 0,
  qtdFalha: 0,
  isOffline: false,
  isDarkMode: true,
  isDevAuthenticated: true,
  isTemp: true,
  abaAtiva: 'dev_panel'
};

test('todas as telas renderizam com o estado inicial sem dados', async (context) => {
  const vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false }
  });

  try {
    for (const [name, modulePath] of screens) {
      await context.test(name, async () => {
        const loaded = await vite.ssrLoadModule(modulePath);
        assert.equal(typeof loaded.default, 'function', `${name} precisa exportar um componente padrão`);
        const element = React.createElement(
          MemoryRouter,
          { initialEntries: ['/'] },
          React.createElement(loaded.default, baseProps)
        );
        const html = renderToString(element);
        assert.ok(html.length > 0, `${name} não produziu conteúdo no primeiro render`);
      });
    }
  } finally {
    await vite.close();
  }
});
