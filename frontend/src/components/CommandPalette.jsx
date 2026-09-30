/**
 * Módulo: frontend/src/components/CommandPalette.jsx
 * Responsabilidade: Implementa o componente reutilizável Command Palette e seu contrato visual.
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Compass, CornerDownLeft, FileSearch, X } from 'lucide-react';
import React from 'react';
import { Search } from 'lucide-react';
import './CommandPalette.css';

/**
 * Renderiza o componente Command Palette e encapsula sua interacao visual reutilizavel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.showCommandPalette - Propriedade showCommandPalette usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setShowCommandPalette - Propriedade setShowCommandPalette usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.cmdSearch - Propriedade cmdSearch usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setCmdSearch - Propriedade setCmdSearch usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.commandInputRef - Propriedade commandInputRef usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.NAVIGATION_ATIVA - Propriedade NAVIGATION_ATIVA usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.globalSearchItems - Propriedade globalSearchItems usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setAbaAtiva - Propriedade setAbaAtiva usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setGruposExpandidos - Propriedade setGruposExpandidos usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function CommandPalette({
  showCommandPalette,
  setShowCommandPalette,
  cmdSearch,
  setCmdSearch,
  commandInputRef,
  NAVIGATION_ATIVA,
  globalSearchItems = [],
  setAbaAtiva,
  setGruposExpandidos
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const normalizedSearch = cmdSearch.trim().toLocaleLowerCase('pt-BR');

  const navigationResults = useMemo(() => NAVIGATION_ATIVA
    .filter((item) => item.label.toLocaleLowerCase('pt-BR').includes(normalizedSearch))
    .slice(0, normalizedSearch ? 12 : 8), [NAVIGATION_ATIVA, normalizedSearch]);

  const results = useMemo(() => [
    ...navigationResults.map((item) => ({ kind: 'navigation', item })),
    ...globalSearchItems.map((item) => ({ kind: 'record', item }))
  ], [globalSearchItems, navigationResults]);
  const activeIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));

  useEffect(() => {
    if (showCommandPalette) document.querySelector('.ts-command-item.is-selected')?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, showCommandPalette]);

  /**
   * Abre o destino escolhido e restaura a busca para a próxima utilização.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} result - Valor de result consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const selectResult = (result) => {
    if (!result) return;
    const target = result.kind === 'navigation' ? result.item.id : result.item.target;
    setAbaAtiva(target);
    if (result.kind === 'navigation') setGruposExpandidos((current) => ({ ...current, [result.item.type]: true }));
    setCmdSearch('');
    setShowCommandPalette(false);
  };

  /**
   * Trata setas, Enter e Escape sem retirar o foco do campo de pesquisa.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex(Math.min(activeIndex + 1, Math.max(0, results.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex(Math.max(0, activeIndex - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectResult(results[activeIndex]);
    } else if (event.key === 'Escape') {
      setShowCommandPalette(false);
    }
  };

  if (!showCommandPalette) return null;

  return (
    <div className="command-palette-overlay ts-command-overlay" onClick={() => setShowCommandPalette(false)}>
      <section className="command-palette-modal ts-command-modal" role="dialog" aria-modal="true" aria-label="Busca global" onClick={(event) => event.stopPropagation()}>
        <header className="ts-command-search">
          <Search size={19} aria-hidden="true" />
          <input ref={commandInputRef} type="text" autoFocus placeholder="Busque módulos, equipamentos, chamados ou pessoas" value={cmdSearch} onChange={(event) => { setCmdSearch(event.target.value); setSelectedIndex(0); }} onKeyDown={handleKeyDown} aria-label="Pesquisar no sistema" />
          {cmdSearch && <button type="button" onClick={() => { setCmdSearch(''); setSelectedIndex(0); }} title="Limpar busca"><X size={15} /></button>}
          <kbd>ESC</kbd>
        </header>

        <div className="ts-command-results" role="listbox" aria-label="Resultados da busca">
          {navigationResults.length > 0 && (
            <section className="ts-command-group">
              <div className="ts-command-group-title"><span><Compass size={13} /> Módulos</span><small>{navigationResults.length}</small></div>
              {navigationResults.map((item, currentIndex) => {
                const ItemIcon = item.icon;
                return <button type="button" role="option" aria-selected={activeIndex === currentIndex} className={`ts-command-item ${activeIndex === currentIndex ? 'is-selected' : ''}`} key={item.id} onMouseEnter={() => setSelectedIndex(currentIndex)} onClick={() => selectResult(results[currentIndex])}><span className="ts-command-icon"><ItemIcon size={17} /></span><span><strong>{item.label}</strong><small>{item.type || 'Navegação'} · Abrir módulo</small></span><CornerDownLeft size={14} /></button>;
              })}
            </section>
          )}

          {globalSearchItems.length > 0 && (
            <section className="ts-command-group">
              <div className="ts-command-group-title"><span><FileSearch size={13} /> Registros</span><small>{globalSearchItems.length}</small></div>
              {globalSearchItems.map((item, index) => {
                const currentIndex = navigationResults.length + index;
                const ItemIcon = item.icon;
                return <button type="button" role="option" aria-selected={activeIndex === currentIndex} className={`ts-command-item ${activeIndex === currentIndex ? 'is-selected' : ''}`} key={`${item.type}-${item.title}-${index}`} onMouseEnter={() => setSelectedIndex(currentIndex)} onClick={() => selectResult(results[currentIndex])}><span className="ts-command-icon"><ItemIcon size={17} /></span><span><strong>{item.title}</strong><small>{item.type} · {item.detail}</small></span><CornerDownLeft size={14} /></button>;
              })}
            </section>
          )}

          {results.length === 0 && <div className="ts-command-empty"><Search size={25} /><strong>Nenhum resultado encontrado</strong><span>Revise o termo ou tente pesquisar por filial, equipamento ou número do chamado.</span></div>}
        </div>

        <footer className="ts-command-footer"><span><kbd><ArrowUp size={11} /><ArrowDown size={11} /></kbd> Navegar</span><span><kbd><CornerDownLeft size={11} /></kbd> Abrir</span><span>{results.length} resultado(s)</span></footer>
      </section>
    </div>
  );
}
