import React, { useCallback, memo, useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  AlertTriangle, Wifi, Snowflake, Power, DoorOpen, Droplets, 
  ActivitySquare, ClipboardCheck, CheckCircle, Server, 
  Activity, ThermometerSnowflake, AlertOctagon, MessageSquare, Send, X, Clock, Radio, Zap, MonitorPlay, DownloadCloud
} from 'lucide-react';
import './Dashboard.css';
import EmptyState from '../../components/EmptyState';

export const getAlertConfig = (tipo_alerta) => {
  const configs = {
    'REDE': { icon: Wifi, color: 'var(--warning)', action: 'Analisar Rede', critical: true },
    'DEGELO': { icon: Snowflake, color: 'var(--secondary)', action: 'Finalizar Degelo', critical: false },
    'MECANICA': { icon: Power, color: '#f97316', action: 'Acionar Manutenção', critical: true },
    'PORTA': { icon: DoorOpen, color: '#e11d48', action: 'Verificar Porta', critical: true },
    'TEMPERATURA': { icon: ThermometerSnowflake, color: '#ef4444', action: 'Normalizar Temp.', critical: true },
    'UMIDADE': { icon: Droplets, color: '#0ea5e9', action: 'Ajustar Umidade', critical: false },
    'METROLOGIA': { icon: ClipboardCheck, color: '#6366f1', action: 'Agendar Calibração', critical: true },
    'PREDITIVO': { icon: ActivitySquare, color: '#8b5cf6', action: 'Prevenção', critical: false }
  };
  return configs[tipo_alerta] || { icon: AlertTriangle, color: 'var(--danger)', action: 'Investigar', critical: true };
};

const StatCard = memo(({ title, value, icon: Icon, iconBg, valClass = '', isPulsing = false }) => (
  <div className={`summary-card ${isPulsing ? 'pulsing-card' : ''}`}>
    <div className="summary-header"><span className="summary-title">{title}</span><div className={`summary-icon-wrapper ${iconBg}`}><Icon size={22} className="kpi-icon" /></div></div>
    <div className="summary-body"><span className={`summary-value ${valClass} ${isPulsing ? 'pulse-danger-text' : ''}`}>{value || 0}</span>{isPulsing && <span className="live-pulse-dot bg-danger"></span>}</div>
  </div>
));

const ChatDrawer = ({ notif, onClose, contatosDb, irParaChat, showToast, socket, userId, nomeLogado, setHistoricoChat }) => {
  const [contatoSelecionado, setContatoSelecionado] = useState('');
  const [novaMensagem, setNovaMensagem] = useState(`[ALERTA CRÍTICO] A máquina ${notif.equipamento_nome} (${notif.filial}) registrou uma anomalia grave. Ocorrência: ${notif.mensagem}. Solicito verificação técnica imediata.`);

  const handleEnviar = (e) => {
    e.preventDefault();
    if (!contatoSelecionado) return showToast('Selecione um destinatário.', 'warning');
    if (!novaMensagem.trim()) return;

    const msg = { id: Date.now(), remetenteId: userId, remetenteNome: nomeLogado, destinoId: contatoSelecionado, texto: novaMensagem, data: new Date(), tipo: 'sent' };
    setHistoricoChat(prev => [...prev, msg]);
    if (socket) socket.emit('enviar_mensagem_chat', msg);

    showToast('Alerta transmitido à equipe com sucesso!', 'success');
    onClose();
    setTimeout(() => { irParaChat(contatoSelecionado === 'todos' ? null : contatoSelecionado); }, 400); 
  };

  return (
    <div className="chat-overlay" onClick={onClose}>
      <div className="chat-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="chat-drawer-header"><div className="chat-header-info"><h4>Escalar Emergência</h4><p>{notif.equipamento_nome} • {notif.filial}</p></div><button className="btn-close-drawer" onClick={onClose}><X size={24} /></button></div>
        <div className="chat-drawer-body">
          <div className="form-group"><label>1. Direcionar alerta para:</label><select className="select-input w-100" value={contatoSelecionado} onChange={(e) => setContatoSelecionado(e.target.value)}><option value="">-- Escolha a equipe de intervenção --</option>{contatosDb?.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>)}<option value="todos">Toda a Rede (Broadcast de Emergência)</option></select></div>
          <div className="form-group"><label>2. Relatório do Incidente:</label><textarea className="textarea-input" value={novaMensagem} onChange={(e) => setNovaMensagem(e.target.value)} rows="6" /></div>
        </div>
        <div className="chat-drawer-footer"><button className="btn btn-outline w-100" onClick={onClose} style={{ marginBottom: '10px' }}>Cancelar</button><button className="btn btn-primary w-100 btn-escalar" onClick={handleEnviar}><Send size={18} /> Transmitir Alerta</button></div>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, isDarkMode }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '1px solid var(--border)', color: isDarkMode ? '#f8fafc' : '#0f172a', padding: '10px' }}>
        <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{payload[0].name}</p>
        <p style={{ margin: 0, fontWeight: '700', color: payload[0].payload.fill || '#38bdf8' }}>Quantidade: {payload[0].value}</p>
      </div>
    );
  }
  return null;
};

