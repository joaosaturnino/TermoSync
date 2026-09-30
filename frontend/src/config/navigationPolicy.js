/**
 * Define as áreas exibidas no menu de contexto e a ordem das abas. Cada tela deve pertencer a
 * no máximo uma área para que o item pai da sidebar e o histórico de navegação permaneçam
 * determinísticos.
 */
// Os dois caminhos de aquisição são rotas independentes para evitar que uma
// demonstração seja confundida com a contratação definitiva da plataforma.
export const AUTH_SCREEN_PATHS = {
  landing: '/',
  login: '/entrar',
  trial: '/teste-gratis',
  register: '/cadastro',
  terms: '/termos-de-uso',
  privacyPolicy: '/politica-de-privacidade'
};

export const SCREEN_PATHS = {
  dashboard: 'dashboard-operacional', dev_panel: 'console-dev', bi: 'inteligencia-bi', soc: 'seguranca-soc',
  atualizacoes: 'atualizacoes', sql_terminal: 'console-sql', websocket_stream: 'live-firehose', network_scanner: 'sonda-rede',
  monitor_edge: 'monitor-edge', simulador: 'simulador', hardware: 'hardware-iot', system: 'infraestrutura', empresas: 'empresas',
  aprovacoes: 'onboarding-saas', saas: 'licencas-saas', billing: 'financeiro', assistente: 'assistente-operacao',
  resumo_loja: 'resumo-loja', central_procedimentos: 'procedimentos', checklist_turno: 'checklist-turno', resumo_turno: 'resumo-turno',
  plano_dia: 'plano-dia', resumo_executivo: 'resumo-executivo', timeline_operacional: 'timeline', mapa: 'planta-digital',
  motores: 'monitoramento-termico', umidade: 'umidade', chamados: 'chamados', sla_chamados: 'sla-chamados', kanban: 'kanban',
  chat: 'chat', metrologia: 'metrologia', inventario_iot: 'inventario-iot', equipamentos: 'equipamentos', parametros: 'parametros',
  historico_chamados: 'historico-chamados', relatorios: 'relatorios', energia: 'energia', historico: 'historico', lojas: 'lojas',
  usuarios: 'usuarios', centro_comando: 'centro-comando', central_saude: 'saude-sistema', suporte: 'suporte',
  seguranca_conta: 'seguranca-conta', documentacao: 'documentacao', privacidade: 'privacidade', sobre: 'sobre'
};

const PATH_TO_SCREEN = Object.fromEntries(Object.entries(SCREEN_PATHS).map(([id, slug]) => [slug, id]));
export const DEV_WORKSPACE_IDS = new Set(['dev_panel', 'bi', 'soc', 'atualizacoes', 'sql_terminal', 'websocket_stream', 'network_scanner', 'monitor_edge', 'simulador', 'hardware', 'system', 'empresas', 'aprovacoes', 'saas', 'billing', 'central_saude']);
export const APPLICATION_ROLES = ['DEV', 'ADMIN', 'LOJA', 'MANUTENCAO'];

const ALL_ROLES = APPLICATION_ROLES;
const MANAGEMENT_ROLES = ['DEV', 'ADMIN'];
const TECHNICAL_ROLES = ['DEV', 'ADMIN', 'MANUTENCAO'];

/**
 * Capacidades de negócio usadas quando executar uma ação exige mais privilégio do que apenas
 * visualizar a tela. Isso mantém a mesma regra em todos os componentes do frontend.
 */
export const ROLE_CAPABILITIES = Object.freeze({
  MANAGE_OPERATION_TASKS: TECHNICAL_ROLES,
  MANAGE_TICKET_WORKFLOW: TECHNICAL_ROLES,
  ASSIGN_TICKET_TECHNICIAN: TECHNICAL_ROLES
});

export function canRolePerform(userRole, capability) {
  return Boolean(ROLE_CAPABILITIES[capability]?.includes(String(userRole || '').toUpperCase()));
}

/**
 * Categorias funcionais exibidas na navegação principal. Os nomes descrevem quem executa o
 * trabalho e para que a tela serve, evitando que conceitos técnicos como "Ativos" ou
 * "Monitoramento" virem seções isoladas e fragmentem um mesmo fluxo de negócio.
 */
export const FUNCTIONAL_SECTIONS = Object.freeze({
  DEVELOPMENT: 'Desenvolvimento',
  OPERATIONAL: 'Operacional',
  MAINTENANCE: 'Manutenção',
  ADMINISTRATION: 'Administração',
  USER: 'Usuário'
});

const SHARED_PLATFORM_SCREENS = ['suporte', 'chat', 'seguranca_conta', 'documentacao', 'privacidade', 'sobre'];
const SHARED_OPERATION_SCREENS = ['dashboard', 'assistente', 'resumo_loja', 'central_procedimentos', 'checklist_turno', 'resumo_turno', 'plano_dia', 'motores', 'umidade', 'chamados', 'centro_comando'];

