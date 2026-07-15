import React from 'react';
import { 
  ShieldCheck, Database, Server, GraduationCap, 
  Code2, GitBranch, Github, Linkedin, Globe, Layers, Activity, Fingerprint, Cpu, Network, Radio
} from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';
import './Sobre.css';

export default function Sobre() {
  return (
    <div className="sobre-container anim-fade-in stagger-1">
      
      {/* SEÇÃO HERO DA PLATAFORMA */}
      <div className="sobre-hero">
        <div className="hero-content">
          <TermoSyncLogo size={90} color="#10b981" />
          <h1>ThermoSync</h1>
          
          <div className="hero-tags">
            <span className="hero-tag tag-noc">
              <Activity size={16}/> NOC PLATFORM
            </span>
            <span className="hero-tag tag-ver">
              <Radio size={16}/> v10.5 ENTERPRISE
            </span>
            <span className="hero-tag tag-tcc">
              <GraduationCap size={16}/> TCC - REDES DE COMPUTADORES
            </span>
          </div>
          
          <p>
            Sistema integrado de monitorização frigorífica e orquestração de redes IoT. Construído sobre uma arquitetura puramente assíncrona, o ecossistema ThermoSync realiza a ingestão massiva de telemetria proveniente de hardwares dedicados dispostos na borda operacional da infraestrutura.
          </p>
        </div>
      </div>

      {/* TRIPÉ DA INFRAESTRUTURA TÉCNICA */}
      <div className="dev-section-title stagger-2">
        <Layers size={28} color="#38bdf8" />
        Especificações Arquiteturais
      </div>

      <div className="sobre-tech-grid stagger-2">
        <div className="sobre-tech-card" style={{ '--card-color': '#10b981' }}>
          <div className="tech-card-header">
            <div className="tech-icon-wrapper">
              <Cpu size={26} color="#10b981" />
            </div>
            <strong>Edge Computing & IoT</strong>
          </div>
          <p>
            Comunicação escalável em tempo real através de WebSockets bidirecionais, integrando microcontroladores IoT (Arduino/ESP32) sob barramentos estáveis de telemetria na borda da rede.
          </p>
        </div>

        <div className="sobre-tech-card" style={{ '--card-color': '#38bdf8' }}>
          <div className="tech-card-header">
            <div className="tech-icon-wrapper">
              <ShieldCheck size={26} color="#38bdf8" />
            </div>
            <strong>Compliance Operacional</strong>
          </div>
          <p>
            Rastreabilidade total das cadeias frias corporativas e conformidade automatizada com métricas rigorosas de preservação para ativos termolábeis e redução de quebras térmicas.
          </p>
        </div>

        <div className="sobre-tech-card" style={{ '--card-color': '#a78bfa' }}>
          <div className="tech-card-header">
            <div className="tech-icon-wrapper">
              <Database size={26} color="#a78bfa" />
            </div>
            <strong>SaaS Isolation Core</strong>
          </div>
          <p>
            Arquitetura de banco de dados orientada ao isolamento lógico Multi-Tenant. Abstração completa de instâncias, autenticação JWT robusta e criptografia de logs de auditoria imutáveis.
          </p>
        </div>
      </div>

      {/* PORTFÓLIO DO DESENVOLVEDOR (ID BADGE) */}
      <div className="dev-section-title stagger-3" style={{ marginTop: '3rem' }}>
        <Fingerprint size={28} color="#10b981" />
        Engenharia & Autoria
      </div>

      <div className="developer-profile-card stagger-3">
        
        {/* Links Sociais no Topo Direito (Desktop) */}
        <div className="dev-social-links">
          <a href="https://github.com/joaosaturnino" target="_blank" rel="noopener noreferrer" className="social-btn github">
            <Github size={18} /> GitHub
          </a>
          <a href="https://www.linkedin.com/in/jo%C3%A3o-henrique-00288621a/" target="_blank" rel="noopener noreferrer" className="social-btn linkedin">
            <Linkedin size={18} /> LinkedIn
          </a>
        </div>

        <div className="dev-avatar-container">
          <div className="dev-avatar">
            <div className="status-online-dot" title="Status: Online e Operante"></div>
            JH
            <div className="clearance-badge">SYS.ROOT</div>
          </div>
          <span className="dev-id-serial">ID: TS-ROOT-001</span>
        </div>
        
        <div className="dev-info">
          <div>
            <h2 className="dev-name">João Henrique</h2>
            <div className="dev-role">
              <Code2 size={18} /> SOFTWARE ARCHITECT & FULL-STACK ENGINEER
            </div>
          </div>

          <div className="tech-stack-pills">
             <span className="pill">React.js</span>
             <span className="pill">Node.js</span>
             <span className="pill">MySQL</span>
             <span className="pill">WebSockets</span>
             <span className="pill">C++ / Arduino (IoT)</span>
          </div>
          
          <p className="dev-bio">
            Engenheiro responsável pela idealização do ecossistema <strong>ThermoSync</strong>. O sistema nasceu como um <strong>Trabalho de Conclusão de Curso (TCC) em Redes de Computadores</strong>, evoluindo para uma robusta plataforma empresarial que une o desenvolvimento Full-Stack de software (interfaces e APIs) com o controlo direto de hardware e telemetria periférica.
          </p>

          {/* GRADE ACADÊMICA COMPLETA */}
          <div className="dev-courses-grid">
            <div className="course-badge">
              <Network size={22} style={{ color: '#10b981', flexShrink: 0 }} />
              <span>Técnico em Redes de Computadores</span>
            </div>
            
            <div className="course-badge">
              <GraduationCap size={22} style={{ color: '#38bdf8', flexShrink: 0 }} />
              <span>Técnico em Desenvolvimento de Sistemas</span>
            </div>
            
            <div className="course-badge">
              <Globe size={22} style={{ color: '#a78bfa', flexShrink: 0 }} />
              <span>Técnico em Informática para Internet</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}