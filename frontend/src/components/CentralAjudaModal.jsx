import React, { useState, useEffect } from 'react';
import { BookOpen, Sparkles, X, Search, ChevronRight, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function CentralAjudaModal({ isOpen, onClose, api, isDarkMode }) {
  const [aba, setAba] = useState('artigos'); // 'artigos' ou 'changelog'
  const [artigos, setArtigos] = useState([]);
  const [changelog, setChangelog] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    
    Promise.all([
      api.get('/suporte/artigos').catch(() => ({ data: [] })),
      api.get('/system/changelog').catch(() => ({ data: [] }))
    ]).then(([resArtigos, resChangelog]) => {
      setArtigos(Array.isArray(resArtigos.data) ? resArtigos.data : []);
      setChangelog(Array.isArray(resChangelog.data) ? resChangelog.data : []);
    }).finally(() => setLoading(false));
  }, [isOpen, api]);

  if (!isOpen) return null;

  const artigosFiltrados = artigos.filter(a => 
    a.titulo.toLowerCase().includes(busca.toLowerCase()) || 
    a.conteudo.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 99999 }}>
      <div 
        className="modal-content anim-slide-up" 
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '680px', width: '100%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* CABEÇALHO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={22} color="#38bdf8" />
            <div>
              <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>Central de Conhecimento</h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Artigos operacionais & Histórico de atualizações do ThermoSync</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20}/></button>
        </div>

        {/* ABAS */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.8rem' }}>
          <button 
            onClick={() => setAba('artigos')} 
            className={`btn ${aba === 'artigos' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            Base de Ajuda ({artigos.length})
          </button>
          <button 
            onClick={() => setAba('changelog')} 
            className={`btn ${aba === 'changelog' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={14} /> Notas de Versão ({changelog.length})
          </button>
        </div>

        {/* CONTEÚDO SCROLLÁVEL */}
        <div style={{ overflowY: 'auto', padding: '1rem 0', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Carregando dados...</div>
          ) : aba === 'artigos' ? (
            <div>
              <div className="input-wrapper" style={{ marginBottom: '1rem' }}>
                <Search size={16} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="Pesquisar artigos de ajuda..." 
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  style={{ paddingLeft: '38px', width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 10px 10px 38px', color: 'white' }}
                />
              </div>

              {artigosFiltrados.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Nenhum artigo encontrado.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {artigosFiltrados.map(art => (
                    <div key={art.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>{art.titulo}</strong>
                        <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', color: '#94a3b8' }}>{art.categoria}</span>
                      </div>
                      <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.85rem', lineHeight: '1.5' }}>{art.conteudo}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* CHANGELOG DA TABELA system_changelog */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {changelog.map(log => (
                <div key={log.id} style={{ background: 'rgba(0,0,0,0.3)', borderLeft: '4px solid #10b981', padding: '14px', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 'bold', color: 'white', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                      {log.version}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(log.date).toLocaleDateString()}</span>
                  </div>
                  <strong style={{ color: '#f8fafc', fontSize: '0.95rem', display: 'block', marginBottom: '6px' }}>{log.title}</strong>
                  <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.5' }}>{log.desc_text}</p>
                  <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#64748b' }}>Autor: {log.author}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.8rem', textAlign: 'right' }}>
          <button className="btn btn-outline" onClick={onClose} style={{ padding: '6px 18px' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}