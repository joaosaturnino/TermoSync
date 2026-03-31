import React, { useState, useMemo } from 'react';
import { Printer, MessageSquarePlus, CheckCircle, Wrench, Save } from 'lucide-react';

export default function Chamados({ 
  userRole, filialAtiva, nomeLogado, chamados, tecnicosDb, equipamentosDaFilial, 
  nomeGerente, nomeCoordenador, api, carregarChamados, showToast, isOffline, gerarLoteOS 
}) {
  const [tecnicoFiltroOS, setTecnicoFiltroOS] = useState('todos');
  const [filtroTempoOS, setFiltroTempoOS] = useState('todos');
  const [modalChamado, setModalChamado] = useState(false);
  const [formChamado, setFormChamado] = useState({ equipamento_id: '', descricao: '', solicitante_nome: '', tecnico_responsavel: '' });

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

  return (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 style={{ margin: 0 }}>Central de Chamados Técnicos</h3>
        <div className="action-group">
          {userRole !== 'MANUTENCAO' && (
            <select className="select-input" value={tecnicoFiltroOS} onChange={e => setTecnicoFiltroOS(e.target.value)} style={{ minWidth: '150px' }}>
              <option value="todos">Todos os Técnicos</option>{tecnicosDb?.map(tec => <option key={tec.id} value={tec.nome_tecnico}>{tec.nome_tecnico}</option>)}
            </select>
          )}
          <select className="select-input" value={filtroTempoOS} onChange={e => setFiltroTempoOS(e.target.value)} style={{ minWidth: '150px' }}>
            <option value="todos">Todo o Período</option><option value="dia">Apenas de Hoje</option><option value="semana">Últimos 7 dias</option><option value="mes">Últimos 30 dias</option>
          </select>
          <button className="btn btn-outline" style={{ borderColor: '#3b82f6', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.05)' }} onClick={() => gerarLoteOS(chamadosAtivosFiltrados?.filter(c => c.status === 'Concluído') || [])}><Printer size={18} /> Imprimir OS ({(chamadosAtivosFiltrados?.filter(c => c.status === 'Concluído') || []).length})</button>
          {userRole !== 'MANUTENCAO' && (
            <button className="btn btn-primary" onClick={() => {
              if (!equipamentosDaFilial || equipamentosDaFilial.length === 0) return showToast("Não existem equipamentos nesta unidade para abrir um chamado.", "warning");
              let solicitanteAuto = userRole === 'ADMIN' ? 'Administração Central' : (nomeGerente ? `Gerente - ${nomeGerente}` : (nomeCoordenador ? `Coordenador - ${nomeCoordenador}` : 'Equipe da Loja'));
              setFormChamado({ equipamento_id: equipamentosDaFilial[0].id, descricao: '', solicitante_nome: solicitanteAuto, tecnico_responsavel: '' }); setModalChamado(true);
            }}><MessageSquarePlus size={18} /> Abrir Solicitação</button>
          )}
        </div>
      </div>

      {!chamadosAtivosFiltrados || chamadosAtivosFiltrados.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '2rem' }}><CheckCircle size={56} color="var(--success)" style={{ marginBottom: '1rem' }} /><h3 style={{ margin: 0, color: 'var(--text-main)' }}>Sem Ocorrências Encontradas</h3><p>Não há chamados técnicos pendentes para os filtros selecionados.</p></div>
      ) : (
        <div className="grid-cards" style={{ marginTop: '1.5rem' }}>
          {chamadosAtivosFiltrados.map(c => (
            <div key={c.id} className="card" style={{ borderLeft: `6px solid ${c.status === 'Concluído' ? 'var(--success)' : (c.urgencia === 'Crítica' || c.urgencia === 'Alta' ? 'var(--danger)' : 'var(--warning)')}` }}>
              <div className="card-top"><div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{c.equipamento_nome}</div><span className="badge-setor">{c.status}</span></div>
              <p style={{ fontSize: '0.95rem', margin: '15px 0', fontWeight: '500' }}>"{c.descricao}"</p>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loja: <strong>{c.filial}</strong> | Solicitante: <strong>{c.solicitante_nome || c.aberto_por}</strong></div>
              <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: 5, fontWeight: 'bold' }}>Técnico Acionado: {c.tecnico_responsavel || 'Manutenção Geral'}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 5 }}>Urgência definida: <strong style={{ color: c.urgencia === 'Crítica' || c.urgencia === 'Alta' ? 'var(--danger)' : 'var(--warning)' }}>{c.urgencia}</strong></div>
              
              {c.status === 'Concluído' && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.85rem' }}><strong>Nota de Resolução:</strong> {c.nota_resolucao}<div style={{ fontSize: '0.7rem', color: 'gray', marginTop: '4px' }}>Concluído em: {c.data_conclusao ? new Date(c.data_conclusao).toLocaleDateString() : ''}</div></div>
              )}
              {userRole === 'ADMIN' && c.status !== 'Concluído' && (
                <div style={{ marginTop: '15px' }}><select className="select-input" style={{ fontSize: '0.8rem', padding: '8px', width: '100%' }} value={c.urgencia} onChange={(e) => api.put(`/chamados/${c.id}/urgencia`, { urgencia: e.target.value }).then(carregarChamados)}><option value="Pendente">Urgência: Pendente...</option><option value="Baixa">Baixa</option><option value="Média">Média</option><option value="Alta">Alta</option><option value="Crítica">Crítica (Imediato)</option></select></div>
              )}
              {(userRole === 'ADMIN' || userRole === 'MANUTENCAO') && c.status !== 'Concluído' && (
                <button className="btn btn-outline w-100" style={{ marginTop: '10px', borderColor: 'var(--success)', color: 'var(--success)' }} onClick={() => { const nota = prompt("Escreva a Nota de Resolução do reparo:"); if (nota) { api.put(`/chamados/${c.id}/status`, { status: 'Concluído', nota_resolucao: nota }).then(() => { showToast('Chamado concluído!', 'success'); carregarChamados(); }); } }}><CheckCircle size={16} /> Marcar como Corrigido</button>
              )}
            </div>
          ))}
        </div>
      )}

      {modalChamado && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '100%' }}>
            <h3><Wrench size={20} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--primary)' }}/> Nova Ordem de Serviço</h3>
            <form onSubmit={async (e) => { e.preventDefault(); if (isOffline) return showToast('Ação bloqueada.', 'warning'); if (!formChamado.equipamento_id) return showToast('Selecione um equipamento.', 'error'); try { await api.post('/chamados', formChamado); showToast('Chamado aberto!', 'success'); setModalChamado(false); carregarChamados(); } catch (err) { showToast('Erro ao abrir o chamado.', 'error'); } }}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div><label>Máquina / Equipamento</label><select className="select-input" value={formChamado.equipamento_id} onChange={e => setFormChamado({...formChamado, equipamento_id: e.target.value})} required style={{ width: '100%' }}><option value="">Selecione...</option>{equipamentosDaFilial?.map(eq => (<option key={eq.id} value={eq.id}>{userRole === 'ADMIN' ? `[${eq.filial}] ` : ''}{eq.nome} - {eq.setor}</option>))}</select></div>
                <div><label>Descrição do Problema</label><textarea className="input" rows="4" value={formChamado.descricao} onChange={e => setFormChamado({...formChamado, descricao: e.target.value})} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', resize: 'vertical' }} /></div>
                <div><label>Nome do Solicitante</label><input type="text" value={formChamado.solicitante_nome} readOnly style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', cursor: 'not-allowed' }} /></div>
                <div><label>Técnico Específico (Opcional)</label><select className="select-input" value={formChamado.tecnico_responsavel} onChange={e => setFormChamado({...formChamado, tecnico_responsavel: e.target.value})} style={{ width: '100%' }}><option value="">Deixar em aberto</option>{tecnicosDb?.map(t => <option key={t.id} value={t.nome_tecnico}>{t.nome_tecnico}</option>)}</select></div>
              </div>
              <div className="modal-actions" style={{ marginTop: '1.5rem' }}><button type="button" className="btn btn-outline" onClick={() => setModalChamado(false)}>Cancelar</button><button type="submit" className="btn btn-primary"><Save size={18}/> Submeter OS</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}