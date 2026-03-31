import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { AlertTriangle, Wifi, Snowflake, Power, DoorOpen, ActivitySquare, ClipboardCheck, CheckCircle } from 'lucide-react';

export default function Dashboard({ 
  qtdTotal, qtdOperando, qtdDegelo, qtdFalha, dadosDonutStatus, 
  notificacoesDaFilial, resolverTodasNotificacoes, isOffline, pedirNotaResolucao, isDarkMode 
}) {
  return (
    <div className="anim-fade-in">
      <div className="dashboard-grid stagger-1">
        <div className="summary-cards" style={{ margin: 0 }}>
          <div className="summary-card"><span className="summary-title">Equipamentos Instalados</span><span className="summary-value">{qtdTotal}</span></div>
          <div className="summary-card"><span className="summary-title">Operação Segura</span><span className="summary-value val-green">{qtdOperando}</span></div>
          <div className="summary-card"><span className="summary-title">Modo Degelo</span><span className="summary-value val-blue">{qtdDegelo}</span></div>
          <div className="summary-card"><span className="summary-title">Anomalias Ativas</span><span className={`summary-value val-red ${notificacoesDaFilial?.length > 0 ? 'pulse-danger' : ''}`} style={{ borderRadius: '50%', display: 'inline-block', width: 'fit-content' }}>{qtdFalha}</span></div>
        </div>
        <div className="donut-container">
          <span className="donut-title">Eficiência e Saúde do Frio</span>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart><Pie data={dadosDonutStatus} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{dadosDonutStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none' }} /></PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex-header stagger-2">
        <h3>Painel Operacional e Triagem</h3>
        {notificacoesDaFilial?.length > 0 && (<div className="action-group"><button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={resolverTodasNotificacoes} disabled={isOffline}><CheckCircle size={18}/> Arquivar Todos</button></div>)}
      </div>
      
      {notificacoesDaFilial?.length === 0 ? (
        <div className="empty-state stagger-3"><CheckCircle size={56} color="var(--success)" style={{ marginBottom: '1rem' }} /><h3 style={{ margin: 0, color: 'var(--text-main)' }}>Plataforma Limpa</h3><p>Temperatura, rede e metrologia dentro dos conformes legais.</p></div>
      ) : (
        <div className="grid-cards stagger-3">
          {notificacoesDaFilial?.map(notif => {
            const isRede = notif.tipo_alerta === 'REDE'; const isDegelo = notif.tipo_alerta === 'DEGELO'; const isMecanica = notif.tipo_alerta === 'MECANICA'; const isPorta = notif.tipo_alerta === 'PORTA'; const isPreditivo = notif.tipo_alerta === 'PREDITIVO'; const isMetrologia = notif.tipo_alerta === 'METROLOGIA';
            let IconCmp = AlertTriangle; let colorTheme = 'var(--danger)';
            if (isRede) { IconCmp = Wifi; colorTheme = 'var(--warning)'; } 
            else if (isDegelo) { IconCmp = Snowflake; colorTheme = 'var(--info)'; } 
            else if (isMecanica) { IconCmp = Power; colorTheme = '#f97316'; }
            else if (isPorta) { IconCmp = DoorOpen; colorTheme = '#e11d48'; }
            else if (isPreditivo) { IconCmp = ActivitySquare; colorTheme = '#8b5cf6'; } 
            else if (isMetrologia) { IconCmp = ClipboardCheck; colorTheme = '#6366f1'; } 

            return (
              <div key={notif.id} className={`card card-alert ${!isDegelo && !isRede && !isPreditivo && !isMetrologia ? 'pulse-danger' : ''}`} style={{ borderColor: colorTheme, backgroundColor: (isPreditivo || isMetrologia) ? 'rgba(139, 92, 246, 0.05)' : undefined }}>
                <div className="card-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><IconCmp size={24} color={colorTheme} /><span style={{ fontWeight: '800', fontSize: '1.1rem', color: colorTheme }}>{notif.equipamento_nome}</span></div>
                  <span className="time-badge" style={{ color: colorTheme, backgroundColor: isDegelo ? 'rgba(56, 189, 248, 0.1)' : undefined }}>{new Date(notif.data_hora).toLocaleTimeString()}</span>
                </div>
                <span className="badge-setor">{notif.filial} | {notif.setor}</span>
                <p className="alert-msg">{notif.mensagem}</p>
                <button className="btn btn-primary w-100" onClick={() => pedirNotaResolucao(notif.id)} disabled={isOffline} style={(isDegelo || isMecanica || isPorta || isPreditivo || isMetrologia) ? { backgroundColor: colorTheme, color: '#fff', borderColor: colorTheme } : {}}>
                  {isDegelo ? 'Ocultar Degelo' : (isMecanica ? 'Assinalar Manutenção' : (isPorta ? 'Fechar Porta Física' : (isMetrologia ? 'Arquivar Notificação' : 'Resolver Anomalia')))}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}