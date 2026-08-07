import React from 'react';
import { 
  ShieldCheck, Activity, Server, LogIn, UserPlus, 
  ArrowRight, Lock, CheckCircle2 
} from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';
import './LandingPage.css';

/**
 * Página de Entrada (Landing Page - SaaS Enterprise)
 */
export default function LandingPage({ onNavigate }) {
  return (
    <div className="landing-viewport">
      
      {/* Cabeçalho com Status e Atalho Rápido */}
      <header className="landing-header">
        <div className="landing-header-status">
          <span className="status-dot"></span>
          <span>Sistemas Operacionais • <strong>100% Online</strong></span>
        </div>
        
        <button className="btn-header-login" onClick={() => onNavigate('login')}>
          <LogIn size={15} /> Acessar Portal
        </button>
      </header>

      {/* Conteúdo Principal (Hero Section) */}
      <main className="landing-content">
        
        <div className="landing-badge">
          <span className="pulse-success-icon"></span>
          PLATAFORMA IOT & TELEMETRIA
        </div>

        <div className="landing-logo-wrapper">
          <TermoSyncLogo size={68} color="#38bdf8" />
        </div>
        
        <h1 className="landing-title">ThermoSync</h1>
        
        <p className="landing-subtitle">
          Monitorização frigorífica e orquestração de ponta a ponta. 
          Tenha controle absoluto sobre a cadeia de frio, compliance sanitário e alertas da sua infraestrutura em tempo real.
        </p>

        {/* OS DOIS BOTÕES PRINCIPAIS EM DESTAQUE */}
        <div className="landing-actions">
          {/* <button className="btn-landing-primary" onClick={() => onNavigate('login')}>
            <LogIn size={20} /> Acessar Sistema
          </button> */}
          
          <button className="btn-landing-secondary" onClick={() => onNavigate('register')}>
            <UserPlus size={20} /> Criar Conta <ArrowRight size={16} />
          </button>
        </div>

        {/* Minicards de Proposta de Valor */}
        <div className="landing-features">
          <div className="feature-card">
            <div className="feature-icon-wrapper blue">
              <Activity size={22} />
            </div>
            <div className="feature-text">
              <strong>Telemetria em Tempo Real</strong>
              <span>Sensores com leitura contínua e precisão térmica</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper green">
              <ShieldCheck size={22} />
            </div>
            <div className="feature-text">
              <strong>Auditoria & Compliance</strong>
              <span>Histórico imutável para vigilância sanitária</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper purple">
              <Server size={22} />
            </div>
            <div className="feature-text">
              <strong>Cloud Multi-Tenant</strong>
              <span>Gestão centralizada para matriz e filiais</span>
            </div>
          </div>
        </div>

      </main>

      {/* Rodapé Discreto com Credibilidade */}
      <footer className="landing-footer">
        <div className="footer-item">
          <Lock size={14} /> Criptografia AES-256 E2E
        </div>
        <span className="footer-divider">•</span>
        <div className="footer-item">
          <CheckCircle2 size={14} /> SLA de Disponibilidade 99.98%
        </div>
        <span className="footer-divider">•</span>
        <div className="footer-item">
          ThermoSync Enterprise © 2026
        </div>
      </footer>

    </div>
  );
}