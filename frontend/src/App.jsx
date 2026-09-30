/**
 * Módulo: frontend/src/App.jsx
 * Responsabilidade: Orquestra sessão, dados globais, navegação e composição das telas autenticadas.
 */

import { AUTH_SCREEN_PATHS, SCREEN_PATHS, canRoleAccessScreen, getAllowedRolesForScreen, getAuthScreenFromPathname, getAuthenticatedScreenPath, getNavigationContext, getScreenClassification, getScreenFromPathname, normalizePathname, shouldShowDeveloperEnvironmentBanner } from './config/navigationPolicy';
import { isMobileDevice } from './config/api';
import { startTransition, useLayoutEffect } from 'react';
import { BookOpen } from 'lucide-react';
import LockScreen from './components/LockScreen';
import ErrorBoundary from './components/ErrorBoundary';
import Documentacao from './pages/Documentacao/Documentacao';
import Privacidade from './pages/Privacidade/Privacidade';
import SystemFooter from './components/SystemFooter';
import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from 'react';
import logger from './utils/logger';
import axios from 'axios';
import { io } from 'socket.io-client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'react-datepicker/dist/react-datepicker.css';

import './styles/global.css';
import './App.css';
import './styles/mobile.css';

import {
  Activity, Thermometer, Droplets, Leaf, History, Wrench, Archive,
  Store, Sliders, Users, X, CheckCircle, AlertTriangle,
  AlertOctagon, Edit, Save, MessageSquare, Terminal,
  Server, LockKeyhole, Loader2, ShieldAlert, DollarSign, Building2,
  Bell, Wifi, Snowflake, Power, DoorOpen, ActivitySquare, ClipboardCheck, ThermometerSnowflake,
  Map, Columns, Target, Cpu, Info, Settings2, ShieldCheck, PieChart,
  Rocket, Database, Network, Sparkles, ClipboardList, BarChart3, CalendarDays, KeyRound, LifeBuoy, Zap, Radio, Clock, Timer, Search
} from 'lucide-react';

// Importação dos Componentes de UI Modulares
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CommandPalette from './components/CommandPalette';
import Loader from './components/Loader';

import DevBootScreen from './components/DevBootScreen';

