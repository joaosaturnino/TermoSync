import React from 'react';
import { ShieldCheck, Activity, Server, LogIn, UserPlus, ArrowRight } from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo'; // Ajuste o caminho se necessário
import './LandingPage.css';

export default function LandingPage({ onNavigate }) {
  return (
    <div className="landing-viewport">
      <div className="landing-content">
        
        <div className="landing-badge">
          <span className="pulse-success-icon" style={{display: 'inline-block', width: '8px', height: '8px', background: '#10b981', borderRadius: '50%'}}></span>
          Sistemas Operacionais
        </div>

        <TermoSyncLogo size={80} color="#38bdf8" style={{ marginBottom: '1rem' }} />
        
        <h1 className="landing-title">ThermoSync</h1>
        
        <p className="landing-subtitle">
          Plataforma Enterprise de Monitorização Frigorífica e Orquestração IoT. 
          Tenha controle absoluto sobre a telemetria, compliance e cadeia de frio da sua infraestrutura em tempo real.
        </p>

        <div className="landing-features">
          <div className="feature-pill">
            <Activity size={20} color="#38bdf8" />
            <strong>Telemetria em Tempo Real</strong>
          </div>
          <div className="feature-pill">
            <ShieldCheck size={20} color="#10b981" />
            <strong>Auditoria e Compliance</strong>
          </div>
          <div className="feature-pill">
            <Server size={20} color="#a78bfa" />
            <strong>Cloud Multi-Tenant</strong>
          </div>
        </div>

        <div className="landing-actions">
          {/* Chama a tela de Login */}
          <button className="btn-landing-primary" onClick={() => onNavigate('login')}>
            <LogIn size={20} /> Acessar Sistema
          </button>
          
          {/* Chama a tela de Registo */}
          <button className="btn-landing-secondary" onClick={() => onNavigate('register')}>
            <UserPlus size={20} /> Criar Conta <ArrowRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}