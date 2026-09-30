/**
 * Módulo: frontend/src/pages/PainelDesenvolvedor/LiveFirehose.jsx
 * Responsabilidade: Implementa a tela Live Firehose, seus estados, interações e integrações de dados.
 */

import { Activity, AlertTriangle, Copy, Database, DownloadCloud, Filter, Gauge, Network, PauseCircle, PlayCircle, Radio, Search, Server, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './LiveFirehose.css';

const MAX_PACKETS = 500;
const CHART_SECONDS = 30;
/**
 * Módulo: frontend/src/pages/PainelDesenvolvedor/LiveFirehose.jsx
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} eventName - Valor de event name consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function classifyEvent(eventName) {
  const name = String(eventName || '').toLowerCase();
  if (name.includes('alert') || name.includes('erro') || name.includes('falha')) return 'ALERT';
  if (name.includes('leitura') || name.includes('telemetr') || name.includes('sensor')) return 'TELEMETRY';
  if (name.includes('system') || name.includes('deploy') || name.includes('health') || name.includes('atualizacao')) return 'SYSTEM';
  return 'OTHER';
}

/**
 * Serializa qualquer payload recebido sem permitir que referências circulares quebrem a tela.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object|Array} payload - Dados de entrada que serão validados e transformados pelo fluxo.
 * @param {unknown} indentation - Valor de indentation consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function stringifyPayload(payload, indentation = 0) {
  try {
    const seen = new WeakSet();
    return JSON.stringify(payload, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    }, indentation);
  } catch {
    return String(payload);
  }
}

/**
 * Resume o payload para a lista, preservando o conteúdo integral no inspetor lateral.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object|Array} payload - Dados de entrada que serão validados e transformados pelo fluxo.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function getPayloadPreview(payload) {
  const serialized = stringifyPayload(payload);
  return serialized.length > 180 ? `${serialized.slice(0, 180)}...` : serialized;
}

const categoryMeta = {
  ALL: { label: 'Todos', icon: Filter },
  TELEMETRY: { label: 'Telemetria', icon: Activity },
  ALERT: { label: 'Alertas', icon: AlertTriangle },
  SYSTEM: { label: 'Sistema', icon: Server },
  OTHER: { label: 'Outros', icon: Radio }
};

/**
 * Observatório em tempo real dos eventos Socket.IO recebidos pelo cliente DEV. O buffer é
 * limitado para manter a interface estável mesmo sob fluxo intenso.
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
 * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador; troca eventos em tempo real
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.addLog - Propriedade addLog usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function LiveFirehose({ socket, addLog, showToast }) {
  const [packets, setPackets] = useState([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [connectionState, setConnectionState] = useState(socket?.connected ? 'connected' : 'disconnected');
  const [latency, setLatency] = useState(null);
  const [filterMode, setFilterMode] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPacketId, setSelectedPacketId] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [compactMode, setCompactMode] = useState(true);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [activityTimestamps, setActivityTimestamps] = useState([]);
  const [discardedCount, setDiscardedCount] = useState(0);
  const sequenceRef = useRef(0);
  const bufferInputCountRef = useRef(0);
  const streamingRef = useRef(true);
  const feedRef = useRef(null);

  useEffect(() => { streamingRef.current = isStreaming; }, [isStreaming]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    /**
     * Acrescenta um evento ao buffer circular e registra descartes por capacidade.
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
     * @param {unknown} eventName - Valor de event name consumido por esta rotina.
     * @param {unknown} args - Valor de args consumido por esta rotina.
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const capturePacket = (eventName, ...args) => {
      if (!streamingRef.current) return;
      const payload = args.length === 1 ? args[0] : args;
      const receivedAt = Date.now();
      const packet = {
        id: `${receivedAt}-${sequenceRef.current += 1}`,
        sequence: sequenceRef.current,
        event: String(eventName || 'evento_sem_nome'),
        category: classifyEvent(eventName),
        receivedAt,
        payload: payload ?? { info: 'Evento sem payload' }
      };
      bufferInputCountRef.current += 1;
      if (bufferInputCountRef.current > MAX_PACKETS) setDiscardedCount((count) => count + 1);
      setActivityTimestamps((timestamps) => [
        ...timestamps.filter((timestamp) => timestamp >= receivedAt - 60000),
        receivedAt
      ].slice(-10000));

      setPackets((current) => {
        const willDiscard = current.length >= MAX_PACKETS;
        return [...(willDiscard ? current.slice(1) : current), packet];
      });
    };


    /**
     * Processa a interacao de handle connect e atualiza a interface conforme o resultado.
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
    const handleConnect = () => setConnectionState('connected');

    /**
     * Processa a interacao de handle disconnect e atualiza a interface conforme o resultado.
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
    const handleDisconnect = () => setConnectionState('disconnected');

    /**
     * Processa a interacao de handle connect error e atualiza a interface conforme o resultado.
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
    const handleConnectError = () => setConnectionState('error');

    socket.onAny(capturePacket);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    addLog?.('[WSS] Captura do Live Firehose iniciada.', 'warning');

    return () => {
      socket.offAny(capturePacket);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket, addLog]);

  useEffect(() => {
    if (!socket) return undefined;

    /**
     * Mede o tempo de ida e volta usando o callback já exposto pelo servidor Socket.IO.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     *
     * Efeitos colaterais: atualiza estado reativo da interface; troca eventos em tempo real
     *
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const measureLatency = () => {
      if (!socket.connected) {
        setLatency(null);
        return;
      }
      const startedAt = Date.now();
      socket.emit('medir_latencia', startedAt, () => setLatency(Date.now() - startedAt));
    };

    measureLatency();
    const intervalId = window.setInterval(measureLatency, 10000);
    return () => window.clearInterval(intervalId);
  }, [socket]);

  useEffect(() => {
    if (autoScroll && feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [packets, autoScroll]);

  const eventCounts = useMemo(() => packets.reduce((counts, packet) => {
    counts[packet.category] += 1;
    return counts;
  }, { TELEMETRY: 0, ALERT: 0, SYSTEM: 0, OTHER: 0 }), [packets]);

  const filteredPackets = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase('pt-BR');
    return packets.filter((packet) => {
      if (filterMode !== 'ALL' && packet.category !== filterMode) return false;
      if (!term) return true;
      return packet.event.toLocaleLowerCase('pt-BR').includes(term)
        || stringifyPayload(packet.payload).toLocaleLowerCase('pt-BR').includes(term);
    });
  }, [packets, filterMode, searchTerm]);

  const selectedPacket = useMemo(
    () => packets.find((packet) => packet.id === selectedPacketId) || null,
    [packets, selectedPacketId]
  );

  const flowSeries = useMemo(() => {
    const buckets = Array.from({ length: CHART_SECONDS }, (_, index) => ({
      second: CHART_SECONDS - index - 1,
      count: 0
    }));
    activityTimestamps.forEach((receivedAt) => {
      const age = Math.floor((clockNow - receivedAt) / 1000);
      if (age >= 0 && age < CHART_SECONDS) buckets[CHART_SECONDS - age - 1].count += 1;
    });
    return buckets;
  }, [activityTimestamps, clockNow]);

  const lastMinuteCount = activityTimestamps.filter((timestamp) => timestamp >= clockNow - 60000).length;

  const maxFlow = Math.max(1, ...flowSeries.map((item) => item.count));
  const uniqueEvents = useMemo(() => new Set(packets.map((packet) => packet.event)).size, [packets]);

  /** Limpa buffer, seleção e contadores da sessão visual atual. */
  const clearConsole = useCallback(() => {
    setPackets([]);
    setSelectedPacketId(null);
    setDiscardedCount(0);
    setActivityTimestamps([]);
    bufferInputCountRef.current = 0;
    addLog?.('[WSS] Buffer do Live Firehose limpo.', 'info');
  }, [addLog]);

  /** Copia o payload selecionado em JSON formatado para análise externa. */
  const copySelectedPayload = useCallback(async () => {
    if (!selectedPacket) return;
    try {
      await navigator.clipboard.writeText(stringifyPayload(selectedPacket.payload, 2));
      showToast?.('Payload copiado.', 'success');
    } catch {
      showToast?.('Não foi possível copiar o payload.', 'error');
    }
  }, [selectedPacket, showToast]);

  /** Exporta o recorte filtrado como JSON Lines, formato adequado para ferramentas de log. */
  const exportPackets = useCallback(() => {
    if (!filteredPackets.length) return;
    const content = filteredPackets.map((packet) => stringifyPayload({
      sequence: packet.sequence,
      event: packet.event,
      category: packet.category,
      receivedAt: new Date(packet.receivedAt).toISOString(),
      payload: packet.payload
    })).join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'application/x-ndjson;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `termosync-firehose-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast?.(`${filteredPackets.length} evento(s) exportado(s).`, 'success');
  }, [filteredPackets, showToast]);

  return (
    <section className="firehose-page anim-fade-in" aria-labelledby="firehose-title">
      <header className="firehose-header">
        <div>
          <span className="firehose-eyebrow"><Network size={14} /> Observabilidade em tempo real</span>
          <h2 id="firehose-title">Live Firehose</h2>
          <p>Inspeção do tráfego Socket.IO recebido por esta sessão de desenvolvimento.</p>
        </div>
        <div className="firehose-header-actions">
          <span className={`firehose-connection is-${connectionState}`}>
            {connectionState === 'connected' ? <Wifi size={15} /> : <WifiOff size={15} />}
            {connectionState === 'connected' ? 'Socket conectado' : connectionState === 'error' ? 'Falha na conexão' : 'Socket desconectado'}
          </span>
          <button type="button" className={isStreaming ? 'is-capturing' : ''} onClick={() => setIsStreaming((value) => !value)}>
            {isStreaming ? <PauseCircle size={17} /> : <PlayCircle size={17} />}
            {isStreaming ? 'Pausar captura' : 'Retomar captura'}
          </button>
        </div>
      </header>

      <div className="firehose-kpis">
        <article className="is-throughput"><span><Activity size={15} /> Fluxo atual</span><strong>{lastMinuteCount}<small>/min</small></strong><p>{(lastMinuteCount / 60).toFixed(2)} evento(s) por segundo</p></article>
        <article className="is-latency"><span><Gauge size={15} /> Latência</span><strong>{latency ?? '--'}<small> ms</small></strong><p>{latency === null ? 'Aguardando resposta do servidor' : latency <= 80 ? 'Canal com resposta saudável' : 'Resposta acima do esperado'}</p></article>
        <article className="is-types"><span><Database size={15} /> Eventos distintos</span><strong>{uniqueEvents}</strong><p>{packets.length} evento(s) retido(s) no buffer</p></article>
        <article className="is-alerts"><span><AlertTriangle size={15} /> Alertas no buffer</span><strong>{eventCounts.ALERT}</strong><p>{discardedCount} descartado(s) pelo limite local</p></article>
      </div>

      <section className="firehose-flow-panel">
        <div className="firehose-section-title"><div><Radio size={16} /><span>Atividade nos últimos 30 segundos</span></div><small>{isStreaming ? 'Captura ativa' : 'Captura pausada'}</small></div>
        <div className="firehose-flow-chart" aria-label="Volume de eventos nos últimos 30 segundos">
          {flowSeries.map((item, index) => <i key={`${item.second}-${index}`} style={{ height: `${Math.max(4, (item.count / maxFlow) * 100)}%` }} title={`${item.count} evento(s)`} />)}
        </div>
      </section>

      <div className={`firehose-workspace ${selectedPacket ? 'has-inspector' : ''}`}>
        <main className="firehose-stream-panel">
          <div className="firehose-toolbar">
            <label className="firehose-search"><Search size={15} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar evento ou conteúdo do payload" />{searchTerm && <button type="button" title="Limpar busca" onClick={() => setSearchTerm('')}><X size={14} /></button>}</label>
            <div className="firehose-toolbar-buttons">
              <button type="button" title="Exportar eventos filtrados" onClick={exportPackets} disabled={!filteredPackets.length}><DownloadCloud size={16} /></button>
              <button type="button" title="Limpar buffer" className="is-danger" onClick={clearConsole} disabled={!packets.length}><Trash2 size={16} /></button>
            </div>
          </div>

          <div className="firehose-filter-row">
            <div className="firehose-filters" role="tablist" aria-label="Categorias de evento">
              {Object.entries(categoryMeta).map(([key, meta]) => {
                const Icon = meta.icon;
                const count = key === 'ALL' ? packets.length : eventCounts[key];
                return <button type="button" role="tab" aria-selected={filterMode === key} className={filterMode === key ? 'active' : ''} key={key} onClick={() => setFilterMode(key)}><Icon size={13} /><span>{meta.label}</span><b>{count}</b></button>;
              })}
            </div>
            <label className="firehose-toggle"><input type="checkbox" checked={compactMode} onChange={(event) => setCompactMode(event.target.checked)} /><span /> Compacto</label>
            <label className="firehose-toggle"><input type="checkbox" checked={autoScroll} onChange={(event) => setAutoScroll(event.target.checked)} /><span /> Auto-scroll</label>
          </div>

          <div className={`firehose-feed ${compactMode ? 'is-compact' : ''}`} ref={feedRef}>
            {filteredPackets.length === 0 ? (
              <div className="firehose-empty"><Radio size={24} /><strong>{packets.length ? 'Nenhum evento neste filtro' : 'Aguardando eventos'}</strong><span>{isStreaming ? 'O tráfego recebido aparecerá aqui em tempo real.' : 'Retome a captura para receber novos eventos.'}</span></div>
            ) : filteredPackets.map((packet) => (
              <button type="button" key={packet.id} className={`firehose-event is-${packet.category.toLowerCase()} ${selectedPacketId === packet.id ? 'selected' : ''}`} onClick={() => setSelectedPacketId(packet.id)}>
                <time><span>{new Date(packet.receivedAt).toLocaleTimeString('pt-BR', { hour12: false })}</span><small>#{packet.sequence}</small></time>
                <i />
                <div><strong>{packet.event}</strong><code>{getPayloadPreview(packet.payload)}</code></div>
                <span>{categoryMeta[packet.category].label}</span>
              </button>
            ))}
          </div>

          <footer className="firehose-footer"><span>{filteredPackets.length} de {packets.length} evento(s) exibido(s)</span><span>Buffer máximo: {MAX_PACKETS}</span></footer>
        </main>

        {selectedPacket && (
          <aside className="firehose-inspector">
            <header><div><span>Evento #{selectedPacket.sequence}</span><strong>{selectedPacket.event}</strong></div><button type="button" title="Fechar inspetor" onClick={() => setSelectedPacketId(null)}><X size={17} /></button></header>
            <dl>
              <div><dt>Categoria</dt><dd className={`is-${selectedPacket.category.toLowerCase()}`}>{categoryMeta[selectedPacket.category].label}</dd></div>
              <div><dt>Recebido em</dt><dd>{new Date(selectedPacket.receivedAt).toLocaleString('pt-BR')}</dd></div>
              <div><dt>Tamanho</dt><dd>{new Blob([stringifyPayload(selectedPacket.payload)]).size.toLocaleString('pt-BR')} bytes</dd></div>
            </dl>
            <div className="firehose-payload-header"><span>Payload completo</span><button type="button" onClick={copySelectedPayload}><Copy size={14} /> Copiar</button></div>
            <pre>{stringifyPayload(selectedPacket.payload, 2)}</pre>
          </aside>
        )}
      </div>
    </section>
  );
}
