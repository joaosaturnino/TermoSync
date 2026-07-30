import React, { useState, useEffect } from 'react';
import { MapPin, UserCheck, Lock, ChevronDown, ChevronRight, LogOut, X, Pin } from 'lucide-react';
import TermoSyncLogo from './TermoSyncLogo';

export default function Sidebar({
  menuAberto,
  setMenuAberto,
  menuRecolhido,
  nomeLogado,
  papelLogado,
  getPlanoVisual,
  userRole,
  userFilial,
  filialAtiva,
  setFilialAtiva,
  listaFiliais,
  gruposExpandidos,
  toggleGrupo,
  abaAtiva,
  setAbaAtiva,
  NAVIGATION_ATIVA,
  setIsLocked,
  fazerLogout
}) {
  const isDevUser = userRole === 'DEV';
  const visualContext = isDevUser 
    ? { nome: 'ROOT', cor: '#ef4444' } 
    : getPlanoVisual();

  // ============================================================================
  // LÓGICA DE FAVORITOS (PINOS) - Salva as preferências de acordo com a Role
  // ============================================================================
  const [favoritos, setFavoritos] = useState(() => {
    const salvos = localStorage.getItem(`termosync_favoritos_${userRole}`);
    if (salvos) return JSON.parse(salvos);
    // Telas fixadas por padrão na primeira vez que o usuário loga
    return ['dashboard', 'motores', 'chamados'];
  });

  useEffect(() => {
    localStorage.setItem(`termosync_favoritos_${userRole}`, JSON.stringify(favoritos));
  }, [favoritos, userRole]);

  const toggleFavorito = (e, id) => {
    e.stopPropagation(); // Evita que clicar no pino mude a página
    setFavoritos(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  return (
    <>
      {menuAberto && window.innerWidth <= 768 && <div className="overlay" onClick={() => setMenuAberto(false)}></div>}
      
      <aside className={`sidebar ${menuAberto ? 'open' : ''} ${menuRecolhido ? 'collapsed' : ''}`}>
        <div className="sidebar-header" style={{ padding: '1.5rem 1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', borderBottom: 'none' }}>
          <TermoSyncLogo size={36} color="var(--secondary)" className="hide-on-collapse" />
          <h2 className="hide-on-collapse" style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, background: 'linear-gradient(90deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-1px' }}>ThermoSync</h2>
          <button className="mobile-close" onClick={() => setMenuAberto(false)}><X size={20} /></button>
        </div>
        
        {/* PERFIL DO USUÁRIO AVANÇADO */}
        <div className="sidebar-user-section hide-on-collapse" style={{ padding: '0 1rem 1rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: `radial-gradient(circle at 50% 50%, ${visualContext.cor} 0%, transparent 60%)`, opacity: isDevUser ? 0.15 : 0.05, pointerEvents: 'none' }}></div>
            
            <div className="user-avatar" style={{ width: '42px', height: '42px', background: `color-mix(in srgb, ${visualContext.cor} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${visualContext.cor} 30%, transparent)`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: visualContext.cor, fontWeight: '900', fontSize: '1.1rem', boxShadow: `0 0 15px color-mix(in srgb, ${visualContext.cor} 20%, transparent)`, flexShrink: 0, zIndex: 1 }}>
              {nomeLogado ? nomeLogado.charAt(0).toUpperCase() : 'U'}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, zIndex: 1 }}>
              <span style={{ color: 'white', fontWeight: '800', fontSize: '0.9rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{nomeLogado}</span>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{papelLogado}</span>
            </div>
            
            {!isDevUser && (
              <div style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '0.55rem', fontWeight: '900', background: 'rgba(0,0,0,0.5)', padding: '3px 6px', borderRadius: '6px', border: `1px solid color-mix(in srgb, ${visualContext.cor} 50%, transparent)`, color: visualContext.cor, letterSpacing: '0.5px', zIndex: 1 }}>
                 {visualContext.nome}
              </div>
            )}
          </div>
        </div>

        {/* SELETOR DE CONTEXTO (FILIAL) */}
        <div className="sidebar-context-section hide-on-collapse" style={{ padding: '0 1rem 0.5rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--secondary)', fontWeight: '900', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                {userRole !== 'LOJA' ? <><MapPin size={12}/> Rede Operacional</> : <><UserCheck size={12}/> Acesso Local</>}
              </div>
              {papelLogado.includes('Impersonate') ? (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 10px', borderRadius: '6px', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={14}/> {userFilial}
                </div>
              ) : userRole !== 'LOJA' ? (
                <div style={{position: 'relative'}}>
                  <select value={filialAtiva} onChange={(e) => setFilialAtiva(e.target.value)} style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 30px 8px 10px', borderRadius: '6px', color: 'white', fontSize: '0.8rem', fontWeight: '700', outline: 'none', cursor: 'pointer', appearance: 'none', transition: 'all 0.2s' }} onFocus={e => e.target.style.borderColor = 'var(--secondary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}>
                    {listaFiliais?.map(f => <option key={f} value={f} style={{background: '#0f172a'}}>{f === 'Todas' ? '🌐 Visão Global (Todas)' : `📍 ${f}`}</option>)}
                  </select>
                  <ChevronDown size={14} style={{position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8'}} />
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: '700' }}>{userFilial}</div>
              )}
            </div>
        </div>

        {/* NAVEGAÇÃO PRINCIPAL */}
        <nav className="sidebar-nav" style={{ padding: '0.5rem 0', flex: 1, overflowY: 'auto' }}>
          
          {/* GRUPO DE FAVORITOS (FIXADOS) */}
          {favoritos.length > 0 && (
            <div className="nav-group">
              <div className="nav-group-label hide-on-collapse" style={{ padding: '0.6rem 1.2rem', margin: '0 0.8rem 0.2rem', borderRadius: '8px', background: 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Pin size={12} fill="#38bdf8" /> Fixados
                </span>
              </div>
              <div className="nav-group-items expanded">
                {NAVIGATION_ATIVA.filter(item => favoritos.includes(item.id)).map(item => (
                  <button 
                    key={`fav-${item.id}`} 
                    className={`nav-item ${abaAtiva === item.id ? 'active' : ''}`} 
                    onClick={() => { setAbaAtiva(item.id); if(window.innerWidth <= 768) setMenuAberto(false); }} 
                    title={item.label} 
                    style={{ margin: '0.15rem 1rem', padding: '0.75rem 1rem', borderRadius: '10px', border: abaAtiva === item.id ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent', position: 'relative', display: 'flex', alignItems: 'center', width: 'calc(100% - 2rem)', background: abaAtiva === item.id ? 'rgba(56,189,248,0.1)' : 'transparent', cursor: 'pointer', textAlign: 'left', color: 'white', transition: '0.2s' }}
                  >
                    <item.icon size={18} style={{ color: abaAtiva === item.id ? '#38bdf8' : '#94a3b8', marginRight: '10px', flexShrink: 0 }} />
                    <span className="nav-item-text hide-on-collapse" style={{ fontSize: '0.85rem', fontWeight: abaAtiva === item.id ? '700' : '500', color: abaAtiva === item.id ? '#fff' : '#cbd5e1', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>

                    {/* BADGE NUMÉRICA (MENU ABERTO) */}
                    {item.badge > 0 && !menuRecolhido && (
                      <span className="hide-on-collapse" style={{ background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '900', boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)', marginRight: '6px' }}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}

                    {/* PONTO VERMELHO (MENU RECOLHIDO) */}
                    {item.badge > 0 && menuRecolhido && (
                      <span style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 8px rgba(239, 68, 68, 0.8)', zIndex: 10 }}></span>
                    )}

                    {/* Botão de desafixar (Pino Preenchido) */}
                    <Pin 
                      size={14} 
                      onClick={(e) => toggleFavorito(e, item.id)} 
                      className="hide-on-collapse"
                      style={{ color: '#38bdf8', fill: '#38bdf8', opacity: 0.8, transition: '0.2s', marginLeft: 'auto' }} 
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DEMAIS GRUPOS (SANFONADOS) */}
          {['Desenvolvedor', 'Operações', 'Serviços', 'Auditoria', 'Sistema'].map(group => {
            const itemsInGroup = NAVIGATION_ATIVA.filter(n => n.type === group);
            if (itemsInGroup.length === 0) return null;
            
            const isExpanded = gruposExpandidos[group];
            return (
              <div key={group} className="nav-group" style={{ marginTop: '0.5rem' }}>
                <div className="nav-group-label hide-on-collapse" onClick={() => toggleGrupo(group)} style={{ padding: '0.6rem 1.2rem', margin: '0 0.8rem 0.2rem', borderRadius: '8px', background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s', border: isExpanded ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: '900', color: isExpanded ? '#f8fafc' : '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>{group}</span>
                  {isExpanded ? <ChevronDown size={14} color="#94a3b8" /> : <ChevronRight size={14} color="#64748b" />}
                </div>
                
                <div className={`nav-group-items ${isExpanded ? 'expanded' : 'collapsed'}`}>
                  {itemsInGroup.map(item => {
                    const isFav = favoritos.includes(item.id);
                    return (
                      <button 
                        key={item.id} 
                        className={`nav-item ${abaAtiva === item.id ? 'active' : ''}`} 
                        onClick={() => { setAbaAtiva(item.id); if(window.innerWidth <= 768) setMenuAberto(false); }} 
                        title={item.label} 
                        style={{ margin: '0.15rem 1rem', padding: '0.75rem 1rem', borderRadius: '10px', border: abaAtiva === item.id ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent', position: 'relative', display: 'flex', alignItems: 'center', width: 'calc(100% - 2rem)', background: abaAtiva === item.id ? 'rgba(56,189,248,0.1)' : 'transparent', cursor: 'pointer', textAlign: 'left', color: 'white', transition: '0.2s' }}
                      >
                        <item.icon size={18} style={{ color: abaAtiva === item.id ? '#38bdf8' : '#94a3b8', marginRight: '10px', flexShrink: 0 }} />
                        
                        <span className="nav-item-text hide-on-collapse" style={{ fontSize: '0.85rem', fontWeight: abaAtiva === item.id ? '700' : '500', color: abaAtiva === item.id ? '#fff' : '#cbd5e1', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </span>
                        
                        {/* BADGE NUMÉRICA (MENU ABERTO) */}
                        {item.badge > 0 && !menuRecolhido && (
                          <span className="hide-on-collapse" style={{ background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '900', boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)', marginRight: '6px' }}>
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}

                        {/* PONTO VERMELHO (MENU RECOLHIDO) */}
                        {item.badge > 0 && menuRecolhido && (
                          <span style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 8px rgba(239, 68, 68, 0.8)', zIndex: 10 }}></span>
                        )}

                        {/* Botão de Fixar/Desfixar */}
                        <Pin 
                          size={14} 
                          onClick={(e) => toggleFavorito(e, item.id)} 
                          className="hide-on-collapse"
                          style={{ 
                            color: isFav ? '#38bdf8' : '#64748b', 
                            fill: isFav ? '#38bdf8' : 'none',
                            opacity: isFav ? 1 : 0.3,
                            transition: '0.2s',
                            marginLeft: 'auto'
                          }} 
                          onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = isFav ? 1 : 0.3}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        
        {/* RODAPÉ FLUTUANTE AFK/LOGOUT */}
        <div className="sidebar-footer" style={{ marginTop: 'auto', padding: '1rem', background: 'linear-gradient(to top, rgba(2, 6, 23, 1) 0%, rgba(2, 6, 23, 0.8) 50%, transparent 100%)', display: 'flex', gap: '8px', position: 'sticky', bottom: 0 }}>
          <button className="btn-logout flex-1" onClick={() => setIsLocked(true)} title="Modo AFK" style={{ background: 'rgba(245, 158, 11, 0.05)', color: 'var(--warning)', padding: '10px', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }} onMouseOver={(e) => {e.currentTarget.style.background='rgba(245, 158, 11, 0.15)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={(e) => {e.currentTarget.style.background='rgba(245, 158, 11, 0.05)'; e.currentTarget.style.transform='translateY(0)'}}>
            <Lock size={18} />
          </button>
          <button className="btn-logout flex-1 hide-on-collapse" onClick={fazerLogout} title="Encerrar Sessão" style={{ background: 'rgba(239, 68, 68, 0.05)', color: 'var(--danger)', padding: '10px', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }} onMouseOver={(e) => {e.currentTarget.style.background='rgba(239, 68, 68, 0.15)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={(e) => {e.currentTarget.style.background='rgba(239, 68, 68, 0.05)'; e.currentTarget.style.transform='translateY(0)'}}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}