import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  TrendingUp,
  Wrench
} from 'lucide-react';
import './ResumoTurno.css';

/**
 * Resumo de Turno
 *
 * Responsabilidades:
 * - Mostrar resumo objetivo para início/encerramento de turno
 * - Apresentar KPIs rápidos: equipamentos, alertas e chamados
 *
 * Props: `equipamentosDaFilial`, `notificacoesDaFilial`, `chamados`, `filialAtiva`, `userRole`
 */
export default function ResumoTurno({ equipamentosDaFilial = [], notificacoesDaFilial = [], chamados = [], filialAtiva, userRole }) {
  const totalEquipamentos = equipamentosDaFilial.length;
  const alertasAtivos = notificacoesDaFilial.length;
  const chamadosAbertos = chamados.filter((item) => String(item.status || '').toLowerCase() !== 'concluído' && String(item.status || '').toLowerCase() !== 'fechado').length;

  const statusResumo = useMemo(() => {
    if (totalEquipamentos === 0) return { label: 'Sem leitura', tone: 'neutral' };
    if (alertasAtivos > 0) return { label: 'Atenção', tone: 'warning' };
    if (chamadosAbertos > 0) return { label: 'Monitoramento', tone: 'info' };
    return { label: 'Estável', tone: 'success' };
  }, [alertasAtivos, chamadosAbertos, totalEquipamentos]);

  const proximosPassos = [
    'Validar alertas críticos antes do próximo ciclo operacional.',
    'Confirmar se os chamados em aberto exigem escalonamento.',
    'Acompanhar o retorno das áreas com maior desvio térmico.'
  ];

  return (
    <div className="resumo-turno anim-fade-in">
      <section className="hero-resumo-turno">
        <div>
          <div className="hero-badge-resumo-turno">
            <BarChart3 size={16} />
            Resumo de turno
          </div>
          <h3>Visão objetiva da operação para o início e o encerramento do turno.</h3>
          <p>
            Centralize o estado atual da operação, principais alertas e próximos passos sem abrir vários módulos.
          </p>
        </div>
        <div className="hero-summary-resumo-turno">
          <span><Clock3 size={14} /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span><ClipboardCheck size={14} /> {filialAtiva || 'Visão local'}</span>
          <span><Activity size={14} /> {userRole || 'Usuário'}</span>
        </div>
      </section>

      <section className="cards-resumo-turno">
        <article className="resumo-card">
          <div className="resumo-icon status">
            <Activity size={18} />
          </div>
          <div>
            <h4>{totalEquipamentos}</h4>
            <p>Equipamentos na visão atual</p>
          </div>
        </article>

        <article className="resumo-card">
          <div className="resumo-icon alert">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h4>{alertasAtivos}</h4>
            <p>Alertas ativos</p>
          </div>
        </article>

        <article className="resumo-card">
          <div className="resumo-icon service">
            <Wrench size={18} />
          </div>
          <div>
            <h4>{chamadosAbertos}</h4>
            <p>Chamados em andamento</p>
          </div>
        </article>

        <article className="resumo-card">
          <div className="resumo-icon success">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <h4>{statusResumo.label}</h4>
            <p>Situação geral do turno</p>
          </div>
        </article>
      </section>

      <section className="resumo-grid">
        <article className="panel-resumo">
          <div className="panel-title">
            <TrendingUp size={16} />
            <h4>Próximos passos</h4>
          </div>
          <ul>
            {proximosPassos.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel-resumo">
          <div className="panel-title">
            <ClipboardCheck size={16} />
            Observações operacionais
          </div>
          <p>
            A equipe pode usar esta tela para consolidar o estado do turno, registrar prioridades e dar sequência ao trabalho sem perder contexto.
          </p>
        </article>
      </section>
    </div>
  );
}
