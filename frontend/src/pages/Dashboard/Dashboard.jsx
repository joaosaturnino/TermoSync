import React, { useCallback, memo, useState, useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { 
  AlertTriangle, Wifi, Snowflake, Power, DoorOpen, Droplets, 
  ActivitySquare, ClipboardCheck, CheckCircle, Server, 
  Activity, ThermometerSnowflake, AlertOctagon, MessageSquare, Send, X, Clock, Radio, Zap
} from 'lucide-react';
import './Dashboard.css';

// ============================================================================
// DICIONÁRIO E CONFIGURAÇÃO VISUAL DOS ALERTAS
// Mapeia o tipo de problema recebido da API para Ícones, Cores, Ações UI e Nível de Crise.
// ============================================================================
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

// ============================================================================
// COMPONENTE OTIMIZADO (MEMO): CARTÃO DE ESTATÍSTICA (KPI)
// Pequeno card no topo da tela usado para Máquinas na Rede, Operação Segura, etc.
// Usar memo evita renderizações extras desse elemento.
// ============================================================================
const StatCard = memo(({ title, value, icon: Icon, iconBg, valClass = '', isPulsing = false }) => (
  <div className={`summary-card ${isPulsing ? 'pulsing-card' : ''}`}>
    <div className="summary-header">
      <span className="summary-title">{title}</span>
      <div className={`summary-icon-wrapper ${iconBg}`}>
        <Icon size={22} className="kpi-icon" />
      </div>
    </div>
    <div className="summary-body">
      <span className={`summary-value ${valClass} ${isPulsing ? 'pulse-danger-text' : ''}`}>
        {value || 0}
      </span>
      {/* Exibe bolinha pulsante adicional se houver um erro atrelado à prop "isPulsing" */}
      {isPulsing && <span className="live-pulse-dot bg-danger"></span>}
    </div>
  </div>
));

// ============================================================================
// MODAL DRAWER DE ESCALONAMENTO DE CHAT INTERNO
// Esta tela desliza para permitir o envio do Alerta Crítico a um contato via Socket.
// ============================================================================
const ChatDrawer = ({ notif, onClose, contatosDb, irParaChat, showToast, socket, userId, nomeLogado, setHistoricoChat }) => {
  const [contatoSelecionado, setContatoSelecionado] = useState('');
  
  // Preenche a mensagem padrão automaticamente baseado no dado da notificação
  const [novaMensagem, setNovaMensagem] = useState(`[ALERTA CRÍTICO] A máquina ${notif.equipamento_nome} (${notif.filial}) registrou uma anomalia grave. Ocorrência: ${notif.mensagem}. Solicito verificação técnica imediata.`);

  const handleEnviar = (e) => {
    e.preventDefault();
    if (!contatoSelecionado) return showToast('Selecione um destinatário.', 'warning');
    if (!novaMensagem.trim()) return;

    // Constrói o Payload a ser gravado localmente e emitido pela rede
    const msg = {
      id: Date.now(), remetenteId: userId, remetenteNome: nomeLogado,
      destinoId: contatoSelecionado, texto: novaMensagem, data: new Date(), tipo: 'sent'
    };

    setHistoricoChat(prev => [...prev, msg]);
    if (socket) socket.emit('enviar_mensagem_chat', msg);

    showToast('Alerta transmitido à equipe com sucesso!', 'success');
    onClose();
    
    // Pequeno timeout para dar tempo da gaveta fechar antes de mudar para a aba Chat
    setTimeout(() => { irParaChat(contatoSelecionado === 'todos' ? null : contatoSelecionado); }, 400); 
  };

  return (
    <div className="chat-overlay" onClick={onClose}>
      {/* Evita fechamento quando clicar dentro da "Gaveta" (stopPropagation) */}
      <div className="chat-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="chat-drawer-header">
          <div className="chat-header-info">
            <h4>Escalar Emergência</h4>
            <p>{notif.equipamento_nome} • {notif.filial}</p>
          </div>
          <button className="btn-close-drawer" onClick={onClose}><X size={24} /></button>
        </div>
        
        <div className="chat-drawer-body">
          <div className="form-group">
            <label>1. Direcionar alerta para:</label>
            <select className="select-input w-100" value={contatoSelecionado} onChange={(e) => setContatoSelecionado(e.target.value)}>
              <option value="">-- Escolha a equipe de intervenção --</option>
              {/* Opções provenientes do Banco de Dados repassadas por prop */}
              {contatosDb?.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>)}
              <option value="todos">Toda a Rede (Broadcast de Emergência)</option>
            </select>
          </div>
          <div className="form-group">
            <label>2. Relatório do Incidente:</label>
            <textarea className="textarea-input" value={novaMensagem} onChange={(e) => setNovaMensagem(e.target.value)} rows="6" />
          </div>
        </div>

        <div className="chat-drawer-footer">
          <button className="btn btn-outline w-100" onClick={onClose} style={{ marginBottom: '10px' }}>Cancelar</button>
          <button className="btn btn-primary w-100 btn-escalar" onClick={handleEnviar}>
            <Send size={18} /> Transmitir Alerta
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TOOLTIPS CUSTOMIZADOS DO GRÁFICO RECHARTS (DONUT)
// ============================================================================
const CustomTooltip = ({ active, payload, isDarkMode }) => {
  // Renderiza a caixa preta customizada apenas se houver o hover no gráfico e dados presentes
  if (active && payload && payload.length) {
    return (
      <div style={{ 
        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
        backdropFilter: 'blur(10px)', 
        borderRadius: '12px', 
        border: '1px solid var(--border)',
        color: isDarkMode ? '#f8fafc' : '#0f172a',
        padding: '10px'
      }}>
        <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{payload[0].name}</p>
        <p style={{ margin: 0, fontWeight: '700', color: payload[0].payload.fill || '#38bdf8' }}>
          Quantidade: {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

// Tooltip exibido quando não há dados (Empty State)
const EmptyTooltip = () => (
  <div style={{
    padding: '8px', 
    background: 'var(--card-bg)', 
    border: '1px solid var(--border)', 
    borderRadius: '8px', 
    fontSize: '0.8rem', 
    fontWeight: '600'
  }}>
    Aguardando telemetria...
  </div>
);

// ============================================================================
// COMPONENTE PRINCIPAL (DASHBOARD)
// Agrega todo o gerenciamento de Estado de Filtros, Cálculo de SLA (Health Score),
// e renderização das subcamadas da interface principal.
// ============================================================================
export default function Dashboard({ 
  qtdTotal, qtdOperando, qtdDegelo, qtdFalha, dadosDonutStatus = [], 
  notificacoesDaFilial = [], resolverTodasNotificacoes, isOffline, pedirNotaResolucao, isDarkMode,
  contatosDb, irParaChat, showToast, socket, userId, nomeLogado, setHistoricoChat
}) {
  
  // Controle local para mostrar a "Gaveta" do Chat do lado Direito da tela
  const [chatAtivo, setChatAtivo] = useState(null);
  // Filtro atual para exibição de tickets ('TODOS', 'CRITICO', 'AVISO')
  const [filtroRisco, setFiltroRisco] = useState('TODOS'); 

  // Funções Callback para os Cards renderizados (garantindo estabilidade de referência na árvore react)
  const abrirChatInterno = useCallback((notif) => { setChatAtivo(notif); }, []);
  const handleResolve = useCallback((id) => { pedirNotaResolucao(id); }, [pedirNotaResolucao]);

  // Cálculo da pontuação de Saúde do sistema (SLA de uptime de equipamento x total de rede)
  const saudeRede = useMemo(() => {
    if (!qtdTotal || qtdTotal === 0) return { score: 100, status: 'ESTÁVEL', class: 'stable' };
    const score = Math.round((qtdOperando / qtdTotal) * 100);
    // Categorização visual dependendo da porcentagem atingida
    if (score < 80) return { score, status: 'CRÍTICO', class: 'critical' };
    if (score < 95) return { score, status: 'ATENÇÃO', class: 'warning' };
    return { score, status: 'ESTÁVEL', class: 'stable' };
  }, [qtdTotal, qtdOperando]);

  // Recria os alertas exibidos baseados nos botões de filtro clicados pelo usuário
  const alertasExibidos = useMemo(() => {
    if (!notificacoesDaFilial) return [];
    if (filtroRisco === 'TODOS') return notificacoesDaFilial;
    return notificacoesDaFilial.filter(n => {
      // Regra de Negócio: Alguns tipos de alerta são definidos como Hard Critical
      const isCritical = n.tipo_alerta === 'MECANICA' || n.tipo_alerta === 'PORTA' || n.tipo_alerta === 'TEMPERATURA';
      return filtroRisco === 'CRITICO' ? isCritical : !isCritical;
    });
  }, [notificacoesDaFilial, filtroRisco]);

  // Paleta de Cores para injeção no Objeto do Gráfico de Rosca (Donut)
  const DONUT_COLORS = {
    'Ok': '#10b981',      
    'Degelo': '#38bdf8',  
    'Falha': '#ef4444'    
  };

  const temDadosDonut = dadosDonutStatus && dadosDonutStatus.length > 0;
  const dadosPlaceholder = [{ name: 'Aguardando Dados', value: 1 }]; // Fallback visual

  return (
    <div className="anim-fade-in dashboard-container">
      
      {/* 1. HEALTH BANNER SUPERIOR */}
      <div className={`health-banner ${saudeRede.class} stagger-1`}>
        <div className="health-info">
          <Zap size={32} className="health-icon" />
          <div>
            <h4>Índice de integridade do sistema</h4>
            <p>Estado Operacional: <strong>{saudeRede.status}</strong></p>
          </div>
        </div>
        
        <div className="health-secondary-stats">
          <div className="sla-stat">
            <span className="sla-label">SLA GARANTIDO</span>
            <span className="sla-value">99.98%</span>
          </div>
          <div className="sla-stat">
            <span className="sla-label">SENSORES ATIVOS</span>
            <span className="sla-value">{qtdTotal} NÓS</span>
          </div>
        </div>

        {/* Barra de Progresso indicando Score Real */}
        <div className="health-score-area">
          <span className="health-score">{saudeRede.score}%</span>
          <div className="health-progress-bg">
            <div className="health-progress-fill" style={{ width: `${saudeRede.score}%` }}></div>
          </div>
        </div>
      </div>

      {/* 2. GRID CONTENDO OS KPIs (Esquerda) E O GRÁFICO (Direita) */}
      <div className="dashboard-grid stagger-2">
        <div className="summary-cards">
          <StatCard title="Máquinas na Rede" value={qtdTotal} icon={Server} iconBg="icon-bg-gray" />
          <StatCard title="Operação Segura" value={qtdOperando} icon={Activity} iconBg="icon-bg-green" valClass="val-green" />
          <StatCard title="Ciclos de Degelo" value={qtdDegelo} icon={ThermometerSnowflake} iconBg="icon-bg-blue" valClass="val-blue" />
          <StatCard title="Ocorrências Críticas" value={qtdFalha} icon={AlertOctagon} iconBg="icon-bg-red" valClass="val-red" isPulsing={qtdFalha > 0} />
        </div>

        <div className="donut-container">
          <span className="donut-title">Distribuição de Carga</span>
          <div style={{ width: '100%', height: '240px', minHeight: '240px', position: 'relative', marginTop: '10px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {/* Lógica ternária que troca o gráfico por uma visualização cinza caso não haja dados na array */}
                {temDadosDonut ? (
                  <>
                    <Pie 
                      data={dadosDonutStatus} 
                      cx="50%" cy="50%" 
                      innerRadius={60} 
                      outerRadius={80} 
                      paddingAngle={5} 
                      dataKey="value" 
                      nameKey="name"
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {dadosDonutStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} isAnimationActive={false} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.85rem', fontWeight: '600', paddingBottom: '10px' }}/>
                  </>
                ) : (
                  <>
                    <Pie 
                      data={dadosPlaceholder} 
                      cx="50%" cy="50%"
                      innerRadius={60} 
                      outerRadius={80} 
                      dataKey="value" 
                      nameKey="name"
                      stroke="none"
                      fill={isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}
                      isAnimationActive={false}
                    />
                    <Tooltip content={<EmptyTooltip />} isAnimationActive={false} />
                  </>
                )}
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. ÁREA DE TRIAGEM (BARRA DE FILTROS DE INCIDENTES) */}
      <div className="flex-header stagger-3" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
        <h3 className="section-title">Monitor de Incidentes Ativos</h3>
        
        <div className="triage-actions">
          {notificacoesDaFilial?.length > 0 && (
            <div className="triage-filters">
              <button className={`btn-filter ${filtroRisco === 'TODOS' ? 'active' : ''}`} onClick={() => setFiltroRisco('TODOS')}>Todos</button>
              <button className={`btn-filter critical ${filtroRisco === 'CRITICO' ? 'active' : ''}`} onClick={() => setFiltroRisco('CRITICO')}>Críticos</button>
              <button className={`btn-filter warning ${filtroRisco === 'AVISO' ? 'active' : ''}`} onClick={() => setFiltroRisco('AVISO')}>Avisos</button>
            </div>
          )}

          {/* Opção Rápida para despachar (normalizar) todas as notificações caso o Admin precise */}
          {notificacoesDaFilial?.length > 0 && (
            <button className="btn btn-outline btn-archive" onClick={resolverTodasNotificacoes} disabled={isOffline}>
              <CheckCircle size={18} /> Normalizar Todos
            </button>
          )}
        </div>
      </div>
      
      {/* 4. RENDERIZAÇÃO DA GRADE DE TICKETS OU DO RADAR VAZIO (EMPTY STATE) */}
      {!alertasExibidos?.length ? (
        <div className="empty-state dashboard-empty stagger-3">
          <div className="radar-box">
             <div className="radar-scanner"></div>
             <div className="radar-blip blip-1"></div>
             <div className="radar-blip blip-2"></div>
             <div className="radar-blip blip-3"></div>
             <Radio size={40} className="radar-icon" color="var(--success)" />
          </div>
          <h3 className="empty-title">Nenhuma Ocorrência Detectada</h3>
          <p className="empty-subtitle">
            {filtroRisco === 'TODOS' ? 'O radar não detecta anomalias térmicas ou mecânicas. A infraestrutura encontra-se operacional e dentro das métricas.' : 'Não existem ocorrências ativas para o filtro de risco selecionado.'}
          </p>
        </div>
      ) : (
        <div className="grid-cards stagger-3">
          {alertasExibidos.map(notif => (
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

      {/* 5. RODAPÉ NOC (LIVE TICKER SIMULANDO LOGS ENTRANTES) */}
      <div className="noc-ticker-wrap stagger-4">
        <div className="noc-ticker-label">LATEST EVENTS</div>
        <div className="noc-ticker">
          <div className="ticker-content">
            {/* Duplica a renderização de strings de logs na div para emular um looping contínuo sem quebras no CSS */}
            {notificacoesDaFilial.length > 0 ? (
              notificacoesDaFilial.map((n, i) => (
                <span key={i} className={`ticker-item ${n.tipo_alerta === 'MECANICA' || n.tipo_alerta === 'PORTA' || n.tipo_alerta === 'TEMPERATURA' ? 'ticker-critical' : 'ticker-warning'}`}>
                  [{new Date(n.data_hora).toLocaleTimeString()}] {n.filial.toUpperCase()} - {n.equipamento_nome.toUpperCase()}: {n.mensagem.toUpperCase()}
                </span>
              ))
            ) : (
              <span className="ticker-item ticker-success">SISTEMA 100% OPERACIONAL - NENHUMA OCORRÊNCIA REGISTRADA NA REDE - MONITORAMENTO DE SENSOR ATIVO</span>
            )}
             {notificacoesDaFilial.length > 0 ? (
              notificacoesDaFilial.map((n, i) => (
                <span key={`dup-${i}`} className={`ticker-item ${n.tipo_alerta === 'MECANICA' || n.tipo_alerta === 'PORTA' || n.tipo_alerta === 'TEMPERATURA' ? 'ticker-critical' : 'ticker-warning'}`}>
                  [{new Date(n.data_hora).toLocaleTimeString()}] {n.filial.toUpperCase()} - {n.equipamento_nome.toUpperCase()}: {n.mensagem.toUpperCase()}
                </span>
              ))
            ) : (
              <span className="ticker-item ticker-success">SISTEMA 100% OPERACIONAL - NENHUMA OCORRÊNCIA REGISTRADA NA REDE - MONITORAMENTO DE SENSOR ATIVO</span>
            )}
          </div>
        </div>
      </div>

      {/* 6. ABRIR GAVETA DE CHAT (Renderização Condicional Baseada no State chatAtivo) */}
      {chatAtivo && (
        <ChatDrawer 
          notif={chatAtivo} 
          onClose={() => setChatAtivo(null)} 
          contatosDb={contatosDb} irParaChat={irParaChat} showToast={showToast}
          socket={socket} userId={userId} nomeLogado={nomeLogado} setHistoricoChat={setHistoricoChat}
        />
      )}
    </div>
  );
}

// ============================================================================
// COMPONENTE OTIMIZADO (MEMO): CARTÃO DE INCIDENTE/ALERTA
// Estrutura independente renderizada dentro do "Alertas Exibidos" que
// previne reinicializações gráficas excessivas no Scroll da Grade.
// ============================================================================
const AlertCard = memo(({ notif, onResolve, onAbrirChat, isOffline }) => {
  // Pega o dicionário de cores, botões e icones de acordo com a falha
  const tipo = getAlertConfig(notif.tipo_alerta);
  const IconCmp = tipo.icon;

  return (
    <div className={`card card-alert ${tipo.critical ? 'critical-alert' : ''}`} style={{ '--alert-color': tipo.color }}>
      <div className="card-top">
        <div className="alert-title-group">
          <div className="alert-icon-box">
            <IconCmp size={20} color={tipo.color} />
          </div>
          <div className="alert-equip-info">
            <span className="alert-equip-name">{notif.equipamento_nome}</span>
            <div className="badges-container">
              <span className="badge-setor">{notif.setor}</span>
              <span className="badge-setor">{notif.filial}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="alert-body">
        <p className="alert-msg">{notif.mensagem}</p>
        <span className="time-badge">
          <Clock size={12} />
          {new Date(notif.data_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </span>
      </div>
      
      <div className="alert-actions">
        <button 
          className="btn btn-alert-action flex-1" 
          onClick={() => onResolve(notif.id)} 
          disabled={isOffline} 
          style={{ backgroundColor: tipo.color }}
        >
          {tipo.action}
        </button>
        {/* Caso a gravidade seja crítica, destrava o botão balão de atalho para escalonamento tático (Drawer) */}
        {tipo.critical && (
          <button className="btn btn-chat-internal" onClick={() => onAbrirChat(notif)} title="Escalar problema para a Equipe Técnica">
            <MessageSquare size={18} />
          </button>
        )}
      </div>
    </div>
  );
});