import React from 'react';
import './Loader.css';

/*
  Componente: Loader
  Propósito: Exibir um indicador de carregamento consistente em toda a aplicação.
  Uso: <Loader message="Carregando..." size={48} />
  Acessibilidade: possui `role="status"`, `aria-live="polite"` e `aria-busy` para leitores de tela.
*/
export default function Loader({ message = 'Carregando...', size = 48 }) {
  return (
    <div className="ts-loader-container" role="status" aria-live="polite" aria-busy="true" aria-label={message}>
      <div className="ts-loader-spinner" style={{ width: size, height: size }} aria-hidden="true" />
      <div className="ts-loader-message">{message}</div>
    </div>
  );
}
