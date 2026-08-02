import React, { useState, useMemo } from 'react';
import { 
  Columns, Wrench, Clock, CheckCircle, ArrowRight, AlertTriangle, 
  Search, Calendar, MapPin, ActivitySquare, Server, Loader2, AlertOctagon
} from 'lucide-react';
import './Kanban.css';
import logger from '../../utils/logger';

/**
 * Quadro Kanban para Gestão de Incidentes (ITSM)
 *
 * Responsabilidades:
 * - Apresentar tickets por coluna (Triagem, Em Andamento, Logística, Concluído)
 * - Permitir drag-and-drop nativo e ações de movimentação manual
 * - Fornecer filtros de busca e KPIs resumidos para operação rápida
 *
 * Props:
 * - `chamados`: lista de ordens de serviço
 * - `api`: instância HTTP para atualizações de status
 * - `carregarChamados`: função para recarregar dados após mudanças
 * - `showToast`, `isOffline`: utilitários de UI/estado offline
 */
export default function Kanban({ chamados, api, carregarChamados, showToast, isOffline }) {
  const [busca, setBusca] = useState('');
  
  // Controle UX: Bloqueio do card que está a atualizar na API
  const [movingTicketId, setMovingTicketId] = useState(null);
  
  // Controle UX: Drag and Drop Nativo (Arrastar e Largar)
  const [draggedTicketId, setDraggedTicketId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);

  // Paleta de Cores e Colunas
  const colunas = [
    { id: 'Aberto', title: 'Novos / Triagem', icon: AlertTriangle, color: '#ef4444' }, // Vermelho
    { id: 'Em Andamento', title: 'Intervenção (FSM)', icon: Wrench, color: '#f59e0b' }, // Amarelo
    { id: 'Aguardando Peça', title: 'Logística', icon: Clock, color: '#38bdf8' }, // Azul
    { id: 'Concluído', title: 'Auditoria Fechada', icon: CheckCircle, color: '#10b981' } // Verde
  ];

  // =========================================================
  // COMUNICAÇÃO COM A API (Mover Cartão)
  // =========================================================
  const moverChamado = async (id, novoStatus) => {
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
  };

  // =========================================================
  // EVENTOS DE DRAG AND DROP (ARRASTAR E LARGAR)
  // =========================================================
  const handleDragStart = (e, ticketId) => {
    setDraggedTicketId(ticketId);
    // Armazena o ID no evento nativo para segurança entre navegadores
    e.dataTransfer.setData("ticketId", ticketId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault(); // Necessário para permitir o Drop no HTML5
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverColId(null);
  };

  const handleDrop = async (e, targetColId) => {
    e.preventDefault();
    setDragOverColId(null);
    const droppedTicketId = e.dataTransfer.getData("ticketId") || draggedTicketId;
    
    if (droppedTicketId) {
      const ticket = listaSeguraChamados.find(c => String(c.id) === String(droppedTicketId));
      // Move apenas se for deixado numa coluna diferente da atual
      if (ticket && ticket.status !== targetColId) {
        await moverChamado(ticket.id, targetColId);
      }
    }
    setDraggedTicketId(null);
  };

  const handleDragEnd = () => {
    setDraggedTicketId(null);
    setDragOverColId(null);
  };

  // =========================================================
  // MOTORES DE FILTRO E KPIs
  // =========================================================
  const listaSeguraChamados = chamados || [];

  const chamadosFiltrados = useMemo(() => {
    if (!busca.trim()) return listaSeguraChamados;
    const termo = busca.toLowerCase();
    return listaSeguraChamados.filter(c => 
      c.equipamento_nome?.toLowerCase().includes(termo) ||
      c.descricao?.toLowerCase().includes(termo) ||
      String(c.id).includes(termo) ||
      c.filial?.toLowerCase().includes(termo)
    );
  }, [listaSeguraChamados, busca]);

  const kpis = useMemo(() => {
    const total = listaSeguraChamados.filter(c => !c.arquivado).length;
    const criticos = listaSeguraChamados.filter(c => c.status === 'Aberto' && !c.arquivado).length;
    const resolvidos = listaSeguraChamados.filter(c => c.status === 'Concluído' && !c.arquivado).length;
    return { total, criticos, resolvidos };
  }, [listaSeguraChamados]);

  // Função para mapear o nível de urgência com estilos
  const getBadgeUrgencia = (urgencia) => {
    if (!urgencia || urgencia === 'Pendente') return null;
    const normalize = urgencia.toLowerCase().replace('í', 'i').replace('é', 'e');
    return <span className={`ticket-urgency-badge ${normalize}`}>{urgencia}</span>;
  };

  return (
    <div className="kanban-wrapper">
      
      {/* HEADER & SEARCH BARS */}
      <div className="itsm-header-actions">
        <div>
          <h3 className="itsm-title-modern">
            <div className="icon-box-primary"><Columns size={24} /></div>
            Gestão de Incidentes (ITSM)
          </h3>
          <p className="text-muted" style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>
            Field Service Management (FSM). <b>Dica: Pode arrastar e largar os cartões entre as colunas.</b>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="search-modern">
            <Search size={18} color="var(--text-muted)" style={{marginRight: '8px'}} />
            <input type="text" placeholder="Pesquisar OS, Máquina ou Filtro..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>
      </div>

      {/* KPI GLASSMORPHISM BAR */}
      <div className="itsm-kpi-bar">
        <div className="kpi-card-modern info">
          <div style={{color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '12px', borderRadius: '12px'}}>
            <ActivitySquare size={28}/>
          </div>
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.total}</span>
            <span className="kpi-label-modern">Tickets Ativos</span>
          </div>
        </div>
        
        <div className="kpi-card-modern danger">
          <div style={{color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '12px'}}>
            <AlertTriangle size={28}/>
          </div>
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.criticos}</span>
            <span className="kpi-label-modern">Triagem Pendente (SLA)</span>
          </div>
        </div>
        
        <div className="kpi-card-modern success">
          <div style={{color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '12px'}}>
            <CheckCircle size={28}/>
          </div>
          <div className="kpi-text-box">
            <span className="kpi-value-modern">{kpis.resolvidos}</span>
            <span className="kpi-label-modern">Aguardando Auditoria</span>
          </div>
        </div>
      </div>

      {/* BOARD ITSM (KANBAN) */}
      <div className="kanban-board">
        {colunas.map(col => {
          const chamadosColuna = chamadosFiltrados.filter(c => c.status === col.id && !c.arquivado);
          const isDragTarget = dragOverColId === col.id;
          
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
                  <col.icon size={18} color={col.color}/> {col.title}
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
                  chamadosColuna.map(c => {
                    const isMoving = movingTicketId === c.id;
                    const isDragging = draggedTicketId === c.id;
                    
                    return (
                      <div 
                        key={c.id} 
                        className={`kanban-card ${isMoving ? 'is-moving' : ''} ${isDragging ? 'is-dragging' : ''}`} 
                        style={{ '--ticket-color': col.color }}
                        draggable={!isMoving}
                        onDragStart={(e) => handleDragStart(e, c.id)}
                        onDragEnd={handleDragEnd}
                      >
                        
                        <div className="kanban-card-header">
                          <div>
                            <div className="kanban-equip-name">{c.equipamento_nome || 'Sistema Core'}</div>
                            <div className="kanban-id">OS-{c.id}</div>
                          </div>
                          {getBadgeUrgencia(c.urgencia)}
                        </div>

                        <div className="ticket-meta">
                          <div className="ticket-meta-item" title="Local de Intervenção">
                            <MapPin size={14}/> {c.filial || 'Matriz'}
                          </div>
                          <div className="ticket-meta-item" title="Data de Abertura">
                            <Calendar size={14}/> {c.data_abertura ? new Date(c.data_abertura).toLocaleDateString('pt-PT') : '--'}
                          </div>
                        </div>

                        <p className="kanban-desc">{c.descricao || 'Nenhuma descrição fornecida pelo operador.'}</p>
                        
                        <div className="ticket-footer">
                          <div className="ticket-assignee" title="Agente Responsável">
                            <div className="ticket-avatar" style={{ background: col.color, boxShadow: `0 0 10px ${col.color}60` }}>
                              {c.aberto_por ? c.aberto_por.charAt(0).toUpperCase() : <AlertOctagon size={12}/>}
                            </div>
                            {c.aberto_por || 'Sistema Auto'}
                          </div>

                          <div className="kanban-actions">
                            {/* Opcional: Manter os botões para acessibilidade ou dispositivos móveis sem rato */}
                            {isMoving ? (
                              <Loader2 size={22} color={col.color} className="spin" style={{marginRight: '5px'}} />
                            ) : (
                              colunas.map(targetCol => {
                                if (targetCol.id === col.id) return null;
                                return (
                                  <button 
                                    key={targetCol.id} 
                                    className="btn-kanban-move"
                                    onClick={() => moverChamado(c.id, targetCol.id)} 
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
                  })
                )}
              </div>

            </div>
          )
        })}
      </div>
    </div>
  );
}