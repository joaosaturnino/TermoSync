import React, { useMemo } from 'react';
import { FileText, Calendar, AlertTriangle, CheckSquare, History, MapPin, ActivitySquare, ShieldCheck } from 'lucide-react';
import './HistoricoLogs.css';

export default function HistoricoLogs({ historicoFiltradoLista, gerarExportacao }) {
  
  // Garante que o histórico é ordenado sempre do mais recente para o mais antigo
  const historicoOrdenado = useMemo(() => {
    if (!historicoFiltradoLista) return [];
    return [...historicoFiltradoLista].sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));
  }, [historicoFiltradoLista]);

  return (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={24} style={{ color: 'var(--primary)' }} />
          Livro de Registo Oficial (RDC)
        </h3>
        <div className="action-group">
          <button className="btn btn-export-log" onClick={() => gerarExportacao('pdf')}>
            <FileText size={18} /> Exportar Log Auditável
          </button>
        </div>
      </div>
      
      {!historicoOrdenado || historicoOrdenado.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '2rem' }}>
          <History size={64} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Nenhum Registo Encontrado</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>O histórico de auditoria está vazio para a loja ou filtros selecionados.</p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: '1.5rem', padding: '2rem' }}>
          <div className="timeline-container">
            {historicoOrdenado.map((hist, index) => (
              // Limita o delay da animação para não demorar muito a carregar se houver centenas de logs
              <div key={hist.id} className="timeline-item stagger-2" style={{ animationDelay: `${Math.min(index * 0.05, 1)}s` }}>
                <div className="timeline-marker"></div>
                
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-date">
                      <Calendar size={16} style={{ color: 'var(--primary)' }}/> 
                      {new Date(hist.data_hora).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge-setor" style={{ background: 'var(--bg-color)', color: 'var(--text-muted)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12}/> {hist.filial}
                      </span>
                      <span className="badge-setor" style={{ background: 'var(--bg-color)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {hist.setor}
                      </span>
                    </div>
                  </div>
                  
                  <div className="timeline-body">
                    <h4 className="timeline-equip-title">
                      <ActivitySquare size={20} color="var(--primary)" />
                      {hist.equipamento_nome}
                    </h4>
                    <div className="timeline-alert-msg">
                      <AlertTriangle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} /> 
                      <span><strong>Ocorrência:</strong> {hist.mensagem}</span>
                    </div>
                  </div>
                  
                  <div className="timeline-action">
                    <div className="timeline-action-title">
                      <CheckSquare size={16} /> Relatório Técnico Assinado:
                    </div>
                    <p className="timeline-action-text">{hist.nota_resolucao}</p>
                  </div>
                  
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}