import React, { useMemo } from 'react';
import {
  Activity, AlertTriangle, Building2, CheckCircle2, Clock3, Droplets,
  Thermometer, Users, Wrench
} from 'lucide-react';
import './ResumoLoja.css';

/**
 * Resumo da Loja (Visão Operacional)
 *
 * Responsabilidades:
 * - Consolidar indicadores rápidos da filial (ativos, alertas, chamados)
 * - Servir como painel de decisão para supervisores e turno
 *
 * Props:
 * - `equipamentosDaFilial`, `notificacoesDaFilial`, `chamados` e contexto de `filialAtiva`
 */
export default function ResumoLoja({
  equipamentosDaFilial = [],
  notificacoesDaFilial = [],
  chamados = [],
  filialAtiva = 'Todas',
  userRole = 'LOJA'
}) {
  const resumo = useMemo(() => {
    const total = equipamentosDaFilial.length;
    const operando = equipamentosDaFilial.filter((eq) => eq.motor_ligado && !eq.em_degelo).length;
    const alerta = equipamentosDaFilial.filter((eq) => !eq.motor_ligado || eq.em_degelo).length;
    const chamadosPendentes = chamados.filter((c) => !['Concluído', 'Fechado'].includes(c.status)).length;
    const alertasCriticos = notificacoesDaFilial.filter((n) => ['MECANICA', 'PORTA', 'TEMPERATURA', 'REDE', 'METROLOGIA'].includes(n.tipo_alerta)).length;

    return { total, operando, alerta, chamadosPendentes, alertasCriticos };
  }, [equipamentosDaFilial, notificacoesDaFilial, chamados]);

  const highlights = [
    { title: 'Ativos monitorados', value: resumo.total, icon: Building2, tone: 'blue' },
    { title: 'Operando normalmente', value: resumo.operando, icon: CheckCircle2, tone: 'green' },
    { title: 'Atenção operacional', value: resumo.alerta, icon: AlertTriangle, tone: 'warning' },
    { title: 'Chamados abertos', value: resumo.chamadosPendentes, icon: Wrench, tone: 'orange' }
  ];

  return (
    <div className="resumo-loja anim-fade-in">
      <section className="hero-resumo">
        <div>
          <div className="hero-badge-resumo">
            <Activity size={16} />
            Resumo da loja
          </div>
          <h3>Visão prática para acompanhamento rápido do dia a dia.</h3>
          <p>Esta tela consolida o que importa para operação, supervisão e manutenção em um único painel simples.</p>
        </div>
        <div className="hero-pill-group">
          <span>{filialAtiva === 'Todas' ? 'Visão global' : filialAtiva}</span>
          <span>{userRole === 'LOJA' ? 'Operação local' : 'Gestão e supervisão'}</span>
          <span><Clock3 size={14} /> Atualização contínua</span>
        </div>
      </section>

      <section className="highlights-grid">
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className={`highlight-card ${item.tone}`}>
              <div className="highlight-icon">
                <Icon size={20} />
              </div>
              <div>
                <strong>{item.value}</strong>
                <span>{item.title}</span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="resumo-grid">
        <article className="panel-card">
          <div className="panel-header">
            <h4>Estado operacional</h4>
            <p>Indicadores gerais da operação da unidade.</p>
          </div>
          <div className="status-list">
            <div className="status-item">
              <Thermometer size={16} />
              <div>
                <strong>{resumo.alertasCriticos} alertas críticos</strong>
                <span>Requerem atenção imediata.</span>
              </div>
            </div>
            <div className="status-item">
              <Droplets size={16} />
              <div>
                <strong>{resumo.operando} equipamentos em operação</strong>
                <span>Dentro do fluxo sem interrupções.</span>
              </div>
            </div>
            <div className="status-item">
              <Users size={16} />
              <div>
                <strong>Equipe alinhada</strong>
                <span>Comunicação e resposta operacional centralizadas.</span>
              </div>
            </div>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <h4>Próximos cuidados</h4>
            <p>O que merece prioridade nesta unidade.</p>
          </div>
          <div className="care-list">
            <div className="care-item">
              <CheckCircle2 size={16} />
              <span>Revisar ativos em atenção antes do próximo turno.</span>
            </div>
            <div className="care-item">
              <AlertTriangle size={16} />
              <span>Encerrar chamados em aberto com prioridade de risco.</span>
            </div>
            <div className="care-item">
              <Wrench size={16} />
              <span>Validar manutenção preventiva e calibração de ativos críticos.</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
