import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { AlertTriangle, Wifi, Snowflake, Power, DoorOpen, ActivitySquare, ClipboardCheck, CheckCircle, Server, Activity, ThermometerSnowflake, AlertOctagon } from 'lucide-react';
import './Dashboard.css';

export default function Dashboard({ 
  qtdTotal, qtdOperando, qtdDegelo, qtdFalha, dadosDonutStatus, 
  notificacoesDaFilial, resolverTodasNotificacoes, isOffline, pedirNotaResolucao, isDarkMode 
}) {
  return (
    <div className="anim-fade-in">
      {/* SEÇÃO 1: KPIs SUPERIORES */}
      <div className="dashboard-grid stagger-1">
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-header">
              <span className="summary-title">Equipamentos Instalados</span>
              <div className="summary-icon-wrapper" style={{ backgroundColor: 'rgba(100, 116, 139, 0.1)' }}>
                <Server size={20} color="var(--text-muted)" />
              </div>
            </div>
            <span className="summary-value">{qtdTotal}</span>
          </div>

          <div className="summary-card">
            <div className="summary-header">
              <span className="summary-title">Operação Segura</span>
              <div className="summary-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}>
                <Activity size={20} color="var(--success)" />
              </div>
            </div>
            <span className="summary-value val-green">{qtdOperando}</span>
          </div>

          <div className="summary-card">
            <div className="summary-header">
              <span className="summary-title">Modo Degelo</span>
              <div className="summary-icon-wrapper" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)' }}>
                <ThermometerSnowflake size={20} color="var(--secondary)" />
              </div>
            </div>
            <span className="summary-value val-blue">{qtdDegelo}</span>
          </div>

          <div className="summary-card">
            <div className="summary-header">
              <span className="summary-title">Anomalias Ativas</span>
              <div className="summary-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}>
                <AlertOctagon size={20} color="var(--danger)" />
              </div>
            </div>
            <span className={`summary-value val-red ${notificacoesDaFilial?.length > 0 ? 'pulse-danger' : ''}`} style={{ borderRadius: '50%', display: 'inline-block', width: 'fit-content' }}>
              {qtdFalha}
            </span>
          </div>
        </div>

        {/* SEÇÃO 2: GRÁFICO DONUT */}
        <div className="donut-container">
          <span className="donut-title">Operações de Máquinas</span>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={dadosDonutStatus} innerRadius={65} outerRadius={85} paddingAngle={6} dataKey="value" stroke="none">
                {dadosDonutStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', borderRadius: '12px', border: '1px solid var(--border)', fontWeight: 'bold', color: 'var(--text-main)' }} 
                itemStyle={{ color: 'var(--text-main)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SEÇÃO 3: TRIAGEM DE ALERTAS */}
      <div className="flex-header stagger-2">
        <h3 style={{ margin: 0 }}>Painel Operacional e Triagem</h3>
        {notificacoesDaFilial?.length > 0 && (
          <div className="action-group">
            <button className="btn btn-outline" style={{ color: 'var(--text-main)' }} onClick={resolverTodasNotificacoes} disabled={isOffline}>
              <CheckCircle size={18} color="var(--success)"/> Arquivar Todos
            </button>
          </div>
        )}
      </div>
      
      {notificacoesDaFilial?.length === 0 ? (
        <div className="empty-state dashboard-empty stagger-3">
          <CheckCircle size={64} color="var(--success)" className="pulse-success-icon" style={{ marginBottom: '1.5rem' }} />
          <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.5rem' }}>Plataforma Estável</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.5rem' }}>A rede, a metrologia e a temperatura encontram-se dentro dos parâmetros legais.</p>
        </div>
      ) : (
        <div className="grid-cards stagger-3">
          {notificacoesDaFilial?.map(notif => {
            const isRede = notif.tipo_alerta === 'REDE'; 
            const isDegelo = notif.tipo_alerta === 'DEGELO'; 
            const isMecanica = notif.tipo_alerta === 'MECANICA'; 
            const isPorta = notif.tipo_alerta === 'PORTA'; 
            const isPreditivo = notif.tipo_alerta === 'PREDITIVO'; 
            const isMetrologia = notif.tipo_alerta === 'METROLOGIA';
            
            let IconCmp = AlertTriangle; 
            let colorTheme = 'var(--danger)';

            if (isRede) { IconCmp = Wifi; colorTheme = 'var(--warning)'; } 
            else if (isDegelo) { IconCmp = Snowflake; colorTheme = 'var(--secondary)'; } 
            else if (isMecanica) { IconCmp = Power; colorTheme = '#f97316'; }
            else if (isPorta) { IconCmp = DoorOpen; colorTheme = '#e11d48'; }
            else if (isPreditivo) { IconCmp = ActivitySquare; colorTheme = '#8b5cf6'; } 
            else if (isMetrologia) { IconCmp = ClipboardCheck; colorTheme = '#6366f1'; } 

            return (
              // Injetamos a cor temática do alerta como uma variável CSS para este cartão específico
              <div key={notif.id} className={`card card-alert ${!isDegelo && !isRede && !isPreditivo && !isMetrologia ? 'pulse-danger' : ''}`} style={{ '--alert-color': colorTheme }}>
                
                <div className="card-top">
                  <div className="alert-title-group">
                    <div className="alert-icon-box">
                      <IconCmp size={22} color={colorTheme} />
                    </div>
                    <span className="alert-equip-name">{notif.equipamento_nome}</span>
                  </div>
                  <span className="time-badge">{new Date(notif.data_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <span className="badge-setor" style={{ background: 'var(--bg-color)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{notif.filial}</span>
                  <span className="badge-setor" style={{ background: 'var(--bg-color)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{notif.setor}</span>
                </div>
                
                <p className="alert-msg">{notif.mensagem}</p>
                
                <button 
                  className="btn w-100" 
                  onClick={() => pedirNotaResolucao(notif.id)} 
                  disabled={isOffline} 
                  style={{ 
                    backgroundColor: colorTheme, 
                    color: '#ffffff', 
                    border: 'none',
                    boxShadow: `0 4px 12px color-mix(in srgb, ${colorTheme} 40%, transparent)`
                  }}
                >
                  {isDegelo ? 'Ocultar Degelo' : (isMecanica ? 'Assinalar Manutenção' : (isPorta ? 'Confirmar Fecho da Porta' : (isMetrologia ? 'Arquivar Notificação' : 'Resolver Anomalia')))}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}