const LandingPage = lazy(() => import('./pages/LandingPage/LandingPage'));
const Register = lazy(() => import('./pages/Register/Register'));
const Login = lazy(() => import('./pages/Login/Login'));
const LegalDocument = lazy(() => import('./pages/Legal/LegalDocument'));
const PortalPublico = lazy(() => import('./pages/PortalPublico/PortalPublico'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const AssistenteOperacao = lazy(() => import('./pages/AssistenteOperacao/AssistenteOperacao'));
const ResumoLoja = lazy(() => import('./pages/ResumoLoja/ResumoLoja'));
const CentralProcedimentos = lazy(() => import('./pages/CentralProcedimentos/CentralProcedimentos'));
const ChecklistTurno = lazy(() => import('./pages/ChecklistTurno/ChecklistTurno'));
const ResumoTurno = lazy(() => import('./pages/ResumoTurno/ResumoTurno'));
const PlanoDia = lazy(() => import('./pages/PlanoDia/PlanoDia'));
const ResumoExecutivo = lazy(() => import('./pages/ResumoExecutivo/ResumoExecutivo'));
const CentralSaudeSistema = lazy(() => import('./pages/CentralSaudeSistema/CentralSaudeSistema'));
const TimelineOperacional = lazy(() => import('./pages/TimelineOperacional/TimelineOperacional'));
const InventarioIoT = lazy(() => import('./pages/InventarioIoT/InventarioIoT'));
const SLAChamados = lazy(() => import('./pages/SLAChamados/SLAChamados'));
const Suporte = lazy(() => import('./pages/Suporte/Suporte'));
const CentroComando = lazy(() => import('./pages/CentroComando/CentroComando'));
const MapaCalor = lazy(() => import('./pages/MapaCalor/MapaCalor'));
const Kanban = lazy(() => import('./pages/Kanban/Kanban'));
const Metrologia = lazy(() => import('./pages/Metrologia/Metrologia'));
const Simulador = lazy(() => import('./pages/Simulador/Simulador'));
const HardwareIoT = lazy(() => import('./pages/HardwareIoT/HardwareIoT'));
const SegurancaConta = lazy(() => import('./pages/SegurancaConta/SegurancaConta'));
const Sobre = lazy(() => import('./pages/Sobre/Sobre'));
const Chat = lazy(() => import('./pages/Chat/Chat'));
const Monitoramento = lazy(() => import('./pages/Monitoramento/Monitoramento'));
const Equipamentos = lazy(() => import('./pages/Equipamentos/Equipamentos'));
const Relatorios = lazy(() => import('./pages/Relatorios/Relatorios'));
const GestaoEnergetica = lazy(() => import('./pages/GestaoEnergetica/GestaoEnergetica'));
const HistoricoLogs = lazy(() => import('./pages/HistoricoLogs/HistoricoLogs'));
const Chamados = lazy(() => import('./pages/Chamados/Chamados'));
const HistoricoChamados = lazy(() => import('./pages/HistoricoChamados/HistoricoChamados'));
const AprovacoesSaaS = lazy(() => import('./pages/AprovacoesSaaS/AprovacoesSaaS'));
const GestaoLojas = lazy(() => import('./pages/GestaoLoja/GestaoLojas'));
const GestaoUsuarios = lazy(() => import('./pages/GestaoUsuarios/GestaoUsuarios'));
const ParametrosGlobais = lazy(() => import('./pages/ParametrosGlobais/ParametrosGlobais'));
const CentroInteligenciaBI = lazy(() => import('./pages/CentroInteligenciaBI/CentroInteligenciaBI'));
const PainelDesenvolvedor = lazy(() => import('./pages/PainelDesenvolvedor/PainelDesenvolvedor'));

import { useSystemCore } from './hooks/useSystemCore';
import { useSecurity } from './hooks/useSecurity';
import { getApiUrl, getSocketUrl } from './config/api.js';

const TRIAL_GUIDE_STEPS = [
  { screen: 'dashboard', label: 'Visão geral', description: 'Indicadores da operação' },
  { screen: 'motores', label: 'Temperaturas', description: 'Telemetria em tempo real' },
  { screen: 'chamados', label: 'Chamados', description: 'Atendimento e manutenção' },
  { screen: 'relatorios', label: 'Relatórios', description: 'Histórico e análises' },
  { screen: 'seguranca_conta', label: 'Segurança', description: 'Proteção da conta' }
];

/**
 * Busca ou monta os dados de get alert config usados no fluxo atual.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} tipo_alerta - Valor de tipo alerta consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const getAlertConfig = (tipo_alerta) => {
  // Mapeia cada tipo de anomalia para ícone, cor e ação sugerida exibida na UI.
  const configs = {
    'REDE': { icon: Wifi, color: 'var(--warning)', action: 'Analisar Rede', critical: true },
    'DEGELO': { icon: Snowflake, color: 'var(--secondary)', action: 'Finalizar Degelo', critical: false },
    'MECANICA': { icon: Power, color: 'var(--warning)', action: 'Acionar Manutenção', critical: true },
    'PORTA': { icon: DoorOpen, color: 'var(--danger)', action: 'Verificar Porta', critical: true },
    'TEMPERATURA': { icon: ThermometerSnowflake, color: 'var(--danger)', action: 'Normalizar Temp.', critical: true },
    'UMIDADE': { icon: Droplets, color: 'var(--info)', action: 'Ajustar Umidade', critical: false },
    'METROLOGIA': { icon: ClipboardCheck, color: 'var(--accent-violet)', action: 'Agendar Calibração', critical: true },
    'PREDITIVO': { icon: ActivitySquare, color: 'var(--accent-violet)', action: 'Prevenção', critical: false }
  };
  return configs[tipo_alerta] || { icon: AlertTriangle, color: 'var(--danger)', action: 'Investigar', critical: true };
};


/**
 * Prepara escape html para exibicao sem expor dados sensiveis.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');


/**
 * Formata format toast message para exibicao segura na interface.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} message - Valor de message consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatToastMessage = (message) => escapeHtml(message)
  .replace(/&lt;b&gt;/gi, '<strong>')
  .replace(/&lt;\/b&gt;/gi, '</strong>')
  .replace(/&lt;strong&gt;/gi, '<strong>')
  .replace(/&lt;\/strong&gt;/gi, '</strong>')
  .replace(/&lt;br&gt;/gi, '<br>')
  .replace(/&lt;br\/&gt;/gi, '<br>');

const MOBILE_PRIMARY_NAV_BY_ROLE = {
  DEV: ['dev_panel', 'bi', 'system', 'hardware', 'suporte'],
  ADMIN: ['dashboard', 'motores', 'chamados', 'relatorios', 'usuarios'],
  MANUTENCAO: ['dashboard', 'motores', 'chamados', 'equipamentos', 'checklist_turno'],
  LOJA: ['dashboard', 'assistente', 'motores', 'chamados', 'chat']
};

const MOBILE_NAV_LABELS = {
  dev_panel: 'Controle',
  bi: 'BI',
  system: 'Sistema',
  hardware: 'IoT',
  suporte: 'Suporte',
  dashboard: 'Inicio',
  assistente: 'Assistir',
  motores: 'Sensores',
  chamados: 'Chamados',
  kanban: 'Fluxo',
  chat: 'Chat',
  usuarios: 'Acessos',
  equipamentos: 'Equip.',
  central_saude: 'Saude',
  timeline_operacional: 'Linha',
  inventario_iot: 'IoT',
  sla_chamados: 'SLA'
};

/**
 * Rotas públicas e nomes amigáveis das telas internas. Os IDs continuam sendo usados no estado
 * da aplicação, enquanto a URL expõe nomes legíveis e estáveis.
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
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const isTvPathname = (pathname = window.location.pathname) => /^\/(?:painel-tv|live)\//i.test(pathname);

/**
 * Renderiza a aplicação autenticada e coordena sessão, navegação, dados globais e recuperação
 * de falhas.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador; registra ou remove listeners de eventos; publica ou consome mensagens MQTT
 *
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function App() {
  // Estados de autenticação persistem em sessionStorage para sobreviver ao reload
  // sem manter sessão aberta indefinidamente após fechar o navegador.
  const initialImpersonateCode = useRef(new URLSearchParams(window.location.search).get('impersonateCode'));
  const impersonationExchangeStarted = useRef(false);
  const routeSyncReadyRef = useRef(false);
  const [authScreen, setAuthScreen] = useState(() => getAuthScreenFromPathname());
  const [isImpersonating, setIsImpersonating] = useState(Boolean(initialImpersonateCode.current));
  const [impersonateError, setImpersonateError] = useState('');

  useEffect(() => {
    document.documentElement.classList.add('mobile-app', 'native-app');
    document.body.classList.add('mobile-app', 'native-app');
    return () => {
      document.documentElement.classList.remove('mobile-app', 'native-app');
      document.body.classList.remove('mobile-app', 'native-app');
    };
  }, []);

  const [token, setToken] = useState(initialImpersonateCode.current ? '' : (sessionStorage.getItem('token') || ''));
  const [userId, setUserId] = useState(sessionStorage.getItem('userId') || '');
  const [userRole, setUserRole] = useState(sessionStorage.getItem('userRole') || 'LOJA');
  const [userFilial, setUserFilial] = useState(sessionStorage.getItem('userFilial') || 'Todas');
  const [userEmpresa, setUserEmpresa] = useState(sessionStorage.getItem('userEmpresa') || '');
  const [trialInfo, setTrialInfo] = useState(() => ({
    active: sessionStorage.getItem('isTrial') === 'true',
    lifetime: sessionStorage.getItem('demoLifetime') === 'true',
    expiresAt: sessionStorage.getItem('trialExpiresAt') || ''
  }));
  const [mustChangePassword, setMustChangePassword] = useState(sessionStorage.getItem('mustChangePassword') === 'true');
  const [showTrialGuide, setShowTrialGuide] = useState(false);
  const [trialGuideVisited, setTrialGuideVisited] = useState(() => new Set());
  const [nomeLogado, setNomeLogado] = useState(sessionStorage.getItem('nomeLogado') || '');
  const [papelLogado, setPapelLogado] = useState(sessionStorage.getItem('papelLogado') || '');
  const [loginAtivo, setLoginAtivo] = useState(sessionStorage.getItem('loginAtivo') || '');
  const [isDevAuthenticated, setIsDevAuthenticated] = useState(sessionStorage.getItem('devAuth') === 'true');
  const [abaAtiva, setAbaAtiva] = useState(() => getScreenFromPathname() || sessionStorage.getItem('abaAtiva') || 'dashboard');

  // [NOVIDADE] Estado para capturar e ativar a rota do Portal Público (TV)
  const [publicFilial, setPublicFilial] = useState(null);

  const [socketInstance, setSocketInstance] = useState(null);
  const [isDevBooting, setIsDevBooting] = useState(false);
  const [devBootData, setDevBootData] = useState(null);
  const [bannerFechado, setBannerFechado] = useState(true);

  const [gruposExpandidos, setGruposExpandidos] = useState({
    'Desenvolvimento': true,
    'Operacional': true,
    'Manutenção': true,
    'Administração': true,
    'Usuário': false
  });

  const [menuAberto, setMenuAberto] = useState(false);
  const [menuRecolhido, setMenuRecolhido] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginErro, setLoginErro] = useState('');
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [isMfaLoading, setIsMfaLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') !== 'light');
  const [uiDensity, setUiDensity] = useState(localStorage.getItem('termosync_ui_density') || 'comfortable');
  const [mostrarNotificacoes, setMostrarNotificacoes] = useState(false);
  const [somAtivoState, setSomAtivoState] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [systemHealth, setSystemHealth] = useState({ status: 'checking', database: 'checking', mqtt: 'checking', whatsapp: 'checking' });

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [cmdSearch, setCmdSearch] = useState('');
  const [isLocked, setIsLocked] = useState(() => sessionStorage.getItem('terminalLocked') === 'true');
  const [lockPassword, setLockPassword] = useState('');
  const [lockError, setLockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Estados de dados compartilhados por várias telas. As listas são carregadas
  // sob demanda e reaproveitadas entre Dashboard, Monitoramento, Chamados e BI.
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', isPrompt: false, promptValue: '', requirePrompt: false, confirmLabel: '', onConfirm: null });
  const [formEditEquip, setFormEditEquip] = useState({});
  const [equipEditando, setEquipEditando] = useState(null);
  const [equipamentos, setEquipamentos] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [historicoAlertas, setHistoricoAlertas] = useState([]);
  const [chamados, setChamados] = useState([]);
  const [usuariosLista, setUsuariosLista] = useState([]);
  const [lojasCadastradas, setLojasCadastradas] = useState([]);
  const [filiaisDb, setFiliaisDb] = useState([]);
  const [tecnicosDb, setTecnicosDb] = useState([]);
  const [contatosDb, setContatosDb] = useState([]);
  const [historicoChat, setHistoricoChat] = useState([]);
  const [contatoChatAtivo, setContatoChatAtivo] = useState(null);
  const [naoLidasPorContato, setNaoLidasPorContato] = useState({});
  const [listaSetores, setListaSetores] = useState([]);
  const [listaTipos, setListaTipos] = useState([]);
  const termoPesquisa = '';
  const [toasts, setToasts] = useState([]);

  const [badgeSaaS, setBadgeSaaS] = useState(0);
  const [badgeSuporte, setBadgeSuporte] = useState(0);
  const [popupAlerta, setPopupAlerta] = useState(null);

  const isInitialLoadRef = useRef(true);
  const prevBadgesRef = useRef({ saas: 0, suporte: 0, chamados: 0 });

  const initialFilialAtiva = sessionStorage.getItem('papelLogado')?.includes('Impersonate') ? sessionStorage.getItem('userFilial') : ((userRole !== 'LOJA' && userRole !== 'MANUTENCAO') ? 'Todas' : userFilial);
  const [filialAtiva, setFilialAtiva] = useState(initialFilialAtiva);

  const somAtivoRef = useRef(false);
  // Refs espelham estados usados dentro de callbacks longos/sockets, evitando
  // closures antigas quando eventos chegam depois de várias renderizações.
  const commandInputRef = useRef(null);
  const filialAtivaRef = useRef(filialAtiva);
  const userRoleRef = useRef(userRole);
  const userEmpresaRef = useRef(userEmpresa);
  const papelLogadoRef = useRef(papelLogado);
  const contatoChatAtivoRef = useRef(contatoChatAtivo);
  const abaAtivaRef = useRef(abaAtiva);
  const bufferLeiturasRef = useRef({});
  const lastApiErrorToastRef = useRef({ key: '', time: 0 });
  const mainContentRef = useRef(null);
  const screenScrollPositionsRef = useRef(new window.Map());
  const previousScreenRef = useRef(abaAtiva);
  const navigationVisitRef = useRef({ screenId: abaAtiva, enteredAt: Date.now() });
  const pullToRefreshRef = useRef({ startY: 0, active: false });
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  useEffect(() => { filialAtivaRef.current = filialAtiva; }, [filialAtiva]);
  useEffect(() => { userRoleRef.current = userRole; }, [userRole]);
  useEffect(() => { userEmpresaRef.current = userEmpresa; }, [userEmpresa]);
  useEffect(() => { papelLogadoRef.current = papelLogado; }, [papelLogado]);
  useEffect(() => { contatoChatAtivoRef.current = contatoChatAtivo; }, [contatoChatAtivo]);
  useEffect(() => { abaAtivaRef.current = abaAtiva; }, [abaAtiva]);

  const totalNaoLidas = Object.values(naoLidasPorContato).reduce((a, b) => a + (Number(b) || 0), 0);

  // ============================================================================
  // Intercepta a URL do Painel TV. A própria tela confirma a sessão antes de
  // buscar os equipamentos permitidos para o usuário.
  // ============================================================================
  useEffect(() => {
    const path = window.location.pathname;
    if (isTvPathname(path)) {
      const filialRoute = path.replace(/^\/(?:painel-tv|live)\//i, '');
      if (filialRoute) {
        setPublicFilial(decodeURIComponent(filialRoute));
      }
    }
  }, []);

  useEffect(() => {
    /**
     * Sincroniza o estado ao usar os botões voltar e avançar do navegador.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     *
     * Efeitos colaterais: atualiza estado reativo da interface
     *
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const handleBrowserNavigation = () => {
      if (isTvPathname()) return;
      if (token) {
        setAbaAtiva(getScreenFromPathname() || 'dashboard');
        return;
      }
      setAuthScreen(getAuthScreenFromPathname());
    };

    window.addEventListener('popstate', handleBrowserNavigation);
    return () => window.removeEventListener('popstate', handleBrowserNavigation);
  }, [token]);

  const fazerLogout = useCallback(() => {
    // Logout precisa limpar estado React e sessionStorage para impedir reuso de
    // token antigo depois de revogação, troca de usuário ou bloqueio de sessão.
    const currentToken = sessionStorage.getItem('token');
    if (currentToken) {
      fetch(`${getApiUrl()}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` },
        keepalive: true
      }).catch(() => {});
    }
    setToken(''); setUserId('');
    const chavesAuth = ['token', 'userId', 'userRole', 'userFilial', 'userEmpresa', 'nomeLogado', 'papelLogado', 'loginAtivo', 'devAuth', 'abaAtiva', 'terminalLocked'];
    chavesAuth.forEach(k => sessionStorage.removeItem(k));
    sessionStorage.clear();

    setUserRole('LOJA'); setUserFilial(''); setUserEmpresa(''); setTrialInfo({ active: false, lifetime: false, expiresAt: '' }); setMustChangePassword(false); setShowTrialGuide(false); setFilialAtiva('Todas'); setNomeLogado(''); setPapelLogado(''); setLoginAtivo('');
    setAbaAtiva('dashboard'); setMenuAberto(false); setNaoLidasPorContato({}); setContatoChatAtivo(null); setShowCommandPalette(false); setIsLocked(false);
    setIsDevAuthenticated(false);
    setPopupAlerta(null);
  }, []);

  const { authState } = useSecurity(token, fazerLogout);

  const { sysConfig, isFeatureEnabled, isModuloOculto, updateSysConfig, getPlanoAtual } = useSystemCore(userRole, loginAtivo, userFilial, abaAtiva, setAbaAtiva, token, socketInstance);
  const isFeatureEnabledRef = useRef(isFeatureEnabled);
  useEffect(() => { isFeatureEnabledRef.current = isFeatureEnabled; }, [isFeatureEnabled]);

  useEffect(() => {
    // O aviso vive no body para continuar visível também nas rotas públicas,
    // no login, no bloqueio de tela e durante o boot do desenvolvedor.
    const maintenanceActive = sysConfig?.maintenanceMode === true;
    const maintenanceNoticeActive = maintenanceActive || sysConfig?.maintenanceNoticeActive === true;
    document.body.classList.toggle('system-maintenance-notice', maintenanceNoticeActive);
    document.body.classList.toggle('system-maintenance-active', maintenanceActive);
    if (maintenanceNoticeActive) {
      document.body.dataset.maintenanceLabel = maintenanceActive ? 'MANUTENÇÃO' : 'MANUTENÇÃO PROGRAMADA';
      document.body.dataset.maintenanceMessage = sysConfig?.maintenanceMessage || 'Manutenção do sistema em andamento.';
    } else {
      delete document.body.dataset.maintenanceLabel;
      delete document.body.dataset.maintenanceMessage;
    }

    return () => {
      document.body.classList.remove('system-maintenance-notice');
      document.body.classList.remove('system-maintenance-active');
      delete document.body.dataset.maintenanceLabel;
      delete document.body.dataset.maintenanceMessage;
    };
  }, [sysConfig?.maintenanceMode, sysConfig?.maintenanceNoticeActive, sysConfig?.maintenanceMessage]);

  useEffect(() => {
    if (userRole === 'DEV') {
      setGruposExpandidos({ 'Desenvolvimento': true, 'Operacional': false, 'Manutenção': false, 'Administração': false, 'Usuário': false });
    } else {
      setGruposExpandidos({ 'Desenvolvimento': false, 'Operacional': true, 'Manutenção': true, 'Administração': true, 'Usuário': false });
    }
  }, [userRole]);


  /**
   * Processa a interacao de toggle grupo e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} grupo - Valor de grupo consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const toggleGrupo = (grupo) => {
    setGruposExpandidos(prev => ({ ...prev, [grupo]: !prev[grupo] }));
  };

  useEffect(() => { if (token) sessionStorage.setItem('abaAtiva', abaAtiva); }, [abaAtiva, token]);
  useEffect(() => {
    if (isLocked) {
      sessionStorage.setItem('terminalLocked', 'true');
      setLockPassword('');
      setLockError('');
    } else sessionStorage.removeItem('terminalLocked');
  }, [isLocked]);

  useEffect(() => {
    if (!token || isLocked) return;
    let idleTimeout;

    /**
     * Concentra a logica de reset idle timer para manter o restante do modulo mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
     *
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const resetIdleTimer = () => {
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        setIsLocked(true);
        const fakeEvent = new CustomEvent('forceToast', {
          detail: { msg: 'Terminal bloqueado por inatividade para sua segurança.', type: 'warning' }
        });
        window.dispatchEvent(fakeEvent);
      }, 600000);
    };
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      clearTimeout(idleTimeout);
    };
  }, [token, isLocked]);

  useEffect(() => {

    /**
     * Processa a interacao de handle key down e atualiza a interface conforme o resultado.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     *
     * Efeitos colaterais: atualiza estado reativo da interface
     *
     * @param {Event} e - Evento que iniciou a interação ou mudança de estado.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setMostrarNotificacoes(false);
        if (modalConfig.isOpen) setModalConfig(prev => ({...prev, isOpen: false}));
        if (equipEditando) setEquipEditando(null);
        if (popupAlerta) setPopupAlerta(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalConfig.isOpen, equipEditando, popupAlerta]);

  useEffect(() => { if (showCommandPalette && commandInputRef.current) commandInputRef.current.focus(); }, [showCommandPalette]);

  const bannerTexto = sysConfig?.regras?.GLOBAL?.features?.globalBanner;
  useEffect(() => {
    if (bannerTexto) {
      const bannerGuardado = localStorage.getItem('termosync_banner_oculto');
      if (bannerGuardado !== bannerTexto) setBannerFechado(false);
    }
  }, [bannerTexto]);


  /**
   * Processa a interacao de fechar banner global e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const fecharBannerGlobal = () => {
    setBannerFechado(true);
    if (bannerTexto) localStorage.setItem('termosync_banner_oculto', bannerTexto);
  };

  useEffect(() => {
    const accessCode = initialImpersonateCode.current;
    if (!accessCode || impersonationExchangeStarted.current) return;
    impersonationExchangeStarted.current = true;

    window.history.replaceState({}, document.title, window.location.pathname);

    /**
     * Troca o código efêmero por uma sessão LOJA dentro da aba de destino.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
     * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
     *
     * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
     *
     * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const exchangeImpersonationCode = async () => {
      try {
        const { data } = await axios.post(`${getApiUrl()}/auth/impersonate/exchange`, { code: accessCode });

        const authKeys = ['token', 'userId', 'userRole', 'userFilial', 'userEmpresa', 'nomeLogado', 'papelLogado', 'loginAtivo', 'devAuth', 'abaAtiva', 'terminalLocked', 'isTrial', 'demoLifetime', 'trialExpiresAt'];
        authKeys.forEach((key) => sessionStorage.removeItem(key));
        const roleTitle = 'Acesso como Cliente (Impersonate)';
        const loginName = `suporte_${data.filial.toLowerCase().replace(/\s+/g, '')}`;

        setToken(data.token); setUserId(String(data.id)); setUserRole(data.role);
        setUserFilial(data.filial); setUserEmpresa(data.empresa || ''); setTrialInfo({ active: false, lifetime: false, expiresAt: '' }); setFilialAtiva(data.filial);
        setAbaAtiva('dashboard'); setMenuAberto(false); setIsLocked(false);
        setNomeLogado(data.nome); setPapelLogado(roleTitle); setLoginAtivo(loginName); setIsDevAuthenticated(false);

        sessionStorage.setItem('token', data.token); sessionStorage.setItem('userId', String(data.id));
        sessionStorage.setItem('userRole', data.role); sessionStorage.setItem('userFilial', data.filial);
        sessionStorage.setItem('userEmpresa', data.empresa || ''); sessionStorage.setItem('nomeLogado', data.nome);
        sessionStorage.setItem('papelLogado', roleTitle); sessionStorage.setItem('loginAtivo', loginName);
        sessionStorage.setItem('devAuth', 'false'); sessionStorage.setItem('abaAtiva', 'dashboard');

        window.setTimeout(() => window.dispatchEvent(new CustomEvent('forceToast', {
          detail: { msg: `<b>Acesso remoto ativo:</b> conectado à loja <strong>${data.filial}</strong>.`, type: 'warning' }
        })), 700);
      } catch (error) {
        setImpersonateError(error.response?.data?.error || 'Não foi possível abrir o acesso remoto. Gere um novo acesso.');
      } finally {
        setIsImpersonating(false);
      }
    };

    exchangeImpersonationCode();
  }, []);

  const aplicarSessaoAutenticada = useCallback((data, usuarioInput) => {
    // Normaliza a identidade exibida na interface conforme o papel retornado
    // pelo backend e grava os dados mínimos necessários para a sessão atual.
    const gNome = data.nome_gerente || '';
    const cNome = data.nome_coordenador || '';
    let identityName = usuarioInput;
    let roleTitle = 'Gestor de Loja';

    if (data.role === 'DEV') { identityName = 'Desenvolvedor do Sistema'; roleTitle = 'SysAdmin / Root'; }
    else if (data.role === 'ADMIN') { identityName = 'Administrador'; roleTitle = 'Acesso Master'; }
    else if (data.role === 'MANUTENCAO') { identityName = data.nome_tecnico || 'Técnico'; roleTitle = 'Manutenção Global'; }
    else if (data.role === 'LOJA') {
      if (gNome) { identityName = gNome; roleTitle = 'Gerente da Loja'; }
      else if (cNome) { identityName = cNome; roleTitle = 'Coordenador da Loja'; }
      else { identityName = 'Equipe Geral'; roleTitle = 'Acesso da Loja'; }
    }

    const initialTab = data.mustChangePassword ? 'seguranca_conta' : data.role === 'DEV' ? 'dev_panel' : 'dashboard';

    setToken(data.token); setUserId(data.id); setUserRole(data.role); setUserFilial(data.filial); setUserEmpresa(data.empresa);
    setTrialInfo({ active: data.isTrial === true, lifetime: data.demoLifetime === true, expiresAt: data.trialExpiresAt || '' });
    setMustChangePassword(data.mustChangePassword === true);
    setShowTrialGuide(data.isTrial === true && data.mustChangePassword !== true && localStorage.getItem(`termosync_trial_guide_${data.id}`) !== 'done');
    setIsDevAuthenticated(false);
    setFilialAtiva(data.role !== 'LOJA' ? 'Todas' : data.filial);
    setAbaAtiva(initialTab); setMenuAberto(false); setNomeLogado(identityName); setPapelLogado(roleTitle); setLoginAtivo(usuarioInput);

    sessionStorage.setItem('token', data.token); sessionStorage.setItem('userId', data.id);
    sessionStorage.setItem('userRole', data.role); sessionStorage.setItem('userFilial', data.filial); sessionStorage.setItem('userEmpresa', data.empresa);
    sessionStorage.setItem('isTrial', data.isTrial === true ? 'true' : 'false');
    sessionStorage.setItem('mustChangePassword', data.mustChangePassword === true ? 'true' : 'false');
    sessionStorage.setItem('demoLifetime', data.demoLifetime === true ? 'true' : 'false');
    if (data.trialExpiresAt) sessionStorage.setItem('trialExpiresAt', data.trialExpiresAt); else sessionStorage.removeItem('trialExpiresAt');
    sessionStorage.setItem('nomeLogado', identityName); sessionStorage.setItem('papelLogado', roleTitle);
    sessionStorage.setItem('loginAtivo', usuarioInput);
    sessionStorage.setItem('devAuth', 'false');
    sessionStorage.setItem('abaAtiva', initialTab);

    window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: `Protocolo aceito. Bem-vindo(a), ${identityName}.`, type: 'success' }}));
  }, []);


  /**
   * Concentra a logica de fazer login para manter o restante do modulo mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
   *
   * @param {unknown} usuarioInput - Valor de usuario input consumido por esta rotina.
   * @param {unknown} senhaInput - Valor de senha input consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const fazerLogin = async (usuarioInput, senhaInput) => {
    // Fluxo de login em duas fases: credenciais primeiro; se o servidor exigir
    // MFA, a sessão só é aplicada depois da confirmação do código TOTP.
    if (isOffline) {
      window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: 'Sinal de rede perdido.', type: 'error' }}));
      return;
    }
    setLoginErro('');
    setIsLoginLoading(true);

    try {
      const res = await axios.post(`${getApiUrl()}/login`, { usuario: usuarioInput, senha: senhaInput });

      if (res.data.mfaRequired) {
        setMfaChallenge({ challengeId: res.data.challengeId, usuario: usuarioInput });
        setIsLoginLoading(false);
        return;
      }

      if (sysConfig?.maintenanceMode && res.data.role !== 'DEV') {
        window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: sysConfig?.maintenanceMessage || 'Sistema em manutenção. Acesso restrito.', type: 'warning' }}));
        setIsLoginLoading(false);
        return;
      }

      const gNome = res.data.nome_gerente || '';
      const cNome = res.data.nome_coordenador || '';
      let identityName = usuarioInput;
      let roleTitle = 'Gestor de Loja';

      if (res.data.role === 'DEV') {
         identityName = 'Desenvolvedor do Sistema';
         roleTitle = 'SysAdmin / Root';
         // Apenas o perfil ROOT recebe a segunda verificacao no mobile.
         if (isMobileDevice() || window.localStorage.getItem('termosync_mobile_shell') === 'webview') {
           aplicarSessaoAutenticada(res.data, usuarioInput);
           return;
         }
         setDevBootData({ token: res.data.token, id: res.data.id, role: res.data.role, filial: res.data.filial, empresa: res.data.empresa, identityName, roleTitle, loginName: usuarioInput });
         setIsDevBooting(true);
         setIsLoginLoading(false);
         return;
      }
      else if (res.data.role === 'ADMIN') { identityName = 'Administrador'; roleTitle = 'Acesso Master'; }
      else if (res.data.role === 'MANUTENCAO') { identityName = res.data.nome_tecnico || 'Técnico'; roleTitle = 'Manutenção Global'; }
      else if (res.data.role === 'LOJA') {
         if (gNome) { identityName = gNome; roleTitle = 'Gerente da Loja'; }
         else if (cNome) { identityName = cNome; roleTitle = 'Coordenador da Loja'; }
         else { identityName = 'Equipe Geral'; roleTitle = 'Acesso da Loja'; }
       }

      aplicarSessaoAutenticada(res.data, usuarioInput);
    } catch (error) {
      const responseData = error.response?.data;
      const accessMessage = responseData?.maintenance || responseData?.trialExpired ? responseData.error : '';
      setLoginErro(accessMessage || 'Credenciais inválidas.');
      window.dispatchEvent(new CustomEvent('forceToast', {
        detail: { msg: accessMessage || 'Acesso Negado.', type: accessMessage ? 'warning' : 'error' }
      }));
    } finally { setIsLoginLoading(false); }
  };


  /**
   * Concentra a logica de concluir mfa login para manter o restante do modulo mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
   *
   * @param {string} code - Código de verificação ou credencial temporária recebida pelo fluxo.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const concluirMfaLogin = async (code) => {
    if (!mfaChallenge?.challengeId) return;
    setIsMfaLoading(true);
    setLoginErro('');
    try {
      const res = await axios.post(`${getApiUrl()}/login/mfa`, { challengeId: mfaChallenge.challengeId, code });
      const isMobileRuntime = isMobileDevice() || window.localStorage.getItem('termosync_mobile_shell') === 'webview';
      if (res.data.role === 'DEV' && !isMobileRuntime) {
        setDevBootData({
          token: res.data.token,
          id: res.data.id,
          role: res.data.role,
          filial: res.data.filial,
          empresa: res.data.empresa,
          identityName: 'Desenvolvedor do Sistema',
          roleTitle: 'SysAdmin / Root',
          loginName: mfaChallenge.usuario
        });
        setIsDevBooting(true);
        setMfaChallenge(null);
        return;
      }
      aplicarSessaoAutenticada(res.data, mfaChallenge.usuario);
      setMfaChallenge(null);
    } catch (error) {
      setLoginErro(error.response?.data?.error || 'Código MFA inválido.');
      window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: 'MFA recusado.', type: 'error' }}));
    } finally {
      setIsMfaLoading(false);
    }
  };


  /**
   * Concentra a logica de complete dev boot para manter o restante do modulo mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const completeDevBoot = () => {
    if (!devBootData) return;
    const { token, id, role, filial, empresa, identityName, roleTitle, loginName } = devBootData;

    setToken(token); setUserId(id); setUserRole(role); setUserFilial(filial); setUserEmpresa(empresa); setTrialInfo({ active: false, lifetime: false, expiresAt: '' });
    setFilialAtiva('Todas'); setAbaAtiva('dev_panel'); setMenuAberto(false);
    setNomeLogado(identityName); setPapelLogado(roleTitle); setLoginAtivo(loginName); setIsDevAuthenticated(true);

    sessionStorage.setItem('token', token); sessionStorage.setItem('userId', id); sessionStorage.setItem('userRole', role); sessionStorage.setItem('userFilial', filial); sessionStorage.setItem('userEmpresa', empresa); sessionStorage.setItem('nomeLogado', identityName); sessionStorage.setItem('papelLogado', roleTitle); sessionStorage.setItem('loginAtivo', loginName); sessionStorage.setItem('devAuth', 'true');

    window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: `Protocolo ROOT aceito. Bem-vindo(a), ${identityName}.`, type: 'success' }}));
    setIsDevBooting(false); setDevBootData(null);
  };

  useEffect(() => {

    /**
     * Processa a interacao de handle kill switch e atualiza a interface conforme o resultado.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     *
     * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
     *
     * @param {Event} e - Evento que iniciou a interação ou mudança de estado.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const handleKillSwitch = (e) => {
      if (e.key === 'termosync_force_logout' && e.newValue) {
        const lojaAlvo = e.newValue.split('_')[0];
        if (userFilial === lojaAlvo && userRole !== 'DEV' && !papelLogado.includes('Impersonate')) {
          fazerLogout();
          setTimeout(() => window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: `<b>Conexão Terminada:</b> A sua sessão foi revogada remotamente.`, type: 'error' }})), 500);
        }
      }
    };
    window.addEventListener('storage', handleKillSwitch);
    return () => window.removeEventListener('storage', handleKillSwitch);
  }, [userFilial, userRole, papelLogado, fazerLogout]);

  useEffect(() => { if (sysConfig?.maintenanceMode && userRole !== 'DEV' && token && !papelLogado.includes('Impersonate')) fazerLogout(); }, [sysConfig?.maintenanceMode, userRole, token, fazerLogout, papelLogado]);
  useEffect(() => { if (isFeatureEnabled('forceDarkMode')) setIsDarkMode(true); }, [sysConfig, isFeatureEnabled]);


  /**
   * Processa a interacao de handle unlock e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador
   *
   * @param {Event} e - Evento que iniciou a interação ou mudança de estado.
   * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleUnlock = async (e) => {
    e.preventDefault();
    setLockError('');
    if (!lockPassword.trim()) return setLockError('A chave de segurança é obrigatória.');
    if (isOffline) return setLockError('Conexão à base de dados perdida. Aguarde.');
    setIsUnlocking(true);
    try {
      await axios.post(`${getApiUrl()}/login`, { usuario: loginAtivo, senha: lockPassword });
      setIsLocked(false); setLockPassword('');
      sessionStorage.removeItem('terminalLocked');
    } catch (error) { setLockError('Acesso Negado. Credencial inválida.'); }
    finally { setIsUnlocking(false); }
  };


  useEffect(() => {
    let cancelled = false;

    /**
     * Concentra a logica de check system health para manter o restante do modulo mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
     * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
     *
     * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; publica ou consome mensagens MQTT
     *
     * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const checkSystemHealth = async () => {
      try {
        const response = await axios.get(`${getApiUrl()}/health`);
        if (!cancelled) {
          setSystemHealth({
            status: response?.data?.status || 'ok',
            database: response?.data?.database || 'online',
            mqtt: response?.data?.mqtt || 'online',
            whatsapp: response?.data?.whatsapp || 'unknown'
          });
        }
      } catch (error) {
        if (!cancelled) {
          setSystemHealth({ status: 'degraded', database: 'offline', mqtt: 'unknown', whatsapp: 'unknown' });
        }
      }
    };

    checkSystemHealth();
    const intervalId = setInterval(checkSystemHealth, 30000);
    return () => { cancelled = true; clearInterval(intervalId); };
  }, []);


  /**
   * Processa a interacao de toggle full screen e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => { window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: "Modo TV bloqueado.", type: 'warning' }})); }); }
    else { document.exitFullscreen(); }
  };
  useEffect(() => { const handleFullscreenChange = () => setIsFullScreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', handleFullscreenChange); return () => document.removeEventListener('fullscreenchange', handleFullscreenChange); }, []);

  useEffect(() => {
    if (isDarkMode) { document.documentElement.classList.add('dark-theme'); document.body.classList.add('dark-theme'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark-theme'); document.body.classList.remove('dark-theme'); localStorage.setItem('theme', 'light'); }
  }, [isDarkMode]);

  useEffect(() => {
    const isCompact = uiDensity === 'compact';
    document.documentElement.classList.toggle('compact-ui', isCompact);
    document.body.classList.toggle('compact-ui', isCompact);
    localStorage.setItem('termosync_ui_density', uiDensity);
  }, [uiDensity]);

  const toggleUiDensity = useCallback(() => {
    setUiDensity((current) => current === 'compact' ? 'comfortable' : 'compact');
  }, []);

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: getApiUrl(), headers: token ? { Authorization: `Bearer ${token}` } : {} });
    instance.interceptors.response.use((response) => response, (error) => {
      const status = error.response?.status;
      const requestId = error.response?.data?.requestId || error.response?.headers?.['x-request-id'];
      const apiMessage = error.response?.data?.error || error.message || 'Falha de comunicação com o servidor.';
      const endpoint = error.config?.url || 'API';
      error.requestId = requestId;
      error.userMessage = requestId ? `${apiMessage} Código: ${requestId}` : apiMessage;

      if (error.response?.data?.trialExpired && !papelLogado.includes('Impersonate')) {
        fazerLogout();
        setLoginErro(apiMessage);
      } else if (status === 401 && !papelLogado.includes('Impersonate')) {
        fazerLogout();
      }

      if (status >= 500) {
        const key = `${status}:${endpoint}`;
        const now = Date.now();
        if (lastApiErrorToastRef.current.key !== key || now - lastApiErrorToastRef.current.time > 8000) {
          lastApiErrorToastRef.current = { key, time: now };
          window.dispatchEvent(new CustomEvent('forceToast', {
            detail: {
              msg: requestId ? `Falha no servidor em ${endpoint}. Código: ${requestId}` : `Falha no servidor em ${endpoint}.`,
              type: 'error'
            }
          }));
        }
      }
      return Promise.reject(error);
    });
    return instance;
  }, [token, fazerLogout, papelLogado]);

  const showToast = useCallback((message, type = 'success') => {
    if (userRole !== 'DEV' && !isFeatureEnabled('enableToasts')) return;
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message: formatToastMessage(message), type }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4500);
  }, [isFeatureEnabled, userRole]);
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  useEffect(() => {

    /**
     * Concentra a logica de listen toasts para manter o restante do modulo mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @param {Event} e - Evento que iniciou a interação ou mudança de estado.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const listenToasts = (e) => { showToast(e.detail.msg, e.detail.type); };
    window.addEventListener('forceToast', listenToasts);
    return () => window.removeEventListener('forceToast', listenToasts);
  }, [showToast]);

  const tocarSomMensagem = useCallback(() => {
    if (!somAtivoRef.current || !isFeatureEnabledRef.current('enableAudioAlerts')) return;
    try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gainNode = ctx.createGain(); osc.connect(gainNode); gainNode.connect(ctx.destination); osc.type = 'sine'; osc.frequency.setValueAtTime(600, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1); gainNode.gain.setValueAtTime(0.15, ctx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2); osc.start(); osc.stop(ctx.currentTime + 0.2); } catch (error) { logger.info('Áudio de mensagem indisponível neste navegador.', error); }
  }, []);
  const tocarSomMensagemRef = useRef(tocarSomMensagem);
  useEffect(() => { tocarSomMensagemRef.current = tocarSomMensagem; }, [tocarSomMensagem]);

  const tocarAlarme = useCallback(() => {
    if (!somAtivoRef.current || !isFeatureEnabledRef.current('enableAudioAlerts')) return;
    try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gainNode = ctx.createGain(); osc.connect(gainNode); gainNode.connect(ctx.destination); osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.5); } catch (error) { logger.info('Alarme sonoro indisponível neste navegador.', error); }
  }, []);
  const tocarAlarmeRef = useRef(tocarAlarme);
  useEffect(() => { tocarAlarmeRef.current = tocarAlarme; }, [tocarAlarme]);

  const tocarSomNotificacao = useCallback(() => {
    if (!somAtivoRef.current || !isFeatureEnabledRef.current('enableAudioAlerts')) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.12);
      gainNode.gain.setValueAtTime(0.18, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (error) { logger.info('Som de notificação indisponível neste navegador.', error); }
  }, []);
  const tocarSomNotificacaoRef = useRef(tocarSomNotificacao);
  useEffect(() => { tocarSomNotificacaoRef.current = tocarSomNotificacao; }, [tocarSomNotificacao]);

  const alternarSom = useCallback(() => {
    if (!isFeatureEnabled('enableAudioAlerts')) return showToast('Alertas sonoros bloqueados pela Administração.', 'warning');
    const novoEstado = !somAtivoState; setSomAtivoState(novoEstado); somAtivoRef.current = novoEstado;
    if (novoEstado) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator(); const gainNode = ctx.createGain(); osc.connect(gainNode); gainNode.connect(ctx.destination); osc.type = 'sine'; osc.frequency.setValueAtTime(1000, ctx.currentTime); gainNode.gain.setValueAtTime(0.05, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.1);
        showToast('Sirenes Armadas.', 'success');
      } catch (error) { logger.warn('Falha ao armar alertas sonoros.', error); }
    } else { showToast('Sistema silenciado.', 'info'); }
  }, [somAtivoState, showToast, isFeatureEnabled]);

  const carregarChamados = useCallback(async (options = {}) => {
    // Chamados são compartilhados por Kanban, abertura/listagem e histórico.
    // A opção historico usa rota filtrada no backend para reduzir carga na UI.
    if (!token || isOffline) return;
    try {
      const query = options.historico ? '?historico=1&limit=1200' : '';
      const res = await api.get(`/chamados${query}`);
      const lista = Array.isArray(res.data) ? res.data : [];
      setChamados(lista);

      const countChamados = lista.filter(c => {
        const s = String(c.status || '').trim().toLowerCase();
        return !['concluído', 'fechado', 'cancelado', 'resolvido'].includes(s) && s !== '';
      }).length;

      if (!isInitialLoadRef.current && userRole !== 'DEV' && countChamados > prevBadgesRef.current.chamados) {
        tocarSomNotificacaoRef.current();
        if (abaAtivaRef.current !== 'chamados') {
          setPopupAlerta({
            titulo: '🔧 Novo Chamado Técnico',
            mensagem: 'Uma nova Ordem de Serviço (OS) requer atenção ou intervenção técnica.',
            abaDestino: 'chamados'
          });
        }
      }
      prevBadgesRef.current.chamados = countChamados;
    } catch (error) { logger.warn('Falha ao carregar chamados.', error); }
  }, [token, isOffline, api, userRole]);

  const carregarUsuarios = useCallback(async () => { if ((userRole !== 'ADMIN' && userRole !== 'DEV') || !token || isOffline) return; try { const res = await api.get('/usuarios'); setUsuariosLista(Array.isArray(res.data) ? res.data : []); } catch (error) { logger.warn('Falha ao carregar usuários.', error); } }, [api, userRole, token, isOffline]);
  const carregarLojas = useCallback(async () => { if ((userRole !== 'ADMIN' && userRole !== 'DEV') || !token || isOffline) return; try { const res = await api.get('/lojas'); setLojasCadastradas(Array.isArray(res.data) ? res.data : []); } catch (error) { logger.warn('Falha ao carregar lojas.', error); } }, [api, userRole, token, isOffline]);
  const carregarTecnicos = useCallback(async () => { if (!token || isOffline) return; if (!['DEV', 'ADMIN', 'MANUTENCAO'].includes(userRole)) { setTecnicosDb([]); return; } try { const res = await api.get('/tecnicos'); setTecnicosDb(Array.isArray(res.data) ? res.data : []); } catch (error) { logger.warn('Falha ao carregar técnicos.', error); } }, [api, token, isOffline, userRole]);
  const carregarContatos = useCallback(async () => { if (!token || isOffline) return; try { const res = await api.get('/contatos'); setContatosDb(Array.isArray(res.data) ? res.data : []); } catch (error) { logger.warn('Falha ao carregar contatos.', error); } }, [api, token, isOffline]);
  const carregarParametrosGerais = useCallback(async () => { if (!token || isOffline) return; try { const [resSetores, resTipos] = await Promise.all([ api.get('/setores').catch(() => ({ data: [] })), api.get('/tipos-refrigeracao').catch(() => ({ data: [] })) ]); setListaSetores(Array.isArray(resSetores.data) ? resSetores.data : []); setListaTipos(Array.isArray(resTipos.data) ? resTipos.data : []); } catch (error) { logger.warn('Falha ao carregar parâmetros gerais.', error); } }, [api, token, isOffline]);

  const carregarHistoricoChat = useCallback(async () => {
    // Histórico do chat é carregado apenas quando o módulo está habilitado,
    // evitando requests desnecessários em tenants onde a feature foi desligada.
    if (!token || isOffline || !isFeatureEnabledRef.current('enableChat')) return;
    try {
      const res = await api.get('/chat/historico');
      const lista = Array.isArray(res.data) ? res.data : [];
      const histFormatado = lista.map(m => ({ ...m, data: new Date(m.data) }));
      setHistoricoChat(histFormatado);
    } catch (error) { logger.warn('Falha ao carregar histórico do chat.', error); }
  }, [api, token, isOffline]);

  const carregarBadgesSecundarios = useCallback(async () => {
    // Centraliza contadores de atenção do topo/sidebar: onboarding SaaS para DEV
    // e suporte respondido/pendente para usuários operacionais.
    if (!token || isOffline) return;
    try {
      const roleAtual = userRoleRef.current || userRole;

      if (roleAtual === 'DEV') {
        const resSaaS = await api.get('/pre-cadastros').catch(() => ({ data: [] }));
        const countSaaS = Array.isArray(resSaaS.data) ? resSaaS.data.length : 0;

        if (!isInitialLoadRef.current && countSaaS > prevBadgesRef.current.saas) {
          tocarSomNotificacaoRef.current();
          if (abaAtivaRef.current !== 'aprovacoes') {
            setPopupAlerta({
              titulo: '🚀 Novo Onboarding SaaS',
              mensagem: 'Uma nova empresa submeteu pedido de pré-cadastro e aguarda aprovação Root.',
              abaDestino: 'aprovacoes'
            });
          }
        }
        prevBadgesRef.current.saas = countSaaS;
        setBadgeSaaS(countSaaS);
      }

      const resSuporte = await api.get('/suporte/chamados').catch(() => ({ data: [] }));
      if (Array.isArray(resSuporte.data)) {
        let countSup = 0;

        if (roleAtual === 'DEV') {
          countSup = resSuporte.data.filter(c => {
            const s = String(c.status || '').trim().toLowerCase();
            const concluidos = ['concluído', 'resolvido', 'fechado', 'respondido'];
            if (concluidos.includes(s) || !s) return false;
            if (c.resposta && String(c.resposta).trim() !== '') return false;
            return ['aberto', 'em análise', 'em atendimento', 'pendente'].includes(s);
          }).length;
        } else {
          countSup = resSuporte.data.filter(c => {
            const s = String(c.status || '').trim().toLowerCase();
            const temRespostaDev = Boolean(c.resposta && String(c.resposta).trim() !== '');
            const naoEncerrado = !['concluído', 'fechado', 'resolvido'].includes(s);
            return temRespostaDev && naoEncerrado && s === 'respondido';
          }).length;
        }

        if (!isInitialLoadRef.current && countSup > prevBadgesRef.current.suporte) {
          tocarSomNotificacaoRef.current();
          if (abaAtivaRef.current !== 'suporte') {
            setPopupAlerta({
              titulo: '🎧 Novo Retorno de Suporte',
              mensagem: 'A Engenharia ThermoSync respondeu ao seu chamado de suporte.',
              abaDestino: 'suporte'
            });
          }
        }
        prevBadgesRef.current.suporte = countSup;
        setBadgeSuporte(countSup);
      }
    } catch (error) { logger.warn('Falha ao carregar badges secundários.', error); }
  }, [api, token, isOffline, userRole]);

  const carregarBadgesSecundariosRef = useRef(carregarBadgesSecundarios);
  useEffect(() => { carregarBadgesSecundariosRef.current = carregarBadgesSecundarios; }, [carregarBadgesSecundarios]);

  useEffect(() => {
    carregarBadgesSecundarios();
    const timer = setTimeout(() => { isInitialLoadRef.current = false; }, 2500);
    return () => clearTimeout(timer);
  }, [carregarBadgesSecundarios]);

  const carregarDadosBase = useCallback(async () => {
    // Carga base do painel operacional. Usa cache de sessão para renderizar rápido
    // e atualiza em paralelo equipamentos, notificações, histórico e filiais.
    if (!token) return;
    const cE = sessionStorage.getItem('cache_equipamentos'); const cN = sessionStorage.getItem('cache_notificacoes');
    if (cE) setEquipamentos(prev => prev.length === 0 ? JSON.parse(cE) : prev);
    if (cN) setNotificacoes(prev => prev.length === 0 ? JSON.parse(cN) : prev);
    if (isOffline) {
      const cH = sessionStorage.getItem('cache_historico');
      if (cH && abaAtivaRef.current === 'historico') setHistoricoAlertas(JSON.parse(cH));
      return;
    }
    try {
      const isHistorico = abaAtivaRef.current === 'historico';
      const [resEquip, resNotif, resHist, resFiliais] = await Promise.all([
          api.get('/equipamentos').catch(() => ({ data: [] })),
          api.get('/notificacoes').catch(() => ({ data: [] })),
          isHistorico ? api.get('/notificacoes/historico').catch(() => ({ data: null })) : Promise.resolve({ data: null }),
          api.get('/auxiliares/filiais').catch(() => ({ data: [] }))
      ]);
      setEquipamentos(Array.isArray(resEquip.data) ? resEquip.data : []); setFiliaisDb(Array.isArray(resFiliais.data) ? resFiliais.data : []); carregarParametrosGerais();
      if (isHistorico && resHist.data) setHistoricoAlertas(Array.isArray(resHist.data) ? resHist.data : []);
      const dadosNotificacoes = Array.isArray(resNotif.data) ? resNotif.data : []; setNotificacoes(dadosNotificacoes);
      sessionStorage.setItem('cache_equipamentos', JSON.stringify(resEquip.data)); sessionStorage.setItem('cache_notificacoes', JSON.stringify(dadosNotificacoes));
    } catch (error) { logger.warn('Falha ao carregar dados base.', error); }
  }, [token, isOffline, api, carregarParametrosGerais]);

  const carregarDadosBaseRef = useRef(carregarDadosBase); const carregarChamadosRef = useRef(carregarChamados);
  useEffect(() => { carregarDadosBaseRef.current = carregarDadosBase; }, [carregarDadosBase]); useEffect(() => { carregarChamadosRef.current = carregarChamados; }, [carregarChamados]);

  // ============================================================================
  // WEBSOCKETS (COM PROTEÇÃO MULTI-TENANT E ESCUTA DE RESPOSTA DO SUPORTE)
  // ============================================================================
  useEffect(() => {
    // A conexão permanece ativa mesmo quando a telemetria foi desabilitada,
    // pois avisos globais, chat, suporte e manutenção também usam este canal.
    if (!token || isOffline) return;
    const socket = io(getSocketUrl(), { transports: ['websocket'], upgrade: false, auth: { token } });
    setSocketInstance(socket);
    if (userId && !papelLogado.includes('Impersonate')) socket.emit('registrar_usuario', userId);

    socket.on('nova_leitura', (dadosNovaLeitura) => {
      if (!isFeatureEnabledRef.current('telemetryStream')) return;
      // Leituras IoT chegam em alta frequência. Em vez de setState por evento,
      // guardamos em buffer e aplicamos em lote no intervalo abaixo.
      if (userRoleRef.current !== 'DEV' && !papelLogadoRef.current.includes('Impersonate')) {
        if (dadosNovaLeitura.empresa && dadosNovaLeitura.empresa !== userEmpresaRef.current) return;
      }
      bufferLeiturasRef.current[dadosNovaLeitura.equipamento_id] = dadosNovaLeitura;
    });

    socket.on('novo_pre_cadastro', () => {
      carregarBadgesSecundariosRef.current();
    });

    socket.on('resposta_suporte', (data) => {
      if (userRoleRef.current !== 'DEV') {
        if (data.empresa && data.empresa !== userEmpresaRef.current) return;

        tocarSomNotificacaoRef.current();
        if (abaAtivaRef.current !== 'suporte') {
          setPopupAlerta({
            titulo: '🎧 Resposta do Suporte (NOC)',
            mensagem: `Chamado "${data.titulo || '#' + data.id}" atualizado: "${data.resposta || 'Verifique o status de atendimento.'}"`,
            abaDestino: 'suporte'
          });
        }
        showToastRef.current(`Suporte NOC respondeu ao chamado #${data.id}`, 'info');
      }
      carregarBadgesSecundariosRef.current();
    });

    let timeoutAtualizacao;
    socket.on('atualizacao_dados', () => {
        // Debounce evita tempestade de requests quando vários eventos do backend
        // chegam quase ao mesmo tempo.
        clearTimeout(timeoutAtualizacao);
        timeoutAtualizacao = setTimeout(() => {
            carregarDadosBaseRef.current();
            carregarChamadosRef.current();
            carregarBadgesSecundariosRef.current();
        }, 2000);
    });

    socket.on('novo_alerta', (alertaCompleto) => {
      if (!isFeatureEnabledRef.current('telemetryStream')) return;
      if (userRoleRef.current !== 'DEV' && !papelLogadoRef.current.includes('Impersonate')) {
        if (alertaCompleto.empresa && alertaCompleto.empresa !== userEmpresaRef.current) return;
      }

      if (filialAtivaRef.current === 'Todas' || filialAtivaRef.current === alertaCompleto.filial) {
        if (userRoleRef.current !== 'DEV') {
          if (!alertaCompleto.silencioso) {
            const tiposCriticos = ['MECANICA', 'PORTA', 'TEMPERATURA', 'REDE', 'METROLOGIA'];
            if (tiposCriticos.includes(alertaCompleto.tipo_alerta)) {
              const equipamentoLabel = alertaCompleto.equipamento_nome
                || alertaCompleto.maquina
                || (alertaCompleto.equipamento_id ? `#${alertaCompleto.equipamento_id}` : 'não identificado');
              tocarAlarmeRef.current();
              showToastRef.current(`<b>ANOMALIA DETECTADA:</b> O equipamento <b>${equipamentoLabel}</b> registrou uma ocorrência: ${alertaCompleto.mensagem || 'Evento operacional recebido sem descrição.'}`, 'error');
            }
          }
        }
        setNotificacoes(prev => {

          /**
           * Concentra a logica de same condition para manter o restante do modulo mais legivel.
           *
           * Responsabilidade: mantém este comportamento isolado para que validação,
           * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
           *
           * Fluxo principal:
           * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
           *
           * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
           *
           * @param {unknown} n - Valor de n consumido por esta rotina.
           * @returns {unknown} Resultado calculado para consumo do chamador.
           * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
           */
          const sameCondition = n => String(n.equipamento_id) === String(alertaCompleto.equipamento_id)
            && n.tipo_alerta === alertaCompleto.tipo_alerta;
          const current = prev.find(sameCondition);
          if (current?.id === alertaCompleto.id) return prev;
          // Mantém uma ocorrência atual por equipamento/tipo e limita o estado
          // defensivamente caso um emissor externo gere uma tempestade de eventos.
          return [alertaCompleto, ...prev.filter(n => !sameCondition(n))].slice(0, 1000);
        });
      }
    });

    socket.on('nova_mensagem_chat', (msg) => {
      if (!isFeatureEnabledRef.current('enableChat')) return;
      setHistoricoChat(prev => { if (prev.some(m => String(m.id) === String(msg.id))) return prev; return [...prev, { ...msg, data: new Date(msg.data), tipo: 'received' }]; });

      if (String(msg.remetenteId) !== String(userId)) {
        tocarSomNotificacaoRef.current();
        if (abaAtivaRef.current !== 'chat') {
          setPopupAlerta({
            titulo: `💬 Chat: ${msg.remetenteNome}`,
            mensagem: msg.texto,
            abaDestino: 'chat'
          });
        }
        if (abaAtivaRef.current !== 'chat' || String(contatoChatAtivoRef.current?.id) !== String(msg.remetenteId)) {
          showToastRef.current(`${msg.remetenteNome}: ${msg.texto}`, 'info');
        }
      }
      if (abaAtivaRef.current !== 'chat' || String(contatoChatAtivoRef.current?.id) !== String(msg.remetenteId)) { setNaoLidasPorContato(prev => ({ ...prev, [msg.remetenteId]: (prev[msg.remetenteId] || 0) + 1 })); }
    });

    return () => { clearTimeout(timeoutAtualizacao); socket.off('nova_leitura'); socket.off('atualizacao_dados'); socket.off('novo_alerta'); socket.off('novo_pre_cadastro'); socket.off('resposta_suporte'); socket.off('nova_mensagem_chat'); socket.disconnect(); };
  }, [token, isOffline, userId, papelLogado]);

  useEffect(() => {
    // Flush do buffer IoT: atualiza os cards de equipamentos a cada dois segundos,
    // mantendo a UI fluida mesmo com muitos sensores enviando dados.
    const iotFlushInterval = setInterval(() => {
      const keys = Object.keys(bufferLeiturasRef.current);
      if (keys.length > 0) {
        const readings = { ...bufferLeiturasRef.current };
        bufferLeiturasRef.current = {};
        startTransition(() => {
          setEquipamentos(prev => prev.map(eq => {
            const reading = readings[eq.id];
            if (reading) return {
              ...eq,
              ultima_temp: reading.temperatura,
              ultima_umidade: reading.umidade,
              motor_ligado: reading.motor_ligado === true || reading.motor_ligado == 1,
              em_degelo: reading.em_degelo === true || reading.em_degelo == 1,
              ultima_comunicacao: reading.ultima_comunicacao || reading.data_hora || new Date().toISOString(),
              status_conexao: reading.status_conexao || 'online'
            };
            return eq;
          }));
        });
      }
    }, 2000);
    return () => clearInterval(iotFlushInterval);
  }, []);

  useEffect(() => { if (token) { carregarDadosBase(); carregarTecnicos(); carregarContatos(); carregarHistoricoChat(); } }, [token, carregarDadosBase, carregarTecnicos, carregarContatos, carregarHistoricoChat]);
  useEffect(() => { const handleOnline = () => { setIsOffline(false); showToast('Sinal Restabelecido.', 'success'); carregarDadosBase(); carregarHistoricoChat(); }; const handleOffline = () => { setIsOffline(true); showToast('Sem Conexão ao Servidor.', 'warning'); }; window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline); return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); }; }, [carregarDadosBase, carregarHistoricoChat, showToast]);
  useEffect(() => { if ((['usuarios', 'dev_panel', 'saas', 'billing', 'bi'].includes(abaAtiva)) && (userRole === 'ADMIN' || userRole === 'DEV')) carregarUsuarios(); }, [abaAtiva, carregarUsuarios, userRole]);
  useEffect(() => { if (abaAtiva === 'lojas' && (userRole === 'ADMIN' || userRole === 'DEV')) carregarLojas(); }, [abaAtiva, carregarLojas, userRole]);
  useEffect(() => {
    if (abaAtiva === 'historico_chamados') carregarChamados({ historico: true });
    else if (abaAtiva === 'chamados' || abaAtiva === 'kanban') carregarChamados();
  }, [abaAtiva, carregarChamados]);
  useEffect(() => { if (abaAtiva === 'parametros' && (userRole === 'ADMIN' || userRole === 'DEV')) carregarParametrosGerais(); }, [abaAtiva, carregarParametrosGerais, userRole]);

  const listaFiliais = useMemo(() => {
    if (papelLogado.includes('Impersonate') || userRole === 'LOJA') return [userFilial];
     /**
      * Concentra a logica de filiais extraidas para manter o restante do modulo mais legivel.
      *
      * Responsabilidade: mantém este comportamento isolado para que validação,
      * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
      *
      * Fluxo principal:
      * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
      *
      * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
      *
      * @param {unknown} b - Valor de b consumido por esta rotina.
      * @returns {unknown} Resultado calculado para consumo do chamador.
      * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
      */

    /**
     * Concentra a logica de filiais extraidas para manter o restante do modulo mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @param {unknown} b - Valor de b consumido por esta rotina.
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const filiaisExtraidas = (lojasCadastradas || []).map(l => l.nome);
    const combinadas = Array.from(new Set([...(filiaisDb || []), ...filiaisExtraidas]
      .map(filial => String(filial || '').trim())
      .filter(filial => filial && filial.toLowerCase() !== 'todas')));
    return ['Todas', ...combinadas.sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [filiaisDb, lojasCadastradas, userRole, userFilial, papelLogado]);

  const equipamentosDaFilial = useMemo(() => filialAtiva === 'Todas' ? equipamentos : equipamentos.filter(eq => (eq.filial || 'Loja Principal') === filialAtiva), [equipamentos, filialAtiva]);
  const notificacoesDaFilial = useMemo(() => filialAtiva === 'Todas' ? notificacoes : notificacoes.filter(n => (n.filial || 'Loja Principal') === filialAtiva), [notificacoes, filialAtiva]);

  const { qtdTotal, qtdDegelo, qtdFalha, qtdOperando } = useMemo(() => {
    const total = equipamentosDaFilial?.length || 0;
    const degelo = equipamentosDaFilial?.filter(e => e.em_degelo).length || 0;
    const falha = notificacoesDaFilial?.length || 0;
    const operando = Math.max(0, total - degelo - falha);
    return { qtdTotal: total, qtdDegelo: degelo, qtdFalha: falha, qtdOperando: operando };
  }, [equipamentosDaFilial, notificacoesDaFilial]);

  const eqPesquisaLower = termoPesquisa.toLowerCase();
  const equipamentosFiltradosLista = useMemo(() => equipamentosDaFilial?.filter(eq => eq.nome?.toLowerCase().includes(eqPesquisaLower) || (eq.setor && eq.setor.toLowerCase().includes(eqPesquisaLower))), [equipamentosDaFilial, eqPesquisaLower]);
  const historicoFiltradoLista = useMemo(() => { let hist = filialAtiva === 'Todas' ? historicoAlertas : historicoAlertas?.filter(h => (h.filial || 'Loja Principal') === filialAtiva); return hist?.filter(h => h.equipamento_nome?.toLowerCase().includes(eqPesquisaLower) || (h.setor && h.setor.toLowerCase().includes(eqPesquisaLower))); }, [historicoAlertas, filialAtiva, eqPesquisaLower]);
  const dadosDonutStatus = useMemo(() => [ { name: 'Ok', value: qtdOperando, color: 'var(--success)' }, { name: 'Degelo', value: qtdDegelo, color: 'var(--info)' }, { name: 'Falha', value: qtdFalha, color: 'var(--danger)' } ].filter(d => d.value > 0), [qtdOperando, qtdDegelo, qtdFalha]);


  /**
   * Concentra a logica de editar equipamento para manter o restante do modulo mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} eq - Valor de eq consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const editarEquipamento = (eq) => { if (isOffline || isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada.', 'warning'); setEquipEditando(eq.id); setFormEditEquip({ nome: eq.nome, tipo: eq.tipo, temp_min: eq.temp_min, temp_max: eq.temp_max, umidade_min: eq.umidade_min || '', umidade_max: eq.umidade_max || '', intervalo_degelo: eq.intervalo_degelo, duracao_degelo: eq.duracao_degelo, setor: eq.setor, filial: eq.filial, data_calibracao: eq.data_calibracao ? new Date(eq.data_calibracao).toISOString().split('T')[0] : '' }); };

  /**
   * Concentra a logica de salvar edicao equipamento para manter o restante do modulo mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {Event} e - Evento que iniciou a interação ou mudança de estado.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const salvarEdicaoEquipamento = async (e) => { e.preventDefault(); if (isOffline) return; try { await api.put(`/equipamentos/${equipEditando}/edit`, formEditEquip); showToast('Atualizado com sucesso.', 'success'); setEquipEditando(null); carregarDadosBase(); } catch (e) { showToast('Erro de sincronização.', 'error'); } };

  /**
   * Processa a interacao de pedir exclusao e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @param {unknown} nome - Valor de nome consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const pedirExclusao = (id, nome) => { if (isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada (Leitura).', 'warning'); setModalConfig({ isOpen: true, title: 'Remover Máquina', message: `Remover "${nome}" permanentemente?`, isPrompt: false, onConfirm: async () => { try { await api.delete(`/equipamentos/${id}`); showToast('Ativo purgado do sistema.', 'success'); carregarDadosBase(); } catch (e) { showToast('Ação autorizada.', 'error'); } }}); };


  /**
   * Processa a interacao de pedir nota resolucao e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const pedirNotaResolucao = (id) => {
    if (isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada (Leitura).', 'warning');
    setModalConfig({ isOpen: true, title: 'Registro de Manutenção', message: 'Descreva a intervenção técnica:', isPrompt: true, promptValue: '', onConfirm: async (nota) => { try { await api.put(`/notificacoes/${id}/resolver`, { nota_resolucao: nota.trim() === '' ? 'Verificado e limpo.' : nota }); showToast('Incidente arquivado.', 'success'); setNotificacoes(prev => prev.filter(n => n.id !== id)); carregarDadosBase(); } catch (e) { showToast('Erro no arquivo.', 'error'); } } });
  };


  /**
   * Concentra a logica de resolver todas notificacoes para manter o restante do modulo mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const resolverTodasNotificacoes = () => {
    if (isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada (Leitura).', 'warning');
    setModalConfig({ isOpen: true, title: 'Limpeza do Painel', message: 'Arquivar todos os alarmes pendentes do radar?', isPrompt: false, onConfirm: async () => { try { await api.put(`/notificacoes/resolver-todas`); showToast('Painel higienizado.', 'success'); setNotificacoes([]); carregarDadosBase(); } catch (e) { showToast('Erro de sistema.', 'error'); } } });
  };


  /**
   * Gera gerar exportacao com os dados necessarios para o proximo passo.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
   *
   * @param {unknown} tipo - Valor de tipo consumido por esta rotina.
   * @param {unknown} dadosExportacao - Valor de dados exportacao consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const gerarExportacao = (tipo, dadosExportacao = historicoFiltradoLista) => {
    if (!isFeatureEnabled('allowExports')) return showToast('A exportação de dados foi bloqueada pelas diretrizes do sistema.', 'error');
    if (abaAtiva === 'historico') {
      const dados = Array.isArray(dadosExportacao) ? dadosExportacao : historicoFiltradoLista;
      if (dados.length === 0) return showToast("Sem dados para exportar.", "warning");
      if (tipo === 'pdf') {
        const doc = new jsPDF(); doc.setFontSize(18); doc.text("Auditoria de Ocorrências", 14, 20); doc.setFontSize(11); doc.text(`Emitido: ${new Date().toLocaleString()}`, 14, 28); const head = [["Data", "Equipamento", "Ocorrência", "Técnico Responsável"]]; const body = dados.map(h => [new Date(h.data_hora).toLocaleString(), `${h.equipamento_nome}`, h.mensagem, h.nota_resolucao || 'Sem resolução']); autoTable(doc, { head, body, startY: 40, theme: 'grid' }); doc.save(`Auditoria_Ocorrencias_${new Date().getTime()}.pdf`);
      } else {
        let csv = "Data,Equipamento,Setor,Ocorrencia,Resolucao\n"; dados.forEach(row => { csv += `"${new Date(row.data_hora).toLocaleString()}","${row.equipamento_nome}","${row.setor}","${row.mensagem}","${row.nota_resolucao || ''}"\n`; }); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv' })); link.download = `Auditoria_${new Date().getTime()}.csv`; link.click();
      }
      showToast('Pacote de dados gerado.', 'success');
    } else { showToast('Funcionalidade de PDF não implementada no frontend (usando backend).', 'info'); }
  };


  /**
   * Gera gerar lote os com os dados necessarios para o proximo passo.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} listaChamados - Valor de lista chamados consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const gerarLoteOS = (listaChamados) => {
    if (!isFeatureEnabled('allowExports')) return showToast('A exportação de dados foi bloqueada pelas diretrizes do sistema.', 'error');
    if (!listaChamados || listaChamados.length === 0) return showToast("Nenhuma OS pendente.", "warning"); const doc = new jsPDF(); listaChamados.forEach((c, index) => { if (index > 0) doc.addPage(); doc.setFontSize(18); doc.text(`Ordem de Serviço (OS) - ${c.status}`, 14, 20); doc.setFontSize(11); doc.text(`Máquina: ${c.equipamento_nome}`, 14, 32); doc.text(`Filial: ${c.filial}`, 14, 40); doc.text(`Abertura: ${new Date(c.data_abertura).toLocaleString()}`, 14, 72); doc.text(doc.splitTextToSize(c.descricao || 'Sem descrição.', 180), 14, 96); if (c.status === 'Concluído') { doc.text(doc.splitTextToSize(c.nota_resolucao || 'Sem nota.', 180), 14, 138); } }); doc.save(`Lote_OS_${new Date().getTime()}.pdf`); showToast('Lote Operacional Baixado.', 'success');
  };

  // ===============================================
  // REGISTRO DE TELAS E REGRAS DE BADGES POR ROLE
  // ===============================================
  const chamadosAbertosCount = chamados?.filter((chamado) => {
    const status = String(chamado.status || '').trim().toLowerCase();
    return status && !['concluído', 'concluido', 'fechado', 'cancelado', 'resolvido'].includes(status);
  }).length || 0;
  const alertasTemperaturaCount = notificacoesDaFilial?.filter((item) => String(item.tipo_alerta || '').toUpperCase() !== 'UMIDADE').length || 0;
  const alertasUmidadeCount = notificacoesDaFilial?.filter((item) => String(item.tipo_alerta || '').toUpperCase() === 'UMIDADE').length || 0;
  const equipamentosOfflineCount = equipamentosDaFilial?.filter((item) => ['offline', 'sem-sinal'].includes(String(item.status_conexao || '').toLowerCase())).length || 0;

  // Catálogo único de telas: permissões, agrupamento, badges e presença na sidebar.
  // `sidebar: false` mantém a tela acessível apenas pelas abas da área contextual.
  const NAVIGATION = [
    // Ferramentas de desenvolvimento: cada área técnica conserva uma única entrada lateral.
    { id: 'dev_panel', label: 'Console DEV', icon: Terminal, roles: ['DEV'], type: 'Desenvolvimento', priority: 1 },
    { id: 'bi', label: 'Centro de Inteligência (BI)', icon: PieChart, roles: ['DEV'], type: 'Desenvolvimento', devAuthRequired: true, sidebar: false },
    { id: 'soc', label: 'Segurança', icon: ShieldCheck, roles: ['DEV'], type: 'Desenvolvimento', devAuthRequired: true, priority: 5 },
    { id: 'atualizacoes', label: 'Atualizações / Deploy', icon: Rocket, roles: ['DEV'], type: 'Desenvolvimento', devAuthRequired: true },
    { id: 'sql_terminal', label: 'Console SQL', icon: Database, roles: ['DEV'], type: 'Desenvolvimento', devAuthRequired: true, sidebar: false },
    { id: 'websocket_stream', label: 'Live Firehose (WS)', icon: Network, roles: ['DEV'], type: 'Desenvolvimento', devAuthRequired: true, sidebar: false },
    { id: 'network_scanner', label: 'Sonda de Rede (IDS)', icon: Network, roles: ['DEV'], type: 'Desenvolvimento', devAuthRequired: true, sidebar: false },
    { id: 'monitor_edge', label: 'Monitor Serial Edge', icon: Radio, roles: ['DEV'], type: 'Desenvolvimento', devAuthRequired: true, sidebar: false },
    { id: 'simulador', label: 'Simulador', icon: Cpu, roles: ['DEV'], type: 'Desenvolvimento', sidebar: false },
    { id: 'hardware', label: 'Hardware IoT', icon: Server, roles: ['DEV'], type: 'Desenvolvimento', sidebar: false },
    { id: 'system', label: 'Infraestrutura', icon: Settings2, roles: ['DEV'], type: 'Desenvolvimento', priority: 4 },
    { id: 'empresas', label: 'Dados e SaaS', icon: Building2, roles: ['DEV'], type: 'Desenvolvimento', devAuthRequired: true, priority: 3 },
    { id: 'aprovacoes', label: 'Onboarding SaaS', icon: CheckCircle, roles: ['DEV'], badge: badgeSaaS, type: 'Desenvolvimento', devAuthRequired: true, sidebar: false },
    { id: 'saas', label: 'Licenças SaaS', icon: ShieldAlert, roles: ['DEV'], type: 'Desenvolvimento', devAuthRequired: true, sidebar: false },
    { id: 'billing', label: 'Core Financeiro', icon: DollarSign, roles: ['DEV'], type: 'Desenvolvimento', devAuthRequired: true, sidebar: false },

    // Operação diária: dashboard, rotinas de turno e monitoramento ambiental.
    { id: 'dashboard', label: 'Dashboard Operacional', icon: Activity, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: notificacoesDaFilial?.length || 0, type: 'Operacional', priority: 1 },
    { id: 'assistente', label: 'Assistente de Operação', icon: Sparkles, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operacional', priority: 2 },
    { id: 'resumo_loja', label: 'Resumo da Loja', icon: Building2, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operacional', sidebar: false },
    { id: 'central_procedimentos', label: 'Central de Procedimentos', icon: ClipboardCheck, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operacional', sidebar: false },
    { id: 'checklist_turno', label: 'Checklist de Turno', icon: ClipboardList, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operacional' },
    { id: 'resumo_turno', label: 'Resumo de Turno', icon: BarChart3, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operacional', sidebar: false },
    { id: 'plano_dia', label: 'Plano do Dia', icon: CalendarDays, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operacional', sidebar: false },
    { id: 'resumo_executivo', label: 'Resumo Executivo', icon: BarChart3, roles: ['ADMIN', 'DEV'], type: 'Operacional', sidebar: false },
    { id: 'timeline_operacional', label: 'Timeline Operacional', icon: Clock, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Operacional', sidebar: false },
    { id: 'mapa', label: 'Planta Digital', icon: Map, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Operacional', sidebar: false },
    { id: 'motores', label: 'Monitoramento Térmico', icon: Thermometer, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: alertasTemperaturaCount, type: 'Operacional' },
    { id: 'umidade', label: 'Monitoramento de Umidade', icon: Droplets, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: alertasUmidadeCount, type: 'Operacional', sidebar: false },

    // Serviços e ativos: atendimento, inventário e parâmetros compartilhados.
    { id: 'chamados', label: 'Chamados', icon: Wrench, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: userRole === 'DEV' ? 0 : chamadosAbertosCount, type: 'Manutenção', priority: 1 },
    { id: 'sla_chamados', label: 'SLA de Chamados', icon: Timer, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], badge: chamadosAbertosCount, type: 'Manutenção', sidebar: false },
    { id: 'kanban', label: 'Gestão Ágil (Kanban)', icon: Columns, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], badge: chamadosAbertosCount, type: 'Manutenção', sidebar: false },
    { id: 'chat', label: 'Chat', icon: MessageSquare, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: totalNaoLidas || 0, type: 'Usuário', sidebar: false },
    { id: 'metrologia', label: 'Controle Metrológico', icon: Target, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Manutenção', sidebar: false },
    { id: 'inventario_iot', label: 'Inventário IoT', icon: Cpu, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], badge: equipamentosOfflineCount, type: 'Manutenção', sidebar: false },
    { id: 'equipamentos', label: 'Equipamentos', icon: Server, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], badge: equipamentosOfflineCount, type: 'Manutenção' },
    { id: 'parametros', label: 'Parâmetros Globais', icon: Sliders, roles: ['ADMIN', 'DEV'], type: 'Administração', sidebar: false },
    { id: 'historico_chamados', label: 'Histórico de Chamados', icon: Archive, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Manutenção', sidebar: false },

    // Auditoria e análise histórica da operação.
    { id: 'relatorios', label: 'Relatórios', icon: Leaf, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Operacional', isPremium: true, priority: 1 },
    { id: 'energia', label: 'Gestão Energética', icon: Zap, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Operacional', sidebar: false },
    { id: 'historico', label: 'Histórico de Logs', icon: History, roles: ['ADMIN', 'DEV'], type: 'Administração', isPremium: true, sidebar: false },

    // Administração da plataforma e recursos institucionais.
    { id: 'lojas', label: 'Gestão de Lojas', icon: Store, roles: ['ADMIN', 'DEV'], type: 'Administração', priority: 1 },
    { id: 'usuarios', label: 'Identidades e Acessos', icon: Users, roles: ['ADMIN', 'DEV'], type: 'Administração', priority: 2 },
    { id: 'centro_comando', label: 'Centro de Comando', icon: Target, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operacional', sidebar: false },
    { id: 'central_saude', label: 'Observabilidade', icon: ShieldCheck, roles: ['DEV'], type: 'Desenvolvimento', priority: 2 },
    { id: 'suporte', label: 'Suporte da Plataforma', icon: LifeBuoy, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: badgeSuporte, type: 'Usuário' },
    { id: 'seguranca_conta', label: 'Segurança da Conta', icon: LockKeyhole, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Usuário', sidebar: false },
    { id: 'documentacao', label: 'Documentação', icon: BookOpen, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Usuário', sidebar: false },
    { id: 'privacidade', label: 'Privacidade e Dados', icon: ShieldCheck, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Usuário', sidebar: false },
    { id: 'sobre', label: 'Sobre a Plataforma', icon: Info, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Usuário', sidebar: false }
  ].map((item) => {
    const classification = getScreenClassification(item.id);
    return {
      ...item,
      roles: getAllowedRolesForScreen(item.id),
      type: classification?.section || item.type,
      moduleId: classification?.moduleId || item.id,
      moduleLabel: classification?.moduleLabel || item.label,
      screenKind: classification?.kind || 'Tela do sistema'
    };
  }).sort((a, b) => {
    // Prioridades explícitas vêm primeiro; o restante mantém ordem alfabética estável.
    const priorityA = Number.isFinite(a.priority) ? a.priority : Infinity;
    const priorityB = Number.isFinite(b.priority) ? b.priority : Infinity;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.label.localeCompare(b.label, 'pt-BR');
  });

  // Aplica feature flags, permissões e autenticação DEV antes de montar qualquer menu.
  const NAVIGATION_ATIVA = NAVIGATION.filter(nav => !isModuloOculto(nav.id) && canRoleAccessScreen(userRole, nav.id) && (nav.id !== 'chat' || isFeatureEnabled('enableChat')) && (!nav.devAuthRequired || isDevAuthenticated));
  const modulosAcessiveis = useMemo(() => new Set(NAVIGATION_ATIVA.map(item => item.id)), [NAVIGATION_ATIVA]);
  const podeAcessarModulo = useCallback((id) => modulosAcessiveis.has(id), [modulosAcessiveis]);
  const activeScreenLabel = NAVIGATION.find(item => item.id === abaAtiva)?.label || 'Central de Operações';
  // O contexto associa telas secundárias ao item único que deve permanecer selecionado.
  const navigationContext = getNavigationContext(abaAtiva, NAVIGATION_ATIVA);
  const activeWorkspace = navigationContext.workspace?.tabs.length > 1 ? navigationContext.workspace : null;
  const activeNavigationId = navigationContext.parentItem?.id || abaAtiva;
  // O aviso acompanha a sessão DEV em qualquer módulo permitido, inclusive telas compartilhadas.
  const showDeveloperEnvironmentBanner = shouldShowDeveloperEnvironmentBanner({
    userRole,
    hasSession: Boolean(token),
    activeScreenId: abaAtiva,
    navigation: NAVIGATION_ATIVA
  });
  const runtimeEnvironment = String(import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'local').toUpperCase();

  useEffect(() => {
    if (isTvPathname()) return;

    const slug = SCREEN_PATHS[abaAtiva] || SCREEN_PATHS.dashboard;
    const desiredPath = token
      ? getAuthenticatedScreenPath({ screenId: abaAtiva, slug, userRole })
      : AUTH_SCREEN_PATHS[authScreen] || '/';
    const currentPath = normalizePathname(window.location.pathname);
    const publicPageLabels = {
      login: 'Entrar',
      trial: 'Teste gratuito',
      register: 'Cadastro definitivo',
      terms: 'Termos de Uso',
      privacyPolicy: 'Política de Privacidade'
    };
    const pageLabel = token ? activeScreenLabel : publicPageLabels[authScreen] || 'Monitoramento inteligente';

    document.title = `${pageLabel} | ThermoSync`;
    if (currentPath === desiredPath) {
      routeSyncReadyRef.current = true;
      return;
    }

    const method = routeSyncReadyRef.current ? 'pushState' : 'replaceState';
    window.history[method]({ termoSyncScreen: token ? abaAtiva : authScreen }, '', desiredPath);
    routeSyncReadyRef.current = true;
  }, [abaAtiva, activeScreenLabel, authScreen, token, userRole]);

  useLayoutEffect(() => {
    const container = mainContentRef.current;
    if (!container) return;

    const previousScreen = previousScreenRef.current;
    if (previousScreen !== abaAtiva) {
      screenScrollPositionsRef.current.set(previousScreen, container.scrollTop);
      container.scrollTo({ top: screenScrollPositionsRef.current.get(abaAtiva) || 0, behavior: 'auto' });
      previousScreenRef.current = abaAtiva;
    }
  }, [abaAtiva]);

  useEffect(() => {
    if (!token || !abaAtiva) return;
    const scope = `${userRole}_${userId || loginAtivo || 'usuario'}`.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
    const metricsKey = `termosync_navigation_metrics_${scope}`;

    try {
      const now = Date.now();
      const previousVisit = navigationVisitRef.current;
      const metrics = JSON.parse(localStorage.getItem(metricsKey) || '{}');
      if (previousVisit.screenId && previousVisit.screenId !== abaAtiva) {
        const previousMetric = metrics[previousVisit.screenId] || { visits: 0, durationMs: 0 };
        metrics[previousVisit.screenId] = {
          ...previousMetric,
          durationMs: previousMetric.durationMs + Math.max(0, now - previousVisit.enteredAt),
          lastVisitedAt: new Date(now).toISOString()
        };
      }
      const currentMetric = metrics[abaAtiva] || { visits: 0, durationMs: 0 };
      metrics[abaAtiva] = { ...currentMetric, visits: currentMetric.visits + 1, lastVisitedAt: new Date(now).toISOString() };
      localStorage.setItem(metricsKey, JSON.stringify(metrics));
      navigationVisitRef.current = { screenId: abaAtiva, enteredAt: now };
      window.dispatchEvent(new CustomEvent('termosync:navigation', { detail: { screenId: abaAtiva, path: window.location.pathname } }));
      if (trialInfo.active) {
        api.post('/saas/trials/usage', {
          screenId: abaAtiva,
          durationMs: previousVisit.screenId === abaAtiva ? 0 : Math.max(0, now - previousVisit.enteredAt)
        }).catch(() => {});
        setTrialGuideVisited((current) => new Set([...current, abaAtiva]));
      }
    } catch {
      // As métricas são auxiliares e não devem bloquear a navegação sem armazenamento local.
    }
  }, [abaAtiva, api, loginAtivo, token, trialInfo.active, userId, userRole]);

  useEffect(() => {
    if (!token || !mustChangePassword || abaAtiva === 'seguranca_conta') return;
    setAbaAtiva('seguranca_conta');
    sessionStorage.setItem('abaAtiva', 'seguranca_conta');
  }, [abaAtiva, mustChangePassword, token]);

  useEffect(() => {
    if (!token || !abaAtiva || podeAcessarModulo(abaAtiva)) return;
    setAbaAtiva('dashboard');
    sessionStorage.setItem('abaAtiva', 'dashboard');
  }, [abaAtiva, podeAcessarModulo, token]);

  const mobilePrimaryNav = useMemo(() => {
    const role = MOBILE_PRIMARY_NAV_BY_ROLE[userRole] ? userRole : 'LOJA';
    const preferredIds = MOBILE_PRIMARY_NAV_BY_ROLE[role];
    const usedIds = new Set();

    const preferredItems = preferredIds
      .map(id => NAVIGATION_ATIVA.find(item => item.id === id))
      .filter(Boolean)
      .filter(item => {
        if (usedIds.has(item.id)) return false;
        usedIds.add(item.id);
        return true;
      });

    if (preferredItems.length >= 5) return preferredItems.slice(0, 5);

    const fallbackItems = NAVIGATION_ATIVA
      .filter(item => item.sidebar !== false && !usedIds.has(item.id))
      .sort((a, b) => {
        const priorityA = Number.isFinite(a.priority) ? a.priority : Infinity;
        const priorityB = Number.isFinite(b.priority) ? b.priority : Infinity;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.label.localeCompare(b.label, 'pt-BR');
      });

    return [...preferredItems, ...fallbackItems].slice(0, 5);
  }, [NAVIGATION_ATIVA, userRole]);

  const globalSearchItems = useMemo(() => {
    const termo = cmdSearch.trim().toLowerCase();
    if (termo.length < 2) return [];

    const matches = [];

    /**
     * Concentra a logica de push match para manter o restante do modulo mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @param {unknown} type - Valor de type consumido por esta rotina.
     * @param {unknown} title - Valor de title consumido por esta rotina.
     * @param {unknown} detail - Valor de detail consumido por esta rotina.
     * @param {unknown} target - Valor de target consumido por esta rotina.
     * @param {unknown} icon - Valor de icon consumido por esta rotina.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const pushMatch = (type, title, detail, target, icon = Search) => {
      if (!modulosAcessiveis.has(target)) return;
      const haystack = `${title} ${detail}`.toLowerCase();
      if (haystack.includes(termo)) matches.push({ type, title, detail, target, icon });
    };

    equipamentos.slice(0, 500).forEach(eq => pushMatch('Equipamento', eq.nome || `Equipamento ${eq.id}`, `${eq.filial || ''} ${eq.setor || ''} ${eq.tipo || ''}`, 'inventario_iot', Server));
    chamados.slice(0, 500).forEach(chamado => pushMatch('Chamado', `OS-${chamado.id} ${chamado.equipamento_nome || ''}`, `${chamado.status || ''} ${chamado.urgencia || ''} ${chamado.descricao || ''}`, 'chamados', Wrench));
    notificacoes.slice(0, 300).forEach(alerta => pushMatch('Alerta', alerta.equipamento_nome || 'Alerta', `${alerta.tipo_alerta || ''} ${alerta.mensagem || ''}`, 'timeline_operacional', Bell));
    contatosDb.slice(0, 300).forEach(contato => pushMatch('Contato', contato.nome || contato.usuario || `Contato ${contato.id}`, `${contato.role || ''} ${contato.filial || ''}`, 'chat', MessageSquare));

    return matches.slice(0, 12);
  }, [cmdSearch, equipamentos, chamados, notificacoes, contatosDb, modulosAcessiveis]);

  const navegarMobileTab = useCallback((id) => {
    if (!id || !podeAcessarModulo(id)) return;
    setMostrarNotificacoes(false);
    setShowCommandPalette(false);
    setMenuAberto(false);
    setAbaAtiva(id);
    if (token) sessionStorage.setItem('abaAtiva', id);
    requestAnimationFrame(() => {
      document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [podeAcessarModulo, token]);

  const atualizarTelaMobile = useCallback(async () => {
    if (!token || isOffline || isPullRefreshing) return;

    setIsPullRefreshing(true);
    try {
      const tarefas = [
        carregarDadosBase(),
        carregarBadgesSecundarios()
      ];

      if (abaAtiva === 'chat') tarefas.push(carregarHistoricoChat());
      if (abaAtiva === 'historico_chamados') tarefas.push(carregarChamados({ historico: true }));
      if (abaAtiva === 'chamados' || abaAtiva === 'kanban') tarefas.push(carregarChamados());
      if ((['usuarios', 'dev_panel', 'saas', 'billing', 'bi'].includes(abaAtiva)) && (userRole === 'ADMIN' || userRole === 'DEV')) tarefas.push(carregarUsuarios());
      if (abaAtiva === 'lojas' && (userRole === 'ADMIN' || userRole === 'DEV')) tarefas.push(carregarLojas());
      if (abaAtiva === 'parametros' && (userRole === 'ADMIN' || userRole === 'DEV')) tarefas.push(carregarParametrosGerais());

      await Promise.allSettled(tarefas);
      showToast('Tela atualizada.', 'success');
    } finally {
      setPullDistance(0);
      setTimeout(() => setIsPullRefreshing(false), 350);
    }
  }, [
    abaAtiva,
    carregarBadgesSecundarios,
    carregarChamados,
    carregarDadosBase,
    carregarHistoricoChat,
    carregarLojas,
    carregarParametrosGerais,
    carregarUsuarios,
    isOffline,
    isPullRefreshing,
    showToast,
    token,
    userRole
  ]);

  const handleMobilePullStart = useCallback((event) => {
    if (!window.matchMedia('(max-width: 768px)').matches || !token || isPullRefreshing) return;
    if (event.touches.length !== 1) return;

    const scrollEl = mainContentRef.current;
    pullToRefreshRef.current = {
      startY: event.touches[0].clientY,
      active: Boolean(scrollEl && scrollEl.scrollTop <= 0)
    };
  }, [isPullRefreshing, token]);

  const handleMobilePullMove = useCallback((event) => {
    const pullState = pullToRefreshRef.current;
    if (!pullState.active || event.touches.length !== 1 || isPullRefreshing) return;

    const scrollEl = mainContentRef.current;
    if (!scrollEl || scrollEl.scrollTop > 0) {
      pullState.active = false;
      setPullDistance(0);
      return;
    }

    const deltaY = event.touches[0].clientY - pullState.startY;
    if (deltaY <= 0) {
      setPullDistance(0);
      return;
    }

    if (event.cancelable) event.preventDefault();
    setPullDistance(Math.min(92, deltaY * 0.45));
  }, [isPullRefreshing]);

  const handleMobilePullEnd = useCallback(() => {
    const shouldRefresh = pullToRefreshRef.current.active && pullDistance >= 64;
    pullToRefreshRef.current = { startY: 0, active: false };

    if (shouldRefresh) {
      atualizarTelaMobile();
      return;
    }

    setPullDistance(0);
  }, [atualizarTelaMobile, pullDistance]);

  // ============================================================================
  // RENDERIZAÇÃO DA ROTA DO PAINEL DE TV ANTES DA INTERFACE PRINCIPAL
  // ============================================================================
  if (publicFilial) {
    return (
      <Suspense fallback={<Loader message="Abrindo portal público..." />}>
        <PortalPublico filialUrl={publicFilial} />
      </Suspense>
    );
  }

  if (isDevBooting) {
    return <DevBootScreen onComplete={completeDevBoot} authToken={devBootData?.token} />;
  }

  if (isImpersonating) {
    return <Loader message="Abrindo acesso seguro à loja..." />;
  }

  if (impersonateError && !token) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '24px', textAlign: 'center', background: 'var(--technical-canvas)', color: '#e2e8f0' }}>
        <AlertTriangle size={42} color="var(--warning)" />
        <h2 style={{ margin: 0 }}>Acesso à loja não iniciado</h2>
        <p style={{ margin: 0, maxWidth: '480px', color: 'var(--text-muted)' }}>{impersonateError}</p>
        <button type="button" className="btn-primary" onClick={() => window.close()}>Fechar esta aba</button>
      </div>
    );
  }

  if (authState.isVerifying && token) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--technical-canvas)', color: 'var(--info)' }}>
        <Loader2 size={48} className="spin" />
        <h3 style={{ marginLeft: '15px', fontFamily: 'Montserrat' }}>Verificando Integridade Criptográfica...</h3>
      </div>
    );
  }

  // Documentos jurídicos permanecem públicos mesmo quando já existe uma sessão.
  // Isso permite abri-los em outra aba a partir do rodapé da área autenticada.
  if (authScreen === 'terms' || authScreen === 'privacyPolicy') {
    return (
      <Suspense fallback={<Loader message="Abrindo documento..." />}>
        <LegalDocument type={authScreen === 'terms' ? 'terms' : 'privacy'} onNavigate={setAuthScreen} />
      </Suspense>
    );
  }

  if (!token) {
    if (authScreen === 'landing') {
      return (
        <Suspense fallback={<Loader message="Preparando acesso..." />}>
          <LandingPage onNavigate={setAuthScreen} />
        </Suspense>
      );
    }

    if (authScreen === 'login') {
      return (
        <div style={{ position: 'relative', width: '100%', minHeight: '100vh', background: 'var(--bg-color)' }}>
          <Suspense fallback={<Loader message="Carregando autenticação..." />}>
            <Login
              isOffline={isOffline}
              isLoginLoading={isLoginLoading || isMfaLoading}
              fazerLogin={fazerLogin}
              loginErro={loginErro}
              mfaChallenge={mfaChallenge}
              concluirMfaLogin={concluirMfaLogin}
              cancelarMfa={() => { setMfaChallenge(null); setLoginErro(''); }}
              onBack={() => setAuthScreen('landing')}
            />
          </Suspense>
        </div>
      );
    }

    if (authScreen === 'trial' || authScreen === 'register') {
      const isTrialRequest = authScreen === 'trial';
      return (
        <Suspense fallback={<Loader message={isTrialRequest ? 'Abrindo teste gratuito...' : 'Abrindo cadastro...'} />}>
          <Register onNavigate={setAuthScreen} isOffline={isOffline} requestType={isTrialRequest ? 'TRIAL' : 'COMERCIAL'} />
        </Suspense>
      );
    }

  }

  if (isLocked) {
    return (
      <LockScreen
        password={lockPassword}
        error={lockError}
        isUnlocking={isUnlocking}
        isOffline={isOffline}
        userName={nomeLogado}
        userLogin={loginAtivo}
        userRole={userRole}
        userFilial={userFilial}
        onPasswordChange={(value) => { setLockPassword(value); setLockError(''); }}
        onSubmit={handleUnlock}
        onLogout={fazerLogout}
      />
    );
  }

  return (
    <div className={`app-container ${isDarkMode ? 'dark-theme' : ''} ${uiDensity === 'compact' ? 'compact-ui' : ''}`}>
      <datalist id="filiais-db">{filiaisDb?.map(f => <option key={f} value={f} />)}</datalist><datalist id="setores-db">{listaSetores?.map(s => <option key={s.id} value={s.nome} />)}</datalist>

      <CommandPalette
        showCommandPalette={showCommandPalette}
        setShowCommandPalette={setShowCommandPalette}
        cmdSearch={cmdSearch}
        setCmdSearch={setCmdSearch}
        commandInputRef={commandInputRef}
        NAVIGATION_ATIVA={NAVIGATION_ATIVA}
        globalSearchItems={globalSearchItems}
        setAbaAtiva={setAbaAtiva}
        setGruposExpandidos={setGruposExpandidos}
      />

      <Sidebar
        api={api}
        menuAberto={menuAberto}
        setMenuAberto={setMenuAberto}
        menuRecolhido={menuRecolhido}
        nomeLogado={nomeLogado}
        papelLogado={papelLogado}
        getPlanoVisual={getPlanoAtual}
        userRole={userRole}
        userFilial={userFilial}
        filialAtiva={filialAtiva}
        setFilialAtiva={setFilialAtiva}
        listaFiliais={listaFiliais}
        gruposExpandidos={gruposExpandidos}
        toggleGrupo={toggleGrupo}
        abaAtiva={abaAtiva}
        activeNavigationId={activeNavigationId}
        setAbaAtiva={setAbaAtiva}
        NAVIGATION_ATIVA={NAVIGATION_ATIVA}
        systemHealth={systemHealth}
        isOffline={isOffline}
        getPlanoAtual={getPlanoAtual}
        setIsLocked={setIsLocked}
        fazerLogout={fazerLogout}
      />

      <main
        className={`main-content ${pullDistance > 0 || isPullRefreshing ? 'is-pulling-refresh' : ''}`}
        ref={mainContentRef}
        onTouchStart={handleMobilePullStart}
        onTouchMove={handleMobilePullMove}
        onTouchEnd={handleMobilePullEnd}
        onTouchCancel={handleMobilePullEnd}
      >

        {trialInfo.active && (
          <>
            <div className="trial-environment-banner" role="status">
              <Radio size={17} />
              <div className="trial-environment-copy"><strong>Ambiente de demonstração</strong><span>Equipamentos e leituras virtuais, sem instalação física.</span></div>
              <b>{trialInfo.lifetime ? 'Demonstração permanente' : trialInfo.expiresAt ? `${Math.max(0, Math.ceil((new Date(trialInfo.expiresAt).getTime() - Date.now()) / 86400000))} dia(s) restante(s)` : 'Período gratuito'}</b>
              <button type="button" onClick={() => setShowTrialGuide((current) => !current)}><ClipboardCheck size={15} /> Roteiro</button>
            </div>
            {showTrialGuide && (
              <nav className="trial-guide" aria-label="Roteiro da demonstração">
                <div className="trial-guide-intro">
                  <span>Roteiro recomendado</span>
                  <strong>Conheça o ambiente</strong>
                  <small>{trialGuideVisited.size} de {TRIAL_GUIDE_STEPS.length} etapas visitadas</small>
                  <div className="trial-guide-progress" aria-hidden="true"><i style={{ width: `${(trialGuideVisited.size / TRIAL_GUIDE_STEPS.length) * 100}%` }} /></div>
                </div>
                <div className="trial-guide-steps">
                  {TRIAL_GUIDE_STEPS.map(({ screen, label, description }, index) => {
                    const completed = trialGuideVisited.has(screen);
                    return <button type="button" className={completed ? 'is-complete' : ''} key={screen} onClick={() => setAbaAtiva(screen)}><i>{completed ? <CheckCircle size={18} /> : index + 1}</i><span><strong>{label}</strong><small>{description}</small></span></button>;
                  })}
                </div>
                <button className="trial-guide-close" type="button" title="Concluir roteiro" aria-label="Concluir roteiro" onClick={() => { localStorage.setItem(`termosync_trial_guide_${userId}`, 'done'); setShowTrialGuide(false); }}><X size={18} /></button>
              </nav>
            )}
          </>
        )}

        {mustChangePassword && <div className="password-change-required" role="alert"><KeyRound size={17} /><span><strong>Proteja seu acesso</strong> Defina uma senha pessoal antes de continuar.</span><button type="button" onClick={() => setAbaAtiva('seguranca_conta')}>Alterar senha</button></div>}

        {bannerTexto && !bannerFechado && (
          <div className="global-announcement-banner anim-slide-up">
            <AlertTriangle size={16} />
            <span><strong>AVISO DO SISTEMA:</strong> {bannerTexto}</span>
            <button onClick={fecharBannerGlobal} title="Ocultar aviso localmente"><X size={14}/></button>
          </div>
        )}

        <Header
          setMenuAberto={setMenuAberto}
          menuRecolhido={menuRecolhido}
          setMenuRecolhido={setMenuRecolhido}
          NAVIGATION={NAVIGATION}
          abaAtiva={abaAtiva}
          activeWorkspace={activeWorkspace}
          onNavigate={setAbaAtiva}
          mostrarNotificacoes={mostrarNotificacoes}
          setMostrarNotificacoes={setMostrarNotificacoes}
          notificacoesDaFilial={notificacoesDaFilial}
          resolverTodasNotificacoes={resolverTodasNotificacoes}
          getAlertConfig={getAlertConfig}
          isFeatureEnabled={isFeatureEnabled}
          isOffline={isOffline}
          systemHealth={systemHealth}
          setShowCommandPalette={setShowCommandPalette}
          alternarSom={alternarSom}
          somAtivoState={somAtivoState}
          toggleFullScreen={toggleFullScreen}
          isFullScreen={isFullScreen}
          uiDensity={uiDensity}
          setUiDensity={setUiDensity}
          toggleUiDensity={toggleUiDensity}
          setIsDarkMode={setIsDarkMode}
          isDarkMode={isDarkMode}
          supportContext={{ role: userRole, filial: filialAtiva, apiUrl: getApiUrl() }}
        />

        {showDeveloperEnvironmentBanner && (
          <div className={`developer-environment-banner ${runtimeEnvironment === 'PRODUCTION' ? 'production' : ''}`} role="status">
            <span>Ambiente</span>
            <strong>{runtimeEnvironment}</strong>
            <p>Ações privilegiadas são auditadas. Confirme o escopo antes de executar SQL, deploy ou alterações globais.</p>
          </div>
        )}

        {(isOffline || systemHealth.status === 'degraded') && (
          <div className={`app-health-banner ${isOffline ? 'offline' : 'degraded'} anim-slide-up`} role="status" aria-live="polite">
            <div className="app-health-banner-main">
              {isOffline ? <Wifi size={18} /> : <AlertTriangle size={18} />}
              <div>
                <strong>{isOffline ? 'Modo offline ativo' : 'Serviços em atenção'}</strong>
                <span>
                  {isOffline
                    ? 'O sistema está usando dados locais sempre que possível. Alterações críticas ficam bloqueadas até reconectar.'
                    : 'A API respondeu com degradação. Banco, MQTT ou integrações podem estar instáveis.'}
                </span>
              </div>
            </div>
            <button type="button" className="btn btn-outline" onClick={atualizarTelaMobile} disabled={isPullRefreshing || isOffline}>
              {isPullRefreshing ? <Loader2 size={16} className="spin" /> : <Activity size={16} />}
              Sincronizar
            </button>
          </div>
        )}

        <div
          className={`mobile-pull-refresh ${isPullRefreshing ? 'refreshing' : ''} ${pullDistance >= 64 ? 'ready' : ''}`}
          style={{ transform: `translate3d(-50%, ${Math.max(0, pullDistance - 54)}px, 0)`, opacity: pullDistance > 4 || isPullRefreshing ? 1 : 0 }}
          aria-hidden="true"
        >
          <Loader2 size={18} />
          <span>{isPullRefreshing ? 'Atualizando' : pullDistance >= 64 ? 'Solte para atualizar' : 'Puxe para atualizar'}</span>
        </div>

        {activeWorkspace && (
          <nav className="workspace-tabs" aria-label={activeWorkspace.label}>
            <span className="workspace-tabs-label"><small>Módulo</small><strong>{activeWorkspace.label}</strong><em>{activeWorkspace.kind}</em></span>
            <div className="workspace-tabs-list" role="tablist">
              {activeWorkspace.tabs.map((item) => {
                const ItemIcon = item.icon;
                const isActive = item.id === abaAtiva;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={isActive ? 'active' : ''}
                    onClick={() => setAbaAtiva(item.id)}
                  >
                    <ItemIcon size={16} />
                    <span>{item.tabLabel}</span>
                    {Number(item.badge) > 0 && <small className="workspace-tab-badge">{item.badge > 99 ? '99+' : item.badge}</small>}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        <div className="content-area">
          <ErrorBoundary
            key={abaAtiva}
            forceError={import.meta.env.DEV && new URLSearchParams(window.location.search).get('previewError') === 'module'}
            scope="module"
            moduleName={activeScreenLabel}
            onGoHome={() => setAbaAtiva('dashboard')}
            onOpenSupport={() => setAbaAtiva('suporte')}
          >
            <Suspense fallback={<Loader message="Carregando módulo..." />}>
            {!isModuloOculto('dashboard') && abaAtiva === 'dashboard' && ( <Dashboard equipamentosDaFilial={equipamentosDaFilial} filialAtiva={filialAtiva} qtdTotal={qtdTotal} qtdOperando={qtdOperando} qtdDegelo={qtdDegelo} qtdFalha={qtdFalha} dadosDonutStatus={dadosDonutStatus} notificacoesDaFilial={notificacoesDaFilial} resolverTodasNotificacoes={resolverTodasNotificacoes} isOffline={isOffline} pedirNotaResolucao={pedirNotaResolucao} isDarkMode={isDarkMode} contatosDb={contatosDb} chamados={chamados} api={api} userRole={userRole} onNavigate={setAbaAtiva} showToast={showToast} irParaChat={(id) => { setAbaAtiva('chat'); if (id) { const c = contatosDb.find(x => String(x.id) === String(id)); if (c) setContatoChatAtivo(c); } }} socket={socketInstance} userId={userId} nomeLogado={nomeLogado} setHistoricoChat={setHistoricoChat} /> )}
            {!isModuloOculto('assistente') && abaAtiva === 'assistente' && ( <AssistenteOperacao key={filialAtiva} equipamentosDaFilial={equipamentosDaFilial} notificacoesDaFilial={notificacoesDaFilial} chamados={chamados} userRole={userRole} filialAtiva={filialAtiva} onNavigate={(id) => setAbaAtiva(id)} showToast={showToast} /> )}
            {!isModuloOculto('resumo_loja') && abaAtiva === 'resumo_loja' && ( <ResumoLoja equipamentosDaFilial={equipamentosDaFilial} notificacoesDaFilial={notificacoesDaFilial} chamados={chamados} filialAtiva={filialAtiva} userRole={userRole} onNavigate={setAbaAtiva} /> )}
            {!isModuloOculto('central_procedimentos') && abaAtiva === 'central_procedimentos' && ( <CentralProcedimentos api={api} notificacoes={notificacoesDaFilial} onNavigate={(id) => setAbaAtiva(id)} showToast={showToast} userRole={userRole} /> )}
            {!isModuloOculto('checklist_turno') && abaAtiva === 'checklist_turno' && ( <ChecklistTurno api={api} filialAtiva={filialAtiva} showToast={showToast} userRole={userRole} socket={socketInstance} /> )}
            {!isModuloOculto('resumo_turno') && abaAtiva === 'resumo_turno' && ( <ResumoTurno equipamentosDaFilial={equipamentosDaFilial} notificacoesDaFilial={notificacoesDaFilial} chamados={chamados} filialAtiva={filialAtiva} userRole={userRole} api={api} socket={socketInstance} onNavigate={setAbaAtiva} /> )}
            {!isModuloOculto('plano_dia') && abaAtiva === 'plano_dia' && ( <PlanoDia api={api} filialAtiva={filialAtiva} showToast={showToast} userRole={userRole} socket={socketInstance} /> )}
            {!isModuloOculto('resumo_executivo') && abaAtiva === 'resumo_executivo' && ( <ResumoExecutivo api={api} filialAtiva={filialAtiva} socket={socketInstance} onNavigate={setAbaAtiva} /> )}
            {podeAcessarModulo('timeline_operacional') && abaAtiva === 'timeline_operacional' && ( <TimelineOperacional notificacoes={notificacoes} historicoAlertas={historicoAlertas} chamados={chamados} filialAtiva={filialAtiva} onNavigate={setAbaAtiva} /> )}
            {!isModuloOculto('suporte') && abaAtiva === 'suporte' && ( <Suporte api={api} socket={socketInstance} userRole={userRole} nomeLogado={nomeLogado} userFilial={userFilial} showToast={showToast} isOffline={isOffline} onNavigate={setAbaAtiva} /> )}
            {podeAcessarModulo('centro_comando') && abaAtiva === 'centro_comando' && ( <CentroComando onNavigate={(id) => setAbaAtiva(id)} qtdTotal={qtdTotal} qtdOperando={qtdOperando} qtdDegelo={qtdDegelo} qtdFalha={qtdFalha} notificacoesDaFilial={notificacoesDaFilial} chamados={chamados} equipamentosDaFilial={equipamentosDaFilial} isOffline={isOffline} userRole={userRole} filialAtiva={filialAtiva} /> )}
            {!isModuloOculto('mapa') && abaAtiva === 'mapa' && ( <MapaCalor equipamentosDaFilial={equipamentosDaFilial} notificacoesDaFilial={notificacoesDaFilial} filialAtiva={filialAtiva} showToast={showToast} onNavigate={setAbaAtiva} /> )}
            {!isModuloOculto('kanban') && abaAtiva === 'kanban' && ( <Kanban chamados={chamados} api={api} carregarChamados={carregarChamados} showToast={showToast} isOffline={isOffline} filialAtiva={filialAtiva} /> )}
            {!isModuloOculto('metrologia') && abaAtiva === 'metrologia' && ( <Metrologia equipamentosDaFilial={equipamentosDaFilial} editarEquipamento={editarEquipamento} userRole={userRole} filialAtiva={filialAtiva} /> )}
            {!isModuloOculto('simulador') && abaAtiva === 'simulador' && userRole === 'DEV' && ( <Simulador api={api} equipamentos={equipamentos} showToast={showToast} socket={socketInstance} setModalConfig={setModalConfig} /> )}
            {!isModuloOculto('hardware') && abaAtiva === 'hardware' && userRole === 'DEV' && ( <HardwareIoT showToast={showToast} isOffline={isOffline} socket={socketInstance} setModalConfig={setModalConfig} /> )}
            {!isModuloOculto('seguranca_conta') && abaAtiva === 'seguranca_conta' && ( <SegurancaConta api={api} showToast={showToast} fazerLogout={fazerLogout} onPasswordChanged={() => { setMustChangePassword(false); sessionStorage.setItem('mustChangePassword', 'false'); if (trialInfo.active) setShowTrialGuide(true); }} /> )}
            {podeAcessarModulo('documentacao') && abaAtiva === 'documentacao' && ( <Documentacao userRole={userRole} onNavigate={setAbaAtiva} showToast={showToast} /> )}
            {podeAcessarModulo('privacidade') && abaAtiva === 'privacidade' && ( <Privacidade userRole={userRole} userFilial={userFilial} onNavigate={setAbaAtiva} showToast={showToast} /> )}
            {!isModuloOculto('sobre') && abaAtiva === 'sobre' && ( <Sobre onNavigate={setAbaAtiva} isOffline={isOffline} userRole={userRole} /> )}
            {!isModuloOculto('chat') && abaAtiva === 'chat' && isFeatureEnabled('enableChat') && ( <Chat api={api} contatosDb={contatosDb} nomeLogado={nomeLogado} socket={socketInstance} userId={userId} historicoChat={historicoChat} setHistoricoChat={setHistoricoChat} contatoAtivo={contatoChatAtivo} setContatoAtivo={setContatoChatAtivo} naoLidasPorContato={naoLidasPorContato} setNaoLidasPorContato={setNaoLidasPorContato} showToast={showToast} /> )}
            {!isModuloOculto('motores') && abaAtiva === 'motores' && ( <Monitoramento isTemp={true} listaSetores={listaSetores} equipamentosDaFilial={equipamentosDaFilial} socket={socketInstance} filialAtiva={filialAtiva} onNavigate={setAbaAtiva} /> )}
            {!isModuloOculto('umidade') && abaAtiva === 'umidade' && ( <Monitoramento isTemp={false} listaSetores={listaSetores} equipamentosDaFilial={equipamentosDaFilial} socket={socketInstance} filialAtiva={filialAtiva} onNavigate={setAbaAtiva} /> )}
            {podeAcessarModulo('inventario_iot') && abaAtiva === 'inventario_iot' && ( <InventarioIoT equipamentos={equipamentos} filialAtiva={filialAtiva} listaSetores={listaSetores} socket={socketInstance} /> )}
            {!isModuloOculto('equipamentos') && abaAtiva === 'equipamentos' && ( <Equipamentos api={api} showToast={showToast} isOffline={isOffline} userRole={userRole} userFilial={userFilial} filiaisDb={filiaisDb} listaSetores={listaSetores} listaTipos={listaTipos} carregarDadosBase={carregarDadosBase} equipamentosFiltradosLista={equipamentosFiltradosLista} editarEquipamento={editarEquipamento} pedirExclusao={pedirExclusao} /> )}

            {!isModuloOculto('relatorios') && abaAtiva === 'relatorios' && ( <Relatorios api={api} filialAtiva={filialAtiva} showToast={showToast} isDarkMode={isDarkMode} isOffline={isOffline} /> )}
            {!isModuloOculto('energia') && abaAtiva === 'energia' && ( <GestaoEnergetica api={api} filialAtiva={filialAtiva} showToast={showToast} isDarkMode={isDarkMode} isOffline={isOffline} /> )}
            {!isModuloOculto('historico') && abaAtiva === 'historico' && ( <HistoricoLogs historicoFiltradoLista={historicoFiltradoLista} gerarExportacao={gerarExportacao} /> )}
            {!isModuloOculto('chamados') && abaAtiva === 'chamados' && ( <Chamados userRole={userRole} filialAtiva={filialAtiva} nomeLogado={nomeLogado} chamados={chamados} tecnicosDb={tecnicosDb} equipamentosDaFilial={equipamentosDaFilial} api={api} carregarChamados={carregarChamados} showToast={showToast} isOffline={isOffline} gerarLoteOS={gerarLoteOS} /> )}
            {podeAcessarModulo('sla_chamados') && abaAtiva === 'sla_chamados' && ( <SLAChamados chamados={chamados} filialAtiva={filialAtiva} /> )}
            {!isModuloOculto('historico_chamados') && abaAtiva === 'historico_chamados' && ( <HistoricoChamados userRole={userRole} filialAtiva={filialAtiva} nomeLogado={nomeLogado} chamados={chamados} tecnicosDb={tecnicosDb} gerarLoteOS={gerarLoteOS} api={api} carregarChamados={carregarChamados} showToast={showToast} /> )}

            {!isModuloOculto('aprovacoes') && abaAtiva === 'aprovacoes' && userRole === 'DEV' && ( <AprovacoesSaaS showToast={showToast} isOffline={isOffline} api={api} socket={socketInstance} setModalConfig={setModalConfig} /> )}

            {!isModuloOculto('lojas') && abaAtiva === 'lojas' && (userRole === 'ADMIN' || userRole === 'DEV') && ( <GestaoLojas api={api} showToast={showToast} carregarDadosBase={carregarDadosBase} setModalConfig={setModalConfig} /> )}
            {!isModuloOculto('usuarios') && abaAtiva === 'usuarios' && (userRole === 'ADMIN' || userRole === 'DEV') && ( <GestaoUsuarios api={api} showToast={showToast} usuariosLista={usuariosLista} carregarUsuarios={carregarUsuarios} filiaisDb={filiaisDb} setModalConfig={setModalConfig} /> )}
            {!isModuloOculto('parametros') && abaAtiva === 'parametros' && (userRole === 'ADMIN' || userRole === 'DEV') && ( <ParametrosGlobais api={api} showToast={showToast} listaSetores={listaSetores} listaTipos={listaTipos} carregarParametrosGerais={carregarParametrosGerais} carregarDadosBase={carregarDadosBase} setModalConfig={setModalConfig} userRole={userRole} /> )}

            {podeAcessarModulo('central_saude') && abaAtiva === 'central_saude' && ( <CentralSaudeSistema api={api} socket={socketInstance} systemHealth={systemHealth} isOffline={isOffline} showToast={showToast} userRole={userRole} /> )}
            {abaAtiva === 'bi' && <CentroInteligenciaBI api={api} isDarkMode={isDarkMode} showToast={showToast} />}
            {['empresas', 'dev_panel', 'saas', 'billing', 'system', 'soc', 'atualizacoes', 'sql_terminal', 'websocket_stream', 'network_scanner', 'monitor_edge'].includes(abaAtiva) && userRole === 'DEV' && (
               <PainelDesenvolvedor
                 api={api} socket={socketInstance} abaAtiva={abaAtiva} isDevAuthenticated={isDevAuthenticated}
                 onAuthenticate={() => { setIsDevAuthenticated(true); sessionStorage.setItem('devAuth', 'true'); }} onLogout={fazerLogout} showToast={showToast}
                 sysConfig={sysConfig} updateSysConfig={updateSysConfig} tocarAlarme={tocarAlarme} usuariosLista={usuariosLista} filiaisDb={filiaisDb} setModalConfig={setModalConfig}
                 navigationCatalog={NAVIGATION}
               />
             )}

            {((!podeAcessarModulo(abaAtiva) && !['aprovacoes', 'empresas', 'dev_panel', 'saas', 'billing', 'system', 'soc', 'atualizacoes', 'sql_terminal', 'websocket_stream', 'network_scanner', 'monitor_edge'].includes(abaAtiva)) || (abaAtiva === 'chat' && !isFeatureEnabled('enableChat'))) && (
               <div className="empty-state dashboard-empty anim-fade-in" style={{marginTop: '2rem'}}>
                  <div className="empty-shield-box" style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)' }}><AlertOctagon size={48} color="var(--danger)" /></div>
                  <h3 className="empty-title" style={{ color: 'var(--danger)' }}>Acesso Restrito</h3>
                  <p className="empty-subtitle">As políticas de governação atuais impedem a visualização deste módulo.</p>
               </div>
            )}
            </Suspense>
          </ErrorBoundary>
        </div>
        <SystemFooter variant="desktop" systemHealth={systemHealth} isOffline={isOffline} userRole={userRole} navigation={NAVIGATION_ATIVA} onNavigate={setAbaAtiva} />
      </main>

      <nav className="mobile-tab-bar" aria-label="Navegação principal mobile">
        {mobilePrimaryNav.map(item => (
          <button
            key={item.id}
            type="button"
            className={`mobile-tab-item ${activeNavigationId === item.id ? 'active' : ''}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              navegarMobileTab(item.id);
            }}
            title={item.label}
          >
            <item.icon size={20} />
            <span>{MOBILE_NAV_LABELS[item.id] || item.label}</span>
            {Number(item.badge) > 0 && (
              <small>{Number(item.badge) > 99 ? '99+' : Number(item.badge)}</small>
            )}
          </button>
        ))}
      </nav>

      {/* MODAL FLUTUANTE DE NOTIFICAÇÕES (POP-UP INTERATIVO) */}
      {popupAlerta && (
        <div className="popup-notificacao-overlay anim-slide-up" style={{
          position: 'fixed',
          bottom: '25px',
          right: '25px',
          zIndex: 99999,
          width: '340px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '16px',
          padding: '1.2rem',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px color-mix(in srgb, var(--info) 15%, transparent)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} color="var(--info)" className="pulse-blue-shadow" />
              <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{popupAlerta.titulo}</strong>
            </div>
            <button
              onClick={() => setPopupAlerta(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
            >
              <X size={16} />
            </button>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: '0 0 1.2rem 0', lineHeight: '1.4' }}>
            {popupAlerta.mensagem}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-outline"
              style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}
              onClick={() => setPopupAlerta(null)}
            >
              Dispensar
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}
              onClick={() => {
                setAbaAtiva(popupAlerta.abaDestino);
                setPopupAlerta(null);
              }}
            >
              Ver Agora
            </button>
          </div>
        </div>
      )}

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-message" dangerouslySetInnerHTML={{ __html: t.message }}></span>
            <button className="toast-close-btn" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}><X size={16}/></button>
          </div>
        ))}
      </div>

      {equipEditando && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3><Edit size={20} style={{ marginRight: '10px' }} /> Editar Ativo IoT</h3>
            <form onSubmit={salvarEdicaoEquipamento}>
              <div className="form-grid">
                <div className="input-group"><label>Identificação</label><div className="input-wrapper"><input type="text" value={formEditEquip.nome} onChange={(e) => setFormEditEquip({ ...formEditEquip, nome: e.target.value })} required disabled={isOffline} /></div></div>
                <div className="input-group"><label>Filial Física</label><div className="input-wrapper"><select value={formEditEquip.filial} onChange={(e) => setFormEditEquip({ ...formEditEquip, filial: e.target.value })} required disabled={userRole === 'LOJA' || isOffline}><option value="">Selecione...</option>{filiaisDb?.map(f => <option key={f} value={f}>{f}</option>)}</select></div></div>
                <div className="input-group"><label>Setor Comercial</label><div className="input-wrapper"><select value={formEditEquip.setor} onChange={(e) => setFormEditEquip({ ...formEditEquip, setor: e.target.value })} required disabled={isOffline}><option value="">Selecione...</option>{listaSetores?.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}</select></div></div>
                <div className="input-group"><label>Tipo de Refrigeração</label><div className="input-wrapper"><select value={formEditEquip.tipo} onChange={(e) => setFormEditEquip({ ...formEditEquip, tipo: e.target.value })} required disabled={isOffline}><option value="">Selecione...</option>{listaTipos?.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}</select></div></div>
                <div className="input-group"><label>Data de Calibração</label><div className="input-wrapper"><input type="date" value={formEditEquip.data_calibracao} onChange={(e) => setFormEditEquip({ ...formEditEquip, data_calibracao: e.target.value })} required disabled={isOffline} /></div></div>
                <div className="input-group"><label>Degelo Automático (H)</label><div className="input-wrapper"><input type="number" min="1" value={formEditEquip.intervalo_degelo} onChange={(e) => setFormEditEquip({ ...formEditEquip, intervalo_degelo: e.target.value })} required disabled={isOffline} /></div></div>
                <div className="input-group"><label>Temp. Min (°C)</label><div className="input-wrapper"><input type="number" step="0.1" value={formEditEquip.temp_min} onChange={(e) => setFormEditEquip({ ...formEditEquip, temp_min: e.target.value })} required disabled={isOffline} /></div></div>
                <div className="input-group"><label>Temp. Max (°C)</label><div className="input-wrapper"><input type="number" step="0.1" value={formEditEquip.temp_max} onChange={(e) => setFormEditEquip({ ...formEditEquip, temp_max: e.target.value })} required disabled={isOffline} /></div></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setEquipEditando(null)}>Abortar</button>
                <button type="submit" className="btn btn-primary" disabled={isOffline}><Save size={18} /> Gravar Parâmetros</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalConfig.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content prompt-box">
            <h3 style={{ justifyContent: 'center', marginBottom: '1rem' }}>{modalConfig.title}</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.5' }}>{modalConfig.message}</p>
            {modalConfig.isPrompt && (
              <div className="modal-prompt-field" style={{ marginBottom: '1.5rem' }}>
                <textarea
                  value={modalConfig.promptValue || ''}
                  onChange={(e) => setModalConfig({...modalConfig, promptValue: e.target.value})}
                  placeholder={modalConfig.promptPlaceholder || 'Insira a justificativa...'}
                  maxLength={modalConfig.promptMaxLength || 280}
                  rows={4}
                  autoFocus
                />
                <small>{String(modalConfig.promptValue || '').length}/{modalConfig.promptMaxLength || 280}</small>
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: '0', paddingTop: '0', border: 'none' }}>
              <button className="btn btn-outline w-100" onClick={() => setModalConfig({...modalConfig, isOpen: false})}>Cancelar</button>
              <button
                className="btn btn-primary w-100"
                disabled={modalConfig.requirePrompt && !String(modalConfig.promptValue || '').trim()}
                onClick={() => { modalConfig.onConfirm?.(modalConfig.promptValue); setModalConfig({...modalConfig, isOpen: false}); }}
              >
                {modalConfig.confirmLabel || 'Prosseguir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
