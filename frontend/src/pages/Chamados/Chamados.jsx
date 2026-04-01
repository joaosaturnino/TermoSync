import React, { useState, useMemo } from 'react';
import { Printer, MessageSquarePlus, CheckCircle, Wrench, Save, MapPin, User, AlertCircle, Clock, CheckSquare } from 'lucide-react';
import './Chamados.css';

export default function Chamados({ 
  userRole, filialAtiva, nomeLogado, chamados, tecnicosDb, equipamentosDaFilial, 
  nomeGerente, nomeCoordenador, api, carregarChamados, showToast, isOffline, gerarLoteOS 
}) {
  const [tecnicoFiltroOS, setTecnicoFiltroOS] = useState('todos');
  const [filtroTempoOS, setFiltroTempoOS] = useState('todos');
  
  // Modais
  const [modalChamado, setModalChamado] = useState(false);
  const [formChamado, setFormChamado] = useState({ equipamento_id: '', descricao: '', solicitante_nome: '', tecnico_responsavel: '' });
  
  const [modalResolver, setModalResolver] = useState({ isOpen: false, chamadoId: null, nota: '' });

  const chamadosAtivosFiltrados = useMemo(() => {
    const trintaDiasAtras = new Date(); trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    let list = chamados.filter(c => c.status !== 'Concluído' || new Date(c.data_conclusao) >= trintaDiasAtras);
    
    if (userRole === 'ADMIN' && filialAtiva !== 'Todas') list = list.filter(c => c.filial === filialAtiva);
    if (userRole === 'MANUTENCAO') list = list.filter(c => c.tecnico_responsavel === nomeLogado);
    else if (tecnicoFiltroOS !== 'todos') list = list.filter(c => c.tecnico_responsavel === tecnicoFiltroOS);
    
    const hoje = new Date();
    if (filtroTempoOS === 'dia') list = list.filter(c => new Date(c.data_abertura).toDateString() === hoje.toDateString() || (c.data_conclusao && new Date(c.data_conclusao).toDateString() === hoje.toDateString()));
    else if (filtroTempoOS === 'semana') { const seteDias = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000); list = list.filter(c => new Date(c.data_abertura) >= seteDias || (c.data_conclusao && new Date(c.data_conclusao) >= seteDias)); }
    else if (filtroTempoOS === 'mes') { const mesAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000); list = list.filter(c => new Date(c.data_abertura) >= mesAtras || (c.data_conclusao && new Date(c.data_conclusao) >= mesAtras)); }
    return list;
  }, [chamados, filialAtiva, userRole, nomeLogado, tecnicoFiltroOS, filtroTempoOS]);

  const concluirChamado = async (e) => {
    e.preventDefault();
    if (isOffline) return showToast('Ação bloqueada offline.', 'warning');
    if (!modalResolver.nota.trim()) return showToast('A nota de resolução é obrigatória.', 'warning');
    
    try {
      await api.put(`/chamados/${modalResolver.chamadoId}/status`, { status: 'Concluído', nota_resolucao: modalResolver.nota });
      showToast('Chamado concluído com sucesso!', 'success');
      setModalResolver({ isOpen: false, chamadoId: null, nota: '' });
      carregarChamados();
    } catch (err) {
      showToast('Erro ao concluir o chamado.', 'error');
    }
  };

  return (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 style={{ margin: 0 }}>Central de Chamados Técnicos</h3>
        <div className="action-group">
          {userRole !== 'MANUTENCAO' && (
            <select className="select-input chamados-filter-select" value={tecnicoFiltroOS} onChange={e => setTecnicoFiltroOS(e.target.value)}>
              <option value="todos">Todos os Técnicos</option>
              {tecnicosDb?.map(tec => <option key={tec.id} value={tec.nome_tecnico}>{tec.nome_tecnico}</option>)}
            </select>
          )}
          <select className="select-input chamados-filter-select" value={filtroTempoOS} onChange={e => setFiltroTempoOS(e.target.value)}>
            <option value="todos">Todo o Período</option>
            <option value="dia">Apenas de Hoje</option>
            <option value="semana">Últimos 7 dias</option>
            <option value="mes">Últimos 30 dias</option>
          </select>
          
          <button className="btn btn-outline btn-print-os" onClick={() => gerarLoteOS(chamadosAtivosFiltrados?.filter(c => c.status === 'Concluído') || [])}>
            <Printer size={18} /> Imprimir OS ({(chamadosAtivosFiltrados?.filter(c => c.status === 'Concluído') || []).length})
          </button>
          
          {userRole !== 'MANUTENCAO' && (
            <button className="btn btn-primary" onClick={() => {
              if (!equipamentosDaFilial || equipamentosDaFilial.length === 0) return showToast("Não existem equipamentos nesta unidade para abrir um chamado.", "warning");
              let solicitanteAuto = userRole === 'ADMIN' ? 'Administração Central' : (nomeGerente ? `Gerente - ${nomeGerente}` : (nomeCoordenador ? `Coordenador - ${nomeCoordenador}` : 'Equipe da Loja'));
              setFormChamado({ equipamento_id: equipamentosDaFilial[0].id, descricao: '', solicitante_nome: solicitanteAuto, tecnico_responsavel: '' }); setModalChamado(true);
            }}><MessageSquarePlus size={18} /> Abrir Chamado</button>
          )}
        </div>
      </div>

      {!chamadosAtivosFiltrados || chamadosAtivosFiltrados.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '2rem' }}>
          <CheckCircle size={64} color="var(--success)" style={{ marginBottom: '1rem', animation: 'pulseSoftGreen 2s infinite' }} />
          <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Sem Ocorrências Pendentes</h3>
          <p style={{ color: 'var(--text-muted)' }}>A central de máquinas está saudável ou os filtros não encontram resultados.</p>
        </div>
      ) : (
        <div className="grid-cards" style={{ marginTop: '1.5rem' }}>
          {chamadosAtivosFiltrados.map(c => {
            // Definição da Cor Dinâmica por Urgência / Status
            let colorTheme = 'var(--info)';
            if (c.status === 'Concluído') colorTheme = 'var(--success)';
            else if (c.urgencia === 'Crítica') colorTheme = 'var(--danger)';
            else if (c.urgencia === 'Alta') colorTheme = '#f97316'; // Laranja
            else if (c.urgencia === 'Média') colorTheme = 'var(--warning)';

            return (
              <div key={c.id} className="card chamado-card" style={{ '--ticket-color': colorTheme }}>
                
                <div className="chamado-header">
                  <div className="chamado-equip-title">
                    <Wrench size={22} color={colorTheme} />
                    {c.equipamento_nome}
                  </div>
                  <span className="chamado-status-badge">{c.status}</span>
                </div>
                
                <div className="chamado-desc-box">
                  "{c.descricao}"
                </div>
                
                <div className="chamado-meta-grid">
                  <div className="chamado-meta-item">
                    <MapPin size={16} /> Loja/Filial: <strong>{c.filial}</strong>
                  </div>
                  <div className="chamado-meta-item">
                    <User size={16} /> Solicitante: <strong>{c.solicitante_nome || c.aberto_por}</strong>
                  </div>
                  <div className="chamado-meta-item" style={{ color: c.status !== 'Concluído' ? 'var(--info)' : 'var(--text-muted)' }}>
                    <Wrench size={16} /> Técnico: <strong>{c.tecnico_responsavel || 'Equipe Geral'}</strong>
                  </div>
                  {c.status !== 'Concluído' && (
                    <div className="chamado-meta-item" style={{ color: colorTheme }}>
                      <AlertCircle size={16} /> Urgência: <strong>{c.urgencia}</strong>
                    </div>
                  )}
                  <div className="chamado-meta-item">
                    <Clock size={16} /> Abertura: {new Date(c.data_abertura).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>
                
                {c.status === 'Concluído' && (
                  <div className="chamado-resolucao">
                    <div className="chamado-resolucao-title"><CheckSquare size={16} /> Nota de Resolução:</div>
                    <div className="chamado-resolucao-text">{c.nota_resolucao}</div>
                    <div className="chamado-resolucao-date">Concluído em: {c.data_conclusao ? new Date(c.data_conclusao).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}</div>
                  </div>
                )}
                
                {c.status !== 'Concluído' && (
                  <div className="chamado-actions">
                    {userRole === 'ADMIN' && (
                      <select className="select-input w-100" value={c.urgencia} onChange={(e) => api.put(`/chamados/${c.id}/urgencia`, { urgencia: e.target.value }).then(carregarChamados)}>
                        <option value="Pendente">Urgência: Pendente...</option>
                        <option value="Baixa">Baixa</option>
                        <option value="Média">Média</option>
                        <option value="Alta">Alta</option>
                        <option value="Crítica">Crítica (Imediato)</option>
                      </select>
                    )}
                    
                    {(userRole === 'ADMIN' || userRole === 'MANUTENCAO') && (
                      <button className="btn btn-outline w-100" style={{ borderColor: 'var(--success)', color: 'var(--success)' }} onClick={() => setModalResolver({ isOpen: true, chamadoId: c.id, nota: '' })}>
                        <CheckCircle size={16} /> Marcar como Corrigido
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 🔴 MODAL PARA ABRIR NOVO CHAMADO */}
      {modalChamado && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '100%' }}>
            <h3><Wrench size={20} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--primary)' }}/> Nova Ordem de Serviço</h3>
            <form onSubmit={async (e) => { e.preventDefault(); if (isOffline) return showToast('Ação bloqueada.', 'warning'); if (!formChamado.equipamento_id) return showToast('Selecione um equipamento.', 'error'); try { await api.post('/chamados', formChamado); showToast('Chamado aberto!', 'success'); setModalChamado(false); carregarChamados(); } catch (err) { showToast('Erro ao abrir o chamado.', 'error'); } }}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div>
                  <label>Máquina / Equipamento</label>
                  <select className="select-input w-100" value={formChamado.equipamento_id} onChange={e => setFormChamado({...formChamado, equipamento_id: e.target.value})} required>
                    <option value="">Selecione...</option>
                    {equipamentosDaFilial?.map(eq => (<option key={eq.id} value={eq.id}>{userRole === 'ADMIN' ? `[${eq.filial}] ` : ''}{eq.nome} - {eq.setor}</option>))}
                  </select>
                </div>
                
                <div>
                  <label>Descrição do Problema</label>
                  <textarea className="textarea-chamado" rows="4" placeholder="Ex: O compressor está a fazer um ruído estranho..." value={formChamado.descricao} onChange={e => setFormChamado({...formChamado, descricao: e.target.value})} required />
                </div>
                
                <div>
                  <label>Nome do Solicitante</label>
                  <input type="text" className="input-readonly w-100" value={formChamado.solicitante_nome} readOnly />
                </div>
                
                <div>
                  <label>Técnico Específico (Opcional)</label>
                  <select className="select-input w-100" value={formChamado.tecnico_responsavel} onChange={e => setFormChamado({...formChamado, tecnico_responsavel: e.target.value})}>
                    <option value="">Deixar em aberto</option>
                    {tecnicosDb?.map(t => <option key={t.id} value={t.nome_tecnico}>{t.nome_tecnico}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setModalChamado(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary"><Save size={18}/> Abrir Chamado</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔴 NOVO: MODAL PREMIUM DE RESOLUÇÃO */}
      {modalResolver.isOpen && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '15vh' }}>
          <div className="modal-content" style={{ maxWidth: '450px', width: '100%' }}>
            <h3><CheckSquare size={22} style={{ color: 'var(--success)', marginRight: '8px' }} /> Concluir Chamado</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Descreva brevemente a intervenção técnica realizada para manter o histórico de manutenção rigoroso.
            </p>
            <form onSubmit={concluirChamado}>
              <div className="form-group">
                <label>Nota de Resolução Técnica</label>
                <textarea 
                  className="textarea-chamado" 
                  rows="4" 
                  placeholder="Ex: Substituição da válvula solenoide e recarga de gás." 
                  value={modalResolver.nota} 
                  onChange={e => setModalResolver({...modalResolver, nota: e.target.value})} 
                  autoFocus 
                  required 
                />
              </div>
              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setModalResolver({ isOpen: false, chamadoId: null, nota: '' })}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--success)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                  <CheckCircle size={18}/> Concluir e Arquivar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}