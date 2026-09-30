/**
 * Módulo: frontend/src/pages/Suporte/Suporte.jsx
 * Responsabilidade: Implementa a tela Suporte, seus estados, interações e integrações de dados.
 */

import { ArrowUpDown, RefreshCw, WifiOff } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  LifeBuoy, PlusCircle, Clock3, AlertTriangle,
  MessageSquare, User, Building2, ShieldCheck, X, Send,
  History, Loader2, Filter,
  Search, Sparkles, Terminal, BookOpen,
  BadgeCheck, Hourglass,
  HelpCircle, Server, Copy, Check, Play, CheckCheck
} from 'lucide-react';
import './Suporte.css';
import './SuporteTelas.css';
import CentralAjudaModal from '../../components/CentralAjudaModal';

const STATUS_OPTIONS = ['Todos', 'Aberto', 'Em análise', 'Respondido', 'Concluído'];
const PRIORITY_OPTIONS = ['Todas', 'Baixa', 'Média', 'Alta', 'Crítica'];
const CATEGORY_OPTIONS = ['Todas', 'Geral', 'Técnico', 'Financeiro', 'Sugestão'];

/**
 * Concentra a logica de status class para manter o restante do tela mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} status - Valor de status consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const statusClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'concluído' || s === 'resolvido' || s === 'fechado') return 'status-concluido';
  if (s === 'em análise' || s === 'em atendimento') return 'status-analise';
  if (s === 'respondido') return 'status-respondido';
  return 'status-aberto';
};


/**
 * Formata format date para exibicao segura na interface.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatDate = (value) => {
  if (!value) return 'Data indisponível';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};


/**
 * Busca ou monta os dados de get priority config usados no fluxo atual.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} prioridade - Valor de prioridade consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const getPriorityConfig = (prioridade) => {
  const p = String(prioridade || 'Média').toLowerCase();
  if (p === 'crítica' || p === 'critica') {
    return { color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.12)', border: 'var(--danger)', slaHours: 4, label: 'Crítica (Emergência - SLA 4h)' };
  }
  if (p === 'alta') {
    return { color: 'var(--warning)', bg: 'rgba(249, 115, 22, 0.12)', border: 'var(--warning)', slaHours: 12, label: 'Alta (Urgente - SLA 12h)' };
  }
  if (p === 'baixa') {
    return { color: 'var(--info)', bg: 'rgba(56, 189, 248, 0.12)', border: 'var(--info)', slaHours: 48, label: 'Baixa (Dúvida/Melhoria - SLA 48h)' };
  }
  return { color: 'var(--warning)', bg: 'rgba(234, 179, 8, 0.12)', border: 'var(--warning)', slaHours: 24, label: 'Média (Padrão - SLA 24h)' };
};


/**
 * Verifica a condicao is chamado recente e retorna um valor booleano.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} dataCriacao - Valor de data criacao consumido por esta rotina.
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const isChamadoRecente = (dataCriacao) => {
  if (!dataCriacao) return false;
  /**
   * Concentra a logica de diff minutos para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} dataCriacao - Valor de data criacao consumido por esta rotina.
   * @param {unknown} status - Valor de status consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const diffMinutos = (Date.now() - new Date(dataCriacao).getTime()) / (1000 * 60);
  return diffMinutos <= 120; 
};


/**
 * Concentra a logica de calcular sla para manter o restante do tela mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} prioridade - Valor de prioridade consumido por esta rotina.
 * @param {unknown} dataCriacao - Valor de data criacao consumido por esta rotina.
 * @param {unknown} status - Valor de status consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const calcularSLA = (prioridade, dataCriacao, status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'concluído' || s === 'resolvido' || s === 'fechado' || s === 'respondido') {
    return { percent: 100, text: 'Atendimento encerrado', color: 'var(--success)' };
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
            <span style={{ fontSize: '0.65rem', fontWeight: '800', background: 'var(--accent-violet)', color: '#fff', padding: '2px 8px', borderRadius: '99px', display: 'inline-flex', alignItems: 'center', gap: '3px', boxShadow: '0 0 10px rgba(168, 85, 247, 0.6)' }}>
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
            <span style={{ fontSize: '0.65rem', fontWeight: '800', background: 'var(--accent-violet)', color: '#fff', padding: '2px 8px', borderRadius: '99px', display: 'inline-flex', alignItems: 'center', gap: '3px', boxShadow: '0 0 10px rgba(168, 85, 247, 0.6)' }}>
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
 * Módulo de Suporte (Entrada) Responsabilidades:
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; troca eventos em tempo real
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.nomeLogado - Propriedade nomeLogado usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userFilial - Propriedade userFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
  const [incluirContexto, setIncluirContexto] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroPrioridade, setFiltroPrioridade] = useState('Todas');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [ordenacao, setOrdenacao] = useState('sla');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [historico, setHistorico] = useState([]);

  const [resposta, setResposta] = useState('');
  const [statusAtual, setStatusAtual] = useState('Em análise');
  const [isSaving, setIsSaving] = useState(false);
  const [copiadoId, setCopiadoId] = useState(false);

  const carregarTickets = useCallback(async (silencioso = false) => {
    if (!api || isOffline) {
      if (!silencioso) setLoading(false);
      return;
    }
    try {
      if (!silencioso) setLoading(true);
      const res = await api.get('/suporte/chamados');
      setTickets(Array.isArray(res.data) ? res.data : []);
      setLastUpdated(new Date());
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
    

    /**
     * Processa a interacao de handle novo chamado e atualiza a interface conforme o resultado.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     *
     * Efeitos colaterais: atualiza estado reativo da interface
     *
     * @param {unknown} novoTicket - Valor de novo ticket consumido por esta rotina.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const handleNovoChamado = (novoTicket) => {
      // SÓ MOSTRA O BANNER SE QUEM ESTIVER NA TELA FOR TÉCNICO DEV (NOC)
      if (isDev && novoTicket && String(novoTicket.status || 'Aberto').toLowerCase() === 'aberto') {
        setAlertaNovoChamado(novoTicket);
        showToast?.(`Novo chamado #${novoTicket.id} aberto por ${novoTicket.solicitante}!`, 'info');
      }
      carregarTicketsRef.current(true);
    };


    /**
     * Processa a interacao de handle update silencioso e atualiza a interface conforme o resultado.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
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
        if (ordenacao === 'recentes') return new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime();
        if (ordenacao === 'prioridade') {
          const weight = { crítica: 4, critica: 4, alta: 3, média: 2, media: 2, baixa: 1 };
          return (weight[String(b.prioridade || '').toLowerCase()] || 0) - (weight[String(a.prioridade || '').toLowerCase()] || 0);
        }

        /**
         * Concentra a logica de deadline para manter o restante do tela mais legivel.
         *
         * Responsabilidade: mantém este comportamento isolado para que validação,
         * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
         *
         * Fluxo principal:
         * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
         *
         * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
         *
         * @param {unknown} ticket - Valor de ticket consumido por esta rotina.
         * @returns {unknown} Resultado calculado para consumo do chamador.
         * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
         */
        const deadline = (ticket) => new Date(ticket.criado_em || 0).getTime() + getPriorityConfig(ticket.prioridade).slaHours * 3600000;

        /**
         * Concentra a logica de closed para manter o restante do tela mais legivel.
         *
         * Responsabilidade: mantém este comportamento isolado para que validação,
         * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
         *
         * Fluxo principal:
         * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
         *
         * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
         *
         * @param {unknown} ticket - Valor de ticket consumido por esta rotina.
         * @returns {unknown} Resultado calculado para consumo do chamador.
         * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
         */
        const closed = (ticket) => ['respondido', 'concluído', 'resolvido', 'fechado'].includes(String(ticket.status || '').toLowerCase());
        if (closed(a) !== closed(b)) return closed(a) ? 1 : -1;
        return deadline(a) - deadline(b);
      });
  }, [tickets, busca, filtroStatus, filtroPrioridade, filtroCategoria, ordenacao]);

  const resumo = useMemo(() => {

    /**
     * Concentra a logica de status para manter o restante do tela mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @param {unknown} ticket - Valor de ticket consumido por esta rotina.
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const status = (ticket) => String(ticket.status || '').toLowerCase();
    const abertos = ticketsVisiveis.filter((ticket) => status(ticket) === 'aberto').length;
    const analise = ticketsVisiveis.filter((ticket) => ['em análise', 'em atendimento'].includes(status(ticket))).length;
    const respondidos = ticketsVisiveis.filter((ticket) => ['respondido', 'concluído', 'resolvido', 'fechado'].includes(status(ticket))).length;
    const criticos = ticketsVisiveis.filter((ticket) => ['crítica', 'critica'].includes(String(ticket.prioridade || '').toLowerCase())).length;
    const vencidos = ticketsVisiveis.filter((ticket) => calcularSLA(ticket.prioridade, ticket.criado_em, ticket.status).text === 'SLA Expirado').length;
    return { abertos, analise, respondidos, criticos, vencidos };
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

    /**
     * Concentra a logica de carregar historico para manter o restante do tela mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
     * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
     *
     * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
     *
     * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const carregarHistorico = async () => {
      if (!api || isOffline || !selecionado?.id) { setHistorico([]); return; }
      try {
        const res = await api.get(`/suporte/chamados/${selecionado.id}/historico`);
        setHistorico(Array.isArray(res.data) ? res.data : []);
      } catch (error) { setHistorico([]); }
    };
    carregarHistorico();
  }, [api, isOffline, selecionado?.id]);


  /**
   * Processa a interacao de handle criar chamado e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {Event} e - Evento que iniciou a interação ou mudança de estado.
   * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleCriarChamado = async (e) => {
    e.preventDefault();
    if (isOffline) return showToast?.('Ação bloqueada. Sem rede.', 'error');
    if (!formNovo.titulo || !formNovo.descricao) return showToast?.('Preencha o título e a descrição.', 'warning');

    setEnviando(true);
    try {
      const contexto = incluirContexto
        ? `[Contexto: perfil ${userRole || 'não informado'} | unidade ${userFilial || 'não informada'} | conexão ${isOffline ? 'offline' : 'online'}]\n`
        : '';
      const ativo = formNovo.equipamento ? `[Ativo / Setor Impactado: ${formNovo.equipamento}]\n` : '';
      const descCompleta = `${contexto}${ativo}\n${formNovo.descricao}`.trim();

      await api.post('/suporte/chamados', {
        titulo: formNovo.titulo,
        categoria: formNovo.categoria,
        prioridade: formNovo.prioridade,
        descricao: descCompleta,
        solicitante: nomeLogado
      });

      showToast?.('Chamado enviado e adicionado à fila de atendimento.', 'success');
      setModalNovoAberto(false);
      setFormNovo({ titulo: '', categoria: 'Geral', prioridade: 'Média', equipamento: '', descricao: '' });
      carregarTickets(true);
    } catch (error) {
      showToast?.('Falha ao abrir chamado de suporte.', 'error');
    } finally {
      setEnviando(false);
    }
  };


  /**
   * Concentra a logica de salvar resposta dev para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {unknown} statusOverride - Valor de status override consumido por esta rotina.
   * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
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

  /**
   * Preenche um modelo editavel sem afirmar que diagnosticos ou correcoes foram executados.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const aplicarModeloResposta = () => {
    if (!selecionado) return;
    const modelo = `Olá, ${selecionado.solicitante || 'usuário'}.\n\nRecebemos o chamado "${selecionado.titulo}" e iniciamos a triagem técnica da unidade ${selecionado.filial || 'informada'}.\n\nVerificações realizadas:\n- [descrever evidências consultadas]\n- [registrar resultado da telemetria ou serviço]\n\nOrientação / próximo passo:\n[descrever a ação recomendada e o critério de validação]\n\nAtenciosamente,\nEquipe de Engenharia ThermoSync.`;
    setResposta(modelo);
    setStatusAtual('Em análise');
    showToast?.('Modelo técnico inserido. Revise as evidências antes de enviar.', 'info');
  };


  /**
   * Processa a interacao de copiar protocolo e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
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
      {isOffline && (
        <div className="support-flow-connectivity" role="status">
          <WifiOff size={17} />
          <div><strong>Suporte em modo somente leitura</strong><span>A conexão com o servidor está indisponível. Abertura e atualização de chamados foram bloqueadas.</span></div>
        </div>
      )}
      
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
            <div className="support-flow-stat"><strong>{resumo.vencidos}</strong><span>SLA expirado</span></div>
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
            <div className="support-flow-stat"><strong>{resumo.vencidos}</strong><span>Fora do SLA</span></div>
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
        <div className="support-flow-tools">
          <label>
            <ArrowUpDown size={15} />
            <select value={ordenacao} onChange={(event) => setOrdenacao(event.target.value)} aria-label="Ordenar chamados">
              <option value="sla">SLA mais próximo</option>
              <option value="prioridade">Maior prioridade</option>
              <option value="recentes">Mais recentes</option>
            </select>
          </label>
          <button type="button" className="btn btn-outline" onClick={() => carregarTickets(false)} disabled={loading || isOffline} title={lastUpdated ? `Última atualização: ${formatDate(lastUpdated)}` : 'Atualizar chamados'}>
            {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Atualizar
          </button>
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
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', borderRadius: '6px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      {copiadoId ? <Check size={12} color="var(--success)" /> : <Copy size={12} />} #{detalheSelecionado.id}
                    </button>
                  </div>
                  <h3 style={{ color: 'var(--text-main)' }}>{detalheSelecionado.titulo}</h3>
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
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--info) 30%, transparent)', background: 'color-mix(in srgb, var(--info) 10%, transparent)', color: 'var(--info)', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}
                  >
                    <Play size={13} /> Iniciar Análise
                  </button>

                  <button 
                    type="button"
                    onClick={() => salvarRespostaDev('Concluído')}
                    disabled={isSaving || detalheSelecionado.status === 'Concluído'}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)', background: 'color-mix(in srgb, var(--success) 10%, transparent)', color: 'var(--success)', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}
                  >
                    <CheckCheck size={14} /> Concluir Ticket
                  </button>
                </div>
              )}

              {/* BARRA DE PROGRESSO DE SLA (SLA EM TEMPO REAL) */}
              {currentSLA && (
                <div style={{ background: 'color-mix(in srgb, var(--card-bg) 92%, var(--border))', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
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

              <p className="support-flow-detail-text" style={{ padding: '15px', background: 'color-mix(in srgb, var(--card-bg) 92%, var(--border))', borderRadius: '8px', borderLeft: '3px solid var(--border)', margin: 0, whiteSpace: 'pre-wrap' }}>
                {detalheSelecionado.descricao}
              </p>

              {/* RETORNO OFICIAL DA ENGENHARIA (VISÃO DO USUÁRIO) */}
              {modoVisao === 'acompanhamento' && (
                <div className="support-flow-note-box">
                  <strong style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={16} color="var(--success)" /> Retorno Oficial da Engenharia
                  </strong>
                  <p style={{ color: detalheSelecionado.resposta ? 'var(--success)' : 'var(--text-muted)', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                    {detalheSelecionado.resposta || 'Ainda não houve parecer registrado pelo NOC para este ticket.'}
                  </p>
                  {detalheSelecionado.responsavel && detalheSelecionado.resposta && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
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
                        <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{h.autor || 'Sistema'} ({h.evento})</div>
                        <div>{h.mensagem}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EDITOR NOC (VISÃO DO DESENVOLVEDOR NA TRIAGEM) */}
              {modoVisao === 'triagem' && isDev && (
                <div className="support-flow-editor" style={{ marginTop: 'auto' }}>
                  <div className="support-flow-editor-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0 }}>Parecer Operacional NOC</label>
                    <button 
                      type="button" 
                      onClick={aplicarModeloResposta}
                      style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    >
                      <Sparkles size={14} /> Modelo técnico
                    </button>
                  </div>
                  <textarea 
                    rows={6} 
                    value={resposta} 
                    onChange={(e) => setResposta(e.target.value)} 
                    placeholder="Redija a instrução técnica ou solução para o cliente..." 
                    style={{ background: 'color-mix(in srgb, var(--card-bg) 92%, var(--border))', color: 'var(--text-main)' }}
                  />
                  <div className="support-flow-editor-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
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
            className="modal-content anim-slide-up support-ticket-modal"
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
              <button onClick={() => setModalNovoAberto(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            {/* BANNER DE CONTEXTO DO TENANT & SLA EM TEMPO REAL */}
            <div className="support-ticket-context" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px', borderRadius: '12px', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Unidade / Tenant</span>
                <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                  <Building2 size={15} color="var(--primary)" /> {userFilial || 'Sede Principal'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Meta de SLA Prevista</span>
                <div style={{ color: sNovoPrioridadeConfig.color, fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', marginTop: '3px' }}>
                  <Clock3 size={15} /> Máx. {sNovoPrioridadeConfig.slaHours} horas
                </div>
              </div>
            </div>

            <form onSubmit={handleCriarChamado} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* TÍTULO DO CHAMADO */}
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                  Título / Assunto Principal <span style={{ color: 'var(--danger)' }}>*</span>
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
              <div className="support-ticket-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                    Categoria do Suporte <span style={{ color: 'var(--danger)' }}>*</span>
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
                    Nível de Prioridade <span style={{ color: 'var(--danger)' }}>*</span>
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
                  <Server size={14} color="var(--info)" /> Equipamento ou Setor Impactado <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Opcional)</span>
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
                  Relato do Problema ou Ocorrência <span style={{ color: 'var(--danger)' }}>*</span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(14, 165, 233, 0.08)', borderLeft: '3px solid var(--info)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.75rem', color: '#cbd5e1' }}>
                <HelpCircle size={18} color="var(--info)" style={{ flexShrink: 0 }} />
                <span>
                  O protocolo será adicionado à fila conforme prioridade e prazo de SLA. Uma notificação aparecerá quando houver retorno da Engenharia.
                </span>
              </div>

              <label className="support-context-option">
                <input type="checkbox" checked={incluirContexto} onChange={(event) => setIncluirContexto(event.target.checked)} />
                <span><strong>Incluir contexto técnico</strong><small>Adiciona perfil, unidade e estado da conexão ao relato para agilizar a triagem.</small></span>
              </label>

              {/* BOTÕES DE AÇÃO DO MODAL */}
              <div className="support-ticket-modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
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
