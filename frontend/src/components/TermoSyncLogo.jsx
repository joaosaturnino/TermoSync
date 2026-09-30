/**
 * Módulo: frontend/src/components/TermoSyncLogo.jsx
 * Responsabilidade: Implementa o componente reutilizável Termo Sync Logo e seu contrato visual.
 */

import { useId } from 'react';
import React from 'react';

/**
 * Renderiza o componente Termo Sync Logo e encapsula sua interacao visual reutilizavel.
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
 * @param {unknown} props.size - Propriedade size usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.color - Propriedade color usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.className - Propriedade className usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function TermoSyncLogo({ size = 40, color = 'var(--brand-core, #42d9ae)', className = '' }) {
  const gradientId = `ts-spectrum-${useId().replace(/:/g, '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={`termosync-logo ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="6" y1="8" x2="34" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-cold, #67b7ff)" />
          <stop offset="0.52" stopColor={color} />
          <stop offset="1" stopColor="var(--brand-warm, #ff756d)" />
        </linearGradient>
      </defs>

      <rect x="5" y="4" width="30" height="32" rx="7" fill="var(--brand-mark-bg, rgba(8, 25, 31, .72))" stroke={`url(#${gradientId})`} strokeWidth="2" />
      <path d="M14 5v30" stroke="var(--brand-cold, #67b7ff)" strokeWidth="1.5" opacity=".55" />
      <path d="M8.5 23h6.2l3.1-9 4.4 15 3.6-10 2.5 4H32" stroke={`url(#${gradientId})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="23" r="2.1" fill="var(--brand-warm, #ff756d)" />
      <path d="M9 9h2.5M9 13h2.5M9 17h2.5" stroke="var(--brand-cold, #67b7ff)" strokeWidth="1.4" strokeLinecap="round" opacity=".78" />
    </svg>
  );
}