const EmptyTooltip = () => (<div style={{ padding: '8px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}>Aguardando telemetria...</div>);

/**
 * Componente Dashboard Operacional
 *
 * Responsabilidades:
 * - Exibir resumo de status das máquinas e alertas
 * - Fornecer ações rápidas (escalar para chat, gerar PDF)
 * - Suportar modo Kiosk e integração com sockets para eventos ao vivo
 */
export default function Dashboard({ 
  qtdTotal, 
  qtdDegelo, 
  dadosDonutStatus = [], 
  notificacoesDaFilial = [], resolverTodasNotificacoes, isOffline, pedirNotaResolucao, isDarkMode,
  contatosDb, irParaChat, showToast, socket, userId, nomeLogado, setHistoricoChat
}) {
  
  const [chatAtivo, setChatAtivo] = useState(null);
  const [filtroRisco, setFiltroRisco] = useState('TODOS'); 
  const [kioskMode, setKioskMode] = useState(false);

  // =====================================================================
  // ESTADO REATIVO DE ALERTAS (Sincroniza com Simulador e Banco)
  // =====================================================================
  const [localAlertas, setLocalAlertas] = useState(notificacoesDaFilial || []);

  useEffect(() => {
    setLocalAlertas(notificacoesDaFilial || []);
  }, [notificacoesDaFilial]);

  useEffect(() => {
    if (!socket) return;
    
    const handleAlertaRemovido = (data) => {
      setLocalAlertas(prev => prev.filter(n => !(n.equipamento_id === data.equipamento_id && n.tipo_alerta === data.tipo_alerta)));
    };

    const handleAlertaRemovidoId = (data) => {
      setLocalAlertas(prev => prev.filter(n => String(n.id) !== String(data.id)));
    };

    const handleAlertasLimpos = () => {
      setLocalAlertas([]);
    };

    socket.on('alerta_removido', handleAlertaRemovido);
    socket.on('alerta_removido_id', handleAlertaRemovidoId);
    socket.on('alertas_limpos', handleAlertasLimpos);
    
    return () => {
      socket.off('alerta_removido', handleAlertaRemovido);
      socket.off('alerta_removido_id', handleAlertaRemovidoId);
      socket.off('alertas_limpos', handleAlertasLimpos);
    };
  }, [socket]);

  // Listener para sair do Kiosk Mode usando ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setKioskMode(false);
    };
    if (kioskMode) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [kioskMode]);

  // =====================================================================
  // MATEMÁTICA CORRIGIDA DOS KPIS
  // =====================================================================
  const { operandoReal, falhaReal, maquinasEmFalha, maquinasDegelo } = useMemo(() => {
    // 1. Quantidade bruta de alertas 
    const qtAlertas = localAlertas.length;
    
    // 2. Extrair apenas as MÁQUINAS (IDs únicos) que possuem alertas
    // Isso evita que uma máquina com 2 alertas estrague a soma total do Dashboard.
    const setMaquinasFalhas = new Set(localAlertas.map(a => String(a.equipamento_id)));
    const qtMaquinasComFalha = setMaquinasFalhas.size;
    
    // 3. Define as bases de cálculo
    let qtDegeloFinal = qtdDegelo || 0;
    let qtOperando = (qtdTotal || 0) - qtDegeloFinal - qtMaquinasComFalha;
    
    // 4. Correção de sobreposição (se a máquina está em Degelo E tem falha)
    if (qtOperando < 0) {
        qtOperando = 0;
        qtDegeloFinal = Math.max(0, (qtdTotal || 0) - qtMaquinasComFalha);
    }
    
    return { 
        operandoReal: qtOperando, 
        falhaReal: qtAlertas, 
        maquinasEmFalha: qtMaquinasComFalha,
        maquinasDegelo: qtDegeloFinal
    };
  }, [localAlertas, qtdTotal, qtdDegelo]);

  const dadosDonutReativos = useMemo(() => [ 
    { name: 'Ok', value: operandoReal, color: 'var(--success)' }, 
    { name: 'Degelo', value: maquinasDegelo, color: '#38bdf8' }, 
    { name: 'Falha', value: maquinasEmFalha, color: 'var(--danger)' } 
  ].filter(d => d.value > 0), [operandoReal, maquinasDegelo, maquinasEmFalha]);

  const abrirChatInterno = useCallback((notif) => { setChatAtivo(notif); }, []);
  const handleResolve = useCallback((id) => { pedirNotaResolucao(id); }, [pedirNotaResolucao]);

  const saudeRede = useMemo(() => {
    if (!qtdTotal || qtdTotal === 0) return { score: 100, status: 'ESTÁVEL', class: 'stable' };
    const score = Math.round((operandoReal / qtdTotal) * 100);
    if (score < 80) return { score, status: 'CRÍTICO', class: 'critical' };
    if (score < 95) return { score, status: 'ATENÇÃO', class: 'warning' };
    return { score, status: 'ESTÁVEL', class: 'stable' };
  }, [qtdTotal, operandoReal]);

  const alertasExibidos = useMemo(() => {
    if (!localAlertas) return [];
    if (filtroRisco === 'TODOS') return localAlertas;
    return localAlertas.filter(n => {
      const isCritical = n.tipo_alerta === 'MECANICA' || n.tipo_alerta === 'PORTA' || n.tipo_alerta === 'TEMPERATURA';
      return filtroRisco === 'CRITICO' ? isCritical : !isCritical;
    });
  }, [localAlertas, filtroRisco]);

  const gerarSnapshotPDF = () => {
    showToast('A compilar Snapshot Operacional...', 'info');
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("TermoSync - Snapshot Executivo do Turno", 14, 20);
    doc.setFontSize(11);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Status da Rede: ${saudeRede.status} (${saudeRede.score}%)`, 14, 34);
    
    autoTable(doc, {
      startY: 45,
      head: [['Métrica Operacional', 'Valor Atual']],
      body: [
        ['Total de Máquinas na Rede', qtdTotal],
        ['Operação Normal (Dentro do SLA)', operandoReal],
        ['Máquinas em Ciclo de Degelo', maquinasDegelo],
        ['Máquinas em Alerta/Falha', maquinasEmFalha],
        ['Total de Ocorrências Individuais', falhaReal]
      ]
    });

    if (localAlertas.length > 0) {
      doc.text("Listagem de Alarmes Ativos:", 14, doc.lastAutoTable.finalY + 15);
      const alarmesBody = localAlertas.map(n => [n.equipamento_nome, n.tipo_alerta, n.mensagem]);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Equipamento', 'Tipo', 'Descrição']],
        body: alarmesBody,
        theme: 'grid'
      });
    }

    doc.save(`Snapshot_TermoSync_${Date.now()}.pdf`);
    showToast('Download do Relatório concluído.', 'success');
  };

  const DONUT_COLORS = { 'Ok': '#10b981', 'Degelo': '#38bdf8', 'Falha': '#ef4444' };
  const temDadosDonut = dadosDonutReativos && dadosDonutReativos.length > 0;
  const dadosPlaceholder = [{ name: 'Aguardando Dados', value: 1 }];

  if (!temDadosDonut && (!localAlertas || localAlertas.length === 0) && (!qtdTotal || qtdTotal === 0)) {
    return <EmptyState title="Sem telemetria" description="Nenhuma telemetria disponível no momento. Verifique a conexão com os gateways ou aguarde novos dados." />;
  }

  // =====================================================================
  // KIOSK MODE RENDERING (PORTAL)
  // =====================================================================
  if (kioskMode) {
    return createPortal(
      <div className="kiosk-overlay">
        <div className="kiosk-header">
          <h1 className="kiosk-title">
            <Activity className="pulse-success-icon" size={40} color="var(--success)" /> 
            KIOSK MODE: {saudeRede.status}
          </h1>
          <button className="kiosk-btn-exit" onClick={() => setKioskMode(false)}>
            SAIR [ESC]
          </button>
        </div>
        
        <div className="kiosk-grid">
          <div className="kiosk-card total">
            <Server size={40} color="#94a3b8" />
            <h2 style={{ color: '#94a3b8' }}>TOTAL</h2>
            <div className="kiosk-card-val" style={{ color: 'white' }}>{qtdTotal}</div>
          </div>
          
          <div className="kiosk-card ok">
            <Activity size={40} color="#10b981" />
            <h2 style={{ color: '#10b981' }}>OPERANDO</h2>
            <div className="kiosk-card-val" style={{ color: '#10b981' }}>{operandoReal}</div>
          </div>
          
          <div className="kiosk-card degelo">
            <Snowflake size={40} color="#38bdf8" />
            <h2 style={{ color: '#38bdf8' }}>DEGELO</h2>
            <div className="kiosk-card-val" style={{ color: '#38bdf8' }}>{maquinasDegelo}</div>
          </div>
          
          <div className={`kiosk-card alerta ${maquinasEmFalha === 0 ? 'inactive' : ''}`}>
            <AlertOctagon size={40} color="#ef4444" className={maquinasEmFalha > 0 ? "pulse-danger-icon" : ""} />
            <h2 style={{ color: '#ef4444' }}>ALARMES</h2>
            <div className="kiosk-card-val" style={{ color: '#ef4444' }}>{maquinasEmFalha}</div>
          </div>
        </div>
        
        <h2 className="kiosk-log-section">OCORRÊNCIAS EM TEMPO REAL</h2>
        
        <div className="kiosk-log-list">
           {localAlertas.length === 0 ? (
              <h1 style={{ color: '#10b981', textAlign: 'center', marginTop: '4rem', opacity: 0.5 }}>
                TUDO OPERACIONAL NA LOJA
              </h1>
           ) : (
              localAlertas.map((n, i) => (
                <div key={i} className="kiosk-log-item">
                   <div className="kiosk-log-name">{n.equipamento_nome}</div>
                   <div className="kiosk-log-msg">{n.mensagem}</div>
                   <div className="kiosk-log-time">{new Date(n.data_hora).toLocaleTimeString()}</div>
                </div>
              ))
           )}
        </div>
      </div>,
      document.body 
    );
  }

  return (
    <div className="anim-fade-in dashboard-container">
      
      <div className={`health-banner ${saudeRede.class} stagger-1`}>
        <div className="health-info">
          <Zap size={32} className="health-icon" />
          <div>
            <h4>Índice de integridade do sistema</h4>
            <p>Estado Operacional: <strong>{saudeRede.status}</strong></p>
          </div>
        </div>
        
        <div className="health-secondary-stats">
          <div className="sla-stat"><span className="sla-label">SLA GARANTIDO</span><span className="sla-value">99.98%</span></div>
          <div className="sla-stat"><span className="sla-label">SENSORES ATIVOS</span><span className="sla-value">{qtdTotal} NÓS</span></div>
        </div>

        <div className="health-score-area">
          <span className="health-score">{saudeRede.score}%</span>
          <div className="health-progress-bg"><div className="health-progress-fill" style={{ width: `${saudeRede.score}%` }}></div></div>
        </div>
      </div>

      <div className="dashboard-grid stagger-2">
        <div className="summary-cards">
          <StatCard title="Máquinas na Rede" value={qtdTotal} icon={Server} iconBg="icon-bg-gray" />
          <StatCard title="Operação Segura" value={operandoReal} icon={Activity} iconBg="icon-bg-green" valClass="val-green" />
          <StatCard title="Ciclos de Degelo" value={maquinasDegelo} icon={ThermometerSnowflake} iconBg="icon-bg-blue" valClass="val-blue" />
          <StatCard title="Máquinas em Alerta" value={maquinasEmFalha} icon={AlertOctagon} iconBg="icon-bg-red" valClass="val-red" isPulsing={maquinasEmFalha > 0} />
        </div>

        <div className="donut-container">
          <span className="donut-title">Distribuição de Carga</span>
          <div style={{ width: '100%', height: '240px', minHeight: '240px', position: 'relative', marginTop: '10px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {temDadosDonut ? (
                  <>
                    <Pie data={dadosDonutReativos} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" nameKey="name" stroke="none" isAnimationActive={false}>
                      {dadosDonutReativos.map((entry, index) => (<Cell key={`cell-${index}`} fill={DONUT_COLORS[entry.name] || '#94a3b8'} />))}
                    </Pie>
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} isAnimationActive={false} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.85rem', fontWeight: '600', paddingBottom: '10px' }}/>
                  </>
                ) : (
                  <>
                    <Pie data={dadosPlaceholder} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" nameKey="name" stroke="none" fill={isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'} isAnimationActive={false} />
                    <Tooltip content={<EmptyTooltip />} isAnimationActive={false} />
                  </>
                )}
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex-header stagger-3" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
        <h3 className="section-title">Monitor de Incidentes Ativos</h3>
        
        <div className="triage-actions">
          <div style={{ display: 'flex', gap: '8px', marginRight: '10px' }}>
             <button onClick={gerarSnapshotPDF} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'var(--card-bg)' }}>
               <DownloadCloud size={16} style={{marginRight: '6px'}}/> Snapshot PDF
             </button>
             <button onClick={() => setKioskMode(true)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
               <MonitorPlay size={16} style={{marginRight: '6px'}}/> Kiosk Mode
             </button>
          </div>

          {localAlertas?.length > 0 && (
            <div className="triage-filters">
              <button className={`btn-filter ${filtroRisco === 'TODOS' ? 'active' : ''}`} onClick={() => setFiltroRisco('TODOS')}>Todos</button>
              <button className={`btn-filter critical ${filtroRisco === 'CRITICO' ? 'active' : ''}`} onClick={() => setFiltroRisco('CRITICO')}>Críticos</button>
              <button className={`btn-filter warning ${filtroRisco === 'AVISO' ? 'active' : ''}`} onClick={() => setFiltroRisco('AVISO')}>Avisos</button>
            </div>
          )}
          {localAlertas?.length > 0 && (
            <button className="btn btn-outline btn-archive" onClick={resolverTodasNotificacoes} disabled={isOffline}>
              <CheckCircle size={18} /> Normalizar Todos
            </button>
          )}
        </div>
      </div>
      
      {!alertasExibidos?.length ? (
        <div className="empty-state dashboard-empty stagger-3">
          <div className="radar-box">
             <div className="radar-scanner"></div><div className="radar-blip blip-1"></div><div className="radar-blip blip-2"></div><div className="radar-blip blip-3"></div>
             <Radio size={40} className="radar-icon" color="var(--success)" />
          </div>
          <h3 className="empty-title">Nenhuma Ocorrência Detectada</h3>
          <p className="empty-subtitle">{filtroRisco === 'TODOS' ? 'O radar não detecta anomalias térmicas ou mecânicas. A infraestrutura encontra-se operacional e dentro das métricas.' : 'Não existem ocorrências ativas para o filtro de risco selecionado.'}</p>
        </div>
      ) : (
        <div className="grid-cards stagger-3">
          {alertasExibidos.map(notif => (<AlertCard key={notif.id} notif={notif} onResolve={handleResolve} onAbrirChat={abrirChatInterno} isOffline={isOffline} />))}
        </div>
      )}

      <div className="noc-ticker-wrap stagger-4">
        <div className="noc-ticker-label">LATEST EVENTS</div>
        <div className="noc-ticker">
          <div className="ticker-content">
            {localAlertas.length > 0 ? (
              localAlertas.map((n, i) => (<span key={i} className={`ticker-item ${n.tipo_alerta === 'MECANICA' || n.tipo_alerta === 'PORTA' || n.tipo_alerta === 'TEMPERATURA' ? 'ticker-critical' : 'ticker-warning'}`}>[{new Date(n.data_hora).toLocaleTimeString()}] {n.filial.toUpperCase()} - {n.equipamento_nome.toUpperCase()}: {n.mensagem.toUpperCase()}</span>))
            ) : (<span className="ticker-item ticker-success">SISTEMA 100% OPERACIONAL - NENHUMA OCORRÊNCIA REGISTRADA NA REDE - MONITORAMENTO DE SENSOR ATIVO</span>)}
          </div>
        </div>
      </div>

      {chatAtivo && (
        <ChatDrawer notif={chatAtivo} onClose={() => setChatAtivo(null)} contatosDb={contatosDb} irParaChat={irParaChat} showToast={showToast} socket={socket} userId={userId} nomeLogado={nomeLogado} setHistoricoChat={setHistoricoChat} />
      )}
    </div>
  );
}

const AlertCard = memo(({ notif, onResolve, onAbrirChat, isOffline }) => {
  const tipo = getAlertConfig(notif.tipo_alerta);
  const IconCmp = tipo.icon;

  return (
    <div className={`card card-alert ${tipo.critical ? 'critical-alert' : ''}`} style={{ '--alert-color': tipo.color }}>
      <div className="card-top">
        <div className="alert-title-group">
          <div className="alert-icon-box"><IconCmp size={20} color={tipo.color} /></div>
          <div className="alert-equip-info">
            <span className="alert-equip-name">{notif.equipamento_nome}</span>
            <div className="badges-container"><span className="badge-setor">{notif.setor}</span><span className="badge-setor">{notif.filial}</span></div>
          </div>
        </div>
      </div>
      <div className="alert-body">
        <p className="alert-msg">{notif.mensagem}</p>
        <span className="time-badge"><Clock size={12} />{new Date(notif.data_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>
      <div className="alert-actions">
        <button className="btn btn-alert-action flex-1" onClick={() => onResolve(notif.id)} disabled={isOffline} style={{ backgroundColor: tipo.color }}>{tipo.action}</button>
        {tipo.critical && (<button className="btn btn-chat-internal" onClick={() => onAbrirChat(notif)} title="Escalar problema para a Equipe Técnica"><MessageSquare size={18} /></button>)}
      </div>
    </div>
  );
});