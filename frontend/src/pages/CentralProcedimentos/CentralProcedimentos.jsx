import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  DoorOpen,
  Droplets,
  MessageSquare,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Wrench
} from 'lucide-react';
import './CentralProcedimentos.css';

/**
 * Central de Procedimentos - cartões com passos operacionais
 *
 * Responsabilidades:
 * - Exibir procedimentos padrão para eventos operacionais comuns (porta, degelo, comunicacao)
 * - Servir como referência rápida para operadores e manutenção
 */
const procedimentos = [
  {
    id: 'refrigeracao',
    title: 'Falha de refrigeração',
    icon: Thermometer,
    severity: 'Alta',
    trigger: 'Temperatura acima do limite ou equipamento sem resposta.',
    steps: [
      'Confirmar leitura atual e comparar com os limites configurados.',
      'Verificar se o motor está ligado e se há indicação de bloqueio.',
      'Acionar manutenção ou escalonar para suporte técnico se persistir.'
    ],
    note: 'Priorize a contenção do risco antes de qualquer ajuste manual.'
  },
  {
    id: 'porta',
    title: 'Porta aberta ou mal fechada',
    icon: DoorOpen,
    severity: 'Alta',
    trigger: 'Alerta de porta ou perda de isolamento térmico.',
    steps: [
      'Fechar a porta e confirmar o estado visual da vedação.',
      'Revisar se há bloqueio mecânico ou sensor descalibrado.',
      'Registrar a ocorrência no chamado se o problema persistir.'
    ],
    note: 'Mesmo uma abertura curta pode gerar desvio térmico relevante.'
  },
  {
    id: 'comunicacao',
    title: 'Perda de comunicação',
    icon: MessageSquare,
    severity: 'Média',
    trigger: 'Equipamento sem atualização ou sem sinal de telemetria.',
    steps: [
      'Validar conectividade local e presença de rede.',
      'Confirmar se o equipamento continua respondendo localmente.',
      'Escalar para suporte caso não haja recuperação em curto prazo.'
    ],
    note: 'A comunicação interrompida pode esconder um problema maior.'
  },
  {
    id: 'umidade',
    title: 'Umidade fora do padrão',
    icon: Droplets,
    severity: 'Média',
    trigger: 'Leitura fora dos limites recomendados para o ambiente.',
    steps: [
      'Confirmar a leitura em mais de uma verificação.',
      'Verificar se o ambiente está com circulação ou vedação adequada.',
      'Acionar intervenção quando o desvio se mantiver.'
    ],
    note: 'Em alguns casos, a causa é operacional e não elétrica.'
  },
  {
    id: 'degelo',
    title: 'Ciclo de degelo',
    icon: Snowflake,
    severity: 'Média',
    trigger: 'Equipamento entrou em ciclo de degelo programado.',
    steps: [
      'Confirmar o tempo estimado do ciclo.',
      'Evitar abertura desnecessária da porta.',
      'Acompanhar o retorno à temperatura de operação.'
    ],
    note: 'O ciclo é esperado, mas exige monitoramento.'
  }
];

/**
 * Página Central de Procedimentos
 *
 * Nota: componente estático (conteúdo em memória). Incluir aqui instruções claras torna a tela auditável.
 */
export default function CentralProcedimentos() {
  return (
    <div className="central-procedimentos anim-fade-in">
      <section className="hero-procedimentos">
        <div>
          <div className="hero-badge-procedimentos">
            <ClipboardCheck size={16} />
            Central de Procedimentos
          </div>
          <h3>Guia rápido para responder com segurança aos cenários mais comuns.</h3>
          <p>
            Esta tela reúne passos claros para operação, manutenção e supervisão, sem depender de acesso técnico avançado.
          </p>
        </div>
        <div className="hero-summary-procedimentos">
          <span><ShieldCheck size={14} /> Procedimentos operacionais</span>
          <span><Wrench size={14} /> Apoio à manutenção</span>
          <span><CheckCircle2 size={14} /> Resposta mais objetiva</span>
        </div>
      </section>

      <section className="procedimentos-grid">
        {procedimentos.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.id} className="procedimento-card">
              <div className="procedimento-head">
                <div className="procedimento-icon">
                  <Icon size={18} />
                </div>
                <span className={`severity-badge ${item.severity.toLowerCase()}`}>{item.severity}</span>
              </div>
              <h4>{item.title}</h4>
              <p className="trigger-text">{item.trigger}</p>
              <ul>
                {item.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <div className="procedimento-note">
                <AlertTriangle size={14} />
                <span>{item.note}</span>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
