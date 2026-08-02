import React from 'react';
import { Search, Keyboard } from 'lucide-react';

/**
 * CommandPalette (atalhos de teclado)
 *
 * Responsabilidades:
 * - Fornecer UI de pesquisa rápida para navegar entre módulos
 * - Fechar/abrir via ESC e propagar seleção para o App
 *
 * Props: estado de visibilidade, pesquisa e callbacks de navegação
 */
export default function CommandPalette({
  showCommandPalette,
  setShowCommandPalette,
  cmdSearch,
  setCmdSearch,
  commandInputRef,
  NAVIGATION_ATIVA,
  setAbaAtiva,
  setGruposExpandidos
}) {
  if (!showCommandPalette) return null;

  return (
    <div className="command-palette-overlay" onClick={() => setShowCommandPalette(false)}>
      <div className="command-palette-modal anim-slide-up" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-row">
          <Search size={22} color="var(--primary)" />
          <input 
            ref={commandInputRef} 
            type="text" 
            autoFocus 
            placeholder="Pesquisar módulo ou comando de sistema..." 
            value={cmdSearch} 
            onChange={e => setCmdSearch(e.target.value)} 
          />
          <div className="cmd-hint"><Keyboard size={14}/> ESC para fechar</div>
        </div>
        <div className="cmd-results">
          <div className="cmd-group">Navegação Rápida</div>
          {NAVIGATION_ATIVA.filter(n => n.label.toLowerCase().includes(cmdSearch.toLowerCase())).map(nav => (
            <button key={nav.id} className="cmd-item" onClick={() => { 
              setAbaAtiva(nav.id); 
              setGruposExpandidos(prev => ({ ...prev, [nav.type]: true }));
              setShowCommandPalette(false); 
            }}>
              <nav.icon size={18} className="cmd-item-icon"/> <span>Acessar <strong>{nav.label}</strong></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}