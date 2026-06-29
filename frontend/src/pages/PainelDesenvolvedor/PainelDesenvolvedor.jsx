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
  Zap, Flame, AlertCircle, Wifi, Users, UserPlus, FileKey, UserCog, LockKeyhole, XCircle, Minus,
  MonitorSmartphone, Search, ShieldBan, Save, Target, X,
  Rocket, GitCommit, Bug, FileCode, User, Trash2, Filter, ChevronRight
} from 'lucide-react';

import { AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, YAxis, BarChart, Bar, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './PainelDesenvolvedor.css';
import GestaoEmpresas from '../GestaoEmpresas/GestaoEmpresas';

// ============================================================================
// COMPONENTE PRINCIPAL (CONTAINER OS)
// ============================================================================
export default function PainelDesenvolvedor({ api, socket, abaAtiva, isDevAuthenticated, onAuthenticate, showToast, sysConfig, updateSysConfig, tocarAlarme, usuariosLista, filiaisDb, setModalConfig }) {
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [isOverclocked, setIsOverclocked] = useState(false); 
  
  const addLog = useCallback((text, status = 'info') => { 
    setTerminalLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text, status }]); 
  }, []);

  // Adiciona a mensagem de boas vindas no terminal assim que o painel é carregado
  useEffect(() => {
    if (terminalLogs.length === 0) {
      addLog("Sessão Master estabelecida. SysAdmin conectado.", "success");
    }
  }, [addLog, terminalLogs.length]);

  if (!isDevAuthenticated) {
    return (
      <div className="dev-os-container" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '15px', color: 'var(--danger)'}}>
        <ShieldAlert size={64} className="pulse-icon" />
        <h2>Acesso Rejeitado</h2>
        <p style={{color: '#94a3b8'}}>O terminal requer autenticação de Nível ROOT.</p>
      </div>
    );
  }

  return (
    <div className={`dev-os-container anim-fade-in ${sysConfig?.maintenanceMode ? 'lockdown-mode' : ''} ${isOverclocked ? 'red-alert-mode' : ''}`}>
      
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
          {abaAtiva === 'dev_panel' && <TelaNOC api={api} showToast={showToast} sysConfig={sysConfig} updateSysConfig={updateSysConfig} tocarAlarme={tocarAlarme} usuariosLista={usuariosLista} addLog={addLog} setModalConfig={setModalConfig} isOverclocked={isOverclocked} setIsOverclocked={setIsOverclocked} />}
          {abaAtiva === 'saas' && <TelaSaaS api={api} sysConfig={sysConfig} updateSysConfig={updateSysConfig} filiaisDb={filiaisDb} showToast={showToast} addLog={addLog} setModalConfig={setModalConfig} isOverclocked={isOverclocked} />}
          {abaAtiva === 'billing' && <TelaBilling sysConfig={sysConfig} filiaisDb={filiaisDb} showToast={showToast} addLog={addLog} updateSysConfig={updateSysConfig} setModalConfig={setModalConfig} isOverclocked={isOverclocked} />}
          {abaAtiva === 'system' && <TelaSistema api={api} showToast={showToast} addLog={addLog} sysConfig={sysConfig} updateSysConfig={updateSysConfig} setModalConfig={setModalConfig} isOverclocked={isOverclocked} />}
          {abaAtiva === 'soc' && <TelaSOC api={api} showToast={showToast} addLog={addLog} setModalConfig={setModalConfig} usuariosLista={usuariosLista} isOverclocked={isOverclocked} />}
          {abaAtiva === 'bi' && <TelaBI api={api} showToast={showToast} addLog={addLog} sysConfig={sysConfig} filiaisDb={filiaisDb} setModalConfig={setModalConfig} isOverclocked={isOverclocked} />}
          {abaAtiva === 'atualizacoes' && <TelaAtualizacoes api={api} showToast={showToast} addLog={addLog} setModalConfig={setModalConfig} isOverclocked={isOverclocked} />}
          {abaAtiva === 'sql_terminal' && <TelaTerminalSQL api={api} showToast={showToast} addLog={addLog} />}
          {abaAtiva === 'websocket_stream' && <TelaWebSocketStream socket={socket} addLog={addLog} />}
        </div>
        <TerminalFooter logs={terminalLogs} setLogs={setTerminalLogs} addLog={addLog} sysConfig={sysConfig} isOverclocked={isOverclocked} />
      </div>
    </div>
  );
}

