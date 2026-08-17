import React, { useCallback, memo, useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  AlertTriangle, Wifi, Snowflake, Power, DoorOpen, Droplets, 
  ActivitySquare, ClipboardCheck, CheckCircle, Server, 
  Activity, ThermometerSnowflake, AlertOctagon, MessageSquare, Send, X, Clock, Radio, Zap, DownloadCloud, Tv, MapPin, CheckCircle2, Thermometer
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

// =====================================================================
// COMPONENTES BLINDADOS (MEMO) - EVITAM TRAVAMENTOS NO NAVEGADOR
// =====================================================================

const StatCard = memo(({ title, value, icon: Icon, iconBg, valClass = '', isPulsing = false }) => (
  <div className={`summary-card ${isPulsing ? 'pulsing-card' : ''}`}>
    <div className="summary-header"><span className="summary-title">{title}</span><div className={`summary-icon-wrapper ${iconBg}`}><Icon size={22} className="kpi-icon" /></div></div>
    <div className="summary-body"><span className={`summary-value ${valClass} ${isPulsing ? 'pulse-danger-text' : ''}`}>{value || 0}</span>{isPulsing && <span className="live-pulse-dot bg-danger"></span>}</div>
  </div>
));

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

// [NOVIDADE] Gráfico Isolado. Ele causava a lentidão por recarregar a cada temperatura.
const MemoizedDonut = memo(({ temDadosDonut, dadosDonutReativos, dadosPlaceholder, isDarkMode }) => {
  const DONUT_COLORS = { 'Ok': '#10b981', 'Degelo': '#38bdf8', 'Falha': '#ef4444' };
  return (
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
  );
});

// [NOVIDADE] Ticker Isolado
const NocTicker = memo(({ localAlertas }) => (
  <div className="noc-ticker-wrap stagger-4">
    <div className="noc-ticker-label">LATEST EVENTS</div>
    <div className="noc-ticker">
      <div className="ticker-content">
        {localAlertas.length > 0 ? (
          localAlertas.map((n, i) => (
            <span key={`ticker-${n.id || i}`} className={`ticker-item ${n.tipo_alerta === 'MECANICA' || n.tipo_alerta === 'PORTA' || n.tipo_alerta === 'TEMPERATURA' ? 'ticker-critical' : 'ticker-warning'}`}>
              [{new Date(n.data_hora).toLocaleTimeString()}] {String(n.filial || 'MATRIZ').toUpperCase()} - {String(n.equipamento_nome || 'EQUIPAMENTO').toUpperCase()}: {String(n.mensagem || '').toUpperCase()}
            </span>
          ))
        ) : (
          <span className="ticker-item ticker-success">SISTEMA 100% OPERACIONAL - NENHUMA OCORRÊNCIA REGISTRADA NA REDE - MONITORAMENTO DE SENSOR ATIVO</span>
        )}
      </div>
    </div>
  </div>
));

const AlertCard = memo(({ notif, onResolve, onAbrirChat, isOffline }) => {
  const tipo = getAlertConfig(notif.tipo_alerta);
  const IconCmp = tipo.icon;

  return (
    <div className={`card card-alert ${tipo.critical ? 'critical-alert' : ''}`} style={{ '--alert-color': tipo.color }}>
      <div className="card-top">
        <div className="alert-title-group">
          <div className="alert-icon-box"><IconCmp size={20} color={tipo.color} /></div>
          <div className="alert-equip-info">
            <span className="alert-equip-name">{notif.equipamento_nome || 'Equipamento'}</span>
            <div className="badges-container">
              <span className="badge-setor">{notif.setor || 'Geral'}</span>
              <span className="badge-setor">{notif.filial || 'Matriz'}</span>
            </div>
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

// [NOVIDADE] MODO TV BLINDADO 
const PainelTVKiosk = memo(({ equipamentosDaFilial, filialAtiva, onClose }) => {
  const equipamentosAgrupados = useMemo(() => {
    if (!equipamentosDaFilial) return {};
    return equipamentosDaFilial.reduce((grupos, eq) => {
      const nomeFilial = eq.filial || 'Filial Não Identificada';
      if (!grupos[nomeFilial]) grupos[nomeFilial] = [];
      grupos[nomeFilial].push(eq);
      return grupos;
    }, {});
  }, [equipamentosDaFilial]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#0f172a', display: 'flex', flexDirection: 'column', padding: '2rem', color: '#f8fafc', fontFamily: 'system-ui, sans-serif', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#38bdf8' }}>
            {!filialAtiva || filialAtiva.toLowerCase() === 'todas' ? 'Visão Geral (Rede Completa)' : filialAtiva}
          </h1>
          <p style={{ margin: 0, fontSize: '1.2rem', color: '#94a3b8' }}>Monitoramento Operacional e Metrológico</p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
              <span className="live-indicator-dot" style={{ width: '15px', height: '15px', backgroundColor: '#10b981', borderRadius: '50%' }}></span> AO VIVO
            </div>
            <p style={{ margin: 0, color: '#64748b' }}>Sincronização Ativa</p>
          </div>
          
          <button onClick={onClose} style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px 20px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <X size={20} /> Sair [ESC]
          </button>
        </div>
      </div>

      {!equipamentosDaFilial || equipamentosDaFilial.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#1e293b', borderRadius: '24px', border: '1px dashed #334155' }}>
          <Activity size={64} color="#64748b" style={{marginBottom: '1rem', opacity: 0.5}} />
          <h2 style={{color: '#cbd5e1', margin: '0 0 10px 0'}}>Nenhuma máquina encontrada.</h2>
          <p style={{color: '#94a3b8', fontSize: '1.1rem'}}>Verifique a conexão dos sensores desta unidade.</p>
        </div>
      ) : (
        Object.entries(equipamentosAgrupados).map(([nomeFilial, maquinasDaFilial], index) => (
          <div key={index} style={{ marginBottom: '3.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', paddingBottom: '10px', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
              <MapPin size={28} color="#3b82f6" />
              <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#f1f5f9' }}>{nomeFilial}</h2>
              <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', padding: '4px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', marginLeft: '10px' }}>{maquinasDaFilial.length} ativo(s)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
              {maquinasDaFilial.map((eq, idx) => {
                const t = parseFloat(eq.ultima_temp);
                const min = parseFloat(eq.temp_min);
                const max = parseFloat(eq.temp_max);
                const temDados = !isNaN(t);
                
                const isAcima = temDados && t > max;
                const isAbaixo = temDados && t < min;
                const isFalhaMecanica = !eq.motor_ligado && temDados && t >= (max + 10.0) && !eq.em_degelo;

                let corCard = '#1e293b'; 
                let corTexto = '#10b981'; 
                let icone = <CheckCircle2 size={36} />;
                let status = 'DENTRO DA NORMA';

                if (!temDados) {
                  corTexto = '#f59e0b'; icone = <AlertTriangle size={36} />; status = 'SEM SINAL';
                } else if (eq.em_degelo) {
                  corTexto = '#0ea5e9'; icone = <Snowflake size={36} />; status = 'EM DEGELO';
                } else if (isFalhaMecanica) {
                  corTexto = '#ef4444'; corCard = '#450a0a'; icone = <Power size={36} />; status = 'MOTOR PARADO';
                } else if (isAcima) {
                  corTexto = '#ef4444'; icone = <AlertTriangle size={36} />; status = 'ALTA TEMPERATURA';
                } else if (isAbaixo) {
                  corTexto = '#38bdf8'; icone = <Thermometer size={36} />; status = 'BAIXA TEMPERATURA';
                } else if (!eq.motor_ligado) {
                  status = 'EM REPOUSO (IDEAL)';
                }

                return (
                  <div key={idx} style={{ background: corCard, border: `2px solid ${corTexto}`, borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', boxShadow: `0 8px 20px ${corTexto}15` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{eq.nome}</h3>
                        <span style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase' }}>{eq.setor}</span>
                      </div>
                      <div style={{ color: corTexto }}>{icone}</div>
                    </div>

                    <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
                      <span style={{ fontSize: '4.5rem', fontWeight: '900', color: corTexto, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                        {temDados ? t.toFixed(1) : '--'}°C
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
                      <span style={{ fontSize: '1rem', color: '#cbd5e1' }}>Mín: <b>{min.toFixed(1)}°C</b></span>
                      <span style={{ fontSize: '1rem', fontWeight: '900', color: corTexto }}>{status}</span>
                      <span style={{ fontSize: '1rem', color: '#cbd5e1' }}>Máx: <b>{max.toFixed(1)}°C</b></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        .live-indicator-dot { animation: blink 2s infinite; }
      `}} />
    </div>,
    document.body 
  );
});

const ChatDrawer = ({ notif, onClose, contatosDb, irParaChat, showToast, socket, userId, nomeLogado, setHistoricoChat }) => {
  const [contatoSelecionado, setContatoSelecionado] = useState('');
  const [novaMensagem, setNovaMensagem] = useState(`[ALERTA CRÍTICO] A máquina ${notif.equipamento_nome || 'Desconhecida'} (${notif.filial || 'Matriz'}) registrou uma anomalia grave. Ocorrência: ${notif.mensagem}. Solicito verificação técnica imediata.`);

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
        <div className="chat-drawer-header"><div className="chat-header-info"><h4>Escalar Emergência</h4><p>{notif.equipamento_nome || 'Equipamento'} • {notif.filial || 'Matriz'}</p></div><button className="btn-close-drawer" onClick={onClose}><X size={24} /></button></div>
        <div className="chat-drawer-body">
          <div className="form-group"><label>1. Direcionar alerta para:</label><select className="select-input w-100" value={contatoSelecionado} onChange={(e) => setContatoSelecionado(e.target.value)}><option value="">-- Escolha a equipe de intervenção --</option>{contatosDb?.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>)}<option value="todos">Toda a Rede (Broadcast de Emergência)</option></select></div>
          <div className="form-group"><label>2. Relatório do Incidente:</label><textarea className="textarea-input" value={novaMensagem} onChange={(e) => setNovaMensagem(e.target.value)} rows="6" /></div>
        </div>
        <div className="chat-drawer-footer"><button className="btn btn-outline w-100" onClick={onClose} style={{ marginBottom: '10px' }}>Cancelar</button><button className="btn btn-primary w-100 btn-escalar" onClick={handleEnviar}><Send size={18} /> Transmitir Alerta</button></div>
      </div>
    </div>
  );
};


/**
 * =====================================================================
 * Dashboard Principal
 * =====================================================================
 */
export default function Dashboard({ 
  qtdTotal, 
  qtdDegelo, 
  dadosDonutStatus = [], 
  notificacoesDaFilial = [], resolverTodasNotificacoes, isOffline, pedirNotaResolucao, isDarkMode,
  contatosDb, irParaChat, showToast, socket, userId, nomeLogado, setHistoricoChat,
  filialAtiva, equipamentosDaFilial 
}) {
  
  const [chatAtivo, setChatAtivo] = useState(null);
  const [filtroRisco, setFiltroRisco] = useState('TODOS'); 
  const [kioskMode, setKioskMode] = useState(false); 

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

  const { operandoReal, falhaReal, maquinasEmFalha, maquinasDegelo } = useMemo(() => {
    const qtAlertas = localAlertas.length;
    const setMaquinasFalhas = new Set(localAlertas.map(a => String(a.equipamento_id)));
    const qtMaquinasComFalha = setMaquinasFalhas.size;
    
    let qtDegeloFinal = qtdDegelo || 0;
    let qtOperando = (qtdTotal || 0) - qtDegeloFinal - qtMaquinasComFalha;
    
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
      const alarmesBody = localAlertas.map(n => [n.equipamento_nome || 'N/A', n.tipo_alerta, n.mensagem || '']);
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

  const temDadosDonut = dadosDonutReativos && dadosDonutReativos.length > 0;
  const dadosPlaceholder = [{ name: 'Aguardando Dados', value: 1 }];

  const fecharKiosk = useCallback(() => setKioskMode(false), []);

  return (
    <>
      {kioskMode && (
        <PainelTVKiosk 
          equipamentosDaFilial={equipamentosDaFilial} 
          filialAtiva={filialAtiva} 
          onClose={fecharKiosk} 
        />
      )}

      {(!temDadosDonut && (!localAlertas || localAlertas.length === 0) && (!qtdTotal || qtdTotal === 0)) ? (
        <EmptyState title="Sem telemetria" description="Nenhuma telemetria disponível no momento. Verifique a conexão com os gateways ou aguarde novos dados." />
      ) : (
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
                <MemoizedDonut 
                  temDadosDonut={temDadosDonut} 
                  dadosDonutReativos={dadosDonutReativos} 
                  dadosPlaceholder={dadosPlaceholder} 
                  isDarkMode={isDarkMode} 
                />
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
                 <button onClick={() => setKioskMode(true)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} title="Abre a visão Kiosk para a unidade autorizada">
                   <Tv size={16} style={{marginRight: '6px'}}/> Painel TV
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
              {alertasExibidos.map(notif => (<AlertCard key={`alert-${notif.id}`} notif={notif} onResolve={handleResolve} onAbrirChat={abrirChatInterno} isOffline={isOffline} />))}
            </div>
          )}

          <NocTicker localAlertas={localAlertas} />

          {chatAtivo && (
            <ChatDrawer notif={chatAtivo} onClose={() => setChatAtivo(null)} contatosDb={contatosDb} irParaChat={irParaChat} showToast={showToast} socket={socket} userId={userId} nomeLogado={nomeLogado} setHistoricoChat={setHistoricoChat} />
          )}
        </div>
      )}
    </>
  );
}