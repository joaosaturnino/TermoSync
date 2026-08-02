import React, { useState, useEffect, useRef, useMemo, useCallback, Component } from 'react';
import logger from './utils/logger';
import axios from 'axios';
import { io } from 'socket.io-client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'react-datepicker/dist/react-datepicker.css';

import './styles/global.css';
import './App.css';

import { 
  Activity, Thermometer, Droplets, Leaf, History, Wrench, Archive,
  Store, Sliders, Users, LogOut, Menu, X, Volume2, VolumeX, Maximize,
  Minimize, Moon, Sun, MapPin, UserCheck, CheckCircle, AlertTriangle,
  AlertOctagon, Edit, Save, MessageSquare, Globe2, WifiOff, Terminal,
  Server, Lock, Unlock, Search, Keyboard, Loader2, ShieldAlert, DollarSign, Building2,
  Bell, Wifi, Snowflake, Power, DoorOpen, ActivitySquare, ClipboardCheck, ThermometerSnowflake,
  Map, Columns, Target, Cpu, Info, Settings2, ShieldCheck, PieChart, FileSpreadsheet,
  ChevronDown, ChevronRight, Rocket, Database, Network, Sparkles, ClipboardList, BarChart3, CalendarDays, LifeBuoy, Zap, ArrowLeft, UserPlus
} from 'lucide-react';

// Importação dos Componentes de UI Modulares
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CommandPalette from './components/CommandPalette';
import LandingPage from './pages/LandingPage/LandingPage';
import Register from './pages/Register/Register';
import AprovacoesSaaS from './pages/AprovacoesSaaS/AprovacoesSaaS';

// Importação dos Módulos do Sistema
import CentroInteligenciaBI from './pages/CentroInteligenciaBI/CentroInteligenciaBI';
import DevBootScreen from './components/DevBootScreen';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Monitoramento from './pages/Monitoramento/Monitoramento';
import Equipamentos from './pages/Equipamentos/Equipamentos';
import Relatorios from './pages/Relatorios/Relatorios';
import HistoricoLogs from './pages/HistoricoLogs/HistoricoLogs';
import Chamados from './pages/Chamados/Chamados';
import HistoricoChamados from './pages/HistoricoChamados/HistoricoChamados';
import GestaoLojas from './pages/GestaoLoja/GestaoLojas';
import GestaoUsuarios from './pages/GestaoUsuarios/GestaoUsuarios';
import ParametrosGlobais from './pages/ParametrosGlobais/ParametrosGlobais';
import Chat from './pages/Chat/Chat'; 
import PainelDesenvolvedor from './pages/PainelDesenvolvedor/PainelDesenvolvedor';
import GestaoEmpresas from './pages/GestaoEmpresas/GestaoEmpresas';
import MapaCalor from './pages/MapaCalor/MapaCalor';
import Kanban from './pages/Kanban/Kanban';
import Metrologia from './pages/Metrologia/Metrologia';
import Simulador from './pages/Simulador/Simulador';
import Sobre from './pages/Sobre/Sobre';
import HardwareIoT from './pages/HardwareIoT/HardwareIoT';
import CentroComando from './pages/CentroComando/CentroComando';
import AssistenteOperacao from './pages/AssistenteOperacao/AssistenteOperacao';
import ResumoLoja from './pages/ResumoLoja/ResumoLoja';
import CentralProcedimentos from './pages/CentralProcedimentos/CentralProcedimentos';
import ChecklistTurno from './pages/ChecklistTurno/ChecklistTurno';
import ResumoTurno from './pages/ResumoTurno/ResumoTurno';
import PlanoDia from './pages/PlanoDia/PlanoDia';
import ResumoExecutivo from './pages/ResumoExecutivo/ResumoExecutivo';
import Suporte from './pages/Suporte/Suporte';
import GestaoEnergetica from './pages/GestaoEnergetica/GestaoEnergetica';

import { useSystemCore } from './hooks/useSystemCore';
import { useSecurity } from './hooks/useSecurity';
import { getApiUrl, getSocketUrl } from './config/api.js';

export const getAlertConfig = (tipo_alerta) => {
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

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, errorInfo: null }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
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
 * Componente Root da aplicação
 *
 * Responsabilidades principais:
 * - Gerenciar estado de autenticação, sessão e roteamento interno (abas)
 * - Inicializar integrações (API axios, Socket.IO) e prover contexto de sistema
 * - Orquestrar carregamento de módulos/páginas e fornecer modal/notifications
 *
 * Observações:
 * - Não altera lógica; apenas documentação para facilitar manutenção.
 */
