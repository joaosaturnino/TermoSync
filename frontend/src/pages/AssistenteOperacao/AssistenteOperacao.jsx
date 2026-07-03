import React, { useMemo } from 'react';
import {
  ClipboardCheck, AlertTriangle, CheckCircle2, Clock3, MessageSquare,
  ShieldCheck, Sparkles, Thermometer, Wrench
} from 'lucide-react';
import './AssistenteOperacao.css';

export default function AssistenteOperacao({
  equipamentosDaFilial = [],
  notificacoesDaFilial = [],
  chamados = [],
  userRole = 'LOJA',
  filialAtiva = 'Todas'
}) {
  const checklist = useMemo(() => {
    const equipamentosEmRisco = equipamentosDaFilial.filter((eq) => eq.em_degelo || !eq.motor_ligado || !eq.ultima_temp || !eq.ultima_umidade).length;
    const alertasCriticos = notificacoesDaFilial.filter((n) => ['MECANICA', 'PORTA', 'TEMPERATURA', 'REDE', 'METROLOGIA'].includes(n.tipo_alerta)).length;
    const chamadosPendentes = chamados.filter((c) => !['Concluído', 'Fechado'].includes(c.status)).length;

    return [
      {
        title: 'Verificar ativos críticos',
        description: equipamentosEmRisco > 0 ? `${equipamentosEmRisco} ativos precisam atenção imediata.` : 'Nenhum ativo fora do padrão operacional.',
        status: equipamentosEmRisco > 0 ? 'Atenção' : 'Ok',
        icon: AlertTriangle,
        tone: equipamentosEmRisco > 0 ? 'warning' : 'success'
      },
      {
        title: 'Confirmar alertas',
        description: alertasCriticos > 0 ? `${alertasCriticos} alertas ainda demandam análise.` : 'Radar limpo para o turno atual.',
        status: alertasCriticos > 0 ? 'Pendente' : 'Ok',
        icon: ShieldCheck,
        tone: alertasCriticos > 0 ? 'danger' : 'success'
      },
      {
        title: 'Acompanhar ordens',
        description: chamadosPendentes > 0 ? `${chamadosPendentes} ordens ainda aguardam atualização.` : 'Sem ordens abertas para revisar.',
        status: chamadosPendentes > 0 ? 'Em andamento' : 'Ok',
        icon: Wrench,
        tone: chamadosPendentes > 0 ? 'warning' : 'success'
      }
    ];
  }, [equipamentosDaFilial, notificacoesDaFilial, chamados]);

  const orientacoes = [
    {
      title: 'Rotina da loja',
      text: 'Revise temperatura, umidade e estado dos equipamentos antes de abrir o turno.',
      icon: Clock3
    },
    {
      title: 'Comunicação',
      text: 'Use o chat operacional para escalar anomalias sem depender do canal telefônico.',
      icon: MessageSquare
    },
    {
      title: 'Manutenção preventiva',
      text: 'Priorize ativos com histórico de desvios e ordens em aberto.',
      icon: Thermometer
    }
  ];

  return (
    <div className="assistente-operacao anim-fade-in">
      <section className="hero-assistente">
        <div>
          <div className="hero-badge-assistente">
            <Sparkles size={16} />
            Assistente de rotina operacional
          </div>
          <h3>Uma visão simples para quem precisa agir com rapidez no dia a dia.</h3>
          <p>
            Este módulo foi pensado para usuários de loja, manutenção e gestão, com instruções claras, checklist e prioridades sem depender do painel de desenvolvimento.
          </p>
        </div>
        <div className="hero-summary">
          <span>{filialAtiva === 'Todas' ? 'Visão global' : filialAtiva}</span>
          <span>{userRole === 'LOJA' ? 'Perfil de operação local' : 'Perfil de supervisão'}</span>
          <span><ClipboardCheck size={14} /> Checklist ativo</span>
        </div>
      </section>

      <section className="checklist-grid">
        {checklist.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className={`check-item-card ${item.tone}`}>
              <div className="check-item-head">
                <div className="check-icon-assistente">
                  <Icon size={18} />
                </div>
                <span>{item.status}</span>
              </div>
              <h4>{item.title}</h4>
              <p>{item.description}</p>
            </article>
          );
        })}
      </section>

      <section className="content-assistente-grid">
        <article className="section-card-assistente">
          <div className="section-header-assistente">
            <h4>Orientações do turno</h4>
            <p>Passos recomendados para manter a operação estável.</p>
          </div>
          <div className="orientacoes-list">
            {orientacoes.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="orientacao-item">
                  <div className="orientacao-icon">
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

        <article className="section-card-assistente">
          <div className="section-header-assistente">
            <h4>Próximo passo recomendado</h4>
            <p>Foco para manter o fluxo do dia sem interrupções.</p>
          </div>
          <div className="next-step-card">
            <CheckCircle2 size={24} />
            <div>
              <strong>Priorize os ativos com maior risco operacional.</strong>
              <p>Concentre os primeiros movimentos em equipamentos fora do padrão, ordens abertas e alertas críticos para reduzir parada e retrabalho.</p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
