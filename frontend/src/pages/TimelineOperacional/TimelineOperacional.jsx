/**
 * Módulo: frontend/src/pages/TimelineOperacional/TimelineOperacional.jsx
 * Responsabilidade: Implementa a tela Timeline Operacional, seus estados, interações e integrações de dados.
 */

import usePersistentState from '../../hooks/usePersistentState';
import { useEffect } from 'react';
import { ChevronDown, Download, Filter, X } from 'lucide-react';
import React, { useDeferredValue, useMemo, useState } from 'react';
import { AlertTriangle, Archive, Bell, CheckCircle2, Search, Wrench, Zap } from 'lucide-react';
import './TimelineOperacional.css';

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
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Converte datas potencialmente inválidas em um timestamp ordenável.
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
const getTime = (value) => {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

/**
 * Retorna o rótulo humano usado para agrupar eventos por dia.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} timestamp - Valor de timestamp consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function getDayLabel(timestamp) {
  if (!timestamp) return 'Sem data';
  const date = new Date(timestamp);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const difference = Math.round((startToday - startDate) / 86400000);
  if (difference === 0) return 'Hoje';
  if (difference === 1) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

/**
 * Escapa conteúdo textual para exportação CSV.
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
const csvField = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

/**
 * Linha do tempo auditável que unifica alertas ativos, resoluções e chamados.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.notificacoes - Propriedade notificacoes usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.historicoAlertas - Propriedade historicoAlertas usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.chamados - Propriedade chamados usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function TimelineOperacional({ notificacoes = [], historicoAlertas = [], chamados = [], filialAtiva, onNavigate }) {
  const [typeFilter, setTypeFilter] = usePersistentState('termosync_timeline_type', 'todos');
  const [period, setPeriod] = usePersistentState('termosync_timeline_period', '7d');
  const [search, setSearch] = usePersistentState('termosync_timeline_search', '');
  const [expandedId, setExpandedId] = useState(null);
  const [referenceTime, setReferenceTime] = useState(() => Date.now());
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const timer = window.setInterval(() => setReferenceTime(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const allEvents = useMemo(() => {
    const activeAlerts = notificacoes.map((item) => ({
      id: `alerta-${item.id}`, sourceId: item.id, type: 'alerta', title: item.equipamento_nome || 'Alerta operacional',
      detail: item.mensagem || item.tipo_alerta || 'Ocorrência ativa', branch: item.filial,
      sector: item.setor, date: item.data_hora, icon: AlertTriangle, tone: 'danger',
      status: 'Ativo', category: item.tipo_alerta || 'Alerta'
    }));
    const resolvedAlerts = historicoAlertas.map((item) => ({
      id: `historico-${item.id}`, sourceId: item.id, type: 'historico', title: item.equipamento_nome || 'Ocorrência resolvida',
      detail: item.nota_resolucao || item.mensagem || 'Evento resolvido', branch: item.filial,
      sector: item.setor, date: item.data_resolucao || item.resolvido_em || item.data_hora,
      icon: CheckCircle2, tone: 'success', status: 'Resolvido', category: item.tipo_alerta || 'Alerta'
    }));
    const ticketEvents = chamados.map((item) => {
      const status = normalize(item.status);
      const closed = status.includes('conclu') || status.includes('fechad') || item.arquivado;
      return {
        id: `chamado-${item.id}`, sourceId: item.id, type: closed ? 'historico' : 'chamado',
        title: item.titulo || item.equipamento_nome || `Chamado ${item.id}`,
        detail: item.descricao || item.nota_resolucao || 'Chamado técnico',
        branch: item.filial || item.equipamento_filial, sector: item.setor,
        date: item.data_conclusao || item.updated_at || item.data_abertura,
        icon: closed ? Archive : Wrench, tone: closed ? 'neutral' : 'warning',
        status: item.status || (closed ? 'Concluído' : 'Aberto'), category: item.urgencia || item.prioridade || 'Chamado'
      };
    });
    return [...activeAlerts, ...resolvedAlerts, ...ticketEvents]
      .filter((event) => !filialAtiva || filialAtiva === 'Todas' || normalize(event.branch) === normalize(filialAtiva))
      .map((event) => ({ ...event, timestamp: getTime(event.date) }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [notificacoes, historicoAlertas, chamados, filialAtiva]);

  const periodEvents = useMemo(() => {
    if (period === 'all') return allEvents;
    const duration = period === '24h' ? 86400000 : 7 * 86400000;
    const cutoff = referenceTime - duration;
    return allEvents.filter((event) => event.timestamp >= cutoff);
  }, [allEvents, period, referenceTime]);

  const counts = useMemo(() => ({
    todos: periodEvents.length,
    alerta: periodEvents.filter((event) => event.type === 'alerta').length,
    chamado: periodEvents.filter((event) => event.type === 'chamado').length,
    historico: periodEvents.filter((event) => event.type === 'historico').length
  }), [periodEvents]);

  const visibleEvents = useMemo(() => {
    const term = normalize(deferredSearch);
    return periodEvents
      .filter((event) => typeFilter === 'todos' || event.type === typeFilter)
      .filter((event) => !term || normalize(`${event.title} ${event.detail} ${event.branch} ${event.sector} ${event.category}`).includes(term))
      .slice(0, 300);
  }, [periodEvents, typeFilter, deferredSearch]);

  const groupedEvents = useMemo(() => {
    const groups = new Map();
    visibleEvents.forEach((event) => {
      const label = getDayLabel(event.timestamp);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(event);
    });
    return [...groups.entries()];
  }, [visibleEvents]);

  /**
   * Exporta exatamente o recorte atualmente filtrado da timeline.
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
  const exportTimeline = () => {
    const rows = [['Data', 'Tipo', 'Título', 'Detalhe', 'Status', 'Filial', 'Setor']];
    visibleEvents.forEach((event) => rows.push([event.date ? new Date(event.date).toLocaleString('pt-BR') : '', event.type, event.title, event.detail, event.status, event.branch || '', event.sector || '']));
    const csv = rows.map((row) => row.map(csvField).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `timeline-operacional-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="operations-timeline anim-fade-in">
      <header className="operations-timeline-header">
        <div><span className="timeline-eyebrow"><Zap size={15} /> Rastreabilidade operacional</span><h2>Timeline operacional</h2><p>{filialAtiva === 'Todas' ? 'Todas as filiais' : filialAtiva} · alertas, resoluções e chamados em ordem cronológica</p></div>
        <button type="button" onClick={exportTimeline} disabled={!visibleEvents.length}><Download size={16} /> Exportar visão</button>
      </header>

      <section className="timeline-overview">
        <article><span>Eventos no período</span><strong>{counts.todos}</strong></article>
        <article className={counts.alerta ? 'danger' : ''}><span>Alertas ativos</span><strong>{counts.alerta}</strong></article>
        <article><span>Chamados abertos</span><strong>{counts.chamado}</strong></article>
        <article><span>Eventos concluídos</span><strong>{counts.historico}</strong></article>
        <div className="timeline-period"><Filter size={15} /><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 dias</option><option value="all">Todo o histórico</option></select></div>
      </section>

      <section className="timeline-controls">
        <label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar equipamento, ocorrência, filial ou setor" />{search && <button type="button" onClick={() => setSearch('')} title="Limpar busca"><X size={15} /></button>}</label>
        <div role="tablist">{[['todos', 'Todos'], ['alerta', 'Alertas'], ['chamado', 'Chamados'], ['historico', 'Concluídos']].map(([id, label]) => <button key={id} type="button" className={typeFilter === id ? 'active' : ''} onClick={() => setTypeFilter(id)}>{label}<small>{counts[id]}</small></button>)}</div>
      </section>

      <section className="timeline-stream">
        {groupedEvents.map(([day, events]) => <div className="timeline-day" key={day}>
          <div className="timeline-day-heading"><span>{day}</span><small>{events.length} evento(s)</small></div>
          <div className="timeline-day-events">{events.map((event) => {
            const Icon = event.icon || Bell;
            const expanded = expandedId === event.id;
            return <article className={`timeline-event ${event.tone} ${expanded ? 'expanded' : ''}`} key={event.id}>
              <time><strong>{event.timestamp ? new Date(event.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</strong><small>{event.timestamp ? new Date(event.timestamp).toLocaleDateString('pt-BR') : ''}</small></time>
              <span className="timeline-event-node"><Icon size={16} /></span>
              <button type="button" className="timeline-event-main" onClick={() => setExpandedId(expanded ? null : event.id)}>
                <span className="timeline-event-title"><strong>{event.title}</strong><small>{event.category}</small></span>
                <p>{event.detail}</p>
                <span className="timeline-event-meta">{event.branch || 'Filial não informada'}{event.sector ? ` · ${event.sector}` : ''} · {event.status}</span>
              </button>
              <button type="button" className="timeline-expand" onClick={() => setExpandedId(expanded ? null : event.id)} title="Exibir detalhes"><ChevronDown size={16} /></button>
              {expanded && <div className="timeline-event-details"><div><span>Origem</span><strong>{event.type === 'chamado' ? 'Chamado técnico' : event.type === 'alerta' ? 'Alerta ativo' : 'Histórico operacional'}</strong></div><div><span>Identificador</span><strong>{event.sourceId}</strong></div><div><span>Data completa</span><strong>{event.date ? new Date(event.date).toLocaleString('pt-BR') : 'Não informada'}</strong></div><button type="button" onClick={() => onNavigate?.(event.type === 'chamado' ? 'chamados' : event.type === 'alerta' ? 'motores' : 'historico')}>Abrir módulo relacionado</button></div>}
            </article>;
          })}</div>
        </div>)}
        {!visibleEvents.length && <div className="timeline-stream-empty"><Bell size={29} /><strong>Nenhum evento encontrado</strong><span>Ajuste o período, o tipo ou o termo pesquisado.</span></div>}
      </section>
    </main>
  );
}
