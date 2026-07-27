import React, { useMemo } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, Cpu, FileText,
  MessageSquare, ShieldCheck, Sparkles, Thermometer, Wrench, WifiOff,
  Terminal, Lock, Bot
} from 'lucide-react';
import './CentroComando.css';

// Ações agora contêm uma matriz de permissão (roles)
const quickActions = [
  {
    id: 'dashboard',
    title: 'Painel Executivo',
    description: 'Resumo visual da rede, saúde e alertas críticos.',
    icon: Activity,
    accent: 'teal',
    roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV']
  },
  {
    id: 'motores',
    title: 'Monitoramento Térmico',
    description: 'Acompanhe limites, desvios e ciclos de degelo.',
    icon: Thermometer,
    accent: 'blue',
    roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV']
  },
  {
    id: 'equipamentos',
    title: 'Inventário e Metrologia',
    description: 'Gerencie ativos, calibração e SLA de manutenção.',
    icon: Cpu,
    accent: 'violet',
    roles: ['ADMIN', 'MANUTENCAO', 'DEV']
  },
  {
    id: 'chamados',
    title: 'Central de Incidentes',
    description: 'Abertura, intervenção e acompanhamento de OS.',
    icon: Wrench,
    accent: 'orange',
    roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV']
  },
  {
    id: 'chat',
    title: 'Comunicação (NOC)',
    description: 'Escale incidentes rapidamente para a equipe interna.',
    icon: MessageSquare,
    accent: 'cyan',
    roles: ['ADMIN', 'LOJA', 'MANUTENCAO', 'DEV']
  },
  {
    id: 'dev_panel',
    title: 'Cyber Command (Root)',
    description: 'Engenharia de caos, infraestrutura e mitigação WAF.',
    icon: Terminal,
    accent: 'danger',
    roles: ['DEV']
  }
];

