import React, { useState, useMemo } from 'react';
import { Printer, Archive, MapPin, User, Wrench, CheckSquare, CalendarCheck } from 'lucide-react';
import './HistoricoChamados.css';

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
    
    // Ordenar do mais recente para o mais antigo
    return list.sort((a, b) => new Date(b.data_conclusao) - new Date(a.data_conclusao));
  }, [chamados, filialAtiva, userRole, nomeLogado, tecnicoFiltroOS]);

  return (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 className="historico-chamados-title">Arquivo de Intervenções Antigas (+30 dias)</h3>
        <div className="action-group">
          {userRole !== 'MANUTENCAO' && (
            <select className="select-input historico-filter-select" value={tecnicoFiltroOS} onChange={e => setTecnicoFiltroOS(e.target.value)}>
              <option value="todos">Todos os Técnicos</option>
              {tecnicosDb?.map(tec => <option key={tec.id} value={tec.nome_tecnico}>{tec.nome_tecnico}</option>)}
            </select>
          )}
          <button className="btn btn-outline btn-print-history" onClick={() => gerarLoteOS(chamadosHistoricoFiltrados || [])}>
            <Printer size={18} /> Imprimir Relatórios ({(chamadosHistoricoFiltrados || []).length})
          </button>
        </div>
      </div>

      {!chamadosHistoricoFiltrados || chamadosHistoricoFiltrados.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '2rem' }}>
          <Archive size={64} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Arquivo Vazio</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Ainda não existem ordens de serviço arquivadas com os filtros atuais.</p>
        </div>
      ) : (
        <div className="grid-cards" style={{ marginTop: '1.5rem' }}>
          {chamadosHistoricoFiltrados.map(c => (
            <div key={c.id} className="card historico-card">
              
              <div className="historico-header">
                <div className="historico-equip-title">
                  <Archive size={22} color="var(--text-muted)" />
                  {c.equipamento_nome}
                </div>
                <span className="historico-badge">Arquivado</span>
              </div>
              
              <div className="historico-desc-box">
                "{c.descricao}"
              </div>
              
              <div className="historico-meta-grid">
                <div className="historico-meta-item">
                  <MapPin size={16} /> Localização: <strong>{c.filial}</strong>
                </div>
                <div className="historico-meta-item">
                  <User size={16} /> Solicitante original: <strong>{c.solicitante_nome || c.aberto_por}</strong>
                </div>
                <div className="historico-meta-item">
                  <Wrench size={16} /> Técnico Encarregue: <strong>{c.tecnico_responsavel || 'Equipe Geral'}</strong>
                </div>
              </div>
              
              <div className="historico-resolucao">
                <div className="historico-resolucao-title">
                  <CheckSquare size={16} /> Registo de Intervenção:
                </div>
                <div className="historico-resolucao-text">
                  {c.nota_resolucao}
                </div>
                <div className="historico-resolucao-date">
                  <CalendarCheck size={14} /> Finalizado em {c.data_conclusao ? new Date(c.data_conclusao).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}
                </div>
              </div>
              
            </div>
          ))}
        </div>
      )}
    </div>
  );
}