/**
 * Módulo: frontend/src/hooks/usePersistentState.js
 * Responsabilidade: Centraliza estado e efeitos compartilhados pelo hook use Persistent State.
 */

import { useEffect, useState } from 'react';
/**
 * Módulo: frontend/src/hooks/usePersistentState.js
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
 *
 * @param {unknown} key - Valor de key consumido por esta rotina.
 * @param {unknown} initialValue - Valor de initial value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored == null ? initialValue : JSON.parse(stored);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Preferências não devem interromper o fluxo quando o armazenamento estiver indisponível.
    }
  }, [key, value]);

  return [value, setValue];
}
