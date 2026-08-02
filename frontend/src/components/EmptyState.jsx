import React from 'react';
import './EmptyState.css';

/*
  Componente: EmptyState
  Propósito: Fornecer um layout padronizado para páginas ou seções sem dados.
  Uso: <EmptyState title="Nenhum registro" description="Sem dados" icon={MyIcon} />
  Observação: ícone é decorativo e marcado com `aria-hidden` para acessibilidade.
*/
export default function EmptyState({ title = 'Nenhum registro', description = 'Não há dados disponíveis para exibir.', icon: Icon = null }) {
  return (
    <div className="ts-empty-state" role="status" aria-live="polite" aria-label={title}>
      {Icon && <div className="ts-empty-icon" aria-hidden="true"><Icon size={40} /></div>}
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
