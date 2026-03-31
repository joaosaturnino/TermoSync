import React, { useState } from 'react';
import { User, Lock, AlertTriangle, WifiOff, Loader2 } from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';

export default function Login({ isOffline, isLoginLoading, fazerLogin, loginErro }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    fazerLogin(usuario, senha);
  };

  return (
    <div className="login-container">
      <div className="login-background-shapes">
         <div className="shape shape-1"></div><div className="shape shape-2"></div>
      </div>
      <div className="login-box stagger-1">
        <div className="login-header">
          <div className="login-logo-wrapper"><TermoSyncLogo size={42} color="var(--primary)" /></div>
          <h2>TermoSync</h2><p>Inteligência e controle para a sua refrigeração.</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-with-icon stagger-2">
            <User size={20} className="input-icon" />
            <input type="text" placeholder="Usuário" value={usuario} onChange={(e) => setUsuario(e.target.value)} required disabled={isOffline || isLoginLoading} style={loginErro ? { borderColor: 'var(--danger)', backgroundColor: 'var(--danger-light)' } : {}} />
          </div>
          <div className="input-with-icon stagger-3">
            <Lock size={20} className="input-icon" />
            <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required disabled={isOffline || isLoginLoading} style={loginErro ? { borderColor: 'var(--danger)', backgroundColor: 'var(--danger-light)' } : {}} />
          </div>
          {loginErro && (
            <div className="stagger-3" style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <AlertTriangle size={16} /> {loginErro}
            </div>
          )}
          <button type="submit" className="btn btn-primary w-100 login-btn stagger-4" disabled={isOffline || isLoginLoading}>
            {isOffline ? <><WifiOff size={20}/> Gateway Offline</> : isLoginLoading ? <><Loader2 size={20} className="spin-anim"/> A Autenticar...</> : 'Acessar Sistema'}
          </button>
        </form>
        <div className="login-footer stagger-4"><p>Protegido por Criptografia End-to-End</p></div>
      </div>
    </div>
  );
}