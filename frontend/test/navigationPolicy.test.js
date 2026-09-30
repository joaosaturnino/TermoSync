/** Valida as regras de agrupamento, permissão, rotas e seleção da navegação. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTH_SCREEN_PATHS,
  APPLICATION_ROLES,
  DEV_WORKSPACE_IDS,
  FUNCTIONAL_SECTIONS,
  ROLE_SCREEN_ACCESS,
  SCREEN_PATHS,
  WORKSPACE_GROUPS,
  canRoleAccessScreen,
  canRolePerform,
  getAllowedRolesForScreen,
  getAuthenticatedScreenPath,
  getAuthScreenFromPathname,
  getNavigationContext,
  getScreenClassification,
  getSidebarNavigation,
  getSidebarSections,
  getScreenFromPathname,
  shouldShowDeveloperEnvironmentBanner
} from '../src/config/navigationPolicy.js';

test('cada tela pertence a apenas uma área contextual', () => {
  const ids = WORKSPACE_GROUPS.flatMap((group) => group.tabs.map(([id]) => id));
  assert.equal(new Set(ids).size, ids.length);
});

test('todas as telas técnicas estão presentes em uma área DEV', () => {
  const groupedDevIds = new Set(
    WORKSPACE_GROUPS
      .filter((group) => group.id.startsWith('dev_'))
      .flatMap((group) => group.tabs.map(([id]) => id))
  );

  DEV_WORKSPACE_IDS.forEach((id) => assert.ok(groupedDevIds.has(id), `${id} não possui área DEV`));
});

test('matriz de acesso cobre todas as telas e somente perfis conhecidos', () => {
  Object.keys(SCREEN_PATHS).forEach((screenId) => {
    const roles = getAllowedRolesForScreen(screenId);
    assert.ok(roles.length > 0, `${screenId} não possui perfil autorizado`);
    roles.forEach((role) => assert.ok(APPLICATION_ROLES.includes(role)));
  });

  assert.deepEqual(new Set(ROLE_SCREEN_ACCESS.DEV), new Set(Object.keys(SCREEN_PATHS)));
});

test('perfis respeitam os limites da regra de negócio', () => {
  assert.equal(canRoleAccessScreen('DEV', 'sql_terminal'), true);
  assert.equal(canRoleAccessScreen('ADMIN', 'sql_terminal'), false);
  assert.equal(canRoleAccessScreen('ADMIN', 'usuarios'), true);
  assert.equal(canRoleAccessScreen('LOJA', 'usuarios'), false);
  assert.equal(canRoleAccessScreen('LOJA', 'relatorios'), true);
  assert.equal(canRoleAccessScreen('LOJA', 'equipamentos'), false);
  assert.equal(canRoleAccessScreen('MANUTENCAO', 'equipamentos'), true);
  assert.equal(canRoleAccessScreen('MANUTENCAO', 'parametros'), false);
  assert.equal(canRoleAccessScreen('MANUTENCAO', 'historico'), false);
  APPLICATION_ROLES.forEach((role) => assert.equal(canRoleAccessScreen(role, 'centro_comando'), true));
});

test('ações técnicas permanecem separadas da execução operacional da loja', () => {
  assert.equal(canRolePerform('LOJA', 'MANAGE_OPERATION_TASKS'), false);
  assert.equal(canRolePerform('LOJA', 'MANAGE_TICKET_WORKFLOW'), false);
  assert.equal(canRolePerform('LOJA', 'ASSIGN_TICKET_TECHNICIAN'), false);
  ['DEV', 'ADMIN', 'MANUTENCAO'].forEach((role) => {
    assert.equal(canRolePerform(role, 'MANAGE_OPERATION_TASKS'), true);
    assert.equal(canRolePerform(role, 'MANAGE_TICKET_WORKFLOW'), true);
  });
});

test('permissões das telas são compatíveis com suas áreas contextuais', () => {
  WORKSPACE_GROUPS.forEach((workspace) => {
    workspace.tabs.forEach(([screenId]) => {
      getAllowedRolesForScreen(screenId).forEach((role) => {
        assert.ok(workspace.roles.includes(role), `${screenId} permite ${role}, mas a área ${workspace.id} não`);
      });
    });
  });

  APPLICATION_ROLES.forEach((role) => {
    assert.equal(new Set(ROLE_SCREEN_ACCESS[role]).size, ROLE_SCREEN_ACCESS[role].length, `${role} possui telas duplicadas`);
  });
});

test('telas secundárias pertencem ao menu de contexto correto', () => {
  const expectedWorkspaces = {
    resumo_executivo: 'operacao',
    timeline_operacional: 'analises_operacionais',
    central_procedimentos: 'rotinas',
    mapa: 'monitoramento',
    historico_chamados: 'manutencao',
    inventario_iot: 'ativos',
    parametros: 'administracao',
    usuarios: 'administracao',
    historico: 'administracao_auditoria',
    documentacao: 'conta_ajuda',
    privacidade: 'conta_ajuda',
    sobre: 'conta_ajuda'
  };

  Object.entries(expectedWorkspaces).forEach(([screenId, workspaceId]) => {
    assert.equal(getNavigationContext(screenId, [{ id: screenId }]).workspace?.id, workspaceId);
  });
});

test('rotas técnicas usam /dev apenas para o perfil desenvolvedor', () => {
  assert.equal(
    getAuthenticatedScreenPath({ screenId: 'sql_terminal', slug: 'console-sql', userRole: 'DEV' }),
    '/dev/console-sql'
  );
  assert.equal(
    getAuthenticatedScreenPath({ screenId: 'dashboard', slug: 'dashboard-operacional', userRole: 'DEV' }),
    '/sistema/dashboard-operacional'
  );
  assert.equal(
    getAuthenticatedScreenPath({ screenId: 'sql_terminal', slug: 'console-sql', userRole: 'ADMIN' }),
    '/sistema/console-sql'
  );
});

test('slugs são únicos e podem ser convertidos novamente em tela', () => {
  const slugs = Object.values(SCREEN_PATHS);
  assert.equal(new Set(slugs).size, slugs.length);
  Object.entries(SCREEN_PATHS).forEach(([screenId, slug]) => {
    assert.equal(getScreenFromPathname(`/sistema/${slug}`), screenId);
  });
  assert.equal(getScreenFromPathname('/sistema/tela-inexistente'), '');
});

test('rotas públicas são resolvidas pela mesma política', () => {
  Object.entries(AUTH_SCREEN_PATHS).forEach(([screenId, path]) => {
    assert.equal(getAuthScreenFromPathname(path), screenId);
  });
  assert.equal(AUTH_SCREEN_PATHS.trial, '/teste-gratis');
  assert.equal(AUTH_SCREEN_PATHS.register, '/cadastro');
  assert.equal(AUTH_SCREEN_PATHS.terms, '/termos-de-uso');
  assert.equal(AUTH_SCREEN_PATHS.privacyPolicy, '/politica-de-privacidade');
  assert.notEqual(AUTH_SCREEN_PATHS.trial, AUTH_SCREEN_PATHS.register);
});

test('tela contextual mantém o módulo visível como item pai', () => {
  const navigation = [
    { id: 'motores', label: 'Temperatura', sidebar: true },
    { id: 'umidade', label: 'Umidade', sidebar: false },
    { id: 'mapa', label: 'Planta', sidebar: false }
  ];
  const context = getNavigationContext('umidade', navigation);
  assert.equal(context.workspace.id, 'monitoramento');
  assert.equal(context.parentItem.id, 'motores');
  assert.deepEqual(context.workspace.tabs.map((item) => item.id), ['motores', 'umidade', 'mapa']);
});

test('ferramentas de desenvolvimento permanecem separadas por módulo técnico', () => {
  const navigation = [
    { id: 'atualizacoes', label: 'Atualizações' },
    { id: 'bi', label: 'BI', sidebar: false },
    { id: 'sql_terminal', label: 'Console SQL', sidebar: false },
    { id: 'hardware', label: 'Hardware IoT', sidebar: false },
    { id: 'network_scanner', label: 'Sonda de rede', sidebar: false }
  ];

  assert.deepEqual(getSidebarNavigation(navigation).map((item) => item.id), ['atualizacoes', 'bi', 'hardware']);
  assert.equal(getNavigationContext('sql_terminal', navigation).parentItem.id, 'bi');
  assert.equal(getNavigationContext('network_scanner', navigation).parentItem.id, 'hardware');
  assert.equal(getNavigationContext('hardware', navigation).parentItem.id, 'hardware');
});

test('área mantém entrada lateral quando o módulo principal está indisponível', () => {
  const navigation = [
    { id: 'inventario_iot', label: 'Inventário IoT', type: 'Manutenção', sidebar: false },
    { id: 'metrologia', label: 'Metrologia', type: 'Manutenção', sidebar: false }
  ];

  assert.deepEqual(getSidebarNavigation(navigation).map((item) => item.id), ['inventario_iot']);
  assert.equal(getNavigationContext('metrologia', navigation).parentItem.id, 'inventario_iot');
});

test('menus laterais respeitam as responsabilidades de cada perfil', () => {
  const entries = {
    dev: { id: 'dev_panel', type: 'Desenvolvimento' },
    operation: { id: 'dashboard', type: 'Operacional' },
    monitoring: { id: 'motores', type: 'Operacional' },
    services: { id: 'chamados', type: 'Manutenção' },
    assets: { id: 'equipamentos', type: 'Manutenção' },
    analysis: { id: 'relatorios', type: 'Operacional' },
    administration: { id: 'lojas', type: 'Administração' },
    user: { id: 'suporte', type: 'Usuário' }
  };
  const labels = (navigation, role) => getSidebarSections(navigation, role).map((section) => section.label);

  assert.deepEqual(labels(Object.values(entries), 'DEV'), ['Desenvolvimento', 'Operacional', 'Manutenção', 'Administração', 'Usuário']);
  assert.deepEqual(labels([entries.operation, entries.monitoring, entries.services, entries.assets, entries.analysis, entries.administration, entries.user], 'ADMIN'), ['Operacional', 'Manutenção', 'Administração', 'Usuário']);
  assert.deepEqual(labels([entries.operation, entries.monitoring, entries.services, entries.analysis, entries.user], 'LOJA'), ['Operacional', 'Manutenção', 'Usuário']);
  assert.deepEqual(labels([entries.operation, entries.monitoring, entries.services, entries.assets, entries.analysis, entries.user], 'MANUTENCAO'), ['Operacional', 'Manutenção', 'Usuário']);
});

test('somente as cinco categorias funcionais são usadas na navegação', () => {
  const validSections = new Set(Object.values(FUNCTIONAL_SECTIONS));
  WORKSPACE_GROUPS.forEach((workspace) => {
    assert.ok(validSections.has(workspace.section), `${workspace.id} usa a seção inválida ${workspace.section}`);
  });
});

test('cada tela expõe módulo e tipo funcional coerentes', () => {
  assert.deepEqual(getScreenClassification('dashboard'), {
    moduleId: 'operacao', moduleLabel: 'Visão operacional', section: 'Operacional', kind: 'Painéis e indicadores'
  });
  assert.equal(getScreenClassification('checklist_turno').moduleId, 'rotinas');
  assert.equal(getScreenClassification('sql_terminal').moduleId, 'dev_data');
  assert.equal(getScreenClassification('network_scanner').moduleId, 'dev_edge');
  assert.equal(getScreenClassification('timeline_operacional').section, 'Operacional');
  assert.equal(getScreenClassification('equipamentos').section, 'Manutenção');
  assert.equal(getScreenClassification('historico').section, 'Administração');
  assert.equal(getScreenClassification('suporte').section, 'Usuário');
  assert.equal(getScreenClassification('seguranca_conta').moduleId, 'conta_ajuda');
});

test('módulos da mesma seção mantêm a ordem funcional configurada', () => {
  const shuffledDevelopmentModules = [
    { id: 'empresas', type: 'Desenvolvimento' },
    { id: 'atualizacoes', type: 'Desenvolvimento' },
    { id: 'hardware', type: 'Desenvolvimento' },
    { id: 'bi', type: 'Desenvolvimento' },
    { id: 'dev_panel', type: 'Desenvolvimento' }
  ];

  const [developmentSection] = getSidebarSections(shuffledDevelopmentModules, 'DEV');
  assert.deepEqual(
    developmentSection.items.map((item) => item.id),
    ['dev_panel', 'bi', 'hardware', 'atualizacoes', 'empresas']
  );
});

test('abas sem permissão não entram no contexto disponível', () => {
  const context = getNavigationContext('chamados', [
    { id: 'chamados', label: 'Chamados', sidebar: true },
    { id: 'historico_chamados', label: 'Histórico', sidebar: false }
  ]);
  assert.deepEqual(context.workspace.tabs.map((item) => item.id), ['chamados', 'historico_chamados']);
  assert.ok(!context.workspace.tabs.some((item) => item.id === 'kanban'));
});

test('sidebar mantém apenas uma entrada por área contextual', () => {
  const navigation = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'assistente', label: 'Assistente' },
    { id: 'resumo_loja', label: 'Resumo', sidebar: false },
    { id: 'chamados', label: 'Chamados' },
    { id: 'suporte', label: 'Suporte' }
  ];

  assert.deepEqual(
    getSidebarNavigation(navigation).map((item) => item.id),
    ['dashboard', 'assistente', 'chamados', 'suporte']
  );
});

test('item contextual disponível permanece na sidebar quando o pai não é acessível', () => {
  const navigation = [{ id: 'seguranca_conta', label: 'Segurança da Conta' }];
  assert.deepEqual(getSidebarNavigation(navigation).map((item) => item.id), ['seguranca_conta']);
});

test('tela secundária mantém a entrada do seu módulo selecionada', () => {
  const navigation = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'assistente', label: 'Assistente' },
    { id: 'central_procedimentos', label: 'Procedimentos', sidebar: false }
  ];

  const context = getNavigationContext('central_procedimentos', navigation);
  assert.equal(context.parentItem.id, 'assistente');
});

test('aviso de ambiente acompanha o DEV em telas técnicas e compartilhadas', () => {
  const navigation = [
    { id: 'dev_panel', roles: ['DEV'] },
    { id: 'dashboard', roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'] }
  ];

  assert.equal(shouldShowDeveloperEnvironmentBanner({ userRole: 'DEV', hasSession: true, activeScreenId: 'dev_panel', navigation }), true);
  assert.equal(shouldShowDeveloperEnvironmentBanner({ userRole: 'DEV', hasSession: true, activeScreenId: 'dashboard', navigation }), true);
  assert.equal(shouldShowDeveloperEnvironmentBanner({ userRole: 'ADMIN', hasSession: true, activeScreenId: 'dashboard', navigation }), false);
  assert.equal(shouldShowDeveloperEnvironmentBanner({ userRole: 'DEV', hasSession: false, activeScreenId: 'dashboard', navigation }), false);
  assert.equal(shouldShowDeveloperEnvironmentBanner({ userRole: 'DEV', hasSession: true, activeScreenId: 'bloqueada', navigation }), false);
});
