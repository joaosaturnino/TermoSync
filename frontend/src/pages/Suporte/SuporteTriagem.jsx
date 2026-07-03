import React, { useCallback, useEffect, useMemo, useState, memo } from 'react';
import {
  BadgeCheck,
  Clock3,
  Filter,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Terminal,
  User,
  AlertTriangle,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import './SuporteTelas.css';

const STATUS_OPTIONS = ['Todos', 'Aberto', 'Em análise', 'Respondido', 'Concluído'];
const PRIORITY_OPTIONS = ['Todas', 'Baixa', 'Média', 'Alta', 'Crítica'];

const statusClass = (status) => {
  const map = {
    'Aberto': 'status-aberto',
    'Em análise': 'status-analise',
    'Respondido': 'status-respondido',
    'Concluído': 'status-concluido'
  };
  return map[status] || 'status-aberto';
};

const formatDate = (value) => {
  if (!value) return 'Data indisponível';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const SupportQueueCard = memo(({ ticket, selected, onClick }) => {
  return (
    <button className={`support-flow-ticket ${selected ? 'selected' : ''}`} onClick={() => onClick(ticket)} type="button">
      <div className="support-flow-ticket-top">
        <div>
          <span className={`support-flow-status ${statusClass(ticket.status)}`}>{ticket.status || 'Aberto'}</span>
          <h3>{ticket.titulo}</h3>
        </div>
        <span className={`support-flow-priority priority-${String(ticket.prioridade || 'Média').toLowerCase().replace('í', 'i').replace('é', 'e')}`}>
          {ticket.prioridade || 'Média'}
        </span>
      </div>
      <p className="support-flow-ticket-desc">{ticket.descricao}</p>
      <div className="support-flow-ticket-meta">
        <span><User size={14} /> {ticket.solicitante || 'Usuário'}</span>
        <span><Clock3 size={14} /> {formatDate(ticket.criado_em)}</span>
        <span><ShieldCheck size={14} /> {ticket.categoria || 'Geral'}</span>
      </div>
      {ticket.resposta ? (
        <div className="support-flow-response-preview">
          <BadgeCheck size={14} /> {ticket.resposta}
        </div>
      ) : (
        <div className="support-flow-response-empty">
          <AlertTriangle size={14} /> Ticket aguardando análise.
        </div>
      )}
    </button>
  );
});

export default function SuporteTriagem({ api, socket, userRole, nomeLogado, showToast, isOffline, onNavigate }) {
  const [tickets, setTickets] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Aberto');
  const [filtroPrioridade, setFiltroPrioridade] = useState('Todas');
  const [selecionado, setSelecionado] = useState(null);
  const [resposta, setResposta] = useState('');
  const [statusAtual, setStatusAtual] = useState('Em análise');
  const [isSaving, setIsSaving] = useState(false);
  const [historico, setHistorico] = useState([]);

  const carregarTickets = useCallback(async () => {
    if (!api || isOffline) return;
    try {
      const res = await api.get('/suporte/chamados');
      setTickets(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      showToast?.('Não foi possível carregar a fila de suporte.', 'error');
    }
  }, [api, isOffline, showToast]);

  useEffect(() => {
    carregarTickets();
  }, [carregarTickets]);

  useEffect(() => {
    if (!socket) return undefined;
    const handler = () => carregarTickets();
    socket.on('atualizacao_dados', handler);
    return () => socket.off('atualizacao_dados', handler);
  }, [socket, carregarTickets]);

  const ticketsVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (tickets || [])
      .filter((ticket) => {
        if (filtroStatus !== 'Todos' && ticket.status !== filtroStatus) return false;
        if (filtroPrioridade !== 'Todas' && ticket.prioridade !== filtroPrioridade) return false;
        if (termo) {
          const texto = `${ticket.titulo} ${ticket.descricao} ${ticket.solicitante} ${ticket.categoria} ${ticket.resposta} ${ticket.empresa} ${ticket.filial}`.toLowerCase();
          if (!texto.includes(termo)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const prioridadeOrder = { 'Crítica': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 };
        const ordemA = prioridadeOrder[a.prioridade] ?? 2;
        const ordemB = prioridadeOrder[b.prioridade] ?? 2;
        if (ordemA !== ordemB) return ordemA - ordemB;
        return new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime();
      });
  }, [tickets, busca, filtroStatus, filtroPrioridade]);

  const resumo = useMemo(() => {
    const abertas = ticketsVisiveis.filter((ticket) => ticket.status === 'Aberto').length;
    const analise = ticketsVisiveis.filter((ticket) => ticket.status === 'Em análise').length;
    const criticos = ticketsVisiveis.filter((ticket) => ticket.prioridade === 'Crítica').length;
    return { abertas, analise, criticos };
  }, [ticketsVisiveis]);

  useEffect(() => {
    if (!selecionado && ticketsVisiveis.length > 0) {
      setSelecionado(ticketsVisiveis[0]);
      setResposta(ticketsVisiveis[0].resposta || '');
      setStatusAtual(ticketsVisiveis[0].status || 'Em análise');
    }
    if (selecionado && !ticketsVisiveis.some((ticket) => ticket.id === selecionado.id)) {
      const next = ticketsVisiveis[0] || null;
      setSelecionado(next);
      setResposta(next?.resposta || '');
      setStatusAtual(next?.status || 'Em análise');
    }
  }, [ticketsVisiveis, selecionado]);

  useEffect(() => {
    const carregarHistorico = async () => {
      if (!api || isOffline || !selecionado?.id) {
        setHistorico([]);
        return;
      }

      try {
        const res = await api.get(`/suporte/chamados/${selecionado.id}/historico`);
        setHistorico(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        setHistorico([]);
      }
    };

    carregarHistorico();
  }, [api, isOffline, selecionado?.id]);

  const selecionarTicket = (ticket) => {
    setSelecionado(ticket);
    setResposta(ticket.resposta || '');
    setStatusAtual(ticket.status || 'Em análise');
  };

  const salvarResposta = async () => {
    if (!selecionado) return;
    if (isOffline) return showToast?.('Sem conexão com o servidor.', 'warning');
    setIsSaving(true);
    try {
      await api.put(`/suporte/chamados/${selecionado.id}`, {
        status: statusAtual,
        resposta,
        responsavel: nomeLogado || 'Equipe DEV'
      });
      showToast?.('Ticket atualizado com sucesso.', 'success');
      await carregarTickets();
      setSelecionado((prev) => prev ? { ...prev, status: statusAtual, resposta } : prev);
    } catch (error) {
      showToast?.('Falha ao salvar a resposta.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedPriority = selecionado?.prioridade || 'Média';

  return (
    <div className="support-flow-shell anim-fade-in">
      <section className="support-flow-hero support-flow-hero-triagem">
        <div>
          <span className="support-flow-kicker"><Terminal size={14} /> Triagem de Suporte</span>
          <h1>Fila interna para análise dos tickets do sistema</h1>
          <p>Organize os tickets por prioridade, responda o usuário e mantenha o fluxo de suporte visível em um painel próprio do desenvolvedor.</p>
          <div className="support-flow-actions">
            <button className="btn btn-primary" type="button" onClick={() => onNavigate?.('suporte')}>
              <MessageSquare size={16} /> Voltar ao suporte
            </button>
            <button className="btn btn-outline" type="button" onClick={() => onNavigate?.('dev_panel')}>
              <Sparkles size={16} /> Ver painel do DEV
            </button>
          </div>
        </div>

        <div className="support-flow-stats">
          <div className="support-flow-stat">
            <strong>{ticketsVisiveis.length}</strong>
            <span>Tickets filtrados</span>
          </div>
          <div className="support-flow-stat">
            <strong>{resumo.abertas + resumo.analise}</strong>
            <span>Em atendimento</span>
          </div>
          <div className="support-flow-stat">
            <strong>{resumo.criticos}</strong>
            <span>Prioridade crítica</span>
          </div>
          <div className="support-flow-stat">
            <strong>ROOT</strong>
            <span>Visão operacional</span>
          </div>
        </div>
      </section>

      <div className="support-flow-toolbar">
        <div className="support-flow-search">
          <Search size={18} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ticket, empresa, usuário ou resposta" />
        </div>
        <div className="support-flow-filters">
          <Filter size={16} className="support-flow-filter-icon" />
          {STATUS_OPTIONS.map((status) => (
            <button key={status} type="button" className={`support-flow-filter ${filtroStatus === status ? 'active' : ''}`} onClick={() => setFiltroStatus(status)}>
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="support-flow-toolbar support-flow-toolbar-secondary">
        <div className="support-flow-filters">
          {PRIORITY_OPTIONS.map((prioridade) => (
            <button key={prioridade} type="button" className={`support-flow-filter ${filtroPrioridade === prioridade ? 'active' : ''}`} onClick={() => setFiltroPrioridade(prioridade)}>
              {prioridade}
            </button>
          ))}
        </div>
      </div>

      <section className="support-flow-grid">
        <div className="support-flow-panel">
          <div className="support-flow-panel-head">
            <div>
              <span className="panel-icon"><LifeBuoy size={18} /></span>
              <h2>Fila operacional</h2>
            </div>
            <span className="panel-badge">{ticketsVisiveis.length} tickets</span>
          </div>

          <div className="support-flow-list">
            {ticketsVisiveis.length === 0 ? (
              <div className="support-flow-empty">
                <ShieldCheck size={42} />
                <h3>Sem tickets nesta fila</h3>
                <p>Afrouxe os filtros ou aguarde o próximo ticket do sistema chegar.</p>
              </div>
            ) : (
              ticketsVisiveis.map((ticket) => (
                <SupportQueueCard key={ticket.id} ticket={ticket} selected={selecionado?.id === ticket.id} onClick={selecionarTicket} />
              ))
            )}
          </div>
        </div>

        <div className="support-flow-side">
          {selecionado ? (
            <div className="support-flow-detail support-flow-triagem-detail">
              <div className="support-flow-detail-head">
                <div>
                  <span className={`support-flow-status ${statusClass(selecionado.status)}`}>{selecionado.status || 'Aberto'}</span>
                  <h3>{selecionado.titulo}</h3>
                </div>
                <span className={`support-flow-priority priority-${String(selectedPriority).toLowerCase().replace('í', 'i').replace('é', 'e')}`}>
                  {selectedPriority}
                </span>
              </div>

              <div className="support-flow-detail-meta">
                <span><User size={14} /> {selecionado.solicitante || 'Usuário'}</span>
                <span><Clock3 size={14} /> {formatDate(selecionado.criado_em)}</span>
                <span><ShieldCheck size={14} /> {selecionado.categoria || 'Geral'}</span>
              </div>

              <p className="support-flow-detail-text">{selecionado.descricao}</p>

              <div className="support-flow-editor">
                <label>Status do ticket</label>
                <select value={statusAtual} onChange={(e) => setStatusAtual(e.target.value)}>
                  {['Aberto', 'Em análise', 'Respondido', 'Concluído'].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>

                <label>Resposta para o usuário</label>
                <textarea rows={8} value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Explique a causa, a correção aplicada ou a orientação ao usuário." />

                <div className="support-flow-action-row">
                  <button className="btn btn-primary" type="button" onClick={salvarResposta} disabled={isSaving}>
                    {isSaving ? <Loader2 size={16} className="spinner" /> : <Send size={16} />}
                    Salvar resposta
                  </button>
                  <button className="btn btn-outline" type="button" onClick={() => onNavigate?.('suporte_acompanhamento')}>
                    <ArrowRight size={16} /> Ver acompanhamento
                  </button>
                </div>
              </div>

              <div className="support-flow-note-box">
                <strong>Linha do tempo interna</strong>
                <div className="support-flow-history">
                  {historico.length === 0 ? (
                    <p>Nenhum evento registrado ainda.</p>
                  ) : (
                    historico.map((item) => (
                      <div key={item.id} className="support-flow-history-item">
                        <span>{item.evento}</span>
                        <strong>{item.autor}</strong>
                        <p>{item.mensagem || 'Sem observação.'}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="support-flow-detail support-flow-detail-empty">
              <Terminal size={42} />
              <h3>Nenhum ticket selecionado</h3>
              <p>Escolha um item da fila para revisar o contexto, responder e atualizar o status.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}