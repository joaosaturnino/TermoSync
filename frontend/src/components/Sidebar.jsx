/** Implementa o componente reutilizável Sidebar e seu contrato visual. */

import React, { useState, useEffect, useMemo } from 'react';
import { Building2, ChevronDown, ChevronRight, Globe2, Lock, LogOut, MapPin, Pin, Search, UserCheck, X } from 'lucide-react';
import TermoSyncLogo from './TermoSyncLogo';
import SystemFooter from './SystemFooter';
import { getSidebarNavigation, getSidebarSections } from '../config/navigationPolicy';
import './Sidebar.css';

/**
 * Componente Sidebar (navegação lateral)
 *
 * Responsabilidades:
 * - Renderizar navegação principal, favoritos e seletor de contexto (filial)
 * - Persistir favoritos por `userRole` e controlar estados de colapso
 *
 * Props: menu state, usuário, navegação e callbacks de interação
 */
export default function Sidebar({
  api,
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
  activeNavigationId = abaAtiva,
  setAbaAtiva,
  NAVIGATION_ATIVA,
  systemHealth,
  isOffline,
  setIsLocked,
  fazerLogout
}) {
  // O perfil DEV usa identidade visual fixa; os demais herdam o plano contratado.
  const isDevUser = userRole === 'DEV';
  const visualContext = isDevUser 
    ? { nome: 'ROOT', cor: 'var(--danger)' }
    : getPlanoVisual();

  // A chave inclui perfil e usuário para não compartilhar favoritos entre sessões.
  const favoritosKey = useMemo(() => {
    const usuarioSeguro = String(nomeLogado || 'usuario').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    return `termosync_favoritos_${userRole}_${usuarioSeguro}`;
  }, [nomeLogado, userRole]);

  // O armazenamento local garante inicialização imediata e funciona como fallback offline.
  const [favoritos, setFavoritos] = useState(() => {
    const usuarioSeguro = String(nomeLogado || 'usuario').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    const salvos = localStorage.getItem(`termosync_favoritos_${userRole}_${usuarioSeguro}`) || localStorage.getItem(`termosync_favoritos_${userRole}`);
    if (salvos) return JSON.parse(salvos);
    return ['dashboard', 'motores', 'chamados'];
  });
  const [preferenciasCarregadas, setPreferenciasCarregadas] = useState(false);
  const [navQuery, setNavQuery] = useState('');

  // Persiste cada alteração local antes da sincronização remota assíncrona.
  useEffect(() => {
    localStorage.setItem(favoritosKey, JSON.stringify(favoritos));
  }, [favoritos, favoritosKey]);

  useEffect(() => {
    let cancelado = false;
    setPreferenciasCarregadas(false);

    /**
     * Carrega a preferência remota sem descartar o fallback local em caso de falha.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
     * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
     *
     * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador
     *
     * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const carregarFavoritos = async () => {
      if (!api) {
        setPreferenciasCarregadas(true);
        return;
      }

      try {
        const res = await api.get('/user/preferences/sidebar_favorites');
        const value = typeof res.data?.value === 'string' ? JSON.parse(res.data.value) : res.data?.value;
        if (!cancelado && Array.isArray(value) && value.length > 0) {
          setFavoritos(value);
          localStorage.setItem(favoritosKey, JSON.stringify(value));
        }
      } catch {
        // Mantém fallback local quando o usuário estiver offline ou a base antiga ainda não tiver a tabela.
      } finally {
        if (!cancelado) setPreferenciasCarregadas(true);
      }
    };

    carregarFavoritos();
    return () => { cancelado = true; };
  }, [api, favoritosKey]);

  // Agrupa alterações rápidas e reduz escritas consecutivas na API de preferências.
  useEffect(() => {
    if (!api || !preferenciasCarregadas) return;
    const timeoutId = window.setTimeout(() => {
      api.put('/user/preferences/sidebar_favorites', { value: favoritos }).catch(() => {});
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [api, favoritos, preferenciasCarregadas]);

  /**
   * Alterna um favorito sem disparar a navegação do item pai.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {Event} e - Evento que iniciou a interação ou mudança de estado.
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const toggleFavorito = (e, id) => {
    e.stopPropagation(); 
    setFavoritos(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  // Coleções derivadas usam somente as entradas deduplicadas pela política central.
  const normalizedQuery = navQuery.trim().toLocaleLowerCase('pt-BR');
  const sidebarNavigation = getSidebarNavigation(NAVIGATION_ATIVA);
  const filteredNavigation = normalizedQuery
    ? sidebarNavigation.filter((item) => [item.label, item.moduleLabel, item.type]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase('pt-BR').includes(normalizedQuery)))
    : sidebarNavigation;
  const sidebarSections = getSidebarSections(filteredNavigation, userRole);
  const favoriteItems = sidebarNavigation.filter((item) => favoritos.includes(item.id));

  /**
   * Abre um módulo e fecha o drawer quando a navegação ocorre no mobile.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
   *
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const navigateTo = (id) => {
    setAbaAtiva(id);
    if (window.matchMedia('(max-width: 768px)').matches) setMenuAberto(false);
  };

  /**
   * Renderiza um destino de navegação com badge e controle de favorito.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Monta a árvore visual conforme o estado e as permissões disponíveis.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} item - Valor de item consumido por esta rotina.
   * @param {unknown} favoriteSection - Valor de favorite section consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const renderNavItem = (item, favoriteSection = false) => {
    const isActive = activeNavigationId === item.id;
    const isFavorite = favoritos.includes(item.id);
    const badge = Number(item.badge) || 0;
    const ItemIcon = item.icon;
    const moduleLabel = item.moduleLabel || item.label;
    const itemTitle = moduleLabel === item.label ? item.label : `${moduleLabel}: ${item.label}`;

    return (
      <div className={`sidebar-nav-row ${isActive ? 'active' : ''}`} key={`${favoriteSection ? 'fav' : 'nav'}-${item.id}`}>
        <button
          type="button"
          className="nav-item sidebar-nav-link"
          onClick={() => navigateTo(item.id)}
          title={itemTitle}
          aria-current={isActive ? 'page' : undefined}
        >
          <span className="sidebar-item-icon"><ItemIcon size={18} /></span>
          <span className="nav-item-text hide-on-collapse">
            <strong>{moduleLabel}</strong>
            {moduleLabel !== item.label && <small>{item.label}</small>}
          </span>
          {badge > 0 && <span className="sidebar-badge" aria-label={`${badge} pendências`}>{badge > 99 ? '99+' : badge}</span>}
        </button>
        <button
          type="button"
          className={`sidebar-pin hide-on-collapse ${isFavorite ? 'active' : ''}`}
          onClick={(event) => toggleFavorito(event, item.id)}
          title={isFavorite ? `Desafixar ${item.label}` : `Fixar ${item.label}`}
          aria-label={isFavorite ? `Desafixar ${item.label}` : `Fixar ${item.label}`}
          aria-pressed={isFavorite}
        >
          <Pin size={13} />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* No mobile, a camada externa fecha o drawer sem alterar a tela ativa. */}
      {menuAberto && <button className="sidebar-overlay" type="button" aria-label="Fechar menu" onClick={() => setMenuAberto(false)} />}

      <aside className={`sidebar sidebar-shell ${menuAberto ? 'open' : ''} ${menuRecolhido ? 'collapsed' : ''}`} style={{ '--sidebar-context-color': visualContext.cor }}>
        {/* Marca do produto e controle de fechamento do drawer móvel. */}
        <header className="sidebar-header ios-sidebar-header">
          <div className="sidebar-brand">
            <span className="sidebar-brand-mark"><TermoSyncLogo size={31} color="var(--brand-core)" /></span>
            <span className="sidebar-brand-copy hide-on-collapse"><strong>ThermoSync</strong><small>Rede térmica sincronizada</small></span>
          </div>
          <button type="button" className="mobile-close" onClick={() => setMenuAberto(false)} title="Fechar menu" aria-label="Fechar menu"><X size={18} /></button>
        </header>

        {/* Identidade da sessão e plano/nível operacional atual. */}
        <section className="sidebar-user-section hide-on-collapse" aria-label="Sessão atual">
          <div className="ios-sidebar-profile-card sidebar-profile">
            <span className="user-avatar ios-sidebar-avatar">{nomeLogado ? nomeLogado.charAt(0).toUpperCase() : 'U'}</span>
            <span className="sidebar-profile-copy"><strong>{nomeLogado}</strong><small>{papelLogado}</small></span>
            <span className="sidebar-profile-plan">{visualContext.nome}</span>
          </div>
        </section>

        {/* Escopo de dados usado por todas as telas operacionais. */}
        <section className="sidebar-context-section hide-on-collapse" aria-label="Contexto operacional">
          <div className="ios-sidebar-context-card sidebar-context-card">
            <span className="sidebar-context-label">{userRole !== 'LOJA' ? <><MapPin size={13} /> Rede operacional</> : <><UserCheck size={13} /> Acesso local</>}</span>
            {papelLogado.includes('Impersonate') ? (
              <span className="sidebar-context-locked"><Lock size={14} />{userFilial}</span>
            ) : userRole !== 'LOJA' ? (
              <label className="sidebar-context-select"><Globe2 size={15} /><select value={filialAtiva} onChange={(event) => setFilialAtiva(event.target.value)} aria-label="Filial ativa">{listaFiliais?.map((filial) => <option key={filial} value={filial}>{filial === 'Todas' ? 'Visão global (todas)' : filial}</option>)}</select><ChevronDown size={14} /></label>
            ) : (
              <span className="sidebar-context-local"><Building2 size={14} />{userFilial}</span>
            )}
          </div>
        </section>

        {/* Busca apenas nas entradas principais; telas secundárias ficam nas abas contextuais. */}
        <div className="sidebar-search hide-on-collapse">
          <Search size={15} />
          <input value={navQuery} onChange={(event) => setNavQuery(event.target.value)} placeholder="Buscar módulo" aria-label="Buscar módulo na navegação" />
          {navQuery && <button type="button" onClick={() => setNavQuery('')} aria-label="Limpar busca"><X size={13} /></button>}
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {/* Atalhos persistidos pelo usuário. */}
          {!normalizedQuery && favoriteItems.length > 0 && (
            <section className="nav-group sidebar-favorites">
              <div className="sidebar-section-title hide-on-collapse"><span><Pin size={12} /> Fixados</span><small>{favoriteItems.length}</small></div>
              <div className="nav-group-items expanded">{favoriteItems.map((item) => renderNavItem(item, true))}</div>
            </section>
          )}

          {/* Grupos principais respeitam permissões, busca e estado de expansão. */}
          {sidebarSections.map(({ label: group, items: itemsInGroup }) => {
            const isExpanded = normalizedQuery || gruposExpandidos[group] || itemsInGroup.some((item) => item.id === activeNavigationId);
            return (
              <section className="nav-group" key={group}>
                <button type="button" className={`sidebar-group-trigger hide-on-collapse ${isExpanded ? 'expanded' : ''}`} onClick={() => toggleGrupo(group)} aria-expanded={Boolean(isExpanded)} disabled={Boolean(normalizedQuery)}>
                  <span>{group}</span><small>{itemsInGroup.length}</small>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div className={`nav-group-items ${isExpanded ? 'expanded' : 'collapsed'}`}>{itemsInGroup.map((item) => renderNavItem(item))}</div>
              </section>
            );
          })}

          {/* Estado vazio da busca lateral. */}
          {normalizedQuery && filteredNavigation.length === 0 && <div className="sidebar-empty hide-on-collapse"><Search size={19} /><strong>Nenhum módulo encontrado</strong><span>Tente outro termo de busca.</span></div>}
        </nav>

        {/* Links institucionais e estado resumido do ambiente. */}
        <SystemFooter variant="sidebar" systemHealth={systemHealth} isOffline={isOffline} userRole={userRole} navigation={NAVIGATION_ATIVA} onNavigate={navigateTo} />

        {/* Ações que encerram ou suspendem a sessão corrente. */}
        <footer className="sidebar-footer">
          <button type="button" className="sidebar-session-action sidebar-lock" onClick={() => setIsLocked(true)} title="Bloquear sessão"><Lock size={17} /><span className="hide-on-collapse">Bloquear</span></button>
          <button type="button" className="sidebar-session-action sidebar-logout" onClick={fazerLogout} title="Encerrar sessão"><LogOut size={17} /><span className="hide-on-collapse sidebar-logout-label">Sair</span></button>
        </footer>
      </aside>
    </>
  );
}
