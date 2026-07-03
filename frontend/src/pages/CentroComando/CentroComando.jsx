import React, { useMemo } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, Cpu, FileText,
  MessageSquare, ShieldCheck, Sparkles, Thermometer, Wrench, WifiOff
} from 'lucide-react';
import './CentroComando.css';

const quickActions = [
  {
    id: 'dashboard',
    title: 'Painel executivo',
    description: 'Resumo visual da rede, saúde e alertas críticos.',
    icon: Activity,
    accent: 'teal'
  },
  {
    id: 'motores',
    title: 'Monitoramento térmico',
    description: 'Acompanhe limites, desvios e ciclos de degelo.',
    icon: Thermometer,
    accent: 'blue'
  },
  {
    id: 'equipamentos',
    title: 'Inventário e metrologia',
    description: 'Gerencie ativos, calibração e SLA de manutenção.',
    icon: Cpu,
    accent: 'violet'
  },
  {
    id: 'chamados',
    title: 'Chamados e ordens',
    description: 'Centralize incidentes, intervenção e acompanhamento.',
    icon: Wrench,
    accent: 'orange'
  },
  {
    id: 'chat',
    title: 'Comunicação operacional',
    description: 'Escale incidentes rapidamente para a equipe.',
    icon: MessageSquare,
    accent: 'cyan'
  },
  {
    id: 'relatorios',
    title: 'Relatórios e auditoria',
    description: 'Gere histórico, exportações e performance do turno.',
    icon: FileText,
    accent: 'green'
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
    if (!qtdTotal) return { score: 100, etiqueta: 'Pronto para operar' };
    const score = Math.max(0, Math.min(100, Math.round((qtdOperando / qtdTotal) * 100)));
    if (score < 80) return { score, etiqueta: 'Atenção crítica' };
    if (score < 95) return { score, etiqueta: 'Operação com observação' };
    return { score, etiqueta: 'Operação estável' };
  }, [qtdOperando, qtdTotal]);

  const recomendacoes = [
    {
      title: 'Prioridade de resposta',
      text: alertasCriticos > 0
        ? `${alertasCriticos} alertas críticos exigem atenção imediata.`
        : 'O radar está limpo. Mantenha a rotina de verificação.',
      icon: AlertTriangle,
      tone: alertasCriticos > 0 ? 'danger' : 'success'
    },
    {
      title: 'Trabalho de manutenção',
      text: chamadosPendentes > 0
        ? `${chamadosPendentes} ordens ainda aguardam encerramento.`
        : 'Não há operações pendentes no momento.',
      icon: Wrench,
      tone: chamadosPendentes > 0 ? 'warning' : 'success'
    },
    {
      title: 'Cobertura de ativos',
      text: ativosEmRisco > 0
        ? `${ativosEmRisco} ativos precisam revisão rápida.`
        : 'Todos os ativos monitorados estão dentro do plano operacional.',
      icon: ShieldCheck,
      tone: ativosEmRisco > 0 ? 'warning' : 'success'
    }
  ];

  return (
    <div className="centro-comando anim-fade-in">
      <section className="hero-card">
        <div className="hero-copy">
          <div className="hero-badge">
            <Sparkles size={16} />
            Centro de Comando Operacional
          </div>
          <h3>Visão unificada da operação, pronta para decisões rápidas.</h3>
          <p>
            Este painel reúne saúde da rede, incidentes ativos, manutenção e próximos passos em um único ponto de controle.
            Ele foi criado para complementar as telas existentes, sem substituir o fluxo atual de cada módulo.
          </p>
          <div className="hero-meta">
            <span><Activity size={14} /> {filialAtiva === 'Todas' ? 'Visão global' : filialAtiva}</span>
            <span><Clock3 size={14} /> {userRole === 'LOJA' ? 'Operação local' : 'Gestão centralizada'}</span>
            <span><ShieldCheck size={14} /> {isOffline ? 'Conexão instável' : 'Telemetria ativa'}</span>
          </div>
        </div>

        <div className="hero-metric">
          <div className="hero-score">{saudeGeral.score}%</div>
          <div className="hero-score-label">{saudeGeral.etiqueta}</div>
          <div className="hero-progress">
            <div className="hero-progress-fill" style={{ width: `${saudeGeral.score}%` }} />
          </div>
          <div className="hero-footer">
            <span>{qtdTotal} ativos monitorados</span>
            <span>{qtdOperando} operando</span>
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card success">
          <div className="kpi-icon"><CheckCircle2 size={20} /></div>
          <div>
            <strong>{qtdOperando}</strong>
            <span>Operando normalmente</span>
          </div>
        </article>
        <article className="kpi-card info">
          <div className="kpi-icon"><Thermometer size={20} /></div>
          <div>
            <strong>{qtdDegelo}</strong>
            <span>Em ciclo de degelo</span>
          </div>
        </article>
        <article className="kpi-card danger">
          <div className="kpi-icon"><AlertTriangle size={20} /></div>
          <div>
            <strong>{qtdFalha}</strong>
            <span>Ocorrências críticas</span>
          </div>
        </article>
        <article className="kpi-card warning">
          <div className="kpi-icon"><WifiOff size={20} /></div>
          <div>
            <strong>{isOffline ? 'Offline' : 'Online'}</strong>
            <span>Status de rede</span>
          </div>
        </article>
      </section>

      <section className="section-card">
        <div className="section-header">
          <h4>Ações rápidas</h4>
          <p>Atalhos para os pontos mais usados da operação.</p>
        </div>
        <div className="action-grid">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.id} className={`action-card ${action.accent}`} onClick={() => onNavigate?.(action.id)}>
                <div className="action-icon">
                  <Icon size={18} />
                </div>
                <div className="action-copy">
                  <strong>{action.title}</strong>
                  <span>{action.description}</span>
                </div>
                <ArrowRight size={16} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="content-grid">
        <article className="section-card">
          <div className="section-header">
            <h4>Próximos passos</h4>
            <p>Checklist operacional com foco em segurança e continuidade.</p>
          </div>
          <div className="checklist">
            {recomendacoes.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className={`check-item ${item.tone}`}>
                  <div className="check-icon">
                    <Icon size={16} />
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
            <h4>Incidentes recentes</h4>
            <p>Resumo do que merece atenção neste momento.</p>
          </div>
          <div className="incident-list">
            {notificacoesDaFilial.length === 0 ? (
              <div className="empty-state-card">
                <CheckCircle2 size={18} />
                <span>Nenhuma anomalia recente registrada para esta visão.</span>
              </div>
            ) : (
              notificacoesDaFilial.slice(0, 4).map((item) => (
                <div key={item.id} className="incident-item">
                  <strong>{item.equipamento_nome}</strong>
                  <span>{item.mensagem}</span>
                  <small>{new Date(item.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
