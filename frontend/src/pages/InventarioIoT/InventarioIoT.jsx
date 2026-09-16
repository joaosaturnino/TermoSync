import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Cpu, Radio, Search, Server, ShieldCheck, Thermometer, WifiOff } from 'lucide-react';
import './InventarioIoT.css';

/**
 * Normaliza textos para filtros sem acento e sem diferenca entre maiusculas/minusculas.
 */
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const OFFLINE_AFTER_MS = 3 * 60 * 1000;

/**
 * Extrai o timestamp mais confiavel da ultima comunicacao conhecida do equipamento.
 */
const getLastCommunicationTime = (eq) => {
  const raw = eq.ultima_comunicacao || eq.ultima_leitura || eq.updated_at || eq.data_hora;
  if (!raw) return null;
  const timestamp = new Date(raw).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

/**
 * Classifica o sensor como online, offline ou sem sinal com base no ultimo contato.
 */
const getSensorStatus = (eq, now) => {
  if (eq.status_conexao === 'offline' || eq.offline) return 'offline';
  const lastCommunication = getLastCommunicationTime(eq);
  if (lastCommunication) return now - lastCommunication <= OFFLINE_AFTER_MS ? 'online' : 'offline';
  if (eq.status_conexao === 'online') return 'online';
  return 'sem-sinal';
};

/**
 * Formata a ultima comunicacao em uma frase curta para a tabela do inventario.
 */
const formatLastSeen = (eq, now) => {
  const lastCommunication = getLastCommunicationTime(eq);
  if (!lastCommunication) return 'Sem comunicação registrada';
  const diffSeconds = Math.max(0, Math.floor((now - lastCommunication) / 1000));
  if (diffSeconds < 10) return 'Agora';
  if (diffSeconds < 60) return `${diffSeconds}s atrás`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}min atrás`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h atrás`;
};

/**
 * Renderiza o inventario IoT com filtros, status de comunicacao e KPIs operacionais.
 */
export default function InventarioIoT({ equipamentos = [], filialAtiva, listaSetores = [], socket }) {
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('todos');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const buscaDiferida = useDeferredValue(busca);

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    /**
     * Atualiza o relogio logico quando chegam leituras ou sincronizacoes via socket.
     */
    const refreshClock = () => setNowTick(Date.now());
    socket.on('nova_leitura', refreshClock);
    socket.on('atualizacao_dados', refreshClock);
    return () => {
      socket.off('nova_leitura', refreshClock);
      socket.off('atualizacao_dados', refreshClock);
    };
  }, [socket]);

  const inventario = useMemo(() => {
    const termo = normalize(buscaDiferida);
    return equipamentos
      .filter(eq => !filialAtiva || filialAtiva === 'Todas' || normalize(eq.filial) === normalize(filialAtiva))
      .map(eq => ({ ...eq, sensorStatus: getSensorStatus(eq, nowTick), lastSeenLabel: formatLastSeen(eq, nowTick) }))
      .filter(eq => status === 'todos' || eq.sensorStatus === status)
      .filter(eq => !termo || normalize(`${eq.nome} ${eq.filial} ${eq.setor} ${eq.tipo} ${eq.id}`).includes(termo))
      .sort((a, b) => String(a.filial || '').localeCompare(String(b.filial || ''), 'pt-BR') || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  }, [equipamentos, filialAtiva, buscaDiferida, status, nowTick]);

  const kpis = useMemo(() => ({
    total: inventario.length,
    online: inventario.filter(eq => eq.sensorStatus === 'online').length,
    offline: inventario.filter(eq => eq.sensorStatus === 'offline').length,
    setores: new Set(inventario.map(eq => eq.setor).filter(Boolean)).size || listaSetores.length
  }), [inventario, listaSetores.length]);

  return (
    <div className="iot-inventory-page anim-fade-in">
      <section className="iot-inventory-hero">
        <div>
          <span><Cpu size={14} /> Ativos conectados</span>
          <h2>Inventário IoT</h2>
          <p>Mapa técnico de sensores, equipamentos, setores e estado de comunicação.</p>
        </div>
        <div className="iot-inventory-search">
          <Search size={16} />
          <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por ID, equipamento, setor ou filial..." />
        </div>
      </section>

      <div className="iot-inventory-kpis">
        <article><Server size={20} /><strong>{kpis.total}</strong><span>Ativos</span></article>
        <article><Radio size={20} /><strong>{kpis.online}</strong><span>Com sinal</span></article>
        <article><WifiOff size={20} /><strong>{kpis.offline}</strong><span>Offline</span></article>
        <article><ShieldCheck size={20} /><strong>{kpis.setores}</strong><span>Setores</span></article>
      </div>

      <div className="iot-filter-row">
        {[
          ['todos', 'Todos'],
          ['online', 'Com sinal'],
          ['offline', 'Offline'],
          ['sem-sinal', 'Sem leitura']
        ].map(([id, label]) => (
          <button key={id} className={status === id ? 'active' : ''} onClick={() => setStatus(id)}>{label}</button>
        ))}
      </div>

      <div className="iot-inventory-grid">
        {inventario.map(eq => (
          <article className={`iot-asset-card ${eq.sensorStatus}`} key={eq.id}>
            <div className="iot-asset-head">
              <div>
                <strong>{eq.nome || `Equipamento ${eq.id}`}</strong>
                <span>ID #{eq.id} • {eq.filial || 'Filial não informada'}</span>
              </div>
              <span className="iot-status-pill">{eq.sensorStatus === 'online' ? 'Com sinal' : eq.sensorStatus === 'offline' ? 'Offline' : 'Sem leitura'}</span>
            </div>
            <div className="iot-asset-metrics">
              <div><Thermometer size={16} /><span>Temp.</span><strong>{eq.ultima_temp ?? eq.temperatura ?? '--'}°C</strong></div>
              <div><Radio size={16} /><span>Motor</span><strong>{eq.motor_ligado ? 'Ligado' : 'Parado'}</strong></div>
              <div><AlertTriangle size={16} /><span>Último sinal</span><strong>{eq.lastSeenLabel}</strong></div>
            </div>
            <footer>
              <span>{eq.setor || 'Setor não informado'}</span>
              <span>{eq.tipo || 'Tipo não informado'}</span>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
