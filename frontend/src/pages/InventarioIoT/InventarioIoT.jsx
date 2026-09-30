/**
 * Módulo: frontend/src/pages/InventarioIoT/InventarioIoT.jsx
 * Responsabilidade: Implementa a tela Inventario Io T, seus estados, interações e integrações de dados.
 */

import usePersistentState from '../../hooks/usePersistentState';
import { CheckCircle2, ChevronRight, Clock3, Download, HardDrive, MapPin, PackageSearch, Router, Signal, Wifi, X } from 'lucide-react';
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Cpu, Radio, Search, Server, ShieldCheck, Thermometer, WifiOff } from 'lucide-react';
import './InventarioIoT.css';

const OFFLINE_AFTER_MS = 3 * 60 * 1000;

/**
 * Normaliza normalize para evitar divergencia de formato nas comparacoes.
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
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Extrai o timestamp mais confiavel da ultima comunicação conhecida.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} eq - Valor de eq consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const getLastCommunicationTime = (eq) => {
  const raw = eq.ultima_comunicacao || eq.updated_at || eq.data_hora;
  if (!raw) return null;
  const timestamp = new Date(raw).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

/**
 * Classifica conectividade combinando o estado da API com a idade do último pacote.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} eq - Valor de eq consumido por esta rotina.
 * @param {unknown} now - Valor de now consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const getSensorStatus = (eq, now) => {
  const statusApi = normalize(eq.status_conexao);
  if (statusApi === 'sem-sinal') return 'sem-sinal';
  if (statusApi === 'instavel') return 'instavel';
  if (statusApi === 'offline' || eq.offline) return 'offline';
  const lastCommunication = getLastCommunicationTime(eq);
  if (lastCommunication) return now - lastCommunication <= OFFLINE_AFTER_MS ? 'online' : 'offline';
  if (statusApi === 'online') return 'online';
  return 'sem-sinal';
};

/**
 * Formata há quanto tempo o hardware deixou seu último sinal.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} eq - Valor de eq consumido por esta rotina.
 * @param {unknown} now - Valor de now consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatLastSeen = (eq, now) => {
  const lastCommunication = getLastCommunicationTime(eq);
  if (!lastCommunication) return 'Nunca comunicado';
  const diffSeconds = Math.max(0, Math.floor((now - lastCommunication) / 1000));
  if (diffSeconds < 10) return 'Agora';
  if (diffSeconds < 60) return `${diffSeconds}s atrás`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}min atrás`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 48) return `${diffHours}h atrás`;
  return `${Math.floor(diffHours / 24)}d atrás`;
};

/**
 * Converte RSSI ou percentual em uma leitura humana sem inventar sinal ausente.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} rawSignal - Valor de raw signal consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const getWifiQuality = (rawSignal) => {
  if (rawSignal === null || rawSignal === undefined || rawSignal === '') return { label: 'Sem dado', level: 'unknown', value: null };
  const value = Number(rawSignal);
  if (!Number.isFinite(value)) return { label: String(rawSignal), level: 'unknown', value: null };
  if (value >= 0) {
    if (value >= 70) return { label: `${value}%`, level: 'good', value };
    if (value >= 40) return { label: `${value}%`, level: 'medium', value };
    return { label: `${value}%`, level: 'weak', value };
  }
  if (value >= -60) return { label: `${value} dBm`, level: 'good', value };
  if (value >= -72) return { label: `${value} dBm`, level: 'medium', value };
  return { label: `${value} dBm`, level: 'weak', value };
};

/**
 * Formata uptime numérico em dias, horas e minutos; strings prontas são preservadas.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} rawUptime - Valor de raw uptime consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatUptime = (rawUptime) => {
  if (rawUptime === null || rawUptime === undefined || rawUptime === '') return 'Sem dado';
  const seconds = Number(rawUptime);
  if (!Number.isFinite(seconds)) return String(rawUptime);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
};

/**
 * Inventário técnico de conectividade, identidade e telemetria do parque IoT.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador; troca eventos em tempo real
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.equipamentos - Propriedade equipamentos usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function InventarioIoT({ equipamentos = [], filialAtiva, socket }) {
  const [busca, setBusca] = usePersistentState('termosync_inventory_search', '');
  const [status, setStatus] = usePersistentState('termosync_inventory_status', 'todos');
  const [setor, setSetor] = usePersistentState('termosync_inventory_sector', 'todos');
  const [ordenacao, setOrdenacao] = usePersistentState('termosync_inventory_order', 'criticidade');
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now);
  const buscaDiferida = useDeferredValue(busca);

  // Atualiza a idade dos dispositivos mesmo quando nenhum pacote novo chega.
  useEffect(() => { const interval = setInterval(() => setNowTick(Date.now()), 10000); return () => clearInterval(interval); }, []);
  useEffect(() => { if (!socket) return undefined; const refresh = () => setNowTick(Date.now()); socket.on('atualizacao_dados', refresh); return () => socket.off('atualizacao_dados', refresh); }, [socket]);
  const inventario = useMemo(() => equipamentos
    .filter((eq) => !filialAtiva || filialAtiva === 'Todas' || normalize(eq.filial) === normalize(filialAtiva))
    .map((eq) => ({ ...eq, sensorStatus: getSensorStatus(eq, nowTick), lastSeenLabel: formatLastSeen(eq, nowTick), wifi: getWifiQuality(eq.sinal_wifi ?? eq.signal_dbm) }))
    .filter((eq) => status === 'todos' || eq.sensorStatus === status)
    .filter((eq) => setor === 'todos' || eq.setor === setor)
    .filter((eq) => !normalize(buscaDiferida) || normalize(`${eq.nome} ${eq.filial} ${eq.setor} ${eq.tipo} ${eq.id} ${eq.ip_local} ${eq.mac_address} ${eq.firmware_version}`).includes(normalize(buscaDiferida)))
    .sort((a, b) => ordenacao === 'nome' ? String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR') : ordenacao === 'sinal' ? Number(a.wifi.value ?? -999) - Number(b.wifi.value ?? -999) : ['offline', 'instavel', 'sem-sinal', 'online'].indexOf(a.sensorStatus) - ['offline', 'instavel', 'sem-sinal', 'online'].indexOf(b.sensorStatus)), [buscaDiferida, equipamentos, filialAtiva, nowTick, ordenacao, setor, status]);
  const setoresDisponiveis = useMemo(() => [...new Set(equipamentos.map((eq) => eq.setor).filter(Boolean))].sort(), [equipamentos]);
  const equipamentoSelecionado = inventario.find((eq) => eq.id === selecionadoId) || null;
  const kpis = useMemo(() => { const total = inventario.length; const online = inventario.filter((eq) => eq.sensorStatus === 'online').length; const offline = inventario.filter((eq) => eq.sensorStatus === 'offline').length; const instavel = inventario.filter((eq) => eq.sensorStatus === 'instavel').length; const semSinal = inventario.filter((eq) => eq.sensorStatus === 'sem-sinal').length; return { total, online, offline, instavel, semSinal, disponibilidade: total ? Math.round((online / total) * 100) : 0 }; }, [inventario]);
  /**
   * Concentra a logica de exportar inventario para manter o restante do tela mais legivel.
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
  const exportarInventario = () => {
    const rows = inventario.map((eq) => [
      eq.id, eq.nome, eq.tipo, eq.setor, eq.filial, eq.sensorStatus, eq.mac_address,
      eq.ip_local, eq.wifi.label, eq.firmware_version, eq.ultima_temp, eq.ultima_umidade, eq.lastSeenLabel
    ]);
    const csv = [['ID', 'Equipamento', 'Tipo', 'Setor', 'Filial', 'Conexão', 'MAC', 'IP', 'Wi-Fi', 'Firmware', 'Temperatura', 'Umidade', 'Último sinal'], ...rows]
      .map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `inventario-iot-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const statusLabel = { online: 'Online', offline: 'Offline', instavel: 'Instável', 'sem-sinal': 'Sem cadastro IoT' };

  return (
    <div className="iot-inventory-page anim-fade-in">
      <header className="iot-inventory-header">
        <div><span className="iot-eyebrow"><Cpu size={14}/> Rede de dispositivos</span><h2>Inventário IoT</h2><p>Identidade, conectividade e telemetria dos controladores instalados.</p></div>
        <div className="iot-inventory-actions">
          <div className="iot-inventory-search"><Search size={16}/><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar ativo, IP, MAC ou firmware" /></div>
          <button type="button" className="iot-export-button" onClick={exportarInventario} disabled={!inventario.length}><Download size={16}/> Exportar</button>
        </div>
      </header>

      <section className="iot-inventory-kpis" aria-label="Resumo da conectividade">
        <article><Server size={20}/><strong>{kpis.total}</strong><span>Controladores</span></article>
        <article className="online"><Radio size={20}/><strong>{kpis.online}</strong><span>Online</span></article>
        <article className={kpis.offline ? 'offline' : ''}><WifiOff size={20}/><strong>{kpis.offline}</strong><span>Offline</span></article>
        <article className={kpis.instavel ? 'unstable' : ''}><AlertTriangle size={20}/><strong>{kpis.instavel}</strong><span>Instáveis</span></article>
        <article className="availability"><ShieldCheck size={20}/><strong>{kpis.disponibilidade}%</strong><span>Disponibilidade</span></article>
      </section>

      <section className="iot-filter-toolbar">
        <div className="iot-filter-row">
          {[
            ['todos', 'Todos', kpis.total], ['online', 'Online', kpis.online],
            ['offline', 'Offline', kpis.offline], ['instavel', 'Instáveis', kpis.instavel],
            ['sem-sinal', 'Sem hardware', kpis.semSinal]
          ].map(([id, label, count]) => <button type="button" key={id} className={status === id ? 'active' : ''} onClick={() => setStatus(id)}>{label}<span>{count}</span></button>)}
        </div>
        <select value={setor} onChange={(event) => setSetor(event.target.value)} aria-label="Filtrar por setor"><option value="todos">Todos os setores</option>{setoresDisponiveis.map(nome => <option value={nome} key={nome}>{nome}</option>)}</select>
        <select value={ordenacao} onChange={(event) => setOrdenacao(event.target.value)} aria-label="Ordenar inventário"><option value="criticidade">Críticos primeiro</option><option value="nome">Nome</option><option value="sinal">Menor sinal</option></select>
      </section>

      <div className={`iot-inventory-content ${equipamentoSelecionado ? 'has-detail' : ''}`}>
        <section className="iot-inventory-grid" aria-label="Dispositivos IoT">
          {inventario.map(eq => (
            <article className={`iot-asset-card ${eq.sensorStatus} ${String(eq.id) === String(selecionadoId) ? 'selected' : ''}`} key={eq.id}>
              <div className="iot-asset-head">
                <div className="iot-device-identity"><span><Cpu size={18}/></span><div><strong>{eq.nome || `Equipamento ${eq.id}`}</strong><small>ID #{eq.id} · {eq.tipo || 'Tipo não informado'}</small></div></div>
                <span className="iot-status-pill"><i/>{statusLabel[eq.sensorStatus]}</span>
              </div>
              <div className="iot-network-grid">
                <div><Router size={15}/><span>Endereço IP</span><strong>{eq.ip_local || 'Não atribuído'}</strong></div>
                <div><HardDrive size={15}/><span>MAC</span><strong>{eq.mac_address || 'Não registrado'}</strong></div>
                <div className={`signal-${eq.wifi.level}`}><Wifi size={15}/><span>Sinal Wi-Fi</span><strong>{eq.wifi.label}</strong></div>
                <div><Clock3 size={15}/><span>Último pacote</span><strong>{eq.lastSeenLabel}</strong></div>
              </div>
              <footer><span><MapPin size={13}/>{eq.setor || 'Sem setor'} · {eq.filial || 'Sem filial'}</span><button type="button" onClick={() => setSelecionadoId(eq.id)}>Ver ficha <ChevronRight size={14}/></button></footer>
            </article>
          ))}
          {!inventario.length && <div className="iot-inventory-empty"><PackageSearch size={34}/><strong>Nenhum dispositivo encontrado</strong><span>Ajuste os filtros ou verifique o cadastro do hardware.</span></div>}
        </section>

        {equipamentoSelecionado && (
          <aside className="iot-device-detail">
            <header><div><span>Ficha técnica</span><h3>{equipamentoSelecionado.nome}</h3></div><button type="button" onClick={() => setSelecionadoId(null)} title="Fechar ficha"><X size={18}/></button></header>
            <div className={`iot-detail-status ${equipamentoSelecionado.sensorStatus}`}>{equipamentoSelecionado.sensorStatus === 'online' ? <CheckCircle2 size={17}/> : <AlertTriangle size={17}/>}<div><strong>{statusLabel[equipamentoSelecionado.sensorStatus]}</strong><span>{equipamentoSelecionado.lastSeenLabel}</span></div></div>
            <dl>
              <div><dt>Endereço IP</dt><dd>{equipamentoSelecionado.ip_local || 'Não atribuído'}</dd></div>
              <div><dt>MAC address</dt><dd>{equipamentoSelecionado.mac_address || 'Não registrado'}</dd></div>
              <div><dt>Firmware</dt><dd>{equipamentoSelecionado.firmware_version || 'Não informado'}</dd></div>
              <div><dt>Uptime</dt><dd>{formatUptime(equipamentoSelecionado.uptime)}</dd></div>
              <div><dt>Sinal Wi-Fi</dt><dd>{equipamentoSelecionado.wifi.label}</dd></div>
              <div><dt>Setor</dt><dd>{equipamentoSelecionado.setor || 'Não informado'}</dd></div>
            </dl>
            <section><h4>Telemetria atual</h4><div className="iot-detail-telemetry"><div><Thermometer size={16}/><span>Temperatura</span><strong>{equipamentoSelecionado.ultima_temp ?? '--'}°C</strong></div><div><Signal size={16}/><span>Umidade</span><strong>{equipamentoSelecionado.ultima_umidade ?? '--'}%</strong></div></div></section>
          </aside>
        )}
      </div>
    </div>
  );
}