export default function CentroComando({
  onNavigate,
  qtdTotal = 0,
  qtdOperando = 0,
  qtdDegelo = 0,
  qtdFalha = 0,
  notificacoesDaFilial = [],
  chamados = [],
  equipamentosDaFilial = [],
  isOffline = false,
  userRole = 'LOJA',
  filialAtiva = 'Todas'
}) {

  // Função auxiliar de Segurança
  const hasPermission = (allowedRoles) => allowedRoles.includes(userRole);

  const alertasCriticos = useMemo(() =>
    notificacoesDaFilial.filter((n) => ['MECANICA', 'PORTA', 'TEMPERATURA', 'REDE', 'METROLOGIA'].includes(n.tipo_alerta)).length,
    [notificacoesDaFilial]
  );

  const chamadosPendentes = useMemo(() =>
    chamados.filter((c) => !['Concluído', 'Fechado'].includes(c.status)).length,
    [chamados]
  );

  const ativosEmRisco = useMemo(() =>
    equipamentosDaFilial.filter((eq) => eq.em_degelo || !eq.motor_ligado || !eq.ultima_temp || !eq.ultima_umidade).length,
    [equipamentosDaFilial]
  );

  const saudeGeral = useMemo(() => {
    if (!qtdTotal) return { score: 100, etiqueta: 'PRONTO PARA OPERAR' };
    const score = Math.max(0, Math.min(100, Math.round((qtdOperando / qtdTotal) * 100)));
    if (score < 80) return { score, etiqueta: 'ATENÇÃO CRÍTICA' };
    if (score < 95) return { score, etiqueta: 'ALERTA DE OBSERVAÇÃO' };
    return { score, etiqueta: 'OPERAÇÃO ESTÁVEL' };
  }, [qtdOperando, qtdTotal]);

  const recomendacoes = [
    {
      title: 'Prioridade de Resposta',
      text: alertasCriticos > 0
        ? `${alertasCriticos} alertas críticos exigem intervenção imediata da equipe.`
        : 'O radar está limpo. O ambiente opera sem anomalias críticas.',
      icon: AlertTriangle,
      tone: alertasCriticos > 0 ? 'danger' : 'success'
    },
    {
      title: 'Trabalho de Manutenção',
      text: chamadosPendentes > 0
        ? `${chamadosPendentes} ordens de serviço (OS) aguardam encerramento no painel.`
        : 'Não há operações corretivas ou preventivas pendentes na fila.',
      icon: Wrench,
      tone: chamadosPendentes > 0 ? 'warning' : 'success'
    },
    {
      title: 'Cobertura de Ativos',
      text: ativosEmRisco > 0
        ? `${ativosEmRisco} ativos registram desvios térmicos ou mecânicos e precisam de revisão.`
        : 'Todos os ativos monitorados estão perfeitamente alinhados ao plano operacional.',
      icon: ShieldCheck,
      tone: ativosEmRisco > 0 ? 'warning' : 'success'
    }
  ];

  return (
    <div className="centro-comando">
      <section className="hero-card">
        <div className="hero-copy">
          <div className="hero-badge">
            <Sparkles size={16} />
            Centro de Comando Operacional
          </div>
          <h3>Visão unificada. Resposta tática.</h3>
          <p>
            Este painel reúne a saúde da rede, os incidentes ativos, a fila de manutenção e os próximos passos em um único ponto de controle avançado.
          </p>
          
          {/* Integração Inteligente baseada no contexto */}
          <div className="ai-insight-box">
            <div className="ai-header"><Bot size={16}/> Copilot AI - Análise Contínua</div>
            <p>A inteligência artificial verificou que a telemetria da Loja Tupã e o fluxo central operam dentro da margem de segurança. Os compressores mantêm eficiência térmica adequada.</p>
          </div>

          <div className="hero-meta">
            <span><Activity size={14} color="var(--secondary)" /> Escopo: {filialAtiva === 'Todas' ? 'Visão Global' : filialAtiva}</span>
            <span><Clock3 size={14} color="var(--warning)" /> Permissão: {userRole}</span>
            <span><ShieldCheck size={14} color={isOffline ? 'var(--danger)' : 'var(--success)'} /> Link: {isOffline ? 'OFFLINE' : 'ONLINE'}</span>
          </div>
        </div>

        <div className="hero-metric">
          <div className="hero-score-label">Índice de Saúde (SLA)</div>
          <div className="hero-score">{saudeGeral.score}%</div>
          <div className="hero-progress">
            <div className="hero-progress-fill" style={{ width: `${saudeGeral.score}%` }} />
          </div>
          <div className="hero-footer">
            <span>{qtdTotal} Ativos Monitorados</span>
            <span style={{color: 'var(--text-main)'}}>{saudeGeral.etiqueta}</span>
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card success">
          <div className="kpi-icon"><CheckCircle2 size={22} /></div>
          <div>
            <strong>{qtdOperando}</strong>
            <span>Ativos OK</span>
          </div>
        </article>
        <article className="kpi-card info">
          <div className="kpi-icon"><Thermometer size={22} /></div>
          <div>
            <strong>{qtdDegelo}</strong>
            <span>Em Degelo</span>
          </div>
        </article>
        <article className="kpi-card danger">
          <div className="kpi-icon"><AlertTriangle size={22} /></div>
          <div>
            <strong>{qtdFalha}</strong>
            <span>Ocorrências</span>
          </div>
        </article>
        <article className="kpi-card warning">
          <div className="kpi-icon"><WifiOff size={22} /></div>
          <div>
            <strong>{isOffline ? 'DOWN' : 'UP'}</strong>
            <span>Conexão</span>
          </div>
        </article>
      </section>

      <section className="section-card">
        <div className="section-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div>
            <h4>Ações Táticas Rápidas</h4>
            <p>Acesso direto aos módulos operacionais do sistema.</p>
          </div>
        </div>
        
        <div className="action-grid">
          {quickActions.map((action) => {
            const isAllowed = hasPermission(action.roles);
            const Icon = action.icon;
            
            return (
              <button 
                key={action.id} 
                className={`action-card ${action.accent} ${!isAllowed ? 'locked' : ''}`} 
                onClick={() => isAllowed && onNavigate?.(action.id)}
                disabled={!isAllowed}
              >
                <div className="action-icon">
                  {isAllowed ? <Icon size={20} /> : <Lock size={20} color="var(--text-muted)" />}
                </div>
                <div className="action-copy">
                  <strong>{action.title}</strong>
                  <span>{isAllowed ? action.description : 'Acesso restrito pelo administrador.'}</span>
                </div>
                {isAllowed && <ArrowRight size={16} color="var(--text-muted)" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="content-grid">
        <article className="section-card">
          <div className="section-header">
            <div>
              <h4>Próximos Passos</h4>
              <p>Checklist operacional com foco em segurança.</p>
            </div>
          </div>
          <div className="checklist">
            {recomendacoes.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className={`check-item ${item.tone}`}>
                  <div className="check-icon">
                    <Icon size={18} color={`var(--${item.tone})`} />
                  </div>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="section-card">
          <div className="section-header">
            <div>
              <h4>Incidentes Recentes</h4>
              <p>Ocorrências que merecem investigação prioritária.</p>
            </div>
          </div>
          <div className="incident-list">
            {notificacoesDaFilial.length === 0 ? (
              <div className="empty-state-card">
                <CheckCircle2 size={24} />
                <span>Nenhuma anomalia crítica foi registrada no histórico recente do log.</span>
              </div>
            ) : (
              notificacoesDaFilial.slice(0, 4).map((item) => (
                <div key={item.id} className="incident-item">
                  <strong>
                    {item.equipamento_nome}
                    <small>{new Date(item.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                  </strong>
                  <span>{item.mensagem}</span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}