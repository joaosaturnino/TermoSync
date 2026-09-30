/**
 * Módulo: frontend/src/pages/PainelDesenvolvedor/SerialEdgeMonitor.jsx
 * Responsabilidade: Implementa a tela Serial Edge Monitor, seus estados, interações e integrações de dados.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Braces, CircleStop, Copy, Cpu, DownloadCloud, Eraser, Gauge, HardDrive, PauseCircle, PlayCircle, Plug, Radio, RefreshCw, Search, Server, Thermometer, Wifi, WifiOff, X } from 'lucide-react';
import './SerialEdgeMonitor.css';
/**
 * Concentra a logica de fetch with timeout para manter o restante do tela mais legivel.
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
 * @param {unknown} url - Valor de url consumido por esta rotina.
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} timeoutMs - Valor de timeout ms consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/**
 * Aceita IPv4, hostname local e porta opcional, removendo protocolo e caminhos.
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
function normalizeTarget(value) {
  const normalized = String(value || '').trim().replace(/^https?:\/\//i, '').split('/')[0];
  return /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(normalized) ? normalized : '';
}

/**
 * Concentra a logica de classify line para manter o restante do tela mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} line - Valor de line consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function classifyLine(line) {
  const value = String(line).toLocaleLowerCase('pt-BR');
  if (/erro|falha|offline|cr.tic|exception|panic|alarme/.test(value)) return 'ERROR';
  if (/aviso|warn|prote..o|aten..o|bloquead/.test(value)) return 'WARNING';
  if (/telemetria|payload|temperatura|umidade|sensor|leitura/.test(value)) return 'TELEMETRY';
  return 'INFO';
}

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
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes >= 10240 ? 0 : 1)} KB`;
}

/**
 * Formata format uptime para exibicao segura na interface.
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
function formatUptime(value) {
  const seconds = Number(value || 0);
  if (!seconds) return 'Não informado';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}

/**
 * Converte o fallback MQTT para o mesmo formato textual exibido pelo firmware.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: publica ou consome mensagens MQTT
 *
 * @param {unknown} reading - Valor de reading consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function formatMqttAsSerialFrame(reading) {
  const rawPayload = typeof reading.raw_payload === 'string'
    ? reading.raw_payload
    : JSON.stringify(reading);
  let payload = reading;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    // O evento original ainda contém dados suficientes para montar o diagnóstico.
  }

  const epochMs = Number(payload.timestamp) * 1000;
  const receivedAt = Number.isFinite(epochMs) && epochMs > 0
    ? new Date(epochMs)
    : new Date(reading.data_hora || reading.ultima_comunicacao || Date.now());
  const dateParts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(receivedAt).reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  const dateLabel = `${dateParts.day}/${dateParts.month}/${dateParts.year} ${dateParts.hour}:${dateParts.minute}:${dateParts.second}`;
  const temperature = Number(payload.temperatura);
  const humidity = Number(payload.umidade);
  const rssi = Number(payload.sinal_wifi);
  const cooling = payload.estado_controle === 'REFRIGERANDO'
    || payload.motor_ligado === true
    || payload.atuador_simulado === true;
  const separator = '='.repeat(50);
  const lines = [
    '', separator, '[TELEMETRIA] Nova leitura de sensores', separator,
    `Data/hora: ${dateLabel}`,
    `Temperatura: ${Number.isFinite(temperature) ? temperature.toFixed(2) : 'nan'} C (calibrada)`,
    `Umidade: ${Number.isFinite(humidity) ? humidity.toFixed(1) : 'nan'}%`,
    `Atuador: ${cooling ? 'LIGADO (refrigerando)' : 'DESLIGADO'}`,
    `Sinal Wi-Fi: ${Number.isFinite(rssi) ? rssi : 0} dBm`
  ];

  if (payload.em_degelo) lines.push('[STATUS] Ciclo de degelo ativo');
  if (payload.bloqueio_emergencia) lines.push('[ALARME] Motor bloqueado pela central NOC');
  lines.push(separator, `[PAYLOAD] ${rawPayload}`);
  if (reading.leitura_uid || payload.leitura_uid) {
    lines.push(`[MQTT] Leitura confirmada: ${reading.leitura_uid || payload.leitura_uid}`);
  }
  return lines.join('\n');
}
/**
 * Renderiza a tela Serial Edge Monitor e concentra as regras de apresentacao desse modulo.
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
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador; troca eventos em tempo real; publica ou consome mensagens MQTT
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function SerialEdgeMonitor({ api, socket, showToast, setModalConfig }) {
  const [logs, setLogs] = useState('');
  const [liveLogs, setLiveLogs] = useState([]);
  const [health, setHealth] = useState(null);
  const [hardwareList, setHardwareList] = useState([]);
  const [activeTarget, setActiveTarget] = useState('');
  const [inputTarget, setInputTarget] = useState('');
  const [connectionState, setConnectionState] = useState('idle');
  const [latencyMs, setLatencyMs] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isFetchingHardware, setIsFetchingHardware] = useState(false);
  const [isPolling, setIsPolling] = useState(true);
  const [pollInterval, setPollInterval] = useState(3000);
  const [autoScroll, setAutoScroll] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [filterMode, setFilterMode] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [pollError, setPollError] = useState('');
  const [edgeUser, setEdgeUser] = useState('');
  const [edgePassword, setEdgePassword] = useState('');
  const terminalRef = useRef(null);
  const lastStreamAtRef = useRef(0);
  const edgeRequestOptions = useMemo(() => {
    if (!edgeUser || !edgePassword) return {};
    return { headers: { Authorization: `Basic ${window.btoa(`${edgeUser}:${edgePassword}`)}` } };
  }, [edgeUser, edgePassword]);

  // Atualiza a lista de placas conhecidas e seleciona a primeira com IP válido.
  const fetchHardware = useCallback(async () => { if (!api) return; setIsFetchingHardware(true); try { const response = await api.get('/hardware'); const devicesByTarget = new Map(); (Array.isArray(response.data) ? response.data : []).forEach((device) => { const target = normalizeTarget(device.ip); if (!target) return; const current = devicesByTarget.get(target); devicesByTarget.set(target, current ? { ...current, deviceCount: current.deviceCount + 1, equipmentIds: [...current.equipmentIds, device.id] } : { ...device, deviceCount: 1, equipmentIds: [device.id] }); }); const available = [...devicesByTarget.values()]; setHardwareList(available); setActiveTarget((current) => { if (current) return current; const firstTarget = normalizeTarget(available[0]?.ip); if (firstTarget) setInputTarget(firstTarget); return firstTarget; }); } catch (error) { showToast?.(error.response?.data?.error || 'Falha ao carregar o inventário IoT.', 'error'); } finally { setIsFetchingHardware(false); } }, [api, showToast]);
  const pollDevice = useCallback(async () => {
    if (!activeTarget) return;
    const startedAt = performance.now();
    try {
      const [healthResponse, logResponse] = await Promise.all([
        fetchWithTimeout(`http://${activeTarget}/health`, edgeRequestOptions),
        fetchWithTimeout(`http://${activeTarget}/logs`, edgeRequestOptions)
      ]);
      if (!healthResponse.ok || !logResponse.ok) throw new Error('Dispositivo indisponível');
      setHealth(await healthResponse.json());
      setLogs(await logResponse.text());
      setLatencyMs(Math.round(performance.now() - startedAt));
      setLastUpdate(new Date());
      setConnectionState('online');
      setPollError('');
    } catch (error) {
      setConnectionState('offline');
      setPollError(error.message || 'Sem resposta do dispositivo.');
    }
  }, [activeTarget, edgeRequestOptions]);
  useEffect(() => { fetchHardware(); }, [fetchHardware]);
  useEffect(() => { if (!isPolling || !activeTarget) return undefined; pollDevice(); const interval = window.setInterval(pollDevice, pollInterval); return () => window.clearInterval(interval); }, [activeTarget, isPolling, pollDevice, pollInterval]);
  useEffect(() => { if (!socket) return undefined; const receive = (reading) => { lastStreamAtRef.current = Date.now(); setLiveLogs((current) => [...current.slice(-300), formatMqttAsSerialFrame(reading)]); }; socket.on('nova_leitura', receive); return () => socket.off('nova_leitura', receive); }, [socket]);
  const combinedLogs = [logs, ...liveLogs].filter(Boolean).join('\n');
  const parsedLines = useMemo(() => combinedLogs.split(/\r?\n/).filter(Boolean).map((text, index) => ({ id: index, text, type: classifyLine(text) })), [combinedLogs]);
  const visibleLines = useMemo(() => parsedLines.filter((line) => (filterMode === 'ALL' || line.type === filterMode) && line.text.toLowerCase().includes(searchTerm.toLowerCase())), [filterMode, parsedLines, searchTerm]);
  const lineCounts = useMemo(() => parsedLines.reduce((counts, line) => ({ ...counts, [line.type]: (counts[line.type] || 0) + 1 }), { ALL: parsedLines.length }), [parsedLines]);
  const selectedHardware = hardwareList.find((item) => normalizeTarget(item.ip) === activeTarget) || null;
  const rssi = Number(health?.rssi ?? health?.sinal_wifi ?? selectedHardware?.sinal_wifi);
  const signalLabel = !Number.isFinite(rssi) ? 'Sem leitura' : rssi >= -60 ? 'Excelente' : rssi >= -72 ? 'Estável' : 'Fraco';
  const diagnosticFailures = [!activeTarget && 'Destino não selecionado', connectionState === 'offline' && 'Dispositivo sem resposta', pollError].filter(Boolean);
  const FILTERS = [['ALL', 'Todos'], ['ERROR', 'Erros'], ['WARNING', 'Avisos'], ['TELEMETRY', 'Telemetria'], ['INFO', 'Informações']];
  /**
   * Concentra a logica de connect manual target para manter o restante do tela mais legivel.
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
  const connectManualTarget = () => {
    const normalized = normalizeTarget(inputTarget);
    if (!normalized) {
      showToast?.('Informe um IP, hostname ou endereço com porta válido.', 'warning');
      return;
    }
    setHealth(null);
    setPollError('');
    setConnectionState('connecting');
    setActiveTarget(normalized);
    setIsPolling(true);
  };

  /**
   * Copia somente as linhas visíveis, respeitando os filtros ativos.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copyVisibleLogs = async () => {
    try {
      await navigator.clipboard.writeText(visibleLines.map((line) => line.text).join('\n'));
      showToast?.(`${visibleLines.length} linha(s) copiada(s).`, 'success');
    } catch {
      showToast?.('Não foi possível copiar os logs.', 'error');
    }
  };

  /**
   * Exporta os logs brutos sem alterar o buffer mantido pelo dispositivo.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const exportLogs = () => {
    if (!combinedLogs) return;
    const url = URL.createObjectURL(new Blob([combinedLogs], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `termosync-edge-${activeTarget.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Limpa o buffer volátil do ESP32 somente após confirmação explícita.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const requestClearLogs = () => {
    if (!activeTarget) return;
    setModalConfig?.({
      isOpen: true,
      title: 'Limpar buffer serial',
      message: `Confirma a limpeza dos logs em RAM do dispositivo ${activeTarget}? Esta ação não altera configurações nem diagnósticos persistidos.`,
      onConfirm: async () => {
        try {
          const response = await fetchWithTimeout(`http://${activeTarget}/clear`, { ...edgeRequestOptions, method: 'POST' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          setLogs('');
          setLiveLogs([]);
          showToast?.('Buffer serial do dispositivo limpo.', 'success');
        } catch {
          showToast?.('O dispositivo não respondeu ao comando de limpeza.', 'error');
        }
      }
    });
  };

  return (
    <section className="serial-page anim-fade-in" aria-labelledby="serial-title">
      <header className="serial-header">
        <div>
          <span className="serial-eyebrow"><Radio size={14} /> Diagnóstico de borda</span>
          <h2 id="serial-title">Monitor Serial Edge</h2>
          <p>Console remoto e integridade operacional do firmware embarcado.</p>
        </div>
        <div className="serial-header-actions">
          <span className={`serial-connection is-${connectionState}`}>
            {connectionState === 'connected' || connectionState === 'streaming' ? <Wifi size={15} /> : <WifiOff size={15} />}
            {connectionState === 'streaming' ? 'MQTT em tempo real' : connectionState === 'connected' ? 'Dispositivo conectado' : connectionState === 'connecting' ? 'Conectando' : connectionState === 'offline' ? 'Dispositivo offline' : 'Aguardando dispositivo'}
          </span>
          <button type="button" onClick={() => setIsPolling((value) => !value)} disabled={!activeTarget}>
            {isPolling ? <PauseCircle size={17} /> : <PlayCircle size={17} />}{isPolling ? 'Pausar leitura' : 'Retomar leitura'}
          </button>
        </div>
      </header>

      <section className="serial-connection-bar">
        <label className="serial-device-select"><Server size={16} /><select value={selectedHardware ? activeTarget : ''} onChange={(event) => { const target = normalizeTarget(event.target.value); setInputTarget(target); setActiveTarget(target); setHealth(null); setIsPolling(true); }}><option value="">Selecionar dispositivo inventariado</option>{hardwareList.map((device) => <option key={normalizeTarget(device.ip)} value={normalizeTarget(device.ip)}>{device.nome} · {device.ip}{device.deviceCount > 1 ? ` · ${device.deviceCount} cadastros neste IP` : ` · ${device.filial || 'Sem filial'}`}</option>)}</select><button type="button" title="Atualizar inventário" onClick={fetchHardware}><RefreshCw size={15} className={isFetchingHardware ? 'spin' : ''} /></button></label>
        <form className="serial-manual-target" onSubmit={(event) => { event.preventDefault(); connectManualTarget(); }}><label><Plug size={15} /><input value={inputTarget} onChange={(event) => setInputTarget(event.target.value)} placeholder="IP ou hostname local" /></label><button type="submit" title="Conectar ao endereço"><Plug size={16} /></button></form>
        <form className="serial-manual-target" onSubmit={(event) => event.preventDefault()} autoComplete="off"><label><input value={edgeUser} onChange={(event) => setEdgeUser(event.target.value)} placeholder="Usuário Edge" autoComplete="off" /></label><label><input type="password" value={edgePassword} onChange={(event) => setEdgePassword(event.target.value)} placeholder="Senha Edge" autoComplete="new-password" /></label></form>
        <label className="serial-interval"><span>Intervalo</span><select value={pollInterval} onChange={(event) => setPollInterval(Number(event.target.value))}><option value={2000}>2s</option><option value={3000}>3s</option><option value={5000}>5s</option><option value={10000}>10s</option></select></label>
      </section>

      <div className="serial-kpis">
        <article className="is-latency"><span><Gauge size={15} /> Resposta HTTP</span><strong>{latencyMs ?? '--'}<small> ms</small></strong><p>{lastUpdate ? `Atualizado às ${lastUpdate.toLocaleTimeString('pt-BR')}` : 'Aguardando primeira consulta'}</p></article>
        <article className="is-signal"><span><Wifi size={15} /> Sinal Wi-Fi</span><strong>{Number.isFinite(rssi) ? `${rssi} dBm` : '--'}</strong><p>{signalLabel}</p></article>
        <article className="is-memory"><span><Cpu size={15} /> Heap livre</span><strong>{health?.heap_livre ? formatBytes(health.heap_livre) : '--'}</strong><p>{health?.heap_minimo ? `Mínimo registrado: ${formatBytes(health.heap_minimo)}` : 'Diagnóstico não recebido'}</p></article>
        <article className="is-health"><span><Activity size={15} /> Integridade</span><strong>{diagnosticFailures === null ? '--' : diagnosticFailures === 0 ? 'OK' : `${diagnosticFailures} falha(s)`}</strong><p>{health?.ultimo_reset ? `Último reset: ${health.ultimo_reset}` : 'Estado da placa indisponível'}</p></article>
      </div>

      <div className="serial-workspace">
        <main className="serial-console-panel">
          <div className="serial-console-toolbar">
            <label className="serial-search"><Search size={15} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar no buffer serial" />{searchTerm && <button type="button" title="Limpar busca" onClick={() => setSearchTerm('')}><X size={14} /></button>}</label>
            <div className="serial-console-actions"><button type="button" title="Atualizar agora" onClick={pollDevice} disabled={!activeTarget}><RefreshCw size={16} /></button><button type="button" title="Copiar linhas visíveis" onClick={copyVisibleLogs} disabled={!visibleLines.length}><Copy size={16} /></button><button type="button" title="Exportar log bruto" onClick={exportLogs} disabled={!combinedLogs}><DownloadCloud size={16} /></button><button type="button" title="Limpar buffer da placa" className="is-danger" onClick={requestClearLogs} disabled={!activeTarget}><Eraser size={16} /></button></div>
          </div>

          <div className="serial-filter-row">
            <div className="serial-filters" role="tablist" aria-label="Filtros do log serial">{FILTERS.map((filter) => <button type="button" role="tab" aria-selected={filterMode === filter.key} className={filterMode === filter.key ? 'active' : ''} key={filter.key} onClick={() => setFilterMode(filter.key)}><span>{filter.label}</span><b>{filter.key === 'ALL' ? parsedLines.length : lineCounts[filter.key]}</b></button>)}</div>
            <label className="serial-toggle"><input type="checkbox" checked={wrapLines} onChange={(event) => setWrapLines(event.target.checked)} /><span /> Quebrar linhas</label>
            <label className="serial-toggle"><input type="checkbox" checked={autoScroll} onChange={(event) => setAutoScroll(event.target.checked)} /><span /> Auto-scroll</label>
            <label className="serial-toggle"><input type="checkbox" checked={compactMode} onChange={(event) => setCompactMode(event.target.checked)} /><span /> Compacto</label>
          </div>

          {pollError && <div className="serial-poll-error"><AlertTriangle size={15} /><span>{pollError}</span><button type="button" onClick={pollDevice}>Tentar agora</button></div>}

          <div className={`serial-terminal ${wrapLines ? 'is-wrapped' : ''} ${compactMode ? 'is-compact' : ''}`} ref={terminalRef}>
            {visibleLines.length && combinedLogs ? visibleLines.map((line) => <div className={`serial-line is-${line.category.toLowerCase()}`} key={line.id}><span>{String(line.number).padStart(4, '0')}</span><i /><code>{line.text || ' '}</code></div>) : <div className="serial-empty"><Braces size={24} /><strong>{combinedLogs ? 'Nenhuma linha encontrada' : 'Aguardando dados seriais'}</strong><span>{activeTarget ? 'As leituras MQTT aparecerão aqui mesmo sem acesso HTTP direto à placa.' : 'Selecione uma placa inventariada ou informe um endereço local.'}</span></div>}
          </div>
          <footer className="serial-console-footer"><span>{visibleLines.length} de {parsedLines.length} linha(s)</span><span>{formatBytes(new Blob([combinedLogs]).size)} no buffer</span><span>{activeTarget || 'Stream geral'}</span></footer>
        </main>

        <aside className="serial-diagnostics">
          <section>
            <div className="serial-section-title"><div><Cpu size={16} /><span>Estado da placa</span></div><small>{health?.device_uuid || selectedHardware?.mac || 'UUID indisponível'}</small></div>
            <div className="serial-health-grid">
              {[['Wi-Fi', health?.wifi_ok, Wifi], ['MQTT', health?.mqtt_ok, Radio], ['Sensor NTC', health?.ntc_ok, Thermometer], ['Sensor DHT', health?.dht_ok, Activity]].map(([label, state, Icon]) => <div className={state === undefined ? 'is-unknown' : state ? 'is-ok' : 'is-failed'} key={label}><Icon size={16} /><span>{label}</span><strong>{state === undefined ? 'N/A' : state ? 'OK' : 'FALHA'}</strong></div>)}
            </div>
          </section>

          <section>
            <div className="serial-section-title"><div><HardDrive size={16} /><span>Runtime embarcado</span></div><small>{health?.estado || 'Sem snapshot'}</small></div>
            <dl className="serial-runtime-list">
              <div><dt>Equipamento</dt><dd>{selectedHardware?.nome || health?.equipamento_id || 'Manual'}</dd></div>
              <div><dt>Filial</dt><dd>{selectedHardware?.filial || 'Não vinculada'}</dd></div>
              <div><dt>Firmware</dt><dd>{selectedHardware?.fwVersion || 'Não informado'}</dd></div>
              <div><dt>Uptime</dt><dd>{formatUptime(selectedHardware?.uptime)}</dd></div>
              <div><dt>Relé</dt><dd className={health?.rele ? 'is-ok' : ''}>{health?.rele ? 'Ligado' : 'Desligado'}</dd></div>
              <div><dt>Controle</dt><dd>{health?.controle_manual ? 'Manual' : 'Automático'}</dd></div>
            </dl>
          </section>

          <section>
            <div className="serial-section-title"><div><CircleStop size={16} /><span>Contadores persistidos</span></div><small>NVS do dispositivo</small></div>
            <div className="serial-counter-grid"><div><span>Boots</span><strong>{health?.boots ?? '--'}</strong></div><div><span>Watchdog</span><strong>{health?.watchdog_resets ?? '--'}</strong></div><div><span>Falhas Wi-Fi</span><strong>{health?.falhas_wifi ?? '--'}</strong></div><div><span>Falhas MQTT</span><strong>{health?.falhas_mqtt ?? '--'}</strong></div><div><span>Falhas NTC</span><strong>{health?.falhas_ntc ?? '--'}</strong></div><div><span>Falhas DHT</span><strong>{health?.falhas_dht ?? '--'}</strong></div></div>
          </section>
        </aside>
      </div>
    </section>
  );
}
