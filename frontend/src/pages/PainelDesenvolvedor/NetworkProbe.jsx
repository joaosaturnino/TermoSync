/**
 * Módulo: frontend/src/pages/PainelDesenvolvedor/NetworkProbe.jsx
 * Responsabilidade: Implementa a tela Network Probe, seus estados, interações e integrações de dados.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Ban, CheckCircle2, Clock, Copy, Cpu, Crosshair, Database, Download, Filter, Globe2, History, Layers3, ListChecks, Loader2, Network, Play, Radar, RefreshCw, Search, Server, ShieldAlert, ShieldCheck, SlidersHorizontal, Wifi, XCircle, Zap } from 'lucide-react';
import './NetworkProbe.css';

const EMPTY_SCAN = { success: false, subnet: '', dispositivos: [], metadata: null };
const PORT_PROFILES = {
  infrastructure: { label: 'Infraestrutura', ports: [22, 53, 80, 443, 445, 1883, 3001, 3306, 3389, 5432, 6379] },
  web: { label: 'Aplicações web', ports: [80, 443, 3000, 3001, 5173, 8000, 8080, 8443] },
  iot: { label: 'IoT e automação', ports: [22, 80, 443, 502, 1883, 5683, 8080, 8883] },
  custom: { label: 'Personalizado', ports: [] }
};
/**
 * Módulo: frontend/src/pages/PainelDesenvolvedor/NetworkProbe.jsx
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
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const parsePorts = (value) => { if (Array.isArray(value)) return value; try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return String(value || '').split(',').map((port) => ({ porta: Number(port.trim()) })).filter((item) => item.porta); } }; /* Classifica serviços expostos para priorizar a investigação do desenvolvedor. */ const classifyPort = (port) => { const numericPort = Number(port); if ([23, 3306, 5432, 6379, 27017].includes(numericPort)) return 'critical'; if ([21, 22, 445, 1883, 3389, 554].includes(numericPort)) return 'warning'; return 'info'; }; const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Não informado'; const getJobDate = (job) => job.criado_em || job.created_at || job.data_criacao || job.updated_at; const getJobTone = (status) => { const normalized = String(status || '').toLowerCase(); if (normalized.includes('concl')) return 'success'; if (normalized.includes('cancel') || normalized.includes('erro')) return 'danger'; return 'warning'; }; /* Central IDS de descoberta, exposição de serviços e coordenação de sondas remotas. */ export default function NetworkProbe({ api, socket, showToast, addLog, setModalConfig, filiais = [] }) { const [storedResults, setStoredResults] = useState([]); const [jobs, setJobs] = useState([]); const [agents, setAgents] = useState([]); const [probeConfig, setProbeConfig] = useState(null); const [selectedNetworkKey, setSelectedNetworkKey] = useState(''); const [liveScan, setLiveScan] = useState(EMPTY_SCAN); const [selectedHost, setSelectedHost] = useState(null); const [filial, setFilial] = useState(filiais.find((item) => item && item !== 'Todas') || 'Todas'); const [ipRange, setIpRange] = useState('192.168.1.0/24'); const [portProfile, setPortProfile] = useState('infrastructure'); const [customPorts, setCustomPorts] = useState('80,443,1883,3001,3306'); const [scanLimit, setScanLimit] = useState(64); const [search, setSearch] = useState(''); const [riskFilter, setRiskFilter] = useState('ALL'); const [sourceFilter, setSourceFilter] = useState('ALL'); const [sortBy, setSortBy] = useState('risk'); const [activeView, setActiveView] = useState('hosts'); const [loading, setLoading] = useState(true); const [scanning, setScanning] = useState(false); const [queueing, setQueueing] = useState(false); const [revalidating, setRevalidating] = useState(false); const [autoRefresh, setAutoRefresh] = useState(true); const [lastUpdated, setLastUpdated] = useState(null); const activePorts = useMemo(() => { if (portProfile !== 'custom') return PORT_PROFILES[portProfile].ports; return [...new Set(customPorts.split(',').map(Number).filter((port) => Number.isInteger(port) && port > 0 && port <= 65535))].slice(0, 20); }, [portProfile, customPorts]); /* Atualiza relatórios persistidos e a fila de execução em uma única rodada. */ const loadData = useCallback(async (silent = false) => { if (!silent) setLoading(true); try { const [resultsResponse, jobsResponse, configResponse, agentsResponse] = await Promise.all([ api.get('/soc/scanner/resultados', { params: { limit: 500 } }), api.get('/soc/scanner/jobs'), api.get('/network-scan/config'), api.get('/soc/scanner/agents') ]); setStoredResults(Array.isArray(resultsResponse.data) ? resultsResponse.data : []); setJobs(Array.isArray(jobsResponse.data) ? jobsResponse.data : []); setProbeConfig(configResponse.data || null); setAgents(Array.isArray(agentsResponse.data) ? agentsResponse.data : []); setSelectedNetworkKey((current) => current || configResponse.data?.defaultNetworkKey || ''); setIpRange((current) => current === '192.168.1.0/24' && configResponse.data?.recommendedCidr ? configResponse.data.recommendedCidr : current); setLastUpdated(new Date()); } catch (error) { if (!silent) showToast(error.response?.data?.error || 'Falha ao carregar os dados da sonda.', 'error'); } finally { if (!silent) setLoading(false); } }, [api, showToast]);

  const selectedNetwork = probeConfig?.interfaces?.find((item) => item.key === selectedNetworkKey)
    || probeConfig?.interfaces?.find((item) => item.isDefault)
    || probeConfig?.interfaces?.[0]
    || null;
  const selectedGateway = probeConfig?.gateway || selectedNetwork?.gateway || null;
  const cidrValid = /^(?:\d{1,3}\.){3}\d{1,3}\/(?:[0-9]|[12][0-9]|3[0-2])$/.test(ipRange.trim())
    && ipRange.split('/')[0].split('.').every((part) => Number(part) >= 0 && Number(part) <= 255);

  const hosts = useMemo(() => {
    const normalizeHost = (item, source) => {
      const ports = parsePorts(item.portas ?? item.portas_abertas).map((port) => ({
        ...port,
        porta: Number(port.porta ?? port.port),
        servico: port.servico || port.service || ''
      })).filter((port) => Number.isInteger(port.porta));
      const criticalPorts = ports.filter((port) => classifyPort(port.porta) === 'critical').length;
      const warningPorts = ports.filter((port) => classifyPort(port.porta) === 'warning').length;
      const risk = criticalPorts ? 'CRITICAL' : warningPorts ? 'WARNING' : 'INFO';
      const ip = item.ip || item.ip_alvo || 'IP não informado';
      return {
        ...item,
        id: `${source}-${item.id || item.equipamentoId || ip}`,
        ip,
        hostname: item.hostname || item.nome || 'Host sem nome',
        filial: item.filial || filial || 'Não informada',
        source: item.registeredIot ? 'IoT cadastrado' : source,
        ports,
        risk,
        criticalPorts,
        warningPorts,
        observations: Number(item.observations || 1),
        scannedAt: item.scannedAt || item.data_scan || item.lastSeen || liveScan.metadata?.completedAt || null,
        status: item.status || (ports.length ? 'Online' : 'Sem resposta')
      };
    };
    const localHosts = (liveScan.dispositivos || []).map((item) => normalizeHost(item, 'Scanner local'));
    const historicalHosts = storedResults.map((item) => normalizeHost(item, 'Sonda remota'));
    const unique = new Map();
    [...historicalHosts, ...localHosts].forEach((host) => unique.set(`${host.filial}-${host.ip}`, host));
    return [...unique.values()];
  }, [filial, liveScan, storedResults]);

  const filteredHosts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const riskWeight = { CRITICAL: 3, WARNING: 2, INFO: 1 };
    return hosts.filter((host) => (!term || `${host.ip} ${host.hostname} ${host.filial}`.toLowerCase().includes(term))
      && (riskFilter === 'ALL' || host.risk === riskFilter)
      && (sourceFilter === 'ALL' || host.source === sourceFilter))
      .sort((a, b) => sortBy === 'recent'
        ? new Date(b.scannedAt || 0) - new Date(a.scannedAt || 0)
        : sortBy === 'ip' ? a.ip.localeCompare(b.ip, undefined, { numeric: true })
          : riskWeight[b.risk] - riskWeight[a.risk]);
  }, [hosts, riskFilter, search, sortBy, sourceFilter]);
  const currentHost = hosts.find((host) => host.id === selectedHost) || null;
  const metrics = useMemo(() => ({
    uniqueHosts: hosts.length,
    exposedPorts: hosts.reduce((total, host) => total + host.ports.length, 0),
    critical: hosts.filter((host) => host.risk === 'CRITICAL').length,
    pendingJobs: jobs.filter((job) => /pendente|aguardando|queued/i.test(String(job.status))).length,
    lastScan: hosts.reduce((latest, host) => Math.max(latest, new Date(host.scannedAt || 0).getTime() || 0), 0) || null,
    registeredIot: liveScan.metadata?.registeredIotCount || hosts.filter((host) => host.registeredIot).length,
    reachableIot: liveScan.metadata?.reachableIotCount || hosts.filter((host) => host.registeredIot && (host.networkReachable || host.telemetryOnline)).length,
    onlineAgents: agents.filter((agent) => agent.online).length
  }), [agents, hosts, jobs, liveScan.metadata]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => loadData(true), 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadData]);
  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => loadData(true);
    socket.on('network_probe_results_updated', refresh);
    return () => socket.off('network_probe_results_updated', refresh);
  }, [loadData, socket]);
  /**
   * Processa a interacao de handle network change e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleNetworkChange = (event) => {
    const key = event.target.value;
    const network = probeConfig?.interfaces?.find((item) => item.key === key);
    setSelectedNetworkKey(key);
    if (network?.cidr) setIpRange(network.cidr);
  };

  /**
   * Executa a varredura no servidor usando o escopo e o perfil escolhidos.
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
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const runLocalScan = async () => {
    setScanning(true);
    addLog?.(`[IDS] Varredura ${ipRange} iniciada com ${activePorts.length} portas.`, 'warning');
    try {
      const response = await api.get('/network-scan', { params: { cidr: ipRange.trim(), interfaceAddress: selectedNetwork?.address, ports: activePorts.join(','), limit: scanLimit } });
      setLiveScan(response.data || EMPTY_SCAN);
      setSelectedHost(null);
      showToast(`Varredura concluída: ${response.data?.dispositivos?.length || 0} host(s), incluindo ${response.data?.metadata?.registeredIotCount || 0} IoT cadastrado(s).`, 'success');
      addLog?.(`[IDS] ${response.data?.metadata?.totalAddressesTested || response.data?.metadata?.scannedHosts || 0} IPs verificados; ${response.data?.metadata?.reachableIotCount || 0} IoT acessível(is).`, 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Falha ao executar a varredura local.', 'error');
    } finally { setScanning(false); }
  };

  /**
   * Enfileira uma ordem para a sonda remota da filial selecionada.
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
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const queueRemoteScan = async () => {
    setQueueing(true);
    try {
      const response = await api.post('/soc/scanner/iniciar', { filial, ip_range: ipRange.trim(), network_mode: 'AUTO', ports: activePorts });
      showToast(response.data?.message || 'Ordem de varredura enfileirada.', 'success');
      addLog?.(`[IDS] Job remoto criado para ${filial}: ${ipRange.trim()}.`, 'success');
      await loadData(true);
      setActiveView('jobs');
    } catch (error) {
      showToast(error.response?.data?.error || 'Falha ao enfileirar a sonda remota.', 'error');
    } finally { setQueueing(false); }
  };

  /**
   * Confirma ações que geram tráfego na rede antes de executá-las.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} kind - Valor de kind consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const confirmScan = (kind) => {
    const action = kind === 'local' ? runLocalScan : queueRemoteScan;
    if (!setModalConfig) return action();
    setModalConfig({
      isOpen: true,
      title: kind === 'local' ? 'Iniciar varredura local' : 'Enfileirar sonda remota',
      message: kind === 'local' ? `A sonda testará ${activePorts.length} portas em até ${scanLimit} endereços de ${ipRange} e em todos os IoT cadastrados com IP válido. Deseja continuar?` : `Enviar uma ordem para o Raspberry de ${filial}? O agente usará automaticamente a rede à qual estiver conectado e incluirá os ESP cadastrados.`,
      isPrompt: false,
      onConfirm: action
    });
  };

  /**
   * Revalida somente o host selecionado e atualiza a evidência local.
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
  const revalidateHost = async () => {
    if (!currentHost) return;
    setRevalidating(true);
    try {
      const response = await api.post('/network-scan/host', { ip: currentHost.ip, ports: activePorts });
      const updated = response.data?.host;
      setLiveScan((current) => {
        const currentDevices = current.dispositivos || [];
        const devices = currentHost.registeredIot
          ? currentDevices.map((item) => item.equipamentoId === currentHost.equipamentoId ? {
            ...item, ...updated, registeredIot: true,
            networkReachable: Boolean(updated.portas?.length),
            status: updated.portas?.length && item.telemetryOnline ? 'Online' : item.telemetryOnline ? 'Telemetria ativa' : updated.portas?.length ? 'IP acessível' : 'Sem resposta'
          } : item)
          : [...currentDevices.filter((item) => item.ip !== updated.ip), updated];
        return { ...current, dispositivos: devices, metadata: { ...(current.metadata || {}), completedAt: new Date().toISOString() } };
      });
      setSelectedHost(currentHost.id);
      showToast(`${updated.portas?.length || 0} serviço(s) TCP confirmado(s) em ${updated.ip}.`, 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Falha ao revalidar o host.', 'error');
    } finally { setRevalidating(false); }
  };

  /**
   * Cancela um job pendente sem apagar seu registro histórico.
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
   * @param {unknown} job - Valor de job consumido por esta rotina.
   * @returns {boolean} Indica se a condição avaliada foi atendida.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const cancelJob = (job) => {

    /**
     * Concentra a logica de action para manter o restante do tela mais legivel.
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
    const action = async () => {
      try {
        await api.delete(`/soc/scanner/jobs/${job.id}`);
        showToast(`Job #${job.id} cancelado.`, 'success');
        await loadData(true);
      } catch (error) { showToast(error.response?.data?.error || 'Não foi possível cancelar o job.', 'error'); }
    };
    if (!setModalConfig) return action();
    setModalConfig({ isOpen: true, title: 'Cancelar varredura remota', message: `Cancelar o job #${job.id} de ${job.filial}?`, isPrompt: false, onConfirm: action });
  };

  /**
   * Exporta a visão filtrada para análise externa sem depender do backend.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const exportCsv = () => {
    const rows = [['IP', 'Hostname', 'Filial', 'Origem', 'Risco', 'Portas', 'Última leitura']];
    filteredHosts.forEach((host) => rows.push([host.ip, host.hostname, host.filial, host.source, host.risk, host.ports.map((port) => port.porta).join(' '), formatDate(host.scannedAt)]));
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `sonda-rede-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    URL.revokeObjectURL(url);
    showToast('Relatório CSV exportado.', 'success');
  };


  /**
   * Processa a interacao de copy host ip e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copyHostIp = async () => {
    if (!currentHost) return;
    await navigator.clipboard.writeText(currentHost.ip);
    showToast('Endereço IP copiado.', 'success');
  };

  return (
    <div className="network-probe-page">
      <header className="network-probe-header">
        <div><span className="network-probe-eyebrow"><Radar size={14} /> Network detection and response</span><h2>Sonda de Rede</h2><p>Descoberta ativa, superfície exposta, evidências históricas e coordenação das sondas distribuídas.</p></div>
        <div className="network-probe-header-actions">
          <button type="button" className={autoRefresh ? 'active' : ''} title={autoRefresh ? 'Atualização automática ativa' : 'Ativar atualização automática'} onClick={() => setAutoRefresh((value) => !value)}><Activity size={17} /></button>
          <span><i /> {lastUpdated ? `Sincronizado às ${lastUpdated.toLocaleTimeString('pt-BR')}` : 'Sincronizando IDS'}</span>
          <button type="button" title="Exportar visão filtrada" onClick={exportCsv} disabled={!filteredHosts.length}><Download size={17} /></button>
          <button type="button" title="Atualizar relatórios" onClick={() => loadData()} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button>
        </div>
      </header>

      <section className="network-probe-kpis">
        <article><span><Globe2 size={16} /> Hosts observados</span><strong>{metrics.uniqueHosts}</strong><small>Ativos únicos por rede e filial</small></article>
        <article className="ports"><span><Network size={16} /> Serviços expostos</span><strong>{metrics.exposedPorts}</strong><small>Portas TCP confirmadas</small></article>
        <article className="critical"><span><ShieldAlert size={16} /> Alta prioridade</span><strong>{metrics.critical}</strong><small>Hosts com exposição crítica</small></article>
        <article className="jobs"><span><ListChecks size={16} /> Jobs pendentes</span><strong>{metrics.pendingJobs}</strong><small>Ordens aguardando sondas remotas</small></article>
        <article className="last"><span><Clock size={16} /> Última leitura</span><strong>{metrics.lastScan ? new Date(metrics.lastScan).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</strong><small>{liveScan.subnet || 'Sem varredura local nesta sessão'}</small></article>
      </section>

      <section className="network-probe-launcher">
        <div className="probe-launcher-copy"><Crosshair size={20} /><div><strong>Nova investigação</strong><small>{selectedNetwork ? `${selectedNetwork.name} · gateway ${selectedGateway || 'não identificado'}` : 'Detectando a rota de rede ativa do servidor.'}</small></div></div>
        <label>Rede conectada<select value={selectedNetwork?.key || ''} onChange={handleNetworkChange} disabled={!probeConfig?.interfaces?.length}>{probeConfig?.interfaces?.map((network) => <option key={network.key} value={network.key}>{network.name} · {network.address}{network.isDefault ? ' · rota padrão' : ''}</option>)}</select></label>
        <label>Filial<select value={filial} onChange={(event) => setFilial(event.target.value)}><option value="Todas">Todas</option>{filiais.filter((item) => item && item !== 'Todas').map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Rede detectada (CIDR)<input className={!cidrValid ? 'invalid' : ''} value={ipRange} onChange={(event) => setIpRange(event.target.value)} placeholder="192.168.1.0/24" /></label>
        <label>Perfil<select value={portProfile} onChange={(event) => setPortProfile(event.target.value)}>{Object.entries(PORT_PROFILES).map(([key, profile]) => <option key={key} value={key}>{profile.label}</option>)}</select></label>
        <label>Limite<select value={scanLimit} onChange={(event) => setScanLimit(Number(event.target.value))}>{[16, 32, 64, 128].map((value) => <option key={value} value={value}>{value} hosts</option>)}</select></label>
        {portProfile === 'custom' && <label className="probe-custom-ports">Portas TCP<input value={customPorts} onChange={(event) => setCustomPorts(event.target.value)} placeholder="80,443,1883" /></label>}
        <div className="probe-launch-actions"><button type="button" className="secondary" onClick={() => confirmScan('remote')} disabled={queueing || !cidrValid}>{queueing ? <Loader2 size={16} className="spin" /> : <Wifi size={16} />} Remota</button><button type="button" className="primary" onClick={() => confirmScan('local')} disabled={scanning || !cidrValid || !activePorts.length}>{scanning ? <Loader2 size={16} className="spin" /> : <Play size={16} />} Varrer agora</button></div>
      </section>

      <section className="network-probe-scope"><SlidersHorizontal size={14} /><span>{activePorts.length} portas:</span><code>{activePorts.join(', ') || 'nenhuma porta válida'}</code><span className="probe-source-network">Origem: {selectedNetwork?.address || 'detectando'}{selectedGateway ? ` · gateway ${selectedGateway}` : ''}</span>{liveScan.metadata && <small>{liveScan.metadata.scannedHosts} de {liveScan.metadata.availableHosts} hosts verificados em {liveScan.metadata.durationMs} ms{liveScan.metadata.truncated ? ' · escopo limitado' : ''}</small>}</section>

      <section className="network-probe-workspace">
        <article className="probe-hosts-panel">
          <div className="probe-view-tabs"><button type="button" className={activeView === 'hosts' ? 'active' : ''} onClick={() => setActiveView('hosts')}><Server size={15} /> Ativos <span>{filteredHosts.length}</span></button><button type="button" className={activeView === 'jobs' ? 'active' : ''} onClick={() => setActiveView('jobs')}><History size={15} /> Fila <span>{jobs.length}</span></button><button type="button" className={activeView === 'agents' ? 'active' : ''} onClick={() => setActiveView('agents')}><Wifi size={15} /> Agentes <span>{agents.length}</span></button></div>
          {activeView === 'hosts' ? <>
            <div className="probe-toolbar"><label><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="IP, hostname ou filial" /></label><div><Filter size={14} />{['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((risk) => <button type="button" key={risk} className={riskFilter === risk ? 'active' : ''} onClick={() => setRiskFilter(risk)}>{risk === 'ALL' ? 'Todos' : risk}</button>)}</div><div className="probe-toolbar-selects"><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="ALL">Todas as origens</option><option value="IoT cadastrado">IoT cadastrado</option><option value="Scanner local">Scanner local</option><option value="Sonda remota">Sonda remota</option></select><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="risk">Maior risco</option><option value="recent">Mais recente</option><option value="ip">Endereço IP</option></select></div></div>
            <div className="probe-host-list">{loading ? <div className="probe-empty"><Loader2 size={22} className="spin" />Carregando relatórios...</div> : filteredHosts.map((host) => <button type="button" key={host.id} className={`${selectedHost === host.id ? 'selected' : ''} risk-${host.risk.toLowerCase()}`} onClick={() => setSelectedHost(host.id)}><span className="probe-host-state">{host.registeredIot ? <Cpu size={16} /> : host.risk === 'CRITICAL' ? <ShieldAlert size={16} /> : host.risk === 'WARNING' ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}</span><span><strong>{host.ip}</strong><small>{host.hostname} · {host.filial}</small></span><span><strong>{host.ports.length}</strong><small>{host.registeredIot ? host.status : `${host.observations} leitura(s)`}</small></span></button>)}{!loading && filteredHosts.length === 0 && <div className="probe-empty"><Radar size={23} />Nenhum host corresponde aos filtros.</div>}</div>
          </> : activeView === 'jobs' ? <div className="probe-job-list">{jobs.map((job) => <div key={job.id} className={`job-${getJobTone(job.status)}`}><span>{getJobTone(job.status) === 'success' ? <CheckCircle2 size={16} /> : getJobTone(job.status) === 'danger' ? <XCircle size={16} /> : <Clock size={16} />}</span><div><strong>Job #{job.id} · {job.filial}</strong><small>{job.agent_id ? `${job.agent_id} · ` : ''}{job.network_mode === 'AUTO' ? 'Rede automática' : job.ip_range} · {formatDate(getJobDate(job))}</small></div><em>{job.status}</em>{String(job.status).toLowerCase().includes('pendente') && <button type="button" title="Cancelar job" onClick={() => cancelJob(job)}><Ban size={14} /></button>}</div>)}{!loading && jobs.length === 0 && <div className="probe-empty"><ListChecks size={23} />Nenhuma ordem de varredura registrada.</div>}</div> : <div className="probe-agent-list">{agents.map((agent) => <div key={agent.agent_id} className={agent.online ? 'online' : 'offline'}><span><Wifi size={16} /></span><div><strong>{agent.hostname || agent.agent_id}</strong><small>{agent.agent_id} · {agent.filial}</small></div><div><strong>{agent.detected_cidr || 'Rede não detectada'}</strong><small>{agent.local_ip || 'Sem IP'} · gateway {agent.gateway || '--'}</small></div><em>{agent.online ? 'Online' : 'Offline'}</em></div>)}{!loading && agents.length === 0 && <div className="probe-empty"><Wifi size={23} />Nenhum Raspberry registrou heartbeat.</div>}</div>}
        </article>

        <article className="probe-detail-panel">
          <div className="probe-panel-title"><div><ShieldCheck size={17} /><span>Análise do host</span></div>{currentHost && <em className={`risk-${currentHost.risk.toLowerCase()}`}>{currentHost.risk}</em>}</div>
          {currentHost ? <>
            <div className="probe-host-heading"><div className={`risk-${currentHost.risk.toLowerCase()}`}><Server size={23} /></div><span><strong>{currentHost.hostname}</strong><small>{currentHost.ip} · {currentHost.source}</small></span><div className="probe-host-actions"><button type="button" title="Copiar IP" onClick={copyHostIp}><Copy size={15} /></button><button type="button" title="Revalidar host" onClick={revalidateHost} disabled={revalidating}>{revalidating ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}</button></div></div>
            <dl className="probe-facts"><div><dt>Filial</dt><dd>{currentHost.filial || 'Não informada'}</dd></div><div><dt>Status</dt><dd>{currentHost.status}</dd></div><div><dt>Origem</dt><dd>{currentHost.source}{currentHost.sourceAddress ? ` · ${currentHost.sourceAddress}` : ''}</dd></div><div><dt>Última leitura</dt><dd>{formatDate(currentHost.scannedAt)}</dd></div><div><dt>Latência TCP</dt><dd>{currentHost.latencyMs != null ? `${currentHost.latencyMs} ms` : 'Não medida'}</dd></div><div><dt>{currentHost.registeredIot ? 'Equipamento' : 'Evidências'}</dt><dd>{currentHost.registeredIot ? `#${currentHost.equipamentoId} · ${currentHost.setor || 'Sem setor'}` : `${currentHost.observations} observação(ões)`}</dd></div>{currentHost.registeredIot && <><div><dt>MAC address</dt><dd>{currentHost.macAddress || 'Não registrado'}</dd></div><div><dt>Firmware / sinal</dt><dd>{currentHost.firmwareVersion || 'Sem versão'} · {currentHost.signalDbm != null ? `${currentHost.signalDbm} dBm` : 'sem RSSI'}</dd></div></>}</dl>
            <div className="probe-risk-summary"><div className="risk-critical"><ShieldAlert size={16} /><span><strong>{currentHost.criticalPorts}</strong><small>críticas</small></span></div><div className="risk-warning"><AlertTriangle size={16} /><span><strong>{currentHost.warningPorts}</strong><small>atenção</small></span></div><div className="risk-info"><CheckCircle2 size={16} /><span><strong>{Math.max(0, currentHost.ports.length - currentHost.criticalPorts - currentHost.warningPorts)}</strong><small>informativas</small></span></div></div>
            <div className="probe-exposure-title"><span>Superfície exposta</span><small>{currentHost.ports.length} serviço(s)</small></div>
            <div className="probe-port-list">{currentHost.ports.map((port, index) => <div key={`${port.porta}-${index}`} className={`risk-${classifyPort(port.porta)}`}><span>{port.porta}</span><div><strong>{port.servico || 'Serviço TCP'}</strong><small>{classifyPort(port.porta) === 'critical' ? 'Restringir origem e revisar autenticação' : classifyPort(port.porta) === 'warning' ? 'Validar necessidade, ACL e versão' : 'Exposição informativa'}</small></div><em>{port.latencyMs != null ? `${port.latencyMs} ms` : classifyPort(port.porta)}</em></div>)}{currentHost.ports.length === 0 && <div className="probe-empty"><CheckCircle2 size={22} />Nenhuma porta do perfil respondeu.</div>}</div>
            <div className={`probe-guidance ${currentHost.risk === 'CRITICAL' ? 'danger' : ''}`}><Database size={17} /><span><strong>{currentHost.risk === 'CRITICAL' ? 'Ação recomendada' : 'Leitura IDS'}</strong><small>{currentHost.risk === 'CRITICAL' ? 'Confirme se bancos, caches ou protocolos legados precisam estar acessíveis nesta rede. Restrinja por firewall e revalide após a correção.' : 'A porta aberta confirma superfície TCP visível, mas não comprova vulnerabilidade. Correlacione com o inventário e as regras de acesso.'}</small></span></div>
          </> : <div className="probe-empty"><Radar size={24} />Execute uma varredura ou selecione um resultado histórico.</div>}
        </article>
      </section>

      <section className="network-probe-intelligence"><article><div><Layers3 size={16} /><strong>Cobertura da sessão</strong></div><p>{liveScan.metadata ? `${liveScan.metadata.totalAddressesTested || liveScan.metadata.scannedHosts} endereço(s) e ${liveScan.metadata.testedPorts?.length || 0} porta(s) testados.` : 'Execute uma varredura local para medir a cobertura efetiva.'}</p></article><article><div><Cpu size={16} /><strong>Inventário IoT</strong></div><p>{liveScan.metadata ? `${metrics.reachableIot} de ${metrics.registeredIot} IoT apresentaram resposta de rede ou telemetria recente.` : 'Os IPs privados cadastrados serão incluídos automaticamente na próxima varredura.'}</p></article><article><div><Zap size={16} /><strong>Exposição prioritária</strong></div><p>{metrics.critical ? `${metrics.critical} host(s) exigem revisão de segmentação ou ACL.` : 'Nenhum serviço crítico identificado nos dados atuais.'}</p></article><article><div><Wifi size={16} /><strong>Agentes Raspberry</strong></div><p>{agents.length ? `${metrics.onlineAgents} de ${agents.length} agente(s) com heartbeat ativo; ${metrics.pendingJobs} job(s) aguardando execução.` : 'A API está pronta para receber o primeiro agente Raspberry Pi.'}</p></article></section>
    </div>
  );
}
