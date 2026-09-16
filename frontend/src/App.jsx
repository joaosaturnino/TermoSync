import React, { useState, useEffect, useRef, useMemo, useCallback, Component, Suspense, lazy } from 'react';
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
  Server, Lock, LockKeyhole, Unlock, Loader2, ShieldAlert, DollarSign, Building2,
  Bell, Wifi, Snowflake, Power, DoorOpen, ActivitySquare, ClipboardCheck, ThermometerSnowflake,
  Map, Columns, Target, Cpu, Info, Settings2, ShieldCheck, PieChart,
  Rocket, Database, Network, Sparkles, ClipboardList, BarChart3, CalendarDays, LifeBuoy, Zap, ArrowLeft, Radio, Clock, Timer, Search
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

/**
 * Busca ou monta os dados de get alert config usados no fluxo atual.
 */
const getAlertConfig = (tipo_alerta) => {
  // Mapeia cada tipo de anomalia para ícone, cor e ação sugerida exibida na UI.
  const configs = {
    'REDE': { icon: Wifi, color: 'var(--warning)', action: 'Analisar Rede', critical: true },
    'DEGELO': { icon: Snowflake, color: 'var(--secondary)', action: 'Finalizar Degelo', critical: false },
    'MECANICA': { icon: Power, color: '#f97316', action: 'Acionar Manutenção', critical: true },
    'PORTA': { icon: DoorOpen, color: '#e11d48', action: 'Verificar Porta', critical: true },
    'TEMPERATURA': { icon: ThermometerSnowflake, color: '#ef4444', action: 'Normalizar Temp.', critical: true },
    'UMIDADE': { icon: Droplets, color: '#0ea5e9', action: 'Ajustar Umidade', critical: false },
    'METROLOGIA': { icon: ClipboardCheck, color: '#6366f1', action: 'Agendar Calibração', critical: true },
    'PREDITIVO': { icon: ActivitySquare, color: '#8b5cf6', action: 'Prevenção', critical: false }
  };
  return configs[tipo_alerta] || { icon: AlertTriangle, color: 'var(--danger)', action: 'Investigar', critical: true };
};

/**
 * Prepara escape html para exibicao sem expor dados sensiveis.
 */
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

/**
 * Formata format toast message para exibicao segura na interface.
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
  ADMIN: ['dashboard', 'motores', 'chamados', 'kanban', 'usuarios'],
  MANUTENCAO: ['dashboard', 'motores', 'chamados', 'kanban', 'equipamentos'],
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
 * Agrupa o comportamento de Error Boundary para isolar estado, renderizacao e tratamento de erro.
 */
