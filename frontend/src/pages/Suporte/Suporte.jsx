import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  LifeBuoy,
  MessageSquarePlus,
  Search,
  ShieldCheck,
  Users,
  Clock3,
  Send,
  ClipboardList,
  Sparkles,
  Filter,
  Loader2,
  Bot,
  Terminal,
  Plus,
  FileText,
  Globe2,
  Layers3, BadgeCheck
} from 'lucide-react';
import './Suporte.css';

const DEFAULT_FORM = {
  titulo: '',
  descricao: '',
  categoria: 'Sistema',
  prioridade: 'Média',
  solicitante: '',
  email: ''
};

const SUPPORT_CATEGORIES = ['Sistema', 'Acesso', 'Relatórios', 'Permissões', 'Integração', 'Performance', 'Outro'];

const statusBadge = (status) => {
  const map = {
    'Aberto': 'badge-open',
    'Em análise': 'badge-progress',
    'Respondido': 'badge-answer',
    'Concluído': 'badge-done'
  };
  return map[status] || 'badge-open';
};

function SupportArticle({ artigo }) {
  return (
    <article className={`support-article ${artigo.destaque ? 'featured' : ''}`}>
      <div className="support-article-top">
        <span className="support-pill">{artigo.categoria}</span>
        <span className="support-visibility">{artigo.publico === 'DEV' ? 'DEV' : (artigo.publico === 'AMBOS' ? 'Todos' : 'Usuário')}</span>
      </div>
      <h3>{artigo.titulo}</h3>
      <p>{artigo.conteudo}</p>
    </article>
  );
}

function TicketCard({ item, isDev, onSelect, onReply }) {
  return (
    <button className="support-ticket" onClick={() => onSelect(item)}>
      <div className="support-ticket-head">
        <div>
          <span className={`support-status ${statusBadge(item.status)}`}>{item.status}</span>
          <h3>{item.titulo}</h3>
        </div>
        <span className={`support-priority priority-${String(item.prioridade || 'Média').toLowerCase().replace('í', 'i').replace('é', 'e')}`}>{item.prioridade || 'Média'}</span>
      </div>
      <p className="support-ticket-desc">{item.descricao}</p>
      <div className="support-ticket-meta">
        <span>{item.solicitante}</span>
        <span>{item.categoria || 'Geral'}</span>
        <span>{item.empresa || 'Global'}</span>
        <span>{new Date(item.criado_em).toLocaleString('pt-BR')}</span>
      </div>
      {isDev && item.resposta && <div className="support-reply-preview">{item.resposta}</div>}
      {isDev && (
        <span className="support-action-hint" onClick={(e) => { e.stopPropagation(); onReply(item); }}>
          Responder <Send size={14} />
        </span>
      )}
    </button>
  );
}

