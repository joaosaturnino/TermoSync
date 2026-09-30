/**
 * Módulo: frontend/src/components/EmptyState.jsx
 * Responsabilidade: Implementa o componente reutilizável Empty State e seu contrato visual.
 */

import { Inbox } from 'lucide-react';
import React from 'react';
import './EmptyState.css';

/**
 * Renderiza o componente Empty State e encapsula sua interacao visual reutilizavel.
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
 * @param {unknown} props.title - Propriedade title usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.description - Propriedade description usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.icon - Propriedade icon usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.actionLabel - Propriedade actionLabel usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onAction - Callback onAction fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function EmptyState({ title = 'Nenhum registro', description = 'Não há dados disponíveis para exibir.', icon: Icon = Inbox, actionLabel = '', onAction }) {
  return (
    <div className="ts-empty-state" role="status" aria-live="polite" aria-label={title}>
      <div className="ts-empty-icon" aria-hidden="true"><Icon size={25} /></div>
      <div className="ts-empty-copy"><h3>{title}</h3><p>{description}</p></div>
      {actionLabel && onAction && <button type="button" className="ts-empty-action" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}
