import React, { useCallback, useEffect, useMemo, useState, memo } from 'react';
import {
  BookOpen,
  ClipboardList,
  Clock3,
  Filter,
  LifeBuoy,
  MessageSquare,
  Search,
  Sparkles,
  User,
  ArrowRight,
  BadgeCheck,
  AlertTriangle
} from 'lucide-react';
import './SuporteTelas.css';

const STATUS_OPTIONS = ['Todos', 'Aberto', 'Em análise', 'Respondido', 'Concluído'];

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

const SupportTicketCard = memo(({ ticket, selected, onClick }) => {
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
        <span><BookOpen size={14} /> {ticket.categoria || 'Geral'}</span>
      </div>
      {ticket.resposta ? (
        <div className="support-flow-response-preview">
          <BadgeCheck size={14} /> {ticket.resposta}
        </div>
      ) : (
        <div className="support-flow-response-empty">
          <AlertTriangle size={14} /> Aguardando retorno do suporte.
        </div>
      )}
    </button>
  );
});

export default function SuporteAcompanhamento({ api, socket, userRole, nomeLogado, userFilial, showToast, isOffline, onNavigate }) {
  const isDev = userRole === 'DEV';
  const [tickets, setTickets] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [selecionado, setSelecionado] = useState(null);
  const [historico, setHistorico] = useState([]);

  const carregarTickets = useCallback(async () => {
    if (!api || isOffline) return;
    try {
      const res = await api.get('/suporte/chamados');
      setTickets(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      showToast?.('Não foi possível carregar os tickets de suporte.', 'error');
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
    const nomeLower = String(nomeLogado || '').toLowerCase();
    const filialLower = String(userFilial || '').toLowerCase();

    return (tickets || [])
      .filter((ticket) => {
        if (!isDev) {
          const solicitante = String(ticket.solicitante || '').toLowerCase();
          const filial = String(ticket.filial || '').toLowerCase();
          const pertenceAoUsuario = nomeLower ? solicitante === nomeLower : false;
          const pertenceAFilial = filialLower ? filial === filialLower : false;
          if (!pertenceAoUsuario && !pertenceAFilial) return false;
        }

        if (filtroStatus !== 'Todos' && ticket.status !== filtroStatus) return false;

        if (termo) {
          const texto = `${ticket.titulo} ${ticket.descricao} ${ticket.solicitante} ${ticket.categoria} ${ticket.resposta} ${ticket.empresa} ${ticket.filial}`.toLowerCase();
          if (!texto.includes(termo)) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime());
  }, [tickets, busca, filtroStatus, isDev, nomeLogado, userFilial]);

  const resumo = useMemo(() => {
    const aberto = ticketsVisiveis.filter((ticket) => ticket.status === 'Aberto').length;
    const analise = ticketsVisiveis.filter((ticket) => ticket.status === 'Em análise').length;
    const respondidos = ticketsVisiveis.filter((ticket) => ticket.status === 'Respondido' || ticket.status === 'Concluído').length;
    return { aberto, analise, respondidos };
  }, [ticketsVisiveis]);

  useEffect(() => {
    if (!selecionado && ticketsVisiveis.length > 0) {
      setSelecionado(ticketsVisiveis[0]);
    }
    if (selecionado && !ticketsVisiveis.some((ticket) => ticket.id === selecionado.id)) {
      setSelecionado(ticketsVisiveis[0] || null);
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

  const detalheSelecionado = selecionado || ticketsVisiveis[0] || null;

  return (
    <div className="support-flow-shell anim-fade-in">
      <section className="support-flow-hero support-flow-hero-acompanhamento">
        <div>
          <span className="support-flow-kicker"><LifeBuoy size={14} /> Acompanhamento de Suporte</span>
          <h1>Histórico e retorno dos tickets do sistema</h1>
          <p>Acompanhe cada chamado aberto no suporte ao desenvolvedor, veja o status atual e revise a resposta registrada pela equipe.</p>
          <div className="support-flow-actions">
            <button className="btn btn-primary" type="button" onClick={() => onNavigate?.('suporte')}>
              <MessageSquare size={16} /> Abrir novo ticket
            </button>
            {isDev && (
              <button className="btn btn-outline" type="button" onClick={() => onNavigate?.('suporte_triagem')}>
                <Sparkles size={16} /> Ir para triagem
              </button>
            )}
          </div>
        </div>

        <div className="support-flow-stats">
          <div className="support-flow-stat">
            <strong>{ticketsVisiveis.length}</strong>
            <span>Tickets visíveis</span>
          </div>
          <div className="support-flow-stat">
            <strong>{resumo.aberto + resumo.analise}</strong>
            <span>Em atendimento</span>
          </div>
          <div className="support-flow-stat">
            <strong>{resumo.respondidos}</strong>
            <span>Respondidos</span>
          </div>
          <div className="support-flow-stat">
            <strong>{isDev ? 'DEV' : 'USUÁRIO'}</strong>
            <span>Modo de visão</span>
          </div>
        </div>
      </section>

      <div className="support-flow-toolbar">
        <div className="support-flow-search">
          <Search size={18} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar protocolo, problema, categoria ou resposta" />
        </div>
        <div className="support-flow-filters">
          <Filter size={16} className="support-flow-filter-icon" />
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              className={`support-flow-filter ${filtroStatus === status ? 'active' : ''}`}
              onClick={() => setFiltroStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <section className="support-flow-grid">
        <div className="support-flow-panel">
          <div className="support-flow-panel-head">
            <div>
              <span className="panel-icon"><ClipboardList size={18} /></span>
              <h2>Fila de tickets</h2>
            </div>
            <span className="panel-badge">{ticketsVisiveis.length} itens</span>
          </div>

          <div className="support-flow-list">
            {ticketsVisiveis.length === 0 ? (
              <div className="support-flow-empty">
                <BookOpen size={42} />
                <h3>Nenhum ticket encontrado</h3>
                <p>Use outro filtro ou volte para abrir um novo ticket de suporte.</p>
              </div>
            ) : (
              ticketsVisiveis.map((ticket) => (
                <SupportTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  selected={detalheSelecionado?.id === ticket.id}
                  onClick={setSelecionado}
                />
              ))
            )}
          </div>
        </div>

        <div className="support-flow-side">
          {detalheSelecionado ? (
            <div className="support-flow-detail">
              <div className="support-flow-detail-head">
                <div>
                  <span className={`support-flow-status ${statusClass(detalheSelecionado.status)}`}>{detalheSelecionado.status || 'Aberto'}</span>
                  <h3>{detalheSelecionado.titulo}</h3>
                </div>
                <span className={`support-flow-priority priority-${String(detalheSelecionado.prioridade || 'Média').toLowerCase().replace('í', 'i').replace('é', 'e')}`}>
                  {detalheSelecionado.prioridade || 'Média'}
                </span>
              </div>

              <div className="support-flow-detail-meta">
                <span><User size={14} /> {detalheSelecionado.solicitante || 'Usuário'}</span>
                <span><Clock3 size={14} /> {formatDate(detalheSelecionado.criado_em)}</span>
                <span><BookOpen size={14} /> {detalheSelecionado.categoria || 'Geral'}</span>
              </div>

              <p className="support-flow-detail-text">{detalheSelecionado.descricao}</p>

              <div className="support-flow-note-box">
                <strong>Retorno do suporte</strong>
                <p>{detalheSelecionado.resposta || 'Ainda não houve resposta registrada para este ticket.'}</p>
              </div>

              <div className="support-flow-note-box muted">
                <strong>Contexto</strong>
                <p>{detalheSelecionado.empresa ? `Empresa: ${detalheSelecionado.empresa}` : 'Ticket global do sistema.'}{detalheSelecionado.filial ? ` Filial: ${detalheSelecionado.filial}.` : ''}</p>
              </div>

              <div className="support-flow-note-box">
                <strong>Linha do tempo</strong>
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

              <button className="btn btn-outline w-100" type="button" onClick={() => onNavigate?.('suporte')}>
                <ArrowRight size={16} /> Abrir outro ticket
              </button>
            </div>
          ) : (
            <div className="support-flow-detail support-flow-detail-empty">
              <BookOpen size={42} />
              <h3>Selecione um ticket</h3>
              <p>O painel lateral mostra a conversa e o status detalhado do ticket escolhido.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}