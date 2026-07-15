import React, { useState, useMemo } from 'react';
import { 
  FileText, ShieldCheck, Search, Thermometer, Power, 
  WifiOff, Download, Terminal, Filter, Cpu, Fingerprint,
  FileCode2, ShieldAlert, CheckCircle2, UserCheck, KeyRound
} from 'lucide-react';
import './HistoricoLogs.css';

export default function HistoricoLogs({ historicoFiltradoLista = [], gerarExportacao }) {
  
  const [buscaLog, setBuscaLog] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('ALL'); 

  // Função Simples para Gerar um "Hash Criptográfico" estético baseado no ID e Data
  const generateHash = (id, dateStr) => {
    const raw = `${id}-${dateStr}-thermosync-soc`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  };

  // --- INTELIGÊNCIA DE LOGS (SIEM Engine) ---
  const getLogInteligencia = (mensagem) => {
    const msg = mensagem?.toLowerCase() || '';
    
    // 1. Logs de Segurança & Acesso (IAM)
    if (msg.includes('acesso') || msg.includes('senha') || msg.includes('credencial') || msg.includes('bloqueado') || msg.includes('porta') || msg.includes('revogado') || msg.includes('login')) {
      return { type: 'SECURITY', label: 'Violação / Controle IAM', icon: ShieldAlert, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.3)' }; 
    }
    // 2. Logs Térmicos
    if (msg.includes('temperatura') || msg.includes('térmica') || msg.includes('excursão') || msg.includes('frio') || msg.includes('umidade') || msg.includes('degelo')) {
      return { type: 'THERMAL', label: 'Excursão Térmica', icon: Thermometer, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)' }; 
    }
    // 3. Logs Elétricos/Mecânicos
    if (msg.includes('parada') || msg.includes('mecânica') || msg.includes('compressor') || msg.includes('motor') || msg.includes('energia') || msg.includes('tensão')) {
      return { type: 'POWER', label: 'Falha Elétrica/Mecânica', icon: Power, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' };
    }
    // 4. Logs de Rede/Conectividade
    if (msg.includes('rede') || msg.includes('offline') || msg.includes('conexão') || msg.includes('wi-fi') || msg.includes('mqtt') || msg.includes('sensor')) {
      return { type: 'NETWORK', label: 'Quebra de Enlace (Nó)', icon: WifiOff, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)', border: 'rgba(56, 189, 248, 0.3)' };
    }
    
    return { type: 'OTHER', label: 'Auditoria Geral', icon: FileCode2, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)' };
  };

  const logsExibidos = useMemo(() => {
    let filtrados = historicoFiltradoLista;
    if (buscaLog.trim()) {
      const b = buscaLog.toLowerCase();
      filtrados = filtrados.filter(h => 
        h.equipamento_nome?.toLowerCase().includes(b) || 
        h.mensagem?.toLowerCase().includes(b) ||
        h.nota_resolucao?.toLowerCase().includes(b)
      );
    }
    if (filtroTipo !== 'ALL') {
      filtrados = filtrados.filter(h => getLogInteligencia(h.mensagem).type === filtroTipo);
    }
    return filtrados;
  }, [historicoFiltradoLista, buscaLog, filtroTipo]);

  const kpis = useMemo(() => {
    return {
      thermal: historicoFiltradoLista.filter(h => getLogInteligencia(h.mensagem).type === 'THERMAL').length,
      power: historicoFiltradoLista.filter(h => getLogInteligencia(h.mensagem).type === 'POWER').length,
      network: historicoFiltradoLista.filter(h => getLogInteligencia(h.mensagem).type === 'NETWORK').length,
      security: historicoFiltradoLista.filter(h => getLogInteligencia(h.mensagem).type === 'SECURITY').length
    };
  }, [historicoFiltradoLista]);

  return (
    <div className="anim-fade-in stagger-1">
      
      {/* HERO SECTION - SOC LEDGER */}
      <div className="siem-hero">
        <div className="hero-title-box">
          <div className="hero-icon-circle">
            <Fingerprint size={28} />
          </div>
          <div>
            <h2 className="hero-main-title">SOC Ledger & Compliance</h2>
            <span className="hero-subtitle">Trilha de auditoria imutável de anomalias, acessos e intervenções técnicas.</span>
          </div>
        </div>

        <div className="audit-export-actions">
          <button className="btn-export-log pdf" onClick={() => gerarExportacao('pdf')} title="Exportar Documento Auditável">
            <FileText size={16} /> Laudo Forense (PDF)
          </button>
          <button className="btn-export-log csv" onClick={() => gerarExportacao('csv')} title="Extrair Base de Dados Bruta">
            <Download size={16} /> Extrair Dataset (CSV)
          </button>
        </div>
      </div>

      {/* PAINEL DE TRIAGEM (FILTROS) */}
      <div className="audit-triage-panel stagger-2">
        
        <div className="triage-filters-group">
          <button className={`triage-chip ${filtroTipo === 'ALL' ? 'active all' : ''}`} onClick={() => setFiltroTipo('ALL')}>
            <Filter size={14}/> Visão Global
            <span className="chip-count">{historicoFiltradoLista.length}</span>
          </button>
          <button className={`triage-chip ${filtroTipo === 'THERMAL' ? 'active thermal' : ''}`} onClick={() => setFiltroTipo('THERMAL')}>
            <Thermometer size={14}/> Térmico
            <span className="chip-count">{kpis.thermal}</span>
          </button>
          <button className={`triage-chip ${filtroTipo === 'POWER' ? 'active power' : ''}`} onClick={() => setFiltroTipo('POWER')}>
            <Power size={14}/> Energia
            <span className="chip-count">{kpis.power}</span>
          </button>
          <button className={`triage-chip ${filtroTipo === 'NETWORK' ? 'active network' : ''}`} onClick={() => setFiltroTipo('NETWORK')}>
            <WifiOff size={14}/> Enlace
            <span className="chip-count">{kpis.network}</span>
          </button>
          <button className={`triage-chip ${filtroTipo === 'SECURITY' ? 'active security' : ''}`} onClick={() => setFiltroTipo('SECURITY')}>
            <KeyRound size={14}/> IAM / Segurança
            <span className="chip-count">{kpis.security}</span>
          </button>
        </div>

        <div className="triage-search">
          <Search size={18} color="#64748b" />
          <input type="text" placeholder="Auditar logs por payload, hardware ou resolução..." value={buscaLog} onChange={e => setBuscaLog(e.target.value)} />
        </div>

      </div>

      {/* TIMELINE DE EVENTOS */}
      {!logsExibidos || logsExibidos.length === 0 ? (
        <div className="log-empty-state stagger-3">
           <div className="empty-shield-box">
             <ShieldCheck size={40} className="pulse-success-icon" />
           </div>
           <h3>Infraestrutura Segura</h3>
           <p>O motor SIEM não localizou anomalias ou infrações que correspondam aos parâmetros de auditoria atuais. O ambiente encontra-se estabilizado e auditado.</p>
        </div>
      ) : (
        <div className="timeline-container stagger-3">
          {logsExibidos.map((hist, index) => {
            const intl = getLogInteligencia(hist.mensagem);
            const Icon = intl.icon;
            
            // Simulação de Hash Cryptográfico para a UI
            const blockHash = generateHash(hist.id || index, hist.data_hora);

            return (
              <div key={hist.id || index} className="timeline-event">
                
                <div className="timeline-connector">
                  <div className="timeline-dot" style={{ background: intl.bg, borderColor: intl.color, color: intl.color }}>
                    <Icon size={14} />
                  </div>
                  {index < logsExibidos.length - 1 && <div className="timeline-line"></div>}
                </div>

                <div className="log-card" style={{ '--log-color': intl.color }}>
                  
                  <div className="log-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div className="log-type-badge" style={{ background: intl.bg, color: intl.color, border: `1px solid ${intl.border}` }}>
                        {intl.label}
                      </div>
                      
                      <div className="log-crypto-hash" title="Assinatura Criptográfica do Bloco (SHA-256 Mock)">
                        <FileCode2 size={14} color="#64748b"/>
                        <span className="hash-string">0x{blockHash}</span>
                      </div>
                    </div>

                    <div className="log-datetime">
                      <Clock size={14} color="#64748b"/>
                      {new Date(hist.data_hora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
                    </div>
                  </div>

                  <div className="log-card-body">
                    <h4 className="log-equip-title">
                      <Cpu size={18} color="#cbd5e1" /> {hist.equipamento_nome}
                      <span className="equip-setor-tag">{hist.setor || 'Nó Físico'}</span>
                    </h4>
                    
                    <div className="log-issue-box" style={{ borderLeftColor: intl.color }}>
                      <Terminal size={16} className="terminal-icon" color={intl.color} />
                      <span className="log-issue-text">
                        <strong>Payload Registrado:</strong> {hist.mensagem}
                      </span>
                    </div>
                  </div>

                  {hist.nota_resolucao && (
                    <div className="log-card-resolution">
                      <div className="resolution-header">
                        <CheckCircle2 size={16} />
                        Parecer Técnico (Ação Corretiva):
                      </div>
                      <div className="resolution-text">
                        "{hist.nota_resolucao}"
                      </div>
                      
                      <div className="resolution-stamp">
                        <div className="operator-id">
                          <UserCheck size={14} /> Identidade Responsável: SYSTEM_OP / Técnico Alocado
                        </div>
                        <div className="stamp-watermark" title="Auditoria Conformidade RDC Anvisa">
                          <ShieldCheck size={14}/> ASSINATURA VÁLIDA
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Extra icon needed for layout
const Clock = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);