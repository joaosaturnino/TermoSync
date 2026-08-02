import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Database, Server, GraduationCap, 
  Code2, Github, Linkedin, Globe, Layers, Activity, 
  Fingerprint, Cpu, Network, Radio, TerminalSquare,
  ArrowRight, Wifi, Zap
} from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';
import './Sobre.css';

/**
 * Página "Sobre" do ThermoSync
 *
 * Responsabilidades:
 * - Documentar a arquitetura e apresentar informações institucionais
 * - Fornecer um terminal mock para efeitos visuais e demonstrações
 */
export default function Sobre() {
  const [bootLines, setBootLines] = useState([]);
  const [showBio, setShowBio] = useState(false);

  // Efeito do Terminal de Boot
  useEffect(() => {
    const sequence = [
      { text: "root@thermosync:~# ./fetch_author_data.sh", delay: 300, type: 'cmd' },
      { text: "[*] INITIATING SECURE CONNECTION TO NOC CLUSTER...", delay: 1000, type: 'sys' },
      { text: "[OK] RSA-4096 HANDSHAKE ESTABLISHED.", delay: 1800, type: 'success' },
      { text: "[*] DECRYPTING AUTHOR BIOGRAPHY DATABANKS...", delay: 2400, type: 'sys' },
      { text: "[OK] DATASTREAM READY. PRINTING OUTPUT:", delay: 3200, type: 'success' },
    ];

    let timeouts = [];

    sequence.forEach((line) => {
      const t = setTimeout(() => {
        setBootLines(prev => [...prev, line]);
      }, line.delay);
      timeouts.push(t);
    });

    const finalT = setTimeout(() => {
      setShowBio(true);
    }, 3800);
    timeouts.push(finalT);

    return () => timeouts.forEach(clearTimeout);
  }, []);

  return (
    <div className="sobre-container anim-fade-in stagger-1">
      
      {/* SEÇÃO HERO DA PLATAFORMA */}
      <div className="sobre-hero">
        <div className="hero-content">
          
          {/* Live Diagnostics Mockup */}
          <div className="live-diagnostics">
             <span className="pulse-success-icon" style={{display: 'inline-block', width: '8px', height: '8px', background: '#10b981', borderRadius: '50%'}}></span>
             <span>UPTIME: <strong>99.999%</strong></span> | 
             <span>LATENCY: <strong>12ms</strong></span> | 
             <span>WSS: <strong>SECURE</strong></span>
          </div>

          <TermoSyncLogo size={90} color="#10b981" />
          <h1>ThermoSync</h1>
          
          <div className="hero-tags">
            <span className="hero-tag tag-noc">
              <Activity size={16}/> NOC PLATFORM
            </span>
            <span className="hero-tag tag-ver">
              <Radio size={16}/> v1.5 ENTERPRISE
            </span>
            <span className="hero-tag tag-tcc">
              <GraduationCap size={16}/> TCC - REDES DE COMPUTADORES
            </span>
          </div>
          
          <p>
            <strong>Sobre o ThermoSync:</strong>
            <br/>
            O <strong>ThermoSync</strong> é uma plataforma inteligente para monitoramento de câmaras e balcões refrigerados e gerenciamento de dispositivos IoT. Desenvolvido com uma arquitetura totalmente assíncrona, o sistema coleta, processa e sincroniza, em tempo real, dados de telemetria enviados por dispositivos instalados na borda da infraestrutura.

A plataforma oferece monitoramento contínuo de temperatura, umidade e status dos equipamentos, além de gerar alertas, históricos e indicadores que auxiliam na prevenção de falhas e na tomada de decisões.

Com foco em desempenho, escalabilidade e confiabilidade, o ThermoSync integra hardware e software em uma solução completa para garantir o controle da rede refrigerada e a eficiência operacional.
             </p>
        </div>
      </div>

      {/* TRIPÉ DA INFRAESTRUTURA TÉCNICA */}
      <div className="dev-section-title stagger-2">
        <Layers size={28} color="#38bdf8" />
        Especificações Arquiteturais
      </div>

      {/* DIAGRAMA VISUAL DE DADOS (NOVO) */}
      <div className="architecture-flow stagger-2">
        <div className="flow-node">
          <Cpu size={24} color="#10b981" />
          <strong>IoT / Edge Nodes</strong>
          <span>ESP32 + Sensores</span>
        </div>
        
        <ArrowRight size={24} className="flow-arrow" />
        
        <div className="flow-node" style={{ borderColor: 'rgba(56, 189, 248, 0.4)' }}>
          <Wifi size={24} color="#38bdf8" />
          <strong>Mqtt / WebSockets</strong>
          <span>Tráfego Bidirecional</span>
        </div>

        <ArrowRight size={24} className="flow-arrow" />

        <div className="flow-node" style={{ borderColor: 'rgba(167, 139, 250, 0.4)' }}>
          <Server size={24} color="#a78bfa" />
          <strong>SaaS Core API</strong>
          <span>Node.js + MySQL</span>
        </div>

        <ArrowRight size={24} className="flow-arrow" />

        <div className="flow-node" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
          <TerminalSquare size={24} color="#f59e0b" />
          <strong>NOC Dashboard</strong>
          <span>React.js Enterprise</span>
        </div>
      </div>

      <div className="sobre-tech-grid stagger-2">
        <div className="sobre-tech-card" style={{ '--card-color': '#10b981' }}>
          <div className="tech-card-header">
            <div className="tech-icon-wrapper">
              <Zap size={26} color="#10b981" />
            </div>
            <strong>Edge Computing & IoT</strong>
          </div>
          <p>
            Comunicação escalável em tempo real através de WebSockets bidirecionais, integrando microcontroladores IoT sob barramentos estáveis de telemetria na borda da rede.
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
              <TerminalSquare size={18} /> SOFTWARE ARCHITECT & FULL-STACK ENGINEER
            </div>
          </div>

          <div className="terminal-prompt-box">
             {bootLines.map((line, idx) => (
                <div key={idx} className="terminal-line">
                  {line.type === 'cmd' ? (
                     <><span className="terminal-user">root@thermosync</span>:<span className="terminal-dir">~</span>$ {line.text.replace('root@thermosync:~# ', '')}</>
                  ) : line.type === 'sys' ? (
                     <span className="terminal-sys">{line.text}</span>
                  ) : (
                     <span className="terminal-success">{line.text}</span>
                  )}
                </div>
             ))}
             
             {showBio ? (
                <p className="dev-bio" style={{ animation: 'fadeIn 0.5s ease-out', marginTop: '10px' }}>
                  Engenheiro e idealizador do ecossistema <strong>ThermoSync</strong>. A plataforma surgiu a partir de uma necessidade operacional identificada no ambiente de trabalho, onde a ausência de uma solução centralizada para o monitoramento de câmaras frigoríficas e equipamentos críticos evidenciava desafios relacionados ao controle, rastreabilidade e resposta a eventos.

Com o potencial da ideia, o projeto foi expandido e estruturado como <strong>Trabalho de Conclusão de Curso (TCC) em Redes de Computadores</strong>, evoluindo de um protótipo acadêmico para uma plataforma empresarial voltada ao monitoramento inteligente e à gestão de dispositivos IoT.

Atualmente, o ThermoSync integra desenvolvimento <strong>Full-Stack</strong>, arquiteturas distribuídas, APIs de alta performance, processamento de telemetria em tempo real e comunicação direta com hardware embarcado, oferecendo uma solução escalável, segura e confiável para o gerenciamento de ambientes frigorificados e da infraestrutura operacional.
<span className="terminal-cursor"></span>
                </p>
             ) : (
                <div style={{ height: '24px' }}><span className="terminal-cursor"></span></div>
             )}
          </div>

          <div className="tech-stack-pills">
             <span className="pill">React.js</span>
             <span className="pill">Node.js</span>
             <span className="pill">MySQL</span>
             <span className="pill">WebSockets</span>
             <span className="pill">C++ / Arduino (IoT)</span>
          </div>

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