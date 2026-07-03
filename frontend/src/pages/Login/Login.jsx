import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  User, Lock, AlertTriangle, WifiOff, Loader2, ArrowRight, 
  Eye, EyeOff, CheckCircle, ArrowLeft, ShieldCheck, Activity, Terminal,
  Server, ChevronDown, ChevronUp
} from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';
import { getApiUrl, getServerUrl, setServerUrl, isCapacitor, isMobileDevice, needsServerConfig } from '../../config/api.js';

import './Login.css';

export default function Login({ isOffline, isLoginLoading, fazerLogin, loginErro }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockAtivo, setCapsLockAtivo] = useState(false);
  const [view, setView] = useState('login');
  
  const [resetUser, setResetUser] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(needsServerConfig());
  const [serverInput, setServerInput] = useState(getServerUrl());

  useEffect(() => {
    setResetError('');
    setSenha('');
    setCapsLockAtivo(false);
  }, [view]);

  const verificarCapsLock = (e) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setCapsLockAtivo(true);
    } else {
      setCapsLockAtivo(false);
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (usuario && senha) {
      fazerLogin(usuario, senha);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError('');

    if (!resetUser || !newPassword || !confirmPassword) {
      return setResetError('Preencha todos os campos.');
    }
    if (newPassword !== confirmPassword) {
      return setResetError('As senhas não coincidem.');
    }
    if (newPassword.length < 6) {
      return setResetError('A nova senha deve ter pelo menos 6 caracteres.');
    }

    setIsResetLoading(true);
    try {
      await axios.put(`${getApiUrl()}/usuarios/reset-senha`, { usuario: resetUser, novaSenha: newPassword });
      setView('success');
    } catch (error) {
      setResetError(error.response?.data?.error || 'Erro ao redefinir. Verifique o usuário.');
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <div className="login-container">
      
      {/* Elementos de Fundo */}
      <div className="login-background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      <div className="login-box anim-fade-in">
        
        {/* Container Isolado para o Scanner (Não corta o formulário) */}
        <div className="scanner-container">
          <div className="cyber-scanner"></div>
        </div>
        
        {/* Cabeçalho do Login */}
        <div className="login-header stagger-1">
          <div className="logo-wrapper">
            <TermoSyncLogo size={42} color="var(--primary)" />
          </div>
          <h2>TermoSync NOC</h2>
          <p className="system-status">
            {isOffline ? (
              <span className="status-offline"><WifiOff size={14}/> CONEXÃO PERDIDA</span>
            ) : (
              <span className="status-online"><Activity size={14} className="pulse-success-icon"/> SISTEMA ONLINE</span>
            )}
          </p>
        </div>

        {/* --- VISTA: LOGIN PRINCIPAL --- */}
        {view === 'login' && (
          <form onSubmit={handleLoginSubmit} className="login-form">
            
            {loginErro && (
              <div className="login-alert error stagger-2">
                <AlertTriangle size={18} />
                <span>{loginErro}</span>
              </div>
            )}
            
            {isOffline && (
              <div className="login-alert warning stagger-2">
                <WifiOff size={18} />
                <span>Modo Offline: Verifique a rede local.</span>
              </div>
            )}

            {(isCapacitor() || isMobileDevice()) && (
              <div className="server-config-panel stagger-2">
                <button
                  type="button"
                  className="server-config-toggle"
                  onClick={() => setShowServerConfig(!showServerConfig)}
                >
                  <span><Server size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Servidor Backend</span>
                  {showServerConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showServerConfig && (
                  <div className="server-config-body">
                    <label>Endereço do servidor (IP:porta)</label>
                    <input
                      type="url"
                      placeholder="http://192.168.1.100:3000"
                      value={serverInput}
                      onChange={(e) => setServerInput(e.target.value)}
                      onBlur={() => setServerUrl(serverInput)}
                    />
                    <span className="server-config-hint">
                      Use o IP da máquina onde o backend está rodando. Emulador Android: 10.0.2.2:3000
                    </span>
                    <span className="server-config-current">Atual: {getServerUrl()}</span>
                  </div>
                )}
              </div>
            )}

            <div className="input-group stagger-2">
              <label>Credencial de Acesso</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="ID de Usuário" 
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  disabled={isLoginLoading || isOffline}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="input-group stagger-3">
              <label>Chave de Segurança</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyUp={verificarCapsLock}
                  disabled={isLoginLoading || isOffline}
                  autoComplete="current-password"
                  required
                />
                <button 
                  type="button" 
                  className="btn-toggle-password" 
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {capsLockAtivo && <span className="caps-warning">CAPS LOCK ATIVO</span>}
            </div>

            <div className="forgot-password-row stagger-3">
              <button type="button" className="btn-link" onClick={() => setView('reset')}>
                Esqueceu a senha?
              </button>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary w-100 login-btn stagger-4" 
              disabled={isLoginLoading || isOffline || !usuario || !senha}
            >
              {isLoginLoading ? (
                <><Loader2 size={20} className="spinner" /> AUTENTICANDO...</>
              ) : (
                <><Terminal size={20} /> INICIAR SESSÃO <ArrowRight size={18} /></>
              )}
            </button>
          </form>
        )}

        {/* --- VISTA: RECUPERAR SENHA --- */}
        {view === 'reset' && (
          <form onSubmit={handleResetSubmit} className="login-form">
            <h3 className="form-title stagger-1"><ShieldCheck size={20}/> Redefinir Credenciais</h3>
            <p className="form-desc stagger-1">Insira seu ID e a nova chave de acesso para atualizar a segurança.</p>

            {resetError && (
              <div className="login-alert error stagger-2">
                <AlertTriangle size={18} />
                <span>{resetError}</span>
              </div>
            )}

            <div className="input-group stagger-2">
              <label>ID de Usuário</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="Seu usuário atual" 
                  value={resetUser}
                  onChange={(e) => setResetUser(e.target.value)}
                  disabled={isResetLoading}
                  required
                />
              </div>
            </div>

            <div className="input-group stagger-3">
              <label>Nova Chave de Segurança</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input 
                  type={showNewPassword ? "text" : "password"} 
                  placeholder="Mínimo 6 caracteres" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isResetLoading}
                  required
                />
                <button 
                  type="button" 
                  className="btn-toggle-password" 
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex="-1"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="input-group stagger-3">
              <label>Confirmar Nova Chave</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input 
                  type={showNewPassword ? "text" : "password"} 
                  placeholder="Repita a senha" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isResetLoading}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary w-100 login-btn stagger-4" 
              disabled={isResetLoading || !resetUser || !newPassword || !confirmPassword}
            >
              {isResetLoading ? <Loader2 size={20} className="spinner" /> : 'ATUALIZAR ACESSO'}
            </button>

            <button type="button" className="btn-back stagger-4" onClick={() => setView('login')}>
              <ArrowLeft size={16} /> Voltar ao Início
            </button>
          </form>
        )}

        {/* --- VISTA: SUCESSO --- */}
        {view === 'success' && (
          <div className="success-view anim-fade-in">
            <div className="stagger-1 success-icon-wrapper">
              <CheckCircle size={64} className="pulse-success-icon" />
            </div>
            <h2 className="stagger-2">Protocolo Aceito</h2>
            <p className="stagger-3">
              Sua credencial de acesso ao TermoSync foi redefinida. Utilize a nova chave para acessar a matriz.
            </p>
            
            <button 
              type="button" 
              className="btn btn-primary w-100 login-btn stagger-4" 
              onClick={() => { setView('login'); setResetUser(''); setNewPassword(''); setConfirmPassword(''); }}
            >
              CONCLUIR E ENTRAR
            </button>
          </div>
        )}
      </div>
      
      {/* Footer System Info */}
      <div className="login-footer stagger-4">
        <span>TermoSync NOC v3.0 Ultra</span>
        <span className="footer-dot">•</span>
        <span>Conexão Criptografada (AES-256)</span>
      </div>
    </div>
  );
}