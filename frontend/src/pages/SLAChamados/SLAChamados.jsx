/**
 * Módulo: frontend/src/pages/SLAChamados/SLAChamados.jsx
 * Responsabilidade: Implementa a tela SLAChamados, seus estados, interações e integrações de dados.
 */

import usePersistentState from '../../hooks/usePersistentState';
import { useDeferredValue, useState } from 'react';
import { CalendarDays, Gauge, Search, User } from 'lucide-react';
import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Timer, TrendingUp, Wrench } from 'lucide-react';
import './SLAChamados.css';

const SLA_HOURS = {
  critica: 2,
  crítica: 2,
  alta: 6,
  media: 12,
  média: 12,
  baixa: 24,
  pendente: 24
};

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
const normalize = (value) => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Calcula prazo, consumo e cumprimento do SLA usando conclusão real quando disponível.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} chamado - Valor de chamado consumido por esta rotina.
 * @param {unknown} now - Valor de now consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const getSlaInfo = (chamado, now) => {
  const urgency = normalize(chamado.urgencia || 'pendente');
  const limitHours = SLA_HOURS[urgency] || 24;
  const openedAt = chamado.data_abertura ? new Date(chamado.data_abertura).getTime() : now;
  const status = normalize(chamado.status);
  const closed = status.includes('conclu') || status.includes('fechad') || chamado.arquivado;
  const closedAt = chamado.data_conclusao ? new Date(chamado.data_conclusao).getTime() : now;
  const reference = closed && Number.isFinite(closedAt) ? closedAt : now;
  const elapsedHours = Math.max(0, (reference - openedAt) / 36e5);
  const remainingHours = limitHours - elapsedHours;
  const withinSla = elapsedHours <= limitHours;

  if (closed) return { limitHours, elapsedHours, remainingHours, state: 'done', label: withinSla ? 'Concluído no prazo' : 'Concluído com atraso', withinSla };
  if (remainingHours <= 0) return { limitHours, elapsedHours, remainingHours, state: 'late', label: 'Atrasado', withinSla: false };
  if (remainingHours <= Math.max(1, limitHours * 0.25)) return { limitHours, elapsedHours, remainingHours, state: 'risk', label: 'Em risco', withinSla: true };
  return { limitHours, elapsedHours, remainingHours, state: 'ok', label: 'No prazo', withinSla: true };
};

