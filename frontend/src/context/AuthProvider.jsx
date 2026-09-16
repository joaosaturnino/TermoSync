import React, { useState } from 'react';
import { AuthContext } from './AuthContext.jsx';

/**
 * Concentra a logica de auth provider para manter o restante do modulo mais legivel.
 */
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(sessionStorage.getItem('token') || '');
  const [userId, setUserId] = useState(sessionStorage.getItem('userId') || '');
  const [userRole, setUserRole] = useState(sessionStorage.getItem('userRole') || 'LOJA');
  const [userFilial, setUserFilial] = useState(sessionStorage.getItem('userFilial') || 'Todas');
  const [nomeLogado, setNomeLogado] = useState(sessionStorage.getItem('nomeLogado') || '');
  const [papelLogado, setPapelLogado] = useState(sessionStorage.getItem('papelLogado') || '');
  const [loginAtivo, setLoginAtivo] = useState(sessionStorage.getItem('loginAtivo') || '');
  const [isDevAuthenticated, setIsDevAuthenticated] = useState(sessionStorage.getItem('devAuth') === 'true');

  /**
   * Registra logout para auditoria, historico ou diagnostico.
   */
  const logout = () => {
    sessionStorage.clear();
    setToken('');
    setUserId('');
    setUserRole('LOJA');
    setUserFilial('Todas');
    setNomeLogado('');
    setPapelLogado('');
    setLoginAtivo('');
    setIsDevAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      token, setToken,
      userId, setUserId,
      userRole, setUserRole,
      userFilial, setUserFilial,
      nomeLogado, setNomeLogado,
      papelLogado, setPapelLogado,
      loginAtivo, setLoginAtivo,
      isDevAuthenticated, setIsDevAuthenticated,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};
