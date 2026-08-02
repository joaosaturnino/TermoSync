import React, { Component } from 'react';
import { Terminal, Activity } from 'lucide-react';
import logger from '../utils/logger';
import './ErrorBoundary.css';

/*
  Componente: ErrorBoundary
  Propósito: Capturar erros de renderização em qualquer subtree React e mostrar uma tela de recuperação.
  Uso: Envolva o `App` ou partes críticas com <ErrorBoundary> para evitar que falhas quebrem toda a UI.
  Nota: registra o erro via `logger.error` e fornece botão para recarregar a aplicação.
*/
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, errorInfo: null }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { logger.error('ErrorBoundary caught:', error, errorInfo); this.setState({ errorInfo }); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="ts-crash-screen" role="alert" aria-live="assertive">
          <div className="ts-crash-box">
            <Terminal size={56} className="ts-crash-icon" />
            <h2>Sistema interrompido</h2>
            <p>Ocorreu um erro inesperado na interface. Sua sessão permanece segura.</p>
            <div className="ts-crash-code">ERR_UI_RENDER_FAIL</div>
            <button className="btn btn-danger" onClick={() => window.location.reload()} aria-label="Recarregar aplicação">
              <Activity size={16} /> Reiniciar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