export default function Suporte({ api, socket, userRole, nomeLogado, userFilial, showToast, isOffline }) {
  const isDev = userRole === 'DEV';
  const [artigos, setArtigos] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [ticketSelecionado, setTicketSelecionado] = useState(null);
  const [ticketResposta, setTicketResposta] = useState('');
  const [ticketStatus, setTicketStatus] = useState('Em análise');

  const carregarDados = async () => {
    if (!api || isOffline) return;
    try {
      const [resArtigos, resTickets] = await Promise.all([
        api.get('/suporte/artigos').catch(() => ({ data: [] })),
        api.get('/suporte/chamados').catch(() => ({ data: [] }))
      ]);
      setArtigos(Array.isArray(resArtigos.data) ? resArtigos.data : []);
      setTickets(Array.isArray(resTickets.data) ? resTickets.data : []);
    } catch (error) {
      showToast('Não foi possível carregar o suporte ao sistema.', 'error');
    }
  };

  useEffect(() => {
    carregarDados();
  }, [api, isOffline]);

  useEffect(() => {
    if (!socket) return undefined;
    const handler = () => carregarDados();
    socket.on('atualizacao_dados', handler);
    return () => socket.off('atualizacao_dados', handler);
  }, [socket, isOffline]);

  const artigosFiltrados = useMemo(() => {
    const texto = busca.trim().toLowerCase();
    return artigos.filter((artigo) => {
      const textoArtigo = `${artigo.titulo} ${artigo.conteudo} ${artigo.categoria}`.toLowerCase();
      return !texto || textoArtigo.includes(texto);
    });
  }, [artigos, busca]);

  const ticketsFiltrados = useMemo(() => {
    return tickets.filter((ticket) => {
      if (filtroStatus !== 'Todos' && ticket.status !== filtroStatus) return false;
      const texto = `${ticket.titulo} ${ticket.descricao} ${ticket.solicitante} ${ticket.categoria}`.toLowerCase();
      return !busca.trim() || texto.includes(busca.trim().toLowerCase());
    });
  }, [tickets, filtroStatus, busca]);

  const ticketsAbertos = tickets.filter((ticket) => ticket.status === 'Aberto' || ticket.status === 'Em análise').length;
  const ticketsRespondidos = tickets.filter((ticket) => ticket.status === 'Respondido' || ticket.status === 'Concluído').length;

  const abrirTicket = async (e) => {
    e.preventDefault();
    if (isOffline) return showToast('Sem conexão com o servidor.', 'warning');
    if (!form.titulo.trim() || !form.descricao.trim() || !form.solicitante.trim()) {
      return showToast('Preencha título, descrição e solicitante.', 'warning');
    }
    setIsSaving(true);
    try {
      await api.post('/suporte/chamados', {
        ...form,
        solicitante: form.solicitante || nomeLogado || 'Usuário',
        filial: userFilial
      });
      showToast('Ticket enviado com sucesso.', 'success');
      setForm({ ...DEFAULT_FORM, solicitante: nomeLogado || '' });
      await carregarDados();
    } catch (error) {
      showToast('Falha ao abrir o ticket.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const salvarResposta = async () => {
    if (!ticketSelecionado) return;
    if (isOffline) return showToast('Sem conexão com o servidor.', 'warning');
    setIsSaving(true);
    try {
      await api.put(`/suporte/chamados/${ticketSelecionado.id}`, {
        status: ticketStatus,
        resposta: ticketResposta,
        responsavel: nomeLogado || 'Equipe DEV'
      });
      showToast('Ticket atualizado.', 'success');
      setTicketSelecionado(null);
      setTicketResposta('');
      await carregarDados();
    } catch (error) {
      showToast('Falha ao atualizar ticket.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="support-shell anim-fade-in">
      <section className="support-hero">
        <div>
          <span className="support-kicker">Central unificada de suporte</span>
          <h1>{isDev ? 'Triagem e resposta de tickets do sistema' : 'Abra e acompanhe tickets de suporte direto para o desenvolvedor'}</h1>
          <p>{isDev ? 'Acompanhe a fila, responda solicitações e mantenha a base de conhecimento viva em um único fluxo.' : 'Use esta central para relatar falhas, dúvidas ou comportamentos incorretos do sistema. A manutenção da loja continua na tela de Chamados.'}</p>
        </div>
        <div className="support-hero-stats">
          <div>
            <strong>{ticketsAbertos}</strong>
            <span>Em aberto</span>
          </div>
          <div>
            <strong>{ticketsRespondidos}</strong>
            <span>Respondidos</span>
          </div>
          <div>
            <strong>{artigosFiltrados.length}</strong>
            <span>Artigos</span>
          </div>
        </div>
      </section>

      <div className="support-toolbar">
        <div className="support-search">
          <Search size={18} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar bug, erro, módulo ou ticket..." />
        </div>
        <div className="support-filters">
          {['Todos', 'Aberto', 'Em análise', 'Respondido', 'Concluído'].map((status) => (
            <button key={status} className={`support-filter ${filtroStatus === status ? 'active' : ''}`} onClick={() => setFiltroStatus(status)}>
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="support-grid">
        <section className="support-panel support-panel-articles">
          <div className="panel-title">
            <div>
              <span className="panel-icon"><BookOpen size={18} /></span>
              <h2>Base de conhecimento do sistema</h2>
            </div>
            <span className="panel-badge">{isDev ? 'Público + interno' : 'Usuário final'}</span>
          </div>
          <div className="support-articles-grid">
            {artigosFiltrados.map((artigo) => <SupportArticle key={artigo.id} artigo={artigo} />)}
          </div>
        </section>

        <section className="support-panel support-panel-form">
          <div className="panel-title">
            <div>
              <span className="panel-icon"><MessageSquarePlus size={18} /></span>
              <h2>{isDev ? 'Criar ticket interno' : 'Abrir ticket para o DEV'}</h2>
            </div>
            <span className="panel-badge">{isDev ? 'Fila interna' : 'Problema de sistema'}</span>
          </div>

          <form className="support-form" onSubmit={abrirTicket}>
            <input value={form.titulo} onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))} placeholder="Título do erro ou falha" />
            <textarea value={form.descricao} onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))} placeholder="Descreva o erro, o que tentou fazer, o que aconteceu e em qual tela/módulo" rows={5} />
            <div className="support-form-row">
              <select value={form.categoria} onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}>
                {SUPPORT_CATEGORIES.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
              </select>
              <select value={form.prioridade} onChange={(e) => setForm((prev) => ({ ...prev, prioridade: e.target.value }))}>
                {['Baixa', 'Média', 'Alta', 'Crítica'].map((prioridade) => <option key={prioridade} value={prioridade}>{prioridade}</option>)}
              </select>
            </div>
            <div className="support-form-row">
              <input value={form.solicitante} onChange={(e) => setForm((prev) => ({ ...prev, solicitante: e.target.value }))} placeholder="Quem está reportando" />
              <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="E-mail de retorno" />
            </div>
            <button className="support-submit" type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
              {isDev ? 'Enviar para triagem' : 'Abrir ticket ao DEV'}
            </button>
          </form>
        </section>
      </div>

      <section className="support-panel support-panel-tickets">
        <div className="panel-title">
          <div>
            <span className="panel-icon"><ClipboardList size={18} /></span>
            <h2>{isDev ? 'Fila operacional' : 'Meus tickets de suporte'}</h2>
          </div>
          <span className="panel-badge">{ticketsFiltrados.length} itens</span>
        </div>

        <div className="support-ticket-list">
          {ticketsFiltrados.map((ticket) => (
            <TicketCard
              key={ticket.id}
              item={ticket}
              isDev={isDev}
              onSelect={(item) => {
                setTicketSelecionado(item);
                setTicketResposta(item.resposta || '');
                setTicketStatus(item.status || 'Em análise');
              }}
              onReply={(item) => {
                setTicketSelecionado(item);
                setTicketResposta(item.resposta || '');
                setTicketStatus(item.status || 'Em análise');
              }}
            />
          ))}
        </div>
      </section>

      {isDev && ticketSelecionado && (
        <div className="support-modal-backdrop" onClick={() => setTicketSelecionado(null)}>
          <div className="support-modal" onClick={(e) => e.stopPropagation()}>
            <div className="support-modal-head">
              <div>
                <span className="panel-icon"><Terminal size={18} /></span>
                <h3>Responder ticket do sistema</h3>
              </div>
              <button onClick={() => setTicketSelecionado(null)} className="support-close">Fechar</button>
            </div>
            <div className="support-modal-body">
              <strong>{ticketSelecionado.titulo}</strong>
              <p>{ticketSelecionado.descricao}</p>
              <div className="support-form-row">
                <select value={ticketStatus} onChange={(e) => setTicketStatus(e.target.value)}>
                  {['Aberto', 'Em análise', 'Respondido', 'Concluído'].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <input value={ticketSelecionado.prioridade || ''} disabled />
              </div>
              <textarea rows={6} value={ticketResposta} onChange={(e) => setTicketResposta(e.target.value)} placeholder="Digite a resposta interna ou a orientação ao usuário" />
              <button className="support-submit" onClick={salvarResposta} disabled={isSaving}>
                {isSaving ? <Loader2 size={16} className="spin" /> : <BadgeCheck size={16} />}
                Salvar resposta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
