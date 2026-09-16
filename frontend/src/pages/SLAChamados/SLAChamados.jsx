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
 */
const normalize = (value) => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Busca ou monta os dados de get sla info usados no fluxo atual.
 */
const getSlaInfo = (chamado) => {
  const urgency = normalize(chamado.urgencia || 'pendente');
  const limitHours = SLA_HOURS[urgency] || 24;
  const openedAt = chamado.data_abertura ? new Date(chamado.data_abertura).getTime() : Date.now();
  const elapsedHours = Math.max(0, (Date.now() - openedAt) / 36e5);
  const remainingHours = limitHours - elapsedHours;
  const status = normalize(chamado.status);
  const closed = status.includes('conclu') || status.includes('fechad') || chamado.arquivado;

  if (closed) return { limitHours, elapsedHours, remainingHours, state: 'done', label: 'Concluído' };
  if (remainingHours <= 0) return { limitHours, elapsedHours, remainingHours, state: 'late', label: 'Atrasado' };
  if (remainingHours <= Math.max(1, limitHours * 0.25)) return { limitHours, elapsedHours, remainingHours, state: 'risk', label: 'Em risco' };
  return { limitHours, elapsedHours, remainingHours, state: 'ok', label: 'No prazo' };
};

/**
 * Formata format hours para exibicao segura na interface.
 */
const formatHours = (hours) => {
  const abs = Math.abs(hours);
  if (abs < 1) return `${Math.max(1, Math.round(abs * 60))} min`;
  return `${Math.round(abs)}h`;
};

/**
 * Renderiza a tela SLAChamados e concentra as regras de apresentacao desse modulo.
 */
export default function SLAChamados({ chamados = [], filialAtiva }) {
  const chamadosComSla = useMemo(() => {
    return chamados
      .filter(c => !filialAtiva || filialAtiva === 'Todas' || normalize(c.filial || c.equipamento_filial) === normalize(filialAtiva))
      .map(c => ({ ...c, sla: getSlaInfo(c) }))
      .sort((a, b) => {
        const weight = { late: 0, risk: 1, ok: 2, done: 3 };
        return weight[a.sla.state] - weight[b.sla.state] || a.sla.remainingHours - b.sla.remainingHours;
      });
  }, [chamados, filialAtiva]);

  const ativos = chamadosComSla.filter(c => c.sla.state !== 'done');
  const kpis = {
    total: ativos.length,
    late: ativos.filter(c => c.sla.state === 'late').length,
    risk: ativos.filter(c => c.sla.state === 'risk').length,
    ok: ativos.filter(c => c.sla.state === 'ok').length
  };

  return (
    <div className="sla-page anim-fade-in">
      <section className="sla-hero">
        <div>
          <span><Timer size={14} /> Prioridade operacional</span>
          <h2>SLA de Chamados</h2>
          <p>Controle visual de prazos por urgência para evitar atrasos e perdas operacionais.</p>
        </div>
      </section>

      <div className="sla-kpis">
        <article><Wrench size={20} /><strong>{kpis.total}</strong><span>OS ativas</span></article>
        <article className="late"><AlertTriangle size={20} /><strong>{kpis.late}</strong><span>Atrasadas</span></article>
        <article className="risk"><Clock3 size={20} /><strong>{kpis.risk}</strong><span>Em risco</span></article>
        <article className="ok"><CheckCircle2 size={20} /><strong>{kpis.ok}</strong><span>No prazo</span></article>
      </div>

      <div className="sla-board">
        {['late', 'risk', 'ok', 'done'].map((state) => {
          const labels = { late: 'Atrasados', risk: 'Em risco', ok: 'No prazo', done: 'Concluídos recentes' };
          const cards = chamadosComSla.filter(c => c.sla.state === state).slice(0, state === 'done' ? 8 : 80);
          return (
            <section className={`sla-column ${state}`} key={state}>
              <h3>{labels[state]} <small>{cards.length}</small></h3>
              <div className="sla-column-list">
                {cards.map(c => (
                  <article className="sla-card" key={c.id}>
                    <div className="sla-card-head">
                      <strong>OS-{c.id}</strong>
                      <span>{c.urgencia || 'Pendente'}</span>
                    </div>
                    <p>{c.equipamento_nome || 'Equipamento não informado'}</p>
                    <small>{c.filial || c.equipamento_filial || 'Filial não informada'}</small>
                    <div className="sla-progress">
                      <div style={{ width: `${Math.min(100, Math.max(6, (c.sla.elapsedHours / c.sla.limitHours) * 100))}%` }} />
                    </div>
                    <footer>
                      <span><TrendingUp size={13} /> SLA {c.sla.limitHours}h</span>
                      <strong>{c.sla.state === 'late' ? `-${formatHours(c.sla.remainingHours)}` : c.sla.state === 'done' ? 'Finalizado' : formatHours(c.sla.remainingHours)}</strong>
                    </footer>
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