class ErrorBoundary extends Component {
  // Barreira de falha visual: se uma tela quebrar, o usuário mantém sessão
  // e recebe opção de recarregar sem expor stack trace na interface.
  constructor(props) { super(props); this.state = { hasError: false, errorInfo: null }; }
  static getDerivedStateFromError(_error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { logger.error("Crash interceptado:", error); this.setState({ errorInfo }); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="crash-recovery-screen anim-fade-in">
          <div className="crash-box">
            <Terminal size={56} className="crash-icon pulse-danger-icon" style={{color: 'var(--danger)', marginBottom: '1rem'}} />
            <h2 style={{color: 'white', marginBottom: '1rem'}}>SISTEMA INTERROMPIDO</h2>
            <p className="crash-text" style={{color: '#94a3b8', marginBottom: '1.5rem'}}>Ocorreu uma falha crítica ao renderizar este módulo. A sua sessão e os dados da rede permanecem seguros.</p>
            <div className="crash-code" style={{background: 'rgba(0,0,0,0.5)', padding: '10px', color: '#fca5a5', fontFamily: 'Montserrat', marginBottom: '2rem'}}>ERR_UI_RENDER_FAIL</div>
            <button className="btn btn-danger w-100" onClick={() => window.location.reload()}><Activity size={18} /> REINICIAR NÚCLEO</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Concentra a logica de app para manter o restante do modulo mais legivel.
 */
export default function App() {
  // Estados de autenticação persistem em sessionStorage para sobreviver ao reload
  // sem manter sessão aberta indefinidamente após fechar o navegador.
  const [authScreen, setAuthScreen] = useState('landing');

  useEffect(() => {
    document.documentElement.classList.add('mobile-app', 'native-app');
    document.body.classList.add('mobile-app', 'native-app');
    return () => {
      document.documentElement.classList.remove('mobile-app', 'native-app');
      document.body.classList.remove('mobile-app', 'native-app');
    };
  }, []);

  const [token, setToken] = useState(sessionStorage.getItem('token') || '');
  const [userId, setUserId] = useState(sessionStorage.getItem('userId') || '');
  const [userRole, setUserRole] = useState(sessionStorage.getItem('userRole') || 'LOJA');
  const [userFilial, setUserFilial] = useState(sessionStorage.getItem('userFilial') || 'Todas');
  const [userEmpresa, setUserEmpresa] = useState(sessionStorage.getItem('userEmpresa') || '');
  const [nomeLogado, setNomeLogado] = useState(sessionStorage.getItem('nomeLogado') || '');
  const [papelLogado, setPapelLogado] = useState(sessionStorage.getItem('papelLogado') || '');
  const [loginAtivo, setLoginAtivo] = useState(sessionStorage.getItem('loginAtivo') || '');
  const [isDevAuthenticated, setIsDevAuthenticated] = useState(sessionStorage.getItem('devAuth') === 'true');
  const [abaAtiva, setAbaAtiva] = useState(sessionStorage.getItem('abaAtiva') || 'dashboard');

  // [NOVIDADE] Estado para capturar e ativar a rota do Portal Público (TV)
  const [publicFilial, setPublicFilial] = useState(null);

  const [socketInstance, setSocketInstance] = useState(null);
  const [isDevBooting, setIsDevBooting] = useState(false);
  const [devBootData, setDevBootData] = useState(null);
  const [bannerFechado, setBannerFechado] = useState(true);

  const [gruposExpandidos, setGruposExpandidos] = useState({
    'Desenvolvedor': true, 'Operações': true, 'Serviços': true, 'Auditoria': true, 'Sistema': true, 'Edge_Computing': true
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
  const [latencia, setLatencia] = useState(12);
  const [systemHealth, setSystemHealth] = useState({ status: 'checking', database: 'checking', mqtt: 'checking', whatsapp: 'checking' });

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [cmdSearch, setCmdSearch] = useState('');
  const [isLocked, setIsLocked] = useState(() => sessionStorage.getItem('terminalLocked') === 'true');
  const [lockPassword, setLockPassword] = useState('');
  const [lockError, setLockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Estados de dados compartilhados por várias telas. As listas são carregadas
  // sob demanda e reaproveitadas entre Dashboard, Monitoramento, Chamados e BI.
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', isPrompt: false, promptValue: '', onConfirm: null });
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
  // [NOVIDADE] INTERCEPTADOR DA URL PARA O PORTAL PÚBLICO
  // Lê a URL e ativa o Portal TV antes do login ser solicitado
  // ============================================================================
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/live/')) {
      const filialRoute = path.replace('/live/', '');
      if (filialRoute) {
        setPublicFilial(decodeURIComponent(filialRoute));
      }
    }
  }, []);

  const fazerLogout = useCallback(() => {
    // Logout precisa limpar estado React e sessionStorage para impedir reuso de
    // token antigo depois de revogação, troca de usuário ou bloqueio de sessão.
    setToken(''); setUserId('');
    const chavesAuth = ['token', 'userId', 'userRole', 'userFilial', 'userEmpresa', 'nomeLogado', 'papelLogado', 'loginAtivo', 'devAuth', 'abaAtiva', 'terminalLocked'];
    chavesAuth.forEach(k => sessionStorage.removeItem(k));
    sessionStorage.clear();

    setUserRole('LOJA'); setUserFilial(''); setUserEmpresa(''); setFilialAtiva('Todas'); setNomeLogado(''); setPapelLogado(''); setLoginAtivo('');
    setAbaAtiva('dashboard'); setMenuAberto(false); setNaoLidasPorContato({}); setContatoChatAtivo(null); setShowCommandPalette(false); setIsLocked(false);
    setIsDevAuthenticated(false);
    setPopupAlerta(null);
  }, []);

  const { authState } = useSecurity(token, fazerLogout);

  const { sysConfig, isFeatureEnabled, isModuloOculto, updateSysConfig, getPlanoAtual } = useSystemCore(userRole, loginAtivo, userFilial, abaAtiva, setAbaAtiva);
  const isFeatureEnabledRef = useRef(isFeatureEnabled);
  useEffect(() => { isFeatureEnabledRef.current = isFeatureEnabled; }, [isFeatureEnabled]);

  useEffect(() => {
    if (userRole === 'DEV') {
      setGruposExpandidos({ 'Desenvolvedor': true, 'Operações': false, 'Serviços': false, 'Auditoria': false, 'Sistema': false, 'Edge_Computing': true });
    } else {
      setGruposExpandidos({ 'Desenvolvedor': true, 'Operações': true, 'Serviços': true, 'Auditoria': true, 'Sistema': true, 'Edge_Computing': false });
    }
  }, [userRole]);

  /**
   * Concentra a logica de toggle grupo para manter o restante do modulo mais legivel.
   */
  const toggleGrupo = (grupo) => {
    setGruposExpandidos(prev => ({ ...prev, [grupo]: !prev[grupo] }));
  };

  useEffect(() => { if (token) sessionStorage.setItem('abaAtiva', abaAtiva); }, [abaAtiva, token]);
  useEffect(() => {
    if (isLocked) sessionStorage.setItem('terminalLocked', 'true');
    else sessionStorage.removeItem('terminalLocked');
  }, [isLocked]);

  useEffect(() => {
    if (!token || isLocked) return;
    let idleTimeout;
    /**
     * Concentra a logica de reset idle timer para manter o restante do modulo mais legivel.
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
     * Concentra a logica de handle key down para manter o restante do modulo mais legivel.
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
   * Concentra a logica de fechar banner global para manter o restante do modulo mais legivel.
   */
  const fecharBannerGlobal = () => {
    setBannerFechado(true);
    if (bannerTexto) localStorage.setItem('termosync_banner_oculto', bannerTexto);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const impersonateToken = urlParams.get('impersonateToken');
    const impersonateLoja = urlParams.get('impersonateLoja');

    if (impersonateToken && impersonateLoja) {
      window.history.replaceState({}, document.title, window.location.pathname);
      const chavesAuth = ['token', 'userId', 'userRole', 'userFilial', 'userEmpresa', 'nomeLogado', 'papelLogado', 'loginAtivo', 'devAuth', 'abaAtiva'];
      chavesAuth.forEach(k => sessionStorage.removeItem(k));

      const role = 'ADMIN';
      const identityName = `Suporte Remoto (${impersonateLoja})`;
      const roleTitle = 'Acesso Master (Impersonate)';
      const loginName = `suporte_${impersonateLoja.toLowerCase().replace(/\s+/g, '')}`;

      setToken(impersonateToken); setUserId('9999'); setUserRole(role);
      setUserFilial(impersonateLoja); setFilialAtiva(impersonateLoja);
      setAbaAtiva('dashboard'); setMenuAberto(false);
      setNomeLogado(identityName); setPapelLogado(roleTitle); setLoginAtivo(loginName); setIsDevAuthenticated(false);

      sessionStorage.setItem('token', impersonateToken); sessionStorage.setItem('userId', '9999');
      sessionStorage.setItem('userRole', role); sessionStorage.setItem('userFilial', impersonateLoja);
      sessionStorage.setItem('nomeLogado', identityName); sessionStorage.setItem('papelLogado', roleTitle);
      sessionStorage.setItem('loginAtivo', loginName); sessionStorage.setItem('devAuth', 'false');

      setTimeout(() => {
         const fakeEvent = new CustomEvent('forceToast', { detail: { msg: `<b>Modo Impersonate Ativo:</b> Controle remoto de <strong>${impersonateLoja}</strong> estabelecido com sucesso.`, type: 'warning' }});
         window.dispatchEvent(fakeEvent);
      }, 1000);
    }
  }, []);

  const aplicarSessaoAutenticada = useCallback((data, usuarioInput) => {
    // Normaliza a identidade exibida na interface conforme o papel retornado
    // pelo backend e grava os dados mínimos necessários para a sessão atual.
    const gNome = data.nome_gerente || '';
    const cNome = data.nome_coordenador || '';
    let identityName = usuarioInput;
    let roleTitle = 'Gestor de Loja';

    if (data.role === 'ADMIN') { identityName = 'Administrador'; roleTitle = 'Acesso Master'; }
    else if (data.role === 'MANUTENCAO') { identityName = data.nome_tecnico || 'Técnico'; roleTitle = 'Manutenção Global'; }
    else if (data.role === 'LOJA') {
      if (gNome) { identityName = gNome; roleTitle = 'Gerente da Loja'; }
      else if (cNome) { identityName = cNome; roleTitle = 'Coordenador da Loja'; }
      else { identityName = 'Equipe Geral'; roleTitle = 'Acesso da Loja'; }
    }

    setToken(data.token); setUserId(data.id); setUserRole(data.role); setUserFilial(data.filial); setUserEmpresa(data.empresa);
    setFilialAtiva(data.role !== 'LOJA' ? 'Todas' : data.filial);
    setAbaAtiva('dashboard'); setMenuAberto(false); setNomeLogado(identityName); setPapelLogado(roleTitle); setLoginAtivo(usuarioInput);

    sessionStorage.setItem('token', data.token); sessionStorage.setItem('userId', data.id);
    sessionStorage.setItem('userRole', data.role); sessionStorage.setItem('userFilial', data.filial); sessionStorage.setItem('userEmpresa', data.empresa);
    sessionStorage.setItem('nomeLogado', identityName); sessionStorage.setItem('papelLogado', roleTitle);
    sessionStorage.setItem('loginAtivo', usuarioInput);

    window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: `Protocolo aceito. Bem-vindo(a), ${identityName}.`, type: 'success' }}));
  }, []);

