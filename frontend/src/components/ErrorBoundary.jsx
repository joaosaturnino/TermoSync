/**
 * Módulo: frontend/src/components/ErrorBoundary.jsx
 * Responsabilidade: Implementa o componente reutilizável Error Boundary e seu contrato visual.
 */

import SystemErrorScreen from './SystemErrorScreen';
import React, { Component } from 'react';
import logger from '../utils/logger';

/**
 * import './ErrorBoundary.css';
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface
 *
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default class ErrorBoundary extends Component {
  // Preserva o erro e a árvore de componentes para compor um diagnóstico útil.
  constructor(props) { super(props); this.state = { hasError: false, error: null, errorInfo: null }; }

  // React exige que a transição para o fallback aconteça nesta fase estática.
  static getDerivedStateFromError(error) { return { hasError: true, error }; }

  // A captura posterior registra detalhes que não devem ser exibidos diretamente ao usuário.
  componentDidCatch(error, errorInfo) { logger.error('ErrorBoundary caught:', error, errorInfo); this.setState({ errorInfo }); }

  // Permite remontar a subtree sem recarregar toda a aplicação.
  retry = () => this.setState({ hasError: false, error: null, errorInfo: null });

  render() {
    // `forceError` existe somente para a prévia controlada em desenvolvimento.
    if (this.props.forceError || this.state.hasError) {
      return (
        <SystemErrorScreen
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          moduleName={this.props.moduleName}
          scope={this.props.scope}
          onRetry={this.props.onRetry || this.retry}
          onGoHome={this.props.onGoHome}
          onOpenSupport={this.props.onOpenSupport}
        />
      );
    }
    return this.props.children;
  }
}
