/**
 * Módulo: frontend/src/pages/PainelDesenvolvedor/PainelDesenvolvedor.jsx
 * Responsabilidade: Implementa a tela Painel Desenvolvedor, seus estados, interações e integrações de dados.
 */

import { Box, ChevronLeft, ChevronRight, Gauge, ListChecks, LogOut, PackageCheck, UploadCloud } from 'lucide-react';
import LiveFirehose from './LiveFirehose';
import NetworkProbe from './NetworkProbe';
import SerialEdgeMonitor from './SerialEdgeMonitor';
import { createPortal } from 'react-dom';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ShieldAlert, Database, Cpu, Power, Settings2, Activity,
  Server, History, FileText,
  DollarSign, Building2, ActivitySquare, Terminal, RefreshCw, Mail,
  Key, UserCheck, LineChart, ShieldCheck, Fingerprint as FingerprintIcon,
  UserX, Clock, PieChart, FileSpreadsheet, Unlock, CheckCircle2,
  AlertTriangle, DownloadCloud, Calendar, Percent, Banknote,
  Eraser, Network, Copy, Check, AlertOctagon, Loader2,
  Receipt, Cloud, HardDrive, Radio, ServerCrash,
  AlertCircle, Wifi, Users,
  UserPlus, UserCog, LockKeyhole, MonitorSmartphone,
  Search, ShieldBan, Save, Target, X, Rocket, GitCommit,
  Trash2, Filter, CalendarMinus, Plug, PauseCircle, PlayCircle
} from 'lucide-react';

import { AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, YAxis, BarChart, Bar, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './PainelDesenvolvedor.css';
import GestaoEmpresas from '../GestaoEmpresas/GestaoEmpresas';
import TermoSyncLogo from '../../components/TermoSyncLogo.jsx';

/**
 * Renderiza a tela Painel Desenvolvedor e concentra as regras de apresentacao desse modulo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador; troca eventos em tempo real
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.abaAtiva - Propriedade abaAtiva usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isDevAuthenticated - Sinalizador isDevAuthenticated que controla este comportamento visual.
 * @param {Function} props.onAuthenticate - Callback onAuthenticate fornecido pelo componente responsável.
 * @param {Function} props.onLogout - Callback onLogout fornecido pelo componente responsável.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.sysConfig - Propriedade sysConfig usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.updateSysConfig - Propriedade updateSysConfig usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.tocarAlarme - Propriedade tocarAlarme usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.usuariosLista - Propriedade usuariosLista usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filiaisDb - Propriedade filiaisDb usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.navigationCatalog - Propriedade navigationCatalog usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function PainelDesenvolvedor({ api, socket, abaAtiva, isDevAuthenticated, onAuthenticate, onLogout, showToast, sysConfig, updateSysConfig, tocarAlarme: _tocarAlarme, usuariosLista, filiaisDb, setModalConfig, navigationCatalog = [] }) {
  // Container mestre do modo DEV. Ele autentica o terminal root e roteia as
  // subtelas internas de NOC, SOC, SaaS, Billing, SQL, Edge e atualizações.
  const [, setTerminalLogs] = useState(() => [
    { time: new Date().toLocaleTimeString('pt-BR'), text: 'Sessão Master estabelecida. SysAdmin conectado.', status: 'success' }
  ]);
  const [isOverclocked, setIsOverclocked] = useState(false);
  const [ticketsSuporteAbertos, setTicketsSuporteAbertos] = useState(0);
  const [rootPasscode, setRootPasscode] = useState('');
  const [rootError, setRootError] = useState('');
  const [isVerifyingRoot, setIsVerifyingRoot] = useState(false);


  /**
   * Processa a interacao de handle root access e atualiza a interface conforme o resultado.
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
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleRootAccess = async (event) => {
    event.preventDefault();
    if (!rootPasscode.trim() || isVerifyingRoot) return;
    setIsVerifyingRoot(true);
    setRootError('');
    try {
      const response = await api.post('/system/verify-root-passcode', { passcode: rootPasscode.trim() });
      if (!response.data?.success) throw new Error('Credencial ROOT invalida.');
      setRootPasscode('');
      onAuthenticate();
    } catch (error) {
      setRootError(error.response?.data?.error || 'Nao foi possivel validar a credencial ROOT.');
    } finally {
      setIsVerifyingRoot(false);
    }
  };

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
    const refreshSupportTickets = () => carregarTicketsSuporte();
    socket.on('atualizacao_dados', refreshSupportTickets);
    return () => socket.off('atualizacao_dados', refreshSupportTickets);
  }, [socket, carregarTicketsSuporte]);

  if (!isDevAuthenticated) {
    return (
      <form className="dev-access" onSubmit={handleRootAccess}>
        <LockKeyhole size={28} aria-hidden="true" />
        <h2>Controle do sistema</h2>
        <p>Informe a credencial ROOT para acessar os controles de desenvolvimento.</p>
        <label htmlFor="dev-root-passcode">Credencial ROOT</label>
        <input
          id="dev-root-passcode"
          type="password"
          autoComplete="off"
          value={rootPasscode}
          onChange={(event) => { setRootPasscode(event.target.value); setRootError(''); }}
          disabled={isVerifyingRoot}
        />
        {rootError && <p className="dev-access-error" role="alert">{rootError}</p>}
        <button type="submit" className="btn btn-primary" disabled={!rootPasscode.trim() || isVerifyingRoot}>
          {isVerifyingRoot ? <Loader2 size={18} className="spin" /> : <Unlock size={18} />}
          {isVerifyingRoot ? 'Validando...' : 'Acessar controle'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onLogout}>
          <LogOut size={18} /> Sair da conta
        </button>
      </form>
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

      <div className="dev-os-workspace">
        <div className="dev-os-content" style={{ position: 'relative' }}>
          {abaAtiva === 'empresas' && <GestaoEmpresas api={api} socket={socket} showToast={showToast} setModalConfig={setModalConfig} />}
          {abaAtiva === 'dev_panel' && <TelaNOC api={api} showToast={showToast} sysConfig={sysConfig} updateSysConfig={updateSysConfig} usuariosLista={usuariosLista} filiaisDb={filiaisDb} addLog={addLog} setModalConfig={setModalConfig} isOverclocked={isOverclocked} setIsOverclocked={setIsOverclocked} navigationCatalog={navigationCatalog} />}
          {abaAtiva === 'saas' && <TelaSaaS api={api} sysConfig={sysConfig} updateSysConfig={updateSysConfig} showToast={showToast} addLog={addLog} setModalConfig={setModalConfig} />}
          {abaAtiva === 'billing' && <TelaBilling api={api} socket={socket} sysConfig={sysConfig} filiaisDb={filiaisDb} showToast={showToast} addLog={addLog} updateSysConfig={updateSysConfig} setModalConfig={setModalConfig} />}
          {abaAtiva === 'system' && <TelaSistema api={api} socket={socket} showToast={showToast} addLog={addLog} sysConfig={sysConfig} updateSysConfig={updateSysConfig} usuariosLista={usuariosLista} setModalConfig={setModalConfig} />}
          {abaAtiva === 'soc' && <TelaSOC api={api} showToast={showToast} addLog={addLog} setModalConfig={setModalConfig} usuariosLista={usuariosLista} />}
          {abaAtiva === 'bi' && <TelaBI api={api} showToast={showToast} addLog={addLog} sysConfig={sysConfig} filiaisDb={filiaisDb} />}
          {abaAtiva === 'atualizacoes' && <TelaAtualizacoes api={api} showToast={showToast} addLog={addLog} setModalConfig={setModalConfig} isOverclocked={isOverclocked} />}
          {abaAtiva === 'sql_terminal' && <TelaTerminalSQL api={api} showToast={showToast} addLog={addLog} />}
          {abaAtiva === 'websocket_stream' && <LiveFirehose socket={socket} addLog={addLog} showToast={showToast} />}
          {abaAtiva === 'network_scanner' && <NetworkProbe api={api} socket={socket} showToast={showToast} addLog={addLog} setModalConfig={setModalConfig} filiais={filiaisDb} />}
          {abaAtiva === 'monitor_edge' && <SerialEdgeMonitor api={api} socket={socket} showToast={showToast} setModalConfig={setModalConfig} />}
        </div>
      </div>
    </div>
  );
}

/**
 * Componente auxiliar de Gráficos Minimizados
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.dataKey - Propriedade dataKey usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.color - Propriedade color usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.data - Propriedade data usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function RenderSparkline({ dataKey, color, data }) {
  // Mini gráfico usado nos painéis DEV para mostrar tendência sem ocupar espaço.
  return (
    <div className="sparkline-box">
      <ResponsiveContainer width="100%" height={40} minWidth={0}>
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
 * Busca ou monta os dados de get cluster node position usados no fluxo atual.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {number} index - Posição do item dentro da coleção atual.
 * @param {unknown} total - Valor de total consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const getClusterNodePosition = (index, total) => {
  const safeTotal = Math.max(total, 1);
  /**
   * Concentra a logica de angle para manter o restante do tela mais legivel.
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
  const angle = ((index + 1) / safeTotal) * Math.PI * 2 - (Math.PI / 2);
  return {
    top: `${50 + Math.sin(angle) * 32}%`,
    left: `${50 + Math.cos(angle) * 36}%`
  };
};


/**
 * Gera build cluster nodes com os dados necessarios para o proximo passo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} filiais - Valor de filiais consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const buildClusterNodes = (filiais = []) => {
  const nodes = [{ id: 'master', name: 'sa-east-1a (Master Core)', role: 'BD Primário & API', status: 'online', pos: { top: '50%', left: '50%' }, ping: 10 }];

  if (filiais.length > 0) {
    filiais.forEach((filial, index) => {
      nodes.push({
        id: `edge-${index}`,
        name: `Edge: ${filial}`,
        role: 'Escopo operacional configurado',
        status: 'configured',
        pos: getClusterNodePosition(index, filiais.length),
        ping: null
      });
    });
  }
  return nodes;
};

/**
 * ============================================================================ TELA NOC
 * (Network Operations Center) - COM TOPOLOGIA DINÂMICA
 * ============================================================================
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador; publica ou consome mensagens MQTT
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.sysConfig - Propriedade sysConfig usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.updateSysConfig - Propriedade updateSysConfig usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.usuariosLista - Propriedade usuariosLista usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.filiaisDb - Propriedade filiaisDb usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.addLog - Propriedade addLog usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @param {boolean} options.isOverclocked - Sinalizador isOverclocked que controla este comportamento visual.
 * @param {unknown} options.setIsOverclocked - Propriedade setIsOverclocked usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.navigationCatalog - Propriedade navigationCatalog usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const TelaNOC = ({ api, showToast, sysConfig, updateSysConfig, usuariosLista, filiaisDb, addLog, setModalConfig, isOverclocked, setIsOverclocked, navigationCatalog = [] }) => {
  // Central de comando do desenvolvedor: concentra políticas globais, matriz de
  // UI por papel/usuário e métricas reais da API de saúde.
  const [scopeType, setScopeType] = useState('ROLE');
  const [activeScope, setActiveScope] = useState('GLOBAL');
  const [metrics, setMetrics] = useState({ cpu: 0, ram: 0, ping: 0, reqs: 0, dbQps: 0, bandwidth: 0 });
  const [metricHistory, setMetricHistory] = useState(Array.from({ length: 20 }, () => ({ time: '', cpu: 0, ram: 0, bw: 0, db: 0 })));
  const [apiTraffic, setApiTraffic] = useState([]);
  const [threats, setThreats] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [latencyData, setLatencyData] = useState([]);
  const [health, setHealth] = useState(null);
  const [healthHistory, setHealthHistory] = useState([]);
  const [hostInfo, setHostInfo] = useState(null);
  const [securityStatus, setSecurityStatus] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const initialClusterNodes = useMemo(() => buildClusterNodes(filiaisDb || []), [filiaisDb]);
  const [clusterNodes, setClusterNodes] = useState(initialClusterNodes);
  const [actionLoading, setActionLoading] = useState(null);

  const trafficContainerRef = useRef(null);
  const wafContainerRef = useRef(null);
  const incidentsContainerRef = useRef(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setClusterNodes(initialClusterNodes);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [initialClusterNodes]);

  const carregarControle = useCallback(async ({ manual = false } = {}) => {
    if (manual) setLoadingHealth(true);
    const startedAt = performance.now();
    try {
      const response = await api.get('/system/health', { validateStatus: status => status === 200 || status === 503 });
      const snapshot = response.data || {};
      const cpu = Math.round(Number(snapshot.cpuPercent || 0));
      const ram = snapshot.memory?.heapTotalMb
        ? Math.round((Number(snapshot.memory.heapUsedMb || 0) / Number(snapshot.memory.heapTotalMb)) * 100)
        : 0;
      const eventLoop = Math.round(Number(snapshot.eventLoopUtilization || 0));
      const dbLatency = Math.round(Number(snapshot.databaseLatencyMs || 0));
      const responseTime = Math.max(0, Math.round(performance.now() - startedAt));
      const nextMetrics = {
        cpu,
        ram,
        ping: dbLatency,
        reqs: Number(snapshot.runtime?.activeRequests || 0),
        dbQps: Number(snapshot.runtime?.activeHandles || 0),
        bandwidth: eventLoop
      };
      const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setHealth(snapshot);
      setMetrics(nextMetrics);
      setLastSyncAt(new Date());
      setMetricHistory(previous => [...previous.slice(-29), { time, cpu, ram, bw: eventLoop, db: dbLatency }]);
      setLatencyData([
        { range: 'CPU', count: cpu },
        { range: 'Heap', count: ram },
        { range: 'Event loop', count: eventLoop },
        { range: 'DB ms', count: Math.min(100, dbLatency) },
        { range: 'Resposta', count: Math.min(100, responseTime) }
      ]);
      setApiTraffic(previous => [...previous.slice(-19), {
        id: `${Date.now()}-${responseTime}`,
        method: 'HEALTH',
        color: snapshot.ok ? 'var(--success)' : 'var(--danger)',
        route: '/api/system/health',
        geo: `${responseTime}ms`,
        ip: snapshot.runtime?.nodeVersion || 'Node.js'
      }]);
      setClusterNodes(previous => previous.map(node => ({
        ...node,
        status: node.id === 'master' ? (snapshot.ok ? 'online' : 'degraded') : 'configured',
        ping: node.id === 'master' ? dbLatency : null
      })));

      const detectedIssues = [];
      if (!snapshot.ok) detectedIssues.push('API reportou estado degradado.');
      if (snapshot.database !== 'online') detectedIssues.push('Banco de dados indisponível.');
      if (eventLoop >= 80) detectedIssues.push(`Event loop em ${eventLoop}%.`);
      if (cpu >= 85) detectedIssues.push(`CPU em ${cpu}%.`);
      if (dbLatency >= 200) detectedIssues.push(`Latência do banco em ${dbLatency}ms.`);
      setThreats(detectedIssues.map((text, index) => ({ id: `${Date.now()}-${index}`, text: `[DIAGNÓSTICO] ${text}` })));
      setIncidents(detectedIssues.map((msg, index) => ({ id: `${Date.now()}-${index}`, msg, type: snapshot.ok ? 'warning' : 'critical', time })));

      if (manual) {
        addLog(`[CONTROLE] Diagnóstico atualizado em ${responseTime}ms.`, 'success');
        showToast('Diagnóstico do controle atualizado.', 'success');
      }
    } catch (error) {
      const time = new Date().toLocaleTimeString('pt-BR');
      setHealth({ ok: false, status: 'offline', database: 'offline', mqtt: 'unknown' });
      setThreats([{ id: Date.now(), text: `[DIAGNÓSTICO] API indisponível: ${error.message}` }]);
      setIncidents([{ id: Date.now(), msg: 'Não foi possível consultar a saúde da plataforma.', type: 'critical', time }]);
      if (manual) showToast('Falha ao atualizar o diagnóstico.', 'error');
    } finally {
      if (manual) setLoadingHealth(false);
    }
  }, [api, addLog, showToast]);

  const carregarInventario = useCallback(async ({ manual = false } = {}) => {
    if (manual) setLoadingInventory(true);
    const [historyResult, hostResult, securityResult, sessionsResult] = await Promise.allSettled([
      api.get('/system/health/history?minutes=60&limit=180'),
      api.get('/system/host-info'),
      api.get('/security/status'),
      api.get('/soc/sessoes')
    ]);

    if (historyResult.status === 'fulfilled') {
      const samples = Array.isArray(historyResult.value.data?.samples) ? historyResult.value.data.samples : [];
      setHealthHistory(samples);
      const chartSamples = samples.slice(0, 30).reverse().map(sample => ({
        time: new Date(sample.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        cpu: Number(sample.cpuPercent || 0),
        ram: sample.memory?.heapTotalMb ? Math.round((Number(sample.memory.heapUsedMb || 0) / Number(sample.memory.heapTotalMb)) * 100) : 0,
        bw: Number(sample.eventLoopUtilization || 0),
        db: Number(sample.databaseLatencyMs || 0)
      }));
      if (chartSamples.length) setMetricHistory(chartSamples);
    }
    if (hostResult.status === 'fulfilled') setHostInfo(hostResult.value.data?.success ? hostResult.value.data : null);
    if (securityResult.status === 'fulfilled') setSecurityStatus(securityResult.value.data || null);
    if (sessionsResult.status === 'fulfilled') setActiveSessions(Array.isArray(sessionsResult.value.data) ? sessionsResult.value.data : []);

    if (manual) {
      const failed = [historyResult, hostResult, securityResult, sessionsResult].filter(result => result.status === 'rejected').length;
      addLog(`[CONTROLE] Inventário atualizado com ${failed} falha(s) de dependência.`, failed ? 'warning' : 'success');
      if (failed) showToast(`${failed} fonte(s) do inventário não responderam.`, 'warning');
      setLoadingInventory(false);
    }
  }, [api, addLog, showToast]);

  useEffect(() => {
    carregarControle();
    const intervalId = window.setInterval(() => carregarControle(), isOverclocked ? 2000 : 5000);
    return () => window.clearInterval(intervalId);
  }, [carregarControle, isOverclocked]);

  useEffect(() => {
    carregarInventario();
    const intervalId = window.setInterval(() => carregarInventario(), 30000);
    return () => window.clearInterval(intervalId);
  }, [carregarInventario]);

  useEffect(() => { if (trafficContainerRef.current) trafficContainerRef.current.scrollTop = trafficContainerRef.current.scrollHeight; }, [apiTraffic]);
  useEffect(() => { if (wafContainerRef.current) wafContainerRef.current.scrollTop = wafContainerRef.current.scrollHeight; }, [threats]);
  useEffect(() => { if (incidentsContainerRef.current) incidentsContainerRef.current.scrollTop = incidentsContainerRef.current.scrollHeight; }, [incidents]);

  const effectiveScope = useMemo(() => {
    if (scopeType === 'ROLE') {
      const roleScopes = ['GLOBAL', 'ADMIN', 'LOJA', 'MANUTENCAO'];
      return roleScopes.includes(activeScope) ? activeScope : 'GLOBAL';
    }
     /**
      * Concentra a logica de usuarios elegiveis para manter o restante do tela mais legivel.
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
     * Concentra a logica de usuarios elegiveis para manter o restante do tela mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const usuariosElegiveis = (usuariosLista || []).filter((u) => u.role !== 'DEV');
    if (activeScope && usuariosElegiveis.some(u => u.usuario === activeScope)) return activeScope;
    return usuariosElegiveis?.[0]?.usuario || '';
  }, [scopeType, activeScope, usuariosLista]);
   /**
    * Concentra a logica de regras ativas para manter o restante do tela mais legivel.
    *
    * Responsabilidade: mantém este comportamento isolado para que validação,
    * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
    *
    * Fluxo principal:
    * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
    *
    * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
    *
    * @param {unknown} scopeType - Valor de scope type consumido por esta rotina.
    * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
    * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
    */

  /**
   * Concentra a logica de regras ativas para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} scopeType - Valor de scope type consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const regrasAtivas = (scopeType === 'USER' ? sysConfig?.regras?.USERS?.[effectiveScope] : sysConfig?.regras?.[effectiveScope]) || { modulosOcultos: [], features: {} };


  /**
   * Processa a interacao de handle toggle modulo e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleToggleModulo = (id) => {
    updateSysConfig(scopeType, effectiveScope, 'modulosOcultos', id);
    addLog(`[MATRIZ_UI] Módulo '${id}' reconfigurado.`, 'warning');
  };


  /**
   * Executa executar acao emergencia coordenando as etapas principais desse fluxo.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
   *
   * @param {unknown} acao - Valor de acao consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const executarAcaoEmergencia = async (acao) => {
    setActionLoading(acao);
    if (acao === 'ATUALIZAR DIAGNÓSTICO') {
      await Promise.all([carregarControle({ manual: true }), carregarInventario({ manual: true })]);
    } else {
      setApiTraffic([]);
      setThreats([]);
      setIncidents([]);
      addLog('[CONTROLE] Eventos locais do console limpos.', 'warning');
      showToast('Eventos locais limpos.', 'success');
    }
    window.setTimeout(() => {
      setActionLoading(null);
    }, 250);
  };


  /**
   * Processa a interacao de handle toggle overclock e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleToggleOverclock = () => {
    setIsOverclocked(!isOverclocked);
    addLog(isOverclocked ? '[CONTROLE] Diagnóstico intensivo desativado.' : '[CONTROLE] Diagnóstico intensivo ativado (2s).', isOverclocked ? 'success' : 'warning');
    showToast(isOverclocked ? 'Atualização normal restaurada.' : 'Diagnóstico intensivo ativado.', isOverclocked ? 'success' : 'warning');
  };


  /**
   * Processa a interacao de copiar diagnostico e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: publica ou consome mensagens MQTT
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copiarDiagnostico = async () => {
    const diagnostic = [
      `TermoSync Controle - ${new Date().toLocaleString('pt-BR')}`,
      `API: ${health?.status || 'indisponível'} | DB: ${health?.database || 'indisponível'} | MQTT: ${health?.mqtt || 'indisponível'}`,
      `CPU: ${metrics.cpu}% | Heap: ${metrics.ram}% | Event loop: ${metrics.bandwidth}% | DB: ${metrics.ping}ms`,
      `Node: ${hostInfo?.runtime?.nodeVersion || health?.runtime?.nodeVersion || 'N/A'} | PID: ${hostInfo?.runtime?.pid || health?.runtime?.pid || 'N/A'}`,
      `Sessões: ${activeSessions.length} | Socket clients: ${health?.runtime?.socketClients || 0}`,
      `Segurança: ${(securityStatus?.checks || []).filter(check => check.ok).length}/${securityStatus?.checks?.length || 0} verificações aprovadas`
    ].join('\n');
    try {
      await navigator.clipboard.writeText(diagnostic);
      showToast('Diagnóstico copiado.', 'success');
    } catch {
      showToast('Não foi possível copiar o diagnóstico.', 'error');
    }
  };


  /**
   * Processa a interacao de confirmar manutencao e atualiza a interface conforme o resultado.
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
  const confirmarManutencao = () => {
    const maintenanceActive = sysConfig?.maintenanceMode === true;
    const noticePublished = !maintenanceActive && sysConfig?.maintenanceNoticeActive === true;
    const action = maintenanceActive ? 'finish' : noticePublished ? 'activate' : 'announce';
    setModalConfig({
      isOpen: true,
      title: action === 'announce' ? 'Publicar aviso de manutenção' : action === 'activate' ? 'Entrar em manutenção' : 'Encerrar manutenção',
      message: action === 'announce'
        ? 'Escreva o aviso que aparecerá em todas as telas. Nesta etapa ninguém será desconectado.'
        : action === 'activate'
          ? `O aviso já foi publicado: “${sysConfig?.maintenanceMessage}”. Ao continuar, as sessões dos usuários serão encerradas.`
          : 'O aviso será removido e a operação normal será restaurada. Confirmar?',
      isPrompt: action === 'announce',
      promptValue: action === 'announce' ? (sysConfig?.maintenanceMessage || '') : '',
      promptPlaceholder: 'Ex.: Manutenção programada até 22h para atualização do servidor.',
      promptMaxLength: 280,
      requirePrompt: action === 'announce',
      confirmLabel: action === 'announce' ? 'Publicar aviso' : action === 'activate' ? 'Entrar em manutenção' : 'Encerrar manutenção',
      onConfirm: (message) => {
        const maintenanceMessage = String(message || '').trim();
        if (action === 'announce' && !maintenanceMessage) {
          showToast('Informe a mensagem de manutenção.', 'warning');
          return;
        }
        if (action === 'announce') {
          updateSysConfig('ROLE', 'GLOBAL', 'maintenanceNotice', maintenanceMessage, true);
          showToast('Aviso publicado. Os usuários continuam conectados.', 'success');
          return;
        }
        if (action === 'activate') {
          updateSysConfig('ROLE', 'GLOBAL', 'maintenanceMode', sysConfig?.maintenanceMessage, true);
          showToast('Modo manutenção ativado. As sessões dos usuários serão encerradas.', 'warning');
          return;
        }
        updateSysConfig('ROLE', 'GLOBAL', 'maintenanceMode', null, false);
        showToast('Modo manutenção encerrado.', 'success');
      }
    });
  };

  const TODOS_MODULOS = useMemo(() => {
    const fallbackModules = [
      { id: 'dashboard', label: 'Dashboard Operacional', type: 'Operacional', roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'] },
      { id: 'assistente', label: 'Assistente de Operação', type: 'Operacional', roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'] },
      { id: 'chamados', label: 'Chamados', type: 'Manutenção', roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'] },
      { id: 'equipamentos', label: 'Equipamentos', type: 'Manutenção', roles: ['ADMIN', 'MANUTENCAO', 'DEV'] },
      { id: 'usuarios', label: 'Identidades e Acessos', type: 'Administração', roles: ['ADMIN', 'DEV'] }
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

  const defconLevel = !health ? 'CARREGANDO' : (!health.ok ? 'CRÍTICO' : (threats.length ? 'ATENÇÃO' : 'SEGURO'));
  const colorPrimary = health?.ok === false ? 'var(--danger)' : 'var(--success)';
  const colorSec = metrics.bandwidth >= 80 ? 'var(--warning)' : 'var(--info)';
  const defconColor = !health?.ok ? 'var(--danger)' : (threats.length ? 'var(--warning)' : 'var(--success)');
  const securityChecks = securityStatus?.checks || [];
  const securityMetrics = securityStatus?.metrics || {};
  const approvedSecurityChecks = securityChecks.filter(check => check.ok).length;
  const hostMemoryPercent = hostInfo?.memory?.totalMB
    ? Math.round(((hostInfo.memory.totalMB - hostInfo.memory.freeMB) / hostInfo.memory.totalMB) * 100)
    : 0;

  /**
   * Formata format duration para exibicao segura na interface.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} seconds - Valor de seconds consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const formatDuration = (seconds = 0) => {
    const totalMinutes = Math.floor(Number(seconds) / 60);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    return days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}min`;
  };
  const capacityMetrics = [
    { label: 'CPU do processo', value: metrics.cpu, detail: `${metrics.cpu}%`, tone: metrics.cpu >= 85 ? 'danger' : metrics.cpu >= 65 ? 'warning' : 'ok' },
    { label: 'Heap do Node', value: metrics.ram, detail: `${metrics.ram}%`, tone: metrics.ram >= 85 ? 'danger' : metrics.ram >= 70 ? 'warning' : 'ok' },
    { label: 'Event loop', value: metrics.bandwidth, detail: `${metrics.bandwidth}%`, tone: metrics.bandwidth >= 80 ? 'danger' : metrics.bandwidth >= 60 ? 'warning' : 'ok' },
    { label: 'Memória do host', value: hostMemoryPercent, detail: `${hostMemoryPercent}%`, tone: hostMemoryPercent >= 90 ? 'danger' : hostMemoryPercent >= 75 ? 'warning' : 'ok' }
  ];
  const dependencyRows = [
    { label: 'API HTTP', status: health?.status || 'unknown', meta: `${health?.runtime?.activeRequests || 0} requisições ativas` },
    { label: 'MySQL', status: health?.database || 'unknown', meta: `${metrics.ping}ms de latência` },
    { label: 'Broker MQTT', status: health?.mqtt || 'unknown', meta: 'ingestão de telemetria' },
    { label: 'WhatsApp', status: health?.whatsapp || health?.whatsappStatus || 'unknown', meta: 'canal de mensagens' },
    { label: 'Socket.IO', status: health?.ok ? 'online' : 'unknown', meta: `${health?.runtime?.socketClients || 0} cliente(s)` }
  ];

  /**
   * Busca ou monta os dados de get status tone usados no fluxo atual.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} status - Valor de status consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const getStatusTone = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (['online', 'connected', 'healthy', 'ok', 'ready'].includes(normalized)) return 'ok';
    if (['offline', 'error', 'failed', 'degraded'].includes(normalized)) return 'danger';
    return 'warning';
  };

  return (
    <div className="noc-dashboard-wrapper dev-tela-scroll control-screen">
      <div className="noc-defcon-bar anim-stagger-1">
        <div className="defcon-title"><TermoSyncLogo size={18} color={defconColor} /> CONTROLE DA PLATAFORMA</div>
        <div className="defcon-status-group">
          <button className="btn btn-outline" style={{ padding: '4px 12px', minHeight: 'auto', fontSize: '0.7rem', color: isOverclocked ? 'var(--warning)' : 'white', borderColor: isOverclocked ? 'var(--warning)' : 'rgba(255,255,255,0.2)' }} onClick={handleToggleOverclock}>
             <Activity size={14} style={{ marginRight: '6px' }}/> {isOverclocked ? 'DESATIVAR MODO INTENSIVO' : 'DIAGNÓSTICO INTENSIVO'}
          </button>
          <div className="defcon-badge" style={{ color: colorPrimary, borderColor: colorPrimary }}><Wifi size={14} /> API: {health?.status || 'CONSULTANDO'}</div>
          <div className="defcon-badge" style={{ color: colorSec, borderColor: colorSec }}><Clock size={14} /> {lastSyncAt ? lastSyncAt.toLocaleTimeString('pt-BR') : '--:--:--'}</div>
          <div className="defcon-badge" style={{ color: defconColor, borderColor: defconColor }}><ShieldAlert size={14} /> ESTADO: {defconLevel}</div>
        </div>
      </div>

      <div className="noc-hud-grid anim-stagger-1">
        <div className="noc-hud-card" style={{'--card-color': colorPrimary}}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><Cpu size={14}/> CPU DO PROCESSO</span></div>
          <div className="noc-kpi-value">{metrics.cpu}<span className="noc-kpi-unit">%</span></div>
          <RenderSparkline dataKey="cpu" color={colorPrimary} data={metricHistory} />
        </div>
        <div className="noc-hud-card" style={{'--card-color': colorSec}}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><HardDrive size={14}/> HEAP DO NODE</span></div>
          <div className="noc-kpi-value" style={{color: colorSec}}>{metrics.ram}<span className="noc-kpi-unit">%</span></div>
          <RenderSparkline dataKey="ram" color={colorSec} data={metricHistory} />
        </div>
        <div className="noc-hud-card" style={{'--card-color': colorSec}}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><Activity size={14}/> EVENT LOOP</span></div>
          <div className="noc-kpi-value" style={{color: colorSec}}>{metrics.bandwidth}<span className="noc-kpi-unit">%</span></div>
          <RenderSparkline dataKey="bw" color={colorSec} data={metricHistory} />
        </div>
        <div className="noc-hud-card" style={{'--card-color': 'var(--accent-violet)'}}>
          <div className="noc-mini-header"><span className="noc-kpi-title"><Database size={14}/> LATÊNCIA DO BANCO</span></div>
          <div className="noc-kpi-value" style={{color: 'var(--accent-violet)'}}>{metrics.ping}<span className="noc-kpi-unit">ms</span></div>
          <RenderSparkline dataKey="db" color="var(--accent-violet)" data={metricHistory} />
        </div>
      </div>

      <div className="noc-main-grid anim-stagger-2">
        <div className="cyber-panel">
          <div className="cyber-panel-header glitch-hover">
             <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>Runtime da aplicação</div>
             <span style={{ fontSize: '0.8rem', color: '#000', fontWeight: 'bold', fontFamily: 'Montserrat', background: 'var(--theme-main)', padding: '4px 10px', borderRadius: '6px' }}>{metrics.reqs} REQUESTS ATIVAS</span>
          </div>
          <div className="noc-chart-grid">
            <div className="noc-chart-box">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                <AreaChart data={metricHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCpuBig" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={colorPrimary} stopOpacity={0.6}/><stop offset="95%" stopColor={colorPrimary} stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorRamBig" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={colorSec} stopOpacity={0.6}/><stop offset="95%" stopColor={colorSec} stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0', color: 'white', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="cpu" stroke={colorPrimary} strokeWidth={2} fillOpacity={1} fill="url(#colorCpuBig)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="ram" stroke={colorSec} strokeWidth={2} fillOpacity={1} fill="url(#colorRamBig)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="noc-histogram-box">
               <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Pressão atual dos recursos</span>
               <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                <BarChart data={latencyData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {latencyData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={index > 2 ? 'var(--danger)' : colorSec} /> ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="cyber-panel">
          <div className="cyber-panel-header"><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Target size={18} /> Escopos operacionais</div></div>
          <div className="cluster-topology-grid">
            {clusterNodes.map(node => {
              const nodeColor = node.status === 'online' ? colorPrimary : (node.status === 'configured' ? colorSec : 'var(--danger)');
              return (
              <div key={node.id} className="cluster-data-block" style={{'--status-color': nodeColor}}>
                <div className="block-header">
                  <span className="block-name"><Server size={14} color="var(--status-color)"/> {node.name}</span>
                  <span className="block-ping" style={{ color: 'var(--status-color)' }}>{node.ping == null ? 'CONFIGURADO' : `${node.ping}ms`}</span>
                </div>
                <span className="block-role" style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{node.role}</span>
              </div>
              );
            })}
          </div>
          <div className="radar-container">
            <div className="radar-grid"></div><div className="radar-sweep"></div>
            {clusterNodes.map((node, i) => (
              <div key={node.id} className="radar-node" data-tooltip={`${node.name}: ${node.ping == null ? 'escopo configurado' : `${node.ping}ms`}`} style={{ top: node.pos.top, left: node.pos.left, background: node.id === 'master' ? colorPrimary : colorSec, boxShadow: node.id === 'master' ? `0 0 15px ${colorPrimary}` : `0 0 10px ${colorSec}`, animation: node.id === 'master' ? 'none' : `blink 2s infinite ${i * 0.5}s` }}></div>
            ))}
          </div>
        </div>
      </div>

      <div className="control-engineering-grid anim-stagger-2">
        <section className="control-engineering-panel">
          <div className="control-panel-heading"><Server size={15}/><span>Runtime e host</span></div>
          <div className="control-fact-grid">
            <div className="control-fact"><span>Hostname</span><strong title={hostInfo?.os?.hostname}>{hostInfo?.os?.hostname || 'Indisponível'}</strong></div>
            <div className="control-fact"><span>Ambiente</span><strong>{hostInfo?.runtime?.environment || 'N/A'}</strong></div>
            <div className="control-fact"><span>Node.js</span><strong>{hostInfo?.runtime?.nodeVersion || health?.runtime?.nodeVersion || 'N/A'}</strong></div>
            <div className="control-fact"><span>PID</span><strong>{hostInfo?.runtime?.pid || health?.runtime?.pid || 'N/A'}</strong></div>
            <div className="control-fact"><span>Sistema</span><strong>{hostInfo?.os ? `${hostInfo.os.type} ${hostInfo.os.release}` : 'N/A'}</strong></div>
            <div className="control-fact"><span>Arquitetura</span><strong>{hostInfo?.os?.arch || 'N/A'}</strong></div>
            <div className="control-fact"><span>CPU lógica</span><strong>{hostInfo?.cpu?.cores ? `${hostInfo.cpu.cores} núcleos` : 'N/A'}</strong></div>
            <div className="control-fact"><span>Uptime host</span><strong>{hostInfo?.uptimeSeconds ? formatDuration(hostInfo.uptimeSeconds) : 'N/A'}</strong></div>
          </div>
        </section>

        <section className="control-engineering-panel">
          <div className="control-panel-heading"><ShieldCheck size={15}/><span>Postura de segurança</span><strong className={`control-heading-score ${securityStatus?.ok ? 'ok' : 'warning'}`}>{approvedSecurityChecks}/{securityChecks.length}</strong></div>
          <div className="control-security-summary">
            <div><strong>{securityMetrics.activeSessions || 0}</strong><span>Sessões ativas</span></div>
            <div><strong>{securityMetrics.failedLogins24h || 0}</strong><span>Falhas 24h</span></div>
            <div><strong>{securityMetrics.mfaEnabled || 0}/{securityMetrics.usersTotal || 0}</strong><span>MFA habilitado</span></div>
          </div>
          <div className="control-policy-line"><span>Limite login</span><strong>{securityStatus?.policy?.loginRateLimit || 'N/A'}/janela</strong></div>
          <div className="control-policy-line"><span>Limite API</span><strong>{securityStatus?.policy?.apiRateLimit || 'N/A'}/janela</strong></div>
          <div className="control-policy-line"><span>Expiração JWT</span><strong>{securityStatus?.policy?.jwtExpiresHours || 'N/A'}h</strong></div>
        </section>

        <section className="control-engineering-panel">
          <div className="control-panel-heading"><Activity size={15}/><span>Capacidade atual</span></div>
          <div className="control-capacity-list">
            {capacityMetrics.map(item => (
              <div className="control-capacity-row" key={item.label}>
                <div><span>{item.label}</span><strong>{item.detail}</strong></div>
                <div className="control-progress-track"><span className={item.tone} style={{ width: `${Math.min(100, Math.max(0, item.value))}%` }}/></div>
              </div>
            ))}
          </div>
          <div className="control-host-memory">
            {hostInfo?.memory ? `${hostInfo.memory.totalMB - hostInfo.memory.freeMB} MB usados de ${hostInfo.memory.totalMB} MB` : 'Memória física indisponível'}
          </div>
        </section>

        <section className="control-engineering-panel">
          <div className="control-panel-heading"><Plug size={15}/><span>Dependências</span></div>
          <div className="control-dependency-list">
            {dependencyRows.map(item => (
              <div className="control-dependency-row" key={item.label}>
                <span className={`control-status-dot ${getStatusTone(item.status)}`} aria-hidden="true"/>
                <div><strong>{item.label}</strong><small>{item.meta}</small></div>
                <span className={`control-service-status ${getStatusTone(item.status)}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="control-observability-grid anim-stagger-3">
        <section className="control-observability-panel">
          <div className="control-panel-heading"><History size={15}/><span>Histórico persistido</span><strong>{healthHistory.length} amostras</strong></div>
          <div className="control-data-scroll">
            {healthHistory.length === 0 && <div className="control-empty-state">Nenhuma amostra disponível na última hora.</div>}
            {healthHistory.slice(0, 12).map(sample => (
              <div className="control-health-row" key={sample.id}>
                <span className={`control-status-dot ${getStatusTone(sample.status)}`} aria-hidden="true"/>
                <div><strong>{new Date(sample.at).toLocaleTimeString('pt-BR')}</strong><small>API {sample.status} · DB {sample.database}</small></div>
                <div className="control-row-metrics"><strong>{sample.responseTimeMs ?? '--'}ms</strong><small>DB {sample.databaseLatencyMs ?? '--'}ms</small></div>
              </div>
            ))}
          </div>
        </section>

        <section className="control-observability-panel">
          <div className="control-panel-heading"><LockKeyhole size={15}/><span>Verificações de segurança</span><strong>{approvedSecurityChecks} aprovadas</strong></div>
          <div className="control-data-scroll">
            {securityChecks.length === 0 && <div className="control-empty-state">Postura de segurança indisponível.</div>}
            {securityChecks.map(check => (
              <div className="control-security-row" key={check.id}>
                {check.ok ? <CheckCircle2 size={16} className="is-ok"/> : <AlertTriangle size={16} className={`is-${check.severity || 'warning'}`}/>}
                <div><strong>{check.label}</strong><small>Impacto {check.severity || 'informativo'}</small></div>
                <span className={check.ok ? 'ok' : 'warning'}>{check.ok ? 'OK' : 'REVISAR'}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="control-observability-panel">
          <div className="control-panel-heading"><Users size={15}/><span>Sessões ativas</span><strong>{activeSessions.length} conectadas</strong></div>
          <div className="control-data-scroll">
            {activeSessions.length === 0 && <div className="control-empty-state">Nenhuma sessão ativa encontrada.</div>}
            {activeSessions.slice(0, 12).map(session => (
              <div className="control-session-row" key={session.id}>
                <div className="control-session-avatar">{String(session.usuario || '?').slice(0, 1).toUpperCase()}</div>
                <div><strong>{session.usuario || 'Usuário'}</strong><small>{session.role || 'Sem perfil'} · {session.ip || 'IP indisponível'}</small></div>
                <div className="control-row-metrics"><strong>{session.lastSeen ? new Date(session.lastSeen).toLocaleTimeString('pt-BR') : '--:--'}</strong><small>última atividade</small></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="noc-terminals-grid anim-stagger-3">
        <div className="cyber-terminal">
          <div className="cyber-terminal-header"><div className="cyber-terminal-title">VERIFICAÇÕES DA API</div></div>
          <div className="terminal-scroll" ref={trafficContainerRef}>
            {sysConfig.maintenanceMode ? <div style={{ color: 'var(--dim-text)', textAlign: 'center', margin: 'auto', fontStyle: 'italic' }}>Rotas BGP Suspensas</div> : apiTraffic.map((pkt) => (
              <div key={pkt.id} className="terminal-line"><span className="log-method" style={{ color: pkt.color, background: 'rgba(255,255,255,0.05)' }}>{pkt.method}</span><span className="log-geo">[{pkt.geo}]</span><span className="log-route text-truncate">{pkt.route}</span></div>
            ))}
          </div>
        </div>
        <div className="cyber-terminal" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', boxShadow: 'inset 0 0 30px color-mix(in srgb, var(--warning) 10%, transparent)' }}>
          <div className="cyber-terminal-header" style={{ borderBottomColor: 'rgba(245, 158, 11, 0.4)' }}><div className="cyber-terminal-title" style={{ color: 'var(--warning)' }}><AlertCircle size={14} /> ALERTAS ATIVOS</div></div>
          <div className="terminal-scroll" ref={incidentsContainerRef}>
            {incidents.length === 0 ? <div style={{ color: 'var(--success)', textAlign: 'center', margin: 'auto', fontWeight: 'bold', fontSize: '0.8rem' }}>Nenhum incidente crítico no momento.</div> : incidents.map((inc) => (
              <div key={inc.id} className={`incident-card ${inc.type}`}><div className="incident-header"><span>{inc.time}</span><span>{inc.type === 'critical' ? 'CRÍTICO' : 'AVISO'}</span></div><div className="incident-desc">{inc.msg}</div></div>
            ))}
          </div>
        </div>
        <div className="cyber-terminal" style={{ borderColor: 'var(--danger)', boxShadow: isOverclocked ? 'inset 0 0 50px color-mix(in srgb, var(--danger) 30%, transparent)' : 'inset 0 0 30px rgba(0,0,0,0.8)' }}>
          <div className="cyber-terminal-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.4)' }}>
            <div className="cyber-terminal-title" style={{ color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', width: '100%' }}><span>DIAGNÓSTICOS ATIVOS</span><span className="defcon-badge" style={{ background: 'rgba(239,68,68,0.2)', color: defconColor, border: `1px solid ${defconColor}` }}>ESTADO: {defconLevel}</span></div>
          </div>
          <div className="terminal-scroll" ref={wafContainerRef} style={{ color: 'var(--danger)' }}>
            {threats.length === 0 ? <div style={{ color: 'var(--success)', textAlign: 'center', margin: 'auto', fontWeight: 'bold', fontSize: '0.8rem' }}>Nenhuma degradação detectada.</div> : threats.map((pkt) => <div key={pkt.id} className="terminal-line log-error"><span style={{ marginRight: '4px' }}>!</span> {pkt.text}</div>)}
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
          <div className="switch-panel-title" style={{ color: 'var(--info)' }}><Activity size={14}/> AÇÕES DO CONSOLE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center', height: '100%' }}>
            <button className="btn-emergency warning" onClick={() => executarAcaoEmergencia('ATUALIZAR DIAGNÓSTICO')} disabled={actionLoading !== null || loadingHealth || loadingInventory}>
              {actionLoading === 'ATUALIZAR DIAGNÓSTICO' ? <Loader2 size={16} className="spin"/> : <RefreshCw size={16}/>} {actionLoading === 'ATUALIZAR DIAGNÓSTICO' ? 'ATUALIZANDO...' : 'ATUALIZAR DIAGNÓSTICO'}
            </button>
            <button className="btn-emergency" onClick={copiarDiagnostico} disabled={actionLoading !== null}>
              <Copy size={16}/> COPIAR DIAGNÓSTICO
            </button>
            <button className={`btn-emergency ${sysConfig?.maintenanceMode ? '' : 'warning'}`} onClick={confirmarManutencao} disabled={actionLoading !== null}>
              {sysConfig?.maintenanceMode ? <PlayCircle size={16}/> : sysConfig?.maintenanceNoticeActive ? <ServerCrash size={16}/> : <PauseCircle size={16}/>} {sysConfig?.maintenanceMode ? 'ENCERRAR MANUTENÇÃO' : sysConfig?.maintenanceNoticeActive ? 'ENTRAR EM MANUTENÇÃO' : 'AVISAR MANUTENÇÃO'}
            </button>
            <button className="btn-emergency" onClick={() => executarAcaoEmergencia('LIMPAR EVENTOS')} disabled={actionLoading !== null}>
              <Eraser size={16}/> LIMPAR EVENTOS LOCAIS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * ============================================================================ TELA OPERAÇÕES
 * DO SISTEMA ============================================================================
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.addLog - Propriedade addLog usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.sysConfig - Propriedade sysConfig usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.updateSysConfig - Propriedade updateSysConfig usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.usuariosLista - Propriedade usuariosLista usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const TelaSistema = ({ api, showToast, addLog, sysConfig, updateSysConfig, usuariosLista, setModalConfig }) => {
  // Consolida runtime, host, segurança e políticas globais em uma única central.
  const [health, setHealth] = useState(null);
  const [hostInfo, setHostInfo] = useState(null);
  const [security, setSecurity] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const featureLabels = useMemo(() => ([
    { key: 'telemetryStream', label: 'Stream de telemetria', description: 'Recepção contínua de eventos IoT e WebSocket.', icon: Radio },
    { key: 'enableAudioAlerts', label: 'Alertas sonoros', description: 'Sinalização audível para ocorrências críticas.', icon: AlertTriangle },
    { key: 'enableToasts', label: 'Notificações internas', description: 'Mensagens de estado e confirmação na interface.', icon: AlertCircle },
    { key: 'enableChat', label: 'Chat operacional', description: 'Comunicação entre lojas, suporte e operação.', icon: Mail },
    { key: 'allowExports', label: 'Exportações', description: 'Geração de relatórios e arquivos operacionais.', icon: DownloadCloud },
    { key: 'readOnlyMode', label: 'Modo somente leitura', description: 'Bloqueia alterações sem suspender consultas.', icon: LockKeyhole },
    { key: 'forceDarkMode', label: 'Forçar modo escuro', description: 'Aplica o tema técnico a todos os perfis.', icon: Settings2 }
  ]), []);

  const globalFeatures = sysConfig?.regras?.GLOBAL?.features || {};
  const modulosOcultosGlobal = sysConfig?.regras?.GLOBAL?.modulosOcultos || [];
  const totalUsuarios = Array.isArray(usuariosLista) ? usuariosLista.length : 0;

  // Busca as quatro fontes do painel sem derrubar toda a tela se uma delas falhar.
  const carregarSystemOverview = useCallback(async (silent = false) => {
    if (!silent) setLoadingHealth(true);
    const [healthResult, hostResult, securityResult, historyResult] = await Promise.allSettled([
      api.get('/system/health', { validateStatus: (status) => status === 200 || status === 503 }),
      api.get('/system/host-info'),
      api.get('/security/status'),
      api.get('/system/health/history?minutes=60&limit=120')
    ]);

    if (healthResult.status === 'fulfilled') setHealth(healthResult.value.data);
    if (hostResult.status === 'fulfilled') setHostInfo(hostResult.value.data);
    if (securityResult.status === 'fulfilled') setSecurity(securityResult.value.data);
    if (historyResult.status === 'fulfilled') {
      const payload = historyResult.value.data;
      setHistory(Array.isArray(payload) ? payload : (payload?.samples || []));
    }

    if (!silent && healthResult.status === 'rejected') {
      showToast('Não foi possível carregar o diagnóstico do sistema.', 'error');
    }
    setLastUpdated(new Date());
    setLoadingHealth(false);
  }, [api, showToast]);

  useEffect(() => {
    carregarSystemOverview();
  }, [carregarSystemOverview]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const intervalId = window.setInterval(() => carregarSystemOverview(true), 15000);
    return () => window.clearInterval(intervalId);
  }, [autoRefresh, carregarSystemOverview]);
  /**
   * Processa a interacao de confirmar modo manutencao e atualiza a interface conforme o resultado.
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
  const confirmarModoManutencao = () => {
    const maintenanceActive = sysConfig?.maintenanceMode === true;
    const noticePublished = !maintenanceActive && sysConfig?.maintenanceNoticeActive === true;
    const action = maintenanceActive ? 'finish' : noticePublished ? 'activate' : 'announce';
    setModalConfig({
      isOpen: true,
      title: action === 'announce' ? 'Publicar aviso de manutenção' : action === 'activate' ? 'Entrar em manutenção' : 'Encerrar manutenção',
      message: action === 'announce'
        ? 'Escreva o aviso que aparecerá em todas as telas. Nesta etapa ninguém será desconectado.'
        : action === 'activate'
          ? `O aviso já foi publicado: “${sysConfig?.maintenanceMessage}”. Ao continuar, as sessões dos usuários serão encerradas.`
          : 'O aviso será removido e o sistema voltará a aceitar a operação normal dos usuários. Confirmar?',
      isPrompt: action === 'announce',
      promptValue: action === 'announce' ? (sysConfig?.maintenanceMessage || '') : '',
      promptPlaceholder: 'Ex.: Manutenção programada até 22h para atualização do servidor.',
      promptMaxLength: 280,
      requirePrompt: action === 'announce',
      confirmLabel: action === 'announce' ? 'Publicar aviso' : action === 'activate' ? 'Entrar em manutenção' : 'Encerrar manutenção',
      onConfirm: (message) => {
        const maintenanceMessage = String(message || '').trim();
        if (action === 'announce' && !maintenanceMessage) {
          showToast('Informe a mensagem de manutenção.', 'warning');
          return;
        }
        if (action === 'announce') {
          updateSysConfig('ROLE', 'GLOBAL', 'maintenanceNotice', maintenanceMessage, true);
          addLog('[SYSTEM] Aviso prévio de manutenção publicado.', 'warning');
          showToast('Aviso publicado. Os usuários continuam conectados.', 'success');
          return;
        }
        if (action === 'activate') {
          updateSysConfig('ROLE', 'GLOBAL', 'maintenanceMode', sysConfig?.maintenanceMessage, true);
          addLog('[SYSTEM] Modo manutenção ativado após aviso prévio.', 'error');
          showToast('Modo manutenção ativado. As sessões dos usuários serão encerradas.', 'warning');
          return;
        }
        updateSysConfig('ROLE', 'GLOBAL', 'maintenanceMode', null, false);
        addLog('[SYSTEM] Modo manutenção desativado.', 'success');
        showToast('Modo manutenção encerrado.', 'success');
      }
    });
  };


  /**
   * Processa a interacao de alternar feature e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} key - Valor de key consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const alternarFeature = (key) => {
    const nextValue = !(globalFeatures[key] ?? true);
    updateSysConfig('ROLE', 'GLOBAL', 'features', key, nextValue);
    addLog(`[SYSTEM] Feature global '${key}' alterada para ${nextValue ? 'ON' : 'OFF'}.`, nextValue ? 'success' : 'warning');
    showToast('Configuração global atualizada.', 'success');
  };


  /**
   * Limpa limpar cache interface para manter o estado consistente.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: lê ou grava preferências no armazenamento do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
   * Processa a interacao de confirmar limpeza cache e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const confirmarLimpezaCache = () => {
    setModalConfig({
      isOpen: true,
      title: 'Limpar cache desta interface',
      message: 'Preferências e caches locais do TermoSync serão removidos neste dispositivo. A configuração do servidor será preservada.',
      onConfirm: limparCacheInterface
    });
  };

  /**
   * Recarrega somente o console atual e deixa um marcador para a próxima inicialização.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const confirmarRecarregamento = () => {
    setModalConfig({
      isOpen: true,
      title: 'Recarregar console atual',
      message: 'A interface será recarregada agora. Operações não salvas nesta aba serão descartadas.',
      onConfirm: () => {
        localStorage.setItem('termosync_force_reload', Date.now().toString());
        window.location.reload();
      }
    });
  };


  /**
   * Formata format uptime para exibicao segura na interface.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} seconds - Valor de seconds consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const formatUptime = (seconds) => {
    const safeSeconds = Number(seconds || 0);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    return `${hours}h ${minutes}min`;
  };

  /**
   * Copia um resumo sem segredos para facilitar diagnóstico e abertura de incidente.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: publica ou consome mensagens MQTT
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copiarDiagnostico = async () => {
    const diagnostic = {
      generatedAt: new Date().toISOString(),
      status: health?.status,
      database: health?.database,
      mqtt: health?.mqtt,
      whatsapp: health?.whatsapp,
      responseTimeMs: health?.responseTimeMs,
      databaseLatencyMs: health?.databaseLatencyMs,
      cpuPercent: health?.cpuPercent,
      eventLoopUtilization: health?.eventLoopUtilization,
      memory: health?.memory,
      runtime: health?.runtime,
      host: hostInfo?.os,
      securityChecks: security?.checks?.map(({ id, ok, severity }) => ({ id, ok, severity }))
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostic, null, 2));
      showToast('Diagnóstico técnico copiado.', 'success');
      addLog('[SYSTEM] Diagnóstico técnico copiado.', 'success');
    } catch {
      showToast('Não foi possível copiar o diagnóstico.', 'error');
    }
  };

  /**
   * Solicita ao backend um backup portátil sem expor o conteúdo na interface.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const baixarBackup = async () => {
    setActionLoading('backup');
    try {
      const response = await api.get('/system/backup-json', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `termosync-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('Backup técnico gerado.', 'success');
      addLog('[SYSTEM] Backup JSON solicitado.', 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Falha ao gerar o backup.', 'error');
    } finally {
      setActionLoading('');
    }
  };


  /**
   * Concentra a logica de status tone para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} value - Valor de value consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const statusTone = (value) => {
    const normalized = String(value || '').toLowerCase();
    if (['ok', 'online', 'ready', 'connected', 'development', 'production', 'test'].includes(normalized)) return 'is-ok';
    if (['disabled', 'unknown', 'degraded'].includes(normalized)) return 'is-warning';
    return 'is-danger';
  };

  /**
   * Concentra a logica de status label para manter o restante do tela mais legivel.
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
  const statusLabel = (value) => String(value || 'indisponível').replace('_', ' ');
  const heapPercent = health?.memory?.heapTotalMb ? Math.min(100, Math.round((health.memory.heapUsedMb / health.memory.heapTotalMb) * 100)) : 0;
  const hostMemoryPercent = hostInfo?.memory?.totalMB ? Math.min(100, Math.round(((hostInfo.memory.totalMB - hostInfo.memory.freeMB) / hostInfo.memory.totalMB) * 100)) : 0;
  const failedChecks = security?.checks?.filter((check) => !check.ok) || [];
  const availability = history.length ? Math.round((history.filter((sample) => sample.status === 'ok').length / history.length) * 1000) / 10 : 0;
  const chartData = history.slice(-60).map((sample) => ({
    time: new Date(sample.timestamp || sample.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    latency: Number(sample.responseTimeMs || 0),
    cpu: Number(sample.cpuPercent || 0),
    eventLoop: Number(sample.eventLoopUtilization || 0)
  }));

  return (
    <div className="dev-tela-scroll system-ops-screen system-command-page">
      <header className="system-command-header">
        <div><span className="system-command-eyebrow"><Settings2 size={14} /> Administração de runtime</span><h2>Operações do Sistema</h2><p>Estado do processo, dependências, políticas globais e ferramentas administrativas.</p></div>
        <div className="system-command-header-actions">
          <label><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /><span>Tempo real</span></label>
          <small>{lastUpdated ? `Atualizado às ${lastUpdated.toLocaleTimeString('pt-BR')}` : 'Sincronizando...'}</small>
          <button type="button" title="Atualizar diagnóstico" onClick={() => carregarSystemOverview()} disabled={loadingHealth}>{loadingHealth ? <Loader2 size={17} className="spin" /> : <RefreshCw size={17} />}</button>
        </div>
      </header>

      <section className="system-command-kpis" aria-label="Resumo operacional">
        <article className={health?.ok ? 'is-ok' : 'is-danger'}><span><Activity size={15} /> Plataforma</span><strong>{loadingHealth && !health ? '...' : statusLabel(health?.status)}</strong><small>{availability}% de disponibilidade na última hora</small></article>
        <article className="is-latency"><span><Database size={15} /> Banco de dados</span><strong>{health?.databaseLatencyMs ?? '--'} ms</strong><small>{statusLabel(health?.database)} · resposta total {health?.responseTimeMs ?? '--'} ms</small></article>
        <article className="is-runtime"><span><Gauge size={15} /> Event loop</span><strong>{Number(health?.eventLoopUtilization || 0).toFixed(1)}%</strong><small>CPU do processo em {Number(health?.cpuPercent || 0).toFixed(1)}%</small></article>
        <article className={failedChecks.length ? 'is-warning' : 'is-ok'}><span><ShieldCheck size={15} /> Baseline</span><strong>{security ? `${security.checks.length - failedChecks.length}/${security.checks.length}` : '--'}</strong><small>{failedChecks.length} verificação(ões) exigem atenção</small></article>
      </section>

      {sysConfig?.maintenanceNoticeActive && <div className="system-command-maintenance"><ServerCrash size={18} /><div><strong>{sysConfig?.maintenanceMode ? 'Modo manutenção ativo' : 'Aviso de manutenção publicado'}</strong><span>{sysConfig?.maintenanceMessage}</span></div><button type="button" onClick={confirmarModoManutencao}>{sysConfig?.maintenanceMode ? 'Encerrar manutenção' : 'Entrar em manutenção'}</button></div>}

      <div className="system-command-overview">
        <section className="system-command-panel system-services-panel">
          <div className="system-command-title"><div><Network size={16} /><span>Serviços e dependências</span></div><small>Leitura em tempo real</small></div>
          <div className="system-service-grid">
            {[
              { label: 'API principal', value: health?.status, icon: Server, detail: `PID ${health?.runtime?.pid || '--'}` },
              { label: 'MySQL', value: health?.database, icon: Database, detail: `${health?.databaseLatencyMs ?? '--'} ms` },
              { label: 'Broker MQTT', value: health?.mqtt, icon: Radio, detail: 'Ingestão IoT' },
              { label: 'WhatsApp', value: health?.whatsapp, icon: Mail, detail: 'Canal assistido' },
              { label: 'WebSocket', value: health ? 'online' : 'unknown', icon: Wifi, detail: `${health?.runtime?.socketClients || 0} cliente(s)` },
              { label: 'Ambiente', value: health?.runtime?.environment || hostInfo?.runtime?.environment, icon: Cloud, detail: health?.runtime?.nodeVersion || '--' }
            ].map((service) => { const Icon = service.icon; return <article key={service.label}><span className={`system-service-icon ${statusTone(service.value)}`}><Icon size={17} /></span><div><strong>{service.label}</strong><small>{service.detail}</small></div><b className={statusTone(service.value)}>{statusLabel(service.value)}</b></article>; })}
          </div>
        </section>

        <section className="system-command-panel system-runtime-panel">
          <div className="system-command-title"><div><Cpu size={16} /><span>Pressão do runtime</span></div><small>{formatUptime(health?.uptime)} ativos</small></div>
          <div className="system-meter-list">
            <div><span><b>Heap Node.js</b><small>{health?.memory?.heapUsedMb || 0} de {health?.memory?.heapTotalMb || 0} MB</small></span><strong>{heapPercent}%</strong><i><em style={{ width: `${heapPercent}%` }} /></i></div>
            <div><span><b>Memória do host</b><small>{hostInfo?.memory ? `${hostInfo.memory.totalMB - hostInfo.memory.freeMB} de ${hostInfo.memory.totalMB} MB` : '--'}</small></span><strong>{hostMemoryPercent}%</strong><i><em style={{ width: `${hostMemoryPercent}%` }} /></i></div>
            <div><span><b>Event loop</b><small>{health?.runtime?.activeHandles || 0} handles · {health?.runtime?.activeRequests || 0} requests</small></span><strong>{Number(health?.eventLoopUtilization || 0).toFixed(0)}%</strong><i><em className="is-event" style={{ width: `${Math.min(100, Number(health?.eventLoopUtilization || 0))}%` }} /></i></div>
          </div>
          <dl className="system-host-facts"><div><dt>Host</dt><dd>{hostInfo?.os?.hostname || '--'}</dd></div><div><dt>Sistema</dt><dd>{hostInfo?.os ? `${hostInfo.os.type} ${hostInfo.os.arch}` : '--'}</dd></div><div><dt>CPU</dt><dd>{hostInfo?.cpu ? `${hostInfo.cpu.cores} cores · ${hostInfo.cpu.speed} MHz` : '--'}</dd></div><div><dt>Node</dt><dd>{hostInfo?.runtime?.nodeVersion || '--'}</dd></div></dl>
        </section>
      </div>

      <section className="system-command-panel system-chart-panel">
        <div className="system-command-title"><div><ActivitySquare size={16} /><span>Janela operacional</span></div><small>{history.length} amostras · última hora</small></div>
        <div className="system-chart-wrap">
          {chartData.length ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}><AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.1)" /><XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} minTickGap={32} /><YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} /><RechartsTooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }} /><Area type="monotone" dataKey="eventLoop" name="Event loop %" stroke="var(--accent-violet)" fill="var(--accent-violet)" fillOpacity={0.08} strokeWidth={2} isAnimationActive={false} /><Area type="monotone" dataKey="cpu" name="CPU %" stroke="var(--info)" fill="var(--info)" fillOpacity={0.08} strokeWidth={2} isAnimationActive={false} /><Area type="monotone" dataKey="latency" name="Latência ms" stroke="var(--warning)" fill="var(--warning)" fillOpacity={0.04} strokeWidth={1.5} isAnimationActive={false} /></AreaChart></ResponsiveContainer> : <div className="system-command-empty"><Loader2 size={19} className={loadingHealth ? 'spin' : ''} /> Aguardando amostras do monitor.</div>}
        </div>
      </section>

      <div className="system-command-lower-grid">
        <section className="system-command-panel system-security-panel">
          <div className="system-command-title"><div><ShieldCheck size={16} /><span>Postura de segurança</span></div><small>{security?.metrics?.activeSessions || 0} sessões ativas</small></div>
          <div className="system-security-metrics"><div><span>Falhas de login</span><strong>{security?.metrics?.failedLogins24h || 0}</strong><small>últimas 24h</small></div><div><span>Adoção MFA</span><strong>{security?.metrics?.usersTotal ? Math.round((security.metrics.mfaEnabled / security.metrics.usersTotal) * 100) : 0}%</strong><small>{security?.metrics?.mfaEnabled || 0} de {security?.metrics?.usersTotal || totalUsuarios}</small></div><div><span>Sessão JWT</span><strong>{security?.policy?.jwtExpiresHours || '--'}h</strong><small>limite configurado</small></div></div>
          <div className="system-check-list">{(security?.checks || []).map((check) => <div key={check.id} className={check.ok ? 'is-ok' : 'is-warning'}>{check.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}<span>{check.label}</span><b>{check.ok ? 'Conforme' : 'Revisar'}</b></div>)}</div>
        </section>

        <section className="system-command-panel system-features-panel">
          <div className="system-command-title"><div><Settings2 size={16} /><span>Políticas da interface</span></div><small>{modulosOcultosGlobal.length} módulo(s) oculto(s)</small></div>
          <div className="system-feature-list">{featureLabels.map((feature) => { const enabled = globalFeatures[feature.key] ?? true; const Icon = feature.icon; return <div key={feature.key} className={enabled ? '' : 'is-disabled'}><Icon size={16} /><span><strong>{feature.label}</strong><small>{feature.description}</small></span><button type="button" role="switch" aria-checked={enabled} className={enabled ? 'is-on' : ''} onClick={() => alternarFeature(feature.key)}><i /></button></div>; })}</div>
        </section>

        <section className="system-command-panel system-actions-panel">
          <div className="system-command-title"><div><ServerCrash size={16} /><span>Ferramentas administrativas</span></div><small>Ações auditáveis</small></div>
          <div className="system-action-list">
            <button type="button" onClick={copiarDiagnostico}><Copy size={17} /><span><strong>Copiar diagnóstico</strong><small>Runtime, host e baseline sem segredos</small></span></button>
            <button type="button" onClick={baixarBackup} disabled={actionLoading === 'backup'}>{actionLoading === 'backup' ? <Loader2 size={17} className="spin" /> : <DownloadCloud size={17} />}<span><strong>Gerar backup JSON</strong><small>Pacote compactado das tabelas operacionais</small></span></button>
            <button type="button" onClick={confirmarLimpezaCache}><Eraser size={17} /><span><strong>Limpar cache local</strong><small>Somente neste dispositivo</small></span></button>
            <button type="button" onClick={confirmarRecarregamento}><RefreshCw size={17} /><span><strong>Recarregar console</strong><small>Reinicia a interface desta aba</small></span></button>
            <button type="button" className={sysConfig?.maintenanceMode ? 'is-recovery' : 'is-danger'} onClick={confirmarModoManutencao}><ServerCrash size={17} /><span><strong>{sysConfig?.maintenanceMode ? 'Encerrar manutenção' : sysConfig?.maintenanceNoticeActive ? 'Entrar em manutenção' : 'Avisar manutenção'}</strong><small>{sysConfig?.maintenanceMode ? 'Restabelece o acesso normal' : sysConfig?.maintenanceNoticeActive ? 'Encerra as sessões após o aviso prévio' : 'Publica o aviso sem desconectar usuários'}</small></span></button>
          </div>
        </section>
      </div>
    </div>
  );
};

/**
 * ============================================================================ TELA SAAS E
 * MULTITENANCY (ABSOLUTE FULLSCREEN - X SCROLL ONLY)
 * ============================================================================
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.updateSysConfig - Propriedade updateSysConfig usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.addLog - Propriedade addLog usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const TelaSaaS = ({ api, updateSysConfig, showToast, addLog, setModalConfig }) => {
  // Esta tela usa o backend como fonte de verdade para licenças e empresas.
  const [tenants, setTenants] = useState([]);
  const [revealedKeys, setRevealedKeys] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [sortBy, setSortBy] = useState('NOME');
  const [modal360, setModal360] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingTenant, setPendingTenant] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Carrega licenças, telemetria, cobrança e sessões consolidadas pelo servidor.
  const loadLicenses = useCallback(async (silent = false) => { if (silent) setRefreshing(true); else setLoading(true); try { const response = await api.get('/saas/licenses'); setTenants(Array.isArray(response.data) ? response.data : []); setLoadError(''); setLastUpdated(new Date()); } catch (error) { const message = error.response?.data?.error || 'Não foi possível carregar as licenças.'; setLoadError(message); if (!silent) showToast(message, 'error'); } finally { setLoading(false); setRefreshing(false); } }, [api, showToast]);
  const normalizedTenants = useMemo(() => tenants.map((tenant) => ({
    ...tenant,
    filial: tenant.filial || tenant.nome || 'Tenant sem nome',
    empresa: tenant.empresa || 'Empresa não vinculada',
    plano: String(tenant.plano || 'FREE').toUpperCase(),
    tenant_status: tenant.tenant_status || tenant.status || 'Ativa',
    retention_days: Number(tenant.retention_days || 30),
    equipamentos: Number(tenant.equipamentos || 0),
    equipamentos_online: Number(tenant.equipamentos_online || 0),
    usuarios: Number(tenant.usuarios || 0),
    sessoes_ativas: Number(tenant.sessoes_ativas || 0),
    alertas_abertos: Number(tenant.alertas_abertos || 0),
    fatura_total: tenant.fatura_total == null ? null : Number(tenant.fatura_total)
  })), [tenants]);
  const filteredTenants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const isOperational = (tenant) => tenant.plano !== 'SUSPENSO' && String(tenant.tenant_status).toLowerCase() === 'ativa';
    return normalizedTenants.filter((tenant) => (!term || `${tenant.filial} ${tenant.empresa}`.toLowerCase().includes(term))
      && (planFilter === 'TODOS' || tenant.plano === planFilter)
      && (statusFilter === 'TODOS' || (statusFilter === 'ATIVOS' ? isOperational(tenant) : !isOperational(tenant))))
      .sort((a, b) => {
        if (sortBy === 'PLANO') return a.plano.localeCompare(b.plano) || a.filial.localeCompare(b.filial);
        if (sortBy === 'STATUS') return String(a.tenant_status).localeCompare(String(b.tenant_status));
        if (sortBy === 'ALERTAS') return b.alertas_abertos - a.alertas_abertos;
        if (sortBy === 'SESSOES') return b.sessoes_ativas - a.sessoes_ativas;
        return a.filial.localeCompare(b.filial);
      });
  }, [normalizedTenants, planFilter, searchTerm, sortBy, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredTenants.length / pageSize));
  const paginatedTenants = filteredTenants.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const summary = useMemo(() => normalizedTenants.reduce((accumulator, tenant) => {
    accumulator.total += 1;
    accumulator[tenant.plano] = (accumulator[tenant.plano] || 0) + 1;
    accumulator.online += tenant.equipamentos_online;
    accumulator.equipment += tenant.equipamentos;
    accumulator.sessions += tenant.sessoes_ativas;
    if (tenant.fatura_status && !['PAGO', 'SEM FATURA'].includes(String(tenant.fatura_status).toUpperCase())) accumulator.billingAttention += 1;
    return accumulator;
  }, { total: 0, TRIAL: 0, FREE: 0, PRO: 0, ENTERPRISE: 0, SUSPENSO: 0, online: 0, equipment: 0, sessions: 0, billingAttention: 0 }), [normalizedTenants]);

  useEffect(() => { loadLicenses(); }, [loadLicenses]);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => loadLicenses(true), 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadLicenses]);
  useEffect(() => { setCurrentPage(1); }, [planFilter, searchTerm, sortBy, statusFilter]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);
  /**
   * Atualiza update license mantendo o estado persistido em sincronia.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {unknown} tenant - Valor de tenant consumido por esta rotina.
   * @param {unknown} changes - Valor de changes consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const updateLicense = async (tenant, changes) => {
    setPendingTenant(tenant.filial);
    try {
      const plano = changes.plano || tenant.plano;
      const retentionDays = Number(changes.retentionDays || tenant.retention_days);
      await api.put(`/saas/licenses/${encodeURIComponent(tenant.filial)}`, { plano, retentionDays });
      updateSysConfig(null, tenant.filial, 'saas_plan', null, plano);
      addLog(`[SAAS] ${tenant.filial}: plano ${plano}, retenção ${retentionDays} dias.`, plano === 'SUSPENSO' ? 'error' : 'success');
      showToast(`Licença de ${tenant.filial} atualizada.`, plano === 'SUSPENSO' ? 'warning' : 'success');
      await loadLicenses(true);
    } catch (error) {
      showToast(error.response?.data?.error || 'Falha ao atualizar a licença.', 'error');
    } finally {
      setPendingTenant(null);
    }
  };

  /**
   * Exige confirmação antes de suspender um tenant em produção.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} tenant - Valor de tenant consumido por esta rotina.
   * @param {unknown} plano - Valor de plano consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const changePlan = (tenant, plano) => {
    if (plano !== 'SUSPENSO') {
      updateLicense(tenant, { plano });
      return;
    }
    setModalConfig({
      isOpen: true,
      title: 'Suspender licença SaaS',
      message: `${tenant.filial} perderá o acesso ao sistema até que outro plano seja selecionado. Deseja continuar?`,
      onConfirm: () => updateLicense(tenant, { plano })
    });
  };

  /**
   * Gera ou rotaciona uma chave e mantém o segredo visível somente nesta sessão.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {unknown} tenant - Valor de tenant consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const generateApiKey = async (tenant) => {
    setPendingTenant(tenant.filial);
    try {
      const response = await api.post(`/saas/licenses/${encodeURIComponent(tenant.filial)}/api-key`);
      setRevealedKeys((current) => ({ ...current, [tenant.filial]: response.data.key }));
      addLog(`[API] Chave de integração rotacionada para ${tenant.filial}.`, 'warning');
      showToast('Nova chave gerada. Ela será exibida somente agora.', 'success');
      await loadLicenses(true);
    } catch (error) {
      showToast(error.response?.data?.error || 'Falha ao gerar a chave.', 'error');
    } finally {
      setPendingTenant(null);
    }
  };

  /**
   * Confirma a rotação quando já existe uma integração ativa.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} tenant - Valor de tenant consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const requestApiKey = (tenant) => {
    if (!tenant.api_key_prefix) {
      generateApiKey(tenant);
      return;
    }
    setModalConfig({
      isOpen: true,
      title: 'Rotacionar chave de integração',
      message: `A chave atual de ${tenant.filial} deixará de funcionar imediatamente. Deseja gerar uma nova?`,
      onConfirm: () => generateApiKey(tenant)
    });
  };

  /**
   * Copia a chave recém-gerada e informa falhas de permissão do navegador.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
   *
   * @param {unknown} filial - Valor de filial consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copyApiKey = async (filial) => {
    try {
      await navigator.clipboard.writeText(revealedKeys[filial]);
      setCopiedKey(filial);
      window.setTimeout(() => setCopiedKey(null), 1800);
      showToast('Chave copiada.', 'info');
    } catch (error) {
      showToast('O navegador bloqueou a cópia da chave.', 'error');
    }
  };

  /**
   * Confirma e revoga a chave persistida do tenant.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} tenant - Valor de tenant consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const revokeApiKey = (tenant) => setModalConfig({
    isOpen: true,
    title: 'Revogar chave de integração',
    message: `A integração de ${tenant.filial} deixará de autenticar imediatamente. Deseja continuar?`,
    onConfirm: async () => {
      try {
        await api.delete(`/saas/licenses/${encodeURIComponent(tenant.filial)}/api-key`);
        setRevealedKeys((current) => { const next = { ...current }; delete next[tenant.filial]; return next; });
        showToast('Chave de integração revogada.', 'success');
        await loadLicenses(true);
      } catch (error) {
        showToast(error.response?.data?.error || 'Falha ao revogar a chave.', 'error');
      }
    }
  });

  /**
   * Encerra no servidor todas as sessões vinculadas à filial selecionada.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} tenant - Valor de tenant consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const revokeSessions = (tenant) => setModalConfig({
    isOpen: true,
    title: 'Encerrar sessões do tenant',
    message: `Todos os usuários conectados em ${tenant.filial} precisarão entrar novamente. Deseja continuar?`,
    onConfirm: async () => {
      try {
        const response = await api.post(`/saas/licenses/${encodeURIComponent(tenant.filial)}/revoke-sessions`);
        addLog(`[SECURITY] ${response.data.revoked} sessão(ões) encerradas em ${tenant.filial}.`, 'error');
        showToast(`${response.data.revoked} sessão(ões) encerradas.`, 'success');
        await loadLicenses(true);
      } catch (error) {
        showToast(error.response?.data?.error || 'Falha ao encerrar sessões.', 'error');
      }
    }
  });

  /**
   * Autoriza uma sessão isolada e entrega à nova aba um código de uso único.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador
   *
   * @param {unknown} tenant - Valor de tenant consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const loginAs = async (tenant) => {
    const customerWindow = window.open('about:blank', '_blank');
    if (!customerWindow) {
      showToast('O navegador bloqueou a nova aba. Permita pop-ups para acessar como cliente.', 'warning');
      return;
    }
    customerWindow.document.title = 'Preparando acesso ao cliente...';
    setPendingTenant(tenant.filial);
    try {
      const response = await api.post('/impersonate', { filialDestino: tenant.filial });
      const accessUrl = new URL(window.location.pathname, window.location.origin);
      accessUrl.searchParams.set('impersonateCode', response.data.accessCode);
      customerWindow.opener = null;
      customerWindow.location.replace(accessUrl.toString());
      addLog(`[AUTH] Acesso remoto criado para ${tenant.filial}.`, 'warning');
      showToast(`Sessão de cliente aberta para ${tenant.filial}.`, 'success');
      await loadLicenses(true);
    } catch (error) {
      customerWindow.close();
      showToast(error.response?.data?.error || 'Erro ao criar sessão remota.', 'error');
    } finally {
      setPendingTenant(null);
    }
  };


  /**
   * Formata format date para exibicao segura na interface.
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
  const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem registro';

  /**
   * Formata format currency para exibicao segura na interface.
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
  const formatCurrency = (value) => value == null ? 'Sem fatura' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="saas-license-screen anim-fade-in">
      <header className="saas-license-heading anim-stagger-1">
        <div>
          <span className="saas-license-eyebrow"><ShieldCheck size={14} /> Governança comercial e operacional</span>
          <h2>Licenças SaaS</h2>
          <p>Planos, acesso, retenção, integrações e consumo real por tenant. {lastUpdated && `Atualizado às ${lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`}</p>
        </div>
        <button className="btn-icon-small" type="button" title="Atualizar licenças" onClick={() => loadLicenses(true)} disabled={refreshing}>
          <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
        </button>
      </header>

      <section className="saas-license-kpis anim-stagger-1" aria-label="Resumo das licenças">
        <article><span><Building2 size={15} /> Tenants</span><strong>{summary.total}</strong><small>{summary.TRIAL} Trial · {summary.FREE} Free · {summary.PRO} Pro · {summary.ENTERPRISE} Enterprise</small></article>
        <article><span><Server size={15} /> Edge online</span><strong>{summary.online}<small>/{summary.equipment}</small></strong><small>Equipamentos com telemetria nos últimos 15 min</small></article>
        <article><span><Users size={15} /> Sessões ativas</span><strong>{summary.sessions}</strong><small>Acessos autenticados agora</small></article>
        <article className={summary.SUSPENSO || summary.billingAttention ? 'is-warning' : ''}><span><AlertTriangle size={15} /> Atenção</span><strong>{summary.SUSPENSO + summary.billingAttention}</strong><small>{summary.SUSPENSO} suspensas · {summary.billingAttention} cobranças pendentes</small></article>
      </section>

      <section className="saas-license-workspace anim-stagger-2">
        <div className="saas-license-toolbar">
          <div className="iam-search-box saas-license-search"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar tenant ou empresa" /></div>
          <div className="saas-license-filters">
            <label><span>Plano</span><select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)}><option value="TODOS">Todos</option><option value="TRIAL">Trial</option><option value="FREE">Free</option><option value="PRO">Pro</option><option value="ENTERPRISE">Enterprise</option><option value="SUSPENSO">Suspenso</option></select></label>
            <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="TODOS">Todos</option><option value="ATIVOS">Operacionais</option><option value="INATIVOS">Com restrição</option></select></label>
            <label><span>Ordenar</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="NOME">Nome</option><option value="PLANO">Plano</option><option value="STATUS">Status</option><option value="ALERTAS">Mais alertas</option><option value="SESSOES">Mais sessões</option></select></label>
          </div>
          <label className="saas-live-toggle"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /><span>Tempo real</span></label>
          <span className="saas-license-result-count">{filteredTenants.length} de {normalizedTenants.length}</span>
        </div>

        {loadError && tenants.length === 0 ? (
          <div className="saas-license-empty is-error"><AlertCircle size={24} /><span>{loadError}</span><button type="button" onClick={() => loadLicenses()}>Tentar novamente</button></div>
        ) : loading ? (
          <div className="saas-license-empty"><Loader2 size={24} className="spin" /><span>Consolidando licenças...</span></div>
        ) : filteredTenants.length === 0 ? (
          <div className="saas-license-empty"><Search size={24} /><span>Nenhum tenant corresponde aos filtros.</span></div>
        ) : (
          <div className="saas-license-list">
            {paginatedTenants.map((tenant) => {
              const suspended = tenant.plano === 'SUSPENSO' || tenant.tenant_status !== 'Ativa';
              const busy = pendingTenant === tenant.filial;
              const onlinePercent = tenant.equipamentos ? Math.round((tenant.equipamentos_online / tenant.equipamentos) * 100) : 0;
              const secret = revealedKeys[tenant.filial];
              return (
                <article className={`saas-license-row ${suspended ? 'is-suspended' : ''}`} key={tenant.id || tenant.filial}>
                  <div className="saas-tenant-identity">
                    <span className={`saas-status-dot ${suspended ? 'offline' : 'online'}`} />
                    <div><strong>{tenant.filial}</strong><span>{tenant.empresa || 'Empresa não vinculada'}</span></div>
                  </div>

                  <div className="saas-tenant-metrics">
                    <div><span>Edge online</span><strong>{tenant.equipamentos_online}/{tenant.equipamentos}</strong><div className="saas-meter"><i style={{ width: `${onlinePercent}%` }} /></div></div>
                    <div><span>Última telemetria</span><strong>{tenant.ultima_telemetria ? new Date(tenant.ultima_telemetria).toLocaleDateString('pt-BR') : 'Sem sinal'}</strong><small>{formatDate(tenant.ultima_telemetria)}</small></div>
                    <div><span>Usuários e sessões</span><strong>{tenant.usuarios} / {tenant.sessoes_ativas}</strong><small>{tenant.alertas_abertos} alerta(s) em aberto</small></div>
                    <div><span>Ciclo financeiro</span><strong className={tenant.fatura_status && tenant.fatura_status !== 'PAGO' ? 'warning-text' : ''}>{tenant.fatura_status || 'SEM FATURA'}</strong><small>{formatCurrency(tenant.fatura_total)}</small></div>
                  </div>

                  <div className="saas-tenant-controls">
                    <label><span>Plano</span><select className="plan-dropdown" value={tenant.plano} disabled={busy} onChange={(event) => changePlan(tenant, event.target.value)}><option value="TRIAL" disabled>Trial</option><option value="FREE">Free</option><option value="PRO">Pro</option><option value="ENTERPRISE">Enterprise</option><option value="SUSPENSO">Suspenso</option></select></label>
                    <label><span>Retenção</span><select className="plan-dropdown" value={tenant.retention_days} disabled={busy || suspended} onChange={(event) => updateLicense(tenant, { retentionDays: event.target.value })}><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option></select></label>
                  </div>

                  <div className="saas-api-key">
                    <span>Integração API</span>
                    {secret ? <div className="saas-secret"><code>{secret}</code><button type="button" title="Copiar chave" onClick={() => copyApiKey(tenant.filial)}>{copiedKey === tenant.filial ? <Check size={16} /> : <Copy size={16} />}</button></div> : <strong>{tenant.api_key_prefix || 'Não configurada'}</strong>}
                    <div><button type="button" disabled={busy || suspended} onClick={() => requestApiKey(tenant)}><Key size={14} />{tenant.api_key_prefix ? 'Rotacionar' : 'Gerar chave'}</button>{tenant.api_key_prefix && <button type="button" className="danger-text" onClick={() => revokeApiKey(tenant)}><Trash2 size={14} />Revogar</button>}</div>
                  </div>

                  <div className="saas-tenant-actions">
                    <button type="button" title="Abrir visão detalhada" onClick={() => setModal360(tenant)}><ActivitySquare size={18} /></button>
                    <button type="button" title="Acessar como cliente" disabled={busy || suspended} onClick={() => loginAs(tenant)}><UserCheck size={18} /></button>
                    <button type="button" title="Encerrar sessões" className="danger-text" disabled={busy || tenant.sessoes_ativas === 0} onClick={() => revokeSessions(tenant)}><Power size={18} /></button>
                  </div>
                </article>
              );
            })}
            {totalPages > 1 && (
              <footer className="saas-license-pagination">
                <button type="button" title="Página anterior" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft size={18} /></button>
                <span>Página {currentPage} de {totalPages}</span>
                <button type="button" title="Próxima página" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}><ChevronRight size={18} /></button>
              </footer>
            )}
          </div>
        )}
      </section>

      {modal360 && (
        <div className="iam-modal-overlay" role="dialog" aria-modal="true" aria-label={`Detalhes de ${modal360.filial}`}>
          <div className="iam-modal-content saas-tenant-modal">
            <div className="iam-modal-header"><div><span>Tenant 360</span><h3>{modal360.filial}</h3></div><button className="btn-close-modal" type="button" title="Fechar" onClick={() => setModal360(null)}><X size={20} /></button></div>
            <div className="iam-modal-body">
              <div className="saas-modal-status"><span className={`saas-status-dot ${modal360.plano === 'SUSPENSO' ? 'offline' : 'online'}`} /><div><strong>{modal360.plano}</strong><span>{modal360.empresa || 'Empresa não vinculada'} · {modal360.tenant_status}</span></div></div>
              <div className="saas-modal-grid">
                <article><span><Server size={15} /> Infraestrutura</span><strong>{modal360.equipamentos_online} de {modal360.equipamentos} online</strong><small>Última telemetria: {formatDate(modal360.ultima_telemetria)}</small></article>
                <article><span><Database size={15} /> Dados</span><strong>{formatDate(modal360.ultima_telemetria)}</strong><small>Retenção contratada: {modal360.retention_days} dias</small></article>
                <article><span><Users size={15} /> Acesso</span><strong>{modal360.usuarios} usuários</strong><small>{modal360.sessoes_ativas} ativas · {modal360.sessoes_remotas || 0} remotas</small></article>
                <article><span><Receipt size={15} /> Cobrança</span><strong>{modal360.fatura_status || 'Sem fatura'}</strong><small>{formatCurrency(modal360.fatura_total)} · venc. {modal360.data_vencimento ? new Date(`${modal360.data_vencimento}T12:00:00`).toLocaleDateString('pt-BR') : 'não informado'}</small></article>
                <article><span><AlertTriangle size={15} /> Operação</span><strong>{modal360.alertas_abertos} alertas abertos</strong><small>Status cadastral: {modal360.tenant_status}</small></article>
                <article><span><Key size={15} /> Integração</span><strong>{modal360.api_key_prefix || 'Sem chave'}</strong><small>Criada: {formatDate(modal360.api_key_created_at)}</small></article>
              </div>
            </div>
            <div className="iam-modal-footer"><button type="button" className="btn btn-primary w-100" onClick={() => setModal360(null)}>Fechar</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * ============================================================================ TELA BILLING
 * (FINANCEIRO E FATURAMENTO - ROLAGEM FLUIDA COM OVERFLOW X)
 * ============================================================================
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; troca eventos em tempo real
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.sysConfig - Propriedade sysConfig usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.filiaisDb - Propriedade filiaisDb usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.addLog - Propriedade addLog usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.updateSysConfig - Propriedade updateSysConfig usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const TelaBilling = ({ api, socket, sysConfig, filiaisDb, showToast, addLog, updateSysConfig, setModalConfig }) => {
  // Billing: acompanha faturas por filial/tenant e aciona cobrança ou bloqueios
  // comerciais conforme plano e status de pagamento.
  const [billingSetup, setBillingSetup] = useState(() => sysConfig.billing || { pro: 299.90, ent: 899.90, diaVencimento: 10, multa: 2.0, juros: 1.0 });

  const [faturas, setFaturas] = useState({});
  const [financeOverview, setFinanceOverview] = useState({ summary: {}, invoices: [], timeline: [], aging: [], generatedAt: null });
  const [isGenerating, setIsGenerating] = useState(null);
  const [isLoadingFinanceiro, setIsLoadingFinanceiro] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('ALL');
  const [buscaFinanceira, setBuscaFinanceira] = useState('');
  const [showPricing, setShowPricing] = useState(false);
  const [modalHistorico, setModalHistorico] = useState(null);
  const [historicoFinanceiro, setHistoricoFinanceiro] = useState([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);


  /**
   * Atualiza update setup mantendo o estado persistido em sincronia.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} key - Valor de key consumido por esta rotina.
   * @param {unknown} val - Valor de val consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const updateSetup = (key, val) => {
    const newSetup = { ...billingSetup, [key]: parseFloat(val) || 0 };
    setBillingSetup(newSetup);
    updateSysConfig(null, null, 'billing', key, newSetup[key]);
  };

  useEffect(() => {
    if (sysConfig.billing) setBillingSetup(sysConfig.billing);
  }, [sysConfig.billing]);

  const carregarDadosFinanceiros = useCallback(async () => {
    setIsLoadingFinanceiro(true);
    try {
      const response = await api.get('/financeiro/overview');
      const overview = response.data || { summary: {}, invoices: [], timeline: [], aging: [] };
      setFinanceOverview(overview);
      setFaturas((overview.invoices || []).reduce((map, invoice) => ({ ...map, [invoice.filial]: invoice }), {}));
    } catch (e) {
      setFaturas({});
      setFinanceOverview({ summary: {}, invoices: [], timeline: [], aging: [], generatedAt: null });
      showToast('Não foi possível carregar os dados financeiros do banco.', 'error');
    } finally { setIsLoadingFinanceiro(false); }
  }, [api, showToast]);

  useEffect(() => { carregarDadosFinanceiros(); }, [carregarDadosFinanceiros]);

  useEffect(() => {
    if (!socket) return;

    /**
     * Processa a interacao de on pagamento confirmado e atualiza a interface conforme o resultado.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @param {object|Array} data - Dados de entrada que serão validados e transformados pelo fluxo.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const onPagamentoConfirmado = (data) => {
      showToast(`Pagamento recebido de ${data.filial} (Tempo Real)!`, 'success');
      addLog(`[FINANCEIRO LIVE] Pagamento automático liquidado para ${data.filial}.`, 'success');
      carregarDadosFinanceiros();
    };
    socket.on('pagamento_confirmado', onPagamentoConfirmado);
    socket.on('atualizacao_dados', carregarDadosFinanceiros);
    return () => { socket.off('pagamento_confirmado', onPagamentoConfirmado); socket.off('atualizacao_dados', carregarDadosFinanceiros); }
  }, [socket, showToast, addLog, carregarDadosFinanceiros]);

  const getDetalhesFatura = useCallback((filial) => {
    const dadosFatura = faturas[filial];
    if (!dadosFatura?.id) return null;
    const dueDate = dadosFatura.dueDate ? new Date(dadosFatura.dueDate) : null;
    return {
      id: dadosFatura.id,
      base: Number(dadosFatura.base || 0),
      multa: Number(dadosFatura.multa || 0),
      juros: Number(dadosFatura.juros || 0),
      total: Number(dadosFatura.total || 0),
      status: dadosFatura.status,
      foiPaga: dadosFatura.status === 'PAGO',
      diasDeAtraso: Number(dadosFatura.daysPastDue || 0),
      dataVenc: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não informado',
      metodo: dadosFatura.metodo_pagamento || 'Não informado',
      email: dadosFatura.email || null,
      empresa: dadosFatura.empresa || null,
      cnpj: dadosFatura.cnpj || null,
      endereco: dadosFatura.endereco || null,
      telefone: dadosFatura.telefone || null
    };
  }, [faturas]);

  const metricasFinanceiras = useMemo(() => {
    if (financeOverview.generatedAt) {
      const summary = financeOverview.summary || {};
      const activeCount = Number(summary.invoiceCount || 0);
      return {
        mrr: Number(summary.billed || 0), arr: Number(summary.billed || 0) * 12,
        inadimplencia: Number(summary.overdue || 0), ativos: activeCount,
        pagos: Number(summary.paidCount || 0), devendo: Math.max(0, activeCount - Number(summary.paidCount || 0)),
        total: activeCount, arpu: activeCount > 0 ? Number(summary.billed || 0) / activeCount : 0,
        taxaInadimplencia: activeCount > 0 ? (Number(summary.overdueCount || 0) / activeCount) * 100 : 0,
        recebido: Number(summary.received || 0), aberto: Number(summary.open || 0), collectionRate: Number(summary.collectionRate || 0)
      };
    }
    return { mrr: 0, arr: 0, inadimplencia: 0, ativos: 0, pagos: 0, devendo: 0, total: 0, arpu: 0, taxaInadimplencia: 0, recebido: 0, aberto: 0, collectionRate: 0 };
  }, [financeOverview]);

  const dadosGraficoReceita = useMemo(() => {
    return financeOverview.timeline || [];
  }, [financeOverview.timeline]);

  /**
   * Abre o extrato persistido da organização selecionada.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {unknown} filial - Valor de filial consumido por esta rotina.
   * @param {unknown} fatura - Valor de fatura consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const abrirHistorico = async (filial, fatura) => {
    setModalHistorico({ nome: filial, fatura });
    setHistoricoFinanceiro([]);
    setHistoricoLoading(true);
    try {
      const response = await api.get(`/financeiro/faturas/${encodeURIComponent(filial)}/historico`);
      setHistoricoFinanceiro(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showToast('Falha ao carregar o extrato financeiro.', 'error');
    } finally {
      setHistoricoLoading(false);
    }
  };

  const filiaisFinanceiras = useMemo(() => {
    const filiaisComFatura = financeOverview.invoices?.map(invoice => invoice.filial) || [];
    const fonte = [...new Set(filiaisComFatura)];
    return fonte.filter((filial) => {
    const plano = faturas[filial]?.plano || sysConfig.planos?.[filial] || 'FREE';
    const fatura = getDetalhesFatura(filial, plano, plano === 'SUSPENSO');
    if (!fatura) return false;
    if (buscaFinanceira && !filial.toLowerCase().includes(buscaFinanceira.toLowerCase())) return false;
    if (filtroStatus === 'PAGO' && !fatura.foiPaga) return false;
    if (filtroStatus === 'PENDENTES' && fatura.foiPaga) return false;
    if (filtroStatus === 'ATRASADAS' && !['ATRASADA', 'VENCIDA'].includes(fatura.status)) return false;
    return true;
    });
  }, [sysConfig.planos, faturas, getDetalhesFatura, buscaFinanceira, filtroStatus, financeOverview.invoices]);


  /**
   * Processa a interacao de confirmar pagamento e atualiza a interface conforme o resultado.
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
   * @param {unknown} filial - Valor de filial consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const confirmarPagamento = (filial) => {
    setModalConfig({
      isOpen: true, title: 'Confirmar Liquidação de Fatura',
      message: `Confirma a receção do pagamento da organização ${filial}? O banco de dados será atualizado e bloqueios removidos.`,
      onConfirm: async () => {
        try {
          const planoAtual = sysConfig.planos?.[filial] || 'PRO';
          await api.post(`/financeiro/faturas/${encodeURIComponent(filial)}/pagar`, { billingSetup: billingSetup, plano: planoAtual });
          if (planoAtual === 'SUSPENSO') { updateSysConfig(null, filial, 'saas_plan', null, 'PRO'); addLog(`[FINANCEIRO] Serviço reativado para ${filial}.`, 'success'); }
          showToast('Pagamento sincronizado.', 'success');
          carregarDadosFinanceiros();
        } catch (error) {
          showToast(error.response?.data?.error || 'Falha ao confirmar o pagamento.', 'error');
        }
      }
    });
  };


  /**
   * Concentra a logica de forcar fatura atrasada para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {unknown} filial - Valor de filial consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: consulta ou altera dados pela API
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const dispararCobrancaEmLote = async () => {
    addLog(`[CRON] Rotina de emissão em lote enviada para a API...`, 'warning');
    try {
      await api.post('/financeiro/cobranca-lote', { billingSetup: billingSetup, planos: sysConfig.planos || {} });
      showToast('Faturamento em lote processado.', 'success');
      carregarDadosFinanceiros();
    } catch(error) {
      const message = error.response?.data?.error || 'Falha ao processar o faturamento em lote.';
      showToast(message, 'error');
      addLog(`[CRON] ${message}`, 'error');
    }
  };


  /**
   * Concentra a logica de notificar cobranca para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: consulta ou altera dados pela API
   *
   * @param {unknown} filial - Valor de filial consumido por esta rotina.
   * @param {unknown} fatura - Valor de fatura consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} tipo - Valor de tipo consumido por esta rotina.
   * @param {unknown} filial - Valor de filial consumido por esta rotina.
   * @param {Function} callback - Função chamada para comunicar o resultado ao componente responsável.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const simularGeracao = (tipo, filial, callback) => {
    setIsGenerating(`${tipo}_${filial}`); showToast(`A compilar documento ${tipo}...`, 'info');
    setTimeout(() => { callback(); setIsGenerating(null); }, 1200);
  };


  /**
   * Concentra a logica de draw barcode para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} doc - Valor de doc consumido por esta rotina.
   * @param {unknown} x - Valor de x consumido por esta rotina.
   * @param {unknown} y - Valor de y consumido por esta rotina.
   * @param {unknown} width - Valor de width consumido por esta rotina.
   * @param {unknown} height - Valor de height consumido por esta rotina.
   * @param {unknown} source - Valor de source consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const drawBarcode = (doc, x, y, width, height, source) => {
    let currentX = x; doc.setFillColor(0, 0, 0);
    const digits = String(source || '0').split('').map((char) => char.charCodeAt(0));
    let index = 0;
    while (currentX < x + width) {
      const value = digits[index % digits.length];
      const barWidth = value % 2 === 0 ? 0.5 : 1.5;
      if (currentX + barWidth > x + width) break;
      doc.rect(currentX, y, barWidth, height, 'F');
      currentX += barWidth + (value % 3 === 0 ? 0.6 : 1.2);
      index += 1;
    }
  };


  /**
   * Gera gerar nota fiscal pdf com os dados necessarios para o proximo passo.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} filial - Valor de filial consumido por esta rotina.
   * @param {unknown} fatura - Valor de fatura consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const gerarNotaFiscalPDF = (filial, fatura) => {
    simularGeracao('NFe', filial, () => {
      const doc = new jsPDF('p', 'mm', 'a4');
      const competencia = financeOverview.period || { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
      const documentNumber = `NFS-${competencia.year}${String(competencia.month).padStart(2, '0')}-${String(fatura.id).padStart(6, '0')}`;
      const verificationCode = `${competencia.year}${competencia.month}${fatura.id}${Math.round(fatura.total * 100)}`.slice(-12).toUpperCase();

      doc.setDrawColor(50); doc.setLineWidth(0.3);
      doc.rect(10, 10, 190, 30);
      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text("PREFEITURA DO MUNICÍPIO DE SÃO PAULO", 105, 18, { align: "center" });
      doc.setFontSize(12);
      doc.text("NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e", 105, 25, { align: "center" });
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`Data e Hora da Emissão: ${new Date().toLocaleString('pt-BR')} | Código de Verificação: ${verificationCode}`, 105, 32, { align: "center" });
      doc.setFont("helvetica", "bold"); doc.text(`Número da Nota: ${documentNumber}`, 105, 37, { align: "center" });

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
      doc.text(`CNPJ: ${fatura.cnpj || 'Não informado no cadastro'}`, 15, 103);
      doc.text(`Endereço: ${fatura.endereco || 'Não informado no cadastro'}`, 15, 108);

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
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} filial - Valor de filial consumido por esta rotina.
   * @param {unknown} fatura - Valor de fatura consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
      doc.text(`CNPJ: ${fatura.cnpj || 'Não informado no cadastro'}`, 12, 123);
      doc.text(fatura.endereco || 'Endereço não informado no cadastro', 12, 128);

      drawBarcode(doc, 12, 138, 110, 16, `FAT-${fatura.id}-${fatura.total}`);

      doc.save(`Boleto_${filial.replace(/ /g, '_')}_${Date.now()}.pdf`);
      addLog(`[BILLING] Boleto gerado para ${filial}.`, 'success');
      showToast('Boleto Bancário gerado.', 'success');
    });
  };


  /**
   * Gera gerar csvrelatorio com os dados necessarios para o proximo passo.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const gerarCSVRelatorio = () => {
     showToast('Exportando CSV Financeiro...', 'info');
     let csvContent = "Cliente,Plano,Mensalidade,Multas_Juros,Total,Status,Metodo_Pagamento,Vencimento\n";
      const filiaisDoRelatorio = financeOverview.invoices?.length ? financeOverview.invoices.map(invoice => invoice.filial) : (filiaisDb || []);
      [...new Set(filiaisDoRelatorio)].forEach(filial => {
         const plano = faturas[filial]?.plano || sysConfig.planos?.[filial] || 'FREE';
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
    <div className="dev-tela-scroll finance-core">
      <header className="finance-header">
        <div>
          <span className="finance-eyebrow"><Receipt size={14} /> Receita e cobrança SaaS</span>
          <h2>Core Financeiro</h2>
          <p>Conciliação do ciclo, aging da carteira e operação de cobrança em uma visão única.</p>
        </div>
        <div className="finance-header-actions">
          <span className="finance-live-status"><i /> Dados consolidados</span>
          {financeOverview.generatedAt && <small>Atualizado às {new Date(financeOverview.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>}
          <button className="finance-icon-button" title="Atualizar dados" onClick={carregarDadosFinanceiros} disabled={isLoadingFinanceiro}>
            <RefreshCw size={17} className={isLoadingFinanceiro ? 'spin' : ''} />
          </button>
          <button className={`finance-icon-button ${showPricing ? 'active' : ''}`} title="Configurar precificação" onClick={() => setShowPricing(value => !value)}>
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      {showPricing && (
        <section className="finance-pricing-panel">
          <div className="finance-section-heading">
            <div><Settings2 size={18} /><span>Precificação e políticas do ciclo</span></div>
            <small>Parâmetros usados nas simulações e documentos locais</small>
          </div>
          <div className="billing-config-grid">
            <div className="config-box"><label>Plano PRO (R$)</label><div className="config-input-wrapper"><DollarSign size={14} /><input type="number" step="0.1" value={billingSetup.pro} onChange={(e) => updateSetup('pro', e.target.value)} /></div></div>
            <div className="config-box"><label>Plano ENTERPRISE (R$)</label><div className="config-input-wrapper"><DollarSign size={14} /><input type="number" step="0.1" value={billingSetup.ent} onChange={(e) => updateSetup('ent', e.target.value)} /></div></div>
            <div className="config-box"><label>Dia de vencimento</label><div className="config-input-wrapper"><Calendar size={14} /><input type="number" min="1" max="31" value={billingSetup.diaVencimento} onChange={(e) => updateSetup('diaVencimento', e.target.value)} /></div></div>
            <div className="config-box"><label>Multa por atraso (%)</label><div className="config-input-wrapper"><Percent size={14} /><input type="number" step="0.1" value={billingSetup.multa} onChange={(e) => updateSetup('multa', e.target.value)} /></div></div>
            <div className="config-box"><label>Juros ao mês (%)</label><div className="config-input-wrapper"><Percent size={14} /><input type="number" step="0.1" value={billingSetup.juros} onChange={(e) => updateSetup('juros', e.target.value)} /></div></div>
          </div>
        </section>
      )}

      <section className="finance-kpi-grid" aria-label="Indicadores financeiros do ciclo">
        <article className="finance-kpi is-billed">
          <span><Receipt size={16} /> Faturado no ciclo</span>
          <strong>R$ {metricasFinanceiras.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          <small>{metricasFinanceiras.total} faturas · ARPU de R$ {metricasFinanceiras.arpu.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</small>
        </article>
        <article className="finance-kpi is-received">
          <span><CheckCircle2 size={16} /> Receita recebida</span>
          <strong>R$ {metricasFinanceiras.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          <small>{metricasFinanceiras.collectionRate.toFixed(1)}% de eficiência de cobrança</small>
        </article>
        <article className="finance-kpi is-open">
          <span><Clock size={16} /> Contas a receber</span>
          <strong>R$ {metricasFinanceiras.aberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          <small>{metricasFinanceiras.devendo} títulos ainda não liquidados</small>
        </article>
        <article className="finance-kpi is-overdue">
          <span><AlertTriangle size={16} /> Carteira vencida</span>
          <strong>R$ {metricasFinanceiras.inadimplencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          <small>{metricasFinanceiras.taxaInadimplencia.toFixed(1)}% das faturas do ciclo</small>
        </article>
      </section>

      <section className="finance-analytics-grid">
        <article className="finance-chart-panel">
          <div className="finance-section-heading">
            <div><LineChart size={18} /><span>Receita dos últimos ciclos</span></div>
            <small>Faturado x efetivamente recebido</small>
          </div>
          <div className="finance-chart-wrap">
            <ResponsiveContainer width="100%" height={260} minWidth={0}>
              <AreaChart data={dadosGraficoReceita} margin={{ top: 15, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="financeBilled" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--info)" stopOpacity={0.25} /><stop offset="95%" stopColor="var(--info)" stopOpacity={0} /></linearGradient>
                  <linearGradient id="financeReceived" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--success)" stopOpacity={0.24} /><stop offset="95%" stopColor="var(--success)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} width={58} tickFormatter={(value) => `R$${Math.round(value / 1000)}k`} />
                <RechartsTooltip contentStyle={{ background: '#0b1220', border: '1px solid #25324a', borderRadius: '8px', color: 'white', fontSize: '12px' }} formatter={(value, name) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, name === 'billed' ? 'Faturado' : 'Recebido']} />
                <Area type="monotone" dataKey="billed" stroke="var(--info)" strokeWidth={2} fill="url(#financeBilled)" />
                <Area type="monotone" dataKey="received" stroke="var(--success)" strokeWidth={2} fill="url(#financeReceived)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="finance-chart-legend"><span className="is-billed">Faturado</span><span className="is-received">Recebido</span></div>
        </article>

        <article className="finance-aging-panel">
          <div className="finance-section-heading">
            <div><CalendarMinus size={18} /><span>Aging da carteira</span></div>
            <small>Exposição por faixa de vencimento</small>
          </div>
          <div className="finance-aging-list">
            {financeOverview.aging?.length ? financeOverview.aging.map((bucket) => {
              const maxAmount = Math.max(...financeOverview.aging.map(item => Number(item.amount || 0)), 1);
              return (
                <div className="finance-aging-item" key={bucket.bucket}>
                  <div><span>{bucket.bucket}</span><strong>R$ {Number(bucket.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
                  <div className="finance-aging-track"><i style={{ width: `${Math.max(3, (Number(bucket.amount || 0) / maxAmount) * 100)}%` }} /></div>
                  <small>{bucket.invoices} {bucket.invoices === 1 ? 'fatura' : 'faturas'}</small>
                </div>
              );
            }) : <div className="finance-empty">Nenhum valor pendente no ciclo atual.</div>}
          </div>
        </article>
      </section>

      <section className="finance-ledger-panel">
        <div className="finance-ledger-header">
          <div className="finance-section-heading">
            <div><FileSpreadsheet size={18} /><span>Razão de faturas</span>{isLoadingFinanceiro && <Loader2 size={15} className="spin" />}</div>
            <small>{filiaisFinanceiras.length} de {metricasFinanceiras.total} títulos exibidos</small>
          </div>
          <div className="finance-ledger-actions">
            <button className="btn btn-outline" onClick={gerarCSVRelatorio}><DownloadCloud size={15} /> Exportar DRE</button>
            <button className="btn btn-primary" onClick={dispararCobrancaEmLote}><RefreshCw size={15} /> Processar lote</button>
          </div>
        </div>

        <div className="finance-ledger-tools">
          <label className="finance-search"><Search size={16} /><input value={buscaFinanceira} onChange={(event) => setBuscaFinanceira(event.target.value)} placeholder="Buscar organização" /></label>
          <div className="finance-status-tabs" role="tablist" aria-label="Filtrar faturas por status">
            <button className={filtroStatus === 'ALL' ? 'active' : ''} onClick={() => setFiltroStatus('ALL')}>Todas</button>
            <button className={filtroStatus === 'PAGO' ? 'active' : ''} onClick={() => setFiltroStatus('PAGO')}>Pagas</button>
            <button className={filtroStatus === 'PENDENTES' ? 'active' : ''} onClick={() => setFiltroStatus('PENDENTES')}>Pendentes</button>
            <button className={filtroStatus === 'ATRASADAS' ? 'active' : ''} onClick={() => setFiltroStatus('ATRASADAS')}>Atrasadas</button>
          </div>
        </div>

        <div className="finance-table-scroll">
          <div className="finance-table-header">
            <div>Cliente pagador</div><div>Plano e vencimento</div><div>Encargos</div><div>Total</div><div>Status</div><div>Ações</div>
          </div>
          <div className="finance-table-body">
            {filiaisFinanceiras.map((filial, index) => {
              const planoAtual = faturas[filial]?.plano || sysConfig.planos?.[filial] || 'FREE';
              const fatura = getDetalhesFatura(filial, planoAtual, planoAtual === 'SUSPENSO');
              if (!fatura) return null;

              const isLate = fatura.status === 'VENCIDA' || fatura.status === 'ATRASADA';

              return (
                <div className={`finance-table-row ${isLate ? 'is-late' : ''}`} key={`${filial}-${index}`}>
                  <div className="finance-client-cell">
                    <strong>{filial}</strong>
                    <span>{fatura.empresa || fatura.email || 'Conta SaaS ativa'}</span>
                  </div>
                  <div className="finance-plan-cell">
                    <strong>{planoAtual} · R$ {fatura.base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    <span><Calendar size={12}/> Vencimento {fatura.dataVenc}</span>
                  </div>
                  <div className={`finance-money-cell ${isLate ? 'danger' : ''}`}>R$ {(fatura.multa + fatura.juros).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className="finance-total-cell">R$ {fatura.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className="finance-status-cell">
                    <span className={`finance-status is-${String(fatura.status).toLowerCase()}`}>{fatura.status}</span>
                    <small>Via {fatura.metodo}{isLate && fatura.diasDeAtraso > 0 ? ` · ${fatura.diasDeAtraso}d` : ''}</small>
                  </div>
                  <div className="finance-row-actions">
                    <button title="Abrir histórico" onClick={() => abrirHistorico(filial, fatura)}><History size={16} /></button>
                    {!fatura.foiPaga && <button className="success" title="Confirmar pagamento" onClick={() => confirmarPagamento(filial)}><CheckCircle2 size={16} /></button>}
                    {!fatura.foiPaga && !isLate && <button className="warning" title="Simular atraso" onClick={() => forcarFaturaAtrasada(filial)}><CalendarMinus size={16} /></button>}
                    <button title="Gerar nota fiscal em PDF" onClick={() => gerarNotaFiscalPDF(filial, fatura)} disabled={isGenerating !== null}>
                      {isGenerating === `NFe_${filial}` ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
                    </button>
                    <button title="Gerar boleto em PDF" onClick={() => gerarBoletoPDF(filial, fatura)} disabled={isGenerating !== null}>
                       {isGenerating === `Boleto_${filial}` ? <Loader2 size={16} className="spin" /> : <Banknote size={16} />}
                    </button>
                    {isLate && !fatura.foiPaga && (
                      <button className="danger" title="Enviar cobrança por e-mail" onClick={() => notificarCobranca(filial, fatura)}><Mail size={16} /></button>
                    )}
                  </div>
                </div>
              );
            })}
            {!isLoadingFinanceiro && filiaisFinanceiras.length === 0 && <div className="finance-empty"><Search size={22} />Nenhuma fatura corresponde aos filtros.</div>}
          </div>
        </div>
      </section>

      {/* Modal Histórico Financeiro */}
      {modalHistorico && createPortal(
        <div className="iam-modal-overlay finance-history-overlay">
          <div className="iam-modal-content finance-history-modal" style={{ maxWidth: '650px' }}>
            <div className="iam-modal-header" style={{ background: 'rgba(234, 179, 8, 0.1)', borderBottom: '1px solid rgba(234, 179, 8, 0.3)' }}>
               <h3 style={{ color: 'var(--warning)' }}><History size={20}/> Extrato: {modalHistorico.nome}</h3>
               <button className="btn-close-modal" onClick={() => setModalHistorico(null)} style={{background: 'transparent', border: 'none', color: 'white', cursor: 'pointer'}}><X size={20}/></button>
            </div>
            <div className="iam-modal-body" style={{ padding: '0' }}>
               <div className="saas-table-header" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', margin: 0, borderRadius: 0, padding: '15px' }}>
                  <div>Competência</div><div>Valor total</div><div style={{textAlign: 'right'}}>Liquidação</div>
               </div>

               {historicoLoading ? (
                 <div className="finance-empty"><Loader2 size={20} className="spin" /> Carregando extrato...</div>
               ) : historicoFinanceiro.length ? historicoFinanceiro.map((item) => (
                 <div className="finance-history-row" key={item.id}>
                   <div><FileText size={14} /><strong>{item.competencia}</strong><small>Venc. {new Date(item.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</small></div>
                   <strong>R$ {Number(item.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                   <div><span className={`finance-status is-${String(item.status).toLowerCase()}`}>{item.status}</span><small>{item.paidAt ? `Liquidada em ${new Date(item.paidAt).toLocaleDateString('pt-BR')}` : 'Aguardando liquidação'}</small></div>
                 </div>
               )) : (
                 <div className="finance-empty"><History size={22} /> Nenhuma fatura persistida para esta organização.</div>
               )}
            </div>
            <div className="iam-modal-footer"><button type="button" className="btn btn-outline w-100" onClick={() => setModalHistorico(null)}>Fechar Extrato</button></div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

/**
 * ============================================================================ TELA SOC &
 * GESTÃO DE IDENTIDADE (IAM / ZERO-TRUST)
 * ============================================================================
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.addLog - Propriedade addLog usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.usuariosLista - Propriedade usuariosLista usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const TelaSOC = ({ api, showToast, addLog, setModalConfig, usuariosLista }) => {
  // SOC: auditoria e resposta de segurança. Reúne sessões, eventos sensíveis,
  // revogações e trilhas de auditoria.
  const [activeSessions, setActiveSessions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [securityStatus, setSecurityStatus] = useState(null);
  const [socOverview, setSocOverview] = useState({ timeline: [], topIps: [], eventTypes: [], roleSessions: [], auditIntegrity: null });
  const [socUsers, setSocUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [eventSeverity, setEventSeverity] = useState('ALL');
  const [investigationView, setInvestigationView] = useState('events');
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [isModalUserOpen, setIsModalUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ nome: '', email: '', role: 'LOJA', mfa: true });

  const carregarDadosSOC = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [resSessoes, resAuditoria, resSecurityEvents, resSecurityStatus, resOverview, resUsers] = await Promise.all([
        api.get('/soc/sessoes'),
        api.get('/soc/auditoria'),
        api.get('/soc/security-events'),
        api.get('/security/status'),
        api.get('/soc/overview'),
        api.get('/usuarios')
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
      setSocOverview(resOverview.data);
      setSocUsers(Array.isArray(resUsers.data) ? resUsers.data : []);
      setLastUpdated(new Date());
    } catch (error) {
      addLog(`[SOC ERRO] Falha ao carregar sessões e auditoria: ${error?.message || 'erro desconhecido'}`, 'error');
    } finally { setIsLoading(false); }
  }, [api, addLog]);

  useEffect(() => { carregarDadosSOC(); const interval = setInterval(() => carregarDadosSOC(true), 15000); return () => clearInterval(interval); }, [carregarDadosSOC]);

  const diretorioUsuarios = useMemo(() => {
    return (socUsers.length ? socUsers : (usuariosLista || [])).map(u => {
      const session = activeSessions.find(s => s.usuario === u.usuario);
      return { id: u.id, nome: u.nome_tecnico || u.nome_gerente || u.nome_coordenador || u.usuario, usuario: u.usuario, role: u.role, cargo: u.role === 'DEV' ? 'SysAdmin' : (u.role === 'ADMIN' ? 'Administrador' : (u.role === 'MANUTENCAO' ? 'Técnico' : 'Operador')), mfa: Boolean(u.mfa_enabled), mfaRequired: Boolean(u.mfa_required), status: u.security_blocked ? 'BLOQUEADO' : 'ATIVO', ip: session ? (session.ip === '::1' ? 'Localhost' : session.ip) : 'Offline' };
    });
  }, [usuariosLista, socUsers, activeSessions]);

  const filteredUsuarios = diretorioUsuarios.filter(u => u.nome.toLowerCase().includes(buscaUsuario.toLowerCase()) || u.role.toLowerCase().includes(buscaUsuario.toLowerCase()) || u.cargo.toLowerCase().includes(buscaUsuario.toLowerCase()));
  const contasAtivas = diretorioUsuarios.filter(u => u.status === 'ATIVO').length;
  const tokensValidos = activeSessions.length;
  const tentativasFalhadas = securityStatus?.metrics?.failedLogins24h ?? securityEvents.filter(l => l.eventType === 'LOGIN_FAILED').length;
  const checksFalhos = securityStatus?.checks?.filter(check => !check.ok && check.severity !== 'info') || [];
   /**
    * Concentra a logica de danger events24h para manter o restante do tela mais legivel.
    *
    * Responsabilidade: mantém este comportamento isolado para que validação,
    * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
    *
    * Fluxo principal:
    * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
    *
    * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
    *
    * @param {unknown} item - Valor de item consumido por esta rotina.
    * @returns {unknown} Resultado calculado para consumo do chamador.
    * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
    */

  /**
   * Concentra a logica de danger events24h para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} item - Valor de item consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const dangerEvents24h = (socOverview.timeline || []).reduce((sum, item) => sum + Number(item.danger || 0), 0);
   /**
    * Concentra a logica de total events24h para manter o restante do tela mais legivel.
    *
    * Responsabilidade: mantém este comportamento isolado para que validação,
    * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
    *
    * Fluxo principal:
    * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
    *
    * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
    *
    * @param {unknown} item - Valor de item consumido por esta rotina.
    * @returns {unknown} Resultado calculado para consumo do chamador.
    * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
    */

  /**
   * Concentra a logica de total events24h para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} item - Valor de item consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const totalEvents24h = (socOverview.timeline || []).reduce((sum, item) => sum + Number(item.total || 0), 0);
  const mfaCoverage = securityStatus?.metrics?.usersTotal ? Math.round((securityStatus.metrics.mfaEnabled / securityStatus.metrics.usersTotal) * 100) : 0;
  const riskScore = Math.min(100, (checksFalhos.length * 12) + (dangerEvents24h * 4) + (tentativasFalhadas * 2));
   /**
    * Concentra a logica de filtered evidence para manter o restante do tela mais legivel.
    *
    * Responsabilidade: mantém este comportamento isolado para que validação,
    * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
    *
    * Fluxo principal:
    * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
    *
    * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
    *
    * @param {unknown} investigationView - Valor de investigation view consumido por esta rotina.
    * @returns {unknown} Resultado calculado para consumo do chamador.
    * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
    */

  /**
   * Concentra a logica de filtered evidence para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} investigationView - Valor de investigation view consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const filteredEvidence = (investigationView === 'events' ? securityEvents : auditLogs).filter((item) => {
    const query = eventSearch.trim().toLowerCase();
    const severity = item.severity || 'info';
    const matchesSeverity = eventSeverity === 'ALL' || severity === eventSeverity;
    const text = investigationView === 'events'
      ? [item.eventType, item.actor, item.ip, item.detail].join(' ').toLowerCase()
      : [item.action, item.actor, item.target].join(' ').toLowerCase();
    return matchesSeverity && (!query || text.includes(query));
  });


  /**
   * Processa a interacao de handle revoke e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @param {object} user - Usuário autenticado ou candidato à autenticação processado por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleRevoke = (id, user) => { setModalConfig({ isOpen: true, title: 'Revogar Acesso JWT', message: `Deseja realmente derrubar a ligação de ${user}?`, onConfirm: async () => { try { await api.post(`/soc/revogar/${id}`); setActiveSessions(prev => prev.filter(s => s.id !== id)); showToast(`Sessão encerrada.`, 'success'); addLog(`[SOC] Sessão forçada ao encerramento: ${user}`, 'error'); carregarDadosSOC(); } catch (e) { showToast('Erro ao revogar sessão.', 'error'); } } }); };

  /**
   * Processa a interacao de handle revoke all e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleRevokeAll = () => { setModalConfig({ isOpen: true, title: 'Purga Global de Sessões (Kill-Switch)', message: `ATENÇÃO: Isto irá invalidar TODOS os tokens JWT ativos, exceto a sessão atual. Proceder?`, onConfirm: async () => { try { const res = await api.post('/soc/revogar-todas'); setActiveSessions([]); showToast(`${res.data?.revoked || 0} sessões terminadas.`, 'success'); addLog('[SECURITY] Kill-switch ativado.', 'error'); carregarDadosSOC(); } catch (e) { showToast('Erro ao revogar sessões.', 'error'); } } }); };

  /**
   * Processa a interacao de handle block action e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @param {unknown} nome - Valor de nome consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleBlockAction = (id, nome) => {
    const user = diretorioUsuarios.find((item) => item.id === id);
    const blocked = user?.status !== 'BLOQUEADO';
    setModalConfig({
      isOpen: true,
      title: blocked ? 'Bloquear identidade' : 'Liberar identidade',
      message: blocked ? `Bloquear ${nome} e encerrar todas as sessões ativas?` : `Liberar novamente o acesso de ${nome}?`,
      onConfirm: async () => {
        try {
          const response = await api.patch(`/soc/users/${id}/security`, { blocked });
          showToast(blocked ? `Usuário bloqueado; ${response.data.revoked} sessão(ões) encerradas.` : 'Usuário desbloqueado.', blocked ? 'warning' : 'success');
          addLog(`[IAM] ${nome} ${blocked ? 'bloqueado' : 'desbloqueado'} pelo SOC.`, blocked ? 'error' : 'success');
          await carregarDadosSOC(true);
        } catch (error) {
          showToast(error.response?.data?.error || 'Falha ao atualizar a identidade.', 'error');
        }
      }
    });
  };


  /**
   * Concentra a logica de salvar novo usuario para manter o restante do tela mais legivel.
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
   * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const salvarNovoUsuario = async (e) => {
    e.preventDefault(); if (!newUser.nome.trim() || !newUser.email.trim()) return showToast('Nome e e-mail são obrigatórios.', 'error');
    try { await api.post('/usuarios', { usuario: newUser.email.split('@')[0], senha: 'Mudar@123', role: newUser.role, nome_tecnico: newUser.role === 'MANUTENCAO' ? newUser.nome : null, nome_gerente: newUser.role === 'LOJA' ? newUser.nome : null, filial: 'Matriz' }); addLog(`[IAM] Nova credencial provisionada: ${newUser.nome}`, 'success'); showToast('Criado! Senha: Mudar@123', 'success'); setIsModalUserOpen(false); setNewUser({ nome: '', email: '', role: 'LOJA', mfa: true }); carregarDadosSOC(true); } catch (err) { showToast('Erro ao gravar na BD.', 'error'); }
  };

  return (
    <>
      <div className="dev-tela-scroll soc-center anim-fade-in">
        <header className="soc-page-header anim-stagger-1">
          <div><span className="soc-eyebrow"><ShieldCheck size={14} /> Centro de operações de segurança</span><h2>Auditoria e SOC</h2><p>Monitore identidades, sessões, controles preventivos e evidências da plataforma em tempo real.</p></div>
          <div className="soc-header-actions"><span><i className="soc-live-dot" />Atualização contínua</span>{lastUpdated && <small>{lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>}<button type="button" className="btn-icon-small" title="Atualizar SOC" onClick={() => carregarDadosSOC()} disabled={isLoading}><RefreshCw size={17} className={isLoading ? 'spin' : ''} /></button></div>
        </header>

        <section className="soc-kpi-grid anim-stagger-1">
          <article><span><Users size={15}/> Identidades ativas</span><strong>{contasAtivas}</strong><small>{mfaCoverage}% com MFA habilitado</small></article>
          <article><span><FingerprintIcon size={15}/> Sessões válidas</span><strong>{tokensValidos}</strong><small>{securityStatus?.metrics?.revokedSessions || 0} revogadas no histórico</small></article>
          <article className={dangerEvents24h ? 'is-warning' : ''}><span><ShieldAlert size={15}/> Eventos críticos</span><strong>{dangerEvents24h}</strong><small>{totalEvents24h} eventos nas últimas 24h</small></article>
          <article className={riskScore >= 60 ? 'is-danger' : riskScore >= 25 ? 'is-warning' : ''}><span><Gauge size={15}/> Exposição calculada</span><strong>{riskScore}/100</strong><small>{checksFalhos.length} controle(s) pedindo atenção</small></article>
        </section>

        <section className="soc-overview-grid anim-stagger-2">
          <div className="soc-chart-panel">
            <div className="soc-section-heading"><div><Activity size={17}/><span>Eventos nas últimas 24 horas</span></div><small>Falhas, alertas e operações confirmadas</small></div>
            <div className="soc-chart-wrap">
              {socOverview.timeline?.length ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}><AreaChart data={socOverview.timeline}><defs><linearGradient id="socDanger" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--danger)" stopOpacity={0.45}/><stop offset="100%" stopColor="var(--danger)" stopOpacity={0}/></linearGradient><linearGradient id="socWarning" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--warning)" stopOpacity={0.35}/><stop offset="100%" stopColor="var(--warning)" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.12)"/><XAxis dataKey="bucket" tickFormatter={(value) => `${String(value).slice(11, 13)}h`} tick={{ fill: 'var(--text-muted)', fontSize: 10 }}/><YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }}/><RechartsTooltip contentStyle={{ background: 'var(--technical-canvas)', border: '1px solid #334155', borderRadius: 6 }}/><Area type="monotone" dataKey="danger" name="Críticos" stroke="var(--danger)" fill="url(#socDanger)"/><Area type="monotone" dataKey="warning" name="Alertas" stroke="var(--warning)" fill="url(#socWarning)"/></AreaChart></ResponsiveContainer> : <div className="soc-empty-state"><Activity size={22}/><span>Sem eventos no período.</span></div>}
            </div>
          </div>
          <div className="soc-intelligence-panel">
            <div className="soc-section-heading"><div><Network size={17}/><span>Origens observadas</span></div><small>Ordenadas por criticidade</small></div>
            <div className="soc-source-list">{socOverview.topIps?.length ? socOverview.topIps.slice(0, 5).map((source) => <div key={source.ip}><span>{source.ip}</span><div><i style={{ width: `${Math.min(100, source.events * 8)}%` }} /></div><strong>{source.events}</strong><small>{source.danger} críticas</small></div>) : <div className="soc-empty-state"><Network size={20}/><span>Nenhuma origem registrada.</span></div>}</div>
            <div className={`soc-integrity ${socOverview.auditIntegrity?.ok ? 'is-ok' : 'is-alert'}`}>{socOverview.auditIntegrity?.ok ? <ShieldCheck size={18}/> : <AlertTriangle size={18}/>}<div><strong>{socOverview.auditIntegrity?.ok ? 'Continuidade da auditoria preservada' : `${socOverview.auditIntegrity?.brokenLinks || 0} descontinuidade(s) detectada(s)`}</strong><small>{socOverview.auditIntegrity?.verifiedRecords || 0} registros encadeados inspecionados</small></div></div>
          </div>
        </section>
        {securityStatus && (
          <div className="dev-card glass-card" style={{ flexShrink: 0, borderTop: `4px solid ${checksFalhos.length ? 'var(--warning)' : 'var(--success)'}`, marginBottom: '12px' }}>
            <div className="dev-card-header flex-between" style={{ marginBottom: '12px', color: checksFalhos.length ? 'var(--warning)' : 'var(--success)', flexWrap: 'wrap', gap: '10px' }}>
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
                <div key={check.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${check.ok ? 'color-mix(in srgb, var(--success) 30%, transparent)' : 'rgba(245,158,11,0.35)'}`, background: check.ok ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)' }}>
                  {check.ok ? <CheckCircle2 size={15} color="var(--success)" /> : <AlertTriangle size={15} color="var(--warning)" />}
                  <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 800 }}>{check.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dev-grid-main soc-data-grid anim-stagger-2" style={{ flex: 1, minHeight: 0 }}>
          <div className="dev-col-left" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div className="dev-card glass-card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid var(--info)', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="dev-card-header flex-between" style={{color: 'var(--info)', padding: '1.5rem', marginBottom: 0, flexWrap: 'wrap'}}>
                <div style={{display:'flex', gap:'8px', alignItems:'center', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap'}}>
                  <div style={{display:'flex', gap:'8px', alignItems:'center'}}><UserCog size={20}/><h3>Diretório (AD)</h3><span className="soc-table-count">{filteredUsuarios.length}</span></div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                    <div className="iam-search-box"><Search size={14} color="var(--text-muted)" /><input type="text" placeholder="Procurar usuário..." value={buscaUsuario} onChange={e => setBuscaUsuario(e.target.value)} /></div>
                    <button className="btn btn-outline" onClick={() => setIsModalUserOpen(true)} style={{padding: '8px 12px', fontSize: '0.75rem', borderColor: 'color-mix(in srgb, var(--info) 30%, transparent)', color: 'var(--info)', minHeight: '34px'}}><UserPlus size={14} style={{marginRight: '6px'}}/> Novo</button>
                  </div>
                </div>
              </div>
              <div className="flex-table-container">
                <div className="flex-table-content">
                  <div className="saas-table-header iam-ad-grid-cols" style={{ position: 'sticky', top: 0, zIndex: 10, margin: '0 0 4px 0', background: 'rgba(11, 17, 32, 0.95)' }}><div>Usuário / Cargo</div><div>Role do Sistema</div><div>Status / MFA</div><div>Último IP</div><div style={{textAlign: 'right'}}>Ações</div></div>
                  {filteredUsuarios.map((u) => (
                    <div key={u.id} className={`saas-client-row iam-ad-grid-cols ${u.status === 'BLOQUEADO' ? 'row-suspended' : ''}`} style={{ margin: 0 }}>
                      <div className="user-profile-cell"><div className={`user-avatar ${u.role.toLowerCase()}`}>{u.nome.charAt(0)}</div><div style={{minWidth: 0}}><div className="text-truncate soc-primary-text" title={u.nome}>{u.nome}</div><div className="text-truncate soc-secondary-text" title={u.cargo}>{u.cargo}</div></div></div>
                      <div><span className={`role-badge ${u.role.toLowerCase()}`}>{u.role}</span></div>
                      <div>{u.status === 'BLOQUEADO' ? <span className="badge-mfa mfa-danger"><LockKeyhole size={12}/> BLOQUEADO</span> : u.mfa ? <span className="badge-mfa mfa-on"><ShieldCheck size={12}/> MFA ATIVO</span> : <span className="badge-mfa mfa-off"><ShieldAlert size={12}/> SEM MFA</span>}</div>
                      <div className="soc-ip-text">{u.ip} {u.ip !== 'Offline' && <span className="traffic-indicator-live" style={{marginLeft: '4px'}}></span>}</div>
                      <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px'}}><button className={`btn-icon-small ${u.status === 'BLOQUEADO' ? 'success-text' : 'danger-text'}`} title={u.status === 'BLOQUEADO' ? "Desbloquear Conta" : "Bloquear Conta"} onClick={() => handleBlockAction(u.id, u.nome)}>{u.status === 'BLOQUEADO' ? <Unlock size={16} color="var(--success)" /> : <UserX size={16} />}</button></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="dev-col-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div className="dev-card glass-card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid var(--accent-violet)', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="dev-card-header flex-between" style={{color: 'var(--accent-violet)', padding: '1.5rem', marginBottom: 0, flexWrap: 'wrap'}}><div style={{display:'flex', gap:'8px', alignItems:'center'}}><FingerprintIcon size={20}/><h3>Sessões JWT (Live)</h3><span className="soc-table-count">{activeSessions.length}</span></div>
                {activeSessions.length > 0 && <button className="btn btn-outline danger-text" onClick={handleRevokeAll} style={{padding: '8px 12px', fontSize: '0.75rem', borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)', color: 'var(--danger)', minHeight: '34px'}}><ShieldBan size={14} style={{marginRight: '6px'}}/> Revogar Tudo</button>}
              </div>
              <div className="flex-table-container">
                <div className="flex-table-content">
                  <div className="saas-table-header soc-grid-cols" style={{ position: 'sticky', top: 0, zIndex: 10, margin: '0 0 4px 0', background: 'rgba(11, 17, 32, 0.95)' }}><div>Usuário (Token)</div><div>IP / Device</div><div>Ciclo de Vida</div><div style={{textAlign: 'right'}}>Ação</div></div>
                  {activeSessions.map((s) => (
                    <div key={s.id} className="saas-client-row soc-grid-cols" style={{ margin: 0 }}>
                      <div><div className="text-truncate soc-primary-text" title={s.usuario}>{s.usuario}</div><div className="soc-role-text">{s.role}</div></div>
                      <div><div className="soc-ip-text">{s.ip === '::1' ? 'Localhost' : s.ip}</div><div className="soc-device-text"><MonitorSmartphone size={11}/><span className="text-truncate" title={s.device}>{s.device}</span></div></div>
                      <div style={{paddingRight: '15px', paddingTop: '4px'}}><div className="progress-bar-bg" style={{marginTop: 0}}><div className="progress-bar-fill" style={{ width: `${s.expirationPercent}%`, backgroundColor: s.expirationPercent < 20 ? 'var(--danger)' : 'var(--accent-violet)' }}></div></div><div style={{fontSize: '0.7rem', color: 'var(--dim-text)', display: 'flex', justifyContent: 'space-between', marginTop: '4px'}}><span>Expira em</span><span style={{fontFamily: 'Montserrat'}}>{s.expirationMin} min</span></div></div>
                      <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center'}}><button className="btn-icon-small danger-text" title="Derrubar Ligação" onClick={() => handleRevoke(s.id, s.usuario)}><Power size={18} /></button></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="dev-card glass-card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid var(--warning)', display: 'flex', flexDirection: 'column', flex: 0.75, minHeight: 220, marginTop: '12px' }}>
              <div className="dev-card-header flex-between" style={{color: 'var(--warning)', padding: '1.25rem', marginBottom: 0, flexWrap: 'wrap'}}>
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
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{event.ip || 'IP desconhecido'}</span>
                      </div>
                      {event.detail && <div className="text-truncate" style={{ marginTop: '4px', fontSize: '0.78rem', color: '#cbd5e1' }}>{event.detail}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="soc-investigation-panel anim-stagger-2">
          <div className="soc-investigation-header">
            <div className="soc-section-heading"><div><Search size={17}/><span>Investigação e evidências</span></div><small>{filteredEvidence.length} registro(s) no recorte atual</small></div>
            <div className="soc-investigation-tabs"><button type="button" className={investigationView === 'events' ? 'active' : ''} onClick={() => { setInvestigationView('events'); setSelectedEvidence(null); }}>Eventos estruturados</button><button type="button" className={investigationView === 'audit' ? 'active' : ''} onClick={() => { setInvestigationView('audit'); setSelectedEvidence(null); }}>Auditoria Zero-Trust</button></div>
          </div>
          <div className="soc-investigation-tools">
            <div className="iam-search-box"><Search size={15}/><input value={eventSearch} onChange={(event) => setEventSearch(event.target.value)} placeholder="Buscar tipo, ator, IP ou detalhe" /></div>
            <label><Filter size={14}/><select value={eventSeverity} onChange={(event) => setEventSeverity(event.target.value)}><option value="ALL">Todas as severidades</option><option value="danger">Crítica</option><option value="warning">Alerta</option><option value="success">Sucesso</option><option value="info">Informativa</option></select></label>
          </div>
          {selectedEvidence && <div className="soc-evidence-detail"><div><span>Evidência selecionada</span><strong>{selectedEvidence.eventType || selectedEvidence.action}</strong></div><p>{selectedEvidence.detail || selectedEvidence.target || 'Sem detalhe adicional.'}</p><dl><div><dt>Ator</dt><dd>{selectedEvidence.actor || 'Não identificado'}</dd></div><div><dt>Origem</dt><dd>{selectedEvidence.ip || 'Não registrada'}</dd></div><div><dt>Data</dt><dd>{selectedEvidence.time}</dd></div><div><dt>Severidade</dt><dd>{selectedEvidence.severity}</dd></div></dl><button type="button" title="Fechar evidência" onClick={() => setSelectedEvidence(null)}><X size={16}/></button></div>}
          <div className="soc-evidence-list">
            {filteredEvidence.length === 0 ? <div className="soc-empty-state"><Search size={22}/><span>Nenhuma evidência corresponde aos filtros.</span></div> : filteredEvidence.map((item, index) => (
              <button type="button" key={`${item.createdAt || item.time}-${index}`} className={`soc-evidence-row severity-${item.severity || 'info'}`} onClick={() => setSelectedEvidence(item)}>
                <span className="soc-evidence-time">{item.time}</span>
                <span className="soc-evidence-type">{item.eventType || item.action}</span>
                <span className="soc-evidence-actor">{item.actor || 'Sistema'}</span>
                <span className="soc-evidence-origin">{item.ip || item.target || 'Sem origem'}</span>
                <span className="soc-evidence-severity">{item.severity || 'info'}</span>
              </button>
            ))}
          </div>
        </section>
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

/**
 * ============================================================================ 9. TELA BI E
 * RELATÓRIOS ============================================================================
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.addLog - Propriedade addLog usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.sysConfig - Propriedade sysConfig usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.filiaisDb - Propriedade filiaisDb usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const TelaBI = ({ api, showToast, addLog: _addLog, sysConfig, filiaisDb }) => {
  // BI executivo: consolida métricas de sistema, filiais e recursos habilitados
  // para análise do ambiente SaaS.
  const [isProcessing, setIsProcessing] = useState(null);


  /**
   * Concentra a logica de processar dados relatorio para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: consulta ou altera dados pela API
   *
   * @param {unknown} tipo - Valor de tipo consumido por esta rotina.
   * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {unknown} tipo - Valor de tipo consumido por esta rotina.
   * @param {unknown} tema - Valor de tema consumido por esta rotina.
   * @param {unknown} cor - Valor de cor consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador
   *
   * @param {unknown} tipo - Valor de tipo consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
    { id: 'FINOPS_BILLING', titulo: 'Core Financeiro (RevOps)', desc: 'Relação completa de MRR, dívidas e faturas.', icon: DollarSign, color: 'var(--success)' },
    { id: 'AUDITORIA_SOC', titulo: 'Auditoria Zero-Trust (SOC)', desc: 'Extrato de logins e purgas de dados.', icon: ShieldCheck, color: 'var(--accent-violet)' },
    { id: 'EDGE_HARDWARE', titulo: 'Inventário Edge Computing', desc: 'Mapeamento global da frota (MAC/Wi-Fi).', icon: Server, color: 'var(--info)' },
    { id: 'SYSOPS_HEALTH', titulo: 'Saúde da Plataforma (SysOps)', desc: 'Métricas vitais do cluster e carga MySQL.', icon: Activity, color: 'var(--accent-violet)' }
  ];

  return (
    <div className="anim-fade-in stagger-1 dev-tela-scroll">
      <div className="flex-header" style={{ padding: 0, background: 'transparent', boxShadow: 'none', marginBottom: '0' }}>
        <div className="dev-card glass-card" style={{ width: '100%', borderTop: '4px solid var(--info)' }}>
          <div className="dev-card-header" style={{ color: 'var(--info)', marginBottom: '5px' }}>
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

/**
 * ============================================================================ 10. TELA DE
 * ATUALIZAÇÕES DO SISTEMA E DEPLOY
 * ============================================================================
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.addLog - Propriedade addLog usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @param {boolean} options.isOverclocked - Sinalizador isOverclocked que controla este comportamento visual.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const TelaAtualizacoes = ({ api, showToast, addLog, setModalConfig, isOverclocked }) => {
  // Atualizações: upload e validação de pacotes de deploy com fluxo protegido
  // para evitar instalação acidental ou pacote fora do padrão.
  const [updates, setUpdates] = useState([]);
  const [newUpdate, setNewUpdate] = useState({
    version: '',
    title: '',
    type: 'feature',
    desc: '',
    targetType: 'FRONTEND',
    passcode: ''
  });
  const [updateFile, setUpdateFile] = useState(null);
  const [fileDetails, setFileDetails] = useState(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState(0);
  const [checkBackup, setCheckBackup] = useState(false);
  const [checkDowntime, setCheckDowntime] = useState(false);
  const [deployments, setDeployments] = useState([]);
  const [deploySummary, setDeploySummary] = useState({ total: 0, successful: 0, failed: 0, processing: 0, lastCompletedAt: null });
  const [environment, setEnvironment] = useState({ health: null, host: null });
  const [isLoadingCenter, setIsLoadingCenter] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deployError, setDeployError] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState('ALL');
  const [historyView, setHistoryView] = useState('deployments');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [environmentConfirmation, setEnvironmentConfirmation] = useState('');
  const [deployCapabilities, setDeployCapabilities] = useState({
    webDeployEnabled: false,
    environment: 'INDEFINIDO',
    requireMfa: false,
    confirmationPhrase: 'DEPLOY INDEFINIDO'
  });

  // Carrega em paralelo ambiente, execuções persistidas e changelog funcional.
  const carregarCentroDeploy = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingCenter(true);
    const [deployResult, changelogResult, healthResult, hostResult] = await Promise.allSettled([
      api.get('/system/deployments'),
      api.get('/system/changelog'),
      api.get('/system/health'),
      api.get('/system/host-info')
    ]);

    if (deployResult.status === 'fulfilled') {
      const deployData = deployResult.value.data || {};
      setDeployments(Array.isArray(deployData.deployments) ? deployData.deployments : []);
      setDeploySummary(deployData.summary || { total: 0, successful: 0, failed: 0, processing: 0, lastCompletedAt: null });
      setDeployCapabilities((current) => ({ ...current, ...(deployData.capabilities || {}) }));
    }
    if (changelogResult.status === 'fulfilled') {
      const changelogData = changelogResult.value.data;
      setUpdates(Array.isArray(changelogData) ? changelogData : (changelogData?.updates || changelogData?.changelog || []));
    }
    setEnvironment({
      health: healthResult.status === 'fulfilled' ? healthResult.value.data : null,
      host: hostResult.status === 'fulfilled' ? hostResult.value.data : null
    });

    const failed = [deployResult, changelogResult, healthResult, hostResult].filter((result) => result.status === 'rejected').length;
    if (failed && !silent) {
      showToast(`Centro de deploy carregado parcialmente (${failed} fonte${failed > 1 ? 's' : ''} indisponível${failed > 1 ? 'is' : ''}).`, 'warning');
    }
    setIsLoadingCenter(false);
  }, [api, showToast]);

  useEffect(() => {
    carregarCentroDeploy();
  }, [carregarCentroDeploy]);

  /**
   * Processa a interacao de handle file select e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
   *
   * @param {unknown} file - Valor de file consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleFileSelect = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      showToast('Selecione um pacote no formato ZIP.', 'error');
      return;
    }
    if (file.size > 75 * 1024 * 1024) {
      showToast('O pacote excede o limite de 75 MB.', 'error');
      return;
    }
    setUpdateFile(file);
    setDeployError('');

    const name = file.name.toLowerCase();
    let detected = newUpdate.targetType || 'FRONTEND';
    let hint = 'Destino mantido conforme seleção manual';

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
      hint,
      checksum: 'Calculando...'
    });

    setNewUpdate((prev) => ({ ...prev, targetType: detected }));
    try {
      const digest = await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const checksum = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      setFileDetails((current) => current ? { ...current, checksum } : current);
    } catch {
      setFileDetails((current) => current ? { ...current, checksum: 'Indisponível neste navegador' } : current);
    }
  };


  /**
   * Processa a interacao de handle deploy e atualiza a interface conforme o resultado.
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
   * @param {Event} e - Evento que iniciou a interação ou mudança de estado.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleDeploy = (e) => {
    e.preventDefault();
    if (!deployCapabilities.webDeployEnabled) {
      return showToast('Deploy pelo painel está desativado neste ambiente.', 'error');
    }
    if (!newUpdate.version || !newUpdate.title || !newUpdate.desc || !newUpdate.passcode || !updateFile || !checkBackup || !checkDowntime || environmentConfirmation.trim().toUpperCase() !== deployCapabilities.confirmationPhrase) {
      return showToast('Preencha os dados e valide o checklist.', 'error');
    }

    setModalConfig({
      isOpen: true,
      title: `INICIAR DEPLOY EM ${deployCapabilities.environment}`,
      message: `O pacote "${updateFile.name}" será aplicado ao alvo [${newUpdate.targetType}] no ambiente ${deployCapabilities.environment}. Um backup do banco será criado antes da extração. Confirmar deploy?`,
      onConfirm: async () => {
        setIsDeploying(true);
        setDeployStep(1);
        setUploadProgress(0);
        setDeployError('');
        addLog(`[CI/CD] Upload de pacote ${newUpdate.targetType} iniciado...`, 'warning');

        const formData = new FormData();
        formData.append('updatePackage', updateFile);
        formData.append('version', newUpdate.version);
        formData.append('title', newUpdate.title);
        formData.append('desc', newUpdate.desc);
        formData.append('type', newUpdate.type);
        formData.append('targetType', newUpdate.targetType);
        formData.append('passcode', newUpdate.passcode);
        formData.append('confirmation', environmentConfirmation.trim());

        try {
          const response = await api.post('/system/deploy-update', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (event) => {
              if (event.total) setUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
            }
          });

          setDeployStep(3);
          addLog(`[CI/CD] Servidor identificou destino: ${response.data?.targetDetected}`, 'info');
          if (response.data?.backupFile) addLog(`[BACKUP] Snapshot pré-deploy criado: ${response.data.backupFile}`, 'success');
          verificarRetornoServidor();
        } catch (error) {
          const message = error.response?.data?.detail || error.response?.data?.error || 'O servidor não conseguiu processar o pacote.';
          setDeployError(message);
          setIsDeploying(false);
          setDeployStep(0);
          setUploadProgress(0);
          addLog(`[CI/CD] Deploy interrompido: ${message}`, 'error');
          showToast(message, 'error');
          carregarCentroDeploy(true);
        }
      }
    });
  };


  /**
   * Concentra a logica de verificar retorno servidor para manter o restante do tela mais legivel.
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
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const finalizarDeploySucesso = () => {
    setDeployStep(5);
    setTimeout(() => {
      carregarCentroDeploy(true);
      setIsDeploying(false);
      setDeployStep(0);
      setNewUpdate({ version: '', title: '', type: 'feature', desc: '', targetType: 'FRONTEND', passcode: '' });
      setUpdateFile(null);
      setFileDetails(null);
      setEnvironmentConfirmation('');
      setCheckBackup(false);
      setCheckDowntime(false);
      setUploadProgress(0);
      setDeployError('');

      showToast('Deploy 100% integrado concluído!', 'success');
      addLog('[CI/CD] Sincronização concluída com Changelog, SOC e WebSockets.', 'success');
    }, 1500);
  };

  const confirmationMatches = environmentConfirmation.trim().toUpperCase() === deployCapabilities.confirmationPhrase;
  const isFormReady = Boolean(deployCapabilities.webDeployEnabled && newUpdate.version && newUpdate.title && newUpdate.desc && newUpdate.passcode && updateFile && checkBackup && checkDowntime && confirmationMatches && environment.health?.ok !== false);
  const successRate = deploySummary.total ? Math.round((deploySummary.successful / deploySummary.total) * 100) : 0;
  const filteredDeployments = deployments.filter((deployment) => {
    const query = historySearch.trim().toLowerCase();
    const matchesSearch = !query || [deployment.version, deployment.title, deployment.target, deployment.package_name, deployment.initiated_by].some((value) => String(value || '').toLowerCase().includes(query));
    return matchesSearch && (historyStatus === 'ALL' || deployment.status === historyStatus);
  });
  const filteredUpdates = updates.filter((update) => {
    const query = historySearch.trim().toLowerCase();
    return !query || [update.version, update.title, update.desc_text, update.author].some((value) => String(value || '').toLowerCase().includes(query));
  });

  /**
   * Formata format bytes para exibicao segura na interface.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} bytes - Valor de bytes consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const formatBytes = (bytes) => {
    const value = Number(bytes || 0);
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  };

  /**
   * Formata format uptime para exibicao segura na interface.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} seconds - Valor de seconds consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const formatUptime = (seconds) => {
    const hours = Math.floor(Number(seconds || 0) / 3600);
    const days = Math.floor(hours / 24);
    return days ? `${days}d ${hours % 24}h` : `${hours}h`;
  };

  return (
    <div className="dev-tela-scroll deploy-center">
      <header className="deploy-page-header anim-stagger-1">
        <div>
          <span className="deploy-eyebrow"><Rocket size={14} /> Engenharia de release</span>
          <h2>Atualizações e Deploy</h2>
          <p>Prepare, publique e audite versões do sistema com validação do artefato e acompanhamento do ambiente.</p>
        </div>
        <button type="button" className="btn-icon-small" title="Atualizar centro de deploy" onClick={() => carregarCentroDeploy()} disabled={isLoadingCenter}>
          <RefreshCw size={18} className={isLoadingCenter ? 'spin' : ''} />
        </button>
      </header>

      <section className="deploy-kpi-grid anim-stagger-2">
        <article><span><PackageCheck size={16} /> Deploys em 30 dias</span><strong>{deploySummary.total}</strong><small>{deploySummary.processing} em processamento</small></article>
        <article className={deploySummary.failed ? 'is-warning' : ''}><span><Gauge size={16} /> Taxa de sucesso</span><strong>{successRate}%</strong><small>{deploySummary.successful} concluídos, {deploySummary.failed} com falha</small></article>
        <article><span><Server size={16} /> Ambiente</span><strong>{deployCapabilities.environment}</strong><small>{environment.host?.os?.hostname || 'Host não identificado'}{deployCapabilities.requireMfa ? ' · MFA obrigatório' : ''}</small></article>
        <article className={environment.health?.ok === false ? 'is-danger' : ''}><span><Activity size={16} /> API e banco</span><strong>{environment.health?.ok ? 'Operacionais' : (environment.health ? 'Com atenção' : 'Verificando')}</strong><small>Uptime {formatUptime(environment.host?.uptimeSeconds)}</small></article>
      </section>

      <div className="dev-grid-main deploy-workspace anim-stagger-2">
        <div className="dev-col-left" style={{ flex: '1.2' }}>
          <div className="dev-card glass-card" style={{ borderTop: `4px solid ${isOverclocked ? 'var(--danger)' : 'var(--theme-sec)'}` }}>
            <div className="dev-card-header flex-between" style={{ color: isOverclocked ? 'var(--danger)' : 'var(--theme-sec)', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Rocket size={24} />
                <h3>Motor de Deploy (CI/CD)</h3>
              </div>
              <span className="status-badge">PIPELINE PROTEGIDO</span>
            </div>

            {isDeploying ? (
              <div style={{ background: 'var(--bg-dark)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-focus)', minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--theme-main)', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                  <Loader2 size={24} className="spin" />
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Injetando Pacote no Servidor...</h3>
                </div>
                <div className="crt-terminal" style={{ flex: 1, fontFamily: 'Montserrat', fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>[CI/CD] Validando assinatura e tipo de alvo ({newUpdate.targetType})...</div>
                  {deployStep >= 1 && <div><span style={{ color: 'var(--secondary)' }}>[UPLOAD]</span> Transferindo artefato ZIP para tmp/ ({uploadProgress}%)...</div>}
                  {deployStep >= 2 && <div><span style={{ color: 'var(--warning)' }}>[EXTRACT]</span> Distribuindo arquivos para {newUpdate.targetType === 'FRONTEND' ? 'public_html/' : 'raiz backend/'}...</div>}
                  {deployStep >= 3 && <div><span style={{ color: 'var(--accent-violet)' }}>[INTEGRAÇÃO]</span> Gravando DB Changelog e emitindo evento Socket...</div>}
                  {deployStep >= 4 && <div className="pulse-icon"><span style={{ color: 'var(--secondary)' }}>[HEALTH]</span> Checando uptime e resposta PM2...</div>}
                  {deployStep >= 5 && <div style={{ color: 'var(--theme-main)', fontWeight: 'bold' }}>[SUCESSO] Deploy finalizado com sucesso!</div>}
                </div>
                <div className="deploy-progress-track"><span style={{ width: `${deployStep >= 3 ? 100 : uploadProgress}%` }} /></div>
              </div>
            ) : (
              <form onSubmit={handleDeploy} className="deploy-form-grid">
                {!deployCapabilities.webDeployEnabled && <div className="deploy-inline-error"><ShieldAlert size={16} /><span>Deploy web desativado. Em produção, habilite explicitamente <code>ALLOW_WEB_DEPLOY=true</code> ou utilize a esteira oficial.</span></div>}
                <div className="form-group" style={{ marginBottom: '5px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--dim-text)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Alvo do Deploy (Destino) *
                  </label>
                  <div className="deploy-target-selector">
                    <button type="button" className={newUpdate.targetType === 'FRONTEND' ? 'active' : ''} onClick={() => setNewUpdate({ ...newUpdate, targetType: 'FRONTEND' })}><MonitorSmartphone size={16} />Frontend</button>
                    <button type="button" className={newUpdate.targetType === 'BACKEND' ? 'active' : ''} onClick={() => setNewUpdate({ ...newUpdate, targetType: 'BACKEND' })}><Server size={16} />Backend</button>
                    <button type="button" className={newUpdate.targetType === 'FULLSTACK' ? 'active' : ''} onClick={() => setNewUpdate({ ...newUpdate, targetType: 'FULLSTACK' })}><Box size={16} />Full-stack</button>
                  </div>
                  {newUpdate.targetType === 'FULLSTACK' && <small>O ZIP deve conter as pastas <code>frontend/</code> e <code>backend/</code> na raiz.</small>}
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 'bold' }}>Pacote ZIP *</label>
                  <div
                    className={`deploy-dropzone ${updateFile ? 'has-file' : ''} ${isDraggingFile ? 'is-dragging' : ''}`}
                    onDragEnter={(event) => { event.preventDefault(); setIsDraggingFile(true); }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(event) => { event.preventDefault(); setIsDraggingFile(false); handleFileSelect(event.dataTransfer.files[0]); }}
                  >
                    <input type="file" accept=".zip" onChange={(e) => handleFileSelect(e.target.files[0])} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                      {updateFile ? <PackageCheck size={32} /> : <UploadCloud size={32} />}
                      <span style={{ color: updateFile ? 'var(--primary)' : 'white', fontWeight: 'bold', marginTop: '5px' }}>{updateFile ? updateFile.name : 'Clique ou arraste um arquivo .zip aqui'}</span>
                      {fileDetails && <><small>{fileDetails.size} · {fileDetails.hint}</small><code title={fileDetails.checksum}>SHA-256 {fileDetails.checksum?.slice(0, 18)}{fileDetails.checksum?.length > 18 ? '...' : ''}</code></>}
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
                <div className="form-group"><label>Confirmação do ambiente *</label><div className="config-input-wrapper"><ShieldCheck size={16} /><input type="text" placeholder={deployCapabilities.confirmationPhrase} value={environmentConfirmation} onChange={(e) => setEnvironmentConfirmation(e.target.value)} autoComplete="off" /></div><small>Digite exatamente <code>{deployCapabilities.confirmationPhrase}</code>.</small></div>

                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px 15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--border-dim)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.8rem', color: checkBackup ? 'var(--primary)' : 'white' }}><input type="checkbox" checked={checkBackup} onChange={(e) => setCheckBackup(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />Autorizo a criação automática do backup do banco antes da atualização.</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.8rem', color: checkDowntime ? 'var(--warning)' : 'white' }}><input type="checkbox" checked={checkDowntime} onChange={(e) => setCheckDowntime(e.target.checked)} style={{ accentColor: 'var(--warning)' }} />Ciente das interconexões com SOC, WebSockets e Changelog.</label>
                </div>

                {deployError && <div className="deploy-inline-error"><AlertCircle size={16} /><span>{deployError}</span></div>}

                <button type="submit" className="btn btn-primary w-100" disabled={!isFormReady} style={{ marginTop: '5px', filter: isFormReady ? 'none' : 'grayscale(1)' }}><Rocket size={18} />Iniciar deploy {newUpdate.targetType.toLowerCase()}</button>
              </form>
            )}
          </div>
        </div>

        <div className="dev-col-right" style={{ flex: '1.8' }}>
          <section className="deploy-environment-panel">
            <div className="deploy-section-title"><div><Activity size={18} /><span>Prontidão do ambiente</span></div><small>Atualização automática a cada 30s</small></div>
            <div className="deploy-readiness-grid">
              <div><span className={environment.health?.ok ? 'deploy-health-dot online' : 'deploy-health-dot offline'} /><p><strong>API principal</strong><small>{environment.health?.status || (environment.health?.ok ? 'online' : 'sem resposta')}</small></p></div>
              <div><Database size={17} /><p><strong>Banco de dados</strong><small>{typeof environment.health?.database === 'string' ? environment.health.database : (environment.health?.database?.status || 'indisponível')}</small></p></div>
              <div><Server size={17} /><p><strong>Runtime</strong><small>{environment.host?.runtime?.nodeVersion || 'não identificado'} · PID {environment.host?.runtime?.pid || '-'}</small></p></div>
              <div><HardDrive size={17} /><p><strong>Memória livre</strong><small>{environment.host?.memory ? `${environment.host.memory.freeMB} de ${environment.host.memory.totalMB} MB` : 'indisponível'}</small></p></div>
            </div>
          </section>

          <div className="dev-card glass-card deploy-history-panel">
            <div className="deploy-history-header">
              <div className="deploy-section-title"><div><History size={18} /><span>Histórico e changelog</span></div></div>
              <div className="deploy-history-tabs">
                <button type="button" className={historyView === 'deployments' ? 'active' : ''} onClick={() => setHistoryView('deployments')}>Execuções</button>
                <button type="button" className={historyView === 'changelog' ? 'active' : ''} onClick={() => setHistoryView('changelog')}>Changelog</button>
              </div>
            </div>
            <div className="deploy-history-tools">
              <div className="iam-search-box"><Search size={15} /><input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Buscar versão, pacote ou autor" /></div>
              {historyView === 'deployments' && <label><Filter size={14} /><select value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value)}><option value="ALL">Todos os status</option><option value="SUCCESS">Sucesso</option><option value="FAILED">Falha</option><option value="PROCESSING">Processando</option></select></label>}
            </div>

            {historyView === 'deployments' ? (
              <div className="deploy-execution-list">
                {filteredDeployments.length === 0 ? <div className="deploy-empty"><PackageCheck size={24} /><span>Nenhuma execução registrada.</span></div> : filteredDeployments.map((deployment) => (
                  <article key={deployment.id} className={`deploy-execution is-${String(deployment.status).toLowerCase()}`}>
                    <div className="deploy-execution-status">{deployment.status === 'SUCCESS' ? <CheckCircle2 size={18} /> : deployment.status === 'FAILED' ? <AlertCircle size={18} /> : <Loader2 size={18} className="spin" />}</div>
                    <div className="deploy-execution-main"><div><strong>{deployment.version}</strong><span>{deployment.title}</span></div><small>{deployment.package_name}</small>{deployment.error_message && <p>{deployment.error_message}</p>}</div>
                    <div className="deploy-execution-meta"><span>{deployment.target}</span><small>{formatBytes(deployment.package_size)} · {deployment.entry_count} arquivos</small><small>{new Date(deployment.created_at).toLocaleString('pt-BR')} · {deployment.duration_seconds}s</small></div>
                    <code title={deployment.package_checksum || ''}>{deployment.package_checksum ? deployment.package_checksum.slice(0, 12) : 'sem hash'}</code>
                  </article>
                ))}
              </div>
            ) : (
              <div className="timeline-container deploy-changelog-list">
              {filteredUpdates.length === 0 ? (
                <div className="deploy-empty"><ListChecks size={24} /><span>Nenhuma atualização encontrada.</span></div>
              ) : (
                filteredUpdates.map((upd, idx) => {
                  const targetBadge = upd.title?.includes('[FRONTEND]') ? 'FRONTEND' : upd.title?.includes('[BACKEND]') ? 'BACKEND' : 'FULLSTACK';
                  const titleClean = upd.title?.replace(/\[(FRONTEND|BACKEND|FULLSTACK)\]\s*/gi, '') || upd.title;

                  return (
                    <div key={upd.id || idx} className="timeline-item">
                      <div className="timeline-node" style={{ borderColor: targetBadge === 'FRONTEND' ? 'var(--info)' : targetBadge === 'BACKEND' ? 'var(--success)' : 'var(--accent-violet)' }}></div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="version-badge">{upd.version}</span>
                            <span style={{ fontSize: '0.65rem', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', background: targetBadge === 'FRONTEND' ? 'color-mix(in srgb, var(--info) 15%, transparent)' : 'color-mix(in srgb, var(--success) 15%, transparent)', color: targetBadge === 'FRONTEND' ? 'var(--info)' : 'var(--success)', border: `1px solid ${targetBadge === 'FRONTEND' ? 'rgba(56,189,248,0.4)' : 'rgba(16,185,129,0.4)'}` }}>{targetBadge}</span>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * ============================================================================ 12. TELA:
 * CONSOLE TERMINAL SQL (ABSOLUTE FULLSCREEN COM OVERFLOW NATIVO)
 * ============================================================================
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.addLog - Propriedade addLog usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const TelaTerminalSQL = ({ api, showToast, addLog }) => {
  // Console administrativo com explorador de esquema, execução auditada e
  // ferramentas de inspeção. A API continua sendo a autoridade de segurança.
  const [query, setQuery] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [hasExecuted, setHasExecuted] = useState(false);
  const [resultMeta, setResultMeta] = useState(null);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState({ tables: [], databaseName: '', mutationEnabled: false, destructiveEnabled: false, maxQueryChars: 6000 });
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState('');
  const [schemaSearch, setSchemaSearch] = useState('');
  const [resultSearch, setResultSearch] = useState('');
  const [activeResultTab, setActiveResultTab] = useState('results');
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const queryKind = useMemo(() => {
    const command = query.trim().match(/^([a-z]+)/i)?.[1]?.toUpperCase() || 'VAZIO';
    const readOnly = /^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN)$/.test(command);
    const destructive = /^(DROP|TRUNCATE|DELETE)$/.test(command);
    return { command, readOnly, destructive };
  }, [query]);

  const filteredTables = useMemo(() => metadata.tables.filter((table) => (
    table.name.toLowerCase().includes(schemaSearch.trim().toLowerCase())
  )), [metadata.tables, schemaSearch]);

  const filteredResults = useMemo(() => {
    const term = resultSearch.trim().toLowerCase();
    if (!term) return results;
    return results.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(term)));
  }, [results, resultSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const visibleResults = filteredResults.slice((page - 1) * pageSize, page * pageSize);
  const columns = resultMeta?.columns?.length ? resultMeta.columns : Object.keys(results[0] || {});

  // Atualiza o catálogo estrutural exibido no explorador sem consultar dados das tabelas.
  const carregarMetadados = useCallback(async () => {
    setSchemaLoading(true);
    setSchemaError('');
    try {
      const response = await api.get('/system/sql-console/metadata');
      const payload = response.data || {};
      if (!Array.isArray(payload.tables)) throw new Error('A API retornou um catálogo SQL inválido.');
      setMetadata((current) => ({ ...current, ...payload, tables: payload.tables }));
    } catch (requestError) {
      const message = requestError.response?.data?.error || requestError.message || 'Falha ao carregar o esquema SQL.';
      setSchemaError(message);
      showToast(message, 'error');
    } finally {
      setSchemaLoading(false);
    }
  }, [api, showToast]);

  // A tela inicia em estado de carregamento; esta chamada libera e preenche o explorador.
  useEffect(() => {
    carregarMetadados();
  }, [carregarMetadados]);
  /**
   * Formata format cell value para exibicao segura na interface.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} value - Valor de value consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const formatCellValue = (value) => {
    if (value === null) return 'NULL';
    if (value instanceof Date) return value.toLocaleString('pt-BR');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  /**
   * Executa a instrução atual e registra o resultado no histórico efêmero da sessão.
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
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @param {unknown} forceQuery - Valor de force query consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const executarSQL = async (event, forceQuery = null) => {
    event?.preventDefault();
    const sqlToRun = (forceQuery ?? query).trim();
    if (!sqlToRun || loading) return;
    setLoading(true);
    setError(null);
    setHasExecuted(false);
    setActiveResultTab('results');
    addLog('[SQL] Executando instrução auditada no banco de dados.', 'warning');
    const startedAt = Date.now();

    try {
      const response = await api.post('/system/query-raw', { sql: sqlToRun, passcode });
      const rows = Array.isArray(response.data.data) ? response.data.data : [];
      const meta = response.data.meta || { rowCount: rows.length, durationMs: Date.now() - startedAt };
      setResults(rows);
      setResultMeta(meta);
      setHasExecuted(true);
      setResultSearch('');
      setPage(1);
      setHistory((current) => [{ id: `${Date.now()}-${Math.random()}`, query: sqlToRun, success: true, ...meta }, ...current].slice(0, 30));
      showToast(`Consulta concluída em ${meta.durationMs} ms.`, 'success');
      addLog(`[SQL SUCCESS] ${meta.rowCount || meta.affectedRows || 0} linha(s) processada(s).`, 'success');
    } catch (requestError) {
      const message = requestError.response?.data?.error || requestError.message;
      const durationMs = requestError.response?.data?.durationMs ?? Date.now() - startedAt;
      setResults([]);
      setResultMeta(null);
      setHasExecuted(true);
      setError(message);
      setHistory((current) => [{ id: `${Date.now()}-${Math.random()}`, query: sqlToRun, success: false, durationMs, executedAt: new Date().toISOString(), error: message }, ...current].slice(0, 30));
      addLog('[SQL ERROR] A instrução foi rejeitada ou falhou durante a execução.', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Preenche o editor com uma consulta segura sem executá-la automaticamente.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} sql - Valor de sql consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const aplicarQuickQuery = (sql) => {
    setQuery(sql);
    setError(null);
  };

  /**
   * Abre uma tabela do catálogo com limite explícito para evitar consultas acidentais extensas.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} tableName - Valor de table name consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const selecionarTabela = (tableName) => aplicarQuickQuery(`SELECT * FROM \`${tableName.replace(/`/g, '``')}\` LIMIT 100;`);

  /**
   * Copia o conjunto filtrado ou a consulta atual para a área de transferência.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} value - Valor de value consumido por esta rotina.
   * @param {unknown} successMessage - Valor de success message consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copiarTexto = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(successMessage, 'success');
    } catch (error) {
      showToast('Não foi possível copiar o conteúdo.', 'error');
    }
  };

  /**
   * Exporta os resultados filtrados para CSV usando os nomes de coluna retornados pela API.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const exportarCSV = () => {
    if (!filteredResults.length) return;

    /**
     * Prepara escape csv para exibicao sem expor dados sensiveis.
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
    const escapeCsv = (value) => `"${formatCellValue(value).replace(/"/g, '""')}"`;
    const csv = [columns.map(escapeCsv).join(','), ...filteredResults.map((row) => columns.map((column) => escapeCsv(row[column])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `termosync-sql-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };


  /**
   * Formata format sql bytes para exibicao segura na interface.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} bytes - Valor de bytes consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const formatSqlBytes = (bytes) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(0, bytes / 1024).toFixed(1)} KB`;

  return (
    <div className="sql-console anim-fade-in">
      <header className="sql-console-header">
        <div><span className="sql-console-eyebrow"><Terminal size={14} /> Ferramenta de desenvolvimento</span><h2>Console SQL</h2><p>Inspecione o esquema, execute consultas auditadas e analise resultados sem sair da plataforma.</p></div>
        <div className="sql-console-policy"><span className={metadata.mutationEnabled ? 'is-warning' : 'is-safe'}><LockKeyhole size={14} /> Escrita {metadata.mutationEnabled ? 'habilitada' : 'bloqueada'}</span><small>Limite de {metadata.maxQueryChars} caracteres</small></div>
      </header>

      <section className="sql-console-kpis">
        <article><span>Banco ativo</span><strong>{metadata.databaseName || 'Carregando...'}</strong><small>MySQL conectado pela API</small></article>
        <article><span>Tabelas catalogadas</span><strong>{metadata.tables.length}</strong><small>{formatSqlBytes(metadata.tables.reduce((sum, table) => sum + table.sizeBytes, 0))} mapeados</small></article>
        <article><span>Última execução</span><strong>{resultMeta ? `${resultMeta.durationMs} ms` : '--'}</strong><small>{resultMeta ? `${resultMeta.rowCount || resultMeta.affectedRows || 0} linha(s) processada(s)` : 'Nenhuma nesta sessão'}</small></article>
        <article className={queryKind.destructive ? 'is-danger' : queryKind.readOnly ? 'is-safe' : 'is-warning'}><span>Classificação atual</span><strong>{queryKind.command}</strong><small>{queryKind.readOnly ? 'Somente leitura' : queryKind.destructive ? 'Operação destrutiva' : 'Requer política de escrita'}</small></article>
      </section>

      <div className="sql-console-workspace">
        <aside className="sql-schema-panel">
          <div className="sql-panel-title"><div><Database size={17} /><strong>Esquema</strong></div><button type="button" title="Atualizar esquema" onClick={carregarMetadados} disabled={schemaLoading}><RefreshCw size={15} className={schemaLoading ? 'spin' : ''} /></button></div>
          <label className="sql-search"><Search size={14} /><input value={schemaSearch} onChange={(event) => setSchemaSearch(event.target.value)} placeholder="Filtrar tabelas" /></label>
          <div className="sql-table-list">
            {schemaLoading ? <div className="sql-empty"><Loader2 size={18} className="spin" />Carregando esquema</div> : schemaError ? (
              <div className="sql-empty sql-schema-error"><AlertTriangle size={18} /><span>{schemaError}</span><button type="button" onClick={carregarMetadados}>Tentar novamente</button></div>
            ) : filteredTables.map((table) => (
              <button type="button" key={table.name} onClick={() => selecionarTabela(table.name)} title={`Abrir ${table.name}`}>
                <Database size={14} /><span><strong>{table.name}</strong><small>{table.engine || 'MySQL'} · ~{table.estimatedRows} linhas</small></span><em>{formatSqlBytes(table.sizeBytes)}</em>
              </button>
            ))}
            {!schemaLoading && !schemaError && filteredTables.length === 0 && <div className="sql-empty">Nenhuma tabela encontrada.</div>}
          </div>
        </aside>

        <main className="sql-editor-panel">
          <div className="sql-editor-toolbar">
            <div className="sql-quick-actions">
              <button type="button" onClick={() => aplicarQuickQuery('SHOW TABLES;')}><Database size={14} />Tabelas</button>
              <button type="button" onClick={() => aplicarQuickQuery('SHOW FULL PROCESSLIST;')}><Activity size={14} />Processos</button>
              <button type="button" onClick={() => aplicarQuickQuery('SELECT * FROM sessoes_ativas LIMIT 100;')}><Users size={14} />Sessões</button>
              <button type="button" onClick={() => aplicarQuickQuery('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100;')}><ShieldCheck size={14} />Auditoria</button>
            </div>
            <div className="sql-editor-actions"><button type="button" title="Copiar consulta" onClick={() => copiarTexto(query, 'Consulta copiada.')} disabled={!query}><Copy size={15} /></button><button type="button" title="Limpar editor" onClick={() => { setQuery(''); setError(null); }} disabled={!query}><Eraser size={15} /></button></div>
          </div>

          <form onSubmit={executarSQL} className="sql-editor-form">
            <div className="sql-editor-shell">
              <div className="sql-editor-gutter">{Array.from({ length: Math.max(1, query.split('\n').length) }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
              <textarea value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') executarSQL(event); }} placeholder="SELECT * FROM equipamentos LIMIT 100;" spellCheck="false" autoFocus />
            </div>
            <div className="sql-editor-footer">
              <div className="sql-query-status"><span className={queryKind.readOnly ? 'is-safe' : queryKind.destructive ? 'is-danger' : 'is-warning'}>{queryKind.command}</span><small>{query.length}/{metadata.maxQueryChars} caracteres · Ctrl + Enter para executar</small></div>
              <div className="sql-execution-controls">
                {!queryKind.readOnly && query.trim() && <label className="sql-passcode"><LockKeyhole size={15} /><input type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} placeholder="Credencial root" autoComplete="current-password" /></label>}
                <button type="submit" className="sql-run-button" disabled={loading || !query.trim() || query.length > metadata.maxQueryChars}>{loading ? <Loader2 size={16} className="spin" /> : <PlayCircle size={17} />}<span>{loading ? 'Executando' : 'Executar'}</span></button>
              </div>
            </div>
          </form>
        </main>
      </div>

      <section className="sql-output-panel">
        <div className="sql-output-header">
          <div className="sql-output-tabs"><button type="button" className={activeResultTab === 'results' ? 'active' : ''} onClick={() => setActiveResultTab('results')}>Resultados {hasExecuted && <span>{results.length}</span>}</button><button type="button" className={activeResultTab === 'history' ? 'active' : ''} onClick={() => setActiveResultTab('history')}>Histórico <span>{history.length}</span></button></div>
          {activeResultTab === 'results' && results.length > 0 && <div className="sql-output-tools"><label><Search size={14} /><input value={resultSearch} onChange={(event) => setResultSearch(event.target.value)} placeholder="Filtrar resultados" /></label><button type="button" title="Copiar resultados" onClick={() => copiarTexto(JSON.stringify(filteredResults, null, 2), 'Resultados copiados.')}><Copy size={15} /></button><button type="button" title="Exportar CSV" onClick={exportarCSV}><DownloadCloud size={15} /></button></div>}
        </div>

        {activeResultTab === 'history' ? (
          <div className="sql-history-list">
            {history.length === 0 ? <div className="sql-empty sql-empty-large"><History size={22} />O histórico desta sessão aparecerá aqui.</div> : history.map((item) => <button type="button" key={item.id} onClick={() => { setQuery(item.query); setActiveResultTab('results'); }}><span className={item.success ? 'is-safe' : 'is-danger'}>{item.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}</span><code>{item.query}</code><small>{item.durationMs} ms</small><em>{item.executedAt ? new Date(item.executedAt).toLocaleTimeString('pt-BR') : 'agora'}</em></button>)}
          </div>
        ) : error ? (
          <div className="sql-error-state"><AlertOctagon size={22} /><div><strong>Falha na execução</strong><p>{error}</p></div></div>
        ) : results.length > 0 ? (
          <>
            <div className="sql-results-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{visibleResults.map((row, rowIndex) => <tr key={rowIndex}>{columns.map((column) => <td key={column} title={formatCellValue(row[column])}>{row[column] === null ? <span className="sql-null">NULL</span> : formatCellValue(row[column])}</td>)}</tr>)}</tbody></table></div>
            <footer className="sql-results-footer"><span>{filteredResults.length} de {results.length} registro(s)</span><div><button type="button" title="Página anterior" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}><ChevronLeft size={15} /></button><span>Página {page} de {totalPages}</span><button type="button" title="Próxima página" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}><ChevronRight size={15} /></button></div><small>{resultMeta?.fingerprint && `ID ${resultMeta.fingerprint}`}</small></footer>
          </>
        ) : hasExecuted ? (
          <div className="sql-success-state"><CheckCircle2 size={22} /><div><strong>Instrução concluída</strong><p>{resultMeta?.affectedRows ? `${resultMeta.affectedRows} linha(s) alterada(s).` : 'Nenhuma linha foi retornada.'}{resultMeta?.insertId ? ` Novo ID: ${resultMeta.insertId}.` : ''}</p></div></div>
        ) : (
          <div className="sql-empty sql-empty-large"><Terminal size={24} /><strong>Pronto para consultar</strong><span>Selecione uma tabela no esquema ou escreva uma instrução no editor.</span></div>
        )}
      </section>
    </div>
  );
};
