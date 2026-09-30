/**
 * Módulo: frontend/src/components/Loader.jsx
 * Responsabilidade: Implementa o componente reutilizável Loader e seu contrato visual.
 */

import React from 'react';
import './Loader.css';

import { Activity } from 'lucide-react';

/**
 * Renderiza o componente Loader e encapsula sua interacao visual reutilizavel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.message - Propriedade message usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.size - Propriedade size usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function Loader({ message = 'Carregando...', size = 48 }) {
  return (
    <div className="ts-loader-container" role="status" aria-live="polite" aria-busy="true" aria-label={message} style={{ '--loader-size': `${size}px` }}>
      <div className="ts-loader-visual" aria-hidden="true"><span className="ts-loader-spinner" /><Activity size={Math.max(16, Math.round(size * .38))} /></div>
      <div className="ts-loader-copy"><strong>{message}</strong><span>Sincronizando dados com o núcleo operacional</span></div>
    </div>
  );
}
