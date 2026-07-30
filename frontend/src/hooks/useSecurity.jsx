import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config/api';

export function useSecurity(initialToken, onLogout) {
  const [authState, setAuthState] = useState({
    isAuthenticated: !!initialToken,
    isVerifying: !!initialToken, 
    role: sessionStorage.getItem('userRole') || null, // <-- Mudou para sessionStorage
    token: initialToken,
    user: null,
  });

  const forceLogout = useCallback(() => {
    const chavesAuth = ['token', 'userId', 'userRole', 'userFilial', 'userEmpresa', 'nomeLogado', 'papelLogado', 'loginAtivo', 'devAuth', 'abaAtiva'];
    chavesAuth.forEach(k => sessionStorage.removeItem(k)); // <-- Mudou para sessionStorage
    sessionStorage.clear();
    setAuthState({ isAuthenticated: false, isVerifying: false, role: null, token: null, user: null });
    if (onLogout) onLogout();
  }, [onLogout]);

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
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
          if (error.response && error.response.status === 401) {
            console.error("[SECURITY] Acesso Negado. O Token expirou de verdade.");
            forceLogout();
          } else {
            console.warn("[SECURITY] Validação online falhou (Rede/CORS). Assumindo a sessão pelo Cache Local.");
            setAuthState({
              isAuthenticated: true,
              isVerifying: false,
              role: sessionStorage.getItem('userRole'),
              token: currentToken,
              user: { role: sessionStorage.getItem('userRole') }
            });
          }
        }
      }
    };

    verifySession();

    return () => { isMounted = false; };
  }, [forceLogout]);

  const hasPermission = (allowedRoles) => {
    if (!authState.isAuthenticated || !authState.role) return false;
    return allowedRoles.includes(authState.role);
  };

  return { authState, setAuthState, forceLogout, hasPermission };
}