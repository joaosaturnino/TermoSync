import React from 'react';
import { Menu, Bell, CheckCircle, Search, Volume2, VolumeX, Minimize, Maximize, Sun, Moon, ChevronRight } from 'lucide-react';

export default function Header({
  setMenuAberto,
  menuRecolhido,
  setMenuRecolhido,
  NAVIGATION,
  abaAtiva,
  mostrarNotificacoes,
  setMostrarNotificacoes,
  notificacoesDaFilial,
  resolverTodasNotificacoes,
  getAlertConfig,
  isFeatureEnabled,
  isOffline,
  socketInstance,
  latencia,
  setShowCommandPalette,
  alternarSom,
  somAtivoState,
  toggleFullScreen,
  isFullScreen,
  setIsDarkMode,
  isDarkMode
}) {
  // Encontra os dados da tela ativa atual para montar o Breadcrumb
  const navItem = NAVIGATION.find(n => n.id === abaAtiva);

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <button className="btn-icon" onClick={() => { if (window.innerWidth <= 768) setMenuAberto(true); else setMenuRecolhido(!menuRecolhido); }}>
          <Menu size={22} />
        </button>
        
        {/* BREADCRUMBS DE NAVEGAÇÃO (OPÇÃO 4) */}
        <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}>
          {navItem && navItem.type ? (
            <>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {navItem.type}
              </span>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <h1 className="page-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
                {navItem.label}
              </h1>
            </>
          ) : (
            <h1 className="page-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
              ThermoSync NOC
            </h1>
          )}
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        
        <div style={{ position: 'relative' }}>
          <button className="btn-icon" onClick={() => setMostrarNotificacoes(!mostrarNotificacoes)} title="Centro de Notificações">
            <Bell size={20} />
            {notificacoesDaFilial?.length > 0 && (
              <span style={{ position: 'absolute', top: '2px', right: '2px', background: 'var(--danger)', color: 'white', fontSize: '0.6rem', fontWeight: 'bold', minWidth: '16px', height: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid var(--bg-color)' }}>
                {notificacoesDaFilial.length}
              </span>
            )}
          </button>

          {mostrarNotificacoes && (
            <>
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} onClick={() => setMostrarNotificacoes(false)}></div>
              
              <div className="anim-slide-up" style={{ position: 'absolute', top: '120%', right: '-50px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', width: '320px', zIndex: 9999, boxShadow: '0 10px 40px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}><Bell size={16} color="var(--primary)"/> Alertas Ativos</h4>
                  {notificacoesDaFilial?.length > 0 && (
                    <button className="btn-action-small" onClick={() => { resolverTodasNotificacoes(); setMostrarNotificacoes(false); }} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Limpar Todos</button>
                  )}
                </div>
                <div style={{ maxHeight: '350px', overflowY: 'auto', padding: '10px' }}>
                  {notificacoesDaFilial?.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem 1rem' }}>
                      <CheckCircle size={32} color="var(--success)" style={{ opacity: 0.5, marginBottom: '10px' }} />
                      <p style={{ margin: 0 }}>Nenhuma anomalia detectada.</p>
                    </div>
                  ) : (
                    notificacoesDaFilial?.map(n => {
                      const cfg = getAlertConfig(n.tipo_alerta);
                      const IconCmp = cfg.icon;
                      return (
                        <div key={n.id} onClick={() => { setMostrarNotificacoes(false); }} style={{ background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`, borderLeft: `3px solid ${cfg.color}`, padding: '10px', borderRadius: '6px', marginBottom: '8px', cursor: 'pointer', transition: '0.2s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <strong style={{ color: 'var(--text-main)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <IconCmp size={14} color={cfg.color} />
                              {n.equipamento_nome}
                            </strong>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(n.data_hora).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                          </div>
                          <span style={{ color: cfg.color, fontSize: '0.75rem', fontWeight: '600' }}>{n.mensagem}</span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="telemetry-badge-simple desktop-only" title={isFeatureEnabled('telemetryStream') ? "Socket Conectado" : "Fluxo Bloqueado pelas Políticas"}>
          <div className={`signal-bars-simple ${!isFeatureEnabled('telemetryStream') ? 'status-offline' : (isOffline ? 'status-offline' : socketInstance ? 'status-good' : 'status-slow')}`}><div className="bar active"></div><div className="bar active"></div><div className={`bar ${socketInstance && !isOffline && isFeatureEnabled('telemetryStream') ? 'active' : ''}`}></div></div>
          <span className="conn-text">{!isFeatureEnabled('telemetryStream') ? 'STREAM PAUSADA' : (isOffline ? 'SINAL PERDIDO' : 'CONECTADO')}</span>
          {!isOffline && isFeatureEnabled('telemetryStream') && <span className="conn-ms">{latencia}ms</span>}
        </div>

        <button className="btn-outline desktop-only" onClick={() => setShowCommandPalette(true)} style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}><Search size={14} /> Terminal <span style={{ background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>⌘K</span></button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-icon" onClick={alternarSom} title={somAtivoState ? "Desarmar Sirenes" : "Armar Sirenes"}>{somAtivoState ? <Volume2 size={18} color="var(--primary)"/> : <VolumeX size={18} />}</button>
          <button className="btn-icon desktop-only" onClick={toggleFullScreen} title="Painel de Comando TV">{isFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
          <button className="btn-icon" onClick={() => setIsDarkMode(!isDarkMode)} title="Modo Visual" disabled={!isFeatureEnabled('forceDarkMode') === false} style={{ opacity: isFeatureEnabled('forceDarkMode') ? 0.3 : 1 }}>{isDarkMode ? <Sun size={18} color="var(--warning)"/> : <Moon size={18} />}</button>
        </div>
      </div>
    </header>
  );
}