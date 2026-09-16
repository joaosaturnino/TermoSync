import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ShieldAlert, Database, Cpu, Power, Settings2, Activity, Globe,
  Server, History, FileText,
  DollarSign, Building2, ActivitySquare, Terminal, RefreshCw, Mail,
  Key, UserCheck, LineChart, ShieldCheck, Fingerprint as FingerprintIcon,
  UserX, Clock, PieChart, FileSpreadsheet, Unlock, CheckCircle2,
  AlertTriangle, TrendingUp, DownloadCloud, Calendar, Percent, Banknote,
  Eraser, Network, Copy, Check, AlertOctagon, Loader2,
  Receipt, Cloud, HardDrive, Radio, ServerCrash,
  Flame, AlertCircle, Wifi, Users,
  UserPlus, UserCog, LockKeyhole, MonitorSmartphone,
  Search, ShieldBan, Save, Target, X, Rocket, GitCommit, FileCode,
  Trash2, Filter, CalendarMinus, Plug, PauseCircle, PlayCircle
} from 'lucide-react';

import { AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, YAxis, BarChart, Bar, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './PainelDesenvolvedor.css';
import GestaoEmpresas from '../GestaoEmpresas/GestaoEmpresas';
import TermoSyncLogo from '../../components/TermoSyncLogo.jsx';

/**
 * Concentra a logica de fetch with timeout para manter o restante do tela mais legivel.
 */
const fetchWithTimeout = async (url, options = {}, timeoutMs = 3500) => {
  // Wrapper para chamadas diretas a dispositivos de borda. Sem timeout manual,
  // fetch pode ficar pendurado por muito tempo quando um ESP32 está offline.
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

// ============================================================================
// COMPONENTE PRINCIPAL (CONTAINER OS)
// ============================================================================
export default function PainelDesenvolvedor({ api, socket, abaAtiva, isDevAuthenticated, onAuthenticate: _onAuthenticate, showToast, sysConfig, updateSysConfig, tocarAlarme: _tocarAlarme, usuariosLista, filiaisDb, setModalConfig, navigationCatalog = [] }) {
  // Container mestre do modo DEV. Ele autentica o terminal root e roteia as
  // subtelas internas de NOC, SOC, SaaS, Billing, SQL, Edge e atualizações.
  const [, setTerminalLogs] = useState(() => [
    { time: new Date().toLocaleTimeString('pt-BR'), text: 'Sessão Master estabelecida. SysAdmin conectado.', status: 'success' }
  ]);
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
    const timerId = window.setTimeout(carregarTicketsSuporte, 0);
    return () => window.clearTimeout(timerId);
  }, [carregarTicketsSuporte]);

  useEffect(() => {
    if (!socket) return undefined;
    /**
     * Concentra a logica de refresh support tickets para manter o restante do tela mais legivel.
     */
    const refreshSupportTickets = () => carregarTicketsSuporte();
    socket.on('atualizacao_dados', refreshSupportTickets);
    return () => socket.off('atualizacao_dados', refreshSupportTickets);
  }, [socket, carregarTicketsSuporte]);

  if (!isDevAuthenticated) {
    return (
      <div className="dev-os-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '15px', color: 'var(--danger)' }}>
        <ShieldAlert size={64} className="pulse-icon" />
        <h2>Acesso Rejeitado</h2>
        <p style={{ color: '#94a3b8' }}>O terminal requer autenticação de Nível ROOT.</p>
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
            <strong>{ticketsSuporteAbertos} ticket{ticketsSuporteAbertos > 1 ? 's' : ''} de suporte aberto</strong>
            <span>Existem chamados aguardando análise no suporte ao sistema.</span>
          </div>
          <div className="dev-support-alert-tag">Prioridade de atendimento</div>
        </div>
      )}

      {sysConfig?.maintenanceMode && (
        <div className="maintenance-banner">
          <AlertOctagon size={18} className="pulse-icon" /> SISTEMA EM MODO DE MANUTENÇÃO (OFFLINE) <AlertOctagon size={18} className="pulse-icon" />
        </div>
      )}

      <div className="dev-os-workspace">
        <div className="dev-os-content" style={{ position: 'relative' }}>
          {abaAtiva === 'empresas' && <GestaoEmpresas api={api} showToast={showToast} setModalConfig={setModalConfig} />}
          {abaAtiva === 'dev_panel' && <TelaNOC api={api} showToast={showToast} sysConfig={sysConfig} updateSysConfig={updateSysConfig} usuariosLista={usuariosLista} filiaisDb={filiaisDb} addLog={addLog} setModalConfig={setModalConfig} isOverclocked={isOverclocked} setIsOverclocked={setIsOverclocked} navigationCatalog={navigationCatalog} />}
          {abaAtiva === 'saas' && <TelaSaaS api={api} sysConfig={sysConfig} updateSysConfig={updateSysConfig} filiaisDb={filiaisDb} showToast={showToast} addLog={addLog} setModalConfig={setModalConfig} />}
          {abaAtiva === 'billing' && <TelaBilling api={api} socket={socket} sysConfig={sysConfig} filiaisDb={filiaisDb} showToast={showToast} addLog={addLog} updateSysConfig={updateSysConfig} setModalConfig={setModalConfig} />}
          {abaAtiva === 'system' && <TelaSistema api={api} showToast={showToast} addLog={addLog} sysConfig={sysConfig} updateSysConfig={updateSysConfig} usuariosLista={usuariosLista} setModalConfig={setModalConfig} />}
          {abaAtiva === 'soc' && <TelaSOC api={api} showToast={showToast} addLog={addLog} setModalConfig={setModalConfig} usuariosLista={usuariosLista} />}
          {abaAtiva === 'bi' && <TelaBI api={api} showToast={showToast} addLog={addLog} sysConfig={sysConfig} filiaisDb={filiaisDb} />}
          {abaAtiva === 'atualizacoes' && <TelaAtualizacoes api={api} showToast={showToast} addLog={addLog} setModalConfig={setModalConfig} isOverclocked={isOverclocked} />}
          {abaAtiva === 'sql_terminal' && <TelaTerminalSQL api={api} showToast={showToast} addLog={addLog} />}
          {abaAtiva === 'websocket_stream' && <TelaWebSocketStream socket={socket} addLog={addLog} />}
          {abaAtiva === 'network_scanner' && <TelaScannerRede api={api} showToast={showToast} addLog={addLog} filiaisDb={filiaisDb} />}
          {abaAtiva === 'monitor_edge' && <MonitorFisicoESP api={api} />}
        </div>
      </div>
    </div>
  );
}

