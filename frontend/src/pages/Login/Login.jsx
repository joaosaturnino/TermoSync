import React, { useState } from 'react';
import axios from 'axios';
import { User, Lock, AlertTriangle, WifiOff, Loader2, ArrowRight, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';

import './Login.css';

const API_URL = 'http://localhost:3000/api';

export default function Login({ isOffline, isLoginLoading, fazerLogin, loginErro }) {
  // 1. Estados do Formulário de Login
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 2. Estado de Visualização ('login', 'forgot', 'success')
  const [view, setView] = useState('login');
  
  // 3. Estados da Alteração de Senha
  const [resetUser, setResetUser] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    fazerLogin(usuario, senha);
  };

  // Lógica para Guardar a Nova Senha na Base de Dados
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError('');

    if (newPassword !== confirmPassword) {
      setResetError('As senhas não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsResetLoading(true);
    
    try {
      await axios.post(`${API_URL}/reset-password`, { 
        usuario: resetUser, 
        novaSenha: newPassword 
      });
      // Se tiver sucesso, vai para a tela de confirmação
      setView('success');
    } catch (err) {
      setResetError(err.response?.data?.error || 'Erro ao comunicar com o servidor.');
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Background Decorativo */}
      <div className="login-background-shapes">
         <div className="shape shape-1"></div>
         <div className="shape shape-2"></div>
      </div>

      <div className="login-box anim-fade-in">
        
        {/* ======================================================
            TELA DE LOGIN PADRÃO
            ====================================================== */}
        {view === 'login' && (
          <>
            <header className="login-header stagger-1">
              <div className="login-logo-wrapper">
                <TermoSyncLogo size={48} color="var(--primary)" />
              </div>
              <h2>TermoSync</h2>
              <p>Inteligência e controle para a sua refrigeração.</p>
            </header>

            <form onSubmit={handleLoginSubmit} className="login-form">
              <div className="input-with-icon stagger-2">
                <User size={20} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="Usuário" 
                  value={usuario} 
                  onChange={(e) => setUsuario(e.target.value)} 
                  required 
                  disabled={isOffline || isLoginLoading}
                  autoComplete="username"
                />
              </div>

              <div className="input-with-icon stagger-3">
                <Lock size={20} className="input-icon" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Senha" 
                  value={senha} 
                  onChange={(e) => setSenha(e.target.value)} 
                  required 
                  disabled={isOffline || isLoginLoading}
                  autoComplete="current-password"
                />
                <button 
                  type="button" 
                  className="password-toggle"
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="stagger-3" style={{ width: '100%', textAlign: 'right', marginTop: '-0.5rem' }}>
                 <button 
                    type="button" 
                    onClick={() => {
                        setView('forgot');
                        setResetError('');
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: '600' }}
                 >
                   Esqueceu a senha?
                 </button>
              </div>

              {loginErro && (
                <div className="login-error-container stagger-3">
                  <AlertTriangle size={18} /> {loginErro}
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary w-100 login-btn stagger-4" 
                disabled={isOffline || isLoginLoading}
              >
                {isOffline ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><WifiOff size={20}/> Sistema Offline</span>
                ) : isLoginLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Loader2 size={20} className="spinner"/> A autenticar...</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Acessar o Sistema <ArrowRight size={18} /></span>
                )}
              </button>
            </form>
          </>
        )}

        {/* ======================================================
            TELA DE ALTERAÇÃO DE SENHA DIRETA
            ====================================================== */}
        {view === 'forgot' && (
          <div className="anim-fade-in">
            <header className="login-header stagger-1">
              <div className="login-logo-wrapper" style={{ background: 'rgba(56, 189, 248, 0.1)' }}>
                <Lock size={36} color="#38bdf8" />
              </div>
              <h2>Nova Senha</h2>
              <p>Insira o seu usuário e defina a sua nova senha de acesso.</p>
            </header>

            <form onSubmit={handleResetSubmit} className="login-form">
              <div className="input-with-icon stagger-2">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="Usuário" 
                  value={resetUser} 
                  onChange={(e) => setResetUser(e.target.value)} 
                  required 
                  disabled={isOffline || isResetLoading}
                />
              </div>

              <div className="input-with-icon stagger-2">
                <Lock size={18} className="input-icon" />
                <input 
                  type={showNewPassword ? "text" : "password"} 
                  placeholder="Nova Senha" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                  disabled={isOffline || isResetLoading}
                />
                <button type="button" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }} onClick={() => setShowNewPassword(!showNewPassword)} tabIndex="-1">
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="input-with-icon stagger-2">
                <Lock size={18} className="input-icon" />
                <input 
                  type={showNewPassword ? "text" : "password"} 
                  placeholder="Confirme a Nova Senha" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required 
                  disabled={isOffline || isResetLoading}
                />
              </div>

              {resetError && (
                <div className="login-error-container stagger-3">
                  <AlertTriangle size={18} /> {resetError}
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary w-100 login-btn stagger-3" 
                style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}
                disabled={isOffline || isResetLoading}
              >
                {isResetLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Loader2 size={20} className="spinner"/> A guardar...</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Confirmar Alteração <CheckCircle size={18} /></span>
                )}
              </button>

              <button 
                type="button" 
                onClick={() => setView('login')}
                style={{ marginTop: '1rem', background: 'transparent', border: 'none', color: '#94a3b8', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <ArrowLeft size={16} /> Voltar ao Login
              </button>
            </form>
          </div>
        )}

        {/* ======================================================
            TELA DE SUCESSO
            ====================================================== */}
        {view === 'success' && (
          <div className="anim-fade-in" style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div className="stagger-1" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <CheckCircle size={64} color="#10b981" />
            </div>
            <h2 className="stagger-2" style={{ color: 'white', fontSize: '1.5rem', marginBottom: '0.8rem' }}>Senha Alterada!</h2>
            <p className="stagger-3" style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '2rem' }}>
              A sua senha foi atualizada com sucesso. Já pode utilizar a sua nova credencial para acessar ao sistema.
            </p>
            
            <button 
              type="button" 
              className="btn btn-primary w-100 login-btn stagger-4" 
              onClick={() => { 
                  setView('login'); 
                  setResetUser(''); 
                  setNewPassword(''); 
                  setConfirmPassword(''); 
              }}
            >
              Concluir e Fazer Login
            </button>
          </div>
        )}

        <footer className="login-footer">
          &copy; {new Date().getFullYear()} TermoSync - Monitorização RDC
        </footer>
      </div>
    </div>
  );
}