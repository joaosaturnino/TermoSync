import React from 'react';
import { FileText, Calendar, AlertTriangle } from 'lucide-react';

export default function HistoricoLogs({ historicoFiltradoLista, gerarExportacao }) {
  return (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 style={{ margin: 0 }}>Livro de Registro Oficial</h3>
        <div className="action-group">
          <button className="btn btn-danger" onClick={() => gerarExportacao('pdf')}><FileText size={18} /> Exportar Log Auditável</button>
        </div>
      </div>
      <div className="card" style={{ marginTop: '1rem', padding: '2rem' }}>
        <div className="timeline-container">
          {historicoFiltradoLista?.map((hist, index) => (
            <div key={hist.id} className="timeline-item stagger-2" style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <span className="timeline-date"><Calendar size={16} /> {new Date(hist.data_hora).toLocaleString()}</span>
                  <span className="badge-setor" style={{ margin: 0 }}>{hist.filial} | {hist.setor}</span>
                </div>
                <div className="timeline-body">
                  <p style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--primary)' }}>{hist.equipamento_nome}</p>
                  <p style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertTriangle size={16} /> {hist.mensagem}</p>
                </div>
                <div className="timeline-action">
                  <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', opacity: 0.8 }}>Relatório Técnico Assinado:</p>
                  <p>{hist.nota_resolucao}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}