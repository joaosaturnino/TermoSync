import React, { useState, useEffect, useRef, useMemo, useCallback, Component } from 'react';
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
  ChevronDown, ChevronRight, Rocket, Database, Network
} from 'lucide-react';

import TermoSyncLogo from './components/TermoSyncLogo';
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

import { useSystemCore } from './hooks/useSystemCore';

const API_URL = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000';

const getAlertConfig = (tipo_alerta) => {
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

// ============================================================================
// 1. TELA DE BOOT AVANÇADA (CYBER CRT TERMINAL & AUDIO FEEDBACK)
// ============================================================================
const DevBootScreen = ({ onComplete }) => {
  const [bootStarted, setBootStarted] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showInput, setShowInput] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [attempts, setBlockedAttempts] = useState(0);
  const [countdown, setCountdown] = useState(0);
  
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const skipRef = useRef(false);

  const asciiLogo = `
  ______                           _____                  
 /_  __/___  _________ ___  ____  / ___/__  ______  _____ 
  / / / __ \\/ ___/ __ \`__ \\/ __ \\ \\__ \\/ / / / __ \\/ ___/ 
 / / / /_/ / /  / / / / / / /_/ /___/ / /_/ / / / / /__   
/_/  \\____/_/  /_/ /_/ /_/\\____//____/\\__, /_/ /_/\\___/   
                                     /____/               
`;

  useEffect(() => { 
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" }); 
  }, [logs, showInput]);

  // Sons Sintetizados via AudioContext API
  const playSound = useCallback((frequency, type, duration) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if(audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
      
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }, []);

  const playTyping = useCallback(() => playSound(800, 'sine', 0.05), [playSound]);
  const playSuccess = useCallback(() => { playSound(600, 'sine', 0.1); setTimeout(() => playSound(1200, 'sine', 0.3), 100); }, [playSound]);
  const playError = useCallback(() => playSound(150, 'sawtooth', 0.4), [playSound]);

  // Detetar Teclas para "Skip Boot"
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showInput && bootStarted && (e.key === 'Enter' || e.key === 'Escape')) {
        skipRef.current = true;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showInput, bootStarted]);

  useEffect(() => {
    if (!bootStarted) return;

    let isMounted = true;
    const sleep = ms => new Promise(r => setTimeout(r, skipRef.current ? 0 : ms));
    const genHex = () => Math.random().toString(16).substring(2, 12).toUpperCase();

    const runBootSequence = async () => {
      const sequence = [
        { text: asciiLogo, delay: 100, color: '#10b981', isPre: true },
        { text: "⚡ TERMOSYNC CORE SYSTEM v13.1.SENTINEL", delay: 200, color: '#10b981', isBold: true },
        { text: "INITIALIZING FIRMWARE HARDWARE INTERFACE...", delay: 100, color: '#94a3b8' },
        { text: "------------------------------------------------------------", delay: 50, color: '#475569' },
        { text: "CPU: AMD EPYC 9754 Core @ 3.20GHz (Hyper-Threading: ACTIVE)", delay: 80 },
        { text: "STORAGE: Multi-Tenant NVMe Array Partition mounted on /dev/sda1", delay: 80 },
        { text: "I2C BUS CORES: Scanning for physical environmental sensors...", delay: 200 },
        { text: "[  OK  ] Sensor Temp/Humi DHT22 detected on Address 0x40", delay: 50, color: '#10b981' },
        { text: "[  OK  ] Broker MQTT Pipeline mapped on port 1883", delay: 120, color: '#10b981' },
        { text: "NETWORK: Initializing TLS 1.3 socket negotiation...", delay: 150 },
        { text: `CONNECTING TO MASTER REPLICA [ 104.28.192.12:3000 ]...`, delay: 300, color: '#38bdf8' }
      ];

      for (let i = 0; i < 6; i++) {
        sequence.push({ 
          text: `[ STAGE_${i} ] Syncing data node index [0x${genHex().substring(0,4)}]... CONNECTED`, 
          delay: 40 + Math.random() * 40, 
          color: '#475569' 
        });
      }

      sequence.push(
        { text: "------------------------------------------------------------", delay: 50, color: '#475569' },
        { text: "[  OK  ] Relational Engine: MySQL Connection Pool established.", delay: 150, color: '#10b981' },
        { text: "[  OK  ] Cryptographic Core: AES-256 Vault unsealed.", delay: 100, color: '#10b981' },
        { text: "[ WARN ] NETWORK SECURITY OPERATION CENTER ACTIVATED.", delay: 250, color: '#eab308', isBold: true },
        { text: "[ ALERTA ] PROTOCOLO ZERO-TRUST EM VIGOR.", delay: 200, color: '#ef4444', isBold: true },
        { text: "ACESSO RESTRITO - INTRODUZA A CREDENCIAL MASTER ROOT", delay: 100, color: '#cbd5e1', isBold: true }
      );

      for (let i = 0; i < sequence.length; i++) {
        if (!isMounted) return;
        await sleep(sequence[i].delay);
        if (!skipRef.current) {
            if (sequence[i].color === '#ef4444') playSound(300, 'sawtooth', 0.15); 
            else playTyping();
        }
        setLogs(prev => [...prev, sequence[i]]);
      }
      if (isMounted) setShowInput(true);
    };

    runBootSequence();
    return () => { isMounted = false; };
  }, [bootStarted, playSound, playTyping]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && attempts >= 3) {
      setShowInput(true);
      setBlockedAttempts(0);
      setLogs(prev => [...prev, { text: "[ SECURITY ] Terminal destrancado. Tente novamente.", color: '#38bdf8' }]);
    }
  }, [countdown, attempts]);

  useEffect(() => { 
    if (showInput && inputRef.current && !isProcessing && countdown === 0) inputRef.current.focus(); 
  }, [showInput, isProcessing, countdown]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!passcode.trim() || isProcessing || countdown > 0) return;
    setIsProcessing(true);
    setShowInput(false);
    
    const typed = passcode;
    setPasscode('');
    setLogs(prev => [...prev, { text: `root@termosync:~$ ${typed.replace(/./g, '●')}`, color: '#10b981' }]);
    
    await new Promise(r => setTimeout(r, 600));
    playTyping();
    
    // ATENÇÃO: Aqui você pode colocar a palavra-passe que desejar (está "root" ou "dev")
    if (typed.toLowerCase() === 'root' || typed.toLowerCase() === 'dev') {
      playSuccess();
      setLogs(prev => [...prev, { text: "SIGNATURE CHECK: VALID ROOT Privileges Conceded.", color: '#10b981', isBold: true }]);
      await new Promise(r => setTimeout(r, 400));
      setLogs(prev => [...prev, { text: "A injetar daemons na consola de controlo...", color: '#94a3b8' }]);
      await new Promise(r => setTimeout(r, 600));
      onComplete();
    } else {
      playError();
      const nextAttempts = attempts + 1;
      setBlockedAttempts(nextAttempts);
      
      setLogs(prev => [...prev, { text: `[ FALHA ] IDENTIFICAÇÃO INCORRETA. INCIDENTE REGISTADO NO NOC.`, color: '#ef4444', isBold: true }]);
      
      if (nextAttempts >= 3) {
        setCountdown(15);
        setLogs(prev => [...prev, { text: `[ LOCKOUT ] Alerta contra Brute-Force acionado. Terminal suspenso por 15s.`, color: '#ef4444' }]);
        setIsProcessing(false);
      } else {
        await new Promise(r => setTimeout(r, 400));
        setShowInput(true);
        setIsProcessing(false);
      }
    }
  };

  if (!bootStarted) {
    return (
      <div className="root-boot-screen crt" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#010409', flexDirection: 'column' }}>
         <div className="noc-scanlines"></div>
         <div style={{ textAlign: 'center', zIndex: 10 }}>
            <Server size={64} color="#10b981" style={{ marginBottom: '20px', opacity: 0.8 }} className="pulse-icon" />
            <h1 style={{ color: 'white', fontFamily: 'JetBrains Mono', fontSize: '1.5rem', marginBottom: '10px' }}>TermoSync Core System</h1>
            <p style={{ color: '#64748b', fontFamily: 'JetBrains Mono', fontSize: '0.85rem', marginBottom: '30px' }}>Aguardando inicialização do Operador de Rede.</p>
            <button 
              onClick={() => setBootStarted(true)} 
              className="btn btn-outline" 
              style={{ borderColor: '#10b981', color: '#10b981', fontFamily: 'JetBrains Mono', fontSize: '1rem', padding: '12px 24px', borderWidth: '2px', background: 'rgba(16, 185, 129, 0.1)' }}
            >
              <Power size={18} style={{ marginRight: '10px', display: 'inline-block' }} />
              INICIAR TERMINAL
            </button>
         </div>
      </div>
    );
  }

  return (
    <div className={`root-boot-screen crt ${countdown > 0 ? 'red-alert-mode' : ''}`} onClick={() => { if (showInput && countdown === 0) inputRef.current?.focus(); }} style={{ position: 'fixed', inset: 0, background: '#010409', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      <div className="noc-scanlines"></div>
      
      {!showInput && countdown === 0 && (
         <div style={{ position: 'absolute', top: '20px', right: '30px', color: '#64748b', fontFamily: 'JetBrains Mono', fontSize: '0.75rem', zIndex: 10 }}>
           [ENTER] para saltar o boot
         </div>
      )}

      <div className="boot-terminal-box" style={{ background: 'transparent', boxShadow: 'none', position: 'relative', zIndex: 5, padding: '2rem', flex: 1, overflowY: 'auto' }}>
        {logs.map((log, index) => (
          <div key={index} className="boot-log" style={{ color: log.color || '#cbd5e1', fontWeight: log.isBold ? 'bold' : 'normal', textShadow: log.color === '#10b981' ? '0 0 4px rgba(16,185,129,0.4)' : 'none', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
            {log.isPre ? <pre style={{ margin: 0, padding: 0, fontFamily: 'inherit' }}>{log.text}</pre> : log.text}
          </div>
        ))}
        
        {showInput && countdown === 0 && (
          <form onSubmit={handleAuth} className="boot-form" style={{ display: 'flex', marginTop: '15px', position: 'relative', alignItems: 'center' }}>
            <span className="boot-prompt" style={{ color: '#10b981', fontWeight: 900, fontFamily: 'JetBrains Mono' }}>root@termosync:~$</span>
            <div className="boot-input-wrapper" style={{ display: 'flex', flex: 1, minWidth: '250px', position: 'relative', alignItems: 'center' }}>
              <input ref={inputRef} type="password" value={passcode} onChange={e => setPasscode(e.target.value)} className="boot-input" autoComplete="off" disabled={isProcessing} style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', fontFamily: 'JetBrains Mono', width: '100%', caretColor: 'transparent', letterSpacing: '2px', textShadow: '0 0 5px #fff' }} />
              <span className="boot-cursor-blink" style={{ display: 'inline-block', width: '10px', height: '1.2em', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'blink 1s step-end infinite', marginLeft: '4px' }}></span>
            </div>
          </form>
        )}

        {countdown > 0 && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '15px', color: '#ef4444', fontFamily: 'JetBrains Mono', fontSize: '0.9rem', marginTop: '15px', fontWeight: 'bold', display: 'inline-block' }} className="pulse-icon">
            <Lock size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
            DISPOSITIVO BLOQUEADO PROTOCOLO ANTI-BRUTE-FORCE: AGUARDE {countdown}s...
          </div>
        )}
        <div ref={bottomRef} style={{ paddingBottom: '20px' }} />
      </div>
    </div>
  );
};

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, errorInfo: null }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("Crash interceptado:", error); this.setState({ errorInfo }); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="crash-recovery-screen anim-fade-in">
          <div className="crash-box">
            <Terminal size={56} className="crash-icon pulse-danger-icon" style={{color: 'var(--danger)', marginBottom: '1rem'}} />
            <h2 style={{color: 'white', marginBottom: '1rem'}}>SISTEMA INTERROMPIDO</h2>
            <p className="crash-text" style={{color: '#94a3b8', marginBottom: '1.5rem'}}>Ocorreu uma falha crítica ao renderizar este módulo. A sua sessão e os dados da rede permanecem seguros.</p>
            <div className="crash-code" style={{background: 'rgba(0,0,0,0.5)', padding: '10px', color: '#fca5a5', fontFamily: 'monospace', marginBottom: '2rem'}}>ERR_UI_RENDER_FAIL</div>
            <button className="btn btn-danger w-100" onClick={() => window.location.reload()}><Activity size={18} /> REINICIAR NÚCLEO</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [token, setToken] = useState(sessionStorage.getItem('token') || '');
  const [userId, setUserId] = useState(sessionStorage.getItem('userId') || ''); 
  const [socketInstance, setSocketInstance] = useState(null); 
  
  const [userRole, setUserRole] = useState(sessionStorage.getItem('userRole') || 'LOJA');
  const [userFilial, setUserFilial] = useState(sessionStorage.getItem('userFilial') || 'Todas');
  const [nomeLogado, setNomeLogado] = useState(sessionStorage.getItem('nomeLogado') || '');
  const [papelLogado, setPapelLogado] = useState(sessionStorage.getItem('papelLogado') || '');
  const [loginAtivo, setLoginAtivo] = useState(sessionStorage.getItem('loginAtivo') || '');
  
  const [isDevAuthenticated, setIsDevAuthenticated] = useState(sessionStorage.getItem('devAuth') === 'true');
  const [abaAtiva, setAbaAtiva] = useState(sessionStorage.getItem('abaAtiva') || 'dashboard');
  
  const [isDevBooting, setIsDevBooting] = useState(false);
  const [devBootData, setDevBootData] = useState(null);
  
  const [bannerFechado, setBannerFechado] = useState(true);

  const [gruposExpandidos, setGruposExpandidos] = useState({
    'Desenvolvedor': true,
    'Operações': true,
    'Serviços': true,
    'Auditoria': true,
    'Sistema': true
  });

  useEffect(() => {
    if (userRole === 'DEV') {
      setGruposExpandidos({
        'Desenvolvedor': true,
        'Operações': false,
        'Serviços': false,
        'Auditoria': false,
        'Sistema': false
      });
    } else {
      setGruposExpandidos({
        'Desenvolvedor': true,
        'Operações': true,
        'Serviços': true,
        'Auditoria': true,
        'Sistema': true
      });
    }
  }, [userRole]);

  const toggleGrupo = (grupo) => {
    setGruposExpandidos(prev => ({ ...prev, [grupo]: !prev[grupo] }));
  };
  
  useEffect(() => { if (token) sessionStorage.setItem('abaAtiva', abaAtiva); }, [abaAtiva, token]);

  const { sysConfig, isFeatureEnabled, isModuloOculto, updateSysConfig, getPlanoAtual } = useSystemCore(userRole, loginAtivo, userFilial, abaAtiva, setAbaAtiva);

  const isFeatureEnabledRef = useRef(isFeatureEnabled);
  useEffect(() => { isFeatureEnabledRef.current = isFeatureEnabled; }, [isFeatureEnabled]);

  const [menuAberto, setMenuAberto] = useState(false);
  const [menuRecolhido, setMenuRecolhido] = useState(false); 
  const [isLoginLoading, setIsLoginLoading] = useState(false); 
  const [loginErro, setLoginErro] = useState(''); 
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') !== 'light');
  
  const [mostrarNotificacoes, setMostrarNotificacoes] = useState(false);
  
  const [somAtivoState, setSomAtivoState] = useState(false); 
  const somAtivoRef = useRef(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [latencia, setLatencia] = useState(12);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [cmdSearch, setCmdSearch] = useState('');
  const commandInputRef = useRef(null);
  
  const [isLocked, setIsLocked] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  const [lockError, setLockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  const bannerTexto = sysConfig?.regras?.GLOBAL?.features?.globalBanner;

  useEffect(() => {
    if (bannerTexto) {
      const bannerGuardado = localStorage.getItem('termosync_banner_oculto');
      if (bannerGuardado !== bannerTexto) {
        setBannerFechado(false);
      }
    }
  }, [bannerTexto]);

  const fecharBannerGlobal = () => {
    setBannerFechado(true);
    if (bannerTexto) {
      localStorage.setItem('termosync_banner_oculto', bannerTexto);
    }
  };

  const initialFilialAtiva = sessionStorage.getItem('papelLogado')?.includes('Impersonate') ? sessionStorage.getItem('userFilial') : ((userRole !== 'LOJA' && userRole !== 'MANUTENCAO') ? 'Todas' : userFilial);
  const [filialAtiva, setFilialAtiva] = useState(initialFilialAtiva);
  
  const filialAtivaRef = useRef(filialAtiva);
  useEffect(() => { filialAtivaRef.current = filialAtiva; }, [filialAtiva]);

  const userRoleRef = useRef(userRole);
  useEffect(() => { userRoleRef.current = userRole; }, [userRole]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const impersonateToken = urlParams.get('impersonateToken');
    const impersonateLoja = urlParams.get('impersonateLoja');
    
    if (impersonateToken && impersonateLoja) {
      sessionStorage.removeItem('cache_equipamentos');
      sessionStorage.removeItem('cache_notificacoes');
      sessionStorage.removeItem('cache_historico');

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

      window.history.replaceState({}, document.title, window.location.pathname);
      
      setTimeout(() => {
         const fakeEvent = new CustomEvent('forceToast', { detail: { msg: `<b>Modo Impersonate Ativo:</b> Controle remoto de <strong>${impersonateLoja}</strong> estabelecido com sucesso.`, type: 'warning' }});
         window.dispatchEvent(fakeEvent);
      }, 1000);
    }
  }, []);

  const fazerLogout = useCallback(() => { 
    setToken(''); setUserId(''); sessionStorage.clear(); 
    setUserRole('LOJA'); setUserFilial(''); setFilialAtiva('Todas'); setNomeLogado(''); setPapelLogado(''); setLoginAtivo('');
    setAbaAtiva('dashboard'); setMenuAberto(false); setNaoLidasPorContato({}); setContatoChatAtivo(null); setShowCommandPalette(false); setIsLocked(false);
    setIsDevAuthenticated(false); 
  }, []);

  useEffect(() => {
    const handleKillSwitch = (e) => {
      if (e.key === 'termosync_force_logout' && e.newValue) {
        const lojaAlvo = e.newValue.split('_')[0]; 
        if (userFilial === lojaAlvo && userRole !== 'DEV' && !papelLogado.includes('Impersonate')) {
          fazerLogout();
          setTimeout(() => {
             const fakeEvent = new CustomEvent('forceToast', { detail: { msg: `<b>Conexão Terminada:</b> A sua sessão foi revogada remotamente pelo Administrador de Rede.`, type: 'error' }});
             window.dispatchEvent(fakeEvent);
          }, 500);
        }
      }
    };
    window.addEventListener('storage', handleKillSwitch);
    return () => window.removeEventListener('storage', handleKillSwitch);
  }, [userFilial, userRole, papelLogado, fazerLogout]);

  useEffect(() => { if (sysConfig.maintenanceMode && userRole !== 'DEV' && token && !papelLogado.includes('Impersonate')) fazerLogout(); }, [sysConfig.maintenanceMode, userRole, token, fazerLogout, papelLogado]);

  useEffect(() => { if (isFeatureEnabled('forceDarkMode')) setIsDarkMode(true); }, [sysConfig, isFeatureEnabled]);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setLockError('');
    if (!lockPassword.trim()) return setLockError('A chave de segurança é obrigatória.');
    if (isOffline) return setLockError('Conexão à base de dados perdida. Aguarde.');

    setIsUnlocking(true);
    try {
      await axios.post(`${API_URL}/login`, { usuario: loginAtivo, senha: lockPassword });
      setIsLocked(false); setLockPassword('');
    } catch (error) { setLockError('Acesso Negado. Credencial inválida.'); } 
    finally { setIsUnlocking(false); }
  };

  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    const handleKeyDown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowCommandPalette(prev => !prev); } };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => { if (showCommandPalette && commandInputRef.current) commandInputRef.current.focus(); }, [showCommandPalette]);

  const toggleFullScreen = () => { 
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => showToast("Modo TV bloqueado.", "warning")); } 
    else { document.exitFullscreen(); } 
  };
  
  useEffect(() => { 
    const handleFullscreenChange = () => setIsFullScreen(!!document.fullscreenElement); 
    document.addEventListener('fullscreenchange', handleFullscreenChange); 
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange); 
  }, []);

  useEffect(() => { 
    if (isDarkMode) { document.documentElement.classList.add('dark-theme'); document.body.classList.add('dark-theme'); localStorage.setItem('theme', 'dark'); } 
    else { document.documentElement.classList.remove('dark-theme'); document.body.classList.remove('dark-theme'); localStorage.setItem('theme', 'light'); } 
  }, [isDarkMode]);

  const [equipamentos, setEquipamentos] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [historicoAlertas, setHistoricoAlertas] = useState([]);
  const [relatorios, setRelatorios] = useState([]);
  const [chamados, setChamados] = useState([]);
  const [usuariosLista, setUsuariosLista] = useState([]);
  const [lojasCadastradas, setLojasCadastradas] = useState([]); 
  const [filiaisDb, setFiliaisDb] = useState([]);
  const [tecnicosDb, setTecnicosDb] = useState([]); 
  const [contatosDb, setContatosDb] = useState([]); 
  const [historicoChat, setHistoricoChat] = useState([]);
  
  const [contatoChatAtivo, setContatoChatAtivo] = useState(null);
  const contatoChatAtivoRef = useRef(contatoChatAtivo);
  useEffect(() => { contatoChatAtivoRef.current = contatoChatAtivo; }, [contatoChatAtivo]);

  const [naoLidasPorContato, setNaoLidasPorContato] = useState({});
  const totalNaoLidas = Object.values(naoLidasPorContato).reduce((a, b) => a + b, 0);

  const [listaSetores, setListaSetores] = useState([]);
  const [listaTipos, setListaTipos] = useState([]);
  
  const [dataInicio, setDataInicio] = useState(new Date(new Date().setDate(new Date().getDate() - 1)));
  const [dataFim, setDataFim] = useState(new Date());
  const [equipamentoFiltro, setEquipamentoFiltro] = useState('');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  
  const [toasts, setToasts] = useState([]);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', isPrompt: false, promptValue: '', onConfirm: null });
  const [formEditEquip, setFormEditEquip] = useState({});
  const [equipEditando, setEquipEditando] = useState(null);

  const abaAtivaRef = useRef(abaAtiva);
  useEffect(() => { abaAtivaRef.current = abaAtiva; }, [abaAtiva]);

  const bufferLeiturasRef = useRef({});
  const relatoriosBufferRef = useRef([]);

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
      if (relatoriosBufferRef.current.length > 0) {
        setRelatorios(prev => { const att = [...prev, ...relatoriosBufferRef.current]; if (att.length > 2000) return att.slice(att.length - 2000); return att; });
        relatoriosBufferRef.current = [];
      }
    }, 1000); 
    return () => clearInterval(iotFlushInterval);
  }, []);

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: API_URL, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    instance.interceptors.response.use((response) => response, (error) => { if (error.response && error.response.status === 401 && !papelLogado.includes('Impersonate')) fazerLogout(); return Promise.reject(error); });
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

  const alternarSom = useCallback(() => { 
    if (!isFeatureEnabled('enableAudioAlerts')) return showToast('Alertas sonoros bloqueados pela Administração.', 'warning');
    const novoEstado = !somAtivoState; 
    setSomAtivoState(novoEstado); 
    somAtivoRef.current = novoEstado; 
    if (novoEstado) { 
      try { 
        const ctx = new (window.AudioContext || window.webkitAudioContext)(); 
        if (ctx.state === 'suspended') ctx.resume(); 
        
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
        
        showToast('Alertas acústicos armados com sucesso.', 'success'); 
      } catch (e) { } 
    } else { 
      showToast('Sistema acústico silenciado.', 'info'); 
    } 
  }, [somAtivoState, showToast, isFeatureEnabled]);

  const fazerLogin = async (usuarioInput, senhaInput) => {
    if (isOffline) return showToast('Sinal de rede perdido.', 'error');
    setLoginErro(''); setIsLoginLoading(true); 
    try {
      const res = await axios.post(`${API_URL}/login`, { usuario: usuarioInput, senha: senhaInput });
      if (sysConfig.maintenanceMode && res.data.role !== 'DEV') return showToast('SISTEMA EM MANUTENÇÃO. Acesso restrito.', 'warning');

      const gNome = res.data.nome_gerente || ''; const cNome = res.data.nome_coordenador || '';
      let identityName = usuarioInput; let roleTitle = 'Gestor de Loja';
      
      if (res.data.role === 'DEV') { 
        identityName = 'Desenvolvedor do Sistema'; roleTitle = 'SysAdmin / Root'; 
        setDevBootData({ token: res.data.token, id: res.data.id, role: res.data.role, filial: res.data.filial, identityName, roleTitle, loginName: usuarioInput });
        setIsDevBooting(true); setIsLoginLoading(false); return;
      }
      else if (res.data.role === 'ADMIN') { identityName = 'Administrador'; roleTitle = 'Acesso Master'; }
      else if (res.data.role === 'MANUTENCAO') { identityName = res.data.nome_tecnico || 'Técnico'; roleTitle = 'Manutenção Global'; }
      else if (res.data.role === 'LOJA') { if (gNome) { identityName = gNome; roleTitle = 'Gerente da Loja'; } else if (cNome) { identityName = cNome; roleTitle = 'Coordenador da Loja'; } else { identityName = 'Equipe Geral'; roleTitle = 'Acesso da Loja'; } }
      
      setToken(res.data.token); setUserId(res.data.id); setUserRole(res.data.role); setUserFilial(res.data.filial); 
      setFilialAtiva(res.data.role !== 'LOJA' ? 'Todas' : res.data.filial);
      setAbaAtiva('dashboard'); setMenuAberto(false);
      
      setNomeLogado(identityName); setPapelLogado(roleTitle); setLoginAtivo(usuarioInput);
      
      sessionStorage.setItem('token', res.data.token); sessionStorage.setItem('userId', res.data.id); sessionStorage.setItem('userRole', res.data.role); sessionStorage.setItem('userFilial', res.data.filial); sessionStorage.setItem('nomeLogado', identityName); sessionStorage.setItem('papelLogado', roleTitle); sessionStorage.setItem('loginAtivo', usuarioInput);
      showToast(`Protocolo aceito. Bem-vindo(a), ${identityName}.`, 'success');
    } catch (error) { setLoginErro('Credenciais inválidas.'); showToast('Acesso Negado.', 'error'); } finally { setIsLoginLoading(false); }
  };

  const completeDevBoot = () => {
    if (!devBootData) return;
    const { token, id, role, filial, identityName, roleTitle, loginName } = devBootData;
    
    setToken(token); setUserId(id); setUserRole(role); setUserFilial(filial); 
    setFilialAtiva('Todas'); setAbaAtiva('dev_panel'); setMenuAberto(false);
    setNomeLogado(identityName); setPapelLogado(roleTitle); setLoginAtivo(loginName);
    setIsDevAuthenticated(true); 
    
    sessionStorage.setItem('token', token); sessionStorage.setItem('userId', id); sessionStorage.setItem('userRole', role); sessionStorage.setItem('userFilial', filial); sessionStorage.setItem('nomeLogado', identityName); sessionStorage.setItem('papelLogado', roleTitle); sessionStorage.setItem('loginAtivo', loginName);
    sessionStorage.setItem('devAuth', 'true');
    
    showToast(`Protocolo ROOT aceito. Bem-vindo(a), ${identityName}.`, 'success');
    setIsDevBooting(false); setDevBootData(null);
  };

  const carregarChamados = useCallback(async () => { if (!token || isOffline) return; try { const res = await api.get('/chamados'); setChamados(Array.isArray(res.data) ? res.data : []); } catch (e) { } }, [token, isOffline, api]);
  const carregarUsuarios = useCallback(async () => { if ((userRole !== 'ADMIN' && userRole !== 'DEV') || !token || isOffline) return; try { const res = await api.get('/usuarios'); setUsuariosLista(Array.isArray(res.data) ? res.data : []); } catch (e) {} }, [api, userRole, token, isOffline]);
  const carregarLojas = useCallback(async () => { if ((userRole !== 'ADMIN' && userRole !== 'DEV') || !token || isOffline) return; try { const res = await api.get('/lojas'); setLojasCadastradas(Array.isArray(res.data) ? res.data : []); } catch (e) {} }, [api, userRole, token, isOffline]);
  const carregarTecnicos = useCallback(async () => { if (!token || isOffline) return; try { const res = await api.get('/tecnicos'); setTecnicosDb(Array.isArray(res.data) ? res.data : []); } catch (e) {} }, [api, token, isOffline]);
  const carregarContatos = useCallback(async () => { if (!token || isOffline) return; try { const res = await api.get('/contatos'); setContatosDb(Array.isArray(res.data) ? res.data : []); } catch (e) {} }, [api, token, isOffline]);
  const carregarParametrosGerais = useCallback(async () => { if (!token || isOffline) return; try { const [resSetores, resTipos] = await Promise.all([ api.get('/setores').catch(() => ({ data: [] })), api.get('/tipos-refrigeracao').catch(() => ({ data: [] })) ]); setListaSetores(Array.isArray(resSetores.data) ? resSetores.data : []); setListaTipos(Array.isArray(resTipos.data) ? resTipos.data : []); } catch (e) {} }, [api, token, isOffline]);
  
  const carregarHistoricoChat = useCallback(async () => { 
    if (!token || isOffline || !isFeatureEnabledRef.current('enableChat')) return; 
    try { 
      const res = await api.get('/chat/historico'); 
      const histFormatado = res.data.map(m => ({ ...m, data: new Date(m.data) })); 
      setHistoricoChat(histFormatado); 
    } catch (e) {} 
  }, [api, token, isOffline]);

  const carregarDadosBase = useCallback(async () => {
    if (!token) return;
    
    const cE = sessionStorage.getItem('cache_equipamentos'); 
    const cN = sessionStorage.getItem('cache_notificacoes'); 
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
      setEquipamentos(Array.isArray(resEquip.data) ? resEquip.data : []); 
      setFiliaisDb(Array.isArray(resFiliais.data) ? resFiliais.data : []); 
      carregarParametrosGerais();
      
      if (isHistorico && resHist.data) setHistoricoAlertas(Array.isArray(resHist.data) ? resHist.data : []);
      
      const dadosNotificacoes = Array.isArray(resNotif.data) ? resNotif.data : [];
      setNotificacoes(dadosNotificacoes); 
      
      sessionStorage.setItem('cache_equipamentos', JSON.stringify(resEquip.data)); 
      sessionStorage.setItem('cache_notificacoes', JSON.stringify(dadosNotificacoes));
    } catch (error) {}
  }, [token, isOffline, api, carregarParametrosGerais]);

  const carregarDadosBaseRef = useRef(carregarDadosBase); const carregarChamadosRef = useRef(carregarChamados);
  useEffect(() => { carregarDadosBaseRef.current = carregarDadosBase; }, [carregarDadosBase]); useEffect(() => { carregarChamadosRef.current = carregarChamados; }, [carregarChamados]);

  useEffect(() => {
    if (!token || isOffline) return;
    if (!isFeatureEnabledRef.current('telemetryStream')) return;
    
    const socket = io(SOCKET_URL, { transports: ['websocket'], upgrade: false }); 
    setSocketInstance(socket);
    
    if (userId && !papelLogado.includes('Impersonate')) socket.emit('registrar_usuario', userId);
    
    socket.on('nova_leitura', (dadosNovaLeitura) => { 
      bufferLeiturasRef.current[dadosNovaLeitura.equipamento_id] = dadosNovaLeitura; 
      if (abaAtivaRef.current === 'relatorios') relatoriosBufferRef.current.push(dadosNovaLeitura); 
    });
    
    let timeoutAtualizacao;
    socket.on('atualizacao_dados', () => { 
      clearTimeout(timeoutAtualizacao);
      timeoutAtualizacao = setTimeout(() => {
        carregarDadosBaseRef.current(); 
        carregarChamadosRef.current(); 
      }, 2000); 
    });

    socket.on('novo_alerta', (alertaCompleto) => {
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
        
        setNotificacoes(prev => {
          if (prev.some(n => n.id === alertaCompleto.id)) return prev;
          return [alertaCompleto, ...prev];
        });
      }
    });
    
    socket.on('nova_mensagem_chat', (msg) => { 
      if (!isFeatureEnabledRef.current('enableChat')) return; 
      setHistoricoChat(prev => { 
        if (prev.some(m => String(m.id) === String(msg.id))) return prev; 
        return [...prev, { ...msg, data: new Date(msg.data), tipo: 'received' }]; 
      }); 
      
      if (userRoleRef.current !== 'DEV') {
        tocarSomMensagemRef.current(); 
        if (abaAtivaRef.current !== 'chat' || String(contatoChatAtivoRef.current?.id) !== String(msg.remetenteId)) { 
          showToastRef.current(`${msg.remetenteNome}: ${msg.texto}`, 'info'); 
        }
      }
      
      if (abaAtivaRef.current !== 'chat' || String(contatoChatAtivoRef.current?.id) !== String(msg.remetenteId)) {
        setNaoLidasPorContato(prev => ({ ...prev, [msg.remetenteId]: (prev[msg.remetenteId] || 0) + 1 })); 
      }
    });
    
    const pingInterval = setInterval(() => { 
      setLatencia(prev => { let novo = prev + (Math.floor(Math.random() * 9) - 4); return novo < 10 ? 10 : novo > 60 ? 60 : novo; }); 
    }, 1500);
    
    return () => { 
      clearTimeout(timeoutAtualizacao);
      clearInterval(pingInterval); 
      socket.disconnect(); 
    };
  }, [token, isOffline, userId, papelLogado]);

  useEffect(() => { if (token) { carregarDadosBase(); carregarTecnicos(); carregarContatos(); carregarHistoricoChat(); } }, [token, carregarDadosBase, carregarTecnicos, carregarContatos, carregarHistoricoChat]);
  useEffect(() => { const handleOnline = () => { setIsOffline(false); showToast('Sinal Restabelecido.', 'success'); carregarDadosBase(); carregarHistoricoChat(); }; const handleOffline = () => { setIsOffline(true); showToast('Sem Conexão ao Servidor.', 'warning'); }; window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline); return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); }; }, [carregarDadosBase, carregarHistoricoChat, showToast]);
  const carregarRelatorios = useCallback(async () => { if (!token || isOffline) return; try { const res = await api.get(`/relatorios?data_inicio=${dataInicio.toISOString()}&data_fim=${dataFim.toISOString()}`); setRelatorios(Array.isArray(res.data) ? res.data : []); } catch (error) {} }, [token, isOffline, api, dataInicio, dataFim]);
  
  useEffect(() => { if ((['usuarios', 'dev_panel', 'saas', 'billing', 'bi'].includes(abaAtiva)) && (userRole === 'ADMIN' || userRole === 'DEV')) carregarUsuarios(); }, [abaAtiva, carregarUsuarios, userRole]);
  useEffect(() => { if (abaAtiva === 'lojas' && (userRole === 'ADMIN' || userRole === 'DEV')) carregarLojas(); }, [abaAtiva, carregarLojas, userRole]);
  useEffect(() => { if (abaAtiva === 'chamados' || abaAtiva === 'historico_chamados') carregarChamados(); }, [abaAtiva, carregarChamados]); 
  useEffect(() => { if (abaAtiva === 'parametros' && (userRole === 'ADMIN' || userRole === 'DEV')) carregarParametrosGerais(); }, [abaAtiva, carregarParametrosGerais, userRole]); 
  useEffect(() => { if (token && abaAtiva === 'relatorios') carregarRelatorios(); }, [token, abaAtiva, dataInicio, dataFim, carregarRelatorios]);

  const listaFiliais = useMemo(() => { 
    if (papelLogado.includes('Impersonate') || userRole === 'LOJA') return [userFilial];
    const filiaisExtraidas = (lojasCadastradas || []).map(l => l.nome);
    const combinadas = Array.from(new Set([...(filiaisDb || []), ...filiaisExtraidas]));
    return ['Todas', ...combinadas].sort(); 
  }, [filiaisDb, lojasCadastradas, userRole, userFilial, papelLogado]);

  useEffect(() => {
    if (userRole === 'LOJA' && filialAtiva !== userFilial) {
      setFilialAtiva(userFilial);
    }
  }, [userRole, userFilial, filialAtiva]);

  const equipamentosDaFilial = useMemo(() => filialAtiva === 'Todas' ? equipamentos : equipamentos.filter(eq => (eq.filial || 'Loja Principal') === filialAtiva), [equipamentos, filialAtiva]);
  const notificacoesDaFilial = useMemo(() => filialAtiva === 'Todas' ? notificacoes : notificacoes.filter(n => (n.filial || 'Loja Principal') === filialAtiva), [notificacoes, filialAtiva]);
  const { qtdTotal, qtdDegelo, qtdFalha, qtdOperando } = useMemo(() => { const total = equipamentosDaFilial?.length || 0; const degelo = equipamentosDaFilial?.filter(e => e.em_degelo).length || 0; const falha = equipamentosDaFilial?.filter(e => !e.motor_ligado && !e.em_degelo).length || 0; return { qtdTotal: total, qtdDegelo: degelo, qtdFalha: falha, qtdOperando: total - degelo - falha }; }, [equipamentosDaFilial]);
  const eqPesquisaLower = termoPesquisa.toLowerCase();
  const equipamentosFiltradosLista = useMemo(() => equipamentosDaFilial?.filter(eq => eq.nome?.toLowerCase().includes(eqPesquisaLower) || (eq.setor && eq.setor.toLowerCase().includes(eqPesquisaLower))), [equipamentosDaFilial, eqPesquisaLower]);
  const historicoFiltradoLista = useMemo(() => { let hist = filialAtiva === 'Todas' ? historicoAlertas : historicoAlertas?.filter(h => (h.filial || 'Loja Principal') === filialAtiva); return hist?.filter(h => h.equipamento_nome?.toLowerCase().includes(eqPesquisaLower) || (h.setor && h.setor.toLowerCase().includes(eqPesquisaLower))); }, [historicoAlertas, filialAtiva, eqPesquisaLower]);
  const dadosRelatorioBrutos = useMemo(() => { let r = filialAtiva === 'Todas' ? relatorios : relatorios?.filter(x => (x.filial || 'Loja Principal') === filialAtiva); return r?.filter(x => equipamentoFiltro === '' || x.nome === equipamentoFiltro); }, [relatorios, filialAtiva, equipamentoFiltro]);
  const dadosGrafico = useMemo(() => dadosRelatorioBrutos?.map(r => ({ hora: new Date(r.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), dataExata: new Date(r.data_hora).toLocaleString(), temperatura: parseFloat(r.temperatura), umidade: parseFloat(r.umidade || 0), consumo_kwh: parseFloat(r.consumo_kwh || 0), nome: r.nome, filial: r.filial || 'Loja Principal' })), [dadosRelatorioBrutos]);
  const dadosGraficoFiltrados = useMemo(() => { if (dadosGrafico?.length <= 200) return dadosGrafico; return dadosGrafico?.filter((_, idx) => idx % Math.ceil(dadosGrafico.length / 200) === 0); }, [dadosGrafico]);
  const ultimasLeiturasRaw = useMemo(() => [...(dadosGrafico || [])].reverse().slice(0, 150), [dadosGrafico]);
  const { kpis, slaCompliance, totalEnergia } = useMemo(() => { let kpiMaxT = -Infinity, kpiMinT = Infinity, kpiMaxU = -Infinity, kpiMinU = Infinity, somaUmid = 0, countUmid = 0, somaTemp = 0, leiturasNoLimite = 0, somaKwh = 0; dadosGrafico?.forEach(d => { if (d.temperatura > kpiMaxT) kpiMaxT = d.temperatura; if (d.temperatura < kpiMinT) kpiMinT = d.temperatura; somaTemp += d.temperatura; if (d.umidade > 0) { if (d.umidade > kpiMaxU) kpiMaxU = d.umidade; if (d.umidade < kpiMinU) kpiMinU = d.umidade; somaUmid += d.umidade; countUmid++; } somaKwh += d.consumo_kwh; const eqRef = equipamentos?.find(e => e.nome === d.nome); if (eqRef && d.temperatura >= eqRef.temp_min && d.temperatura <= eqRef.temp_max) leiturasNoLimite++; }); const sla = dadosGrafico?.length > 0 ? ((leiturasNoLimite / dadosGrafico.length) * 100).toFixed(1) : '--'; return { kpis: { kpiMaxT: kpiMaxT === -Infinity ? '--' : kpiMaxT, kpiMinT: kpiMinT === Infinity ? '--' : kpiMinT, kpiMediaT: dadosGrafico?.length > 0 ? (somaTemp / dadosGrafico.length).toFixed(2) : '--', kpiMaxU: kpiMaxU === -Infinity ? '--' : kpiMaxU, kpiMinU: kpiMinU === Infinity ? '--' : kpiMinU, kpiMediaU: countUmid > 0 ? (somaUmid / countUmid).toFixed(1) : '--' }, slaCompliance: sla, totalEnergia: somaKwh }; }, [dadosGrafico, equipamentos]);
  const mktValueProcessado = useMemo(() => { const arr = dadosRelatorioBrutos?.map(d => parseFloat(d.temperatura)) || []; if (arr.length === 0) return '--'; let soma = 0; arr.forEach(t => soma += Math.exp(-83.144 / (0.0083144 * (t + 273.15)))); return ((83.144 / 0.0083144) / (-Math.log(soma / arr.length)) - 273.15).toFixed(2); }, [dadosRelatorioBrutos]);
  const equipamentoSelecionado = useMemo(() => equipamentosDaFilial?.find(e => e.nome === equipamentoFiltro), [equipamentosDaFilial, equipamentoFiltro]);
  const dadosDonutStatus = useMemo(() => [ { name: 'Ok', value: qtdOperando, color: 'var(--success)' }, { name: 'Degelo', value: qtdDegelo, color: '#38bdf8' }, { name: 'Falha', value: qtdFalha, color: 'var(--danger)' } ].filter(d => d.value > 0), [qtdOperando, qtdDegelo, qtdFalha]);

  const editarEquipamento = (eq) => { if (isOffline || isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada.', 'warning'); setEquipEditando(eq.id); setFormEditEquip({ nome: eq.nome, tipo: eq.tipo, temp_min: eq.temp_min, temp_max: eq.temp_max, umidade_min: eq.umidade_min || '', umidade_max: eq.umidade_max || '', intervalo_degelo: eq.intervalo_degelo, duracao_degelo: eq.duracao_degelo, setor: eq.setor, filial: eq.filial, data_calibracao: eq.data_calibracao ? new Date(eq.data_calibracao).toISOString().split('T')[0] : '' }); };
  const salvarEdicaoEquipamento = async (e) => { e.preventDefault(); if (isOffline) return; try { await api.put(`/equipamentos/${equipEditando}/edit`, formEditEquip); showToast('Atualizado com sucesso.', 'success'); setEquipEditando(null); carregarDadosBase(); } catch (e) { showToast('Erro de sincronização.', 'error'); } };
  const pedirExclusao = (id, nome) => { if (isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada (Leitura).', 'warning'); setModalConfig({ isOpen: true, title: 'Remover Máquina', message: `Remover "${nome}" permanentemente?`, isPrompt: false, onConfirm: async () => { try { await api.delete(`/equipamentos/${id}`); showToast('Ativo purgado do sistema.', 'success'); carregarDadosBase(); } catch (e) { showToast('Ação não autorizada.', 'error'); } }}); };
  
  const pedirNotaResolucao = (id) => { 
    if (isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada (Leitura).', 'warning'); 
    setModalConfig({ 
      isOpen: true, 
      title: 'Registro de Manutenção', 
      message: 'Descreva a intervenção técnica:', 
      isPrompt: true, 
      promptValue: '', 
      onConfirm: async (nota) => { 
        try { 
          await api.put(`/notificacoes/${id}/resolver`, { nota_resolucao: nota.trim() === '' ? 'Verificado e limpo.' : nota }); 
          showToast('Incidente arquivado.', 'success'); 
          setNotificacoes(prev => prev.filter(n => n.id !== id));
          carregarDadosBase(); 
        } catch (e) { showToast('Erro no arquivo.', 'error'); } 
      }
    }); 
  };
  
  const resolverTodasNotificacoes = () => { 
    if (isFeatureEnabled('readOnlyMode')) return showToast('Ação bloqueada (Leitura).', 'warning'); 
    setModalConfig({ 
      isOpen: true, 
      title: 'Limpeza do Painel', 
      message: 'Arquivar todos os alarmes pendentes do radar?', 
      isPrompt: false, 
      onConfirm: async () => { 
        try { 
          await api.put(`/notificacoes/resolver-todas`); 
          showToast('Painel higienizado.', 'success'); 
          setNotificacoes([]); 
          carregarDadosBase(); 
        } catch (e) { showToast('Erro de sistema.', 'error'); } 
      }
    }); 
  };
  
  const gerarExportacao = (tipo) => { 
    if (!isFeatureEnabled('allowExports')) return showToast('A exportação de dados foi bloqueada pelas diretrizes do sistema.', 'error');
    let fd = abaAtiva === 'historico' ? historicoFiltradoLista : (equipamentoFiltro ? relatorios.filter(r => r.nome === equipamentoFiltro) : relatorios); 
    if (fd.length === 0) return showToast("Sem dados para exportar.", "warning"); 
    
    if (tipo === 'pdf') { 
      const doc = new jsPDF(); 
      doc.setFontSize(18); 
      doc.text(abaAtiva === 'historico' ? "Auditoria de Ocorrências" : "Auditoria de Qualidade", 14, 20); 
      doc.setFontSize(11); 
      doc.text(`Emitido: ${new Date().toLocaleString()}`, 14, 28); 
      
      let head = abaAtiva === 'historico' ? [["Data", "Equipamento", "Ocorrência", "Técnico Responsável"]] : [["Data", "Local / Eq.", "Temp", "Umid", "Consumo"]]; 
      let body = abaAtiva === 'historico' 
        ? fd.map(h => [new Date(h.data_hora).toLocaleString(), `${h.equipamento_nome}`, h.mensagem, h.nota_resolucao]) 
        : fd.map(r => [new Date(r.data_hora).toLocaleString(), `${r.filial} - ${r.nome}`, `${r.temperatura}°C`, `${r.umidade}%`, `${r.consumo_kwh}kWh`]); 
      
      autoTable(doc, { head, body, startY: 40, theme: 'grid' }); 
      doc.save(`Auditoria_${new Date().getTime()}.pdf`); 
    } else { 
      let csv = abaAtiva === 'historico' ? "Data,Equipamento,Setor,Ocorrencia,Tecnico\n" : "Data,Filial,Equipamento,Temp,Umid,Consumo(kWh)\n"; 
      fd.forEach(row => { 
        csv += abaAtiva === 'historico' 
          ? `"${new Date(row.data_hora).toLocaleString()}","${row.equipamento_nome}","${row.setor}","${row.mensagem}","${row.nota_resolucao}"\n` 
          : `"${new Date(row.data_hora).toLocaleString()}","${row.filial}","${row.nome}","${row.temperatura}","${row.umidade}","${row.consumo_kwh}"\n`; 
      }); 
      const link = document.createElement("a"); 
      link.href = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv' })); 
      link.download = `Dados_${new Date().getTime()}.csv`; 
      link.click(); 
    } 
    showToast('Pacote de dados gerado.', 'success'); 
  };
  
  const gerarLoteOS = (listaChamados) => { 
    if (!isFeatureEnabled('allowExports')) return showToast('A exportação de dados foi bloqueada pelas diretrizes do sistema.', 'error');
    if (!listaChamados || listaChamados.length === 0) return showToast("Nenhuma OS pendente.", "warning"); const doc = new jsPDF(); listaChamados.forEach((c, index) => { if (index > 0) doc.addPage(); doc.setFontSize(18); doc.text(`Ordem de Serviço (OS) - ${c.status}`, 14, 20); doc.setFontSize(11); doc.text(`Máquina: ${c.equipamento_nome}`, 14, 32); doc.text(`Filial: ${c.filial}`, 14, 40); doc.text(`Abertura: ${new Date(c.data_abertura).toLocaleString()}`, 14, 72); doc.text(doc.splitTextToSize(c.descricao || 'Sem descrição.', 180), 14, 96); if (c.status === 'Concluído') { doc.text(doc.splitTextToSize(c.nota_resolucao || 'Sem nota.', 180), 14, 138); } }); doc.save(`Lote_OS_${new Date().getTime()}.pdf`); showToast('Lote Operacional Baixado.', 'success'); 
  };

  // ✅ ROTAS DE NAVEGAÇÃO ATUALIZADAS AQUI
  const NAVIGATION = [
    { id: 'dev_panel', label: 'Controle', icon: Terminal, roles: ['DEV'], type: 'Desenvolvedor' }, 
    { id: 'soc', label: 'Auditoria', icon: ShieldCheck, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true }, 
    { id: 'atualizacoes', label: 'Atualizações (Deploy)', icon: Rocket, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'sql_terminal', label: 'Console SQL', icon: Database, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'websocket_stream', label: 'Live Firehose (WS)', icon: Network, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'simulador', label: 'Simulador', icon: Cpu, roles: ['DEV'], type: 'Desenvolvedor' },
    { id: 'hardware', label: 'Hardware', icon: Server, roles: ['DEV'], type: 'Desenvolvedor' },
    { id: 'system', label: 'Operações', icon: Settings2, roles: ['DEV'], type: 'Desenvolvedor' },
    { id: 'empresas', label: 'Organizações', icon: Building2, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },
    { id: 'saas', label: 'Licenças SaaS', icon: ShieldAlert, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true }, 
    { id: 'billing', label: 'Core Financeiro', icon: DollarSign, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true }, 
    { id: 'bi', label: 'Centro de Inteligência (BI)', icon: PieChart, roles: ['DEV'], type: 'Desenvolvedor', devAuthRequired: true },

    { id: 'dashboard', label: 'Dashboard', icon: Activity, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: notificacoesDaFilial?.length, type: 'Operações' },
    { id: 'mapa', label: 'Planta Digital', icon: Map, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Operações' },
    { id: 'motores', label: 'Monitoramento Térmico', icon: Thermometer, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operações' },
    { id: 'umidade', label: 'Monitoramento de Umidade', icon: Droplets, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Operações' },
    
    { id: 'kanban', label: 'Gestão de Incidentes (ITSM)', icon: Columns, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços' },
    { id: 'metrologia', label: 'Controle Metrológico', icon: Target, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços' },
    { id: 'equipamentos', label: 'Equipamentos', icon: Server, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços' },
    { id: 'parametros', label: 'Parâmetros Globais', icon: Sliders, roles: ['ADMIN', 'DEV'], type: 'Serviços' },
    { id: 'chamados', label: 'Chamados', icon: Wrench, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Serviços' },
    { id: 'historico_chamados', label: 'Histórico de Chamados', icon: Archive, roles: ['ADMIN', 'MANUTENCAO', 'DEV'], type: 'Serviços' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], badge: totalNaoLidas, type: 'Serviços' },
    
    { id: 'relatorios', label: 'Relatórios', icon: Leaf, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Auditoria', isPremium: true },
    { id: 'historico', label: 'Histórico de Logs', icon: History, roles: ['ADMIN', 'LOJA', 'DEV'], type: 'Auditoria', isPremium: true },
    
    { id: 'lojas', label: 'Gestão de Lojas', icon: Store, roles: ['ADMIN', 'DEV'], type: 'Sistema' },
    { id: 'usuarios', label: 'Gestão de Usuários', icon: Users, roles: ['ADMIN', 'DEV'], type: 'Sistema' },
    { id: 'sobre', label: 'Sobre a Plataforma', icon: Info, roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'], type: 'Sistema' },
  ];

  const NAVIGATION_ATIVA = NAVIGATION.filter(nav => !isModuloOculto(nav.id) && nav.roles.includes(userRole) && (nav.id !== 'chat' || isFeatureEnabled('enableChat')) && (!nav.devAuthRequired || isDevAuthenticated));

  const getPlanoVisual = () => {
     const p = getPlanoAtual();
     if(p === 'ENTERPRISE') return {nome: 'PRO+', cor: '#a855f7'};
     if(p === 'PRO') return {nome: 'PRO', cor: '#38bdf8'};
     return {nome: 'FREE', cor: '#94a3b8'};
  };

  if (isDevBooting) {
    return <DevBootScreen onComplete={completeDevBoot} />;
  }

  if (!token) {
    return <Login isOffline={isOffline} isLoginLoading={isLoginLoading} fazerLogin={fazerLogin} loginErro={loginErro} />;
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

      {showCommandPalette && (
        <div className="command-palette-overlay" onClick={() => setShowCommandPalette(false)}>
          <div className="command-palette-modal anim-slide-up" onClick={e => e.stopPropagation()}>
            <div className="cmd-input-row">
              <Search size={22} color="var(--primary)" />
              <input ref={commandInputRef} type="text" autoFocus placeholder="Pesquisar módulo ou comando de sistema..." value={cmdSearch} onChange={e => setCmdSearch(e.target.value)} />
              <div className="cmd-hint"><Keyboard size={14}/> ESC para fechar</div>
            </div>
            <div className="cmd-results">
              <div className="cmd-group">Navegação Rápida</div>
              {NAVIGATION_ATIVA.filter(n => n.label.toLowerCase().includes(cmdSearch.toLowerCase())).map(nav => (
                <button key={nav.id} className="cmd-item" onClick={() => { 
                  setAbaAtiva(nav.id); 
                  setGruposExpandidos(prev => ({ ...prev, [nav.type]: true }));
                  setShowCommandPalette(false); 
                }}>
                  <nav.icon size={18} className="cmd-item-icon"/> <span>Acessar <strong>{nav.label}</strong></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {menuAberto && window.innerWidth <= 768 && <div className="overlay" onClick={() => setMenuAberto(false)}></div>}

      <aside className={`sidebar ${menuAberto ? 'open' : ''} ${menuRecolhido ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <TermoSyncLogo size={32} color="var(--secondary)" className="hide-on-collapse" />
          <h2 className="hide-on-collapse" style={{marginLeft: '10px'}}>TermoSync</h2>
          <button className="mobile-close" onClick={() => setMenuAberto(false)}><X size={20} /></button>
        </div>

        <div className="sidebar-user hide-on-collapse" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
          <div className="user-avatar" style={{ width: '40px', height: '40px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--secondary)', fontWeight: 'bold' }}>
            {nomeLogado ? nomeLogado.charAt(0) : 'U'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ color: 'white', fontWeight: '800', fontSize: '0.9rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{nomeLogado}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: '600' }}>{papelLogado}</span>
          </div>
          <div style={{ position: 'absolute', top: '10px', right: '15px', fontSize: '0.6rem', fontWeight: '900', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${getPlanoVisual().cor}`, color: getPlanoVisual().cor }}>
             {getPlanoVisual().nome}
          </div>
        </div>

        <div className="hide-on-collapse" style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--secondary)', fontWeight: '800', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>{userRole !== 'LOJA' ? <><MapPin size={14}/> Rede de Lojas</> : <><UserCheck size={14}/> Acesso Local</>}</div>
            
            {papelLogado.includes('Impersonate') ? (
              <div style={{ width: '100%', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 12px', borderRadius: '8px', color: 'var(--danger)', fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={14}/> {userFilial}
              </div>
            ) : userRole !== 'LOJA' ? (
              <select value={filialAtiva} onChange={(e) => setFilialAtiva(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: 'white', fontSize: '0.85rem', fontWeight: '700', outline: 'none' }}>
                {listaFiliais?.map(f => <option key={f} value={f} style={{background: '#0f172a'}}>{f === 'Todas' ? 'Visão Global' : f}</option>)}
              </select>
            ) : (
              <div style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: 'white', fontSize: '0.85rem', fontWeight: '700' }}>{userFilial}</div>
            )}
        </div>

        <nav className="sidebar-nav">
          {['Desenvolvedor', 'Operações', 'Serviços', 'Auditoria', 'Sistema'].map(group => {
            const itemsInGroup = NAVIGATION_ATIVA.filter(n => n.type === group);
            if (itemsInGroup.length === 0) return null;
            
            const isExpanded = gruposExpandidos[group];

            return (
              <div key={group} className="nav-group">
                <div className="nav-group-label hide-on-collapse" onClick={() => toggleGrupo(group)}>
                  <span>{group}</span>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                
                <div className={`nav-group-items ${isExpanded ? 'expanded' : 'collapsed'}`}>
                  {itemsInGroup.map(item => (
                    <button key={item.id} className={`nav-item ${abaAtiva === item.id ? 'active' : ''}`} onClick={() => { setAbaAtiva(item.id); if(window.innerWidth <= 768) setMenuAberto(false); }} title={item.label}>
                      <item.icon size={20} />
                      <span className="nav-item-text hide-on-collapse">
                        {item.label}
                        {item.isPremium && getPlanoAtual() !== 'FREE' && <span style={{marginLeft: '6px', fontSize: '0.6rem', color: 'var(--info)'}}>★</span>}
                      </span>
                      {item.badge > 0 && <span className="badge hide-on-collapse">{item.badge}</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem', display: 'flex', gap: '8px' }}>
          <button className="btn-logout flex-1" onClick={() => setIsLocked(true)} title="Modo AFK" style={{ background: 'rgba(245, 158, 11, 0.05)', color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.2)', padding: '12px', border: '1px dashed rgba(245, 158, 11, 0.4)', borderRadius: '10px', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}><Lock size={18} /></button>
          <button className="btn-logout flex-1 hide-on-collapse" onClick={fazerLogout} title="Encerrar Sessão" style={{ background: 'rgba(239, 68, 68, 0.05)', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '12px', border: '1px dashed rgba(239, 68, 68, 0.4)', borderRadius: '10px', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="main-content">
        
        {bannerTexto && !bannerFechado && (
          <div className="global-announcement-banner anim-slide-up">
            <AlertTriangle size={16} />
            <span><strong>AVISO DO SISTEMA:</strong> {bannerTexto}</span>
            <button onClick={fecharBannerGlobal} title="Ocultar aviso localmente"><X size={14}/></button>
          </div>
        )}

        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="btn-icon" onClick={() => { if (window.innerWidth <= 768) setMenuAberto(true); else setMenuRecolhido(!menuRecolhido); }}><Menu size={22} /></button>
            <h1 className="page-title desktop-only">{NAVIGATION.find(n => n.id === abaAtiva)?.label || 'TermoSync NOC'}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            
            <div style={{ position: 'relative' }}>
              <button className="btn-icon" onClick={() => setMostrarNotificacoes(!mostrarNotificacoes)} title="Centro de Notificações">
                <Bell size={20} />
                {notificacoesDaFilial?.length > 0 && (
                  <span style={{ position: 'absolute', top: '2px', right: '2px', background: 'var(--danger)', color: 'white', fontSize: '0.6rem', fontWeight: 'bold', minWidth: '16px', height: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid var(--bg-color)' }}>
                    {notificacoesDaFilial.length}
                  </span>
                )}
              </button>

              {mostrarNotificacoes && (
                <>
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} onClick={() => setMostrarNotificacoes(false)}></div>
                  
                  <div className="anim-slide-up" style={{ position: 'absolute', top: '120%', right: '-50px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', width: '320px', zIndex: 9999, boxShadow: '0 10px 40px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}><Bell size={16} color="var(--primary)"/> Alertas Ativos</h4>
                      {notificacoesDaFilial?.length > 0 && (
                        <button className="btn-action-small" onClick={() => { resolverTodasNotificacoes(); setMostrarNotificacoes(false); }} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Limpar Todos</button>
                      )}
                    </div>
                    <div style={{ maxHeight: '350px', overflowY: 'auto', padding: '10px' }}>
                      {notificacoesDaFilial?.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem 1rem' }}>
                          <CheckCircle size={32} color="var(--success)" style={{ opacity: 0.5, marginBottom: '10px' }} />
                          <p style={{ margin: 0 }}>Nenhuma anomalia detectada.</p>
                        </div>
                      ) : (
                        notificacoesDaFilial?.map(n => {
                          const cfg = getAlertConfig(n.tipo_alerta);
                          const IconCmp = cfg.icon;
                          return (
                            <div key={n.id} onClick={() => { setAbaAtiva('dashboard'); setMostrarNotificacoes(false); }} style={{ background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`, borderLeft: `3px solid ${cfg.color}`, padding: '10px', borderRadius: '6px', marginBottom: '8px', cursor: 'pointer', transition: '0.2s' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <strong style={{ color: 'var(--text-main)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <IconCmp size={14} color={cfg.color} />
                                  {n.equipamento_nome}
                                </strong>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(n.data_hora).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                              </div>
                              <span style={{ color: cfg.color, fontSize: '0.75rem', fontWeight: '600' }}>{n.mensagem}</span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="telemetry-badge-simple desktop-only" title={isFeatureEnabled('telemetryStream') ? "Socket Conectado" : "Fluxo Bloqueado pelas Políticas"}>
              <div className={`signal-bars-simple ${!isFeatureEnabled('telemetryStream') ? 'status-offline' : (isOffline ? 'status-offline' : socketInstance ? 'status-good' : 'status-slow')}`}><div className="bar active"></div><div className="bar active"></div><div className={`bar ${socketInstance && !isOffline && isFeatureEnabled('telemetryStream') ? 'active' : ''}`}></div></div>
              <span className="conn-text">{!isFeatureEnabled('telemetryStream') ? 'STREAM PAUSADA' : (isOffline ? 'SINAL PERDIDO' : 'CONECTADO')}</span>
              {!isOffline && isFeatureEnabled('telemetryStream') && <span className="conn-ms">{latencia}ms</span>}
            </div>
            <button className="btn-outline desktop-only" onClick={() => setShowCommandPalette(true)} style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}><Search size={14} /> Terminal <span style={{ background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>⌘K</span></button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-icon" onClick={alternarSom} title={somAtivoState ? "Desarmar Sirenes" : "Armar Sirenes"}>{somAtivoState ? <Volume2 size={18} color="var(--primary)"/> : <VolumeX size={18} />}</button>
              <button className="btn-icon desktop-only" onClick={toggleFullScreen} title="Painel de Comando TV">{isFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
              <button className="btn-icon" onClick={() => setIsDarkMode(!isDarkMode)} title="Modo Visual" disabled={!isFeatureEnabled('forceDarkMode') === false} style={{ opacity: isFeatureEnabled('forceDarkMode') ? 0.3 : 1 }}>{isDarkMode ? <Sun size={18} color="var(--warning)"/> : <Moon size={18} />}</button>
            </div>
          </div>
        </header>

        <div className="content-area">
          <ErrorBoundary>
            {!isModuloOculto('dashboard') && abaAtiva === 'dashboard' && ( <Dashboard qtdTotal={qtdTotal} qtdOperando={qtdOperando} qtdDegelo={qtdDegelo} qtdFalha={qtdFalha} dadosDonutStatus={dadosDonutStatus} notificacoesDaFilial={notificacoesDaFilial} resolverTodasNotificacoes={resolverTodasNotificacoes} isOffline={isOffline} pedirNotaResolucao={pedirNotaResolucao} isDarkMode={isDarkMode} contatosDb={contatosDb} showToast={showToast} irParaChat={(id) => { setAbaAtiva('chat'); if (id) { const c = contatosDb.find(x => String(x.id) === String(id)); if (c) setContatoChatAtivo(c); } }} socket={socketInstance} userId={userId} nomeLogado={nomeLogado} setHistoricoChat={setHistoricoChat} /> )}
            
            {/* Telas Corporativas */}
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
            {!isModuloOculto('relatorios') && abaAtiva === 'relatorios' && ( <Relatorios totalEnergia={totalEnergia} slaCompliance={slaCompliance} kpis={kpis} mktValueProcessado={mktValueProcessado} dataInicio={dataInicio} setDataInicio={setDataInicio} dataFim={dataFim} setDataFim={setDataFim} isOffline={isOffline} equipamentoFiltro={equipamentoFiltro} setEquipamentoFiltro={setEquipamentoFiltro} equipamentosDaFilial={equipamentosDaFilial} gerarExportacao={gerarExportacao} dadosGraficoFiltrados={dadosGraficoFiltrados} isDarkMode={isDarkMode} equipamentoSelecionado={equipamentoSelecionado} ultimasLeiturasRaw={ultimasLeiturasRaw} /> )}
            {!isModuloOculto('historico') && abaAtiva === 'historico' && ( <HistoricoLogs historicoFiltradoLista={historicoFiltradoLista} gerarExportacao={gerarExportacao} /> )}
            {!isModuloOculto('chamados') && abaAtiva === 'chamados' && ( <Chamados userRole={userRole} filialAtiva={filialAtiva} nomeLogado={nomeLogado} chamados={chamados} tecnicosDb={tecnicosDb} equipamentosDaFilial={equipamentosDaFilial} api={api} carregarChamados={carregarChamados} showToast={showToast} isOffline={isOffline} gerarLoteOS={gerarLoteOS} /> )}
            {!isModuloOculto('historico_chamados') && abaAtiva === 'historico_chamados' && ( <HistoricoChamados userRole={userRole} filialAtiva={filialAtiva} nomeLogado={nomeLogado} chamados={chamados} tecnicosDb={tecnicosDb} gerarLoteOS={gerarLoteOS} api={api} carregarChamados={carregarChamados} showToast={showToast} /> )}
            
            {!isModuloOculto('lojas') && abaAtiva === 'lojas' && (userRole === 'ADMIN' || userRole === 'DEV') && ( <GestaoLojas api={api} showToast={showToast} carregarDadosBase={carregarDadosBase} setModalConfig={setModalConfig} /> )}
            {!isModuloOculto('usuarios') && abaAtiva === 'usuarios' && (userRole === 'ADMIN' || userRole === 'DEV') && ( <GestaoUsuarios api={api} showToast={showToast} usuariosLista={usuariosLista} carregarUsuarios={carregarUsuarios} filiaisDb={filiaisDb} setModalConfig={setModalConfig} /> )}
            {!isModuloOculto('parametros') && abaAtiva === 'parametros' && (userRole === 'ADMIN' || userRole === 'DEV') && ( <ParametrosGlobais api={api} showToast={showToast} listaSetores={listaSetores} listaTipos={listaTipos} carregarParametrosGerais={carregarParametrosGerais} carregarDadosBase={carregarDadosBase} setModalConfig={setModalConfig} /> )}
            
            {/* ✅ AS NOVAS TELAS ESTÃO RENDERIZADAS AQUI */}
            {['empresas', 'dev_panel', 'saas', 'billing', 'system', 'soc', 'bi', 'atualizacoes', 'sql_terminal', 'websocket_stream'].includes(abaAtiva) && userRole === 'DEV' && ( 
              <PainelDesenvolvedor 
                api={api}
                socket={socketInstance} 
                abaAtiva={abaAtiva}
                isDevAuthenticated={isDevAuthenticated}
                onAuthenticate={() => { setIsDevAuthenticated(true); sessionStorage.setItem('devAuth', 'true'); }}
                showToast={showToast} 
                sysConfig={sysConfig}
                updateSysConfig={updateSysConfig}
                tocarAlarme={tocarAlarme}
                usuariosLista={usuariosLista}
                filiaisDb={filiaisDb}
                setModalConfig={setModalConfig} 
              /> 
            )}

            {((isModuloOculto(abaAtiva) && !['empresas', 'dev_panel', 'saas', 'billing', 'system', 'soc', 'bi', 'atualizacoes', 'sql_terminal', 'websocket_stream'].includes(abaAtiva)) || (abaAtiva === 'chat' && !isFeatureEnabled('enableChat'))) && (
               <div className="empty-state dashboard-empty anim-fade-in" style={{marginTop: '2rem'}}>
                  <div className="empty-shield-box" style={{ background: 'rgba(239, 68, 68, 0.1)' }}><AlertOctagon size={48} color="var(--danger)" /></div>
                  <h3 className="empty-title" style={{ color: 'var(--danger)' }}>Acesso Restrito</h3>
                  <p className="empty-subtitle">As políticas de governação atuais impedem a visualização deste módulo.</p>
               </div>
            )}
          </ErrorBoundary>
        </div>
      </main>

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