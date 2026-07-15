import React, { useMemo } from 'react';
import {
  ClipboardCheck, AlertTriangle, CheckCircle2, Clock3, MessageSquare,
  ShieldCheck, Sparkles, Thermometer, Wrench, ShieldAlert, ThermometerSnowflake,
  Cpu, Activity, ArrowRight, Zap, Target
} from 'lucide-react';
import './AssistenteOperacao.css';

export default function AssistenteOperacao({
  equipamentosDaFilial = [],
  notificacoesDaFilial = [],
  chamados = [],
  userRole = 'LOJA',
  filialAtiva = 'Todas',
  onNavigate // Nova prop (opcional) para criar atalhos na tela
}) {
  
  // 1. Processamento de Dados em Tempo Real
  const { equipamentosEmRisco, alertasCriticos, chamadosPendentes, healthScore } = useMemo(() => {
    const equipRisco = equipamentosDaFilial.filter((eq) => eq.em_degelo || !eq.motor_ligado || !eq.ultima_temp || !eq.ultima_umidade).length;
    const criticos = notificacoesDaFilial.filter((n) => ['MECANICA', 'PORTA', 'TEMPERATURA', 'REDE', 'METROLOGIA'].includes(n.tipo_alerta)).length;
    const pendentes = chamados.filter((c) => !['Concluído', 'Fechado'].includes(c.status)).length;

    // Cálculo do Health Score da Operação
    let score = 100 - (criticos * 15) - (equipRisco * 5) - (pendentes * 3);
    if (score < 0) score = 0;

    return { equipamentosEmRisco: equipRisco, alertasCriticos: criticos, chamadosPendentes: pendentes, healthScore: score };
  }, [equipamentosDaFilial, notificacoesDaFilial, chamados]);

  const scoreColor = healthScore >= 90 ? '#10b981' : healthScore >= 70 ? '#f59e0b' : '#ef4444';

  // 2. Diagnóstico Atual (Cards Superiores com Ações)
  const checklist = useMemo(() => {
    return [
      {
        title: 'Estabilidade dos Ativos',
        description: equipamentosEmRisco > 0 ? `${equipamentosEmRisco} equipamentos fora do ciclo ideal térmico.` : 'Todos os ativos em operação normalizada.',
        status: equipamentosEmRisco > 0 ? 'Atenção' : 'Estável',
        icon: Activity,
        tone: equipamentosEmRisco > 0 ? 'warning' : 'success',
        color: equipamentosEmRisco > 0 ? '#f59e0b' : '#10b981',
        actionLabel: 'Ver Mapa Térmico',
        actionTarget: 'motores'
      },
      {
        title: 'Radar de Ocorrências',
        description: alertasCriticos > 0 ? `${alertasCriticos} alertas críticos exigem intervenção manual.` : 'Radar NOC limpo. Sem anomalias críticas.',
        status: alertasCriticos > 0 ? 'Crítico' : 'Limpo',
        icon: ShieldCheck,
        tone: alertasCriticos > 0 ? 'danger' : 'success',
        color: alertasCriticos > 0 ? '#ef4444' : '#10b981',
        actionLabel: 'Abrir Painel NOC',
        actionTarget: 'dashboard'
      },
      {
        title: 'Ordens de Serviço (OS)',
        description: chamadosPendentes > 0 ? `${chamadosPendentes} ordens ativas no fluxo ITSM da manutenção.` : 'Backlog técnico de manutenção zerado.',
        status: chamadosPendentes > 0 ? 'Backlog' : 'Resolvido',
        icon: Wrench,
        tone: chamadosPendentes > 0 ? 'warning' : 'success',
        color: chamadosPendentes > 0 ? '#f59e0b' : '#10b981',
        actionLabel: 'Acessar Kanban',
        actionTarget: 'kanban'
      }
    ];
  }, [equipamentosEmRisco, alertasCriticos, chamadosPendentes]);

  // 3. Motor de Recomendação Dinâmica Tática (I.A. Copilot)
  const aiRecommendation = useMemo(() => {
    if (alertasCriticos > 0) {
      return {
        title: "Risco de Quebra Térmica Iminente",
        text: `O radar identificou ${alertasCriticos} alertas críticos. A ação mandatória do turno é normalizar estes ativos imediatamente para evitar a quebra térmica da mercadoria e perda financeira.`,
        icon: ShieldAlert,
        color: '#ef4444',
        border: 'rgba(239, 68, 68, 0.5)',
        btnLabel: 'RESOLVER ANOMALIAS AGORA',
        btnTarget: 'dashboard'
      };
    } else if (equipamentosEmRisco > 0) {
      return {
        title: "Acompanhamento de Ciclos (Preventiva)",
        text: `O sistema não regista falhas, mas ${equipamentosEmRisco} ativos encontram-se em ciclo de degelo ou com os motores parados. Mantenha vigilância até que retornem ao *setpoint* térmico.`,
        icon: ThermometerSnowflake,
        color: '#f59e0b',
        border: 'rgba(245, 158, 11, 0.5)',
        btnLabel: 'ACOMPANHAR SENSORES IOT',
        btnTarget: 'motores'
      };
    } else if (chamadosPendentes > 0) {
      return {
        title: "Otimização de Backlog Técnico",
        text: `A operação frigorífica está 100% estabilizada. Utilize a janela de oportunidade deste turno para auxiliar a equipa técnica a encerrar as ${chamadosPendentes} ordens de serviço pendentes.`,
        icon: Wrench,
        color: '#38bdf8',
        border: 'rgba(56, 189, 248, 0.5)',
        btnLabel: 'GERENCIAR ORDENS (ITSM)',
        btnTarget: 'kanban'
      };
    } else {
      return {
        title: "Operação Operando em Excelência",
        text: "Todos os indicadores estão perfeitamente calibrados e em conformidade com as diretrizes da engenharia. Inicie o checklist diário de rotina e as rondas físicas.",
        icon: CheckCircle2,
        color: '#10b981',
        border: 'rgba(16, 185, 129, 0.5)',
        btnLabel: 'INICIAR PLANO DO DIA',
        btnTarget: 'plano_dia'
      };
    }
  }, [alertasCriticos, equipamentosEmRisco, chamadosPendentes]);

  const orientacoesSOP = [
    {
      title: 'Auditoria Visual Contínua (Rondas)',
      text: 'A telemetria não substitui a supervisão humana. Confirme fisicamente o estado das portas, cortinas noturnas e gelo excessivo nos evaporadores.',
      icon: Target
    },
    {
      title: 'Registo Oficial de Ocorrências',
      text: 'Utilize o Chat Operacional da plataforma para registar anomalias elétricas ou de hardware. O histórico auditável protege a operação de loja.',
      icon: MessageSquare
    },
    {
      title: 'Disciplina & Execução de Metas',
      text: 'Complete integralmente o Plano do Dia e o Checklist de Turno do sistema. Estes dados provam a conformidade operacional da filial perante a matriz.',
      icon: ClipboardCheck
    }
  ];

  // Handler para atalhos (Se onNavigate não existir via prop, cria um fallback visual)
  const handleNav = (targetId) => {
    if (onNavigate) {
      onNavigate(targetId);
    } else {
      // Tenta simular o clique caso onNavigate não seja passado diretamente (Opcional, depende de como a sua App lida)
      console.log('Navegar para:', targetId);
    }
  };

  return (
    <div className="assistente-operacao anim-fade-in">
      <section className="hero-assistente">
        <div>
          <div className="hero-badge-assistente">
            <Sparkles size={14} /> Motor de Inferência TermoSync
          </div>
          <h3>Copiloto de Decisão Tática</h3>
          <p>
            Análise computacional em tempo real baseada na rede de telemetria da unidade. Siga as recomendações de ação direta para garantir a conformidade.
          </p>
        </div>
        <div className="hero-summary">
          <span>{filialAtiva === 'Todas' ? 'Visão: Matriz Global' : `Visão Local: ${filialAtiva}`}</span>
          <span className="ia-badge-pulse" style={{ paddingLeft: '20px' }}>
            <Cpu size={14} color="#38bdf8"/> I.A. Analítica Ativa
          </span>
          <span><ShieldCheck size={14} color={scoreColor}/> Health Score: {healthScore}%</span>
        </div>
      </section>

      <section className="checklist-grid">
        {checklist.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className={`check-item-card ${item.tone}`}>
              <div className="check-item-head">
                <div className="check-icon-assistente">
                  <Icon size={20} color={item.color}/>
                </div>
                <span>{item.status}</span>
              </div>
              <h4>{item.title}</h4>
              <p>{item.description}</p>
              
              <button 
                className="btn-assist-action" 
                onClick={() => handleNav(item.actionTarget)}
                title={`Ir para ${item.actionLabel}`}
              >
                {item.actionLabel} <ArrowRight size={14} />
              </button>
            </article>
          );
        })}
      </section>

      <section className="content-assistente-grid">
        
        {/* Recomendação Dinâmica Tática da I.A. */}
        <article className="section-card-assistente" style={{ padding: 0, background: 'transparent', border: 'none' }}>
          <div className="next-step-card" style={{ borderColor: aiRecommendation.border }}>
            <div className="ai-header">
              <div className="ai-icon-wrapper" style={{ background: `color-mix(in srgb, ${aiRecommendation.color} 20%, transparent)` }}>
                <aiRecommendation.icon size={28} color={aiRecommendation.color} />
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#cbd5e1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Comando Recomendado (I.A.)</span>
                <strong style={{ color: aiRecommendation.color, fontSize: '1.25rem', display: 'block' }}>{aiRecommendation.title}</strong>
              </div>
            </div>
            
            <div className="ai-content">
              <p>{aiRecommendation.text}</p>
            </div>

            <div className="ai-action-footer">
              <button 
                className="btn-ai-execute" 
                onClick={() => handleNav(aiRecommendation.btnTarget)}
                style={{ background: aiRecommendation.color, color: (aiRecommendation.color === '#10b981' || aiRecommendation.color === '#f59e0b' || aiRecommendation.color === '#38bdf8') ? '#020617' : 'white' }}
              >
                <Zap size={18} fill="currentColor" /> {aiRecommendation.btnLabel}
              </button>
            </div>

            <div className="health-score-container">
              <div className="health-score-header">
                <span>Índice de Saúde Operacional da Filial</span>
                <span style={{ color: scoreColor }}>{healthScore}%</span>
              </div>
              <div className="health-bar-bg">
                <div className="health-bar-fill" style={{ width: `${healthScore}%`, background: scoreColor, boxShadow: `0 0 15px ${scoreColor}` }} />
              </div>
            </div>
          </div>
        </article>

        {/* Standard Operating Procedures (SOPs) */}
        <article className="section-card-assistente">
          <div className="section-header-assistente">
            <h4>Protocolos Standard (SOP)</h4>
            <p>Procedimentos físicos exigidos pela Governança Corporativa.</p>
          </div>
          <div className="orientacoes-list">
            {orientacoesSOP.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="orientacao-item">
                  <div className="orientacao-icon">
                    <Icon size={20} />
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

      </section>
    </div>
  );
}