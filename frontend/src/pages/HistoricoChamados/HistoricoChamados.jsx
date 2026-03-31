import React, { useState, useMemo } from 'react';
import { Printer, Archive } from 'lucide-react';

export default function HistoricoChamados({ 
  userRole, filialAtiva, nomeLogado, chamados, tecnicosDb, gerarLoteOS 
}) {
  const [tecnicoFiltroOS, setTecnicoFiltroOS] = useState('todos');

  const chamadosHistoricoFiltrados = useMemo(() => {
    const trintaDiasAtras = new Date(); trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    let list = chamados.filter(c => c.status === 'Concluído' && new Date(c.data_conclusao) < trintaDiasAtras);
    if (userRole === 'ADMIN' && filialAtiva !== 'Todas') list = list.filter(c => c.filial === filialAtiva);
    if (userRole === 'MANUTENCAO') list = list.filter(c => c.tecnico_responsavel === nomeLogado);
    else if (tecnicoFiltroOS !== 'todos') list = list.filter(c => c.tecnico_responsavel === tecnicoFiltroOS);
    return list;
  }, [chamados, filialAtiva, userRole, nomeLogado, tecnicoFiltroOS]);

  return (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 style={{ margin: 0 }}>Histórico de OS Antigas (+30 dias)</h3>
        <div className="action-group">
          {userRole !== 'MANUTENCAO' && (
            <select className="select-input" value={tecnicoFiltroOS} onChange={e => setTecnicoFiltroOS(e.target.value)} style={{ minWidth: '150px' }}>
              <option value="todos">Todos os Técnicos</option>{tecnicosDb?.map(tec => <option key={tec.id} value={tec.nome_tecnico}>{tec.nome_tecnico}</option>)}
            </select>
          )}
          <button className="btn btn-outline" style={{ borderColor: '#3b82f6', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.05)' }} onClick={() => gerarLoteOS(chamadosHistoricoFiltrados || [])}><Printer size={18} /> Imprimir OS Antigas ({(chamadosHistoricoFiltrados || []).length})</button>
        </div>
      </div>

      {!chamadosHistoricoFiltrados || chamadosHistoricoFiltrados.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '2rem' }}><Archive size={56} color="gray" style={{ marginBottom: '1rem', opacity: 0.5 }} /><h3 style={{ margin: 0, color: 'var(--text-main)' }}>Histórico Vazio</h3><p>Não há Ordens de Serviço antigas com estes filtros.</p></div>
      ) : (
        <div className="grid-cards" style={{ marginTop: '1.5rem' }}>
          {chamadosHistoricoFiltrados.map(c => (
            <div key={c.id} className="card" style={{ borderLeft: '6px solid gray', opacity: 0.85 }}>
              <div className="card-top"><div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{c.equipamento_nome}</div><span className="badge-setor" style={{ background: 'gray', color: 'white' }}>Arquivado</span></div>
              <p style={{ fontSize: '0.95rem', margin: '15px 0', fontWeight: '500' }}>"{c.descricao}"</p>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loja: <strong>{c.filial}</strong> | Solicitante: <strong>{c.solicitante_nome || c.aberto_por}</strong></div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 5, fontWeight: 'bold' }}>Técnico: {c.tecnico_responsavel || 'Manutenção Geral'}</div>
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '8px', fontSize: '0.85rem' }}><strong>Resolução Histórica:</strong> {c.nota_resolucao}<div style={{ fontSize: '0.7rem', color: 'gray', marginTop: '4px' }}>Data: {c.data_conclusao ? new Date(c.data_conclusao).toLocaleDateString() : ''}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
