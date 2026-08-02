import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { 
  LifeBuoy, PlusCircle, Clock3, CheckCircle, AlertTriangle, 
  MessageSquare, User, Building2, ShieldCheck, X, Send, 
  FileText, History, CornerDownRight, Loader2, Filter, 
  ChevronRight, Search, Sparkles, Terminal, BookOpen, 
  BadgeCheck, Hourglass, Bot, Zap, ArrowRight, AlertOctagon,
  HelpCircle, Server, Tag, Copy, Check, Play, CheckCheck
} from 'lucide-react';
import './Suporte.css';
import './SuporteTelas.css';
import CentralAjudaModal from '../../components/CentralAjudaModal';

const STATUS_OPTIONS = ['Todos', 'Aberto', 'Em análise', 'Respondido', 'Concluído'];
const PRIORITY_OPTIONS = ['Todas', 'Baixa', 'Média', 'Alta', 'Crítica'];
const CATEGORY_OPTIONS = ['Todas', 'Geral', 'Técnico', 'Financeiro', 'Sugestão'];

const statusClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'concluído' || s === 'resolvido' || s === 'fechado') return 'status-concluido';
  if (s === 'em análise' || s === 'em atendimento') return 'status-analise';
  if (s === 'respondido') return 'status-respondido';
  return 'status-aberto';
};

const formatDate = (value) => {
  if (!value) return 'Data indisponível';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const getPriorityConfig = (prioridade) => {
  const p = String(prioridade || 'Média').toLowerCase();
  if (p === 'crítica' || p === 'critica') {
    return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: '#ef4444', slaHours: 4, label: 'Crítica (Emergência - SLA 4h)' };
  }
  if (p === 'alta') {
    return { color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)', border: '#f97316', slaHours: 12, label: 'Alta (Urgente - SLA 12h)' };
  }
  if (p === 'baixa') {
    return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: '#38bdf8', slaHours: 48, label: 'Baixa (Dúvida/Melhoria - SLA 48h)' };
  }
  return { color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)', border: '#eab308', slaHours: 24, label: 'Média (Padrão - SLA 24h)' };
};

const isChamadoRecente = (dataCriacao) => {
  if (!dataCriacao) return false;
  const diffMinutos = (Date.now() - new Date(dataCriacao).getTime()) / (1000 * 60);
  return diffMinutos <= 120; 
};

const calcularSLA = (prioridade, dataCriacao, status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'concluído' || s === 'resolvido' || s === 'fechado' || s === 'respondido') {
    return { percent: 100, text: 'SLA Cumprido', color: 'var(--success)' };
  }
  
  const config = getPriorityConfig(prioridade);
  const horasMeta = config.slaHours;
  const criadoMs = new Date(dataCriacao || Date.now()).getTime();
  const limiteSLA = criadoMs + (horasMeta * 60 * 60 * 1000);
  const agora = Date.now();
  
  if (agora > limiteSLA) {
    return { percent: 100, text: 'SLA Expirado', color: 'var(--danger)' };
  }
  
  const restamMs = limiteSLA - agora;
  const restamHoras = Math.floor(restamMs / (1000 * 60 * 60));
  const restamMins = Math.floor((restamMs % (1000 * 60 * 60)) / (1000 * 60));
  const elapsedPercent = Math.max(0, Math.min(100, ((agora - criadoMs) / (horasMeta * 60 * 60 * 1000)) * 100));

  return { 
    percent: elapsedPercent, 
    text: `Restam ${restamHoras}h ${restamMins}m`, 
    color: elapsedPercent > 80 ? 'var(--danger)' : elapsedPercent > 50 ? 'var(--warning)' : 'var(--success)' 
  };
};

