import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ShieldAlert, Database, Cpu, Power, Settings2, Activity, Globe, 
  Server, History, Store, ToggleLeft, ToggleRight, FileOutput, FileText, 
  Send, DollarSign, Building2, ActivitySquare, Terminal, RefreshCw, Mail, 
  ShieldX, Key, UserCheck, LineChart, ShieldCheck, Fingerprint as FingerprintIcon, 
  UserX, MapPin, Clock, PieChart, FileSpreadsheet, Lock, Unlock, CheckCircle2, 
  AlertTriangle, TrendingUp, DownloadCloud, Calendar, Percent, Banknote, 
  Eraser, Network, Copy, Check, AlertOctagon, TerminalSquare, Loader2, 
  ChevronDown, ChevronUp, Receipt, Cloud, HardDrive, Radio, ServerCrash, ZapOff, Sliders, Map as MapIcon, 
  Zap, Flame, AlertCircle, Wifi
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, YAxis, BarChart, Bar, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './PainelDesenvolvedor.css';
import GestaoEmpresas from '../GestaoEmpresas/GestaoEmpresas';

// ============================================================================
// 1. TELA DE BOOT (HACKER SCREEN)
// ============================================================================
const BootScreen = ({ onComplete }) => {
  const [logs, setLogs] = useState([]);
  const [showInput, setShowInput] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => { if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" }); }, [logs, showInput]);

  useEffect(() => {
    let isMounted = true;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const genHex = () => Math.random().toString(16).substring(2, 12).toUpperCase();

    const runBootSequence = async () => {
      const sequence = [
        { text: "TermoSync Enterprise OS [Build 10.5.22621 - Edição TCC]", delay: 100, color: '#94a3b8' },
        { text: "(c) TermoSync Corporation. Centro de Operações de Rede & SysAdmin.", delay: 100, color: '#94a3b8' },
        { text: " ", delay: 100 },
        { text: "Inicializando Processadores Principais...", delay: 200 },
        { text: "CPU: AMD EPYC 9754 Processador de 128-Núcleos @ 3.2GHz", delay: 100 },
        { text: "Memória: 1048576 MB RAM - SECURE ECC VERIFICADO", delay: 50 },
        { text: "Mapeando rede local por dispositivos edge (IoT)...", delay: 300 }
      ];

      for (let i = 0; i < 8; i++) {
        sequence.push({ text: `[${(Math.random() * 2).toFixed(4)}] Node [MAC: A4:CF:12:${genHex().substring(0,2)}:${genHex().substring(0,2)}:${genHex().substring(0,2)}] Handshake... OK`, delay: 20 + Math.random() * 30, color: '#475569' });
      }

      sequence.push(
        { text: "[  OK  ] Watchdogs de hardware acionados.", delay: 150 },
        { text: "Estabelecendo uplink WSS seguro para o cluster master... [ 104.28.192.12 ]", delay: 250 },
        { text: "[  OK  ] Uplink estabelecido. Túnel TLS 1.3 criptografado.", delay: 100, color: '#10b981' },
        { text: "Montando Volumes MySQL Multi-Tenant...", delay: 200 },
        { text: "Descriptografando tokens de acesso master (AES-256): [████████████████████] 100%", delay: 350 },
        { text: "Iniciando daemons do Network Operations Center (NOC)...", delay: 200 },
        { text: "[ AVISO ] MODO SUPERVISOR ATIVADO.", delay: 400, color: '#eab308', isBold: true },
        { text: "[ AVISO ] IDS INICIANDO PROTOCOLO ZERO-TRUST.", delay: 300, color: '#ef4444', isBold: true },
        { text: "SISTEMA RESTRITO. IDENTIFICAÇÃO ROOT NECESSÁRIA.", delay: 150, color: '#cbd5e1', isBold: true }
      );

      for (let i = 0; i < sequence.length; i++) {
        if (!isMounted) return;
        await sleep(sequence[i].delay);
        setLogs(prev => [...prev, sequence[i]]);
      }
      if (isMounted) setShowInput(true);
    };

    runBootSequence();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => { if (showInput && inputRef.current && !isProcessing) inputRef.current.focus(); }, [showInput, isProcessing]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!passcode.trim() || isProcessing) return;
    setIsProcessing(true);
    setShowInput(false);
    
    const typed = passcode;
    setPasscode('');
    setLogs(prev => [...prev, { text: `root@termosync:~$ ${typed.replace(/./g, '*')}`, color: '#10b981' }]);
    
    await new Promise(r => setTimeout(r, 400));
    setLogs(prev => [...prev, { text: "Verificando assinatura criptográfica...", color: '#94a3b8' }]);
    
    await new Promise(r => setTimeout(r, 600));
    
    if (typed.toLowerCase() === 'root') {
      setLogs(prev => [...prev, { text: "Hash [0x9A4B...21F] -> CORRESPONDÊNCIA", color: '#10b981' }]);
      await new Promise(r => setTimeout(r, 300));
      setLogs(prev => [...prev, { text: "[  OK  ] AUTENTICAÇÃO BEM-SUCEDIDA.", color: '#10b981', isBold: true }]);
      setLogs(prev => [...prev, { text: "Desbloqueando módulos SaaS e elevando privilégios...", color: '#94a3b8' }]);
      await new Promise(r => setTimeout(r, 800));
      onComplete();
    } else {
      setLogs(prev => [...prev, { text: "Hash [0x9A4B...21F] -> INCOMPATÍVEL", color: '#ef4444' }]);
      await new Promise(r => setTimeout(r, 300));
      setLogs(prev => [...prev, { text: "[ FALHA ] ACESSO NEGADO. INCIDENTE REGISTRADO NO SOC.", color: '#ef4444', isBold: true }]);
      await new Promise(r => setTimeout(r, 500));
      setShowInput(true);
      setIsProcessing(false);
    }
  };

  return (
    <div className="root-boot-screen" onClick={() => { if (showInput) inputRef.current?.focus(); }}>
      <div className="boot-terminal-box crt-terminal">
        {logs.map((log, index) => (
          <div key={index} className="boot-log" style={{ color: log.color || '#cbd5e1', fontWeight: log.isBold ? 'bold' : 'normal', textShadow: log.color === '#10b981' ? '0 0 5px rgba(16,185,129,0.3)' : 'none' }}>
            {log.text}
          </div>
        ))}
        {showInput && (
          <form onSubmit={handleAuth} className="boot-form">
            <span className="boot-prompt">root@termosync:~$</span>
            <div className="boot-input-wrapper">
              <input ref={inputRef} type="password" value={passcode} onChange={e => setPasscode(e.target.value)} className="boot-input" autoComplete="off" disabled={isProcessing} />
              <span className="boot-cursor-blink"></span>
            </div>
          </form>
        )}
        <div ref={bottomRef} style={{ paddingBottom: '20px' }} />
      </div>
    </div>
  );
};

// ============================================================================
// 2. PAINEL PRINCIPAL (OS)
// ============================================================================
export default function PainelDesenvolvedor({ api, abaAtiva, isDevAuthenticated, onAuthenticate, showToast, sysConfig, updateSysConfig, tocarAlarme, usuariosLista, filiaisDb, setModalConfig }) {
  const [terminalLogs, setTerminalLogs] = useState([]);
  
  const addLog = useCallback((text, status = 'info') => { 
    setTerminalLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text, status }]); 
  }, []);

  if (!isDevAuthenticated) {
    return <BootScreen onComplete={() => { onAuthenticate(); addLog("Sessão Master estabelecida. SysAdmin conectado.", "success"); }} />;
  }

  return (
    <div className={`dev-os-container anim-fade-in ${sysConfig?.maintenanceMode ? 'lockdown-mode' : ''}`}>
      {abaAtiva === 'dev_panel' && <div className="noc-scanlines"></div>}
      {abaAtiva === 'dev_panel' && <div className="noc-cyber-grid"></div>}

      {sysConfig?.maintenanceMode && (
        <div className="maintenance-banner">
          <AlertOctagon size={18} className="pulse-icon" /> SISTEMA EM MODO DE MANUTENÇÃO (OFFLINE) <AlertOctagon size={18} className="pulse-icon" />
        </div>
      )}
      <div className="dev-os-workspace">
        <div className="dev-os-content">
          {abaAtiva === 'empresas' && <GestaoEmpresas api={api} showToast={showToast} setModalConfig={setModalConfig} />}
          {abaAtiva === 'dev_panel' && <TelaNOC api={api} showToast={showToast} sysConfig={sysConfig} updateSysConfig={updateSysConfig} tocarAlarme={tocarAlarme} usuariosLista={usuariosLista} addLog={addLog} setModalConfig={setModalConfig} />}
          {abaAtiva === 'saas' && <TelaSaaS api={api} sysConfig={sysConfig} updateSysConfig={updateSysConfig} filiaisDb={filiaisDb} showToast={showToast} addLog={addLog} setModalConfig={setModalConfig} />}
          {abaAtiva === 'billing' && <TelaBilling sysConfig={sysConfig} filiaisDb={filiaisDb} showToast={showToast} addLog={addLog} updateSysConfig={updateSysConfig} setModalConfig={setModalConfig} />}
          {abaAtiva === 'system' && <TelaSistema api={api} showToast={showToast} addLog={addLog} sysConfig={sysConfig} updateSysConfig={updateSysConfig} setModalConfig={setModalConfig} />}
          {abaAtiva === 'soc' && <TelaSOC api={api} showToast={showToast} addLog={addLog} setModalConfig={setModalConfig} />}
          {abaAtiva === 'bi' && <TelaBI api={api} showToast={showToast} addLog={addLog} sysConfig={sysConfig} filiaisDb={filiaisDb} setModalConfig={setModalConfig} />}
        </div>
        <TerminalFooter logs={terminalLogs} setLogs={setTerminalLogs} addLog={addLog} sysConfig={sysConfig} />
      </div>
    </div>
  );
}