/**
 * Formata durações curtas e longas sem perder o sinal de atraso.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} hours - Valor de hours consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatHours = (hours) => {
  const abs = Math.abs(hours);
  if (abs < 1) return `${Math.max(1, Math.round(abs * 60))} min`;
  return `${Math.round(abs)}h`;
};

/**
 * Painel de acompanhamento e análise de cumprimento dos prazos de atendimento.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.chamados - Propriedade chamados usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function SLAChamados({ chamados = [], filialAtiva }) {
  const [busca, setBusca] = usePersistentState('termosync_sla_search', '');
  const [urgencia, setUrgencia] = usePersistentState('termosync_sla_urgency', 'todas');
  const [estado, setEstado] = usePersistentState('termosync_sla_state', 'todos');
  const [instanteReferencia] = useState(Date.now);
  const buscaDiferida = useDeferredValue(busca);

  /** Enriquece todos os chamados da filial para manter os KPIs independentes dos filtros visuais. */
  const chamadosBase = useMemo(() => {
    return chamados
      .filter(c => !filialAtiva || filialAtiva === 'Todas' || normalize(c.filial || c.equipamento_filial) === normalize(filialAtiva))
      .map(c => ({ ...c, sla: getSlaInfo(c, instanteReferencia) }))
      .sort((a, b) => {
        const weight = { late: 0, risk: 1, ok: 2, done: 3 };
        return weight[a.sla.state] - weight[b.sla.state] || a.sla.remainingHours - b.sla.remainingHours;
      });
  }, [chamados, filialAtiva, instanteReferencia]);

  /** Aplica os filtros da barra apenas à fila exibida nas colunas. */
  const chamadosComSla = useMemo(() => {
    const termo = normalize(buscaDiferida);
    return chamadosBase
      .filter(c => urgencia === 'todas' || normalize(c.urgencia || 'pendente') === urgencia)
      .filter(c => estado === 'todos' || c.sla.state === estado)
      .filter(c => !termo || normalize([c.id, c.equipamento_nome, c.filial, c.equipamento_filial, c.tecnico_responsavel, c.descricao].join(' ')).includes(termo))
  }, [chamadosBase, buscaDiferida, urgencia, estado]);

  /** Calcula capacidade ativa, conformidade histórica e idade média da fila visível. */
  const kpis = useMemo(() => {
    const ativos = chamadosBase.filter(c => c.sla.state !== 'done');
    const concluidos = chamadosBase.filter(c => c.sla.state === 'done');
    const concluidosNoPrazo = concluidos.filter(c => c.sla.withinSla).length;
    const conformidade = concluidos.length ? Math.round((concluidosNoPrazo / concluidos.length) * 100) : 100;
    const idadeMedia = ativos.length ? Math.round(ativos.reduce((sum, c) => sum + c.sla.elapsedHours, 0) / ativos.length) : 0;
    return {
      total: ativos.length,
      late: ativos.filter(c => c.sla.state === 'late').length,
      risk: ativos.filter(c => c.sla.state === 'risk').length,
      ok: ativos.filter(c => c.sla.state === 'ok').length,
      conformidade,
      idadeMedia
    };
  }, [chamadosBase]);

  return (
    <div className="sla-page anim-fade-in">
      <section className="sla-hero">
        <div>
          <span><Timer size={14} /> Governança de atendimento</span>
          <h2>SLA de Chamados</h2>
          <p>Prazos por criticidade, risco de violação e desempenho das ordens concluídas.</p>
        </div>
        <div className="sla-policy"><Gauge size={18}/><div><strong>Política ativa</strong><span>Crítica 2h · Alta 6h · Média 12h · Baixa 24h</span></div></div>
      </section>

      <div className="sla-kpis">
        <article><Wrench size={20} /><strong>{kpis.total}</strong><span>OS ativas</span></article>
        <article className="late"><AlertTriangle size={20} /><strong>{kpis.late}</strong><span>Atrasadas</span></article>
        <article className="risk"><Clock3 size={20} /><strong>{kpis.risk}</strong><span>Em risco</span></article>
        <article className="ok"><CheckCircle2 size={20} /><strong>{kpis.conformidade}%</strong><span>Concluídas no prazo</span></article>
        <article><TrendingUp size={20} /><strong>{kpis.idadeMedia}h</strong><span>Idade média ativa</span></article>
      </div>

      <section className="sla-toolbar">
        <div className="sla-search"><Search size={16}/><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar OS, equipamento, técnico ou filial" /></div>
        <select value={urgencia} onChange={(event) => setUrgencia(event.target.value)} aria-label="Filtrar por urgência">
          <option value="todas">Todas as urgências</option><option value="critica">Crítica</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option><option value="pendente">Pendente</option>
        </select>
        <select value={estado} onChange={(event) => setEstado(event.target.value)} aria-label="Filtrar por estado do SLA">
          <option value="todos">Todos os estados</option><option value="late">Atrasados</option><option value="risk">Em risco</option><option value="ok">No prazo</option><option value="done">Concluídos</option>
        </select>
      </section>

      <div className="sla-board">
        {['late', 'risk', 'ok', 'done'].map((state) => {
          const labels = { late: 'Atrasados', risk: 'Em risco', ok: 'No prazo', done: 'Concluídos' };
          const cards = chamadosComSla.filter(c => c.sla.state === state).slice(0, state === 'done' ? 20 : 80);
          return (
            <section className={`sla-column ${state}`} key={state}>
              <h3>{labels[state]} <small>{cards.length}</small></h3>
              <div className="sla-column-list">
                {cards.map(c => (
                  <article className="sla-card" key={c.id}>
                    <div className="sla-card-head"><strong>OS-{c.id}</strong><span>{c.urgencia || 'Pendente'}</span></div>
                    <p>{c.equipamento_nome || 'Equipamento não informado'}</p>
                    <small>{c.filial || c.equipamento_filial || 'Filial não informada'}</small>
                    <div className="sla-card-context">
                      <span><User size={13}/> {c.tecnico_responsavel || 'Sem responsável'}</span>
                      <span><CalendarDays size={13}/> {c.data_abertura ? new Date(c.data_abertura).toLocaleDateString('pt-BR') : 'Sem data'}</span>
                    </div>
                    <div className="sla-progress" title={`${Math.round(c.sla.elapsedHours)}h consumidas de ${c.sla.limitHours}h`}><div style={{ width: `${Math.min(100, Math.max(6, (c.sla.elapsedHours / c.sla.limitHours) * 100))}%` }} /></div>
                    <footer><span><TrendingUp size={13} /> SLA {c.sla.limitHours}h</span><strong>{c.sla.state === 'late' ? `-${formatHours(c.sla.remainingHours)}` : c.sla.state === 'done' ? c.sla.label : formatHours(c.sla.remainingHours)}</strong></footer>
                  </article>
                ))}
                {cards.length === 0 && <div className="sla-empty">Nenhuma OS nesta faixa.</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