/**
 * Matriz de autorização da interface. A API continua sendo responsável por validar cada operação,
 * mas menus, rotas e atalhos usam esta mesma fonte para não oferecer telas de outro perfil.
 */
export const ROLE_SCREEN_ACCESS = {
  DEV: Object.keys(SCREEN_PATHS),
  ADMIN: [
    ...SHARED_OPERATION_SCREENS,
    ...SHARED_PLATFORM_SCREENS,
    'resumo_executivo', 'timeline_operacional', 'mapa',
    'historico_chamados', 'sla_chamados', 'kanban',
    'equipamentos', 'inventario_iot', 'metrologia',
    'relatorios', 'energia', 'historico',
    'lojas', 'usuarios', 'parametros'
  ],
  LOJA: [
    ...SHARED_OPERATION_SCREENS,
    ...SHARED_PLATFORM_SCREENS,
    'mapa', 'relatorios', 'energia'
  ],
  MANUTENCAO: [
    ...SHARED_OPERATION_SCREENS,
    ...SHARED_PLATFORM_SCREENS,
    'timeline_operacional', 'historico_chamados', 'sla_chamados', 'kanban',
    'equipamentos', 'inventario_iot', 'metrologia'
  ]
};

export function getAllowedRolesForScreen(screenId) {
  return APPLICATION_ROLES.filter((role) => ROLE_SCREEN_ACCESS[role].includes(screenId));
}

export function canRoleAccessScreen(userRole, screenId) {
  return Boolean(ROLE_SCREEN_ACCESS[userRole]?.includes(screenId));
}

export const WORKSPACE_GROUPS = [
  { id: 'dev_engineering', label: 'Engenharia do sistema', section: FUNCTIONAL_SECTIONS.DEVELOPMENT, kind: 'Administração técnica', roles: ['DEV'], tabs: [['dev_panel', 'Console'], ['central_saude', 'Saúde'], ['soc', 'SOC'], ['system', 'Infraestrutura']] },
  { id: 'dev_data', label: 'Dados e inteligência', section: FUNCTIONAL_SECTIONS.DEVELOPMENT, kind: 'Diagnóstico', roles: ['DEV'], tabs: [['bi', 'BI'], ['sql_terminal', 'SQL'], ['websocket_stream', 'Eventos']] },
  { id: 'dev_edge', label: 'Edge e IoT', section: FUNCTIONAL_SECTIONS.DEVELOPMENT, kind: 'Ferramentas técnicas', roles: ['DEV'], tabs: [['hardware', 'Hardware'], ['monitor_edge', 'Serial'], ['network_scanner', 'Rede'], ['simulador', 'Simulador']] },
  { id: 'dev_delivery', label: 'Entregas', section: FUNCTIONAL_SECTIONS.DEVELOPMENT, kind: 'Deploy', roles: ['DEV'], tabs: [['atualizacoes', 'Atualizações']] },
  { id: 'dev_saas', label: 'Gestão SaaS', section: FUNCTIONAL_SECTIONS.DEVELOPMENT, kind: 'Administração comercial', roles: ['DEV'], tabs: [['empresas', 'Organizações'], ['aprovacoes', 'Onboarding'], ['saas', 'Licenças'], ['billing', 'Financeiro']] },
  { id: 'operacao', label: 'Visão operacional', section: FUNCTIONAL_SECTIONS.OPERATIONAL, kind: 'Painéis e indicadores', roles: ALL_ROLES, tabs: [['dashboard', 'Visão geral'], ['resumo_loja', 'Loja'], ['resumo_executivo', 'Executivo'], ['centro_comando', 'Comando']] },
  { id: 'rotinas', label: 'Rotinas operacionais', section: FUNCTIONAL_SECTIONS.OPERATIONAL, kind: 'Fluxos de trabalho', roles: ALL_ROLES, tabs: [['assistente', 'Assistente'], ['checklist_turno', 'Checklist'], ['resumo_turno', 'Turno'], ['plano_dia', 'Plano'], ['central_procedimentos', 'Procedimentos']] },
  { id: 'monitoramento', label: 'Monitoramento ambiental', section: FUNCTIONAL_SECTIONS.OPERATIONAL, kind: 'Tempo real', roles: ALL_ROLES, tabs: [['motores', 'Temperatura'], ['umidade', 'Umidade'], ['mapa', 'Planta']] },
  { id: 'analises_operacionais', label: 'Análises operacionais', section: FUNCTIONAL_SECTIONS.OPERATIONAL, kind: 'Histórico e desempenho', roles: ALL_ROLES, tabs: [['relatorios', 'Relatórios'], ['energia', 'Energia'], ['timeline_operacional', 'Timeline']] },
  { id: 'manutencao', label: 'Atendimento técnico', section: FUNCTIONAL_SECTIONS.MAINTENANCE, kind: 'Chamados e SLA', roles: ALL_ROLES, tabs: [['chamados', 'Chamados'], ['kanban', 'Kanban'], ['sla_chamados', 'SLA'], ['historico_chamados', 'Histórico']] },
  { id: 'ativos', label: 'Gestão de ativos', section: FUNCTIONAL_SECTIONS.MAINTENANCE, kind: 'Inventário e conformidade', roles: TECHNICAL_ROLES, tabs: [['equipamentos', 'Equipamentos'], ['inventario_iot', 'Inventário IoT'], ['metrologia', 'Metrologia']] },
  { id: 'administracao', label: 'Administração organizacional', section: FUNCTIONAL_SECTIONS.ADMINISTRATION, kind: 'Cadastros e políticas', roles: MANAGEMENT_ROLES, tabs: [['lojas', 'Lojas'], ['usuarios', 'Usuários'], ['parametros', 'Parâmetros']] },
  { id: 'administracao_auditoria', label: 'Auditoria administrativa', section: FUNCTIONAL_SECTIONS.ADMINISTRATION, kind: 'Segurança e rastreabilidade', roles: MANAGEMENT_ROLES, tabs: [['historico', 'Logs']] },
  { id: 'colaboracao', label: 'Atendimento e colaboração', section: FUNCTIONAL_SECTIONS.USER, kind: 'Comunicação', roles: ALL_ROLES, tabs: [['suporte', 'Suporte'], ['chat', 'Chat']] },
  { id: 'conta_ajuda', label: 'Conta e informações', section: FUNCTIONAL_SECTIONS.USER, kind: 'Autocuidado e referência', roles: ALL_ROLES, tabs: [['seguranca_conta', 'Segurança'], ['documentacao', 'Documentação'], ['privacidade', 'Privacidade'], ['sobre', 'Sobre']] }
];

