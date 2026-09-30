/**
 * Módulo: frontend/src/pages/HardwareIoT/HardwareIoT.jsx
 * Responsabilidade: Implementa a tela Hardware Io T, seus estados, interações e integrações de dados.
 */

import { Activity, AlertTriangle, Building2, Clock, Droplets, HardDrive, ListChecks, PackageCheck, Rocket, ShieldCheck, Thermometer, Wifi } from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Cpu, RefreshCw, Power, Search, MapPin,
  Loader2
} from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '../../config/api.js';
import './HardwareIoT.css';

const EMPTY_OVERVIEW = {
  devices: [],
  sites: [],
  firmware: [],
  events: [],
  summary: {
    total: 0,
    online: 0,
    offline: 0,
    degraded: 0,
    unprovisioned: 0,
    weakSignal: 0,
    outdatedFirmware: 0,
    averageSignal: null,
    targetFirmware: null
  },
  generatedAt: null
};

/** Mantém a tela utilizável mesmo quando uma versão antiga da API omite parte do contrato. */
const normalizeOverview = (payload) => ({
  ...EMPTY_OVERVIEW,
  ...(payload && typeof payload === 'object' ? payload : {}),
  devices: Array.isArray(payload?.devices) ? payload.devices : [],
  sites: Array.isArray(payload?.sites) ? payload.sites : [],
  firmware: Array.isArray(payload?.firmware) ? payload.firmware : [],
  events: Array.isArray(payload?.events) ? payload.events : [],
  summary: {
    ...EMPTY_OVERVIEW.summary,
    ...(payload?.summary && typeof payload.summary === 'object' ? payload.summary : {})
  }
});

const statusClass = (status) => String(status || 'UNPROVISIONED').toLowerCase();

const formatDecimal = (value, suffix) => {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)}${suffix}` : 'N/A';
};

/**
 * Formata format heartbeat para exibicao segura na interface.
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
const formatHeartbeat = (seconds) => {
  if (seconds === null || seconds === undefined) return 'Nunca sincronizado';
  if (seconds < 60) return `Há ${seconds}s`;
  if (seconds < 3600) return `Há ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `Há ${Math.floor(seconds / 3600)}h`;
  return `Há ${Math.floor(seconds / 86400)}d`;
};

