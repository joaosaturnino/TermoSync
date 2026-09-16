import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  User, Lock, AlertTriangle, WifiOff, Loader2, ArrowRight, 
  Eye, EyeOff, CheckCircle, ArrowLeft, ShieldCheck, Activity,
  ShieldAlert, Key, Mail, Smartphone
} from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';
import { getApiUrl } from '../../config/api.js';

import './Login.css';

/**
 * Tela de Login e recuperação de senha
 *
 * Responsabilidades:
 * - Apresentar boot-screen inicial
 * - Autenticar usuário via `fazerLogin`
 * - Fornecer fluxo de recuperação de senha e mensagens de erro
 */
export default function Login({ isOffline, isLoginLoading, fazerLogin, loginErro, mfaChallenge, concluirMfaLogin, cancelarMfa }) {
  const [isBooting, setIsBooting] = useState(true);
  const [bootLogs, setBootLogs] = useState([]);
  
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockAtivo, setCapsLockAtivo] = useState(false);
  const [view, setView] = useState('login');
  const [mfaCode, setMfaCode] = useState('');
  
  const [resetUser, setResetUser] = useState('');
  const [resetStep, setResetStep] = useState('request');
  const [resetChannel, setResetChannel] = useState('email');
  const [resetDestination, setResetDestination] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const resetRequestInFlightRef = useRef(false);

  // Lógica do Boot Screen Inicial (SaaS Enterprise)
  useEffect(() => {
    const sequence = [
      "Carregando módulos do sistema...",
      "Estabelecendo conexão segura (SSL)...",
      "Verificando integridade da rede...",
      "Iniciando plataforma ThermoSync..."
    ];
    let delay = 0;
    sequence.forEach((line, index) => {
      setTimeout(() => {
        setBootLogs(prev => [...prev, line]);
        if (index === sequence.length - 1) {
          setTimeout(() => setIsBooting(false), 600);
        }
      }, delay);
      delay += 250; // Mais rápido para não irritar o usuário no dia a dia
    });
  }, []);

  useEffect(() => {
    setResetError('');
    setSenha('');
    setCapsLockAtivo(false);
    if (view !== 'reset') {
      setResetStep('request');
      setResetChannel('email');
      setResetDestination('');
      setResetCode('');
      setResetMessage('');
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
    }
  }, [view]);

  /**
   * Concentra a logica de verificar caps lock para manter o restante do tela mais legivel.
   */
  const verificarCapsLock = (e) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setCapsLockAtivo(true);
    } else {
      setCapsLockAtivo(false);
    }
  };

  /**
   * Processa a interacao de handle login submit e atualiza a interface conforme o resultado.
   */
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (usuario && senha) {
      fazerLogin(usuario, senha);
    }
  };

  /**
   * Concentra a logica de choose reset channel para manter o restante do tela mais legivel.
   */
  const chooseResetChannel = (channel) => {
    setResetChannel(channel);
    setResetDestination('');
    setResetError('');
  };

  /**
   * Processa a interacao de handle reset submit e atualiza a interface conforme o resultado.
   */
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (resetRequestInFlightRef.current || isResetLoading) return;
    setResetError('');

    if (!resetUser) {
      return setResetError('Informe o usuário para receber o código de recuperação.');
    }
    if (!resetDestination) {
      return setResetError(resetChannel === 'sms' ? 'Informe o telefone que receberá o código.' : 'Informe o e-mail que receberá o código.');
    }

    resetRequestInFlightRef.current = true;
    setIsResetLoading(true);
    try {
      const { data } = await axios.post(`${getApiUrl()}/auth/password-reset/request`, {
        usuario: resetUser,
        canal: resetChannel,
        destino: resetDestination
      });
      setResetMessage(data?.message || 'Se o usuário existir, enviaremos um código de recuperação.');
      setResetStep('confirm');
    } catch (error) {
      setResetError(error.response?.data?.error || 'Não foi possível gerar a recuperação agora.');
    } finally {
      resetRequestInFlightRef.current = false;
      setIsResetLoading(false);
    }
  };

  /**
   * Processa a interacao de handle reset confirm submit e atualiza a interface conforme o resultado.
   */
  const handleResetConfirmSubmit = async (e) => {
    e.preventDefault();
    setResetError('');

    if (!resetUser || !resetCode || !newPassword || !confirmPassword) {
      return setResetError('Preencha usuário, código e nova senha.');
    }
    if (resetCode.length !== 6) {
      return setResetError('O código precisa ter 6 dígitos.');
    }
    if (newPassword !== confirmPassword) {
      return setResetError('As senhas digitadas não coincidem.');
    }

    setIsResetLoading(true);
    try {
      await axios.post(`${getApiUrl()}/auth/password-reset/confirm`, {
        usuario: resetUser,
        codigo: resetCode,
        novaSenha: newPassword
      });
      setView('success');
    } catch (error) {
      setResetError(error.response?.data?.error || 'Não foi possível redefinir a senha agora.');
    } finally {
      setIsResetLoading(false);
    }
  };

  /**
   * Concentra a logica de reset recovery flow para manter o restante do tela mais legivel.
   */
  const resetRecoveryFlow = () => {
    setView('login');
    setResetUser('');
    setResetStep('request');
    setResetChannel('email');
    setResetDestination('');
    setResetCode('');
    setResetMessage('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
  };

  /**
   * Processa a interacao de handle mfa submit e atualiza a interface conforme o resultado.
   */
  const handleMfaSubmit = (e) => {
    e.preventDefault();
    if (/^\d{6}$/.test(mfaCode) && concluirMfaLogin) concluirMfaLogin(mfaCode);
  };

  if (isBooting) {
    return (
      <div className="boot-overlay">
        <div style={{ margin: 'auto' }}>
          <TermoSyncLogo size={64} color="var(--primary)" />
          <div style={{ marginTop: '20px' }}>
            {bootLogs.map((log, i) => (
              <div key={i} className="boot-log-line">
                <span style={{color: '#64748b', marginRight: '8px'}}>[OK]</span>{log}
              </div>
            ))}
            <div className="boot-cursor"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      
      {/* Elementos de Fundo */}
      <div className="login-background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      <div className="login-box anim-fade-in">
        
        {/* Container Isolado para o Scanner */}
        <div className="scanner-container">
          <div className="cyber-scanner"></div>
        </div>
        
        {/* Cabeçalho do Login */}
        <div className="login-header stagger-1">
          <div className="logo-wrapper">
            <TermoSyncLogo size={42} color="var(--primary)" />
          </div>
          <h2>ThermoSync</h2>
          <h3>Comando, controle e sincronização térmica.</h3>
          <div className="system-status">
            {isOffline ? (
              <span className="status-offline"><WifiOff size={14}/> SEM CONEXÃO (OFFLINE)</span>
            ) : (
              <span className="status-online"><Activity size={14} className="pulse-success-icon"/> SISTEMA ONLINE</span>
            )}
          </div>
        </div>

        {/* --- VISTA: LOGIN PRINCIPAL --- */}
        {mfaChallenge && (
          <form onSubmit={handleMfaSubmit} className="login-form">
            <h3 className="form-title stagger-1"><ShieldCheck size={20}/> Verificação em duas etapas</h3>
            <p className="form-desc stagger-1">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>

            {loginErro && (
              <div className="login-alert error stagger-2">
                <ShieldAlert size={18} />
                <span>{loginErro}</span>
              </div>
            )}

            <div className="input-group stagger-2">
              <label>Código MFA</label>
              <div className="input-wrapper">
                <ShieldCheck size={18} className="input-icon" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={isLoginLoading}
                  autoComplete="one-time-code"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-100 login-btn stagger-4" disabled={isLoginLoading || mfaCode.length !== 6}>
              {isLoginLoading ? <><Loader2 size={20} className="spinner" /> VALIDANDO...</> : <><Lock size={20} /> VALIDAR MFA</>}
            </button>
            <button type="button" className="btn-back stagger-4" onClick={() => { setMfaCode(''); cancelarMfa?.(); }}>
              <ArrowLeft size={16} /> Voltar para o Login
            </button>
          </form>
        )}

        {!mfaChallenge && view === 'login' && (
          <form onSubmit={handleLoginSubmit} className="login-form">
            
            {loginErro && (
              <div className="login-alert error stagger-2">
                <ShieldAlert size={18} />
                <span>{loginErro}</span>
              </div>
            )}
            
            {isOffline && (
              <div className="login-alert warning stagger-2">
                <WifiOff size={18} />
                <span>Modo Offline: Verifique sua conexão com a internet.</span>
              </div>
            )}

            <div className="input-group stagger-2">
              <label>Usuário de Acesso</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="Digite seu usuário" 
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  disabled={isLoginLoading || isOffline}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="input-group stagger-3">
              <label>Senha</label>
              <div className="input-wrapper">
                <Key size={18} className="input-icon" />
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
                <><Loader2 size={20} className="spinner" /> ENTRANDO...</>
              ) : (
                <><Lock size={20} /> ACESSAR SISTEMA <ArrowRight size={18} /></>
              )}
            </button>
          </form>
        )}

        {/* --- VISTA: RECUPERAR SENHA --- */}
        {view === 'reset' && (
          <form onSubmit={resetStep === 'request' ? handleResetSubmit : handleResetConfirmSubmit} className={`login-form recovery-form recovery-form-${resetStep}`}>
            <h3 className="form-title stagger-1"><ShieldCheck size={20}/> Recuperar Acesso</h3>
            <p className="form-desc stagger-1">
              {resetStep === 'request'
                ? 'Informe seu usuário e escolha onde deseja receber o código temporário.'
                : 'Digite o código recebido e escolha sua nova senha de acesso.'}
            </p>

            {resetError && (
              <div className="login-alert error stagger-2">
                <AlertTriangle size={18} />
                <span>{resetError}</span>
              </div>
            )}

            {resetMessage && (
              <div className="login-alert success stagger-2">
                <ShieldCheck size={18} />
                <span>{resetMessage}</span>
              </div>
            )}

            <div className="input-group stagger-2">
              <label>Usuário</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="Seu usuário no sistema" 
                  value={resetUser}
                  onChange={(e) => setResetUser(e.target.value)}
                  disabled={isResetLoading || resetStep === 'confirm'}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {resetStep === 'request' && (
              <div className="input-group stagger-3">
                <label>Receber código por</label>
                <div className="reset-channel-options" role="radiogroup" aria-label="Canal de recuperação">
                  <button
                    type="button"
                    className={`reset-channel-option ${resetChannel === 'email' ? 'active' : ''}`}
                    onClick={() => chooseResetChannel('email')}
                    aria-pressed={resetChannel === 'email'}
                    disabled={isResetLoading}
                  >
                    <Mail size={18} />
                    <span>E-mail</span>
                  </button>
                  <button
                    type="button"
                    className={`reset-channel-option ${resetChannel === 'sms' ? 'active' : ''}`}
                    onClick={() => chooseResetChannel('sms')}
                    aria-pressed={resetChannel === 'sms'}
                    disabled={isResetLoading}
                  >
                    <Smartphone size={18} />
                    <span>SMS</span>
                  </button>
                </div>
              </div>
            )}

            {resetStep === 'request' && (
              <div className="input-group stagger-3">
                <label>{resetChannel === 'sms' ? 'Telefone para receber' : 'E-mail para receber'}</label>
                <div className="input-wrapper">
                  {resetChannel === 'sms' ? (
                    <Smartphone size={18} className="input-icon" />
                  ) : (
                    <Mail size={18} className="input-icon" />
                  )}
                  <input
                    type={resetChannel === 'sms' ? 'tel' : 'email'}
                    inputMode={resetChannel === 'sms' ? 'tel' : 'email'}
                    placeholder={resetChannel === 'sms' ? '(00) 00000-0000' : 'email@empresa.com'}
                    value={resetDestination}
                    onChange={(e) => setResetDestination(e.target.value)}
                    disabled={isResetLoading}
                    autoComplete={resetChannel === 'sms' ? 'tel' : 'email'}
                    required
                  />
                </div>
              </div>
            )}

            {resetStep === 'confirm' && (
              <>
                <div className="input-group stagger-3">
                  <label>Código de recuperação</label>
                  <div className="input-wrapper">
                    <ShieldCheck size={18} className="input-icon" />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      disabled={isResetLoading}
                      autoComplete="one-time-code"
                      required
                    />
                  </div>
                </div>

                <div className="input-group stagger-3">
                  <label>Nova senha</label>
                  <div className="input-wrapper">
                    <Lock size={18} className="input-icon" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Digite sua nova senha"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isResetLoading}
                      autoComplete="new-password"
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
                  <label>Confirmar nova senha</label>
                  <div className="input-wrapper">
                    <Lock size={18} className="input-icon" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isResetLoading}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <button 
              type="submit" 
              className="btn btn-primary w-100 login-btn stagger-4" 
              disabled={isResetLoading || !resetUser || (resetStep === 'request' && !resetDestination) || (resetStep === 'confirm' && (!resetCode || !newPassword || !confirmPassword))}
            >
              {isResetLoading ? (
                <><Loader2 size={20} className="spinner" /> ENVIANDO...</>
              ) : resetStep === 'request' ? (
                <><ShieldCheck size={20} /> RECEBER CÓDIGO <ArrowRight size={18} /></>
              ) : (
                <><Lock size={20} /> ALTERAR SENHA <ArrowRight size={18} /></>
              )}
            </button>

            {resetStep === 'confirm' && (
              <button type="button" className="btn-link reset-secondary-action stagger-4" onClick={() => { setResetStep('request'); setResetCode(''); setResetMessage(''); }}>
                Solicitar novo código
              </button>
            )}

            <button type="button" className="btn-back stagger-4" onClick={resetRecoveryFlow}>
              <ArrowLeft size={16} /> Voltar para o Login
            </button>
          </form>
        )}

        {/* --- VISTA: SUCESSO --- */}
        {view === 'success' && (
          <div className="success-view anim-fade-in">
            <div className="stagger-1 success-icon-wrapper">
              <CheckCircle size={64} className="pulse-success-icon" />
            </div>
            <h2 className="stagger-2">Senha Atualizada!</h2>
            <p className="stagger-3">
              Sua senha foi redefinida com sucesso. Acesse a plataforma usando a nova senha escolhida.
            </p>
            
            <button 
              type="button" 
              className="btn btn-primary w-100 login-btn stagger-4" 
              onClick={resetRecoveryFlow}
            >
              VOLTAR AO INÍCIO
            </button>
          </div>
        )}
      </div>
      
      {/* Footer System Info */}
      <div className="login-footer stagger-4">
        <span>ThermoSync: Comando, controle e sincronização térmica.</span>
        <span className="footer-dot">•</span>
        <span>Ambiente Seguro</span>
      </div>
    </div>
  );
}