export const SIDEBAR_SECTIONS_BY_ROLE = {
  DEV: Object.values(FUNCTIONAL_SECTIONS),
  ADMIN: [FUNCTIONAL_SECTIONS.OPERATIONAL, FUNCTIONAL_SECTIONS.MAINTENANCE, FUNCTIONAL_SECTIONS.ADMINISTRATION, FUNCTIONAL_SECTIONS.USER],
  LOJA: [FUNCTIONAL_SECTIONS.OPERATIONAL, FUNCTIONAL_SECTIONS.MAINTENANCE, FUNCTIONAL_SECTIONS.USER],
  MANUTENCAO: [FUNCTIONAL_SECTIONS.OPERATIONAL, FUNCTIONAL_SECTIONS.MAINTENANCE, FUNCTIONAL_SECTIONS.USER]
};

/** Retorna a classificação funcional única usada pela sidebar e pelo menu contextual. */
export function getScreenClassification(screenId) {
  const module = WORKSPACE_GROUPS.find((candidate) => candidate.tabs.some(([id]) => id === screenId));
  if (!module) return null;
  return { moduleId: module.id, moduleLabel: module.label, section: module.section, kind: module.kind };
}

/**
 * Concentra a logica de should show developer environment banner para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {boolean} options.hasSession - Sinalizador hasSession que controla este comportamento visual.
 * @param {unknown} options.activeScreenId - Propriedade activeScreenId usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.navigation - Propriedade navigation usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function shouldShowDeveloperEnvironmentBanner({ userRole, hasSession, activeScreenId, navigation = [] }) {
  return userRole === 'DEV' && hasSession && navigation.some((item) => item.id === activeScreenId);
}

/**
 * Normaliza normalize pathname para evitar divergencia de formato nas comparacoes.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} pathname - Valor de pathname consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export const normalizePathname = (pathname) => pathname.replace(/\/+$/, '') || '/';

/**
 * Resolve uma rota autenticada para o identificador interno da tela.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: interage com APIs do navegador
 *
 * @param {unknown} pathname - Valor de pathname consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function getScreenFromPathname(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  const match = normalizePathname(pathname).match(/^\/(?:sistema|dev)\/([^/]+)$/i);
  return match ? PATH_TO_SCREEN[decodeURIComponent(match[1]).toLowerCase()] || '' : '';
}

/**
 * Resolve uma rota pública para o estado correspondente da autenticação.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: interage com APIs do navegador
 *
 * @param {unknown} pathname - Valor de pathname consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function getAuthScreenFromPathname(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  const normalizedPath = normalizePathname(pathname);
  return Object.entries(AUTH_SCREEN_PATHS).find(([, path]) => path === normalizedPath)?.[0] || 'landing';
}

/**
 * Localiza a área contextual que contém uma tela.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {string|number} screenId - Identificador do registro ou recurso processado.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function getWorkspaceForScreen(screenId) {
  return WORKSPACE_GROUPS.find((workspace) => workspace.tabs.some(([id]) => id === screenId)) || null;
}

/**
 * Mantém uma única porta de entrada na sidebar para cada área contextual. A primeira tela
 * acessível vence; assim perfis restritos ainda recebem um destino válido quando a tela
 * principal da área não está disponível.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} navigation - Valor de navigation consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function getSidebarNavigation(navigation = []) {
  const availableById = new Map(navigation.map((item) => [item.id, item]));
  const workspaceParents = new Map();

  WORKSPACE_GROUPS.forEach((workspace) => {
    const availableItems = workspace.tabs
      .map(([id]) => availableById.get(id))
      .filter(Boolean);
    const parent = availableItems.find((item) => item.sidebar !== false) || availableItems[0];
    if (parent) workspaceParents.set(workspace.id, parent.id);
  });

  return navigation.filter((item) => {
    const workspace = getWorkspaceForScreen(item.id);
    if (!workspace) return item.sidebar !== false;
    return workspaceParents.get(workspace.id) === item.id;
  });
}

/**
 * Agrupa as entradas laterais conforme a responsabilidade de cada perfil. A navegação recebida
 * já deve estar filtrada pelas permissões do usuário; esta função apenas garante ordem e separação
 * consistentes entre os quatro papéis da aplicação.
 */