  /**
   * Concentra a logica de fazer login para manter o restante do modulo mais legivel.
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
        window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: 'SISTEMA EM MANUTENÇÃO. Acesso restrito.', type: 'warning' }}));
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
      setLoginErro('Credenciais inválidas.');
      window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: 'Acesso Negado.', type: 'error' }}));
    } finally { setIsLoginLoading(false); }
  };

  /**
   * Concentra a logica de concluir mfa login para manter o restante do modulo mais legivel.
   */
  const concluirMfaLogin = async (code) => {
    if (!mfaChallenge?.challengeId) return;
    setIsMfaLoading(true);
    setLoginErro('');
    try {
      const res = await axios.post(`${getApiUrl()}/login/mfa`, { challengeId: mfaChallenge.challengeId, code });
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
   */
  const completeDevBoot = () => {
    if (!devBootData) return;
    const { token, id, role, filial, empresa, identityName, roleTitle, loginName } = devBootData;

    setToken(token); setUserId(id); setUserRole(role); setUserFilial(filial); setUserEmpresa(empresa);
    setFilialAtiva('Todas'); setAbaAtiva('dev_panel'); setMenuAberto(false);
    setNomeLogado(identityName); setPapelLogado(roleTitle); setLoginAtivo(loginName); setIsDevAuthenticated(true);

    sessionStorage.setItem('token', token); sessionStorage.setItem('userId', id); sessionStorage.setItem('userRole', role); sessionStorage.setItem('userFilial', filial); sessionStorage.setItem('userEmpresa', empresa); sessionStorage.setItem('nomeLogado', identityName); sessionStorage.setItem('papelLogado', roleTitle); sessionStorage.setItem('loginAtivo', loginName); sessionStorage.setItem('devAuth', 'true');

    window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: `Protocolo ROOT aceito. Bem-vindo(a), ${identityName}.`, type: 'success' }}));
    setIsDevBooting(false); setDevBootData(null);
  };

  useEffect(() => {
    /**
     * Concentra a logica de handle kill switch para manter o restante do modulo mais legivel.
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
   * Concentra a logica de handle unlock para manter o restante do modulo mais legivel.
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
   * Concentra a logica de toggle full screen para manter o restante do modulo mais legivel.
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

      if (status === 401 && !papelLogado.includes('Impersonate')) {
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
    if (userRole !== 'DEV') { try { const gConf = JSON.parse(localStorage.getItem('termosync_sysconfig_saas'))?.regras?.['GLOBAL']?.features; const rConf = JSON.parse(localStorage.getItem('termosync_sysconfig_saas'))?.regras?.[userRole]?.features; if (gConf && gConf.enableToasts === false) return; if (rConf && rConf.enableToasts === false) return; } catch(error) { logger.warn('Não foi possível ler as preferências de toast.', error); } }
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message: formatToastMessage(message), type }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4500);
  }, [userRole]);
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  useEffect(() => {
    /**
     * Concentra a logica de listen toasts para manter o restante do modulo mais legivel.
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
  const carregarTecnicos = useCallback(async () => { if (!token || isOffline) return; try { const res = await api.get('/tecnicos'); setTecnicosDb(Array.isArray(res.data) ? res.data : []); } catch (error) { logger.warn('Falha ao carregar técnicos.', error); } }, [api, token, isOffline]);
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
    if (!token || isOffline || !isFeatureEnabledRef.current('telemetryStream')) return;
    const socket = io(getSocketUrl(), { transports: ['websocket'], upgrade: false });
    setSocketInstance(socket);
    if (userId && !papelLogado.includes('Impersonate')) socket.emit('registrar_usuario', userId);

    socket.on('nova_leitura', (dadosNovaLeitura) => {
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
      if (userRoleRef.current !== 'DEV' && !papelLogadoRef.current.includes('Impersonate')) {
        if (alertaCompleto.empresa && alertaCompleto.empresa !== userEmpresaRef.current) return;
      }

      if (filialAtivaRef.current === 'Todas' || filialAtivaRef.current === alertaCompleto.filial) {
        if (userRoleRef.current !== 'DEV') {
          if (!alertaCompleto.silencioso) {
            const tiposCriticos = ['MECANICA', 'PORTA', 'TEMPERATURA', 'REDE', 'METROLOGIA'];
            if (tiposCriticos.includes(alertaCompleto.tipo_alerta)) {
              tocarAlarmeRef.current();
              showToastRef.current(`🚨 <b>ANOMALIA DETECTADA:</b> O equipamento <b>${alertaCompleto.equipamento_nome}</b> registrou uma ocorrência: ${alertaCompleto.mensagem}`, 'error');
            }
          }
        }
        setNotificacoes(prev => { if (prev.some(n => n.id === alertaCompleto.id)) return prev; return [alertaCompleto, ...prev]; });
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

    const pingInterval = setInterval(() => { setLatencia(prev => { let novo = prev + (Math.floor(Math.random() * 9) - 4); return novo < 10 ? 10 : novo > 60 ? 60 : novo; }); }, 1500);

    return () => { clearTimeout(timeoutAtualizacao); clearInterval(pingInterval); socket.off('nova_leitura'); socket.off('atualizacao_dados'); socket.off('novo_alerta'); socket.off('novo_pre_cadastro'); socket.off('resposta_suporte'); socket.off('nova_mensagem_chat'); socket.disconnect(); };
  }, [token, isOffline, userId, papelLogado]);

  useEffect(() => {
    // Flush do buffer IoT: atualiza os cards de equipamentos uma vez por segundo,
    // mantendo a UI fluida mesmo com muitos sensores enviando dados.
    const iotFlushInterval = setInterval(() => {
      const keys = Object.keys(bufferLeiturasRef.current);
      if (keys.length > 0) {
        setEquipamentos(prev => prev.map(eq => {
          const reading = bufferLeiturasRef.current[eq.id];
          if (reading) return {
            ...eq,
            ultima_temp: reading.temperatura,
            ultima_umidade: reading.umidade,
            motor_ligado: reading.motor_ligado === true || reading.motor_ligado == 1,
            em_degelo: reading.em_degelo === true || reading.em_degelo == 1,
            ultima_comunicacao: reading.ultima_comunicacao || reading.data_hora || new Date().toISOString(),
            status_conexao: 'online'
          };
          return eq;
        }));
        bufferLeiturasRef.current = {};
      }
    }, 1000);
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
  const dadosDonutStatus = useMemo(() => [ { name: 'Ok', value: qtdOperando, color: 'var(--success)' }, { name: 'Degelo', value: qtdDegelo, color: '#38bdf8' }, { name: 'Falha', value: qtdFalha, color: 'var(--danger)' } ].filter(d => d.value > 0), [qtdOperando, qtdDegelo, qtdFalha]);

  /**
   * Concentra a logica de editar equipamento para manter o restante do modulo mais legivel.
   */
  const editarEquipamento = (eq) => { if (isOffline || isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada.', 'warning'); setEquipEditando(eq.id); setFormEditEquip({ nome: eq.nome, tipo: eq.tipo, temp_min: eq.temp_min, temp_max: eq.temp_max, umidade_min: eq.umidade_min || '', umidade_max: eq.umidade_max || '', intervalo_degelo: eq.intervalo_degelo, duracao_degelo: eq.duracao_degelo, setor: eq.setor, filial: eq.filial, data_calibracao: eq.data_calibracao ? new Date(eq.data_calibracao).toISOString().split('T')[0] : '' }); };
  /**
   * Concentra a logica de salvar edicao equipamento para manter o restante do modulo mais legivel.
   */
  const salvarEdicaoEquipamento = async (e) => { e.preventDefault(); if (isOffline) return; try { await api.put(`/equipamentos/${equipEditando}/edit`, formEditEquip); showToast('Atualizado com sucesso.', 'success'); setEquipEditando(null); carregarDadosBase(); } catch (e) { showToast('Erro de sincronização.', 'error'); } };
  /**
   * Concentra a logica de pedir exclusao para manter o restante do modulo mais legivel.
   */
  const pedirExclusao = (id, nome) => { if (isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada (Leitura).', 'warning'); setModalConfig({ isOpen: true, title: 'Remover Máquina', message: `Remover "${nome}" permanentemente?`, isPrompt: false, onConfirm: async () => { try { await api.delete(`/equipamentos/${id}`); showToast('Ativo purgado do sistema.', 'success'); carregarDadosBase(); } catch (e) { showToast('Ação autorizada.', 'error'); } }}); };

  /**
   * Concentra a logica de pedir nota resolucao para manter o restante do modulo mais legivel.
   */
  const pedirNotaResolucao = (id) => {
    if (isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada (Leitura).', 'warning');
    setModalConfig({ isOpen: true, title: 'Registro de Manutenção', message: 'Descreva a intervenção técnica:', isPrompt: true, promptValue: '', onConfirm: async (nota) => { try { await api.put(`/notificacoes/${id}/resolver`, { nota_resolucao: nota.trim() === '' ? 'Verificado e limpo.' : nota }); showToast('Incidente arquivado.', 'success'); setNotificacoes(prev => prev.filter(n => n.id !== id)); carregarDadosBase(); } catch (e) { showToast('Erro no arquivo.', 'error'); } } });
  };

  /**
   * Concentra a logica de resolver todas notificacoes para manter o restante do modulo mais legivel.
   */
  const resolverTodasNotificacoes = () => {
    if (isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada (Leitura).', 'warning');
    setModalConfig({ isOpen: true, title: 'Limpeza do Painel', message: 'Arquivar todos os alarmes pendentes do radar?', isPrompt: false, onConfirm: async () => { try { await api.put(`/notificacoes/resolver-todas`); showToast('Painel higienizado.', 'success'); setNotificacoes([]); carregarDadosBase(); } catch (e) { showToast('Erro de sistema.', 'error'); } } });
  };

  /**
   * Gera gerar exportacao com os dados necessarios para o proximo passo.
   */
  const gerarExportacao = (tipo) => {
    if (!isFeatureEnabled('allowExports')) return showToast('A exportação de dados foi bloqueada pelas diretrizes do sistema.', 'error');
    if (abaAtiva === 'historico') {
      if (historicoFiltradoLista.length === 0) return showToast("Sem dados para exportar.", "warning");
      if (tipo === 'pdf') {
        const doc = new jsPDF(); doc.setFontSize(18); doc.text("Auditoria de Ocorrências", 14, 20); doc.setFontSize(11); doc.text(`Emitido: ${new Date().toLocaleString()}`, 14, 28); let head = [["Data", "Equipamento", "Ocorrência", "Técnico Responsável"]]; let body = historicoFiltradoLista.map(h => [new Date(h.data_hora).toLocaleString(), `${h.equipamento_nome}`, h.mensagem, h.nota_resolucao]); autoTable(doc, { head, body, startY: 40, theme: 'grid' }); doc.save(`Auditoria_Ocorrencias_${new Date().getTime()}.pdf`);
      } else {
        let csv = "Data,Equipamento,Setor,Ocorrencia,Tecnico\n"; historicoFiltradoLista.forEach(row => { csv += `"${new Date(row.data_hora).toLocaleString()}","${row.equipamento_nome}","${row.setor}","${row.mensagem}","${row.nota_resolucao}"\n`; }); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv' })); link.download = `Auditoria_${new Date().getTime()}.csv`; link.click();
      }
      showToast('Pacote de dados gerado.', 'success');
    } else { showToast('Funcionalidade de PDF não implementada no frontend (usando backend).', 'info'); }
  };

  /**
   * Gera gerar lote os com os dados necessarios para o proximo passo.
   */
  const gerarLoteOS = (listaChamados) => {
    if (!isFeatureEnabled('allowExports')) return showToast('A exportação de dados foi bloqueada pelas diretrizes do sistema.', 'error');
    if (!listaChamados || listaChamados.length === 0) return showToast("Nenhuma OS pendente.", "warning"); const doc = new jsPDF(); listaChamados.forEach((c, index) => { if (index > 0) doc.addPage(); doc.setFontSize(18); doc.text(`Ordem de Serviço (OS) - ${c.status}`, 14, 20); doc.setFontSize(11); doc.text(`Máquina: ${c.equipamento_nome}`, 14, 32); doc.text(`Filial: ${c.filial}`, 14, 40); doc.text(`Abertura: ${new Date(c.data_abertura).toLocaleString()}`, 14, 72); doc.text(doc.splitTextToSize(c.descricao || 'Sem descrição.', 180), 14, 96); if (c.status === 'Concluído') { doc.text(doc.splitTextToSize(c.nota_resolucao || 'Sem nota.', 180), 14, 138); } }); doc.save(`Lote_OS_${new Date().getTime()}.pdf`); showToast('Lote Operacional Baixado.', 'success');
  };

  // ===============================================
  // REGISTRO DE TELAS E REGRAS DE BADGES POR ROLE
  // ===============================================
  const NAVIGATION = [
    { id: 'dev_panel', label: 'Controle', icon: Terminal, roles: ['DEV'], type: 'Desenvolvedor', priority: 1 },
    { id: 'bi', label: 'Centro de Inteligência (BI)', icon: PieChart, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'soc', label: 'Auditoria / SOC', icon: ShieldCheck, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'atualizacoes', label: 'Atualizações / Deploy', icon: Rocket, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'sql_terminal', label: 'Console SQL', icon: Database, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'websocket_stream', label: 'Live Firehose (WS)', icon: Network, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'network_scanner', label: 'Sonda de Rede (IDS)', icon: Network, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'monitor_edge', label: 'Monitor Serial Edge', icon: Radio, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'simulador', label: 'Simulador', icon: Cpu, roles: ['DEV'], type: 'Desenvolvedor' },
    { id: 'hardware', label: 'Hardware IoT', icon: Server, roles: ['DEV'], type: 'Desenvolvedor' },
    { id: 'system', label: 'Operações do Sistema', icon: Settings2, roles: ['DEV'], type: 'Desenvolvedor' },
    { id: 'empresas', label: 'Organizações', icon: Building2, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'aprovacoes', label: 'Onboarding SaaS', icon: CheckCircle, roles: ['DEV'], badge: badgeSaaS, type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'saas', label: 'Licenças SaaS', icon: ShieldAlert, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'billing', label: 'Core Financeiro', icon: DollarSign, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },

    { id: 'dashboard', label: 'Dashboard Operacional', icon: Activity, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: notificacoesDaFilial?.length || 0, type: 'Operações', priority: 1 },
    { id: 'assistente', label: 'Assistente de Operação', icon: Sparkles, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operações', priority: 2 },
    { id: 'resumo_loja', label: 'Resumo da Loja', icon: Building2, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operações' },
    { id: 'central_procedimentos', label: 'Central de Procedimentos', icon: ClipboardCheck, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operações' },
    { id: 'checklist_turno', label: 'Checklist de Turno', icon: ClipboardList, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operações' },
    { id: 'resumo_turno', label: 'Resumo de Turno', icon: BarChart3, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operações' },
    { id: 'plano_dia', label: 'Plano do Dia', icon: CalendarDays, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operações' },
    { id: 'resumo_executivo', label: 'Resumo Executivo', icon: BarChart3, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operações' },
    { id: 'timeline_operacional', label: 'Timeline Operacional', icon: Clock, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Operações' },
    { id: 'mapa', label: 'Planta Digital', icon: Map, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Operações' },
    { id: 'motores', label: 'Monitoramento Térmico', icon: Thermometer, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operações' },
    { id: 'umidade', label: 'Monitoramento de Umidade', icon: Droplets, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operações' },

    { id: 'chamados', label: 'Chamados', icon: Wrench, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: userRole === 'DEV' ? 0 : (chamados?.filter(c => {
      const s = String(c.status || '').trim().toLowerCase();
      return !['concluído', 'fechado', 'cancelado', 'resolvido'].includes(s) && s !== '';
    }).length || 0), type: 'Serviços', priority: 1 },
    { id: 'sla_chamados', label: 'SLA de Chamados', icon: Timer, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços' },
    { id: 'kanban', label: 'Gestão Ágil (Kanban)', icon: Columns, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: totalNaoLidas || 0, type: 'Serviços' },
    { id: 'metrologia', label: 'Controle Metrológico', icon: Target, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços' },
    { id: 'inventario_iot', label: 'Inventário IoT', icon: Cpu, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços' },
    { id: 'equipamentos', label: 'Equipamentos', icon: Server, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços' },
    { id: 'parametros', label: 'Parâmetros Globais', icon: Sliders, roles: ['ADMIN', 'DEV'], type: 'Serviços' },
    { id: 'historico_chamados', label: 'Histórico de Chamados', icon: Archive, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços' },

    { id: 'relatorios', label: 'Relatórios', icon: Leaf, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Auditoria', isPremium: true, priority: 1 },
    { id: 'energia', label: 'Gestão Energética', icon: Zap, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Auditoria' },
    { id: 'historico', label: 'Histórico de Logs', icon: History, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Auditoria', isPremium: true },

    { id: 'lojas', label: 'Gestão de Lojas', icon: Store, roles: ['ADMIN', 'DEV'], type: 'Sistema', priority: 1 },
    { id: 'usuarios', label: 'Identidades e Acessos', icon: Users, roles: ['ADMIN', 'DEV'], type: 'Sistema', priority: 2 },
    { id: 'centro_comando', label: 'Centro de Comando', icon: Target, roles: ['DEV'], type: 'Sistema' },
    { id: 'central_saude', label: 'Saúde do Sistema', icon: ShieldCheck, roles: ['DEV'], type: 'Desenvolvedor', priority: 2 },
    { id: 'suporte', label: 'Suporte ao Sistema', icon: LifeBuoy, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: badgeSuporte, type: 'Sistema' },
    { id: 'seguranca_conta', label: 'Segurança da Conta', icon: LockKeyhole, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Sistema' },
    { id: 'sobre', label: 'Sobre a Plataforma', icon: Info, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Sistema' }
  ].sort((a, b) => {
    const priorityA = Number.isFinite(a.priority) ? a.priority : Infinity;
    const priorityB = Number.isFinite(b.priority) ? b.priority : Infinity;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.label.localeCompare(b.label, 'pt-BR');
  });

  const NAVIGATION_ATIVA = NAVIGATION.filter(nav => !isModuloOculto(nav.id) && nav.roles.includes(userRole) && (nav.id !== 'chat' || isFeatureEnabled('enableChat')) && (!nav.devAuthRequired || isDevAuthenticated));
  const modulosAcessiveis = useMemo(() => new Set(NAVIGATION_ATIVA.map(item => item.id)), [NAVIGATION_ATIVA]);
  const podeAcessarModulo = useCallback((id) => modulosAcessiveis.has(id), [modulosAcessiveis]);

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
      .filter(item => !usedIds.has(item.id))
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
  // RENDERIZAÇÃO DA ROTA PÚBLICA (PORTAL DE TV) ANTES DE QUALQUER LOGIN
  // ============================================================================
  if (publicFilial) {
    return (
      <Suspense fallback={<Loader message="Abrindo portal público..." />}>
        <PortalPublico filialUrl={publicFilial} />
      </Suspense>
    );
  }

  if (isDevBooting) {
    return <DevBootScreen onComplete={completeDevBoot} />;
  }

  if (authState.isVerifying && token) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#020617', color: '#38bdf8' }}>
        <Loader2 size={48} className="spin" />
        <h3 style={{ marginLeft: '15px', fontFamily: 'Montserrat' }}>Verificando Integridade Criptográfica...</h3>
      </div>
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
        <div style={{ position: 'relative', width: '100%', height: '100vh', background: 'var(--bg-color)' }}>
          <button
            onClick={() => setAuthScreen('landing')}
            style={{ position: 'absolute', top: '30px', left: '30px', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <ArrowLeft size={18} /> Voltar ao Início
          </button>

          <Suspense fallback={<Loader message="Carregando autenticação..." />}>
            <Login
              isOffline={isOffline}
              isLoginLoading={isLoginLoading || isMfaLoading}
              fazerLogin={fazerLogin}
              loginErro={loginErro}
              mfaChallenge={mfaChallenge}
              concluirMfaLogin={concluirMfaLogin}
              cancelarMfa={() => { setMfaChallenge(null); setLoginErro(''); }}
            />
          </Suspense>
        </div>
      );
    }

    if (authScreen === 'register') {
      return (
        <Suspense fallback={<Loader message="Abrindo cadastro..." />}>
          <Register onNavigate={setAuthScreen} isOffline={isOffline} />
        </Suspense>
      );
    }
  }

  if (isLocked) {
    return (
      <div className={`app-container ${isDarkMode ? 'dark-theme' : ''} lock-screen-container`}>
        <form className="lock-box anim-fade-in" onSubmit={handleUnlock}>
          <div className={`lock-icon-wrapper ${isUnlocking ? 'pulse-blue-shadow' : ''}`}>
            <Lock size={48} />
          </div>
          <h2 style={{color: 'var(--text-main)'}}>Terminal Bloqueado</h2>
          <p style={{color: 'var(--text-muted)'}}>O painel de <strong>{nomeLogado}</strong> foi trancado por segurança.</p>
          <div className="input-wrapper" style={{ margin: '1.5rem 0' }}>
            <Lock size={18} className="input-icon" />
            <input type="password" placeholder="Chave de Acesso..." value={lockPassword} onChange={(e) => { setLockPassword(e.target.value); setLockError(''); }} disabled={isUnlocking} autoFocus style={{ paddingLeft: '45px', textAlign: 'center', letterSpacing: '2px' }}/>
          </div>
          {lockError && <span className="lock-error-msg" style={{ marginTop: '-10px', marginBottom: '10px', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 'bold' }}>{lockError}</span>}
          <button type="submit" className="btn btn-primary w-100 login-btn" disabled={isUnlocking}>
            {isUnlocking ? <Loader2 size={18} className="spinner" /> : <Unlock size={18} />}
            {isUnlocking ? 'VERIFICANDO...' : 'RESTAURAR SESSÃO'}
          </button>
        </form>
      </div>
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
        setAbaAtiva={setAbaAtiva}
        NAVIGATION_ATIVA={NAVIGATION_ATIVA}
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
          mostrarNotificacoes={mostrarNotificacoes}
          setMostrarNotificacoes={setMostrarNotificacoes}
          notificacoesDaFilial={notificacoesDaFilial}
          resolverTodasNotificacoes={resolverTodasNotificacoes}
          getAlertConfig={getAlertConfig}
          isFeatureEnabled={isFeatureEnabled}
          isOffline={isOffline}
          socketInstance={socketInstance}
          latencia={latencia}
          systemHealth={systemHealth}
          setShowCommandPalette={setShowCommandPalette}
          alternarSom={alternarSom}
          somAtivoState={somAtivoState}
          toggleFullScreen={toggleFullScreen}
          isFullScreen={isFullScreen}
          uiDensity={uiDensity}
          toggleUiDensity={toggleUiDensity}
          setIsDarkMode={setIsDarkMode}
          isDarkMode={isDarkMode}
          supportContext={{ role: userRole, filial: filialAtiva, apiUrl: getApiUrl() }}
        />

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

        <div className="content-area">
          <ErrorBoundary>
            <Suspense fallback={<Loader message="Carregando módulo..." />}>
            {!isModuloOculto('dashboard') && abaAtiva === 'dashboard' && ( <Dashboard equipamentosDaFilial={equipamentosDaFilial} filialAtiva={filialAtiva} qtdTotal={qtdTotal} qtdOperando={qtdOperando} qtdDegelo={qtdDegelo} qtdFalha={qtdFalha} dadosDonutStatus={dadosDonutStatus} notificacoesDaFilial={notificacoesDaFilial} resolverTodasNotificacoes={resolverTodasNotificacoes} isOffline={isOffline} pedirNotaResolucao={pedirNotaResolucao} isDarkMode={isDarkMode} contatosDb={contatosDb} showToast={showToast} irParaChat={(id) => { setAbaAtiva('chat'); if (id) { const c = contatosDb.find(x => String(x.id) === String(id)); if (c) setContatoChatAtivo(c); } }} socket={socketInstance} userId={userId} nomeLogado={nomeLogado} setHistoricoChat={setHistoricoChat} /> )}
            {!isModuloOculto('assistente') && abaAtiva === 'assistente' && ( <AssistenteOperacao equipamentosDaFilial={equipamentosDaFilial} notificacoesDaFilial={notificacoesDaFilial} chamados={chamados} userRole={userRole} filialAtiva={filialAtiva} onNavigate={(id) => setAbaAtiva(id)} showToast={showToast} /> )}
            {!isModuloOculto('resumo_loja') && abaAtiva === 'resumo_loja' && ( <ResumoLoja equipamentosDaFilial={equipamentosDaFilial} notificacoesDaFilial={notificacoesDaFilial} chamados={chamados} filialAtiva={filialAtiva} userRole={userRole} /> )}
            {!isModuloOculto('central_procedimentos') && abaAtiva === 'central_procedimentos' && ( <CentralProcedimentos /> )}
            {!isModuloOculto('checklist_turno') && abaAtiva === 'checklist_turno' && ( <ChecklistTurno api={api} filialAtiva={filialAtiva} showToast={showToast} userRole={userRole} /> )}
            {!isModuloOculto('resumo_turno') && abaAtiva === 'resumo_turno' && ( <ResumoTurno equipamentosDaFilial={equipamentosDaFilial} notificacoesDaFilial={notificacoesDaFilial} chamados={chamados} filialAtiva={filialAtiva} userRole={userRole} /> )}
            {!isModuloOculto('plano_dia') && abaAtiva === 'plano_dia' && ( <PlanoDia api={api} filialAtiva={filialAtiva} showToast={showToast} userRole={userRole} /> )}
            {!isModuloOculto('resumo_executivo') && abaAtiva === 'resumo_executivo' && ( <ResumoExecutivo api={api} filialAtiva={filialAtiva} /> )}
            {podeAcessarModulo('timeline_operacional') && abaAtiva === 'timeline_operacional' && ( <TimelineOperacional notificacoes={notificacoes} historicoAlertas={historicoAlertas} chamados={chamados} filialAtiva={filialAtiva} /> )}
            {!isModuloOculto('suporte') && abaAtiva === 'suporte' && ( <Suporte api={api} socket={socketInstance} userRole={userRole} nomeLogado={nomeLogado} userFilial={userFilial} showToast={showToast} isOffline={isOffline} /> )}
            {!isModuloOculto('centro_comando') && abaAtiva === 'centro_comando' && userRole === 'DEV' && ( <CentroComando onNavigate={(id) => setAbaAtiva(id)} qtdTotal={qtdTotal} qtdOperando={qtdOperando} qtdDegelo={qtdDegelo} notificacoesDaFilial={notificacoesDaFilial} chamados={chamados} equipamentosDaFilial={equipamentosDaFilial} isOffline={isOffline} userRole={userRole} filialAtiva={filialAtiva} /> )}
            {!isModuloOculto('mapa') && abaAtiva === 'mapa' && ( <MapaCalor equipamentosDaFilial={equipamentosDaFilial} notificacoesDaFilial={notificacoesDaFilial} /> )}
            {!isModuloOculto('kanban') && abaAtiva === 'kanban' && ( <Kanban chamados={chamados} api={api} carregarChamados={carregarChamados} showToast={showToast} isOffline={isOffline} /> )}
            {!isModuloOculto('metrologia') && abaAtiva === 'metrologia' && ( <Metrologia equipamentosDaFilial={equipamentosDaFilial} editarEquipamento={editarEquipamento} /> )}
            {!isModuloOculto('simulador') && abaAtiva === 'simulador' && userRole === 'DEV' && ( <Simulador api={api} equipamentos={equipamentos} showToast={showToast} /> )}
            {!isModuloOculto('hardware') && abaAtiva === 'hardware' && userRole === 'DEV' && ( <HardwareIoT equipamentos={equipamentos} showToast={showToast} isOffline={isOffline} /> )}
            {!isModuloOculto('seguranca_conta') && abaAtiva === 'seguranca_conta' && ( <SegurancaConta api={api} showToast={showToast} fazerLogout={fazerLogout} /> )}
            {!isModuloOculto('sobre') && abaAtiva === 'sobre' && ( <Sobre /> )}
            {!isModuloOculto('chat') && abaAtiva === 'chat' && isFeatureEnabled('enableChat') && ( <Chat api={api} contatosDb={contatosDb} nomeLogado={nomeLogado} socket={socketInstance} userId={userId} historicoChat={historicoChat} setHistoricoChat={setHistoricoChat} contatoAtivo={contatoChatAtivo} setContatoAtivo={setContatoChatAtivo} naoLidasPorContato={naoLidasPorContato} setNaoLidasPorContato={setNaoLidasPorContato} showToast={showToast} /> )}
            {!isModuloOculto('motores') && abaAtiva === 'motores' && ( <Monitoramento isTemp={true} listaSetores={listaSetores} equipamentosDaFilial={equipamentosDaFilial} /> )}
            {!isModuloOculto('umidade') && abaAtiva === 'umidade' && ( <Monitoramento isTemp={false} listaSetores={listaSetores} equipamentosDaFilial={equipamentosDaFilial} /> )}
            {podeAcessarModulo('inventario_iot') && abaAtiva === 'inventario_iot' && ( <InventarioIoT equipamentos={equipamentos} filialAtiva={filialAtiva} listaSetores={listaSetores} socket={socketInstance} /> )}
            {!isModuloOculto('equipamentos') && abaAtiva === 'equipamentos' && ( <Equipamentos api={api} showToast={showToast} isOffline={isOffline} userRole={userRole} userFilial={userFilial} filiaisDb={filiaisDb} listaSetores={listaSetores} listaTipos={listaTipos} carregarDadosBase={carregarDadosBase} equipamentosFiltradosLista={equipamentosFiltradosLista} editarEquipamento={editarEquipamento} pedirExclusao={pedirExclusao} /> )}

            {!isModuloOculto('relatorios') && abaAtiva === 'relatorios' && ( <Relatorios api={api} filialAtiva={filialAtiva} showToast={showToast} isDarkMode={isDarkMode} isOffline={isOffline} /> )}
            {!isModuloOculto('energia') && abaAtiva === 'energia' && ( <GestaoEnergetica api={api} filialAtiva={filialAtiva} showToast={showToast} isDarkMode={isDarkMode} isOffline={isOffline} /> )}
            {!isModuloOculto('historico') && abaAtiva === 'historico' && ( <HistoricoLogs historicoFiltradoLista={historicoFiltradoLista} gerarExportacao={gerarExportacao} /> )}
            {!isModuloOculto('chamados') && abaAtiva === 'chamados' && ( <Chamados userRole={userRole} filialAtiva={filialAtiva} nomeLogado={nomeLogado} chamados={chamados} tecnicosDb={tecnicosDb} equipamentosDaFilial={equipamentosDaFilial} api={api} carregarChamados={carregarChamados} showToast={showToast} isOffline={isOffline} gerarLoteOS={gerarLoteOS} /> )}
            {podeAcessarModulo('sla_chamados') && abaAtiva === 'sla_chamados' && ( <SLAChamados chamados={chamados} filialAtiva={filialAtiva} /> )}
            {!isModuloOculto('historico_chamados') && abaAtiva === 'historico_chamados' && ( <HistoricoChamados userRole={userRole} filialAtiva={filialAtiva} nomeLogado={nomeLogado} chamados={chamados} tecnicosDb={tecnicosDb} gerarLoteOS={gerarLoteOS} api={api} carregarChamados={carregarChamados} showToast={showToast} /> )}

            {!isModuloOculto('aprovacoes') && abaAtiva === 'aprovacoes' && userRole === 'DEV' && ( <AprovacoesSaaS showToast={showToast} isOffline={isOffline} api={api} socket={socketInstance} /> )}

            {!isModuloOculto('lojas') && abaAtiva === 'lojas' && (userRole === 'ADMIN' || userRole === 'DEV') && ( <GestaoLojas api={api} showToast={showToast} carregarDadosBase={carregarDadosBase} setModalConfig={setModalConfig} /> )}
            {!isModuloOculto('usuarios') && abaAtiva === 'usuarios' && (userRole === 'ADMIN' || userRole === 'DEV') && ( <GestaoUsuarios api={api} showToast={showToast} usuariosLista={usuariosLista} carregarUsuarios={carregarUsuarios} filiaisDb={filiaisDb} setModalConfig={setModalConfig} /> )}
            {!isModuloOculto('parametros') && abaAtiva === 'parametros' && (userRole === 'ADMIN' || userRole === 'DEV') && ( <ParametrosGlobais api={api} showToast={showToast} listaSetores={listaSetores} listaTipos={listaTipos} carregarParametrosGerais={carregarParametrosGerais} carregarDadosBase={carregarDadosBase} setModalConfig={setModalConfig} /> )}

            {podeAcessarModulo('central_saude') && abaAtiva === 'central_saude' && ( <CentralSaudeSistema api={api} systemHealth={systemHealth} isOffline={isOffline} equipamentos={equipamentos} chamados={chamados} notificacoes={notificacoes} showToast={showToast} userRole={userRole} /> )}
            {abaAtiva === 'bi' && <CentroInteligenciaBI api={api} isDarkMode={isDarkMode} sysConfig={sysConfig} filiaisDb={filiaisDb} equipamentosDaFilial={equipamentosDaFilial} />}
            {['empresas', 'dev_panel', 'saas', 'billing', 'system', 'soc', 'atualizacoes', 'sql_terminal', 'websocket_stream', 'network_scanner', 'monitor_edge'].includes(abaAtiva) && userRole === 'DEV' && (
               <PainelDesenvolvedor
                 api={api} socket={socketInstance} abaAtiva={abaAtiva} isDevAuthenticated={isDevAuthenticated}
                 onAuthenticate={() => { setIsDevAuthenticated(true); sessionStorage.setItem('devAuth', 'true'); }} showToast={showToast}
                 sysConfig={sysConfig} updateSysConfig={updateSysConfig} tocarAlarme={tocarAlarme} usuariosLista={usuariosLista} filiaisDb={filiaisDb} setModalConfig={setModalConfig}
                 navigationCatalog={NAVIGATION}
               />
             )}

            {((!podeAcessarModulo(abaAtiva) && !['aprovacoes', 'empresas', 'dev_panel', 'saas', 'billing', 'system', 'soc', 'atualizacoes', 'sql_terminal', 'websocket_stream', 'network_scanner', 'monitor_edge'].includes(abaAtiva)) || (abaAtiva === 'chat' && !isFeatureEnabled('enableChat'))) && (
               <div className="empty-state dashboard-empty anim-fade-in" style={{marginTop: '2rem'}}>
                  <div className="empty-shield-box" style={{ background: 'rgba(239, 68, 68, 0.1)' }}><AlertOctagon size={48} color="var(--danger)" /></div>
                  <h3 className="empty-title" style={{ color: 'var(--danger)' }}>Acesso Restrito</h3>
                  <p className="empty-subtitle">As políticas de governação atuais impedem a visualização deste módulo.</p>
               </div>
            )}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <nav className="mobile-tab-bar" aria-label="Navegação principal mobile">
        {mobilePrimaryNav.map(item => (
          <button
            key={item.id}
            type="button"
            className={`mobile-tab-item ${abaAtiva === item.id ? 'active' : ''}`}
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
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.15)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} color="#38bdf8" className="pulse-blue-shadow" />
              <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{popupAlerta.titulo}</strong>
            </div>
            <button
              onClick={() => setPopupAlerta(null)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
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
              <div className="input-wrapper" style={{ marginBottom: '1.5rem' }}>
                <input type="text" value={modalConfig.promptValue} onChange={(e) => setModalConfig({...modalConfig, promptValue: e.target.value})} placeholder="Insira a justificativa..." autoFocus />
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: '0', paddingTop: '0', border: 'none' }}>
              <button className="btn btn-outline w-100" onClick={() => setModalConfig({...modalConfig, isOpen: false})}>Cancelar</button>
              <button className="btn btn-primary w-100" onClick={() => { modalConfig.onConfirm(modalConfig.promptValue); setModalConfig({...modalConfig, isOpen: false}); }}>Prosseguir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
