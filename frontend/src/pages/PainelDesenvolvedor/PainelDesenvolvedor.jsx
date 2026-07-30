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
  Rocket, GitCommit, Bug, FileCode, User, Trash2, Filter, ChevronRight, CalendarMinus
} from 'lucide-react';

import { AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, YAxis, BarChart, Bar, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './PainelDesenvolvedor.css';
import GestaoEmpresas from '../GestaoEmpresas/GestaoEmpresas';
import TermoSyncLogo from '../../components/TermoSyncLogo.jsx';

// ============================================================================
// COMPONENTE PRINCIPAL (CONTAINER OS)
// ============================================================================
export default function PainelDesenvolvedor({ api, socket, abaAtiva, isDevAuthenticated, onAuthenticate, showToast, sysConfig, updateSysConfig, tocarAlarme, usuariosLista, filiaisDb, setModalConfig }) {
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [isOverclocked, setIsOverclocked] = useState(false); 
  const [ticketsSuporteAbertos, setTicketsSuporteAbertos] = useState(0);
  
  const addLog = useCallback((text, status = 'info') => { 
    setTerminalLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text, status }]); 
  }, []);

  const carregarTicketsSuporte = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.get('/suporte/chamados');
      const lista = Array.isArray(res.data) ? res.data : [];
      const abertos = lista.filter(ticket => ticket.status === 'Aberto' || ticket.status === 'Em análise').length;
      setTicketsSuporteAbertos(abertos);
    } catch (error) { setTicketsSuporteAbertos(0); }
  }, [api]);

  useEffect(() => {
    if (terminalLogs.length === 0) addLog("Sessão Master estabelecida. SysAdmin conectado.", "success");
  }, [addLog, terminalLogs.length]);

  useEffect(() => { carregarTicketsSuporte(); }, [carregarTicketsSuporte]);

  useEffect(() => {
    if (!socket) return undefined;
    const refreshSupportTickets = () => carregarTicketsSuporte();
    socket.on('atualizacao_dados', refreshSupportTickets);
    return () => socket.off('atualizacao_dados', refreshSupportTickets);
  }, [socket, carregarTicketsSuporte]);

  if (!isDevAuthenticated) {
    return (
      <div className="dev-os-container" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '15px', color: 'var(--danger)'}}>
        <ShieldAlert size={64} className="pulse-icon" /><h2>Acesso Rejeitado</h2><p style={{color: '#94a3b8'}}>O terminal requer autenticação de Nível ROOT.</p>
      </div>
    );
  }

  return (
    <div className={`dev-os-container anim-fade-in ${sysConfig?.maintenanceMode ? 'lockdown-mode' : ''} ${isOverclocked ? 'red-alert-mode' : ''}`}>
      {abaAtiva === 'dev_panel' && <div className="noc-scanlines"></div>}
      {abaAtiva === 'dev_panel' && <div className="noc-cyber-grid"></div>}
      {abaAtiva === 'dev_panel' && ticketsSuporteAbertos > 0 && (
        <div className="dev-support-alert" role="status" aria-live="polite">
          <div className="dev-support-alert-icon"><AlertTriangle size={20} /></div>
          <div className="dev-support-alert-copy">
            <strong>{ticketsSuporteAbertos} ticket{ticketsSuporteAbertos > 1 ? 's' : ''} de suporte aberto{ticketsSuporteAbertos > 1 ? 's' : ''}</strong>
            <span>Existe{ticketsSuporteAbertos > 1 ? 'm' : ''} chamado{ticketsSuporteAbertos > 1 ? 's' : ''} aguardando análise no suporte ao sistema.</span>
          </div>
          <div className="dev-support-alert-tag">Prioridade de atendimento</div>
        </div>
      )}
      {sysConfig?.maintenanceMode && (
        <div className="maintenance-banner"><AlertOctagon size={18} className="pulse-icon" /> SISTEMA EM MODO DE MANUTENÇÃO (OFFLINE) <AlertOctagon size={18} className="pulse-icon" /></div>
      )}

      <div className="dev-os-workspace">
        <div className="dev-os-content">
          {abaAtiva === 'empresas' && <GestaoEmpresas api={api} showToast={showToast} setModalConfig={setModalConfig} />}
          {abaAtiva === 'dev_panel' && <TelaNOC api={api} showToast={showToast} sysConfig={sysConfig} updateSysConfig={updateSysConfig} tocarAlarme={tocarAlarme} usuariosLista={usuariosLista} addLog={addLog} setModalConfig={setModalConfig} isOverclocked={isOverclocked} setIsOverclocked={setIsOverclocked} />}
          {abaAtiva === 'saas' && <TelaSaaS api={api} sysConfig={sysConfig} updateSysConfig={updateSysConfig} filiaisDb={filiaisDb} showToast={showToast} addLog={addLog} setModalConfig={setModalConfig} isOverclocked={isOverclocked} />}
          {abaAtiva === 'billing' && <TelaBilling api={api} socket={socket} sysConfig={sysConfig} filiaisDb={filiaisDb} showToast={showToast} addLog={addLog} updateSysConfig={updateSysConfig} setModalConfig={setModalConfig} isOverclocked={isOverclocked} />}
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
        if (isMounted && res.data && res.data.uptime !== undefined) setServerStartTime(Date.now() - (res.data.uptime * 1000));
      } catch (e) { if (isMounted) setUptimeStr('OFFLINE'); }
    };
    fetchRealUptime();
    const syncInterval = setInterval(fetchRealUptime, 30000);
    return () => { isMounted = false; clearInterval(syncInterval); };
  }, [api]);

  useEffect(() => {
    if (!serverStartTime) return;
    const iUptime = setInterval(() => {
      const diff = Math.floor((Date.now() - serverStartTime) / 1000);
      const d = Math.floor(diff / 86400); const h = String(Math.floor((diff % 86400) / 3600)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0'); const s = String(diff % 60).padStart(2, '0');
      if (d > 0) setUptimeStr(`${d}d ${h}:${m}:${s}`); else setUptimeStr(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(iUptime);
  }, [serverStartTime]);

  useEffect(() => {
    let isMounted = true;
    const i1 = setInterval(() => {
      if (!isMounted) return;
      if(sysConfig.maintenanceMode) {
        setMetrics({ cpu: 1, ram: 15, ping: 5, reqs: 0, dbQps: 0, bandwidth: 0 });
        setMetricHistory(prev => [...prev.slice(1), { time: new Date().toLocaleTimeString('pt-BR', { second: '2-digit' }), cpu: 1, ram: 15, bw: 0, db: 0 }]);
        setLatencyData([]); return;
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
      setLatencyData([{ range: '10ms', count: Math.floor(Math.random() * 200) + 300 }, { range: '50ms', count: Math.floor(Math.random() * 100) + 150 }, { range: '100ms', count: Math.floor(Math.random() * 50) + 50 }, { range: '200ms', count: Math.floor(Math.random() * 20) + 10 }, { range: '500ms+', count: Math.floor(Math.random() * 5) }]);
    }, 2000);

    const i2 = setInterval(() => {
      if (!isMounted || sysConfig.maintenanceMode) return;
      const rotas = [{ method: 'MQTT', route: 'telemetry/esp32/temp_hum', color: isOverclocked ? '#ef4444' : '#10b981', status: 'ACK' }, { method: 'POST', route: '/api/v1/auth/verify', color: '#f59e0b', status: '201 OK' }, { method: 'WSS', route: '/ws/stream/events', color: '#a855f7', status: '101 SW' }, { method: 'GET', route: '/api/v1/sys/health', color: '#38bdf8', status: '304 CA' }];
      const r = rotas[Math.floor(Math.random() * rotas.length)]; const geo = locs[Math.floor(Math.random() * locs.length)];
      setApiTraffic(prev => [...prev.slice(-40), { id: Date.now() + Math.random(), method: r.method, color: r.color, route: r.route, status: r.status, geo, ip: `192.168.${Math.floor(Math.random()*10)}.${Math.floor(Math.random() * 255)}`, ms: Math.floor(Math.random() * 40)+5 }]);
    }, isOverclocked ? 100 : 250);

    const i3 = setInterval(() => {
      if (!isMounted || sysConfig.maintenanceMode) return;
      const ataques = ['TENTATIVA_INJEÇÃO_SQL', 'DDOS_SYN_FLOOD', 'BRUTE_FORCE_JWT', 'PATH_TRAVERSAL'];
      const ips = [`45.33.${Math.floor(Math.random() * 255)}.12`, `188.166.${Math.floor(Math.random() * 255)}.55`, `104.28.${Math.floor(Math.random() * 255)}.1`];
      const atk = `[BLOQUEIO IDS] ASSINATURA: ${ataques[Math.floor(Math.random() * ataques.length)]} -> PACOTE DESCARTADO de ${ips[Math.floor(Math.random() * ips.length)]} (${locs[Math.floor(Math.random() * locs.length)]})`;
      setThreats(prev => [...prev.slice(-20), { id: Date.now(), text: atk }]);
    }, isOverclocked ? 1500 : 3500);

    const i4 = setInterval(() => {
      if (!isMounted || sysConfig.maintenanceMode) return;
      if (Math.random() > 0.6) {
        const errors = [{ msg: 'Aviso: Sobrecarga temporária na API conectora.', type: 'warning' }, { msg: 'Crítico: Latência do Cluster MySQL Master > 200ms.', type: 'critical' }, { msg: 'Aviso: Memória Cache Redis atingindo 85% de capacidade.', type: 'warning' }, { msg: 'Nó Edge [Filial SP] não envia Heartbeat há 2 min.', type: 'warning' }, { msg: 'Queda de comunicação com Broker MQTT. Tentando reconectar.', type: 'critical' }];
        const err = errors[Math.floor(Math.random() * errors.length)];
        setIncidents(prev => [...prev.slice(-15), { id: Date.now(), ...err, time: new Date().toLocaleTimeString('pt-BR', { second: '2-digit', minute: '2-digit', hour: '2-digit' }) }]);
      }
    }, 5000);

    return () => { isMounted = false; clearInterval(i1); clearInterval(i2); clearInterval(i3); clearInterval(i4); };
  }, [sysConfig.maintenanceMode, isOverclocked]);

  useEffect(() => { if (trafficContainerRef.current) trafficContainerRef.current.scrollTop = trafficContainerRef.current.scrollHeight; }, [apiTraffic]);
  useEffect(() => { if (wafContainerRef.current) wafContainerRef.current.scrollTop = wafContainerRef.current.scrollHeight; }, [threats]);
  useEffect(() => { if (incidentsContainerRef.current) incidentsContainerRef.current.scrollTop = incidentsContainerRef.current.scrollHeight; }, [incidents]);
  useEffect(() => { if (scopeType === 'ROLE') setActiveScope('GLOBAL'); else setActiveScope(usuariosLista?.[0]?.usuario || ''); }, [scopeType, usuariosLista]);

  const regrasAtivas = (scopeType === 'USER' ? sysConfig?.regras?.USERS?.[activeScope] : sysConfig?.regras?.[activeScope]) || { modulosOcultos: [], features: {} };
  const handleToggleModulo = (id) => { updateSysConfig(scopeType, activeScope, 'modulosOcultos', id); addLog(`[MATRIZ_UI] Módulo '${id}' reconfigurado.`, 'warning'); };

  const executarAcaoEmergencia = (acao) => {
    setActionLoading(acao); addLog(`[EMERGÊNCIA] Protocolo acionado: ${acao}`, 'error');
    setTimeout(() => {
      setActionLoading(null); showToast(`Protocolo ${acao} executado.`, 'success'); addLog(`[SISTEMA] Comando '${acao}' finalizado com sucesso.`, 'success');
      if (acao === 'LIMPAR CACHE REDIS') setIncidents([]);
    }, 2000);
  };

  const handleToggleOverclock = () => {
    setIsOverclocked(!isOverclocked);
    addLog(isOverclocked ? '[SISTEMA] OVERCLOCK DESATIVADO. Retornando ao estado nominal.' : '[SISTEMA] AVISO: OVERCLOCK INICIADO. Injeção de tráfego sintético ativa.', isOverclocked ? 'success' : 'error');
    if (!isOverclocked) showToast('ALERTA: Simulador de Stress Ativado!', 'error');
  };

  // ============================================================================
  // MATRIZ DE UI - ORDENADA ALFABETICAMENTE
  // ============================================================================
  const TODOS_MODULOS = [
    { id: 'assistente', nome: 'Assistente de Operação' },
    { id: 'atualizacoes', nome: 'Atualizações / Deploy' },
    { id: 'soc', nome: 'Auditoria / SOC' },
    { id: 'central_procedimentos', nome: 'Central de Procedimentos' },
    { id: 'centro_comando', nome: 'Centro de Comando' },
    { id: 'bi', nome: 'Centro de Inteligência (BI)' },
    { id: 'chamados', nome: 'Chamados' },
    { id: 'chat', nome: 'Chat' },
    { id: 'checklist_turno', nome: 'Checklist de Turno' },
    { id: 'sql_terminal', nome: 'Console SQL' },
    { id: 'metrologia', nome: 'Controlo Metrológico' },
    { id: 'billing', nome: 'Core Financeiro' },
    { id: 'dashboard', nome: 'Dashboard Operacional' },
    { id: 'equipamentos', nome: 'Equipamentos' },
    { id: 'kanban', nome: 'Gestão Ágil (Kanban)' },
    { id: 'lojas', nome: 'Gestão de Lojas' },
    { id: 'energia', nome: 'Gestão Energética' },
    { id: 'hardware', nome: 'Hardware IoT' },
    { id: 'historico_chamados', nome: 'Histórico de Chamados' },
    { id: 'historico', nome: 'Histórico de Logs' },
    { id: 'usuarios', nome: 'Identidades e Acessos' },
    { id: 'saas', nome: 'Licenças SaaS' },
    { id: 'websocket_stream', nome: 'Live Firehose' },
    { id: 'umidade', nome: 'Monitoramento de Umidade' },
    { id: 'motores', nome: 'Monitoramento Térmico' },
    { id: 'system', nome: 'Operações do Sistema' },
    { id: 'empresas', nome: 'Organizações' },
    { id: 'dev_panel', nome: 'Painel de Controle' },
    { id: 'parametros', nome: 'Parâmetros Globais' },
    { id: 'plano_dia', nome: 'Plano do Dia' },
    { id: 'mapa', nome: 'Planta Digital' },
    { id: 'relatorios', nome: 'Relatórios' },
    { id: 'resumo_loja', nome: 'Resumo da Loja' },
    { id: 'resumo_turno', nome: 'Resumo de Turno' },
    { id: 'resumo_executivo', nome: 'Resumo Executivo' },
    { id: 'simulador', nome: 'Simulador Edge' },
    { id: 'sobre', nome: 'Sobre a Plataforma' },
    { id: 'suporte', nome: 'Suporte ao Sistema' }
  ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

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
        <div className="defcon-title glitch-hover"><TermoSyncLogo size={18} color={defconColor} /> THERMOSYNC</div>
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
        <div className="noc-hud-card" style={{'--card-color': colorPrimary}}><div className="noc-mini-header"><span className="noc-kpi-title"><Cpu size={14}/> USO DE CPU</span></div><div className="noc-kpi-value">{metrics.cpu}<span className="noc-kpi-unit">%</span></div><RenderSparkline dataKey="cpu" color={colorPrimary} /></div>
        <div className="noc-hud-card" style={{'--card-color': colorSec}}><div className="noc-mini-header"><span className="noc-kpi-title"><HardDrive size={14}/> MEMÓRIA (RAM)</span></div><div className="noc-kpi-value" style={{color: colorSec}}>{metrics.ram}<span className="noc-kpi-unit">%</span></div><RenderSparkline dataKey="ram" color={colorSec} /></div>
        <div className="noc-hud-card" style={{'--card-color': colorSec}}><div className="noc-mini-header"><span className="noc-kpi-title"><Globe size={14}/> TRÁFEGO</span></div><div className="noc-kpi-value" style={{color: colorSec}}>{metrics.bandwidth}<span className="noc-kpi-unit">Mb/s</span></div><RenderSparkline dataKey="bw" color={colorSec} /></div>
        <div className="noc-hud-card" style={{'--card-color': '#a855f7'}}><div className="noc-mini-header"><span className="noc-kpi-title"><Database size={14}/> QUERIES DB</span></div><div className="noc-kpi-value" style={{color: '#a855f7'}}>{metrics.dbQps}<span className="noc-kpi-unit">QPS</span></div><RenderSparkline dataKey="db" color="#a855f7" /></div>
      </div>

      <div className="noc-main-grid anim-stagger-2">
        <div className="cyber-panel">
          <div className="cyber-panel-header glitch-hover">
             <div style={{display:'flex', gap:'8px', alignItems:'center'}}>Osciloscópio de Rede</div>
             <span style={{fontSize: '0.8rem', color: 'var(--bg-dark)', fontWeight: '900', fontFamily: 'Montserrat', background: 'var(--theme-main)', padding: '4px 10px', borderRadius: '6px'}}>{sysConfig.maintenanceMode ? '0' : metrics.reqs} REQ/s</span>
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
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>{latencyData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={index > 2 ? '#ef4444' : colorSec} /> ))}</Bar>
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
                <div className="block-header"><span className="block-name"><Server size={14} color="var(--status-color)"/> {node.name}</span><span className="block-ping" style={{color: 'var(--status-color)'}}>{node.ping}ms</span></div>
                <span className="block-role" style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{node.role}</span>
              </div>
            ))}
          </div>
          <div className="radar-container">
            <div className="radar-grid"></div><div className="radar-sweep"></div>
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
            {sysConfig.maintenanceMode ? <div style={{color: 'var(--dim-text)', textAlign: 'center', margin: 'auto', fontStyle: 'italic'}}>Rotas BGP Suspensas</div> : apiTraffic.map((pkt) => (
              <div key={pkt.id} className="terminal-line"><span className="log-method" style={{color: isOverclocked ? 'white' : pkt.color, background: isOverclocked ? '#ef4444' : 'rgba(255,255,255,0.05)'}}>{pkt.method}</span><span className="log-geo">[{pkt.geo}]</span><span className="log-route text-truncate">{pkt.route}</span></div>
            ))}
          </div>
        </div>
        <div className="cyber-terminal" style={{borderColor: 'rgba(245, 158, 11, 0.4)', boxShadow: 'inset 0 0 30px rgba(245, 158, 11, 0.1)'}}>
          <div className="cyber-terminal-header" style={{borderBottomColor: 'rgba(245, 158, 11, 0.4)'}}><div className="cyber-terminal-title" style={{color: '#f59e0b'}}><AlertCircle size={14} /> ALERTAS ATIVOS</div></div>
          <div className="terminal-scroll" ref={incidentsContainerRef}>
            {incidents.length === 0 ? <div style={{color: '#10b981', textAlign: 'center', margin: 'auto', fontWeight: 'bold', fontSize: '0.8rem'}}>Nenhum incidente crítico no momento.</div> : incidents.map((inc) => (
              <div key={inc.id} className={`incident-card ${inc.type}`}><div className="incident-header"><span>{inc.time}</span><span>{inc.type === 'critical' ? 'CRÍTICO' : 'AVISO'}</span></div><div className="incident-desc">{inc.msg}</div></div>
            ))}
          </div>
        </div>
        <div className="cyber-terminal" style={{borderColor: '#ef4444', boxShadow: isOverclocked ? 'inset 0 0 50px rgba(239,68,68,0.3)' : 'inset 0 0 30px rgba(0,0,0,0.8)'}}>
          <div className="cyber-terminal-header" style={{borderBottomColor: 'rgba(239, 68, 68, 0.4)'}}>
            <div className="cyber-terminal-title" style={{color: '#ef4444', display: 'flex', justifyContent: 'space-between', width: '100%'}}><span>LOGS SEGURANÇA WAF</span><span className="defcon-badge" style={{background: `rgba(239,68,68,0.2)`, color: '#ef4444', border: `1px solid #ef4444`}}>NÍVEL: {defconLevel}</span></div>
          </div>
          <div className="terminal-scroll" ref={wafContainerRef} style={{ color: '#ef4444' }}>
            {threats.map((pkt) => <div key={pkt.id} className="terminal-line log-error"><span style={{ marginRight: '4px' }}>✖</span> {pkt.text}</div>)}
          </div>
        </div>
      </div>

      <div className="switchboard-grid anim-stagger-3">
        <div className="switch-panel">
          <div className="switch-panel-title"><ShieldCheck size={14}/> GESTÃO DE IDENTIDADE (IAM)</div>
          <div className="scope-types"><button className={scopeType === 'ROLE' ? 'active' : ''} onClick={() => setScopeType('ROLE')}>POR CARGO</button><button className={scopeType === 'USER' ? 'active' : ''} onClick={() => setScopeType('USER')}>POR UTILIZADOR</button></div>
          <div className="scope-targets" style={{marginTop: 'auto'}}>
            {scopeType === 'ROLE' && <div className="scope-tabs"><button className={activeScope === 'GLOBAL' ? 'active' : ''} onClick={() => setActiveScope('GLOBAL')}>Global</button><button className={activeScope === 'ADMIN' ? 'active' : ''} onClick={() => setActiveScope('ADMIN')}>Admins</button><button className={activeScope === 'LOJA' ? 'active' : ''} onClick={() => setActiveScope('LOJA')}>Lojistas</button></div>}
            {scopeType === 'USER' && <select value={activeScope} onChange={e => setActiveScope(e.target.value)} className="dev-select-input">{usuariosLista?.map((u, i) => <option key={i} value={u.usuario}>{u.nome_tecnico || u.nome_gerente || u.usuario} ({u.role})</option>)}</select>}
          </div>
        </div>
        <div className="switch-panel">
          <div className="switch-panel-title"><div style={{display:'flex', gap:'6px'}}><Settings2 size={14}/> MATRIZ DE UI</div><span className="status-badge" style={{background: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px 6px', fontSize: '0.65rem'}}>{TODOS_MODULOS.length - (regrasAtivas?.modulosOcultos?.length || 0)}/{TODOS_MODULOS.length}</span></div>
          <div className="modulos-list"><div className="modulos-list-help">Ative ou desative cada tela para o escopo selecionado.</div>
            {TODOS_MODULOS.map(m => {
              const isAtivo = !regrasAtivas?.modulosOcultos?.includes(m.id);
              return <div key={m.id} className={`hardware-toggle ${!isAtivo ? 'disabled' : ''}`}><span>{m.nome}</span><button className={`btn-toggle-ui ${isAtivo ? 'on' : 'off'}`} onClick={() => handleToggleModulo(m.id)}>{isAtivo ? 'ON' : 'OFF'}</button></div>;
            })}
          </div>
        </div>
        <div className="switch-panel">
          <div className="switch-panel-title" style={{color: '#ef4444'}}><Flame size={14}/> PROTOCOLOS DE EMERGÊNCIA</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center', height: '100%'}}>
            <button className="btn-emergency warning" onClick={() => executarAcaoEmergencia('LIMPAR CACHE REDIS')} disabled={actionLoading !== null || sysConfig.maintenanceMode}>{actionLoading === 'LIMPAR CACHE REDIS' ? <Loader2 size={16} className="spin"/> : <RefreshCw size={16}/>} {actionLoading === 'LIMPAR CACHE REDIS' ? 'A EXECUTAR...' : 'LIMPAR CACHE REDIS'}</button>
            <button className="btn-emergency" onClick={() => executarAcaoEmergencia('REINICIAR PODS DOCKER')} disabled={actionLoading !== null || sysConfig.maintenanceMode}>{actionLoading === 'REINICIAR PODS DOCKER' ? <Loader2 size={16} className="spin"/> : <ServerCrash size={16}/>} {actionLoading === 'REINICIAR PODS DOCKER' ? 'A REINICIAR NOS...' : 'REINICIAR PODS DOCKER'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TELA DE CONTROLO DO SISTEMA (CONFIGURAÇÕES GLOBAIS)
// ============================================================================
const TelaSistema = ({ api, showToast, addLog, sysConfig, updateSysConfig, setModalConfig }) => {
  const [globalBanner, setGlobalBanner] = useState(sysConfig?.regras?.GLOBAL?.features?.globalBanner || '');
  const [isExporting, setIsExporting] = useState(null);
  const [isPurging, setIsPurging] = useState(false);
  const [storageUsed, setStorageUsed] = useState(87);

  const handleMaintenance = () => { 
    const novoEstado = !sysConfig.maintenanceMode; 
    setModalConfig({
      isOpen: true, title: novoEstado ? 'Ativar Lockdown de Segurança' : 'Retomar Operações',
      message: novoEstado ? 'Deseja bloquear todas as operações de telemetria e colocar o sistema em modo Offline? Novos dados IoT serão descartados.' : 'Deseja retomar as operações normais e reabrir o fluxo de dados dos nós Edge?',
      onConfirm: () => {
        updateSysConfig('ROLE', 'GLOBAL', 'maintenanceMode', null, novoEstado); 
        addLog(`Status da API alterado para: ${novoEstado ? 'OFFLINE' : 'ONLINE'}`, novoEstado ? 'error' : 'success');
        showToast(novoEstado ? 'Sistema em modo Offline.' : 'Sistema operacional liberado.', novoEstado ? 'warning' : 'success');
      }
    });
  };

  const handlePurge = () => {
    setModalConfig({
      isOpen: true, title: 'Limpeza de Dados (Purge)',
      message: 'Tem a certeza de que deseja apagar permanentemente todos os registos de telemetria com mais de 90 dias da base de dados MySQL? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        setIsPurging(true);
        try {
          const res = await api.post('/system/purge', { dias: 90 });
          showToast(`Registos antigos apagados com sucesso.`, 'success'); addLog(`[DB] Exclusão executada: ${res.data?.deleted || 0} linhas removidas.`, 'warning'); setStorageUsed(12);
        } catch (e) { showToast('Falha na exclusão.', 'error'); }
        setIsPurging(false);
      }
    });
  };

  const exportarTabelaReal = async (nomeTabela) => {
    setIsExporting(nomeTabela); addLog(`[DB] A iniciar extração de ${nomeTabela}...`, 'info');
    try {
      const res = await api.post('/system/exportar-tabela', { tabela: nomeTabela });
      if (!res.data.dados || res.data.dados.length === 0) return showToast('A tabela está vazia.', 'warning');
      const cabecalhos = Object.keys(res.data.dados[0]).join(',');
      const linhas = res.data.dados.map(l => Object.values(l).map(v => v === null ? '""' : `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), `${cabecalhos}\n${linhas}`], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Dump_${nomeTabela}_${Date.now()}.csv`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      showToast(`Download de ${nomeTabela} concluído!`, 'success'); addLog(`[DB] Dump CSV extraído.`, 'success');
    } catch (erro) { showToast('Falha ao aceder à BD.', 'error'); addLog(`[DB ERR] Ligação recusada.`, 'error'); } finally { setIsExporting(null); }
  };

  return (
    <div className="dev-tela-scroll">
      <div className="dev-grid-main">
        <div className="dev-col-left">
          <div className="sys-control-card warning">
            {sysConfig.maintenanceMode && <div className="hazard-stripes"></div>}
            <div className="dev-card-header" style={{color: '#f59e0b', flexWrap: 'wrap'}}><Radio size={24}/><h3>Controle de Operações Globais</h3></div>
            <div style={{position: 'relative', zIndex: 2}}>
              <div className={`sys-status-banner ${sysConfig.maintenanceMode ? 'sys-status-offline' : 'sys-status-online'}`}>{sysConfig.maintenanceMode ? <AlertOctagon size={20} /> : <ShieldCheck size={20} />} STATUS CORE: {sysConfig.maintenanceMode ? 'LOCKDOWN (OFFLINE)' : 'OPERACIONAL (ONLINE)'}</div>
              <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '10px', fontWeight: 'bold'}}>Transmissão Global (Broadcast Tático):</p>
              <textarea className="transmit-box" value={globalBanner} onChange={e => setGlobalBanner(e.target.value)} placeholder="> INSERIR DIRETIVA GLOBAL AQUI_" spellCheck="false" />
              <button className="btn btn-primary w-100" onClick={() => { updateSysConfig('ROLE', 'GLOBAL', 'features', 'globalBanner', globalBanner); showToast('Comunicado emitido.', 'success'); addLog('Mensagem Global transmitida na rede.', 'info'); }} style={{marginBottom: '30px', backgroundColor: '#f59e0b'}}><Send size={18} style={{marginRight: '8px'}}/> TRANSMITIR MENSAGEM</button>
              <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '10px', fontWeight: 'bold'}}>Interruptor de Segurança Crítica:</p>
              <button className={`btn w-100 ${sysConfig.maintenanceMode ? 'btn-success' : 'btn-danger pulse-danger-btn'}`} onClick={handleMaintenance}>{sysConfig.maintenanceMode ? <><Unlock size={22} /> DESBLOQUEAR SISTEMA</> : <><Lock size={22} /> INICIAR LOCKDOWN CRÍTICO</>}</button>
            </div>
          </div>
        </div>
        <div className="dev-col-right">
          <div className="sys-control-card primary">
             <div className="dev-card-header" style={{color: 'var(--theme-sec)', flexWrap: 'wrap'}}><Database size={24}/><h3>Pipelines de Extração (MySQL)</h3></div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <button onClick={() => exportarTabelaReal('equipamentos')} disabled={isExporting !== null} className="btn btn-outline w-100" style={{justifyContent: 'flex-start', padding: '16px', borderRadius: '8px'}}><Loader2 size={18} className={isExporting === 'equipamentos' ? 'spin' : 'd-none'} /> <Server size={18} color="var(--theme-sec)"/> DUMP TABELA: EQUIPAMENTOS EDGE</button>
               <button onClick={() => exportarTabelaReal('leituras_telemetria')} disabled={isExporting !== null} className="btn btn-outline w-100" style={{justifyContent: 'flex-start', padding: '16px', borderRadius: '8px'}}><Loader2 size={18} className={isExporting === 'leituras_telemetria' ? 'spin' : 'd-none'} /> <Activity size={18} color="var(--theme-main)"/> DUMP TABELA: TELEMETRIA CONTÍNUA</button>
             </div>
          </div>
          <div className="sys-control-card danger">
            <div className="dev-card-header" style={{color: '#ef4444', position: 'relative', zIndex: 2, flexWrap: 'wrap'}}><ServerCrash size={24}/><h3>Apagar Base de Dados</h3></div>
            <div style={{marginBottom: '25px', position: 'relative', zIndex: 2}}>
               <div className="storage-info" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}><span style={{ color: '#cbd5e1' }}>Consumo Volume DB</span><span style={{ color: storageUsed > 80 ? '#ef4444' : 'var(--theme-main)' }}>{storageUsed}% / 100%</span></div>
               <div className="storage-bar-bg" style={{ height: '10px' }}><div className="storage-bar-fill" style={{ width: `${storageUsed}%`, background: storageUsed > 80 ? '#ef4444' : 'var(--theme-main)' }}></div></div>
            </div>
            <button className="btn btn-outline w-100" onClick={handlePurge} disabled={isPurging} style={{color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', padding: '16px', borderRadius: '8px'}}>{isPurging ? <Loader2 size={18} className="spin"/> : <Eraser size={18}/>} Apagar...</button>
            <div className="hazard-stripes"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TELA SAAS E MULTITENANCY (MELHORADA COM 360 VIEW)
// ============================================================================
const TelaSaaS = ({ api, sysConfig, updateSysConfig, filiaisDb, showToast, addLog, setModalConfig }) => {
  const [chavesAPI, setChavesAPI] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modal360, setModal360] = useState(null);

  const handleMudarPlano = (loja, plano) => { updateSysConfig(null, loja, 'saas_plan', null, plano); addLog(`[SAAS] Contrato de ${loja} alterado para ${plano}.`, plano === 'SUSPENSO' ? 'error' : 'success'); showToast(`Licença de ${loja} atualizada.`, plano === 'SUSPENSO' ? 'error' : 'success'); };
  const handleMudarRetencao = (loja, dias) => { addLog(`[CLOUD] Limite de retenção de ${loja} ajustado para ${dias} dias.`, 'info'); showToast(`Cluster de dados de ${loja} ajustado.`, 'success'); };

  const handleForcarLogout = (loja) => {
    setModalConfig({
      isOpen: true, title: 'Forçar Logout Remoto',
      message: `Tem a certeza de que deseja acionar o Kill Switch para a organização ${loja}? Todos os utilizadores locais serão desconectados instantaneamente.`,
      onConfirm: () => { localStorage.setItem('termosync_force_logout', `${loja}_${Date.now()}`); addLog(`[SECURITY] Sinal de KILL SWITCH disparado para: ${loja}.`, 'error'); showToast(`Comando de expulsão enviado para ${loja}.`, 'success'); }
    });
  };

  const gerarChaveAPI = (loja) => {
    const key = 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setChavesAPI(prev => ({ ...prev, [loja]: key })); addLog(`[API] Nova chave gerada para ${loja}.`, 'success'); showToast(`Chave API gerada.`, 'success');
  };

  const copyToClipboard = (loja, key) => { navigator.clipboard.writeText(key); setCopiedKey(loja); setTimeout(() => setCopiedKey(null), 2000); showToast('Chave copiada!', 'info'); };
  
  const loginAs = async (loja) => {
    addLog(`[AUTH] A solicitar token de Impersonate para ${loja}...`, 'warning');
    showToast(`A gerar acesso remoto...`, 'warning');
    try {
      const res = await api.post('/impersonate', { filialDestino: loja }); 
      const url = new URL(window.location.href); url.searchParams.set('impersonateToken', res.data.token); url.searchParams.set('impersonateLoja', loja); window.open(url.toString(), '_blank');
    } catch (err) { showToast('Erro ao criar sessão remota.', 'error'); }
  };

  const lojasFiltradas = (filiaisDb || []).filter(f => f.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalLojas = (filiaisDb || []).length;
  const ativas = (filiaisDb || []).filter(f => sysConfig.planos?.[f] !== 'SUSPENSO').length;
  const suspensas = totalLojas - ativas;

  return (
    <div className="dev-tela-scroll">
      <div className="noc-hud-grid anim-stagger-1" style={{ marginBottom: '10px' }}>
        <div className="noc-hud-card" style={{'--card-color': 'var(--theme-sec)', minHeight: '100px'}}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><Building2 size={14}/> Total de Tenants</span></div>
          <div className="noc-kpi-value" style={{color: 'var(--theme-sec)'}}>{totalLojas}</div>
        </div>
        <div className="noc-hud-card" style={{'--card-color': '#10b981', minHeight: '100px'}}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><ShieldCheck size={14}/> Licenças Ativas</span></div>
          <div className="noc-kpi-value" style={{color: '#10b981'}}>{ativas}</div>
        </div>
        <div className="noc-hud-card" style={{'--card-color': '#ef4444', minHeight: '100px'}}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><ShieldBan size={14}/> Em Lockdown</span></div>
          <div className="noc-kpi-value" style={{color: '#ef4444'}}>{suspensas}</div>
        </div>
      </div>

      <div className="dev-card glass-card anim-stagger-2" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid #a855f7' }}>
        <div className="dev-card-header flex-between" style={{ color: '#a855f7', padding: '1.5rem', marginBottom: 0, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldAlert size={24} /><h3>Contas Corporativas e Integrações API</h3></div>
          <div className="iam-search-box" style={{ maxWidth: '300px' }}>
            <Search size={16} color="#64748b" />
            <input type="text" placeholder="Procurar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
        
        <div className="table-responsive-wrapper">
          <div className="saas-table-header saas-grid-cols" style={{ gridTemplateColumns: '1.8fr 1.2fr 1fr 1.5fr 1.2fr 150px' }}>
            <div>Organização / Cliente</div><div>Uso / Infraestrutura</div><div>Armazenamento DB</div><div style={{ textAlign: 'center' }}>Chaves API (Webhooks)</div><div style={{ textAlign: 'center' }}>Licença (Acesso)</div><div style={{ textAlign: 'right' }}>Ações Rápidas</div>
          </div>
          <div style={{maxHeight: '55vh', overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px'}}>
            {lojasFiltradas.length === 0 ? (
               <div style={{textAlign: 'center', padding: '30px', color: 'var(--dim-text)'}}>Nenhuma organização encontrada.</div>
            ) : lojasFiltradas.map((filial, index) => {
              const planoAtual = sysConfig.planos?.[filial] || 'FREE'; const isSuspenso = planoAtual === 'SUSPENSO';
              const storagePercent = isSuspenso ? 0 : (planoAtual === 'FREE' ? 85 : (planoAtual === 'PRO' ? 45 : 15));
              const storageColor = storagePercent > 80 ? 'var(--danger)' : (storagePercent > 50 ? 'var(--warning)' : 'var(--theme-main)');
              
              const nodeCount = planoAtual === 'ENTERPRISE' ? Math.floor(Math.random() * 40) + 20 : (planoAtual === 'PRO' ? Math.floor(Math.random() * 15) + 5 : Math.floor(Math.random() * 3) + 1);
              const apiCalls = planoAtual === 'ENTERPRISE' ? (Math.random() * 5 + 1).toFixed(1) + 'M' : (Math.random() * 900 + 100).toFixed(0) + 'K';

              return (
                <div className={`saas-client-row saas-grid-cols ${isSuspenso ? 'row-suspended' : ''}`} style={{ gridTemplateColumns: '1.8fr 1.2fr 1fr 1.5fr 1.2fr 150px' }} key={index}>
                  <div>
                    <div className="text-truncate" style={{ color: isSuspenso ? 'var(--danger)' : 'white', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
                      <div style={{width: '8px', height: '8px', borderRadius: '50%', background: isSuspenso ? '#ef4444' : '#10b981', boxShadow: `0 0 8px ${isSuspenso ? '#ef4444' : '#10b981'}`}}></div>
                      {filial}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dim-text)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Activity size={12}/> SLA: 99.9% (Online)
                    </div>
                  </div>
                  
                  <div style={{ color: 'var(--dim-text)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Server size={12}/> {nodeCount} Nós Edge Ativos</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Globe size={12}/> {apiCalls} Req/mês</span>
                  </div>

                  <div style={{ paddingRight: '15px' }}>
                    <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${storagePercent}%`, backgroundColor: storageColor }}></div></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--dim-text)', display: 'flex', alignItems: 'center', gap: '4px' }}><Cloud size={12} /> {storagePercent}%</span>
                      <select disabled={isSuspenso} onChange={(e) => handleMudarRetencao(filial, e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.8rem', color: 'var(--theme-sec)', outline: 'none', cursor: 'pointer', fontWeight: '800' }}><option value="30">30 Dias</option><option value="90">90 Dias</option><option value="365">1 Ano</option></select>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {chavesAPI[filial] ? (
                      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(168, 85, 247, 0.3)', maxWidth: '100%' }}>
                        <span className="text-truncate" style={{ fontFamily: 'Montserrat', fontSize: '0.9rem', color: '#a855f7', padding: '10px 14px', fontWeight: 'bold', maxWidth: '140px' }}>{chavesAPI[filial].substring(0, 10)}...</span>
                        <button onClick={() => copyToClipboard(filial, chavesAPI[filial])} style={{ background: '#a855f7', border: 'none', color: 'white', padding: '10px 14px', cursor: 'pointer' }}>{copiedKey === filial ? <Check size={16}/> : <Copy size={16}/>}</button>
                      </div>
                    ) : ( <button className="btn-icon-small" title="Gerar Chave API" onClick={() => gerarChaveAPI(filial)} disabled={isSuspenso}><Key size={16} /></button> )}
                  </div>
                  
                  <div style={{textAlign: 'center', padding: '0 10px'}}>
                    <select value={planoAtual} onChange={(e) => handleMudarPlano(filial, e.target.value)} className="plan-dropdown"><option value="FREE">FREE (Básico)</option><option value="PRO">PRO (Avançado)</option><option value="ENTERPRISE">ENTERPRISE (Total)</option><option value="SUSPENSO">⚠️ LOCKDOWN</option></select>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn-icon-small" title="Visão 360 do Cliente" onClick={() => setModal360({ nome: filial, plano: planoAtual, nodes: nodeCount })} style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}><ActivitySquare size={18} /></button>
                    <button className="btn-icon-small" title="Aceder Como Cliente (Impersonate)" onClick={() => loginAs(filial)}><UserCheck size={18} /></button>
                    <button className="btn-icon-small danger-text" title="Forçar Logout Remoto (Kill Switch)" onClick={() => handleForcarLogout(filial)}><Power size={18} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal 360 View do Tenant */}
      {modal360 && (
        <div className="iam-modal-overlay">
          <div className="iam-modal-content" style={{ maxWidth: '600px' }}>
            <div className="iam-modal-header" style={{ background: 'rgba(56, 189, 248, 0.1)', borderBottom: '1px solid rgba(56, 189, 248, 0.3)' }}>
               <h3 style={{ color: '#38bdf8' }}><ActivitySquare size={20}/> Client 360: {modal360.nome}</h3>
               <button className="btn-close-modal" onClick={() => setModal360(null)} style={{background: 'transparent', border: 'none', color: 'white', cursor: 'pointer'}}><X size={20}/></button>
            </div>
            <div className="iam-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px', border: '1px solid var(--border-dim)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>Licença Ativa</span>
                  <div style={{ fontSize: '1.2rem', color: 'white', fontWeight: '900', marginTop: '5px' }}>{modal360.plano}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px', border: '1px solid var(--border-dim)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>Nós Conectados</span>
                  <div style={{ fontSize: '1.2rem', color: 'var(--theme-main)', fontWeight: '900', marginTop: '5px', fontFamily: 'Montserrat' }}>{modal360.nodes} / ∞</div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px', border: '1px solid var(--border-dim)', marginTop: '5px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--theme-sec)', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '15px' }}><Cpu size={16}/> Consumo de Carga Isolada (Pods)</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   <div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px' }}><span>CPU (vCores)</span><span>32%</span></div>
                     <div className="storage-bar-bg" style={{height: '6px', margin: 0}}><div className="storage-bar-fill" style={{ width: '32%', background: 'var(--theme-sec)' }}></div></div>
                   </div>
                   <div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px' }}><span>Memória Cache (Redis)</span><span>65%</span></div>
                     <div className="storage-bar-bg" style={{height: '6px', margin: 0}}><div className="storage-bar-fill" style={{ width: '65%', background: '#f59e0b' }}></div></div>
                   </div>
                   <div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px' }}><span>Webhooks Simultâneos</span><span>12 / 50</span></div>
                     <div className="storage-bar-bg" style={{height: '6px', margin: 0}}><div className="storage-bar-fill" style={{ width: '24%', background: '#a855f7' }}></div></div>
                   </div>
                </div>
              </div>
            </div>
            <div className="iam-modal-footer"><button type="button" className="btn btn-primary w-100" onClick={() => setModal360(null)}>Fechar Inspeção</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// TELA BILLING (FINANCEIRO E FATURAMENTO) - MELHORADA COM PDF, NODEMAILER E HISTÓRICO
// ============================================================================
const TelaBilling = ({ api, socket, sysConfig, filiaisDb, showToast, addLog, updateSysConfig, setModalConfig }) => {
  const [billingSetup, setBillingSetup] = useState(() => {
    const saved = localStorage.getItem('termosync_billing_setup');
    return saved ? JSON.parse(saved) : { pro: 299.90, ent: 899.90, diaVencimento: 10, multa: 2.0, juros: 1.0 };
  });
  
  const [faturas, setFaturas] = useState({});
  const [isGenerating, setIsGenerating] = useState(null);
  const [isLoadingFinanceiro, setIsLoadingFinanceiro] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('ALL'); 
  const [modalHistorico, setModalHistorico] = useState(null); // Armazena a filial para mostrar o histórico

  const updateSetup = (key, val) => {
    const newSetup = { ...billingSetup, [key]: parseFloat(val) || 0 };
    setBillingSetup(newSetup);
    localStorage.setItem('termosync_billing_setup', JSON.stringify(newSetup));
  };

  const hoje = new Date();
  const atrasoDiasMesAtual = hoje.getDate() > billingSetup.diaVencimento ? hoje.getDate() - billingSetup.diaVencimento : 0;

  const carregarDadosFinanceiros = useCallback(async () => {
    setIsLoadingFinanceiro(true);
    try {
      const res = await api.get('/financeiro/faturas/atuais');
      setFaturas(res.data || {});
    } catch (e) {
      const fallbackFaturas = {};
      (filiaisDb || []).forEach(filial => { fallbackFaturas[filial] = { foiPaga: false, atrasoDias: 0 }; });
      setFaturas(fallbackFaturas);
    } finally { setIsLoadingFinanceiro(false); }
  }, [api, filiaisDb]);

  useEffect(() => { carregarDadosFinanceiros(); }, [carregarDadosFinanceiros]);

  useEffect(() => {
    if (!socket) return;
    const onPagamentoConfirmado = (data) => {
      setFaturas(prev => ({ ...prev, [data.filial]: { ...prev[data.filial], foiPaga: true, atrasoDias: 0 } }));
      showToast(`Pagamento recebido de ${data.filial} (Tempo Real)!`, 'success');
      addLog(`[FINANCEIRO LIVE] Pagamento automático liquidado para ${data.filial}.`, 'success');
    };
    socket.on('pagamento_confirmado', onPagamentoConfirmado);
    socket.on('atualizacao_dados', carregarDadosFinanceiros);
    return () => { socket.off('pagamento_confirmado', onPagamentoConfirmado); socket.off('atualizacao_dados', carregarDadosFinanceiros); }
  }, [socket, showToast, addLog, carregarDadosFinanceiros]);

  const getDetalhesFatura = useCallback((filial, plano, isSuspenso) => {
    if (plano === 'FREE' && !isSuspenso) return null;
    const dadosFatura = faturas[filial] || { foiPaga: false, atrasoDias: 0 };
    const foiPaga = dadosFatura.foiPaga;
    const diasDeAtraso = dadosFatura.atrasoDias > 0 ? dadosFatura.atrasoDias : (!foiPaga ? atrasoDiasMesAtual : 0);
    
    let base = isSuspenso ? billingSetup.pro : (plano === 'ENTERPRISE' ? billingSetup.ent : billingSetup.pro);
    let valorMulta = 0; let valorJuros = 0; let status = foiPaga ? "PAGO" : "PENDENTE";

    if (!foiPaga && (isSuspenso || diasDeAtraso > 0)) {
      status = isSuspenso ? "VENCIDA" : "ATRASADA";
      valorMulta = base * (billingSetup.multa / 100);
      valorJuros = (base * (billingSetup.juros / 100)) * (diasDeAtraso / 30);
    }

    const dataVenc = new Date();
    dataVenc.setDate(billingSetup.diaVencimento);
    if(status === 'ATRASADA' || status === 'VENCIDA') dataVenc.setMonth(dataVenc.getMonth() - 1);

    // Simula método de pagamento para deixar a UI realista
    const metodo = (filial.length % 2 === 0) ? 'PIX' : 'BOLETO';

    return { base, multa: valorMulta, juros: valorJuros, total: base + valorMulta + valorJuros, status, foiPaga, dataVenc: dataVenc.toLocaleDateString('pt-BR'), metodo };
  }, [faturas, billingSetup, atrasoDiasMesAtual]);

  const metricasFinanceiras = useMemo(() => {
    let mrr = 0; let inadimplencia = 0; let ativos = 0; let pagos = 0; let devendo = 0;
    (filiaisDb || []).forEach((filial) => {
      const plano = sysConfig.planos?.[filial] || 'FREE';
      const fatura = getDetalhesFatura(filial, plano, plano === 'SUSPENSO');
      if (fatura) {
        if (fatura.status === 'VENCIDA' || fatura.status === 'ATRASADA') { inadimplencia += fatura.total; devendo++; }
        else { ativos++; mrr += fatura.total; if (fatura.foiPaga) pagos++; else devendo++; }
      }
    });
    
    const arpu = ativos > 0 ? (mrr / ativos) : 0;
    const taxaInadimplencia = (ativos + devendo) > 0 ? (devendo / (ativos + devendo)) * 100 : 0;

    return { mrr, arr: mrr * 12, inadimplencia, ativos, pagos, devendo, total: (filiaisDb || []).length, arpu, taxaInadimplencia };
  }, [filiaisDb, sysConfig.planos, getDetalhesFatura]);

  const dadosGraficoReceita = useMemo(() => {
    const m = metricasFinanceiras.mrr;
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const dados = []; const mesAtual = hoje.getMonth();
    for (let i = 5; i >= 0; i--) {
      let mesIndex = mesAtual - i; if (mesIndex < 0) mesIndex += 12;
      const multiplicador = 1 - (i * 0.15); 
      dados.push({ mes: i === 0 ? `${mesesNomes[mesIndex]} (Atual)` : mesesNomes[mesIndex], receita: Math.max(0, m * multiplicador) });
    }
    return dados;
  }, [metricasFinanceiras.mrr, hoje]);

  const confirmarPagamento = (filial) => {
    setModalConfig({
      isOpen: true, title: 'Confirmar Liquidação de Fatura',
      message: `Confirma a receção do pagamento da organização ${filial}? O banco de dados será atualizado e bloqueios removidos.`,
      onConfirm: async () => {
        try {
          const planoAtual = sysConfig.planos?.[filial] || 'PRO';
          await api.post(`/financeiro/faturas/${encodeURIComponent(filial)}/pagar`, { billingSetup: billingSetup, plano: planoAtual });
          setFaturas(prev => ({ ...prev, [filial]: { ...prev[filial], foiPaga: true, atrasoDias: 0 } }));
          if (planoAtual === 'SUSPENSO') { updateSysConfig(null, filial, 'saas_plan', null, 'PRO'); addLog(`[FINANCEIRO] Serviço reativado para ${filial}.`, 'success'); } 
          showToast('Pagamento sincronizado.', 'success');
        } catch (error) {
          setFaturas(prev => ({ ...prev, [filial]: { ...prev[filial], foiPaga: true, atrasoDias: 0 } }));
          showToast('Modo Offline: Pagamento forçado localmente.', 'warning');
        }
      }
    });
  };

  const forcarFaturaAtrasada = (filial) => {
    setModalConfig({
      isOpen: true, title: 'Forçar Inadimplência (Dev Tool)',
      message: `Deseja forçar uma fatura em atraso para a organização ${filial}? Isso irá injetar uma dívida no banco e afetar os gráficos MRR.`,
      onConfirm: async () => {
        try {
          const planoAtual = sysConfig.planos?.[filial] || 'PRO';
          await api.post(`/financeiro/faturas/${encodeURIComponent(filial)}/forcar-atraso`, { billingSetup: billingSetup, plano: planoAtual });
          showToast(`Fatura atrasada gerada para ${filial}.`, 'warning');
          addLog(`[FINANCEIRO] Inadimplência simulada via DevTools para ${filial}.`, 'warning');
          carregarDadosFinanceiros(); 
        } catch (error) { showToast('Erro ao forçar atraso.', 'error'); }
      }
    });
  };

  const dispararCobrancaEmLote = async () => {
    addLog(`[CRON] Rotina de emissão em lote enviada para a API...`, 'warning');
    try {
      await api.post('/financeiro/cobranca-lote', { billingSetup: billingSetup, planos: sysConfig.planos || {} });
      showToast('Faturamento em lote processado.', 'success'); 
      carregarDadosFinanceiros();
    } catch(e) {
      setTimeout(() => { showToast('Faturamento em lote simulado.', 'success'); addLog('[CRON] Simulação de lote processada.', 'success'); }, 1500);
    }
  };

  const notificarCobranca = async (filial, fatura) => {
    addLog(`[FINOPS] A processar envio de e-mail SMTP para ${filial}...`, 'warning');
    showToast('A enviar notificação oficial...', 'info');
    try {
      const response = await api.post(`/financeiro/faturas/${encodeURIComponent(filial)}/notificar`, {
        total: fatura.total, vencimento: fatura.dataVenc, plano: sysConfig.planos?.[filial] || 'PRO', status: fatura.status
      });
      addLog(`[FINOPS SMTP] ${response.data.message}`, 'success');
      showToast('E-mail enviado ao cliente!', 'success');
    } catch (error) {
      const erroMsg = error.response?.data?.error || 'Falha SMTP no servidor.';
      showToast(erroMsg, 'error'); addLog(`[FINOPS ERRO] ${erroMsg}`, 'error');
    }
  };

  const simularGeracao = (tipo, filial, callback) => {
    setIsGenerating(`${tipo}_${filial}`); showToast(`A compilar documento ${tipo}...`, 'info');
    setTimeout(() => { callback(); setIsGenerating(null); }, 1200);
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

  const gerarNotaFiscalPDF = (filial, fatura) => {
    simularGeracao('NFe', filial, () => {
      const doc = new jsPDF('p', 'mm', 'a4');
      
      doc.setDrawColor(50); doc.setLineWidth(0.3);
      doc.rect(10, 10, 190, 30);
      doc.setFontSize(14); doc.setFont("helvetica", "bold"); 
      doc.text("PREFEITURA DO MUNICÍPIO DE SÃO PAULO", 105, 18, { align: "center" });
      doc.setFontSize(12); 
      doc.text("NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e", 105, 25, { align: "center" });
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`Data e Hora da Emissão: ${new Date().toLocaleString('pt-BR')} | Código de Verificação: ${Math.random().toString(36).substring(2,10).toUpperCase()}`, 105, 32, { align: "center" });
      doc.setFont("helvetica", "bold"); doc.text(`Número da Nota: ${Math.floor(Math.random() * 90000 + 10000)}`, 105, 37, { align: "center" });

      doc.setFillColor(240, 240, 240); doc.rect(10, 45, 190, 8, 'F'); doc.rect(10, 45, 190, 8);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("PRESTADOR DE SERVIÇOS", 15, 50);
      doc.rect(10, 53, 190, 25);
      doc.setFontSize(11); doc.text("TERMOSYNC SAAS SOLUTIONS LTDA", 15, 60);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); 
      doc.text("CNPJ: 45.123.890/0001-12 | Inscrição Municipal: 9.876.543-2", 15, 65); 
      doc.text("Endereço: Av. Paulista, 1000 - Bela Vista, São Paulo/SP - CEP: 01310-100", 15, 70); 
      doc.text("E-mail: financeiro@termosync.com.br", 15, 75);

      doc.setFillColor(240, 240, 240); doc.rect(10, 83, 190, 8, 'F'); doc.rect(10, 83, 190, 8);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("TOMADOR DE SERVIÇOS", 15, 88);
      doc.rect(10, 91, 190, 25);
      doc.setFontSize(11); doc.text(filial.toUpperCase(), 15, 98);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); 
      doc.text(`CNPJ: ${Math.floor(Math.random()*90 + 10)}.${Math.floor(Math.random()*900 + 100)}.${Math.floor(Math.random()*900 + 100)}/0001-${Math.floor(Math.random()*90 + 10)}`, 15, 103); 
      doc.text("Endereço: Morada predefinida no cadastro do sistema - Brasil", 15, 108);

      doc.setFillColor(240, 240, 240); doc.rect(10, 121, 190, 8, 'F'); doc.rect(10, 121, 190, 8);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("DISCRIMINAÇÃO DOS SERVIÇOS", 15, 126);
      doc.rect(10, 129, 190, 60);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text("CÓD. SERVIÇO: 01.05 - Licenciamento ou cessão de direito de uso de programas de computação.", 15, 136);
      doc.text(`DESCRIÇÃO DETALHADA:`, 15, 146);
      doc.text(`- Assinatura Mensal da Plataforma de Telemetria TermoSync IoT (SaaS)`, 15, 152);
      doc.text(`- Plano Contratado: Licença Corporativa ${sysConfig.planos?.[filial] || 'PRO'}`, 15, 158);
      doc.text(`- Mês de Competência: ${new Date().getMonth() + 1}/${new Date().getFullYear()}`, 15, 164);
      if(fatura.multa > 0 || fatura.juros > 0) {
          doc.setFont("helvetica", "bold");
          doc.text(`- Encargos Adicionais (Multa + Juros de Atraso): R$ ${(fatura.multa + fatura.juros).toFixed(2)}`, 15, 172);
      }

      doc.setFillColor(240, 240, 240); doc.rect(10, 194, 190, 8, 'F'); doc.rect(10, 194, 190, 8);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("VALORES E RETENÇÕES FISCAIS", 15, 199);
      doc.rect(10, 202, 190, 20);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text("PIS (R$): 0,00", 15, 208); doc.text("COFINS (R$): 0,00", 50, 208); doc.text("INSS (R$): 0,00", 90, 208); doc.text("IR (R$): 0,00", 130, 208); doc.text("CSLL (R$): 0,00", 160, 208);
      doc.text("Deduções (R$): 0,00", 15, 216); doc.text(`Base de Cálculo (R$): ${fatura.total.toFixed(2)}`, 60, 216); doc.text("Alíquota ISS (%): 2,00", 110, 216); doc.text(`Valor ISS (R$): ${(fatura.total * 0.02).toFixed(2)}`, 150, 216);

      doc.rect(10, 227, 190, 15);
      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("VALOR LÍQUIDO DA NOTA FISCAL: R$", 90, 236);
      doc.setFontSize(16); doc.text(`${fatura.total.toFixed(2).replace('.', ',')}`, 170, 237);

      doc.save(`NFS-e_${filial.replace(/ /g, '_')}_${Date.now()}.pdf`);
      addLog(`[BILLING] NFS-e Oficial gerada para ${filial}.`, 'success'); 
      showToast('Nota Fiscal gerada com sucesso.', 'success');
    });
  };

  const gerarBoletoPDF = (filial, fatura) => {
    simularGeracao('Boleto', filial, () => {
      const doc = new jsPDF('p', 'mm', 'a4'); 
      
      doc.setLineDashPattern([2, 2], 0); doc.line(10, 30, 200, 30); doc.setLineDashPattern([], 0);
      doc.setFontSize(8); doc.text("Corte na linha pontilhada", 160, 28);

      doc.setFont("helvetica", "bold"); doc.setFontSize(14);
      doc.text("BANCO DO BRASIL", 12, 42);
      doc.setFontSize(16); doc.text("| 001-9 |", 65, 42);
      
      const valorStr = fatura.total.toFixed(2).replace('.', '');
      doc.setFontSize(12);
      doc.text(`00190.00009 01234.567890 00000.000000 1 898900000${valorStr.padStart(5, '0')}`, 95, 42);

      doc.setLineWidth(0.2);
      doc.rect(10, 48, 190, 85);
      doc.line(10, 58, 200, 58);
      doc.line(10, 68, 200, 68);
      doc.line(10, 78, 200, 78);
      doc.line(10, 88, 200, 88);
      doc.line(10, 110, 200, 110);
      doc.line(155, 48, 155, 110);

      doc.setFontSize(6); doc.setFont("helvetica", "normal");
      doc.text("Local de Pagamento", 12, 51);
      doc.setFontSize(8); doc.text("PAGÁVEL EM QUALQUER BANCO OU CORRESPONDENTE BANCÁRIO.", 12, 56);
      doc.setFontSize(6); doc.text("Vencimento", 157, 51);
      
      const dataVenc = new Date();
      dataVenc.setDate(billingSetup.diaVencimento);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); 
      doc.text(`${dataVenc.toLocaleDateString('pt-BR')}`, 157, 56);
      
      doc.setFont("helvetica", "normal"); doc.setFontSize(6);
      doc.text("Beneficiário", 12, 61);
      doc.setFontSize(8); doc.text("TERMOSYNC SAAS SOLUTIONS LTDA - CNPJ: 45.123.890/0001-12", 12, 66);
      doc.setFontSize(6); doc.text("Agência/Código Beneficiário", 157, 61);
      doc.setFontSize(9); doc.text("1234-5 / 987654-3", 157, 66);

      doc.setFontSize(6);
      doc.text("Data do Documento", 12, 71); doc.setFontSize(8); doc.text(new Date().toLocaleDateString('pt-BR'), 12, 76);
      doc.setFontSize(6); doc.text("Nº Documento", 50, 71); doc.setFontSize(8); doc.text(`FAT-${Date.now().toString().slice(-6)}`, 50, 76);
      doc.setFontSize(6); doc.text("Espécie Doc.", 90, 71); doc.setFontSize(8); doc.text("DMI", 90, 76);
      doc.setFontSize(6); doc.text("Aceite", 110, 71); doc.setFontSize(8); doc.text("N", 110, 76);
      doc.setFontSize(6); doc.text("Data Processamento", 125, 71); doc.setFontSize(8); doc.text(new Date().toLocaleDateString('pt-BR'), 125, 76);
      doc.setFontSize(6); doc.text("Nosso Número", 157, 71); doc.setFontSize(9); doc.text(`10987654321-0`, 157, 76);

      doc.setFontSize(6);
      doc.text("Uso do Banco", 12, 81); 
      doc.text("Carteira", 50, 81); doc.setFontSize(8); doc.text("17", 50, 86);
      doc.setFontSize(6); doc.text("Espécie Moeda", 75, 81); doc.setFontSize(8); doc.text("R$", 75, 86);
      doc.setFontSize(6); doc.text("Quantidade", 100, 81); doc.text("Valor", 125, 81);
      doc.text("(=) Valor do Documento", 157, 81); 
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(`${fatura.base.toFixed(2)}`, 195, 86, {align: "right"});

      doc.setFont("helvetica", "normal"); doc.setFontSize(6);
      doc.text("Instruções (Texto de responsabilidade do beneficiário)", 12, 91);
      doc.setFontSize(8);
      doc.text(`- NÃO RECEBER APÓS 30 DIAS DO VENCIMENTO.`, 12, 96);
      doc.text(`- APÓS VENCIMENTO COBRAR MULTA DE R$ ${(fatura.base * (billingSetup.multa/100)).toFixed(2)} E JUROS AO MÊS.`, 12, 101);
      doc.text(`- REFERENTE À LICENÇA SAAS TERMOSYNC IOT.`, 12, 106);

      doc.setFontSize(6); doc.text("(-) Descontos / Abatimentos", 157, 91);
      doc.text("(+) Multa / Juros (Atraso)", 157, 98);
      doc.text("(=) Valor a Cobrar", 157, 105);
      
      if (fatura.status === "ATRASADA" || fatura.status === "VENCIDA") {
          doc.setFontSize(8); doc.text(`${(fatura.multa + fatura.juros).toFixed(2)}`, 195, 102, {align: "right"});
          doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(`${fatura.total.toFixed(2)}`, 195, 109, {align: "right"});
      }

      doc.setFont("helvetica", "normal"); doc.setFontSize(6);
      doc.text("Pagador", 12, 113);
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(`${filial.toUpperCase()}`, 12, 118);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(`CNPJ: ${Math.floor(Math.random()*90 + 10)}.${Math.floor(Math.random()*900 + 100)}.${Math.floor(Math.random()*900 + 100)}/0001-${Math.floor(Math.random()*90 + 10)}`, 12, 123);
      doc.text(`Avenida Principal, 1000 - Centro - São Paulo / SP - CEP: 01000-000`, 12, 128);

      drawBarcode(doc, 12, 138, 110, 16);

      doc.save(`Boleto_${filial.replace(/ /g, '_')}_${Date.now()}.pdf`);
      addLog(`[BILLING] Boleto gerado para ${filial}.`, 'success'); 
      showToast('Boleto Bancário gerado.', 'success');
    });
  };

  const gerarCSVRelatorio = () => {
     showToast('Exportando CSV Financeiro...', 'info');
     let csvContent = "Cliente,Plano,Mensalidade,Multas_Juros,Total,Status,Metodo_Pagamento,Vencimento\n";
     filiaisDb?.forEach(filial => {
        const plano = sysConfig.planos?.[filial] || 'FREE';
        const fatura = getDetalhesFatura(filial, plano, plano === 'SUSPENSO');
        if(fatura) {
           csvContent += `"${filial}","${plano}",${fatura.base.toFixed(2)},${(fatura.multa+fatura.juros).toFixed(2)},${fatura.total.toFixed(2)},"${fatura.status}","${fatura.metodo}","${fatura.dataVenc}"\n`;
        }
     });
     const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
     const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `RevOps_Financeiro_${Date.now()}.csv`;
     document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="dev-tela-scroll">
      <div className="flex-header" style={{ padding: 0, background: 'transparent', boxShadow: 'none', marginBottom: '0' }}>
        <div className="dev-card glass-card" style={{ width: '100%', borderTop: '4px solid #eab308' }}>
          <div className="dev-card-header flex-between" style={{ color: '#eab308', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Settings2 size={20} /><h3>Configuração Biling & Pricing</h3></div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-outline" onClick={gerarCSVRelatorio} style={{ fontSize: '0.8rem', padding: '8px 16px', minHeight: '36px', color: '#eab308', borderColor: 'rgba(234, 179, 8, 0.3)' }}><DownloadCloud size={14} style={{marginRight: '6px'}}/> Exportar DRE</button>
              <button className="btn btn-primary" onClick={dispararCobrancaEmLote} style={{ fontSize: '0.8rem', padding: '8px 16px', background: '#eab308', color: '#0f172a', fontWeight: 'bold', minHeight: '36px' }}><RefreshCw size={14} /> Processar Lote</button>
            </div>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr', gap: '1.5rem', marginBottom: '1rem' }} className="dev-grid-main">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div className="dev-card glass-card saas-kpi-card" style={{ padding: '1.2rem', margin: 0, borderLeft: '4px solid var(--theme-main)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{fontSize: '0.8rem', fontWeight: '900', color: 'var(--dim-text)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px'}}><TrendingUp size={16} color="var(--theme-main)"/> MRR MENSAL</span>
            <div style={{color: 'white', fontFamily: 'Montserrat', fontSize: '1.8rem', fontWeight: '900', wordBreak: 'break-word'}}>R$ {metricasFinanceiras.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              <div style={{fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold'}}>ARR: R$ {metricasFinanceiras.arr.toLocaleString('pt-BR')}</div>
              <div style={{fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold'}} title="Average Revenue Per User">ARPU: R$ {metricasFinanceiras.arpu.toFixed(2)}</div>
            </div>
          </div>

          <div className="dev-card glass-card saas-kpi-card" style={{ padding: '1.2rem', margin: 0, borderLeft: '4px solid #ef4444', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{fontSize: '0.8rem', fontWeight: '900', color: 'var(--dim-text)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px'}}><AlertTriangle size={16} color="#ef4444"/> DÍVIDA ATIVA</span>
            <div style={{ color: 'var(--danger)', fontFamily: 'Montserrat', fontSize: '1.8rem', fontWeight: '900', wordBreak: 'break-word'}}>R$ {metricasFinanceiras.inadimplencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              <div style={{fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 'bold'}}>{metricasFinanceiras.pagos} Pagos / {metricasFinanceiras.devendo} Pendentes</div>
              <div style={{fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold'}}>Inadimplência: {metricasFinanceiras.taxaInadimplencia.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <div className="dev-card glass-card" style={{ margin: 0, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
          <div className="dev-card-header" style={{ color: 'var(--theme-main)', marginBottom: '10px' }}><LineChart size={20} /> <h3 style={{ fontSize: '1rem' }}>Evolução de Receita</h3></div>
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
        <div className="dev-card-header flex-between" style={{ color: '#eab308', padding: '1.5rem', marginBottom: 0, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Receipt size={24} /><h3>Faturas Emitidas (Ciclo Atual)</h3>{isLoadingFinanceiro && <Loader2 size={16} className="spin" style={{marginLeft: '10px'}} />}
            </div>
            <div className="scope-tabs" style={{ maxWidth: '400px' }}>
                <button className={filtroStatus === 'ALL' ? 'active' : ''} onClick={() => setFiltroStatus('ALL')} style={{minHeight: '36px', padding: '6px 12px'}}>Todas</button>
                <button className={filtroStatus === 'PAGO' ? 'active' : ''} onClick={() => setFiltroStatus('PAGO')} style={{minHeight: '36px', padding: '6px 12px'}}>Pagas</button>
                <button className={filtroStatus === 'PENDENTES' ? 'active' : ''} onClick={() => setFiltroStatus('PENDENTES')} style={{minHeight: '36px', padding: '6px 12px'}}>Atrasadas</button>
            </div>
        </div>
        
        <div className="table-responsive-wrapper">
          <div className="saas-table-header billing-grid-cols" style={{ gridTemplateColumns: '1.8fr 1.2fr 1fr 1.2fr 1.2fr 280px' }}>
            <div>Cliente Pagador</div><div>Plano / Vencimento</div><div>Multa/Juros</div><div>Total (R$)</div><div style={{ textAlign: 'center' }}>Status / Método</div><div style={{ textAlign: 'right', paddingRight: '20px' }}>Ações de Faturamento</div>
          </div>

          <div style={{maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px'}}>
            {filiaisDb?.map((filial, index) => {
              const planoAtual = sysConfig.planos?.[filial] || 'FREE';
              const fatura = getDetalhesFatura(filial, planoAtual, planoAtual === 'SUSPENSO');
              if (!fatura) return null;
              
              const isLate = fatura.status === 'VENCIDA' || fatura.status === 'ATRASADA';

              if (filtroStatus === 'PAGO' && !fatura.foiPaga) return null;
              if (filtroStatus === 'PENDENTES' && fatura.foiPaga) return null;

              return (
                <div className={`saas-client-row billing-grid-cols ${isLate ? 'row-suspended' : ''}`} style={{ gridTemplateColumns: '1.8fr 1.2fr 1fr 1.2fr 1.2fr 280px' }} key={index}>
                  <div className="text-truncate" style={{fontWeight: '900', color: 'white', fontSize: '1.1rem'}}>{filial}</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: 'var(--theme-sec)', fontWeight: 'bold', fontSize: '0.85rem' }}>{planoAtual} (R$ {fatura.base.toFixed(2)})</span>
                    <span style={{ color: 'var(--dim-text)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12}/> Venc: {fatura.dataVenc}</span>
                  </div>

                  <div style={{ color: isLate ? 'var(--danger)' : 'var(--dim-text)', fontSize: '1rem' }}>R$ {(fatura.multa + fatura.juros).toFixed(2)}</div>
                  <div style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '1.3rem', fontFamily: 'Montserrat' }}>R$ {fatura.total.toFixed(2)}</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span className={`status-badge ${isLate ? 'danger' : 'success'}`}>{fatura.status}</span>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 'bold' }}>VIA {fatura.metodo}</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button className="btn-icon-small" title="Histórico do Cliente" onClick={() => setModalHistorico({nome: filial, fatura})} style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}><History size={16} /></button>
                    {!fatura.foiPaga && <button className="btn-icon-small" title="Confirmar Pagamento (API)" onClick={() => confirmarPagamento(filial)} style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }}><CheckCircle2 size={16} /></button>}
                    {!fatura.foiPaga && !isLate && <button className="btn-icon-small" title="Sinalizar Atraso (Simulador)" onClick={() => forcarFaturaAtrasada(filial)} style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}><CalendarMinus size={16} /></button>}

                    <button className="btn-icon-small" title="Gerar NF-e (PDF)" onClick={() => gerarNotaFiscalPDF(filial, fatura)} disabled={isGenerating !== null}>
                      {isGenerating === `NFe_${filial}` ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
                    </button>
                    <button className="btn-icon-small" title="Gerar Boleto (PDF)" onClick={() => gerarBoletoPDF(filial, fatura)} disabled={isGenerating !== null}>
                       {isGenerating === `Boleto_${filial}` ? <Loader2 size={16} className="spin" /> : <Banknote size={16} />}
                    </button>
                    
                    {isLate && !fatura.foiPaga && (
                      <button className="btn-icon-small danger-text" title="Notificar Cobrança por E-mail" onClick={() => notificarCobranca(filial, fatura)}>
                        <Mail size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal Histórico Financeiro */}
      {modalHistorico && (
        <div className="iam-modal-overlay">
          <div className="iam-modal-content" style={{ maxWidth: '650px' }}>
            <div className="iam-modal-header" style={{ background: 'rgba(234, 179, 8, 0.1)', borderBottom: '1px solid rgba(234, 179, 8, 0.3)' }}>
               <h3 style={{ color: '#eab308' }}><History size={20}/> Extrato: {modalHistorico.nome}</h3>
               <button className="btn-close-modal" onClick={() => setModalHistorico(null)} style={{background: 'transparent', border: 'none', color: 'white', cursor: 'pointer'}}><X size={20}/></button>
            </div>
            <div className="iam-modal-body" style={{ padding: '0' }}>
               <div className="saas-table-header" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', margin: 0, borderRadius: 0, padding: '15px' }}>
                  <div>Competência</div><div>Valor Recebido</div><div style={{textAlign: 'right'}}>Data Liquidação</div>
               </div>
               
               {/* Simula as 3 últimas faturas pagas baseadas na fatura atual */}
               {[1, 2, 3].map((mesVolta) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - mesVolta);
                  const nomeMes = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
                  const dataLiq = new Date(d);
                  dataLiq.setDate(billingSetup.diaVencimento - Math.floor(Math.random() * 3));
                  
                  return (
                    <div key={mesVolta} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '15px', borderBottom: '1px solid var(--border-dim)', background: mesVolta % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.2)' }}>
                      <div style={{ color: 'white', fontWeight: 'bold' }}><FileText size={12} color="var(--dim-text)" style={{marginRight: '6px'}}/> FATURA {nomeMes}</div>
                      <div style={{ color: 'var(--primary)', fontFamily: 'Montserrat', fontWeight: 'bold' }}>R$ {modalHistorico.fatura.base.toFixed(2)}</div>
                      <div style={{ textAlign: 'right', color: '#94a3b8', fontSize: '0.85rem' }}><CheckCircle2 size={12} color="var(--primary)" style={{marginRight: '4px'}}/> {dataLiq.toLocaleDateString('pt-BR')}</div>
                    </div>
                  );
               })}
            </div>
            <div className="iam-modal-footer"><button type="button" className="btn btn-outline w-100" onClick={() => setModalHistorico(null)}>Fechar Extrato</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 8. TELA SOC & GESTÃO DE IDENTIDADE (IAM / ZERO-TRUST)
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
        const loginDate = new Date(s.loginTime); const expiryDate = new Date(loginDate.getTime() + 12 * 60 * 60 * 1000); 
        const minLeft = Math.max(0, Math.floor((expiryDate - new Date()) / 60000));
        return { ...s, loginTimeStr: loginDate.toLocaleString('pt-BR'), expirationMin: minLeft, expirationPercent: Math.min(100, Math.max(0, (minLeft / (12 * 60)) * 100)), device: 'Web Client' };
      }));
      setAuditLogs(resAuditoria.data.map(a => ({ ...a, time: new Date(a.data_hora).toLocaleString('pt-BR'), severity: a.severity || 'info' })));
    } catch (e) { } finally { setIsLoading(false); }
  }, [api]);

  useEffect(() => { carregarDadosSOC(); const interval = setInterval(carregarDadosSOC, 10000); return () => clearInterval(interval); }, [carregarDadosSOC]);

  const diretorioUsuarios = useMemo(() => {
    return (usuariosLista || []).map(u => {
      const session = activeSessions.find(s => s.usuario === u.usuario);
      return { id: u.id, nome: u.nome_tecnico || u.nome_gerente || u.nome_coordenador || u.usuario, usuario: u.usuario, role: u.role, cargo: u.role === 'DEV' ? 'SysAdmin' : (u.role === 'ADMIN' ? 'Administrador' : (u.role === 'MANUTENCAO' ? 'Técnico' : 'Operador')), mfa: mfaUsers.includes(u.id), status: blockedUsers.includes(u.id) ? 'BLOQUEADO' : 'ATIVO', ip: session ? (session.ip === '::1' ? 'Localhost' : session.ip) : 'Offline' };
    });
  }, [usuariosLista, activeSessions, mfaUsers, blockedUsers]);

  const filteredUsuarios = diretorioUsuarios.filter(u => u.nome.toLowerCase().includes(buscaUsuario.toLowerCase()) || u.role.toLowerCase().includes(buscaUsuario.toLowerCase()) || u.cargo.toLowerCase().includes(buscaUsuario.toLowerCase()));
  const contasAtivas = diretorioUsuarios.filter(u => u.status === 'ATIVO').length;
  const tokensValidos = activeSessions.length;
  const tentativasFalhadas = auditLogs.filter(l => l.action === 'LOGIN_FAILED').length;
  const ipsBloqueados = new Set(auditLogs.filter(l => l.action === 'LOGIN_FAILED').map(l => l.actor)).size;
  const score = Math.max(0, 100 - (auditLogs.filter(l => l.severity === 'danger').length * 5));

  const severityData = useMemo(() => { return [ { name: 'Info', count: auditLogs.filter(l => l.severity === 'info').length, fill: '#38bdf8' }, { name: 'Aviso', count: auditLogs.filter(l => l.severity === 'warning').length, fill: '#f59e0b' }, { name: 'Crítico', count: auditLogs.filter(l => l.severity === 'danger').length, fill: '#ef4444' }, { name: 'Sucesso', count: auditLogs.filter(l => l.severity === 'success').length, fill: '#10b981' } ]; }, [auditLogs]);

  const handleRevoke = (id, user) => { setModalConfig({ isOpen: true, title: 'Revogar Acesso JWT', message: `Deseja realmente derrubar a ligação de ${user}?`, onConfirm: async () => { try { await api.post(`/soc/revogar/${id}`); setActiveSessions(prev => prev.filter(s => s.id !== id)); showToast(`Sessão encerrada.`, 'success'); addLog(`[SOC] Sessão forçada ao encerramento: ${user}`, 'error'); carregarDadosSOC(); } catch (e) { showToast('Erro ao revogar sessão.', 'error'); } } }); };
  const handleRevokeAll = () => { setModalConfig({ isOpen: true, title: 'Purga Global de Sessões (Kill-Switch)', message: `ATENÇÃO: Isto irá invalidar TODOS os tokens JWT ativos. Proceder?`, onConfirm: () => { setActiveSessions([]); showToast('Todas as sessões foram terminadas.', 'success'); addLog('[SECURITY] Kill-switch ativado.', 'error'); } }); };
  const toggleRbac = (id, roleKey) => { const newRules = localRbac.map(p => p.id === id ? { ...p, [roleKey]: !p[roleKey] } : p); setLocalRbac(newRules); localStorage.setItem('termosync_rbac_rules', JSON.stringify(newRules)); addLog(`[IAM] Política Atualizada: ${roleKey.toUpperCase()}`, 'warning'); showToast('Política RBAC atualizada.', 'success'); };
  const handleMfaAction = (id, nome) => { const newMfa = mfaUsers.includes(id) ? mfaUsers.filter(uid => uid !== id) : [...mfaUsers, id]; setMfaUsers(newMfa); localStorage.setItem('termosync_mfa_users', JSON.stringify(newMfa)); showToast(`MFA alterado para ${nome}.`, 'info'); addLog(`[IAM] MFA atualizado para: ${nome}`, 'warning'); };
  
  const handleBlockAction = (id, nome) => {
    const isBlocked = blockedUsers.includes(id); const newBlocked = isBlocked ? blockedUsers.filter(uid => uid !== id) : [...blockedUsers, id];
    setBlockedUsers(newBlocked); localStorage.setItem('termosync_blocked_users', JSON.stringify(newBlocked));
    if (isBlocked) { addLog(`[IAM] Utilizador ${nome} desbloqueado.`, 'success'); showToast('Utilizador desbloqueado.', 'success'); } 
    else { addLog(`[IAM] Utilizador ${nome} bloqueado preventivamente.`, 'error'); showToast('Utilizador bloqueado.', 'warning'); const userBase = usuariosLista.find(u => u.id === id); const session = activeSessions.find(s => s.usuario === userBase?.usuario); if (session) api.post(`/soc/revogar/${session.id}`).then(() => carregarDadosSOC()).catch(()=>{}); }
  };

  const salvarNovoUsuario = async (e) => {
    e.preventDefault(); if (!newUser.nome.trim() || !newUser.email.trim()) return showToast('Nome e e-mail são obrigatórios.', 'error');
    try { await api.post('/usuarios', { usuario: newUser.email.split('@')[0], senha: 'Mudar@123', role: newUser.role, nome_tecnico: newUser.role === 'MANUTENCAO' ? newUser.nome : null, nome_gerente: newUser.role === 'LOJA' ? newUser.nome : null, filial: 'Matriz' }); addLog(`[IAM] Nova credencial provisionada: ${newUser.nome}`, 'success'); showToast('Criado! Senha: Mudar@123', 'success'); setIsModalUserOpen(false); setNewUser({ nome: '', email: '', role: 'LOJA', mfa: true }); } catch (err) { showToast('Erro ao gravar na BD.', 'error'); }
  };

  const exportarLogsCSV = () => {
    if (auditLogs.length === 0) return showToast('Sem registos para exportar.', 'warning');
    let csvContent = "Data/Hora,Ação Realizada,Ator,Alvo,Severidade\n"; auditLogs.forEach(log => { csvContent += `"${log.time}","${log.action}","${log.actor}","${log.target}","${(log.severity || 'info').toUpperCase()}"\n`; });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Auditoria_ZeroTrust_${Date.now()}.csv`; link.click();
    showToast('Logs exportados.', 'success'); addLog('[SOC] Exportação CSV de Auditoria concluída.', 'success');
  };

  return (
    <>
      <div className="dev-tela-scroll">
        <div className="noc-hud-grid anim-stagger-1">
          <div className="noc-hud-card" style={{'--card-color': '#a855f7'}}><div className="noc-mini-header"><span className="noc-kpi-title"><Users size={14}/> CONTAS ATIVAS</span></div><div className="noc-kpi-value">{contasAtivas}</div></div>
          <div className="noc-hud-card" style={{'--card-color': '#10b981'}}><div className="noc-mini-header"><span className="noc-kpi-title"><ShieldCheck size={14}/> TOKENS VÁLIDOS</span></div><div className="noc-kpi-value" style={{color: '#10b981'}}>{tokensValidos}</div></div>
          <div className="noc-hud-card pulse-warning-card" style={{'--card-color': '#f59e0b'}}><div className="noc-mini-header"><span className="noc-kpi-title"><UserX size={14}/> TENTATIVAS FALHADAS</span></div><div className="noc-kpi-value" style={{color: '#f59e0b'}}>{tentativasFalhadas}</div></div>
          <div className="noc-hud-card" style={{'--card-color': '#ef4444'}}><div className="noc-mini-header"><span className="noc-kpi-title"><AlertTriangle size={14}/> IPS BLOQUEADOS</span></div><div className="noc-kpi-value" style={{color: '#ef4444'}}>{ipsBloqueados}</div></div>
        </div>

        <div className="dev-grid-main anim-stagger-2">
          <div className="dev-col-left">
            <div className="dev-card glass-card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid #38bdf8' }}>
              <div className="dev-card-header flex-between" style={{color: '#38bdf8', padding: '1.5rem', marginBottom: 0, flexWrap: 'wrap'}}>
                <div style={{display:'flex', gap:'8px', alignItems:'center', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap'}}>
                  <div style={{display:'flex', gap:'8px', alignItems:'center'}}><UserCog size={24}/><h3>Diretório (AD)</h3></div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                    <div className="iam-search-box"><Search size={14} color="#64748b" /><input type="text" placeholder="Procurar utilizador..." value={buscaUsuario} onChange={e => setBuscaUsuario(e.target.value)} /></div>
                    <button className="btn btn-outline" onClick={() => setIsModalUserOpen(true)} style={{padding: '8px 12px', fontSize: '0.75rem', borderColor: 'rgba(56,189,248,0.3)', color: '#38bdf8', minHeight: '34px'}}><UserPlus size={14} style={{marginRight: '6px'}}/> Novo</button>
                  </div>
                </div>
              </div>
              <div className="table-responsive-wrapper">
                <div className="saas-table-header iam-ad-grid-cols"><div>Utilizador / Cargo</div><div>Role do Sistema</div><div>Status / MFA</div><div>Último IP</div><div style={{textAlign: 'right'}}>Ações</div></div>
                <div style={{maxHeight: '40vh', overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px'}}>
                  {filteredUsuarios.map((u) => (
                    <div key={u.id} className={`saas-client-row iam-ad-grid-cols ${u.status === 'BLOQUEADO' ? 'row-suspended' : ''}`}>
                      <div className="user-profile-cell"><div className={`user-avatar ${u.role.toLowerCase()}`}>{u.nome.charAt(0)}</div><div style={{minWidth: 0}}><div className="text-truncate" style={{fontWeight: '900', color: 'white', fontSize: '1.05rem'}}>{u.nome}</div><div className="text-truncate" style={{fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px'}}>{u.cargo}</div></div></div>
                      <div><span className={`role-badge ${u.role.toLowerCase()}`}>{u.role}</span></div>
                      <div>{u.mfa ? <span className="badge-mfa mfa-on"><ShieldCheck size={12}/> MFA ATIVO</span> : (u.status === 'BLOQUEADO' ? <span className="badge-mfa mfa-danger"><LockKeyhole size={12}/> BLOQUEADO</span> : <span className="badge-mfa mfa-off"><ShieldAlert size={12}/> SEM MFA</span>)}</div>
                      <div style={{fontFamily: 'Montserrat', color: 'var(--dim-text)', fontSize: '0.85rem'}}>{u.ip} {u.ip !== 'Offline' && <span className="traffic-indicator-live" style={{marginLeft: '4px'}}></span>}</div>
                      <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px'}}><button className="btn-icon-small" title="Alternar Setup MFA" onClick={() => handleMfaAction(u.id, u.nome)}><ShieldAlert size={16} /></button><button className={`btn-icon-small ${u.status === 'BLOQUEADO' ? 'success-text' : 'danger-text'}`} title={u.status === 'BLOQUEADO' ? "Desbloquear Conta" : "Bloquear Conta"} onClick={() => handleBlockAction(u.id, u.nome)}>{u.status === 'BLOQUEADO' ? <Unlock size={16} color="#10b981" /> : <UserX size={16} />}</button></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="dev-col-right">
            <div className="dev-card glass-card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid #a855f7' }}>
              <div className="dev-card-header flex-between" style={{color: '#a855f7', padding: '1.5rem', marginBottom: 0, flexWrap: 'wrap'}}><div style={{display:'flex', gap:'8px', alignItems:'center'}}><FingerprintIcon size={24}/><h3>Sessões JWT (Live)</h3></div>
                {activeSessions.length > 0 && <button className="btn btn-outline danger-text" onClick={handleRevokeAll} style={{padding: '8px 12px', fontSize: '0.75rem', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444', minHeight: '34px'}}><ShieldBan size={14} style={{marginRight: '6px'}}/> Revogar Tudo</button>}
              </div>
              <div className="table-responsive-wrapper">
                <div className="saas-table-header soc-grid-cols"><div>Utilizador (Token)</div><div>IP / Device</div><div>Ciclo de Vida</div><div style={{textAlign: 'right'}}>Ação</div></div>
                <div style={{maxHeight: '40vh', overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px'}}>
                  {activeSessions.map((s) => (
                    <div key={s.id} className="saas-client-row soc-grid-cols">
                      <div><div className="text-truncate" style={{fontWeight: '900', color: 'white', fontSize: '1.05rem'}}>{s.usuario}</div><div style={{fontSize: '0.85rem', color: '#a855f7', marginTop: '4px', fontWeight: 'bold'}}>{s.role}</div></div>
                      <div><div style={{fontFamily: 'Montserrat', color: 'var(--dim-text)', fontSize: '0.95rem'}}>{s.ip === '::1' ? 'Localhost' : s.ip}</div><div style={{fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: '#cbd5e1'}}><MonitorSmartphone size={12}/>{s.device}</div></div>
                      <div style={{paddingRight: '15px', paddingTop: '4px'}}><div className="progress-bar-bg" style={{marginTop: 0}}><div className="progress-bar-fill" style={{ width: `${s.expirationPercent}%`, backgroundColor: s.expirationPercent < 20 ? '#ef4444' : '#a855f7' }}></div></div><div style={{fontSize: '0.7rem', color: 'var(--dim-text)', display: 'flex', justifyContent: 'space-between', marginTop: '4px'}}><span>Expira em</span><span style={{fontFamily: 'Montserrat'}}>{s.expirationMin} min</span></div></div>
                      <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center'}}><button className="btn-icon-small danger-text" title="Derrubar Ligação" onClick={() => handleRevoke(s.id, s.usuario)}><Power size={18} /></button></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="dev-grid-main anim-stagger-3">
          <div className="dev-col-left">
            <div className="dev-card glass-card" style={{ borderTop: '4px solid var(--secondary)' }}>
              <div className="dev-card-header flex-between" style={{color: 'var(--secondary)', flexWrap: 'wrap'}}><div style={{display:'flex', gap:'8px', alignItems:'center'}}><FileKey size={20}/><h3>Matriz de Permissões (RBAC)</h3></div></div>
              <div className="table-responsive-wrapper" style={{paddingBottom: '0'}}>
                <div className="saas-table-header rbac-grid-cols" style={{background: 'rgba(0,0,0,0.3)', padding: '10px 15px', marginBottom: '8px', textAlign: 'center'}}><div style={{textAlign: 'left'}}>Política de Acesso</div><div>DEV</div><div>ADMIN</div><div>LOJA</div><div>MANUT.</div></div>
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
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                  <History size={20}/>
                  <h3>Registo de Auditoria Zero-Trust</h3>
                </div>
                
                <div 
                  className="status-badge" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${score > 80 ? '#10b981' : (score > 50 ? '#f59e0b' : '#ef4444')}` }}
                >
                  {score > 80 ? (
                    <ShieldCheck size={14} color="#10b981" />
                  ) : (
                    <ShieldAlert size={14} color={score > 50 ? '#f59e0b' : '#ef4444'} />
                  )}
                  <span style={{ fontSize: '0.8rem', fontWeight: '900', color: score > 80 ? '#10b981' : (score > 50 ? '#f59e0b' : '#ef4444') }}>
                    Pontuação SOC: {score}%
                  </span>
                </div>

              </div>

              <div style={{ height: '120px', marginBottom: '15px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={severityData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>{severityData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '25vh', overflowY: 'auto', paddingRight: '10px', marginBottom: '20px'}}>
                {auditLogs.map((log, idx) => (
                  <div key={idx} style={{background: 'rgba(0,0,0,0.3)', borderLeft: `4px solid var(--${log.severity})`, padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', border: '1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '200px'}}>
                      <span style={{color: `var(--${log.severity})`, fontWeight: '900', fontSize: '0.85rem'}}>{log.action}</span>
                      <span style={{color: 'var(--dim-text)', fontSize: '0.75rem'}}>Alvo: <span style={{color: 'white', fontWeight: 'bold'}}>{log.target}</span> | Ator: <span style={{color: 'white', fontWeight: 'bold'}}>{log.actor}</span></span>
                    </div>
                    <div style={{fontSize: '0.7rem', color: 'var(--dim-text)', display: 'flex', alignItems: 'center', gap: '4px', textAlign: 'right', fontWeight: 'bold'}}><Clock size={12}/> {log.time}</div>
                  </div>
                ))}
              </div>
              <button className="btn btn-outline w-100" style={{padding: '16px', display: 'flex', justifyContent: 'center', gap: '10px', fontWeight: '900', borderRadius: '10px', letterSpacing: '0.5px', marginTop: 'auto'}} onClick={exportarLogsCSV}><DownloadCloud size={20}/> EXPORTAR DUMP DE LOGS (CSV)</button>
            </div>
          </div>
        </div>
      </div>

      {isModalUserOpen && (
        <div className="iam-modal-overlay">
          <div className="iam-modal-content">
            <div className="iam-modal-header"><h3><UserPlus size={20}/> Provisionar Credencial</h3><button className="btn-close-modal" onClick={() => setIsModalUserOpen(false)} style={{background: 'transparent', border: 'none', color: 'white', cursor: 'pointer'}}><X size={20}/></button></div>
            <form onSubmit={salvarNovoUsuario} className="iam-modal-body">
              <div className="form-group"><label>Nome do Colaborador</label><input type="text" value={newUser.nome} onChange={e => setNewUser({...newUser, nome: e.target.value})} autoFocus required /></div>
              <div className="form-group"><label>E-mail Corporativo</label><input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} /></div>
              <div className="form-group"><label>Nível de Acesso (Role)</label><select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}><option value="LOJA">Operador</option><option value="MANUTENCAO">Técnico</option><option value="ADMIN">Admin</option><option value="DEV">Root</option></select></div>
              <label className="form-check"><input type="checkbox" checked={newUser.mfa} onChange={e => setNewUser({...newUser, mfa: e.target.checked})} /><span>Exigir MFA no login</span></label>
            </form>
            <div className="iam-modal-footer"><button type="button" className="btn btn-outline" onClick={() => setIsModalUserOpen(false)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={salvarNovoUsuario}><Save size={16}/> Gerar Acesso</button></div>
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
      const res = await api.get('/soc/auditoria'); head = ['Data/Hora', 'Ação', 'Ator', 'Alvo', 'Severidade'];
      body = res.data.map(log => [new Date(log.data_hora).toLocaleString('pt-BR'), log.action, log.actor, log.target, (log.severity || 'INFO').toUpperCase()]);
    } else if (tipo === 'FINOPS_BILLING') {
      head = ['Cliente / Tenant', 'Plano Base', 'Custo', 'Status Financeiro'];
      body = (filiaisDb || []).map(filial => [filial, sysConfig?.planos?.[filial] || 'FREE', sysConfig?.planos?.[filial] === 'ENTERPRISE' ? 'R$ 899,90' : 'R$ 299,90', sysConfig?.planos?.[filial] === 'SUSPENSO' ? 'BLOQUEADO' : 'ATIVO']);
    } else if (tipo === 'SYSOPS_HEALTH') {
      const res = await api.get('/system/health'); head = ['Métrica', 'Valor', 'Status'];
      body = [['Cluster MySQL', res.data.db, 'NORMAL'], ['WebSockets Ativos', res.data.sockets, 'NORMAL'], ['Volume (Registos)', res.data.total_records, 'NORMAL']];
    } else { head = ['Campo 1', 'Campo 2']; body = [['Sem dados', '...']]; }
    return { head, body };
  };

  const gerarRelatorioPDF = async (tipo, tema, cor) => {
    setIsProcessing(`PDF_${tipo}`); showToast(`Compilando PDF: ${tipo}...`, 'warning');
    try {
      await api.post('/system/reports/log', { tipo, formato: 'PDF', solicitante: 'Root/Dev' });
      const { head, body } = await processarDadosRelatorio(tipo);
      const doc = new jsPDF('landscape'); doc.setFillColor(cor); doc.rect(0, 0, 300, 20, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text(`TERMOSYNC ENTERPRISE - RELATÓRIO EXECUTIVO`, 15, 13);
      doc.setTextColor(50, 50, 50); doc.setFontSize(14); doc.text(tema, 15, 30);
      autoTable(doc, { head: [head], body: body, startY: 45, headStyles: { fillColor: cor } });
      doc.save(`TermoSync_Report_${tipo}_${Date.now()}.pdf`); showToast('PDF transferido.', 'success');
    } catch (e) { showToast('Erro no PDF.', 'error'); }
    setIsProcessing(null);
  };

  const gerarRelatorioCSV = async (tipo) => {
    setIsProcessing(`CSV_${tipo}`); showToast(`Extraindo CSV: ${tipo}...`, 'warning');
    try {
      await api.post('/system/reports/log', { tipo, formato: 'CSV', solicitante: 'Root/Dev' });
      const { head, body } = await processarDadosRelatorio(tipo);
      let csvContent = head.map(h => `"${h}"`).join(',') + '\n';
      body.forEach(row => { csvContent += row.map(val => `"${val}"`).join(',') + '\n'; });
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Data_${tipo}_${Date.now()}.csv`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      showToast('CSV transferido.', 'success');
    } catch (e) { showToast('Erro no CSV.', 'error'); }
    setIsProcessing(null);
  };

  const modulosBI = [
    { id: 'FINOPS_BILLING', titulo: 'Core Financeiro (RevOps)', desc: 'Relação completa de MRR, dívidas e faturas.', icon: DollarSign, color: '#10b981' },
    { id: 'AUDITORIA_SOC', titulo: 'Auditoria Zero-Trust (SOC)', desc: 'Extrato de logins e purgas de dados.', icon: ShieldCheck, color: '#a855f7' },
    { id: 'EDGE_HARDWARE', titulo: 'Inventário Edge Computing', desc: 'Mapeamento global da frota (MAC/Wi-Fi).', icon: Server, color: '#38bdf8' },
    { id: 'SYSOPS_HEALTH', titulo: 'Saúde da Plataforma (SysOps)', desc: 'Métricas vitais do cluster e carga MySQL.', icon: Activity, color: '#6366f1' }
  ];

  return (
    <div className="anim-fade-in stagger-1 dev-tela-scroll">
      <div className="flex-header" style={{ padding: 0, background: 'transparent', boxShadow: 'none', marginBottom: '0' }}><div className="dev-card glass-card" style={{ width: '100%' }}><div className="dev-card-header" style={{ color: 'white', marginBottom: '5px' }}><PieChart size={24} color="#38bdf8" /><h3 style={{fontSize: 'clamp(1rem, 2vw, 1.2rem)'}}>Centro de Inteligência e Analytics (BI)</h3></div></div></div>
      <div className="bi-grid stagger-2">
        {modulosBI.map(mod => (
          <div key={mod.id} className="bi-card glass-card" style={{ '--theme-color': mod.color }}>
            <div className="bi-header"><div className="bi-icon-wrapper"><mod.icon size={24} /></div><div><h4 className="bi-title" style={{color:'white'}}>{mod.titulo}</h4><p className="bi-desc">{mod.desc}</p></div></div>
            <div className="bi-actions">
              <button className="btn-bi" onClick={() => gerarRelatorioPDF(mod.id, mod.titulo, mod.color)} disabled={isProcessing !== null}>{isProcessing === `PDF_${mod.id}` ? <Loader2 size={16} className="spin"/> : <FileText size={16}/>} PDF Dinâmico</button>
              <button className="btn-bi" onClick={() => gerarRelatorioCSV(mod.id)} disabled={isProcessing !== null}>{isProcessing === `CSV_${mod.id}` ? <Loader2 size={16} className="spin"/> : <FileSpreadsheet size={16}/>} Tabela CSV</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 10. TELA DE ATUALIZAÇÕES DO SISTEMA E DEPLOY
// ============================================================================
const TelaAtualizacoes = ({ api, showToast, addLog, setModalConfig, isOverclocked }) => {
  const [updates, setUpdates] = useState(() => JSON.parse(localStorage.getItem('termosync_changelog')) || [{ id: 4, version: 'v13.1.0', title: 'Módulo de Deploy', type: 'feature', date: new Date().toISOString(), author: 'Root', desc: 'Aba de deploy.' }]);
  useEffect(() => { localStorage.setItem('termosync_changelog', JSON.stringify(updates)); }, [updates]);

  const [newUpdate, setNewUpdate] = useState({ version: '', title: '', type: 'feature', desc: '' });
  const [updateFile, setUpdateFile] = useState(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState(0); 
  const [checkBackup, setCheckBackup] = useState(false); const [checkDowntime, setCheckDowntime] = useState(false);

  const handleDeploy = (e) => {
    e.preventDefault();
    if (!newUpdate.version || !newUpdate.title || !newUpdate.desc || !updateFile || !checkBackup || !checkDowntime) return showToast('Preencha os dados e valide o checklist.', 'error');
    setModalConfig({
      isOpen: true, title: 'INICIAR DEPLOY EM PRODUÇÃO', message: `A versão ${newUpdate.version} será injetada. Confirmar?`,
      onConfirm: async () => {
        setIsDeploying(true); setDeployStep(1); addLog(`[CICD] Upload iniciado...`, 'warning');
        const formData = new FormData(); formData.append('updatePackage', updateFile); formData.append('version', newUpdate.version);
        try { setTimeout(() => setDeployStep(2), 1500); await api.post('/system/deploy-update', formData, { headers: { 'Content-Type': 'multipart/form-data' } }); setDeployStep(3); verificarRetornoServidor(); } 
        catch (error) { setDeployStep(3); verificarRetornoServidor(); }
      }
    });
  };

  const verificarRetornoServidor = () => {
    setDeployStep(4);
    let tentativas = 0;
    const intervalo = setInterval(async () => {
      tentativas++;
      try { await api.get('/system/health'); clearInterval(intervalo); finalizarDeploySucesso(); } 
      catch (e) { if (tentativas > 20) { clearInterval(intervalo); setIsDeploying(false); setDeployStep(0); showToast('Falha: Timeout.', 'error'); } }
    }, 2000); 
  };

  const finalizarDeploySucesso = () => {
    setDeployStep(5);
    setTimeout(() => {
      setUpdates(prev => [{ id: Date.now(), version: newUpdate.version, title: newUpdate.title, type: newUpdate.type, desc: newUpdate.desc, date: new Date().toISOString(), author: 'Root / Você' }, ...prev]);
      setIsDeploying(false); setDeployStep(0); setNewUpdate({ version: '', title: '', type: 'feature', desc: '' }); setUpdateFile(null); setCheckBackup(false); setCheckDowntime(false);
      showToast(`Deploy concluído 100%!`, 'success'); addLog(`[CICD] Deploy finalizado.`, 'success');
    }, 1500);
  };

  const isFormReady = newUpdate.version && newUpdate.title && newUpdate.desc && updateFile && checkBackup && checkDowntime;

  return (
    <div className="dev-tela-scroll">
      <div className="dev-grid-main anim-stagger-2">
        <div className="dev-col-left" style={{ flex: '1.2' }}>
          <div className="dev-card glass-card" style={{ borderTop: `4px solid ${isOverclocked ? '#ef4444' : 'var(--theme-sec)'}` }}>
            <div className="dev-card-header" style={{ color: isOverclocked ? '#ef4444' : 'var(--theme-sec)', marginBottom: '20px' }}><Rocket size={24} /><h3>Motor de Deploy (CI/CD)</h3></div>
            {isDeploying ? (
              <div style={{ background: 'var(--bg-dark)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-focus)', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--theme-main)', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}><Loader2 size={24} className="spin" /><h3 style={{ margin: 0, fontSize: '1rem' }}>Injetando Pacote...</h3></div>
                 <div className="crt-terminal" style={{ flex: 1, fontFamily: 'Montserrat', fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                   <div style={{color: '#94a3b8'}}>[SYSTEM] Iniciando Continuous Deployment...</div>
                   {deployStep >= 1 && <div><span style={{color: 'var(--secondary)'}}>[UPLOAD]</span> Transferindo arquivos...</div>}
                   {deployStep >= 2 && <div><span style={{color: 'var(--warning)'}}>[EXTRACT]</span> Sobrescrevendo sistema...</div>}
                   {deployStep >= 3 && <div><span style={{color: 'var(--danger)'}}>[CORE]</span> Reinício enviado ao PM2...</div>}
                   {deployStep >= 4 && <div className="pulse-icon"><span style={{color: 'var(--secondary)'}}>[PING]</span> Aguardando servidor voltar...</div>}
                   {deployStep >= 5 && <div style={{color: 'var(--theme-main)', fontWeight: 'bold'}}>[SUCESSO] Sistema Operacional 100% Atualizado!</div>}
                 </div>
              </div>
            ) : (
              <form onSubmit={handleDeploy} className="deploy-form-grid">
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 'bold' }}>Pacote ZIP *</label>
                  <div style={{ position: 'relative', border: `2px dashed ${updateFile ? 'var(--primary)' : 'var(--border-focus)'}`, borderRadius: '12px', padding: '25px 20px', textAlign: 'center', background: updateFile ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.3)' }}>
                    <input type="file" accept=".zip" onChange={e => { if(e.target.files[0]) setUpdateFile(e.target.files[0]); }} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                      <FileCode size={36} color={updateFile ? 'var(--primary)' : 'var(--dim-text)'} />
                      <span style={{ color: updateFile ? 'var(--primary)' : 'white', fontWeight: 'bold', marginTop: '5px' }}>{updateFile ? updateFile.name : 'Clique para enviar .zip'}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group"><label>Versão *</label><div className="config-input-wrapper"><GitCommit size={16} /><input type="text" value={newUpdate.version} onChange={e => setNewUpdate({...newUpdate, version: e.target.value})} /></div></div>
                  <div className="form-group"><label>Categoria *</label><select value={newUpdate.type} onChange={e => setNewUpdate({...newUpdate, type: e.target.value})} style={{minHeight: '48px'}}><option value="feature">Feature</option><option value="fix">Bugfix</option><option value="security">Segurança</option></select></div>
                </div>
                <div className="form-group"><label>Título *</label><div className="config-input-wrapper"><input type="text" value={newUpdate.title} onChange={e => setNewUpdate({...newUpdate, title: e.target.value})} /></div></div>
                <div className="form-group"><label>Descrição (Changelog) *</label><textarea value={newUpdate.desc} onChange={e => setNewUpdate({...newUpdate, desc: e.target.value})}></textarea></div>
                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-dim)' }}>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.8rem', color: checkBackup ? 'var(--primary)' : 'white' }}><input type="checkbox" checked={checkBackup} onChange={e => setCheckBackup(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />Backup (MySQL) realizado.</label>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.8rem', color: checkDowntime ? 'var(--warning)' : 'white' }}><input type="checkbox" checked={checkDowntime} onChange={e => setCheckDowntime(e.target.checked)} style={{ accentColor: 'var(--warning)' }} />Ciente da queda de instâncias IoT.</label>
                </div>
                <button type="submit" className="btn btn-primary w-100" disabled={!isFormReady} style={{ marginTop: '5px', filter: isFormReady ? 'none' : 'grayscale(1)' }}><Rocket size={18} /> DEPLOY</button>
              </form>
            )}
          </div>
        </div>

        <div className="dev-col-right" style={{ flex: '1.8' }}>
          <div className="dev-card glass-card" style={{ borderTop: '4px solid var(--theme-main)', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="dev-card-header flex-between" style={{ color: 'var(--theme-main)', marginBottom: '15px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><History size={24} /><h3>Changelog</h3></div></div>
            <div className="timeline-container" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', marginTop: 0 }}>
              {updates.map((upd) => (
                <div key={upd.id} className="timeline-item">
                  <div className="timeline-node"></div>
                  <div className="timeline-content">
                    <div className="timeline-header"><span className="version-badge">{upd.version}</span><div className="update-meta"><Clock size={12} /> {new Date(upd.date).toLocaleString('pt-BR')}</div></div>
                    <h4 className="update-title">{upd.title}</h4><p className="update-desc">{upd.desc}</p>
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

  const executarSQL = async (e, forceQuery = null) => {
    if (e) e.preventDefault(); const sqlToRun = forceQuery || query; if (!sqlToRun.trim()) return;
    setLoading(true); setError(null); setResults(null); addLog(`[SQL] A executar diretiva na base de dados...`, 'warning');
    try {
      const res = await api.post('/system/query-raw', { sql: sqlToRun });
      if (res.data.success) {
        setResults(res.data.data); showToast('Query executada com sucesso.', 'success'); addLog(`[SQL SUCESS] Afetadas/Retornadas ${res.data.data?.length || 0} linhas do cluster MySQL.`, 'success');
      } else { setError(res.data.error || 'Erro desconhecido na query.'); showToast('Erro de sintaxe SQL.', 'error'); }
    } catch (err) { setError(err.response?.data?.error || err.message); addLog(`[SQL ERROR] Falha crítica de sintaxe ou ligação.`, 'error'); } finally { setLoading(false); }
  };

  const aplicarQuickQuery = (sql) => { setQuery(sql); executarSQL(null, sql); };

  return (
    <div className="dev-tela-scroll">
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '5px' }}>
        <button className="btn btn-outline" onClick={() => aplicarQuickQuery("SHOW TABLES;")} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}><Database size={14} style={{ marginRight: '6px' }}/> Ver Tabelas</button>
        <button className="btn btn-outline" onClick={() => aplicarQuickQuery("SELECT * FROM sessoes_ativas;")} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px' }}>Sessões</button>
      </div>

      <div className="dev-card glass-card" style={{ borderTop: '4px solid #f59e0b', marginBottom: '20px' }}>
        <div className="dev-card-header flex-between" style={{ color: '#f59e0b', marginBottom: '15px' }}><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Database size={24} /><h3>Terminal SQL Master</h3></div></div>
        <form onSubmit={(e) => executarSQL(e)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <textarea value={query} onChange={e => setQuery(e.target.value)} placeholder="SELECT * FROM equipamentos LIMIT 10;" style={{ minHeight: '120px', background: '#020617', color: '#38bdf8', fontFamily: 'Montserrat', fontSize: '0.95rem', border: '1px solid var(--border-focus)', padding: '15px', borderRadius: '8px' }} spellCheck="false" autoFocus />
          <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()} style={{ background: '#f59e0b', color: '#000', width: '220px', alignSelf: 'flex-end', filter: !query.trim() ? 'grayscale(1)' : 'none' }}>{loading ? <Loader2 size={16} className="spin" /> : <Terminal size={16} />} EXECUTAR SQL</button>
        </form>
      </div>

      {error && <div className="anim-fade-in" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '15px', borderRadius: '8px', fontFamily: 'Montserrat', fontSize: '0.85rem', marginBottom: '20px' }}><strong>❌ ERRO DE COMPILAÇÃO MYSQL:</strong> {error}</div>}
      
      {results && results.length > 0 ? (
        <div className="dev-card glass-card anim-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive-wrapper" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="dev-select-input" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'transparent', fontSize: '0.85rem' }}>
              <thead style={{ background: 'rgba(255,255,255,0.05)', color: '#38bdf8', fontFamily: 'Montserrat', position: 'sticky', top: 0, zIndex: 10 }}><tr>{Object.keys(results[0]).map((key, i) => <th key={i} style={{ padding: '12px 15px', borderBottom: '1px solid var(--border-focus)', whiteSpace: 'nowrap' }}>{key}</th>)}</tr></thead>
              <tbody style={{ fontFamily: 'Montserrat', color: '#cbd5e1' }}>
                {results.map((row, i) => <tr key={i} style={{ borderBottom: '1px solid var(--border-dim)', background: i % 2 === 0 ? 'rgba(0,0,0,0.2)' : 'transparent' }}>{Object.values(row).map((val, j) => <td key={j} style={{ padding: '10px 15px', whiteSpace: 'nowrap' }}>{val === null ? <span style={{color: '#64748b'}}>NULL</span> : String(val)}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </div>
      ) : results && (
        <div className="anim-fade-in" style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '15px', borderRadius: '8px', fontSize: '0.85rem' }}>✔ Comando executado com sucesso. Nenhuma linha retornada (Ação de escrita / DML concluída).</div>
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
      const payloadFormatado = payloadOriginal !== undefined && payloadOriginal !== null ? payloadOriginal : { info: 'Sinal de pulso sem payload' };
      setPackets(prev => [...prev.slice(-199), { id: Date.now() + Math.random(), event: eventName, time: new Date().toLocaleTimeString('pt-BR'), payload: payloadFormatado }]);
    };
    if (isStreaming) { socket.onAny(capturarTudo); addLog('[WSS] Modo Promíscuo Ativado: Intercetando todos os canais de telemetria.', 'warning'); }
    return () => { socket.offAny(capturarTudo); };
  }, [socket, isStreaming, addLog]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [packets]);

  const limparConsole = () => { setPackets([]); addLog('[WSS] Consola Firehose limpa pelo operador.', 'info'); };
  const visiblePackets = packets.filter(p => filterMode === 'ALL' || (filterMode === 'ALERTAS' && p.event.includes('alerta')) || (filterMode === 'LEITURAS' && p.event.includes('leitura')));

  return (
    <div className="dev-tela-scroll">
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '5px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
           <button className={`btn btn-outline ${filterMode === 'ALL' ? 'active' : ''}`} onClick={() => setFilterMode('ALL')} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', flex: 'none', background: filterMode==='ALL'?'var(--primary)':'', color: filterMode==='ALL'?'#000':'' }}><Filter size={14} style={{ marginRight: '6px' }}/> Tudo</button>
           <button className={`btn btn-outline ${filterMode === 'LEITURAS' ? 'active' : ''}`} onClick={() => setFilterMode('LEITURAS')} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', flex: 'none', background: filterMode==='LEITURAS'?'var(--secondary)':'', color: filterMode==='LEITURAS'?'#000':'' }}>Apenas Leituras</button>
           <button className={`btn btn-outline ${filterMode === 'ALERTAS' ? 'active' : ''}`} onClick={() => setFilterMode('ALERTAS')} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', flex: 'none', background: filterMode==='ALERTAS'?'var(--danger)':'', color: filterMode==='ALERTAS'?'#000':'' }}>Apenas Alertas</button>
        </div>
        <button className="btn btn-outline danger-text" onClick={limparConsole} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', flex: 'none', borderColor: 'rgba(239, 68, 68, 0.3)' }}><Trash2 size={14} style={{ marginRight: '6px' }}/> Limpar Ecrã</button>
      </div>

      <div className="dev-card glass-card" style={{ borderTop: '4px solid #a855f7', height: '75vh', display: 'flex', flexDirection: 'column' }}>
        <div className="dev-card-header flex-between" style={{ color: '#a855f7', marginBottom: '15px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Network size={24} /><h3>Monitor Sockets Duplex (Firehose Stream)</h3></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {isStreaming && <span className="pulse-icon" style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>● OUVINDO REDE</span>}
            <button onClick={() => { setIsStreaming(!isStreaming); addLog(isStreaming ? '[WSS] Captura suspensa pelo operador.' : '[WSS] Captura retomada.', 'info'); }} className={`btn ${isStreaming ? 'btn-danger' : 'btn-success'}`} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', fontWeight: 'bold' }}>{isStreaming ? <Power size={14} /> : <RefreshCw size={14} />}{isStreaming ? 'SUSPENDER CAPTURA' : 'LIGAR CAPTURA LIVE'}</button>
          </div>
        </div>
        
        <div className="crt-terminal" ref={scrollRef} style={{ flex: 1, background: '#020617', padding: '15px', borderRadius: '8px', overflowY: 'auto', border: '1px solid var(--border-focus)', fontFamily: 'Montserrat', fontSize: '0.8rem' }}>
          {visiblePackets.map(p => (
            <div key={p.id} className="anim-fade-in" style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}><span style={{ color: '#64748b' }}>[{p.time}]</span><span style={{ color: p.event.includes('alerta') ? '#ef4444' : (p.event.includes('leitura') ? '#10b981' : '#38bdf8'), fontWeight: 'bold', textTransform: 'uppercase' }}>📡 {p.event}</span></div>
              <pre style={{ margin: 0, color: '#a855f7', paddingLeft: '20px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(p.payload, null, 2)}</pre>
            </div>
          ))}
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
    
    setCmdHistory(prev => [...prev, cmd]); setHistoryIndex(-1);
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: cmd, status: 'cmd-echo' }]);
    
    setTimeout(() => {
      switch (cmd) {
        case 'help': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'Comandos disponíveis: clear, ping, sysinfo, netstat, purge, reboot, whoami, date, lockdown, ifconfig, sudo, matrix', status: 'info' }]); break;
        case 'clear': setLogs([]); break;
        case 'ping': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'Gateway Ping: 12ms. Servidor Core: ONLINE.', status: 'success' }]); break;
        case 'sysinfo': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: `TermoSync OS Enterprise Edition | Auth: ROOT_DEV.`, status: 'warning' }]); break;
        case 'netstat': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'TCP 0.0.0.0:3000 (LISTEN) | Ligações WebSocket ativas: 3.', status: 'info' }]); break;
        case 'whoami': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'SuperUser (UID: 0). Permissão Máxima Concedida.', status: 'success' }]); break;
        case 'date': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: new Date().toString(), status: 'info' }]); break;
        case 'ifconfig': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'eth0: inet 192.168.1.100 netmask 255.255.255.0 | lo: inet 127.0.0.1', status: 'info' }]); break;
        case 'sudo': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'Você já é ROOT.', status: 'warning' }]); break;
        case 'matrix': for(let i=0; i<15; i++) { setTimeout(() => setLogs(prev => [...prev, { time: '', text: Array.from({length: 40}, () => String.fromCharCode(33 + Math.random() * 94)).join(''), status: 'success' }]), i * 50); } break;
        case 'lockdown': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: sysConfig?.maintenanceMode ? 'Já em LOCKDOWN.' : 'Use a UI.', status: 'warning' }]); break;
        case 'reboot': setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: 'A reiniciar...', status: 'error' }]); setTimeout(() => window.location.reload(), 1500); break;
        default: setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), text: `ERR: comando não reconhecido.`, status: 'error' }]);
      }
    }, 400);
    setCmdInput(''); 
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      if (cmdHistory.length > 0 && historyIndex < cmdHistory.length - 1) { const newIndex = historyIndex + 1; setHistoryIndex(newIndex); setCmdInput(cmdHistory[cmdHistory.length - 1 - newIndex]); }
    } else if (e.key === 'ArrowDown') {
      if (historyIndex > 0) { const newIndex = historyIndex - 1; setHistoryIndex(newIndex); setCmdInput(cmdHistory[cmdHistory.length - 1 - newIndex]); } else if (historyIndex === 0) { setHistoryIndex(-1); setCmdInput(''); }
    }
  };

  return (
    <div className={`os-terminal-footer ${isOpen ? 'open' : 'closed'}`}>
      <div className="terminal-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="terminal-header-title"><TerminalSquare size={16} /><span>{isOpen ? '/dev/tty1 (SHELL ROOT INTERATIVO)' : 'Abrir Terminal do Servidor (ROOT)'}</span></div>
        {isOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </div>
      {isOpen && (
        <>
          <div className="terminal-body crt-terminal" ref={terminalContainerRef}>
            <div className="crt-scan"></div>
            {logs.map((log, index) => (
              <div key={index} className={`terminal-line ${log.status}`}>
                <span className="time">{log.time && `[${log.time}]`}</span>
                {log.status === 'cmd-echo' ? <span className="prompt">root@termosync:~$ <span style={{color: 'white'}}>{log.text}</span></span> : <><span className="prompt" style={{visibility: log.time ? 'visible' : 'hidden'}}>root@termosync:~$</span> <span className="text" style={{ color: log.status === 'error' ? '#ef4444' : log.status === 'warning' ? '#f59e0b' : log.status === 'success' ? '#10b981' : '#cbd5e1' }}>{log.text}</span></>}
              </div>
            ))}
          </div>
          <form onSubmit={handleCommandSubmit} className="terminal-input-form">
            <span className="prompt">root@termosync:~$</span>
            <input type="text" value={cmdInput} onChange={e => setCmdInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Digite um comando (ex: help) [Use setas Cima/Baixo para histórico]..." autoComplete="off" spellCheck="false" autoFocus />
            <button type="button" className="btn-clear-terminal" onClick={() => setLogs([])} title="Limpar Consola"><Eraser size={16} /></button>
          </form>
        </>
      )}
    </div>
  );
};