import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(sessionStorage.getItem('token') || '');
  const [userId, setUserId] = useState(sessionStorage.getItem('userId') || ''); 
  
  const [userRole, setUserRole] = useState(sessionStorage.getItem('userRole') || 'LOJA');
  const [userFilial, setUserFilial] = useState(sessionStorage.getItem('userFilial') || 'Todas');
  const [nomeLogado, setNomeLogado] = useState(sessionStorage.getItem('nomeLogado') || '');
  const [papelLogado, setPapelLogado] = useState(sessionStorage.getItem('papelLogado') || '');
  const [loginAtivo, setLoginAtivo] = useState(sessionStorage.getItem('loginAtivo') || '');
  const [isDevAuthenticated, setIsDevAuthenticated] = useState(sessionStorage.getItem('devAuth') === 'true');

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

export const useAuth = () => useContext(AuthContext);