/**
 * Módulo: frontend/src/hooks/useSecurity.jsx
 * Responsabilidade: Centraliza estado e efeitos compartilhados pelo hook use Security.
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config/api';
import logger from '../utils/logger';

/**
 * Expõe o hook use Security com estado e acoes compartilhadas pela aplicacao.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador
 *
 * @param {unknown} initialToken - Valor de initial token consumido por esta rotina.
 * @param {Function} onLogout - Função chamada para comunicar o resultado ao componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function useSecurity(initialToken, onLogout) {
  const [authState, setAuthState] = useState({
    isAuthenticated: !!initialToken,
    isVerifying: !!initialToken, 
    role: sessionStorage.getItem('userRole') || null, // <-- Mudou para sessionStorage
    token: initialToken,
    user: null,
  });

  const forceLogout = useCallback(() => {
    // Remove todos os dados sensíveis do navegador antes de atualizar a UI.
    const chavesAuth = ['token', 'userId', 'userRole', 'userFilial', 'userEmpresa', 'nomeLogado', 'papelLogado', 'loginAtivo', 'devAuth', 'abaAtiva'];
    chavesAuth.forEach(k => sessionStorage.removeItem(k)); // <-- Mudou para sessionStorage
    sessionStorage.clear();
    setAuthState({ isAuthenticated: false, isVerifying: false, role: null, token: null, user: null });
    if (onLogout) onLogout();
  }, [onLogout]);

  useEffect(() => {
    let isMounted = true;


    /**
     * Expõe o hook verify Session com estado e acoes compartilhadas pela aplicacao.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
     * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
     *
     * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador
     *
     * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const verifySession = async () => {
      // A verificação usa /auth/verify para confirmar que o token ainda é aceito
      // e que a sessão ativa não foi revogada pelo SOC/DEV.
      const currentToken = initialToken || sessionStorage.getItem('token');
      
      if (!currentToken) {
        if (isMounted) setAuthState(prev => ({ ...prev, isVerifying: false }));
        return;
      }

      try {
        const response = await axios.get(`${getApiUrl()}/auth/verify`, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });

          if (isMounted) {
            setAuthState({
              isAuthenticated: true,
              isVerifying: false,
              role: response.data.role || sessionStorage.getItem('userRole'),
              token: currentToken,
              user: response.data
            });
          }
      } catch (error) {
        if (isMounted) {
          const status = error.response?.status;
          if (status === 401 || status === 403) {
            logger.error('[SECURITY] Sessão rejeitada pelo servidor. Encerrando sessão local.', error);
            forceLogout();
          } else {
            // Rate limit, indisponibilidade e falhas de rede são temporários e não
            // invalidam um token que já estava autenticado no navegador.
            logger.warn('[SECURITY] Não foi possível revalidar a sessão agora; mantendo a sessão local.', error);
            setAuthState(prev => ({
              ...prev,
              isAuthenticated: true,
              isVerifying: false,
              role: prev.role || sessionStorage.getItem('userRole'),
              token: currentToken
            }));
          }
        }
      }
    };

    verifySession();

    return () => { isMounted = false; };
  }, [forceLogout, initialToken]);


  /**
   * Expõe o hook has Permission com estado e acoes compartilhadas pela aplicacao.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} allowedRoles - Valor de allowed roles consumido por esta rotina.
   * @returns {boolean} Indica se a condição avaliada foi atendida.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const hasPermission = (allowedRoles) => {
    // Helper simples para componentes que só precisam validar papel do usuário.
    if (!authState.isAuthenticated || !authState.role) return false;
    return allowedRoles.includes(authState.role);
  };

  return { authState, setAuthState, forceLogout, hasPermission };
}
