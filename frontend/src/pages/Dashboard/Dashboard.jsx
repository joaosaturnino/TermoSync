import React, { useEffect, useCallback, memo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { 
  AlertTriangle, Wifi, Snowflake, Power, DoorOpen, 
  ActivitySquare, ClipboardCheck, CheckCircle, Server, 
  Activity, ThermometerSnowflake, AlertOctagon, MessageSquare, Send, X
} from 'lucide-react';
import './Dashboard.css';

const StatCard = memo(({ title, value, icon: Icon, iconBg, valClass = '', isPulsing = false }) => (
  <div className="summary-card">
    <div className="summary-header">
      <span className="summary-title">{title}</span>
      <div className={`summary-icon-wrapper ${iconBg}`}>
        <Icon size={20} className="kpi-icon" />
      </div>
    </div>
    <span className={`summary-value ${valClass} ${isPulsing ? 'pulse-danger-text' : ''}`}>
      {value || 0}
    </span>
  </div>
));

const ChatModal = ({ notif, onClose, contatosDb, irParaChat, showToast, socket, userId, nomeLogado, setHistoricoChat }) => {
  const [contatoSelecionado, setContatoSelecionado] = useState('');
  const [novaMensagem, setNovaMensagem] = useState(`Emergência técnica: A máquina ${notif.equipamento_nome} (${notif.filial}) registou uma anomalia grave. Solicito verificação.`);

  const handleEnviar = (e) => {
    e.preventDefault();
    if (!contatoSelecionado) return showToast('Selecione um destinatário.', 'warning');
    if (!novaMensagem.trim()) return;

    const msg = {
      id: Date.now(), 
      remetenteId: userId,
      remetenteNome: nomeLogado,
      destinoId: contatoSelecionado,
      texto: novaMensagem,
      data: new Date(),
      tipo: 'sent'
    };

    setHistoricoChat(prev => [...prev, msg]);
    if (socket) socket.emit('enviar_mensagem_chat', msg);

    showToast('Alerta encaminhado! A redirecionar...', 'success');
    onClose();
    setTimeout(() => { irParaChat(contatoSelecionado); }, 600); 
  };

  return (
    <div className="chat-overlay" onClick={onClose}>
      <div className="chat-panel" onClick={(e) => e.stopPropagation()} style={{ height: 'auto', paddingBottom: '1rem' }}>
        <div className="chat-header" style={{ background: 'var(--danger)', color: 'white', borderBottom: 'none' }}>
          <div className="chat-header-info">
            <h4 style={{ color: 'white' }}>Escalonar Alerta Crítico</h4>
            <p style={{ color: 'rgba(255,255,255,0.8)' }}>{notif.equipamento_nome} • {notif.filial}</p>
          </div>
          <button className="btn-close-chat" onClick={onClose} style={{ color: 'white' }}>
            <X size={24} />
          </button>
        </div>
        
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-main)' }}>
              1. Selecionar Destinatário
            </label>
            <select 
              className="select-input" 
              value={contatoSelecionado} 
              onChange={(e) => setContatoSelecionado(e.target.value)}
              style={{ width: '100%', padding: '12px', background: 'var(--bg-color)' }}
            >
              <option value="">-- Escolha o destinatário --</option>
              {contatosDb?.map(c => (
                <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>
              ))}
              <option value="todos">Notificar Equipa Inteira (Broadcast)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-main)' }}>
              2. Detalhes da Emergência
            </label>
            <textarea 
              value={novaMensagem}
              onChange={(e) => setNovaMensagem(e.target.value)}
              style={{ 
                width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', 
                background: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: 'inherit',
                resize: 'vertical', minHeight: '90px'
              }}
            />
          </div>

          <button 
            className="btn btn-primary w-100" 
            onClick={handleEnviar}
            style={{ padding: '14px', fontSize: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }}
          >
            <Send size={18} style={{ marginRight: '8px' }} /> Confirmar e Abrir Bate-Papo
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard({ 
  qtdTotal, qtdOperando, qtdDegelo, qtdFalha, dadosDonutStatus = [], 
  notificacoesDaFilial = [], resolverTodasNotificacoes, isOffline, pedirNotaResolucao, isDarkMode,
  contatosDb, irParaChat, showToast, socket, userId, nomeLogado, setHistoricoChat
}) {

  const [chatAtivo, setChatAtivo] = useState(null);

  useEffect(() => {
    const temFalhaCritica = notificacoesDaFilial?.some(n => n.tipo_alerta === 'MECANICA' || n.tipo_alerta === 'PORTA');
    if (temFalhaCritica && !isOffline) {
      const audio = new Audio('/alert-sound.mp3'); 
      audio.play().catch(() => {});
    }
  }, [notificacoesDaFilial, isOffline]);

  const abrirChatInterno = useCallback((notif) => { setChatAtivo(notif); }, []);
  const handleResolve = useCallback((id) => { pedirNotaResolucao(id); }, [pedirNotaResolucao]);

  return (
    <div className="anim-fade-in dashboard-container">
      
      <div className="dashboard-grid stagger-1">
        <div className="summary-cards">
          <StatCard title="Equipamentos na Rede" value={qtdTotal} icon={Server} iconBg="icon-bg-gray" />
          <StatCard title="Operação Segura" value={qtdOperando} icon={Activity} iconBg="icon-bg-green" valClass="val-green" />
          <StatCard title="Modo Degelo" value={qtdDegelo} icon={ThermometerSnowflake} iconBg="icon-bg-blue" valClass="val-blue" />
          <StatCard title="Anomalias Ativas" value={qtdFalha} icon={AlertOctagon} iconBg="icon-bg-red" valClass="val-red" isPulsing={notificacoesDaFilial?.length > 0} />
        </div>

        <div className="donut-container">
          <span className="donut-title">Distribuição da Rede</span>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={dadosDonutStatus} innerRadius={65} outerRadius={85} paddingAngle={6} dataKey="value" stroke="none">
                {dadosDonutStatus?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
                  backdropFilter: 'blur(10px)', borderRadius: '12px', border: '1px solid var(--border)' 
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex-header stagger-2">
        <h3 className="section-title">Triagem de Rede e Sensores</h3>
        {notificacoesDaFilial?.length > 0 && (
          <button className="btn btn-outline btn-archive" onClick={resolverTodasNotificacoes} disabled={isOffline}>
            <CheckCircle size={18} /> Arquivar Todos
          </button>
        )}
      </div>
      
      {!notificacoesDaFilial?.length ? (
        <div className="empty-state dashboard-empty stagger-3">
          <CheckCircle size={64} className="pulse-success-icon empty-icon" color="var(--success)" />
          <h3 className="empty-title">Rede Estável</h3>
          <p className="empty-subtitle">Todos os nós da rede e sensores de temperatura estão respondendo normalmente.</p>
        </div>
      ) : (
        <div className="grid-cards stagger-3">
          {notificacoesDaFilial.map(notif => (
            <AlertCard 
              key={notif.id} 
              notif={notif} 
              onResolve={handleResolve} 
              onAbrirChat={abrirChatInterno}
              isOffline={isOffline} 
            />
          ))}
        </div>
      )}

      {chatAtivo && (
        <ChatModal 
          notif={chatAtivo} 
          onClose={() => setChatAtivo(null)} 
          contatosDb={contatosDb}
          irParaChat={irParaChat}
          showToast={showToast}
          socket={socket}
          userId={userId}
          nomeLogado={nomeLogado}
          setHistoricoChat={setHistoricoChat}
        />
      )}
    </div>
  );
}

const AlertCard = memo(({ notif, onResolve, onAbrirChat, isOffline }) => {
  const configs = {
    'REDE': { icon: Wifi, color: 'var(--warning)', action: 'Verificar Nó de Rede', critical: false },
    'DEGELO': { icon: Snowflake, color: 'var(--secondary)', action: 'Ocultar Degelo', critical: false },
    'MECANICA': { icon: Power, color: '#f97316', action: 'Assinalar Manutenção', critical: true },
    'PORTA': { icon: DoorOpen, color: '#e11d48', action: 'Confirmar Fechamento', critical: true },
    'PREDITIVO': { icon: ActivitySquare, color: '#8b5cf6', action: 'Analisar Previsão', critical: false },
    'METROLOGIA': { icon: ClipboardCheck, color: '#6366f1', action: 'Arquivar Calibração', critical: false }
  };

  const tipo = configs[notif.tipo_alerta] || { icon: AlertTriangle, color: 'var(--danger)', action: 'Resolver Anomalia', critical: true };
  const IconCmp = tipo.icon;

  return (
    <div className={`card card-alert ${tipo.critical ? 'pulse-danger-border' : ''}`} style={{ '--alert-color': tipo.color }}>
      <div className="card-top">
        <div className="alert-title-group">
          <div className="alert-icon-box">
            <IconCmp size={22} color={tipo.color} />
          </div>
          <span className="alert-equip-name">{notif.equipamento_nome}</span>
        </div>
        <span className="time-badge">{new Date(notif.data_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>
      
      <div className="badges-container">
        <span className="badge-setor">{notif.filial}</span>
        <span className="badge-setor">{notif.setor}</span>
      </div>
      
      <p className="alert-msg">{notif.mensagem}</p>
      
      <div className="alert-actions">
        <button className="btn btn-alert-action flex-1" onClick={() => onResolve(notif.id)} disabled={isOffline} style={{ backgroundColor: tipo.color, boxShadow: `0 4px 12px color-mix(in srgb, ${tipo.color} 40%, transparent)` }}>
          {tipo.action}
        </button>
        {tipo.critical && (
          <button className="btn btn-chat-internal" onClick={() => onAbrirChat(notif)} title="Abrir Chat de Suporte Interno">
            <MessageSquare size={20} />
          </button>
        )}
      </div>
    </div>
  );
});