export default function App() {
  const [authScreen, setAuthScreen] = useState('landing'); 

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
  
  const [socketInstance, setSocketInstance] = useState(null); 
  const [isDevBooting, setIsDevBooting] = useState(false);
  const [devBootData, setDevBootData] = useState(null);
  const [bannerFechado, setBannerFechado] = useState(true);
  
  const [gruposExpandidos, setGruposExpandidos] = useState({
    'Desenvolvedor': true, 'Operações': true, 'Serviços': true, 'Auditoria': true, 'Sistema': true,
  });

  const [menuAberto, setMenuAberto] = useState(false);
  const [menuRecolhido, setMenuRecolhido] = useState(false); 
  const [isLoginLoading, setIsLoginLoading] = useState(false); 
  const [loginErro, setLoginErro] = useState(''); 
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') !== 'light');
  const [mostrarNotificacoes, setMostrarNotificacoes] = useState(false);
  const [somAtivoState, setSomAtivoState] = useState(false); 
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [latencia, setLatencia] = useState(12);

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [cmdSearch, setCmdSearch] = useState('');
  const [isLocked, setIsLocked] = useState(() => sessionStorage.getItem('terminalLocked') === 'true');
  const [lockPassword, setLockPassword] = useState('');
  const [lockError, setLockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Estados de dados
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
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [toasts, setToasts] = useState([]);

  // ===============================================
  // ESTADOS GLOBAIS DE NOTIFICAÇÕES (BADGES & POP-UP)
  // ===============================================
  const [badgeSaaS, setBadgeSaaS] = useState(0);
  const [badgeSuporte, setBadgeSuporte] = useState(0);
  const [popupAlerta, setPopupAlerta] = useState(null);

  const isInitialLoadRef = useRef(true);
  const prevBadgesRef = useRef({ saas: 0, suporte: 0, chamados: 0 });

  const initialFilialAtiva = sessionStorage.getItem('papelLogado')?.includes('Impersonate') ? sessionStorage.getItem('userFilial') : ((userRole !== 'LOJA' && userRole !== 'MANUTENCAO') ? 'Todas' : userFilial);
  const [filialAtiva, setFilialAtiva] = useState(initialFilialAtiva);

  const somAtivoRef = useRef(false);
  const commandInputRef = useRef(null);
  const filialAtivaRef = useRef(filialAtiva);
  const userRoleRef = useRef(userRole);
  const userEmpresaRef = useRef(userEmpresa);
  const papelLogadoRef = useRef(papelLogado);
  const contatoChatAtivoRef = useRef(contatoChatAtivo);
  const abaAtivaRef = useRef(abaAtiva);
  const bufferLeiturasRef = useRef({});

  useEffect(() => { filialAtivaRef.current = filialAtiva; }, [filialAtiva]);
  useEffect(() => { userRoleRef.current = userRole; }, [userRole]);
  useEffect(() => { userEmpresaRef.current = userEmpresa; }, [userEmpresa]);
  useEffect(() => { papelLogadoRef.current = papelLogado; }, [papelLogado]);
  useEffect(() => { contatoChatAtivoRef.current = contatoChatAtivo; }, [contatoChatAtivo]);
  useEffect(() => { abaAtivaRef.current = abaAtiva; }, [abaAtiva]);

  const totalNaoLidas = Object.values(naoLidasPorContato).reduce((a, b) => a + (Number(b) || 0), 0);

  const fazerLogout = useCallback(() => { 
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
      setGruposExpandidos({ 'Desenvolvedor': true, 'Operações': false, 'Serviços': false, 'Auditoria': false, 'Sistema': false });
    } else {
      setGruposExpandidos({ 'Desenvolvedor': true, 'Operações': true, 'Serviços': true, 'Auditoria': true, 'Sistema': true });
    }
  }, [userRole]);

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

  const fazerLogin = async (usuarioInput, senhaInput) => {
    if (isOffline) {
      window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: 'Sinal de rede perdido.', type: 'error' }}));
      return;
    }
    setLoginErro(''); 
    setIsLoginLoading(true);
    
    try {
      const res = await axios.post(`${getApiUrl()}/login`, { usuario: usuarioInput, senha: senhaInput });
      
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
      
      setToken(res.data.token); setUserId(res.data.id); setUserRole(res.data.role); setUserFilial(res.data.filial); setUserEmpresa(res.data.empresa);
      setFilialAtiva(res.data.role !== 'LOJA' ? 'Todas' : res.data.filial);
      setAbaAtiva('dashboard'); setMenuAberto(false); setNomeLogado(identityName); setPapelLogado(roleTitle); setLoginAtivo(usuarioInput);
      
      sessionStorage.setItem('token', res.data.token); sessionStorage.setItem('userId', res.data.id); 
      sessionStorage.setItem('userRole', res.data.role); sessionStorage.setItem('userFilial', res.data.filial); sessionStorage.setItem('userEmpresa', res.data.empresa);
      sessionStorage.setItem('nomeLogado', identityName); sessionStorage.setItem('papelLogado', roleTitle); 
      sessionStorage.setItem('loginAtivo', usuarioInput);
      
      window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: `Protocolo aceito. Bem-vindo(a), ${identityName}.`, type: 'success' }}));
    } catch (error) { 
      setLoginErro('Credenciais inválidas.'); 
      window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: 'Acesso Negado.', type: 'error' }}));
    } finally { setIsLoginLoading(false); }
  };

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

  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);

  const toggleFullScreen = () => { 
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => { window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: "Modo TV bloqueado.", type: 'warning' }})); }); } 
    else { document.exitFullscreen(); } 
  };
  useEffect(() => { const handleFullscreenChange = () => setIsFullScreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', handleFullscreenChange); return () => document.removeEventListener('fullscreenchange', handleFullscreenChange); }, []);
  
  useEffect(() => { 
    if (isDarkMode) { document.documentElement.classList.add('dark-theme'); document.body.classList.add('dark-theme'); localStorage.setItem('theme', 'dark'); } 
    else { document.documentElement.classList.remove('dark-theme'); document.body.classList.remove('dark-theme'); localStorage.setItem('theme', 'light'); } 
  }, [isDarkMode]);

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: getApiUrl(), headers: token ? { Authorization: `Bearer ${token}` } : {} });
    instance.interceptors.response.use((response) => response, (error) => { 
      if (error.response && error.response.status === 401 && !papelLogado.includes('Impersonate')) {
         fazerLogout(); 
      }
      return Promise.reject(error); 
    });
    return instance;
  }, [token, fazerLogout, papelLogado]);

  const showToast = useCallback((message, type = 'success') => {
    if (userRole !== 'DEV') { try { const gConf = JSON.parse(localStorage.getItem('termosync_sysconfig_saas'))?.regras?.['GLOBAL']?.features; const rConf = JSON.parse(localStorage.getItem('termosync_sysconfig_saas'))?.regras?.[userRole]?.features; if (gConf && gConf.enableToasts === false) return; if (rConf && rConf.enableToasts === false) return; } catch(e) {} }
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4500);
  }, [userRole]);
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  useEffect(() => {
    const listenToasts = (e) => { showToast(e.detail.msg, e.detail.type); };
    window.addEventListener('forceToast', listenToasts);
    return () => window.removeEventListener('forceToast', listenToasts);
  }, [showToast]);

  // ============================================================================
  // GERADORES DE ALARMES E TONS SONOROS (WEB AUDIO API)
  // ============================================================================
  const tocarSomMensagem = useCallback(() => {
    if (!somAtivoRef.current || !isFeatureEnabledRef.current('enableAudioAlerts')) return;
    try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gainNode = ctx.createGain(); osc.connect(gainNode); gainNode.connect(ctx.destination); osc.type = 'sine'; osc.frequency.setValueAtTime(600, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1); gainNode.gain.setValueAtTime(0.15, ctx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2); osc.start(); osc.stop(ctx.currentTime + 0.2); } catch (e) { }
  }, []);
  const tocarSomMensagemRef = useRef(tocarSomMensagem);
  useEffect(() => { tocarSomMensagemRef.current = tocarSomMensagem; }, [tocarSomMensagem]);

  const tocarAlarme = useCallback(() => { 
    if (!somAtivoRef.current || !isFeatureEnabledRef.current('enableAudioAlerts')) return;
    try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gainNode = ctx.createGain(); osc.connect(gainNode); gainNode.connect(ctx.destination); osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.5); } catch (e) { } 
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
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Nota A5
      osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.12); // Nota C#6
      gainNode.gain.setValueAtTime(0.18, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
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
      } catch (e) { }
    } else { showToast('Sistema silenciado.', 'info'); } 
  }, [somAtivoState, showToast, isFeatureEnabled]);

  const carregarChamados = useCallback(async () => { 
    if (!token || isOffline) return; 
    try { 
      const res = await api.get('/chamados'); 
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
    } catch (e) { } 
  }, [token, isOffline, api, userRole]);

  const carregarUsuarios = useCallback(async () => { if ((userRole !== 'ADMIN' && userRole !== 'DEV') || !token || isOffline) return; try { const res = await api.get('/usuarios'); setUsuariosLista(Array.isArray(res.data) ? res.data : []); } catch (e) {} }, [api, userRole, token, isOffline]);
  const carregarLojas = useCallback(async () => { if ((userRole !== 'ADMIN' && userRole !== 'DEV') || !token || isOffline) return; try { const res = await api.get('/lojas'); setLojasCadastradas(Array.isArray(res.data) ? res.data : []); } catch (e) {} }, [api, userRole, token, isOffline]);
  const carregarTecnicos = useCallback(async () => { if (!token || isOffline) return; try { const res = await api.get('/tecnicos'); setTecnicosDb(Array.isArray(res.data) ? res.data : []); } catch (e) {} }, [api, token, isOffline]);
  const carregarContatos = useCallback(async () => { if (!token || isOffline) return; try { const res = await api.get('/contatos'); setContatosDb(Array.isArray(res.data) ? res.data : []); } catch (e) {} }, [api, token, isOffline]);
  const carregarParametrosGerais = useCallback(async () => { if (!token || isOffline) return; try { const [resSetores, resTipos] = await Promise.all([ api.get('/setores').catch(() => ({ data: [] })), api.get('/tipos-refrigeracao').catch(() => ({ data: [] })) ]); setListaSetores(Array.isArray(resSetores.data) ? resSetores.data : []); setListaTipos(Array.isArray(resTipos.data) ? resTipos.data : []); } catch (e) {} }, [api, token, isOffline]);
  
  const carregarHistoricoChat = useCallback(async () => { 
    if (!token || isOffline || !isFeatureEnabledRef.current('enableChat')) return; 
    try { const res = await api.get('/chat/historico'); const histFormatado = res.data.map(m => ({ ...m, data: new Date(m.data) })); setHistoricoChat(histFormatado); } catch (e) {} 
  }, [api, token, isOffline]);

  // ============================================================================
  // CARREGAMENTO DE BADGES EXTRAS & ALARMES SONOROS (FILTRO RIGOROSO POR PERFIL)
  // ============================================================================
  const carregarBadgesSecundarios = useCallback(async () => {
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
          // Para DEV: conta chamados ABERTOS ou EM ANÁLISE que AINDA NÃO têm resposta da engenharia
          countSup = resSuporte.data.filter(c => {
            const s = String(c.status || '').trim().toLowerCase();
            const concluidos = ['concluído', 'resolvido', 'fechado', 'respondido'];
            if (concluidos.includes(s) || !s) return false;
            if (c.resposta && String(c.resposta).trim() !== '') return false;
            return ['aberto', 'em análise', 'em atendimento', 'pendente'].includes(s);
          }).length;
        } else {
          // Para USUÁRIO COMUM: O badge SÓ APARECE se houver resposta do desenvolvedor (status 'Respondido')
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
    } catch (e) {}
  }, [api, token, isOffline, userRole]);

  const carregarBadgesSecundariosRef = useRef(carregarBadgesSecundarios);
  useEffect(() => { carregarBadgesSecundariosRef.current = carregarBadgesSecundarios; }, [carregarBadgesSecundarios]);
  
  useEffect(() => { 
    carregarBadgesSecundarios(); 
    const timer = setTimeout(() => { isInitialLoadRef.current = false; }, 2500);
    return () => clearTimeout(timer);
  }, [carregarBadgesSecundarios]);

  const carregarDadosBase = useCallback(async () => {
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
    } catch (error) {}
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
    const iotFlushInterval = setInterval(() => {
      const keys = Object.keys(bufferLeiturasRef.current);
      if (keys.length > 0) {
        setEquipamentos(prev => prev.map(eq => {
          const reading = bufferLeiturasRef.current[eq.id];
          if (reading) return { ...eq, ultima_temp: reading.temperatura, ultima_umidade: reading.umidade, motor_ligado: reading.motor_ligado === true || reading.motor_ligado == 1, em_degelo: reading.em_degelo === true || reading.em_degelo == 1 };
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
  useEffect(() => { if (abaAtiva === 'chamados' || abaAtiva === 'historico_chamados') carregarChamados(); }, [abaAtiva, carregarChamados]);
  useEffect(() => { if (abaAtiva === 'parametros' && (userRole === 'ADMIN' || userRole === 'DEV')) carregarParametrosGerais(); }, [abaAtiva, carregarParametrosGerais, userRole]); 

  const listaFiliais = useMemo(() => { 
    if (papelLogado.includes('Impersonate') || userRole === 'LOJA') return [userFilial];
    const filiaisExtraidas = (lojasCadastradas || []).map(l => l.nome);
    const combinadas = Array.from(new Set([...(filiaisDb || []), ...filiaisExtraidas]));
    return ['Todas', ...combinadas].sort(); 
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

  const editarEquipamento = (eq) => { if (isOffline || isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada.', 'warning'); setEquipEditando(eq.id); setFormEditEquip({ nome: eq.nome, tipo: eq.tipo, temp_min: eq.temp_min, temp_max: eq.temp_max, umidade_min: eq.umidade_min || '', umidade_max: eq.umidade_max || '', intervalo_degelo: eq.intervalo_degelo, duracao_degelo: eq.duracao_degelo, setor: eq.setor, filial: eq.filial, data_calibracao: eq.data_calibracao ? new Date(eq.data_calibracao).toISOString().split('T')[0] : '' }); };
  const salvarEdicaoEquipamento = async (e) => { e.preventDefault(); if (isOffline) return; try { await api.put(`/equipamentos/${equipEditando}/edit`, formEditEquip); showToast('Atualizado com sucesso.', 'success'); setEquipEditando(null); carregarDadosBase(); } catch (e) { showToast('Erro de sincronização.', 'error'); } };
  const pedirExclusao = (id, nome) => { if (isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada (Leitura).', 'warning'); setModalConfig({ isOpen: true, title: 'Remover Máquina', message: `Remover "${nome}" permanentemente?`, isPrompt: false, onConfirm: async () => { try { await api.delete(`/equipamentos/${id}`); showToast('Ativo purgado do sistema.', 'success'); carregarDadosBase(); } catch (e) { showToast('Ação autorizada.', 'error'); } }}); };
  
  const pedirNotaResolucao = (id) => { 
    if (isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada (Leitura).', 'warning'); 
    setModalConfig({ isOpen: true, title: 'Registro de Manutenção', message: 'Descreva a intervenção técnica:', isPrompt: true, promptValue: '', onConfirm: async (nota) => { try { await api.put(`/notificacoes/${id}/resolver`, { nota_resolucao: nota.trim() === '' ? 'Verificado e limpo.' : nota }); showToast('Incidente arquivado.', 'success'); setNotificacoes(prev => prev.filter(n => n.id !== id)); carregarDadosBase(); } catch (e) { showToast('Erro no arquivo.', 'error'); } } }); 
  };
  
  const resolverTodasNotificacoes = () => { 
    if (isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada (Leitura).', 'warning'); 
    setModalConfig({ isOpen: true, title: 'Limpeza do Painel', message: 'Arquivar todos os alarmes pendentes do radar?', isPrompt: false, onConfirm: async () => { try { await api.put(`/notificacoes/resolver-todas`); showToast('Painel higienizado.', 'success'); setNotificacoes([]); carregarDadosBase(); } catch (e) { showToast('Erro de sistema.', 'error'); } } }); 
  };

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

  const gerarLoteOS = (listaChamados) => { 
    if (!isFeatureEnabled('allowExports')) return showToast('A exportação de dados foi bloqueada pelas diretrizes do sistema.', 'error');
    if (!listaChamados || listaChamados.length === 0) return showToast("Nenhuma OS pendente.", "warning"); const doc = new jsPDF(); listaChamados.forEach((c, index) => { if (index > 0) doc.addPage(); doc.setFontSize(18); doc.text(`Ordem de Serviço (OS) - ${c.status}`, 14, 20); doc.setFontSize(11); doc.text(`Máquina: ${c.equipamento_nome}`, 14, 32); doc.text(`Filial: ${c.filial}`, 14, 40); doc.text(`Abertura: ${new Date(c.data_abertura).toLocaleString()}`, 14, 72); doc.text(doc.splitTextToSize(c.descricao || 'Sem descrição.', 180), 14, 96); if (c.status === 'Concluído') { doc.text(doc.splitTextToSize(c.nota_resolucao || 'Sem nota.', 180), 14, 138); } }); doc.save(`Lote_OS_${new Date().getTime()}.pdf`); showToast('Lote Operacional Baixado.', 'success'); 
  };

  // ===============================================
  // REGISTRO DE TELAS E REGRAS DE BADGES POR ROLE
  // ===============================================
  const NAVIGATION = [
    { id: 'dev_panel', label: 'Controle', icon: Terminal, roles: ['DEV'], type: 'Desenvolvedor', priority: 1 }, 
    { id: 'bi', label: 'Centro de Inteligência (BI)', icon: PieChart, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true, priority: 2 },
    { id: 'soc', label: 'Auditoria / SOC', icon: ShieldCheck, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true }, 
    { id: 'atualizacoes', label: 'Atualizações / Deploy', icon: Rocket, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'sql_terminal', label: 'Console SQL', icon: Database, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'websocket_stream', label: 'Live Firehose (WS)', icon: Network, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
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
    { id: 'mapa', label: 'Planta Digital', icon: Map, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Operações' },
    { id: 'motores', label: 'Monitoramento Térmico', icon: Thermometer, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operações' },
    { id: 'umidade', label: 'Monitoramento de Umidade', icon: Droplets, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operações' },
    
    // BADGE OCULTA NO DESENVOLVEDOR (DEV) E COM FILTRAGEM ESTREITA
    { id: 'chamados', label: 'Chamados', icon: Wrench, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: userRole === 'DEV' ? 0 : (chamados?.filter(c => {
      const s = String(c.status || '').trim().toLowerCase();
      return !['concluído', 'fechado', 'cancelado', 'resolvido'].includes(s) && s !== '';
    }).length || 0), type: 'Serviços', priority: 1 },
    { id: 'kanban', label: 'Gestão Ágil (Kanban)', icon: Columns, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços', priority: 2 },
    { id: 'chat', label: 'Chat', icon: MessageSquare, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: totalNaoLidas || 0, type: 'Serviços', priority: 3 },
    { id: 'metrologia', label: 'Controle Metrológico', icon: Target, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços' },
    { id: 'equipamentos', label: 'Equipamentos', icon: Server, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços' },
    { id: 'parametros', label: 'Parâmetros Globais', icon: Sliders, roles: ['ADMIN', 'DEV'], type: 'Serviços' },
    { id: 'historico_chamados', label: 'Histórico de Chamados', icon: Archive, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços' },
    
    { id: 'relatorios', label: 'Relatórios', icon: Leaf, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Auditoria', isPremium: true, priority: 1 },
    { id: 'energia', label: 'Gestão Energética', icon: Zap, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Auditoria', priority: 2 },
    { id: 'historico', label: 'Histórico de Logs', icon: History, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Auditoria', isPremium: true, priority: 3 },
    
    { id: 'lojas', label: 'Gestão de Lojas', icon: Store, roles: ['ADMIN', 'DEV'], type: 'Sistema', priority: 1 },
    { id: 'usuarios', label: 'Identidades e Acessos', icon: Users, roles: ['ADMIN', 'DEV'], type: 'Sistema', priority: 2 },
    { id: 'centro_comando', label: 'Centro de Comando', icon: Target, roles: ['DEV'], type: 'Sistema' },
    { id: 'suporte', label: 'Suporte ao Sistema', icon: LifeBuoy, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: badgeSuporte, type: 'Sistema' },
    { id: 'sobre', label: 'Sobre a Plataforma', icon: Info, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Sistema' }
  ].sort((a, b) => {
    const priorityA = a.priority || 99;
    const priorityB = b.priority || 99;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.label.localeCompare(b.label, 'pt-BR');
  });

  const NAVIGATION_ATIVA = NAVIGATION.filter(nav => !isModuloOculto(nav.id) && nav.roles.includes(userRole) && (nav.id !== 'chat' || isFeatureEnabled('enableChat')) && (!nav.devAuthRequired || isDevAuthenticated));

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

  // === LÓGICA DE TELAS INICIAIS (LANDING > LOGIN / REGISTER) ===
  if (!token) {
    if (authScreen === 'landing') {
      return <LandingPage onNavigate={setAuthScreen} />;
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
          
          <Login isOffline={isOffline} isLoginLoading={isLoginLoading} fazerLogin={fazerLogin} loginErro={loginErro} />
        </div>
      );
    }

    if (authScreen === 'register') {
      return <Register onNavigate={setAuthScreen} isOffline={isOffline} />;
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
    <div className={`app-container ${isDarkMode ? 'dark-theme' : ''}`}>
      <datalist id="filiais-db">{filiaisDb?.map(f => <option key={f} value={f} />)}</datalist><datalist id="setores-db">{listaSetores?.map(s => <option key={s.id} value={s.nome} />)}</datalist>
      
      <CommandPalette 
        showCommandPalette={showCommandPalette}
        setShowCommandPalette={setShowCommandPalette}
        cmdSearch={cmdSearch}
        setCmdSearch={setCmdSearch}
        commandInputRef={commandInputRef}
        NAVIGATION_ATIVA={NAVIGATION_ATIVA}
        setAbaAtiva={setAbaAtiva}
        setGruposExpandidos={setGruposExpandidos}
      />

      <Sidebar 
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

      <main className="main-content">
        
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
          setShowCommandPalette={setShowCommandPalette}
          alternarSom={alternarSom}
          somAtivoState={somAtivoState}
          toggleFullScreen={toggleFullScreen}
          isFullScreen={isFullScreen}
          setIsDarkMode={setIsDarkMode}
          isDarkMode={isDarkMode}
        />
        
        <div className="content-area">
          <ErrorBoundary>
            {!isModuloOculto('dashboard') && abaAtiva === 'dashboard' && ( <Dashboard qtdTotal={qtdTotal} qtdOperando={qtdOperando} qtdDegelo={qtdDegelo} qtdFalha={qtdFalha} dadosDonutStatus={dadosDonutStatus} notificacoesDaFilial={notificacoesDaFilial} resolverTodasNotificacoes={resolverTodasNotificacoes} isOffline={isOffline} pedirNotaResolucao={pedirNotaResolucao} isDarkMode={isDarkMode} contatosDb={contatosDb} showToast={showToast} irParaChat={(id) => { setAbaAtiva('chat'); if (id) { const c = contatosDb.find(x => String(x.id) === String(id)); if (c) setContatoChatAtivo(c); } }} socket={socketInstance} userId={userId} nomeLogado={nomeLogado} setHistoricoChat={setHistoricoChat} /> )}
            {!isModuloOculto('assistente') && abaAtiva === 'assistente' && ( <AssistenteOperacao equipamentosDaFilial={equipamentosDaFilial} notificacoesDaFilial={notificacoesDaFilial} chamados={chamados} userRole={userRole} filialAtiva={filialAtiva} onNavigate={(id) => setAbaAtiva(id)} showToast={showToast} /> )}
            {!isModuloOculto('resumo_loja') && abaAtiva === 'resumo_loja' && ( <ResumoLoja equipamentosDaFilial={equipamentosDaFilial} notificacoesDaFilial={notificacoesDaFilial} chamados={chamados} filialAtiva={filialAtiva} userRole={userRole} /> )}
            {!isModuloOculto('central_procedimentos') && abaAtiva === 'central_procedimentos' && ( <CentralProcedimentos /> )}
            {!isModuloOculto('checklist_turno') && abaAtiva === 'checklist_turno' && ( <ChecklistTurno api={api} filialAtiva={filialAtiva} showToast={showToast} userRole={userRole} /> )}
            {!isModuloOculto('resumo_turno') && abaAtiva === 'resumo_turno' && ( <ResumoTurno equipamentosDaFilial={equipamentosDaFilial} notificacoesDaFilial={notificacoesDaFilial} chamados={chamados} filialAtiva={filialAtiva} userRole={userRole} /> )}
            {!isModuloOculto('plano_dia') && abaAtiva === 'plano_dia' && ( <PlanoDia api={api} filialAtiva={filialAtiva} showToast={showToast} userRole={userRole} /> )}
            {!isModuloOculto('resumo_executivo') && abaAtiva === 'resumo_executivo' && ( <ResumoExecutivo api={api} filialAtiva={filialAtiva} /> )}
            {!isModuloOculto('suporte') && abaAtiva === 'suporte' && ( <Suporte api={api} socket={socketInstance} userRole={userRole} nomeLogado={nomeLogado} userFilial={userFilial} showToast={showToast} isOffline={isOffline} /> )}
            {!isModuloOculto('centro_comando') && abaAtiva === 'centro_comando' && userRole === 'DEV' && ( <CentroComando onNavigate={(id) => setAbaAtiva(id)} qtdTotal={qtdTotal} qtdOperando={qtdOperando} qtdDegelo={qtdDegelo} qtdFalha={qtdFalha} notificacoesDaFilial={notificacoesDaFilial} chamados={chamados} equipamentosDaFilial={equipamentosDaFilial} isOffline={isOffline} userRole={userRole} filialAtiva={filialAtiva} /> )}
            {!isModuloOculto('mapa') && abaAtiva === 'mapa' && ( <MapaCalor equipamentosDaFilial={equipamentosDaFilial} notificacoesDaFilial={notificacoesDaFilial} /> )}
            {!isModuloOculto('kanban') && abaAtiva === 'kanban' && ( <Kanban chamados={chamados} api={api} carregarChamados={carregarChamados} showToast={showToast} isOffline={isOffline} /> )}
            {!isModuloOculto('metrologia') && abaAtiva === 'metrologia' && ( <Metrologia equipamentosDaFilial={equipamentosDaFilial} editarEquipamento={editarEquipamento} /> )}
            {!isModuloOculto('simulador') && abaAtiva === 'simulador' && userRole === 'DEV' && ( <Simulador api={api} equipamentos={equipamentos} showToast={showToast} /> )}
            {!isModuloOculto('hardware') && abaAtiva === 'hardware' && userRole === 'DEV' && ( <HardwareIoT equipamentos={equipamentos} showToast={showToast} isOffline={isOffline} /> )}
            {!isModuloOculto('sobre') && abaAtiva === 'sobre' && ( <Sobre /> )}
            {!isModuloOculto('chat') && abaAtiva === 'chat' && isFeatureEnabled('enableChat') && ( <Chat contatosDb={contatosDb} nomeLogado={nomeLogado} socket={socketInstance} userId={userId} historicoChat={historicoChat} setHistoricoChat={setHistoricoChat} contatoAtivo={contatoChatAtivo} setContatoAtivo={setContatoChatAtivo} naoLidasPorContato={naoLidasPorContato} setNaoLidasPorContato={setNaoLidasPorContato} /> )}
            {!isModuloOculto('motores') && abaAtiva === 'motores' && ( <Monitoramento isTemp={true} listaSetores={listaSetores} equipamentosDaFilial={equipamentosDaFilial} /> )}
            {!isModuloOculto('umidade') && abaAtiva === 'umidade' && ( <Monitoramento isTemp={false} listaSetores={listaSetores} equipamentosDaFilial={equipamentosDaFilial} /> )}
            {!isModuloOculto('equipamentos') && abaAtiva === 'equipamentos' && ( <Equipamentos api={api} showToast={showToast} isOffline={isOffline} userRole={userRole} userFilial={userFilial} filiaisDb={filiaisDb} listaSetores={listaSetores} listaTipos={listaTipos} carregarDadosBase={carregarDadosBase} equipamentosFiltradosLista={equipamentosFiltradosLista} editarEquipamento={editarEquipamento} pedirExclusao={pedirExclusao} /> )}
            
            {!isModuloOculto('relatorios') && abaAtiva === 'relatorios' && ( <Relatorios api={api} filialAtiva={filialAtiva} showToast={showToast} isDarkMode={isDarkMode} isOffline={isOffline} /> )}
            {!isModuloOculto('energia') && abaAtiva === 'energia' && ( <GestaoEnergetica api={api} filialAtiva={filialAtiva} showToast={showToast} isDarkMode={isDarkMode} isOffline={isOffline} /> )}
            {!isModuloOculto('historico') && abaAtiva === 'historico' && ( <HistoricoLogs historicoFiltradoLista={historicoFiltradoLista} gerarExportacao={gerarExportacao} /> )}
            {!isModuloOculto('chamados') && abaAtiva === 'chamados' && ( <Chamados userRole={userRole} filialAtiva={filialAtiva} nomeLogado={nomeLogado} chamados={chamados} tecnicosDb={tecnicosDb} equipamentosDaFilial={equipamentosDaFilial} api={api} carregarChamados={carregarChamados} showToast={showToast} isOffline={isOffline} gerarLoteOS={gerarLoteOS} /> )}
            {!isModuloOculto('historico_chamados') && abaAtiva === 'historico_chamados' && ( <HistoricoChamados userRole={userRole} filialAtiva={filialAtiva} nomeLogado={nomeLogado} chamados={chamados} tecnicosDb={tecnicosDb} gerarLoteOS={gerarLoteOS} api={api} carregarChamados={carregarChamados} showToast={showToast} /> )}
            
            {!isModuloOculto('aprovacoes') && abaAtiva === 'aprovacoes' && userRole === 'DEV' && ( <AprovacoesSaaS showToast={showToast} isOffline={isOffline} api={api} socket={socketInstance} /> )}
            
            {!isModuloOculto('lojas') && abaAtiva === 'lojas' && (userRole === 'ADMIN' || userRole === 'DEV') && ( <GestaoLojas api={api} showToast={showToast} carregarDadosBase={carregarDadosBase} setModalConfig={setModalConfig} /> )}
            {!isModuloOculto('usuarios') && abaAtiva === 'usuarios' && (userRole === 'ADMIN' || userRole === 'DEV') && ( <GestaoUsuarios api={api} showToast={showToast} usuariosLista={usuariosLista} carregarUsuarios={carregarUsuarios} filiaisDb={filiaisDb} setModalConfig={setModalConfig} /> )}
            {!isModuloOculto('parametros') && abaAtiva === 'parametros' && (userRole === 'ADMIN' || userRole === 'DEV') && ( <ParametrosGlobais api={api} showToast={showToast} listaSetores={listaSetores} listaTipos={listaTipos} carregarParametrosGerais={carregarParametrosGerais} carregarDadosBase={carregarDadosBase} setModalConfig={setModalConfig} /> )}

            {abaAtiva === 'bi' && <CentroInteligenciaBI api={api} isDarkMode={isDarkMode} sysConfig={sysConfig} filiaisDb={filiaisDb} equipamentosDaFilial={equipamentosDaFilial} />}
            {['empresas', 'dev_panel', 'saas', 'billing', 'system', 'soc', 'atualizacoes', 'sql_terminal', 'websocket_stream'].includes(abaAtiva) && userRole === 'DEV' && (
               <PainelDesenvolvedor
                 api={api} socket={socketInstance} abaAtiva={abaAtiva} isDevAuthenticated={isDevAuthenticated}
                 onAuthenticate={() => { setIsDevAuthenticated(true); sessionStorage.setItem('devAuth', 'true'); }} showToast={showToast}
                 sysConfig={sysConfig} updateSysConfig={updateSysConfig} tocarAlarme={tocarAlarme} usuariosLista={usuariosLista} filiaisDb={filiaisDb} setModalConfig={setModalConfig}
               />
             )}

            {((isModuloOculto(abaAtiva) && !['aprovacoes', 'empresas', 'dev_panel', 'saas', 'billing', 'system', 'soc', 'atualizacoes', 'sql_terminal', 'websocket_stream'].includes(abaAtiva)) || (abaAtiva === 'chat' && !isFeatureEnabled('enableChat'))) && (
               <div className="empty-state dashboard-empty anim-fade-in" style={{marginTop: '2rem'}}>
                  <div className="empty-shield-box" style={{ background: 'rgba(239, 68, 68, 0.1)' }}><AlertOctagon size={48} color="var(--danger)" /></div>
                  <h3 className="empty-title" style={{ color: 'var(--danger)' }}>Acesso Restrito</h3>
                  <p className="empty-subtitle">As políticas de governação atuais impedem a visualização deste módulo.</p>
               </div>
            )}
          </ErrorBoundary>
        </div>
      </main>

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