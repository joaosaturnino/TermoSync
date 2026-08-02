import React, { useState, useMemo, useCallback, memo } from 'react';
import { 
  Printer, MessageSquarePlus, CheckCircle, Wrench, Save, 
  MapPin, User, Clock, CheckSquare, Archive, 
  Search, AlertTriangle, Loader2, Info, Shield
} from 'lucide-react';
import './Chamados.css';
import Loader from '../../components/Loader';
import EmptyState from '../../components/EmptyState';

// ============================================================================
// COMPONENTE OTIMIZADO (MEMO): Evita a re-renderização massiva da lista
// ============================================================================
const ChamadoCard = memo(({ c, isOffline, onResolver, onArquivar, isSelected, onToggleSelection, userRole }) => {
  // Tolerância a acentos e espaços vazios originados do banco de dados
  const statusSeguro = String(c.status || '').trim().toLowerCase();
  const isConcluido = statusSeguro === 'concluído' || statusSeguro === 'concluido' || statusSeguro === 'fechado';
  
  const urgenciaLimpa = c.urgencia ? String(c.urgencia).trim().toLowerCase().replace('í', 'i') : 'pendente';
  const isCritico = urgenciaLimpa === 'critica';

  const urgencyColor = useMemo(() => {
    if (isCritico) return 'var(--danger)';
    if (urgenciaLimpa === 'alta') return 'var(--warning)';
    if (urgenciaLimpa === 'media') return 'var(--info)';
    return 'var(--text-muted)';
  }, [urgenciaLimpa, isCritico]);

  return (
    <div className={`card chamado-card ${isConcluido ? 'concluido' : ''} ${isCritico && !isConcluido ? 'critica' : ''}`} style={{ '--ticket-color': isConcluido ? 'var(--success)' : urgencyColor }}>
      <div className="chamado-card-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {/* CHECKBOX DE SELEÇÃO EM LOTE */}
          <input 
            type="checkbox" 
            checked={isSelected} 
            onChange={() => onToggleSelection(c.id)} 
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)', marginTop: '4px', flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <span className="chamado-equip">{c.equipamento_nome || 'Equipamento Geral'}</span>
            <div className="chamado-badges">
              <span className="badge-os">OS-{c.id}</span>
              {c.urgencia && c.urgencia !== 'Pendente' && (
                <span className={`badge-urgencia ${urgenciaLimpa}`}>
                  {c.urgencia}
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={`status-pill ${statusSeguro.replace(' ', '-')}`}>{c.status}</span>
      </div>
      
      <div className="chamado-body">
        <p className="chamado-desc">"{c.descricao || 'Sem descrição.'}"</p>
        
        <div className="chamado-meta">
          <span title="Filial / Loja"><MapPin size={16}/> {c.filial || c.equipamento_filial || 'Filial Principal'}</span>
          <span title="Solicitante"><User size={16}/> {c.solicitante_nome || c.aberto_por || 'Sistema'}</span>
          <span title="Técnico Responsável"><Wrench size={16}/> {c.tecnico_responsavel || 'Aguardando Atribuição'}</span>
          <span title="Abertura"><Clock size={16}/> {new Date(c.data_abertura).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>

        {isConcluido && c.nota_resolucao && (
          <div className="chamado-resolution">
            <strong><CheckSquare size={14} style={{display:'inline', marginBottom:'-2px'}}/> Laudo de Resolução:</strong> 
            <p>{c.nota_resolucao}</p>
          </div>
        )}
      </div>

      <div className="chamado-footer">
        {isConcluido ? (
          <button className="btn btn-outline w-100" onClick={() => onArquivar(c.id)} disabled={isOffline} style={{borderColor: 'var(--border)', color: 'var(--text-muted)'}}>
            <Archive size={16} style={{marginRight: '6px'}}/> Mover para o Arquivo Histórico
          </button>
        ) : (
          <button className="btn btn-primary w-100" onClick={() => onResolver(c.id, c)} disabled={isOffline}>
            <CheckSquare size={16} style={{marginRight: '6px'}}/> Registrar Intervenção Técnica
          </button>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
/**
 * Central de Chamados (Ordens de Serviço)
 *
 * Responsabilidades:
 * - Listar e filtrar OS por filial, status e urgência
 * - Abrir novas ordens, atribuir técnicos e registrar resolução
 * - Suportar seleção em lote para relatórios/impressão
 */
export default function Chamados({ 
  userRole, filialAtiva, nomeLogado, chamados = [], tecnicosDb = [], 
  api, carregarChamados, showToast, isOffline, gerarLoteOS 
}) {
  
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Aberto');
  const [filtroUrgencia, setFiltroUrgencia] = useState('Todas');
  
  const [novoChamado, setNovoChamado] = useState({ equipamento_id: '', urgencia: 'Pendente', descricao: '', tecnico_responsavel: '' });
  const [mostrarAbrirChamado, setMostrarAbrirChamado] = useState(false);
  
  const [equipamentosAbertura, setEquipamentosAbertura] = useState([]);
  const [tecnicosAbertura, setTecnicosAbertura] = useState([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalArquivarTodos, setModalArquivarTodos] = useState(false);
  const [chamadoResolvendo, setChamadoResolvendo] = useState(null);
  const [notaResolucao, setNotaResolucao] = useState('');

  const [selecionadosIds, setSelecionadosIds] = useState(new Set());

  // Perfis de Segurança
  const isDevOrAdmin = userRole === 'DEV' || userRole === 'ADMIN';
  const isLoja = userRole === 'LOJA';

  // CARREGA OS EQUIPAMENTOS PARA ABERTURA DE OS (Seguro por Filial)
  const carregarOpcoesAbertura = useCallback(async () => {
    if (!api || isOffline) return;
    try {
      const [resEquip, resTec] = await Promise.all([
        api.get('/auxiliares/equipamentos-abertura').catch(() => ({ data: [] })),
        api.get('/tecnicos').catch(() => ({ data: [] }))
      ]);
      
      let equipList = Array.isArray(resEquip.data) ? resEquip.data : [];
      
      // Filtro de Segurança Visual: Se for Loja ou se estiver numa filial específica, mostra só as máquinas dessa filial
      if (filialAtiva !== 'Todas') {
        const filialFiltro = filialAtiva.trim().toLowerCase();
        equipList = equipList.filter(eq => (eq.filial || 'Loja Principal').trim().toLowerCase() === filialFiltro);
      }
      
      setEquipamentosAbertura(equipList);
      setTecnicosAbertura(Array.isArray(resTec.data) ? resTec.data : []);
    } catch (error) {
      showToast('Aviso: Não foi possível carregar as opções de abertura.', 'warning');
    }
  }, [api, isOffline, showToast, filialAtiva]);

  React.useEffect(() => {
    carregarOpcoesAbertura();
  }, [carregarOpcoesAbertura]);

  // MOTOR DE FILTRAGEM E ISOLAMENTO DE DADOS (TOLERANTE A FALHAS DE BANCO DE TESTE)
  const chamadosFiltrados = useMemo(() => {
    let filtrados = chamados || [];
    
    // 1. Isolamento de Filial Rigoroso (Tolerante se o DB tiver OS sem filial)
    if (filialAtiva !== 'Todas') {
      const filialTarget = String(filialAtiva).trim().toLowerCase();
      filtrados = filtrados.filter(c => {
        // Se a OS for de teste e não tiver filial preenchida, assumimos temporariamente a filial atual
        const filialOS = String(c.filial || c.equipamento_filial || filialAtiva).trim().toLowerCase();
        return filialOS === filialTarget;
      });
    }
    
    // 2. Filtro de Status à Prova de Falhas (Ignorar espaços em branco e arquivados falsos)
    const targetStatus = String(filtroStatus).trim().toLowerCase();
    
    filtrados = filtrados.filter(c => {
      // Bloqueia qualquer variação que signifique "arquivado" no banco de dados
      const isArquivado = c.arquivado == 1 || c.arquivado === true || String(c.arquivado).toLowerCase() === 'true';
      if (isArquivado) return false;

      // Valida o Status
      const statusAtual = String(c.status || '').trim().toLowerCase();
      return statusAtual === targetStatus;
    });
    
    // 3. Filtro de Urgência
    if (filtroUrgencia !== 'Todas') {
      const urgenciaDesejada = String(filtroUrgencia).trim().toLowerCase();
      filtrados = filtrados.filter(c => String(c.urgencia || '').trim().toLowerCase() === urgenciaDesejada);
    }
    
    // 4. Busca Global em Texto
    if (busca.trim()) {
      const b = busca.toLowerCase();
      filtrados = filtrados.filter(c => 
        String(c.equipamento_nome || '').toLowerCase().includes(b) || 
        String(c.descricao || '').toLowerCase().includes(b) || 
        String(c.id).includes(b) ||
        String(c.tecnico_responsavel || '').toLowerCase().includes(b)
      );
    }

    // 5. Ordenação Tática: Urgência primeiro, depois data de abertura
    const urgenciaPeso = { 'crítica': 4, 'critica': 4, 'alta': 3, 'média': 2, 'media': 2, 'baixa': 1, 'pendente': 0 };
    return filtrados.sort((a, b) => {
       const pA = String(a.urgencia || '').trim().toLowerCase();
       const pB = String(b.urgencia || '').trim().toLowerCase();
       const pesoA = urgenciaPeso[pA] || 0;
       const pesoB = urgenciaPeso[pB] || 0;
       
       if (pesoA !== pesoB) return pesoB - pesoA; // Mais urgente sobe no radar
       return new Date(b.data_abertura).getTime() - new Date(a.data_abertura).getTime(); // Mais recente sobe
    });

  }, [chamados, filialAtiva, filtroStatus, filtroUrgencia, busca]);

  // Contagem Tolerante de OS Concluídas na Tela
  const concluidosCount = useMemo(() => {
    return chamadosFiltrados.filter(c => {
      const s = String(c.status || '').trim().toLowerCase();
      return s === 'concluído' || s === 'concluido' || s === 'fechado';
    }).length;
  }, [chamadosFiltrados]);

  // SELEÇÃO EM LOTE PARA IMPRESSÃO / RELATÓRIO
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
      setSelecionadosIds(new Set()); 
    } else {
      setSelecionadosIds(new Set(chamadosFiltrados.map(c => c.id))); 
    }
  };

  const handleGerarLoteExato = () => {
    if (selecionadosIds.size > 0) {
      const loteCustomizado = chamadosFiltrados.filter(c => selecionadosIds.has(c.id));
      gerarLoteOS(loteCustomizado);
    } else {
      gerarLoteOS(chamadosFiltrados);
    }
  };

  // ABERTURA DE CHAMADOS
  const handleAbrirChamado = async (e) => {
    e.preventDefault();
    if (isOffline) return showToast('Ação bloqueada no modo offline.', 'warning');
    if (!novoChamado.equipamento_id || !novoChamado.descricao.trim()) {
      return showToast('Selecione a máquina afetada e descreva o problema.', 'warning');
    }

    setIsProcessing(true);
    try {
      await api.post('/chamados', {
        equipamento_id: novoChamado.equipamento_id,
        descricao: novoChamado.descricao,
        solicitante_nome: nomeLogado || 'Colaborador',
        tecnico_responsavel: novoChamado.tecnico_responsavel || null,
        urgencia: novoChamado.urgencia
      });
      await carregarChamados();
      setNovoChamado({ equipamento_id: '', urgencia: 'Pendente', descricao: '', tecnico_responsavel: '' });
      setMostrarAbrirChamado(false);
      showToast('Ordem de Serviço (OS) gerada e notificada à equipa.', 'success');
    } catch (error) {
      showToast('Falha ao abrir a OS. Tente novamente.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // GERENCIAMENTO DE ESTADOS DO CHAMADO
  const handleResolverClick = useCallback((id, c) => { setChamadoResolvendo(c); setNotaResolucao(''); }, []);
  
  const confirmarResolucao = async () => {
    if (isOffline || !chamadoResolvendo) return;
    setIsProcessing(true);
    try {
      await api.put(`/chamados/${chamadoResolvendo.id}`, { status: 'Concluído', nota_resolucao: notaResolucao });
      await carregarChamados();
      showToast('Intervenção técnica finalizada com sucesso.', 'success');
      setChamadoResolvendo(null);
    } catch (error) { showToast('Falha ao concluir a OS.', 'error'); } 
    finally { setIsProcessing(false); }
  };

  const handleArquivar = useCallback(async (id) => {
    if (isOffline) return showToast('Ação bloqueada no modo offline.', 'warning');
    setIsProcessing(true);
    try { 
      await api.put(`/chamados/${id}/arquivar`); 
      await carregarChamados(); 
      showToast('Laudo movido para o Arquivo Histórico.', 'success'); 
    } catch (error) { showToast('Erro ao arquivar chamado.', 'error'); } 
    finally { setIsProcessing(false); }
  }, [api, carregarChamados, isOffline, showToast]);

  const confirmarArquivarTodos = async () => {
    if (isOffline) return showToast('Ação bloqueada no modo offline.', 'warning');
    setIsProcessing(true);
    try {
      const chamadosParaArquivar = chamadosFiltrados.filter(c => {
        const s = String(c.status || '').trim().toLowerCase();
        return s === 'concluído' || s === 'concluido' || s === 'fechado';
      });
      
      for (const c of chamadosParaArquivar) { await api.put(`/chamados/${c.id}/arquivar`); }
      await carregarChamados();
      showToast(`${chamadosParaArquivar.length} chamado(s) arquivado(s).`, 'success');
      setModalArquivarTodos(false);
    } catch (error) { showToast('Erro durante o arquivamento em lote.', 'error'); } 
    finally { setIsProcessing(false); }
  };

  return (
    <div className="anim-fade-in stagger-1">
      
      <div className="chamados-header">
        <div>
          <h2 className="chamados-title">Centro de Manutenção (Service Desk)</h2>
          <p className="chamados-subtitle">Gestão ativa de Ordens de Serviço, reparos e solicitações técnicas da unidade.</p>
        </div>
        
        <div className="chamados-actions">
          <div className="search-box-chamados">
            <Search size={18} className="search-icon" />
            <input type="text" placeholder="Localizar OS, Máquina ou Defeito..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          <button className="btn btn-primary" onClick={() => setMostrarAbrirChamado(prev => !prev)} type="button">
            <MessageSquarePlus size={18} style={{marginRight: '8px'}} />
            <span className="desktop-only-inline">{mostrarAbrirChamado ? 'Cancelar Abertura' : 'Abrir Nova OS'}</span>
            <span className="mobile-only-inline">{mostrarAbrirChamado ? 'Cancelar' : 'Nova OS'}</span>
          </button>

          <button className="btn btn-outline" onClick={handleGerarLoteExato} disabled={chamadosFiltrados.length === 0} title={selecionadosIds.size > 0 ? `Exportar ${selecionadosIds.size} selecionados` : 'Exportar Filtro Atual'} style={{ borderColor: 'var(--info)', color: 'var(--info)' }}>
            <Printer size={18} style={{marginRight: '8px'}} />
            <span className="desktop-only-inline">Imprimir Fichas</span>
            {selecionadosIds.size > 0 && <span style={{marginLeft: '6px', background: 'var(--info)', color: '#fff', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold'}}>{selecionadosIds.size}</span>}
          </button>
        </div>
      </div>

      {mostrarAbrirChamado && (
        <div className="chamados-open-panel stagger-2 anim-slide-up">
          <div className="chamados-open-panel-copy">
            <span className="chamados-open-kicker"><Wrench size={14} /> Manutenção da Loja</span>
            <h3>Abra a solicitação para o Suporte Técnico</h3>
            <p>Selecione a máquina comprometida e descreva o cenário com o máximo de detalhes possível para acelerar o diagnóstico.</p>
            {isLoja && <p style={{marginTop: '10px', fontSize: '0.75rem', color: 'var(--primary)'}}><Shield size={12} style={{display:'inline', marginBottom:'-2px'}}/> Acesso seguro: Apenas máquinas da sua filial são exibidas.</p>}
          </div>

          <form className="chamados-open-form" onSubmit={handleAbrirChamado}>
            <div className="form-group-chamados">
              <label>Selecione o Equipamento *</label>
              <select className="chamados-input" value={novoChamado.equipamento_id} onChange={(e) => setNovoChamado(prev => ({ ...prev, equipamento_id: e.target.value }))}>
                <option value="">-- Escolher Máquina/Câmara --</option>
                {equipamentosAbertura.length === 0 ? (
                  <option value="" disabled>Nenhuma máquina registrada nesta filial.</option>
                ) : (
                  equipamentosAbertura.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.nome} {eq.setor ? `(${eq.setor})` : ''}</option>
                  ))
                )}
              </select>
            </div>

            <div className="form-grid-chamados-2">
              <div className="form-group-chamados">
                <label>Nível de Urgência</label>
                <select className="chamados-input" value={novoChamado.urgencia} onChange={(e) => setNovoChamado(prev => ({ ...prev, urgencia: e.target.value }))}>
                  <option value="Pendente">Normal / Pendente</option>
                  <option value="Baixa">Baixa (Pode Aguardar)</option>
                  <option value="Média">Média (Atenção Necessária)</option>
                  <option value="Alta">Alta (Risco Iminente)</option>
                  <option value="Crítica">Crítica (Risco de Perda Total)</option>
                </select>
              </div>

              <div className="form-group-chamados">
                <label>Atribuir a um Técnico</label>
                <select className="chamados-input" value={novoChamado.tecnico_responsavel} onChange={(e) => setNovoChamado(prev => ({ ...prev, tecnico_responsavel: e.target.value }))}>
                  <option value="">Fila Geral (Automático)</option>
                  {tecnicosAbertura?.map(t => (
                    <option key={t.id} value={t.nome_tecnico || t.usuario}>{t.nome_tecnico || t.usuario}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group-chamados">
              <label>Descrição do Diagnóstico / Problema *</label>
              <textarea
                className="chamados-textarea"
                placeholder="Ex.: porta sem vedação, ruído no compressor, oscilação térmica fora do padrão..."
                value={novoChamado.descricao}
                onChange={(e) => setNovoChamado(prev => ({ ...prev, descricao: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="modal-actions-chamados" style={{ marginTop: '0', paddingTop: '0', border: 'none' }}>
              <button type="button" className="btn btn-outline" onClick={() => setMostrarAbrirChamado(false)} disabled={isProcessing}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={isProcessing || isOffline}>
                {isProcessing ? <Loader2 className="spinner" size={18} /> : <MessageSquarePlus size={18} />} Protocolar OS
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- BARRA DE FILTROS TÁTICOS (STATUS E URGÊNCIA) --- */}
      <div className="chamados-filters-bar stagger-2">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          
          <div className="chamados-tabs">
            <button className={`chamados-tab ${filtroStatus === 'Aberto' ? 'active' : ''}`} onClick={() => setFiltroStatus('Aberto')}>Abertos / Pendentes</button>
            <button className={`chamados-tab ${filtroStatus === 'Em Atendimento' ? 'active' : ''}`} onClick={() => setFiltroStatus('Em Atendimento')}>Em Diagnóstico</button>
            <button className={`chamados-tab ${filtroStatus === 'Concluído' ? 'active' : ''}`} onClick={() => setFiltroStatus('Concluído')}>Concluídos (Aguardando Arquivo)</button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', overflowX: 'auto', paddingBottom: '4px', flexShrink: 0 }}>
            <span style={{fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase'}}>Urgência:</span>
            <button className={`btn-outline ${filtroUrgencia === 'Todas' ? 'btn-primary' : ''}`} style={{padding: '6px 12px', fontSize: '0.75rem', border: 'none', background: filtroUrgencia === 'Todas' ? 'var(--primary)' : 'rgba(0,0,0,0.05)', color: filtroUrgencia === 'Todas' ? 'var(--bg-color)' : 'var(--text-main)'}} onClick={() => setFiltroUrgencia('Todas')}>Todas</button>
            <button className={`btn-outline ${filtroUrgencia === 'Crítica' ? 'btn-danger' : ''}`} style={{padding: '6px 12px', fontSize: '0.75rem', border: 'none', background: filtroUrgencia === 'Crítica' ? 'var(--danger)' : 'rgba(239, 68, 68, 0.1)', color: filtroUrgencia === 'Crítica' ? '#fff' : 'var(--danger)'}} onClick={() => setFiltroUrgencia('Crítica')}>Crítica</button>
            <button className={`btn-outline ${filtroUrgencia === 'Alta' ? 'btn-warning' : ''}`} style={{padding: '6px 12px', fontSize: '0.75rem', border: 'none', background: filtroUrgencia === 'Alta' ? 'var(--warning)' : 'rgba(245, 158, 11, 0.1)', color: filtroUrgencia === 'Alta' ? '#fff' : 'var(--warning)'}} onClick={() => setFiltroUrgencia('Alta')}>Alta</button>
          </div>
        </div>

        {/* Barra de Seleção em Lote */}
        {chamadosFiltrados.length > 0 && (
          <div className="anim-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(56, 189, 248, 0.05)', padding: '10px 15px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)', width: '100%', flexWrap: 'wrap' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
               <input 
                 type="checkbox" 
                 checked={selecionadosIds.size === chamadosFiltrados.length && chamadosFiltrados.length > 0} 
                 onChange={toggleSelecionarTodos} 
                 style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                 id="selectAllOS"
               />
               <label htmlFor="selectAllOS" style={{fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none', fontWeight: '700'}}>Selecionar {chamadosFiltrados.length} Registros na Tela</label>
             </div>
             
             {filtroStatus === 'Concluído' && concluidosCount > 0 && (
              <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.8rem', marginLeft: 'auto', borderColor: 'var(--border)', color: 'var(--text-main)', background: 'var(--card-bg)' }} onClick={() => setModalArquivarTodos(true)}>
                <Archive size={14} style={{marginRight: '6px', color: 'var(--text-muted)'}}/> Mover todos para Arquivo
              </button>
             )}
          </div>
        )}
      </div>

      <div className="grid-cards stagger-3">
        {chamadosFiltrados.length === 0 ? (
          <EmptyState title={busca ? 'Nenhum resultado' : 'Painel Limpo'} description={busca ? 'Nenhum resultado corresponde à sua pesquisa.' : `Nenhuma Ordem de Serviço encontrada na categoria "${filtroStatus}".`} icon={CheckCircle} />
        ) : (
          chamadosFiltrados.map(c => (
            <ChamadoCard 
              key={c.id} 
              c={c} 
              userRole={userRole}
              isOffline={isOffline} 
              onResolver={handleResolverClick} 
              onArquivar={handleArquivar} 
              isSelected={selecionadosIds.has(c.id)}
              onToggleSelection={toggleSelecaoChamado}
            />
          ))
        )}
      </div>

      {/* MODAL DE CONCLUSÃO DE OS */}
      {chamadoResolvendo && (
        <div className="chamados-fixed-overlay anim-fade-in">
          <div className="chamados-modal-box">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', margin: '0 0 1rem 0' }}>
              <CheckSquare size={24} /> Concluir OS-{chamadoResolvendo.id}
            </h3>
            
            <div className="form-group-chamados" style={{ marginBottom: '1.5rem' }}>
              <label>Laudo de Resolução Técnica *</label>
              <textarea 
                className="textarea-chamado" 
                placeholder="Descreva detalhadamente o serviço executado, peças trocadas e o diagnóstico final para efeitos de auditoria..." 
                value={notaResolucao} 
                onChange={e => setNotaResolucao(e.target.value)}
                rows={5}
                autoFocus
              ></textarea>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px', display: 'inline-block' }}><Info size={12} style={{display:'inline', marginBottom:'-2px'}}/> Este laudo será imutável e assinado digitalmente após a confirmação.</span>
            </div>
            
            <div className="modal-actions-chamados">
              <button className="btn btn-outline" onClick={() => setChamadoResolvendo(null)} disabled={isProcessing}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarResolucao} disabled={isProcessing || isOffline || !notaResolucao.trim()}>
                {isProcessing ? <Loader2 className="spinner" size={18} /> : <Save size={18} />} Finalizar e Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ARQUIVAMENTO EM LOTE */}
      {modalArquivarTodos && (
        <div className="chamados-fixed-overlay anim-fade-in">
          <div className="chamados-modal-box" style={{ borderTop: '4px solid var(--text-muted)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', margin: '0 0 1rem 0' }}>
              <Archive size={24} color="var(--text-muted)" /> Arquivar OS Concluídas
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6', margin: '0 0 1.5rem 0' }}>
              Tem certeza que deseja mover <strong>{concluidosCount} OS Concluídas</strong> para o Arquivo Histórico?
              <br/><br/>
              Eles sairão do painel ativo da Loja/Manutenção e ficarão disponíveis permanentemente na aba de Histórico e Auditoria.
            </p>
            <div className="modal-actions-chamados">
              <button className="btn btn-outline" onClick={() => setModalArquivarTodos(false)} disabled={isProcessing}>Cancelar</button>
              <button className="btn" style={{ background: 'var(--text-main)', color: 'var(--bg-color)', display: 'flex', alignItems: 'center', gap: '8px', border: 'none' }} onClick={confirmarArquivarTodos} disabled={isProcessing || isOffline}>
                {isProcessing ? <Loader2 className="spinner" size={18} /> : <Archive size={18} />} Sim, Mover Todos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}