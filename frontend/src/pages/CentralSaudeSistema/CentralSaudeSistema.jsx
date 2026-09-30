/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/CentralSaudeSistema.jsx
 * Responsabilidade: Implementa a tela Central Saude Sistema, seus estados, interações e integrações de dados.
 */

import { useRef } from 'react';
import { MessageCircle, Pause, Play } from 'lucide-react';
import HealthServiceDiagnostics from './HealthServiceDiagnostics';
import HealthRuntimeOverview from './HealthRuntimeOverview';
import HealthRealtimeStream from './HealthRealtimeStream';
import HealthDeveloperWorkbench from './HealthDeveloperWorkbench';
import HealthSessionAnalytics from './HealthSessionAnalytics';
import HealthTelemetryExplorer from './HealthTelemetryExplorer';
import HealthRecentChecks from './HealthRecentChecks';
import React, { useCallback, useEffect, useState } from 'react';
import { Clipboard, Database, Download, Loader2, Radio, RefreshCw, Server, Wifi } from 'lucide-react';
import './CentralSaudeSistema.css';

const checksStorageKey = 'termosync:health-checks';
const warningLatency = 500;
const criticalLatency = 1500;

/**
 * Extrai read recent checks de uma entrada externa ou configuracao local.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
 *
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const readRecentChecks = () => {
  try {
    const entries = JSON.parse(window.sessionStorage.getItem(checksStorageKey) || '[]');
    return Array.isArray(entries) ? entries.filter(entry => Number.isFinite(entry?.at)).slice(0, 120) : [];
  } catch {
    return [];
  }
};

/**
 * Normaliza respostas HTTP, histórico e eventos Socket no mesmo formato de série.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} snapshot - Valor de snapshot consumido por esta rotina.
 * @param {unknown} source - Valor de source consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const toHealthCheck = (snapshot, source = 'manual') => ({
  ...snapshot,
  id: String(snapshot?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
  at: Number(snapshot?.at) || (snapshot?.timestamp ? new Date(snapshot.timestamp).getTime() : Date.now()),
  api: snapshot?.api || snapshot?.status || 'offline',
  database: snapshot?.database || 'unknown',
  mqtt: snapshot?.mqtt || 'unknown',
  whatsapp: snapshot?.whatsapp || 'unknown',
  responseTimeMs: Number.isFinite(Number(snapshot?.responseTimeMs)) && snapshot?.responseTimeMs != null ? Number(snapshot.responseTimeMs) : null,
  source: snapshot?.source || source
});

/**
 * Traduz os estados retornados pelos serviços sem tratar valores desconhecidos como falha.
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
const describeStatus = (value) => {
  const status = String(value || '').trim().toLowerCase();
  if (['ok', 'online', 'healthy', 'connected'].includes(status)) return { tone: 'good', label: 'Operacional' };
  if (['degraded', 'warning'].includes(status)) return { tone: 'warn', label: 'Atenção' };
  if (['offline', 'disconnected', 'error', 'auth_failure'].includes(status)) return { tone: 'bad', label: 'Indisponível' };
  if (status === 'disabled') return { tone: 'neutral', label: 'Desativado' };
  if (status === 'awaiting_qr') return { tone: 'warn', label: 'Aguardando QR' };
  if (status === 'starting' || status === 'checking') return { tone: 'neutral', label: 'Verificando' };
  return { tone: 'neutral', label: 'Sem dados' };
};

/**
 * Exibe o horário informado pela API apenas quando a data é válida.
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
const formatDate = (value) => {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sem registro' : date.toLocaleString('pt-BR');
};

/**
 * Resume a duração em horas e minutos para facilitar a leitura do uptime.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} seconds - Valor de seconds consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatUptime = (seconds) => {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return 'Sem dados';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
};

/**
 * Usa a API de clipboard quando disponível e mantém a cópia funcional na WebView HTTP.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: interage com APIs do navegador
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const writeClipboard = async (value) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // A WebView pode negar a API moderna mesmo após o toque do usuário.
    }
  }
  const field = document.createElement('textarea');
  field.value = value;
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  try {
    if (!document.execCommand('copy')) throw new Error('Cópia indisponível');
  } finally {
    field.remove();
  }
};


/**
 * Renderiza a tela Central Saude Sistema e concentra as regras de apresentacao desse modulo.
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
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador; troca eventos em tempo real; publica ou consome mensagens MQTT
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.systemHealth - Propriedade systemHealth usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function CentralSaudeSistema({ api, socket, systemHealth, isOffline, showToast, userRole }) {
  const [health, setHealth] = useState(systemHealth || null);
  const [host, setHost] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(Boolean(isOffline));
  const [socketConnected, setSocketConnected] = useState(socket ? Boolean(socket.connected) : null);
  const [recentChecks, setRecentChecks] = useState(readRecentChecks);
  const [historyMeta, setHistoryMeta] = useState(null);
  const [lastRealtimeAt, setLastRealtimeAt] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const refreshInFlight = useRef(false);

  useEffect(() => {
    try { window.sessionStorage.setItem(checksStorageKey, JSON.stringify(recentChecks.slice(0, 120))); } catch { /* Armazenamento opcional na WebView. */ }
  }, [recentChecks]);

  const carregarSaude = useCallback(async (notifyOnError = false) => {
    if (!api || isOffline) {
      setApiUnavailable(true);
      setHost(null);
      return;
    }
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setLoading(true);
    try {
      const [healthResult, hostResult] = await Promise.allSettled([
        api.get('/health', { validateStatus: status => status === 200 || status === 503 }),
        api.get('/system/host-info')
      ]);
      const healthData = healthResult.status === 'fulfilled' ? healthResult.value.data : null;
      const hostData = hostResult.status === 'fulfilled' ? hostResult.value.data : null;
      setApiUnavailable(!healthData?.status);
      if (healthData?.status) setHealth(healthData);
      setHost(hostData?.success ? hostData : null);
      if (healthData?.status) setRecentChecks(previous => [toHealthCheck(healthData), ...previous].slice(0, 720));
      if (!healthData?.status && notifyOnError) showToast?.('A API não respondeu à verificação de saúde.', 'error');
    } finally {
      refreshInFlight.current = false;
      setLoading(false);
    }
  }, [api, isOffline, showToast]);

  useEffect(() => { carregarSaude(); }, [carregarSaude]);

  useEffect(() => {
    if (!api || isOffline || userRole !== 'DEV') return undefined;
    let active = true;
    /**
     * Carrega a janela persistida antes que os novos eventos em tempo real sejam anexados.
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
     * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
     *
     * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const loadHistory = async () => {
      try {
        const response = await api.get('/system/health/history?minutes=60&limit=360');
        if (!active) return;
        const samples = Array.isArray(response.data?.samples) ? response.data.samples.map(sample => toHealthCheck(sample, 'history')) : [];
        setHistoryMeta({ retentionDays: response.data?.retentionDays, sampleIntervalSeconds: response.data?.sampleIntervalSeconds });
        setRecentChecks(previous => {
          const unique = new Map([...previous, ...samples].map(sample => [sample.id, sample]));
          return [...unique.values()].sort((a, b) => b.at - a.at).slice(0, 720);
        });
      } catch {
        // O cache da sessão e o polling continuam disponíveis se a tabela ainda estiver iniciando.
      }
    };
    loadHistory();
    return () => { active = false; };
  }, [api, isOffline, userRole]);

  useEffect(() => {
    if (!autoRefresh || socketConnected) return undefined;
    const intervalId = window.setInterval(() => {
      if (!document.hidden) carregarSaude();
    }, refreshInterval * 1000);
    return () => window.clearInterval(intervalId);
  }, [autoRefresh, carregarSaude, refreshInterval, socketConnected]);

  useEffect(() => {
    setSocketConnected(socket ? Boolean(socket.connected) : null);
    if (!socket) return undefined;

    /**
     * Processa a interacao de on connect e atualiza a interface conforme o resultado.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: atualiza estado reativo da interface
     *
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const onConnect = () => setSocketConnected(true);

    /**
     * Processa a interacao de on disconnect e atualiza a interface conforme o resultado.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: atualiza estado reativo da interface
     *
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const onDisconnect = () => setSocketConnected(false);

    /**
     * Processa a interacao de on health update e atualiza a interface conforme o resultado.
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
     * @param {unknown} snapshot - Valor de snapshot consumido por esta rotina.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const onHealthUpdate = (snapshot) => {
      if (!autoRefresh || !snapshot?.status) return;
      const check = toHealthCheck(snapshot, 'realtime');
      setHealth(snapshot);
      setApiUnavailable(false);
      setLastRealtimeAt(check.at);
      setRecentChecks(previous => [check, ...previous.filter(item => item.id !== check.id)].slice(0, 720));
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('system_health_update', onHealthUpdate);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('system_health_update', onHealthUpdate);
    };
  }, [socket, autoRefresh]);


  /**
   * Processa a interacao de copiar diagnostico e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: publica ou consome mensagens MQTT
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copiarDiagnostico = async () => {
    const payload = [
      'TermoSync - Saude do Sistema',
      `API: ${isOffline || apiUnavailable ? 'offline' : health?.status || 'N/A'}`,
      `Banco: ${isOffline || apiUnavailable ? 'N/A' : health?.database || 'N/A'}`,
      `MQTT: ${isOffline || apiUnavailable ? 'N/A' : health?.mqtt || 'N/A'}`,
      `WhatsApp: ${isOffline || apiUnavailable ? 'N/A' : health?.whatsapp || 'N/A'}`,
      `Tempo real: ${socketConnected == null ? 'N/A' : socketConnected ? 'online' : 'offline'}`,
      `Host: ${host?.os?.hostname || 'N/A'}`,
      `Sistema: ${host?.os ? `${host.os.platform} ${host.os.release}` : 'N/A'}`,
      `CPU: ${host?.cpu ? `${host.cpu.cores} nucleos` : 'N/A'}`,
      `Memoria livre: ${host?.memory ? `${host.memory.freeMB} MB de ${host.memory.totalMB} MB` : 'N/A'}`,
      `Tempo ativo da API: ${formatUptime(health?.uptime)}`,
      `Memoria da API: ${health?.memory?.rssMb != null ? `${health.memory.rssMb} MB` : 'N/A'}`,
      `Heap da API: ${health?.memory?.heapUsedMb != null ? `${health.memory.heapUsedMb} de ${health.memory.heapTotalMb} MB` : 'N/A'}`,
      `Runtime: ${host?.runtime?.nodeVersion || 'N/A'} / PID ${host?.runtime?.pid || 'N/A'} / ${host?.runtime?.environment || 'N/A'}`,
      `Ultima resposta: ${formatDate(health?.timestamp)}`,
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`
    ].join('\n');

    try {
      await writeClipboard(payload);
      showToast?.('Diagnóstico copiado.', 'success');
    } catch {
      showToast?.('Não foi possível copiar o diagnóstico.', 'warning');
    }
  };


  /**
   * Concentra a logica de baixar backup para manter o restante do tela mais legivel.
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
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const baixarBackup = async () => {
    if (!api || userRole !== 'DEV') return;
    try {
      const response = await api.get('/system/backup-json', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `termosync-backup-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast?.('Backup exportado com sucesso.', 'success');
    } catch (error) {
      showToast?.(error.userMessage || 'Falha ao gerar backup.', 'error');
    }
  };

  const noApi = isOffline || apiUnavailable;
  const services = [
    { label: 'API', value: noApi ? 'offline' : health?.status, detail: noApi ? 'Sem resposta do servidor' : Number.isFinite(Number(health?.responseTimeMs)) && health?.responseTimeMs != null ? `Resposta em ${health.responseTimeMs} ms` : 'Verificação da aplicação', icon: Server },
    { label: 'Banco de dados', value: noApi ? 'unknown' : health?.database, detail: 'Consulta de integridade', icon: Database },
    { label: 'MQTT / IoT', value: noApi ? 'unknown' : health?.mqtt, detail: 'Conexão com o broker', icon: Radio },
    { label: 'WhatsApp', value: noApi ? 'unknown' : health?.whatsapp, detail: 'Integração de mensagens', icon: MessageCircle },
    { label: 'Tempo real', value: isOffline ? 'offline' : socketConnected == null ? 'unknown' : socketConnected ? 'online' : 'offline', detail: 'Conexão deste painel', icon: Wifi }
  ];
  const statusCounts = services.reduce((counts, service) => {
    counts[describeStatus(service.value).tone] += 1;
    return counts;
  }, { good: 0, warn: 0, bad: 0, neutral: 0 });
  const issueCount = statusCounts.bad + statusCounts.warn;
  const overall = noApi ? { tone: 'bad', label: 'Conexão indisponível' }
    : issueCount > 0 || health?.status === 'degraded' ? { tone: 'warn', label: 'Atenção necessária' }
      : health?.status === 'ok' ? { tone: 'good', label: 'API operacional' }
        : { tone: 'neutral', label: 'Verificando serviços' };
  const summary = noApi ? 'Sem resposta da API. Os dados anteriores podem estar desatualizados.'
    : issueCount > 0 ? `${issueCount} ${issueCount === 1 ? 'serviço precisa' : 'serviços precisam'} de atenção.`
      : health?.status === 'degraded' ? 'A API informou operação degradada; confira os serviços abaixo.'
      : `${statusCounts.good} de ${services.length} serviços operacionais${statusCounts.neutral ? '; demais sem leitura ou desativados.' : '.'}`;

  return (
    <div className="health-page anim-fade-in">
      <header className="health-header">
        <div className="health-heading">
          <h2>Saúde do Sistema</h2>
          <span className={`health-overall ${overall.tone}`} role="status" aria-live="polite">
            <span className="health-status-dot" />{overall.label}
          </span>
        </div>
        <p className="health-updated">{noApi ? 'Última resposta recebida' : 'Atualizado em'}: {formatDate(health?.timestamp)}</p>
        <p className="health-summary">{summary}</p>
        <div className="health-actions">
          <button type="button" className="btn btn-primary" onClick={() => carregarSaude(true)} disabled={loading || isOffline}>
            {loading ? <Loader2 className="spinner" size={16} /> : <RefreshCw size={16} />}
            {loading ? 'Verificando...' : 'Atualizar'}
          </button>
          <button type="button" className="btn btn-outline" onClick={copiarDiagnostico} title="Copiar diagnóstico"><Clipboard size={16} /><span className="health-action-full">Copiar diagnóstico</span><span className="health-action-short">Copiar</span></button>
          <button type="button" className="btn btn-outline" onClick={() => setAutoRefresh(value => !value)} title={autoRefresh ? 'Pausar atualização automática' : 'Ativar atualização automática'} aria-pressed={!autoRefresh}>
            {autoRefresh ? <Pause size={16} /> : <Play size={16} />}
            <span className="health-action-full">{autoRefresh ? 'Pausar automático' : 'Ativar automático'}</span><span className="health-action-short">{autoRefresh ? 'Pausar' : 'Ativar'}</span>
          </button>
          {userRole === 'DEV' && <button type="button" className="btn btn-outline" onClick={baixarBackup} disabled={loading || noApi} title="Exportar backup"><Download size={16} /><span className="health-action-full">Exportar backup</span><span className="health-action-short">Backup</span></button>}
        </div>
        <div className="health-refresh-settings">
          <span>{socketConnected ? 'Stream em tempo real' : 'Contingência automática'}</span>
          <label>Polling de fallback
            <select value={refreshInterval} onChange={event => setRefreshInterval(Number(event.target.value))} disabled={!autoRefresh}>
              <option value={15}>15 segundos</option><option value={30}>30 segundos</option><option value={60}>1 minuto</option>
            </select>
          </label>
          <span className={`health-refresh-state ${autoRefresh ? 'active' : 'paused'}`}><i />{autoRefresh ? (socketConnected ? 'Recebendo eventos do servidor' : `Polling ativo a cada ${refreshInterval} s`) : 'Monitoramento pausado'}</span>
          <span className="health-refresh-thresholds">Latência: atenção acima de {warningLatency} ms · crítica acima de {criticalLatency} ms</span>
        </div>
      </header>

      <HealthServiceDiagnostics services={services} describeStatus={describeStatus} />

      <HealthRuntimeOverview health={noApi ? null : health} host={host} formatUptime={formatUptime} warningLatency={warningLatency} criticalLatency={criticalLatency} />

      <HealthRealtimeStream
        health={noApi ? null : health}
        checks={recentChecks}
        connected={socketConnected && autoRefresh}
        lastEventAt={lastRealtimeAt}
        historyMeta={historyMeta}
        describeStatus={describeStatus}
      />

      {userRole === 'DEV' && (
        <HealthDeveloperWorkbench
          api={api}
          health={noApi ? null : health}
          host={host}
          socketConnected={socketConnected}
          isOffline={noApi}
          recentChecks={recentChecks}
          showToast={showToast}
        />
      )}

      <HealthSessionAnalytics checks={recentChecks} describeStatus={describeStatus} />

      <HealthTelemetryExplorer checks={recentChecks} describeStatus={describeStatus} warningLatency={warningLatency} criticalLatency={criticalLatency} />

      <HealthRecentChecks checks={recentChecks} onClear={() => setRecentChecks([])} describeStatus={describeStatus} autoRefresh={autoRefresh} refreshInterval={refreshInterval} />

      {health?.error && <div className="health-system-error" role="alert"><strong>Último erro informado pela API</strong><span>{health.error}</span></div>}

      <section className="health-detail-grid">
        <div className="health-detail">
          <h3>Infraestrutura</h3>
          <div><span>Host</span><strong>{host?.os?.hostname || 'Indisponível'}</strong></div>
          <div><span>Sistema</span><strong>{host?.os ? `${host.os.type} ${host.os.release}` : 'Indisponível'}</strong></div>
          <div><span>Arquitetura</span><strong>{host?.os?.arch || 'Indisponível'}</strong></div>
          <div><span>CPU</span><strong>{host?.cpu ? `${host.cpu.cores} núcleos · ${host.cpu.speed || 0} MHz` : 'Indisponível'}</strong></div>
          <div><span>Modelo da CPU</span><strong>{host?.cpu?.model || 'Indisponível'}</strong></div>
          <div><span>Carga média</span><strong>{host?.cpu?.loadAverage ? host.cpu.loadAverage.join(' · ') : 'Indisponível'}</strong></div>
          <div><span>Memória livre</span><strong>{host?.memory ? `${host.memory.freeMB} MB de ${host.memory.totalMB} MB` : 'Indisponível'}</strong></div>
          <div><span>Tempo ativo do host</span><strong>{formatUptime(host?.uptimeSeconds)}</strong></div>
        </div>

        <div className="health-detail">
          <h3>Processo da API</h3>
          <div><span>Tempo ativo</span><strong>{formatUptime(health?.uptime)}</strong></div>
          <div><span>Latência da checagem</span><strong>{health?.responseTimeMs != null ? `${health.responseTimeMs} ms` : 'Sem dados'}</strong></div>
          <div><span>Memória residente</span><strong>{health?.memory?.rssMb != null ? `${health.memory.rssMb} MB` : 'Sem dados'}</strong></div>
          <div><span>Heap utilizado</span><strong>{health?.memory?.heapUsedMb != null ? `${health.memory.heapUsedMb} de ${health.memory.heapTotalMb} MB` : 'Sem dados'}</strong></div>
          <div><span>Versão do Node</span><strong>{host?.runtime?.nodeVersion || 'Sem dados'}</strong></div>
          <div><span>Ambiente</span><strong>{host?.runtime?.environment || 'Sem dados'}</strong></div>
          <div><span>PID</span><strong>{host?.runtime?.pid || 'Sem dados'}</strong></div>
          <div><span>Última resposta</span><strong>{formatDate(health?.timestamp)}</strong></div>
        </div>
      </section>

    </div>
  );
}
