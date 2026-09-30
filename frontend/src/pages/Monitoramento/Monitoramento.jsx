/**
 * Módulo: frontend/src/pages/Monitoramento/Monitoramento.jsx
 * Responsabilidade: Implementa a tela Monitoramento, seus estados, interações e integrações de dados.
 */

import { Activity, AlertTriangle, ChevronRight, Radio, ShieldCheck, X } from 'lucide-react';
import usePersistentState from '../../hooks/usePersistentState';
import React, { useState, useMemo } from 'react';
import { Thermometer, Droplets, Power, Snowflake, MapPin, Gauge, CheckCircle2, WifiOff, Search, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';
import './Monitoramento.css';

/**
 * Concentra a logica de to number para manter o restante do tela mais legivel.
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
function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Normaliza a telemetria e determina o estado operacional de um equipamento.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} equipment - Valor de equipment consumido por esta rotina.
 * @param {unknown} isTemp - Valor de is temp consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function analyzeEquipment(equipment, isTemp) {
  const min = toNumber(isTemp ? equipment.temp_min : equipment.umidade_min) ?? (isTemp ? 0 : 40);
  const max = toNumber(isTemp ? equipment.temp_max : equipment.umidade_max) ?? (isTemp ? 10 : 80);
  const value = toNumber(isTemp ? equipment.ultima_temp : equipment.ultima_umidade);
  const hasData = value !== null;
  const isLow = hasData && value < min;
  const isHigh = hasData && value > max;
  // Falha de motor é uma inferência térmica; umidade alta não indica motor parado.
  const mechanicalFailure = isTemp && !equipment.motor_ligado && hasData && value >= max + 10 && !equipment.em_degelo;
  const isDefrost = isTemp && Boolean(equipment.em_degelo);
  let status = 'normal';
  if (!hasData) status = 'offline';
  else if (mechanicalFailure) status = 'critical';
  else if (isHigh) status = 'high';
  else if (isLow) status = 'low';
  else if (isDefrost) status = 'defrost';
  const deviation = !hasData ? 0 : isHigh ? value - max : isLow ? min - value : 0;
  const range = Math.max(max - min, 1);
  const position = hasData ? Math.max(0, Math.min(100, ((value - (min - range * .25)) / (range * 1.5)) * 100)) : 50;
  return { ...equipment, min, max, value, hasData, isLow, isHigh, mechanicalFailure, isDefrost, status, deviation, position };
}

/**
 * Retorna os textos e ícones específicos de cada estado operacional.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} item - Valor de item consumido por esta rotina.
 * @param {unknown} isTemp - Valor de is temp consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function getStatusMeta(item, isTemp) {
  if (item.status === 'offline') return { label: 'Sem telemetria', detail: 'Aguardando leitura do sensor', icon: WifiOff };
  if (item.status === 'critical') return { label: 'Falha crítica', detail: 'Motor parado com temperatura elevada', icon: AlertTriangle };
  if (item.status === 'high') return { label: isTemp ? 'Temperatura alta' : 'Umidade elevada', detail: `${item.deviation.toFixed(1)} acima do limite`, icon: ArrowUpRight };
  if (item.status === 'low') return { label: isTemp ? 'Temperatura baixa' : 'Umidade baixa', detail: `${item.deviation.toFixed(1)} abaixo do limite`, icon: ArrowDownRight };
  if (item.status === 'defrost') return { label: 'Em degelo', detail: 'Ciclo térmico em andamento', icon: Snowflake };
  return { label: 'Dentro da faixa', detail: 'Parâmetros em conformidade', icon: CheckCircle2 };
}

/**
 * Painel em tempo real para supervisão térmica ou higrométrica da operação.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {boolean} props.isTemp - Sinalizador isTemp que controla este comportamento visual.
 * @param {unknown} props.listaSetores - Propriedade listaSetores usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.equipamentosDaFilial - Propriedade equipamentosDaFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function Monitoramento({ isTemp, listaSetores = [], equipamentosDaFilial = [], socket, filialAtiva, onNavigate }) {
  const storagePrefix = isTemp ? 'temperature' : 'humidity';
  const [sectorFilter, setSectorFilter] = usePersistentState(`termosync_monitor_${storagePrefix}_sector`, '');
  const [search, setSearch] = useState('');
  const [focusMode, setFocusMode] = usePersistentState(`termosync_monitor_${storagePrefix}_focus`, false);
  const [selectedId, setSelectedId] = useState(null);
  const unit = isTemp ? '°C' : '%';
  const title = isTemp ? 'Monitoramento térmico' : 'Monitoramento de umidade';

  const analyzed = useMemo(() => equipamentosDaFilial.map((equipment) => analyzeEquipment(equipment, isTemp)), [equipamentosDaFilial, isTemp]);
  const filtered = useMemo(() => analyzed
    .filter((item) => !sectorFilter || item.setor === sectorFilter)
    .filter((item) => !search || String(item.nome || '').toLowerCase().includes(search.toLowerCase()))
    .filter((item) => !focusMode || !['normal', 'defrost'].includes(item.status))
    .sort((a, b) => {
      const order = { critical: 6, high: 5, low: 4, offline: 3, defrost: 2, normal: 1 };
      return order[b.status] - order[a.status] || b.deviation - a.deviation;
    }), [analyzed, sectorFilter, search, focusMode]);

  const selected = analyzed.find((item) => String(item.id) === String(selectedId)) || null;

  const metrics = useMemo(() => {
    const valid = analyzed.filter((item) => item.hasData);
    const normal = analyzed.filter((item) => item.status === 'normal' || item.status === 'defrost').length;
    const high = analyzed.filter((item) => item.status === 'high' || item.status === 'critical').length;
    const low = analyzed.filter((item) => item.status === 'low').length;
    const offline = analyzed.filter((item) => item.status === 'offline').length;
    const average = valid.length ? valid.reduce((sum, item) => sum + item.value, 0) / valid.length : null;
    const compliance = analyzed.length ? Math.round((normal / analyzed.length) * 100) : 0;
    return { total: analyzed.length, normal, high, low, offline, average, compliance };
  }, [analyzed]);

  const sectorSummary = useMemo(() => {
    const groups = new Map();
    analyzed.forEach((item) => {
      const key = item.setor || 'Sem setor';
      const current = groups.get(key) || { name: key, total: 0, values: [], alerts: 0 };
      current.total += 1;
      if (item.hasData) current.values.push(item.value);
      if (['critical', 'high', 'low', 'offline'].includes(item.status)) current.alerts += 1;
      groups.set(key, current);
    });
    return [...groups.values()].map((group) => ({ ...group, average: group.values.length ? group.values.reduce((sum, value) => sum + value, 0) / group.values.length : null })).sort((a, b) => b.alerts - a.alerts || a.name.localeCompare(b.name));
  }, [analyzed]);

  /** Consolida extremos e carga instantânea específicos da operação térmica. */
  const thermalOperations = useMemo(() => {
    const valid = analyzed.filter((item) => item.hasData);
    const hottest = valid.length ? valid.reduce((current, item) => item.value > current.value ? item : current) : null;
    const coldest = valid.length ? valid.reduce((current, item) => item.value < current.value ? item : current) : null;
    return {
      hottest,
      coldest,
      running: analyzed.filter((item) => item.motor_ligado).length,
      defrosting: analyzed.filter((item) => item.isDefrost).length
    };
  }, [analyzed]);

  const distribution = [
    { key: 'normal', label: 'Na faixa', value: metrics.normal, color: 'var(--success)' },
    { key: 'high', label: isTemp ? 'Acima' : 'Úmido', value: metrics.high, color: 'var(--danger)' },
    { key: 'low', label: isTemp ? 'Abaixo' : 'Seco', value: metrics.low, color: 'var(--info)' },
    { key: 'offline', label: 'Sem dados', value: metrics.offline, color: 'var(--text-muted)' }
  ];

  return (
    <main className="environment-monitor anim-fade-in">
      <header className="environment-header">
        <div className="environment-title">
          <span className="environment-icon">{isTemp ? <Thermometer size={21} /> : <Droplets size={21} />}</span>
          <div><span>{filialAtiva || 'Visão da filial'}</span><h2>{title}</h2><p>{isTemp ? 'Faixas térmicas, degelo e condição operacional.' : 'Conformidade higrométrica, desvios e cobertura dos sensores.'}</p></div>
        </div>
        <div className={`telemetry-state ${socket?.connected ? 'online' : ''}`}><Radio size={15} /><div><strong>{socket?.connected ? 'Tempo real ativo' : 'Reconectando'}</strong><span>{metrics.total} pontos monitorados</span></div></div>
      </header>

      <section className="environment-metrics" aria-label="Indicadores do monitoramento">
        <article><span>{isTemp ? <Gauge size={17} /> : <Droplets size={17} />} Média atual</span><strong>{metrics.average === null ? '--' : metrics.average.toFixed(1)}<small>{unit}</small></strong><p>Entre sensores com leitura</p></article>
        <article><span><ShieldCheck size={17} /> Conformidade</span><strong>{metrics.compliance}<small>%</small></strong><p>{metrics.normal} de {metrics.total} pontos na faixa</p></article>
        <article className={metrics.high ? 'attention' : ''}><span><ArrowUpRight size={17} /> {isTemp ? 'Acima do limite' : 'Umidade elevada'}</span><strong>{metrics.high}</strong><p>Requerem análise operacional</p></article>
        <article className={metrics.low ? 'cool' : ''}><span><ArrowDownRight size={17} /> {isTemp ? 'Abaixo do limite' : 'Umidade baixa'}</span><strong>{metrics.low}</strong><p>{isTemp ? 'Leituras abaixo da faixa' : 'Risco de ambiente excessivamente seco'}</p></article>
        <article><span><WifiOff size={17} /> Sem telemetria</span><strong>{metrics.offline}</strong><p>Sensores sem leitura disponível</p></article>
      </section>

      <section className="environment-controls">
        <label className="environment-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar equipamento" />{search && <button type="button" onClick={() => setSearch('')} title="Limpar busca"><X size={15} /></button>}</label>
        <select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} aria-label="Filtrar por setor">
          <option value="">Todos os setores</option>
          {listaSetores.map((sector) => <option key={sector.id || sector.nome} value={sector.nome}>{sector.nome}</option>)}
        </select>
        <button type="button" className={`focus-toggle ${focusMode ? 'active' : ''}`} onClick={() => setFocusMode((current) => !current)}><Filter size={16} /> {focusMode ? 'Exibindo ocorrências' : 'Filtrar ocorrências'}</button>
      </section>

      <section className="environment-layout">
        <div className="environment-main">
          <div className="environment-section-heading"><div><span>Leitura atual</span><h3>Equipamentos</h3></div><strong>{filtered.length} exibidos</strong></div>
          {!filtered.length ? <div className="environment-empty"><ShieldCheck size={32} /><strong>{focusMode ? 'Nenhuma ocorrência ativa' : 'Nenhum equipamento encontrado'}</strong><span>{focusMode ? 'Todos os pontos visíveis estão dentro dos parâmetros.' : 'Revise os filtros aplicados.'}</span></div> :
            <div className="environment-list">
              {filtered.map((item) => {
                const meta = getStatusMeta(item, isTemp);
                const StatusIcon = meta.icon;
                return <button type="button" key={item.id} className={`environment-row status-${item.status} ${String(selectedId) === String(item.id) ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}>
                  <span className="row-status-icon"><StatusIcon size={17} /></span>
                  <span className="row-identity"><strong>{item.nome}</strong><small><MapPin size={12} /> {item.setor || 'Sem setor'} · {item.filial || 'Unidade local'}</small></span>
                  <span className="row-reading"><strong>{item.hasData ? item.value.toFixed(1) : '--'}<small>{unit}</small></strong><span>Faixa {item.min.toFixed(1)} a {item.max.toFixed(1)}{unit}</span></span>
                  <span className="row-range"><i className="range-safe" /><i className={`range-marker ${item.status}`} style={{ left: `${item.position}%` }} /></span>
                  <span className="row-state"><strong>{meta.label}</strong><small>{meta.detail}</small></span>
                  <ChevronRight size={17} />
                </button>;
              })}
            </div>}
        </div>

        <aside className="environment-insights">
          <section className="insight-panel">
            <div className="insight-heading"><div><span>Distribuição atual</span><h3>Condição da operação</h3></div><Gauge size={18} /></div>
            <div className="distribution-bar">{distribution.map((item) => <i key={item.key} style={{ width: `${metrics.total ? (item.value / metrics.total) * 100 : 0}%`, background: item.color }} />)}</div>
            <div className="distribution-legend">{distribution.map((item) => <div key={item.key}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
          </section>

          <section className="insight-panel sectors-panel">
            <div className="insight-heading"><div><span>Comparativo</span><h3>Desempenho por setor</h3></div><MapPin size={18} /></div>
            <div className="sector-ranking">{sectorSummary.length ? sectorSummary.map((sector) => <button key={sector.name} type="button" onClick={() => setSectorFilter(sector.name)}><span><strong>{sector.name}</strong><small>{sector.total} equipamentos</small></span><span className={sector.alerts ? 'has-alert' : ''}><strong>{sector.average === null ? '--' : sector.average.toFixed(1)}{unit}</strong><small>{sector.alerts ? `${sector.alerts} ocorrência(s)` : 'Conforme'}</small></span></button>) : <p className="no-sector-data">Sem dados por setor.</p>}</div>
          </section>

          {isTemp && <section className="insight-panel thermal-operations-panel">
            <div className="insight-heading"><div><span>Operação frigorífica</span><h3>Carga térmica instantânea</h3></div><Activity size={18} /></div>
            <div className="thermal-operation-grid">
              <div><span><ArrowUpRight size={14} /> Ponto mais quente</span><strong>{thermalOperations.hottest ? `${thermalOperations.hottest.value.toFixed(1)}°C` : '--'}</strong><small>{thermalOperations.hottest?.nome || 'Sem leitura'}</small></div>
              <div><span><ArrowDownRight size={14} /> Ponto mais frio</span><strong>{thermalOperations.coldest ? `${thermalOperations.coldest.value.toFixed(1)}°C` : '--'}</strong><small>{thermalOperations.coldest?.nome || 'Sem leitura'}</small></div>
              <div><span><Power size={14} /> Motores ativos</span><strong>{thermalOperations.running}/{metrics.total}</strong><small>Carga atual da refrigeração</small></div>
              <div><span><Snowflake size={14} /> Em degelo</span><strong>{thermalOperations.defrosting}</strong><small>Ciclos em andamento</small></div>
            </div>
            <div className="thermal-quick-actions"><button type="button" onClick={() => onNavigate?.('mapa')}>Abrir planta digital <ChevronRight size={15} /></button><button type="button" onClick={() => onNavigate?.('central_procedimentos')}>Procedimentos <ChevronRight size={15} /></button></div>
          </section>}

          {!isTemp && <section className="insight-panel guidance-panel"><div className="insight-heading"><div><span>Apoio operacional</span><h3>Resposta a desvios</h3></div><Droplets size={18} /></div><p>Priorize sensores sem comunicação e ambientes acima da faixa antes de ajustar parâmetros.</p><button type="button" onClick={() => onNavigate?.('central_procedimentos')}>Abrir procedimentos <ChevronRight size={15} /></button></section>}
        </aside>
      </section>

      {selected && (() => {
        const meta = getStatusMeta(selected, isTemp);
        const DetailIcon = meta.icon;
        return <div className="sensor-drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedId(null)}>
          <aside className="sensor-drawer" role="dialog" aria-modal="true" aria-label={`Detalhes de ${selected.nome}`}>
            <button type="button" className="drawer-close" onClick={() => setSelectedId(null)} title="Fechar"><X size={18} /></button>
            <span className={`drawer-status status-${selected.status}`}><DetailIcon size={16} /> {meta.label}</span>
            <h3>{selected.nome}</h3><p><MapPin size={14} /> {selected.setor || 'Sem setor'} · {selected.filial || 'Unidade local'}</p>
            <div className="drawer-reading"><span>Leitura atual</span><strong>{selected.hasData ? selected.value.toFixed(1) : '--'}<small>{unit}</small></strong><p>{meta.detail}</p></div>
            <div className="drawer-range"><span>Limite mínimo <strong>{selected.min.toFixed(1)}{unit}</strong></span><span>Limite máximo <strong>{selected.max.toFixed(1)}{unit}</strong></span><div><i /><b style={{ left: `${selected.position}%` }} /></div></div>
            <div className="drawer-diagnostics"><h4>Diagnóstico</h4><div><span>Comunicação</span><strong>{selected.hasData ? 'Recebendo dados' : 'Sem leitura'}</strong></div><div><span>Conformidade</span><strong>{['normal', 'defrost'].includes(selected.status) ? 'Dentro da faixa' : 'Requer atenção'}</strong></div>{isTemp && <div><span>Motor</span><strong>{selected.motor_ligado ? 'Ligado' : 'Em repouso'}</strong></div>}</div>
          </aside>
        </div>;
      })()}
    </main>
  );
}
