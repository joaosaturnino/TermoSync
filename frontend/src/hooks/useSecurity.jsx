import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config/api';
import logger from '../utils/logger';

/**
 * Valida a sessão atual contra o backend.
 *
 * O objetivo é não confiar apenas no sessionStorage: se o token foi revogado,
 * expirou ou sumiu do banco, o hook limpa a sessão local e força logout.
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
     */
    const verifySession = async () => {
      // A verificação usa /auth/verify para confirmar que o token ainda é aceito
      // e que a sessão ativa não foi revogada pelo SOC/DEV.
      const currentToken = sessionStorage.getItem('token'); // <-- Mudou para sessionStorage
      
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
          logger.error('[SECURITY] Sessão não validada pelo servidor. Encerrando sessão local.', error);
          forceLogout();
        }
      }
    };

    verifySession();

    return () => { isMounted = false; };
  }, [forceLogout]);

  /**
   * Expõe o hook has Permission com estado e acoes compartilhadas pela aplicacao.
   */
  const hasPermission = (allowedRoles) => {
    // Helper simples para componentes que só precisam validar papel do usuário.
    if (!authState.isAuthenticated || !authState.role) return false;
    return allowedRoles.includes(authState.role);
  };

  return { authState, setAuthState, forceLogout, hasPermission };
}
