import React, { useState } from 'react';
import { User, Lock, AlertTriangle, WifiOff, Loader2, ArrowRight } from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';

import './Login.css';

export default function Login({ isOffline, isLoginLoading, fazerLogin, loginErro }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    fazerLogin(usuario, senha);
  };

  return (
    <div className="login-container">
      {/* Background Decorativo */}
      <div className="login-background-shapes">
         <div className="shape shape-1"></div>
         <div className="shape shape-2"></div>
      </div>

      <div className="login-box anim-fade-in">
        <header className="login-header stagger-1">
          <div className="login-logo-wrapper">
            <TermoSyncLogo size={48} color="var(--primary)" />
          </div>
          <h2>TermoSync</h2>
          <p>Inteligência e controlo para a sua refrigeração.</p>
        </header>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-with-icon stagger-2">
            <User size={20} className="input-icon" />
            <input 
              type="text" 
              placeholder="Nome de utilizador" 
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
              type="password" 
              placeholder="Palavra-passe" 
              value={senha} 
              onChange={(e) => setSenha(e.target.value)} 
              required 
              disabled={isOffline || isLoginLoading}
              autoComplete="current-password"
            />
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
              <><WifiOff size={20}/> Sistema Offline</>
            ) : isLoginLoading ? (
              <><Loader2 size={20} className="spinner"/> A autenticar...</>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                Aceder ao Sistema <ArrowRight size={18} />
              </span>
            )}
          </button>
        </form>
        
        <footer className="login-footer">
          &copy; {new Date().getFullYear()} TermoSync - Monitorização RDC
        </footer>
      </div>
    </div>
  );
}