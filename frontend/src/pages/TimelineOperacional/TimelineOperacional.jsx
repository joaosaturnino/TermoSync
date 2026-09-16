import React, { useDeferredValue, useMemo, useState } from 'react';
import { AlertTriangle, Archive, Bell, CheckCircle2, Clock, Search, Wrench, Zap } from 'lucide-react';
import './TimelineOperacional.css';

/**
 * Normaliza normalize para evitar divergencia de formato nas comparacoes.
 */
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Busca ou monta os dados de get time usados no fluxo atual.
 */
const getTime = (value) => {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

/**
 * Renderiza a tela Timeline Operacional e concentra as regras de apresentacao desse modulo.
 */
export default function TimelineOperacional({ notificacoes = [], historicoAlertas = [], chamados = [], filialAtiva }) {
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const buscaDiferida = useDeferredValue(busca);

  const eventos = useMemo(() => {
    const alertasAtivos = notificacoes.map(item => ({
      id: `alerta-${item.id}`,
      tipo: 'alerta',
      titulo: item.equipamento_nome || 'Alerta operacional',
      detalhe: item.mensagem || item.tipo_alerta || 'Ocorrência ativa',
      filial: item.filial,
      data: item.data_hora,
      icon: AlertTriangle,
      tone: 'danger'
    }));

    const alertasResolvidos = historicoAlertas.map(item => ({
      id: `hist-${item.id}`,
      tipo: 'historico',
      titulo: item.equipamento_nome || 'Ocorrência resolvida',
      detalhe: item.nota_resolucao || item.mensagem || 'Evento resolvido',
      filial: item.filial,
      data: item.data_hora,
      icon: CheckCircle2,
      tone: 'success'
    }));

    const chamadosEventos = chamados.map(item => {
      const status = normalize(item.status);
      const finalizado = status.includes('conclu') || status.includes('fechad') || item.arquivado;
      return {
        id: `chamado-${item.id}`,
        tipo: finalizado ? 'historico' : 'chamado',
        titulo: `OS-${item.id} ${item.equipamento_nome || 'Chamado'}`,
        detalhe: item.descricao || item.nota_resolucao || 'Chamado técnico',
        filial: item.filial || item.equipamento_filial,
        data: item.data_conclusao || item.data_abertura,
        icon: finalizado ? Archive : Wrench,
        tone: finalizado ? 'neutral' : 'warning'
      };
    });

    const termo = normalize(buscaDiferida);
    return [...alertasAtivos, ...alertasResolvidos, ...chamadosEventos]
      .filter(evento => filtro === 'todos' || evento.tipo === filtro)
      .filter(evento => !filialAtiva || filialAtiva === 'Todas' || normalize(evento.filial) === normalize(filialAtiva))
      .filter(evento => !termo || normalize(`${evento.titulo} ${evento.detalhe} ${evento.filial}`).includes(termo))
      .sort((a, b) => getTime(b.data) - getTime(a.data))
      .slice(0, 250);
  }, [notificacoes, historicoAlertas, chamados, filialAtiva, filtro, buscaDiferida]);

  const counts = useMemo(() => ({
    todos: eventos.length,
    alerta: notificacoes.length,
    chamado: chamados.filter(c => !normalize(c.status).includes('conclu') && !c.arquivado).length,
    historico: historicoAlertas.length
  }), [eventos.length, notificacoes.length, chamados, historicoAlertas.length]);

  return (
    <div className="timeline-page anim-fade-in">
      <section className="timeline-hero">
        <div>
          <span><Zap size={14} /> Visão Unificada</span>
          <h2>Timeline Operacional</h2>
          <p>Alertas, chamados e laudos organizados em uma única linha do tempo.</p>
        </div>
        <div className="timeline-search">
          <Search size={16} />
          <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por equipamento, filial ou ocorrência..." />
        </div>
      </section>

      <div className="timeline-tabs">
        {[
          ['todos', 'Todos', counts.todos],
          ['alerta', 'Alertas', counts.alerta],
          ['chamado', 'Chamados', counts.chamado],
          ['historico', 'Histórico', counts.historico]
        ].map(([id, label, count]) => (
          <button key={id} className={filtro === id ? 'active' : ''} onClick={() => setFiltro(id)}>
            {label}<small>{count}</small>
          </button>
        ))}
      </div>

      <div className="timeline-list">
        {eventos.map((evento) => {
          const Icon = evento.icon || Bell;
          return (
            <article className={`timeline-item ${evento.tone}`} key={evento.id}>
              <div className="timeline-icon"><Icon size={18} /></div>
              <div className="timeline-content">
                <div className="timeline-row">
                  <strong>{evento.titulo}</strong>
                  <span><Clock size={13} /> {evento.data ? new Date(evento.data).toLocaleString('pt-BR') : 'Sem data'}</span>
                </div>
                <p>{evento.detalhe}</p>
                <small>{evento.filial || 'Filial não informada'} • {evento.tipo}</small>
              </div>
            </article>
          );
        })}
        {eventos.length === 0 && (
          <div className="timeline-empty">
            <Bell size={28} />
            Nenhum evento encontrado para os filtros atuais.
          </div>
        )}
      </div>
    </div>
  );
}
