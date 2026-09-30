/**
 * Módulo: frontend/src/context/AuthProvider.jsx
 * Responsabilidade: Centraliza as responsabilidades do módulo Auth Provider.
 */

import React, { useState } from 'react';
import { AuthContext } from './AuthContext.jsx';

/**
 * Concentra a logica de auth provider para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.children - Propriedade children usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
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