/**
 * Normaliza texto para que a pesquisa ignore acentos e caixa.
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
const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Exibe a central de gestão da frota IoT, reunindo inventário, telemetria, firmware, cobertura
 * por filial e comandos MQTT auditados.
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
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador; troca eventos em tempo real; publica ou consome mensagens MQTT; registra informações de diagnóstico
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function HardwareIoT({ showToast, isOffline, socket, setModalConfig }) {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [loadError, setLoadError] = useState('');

  // Busca no backend um retrato consistente da frota e mantém a seleção atual.
  const carregarHardware = useCallback(async (manual = false) => {
    if (manual) setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${getApiUrl()}/hardware/overview${manual ? '?refresh=1' : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = normalizeOverview(response.data);
      setOverview(payload);
      setLoadError('');
      setSelectedId(current => payload.devices.some(device => device.id === current)
        ? current
        : (payload.devices[0]?.id || null));
      if (manual) showToast?.('Frota IoT sincronizada.', 'success');
    } catch (error) {
      const message = error.response?.data?.error || 'Não foi possível carregar a frota IoT.';
      console.warn('[HARDWARE] Falha ao carregar overview IoT:', error.message);
      setLoadError(message);
      if (manual) showToast?.(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);
  useEffect(() => { carregarHardware(); const interval = window.setInterval(() => carregarHardware(), 15000); return () => window.clearInterval(interval); }, [carregarHardware]);
  useEffect(() => { if (!socket) return undefined; const refresh = () => carregarHardware(); socket.on('atualizacao_dados', refresh); return () => socket.off('atualizacao_dados', refresh); }, [carregarHardware, socket]);
  const selectedDevice = overview.devices?.find((device) => device.id === selectedId) || null;
  const filteredDevices = useMemo(() => (overview.devices || []).filter((device) => {
    const queryMatches = normalizeSearch(`${device.nome} ${device.filial} ${device.ip} ${device.mac}`).includes(normalizeSearch(searchTerm));
    const statusMatches = statusFilter === 'ALL' || device.status === statusFilter || (statusFilter === 'ATTENTION' && ['DEGRADED', 'UNPROVISIONED'].includes(device.status));
    return queryMatches && statusMatches;
  }), [overview.devices, searchTerm, statusFilter]);
  /**
   * Concentra a logica de solicitar comando para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador; publica ou consome mensagens MQTT
   *
   * @param {unknown} action - Valor de action consumido por esta rotina.
   * @param {unknown} label - Valor de label consumido por esta rotina.
   * @param {unknown} state - Valor de state consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const solicitarComando = (action, label, state = true) => {
    if (!selectedDevice || isOffline) return;

    /**
     * Concentra a logica de execute para manter o restante do tela mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
     * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
     *
     * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
     *
     * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const execute = async () => {
      setActionLoading(action);
      try {
        const token = sessionStorage.getItem('token');
        await axios.post(`${getApiUrl()}/hardware/${selectedDevice.id}/comando`, { acao: action, estado: state }, { headers: { Authorization: `Bearer ${token}` } });
        showToast(`${label} enviado para ${selectedDevice.nome}.`, 'success');
        window.setTimeout(() => carregarHardware(false), 1200);
      } catch (error) {
        showToast(error.response?.data?.error || `Falha ao executar ${label.toLowerCase()}.`, 'error');
      } finally {
        setActionLoading(null);
      }
    };

    if (setModalConfig) {
      setModalConfig({
        isOpen: true,
        title: `${label}: ${selectedDevice.nome}`,
        message: `Confirma o envio do comando ${label.toLowerCase()} para o nó #${selectedDevice.id}? A ação será registrada e publicada no broker MQTT.`,
        onConfirm: execute
      });
    } else {
      execute();
    }
  };

  const summary = overview.summary || {};
  const provisioned = Math.max(0, Number(summary.total || 0) - Number(summary.unprovisioned || 0));
  const availability = provisioned ? (Number(summary.online || 0) / provisioned) * 100 : 0;
  const signalPercent = selectedDevice?.signalDbm === null || selectedDevice?.signalDbm === undefined ? 0 : Math.max(0, Math.min(100, (selectedDevice.signalDbm + 100) * 2));

  return (
    <div className="hardware-console">
      <header className="hwc-header">
        <div><span className="hwc-eyebrow"><Cpu size={14} /> Edge fleet operations</span><h2>Hardware IoT</h2><p>Inventário, conectividade, firmware e controle dos dispositivos de borda.</p></div>
        <div className="hwc-header-status"><span><i /> Atualização automática · 15s</span>{overview.generatedAt && <small>{new Date(overview.generatedAt).toLocaleTimeString('pt-BR')}</small>}<button title="Atualizar frota" onClick={() => carregarHardware(true)} disabled={loading || isOffline}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button></div>
      </header>

      {loadError && (
        <div className="hwc-load-error" role="alert">
          <AlertTriangle size={18} />
          <span><strong>Falha ao sincronizar o inventário.</strong><small>{loadError}</small></span>
          <button type="button" onClick={() => carregarHardware(true)} disabled={loading}>Tentar novamente</button>
        </div>
      )}

      <section className="hwc-kpis" aria-label="Indicadores da frota IoT">
        <article className="online"><span><ShieldCheck size={16} /> Disponibilidade</span><strong>{availability.toFixed(1)}%</strong><small>{summary.online || 0} online de {provisioned} provisionados</small></article>
        <article className="warning"><span><AlertTriangle size={16} /> Atenção requerida</span><strong>{Number(summary.degraded || 0) + Number(summary.offline || 0)}</strong><small>{summary.degraded || 0} degradados · {summary.offline || 0} offline</small></article>
        <article className="signal"><span><Wifi size={16} /> Sinal médio</span><strong>{summary.averageSignal === null || summary.averageSignal === undefined ? 'N/A' : `${summary.averageSignal} dBm`}</strong><small>{summary.weakSignal || 0} enlaces com sinal fraco</small></article>
        <article className="firmware"><span><PackageCheck size={16} /> Firmware alvo</span><strong>{summary.targetFirmware || 'N/A'}</strong><small>{summary.outdatedFirmware || 0} instalações desatualizadas</small></article>
      </section>

      <section className="hwc-workspace">
        <aside className="hwc-inventory">
          <div className="hwc-section-title"><div><HardDrive size={18} /><span>Inventário</span></div><small>{filteredDevices.length} de {summary.total || 0}</small></div>
          <label className="hwc-search"><Search size={16} /><input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Nome, filial, IP ou MAC" /></label>
          <div className="hwc-tabs"><button className={statusFilter === 'ALL' ? 'active' : ''} onClick={() => setStatusFilter('ALL')}>Todos</button><button className={statusFilter === 'ONLINE' ? 'active' : ''} onClick={() => setStatusFilter('ONLINE')}>Online</button><button className={statusFilter === 'ATTENTION' ? 'active' : ''} onClick={() => setStatusFilter('ATTENTION')}>Atenção</button><button className={statusFilter === 'OFFLINE' ? 'active' : ''} onClick={() => setStatusFilter('OFFLINE')}>Offline</button></div>
          <div className="hwc-device-list">
            {loading && !overview.generatedAt ? <div className="hwc-empty"><Loader2 size={24} className="spin" />Sincronizando frota...</div> : filteredDevices.map(device => (
              <button key={device.id} className={`hwc-device ${selectedId === device.id ? 'selected' : ''}`} onClick={() => setSelectedId(device.id)}><span className={`hwc-state is-${statusClass(device.status)}`}><Cpu size={16} /></span><span className="hwc-device-copy"><strong>{device.nome}</strong><small>{device.filial || 'Sem filial'} · #{device.id}</small></span><span className="hwc-device-meta"><strong>{device.signalDbm === null ? 'N/A' : `${device.signalDbm} dBm`}</strong><small>{formatHeartbeat(device.secondsSinceSeen)}</small></span></button>
            ))}
            {!loading && filteredDevices.length === 0 && <div className="hwc-empty"><Search size={22} />Nenhum dispositivo encontrado.</div>}
          </div>
        </aside>

        <article className="hwc-detail">
          {selectedDevice ? <>
            <div className="hwc-detail-header"><div className={`hwc-avatar is-${statusClass(selectedDevice.status)}`}><Cpu size={24} /></div><div><span className={`hwc-status is-${statusClass(selectedDevice.status)}`}>{selectedDevice.status || 'UNPROVISIONED'}</span><h3>{selectedDevice.nome}</h3><p><MapPin size={12} /> {selectedDevice.filial || 'Sem filial'} · {selectedDevice.setor || 'Setor não informado'}</p></div><div className="hwc-edge-id"><span>ID de borda</span><strong>#{selectedDevice.id}</strong></div></div>
            <div className="hwc-metrics"><div><Thermometer size={15} /><span>Temperatura</span><strong>{formatDecimal(selectedDevice.temperature, ' °C')}</strong></div><div><Droplets size={15} /><span>Umidade</span><strong>{formatDecimal(selectedDevice.humidity, '%')}</strong></div><div><Activity size={15} /><span>Uptime</span><strong>{selectedDevice.uptime || 'N/A'}</strong></div><div><Clock size={15} /><span>Heartbeat</span><strong>{formatHeartbeat(selectedDevice.secondsSinceSeen)}</strong></div></div>
            <div className="hwc-connectivity">
              <div className="hwc-signal-panel"><div className="hwc-section-title"><div><Wifi size={17} /><span>Qualidade do enlace</span></div><strong>{selectedDevice.signalDbm === null ? 'N/A' : `${selectedDevice.signalDbm} dBm`}</strong></div><div className="hwc-signal-track"><i style={{ width: `${signalPercent}%` }} /></div><div className="hwc-signal-scale"><span>Crítico</span><b>{selectedDevice.signalQuality}</b><span>Excelente</span></div></div>
              <dl className="hwc-facts"><div><dt>IPv4 local</dt><dd>{selectedDevice.ip || 'Não atribuído'}</dd></div><div><dt>MAC address</dt><dd>{selectedDevice.mac || 'Não provisionado'}</dd></div><div><dt>Firmware</dt><dd>{selectedDevice.firmwareVersion || 'Não informado'}</dd></div><div><dt>Tipo</dt><dd>{selectedDevice.tipo || 'ESP32'}</dd></div></dl>
            </div>
            <div className="hwc-runtime"><div className={selectedDevice.motorOn ? 'active' : ''}><Power size={17} /><span>Compressor</span><strong>{selectedDevice.motorOn ? 'Ligado' : 'Desligado'}</strong></div><div className={selectedDevice.defrosting ? 'warning' : ''}><Activity size={17} /><span>Degelo</span><strong>{selectedDevice.defrosting ? 'Em curso' : 'Inativo'}</strong></div></div>
            <div className="hwc-command-bar"><div><strong>Comandos remotos</strong><small>Publicação auditada via MQTT</small></div><button onClick={() => solicitarComando('REBOOT', 'Reiniciar')} disabled={actionLoading || selectedDevice.status !== 'ONLINE'}>{actionLoading === 'REBOOT' ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Reiniciar</button><button onClick={() => solicitarComando('OTA', 'Atualização OTA')} disabled={actionLoading || selectedDevice.status !== 'ONLINE'}>{actionLoading === 'OTA' ? <Loader2 size={16} className="spin" /> : <Rocket size={16} />} Atualizar OTA</button><button className="danger" onClick={() => solicitarComando('DESLIGAR', 'Desligar saída', false)} disabled={actionLoading || selectedDevice.status !== 'ONLINE'}><Power size={16} /> Desligar saída</button></div>
          </> : <div className="hwc-empty"><Cpu size={26} />Selecione um dispositivo.</div>}
        </article>
      </section>

      <section className="hwc-intelligence">
        <article><div className="hwc-section-title"><div><Building2 size={18} /><span>Cobertura por filial</span></div><small>Maior indisponibilidade primeiro</small></div><div className="hwc-coverage-list">{overview.sites.slice(0, 10).map(site => <div key={site.filial}><span><strong>{site.filial}</strong><small>{site.online}/{site.total} online</small></span><div><i style={{ width: `${site.total ? (site.online / site.total) * 100 : 0}%` }} /></div><b>{site.offline ? `${site.offline} off` : 'OK'}</b></div>)}</div></article>
        <article><div className="hwc-section-title"><div><PackageCheck size={18} /><span>Firmware</span></div><small>Distribuição instalada</small></div><div className="hwc-firmware-list">{overview.firmware.length ? overview.firmware.map(item => <div key={item.version}><span>{item.version}</span><div><i style={{ width: `${summary.total ? (item.count / summary.total) * 100 : 0}%` }} /></div><strong>{item.count}</strong></div>) : <div className="hwc-empty">Sem versões reportadas.</div>}</div></article>
        <article><div className="hwc-section-title"><div><ListChecks size={18} /><span>Eventos recentes</span></div><small>Trilha de segurança IoT</small></div><div className="hwc-events">{overview.events.length ? overview.events.map(event => <div key={event.id}><i className={`is-${event.severity || 'info'}`} /><span><strong>{String(event.type || 'IOT_EVENT').replaceAll('_', ' ')}</strong><small>{event.detail || event.actor || 'Evento registrado'}</small></span><time>{event.createdAt ? new Date(event.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</time></div>) : <div className="hwc-empty">Nenhum evento recente.</div>}</div></article>
      </section>
    </div>
  );
}