const SupportTicketCard = memo(({ ticket, selected, onClick }) => {
  const pConfig = getPriorityConfig(ticket.prioridade);
  const recente = isChamadoRecente(ticket.criado_em);
  const slaInfo = calcularSLA(ticket.prioridade, ticket.criado_em, ticket.status);

  return (
    <button 
      className={`support-flow-ticket ${selected ? 'selected' : ''}`} 
      onClick={() => onClick(ticket)} 
      type="button"
      style={{
        borderLeft: `4px solid ${pConfig.border}`,
        background: selected ? pConfig.bg : 'var(--card-bg)'
      }}
    >
      <div className="support-flow-ticket-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className={`support-flow-status ${statusClass(ticket.status)}`}>{ticket.status || 'Aberto'}</span>
          {recente && (
            <span style={{ fontSize: '0.65rem', fontWeight: '800', background: '#a855f7', color: '#fff', padding: '2px 8px', borderRadius: '99px', display: 'inline-flex', alignItems: 'center', gap: '3px', boxShadow: '0 0 10px rgba(168, 85, 247, 0.6)' }}>
              ✨ NOVO
            </span>
          )}
          <h3>#{ticket.id} - {ticket.titulo}</h3>
        </div>
        <span 
          className={`support-flow-priority`} 
          style={{ background: pConfig.bg, color: pConfig.color, border: `1px solid ${pConfig.border}`, fontWeight: '800' }}
        >
          {ticket.prioridade || 'Média'}
        </span>
      </div>
      <p className="support-flow-ticket-desc">{ticket.descricao}</p>
      <div className="support-flow-ticket-meta">
        <span><User size={14} /> {ticket.solicitante || 'Usuário'}</span>
        <span><Clock3 size={14} /> {formatDate(ticket.criado_em)}</span>
        <span><BookOpen size={14} /> {ticket.categoria || 'Geral'}</span>
        
        <span style={{ color: slaInfo.color, fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
          <Hourglass size={13} /> {slaInfo.text}
        </span>
      </div>
      {ticket.resposta ? (
        <div className="support-flow-response-preview"><BadgeCheck size={14} /> {ticket.resposta}</div>
      ) : (
        <div className="support-flow-response-empty"><AlertTriangle size={14} /> Aguardando retorno do suporte.</div>
      )}
    </button>
  );
});

const SupportQueueCard = memo(({ ticket, selected, onClick }) => {
  const pConfig = getPriorityConfig(ticket.prioridade);
  const recente = isChamadoRecente(ticket.criado_em);
  const slaInfo = calcularSLA(ticket.prioridade, ticket.criado_em, ticket.status);

  return (
    <button 
      className={`support-flow-ticket ${selected ? 'selected' : ''}`} 
      onClick={() => onClick(ticket)} 
      type="button"
      style={{
        borderLeft: `4px solid ${pConfig.border}`,
        background: selected ? pConfig.bg : 'var(--card-bg)'
      }}
    >
      <div className="support-flow-ticket-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className={`support-flow-status ${statusClass(ticket.status)}`}>{ticket.status || 'Aberto'}</span>
          {recente && (
            <span style={{ fontSize: '0.65rem', fontWeight: '800', background: '#a855f7', color: '#fff', padding: '2px 8px', borderRadius: '99px', display: 'inline-flex', alignItems: 'center', gap: '3px', boxShadow: '0 0 10px rgba(168, 85, 247, 0.6)' }}>
              ✨ NOVO
            </span>
          )}
          <h3>#{ticket.id} - {ticket.titulo}</h3>
        </div>
        <span 
          className={`support-flow-priority`} 
          style={{ background: pConfig.bg, color: pConfig.color, border: `1px solid ${pConfig.border}`, fontWeight: '800' }}
        >
          {ticket.prioridade || 'Média'}
        </span>
      </div>
      <p className="support-flow-ticket-desc">{ticket.descricao}</p>
      <div className="support-flow-ticket-meta">
        <span><User size={14} /> {ticket.solicitante || 'Usuário'}</span>
        <span><Clock3 size={14} /> {formatDate(ticket.criado_em)}</span>
        <span><ShieldCheck size={14} /> {ticket.categoria || 'Geral'}</span>
        
        <span style={{ color: slaInfo.color, fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
          <Hourglass size={13} /> {slaInfo.text}
        </span>
      </div>
      {ticket.resposta ? (
        <div className="support-flow-response-preview"><BadgeCheck size={14} /> {ticket.resposta}</div>
      ) : (
        <div className="support-flow-response-empty"><AlertTriangle size={14} /> Ticket aguardando análise NOC.</div>
      )}
    </button>
  );
});

/**
 * Módulo de Suporte (Entrada)
 *
 * Responsabilidades:
 * - Gerenciar criação e atendimento de chamados
 * - Fornecer triagem, acompanhamento e integração com notificações
 * - Otimizar fluxo com filtros, prioridade e SLA visual
 */
export default function Suporte({ api, socket, userRole, nomeLogado, userFilial, showToast, isOffline, onNavigate }) {
  const isDev = userRole === 'DEV';
  const [modoVisao, setModoVisao] = useState(isDev ? 'triagem' : 'acompanhamento');

  const [alertaNovoChamado, setAlertaNovoChamado] = useState(null);

  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalAjudaOpen, setModalAjudaOpen] = useState(false);
  const [formNovo, setFormNovo] = useState({ 
    titulo: '', 
    categoria: 'Geral', 
    prioridade: 'Média', 
    equipamento: '', 
    descricao: '' 
  });
  const [enviando, setEnviando] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroPrioridade, setFiltroPrioridade] = useState('Todas');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [selecionado, setSelecionado] = useState(null);
  const [historico, setHistorico] = useState([]);

  const [resposta, setResposta] = useState('');
  const [statusAtual, setStatusAtual] = useState('Em análise');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [copiadoId, setCopiadoId] = useState(false);

  const carregarTickets = useCallback(async (silencioso = false) => {
    if (!api || isOffline) return;
    try {
      if (!silencioso) setLoading(true);
      const res = await api.get('/suporte/chamados');
      setTickets(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      if (!silencioso) showToast?.('Erro ao carregar chamados de suporte.', 'error');
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [api, isOffline, showToast]);

  const carregarTicketsRef = useRef(carregarTickets);
  useEffect(() => { carregarTicketsRef.current = carregarTickets; }, [carregarTickets]);

  useEffect(() => { carregarTickets(false); }, [carregarTickets]);

  useEffect(() => {
    if (!socket) return undefined;
    
    const handleNovoChamado = (novoTicket) => {
      // SÓ MOSTRA O BANNER SE QUEM ESTIVER NA TELA FOR TÉCNICO DEV (NOC)
      if (isDev && novoTicket && String(novoTicket.status || 'Aberto').toLowerCase() === 'aberto') {
        setAlertaNovoChamado(novoTicket);
        showToast?.(`Novo chamado #${novoTicket.id} aberto por ${novoTicket.solicitante}!`, 'info');
      }
      carregarTicketsRef.current(true);
    };

    const handleUpdateSilencioso = () => {
      carregarTicketsRef.current(true);
    };

    socket.on('novo_chamado_suporte', handleNovoChamado);
    socket.on('resposta_suporte', handleUpdateSilencioso);
    socket.on('atualizacao_dados', handleUpdateSilencioso);

    return () => {
      socket.off('novo_chamado_suporte', handleNovoChamado);
      socket.off('resposta_suporte', handleUpdateSilencioso);
      socket.off('atualizacao_dados', handleUpdateSilencioso);
    };
  }, [socket, showToast, isDev]);

  const ticketsVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return (tickets || [])
      .filter((ticket) => {
        const s = String(ticket.status || '').toLowerCase();
        if (filtroStatus !== 'Todos') {
          if (filtroStatus === 'Concluído') {
            if (!['concluído', 'resolvido', 'fechado'].includes(s)) return false;
          } else if (filtroStatus === 'Em análise') {
            if (!['em análise', 'em atendimento'].includes(s)) return false;
          } else if (s !== filtroStatus.toLowerCase()) {
            return false;
          }
        }
        if (filtroPrioridade !== 'Todas' && ticket.prioridade !== filtroPrioridade) return false;
        if (filtroCategoria !== 'Todas' && ticket.categoria !== filtroCategoria) return false;
        
        if (termo) {
          const texto = `${ticket.titulo} ${ticket.descricao} ${ticket.solicitante} ${ticket.categoria} ${ticket.resposta || ''} ${ticket.empresa || ''} ${ticket.filial || ''}`.toLowerCase();
          if (!texto.includes(termo)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        return new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime();
      });
  }, [tickets, busca, filtroStatus, filtroPrioridade, filtroCategoria]);

  const resumo = useMemo(() => {
    const abertos = ticketsVisiveis.filter((t) => t.status === 'Aberto').length;
    const analise = ticketsVisiveis.filter((t) => ['Em análise', 'Em Atendimento'].includes(t.status)).length;
    const respondidos = ticketsVisiveis.filter((t) => ['Respondido', 'Concluído', 'Resolvido', 'Fechado'].includes(t.status)).length;
    const criticos = ticketsVisiveis.filter((t) => t.prioridade === 'Crítica').length;
    return { abertos, analise, respondidos, criticos };
  }, [ticketsVisiveis]);

  useEffect(() => {
    if (!selecionado && ticketsVisiveis.length > 0) {
      setSelecionado(ticketsVisiveis[0]);
      setResposta(ticketsVisiveis[0].resposta || '');
      setStatusAtual(ticketsVisiveis[0].status || 'Em análise');
    }
    if (selecionado && !ticketsVisiveis.some((t) => t.id === selecionado.id)) {
      const next = ticketsVisiveis[0] || null;
      setSelecionado(next);
      setResposta(next?.resposta || '');
      setStatusAtual(next?.status || 'Em análise');
    }
  }, [ticketsVisiveis, selecionado]);

  useEffect(() => {
    const carregarHistorico = async () => {
      if (!api || isOffline || !selecionado?.id) { setHistorico([]); return; }
      try {
        const res = await api.get(`/suporte/chamados/${selecionado.id}/historico`);
        setHistorico(Array.isArray(res.data) ? res.data : []);
      } catch (error) { setHistorico([]); }
    };
    carregarHistorico();
  }, [api, isOffline, selecionado?.id]);

  const handleCriarChamado = async (e) => {
    e.preventDefault();
    if (isOffline) return showToast?.('Ação bloqueada. Sem rede.', 'error');
    if (!formNovo.titulo || !formNovo.descricao) return showToast?.('Preencha o título e a descrição.', 'warning');

    setEnviando(true);
    try {
      const descCompleta = formNovo.equipamento 
        ? `[Ativo / Setor Impactado: ${formNovo.equipamento}]\n\n${formNovo.descricao}`
        : formNovo.descricao;

      await api.post('/suporte/chamados', {
        titulo: formNovo.titulo,
        categoria: formNovo.categoria,
        prioridade: formNovo.prioridade,
        descricao: descCompleta,
        solicitante: nomeLogado
      });

      showToast?.('Chamado submetido com sucesso! Posição #1 na fila.', 'success');
      setModalNovoAberto(false);
      setFormNovo({ titulo: '', categoria: 'Geral', prioridade: 'Média', equipamento: '', descricao: '' });
      carregarTickets(true);
    } catch (error) {
      showToast?.('Falha ao abrir chamado de suporte.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const salvarRespostaDev = async (statusOverride = null) => {
    if (!selecionado) return;
    if (isOffline) return showToast?.('Sem conexão com o servidor.', 'warning');
    
    const targetStatus = statusOverride || statusAtual;
    setIsSaving(true);
    try {
      await api.put(`/suporte/chamados/${selecionado.id}`, { 
        status: targetStatus, 
        resposta, 
        responsavel: nomeLogado || 'Equipe NOC' 
      });
      showToast?.(`Ticket #${selecionado.id} atualizado para "${targetStatus}"!`, 'success');
      await carregarTickets(true);
      setSelecionado((prev) => prev ? { ...prev, status: targetStatus, resposta } : prev);
      setStatusAtual(targetStatus);
    } catch (error) {
      showToast?.('Falha ao gravar resposta.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const gerarRespostaComIA = () => {
    if (!selecionado) return;
    setIsGeneratingAI(true);
    showToast?.('Analisando telemetria e gerando parecer tático...', 'info');
    
    setTimeout(() => {
      const respostaIA = `Olá, ${selecionado.solicitante}.\n\nA nossa equipa de Engenharia (NOC) analisou o incidente referente à categoria "${selecionado.categoria}". Através da telemetria da unidade [${selecionado.filial || 'Matriz'}], inspecionamos o relato "${selecionado.titulo}" e aplicamos os ajustes remotos necessários na controladora.\n\nO ambiente deverá ser estabilizado no próximo ciclo de comunicação. Se o sintoma persistir, por favor interaja neste protocolo.\n\nAtentamente,\nEquipe de Engenharia ThermoSync.`;
      setResposta(respostaIA);
      setStatusAtual('Respondido');
      setIsGeneratingAI(false);
      showToast?.('Resposta rascunhada pelo Copilot AI.', 'success');
    }, 1800);
  };

  const copiarProtocolo = (id) => {
    navigator.clipboard.writeText(`PROTOCOLO-#${id}`);
    setCopiadoId(true);
    showToast?.(`Protocolo #${id} copiado para a área de transferência!`, 'info');
    setTimeout(() => setCopiadoId(false), 2000);
  };

  const detalheSelecionado = selecionado || ticketsVisiveis[0] || null;
  const currentSLA = detalheSelecionado ? calcularSLA(detalheSelecionado.prioridade, detalheSelecionado.criado_em, detalheSelecionado.status) : null;
  const sNovoPrioridadeConfig = getPriorityConfig(formNovo.prioridade);

  return (
    <div className="support-flow-shell anim-fade-in">
      
      {/* BANNER INTERNO: SOMENTE PERFIS DEV RECONHECEM E VEEM ESTE AVISO */}
      {alertaNovoChamado && (
        <div className="support-dev-alert anim-fade-in" role="alert">
          <div className="support-dev-alert-icon">
            <AlertTriangle size={24} />
          </div>
          <div className="support-dev-alert-copy">
            <strong>Novo chamado #{alertaNovoChamado.id} aberto no suporte!</strong>
            <span>
              <strong>{alertaNovoChamado.solicitante}</strong> ({alertaNovoChamado.filial || alertaNovoChamado.empresa || 'Unidade'}) abriu um ticket com prioridade <strong>{alertaNovoChamado.prioridade}</strong>: "{alertaNovoChamado.titulo}"
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 1 }}>
            <span className="support-dev-alert-badge">
              {alertaNovoChamado.categoria || 'Geral'}
            </span>
            <button
              type="button"
              onClick={() => setAlertaNovoChamado(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Fechar notificação"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* HERO / BANNER SUPERIOR */}
      {modoVisao === 'triagem' ? (
        <section className="support-flow-hero support-flow-hero-triagem">
          <div>
            <span className="support-flow-kicker"><Terminal size={14} /> Triagem Operacional NOC</span>
            <h1>Fila interna para análise dos tickets do sistema</h1>
            <p>Organize os chamados por prioridade e tempo, emita pareceres técnicos e mantenha a telemetria da rede SaaS supervisionada.</p>
            <div className="support-flow-actions">
              <button className="btn btn-outline" type="button" onClick={() => setModoVisao('acompanhamento')}>
                <MessageSquare size={16} /> Ver visão do usuário
              </button>
              <button className="btn btn-outline" type="button" onClick={() => onNavigate?.('dev_panel')}>
                <Sparkles size={16} /> Ir para o Painel DEV
              </button>
            </div>
          </div>
          <div className="support-flow-stats">
            <div className="support-flow-stat"><strong>{ticketsVisiveis.length}</strong><span>Tickets filtrados</span></div>
            <div className="support-flow-stat"><strong>{resumo.abertos + resumo.analise}</strong><span>Em atendimento</span></div>
            <div className="support-flow-stat"><strong>{resumo.criticos}</strong><span>Prioridade crítica</span></div>
            <div className="support-flow-stat"><strong>ROOT</strong><span>Visão de Engenharia</span></div>
          </div>
        </section>
      ) : (
        <section className="support-flow-hero support-flow-hero-acompanhamento">
          <div>
            <span className="support-flow-kicker"><LifeBuoy size={14} /> Acompanhamento de Suporte</span>
            <h1>Histórico e retorno dos chamados do sistema</h1>
            <p>Acompanhe o andamento das suas solicitações em tempo real, visualize a resposta da Engenharia e valide o tempo de SLA.</p>
            <div className="support-flow-actions">
              <button className="btn btn-primary" type="button" onClick={() => setModalNovoAberto(true)}>
                <PlusCircle size={16} /> Abrir novo chamado
              </button>
              <button 
                onClick={() => setModalAjudaOpen(true)} 
                className="btn btn-outline"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <BookOpen size={16} /> Base de Ajuda & FAQ
              </button>
              {isDev && (
                <button className="btn btn-outline" type="button" onClick={() => setModoVisao('triagem')}>
                  <Terminal size={16} /> Voltar para Triagem NOC
                </button>
              )}
            </div>
          </div>
          <div className="support-flow-stats">
            <div className="support-flow-stat"><strong>{ticketsVisiveis.length}</strong><span>Chamados na lista</span></div>
            <div className="support-flow-stat"><strong>{resumo.abertos + resumo.analise}</strong><span>Em atendimento</span></div>
            <div className="support-flow-stat"><strong>{resumo.respondidos}</strong><span>Resolvidos / Ok</span></div>
            <div className="support-flow-stat"><strong>{isDev ? 'DEV' : 'CLIENTE'}</strong><span>Perfil ativo</span></div>
          </div>
        </section>
      )}

      {/* BARRA DE PESQUISA E FILTRO DE STATUS */}
      <div className="support-flow-toolbar">
        <div className="support-flow-search">
          <Search size={18} />
          <input 
            value={busca} 
            onChange={(e) => setBusca(e.target.value)} 
            placeholder="Buscar por protocolo, título, relato, filial ou resposta..." 
          />
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

      {/* SUB-FILTROS DE PRIORIDADE E CATEGORIA (TRIAGEM NOC) */}
      {modoVisao === 'triagem' && (
        <div className="support-flow-toolbar support-flow-toolbar-secondary" style={{ gap: '0.8rem' }}>
          <div className="support-flow-filters">
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px' }}>Prioridade:</span>
            {PRIORITY_OPTIONS.map((prioridade) => (
              <button 
                key={prioridade} 
                type="button" 
                className={`support-flow-filter ${filtroPrioridade === prioridade ? 'active' : ''}`} 
                onClick={() => setFiltroPrioridade(prioridade)}
              >
                {prioridade}
              </button>
            ))}
          </div>

          <div className="support-flow-filters">
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px' }}>Categoria:</span>
            {CATEGORY_OPTIONS.map((cat) => (
              <button 
                key={cat} 
                type="button" 
                className={`support-flow-filter ${filtroCategoria === cat ? 'active' : ''}`} 
                onClick={() => setFiltroCategoria(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PAINEL DE CONTEÚDO PRINCIPAL */}
      <section className="support-flow-grid">
        
        {/* COLUNA ESQUERDA: LISTA DE TICKETS (#1 RECENTE NO TOPO) */}
        <div className="support-flow-panel">
          <div className="support-flow-panel-head">
            <div>
              <span className="panel-icon"><BookOpen size={18} /></span>
              <h2>{modoVisao === 'triagem' ? 'Fila operacional NOC' : 'Chamados e Histórico'}</h2>
            </div>
            <span className="panel-badge">{ticketsVisiveis.length} registros</span>
          </div>

          <div className="support-flow-list">
            {loading ? (
              <div className="support-flow-empty">
                <Loader2 size={36} className="spin" style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                <p>Sincronizando base de tickets...</p>
              </div>
            ) : ticketsVisiveis.length === 0 ? (
              <div className="support-flow-empty">
                <ShieldCheck size={42} />
                <h3>Nenhum chamado na lista</h3>
                <p>Nenhum ticket encontrado com o filtro atual no sistema.</p>
              </div>
            ) : (
              ticketsVisiveis.map((t) => (
                modoVisao === 'triagem' ? (
                  <SupportQueueCard 
                    key={t.id} 
                    ticket={t} 
                    selected={detalheSelecionado?.id === t.id} 
                    onClick={() => { setSelecionado(t); setResposta(t.resposta || ''); setStatusAtual(t.status || 'Em análise'); }} 
                  />
                ) : (
                  <SupportTicketCard 
                    key={t.id} 
                    ticket={t} 
                    selected={detalheSelecionado?.id === t.id} 
                    onClick={() => { setSelecionado(t); setResposta(t.resposta || ''); setStatusAtual(t.status || 'Em análise'); }} 
                  />
                )
              ))
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: DETALHAMENTO, SLA, 1-CLICK TRIAGE E AUDITORIA */}
        <div className="support-flow-side">
          {detalheSelecionado ? (
            <div className="support-flow-detail">
              <div className="support-flow-detail-head">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className={`support-flow-status ${statusClass(detalheSelecionado.status)}`}>{detalheSelecionado.status || 'Aberto'}</span>
                    <button 
                      onClick={() => copiarProtocolo(detalheSelecionado.id)} 
                      title="Copiar Número de Protocolo"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '6px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      {copiadoId ? <Check size={12} color="#10b981" /> : <Copy size={12} />} #{detalheSelecionado.id}
                    </button>
                  </div>
                  <h3 style={{ color: 'white' }}>{detalheSelecionado.titulo}</h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`support-flow-priority priority-${String(detalheSelecionado.prioridade || 'Média').toLowerCase().replace('í', 'i').replace('é', 'e')}`}>
                    {detalheSelecionado.prioridade || 'Média'}
                  </span>
                </div>
              </div>

              {/* AÇÕES RÁPIDAS DE TRIAGEM NOC (1-CLICK TRIAGE) */}
              {modoVisao === 'triagem' && isDev && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <button 
                    type="button"
                    onClick={() => salvarRespostaDev('Em análise')}
                    disabled={isSaving || detalheSelecionado.status === 'Em análise'}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}
                  >
                    <Play size={13} /> Iniciar Análise
                  </button>

                  <button 
                    type="button"
                    onClick={() => salvarRespostaDev('Concluído')}
                    disabled={isSaving || detalheSelecionado.status === 'Concluído'}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}
                  >
                    <CheckCheck size={14} /> Concluir Ticket
                  </button>
                </div>
              )}

              {/* BARRA DE PROGRESSO DE SLA (SLA EM TEMPO REAL) */}
              {currentSLA && (
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '8px', color: currentSLA.color, textTransform: 'uppercase' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Hourglass size={14} /> Acordo de Nível de Serviço (SLA)</span>
                    <span>{currentSLA.text}</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ width: `${currentSLA.percent}%`, height: '100%', background: currentSLA.color, transition: 'width 1s ease' }}></div>
                  </div>
                </div>
              )}

              <div className="support-flow-detail-meta">
                <span><User size={14} /> {detalheSelecionado.solicitante || 'Usuário'}</span>
                <span><Clock3 size={14} /> {formatDate(detalheSelecionado.criado_em)}</span>
                <span><ShieldCheck size={14} /> {detalheSelecionado.categoria || 'Geral'}</span>
              </div>

              <p className="support-flow-detail-text" style={{ padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', borderLeft: '3px solid var(--border)', margin: 0, whiteSpace: 'pre-wrap' }}>
                {detalheSelecionado.descricao}
              </p>

              {/* RETORNO OFICIAL DA ENGENHARIA (VISÃO DO USUÁRIO) */}
              {modoVisao === 'acompanhamento' && (
                <div className="support-flow-note-box">
                  <strong style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={16} color="#10b981" /> Retorno Oficial da Engenharia
                  </strong>
                  <p style={{ color: detalheSelecionado.resposta ? 'var(--success)' : 'var(--text-muted)', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                    {detalheSelecionado.resposta || 'Ainda não houve parecer registrado pelo NOC para este ticket.'}
                  </p>
                  {detalheSelecionado.responsavel && detalheSelecionado.resposta && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem', color: '#64748b' }}>
                      Responsável: {detalheSelecionado.responsavel}
                    </div>
                  )}
                </div>
              )}

              {/* AUDITORIA / LINHA DO TEMPO */}
              {historico.length > 0 && (
                <div className="support-flow-note-box muted">
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                    <History size={14} /> Linha do tempo do chamado
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', maxHeight: '140px', overflowY: 'auto' }}>
                    {historico.map((h, i) => (
                      <div key={i} style={{ fontSize: '0.8rem', borderLeft: '2px solid var(--primary)', paddingLeft: '8px', color: 'var(--text-muted)' }}>
                        <div style={{ fontWeight: 'bold', color: '#cbd5e1' }}>{h.autor || 'Sistema'} ({h.evento})</div>
                        <div>{h.mensagem}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EDITOR NOC (VISÃO DO DESENVOLVEDOR NA TRIAGEM) */}
              {modoVisao === 'triagem' && isDev && (
                <div className="support-flow-editor" style={{ marginTop: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0 }}>Parecer Operacional NOC</label>
                    <button 
                      type="button" 
                      onClick={gerarRespostaComIA} 
                      disabled={isGeneratingAI} 
                      style={{ background: 'linear-gradient(90deg, #a855f7, #3b82f6)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    >
                      {isGeneratingAI ? <Loader2 size={14} className="spin" /> : <Bot size={14} />}
                      {isGeneratingAI ? 'Analisando...' : 'Copilot AI'}
                    </button>
                  </div>
                  <textarea 
                    rows={6} 
                    value={resposta} 
                    onChange={(e) => setResposta(e.target.value)} 
                    placeholder="Redija a instrução técnica ou solução para o cliente..." 
                    style={{ background: 'rgba(0,0,0,0.4)', color: 'white' }} 
                  />
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
                    <select value={statusAtual} onChange={(e) => setStatusAtual(e.target.value)} style={{ flex: 1 }}>
                      {['Aberto', 'Em análise', 'Respondido', 'Concluído'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button 
                      className="btn btn-primary" 
                      type="button" 
                      onClick={() => salvarRespostaDev()} 
                      disabled={isSaving} 
                      style={{ flex: 2, padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      {isSaving ? <Loader2 size={16} className="spin" /> : <Send size={16} />} Gravar Parecer
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="support-flow-detail support-flow-detail-empty">
              <Terminal size={42} />
              <h3>Nenhum ticket selecionado</h3>
              <p>Escolha um item da fila à esquerda para inspecionar os detalhes e o contexto da solicitação.</p>
            </div>
          )}
        </div>

      </section>

      {/* ===================================================================== */}
      {/* MODAL PROFISSIONAL E DETALHADO DE ABERTURA DE CHAMADO (SLA & TRIAGEM) */}
      {/* ===================================================================== */}
      {modalNovoAberto && (
        <div className="modal-overlay" onClick={() => setModalNovoAberto(false)}>
          <div 
            className="modal-content anim-slide-up" 
            onClick={(e) => e.stopPropagation()} 
            style={{ maxWidth: '600px', width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '1.8rem', boxShadow: '0 25px 80px rgba(0,0,0,0.7)' }}
          >
            
            {/* CABEÇALHO DO MODAL */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                  <LifeBuoy size={14} /> Atendimento Tático TermoSync
                </span>
                <h3 style={{ margin: 0, color: 'white', fontSize: '1.25rem' }}>Abrir Chamado de Suporte</h3>
              </div>
              <button onClick={() => setModalNovoAberto(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            {/* BANNER DE CONTEXTO DO TENANT & SLA EM TEMPO REAL */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px', borderRadius: '12px', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Unidade / Tenant</span>
                <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                  <Building2 size={15} color="var(--primary)" /> {userFilial || 'Sede Principal'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Meta de SLA Prevista</span>
                <div style={{ color: sNovoPrioridadeConfig.color, fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', marginTop: '3px' }}>
                  <Clock3 size={15} /> Máx. {sNovoPrioridadeConfig.slaHours} horas
                </div>
              </div>
            </div>

            <form onSubmit={handleCriarChamado} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* TÍTULO DO CHAMADO */}
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                  Título / Assunto Principal <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Ex: Falha na leitura do sensor da Câmara 02" 
                  required 
                  value={formNovo.titulo}
                  onChange={(e) => setFormNovo({ ...formNovo, titulo: e.target.value })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', padding: '12px', borderRadius: '10px', color: 'white', fontSize: '0.9rem' }}
                />
              </div>

              {/* GRID CATEGORIA E PRIORIDADE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                    Categoria do Suporte <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select 
                    value={formNovo.categoria}
                    onChange={(e) => setFormNovo({ ...formNovo, categoria: e.target.value })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', padding: '12px', borderRadius: '10px', color: 'white', fontSize: '0.85rem', fontWeight: '600' }}
                  >
                    <option value="Geral">Geral / Dúvida Operacional</option>
                    <option value="Técnico">Problema Técnico (IoT/Painel)</option>
                    <option value="Financeiro">Financeiro / Licença SaaS</option>
                    <option value="Sugestão">Sugestão de Melhoria</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                    Nível de Prioridade <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select 
                    value={formNovo.prioridade}
                    onChange={(e) => setFormNovo({ ...formNovo, prioridade: e.target.value })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: `1px solid ${sNovoPrioridadeConfig.color}`, padding: '12px', borderRadius: '10px', color: 'white', fontSize: '0.85rem', fontWeight: '700' }}
                  >
                    <option value="Baixa">Baixa (Dúvida/Melhoria - 48h)</option>
                    <option value="Média">Média (Padrão - 24h)</option>
                    <option value="Alta">Alta (Urgente - 12h)</option>
                    <option value="Crítica">Crítica (Emergência - 4h)</option>
                  </select>
                </div>
              </div>

              {/* EQUIPAMENTO / SETOR IMPACTADO */}
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                  <Server size={14} color="#38bdf8" /> Equipamento ou Setor Impactado <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'normal' }}>(Opcional)</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Ex: Balcão Laticínios / Sensor A4:CF:12..." 
                  value={formNovo.equipamento}
                  onChange={(e) => setFormNovo({ ...formNovo, equipamento: e.target.value })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', padding: '12px', borderRadius: '10px', color: 'white', fontSize: '0.85rem' }}
                />
              </div>

              {/* DESCRIÇÃO DETALHADA */}
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                  Relato do Problema ou Ocorrência <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea 
                  rows="4" 
                  placeholder="Descreva a falha informando:&#10;1. Códigos de erro apresentados no painel&#10;2. Horário em que a anomalia iniciou&#10;3. Comportamento físico da câmara ou motor" 
                  required 
                  value={formNovo.descricao}
                  onChange={(e) => setFormNovo({ ...formNovo, descricao: e.target.value })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', padding: '12px', borderRadius: '10px', color: 'white', fontSize: '0.85rem', lineHeight: '1.5' }}
                />
              </div>

              {/* DICA DE SLA E PROTOCOLO */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(14, 165, 233, 0.08)', borderLeft: '3px solid #0ea5e9', padding: '10px 12px', borderRadius: '8px', fontSize: '0.75rem', color: '#cbd5e1' }}>
                <HelpCircle size={18} color="#0ea5e9" style={{ flexShrink: 0 }} />
                <span>
                  O protocolo será adicionado em <strong>#1 na fila</strong> de atendimento. Uma notificação aparecerá assim que a Engenharia responder.
                </span>
              </div>

              {/* BOTÕES DE AÇÃO DO MODAL */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => setModalNovoAberto(false)}
                  style={{ padding: '10px 18px', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={enviando}
                  style={{ padding: '10px 22px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {enviando ? <Loader2 size={16} className="spin" /> : <Send size={16} />} 
                  Submeter Chamado
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL DA CENTRAL DE AJUDA & FAQ */}
      <CentralAjudaModal 
        isOpen={modalAjudaOpen} 
        onClose={() => setModalAjudaOpen(false)} 
        api={api} 
      />

    </div>
  );
}