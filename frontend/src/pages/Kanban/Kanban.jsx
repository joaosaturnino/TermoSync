/**
 * Módulo: frontend/src/pages/Kanban/Kanban.jsx
 * Responsabilidade: Implementa a tela Kanban, seus estados, interações e integrações de dados.
 */

import usePersistentState from '../../hooks/usePersistentState';
import { TimerReset, UserRoundX } from 'lucide-react';
import React, { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { 
  Columns, Wrench, Clock, CheckCircle, ArrowRight, AlertTriangle, 
  Search, Calendar, MapPin, ActivitySquare, Server, Loader2, AlertOctagon
} from 'lucide-react';
import './Kanban.css';
import logger from '../../utils/logger';

const KANBAN_COLUMNS = [
  { id: 'Aberto', title: 'Novos / Triagem', icon: AlertTriangle, color: 'var(--danger)' },
  { id: 'Em Andamento', title: 'Intervenção (FSM)', icon: Wrench, color: 'var(--warning)' },
  { id: 'Aguardando Peça', title: 'Logística', icon: Clock, color: 'var(--info)' },
  { id: 'Concluído', title: 'Auditoria Fechada', icon: CheckCircle, color: 'var(--success)' }
];

const INITIAL_VISIBLE_BY_COLUMN = {
  Aberto: 50,
  'Em Andamento': 50,
  'Aguardando Peça': 50,
  Concluído: 24
};

const LOAD_MORE_STEP = 40;


/**
 * Busca ou monta os dados de get column id usados no fluxo atual.
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
const getColumnId = (status) => {
  const normalized = normalizeText(status);
  if (normalized === 'aberto' || normalized === 'pendente') return 'Aberto';
  if (normalized === 'em andamento' || normalized === 'em atendimento' || normalized === 'diagnostico') return 'Em Andamento';
  if (normalized === 'aguardando peca' || normalized === 'aguardando pecas') return 'Aguardando Peça';
  if (normalized.includes('conclu') || normalized === 'fechado') return 'Concluído';
  return 'Aberto';
};


/**
 * Normaliza normalize text para evitar divergencia de formato nas comparacoes.
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
const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();


/**
 * Busca ou monta os dados de get badge urgencia usados no fluxo atual.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} urgencia - Valor de urgencia consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const getBadgeUrgencia = (urgencia) => {
  if (!urgencia || urgencia === 'Pendente') return null;
  const normalize = normalizeText(urgencia).replace(/\s+/g, '-');
  return <span className={`ticket-urgency-badge ${normalize}`}>{urgencia}</span>;
};

const KanbanTicketCard = memo(function KanbanTicketCard({
  ticket,
  column,
  columns,
  isMoving,
  isDragging,
  movingTicketId,
  onMove,
  onDragStart,
  onDragEnd
}) {
  // Card memoizado: só re-renderiza quando o chamado ou o estado de movimento muda.
  return (
    <div
      className={`kanban-card ${isMoving ? 'is-moving' : ''} ${isDragging ? 'is-dragging' : ''}`}
      style={{ '--ticket-color': column.color }}
      draggable={!isMoving}
      onDragStart={(event) => onDragStart(event, ticket.id)}
      onDragEnd={onDragEnd}
    >
      <div className="kanban-card-header">
        <div>
          <div className="kanban-equip-name">{ticket.equipamento_nome || 'Sistema Core'}</div>
          <div className="kanban-id">OS-{ticket.id}</div>
        </div>
        {getBadgeUrgencia(ticket.urgencia)}
      </div>

      <div className="ticket-meta">
        <div className="ticket-meta-item" title="Local de Intervenção">
          <MapPin size={14}/> {ticket.filial || 'Matriz'}
        </div>
        <div className="ticket-meta-item" title="Data de Abertura">
          <Calendar size={14}/> {ticket.data_abertura ? new Date(ticket.data_abertura).toLocaleDateString('pt-PT') : '--'}
        </div>
      </div>

      <p className="kanban-desc">{ticket.descricao || 'Nenhuma descrição fornecida pelo operador.'}</p>

      <div className="ticket-footer">
        <div className="ticket-assignee" title="Agente Responsável">
          <div className="ticket-avatar" style={{ background: column.color, boxShadow: `0 0 10px ${column.color}60` }}>
            {ticket.aberto_por ? ticket.aberto_por.charAt(0).toUpperCase() : <AlertOctagon size={12}/>}
          </div>
          <span>{ticket.aberto_por || 'Sistema Auto'}</span>
        </div>

        <div className="kanban-actions">
          {isMoving ? (
            <Loader2 size={22} color={column.color} className="spin" style={{marginRight: '5px'}} />
          ) : (
            columns.map(targetCol => {
              if (targetCol.id === column.id) return null;
              return (
                <button
                  key={targetCol.id}
                  className="btn-kanban-move"
                  onClick={() => onMove(ticket.id, targetCol.id)}
                  title={`Mover para: ${targetCol.title}`}
                  disabled={movingTicketId !== null}
                >
                  {targetCol.id === 'Concluído' ? <CheckCircle size={16} color="var(--success)"/> : <ArrowRight size={16}/>}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});

/**
 * Quadro Kanban para Gestão de Incidentes (ITSM) Responsabilidades: Props:
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
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.chamados - Propriedade chamados usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.carregarChamados - Propriedade carregarChamados usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function Kanban({ chamados, api, carregarChamados, showToast, isOffline, filialAtiva }) {
  const [busca, setBusca] = usePersistentState('termosync_kanban_search', '');
  const [prioridade, setPrioridade] = usePersistentState('termosync_kanban_priority', 'todas');
  const [instanteReferencia] = useState(Date.now);
  const buscaDiferida = useDeferredValue(busca);
  const [visibleLimitByColumn, setVisibleLimitByColumn] = useState(INITIAL_VISIBLE_BY_COLUMN);
  
  // Controle UX: Bloqueio do card que está a atualizar na API
  const [movingTicketId, setMovingTicketId] = useState(null);
  
  // Controle UX: Drag and Drop Nativo (Arrastar e Largar)
  const [draggedTicketId, setDraggedTicketId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);

  // =========================================================
  // COMUNICAÇÃO COM A API (Mover Cartão)
  // =========================================================
  const moverChamado = useCallback(async (id, novoStatus) => {
    if (isOffline) return showToast('Control Plane Offline. Sem ligação à base de dados.', 'error');
    
    setMovingTicketId(id); 
    
    try {
      await api.put(`/chamados/${id}/status`, { status: novoStatus });
      await carregarChamados(); 
      showToast(`OS encaminhada para a fila: ${novoStatus}`, 'success');
    } catch (e) { 
      logger.error(e);
      showToast('Falha na sincronização do ticket. Verifique a rede.', 'error'); 
    } finally {
      setMovingTicketId(null); 
    }
  }, [api, carregarChamados, isOffline, showToast]);

  // =========================================================
  // EVENTOS DE DRAG AND DROP (ARRASTAR E LARGAR)
  // =========================================================
  const handleDragStart = useCallback((e, ticketId) => {
    setDraggedTicketId(ticketId);
    // Armazena o ID no evento nativo para segurança entre navegadores
    e.dataTransfer.setData("ticketId", ticketId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e, colId) => {
    e.preventDefault(); // Necessário para permitir o Drop no HTML5
    setDragOverColId(prev => prev === colId ? prev : colId);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOverColId(null);
  }, []);

  const listaSeguraChamados = useMemo(() => chamados || [], [chamados]);

  const chamadosPorId = useMemo(() => {
    // Mapa por ID torna o drop O(1), evitando procurar no array inteiro ao soltar.
    const porId = new Map();
    listaSeguraChamados.forEach(chamado => porId.set(String(chamado.id), chamado));
    return porId;
  }, [listaSeguraChamados]);

  const handleDrop = useCallback(async (e, targetColId) => {
    e.preventDefault();
    setDragOverColId(null);
    const droppedTicketId = e.dataTransfer.getData("ticketId") || draggedTicketId;
    
    if (droppedTicketId) {
      const ticket = chamadosPorId.get(String(droppedTicketId));
      // Move apenas se for deixado numa coluna diferente da atual
      if (ticket && ticket.status !== targetColId) {
        await moverChamado(ticket.id, targetColId);
      }
    }
    setDraggedTicketId(null);
  }, [chamadosPorId, draggedTicketId, moverChamado]);

  const handleDragEnd = useCallback(() => {
    setDraggedTicketId(null);
    setDragOverColId(null);
  }, []);

  // =========================================================
  // MOTORES DE FILTRO E KPIs
  // =========================================================
  const { chamadosAgrupados, kpis } = useMemo(() => {
    // Agrupa, filtra e calcula KPIs em uma única passada para reduzir custo em
    // bases com muitos chamados.
    const buckets = Object.fromEntries(KANBAN_COLUMNS.map(col => [col.id, []]));
    const termo = normalizeText(buscaDiferida);
    const resumo = { total: 0, criticos: 0, resolvidos: 0, semResponsavel: 0, maisAntigoDias: 0 };
    const filialNormalizada = normalizeText(filialAtiva);
    const agora = instanteReferencia;

    for (const chamado of listaSeguraChamados) {
      if (!chamado || chamado.arquivado) continue;
      if (filialAtiva && filialAtiva !== 'Todas' && normalizeText(chamado.filial || chamado.equipamento_filial) !== filialNormalizada) continue;

      const urgencia = normalizeText(chamado.urgencia || 'pendente');
      if (prioridade !== 'todas' && urgencia !== prioridade) continue;
      const columnId = getColumnId(chamado.status);

      resumo.total += 1;
      if (columnId !== 'Concluído' && urgencia === 'critica') resumo.criticos += 1;
      if (columnId === 'Concluído') resumo.resolvidos += 1;
      if (columnId !== 'Concluído' && !String(chamado.tecnico_responsavel || '').trim()) resumo.semResponsavel += 1;
      const abertura = chamado.data_abertura ? new Date(chamado.data_abertura).getTime() : agora;
      if (columnId !== 'Concluído' && Number.isFinite(abertura)) {
        resumo.maisAntigoDias = Math.max(resumo.maisAntigoDias, Math.floor((agora - abertura) / 86400000));
      }

      const colunaExiste = buckets[columnId];
      if (!colunaExiste) continue;

      if (termo) {
        const textoBusca = normalizeText([
          chamado.id,
          chamado.equipamento_nome,
          chamado.descricao,
          chamado.filial,
          chamado.aberto_por,
          chamado.urgencia
        ].join(' '));

        if (!textoBusca.includes(termo)) continue;
      }

      buckets[chamado.status].push(chamado);
    }

    return { chamadosAgrupados: buckets, kpis: resumo };
  }, [listaSeguraChamados, buscaDiferida, filialAtiva, prioridade, instanteReferencia]);

  const handleShowMore = useCallback((colId) => {
    setVisibleLimitByColumn(prev => ({
      ...prev,
      [colId]: (prev[colId] || LOAD_MORE_STEP) + LOAD_MORE_STEP
    }));
  }, []);

  return (
    <div className="kanban-wrapper">
      
      {/* HEADER & SEARCH BARS */}
      <div className="itsm-header-actions">
        <div>
          <h3 className="itsm-title-modern">
            <div className="icon-box-primary"><Columns size={24} /></div>
            Gestão Ágil de Chamados
          </h3>
          <p className="text-muted" style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>
            Organize a fila técnica, atribua prioridades e acompanhe o fluxo até a conclusão.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="search-modern">
            <Search size={18} color="var(--text-muted)" style={{marginRight: '8px'}} />
            <input type="text" placeholder="Pesquisar OS, Máquina ou Filtro..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <select className="kanban-priority-filter" value={prioridade} onChange={(event) => setPrioridade(event.target.value)} aria-label="Filtrar por prioridade">
            <option value="todas">Todas as prioridades</option>
            <option value="critica">Crítica</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
            <option value="pendente">Sem prioridade</option>
          </select>
        </div>
      </div>

      {/* KPI GLASSMORPHISM BAR */}
      <div className="itsm-kpi-bar">
        <div className="kpi-card-modern info">
          <div style={{color: 'var(--info)', background: 'color-mix(in srgb, var(--info) 10%, transparent)', padding: '12px', borderRadius: '12px'}}>
            <ActivitySquare size={28}/>
          </div>
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.total}</span>
            <span className="kpi-label-modern">Tickets no Quadro</span>
          </div>
        </div>
        
        <div className="kpi-card-modern danger">
          <div style={{color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', padding: '12px', borderRadius: '12px'}}>
            <AlertTriangle size={28}/>
          </div>
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.criticos}</span>
            <span className="kpi-label-modern">Triagem Pendente (SLA)</span>
          </div>
        </div>
        
        <div className="kpi-card-modern success">
          <div style={{color: 'var(--success)', background: 'color-mix(in srgb, var(--success) 10%, transparent)', padding: '12px', borderRadius: '12px'}}>
            <CheckCircle size={28}/>
          </div>
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.resolvidos}</span>
            <span className="kpi-label-modern">Aguardando Auditoria</span>
          </div>
        </div>
        <div className="kpi-card-modern warning">
          <div className="kanban-kpi-icon warning"><UserRoundX size={25}/></div>
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.semResponsavel}</span>
            <span className="kpi-label-modern">Sem Responsável</span>
          </div>
        </div>
        <div className="kpi-card-modern info">
          <div className="kanban-kpi-icon info"><TimerReset size={25}/></div>
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.maisAntigoDias}d</span>
            <span className="kpi-label-modern">Maior Tempo em Aberto</span>
          </div>
        </div>
      </div>

      {/* BOARD ITSM (KANBAN) */}
      <div className="kanban-board">
        {KANBAN_COLUMNS.map(col => {
          const chamadosColuna = chamadosAgrupados[col.id] || [];
          const visibleLimit = visibleLimitByColumn[col.id] || LOAD_MORE_STEP;
          const chamadosVisiveis = chamadosColuna.slice(0, visibleLimit);
          const chamadosOcultos = Math.max(0, chamadosColuna.length - chamadosVisiveis.length);
          const isDragTarget = dragOverColId === col.id;
          const ColumnIcon = col.icon;
          
          return (
            <div 
              key={col.id} 
              className={`kanban-column ${isDragTarget ? 'drag-over' : ''}`} 
              style={{ '--col-color': col.color }}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              
              <div className="kanban-column-header">
                <span className="kanban-column-title">
                  <ColumnIcon size={18} color={col.color}/> {col.title}
                </span>
                <span className="kanban-badge">{chamadosColuna.length}</span>
              </div>
              
              <div className="kanban-list">
                {chamadosColuna.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                    <Server size={48} style={{opacity: 0.2, margin: '0 auto 15px auto', display: 'block'}}/>
                    <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem', fontWeight: 'bold' }}>Arraste OS para aqui.</p>
                  </div>
                ) : (
                  <>
                    {chamadosVisiveis.map(c => (
                      <KanbanTicketCard
                        key={c.id}
                        ticket={c}
                        column={col}
                        columns={KANBAN_COLUMNS}
                        isMoving={movingTicketId === c.id}
                        isDragging={draggedTicketId === c.id}
                        movingTicketId={movingTicketId}
                        onMove={moverChamado}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      />
                    ))}

                    {chamadosOcultos > 0 && (
                      <button
                        className="kanban-show-more"
                        type="button"
                        onClick={() => handleShowMore(col.id)}
                      >
                        Mostrar mais {Math.min(LOAD_MORE_STEP, chamadosOcultos)} de {chamadosOcultos}
                      </button>
                    )}
                  </>
                )}
              </div>

            </div>
          )
        })}
      </div>
    </div>
  );
}
