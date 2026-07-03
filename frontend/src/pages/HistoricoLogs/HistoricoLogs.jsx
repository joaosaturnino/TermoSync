import React, { useState, useMemo } from 'react';
import { 
  FileText, AlertTriangle, CheckSquare, History, MapPin, 
  ActivitySquare, ShieldCheck, Search, Thermometer, Power, 
  WifiOff, Download, Terminal, Filter, Zap, ShieldAlert, Cpu
} from 'lucide-react';
import './HistoricoLogs.css';

export default function HistoricoLogs({ historicoFiltradoLista = [], gerarExportacao }) {
  
  const [buscaLog, setBuscaLog] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('ALL'); 

  // --- INTELIGÊNCIA DE LOGS (Categorização por Texto) ---
  const getLogInteligencia = (mensagem) => {
    const msg = mensagem?.toLowerCase() || '';
    if (msg.includes('temperatura') || msg.includes('térmica') || msg.includes('excursão') || msg.includes('frio') || msg.includes('umidade') || msg.includes('humidade')) {
      return { type: 'THERMAL', label: 'Excursão Térmica', icon: Thermometer, color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)' }; 
    }
    if (msg.includes('parada') || msg.includes('mecânica') || msg.includes('compressor') || msg.includes('motor') || msg.includes('energia') || msg.includes('tensão')) {
      return { type: 'POWER', label: 'Falha Mecânica/Elétrica', icon: Power, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' };
    }
    if (msg.includes('rede') || msg.includes('offline') || msg.includes('conexão') || msg.includes('wi-fi') || msg.includes('mqtt') || msg.includes('sensor')) {
      return { type: 'NETWORK', label: 'Quebra de Conectividade', icon: WifiOff, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)', border: 'rgba(56, 189, 248, 0.3)' };
    }
    return { type: 'OTHER', label: 'Anomalia Operacional', icon: ActivitySquare, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.3)' };
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
      network: historicoFiltradoLista.filter(h => getLogInteligencia(h.mensagem).type === 'NETWORK').length
    };
  }, [historicoFiltradoLista]);

  return (
    <div className="anim-fade-in stagger-1">
      <div className="historico-header-area">
        <div className="historico-title-box">
          <div className="icon-circle" style={{background: 'rgba(56, 189, 248, 0.1)', color: 'var(--secondary)'}}>
            <History size={28} />
          </div>
          <div>
            <h2 className="section-title" style={{margin: 0}}>Auditoria de Ocorrências (Data-Log)</h2>
            <p className="text-muted" style={{margin: '4px 0 0 0', fontSize: '0.85rem'}}>
              Registo imutável de todas as anomalias e intervenções técnicas para fins de compliance.
            </p>
          </div>
        </div>

        <div className="audit-export-actions">
          <button className="btn-export-log" onClick={() => gerarExportacao('pdf')}>
            <FileText size={18} color="var(--danger)" /> Laudo PDF
          </button>
          <button className="btn-export-log" onClick={() => gerarExportacao('csv')}>
            <Download size={18} color="var(--success)" /> Dados CSV
          </button>
        </div>
      </div>

      <div className="card log-filters-card stagger-2" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <div className="search-box-iot" style={{ flex: 1, minWidth: '250px' }}>
            <Search size={18} color="var(--text-muted)" />
            <input type="text" placeholder="Procurar em mensagens, laudos ou equipamentos..." value={buscaLog} onChange={e => setBuscaLog(e.target.value)} />
          </div>
        </div>
        
        {/* --- NOVAS PÍLULAS DE FILTRO TÁTICO --- */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className={`btn-outline ${filtroTipo === 'ALL' ? 'btn-primary' : ''}`} style={{ padding: '6px 12px', fontSize: '0.8rem', border: 'none' }} onClick={() => setFiltroTipo('ALL')}>
            <Filter size={14} style={{marginRight: '6px'}}/> Todos os Registos
          </button>
          <button className={`btn-outline ${filtroTipo === 'THERMAL' ? 'btn-warning' : ''}`} style={{ padding: '6px 12px', fontSize: '0.8rem', border: 'none', color: filtroTipo !== 'THERMAL' ? '#f97316' : '#000' }} onClick={() => setFiltroTipo('THERMAL')}>
            <Thermometer size={14} style={{marginRight: '6px'}}/> Térmico ({kpis.thermal})
          </button>
          <button className={`btn-outline ${filtroTipo === 'POWER' ? 'btn-danger' : ''}`} style={{ padding: '6px 12px', fontSize: '0.8rem', border: 'none', color: filtroTipo !== 'POWER' ? '#ef4444' : '#fff' }} onClick={() => setFiltroTipo('POWER')}>
            <Power size={14} style={{marginRight: '6px'}}/> Elétrico/Mecânico ({kpis.power})
          </button>
          <button className={`btn-outline ${filtroTipo === 'NETWORK' ? 'btn-secondary' : ''}`} style={{ padding: '6px 12px', fontSize: '0.8rem', border: 'none', color: filtroTipo !== 'NETWORK' ? '#38bdf8' : '#000' }} onClick={() => setFiltroTipo('NETWORK')}>
            <WifiOff size={14} style={{marginRight: '6px'}}/> Rede ({kpis.network})
          </button>
        </div>
      </div>

      {!logsExibidos || logsExibidos.length === 0 ? (
        <div className="card log-empty-state stagger-3">
           <div className="empty-shield-box" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: 'var(--success)' }}>
             <ShieldCheck size={40} className="pulse-success-icon" />
           </div>
           <h3>Nenhum Registo Encontrado</h3>
           <p>O sistema não localizou anomalias ou intervenções que correspondam aos filtros ativos. O ambiente encontra-se operacional.</p>
        </div>
      ) : (
        <div className="log-timeline stagger-3">
          {logsExibidos.map((hist, index) => {
            const intl = getLogInteligencia(hist.mensagem);
            const Icon = intl.icon;

            return (
              <div key={hist.id || index} className="timeline-event anim-slide-up">
                
                <div className="timeline-connector">
                  <div className="timeline-dot" style={{ background: intl.bg, border: `2px solid ${intl.color}` }}>
                    <Icon size={14} color={intl.color} />
                  </div>
                  {index < logsExibidos.length - 1 && <div className="timeline-line"></div>}
                </div>

                <div className="log-card">
                  
                  <div className="log-card-header">
                    <div className="log-type-badge" style={{ background: intl.bg, color: intl.color, border: `1px solid ${intl.border}` }}>
                      {intl.label}
                    </div>
                    <div className="log-datetime">
                      {new Date(hist.data_hora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>

                  <div className="log-card-body">
                    <h4 className="log-equip-title">
                      <Cpu size={16} /> {hist.equipamento_nome} <span className="equip-setor-tag">{hist.setor}</span>
                    </h4>
                    
                    <div className="log-issue-box" style={{ borderLeftColor: intl.color, background: 'rgba(0,0,0,0.02)' }}>
                      <Terminal size={14} className="terminal-icon"/>
                      <span className="log-issue-text"><strong>Alarme Disparado:</strong> {hist.mensagem}</span>
                    </div>
                  </div>

                  <div className="log-card-resolution">
                    <div className="resolution-header">
                      <ShieldCheck size={16} color="var(--success)" />
                      <strong>Parecer Técnico / Ação Corretiva:</strong>
                    </div>
                    <div className="resolution-text">
                      {hist.nota_resolucao}
                    </div>
                    
                    <div className="resolution-stamp">
                      <div className="stamp-watermark">
                        <CheckSquare size={12}/> RDC COMPLIANT
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}