// ============================================================================
// 3. TELA NOC (CYBER COMMAND V8)
// ============================================================================
const TelaNOC = ({ api, showToast, sysConfig, updateSysConfig, usuariosLista, addLog }) => {
  const [scopeType, setScopeType] = useState('ROLE');
  const [activeScope, setActiveScope] = useState('GLOBAL');
  
  const [metrics, setMetrics] = useState({ cpu: 12, ram: 42, ping: 14, reqs: 342, dbQps: 154, bandwidth: 24.5 });
  const [metricHistory, setMetricHistory] = useState(Array.from({ length: 20 }, () => ({ time: '', cpu: 0, ram: 0, bw: 0, db: 0 })));
  
  const [apiTraffic, setApiTraffic] = useState([]);
  const [threats, setThreats] = useState([]);
  const [incidents, setIncidents] = useState([]); 
  const [latencyData, setLatencyData] = useState([]); 
  
  const [clusterNodes, setClusterNodes] = useState([
    { id: 1, name: 'sa-east-1a (Master)', role: 'BD Primário & Nó', status: 'online', ping: 12 },
    { id: 2, name: 'sa-east-1b (Replica)', role: 'Réplica de Leitura', status: 'online', ping: 14 },
    { id: 3, name: 'us-east-1 (Failover)', role: 'Recuperação de Desastres', status: 'standby', ping: 118 }
  ]);

  const [heatGrid, setHeatGrid] = useState(Array.from({length: 100}, () => Math.floor(Math.random() * 2)));
  const [actionLoading, setActionLoading] = useState(null);

  const trafficContainerRef = useRef(null);
  const wafContainerRef = useRef(null);
  const incidentsContainerRef = useRef(null);
  
  const [uptimeStr, setUptimeStr] = useState('--:--:--');
  const [serverStartTime, setServerStartTime] = useState(null);

  const locs = ['SP, BR', 'FRA, DE', 'ASH, US', 'TOK, JP', 'LON, UK', 'SYD, AU'];

  useEffect(() => {
    let isMounted = true;
    const fetchRealUptime = async () => {
      try {
        const res = await api.get('/system/health');
        if (isMounted && res.data && res.data.uptime !== undefined) {
          setServerStartTime(Date.now() - (res.data.uptime * 1000));
        }
      } catch (e) {
        if (isMounted) setUptimeStr('OFFLINE');
      }
    };
    fetchRealUptime();
    const syncInterval = setInterval(fetchRealUptime, 30000);
    return () => { isMounted = false; clearInterval(syncInterval); };
  }, [api]);

  useEffect(() => {
    if (!serverStartTime) return;
    const iUptime = setInterval(() => {
      const diff = Math.floor((Date.now() - serverStartTime) / 1000);
      const d = Math.floor(diff / 86400);
      const h = String(Math.floor((diff % 86400) / 3600)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      if (d > 0) setUptimeStr(`${d}d ${h}:${m}:${s}`);
      else setUptimeStr(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(iUptime);
  }, [serverStartTime]);

  useEffect(() => {
    const i1 = setInterval(() => {
      if(sysConfig.maintenanceMode) {
        setMetrics({ cpu: 1, ram: 15, ping: 5, reqs: 0, dbQps: 0, bandwidth: 0 });
        setMetricHistory(prev => [...prev.slice(1), { time: new Date().toLocaleTimeString('pt-BR', { second: '2-digit' }), cpu: 1, ram: 15, bw: 0, db: 0 }]);
        setHeatGrid(prev => [...prev.slice(1), 0]);
        setLatencyData([]);
        return;
      }
      const newCpu = Math.floor(Math.random() * 20) + 15;
      const newRam = Math.floor(Math.random() * 10) + 60;
      const newReqs = Math.floor(Math.random() * 150) + 400;
      const newDb = Math.floor(Math.random() * 50) + 100;
      const newBw = (Math.random() * 10 + 15).toFixed(1);
      
      setMetrics({ cpu: newCpu, ram: newRam, ping: Math.floor(Math.random() * 8) + 10, reqs: newReqs, dbQps: newDb, bandwidth: newBw });
      setMetricHistory(prev => [...prev.slice(1), { time: new Date().toLocaleTimeString('pt-BR', { second: '2-digit' }), cpu: newCpu, ram: newRam, bw: newBw, db: newDb }]);
      
      setClusterNodes(prev => prev.map(n => ({ ...n, ping: n.status === 'standby' ? Math.floor(Math.random() * 20) + 110 : Math.floor(Math.random() * 10) + 5 })));
      setHeatGrid(prev => [...prev.slice(1), Math.floor(Math.random() * 5)]);

      setLatencyData([
        { range: '10ms', count: Math.floor(Math.random() * 200) + 300 },
        { range: '50ms', count: Math.floor(Math.random() * 100) + 150 },
        { range: '100ms', count: Math.floor(Math.random() * 50) + 50 },
        { range: '200ms', count: Math.floor(Math.random() * 20) + 10 },
        { range: '500ms+', count: Math.floor(Math.random() * 5) }
      ]);
    }, 2000);

    const i2 = setInterval(() => {
      if(sysConfig.maintenanceMode) return;
      const rotas = [
        { method: 'MQTT', route: 'telemetry/esp32/temp_hum', color: '#10b981', status: 'ACK' }, 
        { method: 'POST', route: '/api/v1/auth/verify', color: '#f59e0b', status: '201 OK' }, 
        { method: 'WSS', route: '/ws/stream/events', color: '#a855f7', status: '101 SW' }, 
        { method: 'GET', route: '/api/v1/sys/health', color: '#38bdf8', status: '304 CA' }
      ];
      const r = rotas[Math.floor(Math.random() * rotas.length)];
      const geo = locs[Math.floor(Math.random() * locs.length)];
      setApiTraffic(prev => [...prev.slice(-40), { id: Date.now() + Math.random(), method: r.method, color: r.color, route: r.route, status: r.status, geo, ip: `192.168.${Math.floor(Math.random()*10)}.${Math.floor(Math.random() * 255)}`, ms: Math.floor(Math.random() * 40)+5 }]);
    }, 250);

    const i3 = setInterval(() => {
      if(sysConfig.maintenanceMode) return;
      const ataques = ['TENTATIVA_INJEÇÃO_SQL', 'DDOS_SYN_FLOOD', 'BRUTE_FORCE_JWT', 'PATH_TRAVERSAL'];
      const ips = [`45.33.${Math.floor(Math.random() * 255)}.12`, `188.166.${Math.floor(Math.random() * 255)}.55`, `104.28.${Math.floor(Math.random() * 255)}.1`];
      const geo = locs[Math.floor(Math.random() * locs.length)];
      const atk = `[BLOQUEIO IDS] ASSINATURA: ${ataques[Math.floor(Math.random() * ataques.length)]} -> PACOTE DESCARTADO de ${ips[Math.floor(Math.random() * ips.length)]} (${geo})`;
      setThreats(prev => [...prev.slice(-20), { id: Date.now(), text: atk }]);
    }, 3500);

    const i4 = setInterval(() => {
      if(sysConfig.maintenanceMode) return;
      if (Math.random() > 0.6) {
        const errors = [
          { msg: 'Aviso: Sobrecarga temporária na API conectora.', type: 'warning' },
          { msg: 'Crítico: Latência do Cluster MySQL Master > 200ms.', type: 'critical' },
          { msg: 'Aviso: Memória Cache Redis atingindo 85% de capacidade.', type: 'warning' },
          { msg: 'Nó Edge [Filial SP] não envia Heartbeat há 2 min.', type: 'warning' },
          { msg: 'Queda de comunicação com Broker MQTT. Tentando reconectar.', type: 'critical' }
        ];
        const err = errors[Math.floor(Math.random() * errors.length)];
        setIncidents(prev => [...prev.slice(-15), { id: Date.now(), ...err, time: new Date().toLocaleTimeString('pt-BR', { second: '2-digit', minute: '2-digit', hour: '2-digit' }) }]);
      }
    }, 5000);

    return () => { clearInterval(i1); clearInterval(i2); clearInterval(i3); clearInterval(i4); };
  }, [sysConfig.maintenanceMode]);

  useEffect(() => { if (trafficContainerRef.current) trafficContainerRef.current.scrollTop = trafficContainerRef.current.scrollHeight; }, [apiTraffic]);
  useEffect(() => { if (wafContainerRef.current) wafContainerRef.current.scrollTop = wafContainerRef.current.scrollHeight; }, [threats]);
  useEffect(() => { if (incidentsContainerRef.current) incidentsContainerRef.current.scrollTop = incidentsContainerRef.current.scrollHeight; }, [incidents]);
  useEffect(() => { if (scopeType === 'ROLE') setActiveScope('GLOBAL'); else setActiveScope(usuariosLista?.[0]?.usuario || ''); }, [scopeType, usuariosLista]);

  const regrasAtivas = (scopeType === 'USER' ? sysConfig?.regras?.USERS?.[activeScope] : sysConfig?.regras?.[activeScope]) || { modulosOcultos: [], features: {} };
  const handleToggleModulo = (id) => { updateSysConfig(scopeType, activeScope, 'modulosOcultos', id); addLog(`[MATRIZ_UI] Módulo '${id}' reconfigurado.`, 'warning'); };
  const handleToggleFeature = (key) => { updateSysConfig(scopeType, activeScope, 'features', key, !(regrasAtivas?.features?.[key] ?? true)); addLog(`[FLAG_API] Política '${key}' alterada.`, 'warning'); };

  const executarAcaoEmergencia = (acao) => {
    setActionLoading(acao);
    addLog(`[EMERGÊNCIA] Protocolo acionado: ${acao}`, 'error');
    setTimeout(() => {
      setActionLoading(null);
      showToast(`Protocolo ${acao} executado.`, 'success');
      addLog(`[SISTEMA] Comando '${acao}' finalizado com sucesso.`, 'success');
      if (acao === 'LIMPAR CACHE REDIS') setIncidents([]);
    }, 2000);
  };

  const TODOS_MODULOS = [
    { id: 'dashboard', nome: 'Dashboard Operacional' }, { id: 'mapa', nome: 'Planta Digital (Heatmap)' }, 
    { id: 'motores', nome: 'Monitoramento Térmico' }, { id: 'umidade', nome: 'Monitoramento de Umidade' },
    { id: 'kanban', nome: 'Gestão Ágil (Kanban)' }, { id: 'metrologia', nome: 'Controle Metrológico' }, 
    { id: 'equipamentos', nome: 'Máquinas (Hardware IoT)' }, { id: 'chamados', nome: 'Gestão de Incidentes' }, 
    { id: 'relatorios', nome: 'Relatórios Executivos' }, { id: 'historico', nome: 'Auditoria de Logs' }, 
    { id: 'lojas', nome: 'Gestão de Lojas' }, { id: 'usuarios', nome: 'Identidades e Acessos' },
    { id: 'simulador', nome: 'Simulador Edge' }
  ];

  const defconLevel = threats.length > 15 ? 'CRÍTICO' : (threats.length > 8 ? 'ELEVADO' : 'SEGURO');
  const defconColor = defconLevel === 'CRÍTICO' ? '#ef4444' : (defconLevel === 'ELEVADO' ? '#f59e0b' : '#10b981');

  const RenderSparkline = ({ dataKey, color }) => (
    <div className="sparkline-box">
      <ResponsiveContainer width="100%" height="100%" minHeight={40}>
        <AreaChart data={metricHistory}>
          <defs><linearGradient id={`color_${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.6}/><stop offset="95%" stopColor={color} stopOpacity={0}/></linearGradient></defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#color_${dataKey})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="noc-dashboard-wrapper dev-tela-scroll">
      
      {/* GLOBAL DEFCON BAR */}
      <div className="noc-defcon-bar anim-stagger-1" style={{ '--theme-color': defconColor }}>
        <div className="defcon-title">
          <Globe size={18} color={defconColor} /> TERMOSYNC COMMAND CENTER
        </div>
        <div className="defcon-status-group">
          <div className="defcon-badge" style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}><Wifi size={14} /> CLUSTER: ONLINE</div>
          <div className="defcon-badge" style={{ color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)' }}><Server size={14} /> NÓS ATIVOS: {clusterNodes.length}</div>
          <div className="defcon-badge" style={{ color: defconColor, borderColor: defconColor, boxShadow: `0 0 10px rgba(${defconColor === '#ef4444' ? '239,68,68' : '245,158,11'}, 0.3)` }}><ShieldAlert size={14} /> DEFCON: {defconLevel}</div>
        </div>
      </div>

      <div className="noc-hud-grid anim-stagger-1">
        <div className="noc-hud-card" style={{'--card-color': '#10b981'}}>
           <div className="noc-mini-header">
             <span className="noc-kpi-title"><Cpu size={14}/> USO DE CPU</span>
             <span className="noc-kpi-trend up-good">+1.2% ▲</span>
           </div>
           <div className="noc-kpi-value">{metrics.cpu}<span className="noc-kpi-unit">%</span></div>
           <RenderSparkline dataKey="cpu" color="#10b981" />
        </div>
        <div className="noc-hud-card" style={{'--card-color': '#f59e0b'}}>
           <div className="noc-mini-header">
             <span className="noc-kpi-title"><HardDrive size={14}/> MEMÓRIA (RAM)</span>
             <span className="noc-kpi-trend up-bad">+5.4% ▲</span>
           </div>
           <div className="noc-kpi-value" style={{color: '#f59e0b'}}>{metrics.ram}<span className="noc-kpi-unit">%</span></div>
           <RenderSparkline dataKey="ram" color="#f59e0b" />
        </div>
        <div className="noc-hud-card" style={{'--card-color': '#38bdf8'}}>
           <div className="noc-mini-header">
             <span className="noc-kpi-title"><Globe size={14}/> TRÁFEGO</span>
             <span className="noc-kpi-trend down-good">-0.8% ▼</span>
           </div>
           <div className="noc-kpi-value" style={{color: '#38bdf8'}}>{metrics.bandwidth}<span className="noc-kpi-unit">Mb/s</span></div>
           <RenderSparkline dataKey="bw" color="#38bdf8" />
        </div>
        <div className="noc-hud-card" style={{'--card-color': '#a855f7'}}>
           <div className="noc-mini-header">
             <span className="noc-kpi-title"><Database size={14}/> QUERIES DB</span>
             <span className="noc-kpi-trend up-good">+12% ▲</span>
           </div>
           <div className="noc-kpi-value" style={{color: '#a855f7'}}>{metrics.dbQps}<span className="noc-kpi-unit">QPS</span></div>
           <RenderSparkline dataKey="db" color="#a855f7" />
        </div>
        <div className="noc-hud-card" style={{'--card-color': '#ef4444'}}>
           <div className="noc-mini-header" style={{flexDirection: 'column', alignItems: 'center', margin: 'auto', gap: '8px'}}>
             <span className="noc-kpi-title" style={{justifyContent: 'center'}}><Radio size={14}/> UPTIME CORE</span>
             <span className="noc-kpi-value" style={{justifyContent: 'center', fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', color: '#ef4444', margin: 'auto 0'}}>{uptimeStr}</span>
           </div>
        </div>
      </div>

      <div className="noc-main-grid anim-stagger-2">
        <div className="cyber-panel" style={{ '--theme-color': '#38bdf8' }}>
          <div className="cyber-panel-header">
             <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
               <span className={sysConfig.maintenanceMode ? '' : 'traffic-indicator-live'} style={{background: '#38bdf8', boxShadow: '0 0 5px #38bdf8'}}></span>
               Osciloscópio de Rede & Latência
             </div>
             <span style={{fontSize: '0.8rem', color: '#10b981', fontWeight: '900', fontFamily: 'JetBrains Mono', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.3)'}}>{sysConfig.maintenanceMode ? '0' : metrics.reqs} REQ/s</span>
          </div>
          
          <div className="noc-chart-grid">
            <div className="noc-chart-box">
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <AreaChart data={metricHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCpuBig" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorRamBig" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <YAxis tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0', color: 'white', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="cpu" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCpuBig)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="ram" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorRamBig)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="noc-histogram-box">
               <span style={{fontSize: '0.65rem', fontWeight: 'bold', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px'}}>Distribuição de Latência (API)</span>
               <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <BarChart data={latencyData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="range" tick={{fontSize: 9, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 9, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {latencyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index > 2 ? '#ef4444' : '#38bdf8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="cyber-panel" style={{ '--theme-color': '#10b981' }}>
          <div className="cyber-panel-header" style={{ color: '#10b981' }}>
            <div style={{display:'flex', gap:'8px', alignItems:'center'}}><Network size={18} /> Topologia & Telemetria</div>
          </div>
          <div className="cluster-topology-grid">
            {clusterNodes.map(node => (
              <div key={node.id} className="cluster-data-block" style={{'--status-color': node.status === 'online' ? '#10b981' : '#f59e0b'}}>
                <div className="block-header">
                  <span className="block-name"><Server size={14} color="var(--status-color)"/> {node.name}</span>
                  <span className="block-ping">{node.ping}ms</span>
                </div>
                <span className="block-role" style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{node.role}</span>
                <div className="block-activity" style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <span className="rx-tx" style={{color: '#38bdf8', fontSize: '0.7rem', fontWeight: 'bold'}}>Rx {Math.floor(Math.random()*100)}</span>
                  <span className="rx-tx" style={{color: '#a855f7', fontSize: '0.7rem', fontWeight: 'bold'}}>Tx {Math.floor(Math.random()*100)}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)'}}>
            <span style={{fontSize: '0.65rem', fontWeight: 'bold', color: '#10b981', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '1px'}}>Densidade de Pacotes IoT (MQTT)</span>
            <div className="heatmap-grid">
              {heatGrid.map((val, idx) => (
                <div key={idx} className={`heatmap-cell heat-${val}`}></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="noc-terminals-grid anim-stagger-3">
        
        <div className="cyber-terminal">
          <div className="cyber-terminal-header">
            <div className="cyber-terminal-title">BASH - ROTEAMENTO (LIVE)</div>
          </div>
          <div className="terminal-scroll" ref={trafficContainerRef}>
            {sysConfig.maintenanceMode ? (
               <div style={{color: 'var(--text-muted)', textAlign: 'center', margin: 'auto', fontStyle: 'italic'}}>Rotas BGP Suspensas</div>
            ) : (
              apiTraffic.map((pkt) => (
                <div key={pkt.id} className="terminal-line">
                  <span className="log-method" style={{color: pkt.color}}>{pkt.method}</span> 
                  <span className="log-geo">[{pkt.geo}]</span>
                  <span className="log-route text-truncate">{pkt.route}</span> 
                  <span className="log-ms">{pkt.ms}ms</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="cyber-terminal" style={{borderColor: 'rgba(245, 158, 11, 0.4)', boxShadow: 'inset 0 0 30px rgba(245, 158, 11, 0.1)'}}>
          <div className="cyber-terminal-header" style={{borderBottomColor: 'rgba(245, 158, 11, 0.4)'}}>
            <div className="cyber-terminal-title" style={{color: '#f59e0b'}}><AlertCircle size={14} /> ALERTAS ATIVOS</div>
          </div>
          <div className="terminal-scroll" ref={incidentsContainerRef}>
            {incidents.length === 0 ? (
               <div style={{color: '#10b981', textAlign: 'center', margin: 'auto', fontWeight: 'bold', fontSize: '0.8rem'}}>Nenhum incidente crítico no momento.</div>
            ) : (
              incidents.map((inc) => (
                <div key={inc.id} className={`incident-card ${inc.type}`}>
                  <div className="incident-header"><span>{inc.time}</span><span>{inc.type === 'critical' ? 'CRÍTICO' : 'AVISO'}</span></div>
                  <div className="incident-desc">{inc.msg}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="cyber-terminal" style={{borderColor: defconLevel === 'CRÍTICO' ? '#ef4444' : 'rgba(239, 68, 68, 0.4)', boxShadow: defconLevel === 'CRÍTICO' ? 'inset 0 0 50px rgba(239,68,68,0.3)' : 'inset 0 0 30px rgba(0,0,0,0.8)'}}>
          <div className="cyber-terminal-header" style={{borderBottomColor: 'rgba(239, 68, 68, 0.4)'}}>
            <div className="cyber-terminal-title" style={{color: '#ef4444', display: 'flex', justifyContent: 'space-between', width: '100%'}}>
              <span>LOGS SEGURANÇA WAF</span>
              <span className="defcon-badge" style={{background: `rgba(${defconColor === '#ef4444' ? '239,68,68' : (defconColor==='#f59e0b'?'245,158,11':'16,185,129')}, 0.2)`, color: defconColor, border: `1px solid ${defconColor}`}}>NÍVEL: {defconLevel}</span>
            </div>
          </div>
          <div className="terminal-scroll" ref={wafContainerRef} style={{ color: '#ef4444' }}>
            {threats.map((pkt) => <div key={pkt.id} className="terminal-line log-error"><span style={{ marginRight: '4px' }}>✖</span> {pkt.text}</div>)}
          </div>
        </div>
      </div>

      <div className="switchboard-grid anim-stagger-3">
        
        <div className="switch-panel">
          <div className="switch-panel-title" style={{color: '#38bdf8'}}><ShieldCheck size={14}/> GESTÃO DE IDENTIDADE (IAM)</div>
          <div className="scope-types">
            <button className={scopeType === 'ROLE' ? 'active' : ''} onClick={() => setScopeType('ROLE')}>POR CARGO</button>
            <button className={scopeType === 'USER' ? 'active' : ''} onClick={() => setScopeType('USER')}>POR USUÁRIO</button>
          </div>
          <div className="scope-targets" style={{marginTop: 'auto'}}>
            {scopeType === 'ROLE' && (
              <div className="scope-tabs">
                <button className={activeScope === 'GLOBAL' ? 'active' : ''} onClick={() => setActiveScope('GLOBAL')}>Global</button>
                <button className={activeScope === 'ADMIN' ? 'active' : ''} onClick={() => setActiveScope('ADMIN')}>Admins</button>
                <button className={activeScope === 'LOJA' ? 'active' : ''} onClick={() => setActiveScope('LOJA')}>Lojistas</button>
                <button className={activeScope === 'MANUTENCAO' ? 'active' : ''} onClick={() => setActiveScope('MANUTENCAO')}>Técnicos</button>
              </div>
            )}
            {scopeType === 'USER' && (
              <select value={activeScope} onChange={e => setActiveScope(e.target.value)} className="dev-select-input">
                {usuariosLista?.map((u, i) => <option key={i} value={u.usuario}>{u.nome_tecnico || u.nome_gerente || u.usuario} ({u.role})</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="switch-panel">
          <div className="switch-panel-title" style={{color: '#10b981'}}>
            <div style={{display:'flex', gap:'6px'}}><Settings2 size={14}/> MATRIZ DE UI</div>
            <span className="status-badge" style={{background: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px 6px', fontSize: '0.65rem'}}>{TODOS_MODULOS.length - (regrasAtivas?.modulosOcultos?.length || 0)}/{TODOS_MODULOS.length}</span>
          </div>
          <div className="modulos-list">
            {TODOS_MODULOS.map(m => {
              const isAtivo = !regrasAtivas?.modulosOcultos?.includes(m.id);
              return (
                <div key={m.id} className={`hardware-toggle ${!isAtivo ? 'disabled' : ''}`}>
                  <span>{m.nome}</span>
                  <button className={`btn-toggle-ui ${isAtivo ? 'on' : 'off'}`} onClick={() => handleToggleModulo(m.id)}>{isAtivo ? 'ON' : 'OFF'}</button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="switch-panel">
          <div className="switch-panel-title" style={{color: '#f59e0b'}}><Sliders size={14}/> SINALIZADORES DE API</div>
          <div className="feature-flags-list">
            {['Permitir Exportações', 'Ativar Alertas de Áudio', 'Fluxo de Telemetria', 'Habilitar Chat', 'Forçar Modo Escuro'].map(f => {
              const ativo = regrasAtivas?.features?.[f] ?? (f !== 'Forçar Modo Escuro');
              return (
                <div key={f} className="hardware-toggle" onClick={() => handleToggleFeature(f)} style={{cursor: 'pointer'}}>
                  <span>{f}</span> {ativo ? <ToggleRight size={20} color="var(--success)" /> : <ToggleLeft size={20} color="var(--text-muted)" />}
                </div>
              );
            })}
            <div className="hardware-toggle" onClick={() => { addLog('[NOC] Regras BGP / Geofencing atualizadas.', 'warning'); showToast('Filtro de IP Regional aplicado.', 'info'); }} style={{cursor: 'pointer'}}>
              <span style={{ color: '#38bdf8' }}><Globe size={14} style={{marginRight: '6px', verticalAlign: 'middle'}}/> IP Geofencing</span> <ToggleLeft size={20} color="var(--text-muted)" />
            </div>
          </div>
        </div>
        
        <div className="switch-panel">
          <div className="switch-panel-title" style={{color: '#ef4444'}}><Flame size={14}/> PROTOCOLOS DE EMERGÊNCIA</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center', height: '100%'}}>
            <button className="btn-emergency warning" onClick={() => executarAcaoEmergencia('LIMPAR CACHE REDIS')} disabled={actionLoading !== null || sysConfig.maintenanceMode}>
               {actionLoading === 'LIMPAR CACHE REDIS' ? <Loader2 size={16} className="spin"/> : <RefreshCw size={16}/>} 
               {actionLoading === 'LIMPAR CACHE REDIS' ? 'EXECUTANDO...' : 'LIMPAR CACHE REDIS'}
            </button>
            <button className="btn-emergency" onClick={() => executarAcaoEmergencia('FORÇAR FAILOVER BGP')} disabled={actionLoading !== null || sysConfig.maintenanceMode}>
               {actionLoading === 'FORÇAR FAILOVER BGP' ? <Loader2 size={16} className="spin"/> : <Network size={16}/>} 
               {actionLoading === 'FORÇAR FAILOVER BGP' ? 'REDIRECIONANDO...' : 'FORÇAR FAILOVER BGP'}
            </button>
            <button className="btn-emergency" onClick={() => executarAcaoEmergencia('REINICIAR PODS DOCKER')} disabled={actionLoading !== null || sysConfig.maintenanceMode}>
               {actionLoading === 'REINICIAR PODS DOCKER' ? <Loader2 size={16} className="spin"/> : <ServerCrash size={16}/>} 
               {actionLoading === 'REINICIAR PODS DOCKER' ? 'REINICIANDO NÓS...' : 'REINICIAR PODS DOCKER'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

// ============================================================================
// 4. TELA DE CONTROLE DO SISTEMA
// ============================================================================
const TelaSistema = ({ api, showToast, addLog, sysConfig, updateSysConfig, setModalConfig }) => {
  const [globalBanner, setGlobalBanner] = useState(sysConfig?.regras?.GLOBAL?.features?.globalBanner || '');
  const [isExporting, setIsExporting] = useState(null);
  const [isPurging, setIsPurging] = useState(false);
  const [storageUsed, setStorageUsed] = useState(87);

  const handleMaintenance = () => { 
    const novoEstado = !sysConfig.maintenanceMode; 
    setModalConfig({
      isOpen: true,
      title: novoEstado ? 'Ativar Lockdown de Segurança' : 'Retomar Operações',
      message: novoEstado 
        ? 'Deseja bloquear todas as operações de telemetria e colocar o sistema em modo Offline? Novos dados IoT serão descartados.' 
        : 'Deseja retomar as operações normais e reabrir o fluxo de dados dos nós Edge?',
      onConfirm: () => {
        updateSysConfig('ROLE', 'GLOBAL', 'maintenanceMode', null, novoEstado); 
        addLog(`Status da API alterado para: ${novoEstado ? 'OFFLINE' : 'ONLINE'}`, novoEstado ? 'error' : 'success');
        showToast(novoEstado ? 'Sistema em modo Offline.' : 'Sistema operacional liberado.', novoEstado ? 'warning' : 'success');
      }
    });
  };

  const handlePurge = () => {
    setModalConfig({
      isOpen: true,
      title: 'Limpeza de Dados (Purge)',
      message: 'Você tem certeza de que deseja apagar permanentemente todos os registros de telemetria com mais de 90 dias do banco de dados MySQL? Esta ação liberará armazenamento mas não pode ser desfeita.',
      onConfirm: async () => {
        setIsPurging(true);
        try {
          const res = await api.post('/system/purge', { dias: 90 });
          showToast(`Registros antigos apagados com sucesso.`, 'success');
          addLog(`[DB] Exclusão executada: ${res.data?.deleted || 0} linhas removidas do cluster MySQL.`, 'warning');
          setStorageUsed(12);
        } catch (e) { showToast('Falha na exclusão.', 'error'); }
        setIsPurging(false);
      }
    });
  };

  const exportarTabelaReal = async (nomeTabela) => {
    setIsExporting(nomeTabela);
    addLog(`[DB] Iniciando extração estruturada da tabela: ${nomeTabela}...`, 'info');
    showToast(`Buscando ${nomeTabela} no banco de dados...`, 'info');
    
    try {
      const res = await api.post('/system/exportar-tabela', { tabela: nomeTabela });
      const { dados } = res.data;
      if (!dados || dados.length === 0) {
        setIsExporting(null);
        return showToast('A tabela encontra-se vazia.', 'warning');
      }
      
      const cabecalhos = Object.keys(dados[0]).join(',');
      const linhas = dados.map(linha => Object.values(linha).map(valor => valor === null ? '""' : `"${String(valor).replace(/"/g, '""')}"`).join(',')).join('\n');
      const csvContent = `${cabecalhos}\n${linhas}`;
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Dump_${nomeTabela.toUpperCase()}_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast(`Download de ${nomeTabela} concluído!`, 'success');
      addLog(`[DB] Dump de ${nomeTabela} extraído para CSV.`, 'success');
    } catch (erro) {
      showToast('Falha ao acessar o banco de dados.', 'error');
      addLog(`[DB ERR] Conexão recusada ao tentar extrair ${nomeTabela}.`, 'error');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="dev-tela-scroll">
      <div className="dev-grid-main">
        
        <div className="dev-col-left">
          <div className="sys-control-card warning">
            {sysConfig.maintenanceMode && <div className="hazard-stripes"></div>}
            
            <div className="dev-card-header" style={{color: '#f59e0b', flexWrap: 'wrap'}}>
              <Radio size={24}/><h3>Controle de Operações Globais</h3>
            </div>
            
            <div style={{position: 'relative', zIndex: 2}}>
              
              <div className={`sys-status-banner ${sysConfig.maintenanceMode ? 'sys-status-offline' : 'sys-status-online'}`}>
                {sysConfig.maintenanceMode ? <AlertOctagon size={20} /> : <ShieldCheck size={20} />}
                STATUS CORE: {sysConfig.maintenanceMode ? 'LOCKDOWN (OFFLINE)' : 'OPERACIONAL (ONLINE)'}
              </div>

              <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '10px', fontWeight: 'bold'}}>Transmissão Global (Broadcast Tático):</p>
              
              <textarea 
                className="transmit-box" 
                value={globalBanner}
                onChange={e => setGlobalBanner(e.target.value)}
                placeholder="> INSERIR DIRETIVA GLOBAL AQUI_"
                spellCheck="false"
              />
              
              <button className="btn btn-primary w-100" onClick={() => { updateSysConfig('ROLE', 'GLOBAL', 'features', 'globalBanner', globalBanner); showToast('Comunicado emitido.', 'success'); addLog('Mensagem Global transmitida na rede.', 'info'); }} style={{fontWeight: '900', padding: '14px', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '30px', backgroundColor: '#f59e0b', color: '#020617', border: 'none'}}>
                <Send size={18} style={{marginRight: '8px'}}/> TRANSMITIR MENSAGEM
              </button>

              <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '10px', fontWeight: 'bold'}}>Interruptor de Segurança Crítica:</p>
              
              <button 
                className={`btn w-100 ${sysConfig.maintenanceMode ? 'btn-success' : 'btn-danger pulse-danger-btn'}`} 
                onClick={handleMaintenance}
                style={{ padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'white', border: 'none', fontWeight: '900', letterSpacing: '1px', borderRadius: '8px', flexWrap: 'wrap' }}
              >
                {sysConfig.maintenanceMode ? <><Unlock size={22} /> DESBLOQUEAR SISTEMA</> : <><Lock size={22} /> INICIAR LOCKDOWN CRÍTICO</>}
              </button>

            </div>
          </div>
        </div>

        <div className="dev-col-right">
          
          <div className="sys-control-card primary">
             <div className="dev-card-header" style={{color: '#38bdf8', flexWrap: 'wrap'}}>
               <Database size={24}/><h3>Pipelines de Extração (MySQL)</h3>
             </div>
             <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.5'}}>Extraia blocos brutos das partições MySQL para backups frios locais (formato CSV nativo).</p>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <button onClick={() => exportarTabelaReal('equipamentos')} disabled={isExporting !== null} className="btn btn-outline w-100" style={{display: 'flex', gap: '12px', justifyContent: 'flex-start', padding: '16px', alignItems: 'center', fontWeight: '800', borderRadius: '8px'}}>
                 {isExporting === 'equipamentos' ? <Loader2 size={18} className="spin" /> : <Server size={18} color="#38bdf8"/>} 
                 {isExporting === 'equipamentos' ? 'EXTRAINDO...' : 'DUMP DA TABELA: EQUIPAMENTOS EDGE'}
               </button>
               <button onClick={() => exportarTabelaReal('leituras_telemetria')} disabled={isExporting !== null} className="btn btn-outline w-100" style={{display: 'flex', gap: '12px', justifyContent: 'flex-start', padding: '16px', alignItems: 'center', fontWeight: '800', borderRadius: '8px'}}>
                 {isExporting === 'leituras_telemetria' ? <Loader2 size={18} className="spin" /> : <Activity size={18} color="#10b981"/>} 
                 {isExporting === 'leituras_telemetria' ? 'EXTRAINDO...' : 'DUMP DA TABELA: TELEMETRIA CONTÍNUA'}
               </button>
               <button onClick={() => exportarTabelaReal('audit_logs')} disabled={isExporting !== null} className="btn btn-outline w-100" style={{display: 'flex', gap: '12px', justifyContent: 'flex-start', padding: '16px', alignItems: 'center', fontWeight: '800', borderRadius: '8px'}}>
                 {isExporting === 'audit_logs' ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} color="#a855f7"/>} 
                 {isExporting === 'audit_logs' ? 'EXTRAINDO...' : 'DUMP DA TABELA: AUDITORIA SOC'}
               </button>
             </div>
          </div>

          <div className="sys-control-card danger">
            <div className="dev-card-header" style={{color: '#ef4444', position: 'relative', zIndex: 2, flexWrap: 'wrap'}}>
              <ServerCrash size={24}/><h3>Purga Base de Dados</h3>
            </div>
            <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '15px', position: 'relative', zIndex: 2, lineHeight: '1.5'}}>
              Operação destrutiva: Força a liberação de inodes no disco apagando registros de telemetria com mais de 90 dias (irreversível).
            </p>
            
            <div style={{marginBottom: '25px', position: 'relative', zIndex: 2}}>
               <div className="storage-info" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                 <span style={{ color: '#cbd5e1' }}>Consumo Volume DB</span>
                 <span style={{ color: storageUsed > 80 ? '#ef4444' : '#10b981' }}>{storageUsed}% / 100%</span>
               </div>
               <div className="storage-bar-bg" style={{ height: '10px' }}>
                 <div className="storage-bar-fill" style={{ width: `${storageUsed}%`, background: storageUsed > 80 ? '#ef4444' : '#10b981' }}></div>
               </div>
            </div>

            <button className="btn btn-outline w-100" onClick={handlePurge} disabled={isPurging} style={{color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', display: 'flex', justifyContent: 'center', gap: '10px', padding: '16px', fontWeight: '900', position: 'relative', zIndex: 2, background: 'rgba(239,68,68,0.1)', letterSpacing: '1px', borderRadius: '8px', flexWrap: 'wrap'}}>
               {isPurging ? <Loader2 size={18} className="spin"/> : <Eraser size={18}/>} 
               {isPurging ? 'EXECUTANDO PURGA...' : 'INICIAR PURGA DE DADOS (+90 DIAS)'}
            </button>
            <div className="hazard-stripes"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. TELA SAAS (TENANTS & API)
// ============================================================================
const TelaSaaS = ({ api, sysConfig, updateSysConfig, filiaisDb, showToast, addLog, setModalConfig }) => {
  const handleMudarPlano = (loja, plano) => { updateSysConfig(null, loja, 'saas_plan', null, plano); addLog(`[SAAS] Contrato de ${loja} alterado para ${plano}.`, plano === 'SUSPENSO' ? 'error' : 'success'); showToast(`Licença de ${loja} atualizada.`, plano === 'SUSPENSO' ? 'error' : 'success'); };
  const handleMudarRetencao = (loja, dias) => { addLog(`[CLOUD] Limite de retenção de ${loja} ajustado para ${dias} dias.`, 'info'); showToast(`Cluster de dados de ${loja} ajustado.`, 'success'); };

  const handleForcarLogout = (loja) => {
    setModalConfig({
      isOpen: true,
      title: 'Forçar Logout Remoto',
      message: `Tem certeza de que deseja acionar o Kill Switch para a organização ${loja}? Todos os usuários locais serão desconectados instantaneamente.`,
      onConfirm: () => {
        localStorage.setItem('termosync_force_logout', `${loja}_${Date.now()}`);
        addLog(`[SECURITY] Sinal de KILL SWITCH disparado para: ${loja}.`, 'error');
        showToast(`Comando de expulsão enviado para ${loja}.`, 'success');
      }
    });
  };

  const [chavesAPI, setChavesAPI] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);

  const gerarChaveAPI = (loja) => {
    const key = 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setChavesAPI(prev => ({ ...prev, [loja]: key }));
    addLog(`[API] Nova chave gerada para ${loja}.`, 'success');
    showToast(`Chave API gerada.`, 'success');
  };

  const copyToClipboard = (loja, key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(loja);
    setTimeout(() => setCopiedKey(null), 2000);
    showToast('Chave copiada!', 'info');
  };

  const loginAs = async (loja) => {
    addLog(`[AUTH] Solicitando token de Impersonate para ${loja}...`, 'warning');
    showToast(`Gerando acesso remoto...`, 'warning');
    try {
      const res = await api.post('/impersonate', { filialDestino: loja });
      const url = new URL(window.location.href);
      url.searchParams.set('impersonateToken', res.data.token);
      url.searchParams.set('impersonateLoja', loja);
      window.open(url.toString(), '_blank');
    } catch (err) { showToast('Erro ao criar sessão remota.', 'error'); }
  };

  return (
    <div className="dev-tela-scroll">
      <div className="dev-card glass-card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid #a855f7' }}>
        <div className="dev-card-header" style={{ color: '#a855f7', padding: '1.5rem', marginBottom: 0 }}><ShieldAlert size={20} /><h3>Contas Corporativas e Integrações API</h3></div>
        
        <div className="table-responsive-wrapper">
          <div className="saas-table-header saas-grid-cols">
            <div>Organização / Cliente</div><div>Armazenamento em Nuvem</div><div style={{ textAlign: 'center' }}>Chaves API (Webhooks)</div><div style={{ textAlign: 'center' }}>Licença (Acesso)</div><div style={{ textAlign: 'right' }}>Ações</div>
          </div>
          
          <div style={{maxHeight: '65vh', overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px'}}>
            {filiaisDb?.map((filial, index) => {
              const planoAtual = sysConfig.planos?.[filial] || 'FREE';
              const isSuspenso = planoAtual === 'SUSPENSO';
              const storagePercent = isSuspenso ? 0 : (planoAtual === 'FREE' ? 85 : (planoAtual === 'PRO' ? 45 : 15));
              const storageColor = storagePercent > 80 ? 'var(--danger)' : (storagePercent > 50 ? 'var(--warning)' : 'var(--success)');

              return (
                <div className={`saas-client-row saas-grid-cols ${isSuspenso ? 'row-suspended' : ''}`} key={index}>
                  <div className="text-truncate" style={{ color: isSuspenso ? 'var(--danger)' : 'white', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.1rem' }}>
                    {isSuspenso ? <ZapOff size={18} /> : <Store size={18} />} {filial}
                  </div>

                  <div style={{ paddingRight: '15px' }}>
                    <div className="storage-bar-bg"><div className="storage-bar-fill" style={{ width: `${storagePercent}%`, backgroundColor: storageColor }}></div></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Cloud size={12} /> {storagePercent}%</span>
                      <select disabled={isSuspenso} onChange={(e) => handleMudarRetencao(filial, e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.8rem', color: '#38bdf8', outline: 'none', cursor: 'pointer', fontWeight: '800' }}>
                        <option value="30">30 Dias</option><option value="90">90 Dias</option><option value="365">1 Ano</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {chavesAPI[filial] ? (
                      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(168, 85, 247, 0.3)', maxWidth: '100%' }}>
                        <span className="text-truncate" style={{ fontFamily: 'JetBrains Mono', fontSize: '0.9rem', color: '#a855f7', padding: '10px 14px', fontWeight: 'bold', maxWidth: '140px' }}>{chavesAPI[filial].substring(0, 10)}...</span>
                        <button onClick={() => copyToClipboard(filial, chavesAPI[filial])} style={{ background: '#a855f7', border: 'none', color: 'white', padding: '10px 14px', cursor: 'pointer' }}>
                          {copiedKey === filial ? <Check size={16}/> : <Copy size={16}/>}
                        </button>
                      </div>
                    ) : (
                      <button className="btn-icon-small" title="Gerar Chave API" onClick={() => gerarChaveAPI(filial)} disabled={isSuspenso}><Key size={16} /></button>
                    )}
                  </div>

                  <div style={{textAlign: 'center', padding: '0 10px'}}>
                    <select value={planoAtual} onChange={(e) => handleMudarPlano(filial, e.target.value)} className="plan-dropdown">
                      <option value="FREE">FREE (Básico)</option><option value="PRO">PRO (Avançado)</option><option value="ENTERPRISE">ENTERPRISE (Total)</option><option value="SUSPENSO">⚠️ LOCKDOWN</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn-icon-small" title="Acessar Como Cliente (Impersonate)" onClick={() => loginAs(filial)}><UserCheck size={18} /></button>
                    <button className="btn-icon-small danger-text" title="Forçar Logout Remoto (Kill Switch)" onClick={() => handleForcarLogout(filial)}><Power size={18} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. TELA BILLING (FINANCEIRO E FATURAMENTO)
// ============================================================================
const TelaBilling = ({ sysConfig, filiaisDb, showToast, addLog, updateSysConfig, setModalConfig }) => {
  const [billingSetup, setBillingSetup] = useState(() => {
    const saved = localStorage.getItem('termosync_billing_setup');
    return saved ? JSON.parse(saved) : { pro: 299.90, ent: 899.90, diaVencimento: 10, multa: 2.0, juros: 1.0 };
  });
  const [faturasPagasManualmente, setFaturasPagasManualmente] = useState([]);
  const [isGenerating, setIsGenerating] = useState(null);

  const updateSetup = (key, val) => {
    const newSetup = { ...billingSetup, [key]: parseFloat(val) || 0 };
    setBillingSetup(newSetup);
    localStorage.setItem('termosync_billing_setup', JSON.stringify(newSetup));
  };

  const hoje = new Date();
  const atrasoDias = hoje.getDate() > billingSetup.diaVencimento ? hoje.getDate() - billingSetup.diaVencimento : 0;

  const getDetalhesFatura = (filial, plano, isSuspenso) => {
    if (plano === 'FREE' && !isSuspenso) return null;
    const foiPaga = faturasPagasManualmente.includes(filial);
    let base = isSuspenso ? billingSetup.pro : (plano === 'ENTERPRISE' ? billingSetup.ent : billingSetup.pro);
    let valorMulta = 0; let valorJuros = 0; let status = foiPaga ? "PAGO" : "PAGO";

    if (!foiPaga && (isSuspenso || atrasoDias > 0)) {
      status = isSuspenso ? "VENCIDA" : "ATRASADA";
      valorMulta = base * (billingSetup.multa / 100);
      valorJuros = (base * (billingSetup.juros / 100)) * (atrasoDias / 30);
    }
    return { base, multa: valorMulta, juros: valorJuros, total: base + valorMulta + valorJuros, status, foiPaga };
  };

  const metricasFinanceiras = useMemo(() => {
    let mrr = 0; let inadimplencia = 0; let ativos = 0;
    (filiaisDb || []).forEach((filial) => {
      const plano = sysConfig.planos?.[filial] || 'FREE';
      const fatura = getDetalhesFatura(filial, plano, plano === 'SUSPENSO');
      if (fatura) {
        if (fatura.status === 'VENCIDA' || fatura.status === 'ATRASADA') inadimplencia += fatura.total;
        else { ativos++; mrr += fatura.total; }
      }
    });
    return { mrr, arr: mrr * 12, inadimplencia, ativos, total: (filiaisDb || []).length };
  }, [filiaisDb, sysConfig.planos, billingSetup, atrasoDias, faturasPagasManualmente]);

  const dadosGraficoReceita = useMemo(() => {
    const m = metricasFinanceiras.mrr;
    return [
      { mes: 'Out', receita: m * 0.4 }, { mes: 'Nov', receita: m * 0.55 }, { mes: 'Dez', receita: m * 0.7 },
      { mes: 'Jan', receita: m * 0.8 }, { mes: 'Fev', receita: m * 0.95 }, { mes: 'Mar (Atual)', receita: m }
    ];
  }, [metricasFinanceiras.mrr]);

  const confirmarPagamento = (filial) => {
    setModalConfig({
      isOpen: true,
      title: 'Confirmar Liquidação de Fatura',
      message: `Você confirma o recebimento do pagamento da organização ${filial}? Isso alterará o status para PAGO e reativará automaticamente o acesso do cliente caso ele esteja bloqueado.`,
      onConfirm: () => {
        setFaturasPagasManualmente(prev => [...prev, filial]);
        const planoAtual = sysConfig.planos?.[filial];
        if (planoAtual === 'SUSPENSO') {
          updateSysConfig(null, filial, 'saas_plan', null, 'PRO');
          addLog(`[FINANCEIRO] Fatura de ${filial} liquidada. Serviço SaaS reativado.`, 'success');
        } else {
          addLog(`[FINANCEIRO] Fatura de ${filial} liquidada.`, 'success');
        }
        showToast('Pagamento confirmado com sucesso.', 'success');
      }
    });
  };

  const drawBarcode = (doc, x, y, width, height) => {
    let currentX = x;
    doc.setFillColor(0, 0, 0);
    while (currentX < x + width) {
      let barWidth = Math.random() > 0.5 ? 0.5 : 1.5;
      if (currentX + barWidth > x + width) break;
      doc.rect(currentX, y, barWidth, height, 'F');
      currentX += barWidth + (Math.random() > 0.5 ? 0.6 : 1.2);
    }
  };

  const simularGeracao = (tipo, filial, callback) => {
    setIsGenerating(`${tipo}_${filial}`);
    showToast(`Gerando documento de ${tipo}...`, 'info');
    setTimeout(() => { callback(); setIsGenerating(null); }, 1200);
  };

  const gerarNotaFiscalPDF = (filial, fatura) => {
    simularGeracao('NFe', filial, () => {
      const doc = new jsPDF('p', 'mm', 'a4');
      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("PREFEITURA MUNICIPAL", 105, 20, { align: "center" });
      doc.setFontSize(12); doc.text("NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e", 105, 28, { align: "center" });
      doc.setDrawColor(150); doc.setLineWidth(0.3); doc.rect(10, 35, 190, 240);
      doc.setFillColor(240, 240, 240); doc.rect(10, 35, 190, 8, 'F'); doc.rect(10, 35, 190, 8);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("PRESTADOR DE SERVIÇOS", 12, 40);
      doc.setFontSize(11); doc.text("TERMOSYNC CORPORATION LTDA", 12, 50);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text("CNPJ: 12.345.678/0001-90", 12, 55); doc.text("Avenida da Tecnologia, 1000 - São Paulo/SP", 12, 60); doc.line(10, 65, 200, 65);
      doc.setFillColor(240, 240, 240); doc.rect(10, 65, 190, 8, 'F'); doc.rect(10, 65, 190, 8);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("TOMADOR DE SERVIÇOS", 12, 70);
      doc.setFontSize(11); doc.text(filial.toUpperCase(), 12, 80);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text("CNPJ: 98.765.432/0001-10", 12, 85); doc.text(`Organização - ${filial}`, 12, 90); doc.line(10, 95, 200, 95);
      doc.setFillColor(240, 240, 240); doc.rect(10, 95, 190, 8, 'F'); doc.rect(10, 95, 190, 8);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("DISCRIMINAÇÃO DOS SERVIÇOS", 12, 100); doc.setFont("helvetica", "normal");
      const obs = `Licenciamento SaaS TermoSync IoT.\nPlano: ${sysConfig.planos?.[filial] || 'PRO'}.\nEncargos: R$ ${(fatura.multa + fatura.juros).toFixed(2)} (Atraso/Juros).`;
      doc.text(obs, 12, 110);
      doc.line(10, 250, 200, 250); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("VALOR TOTAL DA NOTA: R$", 120, 260);
      doc.setFontSize(14); doc.text(`${fatura.total.toFixed(2).replace('.', ',')}`, 175, 260);
      doc.save(`NF_${filial}_${Date.now()}.pdf`);
      addLog(`[BILLING] NFS-e Oficial gerada para ${filial}.`, 'success'); 
      showToast('Nota Fiscal gerada com sucesso.', 'success');
    });
  };

  const gerarBoletoPDF = (filial, fatura) => {
    simularGeracao('Boleto', filial, () => {
      const doc = new jsPDF('p', 'mm', 'a4'); doc.setFont("helvetica", "bold");
      doc.setFontSize(10); doc.text("RECIBO DO PAGADOR", 10, 20); doc.setLineWidth(0.5); doc.line(10, 22, 200, 22);
      doc.setFontSize(16); doc.text("Banco TermoSync S.A.", 10, 30); doc.setFontSize(14); doc.text("| 001-9 |", 70, 30); doc.setFontSize(11); doc.text("00190.00009 01234.567890 00000.000000 1 89000000000000", 95, 30);
      doc.setLineWidth(0.2); doc.rect(10, 35, 190, 60); doc.line(10, 45, 200, 45); doc.line(10, 55, 200, 55); doc.line(150, 35, 150, 95);
      doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.text("Local de Pagamento", 12, 38); doc.text("Pagável em qualquer banco até o vencimento.", 12, 42);
      doc.text("Vencimento", 152, 38); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text(`${billingSetup.diaVencimento}/${new Date().getMonth() + 1}/${new Date().getFullYear()}`, 152, 42);
      doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.text("Beneficiário", 12, 48); doc.text("TermoSync Corp LTDA - CNPJ 12.345.678/0001-90", 12, 52); doc.text("Agência / Cód", 152, 48); doc.text("0001 / 12345-6", 152, 52);
      doc.text("Pagador", 12, 60); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text(filial.toUpperCase(), 12, 64);
      doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.text("(=) Valor Doc", 152, 60); doc.text(`R$ ${fatura.base.toFixed(2)}`, 152, 64); doc.text("(+) Multa/Juros", 152, 70); doc.text(`R$ ${(fatura.multa + fatura.juros).toFixed(2)}`, 152, 74);
      doc.text("(=) Cobrado", 152, 80); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(`R$ ${fatura.total.toFixed(2)}`, 152, 86);
      doc.setLineDashPattern([2, 2], 0); doc.line(10, 110, 200, 110); doc.setLineDashPattern([], 0);
      drawBarcode(doc, 10, 230, 100, 15);
      doc.save(`Boleto_${filial}_${Date.now()}.pdf`);
      addLog(`[BILLING] Boleto gerado para ${filial}.`, 'success'); 
      showToast('Boleto Bancário gerado.', 'success');
    });
  };

  const dispararCobrancaEmLote = () => {
    addLog(`[CRON] Rotina de emissão em lote iniciada para ${filiaisDb?.length} clientes...`, 'warning');
    setTimeout(() => { showToast('Faturamento em lote concluído.', 'success'); addLog('[CRON] Lote processado.', 'success'); }, 1500);
  };

  return (
    <div className="dev-tela-scroll">
      <div className="flex-header" style={{ padding: 0, background: 'transparent', boxShadow: 'none', marginBottom: '0' }}>
        <div className="dev-card glass-card" style={{ width: '100%', borderTop: '4px solid #eab308' }}>
          <div className="dev-card-header flex-between" style={{ color: '#eab308', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Settings2 size={20} /><h3>Centro de Operações Financeiras (RevOps)</h3></div>
            <button className="btn btn-primary" onClick={dispararCobrancaEmLote} style={{ fontSize: '0.8rem', padding: '8px 16px', background: '#eab308', color: '#0f172a', fontWeight: 'bold' }}><RefreshCw size={14} /> Processar Lote (CRON)</button>
          </div>
          <div className="billing-config-grid">
            <div className="config-box"><label>Plano PRO (R$)</label><div className="config-input-wrapper"><DollarSign size={14} /><input type="number" step="0.1" value={billingSetup.pro} onChange={(e) => updateSetup('pro', e.target.value)} /></div></div>
            <div className="config-box"><label>Plano ENTERPRISE (R$)</label><div className="config-input-wrapper"><DollarSign size={14} /><input type="number" step="0.1" value={billingSetup.ent} onChange={(e) => updateSetup('ent', e.target.value)} /></div></div>
            <div className="config-box"><label>Dia Vencimento</label><div className="config-input-wrapper"><Calendar size={14} /><input type="number" min="1" max="31" value={billingSetup.diaVencimento} onChange={(e) => updateSetup('diaVencimento', e.target.value)} /></div></div>
            <div className="config-box"><label>Multa Atraso (%)</label><div className="config-input-wrapper"><Percent size={14} /><input type="number" step="0.1" value={billingSetup.multa} onChange={(e) => updateSetup('multa', e.target.value)} /></div></div>
            <div className="config-box"><label>Juros Mês (%)</label><div className="config-input-wrapper"><Percent size={14} /><input type="number" step="0.1" value={billingSetup.juros} onChange={(e) => updateSetup('juros', e.target.value)} /></div></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '1.5rem', marginBottom: '1rem' }} className="dev-grid-main">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="dev-card glass-card saas-kpi-card" style={{ margin: 0, borderLeft: '4px solid #10b981', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '15px', borderRadius: '12px' }}><TrendingUp size={32} /></div>
            <div>
              <span style={{fontSize: '0.8rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px'}}>MRR ESTIMADO (MENSAL)</span>
              <div style={{color: 'white', fontFamily: 'JetBrains Mono', fontSize: '2rem', fontWeight: '900'}}>R$ {metricasFinanceiras.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div className="dev-card glass-card saas-kpi-card" style={{ margin: 0, borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '12px' }}><AlertTriangle size={32} /></div>
            <div>
              <span style={{fontSize: '0.8rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px'}}>DÍVIDA DE CLIENTES</span>
              <div style={{ color: 'var(--danger)', fontFamily: 'JetBrains Mono', fontSize: '2rem', fontWeight: '900' }}>R$ {metricasFinanceiras.inadimplencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>
        <div className="dev-card glass-card" style={{ margin: 0, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
          <div className="dev-card-header" style={{ color: '#10b981', marginBottom: '10px' }}><LineChart size={20} /> <h3 style={{ fontSize: '1rem' }}>Evolução do MRR (6 Meses)</h3></div>
          <div className="chart-container" style={{ flex: 1, margin: 0, minHeight: '140px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dadosGraficoReceita} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs><linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="mes" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: 'white', fontSize: '12px' }} itemStyle={{ color: '#10b981', fontWeight: 'bold' }} formatter={(value) => `R$ ${value.toFixed(2)}`} />
                <Area type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorMrr)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="dev-card glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="dev-card-header" style={{ color: '#eab308', padding: '1.5rem', marginBottom: 0 }}><Receipt size={20} /><h3>Faturas Emitidas (Ciclo Atual)</h3></div>
        
        <div className="table-responsive-wrapper">
          <div className="saas-table-header billing-grid-cols">
            <div>Cliente Pagador</div><div>Plano Base</div><div>Multa/Juros</div><div>Total (R$)</div><div style={{ textAlign: 'center' }}>Status</div><div style={{ textAlign: 'center' }}>Ações de Faturamento</div>
          </div>

          <div style={{maxHeight: '65vh', overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px'}}>
            {filiaisDb?.map((filial, index) => {
              const planoAtual = sysConfig.planos?.[filial] || 'FREE';
              const fatura = getDetalhesFatura(filial, planoAtual, planoAtual === 'SUSPENSO');
              if (!fatura) return null;
              const isLate = fatura.status === 'VENCIDA' || fatura.status === 'ATRASADA';

              return (
                <div className={`saas-client-row billing-grid-cols ${isLate ? 'row-suspended' : ''}`} key={index}>
                  <div className="text-truncate" style={{fontWeight: '900', color: 'white', fontSize: '1.1rem'}}>{filial}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>R$ {fatura.base.toFixed(2)}</div>
                  <div style={{ color: isLate ? 'var(--danger)' : 'var(--text-muted)', fontSize: '1rem' }}>R$ {(fatura.multa + fatura.juros).toFixed(2)}</div>
                  <div style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '1.3rem', fontFamily: 'JetBrains Mono' }}>R$ {fatura.total.toFixed(2)}</div>
                  <div style={{ textAlign: 'center' }}><span className={`status-badge ${isLate ? 'danger' : 'success'}`}>{fatura.status}</span></div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {!fatura.foiPaga && <button className="btn-icon-small" title="Confirmar Pagamento Manual" onClick={() => confirmarPagamento(filial)} style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }}><CheckCircle2 size={18} /></button>}
                    <button className="btn-icon-small" title="Gerar NF-e (PDF)" onClick={() => gerarNotaFiscalPDF(filial, fatura)} disabled={isGenerating !== null}>
                      {isGenerating === `NFe_${filial}` ? <Loader2 size={18} className="spin" /> : <FileText size={18} />}
                    </button>
                    <button className="btn-icon-small" title="Gerar Boleto (PDF)" onClick={() => gerarBoletoPDF(filial, fatura)} disabled={isGenerating !== null}>
                       {isGenerating === `Boleto_${filial}` ? <Loader2 size={18} className="spin" /> : <Banknote size={18} />}
                    </button>
                    {isLate && !fatura.foiPaga && <button className="btn-icon-small danger-text" title="Notificar Cobrança" onClick={() => { addLog(`Aviso de cobrança enviado a ${filial}.`, 'warning'); showToast('Aviso disparado.', 'info'); }}><Mail size={18} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 8. TELA SOC (AUDITORIA E ZERO-TRUST)
// ============================================================================
const TelaSOC = ({ api, showToast, addLog, setModalConfig }) => {
  const [activeSessions, setActiveSessions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const carregarDadosSOC = useCallback(async () => {
    try {
      const [resSessoes, resAuditoria] = await Promise.all([api.get('/soc/sessoes'), api.get('/soc/auditoria')]);
      setActiveSessions(resSessoes.data.map(s => ({ ...s, loginTime: new Date(s.loginTime).toLocaleString() })));
      setAuditLogs(resAuditoria.data.map(a => ({ ...a, time: new Date(a.data_hora).toLocaleString() })));
    } catch (e) { } finally { setIsLoading(false); }
  }, [api]);

  useEffect(() => {
    carregarDadosSOC();
    const interval = setInterval(carregarDadosSOC, 10000);
    return () => clearInterval(interval);
  }, [carregarDadosSOC]);

  const handleRevoke = (id, user) => {
    setModalConfig({
      isOpen: true,
      title: 'Revogar Acesso JWT',
      message: `Deseja realmente derrubar a conexão em tempo real do usuário ${user}? O token JWT será invalidado imediatamente e registrado na auditoria.`,
      onConfirm: async () => {
        try {
          await api.post(`/soc/revogar/${id}`);
          setActiveSessions(prev => prev.filter(s => s.id !== id));
          showToast(`Sessão de ${user} encerrada.`, 'success');
          addLog(`[SOC] Sessão forçada ao encerramento: ${user}`, 'error');
          carregarDadosSOC(); 
        } catch (e) { showToast('Erro ao revogar sessão.', 'error'); }
      }
    });
  };

  const exportarLogsCSV = () => {
    if (auditLogs.length === 0) return showToast('Não há registros para exportar.', 'warning');
    let csvContent = "Data/Hora,Ação Realizada,Ator,Alvo,Severidade\n";
    auditLogs.forEach(log => { csvContent += `"${log.time}","${log.action}","${log.actor}","${log.target}","${log.severity.toUpperCase()}"\n`; });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Auditoria_ZeroTrust_SOC_${Date.now()}.csv`;
    link.click();
    showToast('Logs exportados em CSV.', 'success');
    addLog('[SOC] Exportação de arquivo CSV de Auditoria concluída.', 'success');
  };

  const score = Math.max(0, 100 - (auditLogs.filter(l => l.severity === 'danger').length * 5));

  return (
    <div className="dev-tela-scroll">
      <div className="dev-grid-main">
        <div className="dev-col-left">
          <div className="dev-card glass-card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid #a855f7' }}>
            <div className="dev-card-header flex-between" style={{color: '#a855f7', padding: '1.5rem', marginBottom: 0, flexWrap: 'wrap'}}>
              <div style={{display:'flex', gap:'8px', alignItems:'center'}}><FingerprintIcon size={24}/><h3>Sessões JWT Ativas</h3></div>
              <span className="status-badge" style={{background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)'}}>Zero-Trust Ativado</span>
            </div>
            
            <div className="table-responsive-wrapper">
              <div className="saas-table-header soc-grid-cols">
                <div>Usuário</div><div>IP / Localização</div><div>Login</div><div style={{textAlign: 'right'}}>Ação</div>
              </div>
              
              <div style={{maxHeight: '65vh', overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px'}}>
                {isLoading && <div style={{padding: '3rem', display: 'flex', justifyContent: 'center', color: 'var(--text-muted)'}}><Loader2 className="spin" size={32} /></div>}
                {!isLoading && activeSessions.map((s) => (
                  <div key={s.id} className="saas-client-row soc-grid-cols">
                    <div><div className="text-truncate" style={{fontWeight: '900', color: 'white', fontSize: '1.1rem'}}>{s.usuario}</div><div style={{fontSize: '0.85rem', color: '#a855f7', marginTop: '4px'}}>{s.role}</div></div>
                    <div><div style={{fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', fontSize: '1rem'}}>{s.ip === '::1' ? 'Localhost' : s.ip}</div><div style={{fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px'}}><MapPin size={12}/>{s.location}</div></div>
                    <div style={{color: 'var(--text-muted)', fontSize: '0.95rem'}}>{s.loginTime}</div>
                    <div style={{display: 'flex', justifyContent: 'flex-end'}}><button className="btn-icon-small danger-text" title="Derrubar Conexão (Revoke)" onClick={() => handleRevoke(s.id, s.usuario)}><UserX size={18} /></button></div>
                  </div>
                ))}
                {!isLoading && activeSessions.length === 0 && <div style={{padding: '2rem', textAlign: 'center', color: 'var(--text-muted)'}}>Nenhuma sessão ativa encontrada.</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="dev-col-right">
          <div className="dev-card glass-card" style={{ borderTop: '4px solid var(--info)' }}>
            <div className="dev-card-header flex-between" style={{color: 'var(--info)', flexWrap: 'wrap'}}>
              <div style={{display:'flex', gap:'8px', alignItems:'center'}}><History size={24}/><h3>Registro de Auditoria</h3></div>
              <div className="status-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${score > 80 ? '#10b981' : (score > 50 ? '#f59e0b' : '#ef4444')}` }}>
                {score > 80 ? <ShieldCheck size={16} color="#10b981"/> : <ShieldAlert size={16} color={score > 50 ? '#f59e0b' : '#ef4444'}/>}
                <span style={{ fontSize: '0.9rem', fontWeight: '900', color: score > 80 ? '#10b981' : (score > 50 ? '#f59e0b' : '#ef4444') }}>Pontuação: {score}%</span>
              </div>
            </div>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '55vh', overflowY: 'auto', paddingRight: '10px', marginBottom: '20px'}}>
              {isLoading && <div style={{textAlign: 'center', color: 'var(--text-muted)', padding: '2rem'}}><Loader2 className="spin" size={32}/></div>}
              {!isLoading && auditLogs.map((log, idx) => (
                <div key={idx} style={{background: 'rgba(0,0,0,0.3)', borderLeft: `4px solid var(--${log.severity})`, padding: '16px 20px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px'}}>
                    <span style={{color: `var(--${log.severity})`, fontWeight: '900', fontSize: '0.95rem'}}>{log.action}</span>
                    <span style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>Alvo: <span style={{color: 'white', fontWeight: 'bold'}}>{log.target}</span> | Ator: <span style={{color: 'white', fontWeight: 'bold'}}>{log.actor}</span></span>
                  </div>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'right', fontWeight: 'bold'}}><Clock size={14}/> {log.time}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-outline w-100" style={{padding: '16px', display: 'flex', justifyContent: 'center', gap: '10px', fontWeight: '900', borderRadius: '10px', letterSpacing: '0.5px'}} onClick={exportarLogsCSV}>
              <DownloadCloud size={20}/> EXPORTAR LOGS (CSV)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 9. TELA BI E RELATÓRIOS
// ============================================================================
const TelaBI = ({ api, showToast, addLog, sysConfig, filiaisDb }) => {
  const [isProcessing, setIsProcessing] = useState(null);

  const processarDadosRelatorio = async (tipo) => {
    let head = []; let body = [];
    if (tipo === 'AUDITORIA_SOC') {
      const res = await api.get('/soc/auditoria');
      head = ['Data/Hora', 'Ação Realizada', 'Ator', 'Alvo', 'Severidade'];
      body = res.data.map(log => [new Date(log.data_hora).toLocaleString(), log.action, log.actor, log.target, log.severity.toUpperCase()]);
      if(body.length === 0) body = [['--', 'Sem registros', '--', '--', '--']];
    } else if (tipo === 'FINOPS_BILLING') {
      head = ['Cliente Pagador / Tenant', 'Plano Base', 'Custo Mensal', 'Status Financeiro'];
      body = (filiaisDb || []).map(filial => {
        const plano = sysConfig?.planos?.[filial] || 'FREE';
        let valor = plano === 'ENTERPRISE' ? 'R$ 899,90' : (plano === 'PRO' ? 'R$ 299,90' : 'R$ 0,00');
        let status = plano === 'SUSPENSO' ? 'BLOQUEADO' : 'ATIVO';
        return [filial, plano, valor, status];
      });
      if(body.length === 0) body = [['--', 'Sem clientes', '--', '--']];
    } else if (tipo === 'EDGE_HARDWARE') {
      const res = await api.get('/hardware');
      head = ['Edge Node (Máquina)', 'Localização', 'Endereço MAC', 'Sinal (dBm)', 'Uptime', 'Firmware'];
      body = res.data.map(node => [node.nome, node.filial || 'Principal', node.mac || '00:00:00:00:00:00', `${node.signal_dbm || -100} dBm`, node.uptime || 'N/A', node.fwVersion || 'v1.0.0']);
      if(body.length === 0) body = [['--', 'Nenhum hardware', '--', '--', '--', '--']];
    } else if (tipo === 'CAOS_RESILIENCIA') {
      const res = await api.get('/notificacoes/historico');
      head = ['Data/Hora', 'Máquina (Nó)', 'Tipo de Anomalia', 'Mensagem do Sistema'];
      body = res.data.slice(0, 50).map(n => [new Date(n.data_hora).toLocaleString(), n.equipamento_nome, n.tipo_alerta, n.mensagem]);
      if(body.length === 0) body = [['--', 'Sem anomalias detectadas', '--', '--']];
    } else if (tipo === 'ORGANIZACOES_TENANTS') {
      const res = await api.get('/empresas');
      head = ['Organização', 'Registro Legal', 'Contato', 'Email', 'Status'];
      body = res.data.map(emp => [emp.nome, emp.cnpj || 'ISENTO', emp.contato || 'Não informado', emp.email || 'Não informado', emp.status.toUpperCase()]);
      if(body.length === 0) body = [['--', 'Nenhuma organização', '--', '--', '--']];
    } else if (tipo === 'SYSOPS_HEALTH') {
      const res = await api.get('/system/health');
      head = ['Métrica Vital do Servidor', 'Valor Atual', 'Status'];
      body = [
        ['Status do Cluster MySQL', res.data.db, 'NORMAL'],
        ['Túneis WebSocket Ativos', `${res.data.sockets} conexão(ões)`, 'NORMAL'],
        ['Volume de Telemetria (Registros)', `${res.data.total_records}`, 'NORMAL'],
        ['Tempo de Atividade (Uptime)', `${Math.floor(res.data.uptime / 60)} min`, 'NORMAL']
      ];
    }
    return { head, body };
  };

  const gerarRelatorioPDF = async (tipo, tema, cor) => {
    setIsProcessing(`PDF_${tipo}`);
    showToast(`Compilando PDF: ${tipo}...`, 'warning');
    try {
      await api.post('/system/reports/log', { tipo, formato: 'PDF', solicitante: 'Root/Dev' });
      addLog(`[BI] Extração de PDF iniciada: ${tipo}`, 'info');
      const { head, body } = await processarDadosRelatorio(tipo);
      const doc = new jsPDF('landscape');
      doc.setFillColor(cor); doc.rect(0, 0, 300, 20, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text(`TERMOSYNC ENTERPRISE - RELATÓRIO EXECUTIVO`, 15, 13);
      doc.setTextColor(50, 50, 50); doc.setFontSize(14); doc.text(tema, 15, 30);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(`Emissão: ${new Date().toLocaleString()} | Uso Interno`, 15, 36);
      autoTable(doc, { head: [head], body: body, startY: 45, headStyles: { fillColor: cor }, styles: { fontSize: 9 } });
      doc.save(`TermoSync_Report_${tipo}_${Date.now()}.pdf`);
      showToast('Relatório PDF exportado.', 'success');
    } catch (e) { showToast('Erro no PDF.', 'error'); }
    setIsProcessing(null);
  };

  const gerarRelatorioCSV = async (tipo) => {
    setIsProcessing(`CSV_${tipo}`);
    showToast(`Extraindo CSV: ${tipo}...`, 'warning');
    try {
      await api.post('/system/reports/log', { tipo, formato: 'CSV', solicitante: 'Root/Dev' });
      addLog(`[BI] Extração de CSV iniciada: ${tipo}`, 'info');
      const { head, body } = await processarDadosRelatorio(tipo);
      let csvContent = head.map(h => `"${h}"`).join(',') + '\n';
      body.forEach(row => { csvContent += row.map(val => `"${val}"`).join(',') + '\n'; });
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob); link.download = `Data_${tipo}_${Date.now()}.csv`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      showToast('CSV exportado.', 'success');
    } catch (e) { showToast('Erro no CSV.', 'error'); }
    setIsProcessing(null);
  };

  const modulosBI = [
    { id: 'FINOPS_BILLING', titulo: 'Core Financeiro (RevOps)', desc: 'Relação completa de MRR, dívidas e faturas.', icon: DollarSign, color: '#10b981' },
    { id: 'AUDITORIA_SOC', titulo: 'Auditoria Zero-Trust (SOC)', desc: 'Extrato oficial e imutável de logins e purgas do banco de dados.', icon: ShieldCheck, color: '#a855f7' },
    { id: 'EDGE_HARDWARE', titulo: 'Inventário Edge Computing', desc: 'Mapeamento global da frota de microcontroladores (MAC/Wi-Fi).', icon: Server, color: '#38bdf8' },
    { id: 'CAOS_RESILIENCIA', titulo: 'Auditoria de Resiliência', desc: 'Relatório das anomalias injetadas ou detectadas no sistema.', icon: Cpu, color: '#ef4444' },
    { id: 'ORGANIZACOES_TENANTS', titulo: 'Ecossistema de Tenants', desc: 'Lista de todos os clientes registrados, capacidades e responsáveis.', icon: Building2, color: '#f59e0b' },
    { id: 'SYSOPS_HEALTH', titulo: 'Saúde da Plataforma (SysOps)', desc: 'Métricas vitais do cluster Node.js, WebSocket e carga MySQL.', icon: Activity, color: '#6366f1' }
  ];

  return (
    <div className="anim-fade-in stagger-1 dev-tela-scroll">
      <div className="flex-header" style={{ padding: 0, background: 'transparent', boxShadow: 'none', marginBottom: '0' }}>
        <div className="dev-card glass-card" style={{ width: '100%' }}>
          <div className="dev-card-header" style={{ color: 'white', marginBottom: '5px' }}><PieChart size={24} color="#38bdf8" /><h3 style={{fontSize: 'clamp(1rem, 2vw, 1.2rem)'}}>Centro de Inteligência e Analytics (BI)</h3></div>
          <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>Motor de extração de dados reais do banco MySQL. Relatórios são registrados em tabela de auditoria para fins de compliance.</p>
        </div>
      </div>
      <div className="bi-grid stagger-2">
        {modulosBI.map(mod => (
          <div key={mod.id} className="bi-card glass-card" style={{ '--theme-color': mod.color }}>
            <div className="bi-header"><div className="bi-icon-wrapper"><mod.icon size={24} /></div><div><h4 className="bi-title" style={{color:'white'}}>{mod.titulo}</h4><p className="bi-desc">{mod.desc}</p></div></div>
            <div className="bi-actions">
              <button className="btn-bi" onClick={() => gerarRelatorioPDF(mod.id, mod.titulo, mod.color)} disabled={isProcessing !== null}>
                {isProcessing === `PDF_${mod.id}` ? <Loader2 size={16} className="spin"/> : <FileText size={16}/>} PDF Dinâmico
              </button>
              <button className="btn-bi" onClick={() => gerarRelatorioCSV(mod.id)} disabled={isProcessing !== null}>
                {isProcessing === `CSV_${mod.id}` ? <Loader2 size={16} className="spin"/> : <FileSpreadsheet size={16}/>} Tabela CSV
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 10. TERMINAL FOOTER (COMANDOS REAIS + EASTER EGGS)
// ============================================================================
const TerminalFooter = ({ logs, setLogs, addLog, sysConfig }) => {
  const [cmdInput, setCmdInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const terminalContainerRef = useRef(null);

  useEffect(() => {
    if (isOpen && terminalContainerRef.current) terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
  }, [logs, isOpen]);

  const handleCommandSubmit = (e) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;
    const cmd = cmdInput.trim().toLowerCase();
    
    // Mostra o que o usuário digitou na tela
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: cmd, status: 'cmd-echo' }]);
    
    // Simula tempo de processamento
    setTimeout(() => {
      switch (cmd) {
        case 'help': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'Comandos disponíveis: clear, ping, sysinfo, netstat, purge, reboot, whoami, date, lockdown, ifconfig, sudo, matrix', status: 'info' }]); break;
        case 'clear': setLogs([]); break;
        case 'ping': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'Gateway Ping: 12ms. Servidor Core: ONLINE.', status: 'success' }]); break;
        case 'sysinfo': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'TermoSync OS v10.5 Enterprise Edition | Auth: ROOT_DEV.', status: 'warning' }]); break;
        case 'netstat': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'TCP 0.0.0.0:3000 (LISTEN) | Conexões WebSocket ativas: 3.', status: 'info' }]); break;
        case 'whoami': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'SuperUser (UID: 0). Permissão Máxima Concedida.', status: 'success' }]); break;
        case 'date': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: new Date().toString(), status: 'info' }]); break;
        case 'ifconfig': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'eth0: inet 192.168.1.100 netmask 255.255.255.0 | lo: inet 127.0.0.1', status: 'info' }]); break;
        case 'sudo': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'Você já é ROOT. Com grandes poderes vêm grandes responsabilidades.', status: 'warning' }]); break;
        case 'matrix': 
            for(let i=0; i<15; i++) {
                setTimeout(() => setLogs(prev => [...prev, { time: '', text: Array.from({length: 40}, () => String.fromCharCode(33 + Math.random() * 94)).join(''), status: 'success' }]), i * 50);
            }
            break;
        case 'lockdown': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: sysConfig?.maintenanceMode ? 'Sistema já está em LOCKDOWN.' : 'Para ativar o Lockdown Crítico, utilize a Interface Gráfica na aba Sistema.', status: 'warning' }]); break;
        case 'purge': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'Limpando cache de memória RAM L3... [OK]', status: 'success' }]); break;
        case 'reboot': 
          setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'Reiniciando painel (F5)...', status: 'error' }]); 
          setTimeout(() => window.location.reload(), 1500); 
          break;
        default: setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: `ERR: comando '${cmd}' não reconhecido. Digite 'help' para ver os comandos válidos.`, status: 'error' }]);
      }
    }, 400);
    setCmdInput(''); 
  };

  return (
    <div className={`os-terminal-footer ${isOpen ? 'open' : 'closed'}`}>
      <div className="terminal-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="terminal-header-title">
          <TerminalSquare size={16} />
          <span>{isOpen ? '/dev/tty1 (SHELL ROOT INTERATIVO)' : 'Abrir Terminal do Servidor (ROOT)'}</span>
        </div>
        {isOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </div>
      {isOpen && (
        <>
          <div className="terminal-body crt-terminal" ref={terminalContainerRef}>
            {logs.map((log, index) => (
              <div key={index} className={`terminal-line ${log.status}`}>
                <span className="time">{log.time && `[${log.time}]`}</span>
                {log.status === 'cmd-echo' ? (<span className="prompt">root@termosync:~$ <span style={{color: 'white'}}>{log.text}</span></span>) : (<><span className="prompt" style={{visibility: log.time ? 'visible' : 'hidden'}}>root@termosync:~$</span> <span className="text">{log.text}</span></>)}
              </div>
            ))}
          </div>
          <form onSubmit={handleCommandSubmit} className="terminal-input-form">
            <span className="prompt">root@termosync:~$</span>
            <input type="text" value={cmdInput} onChange={e => setCmdInput(e.target.value)} placeholder="Digite um comando (ex: help)..." autoComplete="off" spellCheck="false" autoFocus />
            <button type="button" className="btn-clear-terminal" onClick={() => setLogs([])} title="Limpar Console"><Eraser size={16} /></button>
          </form>
        </>
      )}
    </div>
  );
};