import React, { useState, useMemo, useCallback, memo } from 'react';
import { 
  Printer, MessageSquarePlus, CheckCircle, Wrench, Save, 
  MapPin, User, Clock, CheckSquare, Archive, 
  Search, AlertTriangle, Loader2, PlayCircle, Settings
} from 'lucide-react';
import './Chamados.css';

// ============================================================================
// COMPONENTE OTIMIZADO (MEMO): Evita re-renderização desnecessária da lista
// Utilizamos memo para garantir que este card de OS individual só seja 
// redesenhado na tela se as suas props (dados do chamado) mudarem.
// ============================================================================
const ChamadoCard = memo(({ c, isOffline, onResolver, onArquivar }) => {
  // Verifica o status para aplicar estilos condicionalmente
  const isConcluido = c.status === 'Concluído';
  
  // Memoização da cor da borda/tags baseada no nível de urgência
  const urgencyColor = useMemo(() => {
    if (c.urgencia === 'Alta') return 'var(--danger)';
    if (c.urgencia === 'Média') return 'var(--warning)';
    return 'var(--info)';
  }, [c.urgencia]);

  return (
    <div 
      className={`card chamado-card ${isConcluido ? 'concluido' : ''}`}
      style={{ '--ticket-color': isConcluido ? 'var(--success)' : urgencyColor }}
    >
      {/* Cabeçalho do Card: Nome do Equipamento, Filial e Badges */}
      <div className="chamado-header">
        <div className="chamado-equip-info">
          <span className="chamado-equip-nome">{c.equipamento_nome}</span>
          <span className="chamado-filial"><MapPin size={12}/> {c.filial}</span>
        </div>
        
        <div className="chamado-badges">
          <span className="badge-status" style={{ 
            background: isConcluido ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: isConcluido ? 'var(--success)' : 'var(--warning)'
          }}>
            {c.status}
          </span>
          {!isConcluido && (
            <span className="badge-urgencia" style={{ color: urgencyColor, border: `1px solid ${urgencyColor}` }}>
              {c.urgencia}
            </span>
          )}
        </div>
      </div>

      {/* Corpo do Card: Informações detalhadas da ordem de serviço */}
      <div className="chamado-body">
        <div className="chamado-meta">
          <span><User size={14} /> Solicitante: {c.solicitante_nome || c.aberto_por}</span>
          <span><Wrench size={14} /> Técnico: {c.tecnico_responsavel || 'Aguardando Atribuição'}</span>
          <span><Clock size={14} /> Aberto: {new Date(c.data_abertura).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
        
        <div className="chamado-desc-box">
          <strong>Relato:</strong> {c.descricao}
        </div>

        {/* Exibe a nota de laudo apenas se o chamado já foi resolvido */}
        {isConcluido && c.nota_resolucao && (
          <div className="chamado-resolucao-box">
            <div className="resolucao-title"><CheckSquare size={14} /> Laudo de Resolução:</div>
            <p>{c.nota_resolucao}</p>
          </div>
        )}
      </div>

      {/* Rodapé do Card: Ações dinâmicas dependendo do status atual */}
      <div className="chamado-actions">
        {!isConcluido ? (
          <button className="btn w-100" style={{ background: urgencyColor, color: 'white', border: 'none' }} onClick={() => onResolver(c.id)} disabled={isOffline}>
            <Wrench size={16} /> Inserir Laudo e Concluir
          </button>
        ) : (
          <button className="btn btn-outline w-100 btn-arquivar" onClick={() => onArquivar(c.id)} disabled={isOffline}>
            <Archive size={16} /> Mover para Arquivo Histórico
          </button>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// COMPONENTE PRINCIPAL
// Painel que gerencia os estados globais da tela, modais, e lida com a 
// comunicação entre o banco de dados (via API) e as OS da interface.
// ============================================================================
export default function Chamados({
  userRole, filialAtiva, nomeLogado, chamados = [], tecnicosDb = [], equipamentosDaFilial = [],
  api, carregarChamados, showToast, isOffline, gerarLoteOS
}) {

  /* --- ESTADOS --- */
  // Controle de inputs da barra superior
  const [busca, setBusca] = useState('');
  const [tecnicoFiltroOS, setTecnicoFiltroOS] = useState('todos');
  const [filtroTempoOS, setFiltroTempoOS] = useState('todos');

  // Controle de visibilidade e dados dos modais
  const [modalChamado, setModalChamado] = useState(false);
  const [formChamado, setFormChamado] = useState({ equipamento_id: '', descricao: '', urgencia: 'Baixa', tecnico_responsavel: '' });
  const [modalResolver, setModalResolver] = useState({ isOpen: false, chamadoId: null, nota: '' });
  const [modalArquivarTodos, setModalArquivarTodos] = useState(false);
  
  // Estado para travar botões enquanto a API processa dados
  const [isProcessing, setIsProcessing] = useState(false);

  /* --- FILTRAGEM DE ALTA PERFORMANCE (Single-Pass Loop) --- 
     Este hook processa todas as regras de visualização e filtros de texto 
     numa única iteração sobre o array para economizar ciclos de CPU.
  */
  const chamadosAtivosFiltrados = useMemo(() => {
    if (!chamados || chamados.length === 0) return [];

    const agora = Date.now();
    const termoBusca = busca.toLowerCase().trim();
    const roleAdmin = userRole === 'ADMIN';
    const roleManu = userRole === 'MANUTENCAO';
    
    // Filtro num único loop para poupar CPU
    let list = chamados.filter(c => {
      // Ignora chamados que já foram despachados para a aba de histórico
      if (c.arquivado) return false;
      
      // Filtra por filial se o usuário for Admin e não estiver visualizando "Todas"
      if (roleAdmin && filialAtiva !== 'Todas' && c.filial !== filialAtiva) return false;
      
      // Controle de exibição baseado no cargo (RBAC) e no filtro da UI
      if (roleManu) {
        if (c.tecnico_responsavel && c.tecnico_responsavel !== nomeLogado) return false;
      } else if (tecnicoFiltroOS !== 'todos') {
        if (c.tecnico_responsavel !== tecnicoFiltroOS) return false;
      }

      // Filtro de linha do tempo
      if (filtroTempoOS !== 'todos') {
        const tempoAbertura = new Date(c.data_abertura).getTime();
        if (filtroTempoOS === '24h' && (agora - tempoAbertura > 86400000)) return false;
        if (filtroTempoOS === '7d' && (agora - tempoAbertura > 604800000)) return false;
      }

      // Filtro textual que escaneia nome do equipamento, descrição e nome do técnico
      if (termoBusca) {
        const eqNome = c.equipamento_nome ? c.equipamento_nome.toLowerCase() : '';
        const desc = c.descricao ? c.descricao.toLowerCase() : '';
        const tecResp = c.tecnico_responsavel ? c.tecnico_responsavel.toLowerCase() : '';
        if (!eqNome.includes(termoBusca) && !desc.includes(termoBusca) && !tecResp.includes(termoBusca)) return false;
      }

      return true;
    });

    // Ordenação do resultado (Pendentes no topo > Maior Urgência > Data mais recente)
    return list.sort((a, b) => {
      if (a.status !== 'Concluído' && b.status === 'Concluído') return -1;
      if (a.status === 'Concluído' && b.status !== 'Concluído') return 1;
      
      const urgMap = { 'Alta': 3, 'Média': 2, 'Baixa': 1 };
      const urgDiff = (urgMap[b.urgencia] || 0) - (urgMap[a.urgencia] || 0);
      if (urgDiff !== 0) return urgDiff;
      
      return new Date(b.data_abertura).getTime() - new Date(a.data_abertura).getTime(); 
    });
  }, [chamados, filialAtiva, userRole, nomeLogado, tecnicoFiltroOS, filtroTempoOS, busca]);

  /* --- CÁLCULO DE KPIs --- 
     Conta a volumetria dos tickets diretamente da lista já filtrada.
  */
  const { kpis, concluidosCount } = useMemo(() => {
    let pendentes = 0; let concluidos = 0; let criticos = 0;
    chamadosAtivosFiltrados.forEach(c => {
      if (c.status === 'Concluído') concluidos++;
      else { pendentes++; if (c.urgencia === 'Alta') criticos++; }
    });
    return { 
      kpis: { total: chamadosAtivosFiltrados.length, pendentes, concluidos, criticos }, 
      concluidosCount: concluidos 
    };
  }, [chamadosAtivosFiltrados]);

  /* --- FUNÇÕES DA API (Mapeadas via useCallback para não quebrar a memoização dos cards) --- */
  
  // Realiza o soft-delete do chamado, marcando-o como arquivado no BD
  const arquivarChamado = useCallback(async (id) => {
    if (isOffline) return showToast('Ação não permitida em modo offline.', 'warning');
    try {
      await api.put(`/chamados/${id}/arquivar`);
      showToast('Ordem de Serviço arquivada.', 'success');
      carregarChamados(); // Dispara atualização da lista global
    } catch (e) { showToast('Erro ao arquivar OS.', 'error'); }
  }, [api, isOffline, showToast, carregarChamados]);

  // Prepara o state do modal de Resolução capturando o ID do chamado alvo
  const abrirModalResolver = useCallback((id) => {
    setModalResolver({ isOpen: true, chamadoId: id, nota: '' });
  }, []);

  // Arquiva todas as OS que já foram concluídas na tela com uma só ação
  const confirmarArquivarTodos = async () => {
    if (isOffline) return showToast('Modo offline ativo.', 'warning');
    setIsProcessing(true);
    try {
      const idsParaArquivar = chamadosAtivosFiltrados.filter(c => c.status === 'Concluído').map(c => c.id);
      if (idsParaArquivar.length === 0) return;

      await Promise.all(idsParaArquivar.map(id => api.put(`/chamados/${id}/arquivar`)));
      showToast(`${idsParaArquivar.length} OS arquivada(s) com sucesso.`, 'success');
      setModalArquivarTodos(false);
      carregarChamados();
    } catch (e) { 
      showToast('Erro ao arquivar lote. Verifique a conexão.', 'error'); 
    } finally { setIsProcessing(false); }
  };

  // Envia a nota de resolução preenchida pelo técnico no modal
  const confirmarResolucao = async () => {
    if (!modalResolver.nota.trim()) return showToast('O Laudo Técnico é obrigatório para fechamento.', 'warning');
    if (isOffline) return showToast('Modo offline ativo.', 'warning');
    setIsProcessing(true);
    try {
      await api.put(`/chamados/${modalResolver.chamadoId}/resolver`, { nota_resolucao: modalResolver.nota });
      showToast('Laudo Técnico validado e OS concluída.', 'success');
      setModalResolver({ isOpen: false, chamadoId: null, nota: '' });
      carregarChamados();
    } catch (e) { showToast('Erro ao concluir OS.', 'error'); }
    finally { setIsProcessing(false); }
  };

  // Processo para criar uma nova Ordem de Serviço vinculada a um equipamento
  const salvarChamado = async (e) => {
    e.preventDefault();
    if (isOffline) return showToast('Modo offline ativo.', 'warning');
    setIsProcessing(true);
    try {
      await api.post('/chamados', {
        equipamento_id: formChamado.equipamento_id,
        descricao: formChamado.descricao,
        urgencia: formChamado.urgencia,
        tecnico_responsavel: formChamado.tecnico_responsavel || null,
        filial: filialAtiva === 'Todas' ? (equipamentosDaFilial.find(eq => String(eq.id) === String(formChamado.equipamento_id))?.filial || 'Loja Base') : filialAtiva
      });
      showToast('Ordem de Serviço Aberta.', 'success');
      setModalChamado(false); // Fecha o Modal
      setFormChamado({ equipamento_id: '', descricao: '', urgencia: 'Baixa', tecnico_responsavel: '' }); // Reseta formulário
      carregarChamados();
    } catch (e) { showToast('Erro ao abrir OS.', 'error'); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="anim-fade-in stagger-1">
      
      {/* CABEÇALHO DO SERVICE DESK */}
      <div className="chamados-header">
        <div>
          <h3 className="chamados-title">Gestão de Ocorrências (OS)</h3>
          <p className="chamados-subtitle">Painel de Atribuição e Intervenções Técnicas</p>
        </div>

        <div className="chamados-actions">
          {/* Barra de Pesquisa */}
          <div className="search-box-chamados">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar OS ou técnico..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" onClick={() => setModalChamado(true)} style={{ boxShadow: '0 4px 15px rgba(5, 150, 105, 0.3)' }}>
            <MessageSquarePlus size={18} /> Nova OS
          </button>

          {/* Botão Dinâmico: Só aparece se o Admin tiver arquivos prontos para limpeza da tela principal */}
          {userRole !== 'MANUTENCAO' && concluidosCount > 0 && (
            <button className="btn btn-outline btn-archive-all" onClick={() => setModalArquivarTodos(true)}>
              <Archive size={18} /> Arquivar Lote ({concluidosCount})
            </button>
          )}
        </div>
      </div>

      {/* FILTROS SECUNDÁRIOS */}
      <div className="chamados-filters-bar stagger-2">
        {userRole !== 'MANUTENCAO' && (
          <select className="select-input chamados-filter-select" value={tecnicoFiltroOS} onChange={e => setTecnicoFiltroOS(e.target.value)}>
            <option value="todos">Todos os Técnicos</option>
            {tecnicosDb?.map(tec => <option key={tec.id} value={tec.nome_tecnico}>{tec.nome_tecnico}</option>)}
          </select>
        )}
        <select className="select-input chamados-filter-select" value={filtroTempoOS} onChange={e => setFiltroTempoOS(e.target.value)}>
          <option value="todos">Qualquer Data</option>
          <option value="24h">Últimas 24 Horas</option>
          <option value="7d">Últimos 7 Dias</option>
        </select>
        
        <button className="btn btn-print-os" onClick={() => gerarLoteOS(chamadosAtivosFiltrados)}>
          <Printer size={16} /> Imprimir Lote
        </button>
      </div>

      {/* PAINEL DE KPIs DE SERVICE DESK */}
      <div className="chamados-kpi-bar stagger-2">
        <div className="kpi-item total">
          <div className="kpi-icon"><Settings size={20}/></div>
          <div className="kpi-data">
            <span className="kpi-value">{kpis.total}</span>
            <span className="kpi-label">OS Ativas</span>
          </div>
        </div>
        <div className="kpi-item warning">
          <div className="kpi-icon"><PlayCircle size={20}/></div>
          <div className="kpi-data">
            <span className="kpi-value">{kpis.pendentes}</span>
            <span className="kpi-label">Pendentes</span>
          </div>
        </div>
        <div className={`kpi-item ${kpis.criticos > 0 ? 'danger pulse-kpi-danger' : 'ok'}`}>
          <div className="kpi-icon"><AlertTriangle size={20}/></div>
          <div className="kpi-data">
            <span className="kpi-value">{kpis.criticos}</span>
            <span className="kpi-label">Críticos</span>
          </div>
        </div>
        <div className="kpi-item success">
          <div className="kpi-icon"><CheckCircle size={20}/></div>
          <div className="kpi-data">
            <span className="kpi-value">{kpis.concluidos}</span>
            <span className="kpi-label">Aguardando Arquivo</span>
          </div>
        </div>
      </div>

      {/* RENDERIZAÇÃO CONDICIONAL DA LISTA DE CHAMADOS */}
      {chamadosAtivosFiltrados.length === 0 ? (
        /* ESTADO VAZIO: Nenhum chamado com os filtros atuais */
        <div className="empty-state dashboard-empty stagger-3">
          <div className="empty-shield-box" style={{ background: 'rgba(56, 189, 248, 0.1)' }}>
            <CheckSquare size={48} color="var(--secondary)" />
          </div>
          <h3 className="empty-title" style={{ color: 'var(--text-main)' }}>Painel Limpo</h3>
          <p className="empty-subtitle">Não existem ordens de serviço ativas. Toda a manutenção está em dia!</p>
        </div>
      ) : (
        /* GRADE DE CARTÕES (TICKETS) */
        <div className="grid-cards stagger-3">
          {chamadosAtivosFiltrados.map(c => (
            <ChamadoCard 
              key={c.id} 
              c={c} 
              isOffline={isOffline} 
              onResolver={abrirModalResolver} 
              onArquivar={arquivarChamado} 
            />
          ))}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO DE OS */}
      {modalChamado && (
        <div className="chamados-fixed-overlay anim-fade-in">
          <div className="chamados-modal-box">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquarePlus size={22} color="var(--primary)" /> Emissão de Nova OS
            </h3>
            
            <form onSubmit={salvarChamado}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Máquina / Equipamento com Problema</label>
                <select className="select-input w-100" value={formChamado.equipamento_id} onChange={e => setFormChamado({...formChamado, equipamento_id: e.target.value})} required>
                  <option value="">-- Selecione a Máquina --</option>
                  {equipamentosDaFilial?.map(eq => <option key={eq.id} value={eq.id}>{eq.nome} ({eq.filial || 'Base'})</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Descrição do Problema / Motivo da OS</label>
                <textarea className="textarea-chamado" value={formChamado.descricao} onChange={e => setFormChamado({...formChamado, descricao: e.target.value})} placeholder="Descreva os sintomas do defeito detalhadamente..." rows="4" required />
              </div>

              <div className="form-grid-chamados">
                <div className="form-group">
                  <label>Nível de Urgência</label>
                  <select className="select-input w-100" value={formChamado.urgencia} onChange={e => setFormChamado({...formChamado, urgencia: e.target.value})} required>
                    <option value="Baixa">Baixa (Rotina)</option>
                    <option value="Média">Média (Atenção)</option>
                    <option value="Alta">Alta (Emergência T.)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Técnico Designado</label>
                  <select className="select-input w-100" value={formChamado.tecnico_responsavel} onChange={e => setFormChamado({...formChamado, tecnico_responsavel: e.target.value})}>
                    <option value="">Aguardando Atribuição</option>
                    {tecnicosDb?.map(tec => <option key={tec.id} value={tec.nome_tecnico}>{tec.nome_tecnico}</option>)}
                  </select>
                </div>
              </div>

              <div className="modal-actions-chamados" style={{ marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setModalChamado(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isProcessing || isOffline}>
                  {/* UX: Loader rodando caso botão de submit já tenha sido disparado */}
                  {isProcessing ? <Loader2 className="spinner" size={18} /> : <Save size={18} />} 
                  Emitir OS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE RESOLUÇÃO (LAUDO TÉCNICO) */}
      {modalResolver.isOpen && (
        <div className="chamados-fixed-overlay anim-fade-in">
          <div className="chamados-modal-box">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '1.5rem' }}>
              <CheckCircle size={22} /> Laudo Técnico de Fechamento
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Registre as peças trocadas ou as medidas corretivas aplicadas para fins de auditoria futura.
            </p>
            <textarea 
              className="textarea-chamado" 
              value={modalResolver.nota} 
              onChange={e => setModalResolver({...modalResolver, nota: e.target.value})} 
              placeholder="Ex: Trocado termostato e compressor. Testes 100%..." 
              rows="5" autoFocus 
            />
            <div className="modal-actions-chamados" style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setModalResolver({ isOpen: false, chamadoId: null, nota: '' })}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarResolucao} disabled={isProcessing || isOffline || !modalResolver.nota.trim()}>
                {isProcessing ? <Loader2 className="spinner" size={18} /> : <CheckCircle size={18} />} 
                Validar e Concluir OS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ARQUIVAR TODOS LOTE */}
      {modalArquivarTodos && (
        <div className="chamados-fixed-overlay anim-fade-in">
          <div className="chamados-modal-box" style={{ borderTop: '4px solid var(--info)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--info)', margin: '0 0 1rem 0' }}>
              <Archive size={24} /> Arquivar Ocorrências
            </h3>
            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              Tem certeza que deseja mover <strong>{concluidosCount} chamado(s) concluído(s)</strong> para o Arquivo Histórico?
              <br/><br/>
              Eles sairão deste painel principal (Service Desk) e ficarão disponíveis permanentemente na seção de Arquivo Técnico.
            </p>
            <div className="modal-actions-chamados">
              <button className="btn btn-outline" onClick={() => setModalArquivarTodos(false)} disabled={isProcessing}>Cancelar</button>
              <button className="btn" style={{ background: 'var(--info)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', border: 'none' }} onClick={confirmarArquivarTodos} disabled={isProcessing || isOffline}>
                {isProcessing ? <Loader2 className="spinner" size={18} /> : <CheckCircle size={18} />} Sim, Arquivar Todos
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}