export function getSidebarSections(navigation = [], userRole = '') {
  const sidebarNavigation = getSidebarNavigation(navigation);
  const moduleOrder = new Map(WORKSPACE_GROUPS.map((module, index) => [module.id, index]));
  const configuredOrder = SIDEBAR_SECTIONS_BY_ROLE[userRole] || SIDEBAR_SECTIONS_BY_ROLE.LOJA;
  const knownSections = new Set(configuredOrder);
  const sectionOrder = [
    ...configuredOrder,
    ...sidebarNavigation.map((item) => item.type).filter((type) => type && !knownSections.has(type))
  ];

  return [...new Set(sectionOrder)]
    .map((label) => ({
      label,
      items: sidebarNavigation
        .filter((item) => item.type === label)
        .sort((left, right) => {
          const leftModule = getWorkspaceForScreen(left.id);
          const rightModule = getWorkspaceForScreen(right.id);
          return (moduleOrder.get(leftModule?.id) ?? Infinity) - (moduleOrder.get(rightModule?.id) ?? Infinity);
        })
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Monta as abas disponíveis e determina qual item da sidebar representa a tela. Telas
 * secundárias apontam para a entrada única da área, mantendo o destaque lateral enquanto a aba
 * correta continua ativa no menu de contexto.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {string|number} screenId - Identificador do registro ou recurso processado.
 * @param {unknown} navigation - Valor de navigation consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function getNavigationContext(screenId, navigation = []) {
  const activeItem = navigation.find((item) => item.id === screenId) || null;
  const workspace = getWorkspaceForScreen(screenId);
  const availableIds = new Set(navigation.map((item) => item.id));
  const sidebarIds = new Set(getSidebarNavigation(navigation).map((item) => item.id));
   /**
    * Concentra a logica de tabs para manter o restante do modulo mais legivel.
    *
    * Responsabilidade: mantém este comportamento isolado para que validação,
    * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
    *
    * Fluxo principal:
    * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
    *
    * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
    *
    * @returns {unknown} Resultado calculado para consumo do chamador.
    * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
    */

  /**
   * Concentra a logica de tabs para manter o restante do modulo mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const tabs = (workspace?.tabs || [])
    .filter(([id]) => availableIds.has(id))
    .map(([id, tabLabel]) => ({ ...navigation.find((item) => item.id === id), tabLabel }));
  const parentItem = activeItem && sidebarIds.has(activeItem.id)
    ? activeItem
    : tabs.find((item) => sidebarIds.has(item.id)) || activeItem;

  return { activeItem, workspace: workspace ? { ...workspace, tabs } : null, parentItem };
}

/**
 * Decide se o aviso de ambiente deve acompanhar a tela autenticada atual. A decisão usa a
 * identidade da sessão, e não a categoria da tela, para que o perfil DEV continue vendo o
 * alerta também nos módulos compartilhados.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.screenId - Propriedade screenId usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.slug - Propriedade slug usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function getAuthenticatedScreenPath({ screenId, slug, userRole }) {
  const namespace = userRole === 'DEV' && DEV_WORKSPACE_IDS.has(screenId) ? 'dev' : 'sistema';
  return `/${namespace}/${slug}`;
}