// Componente auxiliar de Gráficos Minimizados
function RenderSparkline({ dataKey, color, data }) {
  // Mini gráfico usado nos painéis DEV para mostrar tendência sem ocupar espaço.
  return (
    <div className="sparkline-box">
      <ResponsiveContainer width="100%" height={40}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`color_${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.6} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#color_${dataKey})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Verifica a condicao hash string e retorna um valor booleano.
 */
const hashString = (value) => {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

/**
 * Busca ou monta os dados de get cluster node position usados no fluxo atual.
 */
const getClusterNodePosition = (index, total) => {
  const safeTotal = Math.max(total, 1);
  const angle = ((index + 1) / safeTotal) * Math.PI * 2 - (Math.PI / 2);
  return {
    top: `${50 + Math.sin(angle) * 32}%`,
    left: `${50 + Math.cos(angle) * 36}%`
  };
};

/**
 * Gera build cluster nodes com os dados necessarios para o proximo passo.
 */
const buildClusterNodes = (filiais = []) => {
  const nodes = [{ id: 'master', name: 'sa-east-1a (Master Core)', role: 'BD Primário & API', status: 'online', pos: { top: '50%', left: '50%' }, ping: 10 }];

  if (filiais.length > 0) {
    filiais.forEach((filial, index) => {
      nodes.push({
        id: `edge-${index}`,
        name: `Edge: ${filial}`,
        role: 'Gateway IoT Local',
        status: 'online',
        pos: getClusterNodePosition(index, filiais.length),
        ping: 10
      });
    });
    return nodes;
  }

  nodes.push({ id: 'replica', name: 'sa-east-1b (Replica)', role: 'Réplica de Leitura', status: 'online', pos: { top: '60%', left: '70%' }, ping: 10 });
  return nodes;
};

/**
 * Busca ou monta os dados de get tenant usage metric usados no fluxo atual.
 */
const getTenantUsageMetric = (filial, planoAtual) => {
  const seed = hashString(`${filial}:${planoAtual}`);
  if (planoAtual === 'ENTERPRISE') {
    return { nodeCount: 20 + (seed % 40), apiCalls: `${(1 + (seed % 50) / 10).toFixed(1)}M` };
  }
  if (planoAtual === 'PRO') {
    return { nodeCount: 5 + (seed % 15), apiCalls: `${100 + (seed % 900)}K` };
  }
  return { nodeCount: 1 + (seed % 3), apiCalls: `${25 + (seed % 120)}K` };
};

// ============================================================================
// TELA NOC (Network Operations Center) - COM TOPOLOGIA DINÂMICA
// ============================================================================
const TelaNOC = ({ api: _api, showToast, sysConfig, updateSysConfig, usuariosLista, filiaisDb, addLog, isOverclocked, setIsOverclocked, navigationCatalog = [] }) => {
  // Central de comando do desenvolvedor: concentra políticas globais, matriz de
  // UI por papel/usuário e indicadores sintéticos da operação.
  const [scopeType, setScopeType] = useState('ROLE');
  const [activeScope, setActiveScope] = useState('GLOBAL');
  const [metrics, setMetrics] = useState({ cpu: 12, ram: 42, ping: 14, reqs: 342, dbQps: 154, bandwidth: 24.5 });
  const [metricHistory, setMetricHistory] = useState(Array.from({ length: 20 }, () => ({ time: '', cpu: 0, ram: 0, bw: 0, db: 0 })));
  const [apiTraffic, setApiTraffic] = useState([]);
  const [threats, setThreats] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [latencyData, setLatencyData] = useState([]);
  const initialClusterNodes = useMemo(() => buildClusterNodes(filiaisDb || []), [filiaisDb]);
  const [clusterNodes, setClusterNodes] = useState(initialClusterNodes);
  const [actionLoading, setActionLoading] = useState(null);

  const trafficContainerRef = useRef(null);
  const wafContainerRef = useRef(null);
  const incidentsContainerRef = useRef(null);

  const locs = useMemo(() => ['SP, BR', 'FRA, DE', 'ASH, US', 'TOK, JP', 'LON, UK', 'SYD, AU'], []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setClusterNodes(initialClusterNodes);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [initialClusterNodes]);

  useEffect(() => {
    let isMounted = true;
    const i1 = setInterval(() => {
      if (!isMounted) return;
      if (sysConfig.maintenanceMode) {
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
      setClusterNodes(prev => prev.map(n => ({ ...n, ping: n.id === 'master' ? Math.floor(Math.random() * 5) + 2 : Math.floor(Math.random() * 20) + (isOverclocked ? 45 : 12) })));

      setLatencyData([
        { range: '10ms', count: Math.floor(Math.random() * 200) + 300 },
        { range: '50ms', count: Math.floor(Math.random() * 100) + 150 },
        { range: '100ms', count: Math.floor(Math.random() * 50) + 50 },
        { range: '200ms', count: Math.floor(Math.random() * 20) + 10 },
        { range: '500ms+', count: Math.floor(Math.random() * 5) }
      ]);
    }, 2000);

    const i2 = setInterval(() => {
      if (!isMounted || sysConfig.maintenanceMode) return;
      const rotas = [
        { method: 'MQTT', route: 'telemetry/esp32', color: isOverclocked ? '#ef4444' : '#10b981' },
        { method: 'POST', route: '/api/v1/auth', color: '#f59e0b' },
        { method: 'WSS', route: '/ws/stream', color: '#a855f7' }
      ];
      const r = rotas[Math.floor(Math.random() * rotas.length)];
      const geo = locs[Math.floor(Math.random() * locs.length)];
      setApiTraffic(prev => [...prev.slice(-40), { id: Date.now() + Math.random(), method: r.method, color: r.color, route: r.route, geo, ip: `192.168.${Math.floor(Math.random()*10)}.${Math.floor(Math.random() * 255)}` }]);
    }, isOverclocked ? 100 : 250);

    const i3 = setInterval(() => {
      if (!isMounted || sysConfig.maintenanceMode) return;
      const atk = `[IDS] ASSINATURA: DDOS_SYN_FLOOD -> DESCARTE de 104.28.${Math.floor(Math.random() * 255)}.1`;
      setThreats(prev => [...prev.slice(-20), { id: Date.now(), text: atk }]);
    }, isOverclocked ? 1500 : 3500);

    const i4 = setInterval(() => {
      if (!isMounted || sysConfig.maintenanceMode) return;
      if (Math.random() > 0.6) {
        const errors = [
          { msg: 'Aviso: Sobrecarga temporária na API.', type: 'warning' },
          { msg: 'Crítico: Latência DB > 200ms.', type: 'critical' },
          { msg: 'Aviso: Memória Redis 85%.', type: 'warning' }
        ];
        const err = errors[Math.floor(Math.random() * errors.length)];
        setIncidents(prev => [...prev.slice(-15), { id: Date.now(), ...err, time: new Date().toLocaleTimeString('pt-BR') }]);
      }
    }, 5000);

    return () => { isMounted = false; clearInterval(i1); clearInterval(i2); clearInterval(i3); clearInterval(i4); };
  }, [sysConfig.maintenanceMode, isOverclocked, locs]);

  useEffect(() => { if (trafficContainerRef.current) trafficContainerRef.current.scrollTop = trafficContainerRef.current.scrollHeight; }, [apiTraffic]);
  useEffect(() => { if (wafContainerRef.current) wafContainerRef.current.scrollTop = wafContainerRef.current.scrollHeight; }, [threats]);
  useEffect(() => { if (incidentsContainerRef.current) incidentsContainerRef.current.scrollTop = incidentsContainerRef.current.scrollHeight; }, [incidents]);

  const effectiveScope = useMemo(() => {
    if (scopeType === 'ROLE') {
      const roleScopes = ['GLOBAL', 'ADMIN', 'LOJA', 'MANUTENCAO'];
      return roleScopes.includes(activeScope) ? activeScope : 'GLOBAL';
    }
    const usuariosElegiveis = (usuariosLista || []).filter((u) => u.role !== 'DEV');
    if (activeScope && usuariosElegiveis.some(u => u.usuario === activeScope)) return activeScope;
    return usuariosElegiveis?.[0]?.usuario || '';
  }, [scopeType, activeScope, usuariosLista]);

  const regrasAtivas = (scopeType === 'USER' ? sysConfig?.regras?.USERS?.[effectiveScope] : sysConfig?.regras?.[effectiveScope]) || { modulosOcultos: [], features: {} };

  /**
   * Processa a interacao de handle toggle modulo e atualiza a interface conforme o resultado.
   */
  const handleToggleModulo = (id) => {
    updateSysConfig(scopeType, effectiveScope, 'modulosOcultos', id);
    addLog(`[MATRIZ_UI] Módulo '${id}' reconfigurado.`, 'warning');
  };

  /**
   * Executa executar acao emergencia coordenando as etapas principais desse fluxo.
   */
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

  /**
   * Processa a interacao de handle toggle overclock e atualiza a interface conforme o resultado.
   */
  const handleToggleOverclock = () => {
    setIsOverclocked(!isOverclocked);
    addLog(isOverclocked ? '[SISTEMA] OVERCLOCK DESATIVADO. Retornando ao estado nominal.' : '[SISTEMA] AVISO: OVERCLOCK INICIADO. Injeção de tráfego sintético ativa.', isOverclocked ? 'success' : 'error');
    if (!isOverclocked) showToast('ALERTA: Simulador de Stress Ativado!', 'error');
  };

  const TODOS_MODULOS = useMemo(() => {
    const fallbackModules = [
      { id: 'dashboard', label: 'Dashboard Operacional', type: 'Operações', roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'] },
      { id: 'assistente', label: 'Assistente de Operação', type: 'Operações', roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'] },
      { id: 'chamados', label: 'Chamados', type: 'Serviços', roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'] },
      { id: 'equipamentos', label: 'Equipamentos', type: 'Serviços', roles: ['ADMIN', 'MANUTENCAO', 'DEV'] },
      { id: 'usuarios', label: 'Identidades e Acessos', type: 'Sistema', roles: ['ADMIN', 'DEV'] }
    ];
    const source = navigationCatalog.length > 0 ? navigationCatalog : fallbackModules;
    return source
      .filter((moduleItem) => moduleItem?.id && moduleItem?.label)
      .map((moduleItem) => ({
        id: moduleItem.id,
        nome: moduleItem.label,
        grupo: moduleItem.type || 'Sem grupo',
        roles: Array.isArray(moduleItem.roles) ? moduleItem.roles.filter((role) => role !== 'DEV') : []
      }))
      .filter((moduleItem) => moduleItem.roles.length > 0)
      .sort((a, b) => {
        const groupOrder = a.grupo.localeCompare(b.grupo, 'pt-BR');
        if (groupOrder !== 0) return groupOrder;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });
  }, [navigationCatalog]);

  const modulosControlaveisIds = useMemo(() => TODOS_MODULOS.map((moduleItem) => moduleItem.id), [TODOS_MODULOS]);
  const modulosOcultosControlaveis = useMemo(
    () => (regrasAtivas?.modulosOcultos || []).filter((id) => modulosControlaveisIds.includes(id)),
    [regrasAtivas?.modulosOcultos, modulosControlaveisIds]
  );

  const defconLevel = isOverclocked ? 'MÁXIMO' : (threats.length > 15 ? 'CRÍTICO' : (threats.length > 8 ? 'ELEVADO' : 'SEGURO'));
  const colorPrimary = isOverclocked ? '#ef4444' : '#10b981';
  const colorSec = isOverclocked ? '#f59e0b' : '#38bdf8';
  const defconColor = isOverclocked ? '#ef4444' : (threats.length > 15 ? '#ef4444' : (threats.length > 8 ? '#f59e0b' : '#10b981'));

  return (
    <div className="noc-dashboard-wrapper dev-tela-scroll control-screen">
      <div className="noc-defcon-bar anim-stagger-1">
        <div className="defcon-title glitch-hover"><TermoSyncLogo size={18} color={defconColor} /> THERMOSYNC</div>
        <div className="defcon-status-group">
          <button className="btn btn-outline" style={{ padding: '4px 12px', minHeight: 'auto', fontSize: '0.7rem', color: isOverclocked ? '#ef4444' : 'white', borderColor: isOverclocked ? '#ef4444' : 'rgba(255,255,255,0.2)' }} onClick={handleToggleOverclock}>
             <Flame size={14} style={{ marginRight: '6px' }}/> {isOverclocked ? 'DESATIVAR OVERCLOCK' : 'FORÇAR OVERCLOCK'}
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
          <RenderSparkline dataKey="cpu" color={colorPrimary} data={metricHistory} />
        </div>
        <div className="noc-hud-card" style={{'--card-color': colorSec}}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><HardDrive size={14}/> MEMÓRIA (RAM)</span></div>
          <div className="noc-kpi-value" style={{color: colorSec}}>{metrics.ram}<span className="noc-kpi-unit">%</span></div>
          <RenderSparkline dataKey="ram" color={colorSec} data={metricHistory} />
        </div>
        <div className="noc-hud-card" style={{'--card-color': colorSec}}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><Globe size={14}/> TRÁFEGO</span></div>
          <div className="noc-kpi-value" style={{color: colorSec}}>{metrics.bandwidth}<span className="noc-kpi-unit">Mb/s</span></div>
          <RenderSparkline dataKey="bw" color={colorSec} data={metricHistory} />
        </div>
        <div className="noc-hud-card" style={{'--card-color': '#a855f7'}}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><Database size={14}/> QUERIES DB</span></div>
          <div className="noc-kpi-value" style={{color: '#a855f7'}}>{metrics.dbQps}<span className="noc-kpi-unit">QPS</span></div>
          <RenderSparkline dataKey="db" color="#a855f7" data={metricHistory} />
        </div>
      </div>

      <div className="noc-main-grid anim-stagger-2">
        <div className="cyber-panel">
          <div className="cyber-panel-header glitch-hover">
             <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>Osciloscópio de Rede</div>
             <span style={{ fontSize: '0.8rem', color: '#000', fontWeight: 'bold', fontFamily: 'Montserrat', background: 'var(--theme-main)', padding: '4px 10px', borderRadius: '6px' }}>{sysConfig.maintenanceMode ? '0' : metrics.reqs} REQ/s</span>
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
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0', color: 'white', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="cpu" stroke={colorPrimary} strokeWidth={2} fillOpacity={1} fill="url(#colorCpuBig)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="ram" stroke={colorSec} strokeWidth={2} fillOpacity={1} fill="url(#colorRamBig)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="noc-histogram-box">
               <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Distribuição (API)</span>
               <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <BarChart data={latencyData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {latencyData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={index > 2 ? '#ef4444' : colorSec} /> ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="cyber-panel">
          <div className="cyber-panel-header glitch-hover"><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Target size={18} /> Topologia Avançada (Sonar)</div></div>
          <div className="cluster-topology-grid">
            {clusterNodes.map(node => (
              <div key={node.id} className="cluster-data-block" style={{'--status-color': node.status === 'online' ? colorPrimary : '#ef4444'}}>
                <div className="block-header">
                  <span className="block-name"><Server size={14} color="var(--status-color)"/> {node.name}</span>
                  <span className="block-ping" style={{ color: 'var(--status-color)' }}>{node.ping}ms</span>
                </div>
                <span className="block-role" style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{node.role}</span>
              </div>
            ))}
          </div>
          <div className="radar-container">
            <div className="radar-grid"></div><div className="radar-sweep"></div>
            {clusterNodes.map((node, i) => (
              <div key={node.id} className="radar-node" data-tooltip={`${node.name}: ${node.ping}ms`} style={{ top: node.pos.top, left: node.pos.left, background: node.id === 'master' ? colorPrimary : 'var(--theme-sec)', boxShadow: node.id === 'master' ? `0 0 15px ${colorPrimary}` : '0 0 10px var(--theme-sec)', animation: node.id === 'master' ? 'none' : `blink 2s infinite ${i * 0.5}s` }}></div>
            ))}
          </div>
        </div>
      </div>

      <div className="noc-terminals-grid anim-stagger-3">
        <div className="cyber-terminal">
          <div className="cyber-terminal-header"><div className="cyber-terminal-title">BASH - ROTEAMENTO (LIVE)</div></div>
          <div className="terminal-scroll" ref={trafficContainerRef}>
            {sysConfig.maintenanceMode ? <div style={{ color: 'var(--dim-text)', textAlign: 'center', margin: 'auto', fontStyle: 'italic' }}>Rotas BGP Suspensas</div> : apiTraffic.map((pkt) => (
              <div key={pkt.id} className="terminal-line"><span className="log-method" style={{ color: isOverclocked ? 'white' : pkt.color, background: isOverclocked ? '#ef4444' : 'rgba(255,255,255,0.05)' }}>{pkt.method}</span><span className="log-geo">[{pkt.geo}]</span><span className="log-route text-truncate">{pkt.route}</span></div>
            ))}
          </div>
        </div>
        <div className="cyber-terminal" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', boxShadow: 'inset 0 0 30px rgba(245, 158, 11, 0.1)' }}>
          <div className="cyber-terminal-header" style={{ borderBottomColor: 'rgba(245, 158, 11, 0.4)' }}><div className="cyber-terminal-title" style={{ color: '#f59e0b' }}><AlertCircle size={14} /> ALERTAS ATIVOS</div></div>
          <div className="terminal-scroll" ref={incidentsContainerRef}>
            {incidents.length === 0 ? <div style={{ color: '#10b981', textAlign: 'center', margin: 'auto', fontWeight: 'bold', fontSize: '0.8rem' }}>Nenhum incidente crítico no momento.</div> : incidents.map((inc) => (
              <div key={inc.id} className={`incident-card ${inc.type}`}><div className="incident-header"><span>{inc.time}</span><span>{inc.type === 'critical' ? 'CRÍTICO' : 'AVISO'}</span></div><div className="incident-desc">{inc.msg}</div></div>
            ))}
          </div>
        </div>
        <div className="cyber-terminal" style={{ borderColor: '#ef4444', boxShadow: isOverclocked ? 'inset 0 0 50px rgba(239,68,68,0.3)' : 'inset 0 0 30px rgba(0,0,0,0.8)' }}>
          <div className="cyber-terminal-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.4)' }}>
            <div className="cyber-terminal-title" style={{ color: '#ef4444', display: 'flex', justifyContent: 'space-between', width: '100%' }}><span>LOGS SEGURANÇA WAF</span><span className="defcon-badge" style={{ background: `rgba(239,68,68,0.2)`, color: '#ef4444', border: `1px solid #ef4444` }}>NÍVEL: {defconLevel}</span></div>
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
            <button className={scopeType === 'USER' ? 'active' : ''} onClick={() => setScopeType('USER')}>POR USUÁRIO</button>
          </div>
          <div className="scope-targets" style={{ marginTop: 'auto' }}>
            {scopeType === 'ROLE' && (
              <div className="scope-tabs">
                <button className={effectiveScope === 'GLOBAL' ? 'active' : ''} onClick={() => setActiveScope('GLOBAL')}>Global</button>
                <button className={effectiveScope === 'ADMIN' ? 'active' : ''} onClick={() => setActiveScope('ADMIN')}>Admins</button>
                <button className={effectiveScope === 'LOJA' ? 'active' : ''} onClick={() => setActiveScope('LOJA')}>Lojistas</button>
                <button className={effectiveScope === 'MANUTENCAO' ? 'active' : ''} onClick={() => setActiveScope('MANUTENCAO')}>Manutenção</button>
              </div>
            )}
            {scopeType === 'USER' && (
              <select value={effectiveScope} onChange={e => setActiveScope(e.target.value)} className="dev-select-input">
                {(usuariosLista || []).filter((u) => u.role !== 'DEV').map((u, i) => <option key={i} value={u.usuario}>{u.nome_tecnico || u.nome_gerente || u.usuario} ({u.role})</option>)}
              </select>
            )}
          </div>
        </div>
        <div className="switch-panel">
          <div className="switch-panel-title">
            <div style={{ display: 'flex', gap: '6px' }}><Settings2 size={14}/> MATRIZ DE UI</div>
            <span className="status-badge" style={{ background: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px 6px', fontSize: '0.65rem' }}>{TODOS_MODULOS.length - modulosOcultosControlaveis.length}/{TODOS_MODULOS.length}</span>
          </div>
          <div className="modulos-list">
            <div className="modulos-list-help">Ative ou desative cada tela para o escopo selecionado. Telas exclusivas do DEV não entram aqui porque o desenvolvedor sempre vê tudo.</div>
            {TODOS_MODULOS.map(m => {
              const isAtivo = !modulosOcultosControlaveis.includes(m.id);
              return (
                <div key={m.id} className={`hardware-toggle ${!isAtivo ? 'disabled' : ''}`}>
                  <span>
                    <strong>{m.nome}</strong>
                    <small className="module-meta">{m.grupo} • {m.roles.length ? m.roles.join(', ') : 'Sem perfil definido'}</small>
                  </span>
                  <button className={`btn-toggle-ui ${isAtivo ? 'on' : 'off'}`} onClick={() => handleToggleModulo(m.id)}>{isAtivo ? 'ON' : 'OFF'}</button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="switch-panel">
          <div className="switch-panel-title" style={{ color: '#ef4444' }}><Flame size={14}/> PROTOCOLOS DE EMERGÊNCIA</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center', height: '100%' }}>
            <button className="btn-emergency warning" onClick={() => executarAcaoEmergencia('LIMPAR CACHE REDIS')} disabled={actionLoading !== null || sysConfig.maintenanceMode}>
              {actionLoading === 'LIMPAR CACHE REDIS' ? <Loader2 size={16} className="spin"/> : <RefreshCw size={16}/>} {actionLoading === 'LIMPAR CACHE REDIS' ? 'A EXECUTAR...' : 'LIMPAR CACHE REDIS'}
            </button>
            <button className="btn-emergency" onClick={() => executarAcaoEmergencia('REINICIAR PODS DOCKER')} disabled={actionLoading !== null || sysConfig.maintenanceMode}>
              {actionLoading === 'REINICIAR PODS DOCKER' ? <Loader2 size={16} className="spin"/> : <ServerCrash size={16}/>} {actionLoading === 'REINICIAR PODS DOCKER' ? 'A REINICIAR NOS...' : 'REINICIAR PODS DOCKER'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TELA OPERAÇÕES DO SISTEMA
// ============================================================================
const TelaSistema = ({ api, showToast, addLog, sysConfig, updateSysConfig, usuariosLista, setModalConfig }) => {
  // Tela de governança do sistema: saúde, manutenção, recursos globais,
  // sessões, segurança de conta e ações administrativas sensíveis.
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const featureLabels = useMemo(() => ([
    { key: 'telemetryStream', label: 'Stream de telemetria', icon: Radio },
    { key: 'enableAudioAlerts', label: 'Alertas sonoros', icon: AlertTriangle },
    { key: 'enableToasts', label: 'Notificações internas', icon: AlertCircle },
    { key: 'enableChat', label: 'Chat operacional', icon: Mail },
    { key: 'allowExports', label: 'Exportações', icon: DownloadCloud },
    { key: 'readOnlyMode', label: 'Modo somente leitura', icon: LockKeyhole },
    { key: 'forceDarkMode', label: 'Forçar modo escuro', icon: Settings2 }
  ]), []);

  const globalFeatures = sysConfig?.regras?.GLOBAL?.features || {};
  const modulosOcultosGlobal = sysConfig?.regras?.GLOBAL?.modulosOcultos || [];
  const totalUsuarios = Array.isArray(usuariosLista) ? usuariosLista.length : 0;

  const carregarHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const res = await api.get('/system/health');
      setHealth(res.data || null);
      addLog('[SYSTEM] Health check atualizado.', 'success');
    } catch (error) {
      setHealth({ ok: false, status: 'offline', database: 'offline', mqtt: 'unknown', whatsapp: 'unknown', error: error?.message || 'Falha ao consultar o servidor.' });
      addLog(`[SYSTEM ERRO] Health check falhou: ${error?.message || 'erro desconhecido'}`, 'error');
      showToast('Falha ao consultar a saúde do sistema.', 'error');
    } finally {
      setLoadingHealth(false);
    }
  }, [api, addLog, showToast]);

  useEffect(() => {
    carregarHealth();
  }, [carregarHealth]);

  /**
   * Processa a interacao de confirmar modo manutencao e atualiza a interface conforme o resultado.
   */
  const confirmarModoManutencao = () => {
    const nextValue = !sysConfig?.maintenanceMode;
    setModalConfig({
      isOpen: true,
      title: nextValue ? 'Ativar modo manutenção' : 'Desativar modo manutenção',
      message: nextValue
        ? 'O modo manutenção bloqueia usuários não desenvolvedores e sinaliza o sistema como offline. Confirmar?'
        : 'O sistema voltará a aceitar operação normal dos usuários. Confirmar?',
      onConfirm: () => {
        updateSysConfig('ROLE', 'GLOBAL', 'maintenanceMode', null, nextValue);
        addLog(nextValue ? '[SYSTEM] Modo manutenção ativado.' : '[SYSTEM] Modo manutenção desativado.', nextValue ? 'error' : 'success');
        showToast(nextValue ? 'Modo manutenção ativado.' : 'Modo manutenção desativado.', nextValue ? 'warning' : 'success');
      }
    });
  };

  /**
   * Processa a interacao de alternar feature e atualiza a interface conforme o resultado.
   */
  const alternarFeature = (key) => {
    const nextValue = !(globalFeatures[key] ?? true);
    updateSysConfig('ROLE', 'GLOBAL', 'features', key, nextValue);
    addLog(`[SYSTEM] Feature global '${key}' alterada para ${nextValue ? 'ON' : 'OFF'}.`, nextValue ? 'success' : 'warning');
    showToast('Configuração global atualizada.', 'success');
  };

  /**
   * Limpa limpar cache interface para manter o estado consistente.
   */
  const limparCacheInterface = () => {
    const preservadas = new Set(['termosync_sysconfig_saas', 'termosync_server']);
    Object.keys(localStorage)
      .filter((key) => key.startsWith('termosync_') && !preservadas.has(key))
      .forEach((key) => localStorage.removeItem(key));

    addLog('[SYSTEM] Cache local da interface limpo.', 'warning');
    showToast('Cache local limpo.', 'success');
  };

  /**
   * Concentra a logica de recarregar clientes para manter o restante do tela mais legivel.
   */
  const recarregarClientes = () => {
    localStorage.setItem('termosync_force_reload', Date.now().toString());
    addLog('[SYSTEM] Sinal de recarregamento emitido para clientes abertos.', 'warning');
    showToast('Sinal de recarregamento enviado.', 'success');
  };

  /**
   * Formata format uptime para exibicao segura na interface.
   */
  const formatUptime = (seconds) => {
    const safeSeconds = Number(seconds || 0);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    return `${hours}h ${minutes}min`;
  };

  const statusColor = health?.ok ? '#10b981' : '#ef4444';

  return (
    <div className="dev-tela-scroll system-ops-screen">
      <div className="dev-card glass-card" style={{ borderTop: `4px solid ${statusColor}` }}>
        <div className="dev-card-header flex-between" style={{ color: statusColor, gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings2 size={22} />
            <h3>Operações do Sistema</h3>
          </div>
          <button className="btn btn-outline" onClick={carregarHealth} disabled={loadingHealth} style={{ minHeight: '36px', padding: '8px 14px' }}>
            {loadingHealth ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
            Atualizar
          </button>
        </div>
        <p style={{ color: '#94a3b8', margin: 0 }}>
          Controle operacional da plataforma, flags globais e ações de manutenção da interface.
        </p>
      </div>

      <div className="noc-hud-grid">
        <div className="noc-hud-card" style={{ '--card-color': statusColor }}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><Activity size={14} /> STATUS</span></div>
          <div className="noc-kpi-value" style={{ color: statusColor }}>{health?.status || '...'}</div>
        </div>
        <div className="noc-hud-card" style={{ '--card-color': '#38bdf8' }}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><Database size={14} /> BANCO</span></div>
          <div className="noc-kpi-value" style={{ color: health?.database === 'online' ? '#10b981' : '#ef4444' }}>{health?.database || '...'}</div>
        </div>
        <div className="noc-hud-card" style={{ '--card-color': '#a855f7' }}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><Clock size={14} /> UPTIME</span></div>
          <div className="noc-kpi-value" style={{ color: '#a855f7' }}>{health ? formatUptime(health.uptime) : '...'}</div>
        </div>
        <div className="noc-hud-card" style={{ '--card-color': '#f59e0b' }}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><Users size={14} /> USUÁRIOS</span></div>
          <div className="noc-kpi-value" style={{ color: '#f59e0b' }}>{totalUsuarios}</div>
        </div>
      </div>

      <div className="switchboard-grid">
        <div className="switch-panel">
          <div className="switch-panel-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Cloud size={14} /> Núcleo operacional</span>
          </div>
          <div className="modulos-list">
            <div className={`hardware-toggle ${sysConfig?.maintenanceMode ? '' : 'disabled'}`}>
              <span>Modo manutenção</span>
              <button className={`btn-toggle-ui ${sysConfig?.maintenanceMode ? 'off' : 'on'}`} onClick={confirmarModoManutencao}>
                {sysConfig?.maintenanceMode ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="hardware-toggle">
              <span>Banco de dados</span>
              <span className={`status-badge ${health?.database === 'online' ? 'success' : 'danger'}`}>{health?.database || '...'}</span>
            </div>
            <div className="hardware-toggle">
              <span>MQTT</span>
              <span className="status-badge success">{health?.mqtt || '...'}</span>
            </div>
            <div className="hardware-toggle">
              <span>WhatsApp</span>
              <span className="status-badge">{health?.whatsapp || '...'}</span>
            </div>
          </div>
        </div>

        <div className="switch-panel">
          <div className="switch-panel-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={14} /> Flags globais</span>
          </div>
          <div className="modulos-list">
            {featureLabels.map((feature) => {
              const enabled = globalFeatures[feature.key] ?? true;
              const Icon = feature.icon;
              return (
                <div key={feature.key} className={`hardware-toggle ${enabled ? '' : 'disabled'}`}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Icon size={14} /> {feature.label}</span>
                  <button className={`btn-toggle-ui ${enabled ? 'on' : 'off'}`} onClick={() => alternarFeature(feature.key)}>{enabled ? 'ON' : 'OFF'}</button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="switch-panel">
          <div className="switch-panel-title" style={{ color: '#f59e0b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ServerCrash size={14} /> Ações da interface</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn-emergency warning" onClick={limparCacheInterface}>
              <Eraser size={16} /> LIMPAR CACHE LOCAL
            </button>
            <button className="btn-emergency warning" onClick={recarregarClientes}>
              <RefreshCw size={16} /> RECARREGAR CLIENTES
            </button>
          </div>
          <div className="modulos-list-help">
            {modulosOcultosGlobal.length} módulo(s) oculto(s) globalmente. As ações acima não apagam dados do banco.
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TELA SAAS E MULTITENANCY (ABSOLUTE FULLSCREEN - X SCROLL ONLY)
// ============================================================================
const TelaSaaS = ({ api, sysConfig, updateSysConfig, filiaisDb, showToast, addLog, setModalConfig }) => {
  // Gestão SaaS: controla tenants, planos, aprovações e provisionamento
  // comercial/operacional de novas empresas.
  const [chavesAPI, setChavesAPI] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modal360, setModal360] = useState(null);
  const tenantUsageMetrics = useMemo(() => {
    const planos = sysConfig?.planos || {};
    return (filiaisDb || []).reduce((acc, filial) => {
      acc[filial] = getTenantUsageMetric(filial, planos[filial] || 'FREE');
      return acc;
    }, {});
  }, [filiaisDb, sysConfig?.planos]);

  /**
   * Processa a interacao de handle mudar plano e atualiza a interface conforme o resultado.
   */
  const handleMudarPlano = (loja, plano) => {
    updateSysConfig(null, loja, 'saas_plan', null, plano);
    addLog(`[SAAS] Contrato de ${loja} alterado para ${plano}.`, plano === 'SUSPENSO' ? 'error' : 'success');
    showToast(`Licença de ${loja} atualizada.`, plano === 'SUSPENSO' ? 'error' : 'success');
  };

  /**
   * Processa a interacao de handle mudar retencao e atualiza a interface conforme o resultado.
   */
  const handleMudarRetencao = (loja, dias) => {
    addLog(`[CLOUD] Limite de retenção de ${loja} ajustado para ${dias} dias.`, 'info');
    showToast(`Cluster de dados de ${loja} ajustado.`, 'success');
  };

  /**
   * Processa a interacao de handle forcar logout e atualiza a interface conforme o resultado.
   */
  const handleForcarLogout = (loja) => {
    setModalConfig({
      isOpen: true, title: 'Forçar Logout Remoto',
      message: `Tem a certeza de que deseja acionar o Kill Switch para a organização ${loja}? Todos os usuários locais serão desconectados instantaneamente.`,
      onConfirm: () => {
        localStorage.setItem('termosync_force_logout', `${loja}_${Date.now()}`);
        addLog(`[SECURITY] Sinal de KILL SWITCH disparado para: ${loja}.`, 'error');
        showToast(`Comando de expulsão enviado para ${loja}.`, 'success');
      }
    });
  };

  /**
   * Gera gerar chave api com os dados necessarios para o proximo passo.
   */
  const gerarChaveAPI = (loja) => {
    const key = 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setChavesAPI(prev => ({ ...prev, [loja]: key }));
    addLog(`[API] Nova chave gerada para ${loja}.`, 'success');
    showToast(`Chave API gerada.`, 'success');
  };

  /**
   * Processa a interacao de copy to clipboard e atualiza a interface conforme o resultado.
   */
  const copyToClipboard = (loja, key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(loja);
    setTimeout(() => setCopiedKey(null), 2000);
    showToast('Chave copiada!', 'info');
  };

  /**
   * Registra login as para auditoria, historico ou diagnostico.
   */
  const loginAs = async (loja) => {
    addLog(`[AUTH] A solicitar token de Impersonate para ${loja}...`, 'warning');
    showToast(`A gerar acesso remoto...`, 'warning');
    try {
      const res = await api.post('/impersonate', { filialDestino: loja });
      if (res.data && res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('role', 'ADMIN');
        localStorage.setItem('empresa', res.data.empresa);
        localStorage.setItem('filial', 'Todas');
        localStorage.removeItem('nome_gerente');
        localStorage.removeItem('nome_coordenador');
        localStorage.removeItem('nome_tecnico');
        window.open('/', '_blank');
      }
    } catch (err) {
      showToast('Erro ao criar sessão remota.', 'error');
    }
  };

  /**
   * Concentra a logica de open modal360 para manter o restante do tela mais legivel.
   */
  const openModal360 = (filial, plano, nodes) => {
    const cpu = plano === 'ENTERPRISE' ? Math.floor(Math.random() * 30) + 40 : Math.floor(Math.random() * 20) + 15;
    const ram = plano === 'ENTERPRISE' ? Math.floor(Math.random() * 40) + 50 : Math.floor(Math.random() * 30) + 30;
    const webhooksMax = plano === 'ENTERPRISE' ? 200 : (plano === 'PRO' ? 50 : 10);
    const webhooksUsed = Math.floor(Math.random() * (webhooksMax * 0.8));
    setModal360({ nome: filial, plano, nodes, cpu, ram, webhooksUsed, webhooksMax });
  };

  const lojasFiltradas = (filiaisDb || []).filter(f => f.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalLojas = (filiaisDb || []).length;
  const ativas = (filiaisDb || []).filter(f => sysConfig.planos?.[f] !== 'SUSPENSO').length;
  const suspensas = totalLojas - ativas;

  return (
    <div className="anim-fade-in absolute-fullscreen">

      <div className="noc-hud-grid anim-stagger-1" style={{ flexShrink: 0 }}>
        <div className="noc-hud-card" style={{'--card-color': 'var(--theme-sec)', minHeight: '100px'}}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><Building2 size={14}/> Total de Tenants</span></div>
          <div className="noc-kpi-value" style={{ color: 'var(--theme-sec)' }}>{totalLojas}</div>
        </div>
        <div className="noc-hud-card" style={{'--card-color': '#10b981', minHeight: '100px'}}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><ShieldCheck size={14}/> Licenças Ativas</span></div>
          <div className="noc-kpi-value" style={{ color: '#10b981' }}>{ativas}</div>
        </div>
        <div className="noc-hud-card" style={{'--card-color': '#ef4444', minHeight: '100px'}}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><ShieldBan size={14}/> Em Lockdown</span></div>
          <div className="noc-kpi-value" style={{ color: '#ef4444' }}>{suspensas}</div>
        </div>
      </div>

      <div className="dev-card glass-card anim-stagger-2" style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, borderTop: '4px solid #a855f7' }}>
        <div className="dev-card-header flex-between" style={{ color: '#a855f7', padding: '1.5rem', marginBottom: 0, flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldAlert size={24} /><h3>Contas Corporativas e Integrações API</h3></div>
          <div className="iam-search-box mobile-full-width" style={{ maxWidth: '300px', flex: '1 1 200px' }}>
            <Search size={16} color="#64748b" />
            <input type="text" placeholder="Procurar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="flex-table-container">
          <div className="flex-table-content" style={{ minWidth: '1150px' }}>
            <div className="saas-table-header saas-grid-cols" style={{ position: 'sticky', top: 0, zIndex: 10, margin: '0 0 4px 0', background: 'rgba(11, 17, 32, 0.95)' }}>
              <div>Organização / Cliente</div><div>Uso / Infraestrutura</div><div>Armazenamento DB</div><div style={{ textAlign: 'center' }}>Chaves API (Webhooks)</div><div style={{ textAlign: 'center' }}>Licença (Acesso)</div><div style={{ textAlign: 'right' }}>Ações Rápidas</div>
            </div>

            {lojasFiltradas.length === 0 ? (
               <div style={{ textAlign: 'center', padding: '30px', color: 'var(--dim-text)' }}>Nenhuma organização encontrada.</div>
            ) : lojasFiltradas.map((filial, index) => {
              const planoAtual = sysConfig.planos?.[filial] || 'FREE'; const isSuspenso = planoAtual === 'SUSPENSO';
              const storagePercent = isSuspenso ? 0 : (planoAtual === 'FREE' ? 85 : (planoAtual === 'PRO' ? 45 : 15));
              const storageColor = storagePercent > 80 ? 'var(--danger)' : (storagePercent > 50 ? 'var(--warning)' : 'var(--theme-main)');
              const { nodeCount, apiCalls } = tenantUsageMetrics[filial] || getTenantUsageMetric(filial, planoAtual);

              return (
                <div className={`saas-client-row saas-grid-cols ${isSuspenso ? 'row-suspended' : ''}`} style={{ margin: 0 }} key={index}>
                  <div>
                    <div className="text-truncate" style={{ color: isSuspenso ? 'var(--danger)' : 'white', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isSuspenso ? '#ef4444' : '#10b981', boxShadow: `0 0 8px ${isSuspenso ? '#ef4444' : '#10b981'}` }}></div>
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
                      <select disabled={isSuspenso} onChange={(e) => handleMudarRetencao(filial, e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.8rem', color: 'var(--theme-sec)', outline: 'none', cursor: 'pointer', fontWeight: '800' }}>
                        <option value="30">30 Dias</option><option value="90">90 Dias</option><option value="365">1 Ano</option>
                      </select>
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
                  <div style={{ textAlign: 'center', padding: '0 10px' }}>
                    <select value={planoAtual} onChange={(e) => handleMudarPlano(filial, e.target.value)} className="plan-dropdown">
                      <option value="FREE">FREE (Básico)</option><option value="PRO">PRO (Avançado)</option><option value="ENTERPRISE">ENTERPRISE (Total)</option><option value="SUSPENSO">⚠️ LOCKDOWN</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn-icon-small" title="Visão 360 do Cliente" onClick={() => openModal360(filial, planoAtual, nodeCount)} style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}><ActivitySquare size={18} /></button>
                    <button className="btn-icon-small" title="Acessar Como Cliente (Impersonate)" onClick={() => loginAs(filial)}><UserCheck size={18} /></button>
                    <button className="btn-icon-small danger-text" title="Forçar Logout Remoto (Kill Switch)" onClick={() => handleForcarLogout(filial)}><Power size={18} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modal360 && (
        <div className="iam-modal-overlay">
          <div className="iam-modal-content" style={{ maxWidth: '600px' }}>
            <div className="iam-modal-header" style={{ background: 'rgba(56, 189, 248, 0.1)', borderBottom: '1px solid rgba(56, 189, 248, 0.3)' }}>
               <h3 style={{ color: '#38bdf8' }}><ActivitySquare size={20}/> Client 360: {modal360.nome}</h3>
               <button className="btn-close-modal" onClick={() => setModal360(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20}/></button>
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
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px' }}><span>CPU (vCores)</span><span>{modal360.cpu}%</span></div>
                     <div className="storage-bar-bg" style={{ height: '6px', margin: 0 }}><div className="storage-bar-fill" style={{ width: `${modal360.cpu}%`, background: 'var(--theme-sec)' }}></div></div>
                   </div>
                   <div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px' }}><span>Memória Cache (Redis)</span><span>{modal360.ram}%</span></div>
                     <div className="storage-bar-bg" style={{ height: '6px', margin: 0 }}><div className="storage-bar-fill" style={{ width: `${modal360.ram}%`, background: '#f59e0b' }}></div></div>
                   </div>
                   <div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px' }}><span>Webhooks Simultâneos</span><span>{modal360.webhooksUsed} / {modal360.webhooksMax}</span></div>
                     <div className="storage-bar-bg" style={{ height: '6px', margin: 0 }}><div className="storage-bar-fill" style={{ width: `${(modal360.webhooksUsed / modal360.webhooksMax) * 100}%`, background: '#a855f7' }}></div></div>
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
// TELA BILLING (FINANCEIRO E FATURAMENTO - ROLAGEM FLUIDA COM OVERFLOW X)
// ============================================================================
const TelaBilling = ({ api, socket, sysConfig, filiaisDb, showToast, addLog, updateSysConfig, setModalConfig }) => {
  // Billing: acompanha faturas por filial/tenant e aciona cobrança ou bloqueios
  // comerciais conforme plano e status de pagamento.
  const [billingSetup, setBillingSetup] = useState(() => {
    const saved = localStorage.getItem('termosync_billing_setup');
    return saved ? JSON.parse(saved) : { pro: 299.90, ent: 899.90, diaVencimento: 10, multa: 2.0, juros: 1.0 };
  });

  const [faturas, setFaturas] = useState({});
  const [isGenerating, setIsGenerating] = useState(null);
  const [isLoadingFinanceiro, setIsLoadingFinanceiro] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('ALL');
  const [modalHistorico, setModalHistorico] = useState(null);

  /**
   * Atualiza update setup mantendo o estado persistido em sincronia.
   */
  const updateSetup = (key, val) => {
    const newSetup = { ...billingSetup, [key]: parseFloat(val) || 0 };
    setBillingSetup(newSetup);
    localStorage.setItem('termosync_billing_setup', JSON.stringify(newSetup));
  };

  const hoje = useMemo(() => new Date(), []);
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
    /**
     * Processa a interacao de on pagamento confirmado e atualiza a interface conforme o resultado.
     */
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

  /**
   * Processa a interacao de confirmar pagamento e atualiza a interface conforme o resultado.
   */
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

  /**
   * Concentra a logica de forcar fatura atrasada para manter o restante do tela mais legivel.
   */
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

  /**
   * Concentra a logica de disparar cobranca em lote para manter o restante do tela mais legivel.
   */
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

  /**
   * Concentra a logica de notificar cobranca para manter o restante do tela mais legivel.
   */
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

  /**
   * Concentra a logica de simular geracao para manter o restante do tela mais legivel.
   */
  const simularGeracao = (tipo, filial, callback) => {
    setIsGenerating(`${tipo}_${filial}`); showToast(`A compilar documento ${tipo}...`, 'info');
    setTimeout(() => { callback(); setIsGenerating(null); }, 1200);
  };

  /**
   * Concentra a logica de draw barcode para manter o restante do tela mais legivel.
   */
  const drawBarcode = (doc, x, y, width, height) => {
    let currentX = x; doc.setFillColor(0, 0, 0);
    while (currentX < x + width) {
      let barWidth = Math.random() > 0.5 ? 0.5 : 1.5;
      if (currentX + barWidth > x + width) break;
      doc.rect(currentX, y, barWidth, height, 'F');
      currentX += barWidth + (Math.random() > 0.5 ? 0.6 : 1.2);
    }
  };

  /**
   * Gera gerar nota fiscal pdf com os dados necessarios para o proximo passo.
   */
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

  /**
   * Gera gerar boleto pdf com os dados necessarios para o proximo passo.
   */
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

  /**
   * Gera gerar csvrelatorio com os dados necessarios para o proximo passo.
   */
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
          <div className="chart-container" style={{ flex: 1, margin: 0, minHeight: '180px' }}>
            <ResponsiveContainer width="100%" height={180}>
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

          <div style={{paddingRight: '0', paddingBottom: '20px'}}>
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
// TELA SOC & GESTÃO DE IDENTIDADE (IAM / ZERO-TRUST)
// ============================================================================
const TelaSOC = ({ api, showToast, addLog, setModalConfig, usuariosLista }) => {
  // SOC: auditoria e resposta de segurança. Reúne sessões, eventos sensíveis,
  // revogações e trilhas de auditoria.
  const [activeSessions, setActiveSessions] = useState([]);
  const [, setAuditLogs] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [securityStatus, setSecurityStatus] = useState(null);
  const [, setIsLoading] = useState(true);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [isModalUserOpen, setIsModalUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ nome: '', email: '', role: 'LOJA', mfa: true });

  const [mfaUsers, setMfaUsers] = useState(() => JSON.parse(localStorage.getItem('termosync_mfa_users')) || []);
  const [blockedUsers, setBlockedUsers] = useState(() => JSON.parse(localStorage.getItem('termosync_blocked_users')) || []);

  const carregarDadosSOC = useCallback(async () => {
    try {
      const [resSessoes, resAuditoria, resSecurityEvents, resSecurityStatus] = await Promise.all([
        api.get('/soc/sessoes'),
        api.get('/soc/auditoria'),
        api.get('/soc/security-events'),
        api.get('/security/status')
      ]);
      setActiveSessions(resSessoes.data.map(s => {
        const loginDate = new Date(s.loginTime); const expiryDate = s.expiresAt ? new Date(s.expiresAt) : new Date(loginDate.getTime() + 12 * 60 * 60 * 1000);
        const minLeft = Math.max(0, Math.floor((expiryDate - new Date()) / 60000));
        const ttlBase = Math.max(60, Math.floor((expiryDate - loginDate) / 60000));
        return { ...s, loginTimeStr: loginDate.toLocaleString('pt-BR'), expirationMin: minLeft, expirationPercent: Math.min(100, Math.max(0, (minLeft / ttlBase) * 100)), device: s.userAgent ? s.userAgent.split(' ')[0] : 'Web Client' };
      }));
      setAuditLogs(resAuditoria.data.map(a => ({ ...a, time: new Date(a.data_hora).toLocaleString('pt-BR'), severity: a.severity || 'info' })));
      setSecurityEvents(resSecurityEvents.data.map(e => ({ ...e, time: new Date(e.createdAt).toLocaleString('pt-BR'), severity: e.severity || 'info' })));
      setSecurityStatus(resSecurityStatus.data);
    } catch (error) {
      addLog(`[SOC ERRO] Falha ao carregar sessões e auditoria: ${error?.message || 'erro desconhecido'}`, 'error');
    } finally { setIsLoading(false); }
  }, [api, addLog]);

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
  const tentativasFalhadas = securityStatus?.metrics?.failedLogins24h ?? securityEvents.filter(l => l.eventType === 'LOGIN_FAILED').length;
  const ipsBloqueados = new Set(securityEvents.filter(l => l.eventType === 'LOGIN_LOCKED').map(l => l.ip)).size;
  const checksFalhos = securityStatus?.checks?.filter(check => !check.ok && check.severity !== 'info') || [];

  /**
   * Processa a interacao de handle revoke e atualiza a interface conforme o resultado.
   */
  const handleRevoke = (id, user) => { setModalConfig({ isOpen: true, title: 'Revogar Acesso JWT', message: `Deseja realmente derrubar a ligação de ${user}?`, onConfirm: async () => { try { await api.post(`/soc/revogar/${id}`); setActiveSessions(prev => prev.filter(s => s.id !== id)); showToast(`Sessão encerrada.`, 'success'); addLog(`[SOC] Sessão forçada ao encerramento: ${user}`, 'error'); carregarDadosSOC(); } catch (e) { showToast('Erro ao revogar sessão.', 'error'); } } }); };
  /**
   * Processa a interacao de handle revoke all e atualiza a interface conforme o resultado.
   */
  const handleRevokeAll = () => { setModalConfig({ isOpen: true, title: 'Purga Global de Sessões (Kill-Switch)', message: `ATENÇÃO: Isto irá invalidar TODOS os tokens JWT ativos, exceto a sessão atual. Proceder?`, onConfirm: async () => { try { const res = await api.post('/soc/revogar-todas'); setActiveSessions([]); showToast(`${res.data?.revoked || 0} sessões terminadas.`, 'success'); addLog('[SECURITY] Kill-switch ativado.', 'error'); carregarDadosSOC(); } catch (e) { showToast('Erro ao revogar sessões.', 'error'); } } }); };
  /**
   * Processa a interacao de handle mfa action e atualiza a interface conforme o resultado.
   */
  const handleMfaAction = (id, nome) => { const newMfa = mfaUsers.includes(id) ? mfaUsers.filter(uid => uid !== id) : [...mfaUsers, id]; setMfaUsers(newMfa); localStorage.setItem('termosync_mfa_users', JSON.stringify(newMfa)); showToast(`MFA alterado para ${nome}.`, 'info'); addLog(`[IAM] MFA atualizado para: ${nome}`, 'warning'); };

  /**
   * Processa a interacao de handle block action e atualiza a interface conforme o resultado.
   */
  const handleBlockAction = (id, nome) => {
    const isBlocked = blockedUsers.includes(id); const newBlocked = isBlocked ? blockedUsers.filter(uid => uid !== id) : [...blockedUsers, id];
    setBlockedUsers(newBlocked); localStorage.setItem('termosync_blocked_users', JSON.stringify(newBlocked));
    if (isBlocked) { addLog(`[IAM] Usuário ${nome} desbloqueado.`, 'success'); showToast('Usuário desbloqueado.', 'success'); }
    else { addLog(`[IAM] Usuário ${nome} bloqueado preventivamente.`, 'error'); showToast('Usuário bloqueado.', 'warning'); const userBase = usuariosLista.find(u => u.id === id); const session = activeSessions.find(s => s.usuario === userBase?.usuario); if (session) api.post(`/soc/revogar/${session.id}`).then(() => carregarDadosSOC()).catch((error) => addLog(`[IAM ERRO] Falha ao revogar sessão: ${error?.message || 'erro desconhecido'}`, 'error')); }
  };

  /**
   * Concentra a logica de salvar novo usuario para manter o restante do tela mais legivel.
   */
  const salvarNovoUsuario = async (e) => {
    e.preventDefault(); if (!newUser.nome.trim() || !newUser.email.trim()) return showToast('Nome e e-mail são obrigatórios.', 'error');
    try { await api.post('/usuarios', { usuario: newUser.email.split('@')[0], senha: 'Mudar@123', role: newUser.role, nome_tecnico: newUser.role === 'MANUTENCAO' ? newUser.nome : null, nome_gerente: newUser.role === 'LOJA' ? newUser.nome : null, filial: 'Matriz' }); addLog(`[IAM] Nova credencial provisionada: ${newUser.nome}`, 'success'); showToast('Criado! Senha: Mudar@123', 'success'); setIsModalUserOpen(false); setNewUser({ nome: '', email: '', role: 'LOJA', mfa: true }); } catch (err) { showToast('Erro ao gravar na BD.', 'error'); }
  };

  return (
    <>
      <div className="anim-fade-in absolute-fullscreen">
        <div className="noc-hud-grid anim-stagger-1" style={{ flexShrink: 0 }}>
          <div className="noc-hud-card" style={{'--card-color': '#a855f7'}}><div className="noc-mini-header"><span className="noc-kpi-title"><Users size={14}/> CONTAS ATIVAS</span></div><div className="noc-kpi-value">{contasAtivas}</div></div>
          <div className="noc-hud-card" style={{'--card-color': '#10b981'}}><div className="noc-mini-header"><span className="noc-kpi-title"><ShieldCheck size={14}/> TOKENS VÁLIDOS</span></div><div className="noc-kpi-value" style={{color: '#10b981'}}>{tokensValidos}</div></div>
          <div className="noc-hud-card pulse-warning-card" style={{'--card-color': '#f59e0b'}}><div className="noc-mini-header"><span className="noc-kpi-title"><UserX size={14}/> TENTATIVAS FALHADAS</span></div><div className="noc-kpi-value" style={{color: '#f59e0b'}}>{tentativasFalhadas}</div></div>
          <div className="noc-hud-card" style={{'--card-color': '#ef4444'}}><div className="noc-mini-header"><span className="noc-kpi-title"><AlertTriangle size={14}/> IPS BLOQUEADOS</span></div><div className="noc-kpi-value" style={{color: '#ef4444'}}>{ipsBloqueados}</div></div>
        </div>
        {securityStatus && (
          <div className="dev-card glass-card" style={{ flexShrink: 0, borderTop: `4px solid ${checksFalhos.length ? '#f59e0b' : '#10b981'}`, marginBottom: '12px' }}>
            <div className="dev-card-header flex-between" style={{ marginBottom: '12px', color: checksFalhos.length ? '#f59e0b' : '#10b981', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {checksFalhos.length ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
                <h3>Verificação de Segurança</h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--dim-text)', fontFamily: 'Montserrat' }}>
                Sessões: {securityStatus.metrics?.activeSessions || 0} ativas / {securityStatus.metrics?.revokedSessions || 0} revogadas
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
              {securityStatus.checks?.map(check => (
                <div key={check.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${check.ok ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.35)'}`, background: check.ok ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)' }}>
                  {check.ok ? <CheckCircle2 size={15} color="#10b981" /> : <AlertTriangle size={15} color="#f59e0b" />}
                  <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 800 }}>{check.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dev-grid-main anim-stagger-2" style={{ flex: 1, minHeight: 0 }}>
          <div className="dev-col-left" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div className="dev-card glass-card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid #38bdf8', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="dev-card-header flex-between" style={{color: '#38bdf8', padding: '1.5rem', marginBottom: 0, flexWrap: 'wrap'}}>
                <div style={{display:'flex', gap:'8px', alignItems:'center', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap'}}>
                  <div style={{display:'flex', gap:'8px', alignItems:'center'}}><UserCog size={24}/><h3>Diretório (AD)</h3></div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                    <div className="iam-search-box"><Search size={14} color="#64748b" /><input type="text" placeholder="Procurar usuário..." value={buscaUsuario} onChange={e => setBuscaUsuario(e.target.value)} /></div>
                    <button className="btn btn-outline" onClick={() => setIsModalUserOpen(true)} style={{padding: '8px 12px', fontSize: '0.75rem', borderColor: 'rgba(56,189,248,0.3)', color: '#38bdf8', minHeight: '34px'}}><UserPlus size={14} style={{marginRight: '6px'}}/> Novo</button>
                  </div>
                </div>
              </div>
              <div className="flex-table-container">
                <div className="flex-table-content" style={{ minWidth: '950px' }}>
                  <div className="saas-table-header iam-ad-grid-cols" style={{ position: 'sticky', top: 0, zIndex: 10, margin: '0 0 4px 0', background: 'rgba(11, 17, 32, 0.95)' }}><div>Usuário / Cargo</div><div>Role do Sistema</div><div>Status / MFA</div><div>Último IP</div><div style={{textAlign: 'right'}}>Ações</div></div>
                  {filteredUsuarios.map((u) => (
                    <div key={u.id} className={`saas-client-row iam-ad-grid-cols ${u.status === 'BLOQUEADO' ? 'row-suspended' : ''}`} style={{ margin: 0 }}>
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
          <div className="dev-col-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div className="dev-card glass-card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid #a855f7', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="dev-card-header flex-between" style={{color: '#a855f7', padding: '1.5rem', marginBottom: 0, flexWrap: 'wrap'}}><div style={{display:'flex', gap:'8px', alignItems:'center'}}><FingerprintIcon size={24}/><h3>Sessões JWT (Live)</h3></div>
                {activeSessions.length > 0 && <button className="btn btn-outline danger-text" onClick={handleRevokeAll} style={{padding: '8px 12px', fontSize: '0.75rem', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444', minHeight: '34px'}}><ShieldBan size={14} style={{marginRight: '6px'}}/> Revogar Tudo</button>}
              </div>
              <div className="flex-table-container">
                <div className="flex-table-content" style={{ minWidth: '900px' }}>
                  <div className="saas-table-header soc-grid-cols" style={{ position: 'sticky', top: 0, zIndex: 10, margin: '0 0 4px 0', background: 'rgba(11, 17, 32, 0.95)' }}><div>Usuário (Token)</div><div>IP / Device</div><div>Ciclo de Vida</div><div style={{textAlign: 'right'}}>Ação</div></div>
                  {activeSessions.map((s) => (
                    <div key={s.id} className="saas-client-row soc-grid-cols" style={{ margin: 0 }}>
                      <div><div className="text-truncate" style={{fontWeight: '900', color: 'white', fontSize: '1.05rem'}}>{s.usuario}</div><div style={{fontSize: '0.85rem', color: '#a855f7', marginTop: '4px', fontWeight: 'bold'}}>{s.role}</div></div>
                      <div><div style={{fontFamily: 'Montserrat', color: 'var(--dim-text)', fontSize: '0.95rem'}}>{s.ip === '::1' ? 'Localhost' : s.ip}</div><div style={{fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: '#cbd5e1'}}><MonitorSmartphone size={12}/>{s.device}</div></div>
                      <div style={{paddingRight: '15px', paddingTop: '4px'}}><div className="progress-bar-bg" style={{marginTop: 0}}><div className="progress-bar-fill" style={{ width: `${s.expirationPercent}%`, backgroundColor: s.expirationPercent < 20 ? '#ef4444' : '#a855f7' }}></div></div><div style={{fontSize: '0.7rem', color: 'var(--dim-text)', display: 'flex', justifyContent: 'space-between', marginTop: '4px'}}><span>Expira em</span><span style={{fontFamily: 'Montserrat'}}>{s.expirationMin} min</span></div></div>
                      <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center'}}><button className="btn-icon-small danger-text" title="Derrubar Ligação" onClick={() => handleRevoke(s.id, s.usuario)}><Power size={18} /></button></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="dev-card glass-card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', flex: 0.75, minHeight: 220, marginTop: '12px' }}>
              <div className="dev-card-header flex-between" style={{color: '#f59e0b', padding: '1.25rem', marginBottom: 0, flexWrap: 'wrap'}}>
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}><ShieldAlert size={22}/><h3>Eventos de Segurança</h3></div>
                <span style={{fontSize: '0.72rem', color: 'var(--dim-text)', fontFamily: 'Montserrat'}}>últimos {securityEvents.length}</span>
              </div>
              <div style={{ overflowY: 'auto', padding: '0 1.25rem 1.25rem' }}>
                {securityEvents.length === 0 ? (
                  <div style={{ color: 'var(--dim-text)', padding: '14px 0', fontSize: '0.85rem' }}>Nenhum evento estruturado registrado.</div>
                ) : securityEvents.slice(0, 8).map((event, index) => (
                  <div key={`${event.createdAt}-${index}`} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--dim-text)', fontFamily: 'Montserrat' }}>{event.time}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className={`role-badge ${event.severity === 'danger' ? 'dev' : event.severity === 'success' ? 'admin' : 'manutencao'}`}>{event.eventType}</span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{event.ip || 'IP desconhecido'}</span>
                      </div>
                      {event.detail && <div className="text-truncate" style={{ marginTop: '4px', fontSize: '0.78rem', color: '#cbd5e1' }}>{event.detail}</div>}
                    </div>
                  </div>
                ))}
              </div>
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
const TelaBI = ({ api, showToast, addLog: _addLog, sysConfig, filiaisDb }) => {
  // BI executivo: consolida métricas de sistema, filiais e recursos habilitados
  // para análise do ambiente SaaS.
  const [isProcessing, setIsProcessing] = useState(null);

  /**
   * Concentra a logica de processar dados relatorio para manter o restante do tela mais legivel.
   */
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
      body = [['Cluster MySQL', res.data.db, 'NORMAL'], ['WebSockets Ativos', res.data.sockets, 'NORMAL'], ['Volume (Registros)', res.data.total_records, 'NORMAL']];
    } else { head = ['Campo 1', 'Campo 2']; body = [['Sem dados', '...']]; }
    return { head, body };
  };

  /**
   * Gera gerar relatorio pdf com os dados necessarios para o proximo passo.
   */
  const gerarRelatorioPDF = async (tipo, tema, cor) => {
    setIsProcessing(`PDF_${tipo}`); showToast(`Compilando PDF: ${tipo}...`, 'warning');
    try {
      await api.post('/system/reports/log', { tipo, formato: 'PDF', solicitante: 'Root/Dev' });
      const { head, body } = await processarDadosRelatorio(tipo);
      const doc = new jsPDF('landscape'); doc.setFillColor(cor); doc.rect(0, 0, 300, 20, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text(`TERMOSYNC ENTERPRISE - RELATÓRIO EXECUTIVO`, 15, 13);
      doc.setTextColor(50, 50, 50); doc.setFontSize(14); doc.text(tema, 15, 30);
      autoTable(doc, { head: [head], body: body, startY: 45, headStyles: { fillColor: cor } });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      doc.save(`TermoSync_Report_${tipo}_${timestamp}.pdf`); showToast('PDF transferido.', 'success');
    } catch (e) { showToast('Erro no PDF.', 'error'); }
    setIsProcessing(null);
  };

  /**
   * Gera gerar relatorio csv com os dados necessarios para o proximo passo.
   */
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
      <div className="flex-header" style={{ padding: 0, background: 'transparent', boxShadow: 'none', marginBottom: '0' }}>
        <div className="dev-card glass-card" style={{ width: '100%', borderTop: '4px solid #38bdf8' }}>
          <div className="dev-card-header" style={{ color: '#38bdf8', marginBottom: '5px' }}>
            <PieChart size={24} />
            <h3 style={{fontSize: 'clamp(1rem, 2vw, 1.2rem)'}}>Centro de Inteligência e Analytics (BI)</h3>
          </div>
        </div>
      </div>
      <div className="bi-grid stagger-2">
        {modulosBI.map(mod => (
          <div key={mod.id} className="bi-card glass-card" style={{ '--theme-color': mod.color }}>
            <div className="bi-header">
              <div className="bi-icon-wrapper"><mod.icon size={24} /></div>
              <div><h4 className="bi-title" style={{color:'white'}}>{mod.titulo}</h4><p className="bi-desc">{mod.desc}</p></div>
            </div>
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
  // Atualizações: upload e validação de pacotes de deploy com fluxo protegido
  // para evitar instalação acidental ou pacote fora do padrão.
  const [updates, setUpdates] = useState([]);
  const [newUpdate, setNewUpdate] = useState({
    version: '',
    title: '',
    type: 'feature',
    desc: '',
    targetType: 'AUTO',
    passcode: ''
  });
  const [updateFile, setUpdateFile] = useState(null);
  const [fileDetails, setFileDetails] = useState(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState(0);
  const [checkBackup, setCheckBackup] = useState(false);
  const [checkDowntime, setCheckDowntime] = useState(false);

  const carregarChangelog = useCallback(async () => {
    try {
      const res = await api.get('/system/changelog');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setUpdates(res.data);
      } else {
        const local = JSON.parse(localStorage.getItem('termosync_changelog')) || [];
        setUpdates(local);
      }
    } catch (e) {
      const local = JSON.parse(localStorage.getItem('termosync_changelog')) || [];
      setUpdates(local);
    }
  }, [api]);

  useEffect(() => {
    carregarChangelog();
  }, [carregarChangelog]);

  /**
   * Processa a interacao de handle file select e atualiza a interface conforme o resultado.
   */
  const handleFileSelect = (file) => {
    if (!file) return;
    setUpdateFile(file);

    const name = file.name.toLowerCase();
    let detected = 'AUTO';
    let hint = 'Pacote genérico zipado';

    if (name.includes('front') || name.includes('ui') || name.includes('dist') || name.includes('build')) {
      detected = 'FRONTEND';
      hint = 'Detectado: Interface Web / Assets React (public_html)';
    } else if (name.includes('back') || name.includes('api') || name.includes('server') || name.includes('node')) {
      detected = 'BACKEND';
      hint = 'Detectado: Core API / Banco / Rotas Node.js';
    } else if (name.includes('full') || name.includes('release')) {
      detected = 'FULLSTACK';
      hint = 'Detectado: Release Full-Stack Completo';
    }

    setFileDetails({
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      detected,
      hint
    });

    setNewUpdate((prev) => ({ ...prev, targetType: detected }));
  };

  /**
   * Processa a interacao de handle deploy e atualiza a interface conforme o resultado.
   */
  const handleDeploy = (e) => {
    e.preventDefault();
    if (!newUpdate.version || !newUpdate.title || !newUpdate.desc || !newUpdate.passcode || !updateFile || !checkBackup || !checkDowntime) {
      return showToast('Preencha os dados e valide o checklist.', 'error');
    }

    setModalConfig({
      isOpen: true,
      title: 'INICIAR DEPLOY EM PRODUÇÃO',
      message: `O pacote "${updateFile.name}" será injetado no ambiente [${newUpdate.targetType}]. Confirmar deploy?`,
      onConfirm: async () => {
        setIsDeploying(true);
        setDeployStep(1);
        addLog(`[CI/CD] Upload de pacote ${newUpdate.targetType} iniciado...`, 'warning');

        const formData = new FormData();
        formData.append('updatePackage', updateFile);
        formData.append('version', newUpdate.version);
        formData.append('title', newUpdate.title);
        formData.append('desc', newUpdate.desc);
        formData.append('type', newUpdate.type);
        formData.append('targetType', newUpdate.targetType);
        formData.append('passcode', newUpdate.passcode);

        try {
          setTimeout(() => setDeployStep(2), 1200);
          const response = await api.post('/system/deploy-update', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          setDeployStep(3);
          addLog(`[CI/CD] Servidor identificou destino: ${response.data?.targetDetected}`, 'info');
          verificarRetornoServidor();
        } catch (error) {
          setDeployStep(3);
          verificarRetornoServidor();
        }
      }
    });
  };

  /**
   * Concentra a logica de verificar retorno servidor para manter o restante do tela mais legivel.
   */
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
          showToast('Falha: Timeout de reconexão do servidor.', 'error');
        }
      }
    }, 2000);
  };

  /**
   * Concentra a logica de finalizar deploy sucesso para manter o restante do tela mais legivel.
   */
  const finalizarDeploySucesso = () => {
    setDeployStep(5);
    setTimeout(() => {
      carregarChangelog();
      setIsDeploying(false);
      setDeployStep(0);
      setNewUpdate({ version: '', title: '', type: 'feature', desc: '', targetType: 'AUTO', passcode: '' });
      setUpdateFile(null);
      setFileDetails(null);
      setCheckBackup(false);
      setCheckDowntime(false);

      showToast('Deploy 100% integrado concluído!', 'success');
      addLog('[CI/CD] Sincronização concluída com Changelog, SOC e WebSockets.', 'success');
    }, 1500);
  };

  const isFormReady = newUpdate.version && newUpdate.title && newUpdate.desc && newUpdate.passcode && updateFile && checkBackup && checkDowntime;

  return (
    <div className="dev-tela-scroll">
      <div className="dev-grid-main anim-stagger-2">
        <div className="dev-col-left" style={{ flex: '1.2' }}>
          <div className="dev-card glass-card" style={{ borderTop: `4px solid ${isOverclocked ? '#ef4444' : 'var(--theme-sec)'}` }}>
            <div className="dev-card-header flex-between" style={{ color: isOverclocked ? '#ef4444' : 'var(--theme-sec)', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Rocket size={24} />
                <h3>Motor de Deploy (CI/CD)</h3>
              </div>
              <span className="status-badge" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--theme-sec)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                INTELIGENTE & INTEGRADO
              </span>
            </div>

            {isDeploying ? (
              <div style={{ background: 'var(--bg-dark)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-focus)', minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--theme-main)', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                  <Loader2 size={24} className="spin" />
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Injetando Pacote no Servidor...</h3>
                </div>
                <div className="crt-terminal" style={{ flex: 1, fontFamily: 'Montserrat', fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ color: '#94a3b8' }}>[CI/CD] Validando assinatura e tipo de alvo ({newUpdate.targetType})...</div>
                  {deployStep >= 1 && <div><span style={{ color: 'var(--secondary)' }}>[UPLOAD]</span> Transferindo artefato ZIP para tmp/...</div>}
                  {deployStep >= 2 && <div><span style={{ color: 'var(--warning)' }}>[EXTRACT]</span> Distribuindo arquivos para {newUpdate.targetType === 'FRONTEND' ? 'public_html/' : 'raiz backend/'}...</div>}
                  {deployStep >= 3 && <div><span style={{ color: '#a855f7' }}>[INTEGRAÇÃO]</span> Gravando DB Changelog e emitindo evento Socket...</div>}
                  {deployStep >= 4 && <div className="pulse-icon"><span style={{ color: 'var(--secondary)' }}>[HEALTH]</span> Checando uptime e resposta PM2...</div>}
                  {deployStep >= 5 && <div style={{ color: 'var(--theme-main)', fontWeight: 'bold' }}>[SUCESSO] Deploy finalizado com sucesso!</div>}
                </div>
              </div>
            ) : (
              <form onSubmit={handleDeploy} className="deploy-form-grid">
                <div className="form-group" style={{ marginBottom: '5px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--dim-text)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Alvo do Deploy (Destino) *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <button type="button" className={`btn btn-outline ${newUpdate.targetType === 'FRONTEND' ? 'active' : ''}`} onClick={() => setNewUpdate({ ...newUpdate, targetType: 'FRONTEND' })} style={{ padding: '10px', fontSize: '0.75rem', borderColor: newUpdate.targetType === 'FRONTEND' ? '#38bdf8' : 'rgba(255,255,255,0.1)', background: newUpdate.targetType === 'FRONTEND' ? 'rgba(56,189,248,0.15)' : 'transparent', color: newUpdate.targetType === 'FRONTEND' ? '#38bdf8' : 'white' }}>🌐 FRONTEND (UI)</button>
                    <button type="button" className={`btn btn-outline ${newUpdate.targetType === 'BACKEND' ? 'active' : ''}`} onClick={() => setNewUpdate({ ...newUpdate, targetType: 'BACKEND' })} style={{ padding: '10px', fontSize: '0.75rem', borderColor: newUpdate.targetType === 'BACKEND' ? '#10b981' : 'rgba(255,255,255,0.1)', background: newUpdate.targetType === 'BACKEND' ? 'rgba(16,185,129,0.15)' : 'transparent', color: newUpdate.targetType === 'BACKEND' ? '#10b981' : 'white' }}>⚙️ BACKEND (API)</button>
                    <button type="button" className={`btn btn-outline ${newUpdate.targetType === 'FULLSTACK' ? 'active' : ''}`} onClick={() => setNewUpdate({ ...newUpdate, targetType: 'FULLSTACK' })} style={{ padding: '10px', fontSize: '0.75rem', borderColor: newUpdate.targetType === 'FULLSTACK' ? '#a855f7' : 'rgba(255,255,255,0.1)', background: newUpdate.targetType === 'FULLSTACK' ? 'rgba(168,85,247,0.15)' : 'transparent', color: newUpdate.targetType === 'FULLSTACK' ? '#a855f7' : 'white' }}>🚀 FULL-STACK</button>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 'bold' }}>Pacote ZIP *</label>
                  <div style={{ position: 'relative', border: `2px dashed ${updateFile ? 'var(--primary)' : 'var(--border-focus)'}`, borderRadius: '12px', padding: '20px', textAlign: 'center', background: updateFile ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.3)' }}>
                    <input type="file" accept=".zip" onChange={(e) => handleFileSelect(e.target.files[0])} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                      <FileCode size={32} color={updateFile ? 'var(--primary)' : 'var(--dim-text)'} />
                      <span style={{ color: updateFile ? 'var(--primary)' : 'white', fontWeight: 'bold', marginTop: '5px' }}>{updateFile ? updateFile.name : 'Clique ou arraste um arquivo .zip aqui'}</span>
                      {fileDetails && (<div style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(0,0,0,0.4)', padding: '4px 10px', borderRadius: '6px', marginTop: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>Tamanho: <strong>{fileDetails.size}</strong> | {fileDetails.hint}</div>)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group"><label>Versão *</label><div className="config-input-wrapper"><GitCommit size={16} /><input type="text" placeholder="v13.2.0" value={newUpdate.version} onChange={(e) => setNewUpdate({ ...newUpdate, version: e.target.value })} /></div></div>
                  <div className="form-group"><label>Categoria *</label><select value={newUpdate.type} onChange={(e) => setNewUpdate({ ...newUpdate, type: e.target.value })} style={{ minHeight: '48px' }}><option value="feature">Feature (Melhoria)</option><option value="fix">Bugfix (Correção)</option><option value="security">Segurança (SOC)</option><option value="refactor">Refatoração</option></select></div>
                </div>

                <div className="form-group"><label>Título da Versão *</label><div className="config-input-wrapper"><input type="text" placeholder="Ex: Módulo de Degelo Dinâmico" value={newUpdate.title} onChange={(e) => setNewUpdate({ ...newUpdate, title: e.target.value })} /></div></div>
                <div className="form-group"><label>Descrição do Changelog (Integrado com DB) *</label><textarea placeholder="Detalhe as mudanças operacionais..." value={newUpdate.desc} onChange={(e) => setNewUpdate({ ...newUpdate, desc: e.target.value })} style={{ minHeight: '80px' }} /></div>
                <div className="form-group"><label>Passcode Root *</label><div className="config-input-wrapper"><LockKeyhole size={16} /><input type="password" placeholder="Confirme a credencial root para deploy" value={newUpdate.passcode} onChange={(e) => setNewUpdate({ ...newUpdate, passcode: e.target.value })} autoComplete="current-password" /></div></div>

                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px 15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--border-dim)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.8rem', color: checkBackup ? 'var(--primary)' : 'white' }}><input type="checkbox" checked={checkBackup} onChange={(e) => setCheckBackup(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />Backup DB/Arquivos validado antes da atualização.</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.8rem', color: checkDowntime ? 'var(--warning)' : 'white' }}><input type="checkbox" checked={checkDowntime} onChange={(e) => setCheckDowntime(e.target.checked)} style={{ accentColor: 'var(--warning)' }} />Ciente das interconexões com SOC, WebSockets e Changelog.</label>
                </div>

                <button type="submit" className="btn btn-primary w-100" disabled={!isFormReady} style={{ marginTop: '5px', filter: isFormReady ? 'none' : 'grayscale(1)' }}><Rocket size={18} /> INICIAR DEPLOY DO {newUpdate.targetType}</button>
              </form>
            )}
          </div>
        </div>

        <div className="dev-col-right" style={{ flex: '1.8' }}>
          <div className="dev-card glass-card" style={{ borderTop: '4px solid var(--theme-main)', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="dev-card-header flex-between" style={{ color: 'var(--theme-main)', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><History size={24} /><h3>Changelog & Auditoria de Deploys</h3></div>
              <button className="btn btn-outline" onClick={carregarChangelog} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px' }}><RefreshCw size={14} style={{ marginRight: '6px' }} /> Sincronizar DB</button>
            </div>

            <div className="timeline-container" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', marginTop: 0 }}>
              {updates.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--dim-text)', padding: '40px' }}>Nenhuma atualização registrada na tabela system_changelog.</div>
              ) : (
                updates.map((upd, idx) => {
                  const targetBadge = upd.title?.includes('[FRONTEND]') ? 'FRONTEND' : upd.title?.includes('[BACKEND]') ? 'BACKEND' : 'FULLSTACK';
                  const titleClean = upd.title?.replace(/\[(FRONTEND|BACKEND|FULLSTACK)\]\s*/gi, '') || upd.title;

                  return (
                    <div key={upd.id || idx} className="timeline-item">
                      <div className="timeline-node" style={{ borderColor: targetBadge === 'FRONTEND' ? '#38bdf8' : targetBadge === 'BACKEND' ? '#10b981' : '#a855f7' }}></div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="version-badge">{upd.version}</span>
                            <span style={{ fontSize: '0.65rem', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', background: targetBadge === 'FRONTEND' ? 'rgba(56,189,248,0.15)' : 'rgba(16,185,129,0.15)', color: targetBadge === 'FRONTEND' ? '#38bdf8' : '#10b981', border: `1px solid ${targetBadge === 'FRONTEND' ? 'rgba(56,189,248,0.4)' : 'rgba(16,185,129,0.4)'}` }}>{targetBadge}</span>
                          </div>
                          <div className="update-meta"><Clock size={12} /> {upd.date ? new Date(upd.date).toLocaleString('pt-BR') : 'Data Indisponível'}</div>
                        </div>
                        <h4 className="update-title" style={{ marginTop: '6px' }}>{titleClean}</h4>
                        <p className="update-desc">{upd.desc_text || upd.desc}</p>
                        {upd.author && <div style={{ fontSize: '0.7rem', color: 'var(--dim-text)', marginTop: '8px', fontStyle: 'italic' }}>Autor: {upd.author}</div>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 12. TELA: CONSOLE TERMINAL SQL (ABSOLUTE FULLSCREEN COM OVERFLOW NATIVO)
// ============================================================================
const TelaTerminalSQL = ({ api, showToast, addLog }) => {
  // Terminal SQL controlado: executa consultas administrativas com proteções no
  // backend, passcode root e auditoria.
  const [query, setQuery] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Executa executar sql coordenando as etapas principais desse fluxo.
   */
  const executarSQL = async (e, forceQuery = null) => {
    if (e) e.preventDefault(); const sqlToRun = forceQuery || query; if (!sqlToRun.trim()) return;
    setLoading(true); setError(null); setResults(null); addLog(`[SQL] A executar diretiva na base de dados...`, 'warning');
    try {
      const res = await api.post('/system/query-raw', { sql: sqlToRun, passcode });
      if (res.data.success) {
        setResults(res.data.data); showToast('Query executada com sucesso.', 'success'); addLog(`[SQL SUCESS] Afetadas/Retornadas ${res.data.data?.length || 0} linhas.`, 'success');
      } else { setError(res.data.error || 'Erro desconhecido na query.'); showToast('Erro de sintaxe SQL.', 'error'); }
    } catch (err) { setError(err.response?.data?.error || err.message); addLog(`[SQL ERROR] Falha crítica de sintaxe ou ligação.`, 'error'); } finally { setLoading(false); }
  };

  /**
   * Concentra a logica de aplicar quick query para manter o restante do tela mais legivel.
   */
  const aplicarQuickQuery = (sql) => { setQuery(sql); executarSQL(null, sql); };

  return (
    <div className="anim-fade-in absolute-fullscreen">
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '5px', flexShrink: 0 }}>
        <button className="btn btn-outline" onClick={() => aplicarQuickQuery("SHOW TABLES;")} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}><Database size={14} style={{ marginRight: '6px' }}/> Ver Tabelas</button>
        <button className="btn btn-outline" onClick={() => aplicarQuickQuery("SELECT * FROM sessoes_ativas;")} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px' }}>Sessões</button>
      </div>

      <div className="dev-card glass-card" style={{ borderTop: '4px solid #f59e0b', marginBottom: '10px', flexShrink: 0 }}>
        <div className="dev-card-header flex-between" style={{ color: '#f59e0b', marginBottom: '15px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Database size={24} /><h3>Terminal SQL Master</h3></div>
        </div>
        <form onSubmit={(e) => executarSQL(e)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <textarea value={query} onChange={e => setQuery(e.target.value)} placeholder="SELECT * FROM equipamentos LIMIT 10;" style={{ minHeight: '120px', background: '#020617', color: '#38bdf8', fontFamily: 'Montserrat', fontSize: '0.95rem', border: '1px solid var(--border-focus)', padding: '15px', borderRadius: '8px' }} spellCheck="false" autoFocus />
          <div className="config-input-wrapper" style={{ maxWidth: '360px', alignSelf: 'flex-end' }}>
            <LockKeyhole size={16} />
            <input type="password" value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="Passcode root para escrita SQL" autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()} style={{ background: '#f59e0b', color: '#000', width: '220px', alignSelf: 'flex-end', filter: !query.trim() ? 'grayscale(1)' : 'none' }}>{loading ? <Loader2 size={16} className="spin" /> : <Terminal size={16} />} EXECUTAR SQL</button>
        </form>
      </div>

      {error && <div className="anim-fade-in" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '15px', borderRadius: '8px', fontFamily: 'Montserrat', fontSize: '0.85rem', flexShrink: 0 }}><strong>❌ ERRO DE COMPILAÇÃO MYSQL:</strong> {error}</div>}

      {results && results.length > 0 ? (
        <div className="dev-card glass-card anim-fade-in" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="flex-table-container" style={{ padding: 0 }}>
            <table className="dev-select-input" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'transparent', fontSize: '0.85rem' }}>
              <thead style={{ background: 'rgba(11, 17, 32, 0.95)', color: '#38bdf8', fontFamily: 'Montserrat', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>{Object.keys(results[0]).map((key, i) => <th key={i} style={{ padding: '12px 15px', borderBottom: '1px solid var(--border-focus)', whiteSpace: 'nowrap' }}>{key}</th>)}</tr>
              </thead>
              <tbody style={{ fontFamily: 'Montserrat', color: '#cbd5e1' }}>
                {results.map((row, i) => <tr key={i} style={{ borderBottom: '1px solid var(--border-dim)' }}>{Object.values(row).map((val, j) => <td key={j} style={{ padding: '10px 15px', whiteSpace: 'nowrap' }}>{val === null ? <span style={{color: '#64748b'}}>NULL</span> : String(val)}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </div>
      ) : results && (
        <div className="anim-fade-in" style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '15px', borderRadius: '8px', fontSize: '0.85rem', flexShrink: 0 }}>✔ Comando executado com sucesso. Nenhuma linha retornada (DML concluída).</div>
      )}
    </div>
  );
};

// ============================================================================
// 13. TELA: MONITOR WEBSOCKET LIVE (ABSOLUTE FULLSCREEN)
// ============================================================================
const TelaWebSocketStream = ({ socket, addLog }) => {
  // Firehose de sockets: monitor visual para eventos em tempo real sem misturar
  // com logs persistentes do servidor.
  const [packets, setPackets] = useState([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [filterMode, setFilterMode] = useState('ALL');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    /**
     * Concentra a logica de capturar tudo para manter o restante do tela mais legivel.
     */
    const capturarTudo = (eventName, ...args) => {
      if (!isStreaming) return;
      const payloadOriginal = args.length === 1 ? args[0] : args;
      const payloadFormatado = payloadOriginal !== undefined && payloadOriginal !== null ? payloadOriginal : { info: 'Sinal sem payload' };
      setPackets(prev => [...prev.slice(-199), { id: Date.now() + Math.random(), event: eventName, time: new Date().toLocaleTimeString('pt-BR'), payload: payloadFormatado }]);
    };
    if (isStreaming) { socket.onAny(capturarTudo); addLog('[WSS] Modo Promíscuo Ativado.', 'warning'); }
    return () => { socket.offAny(capturarTudo); };
  }, [socket, isStreaming, addLog]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [packets]);

  /**
   * Limpa limpar console para manter o estado consistente.
   */
  const limparConsole = () => { setPackets([]); addLog('[WSS] Consola limpa.', 'info'); };
  const visiblePackets = packets.filter(p => filterMode === 'ALL' || (filterMode === 'ALERTAS' && p.event.includes('alerta')) || (filterMode === 'LEITURAS' && p.event.includes('leitura')));

  return (
    <div className="anim-fade-in absolute-fullscreen">
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flexShrink: 0, justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
           <button className={`btn btn-outline ${filterMode === 'ALL' ? 'active' : ''}`} onClick={() => setFilterMode('ALL')} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', background: filterMode==='ALL'?'var(--primary)':'', color: filterMode==='ALL'?'#000':'' }}><Filter size={14} style={{ marginRight: '6px' }}/> Tudo</button>
           <button className={`btn btn-outline ${filterMode === 'LEITURAS' ? 'active' : ''}`} onClick={() => setFilterMode('LEITURAS')} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', background: filterMode==='LEITURAS'?'var(--secondary)':'', color: filterMode==='LEITURAS'?'#000':'' }}>Apenas Leituras</button>
           <button className={`btn btn-outline ${filterMode === 'ALERTAS' ? 'active' : ''}`} onClick={() => setFilterMode('ALERTAS')} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', background: filterMode==='ALERTAS'?'var(--danger)':'', color: filterMode==='ALERTAS'?'#000':'' }}>Apenas Alertas</button>
        </div>
        <button className="btn btn-outline danger-text" onClick={limparConsole} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', borderColor: 'rgba(239, 68, 68, 0.3)' }}><Trash2 size={14} style={{ marginRight: '6px' }}/> Limpar Tela</button>
      </div>

      <div className="dev-card glass-card" style={{ borderTop: '4px solid #a855f7', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: 0 }}>
        <div className="dev-card-header flex-between" style={{ color: '#a855f7', padding: '1.5rem', marginBottom: 0, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Network size={24} /><h3>Monitor Sockets Duplex (Firehose)</h3></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {isStreaming && <span className="pulse-icon" style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>● OUVINDO REDE</span>}
            <button onClick={() => setIsStreaming(!isStreaming)} className={`btn ${isStreaming ? 'btn-danger' : 'btn-success'}`} style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: '34px', fontWeight: 'bold' }}>{isStreaming ? <Power size={14} /> : <RefreshCw size={14} />}{isStreaming ? 'SUSPENDER CAPTURA' : 'LIGAR CAPTURA LIVE'}</button>
          </div>
        </div>

        <div className="crt-terminal" ref={scrollRef} style={{ flex: 1, background: '#020617', padding: '15px', borderRadius: '8px', overflowY: 'auto', border: '1px solid var(--border-focus)', fontFamily: 'Montserrat', fontSize: '0.8rem', margin: '0 1.5rem 1.5rem 1.5rem' }}>
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
// TELA ATUALIZADA: STATUS E CONFIGURAÇÃO DO ESP32 (VIA TELEMETRIA MQTT)
// ============================================================================
const TelaScannerRede = ({ api, showToast, addLog, filiaisDb: _filiaisDb }) => {
  // Scanner/saúde de ESP32: usa telemetria registrada no backend e só consulta
  // IP direto quando o operador aciona a atualização.
  const [hardwareList, setHardwareList] = useState([]);
  const [activeIp, setActiveIp] = useState('');
  const [espData, setEspData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 2. Consulta o endpoint leve de saúde (/health) direto no IP dinâmico atual
  const consultarStatusEsp = useCallback(async (ipTarget) => {
    const target = ipTarget || activeIp;
    if (!target) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    addLog(`[ESP32] Consultando saúde em http://${target}/health...`, 'warning');
    try {
      const resposta = await fetchWithTimeout(`http://${target}/health`, {}, 2500);
      if (!resposta.ok) throw new Error('Falha na resposta do ESP32');
      const dados = await resposta.json();
      
      setEspData(dados);
      showToast('Dados obtidos do ESP32 com sucesso!', 'success');
      addLog(`[ESP32] Telemetria direta carregada via IP ${target}.`, 'success');
    } catch (e) {
      showToast(`ESP32 ${target} não respondeu. Verifique energia, rede ou IP.`, 'warning');
      addLog(`[ESP32 OFFLINE] ${target} não respondeu dentro do tempo limite.`, 'warning');
      setEspData(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeIp, addLog, showToast]);

  // 1. Busca no backend a lista de hardware contendo o IP reportado pela telemetria
  const carregarHardware = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/hardware');
      const onlines = (res.data || []).filter(h => h.ip && h.ip.trim() !== '' && h.ip !== 'OFFLINE' && h.ip !== '0.0.0.0');
      setHardwareList(onlines);

      if (onlines.length > 0) {
        const ipParaUsar = activeIp || onlines[0].ip;
        if (!activeIp) setActiveIp(ipParaUsar);
        setEspData(null);
        addLog(`[ESP32] IP ${ipParaUsar} selecionado pela telemetria. Use "ATUALIZAR STATUS" para consulta direta.`, 'info');
      } else {
        showToast('Nenhum ESP32 com IP ativo registrado na telemetria.', 'warning');
        setIsLoading(false);
      }
    } catch (e) {
      showToast('Erro ao buscar lista de hardware no backend.', 'error');
      setIsLoading(false);
    }
  }, [api, activeIp, addLog, showToast]);

  useEffect(() => {
    carregarHardware();
  }, [carregarHardware]);

  /**
   * Processa a interacao de handle select ip e atualiza a interface conforme o resultado.
   */
  const handleSelectIp = (e) => {
    const selectedIp = e.target.value;
    setActiveIp(selectedIp);
    consultarStatusEsp(selectedIp);
  };

  return (
    <div className="anim-fade-in absolute-fullscreen">
      <div className="noc-hud-grid anim-stagger-1" style={{ flexShrink: 0 }}>
        <div className="noc-hud-card" style={{ '--card-color': 'var(--theme-sec)', minHeight: 'auto' }}>
          <div className="noc-mini-header" style={{ marginBottom: '5px' }}>
            <span className="noc-kpi-title"><Network size={14}/> IP Dinâmico Atual (MQTT)</span>
          </div>
          <div className="noc-kpi-value" style={{ color: 'var(--theme-sec)', fontSize: '1.2rem' }}>
            {activeIp || 'N/A'}
          </div>
        </div>
      </div>

      <div className="anim-stagger-2" style={{ flex: 1, minHeight: 0, display: 'flex', gap: 'var(--gap-main)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
          <div className="dev-card glass-card" style={{ borderTop: '4px solid #a855f7', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="dev-card-header" style={{ color: '#a855f7', marginBottom: '15px' }}>
              <Radio size={24} /> <h3>Seleção de Dispositivo</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: 1 }}>
              <div className="form-group">
                <label style={{ color: 'var(--dim-text)', fontSize: '0.8rem', fontWeight: 'bold' }}>Equipamento / IP (Reportado via Telemetria)</label>
                <div className="config-input-wrapper" style={{ padding: '0', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                  <div style={{ padding: '0 12px', color: 'var(--theme-sec)' }}><Wifi size={18} /></div>
                  <select value={activeIp} onChange={handleSelectIp} style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', flex: 1, padding: '12px 5px', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Montserrat' }}>
                    <option value="" disabled>Selecione o ESP32 ativo...</option>
                    {hardwareList.map(hw => (
                      <option key={hw.id} value={hw.ip} style={{ background: '#0f172a' }}>
                        {hw.nome || 'ESP32'} - IP: {hw.ip}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.3)', fontSize: '0.8rem', color: '#cbd5e1' }}>
                <strong style={{ color: '#a855f7' }}>Auto-Discovery:</strong> O painel lê o IP dinâmico diretamente da tabela de hardware sincronizada pelo MQTT, sem necessidade de varreduras locais.
              </div>
              <button type="button" onClick={() => consultarStatusEsp(activeIp)} className="btn btn-primary" disabled={isLoading || !activeIp} style={{ background: '#a855f7', color: 'white', fontWeight: 'bold', marginTop: 'auto' }}>
                {isLoading ? <Loader2 size={18} className="spin" /> : <Radio size={18} />} {isLoading ? 'ATUALIZANDO...' : 'ATUALIZAR STATUS'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 2, minWidth: '400px', display: 'flex', flexDirection: 'column' }}>
          <div className="dev-card glass-card" style={{ borderTop: '4px solid var(--secondary)', flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div className="dev-card-header flex-between" style={{ color: 'var(--secondary)', padding: '1.5rem', marginBottom: 0, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Activity size={24} /> <h3>Métricas de Saúde do ESP32</h3>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-outline" onClick={carregarHardware} style={{ padding: '6px 12px', minHeight: '34px', fontSize: '0.75rem' }}>
                  <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
                </button>
              </div>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '15px', flex: 1, overflowY: 'auto' }}>
              {!espData ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--dim-text)' }}>
                  {isLoading ? 'Conectando ao dispositivo...' : 'Selecione um dispositivo com IP ativo para ver os detalhes.'}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--dim-text)', textTransform: 'uppercase' }}>Estado do Controle</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white', marginTop: '5px' }}>{espData.estado}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--dim-text)', textTransform: 'uppercase' }}>Heap Livre</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--theme-sec)', marginTop: '5px', fontFamily: 'Montserrat' }}>{espData.heap_livre} bytes</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--dim-text)', textTransform: 'uppercase' }}>Sinal Wi-Fi (RSSI)</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981', marginTop: '5px', fontFamily: 'Montserrat' }}>{espData.rssi} dBm</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--dim-text)', textTransform: 'uppercase' }}>Total de Boots / Resets</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f59e0b', marginTop: '5px', fontFamily: 'Montserrat' }}>{espData.boots} (WDT: {espData.watchdog_resets})</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// NOVA TELA: MONITOR WEB SERIAL EMBUTIDO (ABSOLUTE FULLSCREEN)
// ============================================================================
export function MonitorFisicoESP({ api }) {
  const [logs, setLogs] = useState('Aguardando inicialização da sonda de borda...');
  const [activeIp, setActiveIp] = useState('');
  const [inputIp, setInputIp] = useState('');
  const [isConectado, setIsConectado] = useState(false);
  const [hardwareList, setHardwareList] = useState([]);
  const [isFetchingHw, setIsFetchingHw] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalRef = useRef(null);
  const lastLogErrorRef = useRef('');

  const fetchHardware = useCallback(async () => {
    if (!api) return;
    setIsFetchingHw(true);
    try {
      const res = await api.get('/hardware');
      const onlines = res.data.filter(h => h.ip && h.ip.trim() !== '' && h.ip !== 'OFFLINE' && h.ip !== '0.0.0.0');
      setHardwareList(onlines);
      const ipAindaValido = onlines.some(h => h.ip === activeIp);
      if (onlines.length > 0 && (!activeIp || !ipAindaValido)) { setActiveIp(onlines[0].ip); setInputIp(onlines[0].ip); }
    } catch (error) {
      setLogs(prev => `${prev}\n[EDGE ERROR] Falha ao listar hardware online: ${error?.message || 'erro desconhecido'}`);
    } finally { setIsFetchingHw(false); }
  }, [api, activeIp]);

  useEffect(() => { fetchHardware(); }, [fetchHardware]);

  /**
   * Processa a interacao de handle select ip e atualiza a interface conforme o resultado.
   */
  const handleSelectIp = (e) => { const selectedIp = e.target.value; setInputIp(selectedIp); setActiveIp(selectedIp); };
  /**
   * Processa a interacao de handle connect manual e atualiza a interface conforme o resultado.
   */
  const handleConnectManual = () => { if (inputIp.trim() !== '') { setActiveIp(inputIp.trim()); } };

  useEffect(() => {
    if (!activeIp) return;
    let isSubscribed = true; let pollTimer = null;
    setLogs(prev => prev + `\n📡 Iniciando handshake com IP: ${activeIp}...`);
    setIsConectado(false);

    /**
     * Concentra a logica de poll logs para manter o restante do tela mais legivel.
     */
    const pollLogs = async () => {
      if (!isSubscribed) return;
      let connectedNow = false;
      try {
        const response = await fetchWithTimeout(`http://${activeIp}/logs`, {}, 2500);
        if (response.ok) {
          connectedNow = true;
          const texto = await response.text();
          if (isSubscribed) {
            lastLogErrorRef.current = '';
            setLogs(texto); setIsConectado(true);
            const term = terminalRef.current;
            if (term && autoScroll) {
              if (term.scrollHeight - term.clientHeight <= term.scrollTop + 50) {
                setTimeout(() => { if(term) term.scrollTop = term.scrollHeight; }, 50);
              }
            }
          }
        } else {
          if (isSubscribed) { setIsConectado(false); setLogs(`[ERRO HTTP ${response.status}] A rota '/logs' não foi encontrada em ${activeIp}.`); }
        }
      } catch (error) {
        if (isSubscribed) {
          const message = `[EDGE OFFLINE] ${activeIp} não respondeu dentro do tempo limite. Aguardando nova tentativa...`;
          setIsConectado(false);
          if (lastLogErrorRef.current !== message) {
            lastLogErrorRef.current = message;
            setLogs(prev => `${prev}\n${message}`);
          }
        }
      }
      if (isSubscribed) { pollTimer = setTimeout(pollLogs, connectedNow ? 2500 : 10000); }
    };
    pollLogs();
    return () => { isSubscribed = false; if (pollTimer) clearTimeout(pollTimer); };
  }, [activeIp, autoScroll]);

  /**
   * Limpa limpar logs hardware para manter o estado consistente.
   */
  const limparLogsHardware = async () => {
    if (!activeIp) return;
    try { await fetchWithTimeout(`http://${activeIp}/clear`, { method: 'POST' }, 2500); setLogs('Memória do dispositivo foi limpa com sucesso. Aguardando novos ciclos...'); } catch (e) { setLogs(`❌ Falha: O dispositivo ${activeIp} não respondeu ao comando de limpeza.`); }
  };

  /**
   * Concentra a logica de baixar logs txt para manter o restante do tela mais legivel.
   */
  const baixarLogsTxt = () => {
    const blob = new Blob([logs], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `TermoSync_EdgeLog_${activeIp.replace(/\./g, '_')}_${Date.now()}.txt`; link.click();
  };

  return (
    <div className="dev-card glass-card anim-fade-in absolute-fullscreen" style={{ borderTop: '4px solid #a855f7', padding: 0 }}>
      <div className="dev-card-header flex-between" style={{ color: '#a855f7', padding: '1.5rem 1.5rem 0 1.5rem', marginBottom: '15px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Radio size={24} /><h3 style={{ margin: 0 }}>Monitor Serial de Borda (Live Edge)</h3></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="status-badge" style={{ background: isConectado ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: isConectado ? '#10b981' : '#ef4444', border: `1px solid ${isConectado ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>{isConectado ? '● CONECTADO' : 'OFFLINE / SCANNING'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'stretch', flexShrink: 0, padding: '0 1.5rem' }}>
        <div className="config-input-wrapper" style={{ flex: 2, minWidth: '300px', padding: '0', display: 'flex', gap: '0', alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center', color: 'var(--theme-sec)' }}><Wifi size={18} /></div>
          <select value={activeIp} onChange={handleSelectIp} style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', flex: 1, padding: '12px 5px', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Montserrat' }}>
            <option value="" disabled>Auto-Discovery: Selecione um equipamento...</option>
            {hardwareList.map(hw => <option key={hw.id} value={hw.ip} style={{background: '#0f172a'}}>{hw.nome} ({hw.filial}) - IP: {hw.ip}</option> )}
          </select>
          <button type="button" onClick={fetchHardware} className="btn-icon-small" title="Escanear rede novamente" style={{ border: 'none', background: 'transparent', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRadius: 0, padding: '0 15px', height: '100%', color: '#94a3b8' }}><RefreshCw size={18} className={isFetchingHw ? 'spin' : ''} /></button>
        </div>

        <div style={{ display: 'flex', gap: '5px', flex: 1, minWidth: '250px' }}>
          <div className="config-input-wrapper" style={{ flex: 1, padding: '0 15px' }}>
            <input type="text" value={inputIp} onChange={(e) => setInputIp(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') handleConnectManual(); }} placeholder="IP manual (ex: 127.0.0.1)" style={{ fontSize: '0.9rem', width: '100%' }}/>
          </div>
          <button className="btn btn-primary" onClick={handleConnectManual} style={{ background: 'var(--theme-sec)', color: '#000', padding: '0 20px', fontWeight: 'bold' }} title="Conectar ao IP Manual"><Plug size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" onClick={baixarLogsTxt} title="Exportar log para TXT" style={{ padding: '0 15px', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}><DownloadCloud size={18} /></button>
          <button className="btn btn-outline danger-text" onClick={limparLogsHardware} title="Limpar Memória RAM do Equipamento" style={{ padding: '0 15px' }}><Eraser size={18} /></button>
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 1.5rem 1.5rem 1.5rem' }}>
        <div style={{ position: 'absolute', top: '15px', right: '35px', zIndex: 10 }}>
          <button onClick={() => setAutoScroll(!autoScroll)} style={{ background: autoScroll ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: autoScroll ? '#10b981' : '#f59e0b', border: `1px solid ${autoScroll ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`, padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
            {autoScroll ? <PauseCircle size={14} /> : <PlayCircle size={14} />}{autoScroll ? 'AUTO-SCROLL: ON' : 'PAUSADO'}
          </button>
        </div>

        <div className="crt-terminal" ref={terminalRef} style={{ flex: 1, background: '#000', border: '1px solid var(--border-focus)', borderRadius: '12px', padding: '25px', overflowY: 'auto', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.9)' }}>
          <pre style={{ margin: 0, color: isConectado ? '#cbd5e1' : '#fca5a5', fontFamily: 'Montserrat, Courier New, monospace', fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '1.5' }}>
            {logs}
          </pre>
        </div>
      </div>

    </div>
  );
}
