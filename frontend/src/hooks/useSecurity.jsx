import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config/api';

export function useSecurity(initialToken, onLogout) {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    isVerifying: true, // Começa bloqueando a tela até provar que é seguro
    role: null,
    token: initialToken,
    user: null,
  });

  const forceLogout = useCallback(() => {
    sessionStorage.clear();
    setAuthState({ isAuthenticated: false, isVerifying: false, role: null, token: null, user: null });
    if (onLogout) onLogout();
  }, [onLogout]);

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      const currentToken = sessionStorage.getItem('token');
      if (!currentToken) {
        if (isMounted) forceLogout();
        return;
      }

      try {
        // A VERDADEIRA SEGURANÇA: Bater na API para validar se o token não foi forjado
        // Se a API não existir ainda, simule com um timeout, mas NÃO confie no sessionStorage
        const response = await axios.get(`${getApiUrl()}/auth/verify`, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });

        if (isMounted) {
          setAuthState({
            isAuthenticated: true,
            isVerifying: false,
            role: response.data.role, // O Backend dita a regra, não o frontend!
            token: currentToken,
            user: response.data
          });
        }
      } catch (error) {
        console.error("[SECURITY] Violação de sessão ou token expirado.");
        if (isMounted) forceLogout();
      }
    };

    verifySession();

    // Listener para pegar malandrinhos tentando alterar o SessionStorage no DevTools (F12)
    const handleStorageTampering = (e) => {
      if (e.key === 'userRole' || e.key === 'token') {
        console.warn("[SECURITY] Tentativa de injeção de privilégios detectada. Purgando sessão.");
        forceLogout();
      }
    };
    window.addEventListener('storage', handleStorageTampering);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageTampering);
    };
  }, [forceLogout]);

  // Função helper para blindar renderizações de botões nas telas
  const hasPermission = (allowedRoles) => {
    if (!authState.isAuthenticated || !authState.role) return false;
    return allowedRoles.includes(authState.role);
  };

  return { authState, setAuthState, forceLogout, hasPermission };
}