// ============================================================================
// TELA NOC (NETWORK OPERATIONS CENTER)
// ============================================================================
const TelaNOC = ({ api, showToast, sysConfig, updateSysConfig, usuariosLista, addLog, isOverclocked, setIsOverclocked }) => {
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
    { id: 3, name: 'us-east-1 (Failover)', role: 'Recuperação de Desastres', status: 'standby', ping: 118 },
    { id: 4, name: 'eu-central-1 (Edge)', role: 'Gateway IoT', status: 'online', ping: 45 }
  ]);

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
        setLatencyData([]);
        return;
      }
      
      const multiplier = isOverclocked ? 4 : 1;
      const newCpu = Math.min(100, Math.floor(Math.random() * 20 * multiplier) + (isOverclocked ? 70 : 15));
      const newRam = Math.min(100, Math.floor(Math.random() * 10 * multiplier) + (isOverclocked ? 85 : 60));
      const newReqs = Math.floor(Math.random() * 150 * multiplier) + (isOverclocked ? 1200 : 400);
      const newDb = Math.floor(Math.random() * 50 * multiplier) + (isOverclocked ? 450 : 100);
      const newBw = (Math.random() * 10 * multiplier + (isOverclocked ? 80 : 15)).toFixed(1);
      
      setMetrics({ cpu: newCpu, ram: newRam, ping: Math.floor(Math.random() * 8) + 10, reqs: newReqs, dbQps: newDb, bandwidth: newBw });
      setMetricHistory(prev => [...prev.slice(1), { time: new Date().toLocaleTimeString('pt-BR', { second: '2-digit' }), cpu: newCpu, ram: newRam, bw: newBw, db: newDb }]);
      
      setClusterNodes(prev => prev.map(n => ({ ...n, ping: n.status === 'standby' ? Math.floor(Math.random() * 20) + 110 : Math.floor(Math.random() * 10) + (isOverclocked ? 25 : 5) })));

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
        { method: 'MQTT', route: 'telemetry/esp32/temp_hum', color: isOverclocked ? '#ef4444' : '#10b981', status: 'ACK' }, 
        { method: 'POST', route: '/api/v1/auth/verify', color: '#f59e0b', status: '201 OK' }, 
        { method: 'WSS', route: '/ws/stream/events', color: '#a855f7', status: '101 SW' }, 
        { method: 'GET', route: '/api/v1/sys/health', color: '#38bdf8', status: '304 CA' }
      ];
      const r = rotas[Math.floor(Math.random() * rotas.length)];
      const geo = locs[Math.floor(Math.random() * locs.length)];
      setApiTraffic(prev => [...prev.slice(-40), { id: Date.now() + Math.random(), method: r.method, color: r.color, route: r.route, status: r.status, geo, ip: `192.168.${Math.floor(Math.random()*10)}.${Math.floor(Math.random() * 255)}`, ms: Math.floor(Math.random() * 40)+5 }]);
    }, isOverclocked ? 100 : 250);

    const i3 = setInterval(() => {
      if(sysConfig.maintenanceMode) return;
      const ataques = ['TENTATIVA_INJEÇÃO_SQL', 'DDOS_SYN_FLOOD', 'BRUTE_FORCE_JWT', 'PATH_TRAVERSAL'];
      const ips = [`45.33.${Math.floor(Math.random() * 255)}.12`, `188.166.${Math.floor(Math.random() * 255)}.55`, `104.28.${Math.floor(Math.random() * 255)}.1`];
      const geo = locs[Math.floor(Math.random() * locs.length)];
      const atk = `[BLOQUEIO IDS] ASSINATURA: ${ataques[Math.floor(Math.random() * ataques.length)]} -> PACOTE DESCARTADO de ${ips[Math.floor(Math.random() * ips.length)]} (${geo})`;
      setThreats(prev => [...prev.slice(-20), { id: Date.now(), text: atk }]);
    }, isOverclocked ? 1500 : 3500);

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
  }, [sysConfig.maintenanceMode, isOverclocked]);

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

  const handleToggleOverclock = () => {
    setIsOverclocked(!isOverclocked);
    addLog(isOverclocked ? '[SISTEMA] OVERCLOCK DESATIVADO. Retornando ao estado nominal.' : '[SISTEMA] AVISO: OVERCLOCK INICIADO. Injeção de tráfego sintético ativa.', isOverclocked ? 'success' : 'error');
    if (!isOverclocked) showToast('ALERTA: Simulador de Stress Ativado!', 'error');
  };

  const TODOS_MODULOS = [
    { id: 'dashboard', nome: 'Dashboard Operacional' }, { id: 'mapa', nome: 'Planta Digital' }, 
    { id: 'motores', nome: 'Monitorização Térmica' }, { id: 'umidade', nome: 'Monitorização Humidade' },
    { id: 'kanban', nome: 'Gestão Ágil (Kanban)' }, { id: 'metrologia', nome: 'Controlo Metrológico' }, 
    { id: 'equipamentos', nome: 'Máquinas (Hardware IoT)' }, { id: 'chamados', nome: 'Gestão de Incidentes' }, 
    { id: 'relatorios', nome: 'Relatórios Executivos' }, { id: 'historico', nome: 'Auditoria de Logs' }, 
    { id: 'lojas', nome: 'Gestão de Lojas' }, { id: 'usuarios', nome: 'Identidades e Acessos' },
    { id: 'simulador', nome: 'Simulador Edge' }
  ];

  const defconLevel = isOverclocked ? 'MÁXIMO' : (threats.length > 15 ? 'CRÍTICO' : (threats.length > 8 ? 'ELEVADO' : 'SEGURO'));
  const colorPrimary = isOverclocked ? '#ef4444' : '#10b981';
  const colorSec = isOverclocked ? '#f59e0b' : '#38bdf8';
  const defconColor = isOverclocked ? '#ef4444' : (threats.length > 15 ? '#ef4444' : (threats.length > 8 ? '#f59e0b' : '#10b981'));

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
      
      <div className="noc-defcon-bar anim-stagger-1">
        <div className="defcon-title glitch-hover">
          <Globe size={18} color={defconColor} /> TERMOSYNC QUANTUM COMMAND
        </div>
        
        <div className="noc-ticker-container">
          <div className="noc-ticker-text">
            [SYS] Roteamento BGP Estável... [SEC] WAF bloqueou 3 payloads maliciosos... [IOT] 98% dos nós sincronizados em tempo real... [DB] Queries otimizadas em 12ms...
          </div>
        </div>

        <div className="defcon-status-group">
          <button className="btn btn-outline" style={{padding: '4px 12px', minHeight: 'auto', fontSize: '0.7rem', color: isOverclocked ? '#ef4444' : 'white', borderColor: isOverclocked ? '#ef4444' : 'rgba(255,255,255,0.2)'}} onClick={handleToggleOverclock}>
             <Flame size={14} style={{marginRight: '6px'}}/> {isOverclocked ? 'DESATIVAR OVERCLOCK' : 'FORÇAR OVERCLOCK'}
          </button>
          <div className="defcon-badge" style={{ color: colorPrimary, borderColor: `rgba(${isOverclocked?'239,68,68':'16,185,129'},0.3)` }}><Wifi size={14} /> CLUSTER: {isOverclocked ? 'SOBRECARGA' : 'ONLINE'}</div>
          <div className="defcon-badge" style={{ color: colorSec, borderColor: `rgba(${isOverclocked?'245,158,11':'56,189,248'},0.3)` }}><Server size={14} /> NÓS ATIVOS: {clusterNodes.length}</div>
          <div className="defcon-badge" style={{ color: defconColor, borderColor: defconColor, boxShadow: isOverclocked ? `0 0 15px #ef4444` : 'none' }}><ShieldAlert size={14} /> DEFCON: {defconLevel}</div>
        </div>
      </div>

      <div className="noc-hud-grid anim-stagger-1">
        <div className="noc-hud-card" style={{'--card-color': colorPrimary}}>
           <div className="noc-mini-header"><span className="noc-kpi-title"><Cpu size={14}/> USO DE CPU</span></div>
           <div className="noc-kpi-value">{metrics.cpu}<span className="noc-kpi-unit">%</span></div>
           <RenderSparkline dataKey="cpu" color={colorPrimary} />
        </div>
        <div className="noc-hud-card" style={{'--card-color': colorSec}}>
           <div className="noc-mini-header"><span className="noc-kpi-title"><HardDrive size={14}/> MEMÓRIA (RAM)</span></div>
           <div className="noc-kpi-value" style={{color: colorSec}}>{metrics.ram}<span className="noc-kpi-unit">%</span></div>
           <RenderSparkline dataKey="ram" color={colorSec} />
        </div>
        <div className="noc-hud-card" style={{'--card-color': colorSec}}>
           <div className="noc-mini-header"><span className="noc-kpi-title"><Globe size={14}/> TRÁFEGO</span></div>
           <div className="noc-kpi-value" style={{color: colorSec}}>{metrics.bandwidth}<span className="noc-kpi-unit">Mb/s</span></div>
           <RenderSparkline dataKey="bw" color={colorSec} />
        </div>
        <div className="noc-hud-card" style={{'--card-color': '#a855f7'}}>
           <div className="noc-mini-header"><span className="noc-kpi-title"><Database size={14}/> QUERIES DB</span></div>
           <div className="noc-kpi-value" style={{color: '#a855f7'}}>{metrics.dbQps}<span className="noc-kpi-unit">QPS</span></div>
           <RenderSparkline dataKey="db" color="#a855f7" />
        </div>
      </div>

      <div className="noc-main-grid anim-stagger-2">
        <div className="cyber-panel">
          <div className="cyber-panel-header glitch-hover">
             <div style={{display:'flex', gap:'8px', alignItems:'center'}}>Osciloscópio de Rede</div>
             <span style={{fontSize: '0.8rem', color: 'var(--bg-dark)', fontWeight: '900', fontFamily: 'JetBrains Mono', background: 'var(--theme-main)', padding: '4px 10px', borderRadius: '6px'}}>{sysConfig.maintenanceMode ? '0' : metrics.reqs} REQ/s</span>
          </div>
          <div className="noc-chart-grid">
            <div className="noc-chart-box">
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <AreaChart data={metricHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCpuBig" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={colorPrimary} stopOpacity={0.6}/><stop offset="95%" stopColor={colorPrimary} stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorRamBig" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={colorSec} stopOpacity={0.6}/><stop offset="95%" stopColor={colorSec} stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <YAxis tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0', color: 'white', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="cpu" stroke={colorPrimary} strokeWidth={2} fillOpacity={1} fill="url(#colorCpuBig)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="ram" stroke={colorSec} strokeWidth={2} fillOpacity={1} fill="url(#colorRamBig)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="noc-histogram-box">
               <span style={{fontSize: '0.65rem', fontWeight: 'bold', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px'}}>Distribuição (API)</span>
               <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <BarChart data={latencyData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="range" tick={{fontSize: 9, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 9, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {latencyData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={index > 2 ? '#ef4444' : colorSec} /> ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="cyber-panel">
          <div className="cyber-panel-header glitch-hover"><div style={{display:'flex', gap:'8px', alignItems:'center'}}><Target size={18} /> Topologia Avançada (Sonar)</div></div>
          <div className="cluster-topology-grid">
            {clusterNodes.map(node => (
              <div key={node.id} className="cluster-data-block" style={{'--status-color': node.status === 'online' ? colorPrimary : '#ef4444'}}>
                <div className="block-header">
                  <span className="block-name"><Server size={14} color="var(--status-color)"/> {node.name}</span>
                  <span className="block-ping" style={{color: 'var(--status-color)'}}>{node.ping}ms</span>
                </div>
                <span className="block-role" style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{node.role}</span>
              </div>
            ))}
          </div>
          <div className="radar-container">
            <div className="radar-grid"></div>
            <div className="radar-sweep"></div>
            <div className="radar-node" data-tooltip="Node Alpha: 12ms" style={{top: '30%', left: '40%'}}></div>
            <div className="radar-node" data-tooltip="Node Beta: 14ms" style={{top: '60%', left: '70%', animationDelay: '0.5s'}}></div>
            <div className="radar-node" data-tooltip="Master Core: 2ms" style={{top: '50%', left: '50%', background: colorPrimary, boxShadow: `0 0 15px ${colorPrimary}`, width: '8px', height: '8px', animation: 'none'}}></div>
            <div className="radar-node" data-tooltip="Failover: 118ms" style={{top: '20%', left: '80%', background: '#ef4444', animationDelay: '1s'}}></div>
          </div>
        </div>
      </div>

      <div className="noc-terminals-grid anim-stagger-3">
        <div className="cyber-terminal">
          <div className="cyber-terminal-header"><div className="cyber-terminal-title">BASH - ROTEAMENTO (LIVE)</div></div>
          <div className="terminal-scroll" ref={trafficContainerRef}>
            {sysConfig.maintenanceMode ? (
               <div style={{color: 'var(--dim-text)', textAlign: 'center', margin: 'auto', fontStyle: 'italic'}}>Rotas BGP Suspensas</div>
            ) : (
              apiTraffic.map((pkt) => (
                <div key={pkt.id} className="terminal-line">
                  <span className="log-method" style={{color: isOverclocked ? 'white' : pkt.color, background: isOverclocked ? '#ef4444' : 'rgba(255,255,255,0.05)'}}>{pkt.method}</span> 
                  <span className="log-geo">[{pkt.geo}]</span>
                  <span className="log-route text-truncate">{pkt.route}</span> 
                </div>
              ))
            )}
          </div>
        </div>

        <div className="cyber-terminal" style={{borderColor: 'rgba(245, 158, 11, 0.4)', boxShadow: 'inset 0 0 30px rgba(245, 158, 11, 0.1)'}}>
          <div className="cyber-terminal-header" style={{borderBottomColor: 'rgba(245, 158, 11, 0.4)'}}><div className="cyber-terminal-title" style={{color: '#f59e0b'}}><AlertCircle size={14} /> ALERTAS ATIVOS</div></div>
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

        <div className="cyber-terminal" style={{borderColor: '#ef4444', boxShadow: isOverclocked ? 'inset 0 0 50px rgba(239,68,68,0.3)' : 'inset 0 0 30px rgba(0,0,0,0.8)'}}>
          <div className="cyber-terminal-header" style={{borderBottomColor: 'rgba(239, 68, 68, 0.4)'}}>
            <div className="cyber-terminal-title" style={{color: '#ef4444', display: 'flex', justifyContent: 'space-between', width: '100%'}}>
              <span>LOGS SEGURANÇA WAF</span>
              <span className="defcon-badge" style={{background: `rgba(239,68,68,0.2)`, color: '#ef4444', border: `1px solid #ef4444`}}>NÍVEL: {defconLevel}</span>
            </div>
          </div>
          <div className="terminal-scroll" ref={wafContainerRef} style={{ color: '#ef4444' }}>
            {threats.map((pkt) => <div key={pkt.id} className="terminal-line log-error"><span style={{ marginRight: '4px' }}>✖</span> {pkt.text}</div>)}
          </div>
        </div>
      </div>

      <div className="switchboard-grid anim-stagger-3">
        <div className="switch-panel">
          <div className="switch-panel-title"><ShieldCheck size={14}/> GESTÃO DE IDENTIDADE (IAM)</div>
          <div className="scope-types">
            <button className={scopeType === 'ROLE' ? 'active' : ''} onClick={() => setScopeType('ROLE')}>POR CARGO</button>
            <button className={scopeType === 'USER' ? 'active' : ''} onClick={() => setScopeType('USER')}>POR UTILIZADOR</button>
          </div>
          <div className="scope-targets" style={{marginTop: 'auto'}}>
            {scopeType === 'ROLE' && (
              <div className="scope-tabs">
                <button className={activeScope === 'GLOBAL' ? 'active' : ''} onClick={() => setActiveScope('GLOBAL')}>Global</button>
                <button className={activeScope === 'ADMIN' ? 'active' : ''} onClick={() => setActiveScope('ADMIN')}>Admins</button>
                <button className={activeScope === 'LOJA' ? 'active' : ''} onClick={() => setActiveScope('LOJA')}>Lojistas</button>
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
          <div className="switch-panel-title">
            <div style={{display:'flex', gap:'6px'}}><Settings2 size={14}/> MATRIZ DE UI</div>
            <span className="status-badge" style={{background: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px 6px', fontSize: '0.65rem'}}>{TODOS_MODULOS.length - (regrasAtivas?.modulosOcultos?.length || 0)}/{TODOS_MODULOS.length}</span>
          </div>
          <div className="modulos-list">
            {TODOS_MODULOS.slice(0, 4).map(m => {
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
          <div className="switch-panel-title" style={{color: '#ef4444'}}><Flame size={14}/> PROTOCOLOS DE EMERGÊNCIA</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center', height: '100%'}}>
            <button className="btn-emergency warning" onClick={() => executarAcaoEmergencia('LIMPAR CACHE REDIS')} disabled={actionLoading !== null || sysConfig.maintenanceMode}>
               {actionLoading === 'LIMPAR CACHE REDIS' ? <Loader2 size={16} className="spin"/> : <RefreshCw size={16}/>} 
               {actionLoading === 'LIMPAR CACHE REDIS' ? 'A EXECUTAR...' : 'LIMPAR CACHE REDIS'}
            </button>
            <button className="btn-emergency" onClick={() => executarAcaoEmergencia('REINICIAR PODS DOCKER')} disabled={actionLoading !== null || sysConfig.maintenanceMode}>
               {actionLoading === 'REINICIAR PODS DOCKER' ? <Loader2 size={16} className="spin"/> : <ServerCrash size={16}/>} 
               {actionLoading === 'REINICIAR PODS DOCKER' ? 'A REINICIAR NOS...' : 'REINICIAR PODS DOCKER'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TELA DE CONTROLO DO SISTEMA (CONFIGURAÇÕES GLOBAIS)
// ============================================================================
const TelaSistema = ({ api, showToast, addLog, sysConfig, updateSysConfig, setModalConfig, isOverclocked }) => {
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
      message: 'Tem a certeza de que deseja apagar permanentemente todos os registos de telemetria com mais de 90 dias da base de dados MySQL? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        setIsPurging(true);
        try {
          const res = await api.post('/system/purge', { dias: 90 });
          showToast(`Registos antigos apagados com sucesso.`, 'success');
          addLog(`[DB] Exclusão executada: ${res.data?.deleted || 0} linhas removidas do cluster MySQL.`, 'warning');
          setStorageUsed(12);
        } catch (e) { showToast('Falha na exclusão.', 'error'); }
        setIsPurging(false);
      }
    });
  };

  const exportarTabelaReal = async (nomeTabela) => {
    setIsExporting(nomeTabela);
    addLog(`[DB] A iniciar extração estruturada da tabela: ${nomeTabela}...`, 'info');
    showToast(`A pesquisar ${nomeTabela} na base de dados...`, 'info');
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
      showToast('Falha ao aceder à base de dados.', 'error');
      addLog(`[DB ERR] Ligação recusada ao tentar extrair ${nomeTabela}.`, 'error');
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
            <div className="dev-card-header" style={{color: '#f59e0b', flexWrap: 'wrap'}}><Radio size={24}/><h3>Controlo de Operações Globais</h3></div>
            <div style={{position: 'relative', zIndex: 2}}>
              <div className={`sys-status-banner ${sysConfig.maintenanceMode ? 'sys-status-offline' : 'sys-status-online'}`}>
                {sysConfig.maintenanceMode ? <AlertOctagon size={20} /> : <ShieldCheck size={20} />}
                STATUS CORE: {sysConfig.maintenanceMode ? 'LOCKDOWN (OFFLINE)' : 'OPERACIONAL (ONLINE)'}
              </div>
              <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '10px', fontWeight: 'bold'}}>Transmissão Global (Broadcast Tático):</p>
              <textarea className="transmit-box" value={globalBanner} onChange={e => setGlobalBanner(e.target.value)} placeholder="> INSERIR DIRETIVA GLOBAL AQUI_" spellCheck="false" />
              <button className="btn btn-primary w-100" onClick={() => { updateSysConfig('ROLE', 'GLOBAL', 'features', 'globalBanner', globalBanner); showToast('Comunicado emitido.', 'success'); addLog('Mensagem Global transmitida na rede.', 'info'); }} style={{marginBottom: '30px', backgroundColor: '#f59e0b'}}><Send size={18} style={{marginRight: '8px'}}/> TRANSMITIR MENSAGEM</button>
              <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '10px', fontWeight: 'bold'}}>Interruptor de Segurança Crítica:</p>
              <button className={`btn w-100 ${sysConfig.maintenanceMode ? 'btn-success' : 'btn-danger pulse-danger-btn'}`} onClick={handleMaintenance}>
                {sysConfig.maintenanceMode ? <><Unlock size={22} /> DESBLOQUEAR SISTEMA</> : <><Lock size={22} /> INICIAR LOCKDOWN CRÍTICO</>}
              </button>
            </div>
          </div>
        </div>

        <div className="dev-col-right">
          <div className="sys-control-card primary">
             <div className="dev-card-header" style={{color: 'var(--theme-sec)', flexWrap: 'wrap'}}><Database size={24}/><h3>Pipelines de Extração (MySQL)</h3></div>
             <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.5'}}>Extraia blocos brutos das partições MySQL para backups frios locais (formato CSV nativo).</p>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <button onClick={() => exportarTabelaReal('equipamentos')} disabled={isExporting !== null} className="btn btn-outline w-100" style={{justifyContent: 'flex-start', padding: '16px', borderRadius: '8px'}}><Loader2 size={18} className={isExporting === 'equipamentos' ? 'spin' : 'd-none'} /> <Server size={18} color="var(--theme-sec)"/> DUMP TABELA: EQUIPAMENTOS EDGE</button>
               <button onClick={() => exportarTabelaReal('leituras_telemetria')} disabled={isExporting !== null} className="btn btn-outline w-100" style={{justifyContent: 'flex-start', padding: '16px', borderRadius: '8px'}}><Loader2 size={18} className={isExporting === 'leituras_telemetria' ? 'spin' : 'd-none'} /> <Activity size={18} color="var(--theme-main)"/> DUMP TABELA: TELEMETRIA CONTÍNUA</button>
             </div>
          </div>

          <div className="sys-control-card danger">
            <div className="dev-card-header" style={{color: '#ef4444', position: 'relative', zIndex: 2, flexWrap: 'wrap'}}><ServerCrash size={24}/><h3>Purga Base de Dados</h3></div>
            <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '15px', position: 'relative', zIndex: 2, lineHeight: '1.5'}}>Operação destrutiva: Força a libertação de inodes no disco apagando registos de telemetria com mais de 90 dias (irreversível).</p>
            <div style={{marginBottom: '25px', position: 'relative', zIndex: 2}}>
               <div className="storage-info" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}><span style={{ color: '#cbd5e1' }}>Consumo Volume DB</span><span style={{ color: storageUsed > 80 ? '#ef4444' : 'var(--theme-main)' }}>{storageUsed}% / 100%</span></div>
               <div className="storage-bar-bg" style={{ height: '10px' }}><div className="storage-bar-fill" style={{ width: `${storageUsed}%`, background: storageUsed > 80 ? '#ef4444' : 'var(--theme-main)' }}></div></div>
            </div>
            <button className="btn btn-outline w-100" onClick={handlePurge} disabled={isPurging} style={{color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', padding: '16px', borderRadius: '8px'}}>{isPurging ? <Loader2 size={18} className="spin"/> : <Eraser size={18}/>} A EXECUTAR PURGA...</button>
            <div className="hazard-stripes"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TELA SAAS E MULTITENANCY
// ============================================================================
const TelaSaaS = ({ api, sysConfig, updateSysConfig, filiaisDb, showToast, addLog, setModalConfig }) => {
  const handleMudarPlano = (loja, plano) => { updateSysConfig(null, loja, 'saas_plan', null, plano); addLog(`[SAAS] Contrato de ${loja} alterado para ${plano}.`, plano === 'SUSPENSO' ? 'error' : 'success'); showToast(`Licença de ${loja} atualizada.`, plano === 'SUSPENSO' ? 'error' : 'success'); };
  const handleMudarRetencao = (loja, dias) => { addLog(`[CLOUD] Limite de retenção de ${loja} ajustado para ${dias} dias.`, 'info'); showToast(`Cluster de dados de ${loja} ajustado.`, 'success'); };

  const handleForcarLogout = (loja) => {
    setModalConfig({
      isOpen: true,
      title: 'Forçar Logout Remoto',
      message: `Tem a certeza de que deseja acionar o Kill Switch para a organização ${loja}? Todos os utilizadores locais serão desconectados instantaneamente.`,
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
    addLog(`[AUTH] A solicitar token de Impersonate para ${loja}...`, 'warning');
    showToast(`A gerar acesso remoto...`, 'warning');
    try {
      const res = await api.post('/impersonate', { filialDestino: loja }); // <-- Modificado o caminho aqui também por segurança
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
            <div>Organização / Cliente</div><div>Armazenamento na Nuvem</div><div style={{ textAlign: 'center' }}>Chaves API (Webhooks)</div><div style={{ textAlign: 'center' }}>Licença (Acesso)</div><div style={{ textAlign: 'right' }}>Ações</div>
          </div>
          <div style={{maxHeight: '65vh', overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px'}}>
            {filiaisDb?.map((filial, index) => {
              const planoAtual = sysConfig.planos?.[filial] || 'FREE';
              const isSuspenso = planoAtual === 'SUSPENSO';
              const storagePercent = isSuspenso ? 0 : (planoAtual === 'FREE' ? 85 : (planoAtual === 'PRO' ? 45 : 15));
              const storageColor = storagePercent > 80 ? 'var(--danger)' : (storagePercent > 50 ? 'var(--warning)' : 'var(--theme-main)');

              return (
                <div className={`saas-client-row saas-grid-cols ${isSuspenso ? 'row-suspended' : ''}`} key={index}>
                  <div className="text-truncate" style={{ color: isSuspenso ? 'var(--danger)' : 'white', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.1rem' }}>
                    {isSuspenso ? <ZapOff size={18} /> : <Store size={18} />} {filial}
                  </div>
                  <div style={{ paddingRight: '15px' }}>
                    <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${storagePercent}%`, backgroundColor: storageColor }}></div></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--dim-text)', display: 'flex', alignItems: 'center', gap: '4px' }}><Cloud size={12} /> {storagePercent}%</span>
                      <select disabled={isSuspenso} onChange={(e) => handleMudarRetencao(filial, e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.8rem', color: 'var(--theme-sec)', outline: 'none', cursor: 'pointer', fontWeight: '800' }}>
                        <option value="30">30 Dias</option><option value="90">90 Dias</option><option value="365">1 Ano</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {chavesAPI[filial] ? (
                      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(168, 85, 247, 0.3)', maxWidth: '100%' }}>
                        <span className="text-truncate" style={{ fontFamily: 'JetBrains Mono', fontSize: '0.9rem', color: '#a855f7', padding: '10px 14px', fontWeight: 'bold', maxWidth: '140px' }}>{chavesAPI[filial].substring(0, 10)}...</span>
                        <button onClick={() => copyToClipboard(filial, chavesAPI[filial])} style={{ background: '#a855f7', border: 'none', color: 'white', padding: '10px 14px', cursor: 'pointer' }}>{copiedKey === filial ? <Check size={16}/> : <Copy size={16}/>}</button>
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
                    <button className="btn-icon-small" title="Aceder Como Cliente (Impersonate)" onClick={() => loginAs(filial)}><UserCheck size={18} /></button>
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
// TELA BILLING (FINANCEIRO E FATURAMENTO)
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
    return [{ mes: 'Out', receita: m * 0.4 }, { mes: 'Nov', receita: m * 0.55 }, { mes: 'Dez', receita: m * 0.7 }, { mes: 'Jan', receita: m * 0.8 }, { mes: 'Fev', receita: m * 0.95 }, { mes: 'Mar (Atual)', receita: m }];
  }, [metricasFinanceiras.mrr]);

  const confirmarPagamento = (filial) => {
    setModalConfig({
      isOpen: true, title: 'Confirmar Liquidação de Fatura',
      message: `Confirma a receção do pagamento da organização ${filial}? Isso alterará o status para PAGO e reativará automaticamente o acesso do cliente caso ele esteja bloqueado.`,
      onConfirm: () => {
        setFaturasPagasManualmente(prev => [...prev, filial]);
        const planoAtual = sysConfig.planos?.[filial];
        if (planoAtual === 'SUSPENSO') {
          updateSysConfig(null, filial, 'saas_plan', null, 'PRO'); addLog(`[FINANCEIRO] Fatura de ${filial} liquidada. Serviço SaaS reativado.`, 'success');
        } else { addLog(`[FINANCEIRO] Fatura de ${filial} liquidada.`, 'success'); }
        showToast('Pagamento confirmado com sucesso.', 'success');
      }
    });
  };

  const drawBarcode = (doc, x, y, width, height) => {
    let currentX = x; doc.setFillColor(0, 0, 0);
    while (currentX < x + width) {
      let barWidth = Math.random() > 0.5 ? 0.5 : 1.5;
      if (currentX + barWidth > x + width) break;
      doc.rect(currentX, y, barWidth, height, 'F');
      currentX += barWidth + (Math.random() > 0.5 ? 0.6 : 1.2);
    }
  };

  const simularGeracao = (tipo, filial, callback) => {
    setIsGenerating(`${tipo}_${filial}`); showToast(`A gerar documento de ${tipo}...`, 'info');
    setTimeout(() => { callback(); setIsGenerating(null); }, 1200);
  };

  const gerarNotaFiscalPDF = (filial, fatura) => {
    simularGeracao('NFe', filial, () => {
      const doc = new jsPDF('p', 'mm', 'a4');
      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("PREFEITURA MUNICIPAL", 105, 20, { align: "center" });
      doc.setFontSize(12); doc.text("NOTA FISCAL DE SERVIÇOS ELETRÓNICA - NFS-e", 105, 28, { align: "center" });
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
          <div className="dev-card glass-card saas-kpi-card" style={{ margin: 0, borderLeft: '4px solid var(--theme-main)', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ color: 'var(--theme-main)', background: 'rgba(16, 185, 129, 0.1)', padding: '15px', borderRadius: '12px' }}><TrendingUp size={32} /></div>
            <div>
              <span style={{fontSize: '0.8rem', fontWeight: '900', color: 'var(--dim-text)', textTransform: 'uppercase', letterSpacing: '1px'}}>MRR ESTIMADO (MENSAL)</span>
              <div style={{color: 'white', fontFamily: 'JetBrains Mono', fontSize: '2rem', fontWeight: '900'}}>R$ {metricasFinanceiras.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div className="dev-card glass-card saas-kpi-card" style={{ margin: 0, borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '12px' }}><AlertTriangle size={32} /></div>
            <div>
              <span style={{fontSize: '0.8rem', fontWeight: '900', color: 'var(--dim-text)', textTransform: 'uppercase', letterSpacing: '1px'}}>DÍVIDA DE CLIENTES</span>
              <div style={{ color: 'var(--danger)', fontFamily: 'JetBrains Mono', fontSize: '2rem', fontWeight: '900' }}>R$ {metricasFinanceiras.inadimplencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>
        <div className="dev-card glass-card" style={{ margin: 0, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
          <div className="dev-card-header" style={{ color: 'var(--theme-main)', marginBottom: '10px' }}><LineChart size={20} /> <h3 style={{ fontSize: '1rem' }}>Evolução do MRR (6 Meses)</h3></div>
          <div className="chart-container" style={{ flex: 1, margin: 0, minHeight: '140px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dadosGraficoReceita} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs><linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--theme-main)" stopOpacity={0.3} /><stop offset="95%" stopColor="var(--theme-main)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="mes" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: 'white', fontSize: '12px' }} itemStyle={{ color: 'var(--theme-main)', fontWeight: 'bold' }} formatter={(value) => `R$ ${value.toFixed(2)}`} />
                <Area type="monotone" dataKey="receita" stroke="var(--theme-main)" strokeWidth={3} fillOpacity={1} fill="url(#colorMrr)" />
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
                  <div style={{ color: 'var(--dim-text)', fontSize: '1rem' }}>R$ {fatura.base.toFixed(2)}</div>
                  <div style={{ color: isLate ? 'var(--danger)' : 'var(--dim-text)', fontSize: '1rem' }}>R$ {(fatura.multa + fatura.juros).toFixed(2)}</div>
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
// 8. TELA SOC & GESTÃO DE IDENTIDADE (IAM / ZERO-TRUST) - COM GRÁFICO E CSV
// ============================================================================
const TelaSOC = ({ api, showToast, addLog, setModalConfig, usuariosLista }) => {
  const [activeSessions, setActiveSessions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  
  const [isModalUserOpen, setIsModalUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ nome: '', email: '', role: 'LOJA', mfa: true });

  const [localRbac, setLocalRbac] = useState(() => {
    const saved = localStorage.getItem('termosync_rbac_rules');
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Acesso Shell / Root (NOC)', dev: true, admin: true, loja: false, manutencao: false },
      { id: 2, name: 'Gestão de Faturação e Tenants', dev: true, admin: true, loja: false, manutencao: false },
      { id: 3, name: 'Comandos Destrutivos (Purga DB)', dev: true, admin: false, loja: false, manutencao: false },
      { id: 4, name: 'Visualização Térmica (Heatmap)', dev: true, admin: true, loja: true, manutencao: true },
      { id: 5, name: 'Tratar Incidentes e Alarmes (OS)', dev: true, admin: true, loja: false, manutencao: true }
    ];
  });

  const [mfaUsers, setMfaUsers] = useState(() => JSON.parse(localStorage.getItem('termosync_mfa_users')) || []);
  const [blockedUsers, setBlockedUsers] = useState(() => JSON.parse(localStorage.getItem('termosync_blocked_users')) || []);

  const carregarDadosSOC = useCallback(async () => {
    try {
      const [resSessoes, resAuditoria] = await Promise.all([api.get('/soc/sessoes'), api.get('/soc/auditoria')]);
      
      setActiveSessions(resSessoes.data.map(s => { 
        const loginDate = new Date(s.loginTime);
        const expiryDate = new Date(loginDate.getTime() + 12 * 60 * 60 * 1000); 
        const minLeft = Math.max(0, Math.floor((expiryDate - new Date()) / 60000));
        const expPercent = Math.min(100, Math.max(0, (minLeft / (12 * 60)) * 100));

        return {
          ...s, 
          loginTimeStr: loginDate.toLocaleString('pt-BR'),
          expirationMin: minLeft,
          expirationPercent: expPercent,
          device: 'Web Client'
        };
      }));

      setAuditLogs(resAuditoria.data.map(a => ({ 
        ...a, 
        time: new Date(a.data_hora).toLocaleString('pt-BR'),
        severity: a.severity || 'info'
      })));
    } catch (e) { } finally { setIsLoading(false); }
  }, [api]);

  useEffect(() => {
    carregarDadosSOC();
    const interval = setInterval(carregarDadosSOC, 10000);
    return () => clearInterval(interval);
  }, [carregarDadosSOC]);

  const diretorioUsuarios = useMemo(() => {
    return (usuariosLista || []).map(u => {
      const session = activeSessions.find(s => s.usuario === u.usuario);
      return {
        id: u.id,
        nome: u.nome_tecnico || u.nome_gerente || u.nome_coordenador || u.usuario,
        usuario: u.usuario,
        role: u.role,
        cargo: u.role === 'DEV' ? 'SysAdmin' : (u.role === 'ADMIN' ? 'Administrador' : (u.role === 'MANUTENCAO' ? 'Técnico' : 'Operador')),
        mfa: mfaUsers.includes(u.id),
        status: blockedUsers.includes(u.id) ? 'BLOQUEADO' : 'ATIVO',
        ip: session ? (session.ip === '::1' ? 'Localhost' : session.ip) : 'Offline'
      };
    });
  }, [usuariosLista, activeSessions, mfaUsers, blockedUsers]);

  const filteredUsuarios = diretorioUsuarios.filter(u => 
    u.nome.toLowerCase().includes(buscaUsuario.toLowerCase()) || 
    u.role.toLowerCase().includes(buscaUsuario.toLowerCase()) ||
    u.cargo.toLowerCase().includes(buscaUsuario.toLowerCase())
  );

  const contasAtivas = diretorioUsuarios.filter(u => u.status === 'ATIVO').length;
  const tokensValidos = activeSessions.length;
  const tentativasFalhadas = auditLogs.filter(l => l.action === 'LOGIN_FAILED').length;
  const ipsBloqueados = new Set(auditLogs.filter(l => l.action === 'LOGIN_FAILED').map(l => l.actor)).size;
  const score = Math.max(0, 100 - (auditLogs.filter(l => l.severity === 'danger').length * 5));

  // --- NOVA ESTATÍSTICA PARA O GRÁFICO ---
  const severityData = useMemo(() => {
    return [
      { name: 'Info', count: auditLogs.filter(l => l.severity === 'info').length, fill: '#38bdf8' },
      { name: 'Aviso', count: auditLogs.filter(l => l.severity === 'warning').length, fill: '#f59e0b' },
      { name: 'Crítico', count: auditLogs.filter(l => l.severity === 'danger').length, fill: '#ef4444' },
      { name: 'Sucesso', count: auditLogs.filter(l => l.severity === 'success').length, fill: '#10b981' }
    ];
  }, [auditLogs]);

  const handleRevoke = (id, user) => {
    setModalConfig({
      isOpen: true,
      title: 'Revogar Acesso JWT',
      message: `Deseja realmente derrubar a ligação em tempo real do utilizador ${user}? O token JWT será invalidado imediatamente e registado na auditoria.`,
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

  const handleRevokeAll = () => {
    setModalConfig({
      isOpen: true,
      title: 'Purga Global de Sessões (Kill-Switch)',
      message: `ATENÇÃO: Isto irá invalidar TODOS os tokens JWT ativos no momento e forçar o logout de todos os utilizadores da plataforma instantaneamente. Proceder com a purga?`,
      onConfirm: () => {
        setActiveSessions([]);
        showToast('Todas as sessões foram terminadas com sucesso.', 'success');
        addLog('[SECURITY] Kill-switch global ativado. Zero-Trust em vigor.', 'error');
      }
    });
  };

  const toggleRbac = (id, roleKey) => {
    const newRules = localRbac.map(p => p.id === id ? { ...p, [roleKey]: !p[roleKey] } : p);
    setLocalRbac(newRules);
    localStorage.setItem('termosync_rbac_rules', JSON.stringify(newRules));
    addLog(`[IAM] Política de Acesso Atualizada para a role: ${roleKey.toUpperCase()}`, 'warning');
    showToast('Política RBAC atualizada.', 'success');
  };

  const handleMfaAction = (id, nome) => {
    const newMfa = mfaUsers.includes(id) ? mfaUsers.filter(uid => uid !== id) : [...mfaUsers, id];
    setMfaUsers(newMfa);
    localStorage.setItem('termosync_mfa_users', JSON.stringify(newMfa));
    showToast(`Configuração MFA alterada para ${nome}.`, 'info');
    addLog(`[IAM] Diretiva de MFA atualizada para: ${nome}`, 'warning');
  };

  const handleBlockAction = (id, nome) => {
    const isBlocked = blockedUsers.includes(id);
    const newBlocked = isBlocked ? blockedUsers.filter(uid => uid !== id) : [...blockedUsers, id];
    setBlockedUsers(newBlocked);
    localStorage.setItem('termosync_blocked_users', JSON.stringify(newBlocked));
    
    if (isBlocked) {
       addLog(`[IAM] Utilizador ${nome} desbloqueado.`, 'success');
       showToast('Utilizador desbloqueado.', 'success');
    } else {
       addLog(`[IAM] Utilizador ${nome} bloqueado preventivamente.`, 'error');
       showToast('Utilizador bloqueado.', 'warning');
       const userBase = usuariosLista.find(u => u.id === id);
       const session = activeSessions.find(s => s.usuario === userBase?.usuario);
       if (session) {
           api.post(`/soc/revogar/${session.id}`).then(() => carregarDadosSOC()).catch(()=>{});
       }
    }
  };

  const salvarNovoUsuario = async (e) => {
    e.preventDefault();
    if (!newUser.nome.trim() || !newUser.email.trim()) return showToast('Nome e e-mail são obrigatórios.', 'error');
    try {
        const payload = {
           usuario: newUser.email.split('@')[0],
           senha: 'Mudar@123',
           role: newUser.role,
           nome_tecnico: newUser.role === 'MANUTENCAO' ? newUser.nome : null,
           nome_gerente: newUser.role === 'LOJA' ? newUser.nome : null,
           filial: 'Matriz'
        };
        await api.post('/usuarios', payload);
        addLog(`[IAM] Nova credencial provisionada na DB: ${newUser.nome} (${newUser.role})`, 'success');
        showToast('Utilizador criado! Senha provisória: Mudar@123', 'success');
        setIsModalUserOpen(false);
        setNewUser({ nome: '', email: '', role: 'LOJA', mfa: true });
    } catch (err) {
        showToast('Erro ao gravar na Base de Dados.', 'error');
    }
  };

  // ✅ Função de CSV restaurada para dentro do componente
  const exportarLogsCSV = () => {
    if (auditLogs.length === 0) return showToast('Não existem registos para exportar.', 'warning');
    let csvContent = "Data/Hora,Ação Realizada,Ator,Alvo,Severidade\n";
    auditLogs.forEach(log => { csvContent += `"${log.time}","${log.action}","${log.actor}","${log.target}","${(log.severity || 'info').toUpperCase()}"\n`; });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Auditoria_ZeroTrust_SOC_${Date.now()}.csv`;
    link.click();
    showToast('Logs exportados em CSV.', 'success');
    addLog('[SOC] Exportação de ficheiro CSV de Auditoria concluída.', 'success');
  };

  return (
    <>
      <div className="dev-tela-scroll">
        <div className="noc-hud-grid anim-stagger-1">
          <div className="noc-hud-card" style={{'--card-color': '#a855f7'}}>
            <div className="noc-mini-header"><span className="noc-kpi-title"><Users size={14}/> CONTAS ATIVAS</span></div>
            <div className="noc-kpi-value">{contasAtivas}</div>
          </div>
          <div className="noc-hud-card" style={{'--card-color': '#10b981'}}>
            <div className="noc-mini-header"><span className="noc-kpi-title"><ShieldCheck size={14}/> TOKENS VÁLIDOS</span></div>
            <div className="noc-kpi-value" style={{color: '#10b981'}}>{tokensValidos}</div>
          </div>
          <div className="noc-hud-card pulse-warning-card" style={{'--card-color': '#f59e0b'}}>
            <div className="noc-mini-header"><span className="noc-kpi-title"><UserX size={14}/> TENTATIVAS FALHADAS</span></div>
            <div className="noc-kpi-value" style={{color: '#f59e0b'}}>{tentativasFalhadas}</div>
          </div>
          <div className="noc-hud-card" style={{'--card-color': '#ef4444'}}>
            <div className="noc-mini-header"><span className="noc-kpi-title"><AlertTriangle size={14}/> IPS BLOQUEADOS</span></div>
            <div className="noc-kpi-value" style={{color: '#ef4444'}}>{ipsBloqueados}</div>
          </div>
        </div>

        <div className="dev-grid-main anim-stagger-2">
          <div className="dev-col-left">
            <div className="dev-card glass-card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid #38bdf8' }}>
              <div className="dev-card-header flex-between" style={{color: '#38bdf8', padding: '1.5rem', marginBottom: 0, flexWrap: 'wrap'}}>
                <div style={{display:'flex', gap:'8px', alignItems:'center', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap'}}>
                  <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                    <UserCog size={24}/><h3>Diretório (AD)</h3>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                    <div className="iam-search-box">
                      <Search size={14} color="#64748b" />
                      <input type="text" placeholder="Procurar utilizador..." value={buscaUsuario} onChange={e => setBuscaUsuario(e.target.value)} />
                    </div>
                    <button className="btn btn-outline" onClick={() => setIsModalUserOpen(true)} style={{padding: '8px 12px', fontSize: '0.75rem', borderColor: 'rgba(56,189,248,0.3)', color: '#38bdf8', minHeight: '34px'}}>
                      <UserPlus size={14} style={{marginRight: '6px'}}/> Novo
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="table-responsive-wrapper">
                <div className="saas-table-header iam-ad-grid-cols">
                  <div>Utilizador / Cargo</div><div>Role do Sistema</div><div>Status / MFA</div><div>Último IP</div><div style={{textAlign: 'right'}}>Ações</div>
                </div>
                
                <div style={{maxHeight: '40vh', overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px'}}>
                  {filteredUsuarios.map((u) => (
                    <div key={u.id} className={`saas-client-row iam-ad-grid-cols ${u.status === 'BLOQUEADO' ? 'row-suspended' : ''}`}>
                      <div className="user-profile-cell">
                        <div className={`user-avatar ${u.role.toLowerCase()}`}>{u.nome.charAt(0)}</div>
                        <div style={{minWidth: 0}}>
                          <div className="text-truncate" style={{fontWeight: '900', color: 'white', fontSize: '1.05rem'}}>{u.nome}</div>
                          <div className="text-truncate" style={{fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px'}}>{u.cargo}</div>
                        </div>
                      </div>
                      <div><span className={`role-badge ${u.role.toLowerCase()}`}>{u.role}</span></div>
                      <div>
                        {u.mfa ? <span className="badge-mfa mfa-on"><ShieldCheck size={12}/> MFA ATIVO</span> : (u.status === 'BLOQUEADO' ? <span className="badge-mfa mfa-danger"><LockKeyhole size={12}/> BLOQUEADO</span> : <span className="badge-mfa mfa-off"><ShieldAlert size={12}/> SEM MFA</span>)}
                      </div>
                      <div style={{fontFamily: 'JetBrains Mono', color: 'var(--dim-text)', fontSize: '0.85rem'}}>
                        {u.ip} {u.ip !== 'Offline' && <span className="traffic-indicator-live" style={{marginLeft: '4px'}}></span>}
                      </div>
                      <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px'}}>
                        <button className="btn-icon-small" title="Alternar Setup MFA" onClick={() => handleMfaAction(u.id, u.nome)}><ShieldAlert size={16} /></button>
                        <button className={`btn-icon-small ${u.status === 'BLOQUEADO' ? 'success-text' : 'danger-text'}`} title={u.status === 'BLOQUEADO' ? "Desbloquear Conta" : "Bloquear Conta"} onClick={() => handleBlockAction(u.id, u.nome)}>
                          {u.status === 'BLOQUEADO' ? <Unlock size={16} color="#10b981" /> : <UserX size={16} />}
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredUsuarios.length === 0 && <div style={{padding: '2rem', textAlign: 'center', color: 'var(--dim-text)'}}>Nenhum utilizador encontrado na Base de Dados.</div>}
                </div>
              </div>
            </div>
          </div>

          <div className="dev-col-right">
            <div className="dev-card glass-card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid #a855f7' }}>
              <div className="dev-card-header flex-between" style={{color: '#a855f7', padding: '1.5rem', marginBottom: 0, flexWrap: 'wrap'}}>
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}><FingerprintIcon size={24}/><h3>Sessões JWT (Live)</h3></div>
                {activeSessions.length > 0 && (
                  <button className="btn btn-outline danger-text" onClick={handleRevokeAll} style={{padding: '8px 12px', fontSize: '0.75rem', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444', minHeight: '34px'}}>
                    <ShieldBan size={14} style={{marginRight: '6px'}}/> Revogar Tudo
                  </button>
                )}
              </div>
              
              <div className="table-responsive-wrapper">
                <div className="saas-table-header soc-grid-cols">
                  <div>Utilizador (Token)</div><div>IP / Device</div><div>Ciclo de Vida</div><div style={{textAlign: 'right'}}>Ação</div>
                </div>
                
                <div style={{maxHeight: '40vh', overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px'}}>
                  {isLoading && <div style={{padding: '3rem', display: 'flex', justifyContent: 'center', color: 'var(--dim-text)'}}><Loader2 className="spin" size={32} /></div>}
                  {!isLoading && activeSessions.map((s) => (
                    <div key={s.id} className="saas-client-row soc-grid-cols">
                      <div><div className="text-truncate" style={{fontWeight: '900', color: 'white', fontSize: '1.05rem'}}>{s.usuario}</div><div style={{fontSize: '0.85rem', color: '#a855f7', marginTop: '4px', fontWeight: 'bold'}}>{s.role}</div></div>
                      <div><div style={{fontFamily: 'JetBrains Mono', color: 'var(--dim-text)', fontSize: '0.95rem'}}>{s.ip === '::1' ? 'Localhost' : s.ip}</div><div style={{fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: '#cbd5e1'}}><MonitorSmartphone size={12}/>{s.device}</div></div>
                      <div style={{paddingRight: '15px', paddingTop: '4px'}}>
                        <div className="progress-bar-bg" style={{marginTop: 0}}><div className="progress-bar-fill" style={{ width: `${s.expirationPercent}%`, backgroundColor: s.expirationPercent < 20 ? '#ef4444' : '#a855f7' }}></div></div>
                        <div style={{fontSize: '0.7rem', color: 'var(--dim-text)', display: 'flex', justifyContent: 'space-between', marginTop: '4px'}}><span>Expira em</span><span style={{fontFamily: 'JetBrains Mono'}}>{s.expirationMin} min</span></div>
                      </div>
                      <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center'}}><button className="btn-icon-small danger-text" title="Derrubar Ligação (Revoke)" onClick={() => handleRevoke(s.id, s.usuario)}><Power size={18} /></button></div>
                    </div>
                  ))}
                  {!isLoading && activeSessions.length === 0 && <div style={{padding: '2rem', textAlign: 'center', color: 'var(--dim-text)'}}>Nenhuma sessão ativa encontrada no sistema.</div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="dev-grid-main anim-stagger-3">
          <div className="dev-col-left">
            <div className="dev-card glass-card" style={{ borderTop: '4px solid var(--secondary)' }}>
              <div className="dev-card-header flex-between" style={{color: 'var(--secondary)', flexWrap: 'wrap'}}>
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}><FileKey size={20}/><h3>Matriz de Permissões (RBAC)</h3></div>
              </div>
              <div className="table-responsive-wrapper" style={{paddingBottom: '0'}}>
                <div className="saas-table-header rbac-grid-cols" style={{background: 'rgba(0,0,0,0.3)', padding: '10px 15px', marginBottom: '8px', textAlign: 'center'}}>
                  <div style={{textAlign: 'left'}}>Política de Acesso</div><div>DEV</div><div>ADMIN</div><div>LOJA</div><div>MANUT.</div>
                </div>
                {localRbac.map((pol) => (
                  <div key={pol.id} className="saas-client-row rbac-grid-cols" style={{padding: '8px 15px'}}>
                    <div style={{fontSize: '0.85rem', color: 'white', fontWeight: 'bold'}}>{pol.name}</div>
                    <div className="matrix-cell" onClick={() => toggleRbac(pol.id, 'dev')}>{pol.dev ? <CheckCircle2 size={18} color="#10b981"/> : <XCircle size={18} color="#475569"/>}</div>
                    <div className="matrix-cell" onClick={() => toggleRbac(pol.id, 'admin')}>{pol.admin ? <CheckCircle2 size={18} color="#10b981"/> : <XCircle size={18} color="#475569"/>}</div>
                    <div className="matrix-cell" onClick={() => toggleRbac(pol.id, 'loja')}>{pol.loja ? <CheckCircle2 size={18} color="#10b981"/> : <Minus size={18} color="#475569"/>}</div>
                    <div className="matrix-cell" onClick={() => toggleRbac(pol.id, 'manutencao')}>{pol.manutencao ? <CheckCircle2 size={18} color="#10b981"/> : <Minus size={18} color="#475569"/>}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dev-col-right">
            <div className="dev-card glass-card" style={{ borderTop: '4px solid var(--danger)', display: 'flex', flexDirection: 'column' }}>
              <div className="dev-card-header flex-between" style={{color: 'var(--danger)', flexWrap: 'wrap', marginBottom: '10px'}}>
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}><History size={20}/><h3>Registo de Auditoria Zero-Trust</h3></div>
                <div className="status-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${score > 80 ? '#10b981' : (score > 50 ? '#f59e0b' : '#ef4444')}` }}>
                  {score > 80 ? <ShieldCheck size={14} color="#10b981"/> : <ShieldAlert size={14} color={score > 50 ? '#f59e0b' : '#ef4444'}/>}
                  <span style={{ fontSize: '0.8rem', fontWeight: '900', color: score > 80 ? '#10b981' : (score > 50 ? '#f59e0b' : '#ef4444') }}>Pontuação SOC: {score}%</span>
                </div>
              </div>

              {/* GRÁFICO DE AMEAÇAS */}
              <div style={{ height: '120px', marginBottom: '15px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={severityData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: 'white', fontSize: '11px' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {severityData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '25vh', overflowY: 'auto', paddingRight: '10px', marginBottom: '20px'}}>
                {!isLoading && auditLogs.map((log, idx) => (
                  <div key={idx} style={{background: 'rgba(0,0,0,0.3)', borderLeft: `4px solid var(--${log.severity})`, padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', border: '1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '200px'}}>
                      <span style={{color: `var(--${log.severity})`, fontWeight: '900', fontSize: '0.85rem'}}>{log.action}</span>
                      <span style={{color: 'var(--dim-text)', fontSize: '0.75rem'}}>Alvo: <span style={{color: 'white', fontWeight: 'bold'}}>{log.target}</span> | Ator: <span style={{color: 'white', fontWeight: 'bold'}}>{log.actor}</span></span>
                    </div>
                    <div style={{fontSize: '0.7rem', color: 'var(--dim-text)', display: 'flex', alignItems: 'center', gap: '4px', textAlign: 'right', fontWeight: 'bold'}}><Clock size={12}/> {log.time}</div>
                  </div>
                ))}
                {!isLoading && auditLogs.length === 0 && <div style={{textAlign: 'center', color: 'var(--dim-text)'}}>Nenhuma auditoria registada.</div>}
              </div>
              <button className="btn btn-outline w-100" style={{padding: '16px', display: 'flex', justifyContent: 'center', gap: '10px', fontWeight: '900', borderRadius: '10px', letterSpacing: '0.5px', marginTop: 'auto'}} onClick={exportarLogsCSV}>
                <DownloadCloud size={20}/> EXPORTAR DUMP DE LOGS (CSV)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Novo User mantido intacto... */}
      {isModalUserOpen && (
        <div className="iam-modal-overlay">
          <div className="iam-modal-content">
            <div className="iam-modal-header">
              <h3><UserPlus size={20}/> Provisionar Credencial</h3>
              <button className="btn-close-modal" onClick={() => setIsModalUserOpen(false)} style={{background: 'transparent', border: 'none', color: 'white', cursor: 'pointer'}}><X size={20}/></button>
            </div>
            <form onSubmit={salvarNovoUsuario} className="iam-modal-body">
              <div className="form-group">
                <label>Nome do Colaborador</label>
                <input type="text" placeholder="Ex: Analista João" value={newUser.nome} onChange={e => setNewUser({...newUser, nome: e.target.value})} autoFocus required />
              </div>
              <div className="form-group">
                <label>E-mail Corporativo</label>
                <input type="email" placeholder="nome@termosync.com" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Nível de Acesso (Role)</label>
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                  <option value="LOJA">Operador de Loja</option>
                  <option value="MANUTENCAO">Técnico de Manutenção</option>
                  <option value="ADMIN">Administrador</option>
                  <option value="DEV">Desenvolvedor / Root</option>
                </select>
              </div>
              <label className="form-check">
                <input type="checkbox" checked={newUser.mfa} onChange={e => setNewUser({...newUser, mfa: e.target.checked})} />
                <span>Exigir MFA no primeiro login</span>
              </label>
            </form>
            <div className="iam-modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setIsModalUserOpen(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={salvarNovoUsuario}><Save size={16}/> Gerar Acesso</button>
            </div>
          </div>
        </div>
      )}
    </>
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
      body = res.data.map(log => [new Date(log.data_hora).toLocaleString('pt-BR'), log.action, log.actor, log.target, (log.severity || 'INFO').toUpperCase()]);
      if(body.length === 0) body = [['--', 'Sem registos', '--', '--', '--']];
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
      body = res.data.slice(0, 50).map(n => [new Date(n.data_hora).toLocaleString('pt-BR'), n.equipamento_nome, n.tipo_alerta, n.mensagem]);
      if(body.length === 0) body = [['--', 'Sem anomalias detetadas', '--', '--']];
    } else if (tipo === 'ORGANIZACOES_TENANTS') {
      const res = await api.get('/empresas');
      head = ['Organização', 'Registo Legal', 'Contato', 'Email', 'Status'];
      body = res.data.map(emp => [emp.nome, emp.cnpj || 'ISENTO', emp.contato || 'Não informado', emp.email || 'Não informado', emp.status.toUpperCase()]);
      if(body.length === 0) body = [['--', 'Nenhuma organização', '--', '--', '--']];
    } else if (tipo === 'SYSOPS_HEALTH') {
      const res = await api.get('/system/health');
      head = ['Métrica Vital do Servidor', 'Valor Atual', 'Status'];
      body = [
        ['Status do Cluster MySQL', res.data.db, 'NORMAL'],
        ['Túneis WebSocket Ativos', `${res.data.sockets} ligação(ões)`, 'NORMAL'],
        ['Volume de Telemetria (Registos)', `${res.data.total_records}`, 'NORMAL'],
        ['Tempo de Atividade (Uptime)', `${Math.floor(res.data.uptime / 60)} min`, 'NORMAL']
      ];
    }
    return { head, body };
  };

  const gerarRelatorioPDF = async (tipo, tema, cor) => {
    setIsProcessing(`PDF_${tipo}`);
    showToast(`A compilar PDF: ${tipo}...`, 'warning');
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
      showToast('Relatório PDF transferido.', 'success');
    } catch (e) { showToast('Erro no PDF.', 'error'); }
    setIsProcessing(null);
  };

  const gerarRelatorioCSV = async (tipo) => {
    setIsProcessing(`CSV_${tipo}`);
    showToast(`A extrair CSV: ${tipo}...`, 'warning');
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
      showToast('CSV transferido.', 'success');
    } catch (e) { showToast('Erro no CSV.', 'error'); }
    setIsProcessing(null);
  };

  const modulosBI = [
    { id: 'FINOPS_BILLING', titulo: 'Core Financeiro (RevOps)', desc: 'Relação completa de MRR, dívidas e faturas.', icon: DollarSign, color: '#10b981' },
    { id: 'AUDITORIA_SOC', titulo: 'Auditoria Zero-Trust (SOC)', desc: 'Extrato oficial e imutável de logins e purgas da base de dados.', icon: ShieldCheck, color: '#a855f7' },
    { id: 'EDGE_HARDWARE', titulo: 'Inventário Edge Computing', desc: 'Mapeamento global da frota de microcontroladores (MAC/Wi-Fi).', icon: Server, color: '#38bdf8' },
    { id: 'CAOS_RESILIENCIA', titulo: 'Auditoria de Resiliência', desc: 'Relatório das anomalias injetadas ou detetadas no sistema.', icon: Cpu, color: '#ef4444' },
    { id: 'ORGANIZACOES_TENANTS', titulo: 'Ecossistema de Tenants', desc: 'Lista de todos os clientes registados, capacidades e responsáveis.', icon: Building2, color: '#f59e0b' },
    { id: 'SYSOPS_HEALTH', titulo: 'Saúde da Plataforma (SysOps)', desc: 'Métricas vitais do cluster Node.js, WebSocket e carga MySQL.', icon: Activity, color: '#6366f1' }
  ];

  return (
    <div className="anim-fade-in stagger-1 dev-tela-scroll">
      <div className="flex-header" style={{ padding: 0, background: 'transparent', boxShadow: 'none', marginBottom: '0' }}>
        <div className="dev-card glass-card" style={{ width: '100%' }}>
          <div className="dev-card-header" style={{ color: 'white', marginBottom: '5px' }}><PieChart size={24} color="#38bdf8" /><h3 style={{fontSize: 'clamp(1rem, 2vw, 1.2rem)'}}>Centro de Inteligência e Analytics (BI)</h3></div>
          <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>Motor de extração de dados reais da base de dados MySQL. Relatórios são registados na tabela de auditoria para fins de compliance.</p>
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
// 10. TELA DE ATUALIZAÇÕES DO SISTEMA E DEPLOY (COMPLETA E BLINDADA)
// ============================================================================
const TelaAtualizacoes = ({ api, showToast, addLog, setModalConfig, isOverclocked }) => {
  const defaultUpdates = [
    { id: 4, version: 'v13.1.0', title: 'Módulo de Changelog e Deploy', type: 'feature', date: new Date().toISOString(), author: 'Root', desc: 'Implementação da nova aba de Atualizações do Sistema. Permite aos administradores registar e acompanhar o histórico de modificações no código-fonte.' },
    { id: 3, version: 'v13.0.0', title: 'Omni-Channel & Intel Vault', type: 'feature', date: new Date(Date.now() - 86400000).toISOString(), author: 'SysAdmin', desc: 'Adicionado cofre de inteligência (Intel Vault) e fixação de diretivas táticas.' },
    { id: 2, version: 'v12.5.2', title: 'Patch de Segurança WAF', type: 'security', date: new Date(Date.now() - 172800000).toISOString(), author: 'NetSec', desc: 'Atualização nas assinaturas do WAF para bloquear tentativas de SQL Injection.' },
    { id: 1, version: 'v12.0.0', title: 'Comunicações VoIP Táticas', type: 'feature', date: new Date(Date.now() - 259200000).toISOString(), author: 'DevOps', desc: 'Implementação de chamadas de rádio (VoIP) e envio de coordenadas de GPS no chat tático.' },
  ];

  const [updates, setUpdates] = useState(() => {
    const saved = localStorage.getItem('termosync_changelog');
    return saved ? JSON.parse(saved) : defaultUpdates;
  });

  useEffect(() => {
    localStorage.setItem('termosync_changelog', JSON.stringify(updates));
  }, [updates]);

  const [newUpdate, setNewUpdate] = useState({ version: '', title: '', type: 'feature', desc: '' });
  const [updateFile, setUpdateFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false); 
  
  const [activeFilter, setActiveFilter] = useState('all');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState(0); 
  const [checkBackup, setCheckBackup] = useState(false);
  const [checkDowntime, setCheckDowntime] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.zip')) {
        setUpdateFile(file);
      } else {
        showToast('Formato não suportado. Por favor, arraste um pacote .zip', 'error');
      }
    }
  };

  const handleDeploy = (e) => {
    e.preventDefault();
    if (!newUpdate.version || !newUpdate.title || !newUpdate.desc || !updateFile || !checkBackup || !checkDowntime) {
      showToast('Preencha os dados, anexe o pacote e valide o checklist de segurança.', 'error');
      return;
    }

    setModalConfig({
      isOpen: true,
      title: 'INICIAR DEPLOY EM PRODUÇÃO',
      message: `Atenção SysAdmin: A versão ${newUpdate.version} será injetada. O núcleo do servidor será reiniciado. Você confirma esta ação destrutiva?`,
      onConfirm: async () => {
        setIsDeploying(true);
        setDeployStep(1); 
        addLog(`[CICD] Upload do pacote ${updateFile.name} iniciado...`, 'warning');
        
        const formData = new FormData();
        formData.append('updatePackage', updateFile);
        formData.append('version', newUpdate.version);
        formData.append('title', newUpdate.title);
        formData.append('type', newUpdate.type);
        formData.append('desc', newUpdate.desc);

        try {
          setTimeout(() => setDeployStep(2), 1500); 
          await api.post('/system/deploy-update', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 15000 });
          setDeployStep(3); 
          verificarRetornoServidor();
        } catch (error) {
          if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
            setDeployStep(3); 
            addLog(`[CICD] Ligação cortada. Servidor PM2 a reiniciar...`, 'warning');
            verificarRetornoServidor();
          } else {
            setIsDeploying(false);
            setDeployStep(0);
            showToast('Falha no upload da atualização.', 'error');
            addLog(`[CICD ERROR] Falha no pacote: ${error.message}`, 'error');
          }
        }
      }
    });
  };

  const verificarRetornoServidor = () => {
    setDeployStep(4);
    let tentativas = 0;
    const intervalo = setInterval(async () => {
      tentativas++;
      try {
        await api.get('/system/health'); 
        clearInterval(intervalo);
        finalizarDeploySucesso();
      } catch (e) {
        if (tentativas > 20) { 
          clearInterval(intervalo);
          setIsDeploying(false);
          setDeployStep(0);
          showToast('Tempo limite excedido. O Servidor não respondeu ao Ping.', 'error');
        }
      }
    }, 2000); 
  };

  const finalizarDeploySucesso = () => {
    setDeployStep(5);
    setTimeout(() => {
      setUpdates(prev => [{
        id: Date.now(),
        version: newUpdate.version,
        title: newUpdate.title,
        type: newUpdate.type,
        desc: newUpdate.desc,
        date: new Date().toISOString(),
        author: 'Root / Você'
      }, ...prev]);
      
      setIsDeploying(false);
      setDeployStep(0);
      setNewUpdate({ version: '', title: '', type: 'feature', desc: '' });
      setUpdateFile(null);
      setCheckBackup(false);
      setCheckDowntime(false);
      showToast(`Deploy da versão ${newUpdate.version} concluído 100%!`, 'success');
      addLog(`[CICD] Deploy finalizado. Túneis reconectados.`, 'success');
    }, 1500);
  };

  const getBadgeClass = (type) => {
    switch (type) {
      case 'feature': return 'type-feature';
      case 'fix': return 'type-fix';
      case 'security': return 'type-security';
      case 'refactor': return 'type-refactor';
      default: return 'type-feature';
    }
  };

  const getBadgeLabel = (type) => {
    switch (type) {
      case 'feature': return '✨ Nova Feature';
      case 'fix': return '🐛 Bugfix';
      case 'security': return '🛡️ Segurança';
      case 'refactor': return '♻️ Refatoração';
      default: return 'Modificação';
    }
  };

  const filteredUpdates = updates.filter(u => activeFilter === 'all' || u.type === activeFilter);
  const isFormReady = newUpdate.version && newUpdate.title && newUpdate.desc && updateFile && checkBackup && checkDowntime;

  return (
    <div className="dev-tela-scroll">
      <div className="noc-hud-grid anim-stagger-1" style={{ marginBottom: '5px' }}>
        <div className="noc-hud-card" style={{'--card-color': 'var(--theme-main)', minHeight: '90px'}}>
           <div className="noc-mini-header"><span className="noc-kpi-title"><GitCommit size={14}/> RELEASE ATIVA</span></div>
           <div className="noc-kpi-value">{updates[0]?.version || 'v1.0.0'}</div>
        </div>
        <div className="noc-hud-card" style={{'--card-color': 'var(--theme-sec)', minHeight: '90px'}}>
           <div className="noc-mini-header"><span className="noc-kpi-title"><Clock size={14}/> ÚLTIMO DEPLOY</span></div>
           <div className="noc-kpi-value" style={{fontSize: '1.4rem'}}>{updates[0]?.date ? new Date(updates[0].date).toLocaleDateString('pt-BR') : '--/--/----'}</div>
        </div>
        <div className="noc-hud-card pulse-warning-card" style={{'--card-color': 'var(--warning)', minHeight: '90px'}}>
           <div className="noc-mini-header"><span className="noc-kpi-title"><Server size={14}/> AMBIENTE ALVO</span></div>
           <div className="noc-kpi-value" style={{fontSize: '1.4rem', color: 'var(--warning)'}}>PRODUÇÃO (LIVE)</div>
        </div>
      </div>

      <div className="dev-grid-main anim-stagger-2">
        <div className="dev-col-left" style={{ flex: '1.2' }}>
          <div className="dev-card glass-card" style={{ borderTop: `4px solid ${isOverclocked ? '#ef4444' : 'var(--theme-sec)'}` }}>
            <div className="dev-card-header" style={{ color: isOverclocked ? '#ef4444' : 'var(--theme-sec)', marginBottom: '20px' }}>
              <Rocket size={24} />
              <h3>Motor de Deploy (CI/CD)</h3>
            </div>
            
            {isDeploying ? (
              <div style={{ background: 'var(--bg-dark)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-focus)', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--theme-main)', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                   <Loader2 size={24} className="spin" />
                   <h3 style={{ margin: 0, fontSize: '1rem', textTransform: 'uppercase' }}>Injetando Pacote no Cluster...</h3>
                 </div>
                 
                 <div className="crt-terminal" style={{ flex: 1, fontFamily: 'JetBrains Mono', fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                   <div style={{color: '#94a3b8'}}>[SYSTEM] Iniciando sequência de Continuous Deployment...</div>
                   {deployStep >= 1 && <div><span style={{color: 'var(--secondary)'}}>[UPLOAD]</span> Transferindo {updateFile.name} ({(updateFile.size / 1024 / 1024).toFixed(2)}MB)... <span style={{color: 'var(--theme-main)'}}>100%</span></div>}
                   {deployStep >= 2 && <div><span style={{color: 'var(--warning)'}}>[EXTRACT]</span> Sobrescrevendo arquivos na diretoria de produção...</div>}
                   {deployStep >= 3 && <div><span style={{color: 'var(--danger)'}}>[CORE]</span> Sinal de reinício enviado. Derrubando conexões WSS...</div>}
                   {deployStep >= 4 && <div className="pulse-icon"><span style={{color: 'var(--secondary)'}}>[PING]</span> Aguardando servidor voltar online...</div>}
                   {deployStep >= 5 && <div style={{color: 'var(--theme-main)', fontWeight: 'bold'}}>[SUCESSO] Sistema Operacional 100% Online e Atualizado!</div>}
                 </div>
              </div>
            ) : (
              <form onSubmit={handleDeploy} className="deploy-form-grid">
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 'bold' }}>Pacote ZIP (Frontend/Backend) *</label>
                  <div 
                    onDragOver={handleDragOver} 
                    onDragLeave={handleDragLeave} 
                    onDrop={handleDrop}
                    style={{
                      position: 'relative', border: `2px dashed ${isDragging ? 'var(--theme-main)' : (updateFile ? 'var(--primary)' : 'var(--border-focus)')}`,
                      borderRadius: '12px', padding: '25px 20px', textAlign: 'center', cursor: 'pointer',
                      background: isDragging ? 'rgba(16, 185, 129, 0.1)' : (updateFile ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.3)'), 
                      transition: '0.3s'
                  }}>
                    <input type="file" accept=".zip" onChange={e => { if(e.target.files[0]) setUpdateFile(e.target.files[0]); }} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }} />
                    {updateFile ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <FileCode size={36} color="var(--primary)" />
                        <span style={{ color: 'var(--primary)', fontWeight: 'bold', marginTop: '5px' }}>{updateFile.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--dim-text)' }}>{(updateFile.size / 1024 / 1024).toFixed(2)} MB - Pronto para Deploy</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <DownloadCloud size={36} color={isDragging ? 'var(--theme-main)' : 'var(--dim-text)'} />
                        <span style={{ color: isDragging ? 'var(--theme-main)' : 'white', fontWeight: 'bold', marginTop: '5px' }}>
                          {isDragging ? 'Solte o arquivo aqui!' : 'Arraste o .zip aqui ou clique'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--dim-text)' }}>Apenas arquivos compactados</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label style={{ color: 'var(--dim-text)', fontSize: '0.75rem' }}>Versão *</label>
                    <div className="config-input-wrapper">
                      <GitCommit size={16} />
                      <input type="text" placeholder="v14.0.0" value={newUpdate.version} onChange={e => setNewUpdate({...newUpdate, version: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'var(--dim-text)', fontSize: '0.75rem' }}>Categoria *</label>
                    <select value={newUpdate.type} onChange={e => setNewUpdate({...newUpdate, type: e.target.value})} style={{minHeight: '48px'}}>
                      <option value="feature">Nova Funcionalidade</option>
                      <option value="fix">Bugfix (Correção)</option>
                      <option value="security">Patch de Segurança</option>
                      <option value="refactor">Refatoração / Otimização</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-group">
                  <label style={{ color: 'var(--dim-text)', fontSize: '0.75rem' }}>Título da Atualização *</label>
                  <div className="config-input-wrapper">
                    <input type="text" placeholder="Ex: Novo Dashboard Financeiro" value={newUpdate.title} onChange={e => setNewUpdate({...newUpdate, title: e.target.value})} />
                  </div>
                </div>
                
                <div className="form-group">
                  <label style={{ color: 'var(--dim-text)', fontSize: '0.75rem' }}>Descrição do Patch (Changelog) *</label>
                  <textarea placeholder="Liste as alterações que os usuários irão notar..." value={newUpdate.desc} onChange={e => setNewUpdate({...newUpdate, desc: e.target.value})}></textarea>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-dim)' }}>
                   <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Protocolo de Segurança PRE-FLIGHT</span>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.8rem', color: checkBackup ? 'var(--primary)' : 'white' }}>
                      <input type="checkbox" checked={checkBackup} onChange={e => setCheckBackup(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
                      Backup completo do Banco de Dados (MySQL) foi realizado.
                   </label>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.8rem', color: checkDowntime ? 'var(--warning)' : 'white' }}>
                      <input type="checkbox" checked={checkDowntime} onChange={e => setCheckDowntime(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--warning)' }} />
                      Estou ciente da queda temporária de instâncias IoT e WebSockets.
                   </label>
                </div>
                
                <button type="submit" className="btn btn-primary w-100" disabled={!isFormReady} style={{ marginTop: '5px', filter: isFormReady ? 'none' : 'grayscale(1)' }}>
                  <Rocket size={18} /> INICIAR DEPLOY NO SERVIDOR
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="dev-col-right" style={{ flex: '1.8' }}>
          <div className="dev-card glass-card" style={{ borderTop: '4px solid var(--theme-main)', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="dev-card-header flex-between" style={{ color: 'var(--theme-main)', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={24} />
                <h3>Registo de Atualizações (Changelog)</h3>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '5px', borderBottom: '1px solid var(--border-dim)' }}>
               <button onClick={() => setActiveFilter('all')} style={{ background: activeFilter === 'all' ? 'var(--primary)' : 'transparent', color: activeFilter === 'all' ? '#000' : 'white', border: '1px solid var(--primary)', padding: '6px 14px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>Todos</button>
               <button onClick={() => setActiveFilter('feature')} style={{ background: activeFilter === 'feature' ? 'var(--secondary)' : 'transparent', color: activeFilter === 'feature' ? '#000' : 'white', border: '1px solid var(--secondary)', padding: '6px 14px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>Features</button>
               <button onClick={() => setActiveFilter('fix')} style={{ background: activeFilter === 'fix' ? 'var(--warning)' : 'transparent', color: activeFilter === 'fix' ? '#000' : 'white', border: '1px solid var(--warning)', padding: '6px 14px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>Correções</button>
               <button onClick={() => setActiveFilter('security')} style={{ background: activeFilter === 'security' ? 'var(--danger)' : 'transparent', color: activeFilter === 'security' ? '#000' : 'white', border: '1px solid var(--danger)', padding: '6px 14px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>Segurança</button>
            </div>

            <div className="timeline-container" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', marginTop: 0 }}>
              {filteredUpdates.map((upd) => (
                <div key={upd.id} className="timeline-item">
                  <div className="timeline-node"></div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="version-badge">{upd.version}</span>
                      <div className="update-meta">
                        <Clock size={12} /> {new Date(upd.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        <span style={{ margin: '0 4px' }}>•</span>
                        <User size={12} /> {upd.author}
                      </div>
                    </div>
                    <h4 className="update-title">{upd.title}</h4>
                    <span className={`update-type-badge ${getBadgeClass(upd.type)}`}>
                      {getBadgeLabel(upd.type)}
                    </span>
                    <p className="update-desc">{upd.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 12. TELA: CONSOLE TERMINAL SQL (RAW DB QUERY EXECUTOR)
// ============================================================================
const TelaTerminalSQL = ({ api, showToast, addLog }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  
  const [history, setHistory] = useState([]);

  const executarSQL = async (e, forceQuery = null) => {
    if (e) e.preventDefault();
    const sqlToRun = forceQuery || query;
    if (!sqlToRun.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);
    addLog(`[SQL] A executar diretiva na base de dados...`, 'warning');

    try {
      const res = await api.post('/system/query-raw', { sql: sqlToRun });
      
      if (res.data.success) {
        setResults(res.data.data);
        showToast('Query executada com sucesso.', 'success');
        addLog(`[SQL SUCESS] Afetadas/Retornadas ${res.data.data?.length || 0} linhas do cluster MySQL.`, 'success');
        
        setHistory(prev => {
          if (prev[0] === sqlToRun) return prev;
          return [sqlToRun, ...prev].slice(0, 10);
        });
      } else {
        setError(res.data.error || 'Erro desconhecido na query.');
        showToast('Erro de sintaxe SQL.', 'error');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      addLog(`[SQL ERROR] Falha crítica de sintaxe ou ligação.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const aplicarQuickQuery = (sql) => {
    setQuery(sql);
    executarSQL(null, sql);
  };

  return (
    <div className="dev-tela-scroll">
      
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '5px' }}>
        <button className="btn btn-outline" onClick={() => aplicarQuickQuery("SHOW TABLES;")} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', flex: 'none', background: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}>
          <Database size={14} style={{ marginRight: '6px' }}/> Ver Tabelas
        </button>
        <button className="btn btn-outline" onClick={() => aplicarQuickQuery("SELECT * FROM equipamentos LIMIT 10;")} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', flex: 'none' }}>
          Equipamentos
        </button>
        <button className="btn btn-outline" onClick={() => aplicarQuickQuery("SELECT COUNT(*) as total_telemetria FROM leituras;")} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', flex: 'none' }}>
          Contar Leituras
        </button>
        <button className="btn btn-outline" onClick={() => aplicarQuickQuery("SELECT * FROM sessoes_ativas;")} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', flex: 'none' }}>
          Sessões Ativas
        </button>
      </div>

      <div className="dev-card glass-card" style={{ borderTop: '4px solid #f59e0b', marginBottom: '20px' }}>
        <div className="dev-card-header flex-between" style={{ color: '#f59e0b', marginBottom: '15px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Database size={24} />
            <h3>Terminal SQL Master (Raw Query Executor)</h3>
          </div>
          
          {history.length > 0 && (
            <select 
              className="dev-select-input" 
              style={{ width: 'auto', minHeight: '34px', padding: '4px 10px', fontSize: '0.75rem', borderColor: 'rgba(245, 158, 11, 0.3)' }}
              onChange={(e) => {
                if(e.target.value) setQuery(e.target.value);
                e.target.value = ""; 
              }}
            >
              <option value="">🕒 Histórico de Queries</option>
              {history.map((h, i) => (
                <option key={i} value={h}>{h.length > 40 ? h.substring(0, 40) + '...' : h}</option>
              ))}
            </select>
          )}
        </div>

        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '15px' }}>
          Acesso direto ao motor relacional MySQL. Use comandos estruturados com precaução. Operações de <span style={{color:'var(--danger)', fontWeight:'bold'}}>DROP</span> ou <span style={{color:'var(--danger)', fontWeight:'bold'}}>DELETE</span> alteram permanentemente os tenants.
        </p>
        
        <form onSubmit={(e) => executarSQL(e)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <textarea 
            value={query} 
            onChange={e => setQuery(e.target.value)}
            placeholder="SELECT * FROM equipamentos WHERE filial = 'Matriz' LIMIT 10;"
            style={{ 
              minHeight: '120px', 
              background: '#020617', 
              color: '#38bdf8', 
              fontFamily: 'JetBrains Mono, monospace', 
              fontSize: '0.95rem', 
              border: '1px solid var(--border-focus)', 
              padding: '15px', 
              borderRadius: '8px',
              lineHeight: '1.5'
            }}
            spellCheck="false"
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()} style={{ background: '#f59e0b', color: '#000', fontWeight: 'bold', width: '220px', alignSelf: 'flex-end', filter: !query.trim() ? 'grayscale(1)' : 'none' }}>
            {loading ? <Loader2 size={16} className="spin" /> : <Terminal size={16} />}
            {loading ? 'A PROCESSAR...' : 'EXECUTAR DIRETIVA SQL'}
          </button>
        </form>
      </div>

      {error && (
        <div className="anim-fade-in" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '15px', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '0.85rem', marginBottom: '20px' }}>
          <strong>❌ ERRO DE COMPILAÇÃO MYSQL:</strong> {error}
        </div>
      )}

      {results && results.length > 0 ? (
        <div className="dev-card glass-card anim-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 15px', background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid var(--border-focus)', fontSize: '0.8rem', color: '#10b981', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
            <span>✔ Query executada com sucesso.</span>
            <span>{results.length} linha(s) retornada(s).</span>
          </div>
          <div className="table-responsive-wrapper" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="dev-select-input" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'transparent', fontSize: '0.85rem' }}>
              <thead style={{ background: 'rgba(255,255,255,0.05)', color: '#38bdf8', fontFamily: 'JetBrains Mono', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  {Object.keys(results[0]).map((key, i) => <th key={i} style={{ padding: '12px 15px', borderBottom: '1px solid var(--border-focus)', whiteSpace: 'nowrap' }}>{key}</th>)}
                </tr>
              </thead>
              <tbody style={{ fontFamily: 'JetBrains Mono, monospace', color: '#cbd5e1' }}>
                {results.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-dim)', background: i % 2 === 0 ? 'rgba(0,0,0,0.2)' : 'transparent' }}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} style={{ padding: '10px 15px', whiteSpace: 'nowrap' }}>
                        {val === null ? <span style={{color: '#64748b'}}>NULL</span> : 
                         (typeof val === 'object' ? JSON.stringify(val) : String(val))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : results && (
        <div className="anim-fade-in" style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '15px', borderRadius: '8px', fontSize: '0.85rem' }}>
          ✔ Comando executado com sucesso. Nenhuma linha retornada (Ação de escrita / DDL / DML concluída).
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 13. TELA: MONITOR WEBSOCKET LIVE (FIREHOSE STREAM) 
// ============================================================================
const TelaWebSocketStream = ({ socket, addLog }) => {
  const [packets, setPackets] = useState([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [filterMode, setFilterMode] = useState('ALL');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const capturarTudo = (eventName, ...args) => {
      if (!isStreaming) return;

      const payloadOriginal = args.length === 1 ? args[0] : args;
      const payloadFormatado = payloadOriginal !== undefined && payloadOriginal !== null 
        ? payloadOriginal 
        : { info: 'Sinal de pulso sem payload (Ping/Refresh)' };

      setPackets(prev => [...prev.slice(-199), { 
        id: Date.now() + Math.random(), 
        event: eventName, 
        time: new Date().toLocaleTimeString('pt-BR'), 
        payload: payloadFormatado 
      }]);
    };

    if (isStreaming) {
      socket.onAny(capturarTudo);
      addLog('[WSS] Modo Promíscuo Ativado: Intercetando todos os canais de telemetria.', 'warning');
    }

    return () => {
      socket.offAny(capturarTudo);
    };
  }, [socket, isStreaming, addLog]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [packets]);

  const limparConsole = () => {
    setPackets([]);
    addLog('[WSS] Consola Firehose limpa pelo operador.', 'info');
  };

  const visiblePackets = packets.filter(p => {
    if (filterMode === 'ALL') return true;
    if (filterMode === 'ALERTAS') return p.event.includes('alerta');
    if (filterMode === 'LEITURAS') return p.event.includes('leitura');
    return true;
  });

  return (
    <div className="dev-tela-scroll">
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '5px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
           <button className={`btn btn-outline ${filterMode === 'ALL' ? 'active' : ''}`} onClick={() => setFilterMode('ALL')} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', flex: 'none', background: filterMode==='ALL'?'var(--primary)':'', color: filterMode==='ALL'?'#000':'' }}>
             <Filter size={14} style={{ marginRight: '6px' }}/> Tudo
           </button>
           <button className={`btn btn-outline ${filterMode === 'LEITURAS' ? 'active' : ''}`} onClick={() => setFilterMode('LEITURAS')} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', flex: 'none', background: filterMode==='LEITURAS'?'var(--secondary)':'', color: filterMode==='LEITURAS'?'#000':'' }}>
             Apenas Leituras
           </button>
           <button className={`btn btn-outline ${filterMode === 'ALERTAS' ? 'active' : ''}`} onClick={() => setFilterMode('ALERTAS')} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', flex: 'none', background: filterMode==='ALERTAS'?'var(--danger)':'', color: filterMode==='ALERTAS'?'#000':'' }}>
             Apenas Alertas
           </button>
        </div>
        <button className="btn btn-outline danger-text" onClick={limparConsole} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', flex: 'none', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <Trash2 size={14} style={{ marginRight: '6px' }}/> Limpar Ecrã
        </button>
      </div>

      <div className="dev-card glass-card" style={{ borderTop: '4px solid #a855f7', height: '75vh', display: 'flex', flexDirection: 'column' }}>
        <div className="dev-card-header flex-between" style={{ color: '#a855f7', marginBottom: '15px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Network size={24} />
            <h3>Monitor Sockets Duplex (Firehose Stream)</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {isStreaming && <span className="pulse-icon" style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>● OUVINDO REDE</span>}
            <button 
              onClick={() => {
                setIsStreaming(!isStreaming);
                addLog(isStreaming ? '[WSS] Captura suspensa pelo operador.' : '[WSS] Captura retomada.', 'info');
              }} 
              className={`btn ${isStreaming ? 'btn-danger' : 'btn-success'}`}
              style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', fontWeight: 'bold' }}
            >
              {isStreaming ? <Power size={14} /> : <RefreshCw size={14} />}
              {isStreaming ? 'SUSPENDER CAPTURA' : 'LIGAR CAPTURA LIVE'}
            </button>
          </div>
        </div>
        
        <div className="crt-terminal" ref={scrollRef} style={{ flex: 1, background: '#020617', padding: '15px', borderRadius: '8px', overflowY: 'auto', border: '1px solid var(--border-focus)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
          {visiblePackets.map(p => (
            <div key={p.id} className="anim-fade-in" style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>[{p.time}]</span>
                <span style={{ 
                  color: p.event.includes('alerta') ? '#ef4444' : (p.event.includes('leitura') ? '#10b981' : '#38bdf8'), 
                  fontWeight: 'bold', 
                  textTransform: 'uppercase' 
                }}>
                  📡 {p.event}
                </span>
              </div>
              <pre style={{ margin: 0, color: '#a855f7', paddingLeft: '20px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(p.payload, null, 2)}
              </pre>
            </div>
          ))}
          {visiblePackets.length === 0 && (
            <div style={{ color: 'var(--dim-text)', textAlign: 'center', marginTop: '100px', fontStyle: 'italic', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Network size={48} style={{ opacity: 0.2, marginBottom: '15px' }} />
              Aguardando transmissões no canal WebSocket...<br/>
              <span style={{fontSize: '0.7rem', marginTop: '10px'}}>(Gere um alerta ou injete dados no simulador para testar)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 11. TERMINAL FOOTER DE COMANDOS
// ============================================================================
const TerminalFooter = ({ logs, setLogs, addLog, sysConfig }) => {
  const [cmdInput, setCmdInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalContainerRef = useRef(null);

  useEffect(() => {
    if (isOpen && terminalContainerRef.current) terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
  }, [logs, isOpen]);

  const handleCommandSubmit = (e) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;
    const cmd = cmdInput.trim().toLowerCase();
    
    setCmdHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);
    
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: cmd, status: 'cmd-echo' }]);
    
    setTimeout(() => {
      switch (cmd) {
        case 'help': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'Comandos disponíveis: clear, ping, sysinfo, netstat, purge, reboot, whoami, date, lockdown, ifconfig, sudo, matrix', status: 'info' }]); break;
        case 'clear': setLogs([]); break;
        case 'ping': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'Gateway Ping: 12ms. Servidor Core: ONLINE.', status: 'success' }]); break;
        case 'sysinfo': 
           const historicoDeploy = JSON.parse(localStorage.getItem('termosync_changelog')) || [{version: 'v13.1.0'}];
           setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: `TermoSync OS ${historicoDeploy[0].version} Enterprise Edition | Auth: ROOT_DEV.`, status: 'warning' }]); 
           break;
        case 'netstat': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'TCP 0.0.0.0:3000 (LISTEN) | Ligações WebSocket ativas: 3.', status: 'info' }]); break;
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
        case 'purge': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'A limpar cache de memória RAM L3... [OK]', status: 'success' }]); break;
        case 'reboot': 
          setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'A reiniciar painel (F5)...', status: 'error' }]); 
          setTimeout(() => window.location.reload(), 1500); 
          break;
        default: setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: `ERR: comando '${cmd}' não reconhecido. Digite 'help' para ver os comandos válidos.`, status: 'error' }]);
      }
    }, 400);
    setCmdInput(''); 
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      if (cmdHistory.length > 0 && historyIndex < cmdHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCmdInput(cmdHistory[cmdHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCmdInput(cmdHistory[cmdHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCmdInput('');
      }
    }
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
            <div className="crt-scan"></div>
            {logs.map((log, index) => (
              <div key={index} className={`terminal-line ${log.status}`}>
                <span className="time">{log.time && `[${log.time}]`}</span>
                {log.status === 'cmd-echo' ? (
                  <span className="prompt">root@termosync:~$ <span style={{color: 'white'}}>{log.text}</span></span>
                ) : (
                  <>
                    <span className="prompt" style={{visibility: log.time ? 'visible' : 'hidden'}}>root@termosync:~$</span> 
                    <span className="text" style={{ 
                      color: log.status === 'error' ? '#ef4444' : 
                             log.status === 'warning' ? '#f59e0b' : 
                             log.status === 'success' ? '#10b981' : '#cbd5e1' 
                    }}>
                      {log.text}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={handleCommandSubmit} className="terminal-input-form">
            <span className="prompt">root@termosync:~$</span>
            <input 
              type="text" 
              value={cmdInput} 
              onChange={e => setCmdInput(e.target.value)} 
              onKeyDown={handleKeyDown}
              placeholder="Digite um comando (ex: help) [Use setas Cima/Baixo para histórico]..." 
              autoComplete="off" 
              spellCheck="false" 
              autoFocus 
            />
            <button type="button" className="btn-clear-terminal" onClick={() => setLogs([])} title="Limpar Consola"><Eraser size={16} /></button>
          </form>
        </>
      )}
    </div>
  );
};c