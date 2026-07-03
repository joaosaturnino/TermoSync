import React, { useState, useMemo, useCallback, memo } from 'react';
import { 
  Printer, MessageSquarePlus, CheckCircle, Wrench, Save, 
  MapPin, User, Clock, CheckSquare, Archive, 
  Search, AlertTriangle, Loader2, PlayCircle, Settings
} from 'lucide-react';
import './Chamados.css';

// Componente individual (Manteve-se inalterado o miolo, adicionei apenas o checkbox)
const ChamadoCard = memo(({ c, isOffline, onResolver, onArquivar, isSelected, onToggleSelection }) => {
  const isConcluido = c.status === 'Concluído';
  const urgencyColor = useMemo(() => {
    if (c.urgencia === 'Alta') return 'var(--danger)';
    if (c.urgencia === 'Média') return 'var(--warning)';
    return 'var(--info)';
  }, [c.urgencia]);

  return (
    <div className={`card chamado-card ${isConcluido ? 'concluido' : ''}`} style={{ '--ticket-color': isConcluido ? 'var(--success)' : urgencyColor }}>
      <div className="chamado-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* NOVO: CHECKBOX DE SELEÇÃO EM LOTE */}
          <input 
            type="checkbox" 
            checked={isSelected} 
            onChange={() => onToggleSelection(c.id)} 
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
          <div>
            <span className="chamado-equip">{c.equipamento_nome || 'Equipamento Geral'}</span>
            <div className="chamado-badges">
              <span className="badge-os">OS-{c.id}</span>
              {c.urgencia && c.urgencia !== 'Pendente' && (
                <span className={`badge-urgencia ${c.urgencia.toLowerCase().replace('í', 'i').replace('é', 'e')}`}>
                  {c.urgencia}
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={`status-pill ${c.status.replace(' ', '-').toLowerCase().replace('í', 'i')}`}>{c.status}</span>
      </div>
      
      <div className="chamado-body">
        <p className="chamado-desc">{c.descricao || 'Sem descrição.'}</p>
        
        <div className="chamado-meta">
          <span title="Filial / Loja"><MapPin size={14}/> {c.filial || 'Filial Principal'}</span>
          <span title="Técnico / Responsável"><User size={14}/> {c.tecnico_responsavel || c.aberto_por || 'Sistema'}</span>
          <span title="Abertura"><Clock size={14}/> {new Date(c.data_abertura).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>

        {isConcluido && c.nota_resolucao && (
          <div className="chamado-resolution">
            <strong>Resolução:</strong> <p>{c.nota_resolucao}</p>
          </div>
        )}
      </div>

      <div className="chamado-footer">
        {isConcluido ? (
          <button className="btn btn-outline btn-arquivar-small w-100" onClick={() => onArquivar(c.id)} disabled={isOffline}>
            <Archive size={16} style={{marginRight: '6px'}}/> Mover para o Arquivo Histórico
          </button>
        ) : (
          <button className="btn btn-primary w-100" onClick={() => onResolver(c.id, c)} disabled={isOffline}>
            <CheckSquare size={16} style={{marginRight: '6px'}}/> Finalizar Intervenção Técnica
          </button>
        )}
      </div>
    </div>
  );
});

export default function Chamados({ userRole, filialAtiva, nomeLogado, chamados, tecnicosDb, equipamentosDaFilial, api, carregarChamados, showToast, isOffline, gerarLoteOS }) {
  
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Aberto');
  // --- NOVO: FILTRO DE URGÊNCIA ---
  const [filtroUrgencia, setFiltroUrgencia] = useState('Todas');
  const [novoChamado, setNovoChamado] = useState({ equipamento_id: '', urgencia: 'Pendente', descricao: '', tecnico_responsavel: '' });
  const [mostrarAbrirChamado, setMostrarAbrirChamado] = useState(false);
  const [equipamentosAbertura, setEquipamentosAbertura] = useState([]);
  const [tecnicosAbertura, setTecnicosAbertura] = useState([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalArquivarTodos, setModalArquivarTodos] = useState(false);
  const [chamadoResolvendo, setChamadoResolvendo] = useState(null);
  const [notaResolucao, setNotaResolucao] = useState('');

  // --- NOVO: ESTADO PARA SELEÇÃO EM LOTE ---
  const [selecionadosIds, setSelecionadosIds] = useState(new Set());

  const carregarOpcoesAbertura = useCallback(async () => {
    if (!api || isOffline) return;
    try {
      const [resEquip, resTec] = await Promise.all([
        api.get('/auxiliares/equipamentos-abertura').catch(() => ({ data: [] })),
        api.get('/tecnicos').catch(() => ({ data: [] }))
      ]);
      setEquipamentosAbertura(Array.isArray(resEquip.data) ? resEquip.data : []);
      setTecnicosAbertura(Array.isArray(resTec.data) ? resTec.data : []);
    } catch (error) {
      showToast('Não foi possível carregar as opções de abertura.', 'warning');
    }
  }, [api, isOffline, showToast]);

  React.useEffect(() => {
    carregarOpcoesAbertura();
  }, [carregarOpcoesAbertura]);

  const chamadosFiltrados = useMemo(() => {
    let filtrados = chamados || [];
    
    if (filialAtiva !== 'Todas') {
      filtrados = filtrados.filter(c => (c.filial || 'Filial Principal') === filialAtiva);
    }
    
    filtrados = filtrados.filter(c => c.status === filtroStatus && !c.arquivado);
    
    if (filtroUrgencia !== 'Todas') {
      filtrados = filtrados.filter(c => c.urgencia === filtroUrgencia);
    }
    
    if (busca.trim()) {
      const b = busca.toLowerCase();
      filtrados = filtrados.filter(c => 
        c.equipamento_nome?.toLowerCase().includes(b) || 
        c.descricao?.toLowerCase().includes(b) || 
        String(c.id).includes(b)
      );
    }
    return filtrados;
  }, [chamados, filialAtiva, filtroStatus, filtroUrgencia, busca]);

  const concluidosCount = useMemo(() => {
    if (!chamados) return 0;
    return chamados.filter(c => c.status === 'Concluído' && !c.arquivado && (filialAtiva === 'Todas' || (c.filial || 'Filial Principal') === filialAtiva)).length;
  }, [chamados, filialAtiva]);

  // --- NOVAS FUNÇÕES PARA SELEÇÃO EM LOTE ---
  const toggleSelecaoChamado = useCallback((id) => {
    setSelecionadosIds(prev => {
      const novoSet = new Set(prev);
      if (novoSet.has(id)) novoSet.delete(id);
      else novoSet.add(id);
      return novoSet;
    });
  }, []);

  const toggleSelecionarTodos = () => {
    if (selecionadosIds.size === chamadosFiltrados.length && chamadosFiltrados.length > 0) {
      setSelecionadosIds(new Set()); // Desmarca todos
    } else {
      setSelecionadosIds(new Set(chamadosFiltrados.map(c => c.id))); // Marca todos visíveis
    }
  };

  const handleGerarLoteExato = () => {
    if (selecionadosIds.size > 0) {
      const loteCustomizado = chamadosFiltrados.filter(c => selecionadosIds.has(c.id));
      gerarLoteOS(loteCustomizado);
    } else {
      gerarLoteOS(chamadosFiltrados); // Se não marcou nenhum, imprime o que está filtrado na tela
    }
  };

  const handleAbrirChamado = async (e) => {
    e.preventDefault();
    if (isOffline) return showToast('Ação bloqueada no modo offline.', 'warning');
    if (!novoChamado.equipamento_id || !novoChamado.descricao.trim()) {
      return showToast('Selecione o equipamento e descreva a manutenção.', 'warning');
    }

    setIsProcessing(true);
    try {
      await api.post('/chamados', {
        equipamento_id: novoChamado.equipamento_id,
        descricao: novoChamado.descricao,
        solicitante_nome: nomeLogado || 'Loja',
        tecnico_responsavel: novoChamado.tecnico_responsavel || null,
        urgencia: novoChamado.urgencia
      });
      await carregarChamados();
      setNovoChamado({ equipamento_id: '', urgencia: 'Pendente', descricao: '', tecnico_responsavel: '' });
      showToast('OS de manutenção aberta com sucesso.', 'success');
    } catch (error) {
      showToast('Falha ao abrir a OS de manutenção.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResolverClick = useCallback((id, c) => { setChamadoResolvendo(c); setNotaResolucao(''); }, []);
  const handleArquivar = useCallback(async (id) => {
    if (isOffline) return showToast('Ação bloqueada no modo offline.', 'warning');
    setIsProcessing(true);
    try { await api.put(`/chamados/${id}/arquivar`); await carregarChamados(); showToast('Chamado arquivado com sucesso.', 'success'); } 
    catch (error) { showToast('Erro ao arquivar chamado.', 'error'); } 
    finally { setIsProcessing(false); }
  }, [api, carregarChamados, isOffline, showToast]);

  const confirmarArquivarTodos = async () => {
    if (isOffline) return showToast('Ação bloqueada no modo offline.', 'warning');
    setIsProcessing(true);
    try {
      const chamadosParaArquivar = chamados.filter(c => c.status === 'Concluído' && !c.arquivado && (filialAtiva === 'Todas' || (c.filial || 'Filial Principal') === filialAtiva));
      for (const c of chamadosParaArquivar) { await api.put(`/chamados/${c.id}/arquivar`); }
      await carregarChamados();
      showToast(`${chamadosParaArquivar.length} chamado(s) arquivado(s).`, 'success');
      setModalArquivarTodos(false);
    } catch (error) { showToast('Erro durante o arquivamento em lote.', 'error'); } 
    finally { setIsProcessing(false); }
  };

  const confirmarResolucao = async () => {
    if (isOffline || !chamadoResolvendo) return;
    setIsProcessing(true);
    try {
      await api.put(`/chamados/${chamadoResolvendo.id}`, { status: 'Concluído', nota_resolucao: notaResolucao });
      await carregarChamados();
      showToast('Ordem de Serviço finalizada com sucesso.', 'success');
      setChamadoResolvendo(null);
    } catch (error) { showToast('Falha ao concluir a OS.', 'error'); } 
    finally { setIsProcessing(false); }
  };

  return (
    <div className="anim-fade-in stagger-1">
      
      <div className="chamados-header">
        <div>
          <h2 className="chamados-title">Abertura de OS de Manutenção</h2>
          <p className="chamados-subtitle">A loja registra aqui a manutenção e encaminha a solicitação ao técnico responsável.</p>
        </div>
        
        <div className="chamados-actions">
          <div className="search-box-chamados">
            <Search size={18} color="var(--text-muted)" />
            <input type="text" placeholder="Localizar OS, Máquina..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          <button className="btn btn-primary" onClick={() => setMostrarAbrirChamado(prev => !prev)} type="button">
            <MessageSquarePlus size={18} style={{marginRight: '8px'}} />
            {mostrarAbrirChamado ? 'Fechar abertura' : 'Abrir OS'}
          </button>

          <button className="btn btn-outline" onClick={handleGerarLoteExato} disabled={chamadosFiltrados.length === 0} title={selecionadosIds.size > 0 ? `Exportar ${selecionadosIds.size} selecionados` : 'Exportar Filtro Atual'}>
            <Printer size={18} style={{marginRight: '8px'}} />
            <span className="desktop-only-inline">Exportar Lote</span>
            {selecionadosIds.size > 0 && <span style={{marginLeft: '6px', background: 'var(--primary)', color: '#000', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold'}}>{selecionadosIds.size}</span>}
          </button>
        </div>
      </div>

      {mostrarAbrirChamado && (
        <div className="chamados-open-panel stagger-2">
          <div className="chamados-open-panel-copy">
            <span className="chamados-open-kicker"><Wrench size={14} /> Manutenção da Loja</span>
            <h3>Abra a solicitação para o técnico responsável</h3>
            <p>Informe o equipamento, a urgência e descreva o problema com o máximo de detalhe possível. Isso acelera a triagem e o atendimento.</p>
          </div>

          <form className="chamados-open-form" onSubmit={handleAbrirChamado}>
            <div className="form-group-chamados">
              <label>Equipamento *</label>
              <select className="chamados-input" value={novoChamado.equipamento_id} onChange={(e) => setNovoChamado(prev => ({ ...prev, equipamento_id: e.target.value }))}>
                <option value="">Selecione o equipamento</option>
                {equipamentosAbertura?.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.nome} {eq.setor ? `- ${eq.setor}` : ''}</option>
                ))}
              </select>
            </div>

            <div className="form-grid-chamados-2">
              <div className="form-group-chamados">
                <label>Urgência</label>
                <select className="chamados-input" value={novoChamado.urgencia} onChange={(e) => setNovoChamado(prev => ({ ...prev, urgencia: e.target.value }))}>
                  <option value="Pendente">Pendente</option>
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                  <option value="Crítica">Crítica</option>
                </select>
              </div>

              <div className="form-group-chamados">
                <label>Técnico sugerido</label>
                <select className="chamados-input" value={novoChamado.tecnico_responsavel} onChange={(e) => setNovoChamado(prev => ({ ...prev, tecnico_responsavel: e.target.value }))}>
                  <option value="">Seleção automática / sem preferência</option>
                  {tecnicosAbertura?.map(t => (
                    <option key={t.id} value={t.nome_tecnico || t.usuario}>{t.nome_tecnico || t.usuario}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group-chamados">
              <label>Descrição da manutenção *</label>
              <textarea
                className="chamados-textarea"
                placeholder="Ex.: porta sem vedação, ruído no compressor, oscilação de temperatura, painel sem resposta..."
                value={novoChamado.descricao}
                onChange={(e) => setNovoChamado(prev => ({ ...prev, descricao: e.target.value }))}
                rows={4}
              />
            </div>

            <div className="modal-actions-chamados" style={{ marginTop: '0.25rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setMostrarAbrirChamado(false)} disabled={isProcessing}>
                Fechar
              </button>
              <button type="submit" className="btn btn-primary" disabled={isProcessing || isOffline}>
                {isProcessing ? <Loader2 className="spinner" size={18} /> : <MessageSquarePlus size={18} />} Abrir OS
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- NOVA BARRA DE FILTROS (STATUS E URGÊNCIA) --- */}
      <div className="chamados-filters-bar stagger-2" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div className="chamados-tabs">
            <button className={`chamados-tab ${filtroStatus === 'Aberto' ? 'active' : ''}`} onClick={() => setFiltroStatus('Aberto')}>Pendentes</button>
            <button className={`chamados-tab ${filtroStatus === 'Em Atendimento' ? 'active' : ''}`} onClick={() => setFiltroStatus('Em Atendimento')}>Em Andamento</button>
            <button className={`chamados-tab ${filtroStatus === 'Concluído' ? 'active' : ''}`} onClick={() => setFiltroStatus('Concluído')}>Concluídos</button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', overflowX: 'auto', paddingBottom: '4px' }}>
            <span style={{fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold'}}>Urgência:</span>
            <button className={`btn-outline ${filtroUrgencia === 'Todas' ? 'btn-primary' : ''}`} style={{padding: '4px 10px', fontSize: '0.75rem', border: 'none'}} onClick={() => setFiltroUrgencia('Todas')}>Todas</button>
            <button className={`btn-outline ${filtroUrgencia === 'Crítica' ? 'btn-danger' : ''}`} style={{padding: '4px 10px', fontSize: '0.75rem', border: 'none', color: filtroUrgencia !== 'Crítica' ? 'var(--danger)' : ''}} onClick={() => setFiltroUrgencia('Crítica')}>Crítica</button>
            <button className={`btn-outline ${filtroUrgencia === 'Alta' ? 'btn-warning' : ''}`} style={{padding: '4px 10px', fontSize: '0.75rem', border: 'none', color: filtroUrgencia !== 'Alta' ? 'var(--warning)' : ''}} onClick={() => setFiltroUrgencia('Alta')}>Alta</button>
            <button className={`btn-outline ${filtroUrgencia === 'Média' ? 'btn-info' : ''}`} style={{padding: '4px 10px', fontSize: '0.75rem', border: 'none', color: filtroUrgencia !== 'Média' ? 'var(--info)' : ''}} onClick={() => setFiltroUrgencia('Média')}>Média</button>
          </div>
        </div>

        {/* Barra de ferramentas de seleção visível apenas quando há chamados */}
        {chamadosFiltrados.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
             <input 
               type="checkbox" 
               checked={selecionadosIds.size === chamadosFiltrados.length && chamadosFiltrados.length > 0} 
               onChange={toggleSelecionarTodos} 
               style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
               id="selectAllOS"
             />
             <label htmlFor="selectAllOS" style={{fontSize: '0.85rem', color: 'white', cursor: 'pointer', userSelect: 'none'}}>Selecionar Todos da Página</label>
             
             {filtroStatus === 'Concluído' && concluidosCount > 0 && (
              <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.75rem', marginLeft: 'auto', borderColor: 'var(--info)', color: 'var(--info)' }} onClick={() => setModalArquivarTodos(true)}>
                <Archive size={14} style={{marginRight: '6px'}}/> Arquivar Tudo em Lote
              </button>
             )}
          </div>
        )}
      </div>

      <div className="grid-cards stagger-3" style={{ marginTop: '20px' }}>
        {chamadosFiltrados.length === 0 ? (
          <div className="empty-state dashboard-empty" style={{ gridColumn: '1 / -1' }}>
            <CheckCircle size={48} style={{ opacity: 0.3, marginBottom: '1rem', color: 'var(--success)' }} />
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>Nenhuma OS encontrada.</h3>
            <p style={{ color: 'var(--text-muted)' }}>Mude os filtros de status ou urgência para localizar a OS correta.</p>
          </div>
        ) : (
          chamadosFiltrados.map(c => (
            <ChamadoCard 
              key={c.id} 
              c={c} 
              isOffline={isOffline} 
              onResolver={handleResolverClick} 
              onArquivar={handleArquivar} 
              isSelected={selecionadosIds.has(c.id)}
              onToggleSelection={toggleSelecaoChamado}
            />
          ))
        )}
      </div>

      {chamadoResolvendo && (
        <div className="chamados-fixed-overlay anim-fade-in">
          <div className="chamados-modal-box">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', margin: '0 0 1rem 0' }}>
              <CheckSquare size={24} /> Concluir OS-{chamadoResolvendo.id}
            </h3>
            <div className="form-group-chamados" style={{ marginBottom: '1.5rem' }}>
              <label>Nota de Resolução Técnica *</label>
              <textarea 
                className="chamados-textarea" 
                placeholder="Descreva o que foi feito para corrigir o problema..." 
                value={notaResolucao} 
                onChange={e => setNotaResolucao(e.target.value)}
                autoFocus
              ></textarea>
            </div>
            <div className="modal-actions-chamados">
              <button className="btn btn-outline" onClick={() => setChamadoResolvendo(null)} disabled={isProcessing}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarResolucao} disabled={isProcessing || isOffline || !notaResolucao.trim()}>
                {isProcessing ? <Loader2 className="spinner" size={18} /> : <Save size={18} />} Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalArquivarTodos && (
        <div className="chamados-fixed-overlay anim-fade-in">
          <div className="chamados-modal-box" style={{ borderTop: '4px solid var(--info)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--info)', margin: '0 0 1rem 0' }}><Archive size={24} /> Arquivar Ocorrências</h3>
            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              Tem certeza que deseja mover <strong>{concluidosCount} chamado(s) concluído(s)</strong> para o Arquivo Histórico?<br/><br/>Eles sairão deste painel principal e ficarão disponíveis permanentemente na seção de Arquivo Técnico.
            </p>
            <div className="modal-actions-chamados">
              <button className="btn btn-outline" onClick={() => setModalArquivarTodos(false)} disabled={isProcessing}>Cancelar</button>
              <button className="btn" style={{ background: 'var(--info)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', border: 'none' }} onClick={confirmarArquivarTodos} disabled={isProcessing || isOffline}>
                {isProcessing ? <Loader2 className="spinner" size={18} /> : <CheckCircle size={18} />} Confirmar Arquivamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}