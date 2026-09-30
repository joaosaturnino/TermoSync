/** Implementa o componente reutilizável Header e seu contrato visual. */

import React, { useState } from 'react';
import { Bell, CheckCircle, ChevronRight, LifeBuoy, Maximize, Menu, Minimize, Moon, MoreHorizontal, Search, Settings, SlidersHorizontal, Sun, Volume2, VolumeX, X } from 'lucide-react';
import GlobalSystemSettingsModal from './GlobalSystemSettingsModal';
import './Header.css';

/**
 * Componente Header (barra superior)
 *
 * Responsabilidades:
 * - Exibir a identidade da tela, notificações e ações rápidas
 * - Controlar palette de comandos, tema e preferências visuais
 *
 * Props: várias callbacks e dados de UI (ver assinatura abaixo)
 */
export default function Header({
  setMenuAberto,
  menuRecolhido,
  setMenuRecolhido,
  NAVIGATION,
  abaAtiva,
  activeWorkspace,
  onNavigate,
  mostrarNotificacoes,
  setMostrarNotificacoes,
  notificacoesDaFilial,
  resolverTodasNotificacoes,
  getAlertConfig,
  isFeatureEnabled,
  isOffline,
  systemHealth,
  setShowCommandPalette,
  alternarSom,
  somAtivoState,
  toggleFullScreen,
  isFullScreen,
  uiDensity,
  setUiDensity,
  toggleUiDensity,
  setIsDarkMode,
  isDarkMode,
  supportContext
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  // Encontra os dados da tela ativa atual para montar o Breadcrumb
  const navItem = NAVIGATION.find(n => n.id === abaAtiva);
  const PageIcon = navItem?.icon;
  const workspaceParent = activeWorkspace?.tabs.find((item) => item.sidebar !== false) || activeWorkspace?.tabs[0];

  // O diagnóstico de suporte usa o estado dos serviços sem expor dados sensíveis.
  const systemStatusText = systemHealth?.status === 'ok' ? 'SAUDÁVEL' : systemHealth?.status === 'degraded' ? 'DEGRADADO' : 'VERIFICANDO';

  /**
   * Renderiza o componente copiar Resumo Suporte e encapsula sua interacao visual reutilizavel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: interage com APIs do navegador; publica ou consome mensagens MQTT
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copiarResumoSuporte = async () => {
    // Pacote sem dados sensíveis para o usuário colar em chamados e acelerar triagem.
    const linhas = [
      'TermoSync - Diagnostico de suporte',
      `Tela: ${navItem?.label || abaAtiva}`,
      `Perfil: ${supportContext?.role || 'N/A'}`,
      `Filial: ${supportContext?.filial || 'N/A'}`,
      `API: ${supportContext?.apiUrl || 'N/A'}`,
      `Status: ${systemStatusText}`,
      `Banco: ${systemHealth?.database || 'N/A'}`,
      `MQTT: ${systemHealth?.mqtt || 'N/A'}`,
      `Offline: ${isOffline ? 'sim' : 'nao'}`,
      `Horario: ${new Date().toLocaleString('pt-BR')}`,
      `Navegador: ${navigator.userAgent}`
    ];

    try {
      await navigator.clipboard.writeText(linhas.join('\n'));
      window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: 'Diagnóstico de suporte copiado.', type: 'success' } }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('forceToast', { detail: { msg: 'Não foi possível copiar o diagnóstico neste navegador.', type: 'warning' } }));
    }
  };

  return (
    <>
      <header className="header app-header">
        <div className="header-left">
          <button type="button" className="btn-icon header-menu-button" onClick={() => { if (window.matchMedia('(max-width: 768px)').matches) setMenuAberto(true); else setMenuRecolhido(!menuRecolhido); }} title={menuRecolhido ? 'Expandir navegação' : 'Recolher navegação'} aria-label={menuRecolhido ? 'Expandir navegação' : 'Abrir navegação'}><Menu size={20} /></button>

          <div className="header-page-identity">
            {PageIcon && <span className="header-page-icon" aria-hidden="true"><PageIcon size={18} /></span>}
            <div className="header-page-copy">
              <nav className="header-breadcrumb" aria-label="Caminho da página">
                <button type="button" onClick={() => onNavigate?.('dashboard')}>ThermoSync</button>
                <ChevronRight size={11} />
                <span>{navItem?.type || 'Usuário'}</span>
                {activeWorkspace && <><ChevronRight size={11} /><button type="button" onClick={() => workspaceParent && onNavigate?.(workspaceParent.id)}>{activeWorkspace.label}</button></>}
                <ChevronRight size={11} />
                <span aria-current="page">{navItem?.label || 'Central de Operações'}</span>
              </nav>
              <h1 className="page-title">{navItem?.label || 'Central de Operações'}</h1>
            </div>
            {isOffline && <span className="header-offline-badge">Offline</span>}
          </div>
        </div>

        <div className="header-actions">
          <button type="button" className="header-search-button desktop-only" onClick={() => setShowCommandPalette(true)}><Search size={15} /><span>Buscar módulo ou ação</span><kbd>Ctrl K</kbd></button>

          <div className="header-action-anchor">
            <button type="button" className={`btn-icon header-action-button ${mostrarNotificacoes ? 'active-soft' : ''}`} onClick={() => { setToolsOpen(false); setMostrarNotificacoes(!mostrarNotificacoes); }} title="Central de notificações" aria-label="Central de notificações" aria-expanded={mostrarNotificacoes}>
              <Bell size={18} />
              {notificacoesDaFilial?.length > 0 && <span className="header-alert-count">{notificacoesDaFilial.length > 99 ? '99+' : notificacoesDaFilial.length}</span>}
            </button>

            {mostrarNotificacoes && (
              <>
                <button type="button" className="header-popover-backdrop" aria-label="Fechar notificações" onClick={() => setMostrarNotificacoes(false)} />
                <section className="header-notification-popover" aria-label="Alertas ativos">
                  <header className="header-popover-heading">
                    <span><Bell size={16} /><span><strong>Alertas ativos</strong><small>{notificacoesDaFilial?.length || 0} ocorrência(s) em acompanhamento</small></span></span>
                    <button type="button" onClick={() => setMostrarNotificacoes(false)} title="Fechar"><X size={16} /></button>
                  </header>
                  {notificacoesDaFilial?.length > 0 && <div className="header-popover-toolbar"><span>Atualizados em tempo real</span><button type="button" onClick={() => { resolverTodasNotificacoes(); setMostrarNotificacoes(false); }}>Resolver todos</button></div>}
                  <div className="header-notification-list">
                    {notificacoesDaFilial?.length === 0 ? (
                      <div className="header-notification-empty"><CheckCircle size={28} /><strong>Operação normal</strong><span>Nenhuma anomalia detectada nesta filial.</span></div>
                    ) : notificacoesDaFilial?.map((notification) => {
                      const config = getAlertConfig(notification.tipo_alerta);
                      const AlertIcon = config.icon;
                      return (
                        <button type="button" className="header-notification-item" key={notification.id} onClick={() => setMostrarNotificacoes(false)} style={{ '--alert-color': config.color }}>
                          <span className="header-notification-icon"><AlertIcon size={15} /></span>
                          <span className="header-notification-copy"><span><strong>{notification.equipamento_nome}</strong><time>{new Date(notification.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></span><small>{notification.mensagem}</small></span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </div>

          <button type="button" className="btn-icon header-action-button desktop-only" onClick={() => setSettingsOpen(true)} title="Configurações do sistema" aria-label="Configurações do sistema"><Settings size={18} /></button>

          <div className="header-action-anchor">
            <button type="button" className={`btn-icon header-action-button ${toolsOpen ? 'active-soft' : ''}`} onClick={() => { setMostrarNotificacoes(false); setToolsOpen(!toolsOpen); }} title="Mais ações" aria-label="Mais ações" aria-expanded={toolsOpen}><MoreHorizontal size={19} /></button>
            {toolsOpen && (
              <>
                <button type="button" className="header-popover-backdrop" aria-label="Fechar ações" onClick={() => setToolsOpen(false)} />
                <div className="header-tools-popover" role="menu">
                  <div className="header-tools-heading"><strong>Ações rápidas</strong><span>Preferências desta sessão</span></div>
                  <button type="button" role="menuitem" onClick={() => { setShowCommandPalette(true); setToolsOpen(false); }}><Search size={16} /><span><strong>Busca global</strong><small>Localizar módulos e ações</small></span><kbd>Ctrl K</kbd></button>
                  <button type="button" role="menuitem" onClick={() => { copiarResumoSuporte(); setToolsOpen(false); }}><LifeBuoy size={16} /><span><strong>Copiar diagnóstico</strong><small>Resumo técnico para suporte</small></span></button>
                  <button type="button" role="menuitem" onClick={alternarSom}>{somAtivoState ? <Volume2 size={16} /> : <VolumeX size={16} />}<span><strong>Alertas sonoros</strong><small>{somAtivoState ? 'Ativados' : 'Desativados'}</small></span><i className={somAtivoState ? 'active' : ''} /></button>
                  <button type="button" role="menuitem" onClick={toggleUiDensity}><SlidersHorizontal size={16} /><span><strong>Densidade visual</strong><small>{uiDensity === 'compact' ? 'Compacta' : 'Confortável'}</small></span></button>
                  <button type="button" role="menuitem" onClick={toggleFullScreen}>{isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}<span><strong>Tela cheia</strong><small>{isFullScreen ? 'Sair do modo expandido' : 'Expandir área de trabalho'}</small></span></button>
                  <button type="button" role="menuitem" disabled={isFeatureEnabled('forceDarkMode')} onClick={() => setIsDarkMode(!isDarkMode)}>{isDarkMode ? <Sun size={16} /> : <Moon size={16} />}<span><strong>Tema visual</strong><small>{isDarkMode ? 'Alternar para claro' : 'Alternar para escuro'}</small></span></button>
                  <button type="button" role="menuitem" className="header-tools-settings" onClick={() => { setSettingsOpen(true); setToolsOpen(false); }}><Settings size={16} /><span><strong>Configurações do sistema</strong><small>Abrir preferências globais</small></span><ChevronRight size={15} /></button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
    {settingsOpen && (
      <GlobalSystemSettingsModal
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        forceDarkMode={isFeatureEnabled('forceDarkMode')}
        uiDensity={uiDensity}
        setUiDensity={setUiDensity}
        soundEnabled={somAtivoState}
        toggleSound={alternarSom}
        audioAllowed={isFeatureEnabled('enableAudioAlerts')}
        isOffline={isOffline}
        systemHealth={systemHealth}
        supportContext={supportContext}
        onClose={() => setSettingsOpen(false)}
      />
    )}
    </>
  );
}
