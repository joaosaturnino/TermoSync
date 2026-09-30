/**
 * Módulo: frontend/src/pages/CentroComando/CentroComando.jsx
 * Responsabilidade: Implementa a tela Centro Comando, seus estados, interações e integrações de dados.
 */

import { Gauge, ListChecks, Radio } from 'lucide-react';
import React, { useMemo } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, Cpu,
  MessageSquare, ShieldCheck, Thermometer, Wrench, WifiOff,
  Terminal, Lock
} from 'lucide-react';
import './CentroComando.css';

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

const CRITICAL_ALERT_TYPES = ['TEMPERATURA', 'MECANICA', 'PORTA', 'REDE', 'METROLOGIA'];


/**
 * Formata format event time para exibicao segura na interface.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatEventTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Sem horario'
    : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

/**
 * Reune sinais operacionais da filial e oferece caminhos rapidos para investigacao. Todos os
 * indicadores sao derivados dos dados recebidos pelo App, sem valores simulados.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @param {unknown} props.qtdTotal - Propriedade qtdTotal usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.qtdOperando - Propriedade qtdOperando usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.qtdDegelo - Propriedade qtdDegelo usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.qtdFalha - Propriedade qtdFalha usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.notificacoesDaFilial - Propriedade notificacoesDaFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.chamados - Propriedade chamados usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.equipamentosDaFilial - Propriedade equipamentosDaFilial usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
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
  const alertasCriticos = useMemo(() => notificacoesDaFilial.filter(
    (item) => CRITICAL_ALERT_TYPES.includes(String(item.tipo_alerta || '').toUpperCase())
  ).length, [notificacoesDaFilial]);

  const chamadosPendentes = useMemo(() => chamados.filter(
    (item) => !['CONCLUIDO', 'CONCLUÍDO', 'FECHADO', 'CANCELADO'].includes(String(item.status || '').toUpperCase())
  ).length, [chamados]);

  const chamadosUrgentes = useMemo(() => chamados.filter((item) => {
    const urgency = String(item.urgencia || item.prioridade || '').toUpperCase();
    const open = !['CONCLUIDO', 'CONCLUÍDO', 'FECHADO', 'CANCELADO'].includes(String(item.status || '').toUpperCase());
    return open && ['CRITICA', 'CRÍTICA', 'ALTA', 'URGENTE'].includes(urgency);
  }).length, [chamados]);

  const ativosSemTelemetria = useMemo(() => equipamentosDaFilial.filter(
    (item) => item.ultima_temp == null || item.ultima_umidade == null
  ).length, [equipamentosDaFilial]);

  const ativosEmRisco = useMemo(() => equipamentosDaFilial.filter(
    (item) => item.em_degelo || item.motor_ligado === false || item.ultima_temp == null || item.ultima_umidade == null
  ).length, [equipamentosDaFilial]);

  const coberturaTelemetria = useMemo(() => {
    const totalMonitorado = Math.max(qtdTotal, equipamentosDaFilial.length);
    if (!totalMonitorado) return 100;
    return Math.max(0, Math.min(100, Math.round(((totalMonitorado - ativosSemTelemetria) / totalMonitorado) * 100)));
  }, [ativosSemTelemetria, equipamentosDaFilial.length, qtdTotal]);

  const saudeGeral = useMemo(() => {
    if (!qtdTotal) return { score: 100, label: 'SEM FALHAS ATIVAS', tone: 'success' };
    const score = Math.max(0, Math.min(100, Math.round((qtdOperando / qtdTotal) * 100)));
    if (score < 80) return { score, label: 'ATENCAO CRITICA', tone: 'danger' };
    if (score < 95) return { score, label: 'SOB OBSERVACAO', tone: 'warning' };
    return { score, label: 'OPERACAO ESTAVEL', tone: 'success' };
  }, [qtdOperando, qtdTotal]);

  const commandState = isOffline || alertasCriticos > 0 || qtdFalha > 0
    ? { label: isOffline ? 'Canal indisponivel' : 'Intervencao necessaria', tone: 'danger', icon: AlertTriangle }
    : chamadosPendentes > 0 || ativosEmRisco > 0
      ? { label: 'Operacao sob observacao', tone: 'warning', icon: Clock3 }
      : { label: 'Operacao estabilizada', tone: 'success', icon: CheckCircle2 };

  const pressureSignals = [
    { label: 'Disponibilidade dos ativos', value: saudeGeral.score, tone: saudeGeral.tone },
    { label: 'Cobertura de telemetria', value: coberturaTelemetria, tone: ativosSemTelemetria ? 'warning' : 'success' },
    { label: 'Fila sem incidente critico', value: Math.max(0, 100 - Math.min(100, alertasCriticos * 20)), tone: alertasCriticos ? 'danger' : 'success' }
  ];

  const recommendations = [
    { title: 'Alertas para triagem', text: alertasCriticos ? `${alertasCriticos} alerta(s) critico(s) aguardam investigacao.` : 'Nenhum alerta critico ativo no escopo atual.', meta: alertasCriticos ? 'Abrir monitoramento' : 'Radar limpo', action: 'motores', tone: alertasCriticos ? 'danger' : 'success', icon: AlertTriangle },
    { title: 'Fila de manutencao', text: chamadosPendentes ? `${chamadosPendentes} chamado(s) aberto(s), ${chamadosUrgentes} com prioridade alta.` : 'Nao ha chamados aguardando tratamento.', meta: chamadosPendentes ? 'Abrir chamados' : 'Fila concluida', action: 'chamados', tone: chamadosUrgentes ? 'danger' : chamadosPendentes ? 'warning' : 'success', icon: Wrench },
    { title: 'Integridade da coleta', text: ativosSemTelemetria ? `${ativosSemTelemetria} ativo(s) sem leitura completa no recorte atual.` : 'Todos os ativos possuem telemetria disponivel.', meta: ativosSemTelemetria ? 'Ver inventario' : 'Coleta integra', action: 'inventario_iot', tone: ativosSemTelemetria ? 'warning' : 'success', icon: Cpu }
  ];

  const OperationalIcon = commandState.icon;

  return (
    <div className="centro-comando">
      <section className={`command-overview command-tone-${commandState.tone}`}>
        <div className="command-overview-copy">
          <div className="command-eyebrow"><OperationalIcon size={15} /> {commandState.label}</div>
          <h2>Centro de Comando</h2>
          <p>{isOffline ? 'A conexao com o backend foi interrompida. Valide servicos e rede antes de executar novas acoes.' : alertasCriticos ? `O ambiente possui ${alertasCriticos} alerta(s) critico(s). Priorize a triagem e confirme a recuperacao da telemetria.` : chamadosPendentes ? `A telemetria esta estavel, com ${chamadosPendentes} chamado(s) ainda em acompanhamento.` : 'Telemetria, ativos e fila operacional estao dentro do estado esperado.'}</p>
          <div className="command-context">
            <span><Activity size={14} /> {filialAtiva === 'Todas' ? 'Escopo global' : filialAtiva}</span>
            <span><ShieldCheck size={14} /> Perfil {userRole}</span>
            <span className={isOffline ? 'is-offline' : 'is-online'}>{isOffline ? <WifiOff size={14} /> : <Radio size={14} />} {isOffline ? 'Offline' : 'Tempo real'}</span>
          </div>
        </div>
        <div className="command-health">
          <div className="command-health-head"><span>Saude operacional</span><strong>{saudeGeral.score}%</strong></div>
          <div className="command-health-track" aria-label={`Saude operacional em ${saudeGeral.score}%`}><span style={{ width: `${saudeGeral.score}%` }} /></div>
          <div className="command-health-foot"><span>{saudeGeral.label}</span><span>{qtdOperando}/{qtdTotal} ativos</span></div>
          <div className="command-hero-actions">
            <button className="btn btn-primary" onClick={() => onNavigate?.('dashboard')}><Activity size={16} /> Abrir dashboard</button>
            {userRole === 'DEV' && <button className="btn btn-outline" onClick={() => onNavigate?.('central_saude')}><Gauge size={16} /> Diagnosticar</button>}
          </div>
        </div>
      </section>

      <section className="command-kpi-grid" aria-label="Indicadores operacionais">
        {[
          { label: 'Operando', value: qtdOperando, detail: 'ativos dentro do estado esperado', icon: CheckCircle2, tone: 'success' },
          { label: 'Em degelo', value: qtdDegelo, detail: 'ciclos termicos em andamento', icon: Thermometer, tone: 'info' },
          { label: 'Falhas', value: qtdFalha, detail: 'ocorrencias detectadas', icon: AlertTriangle, tone: 'danger' },
          { label: 'Chamados', value: chamadosPendentes, detail: `${chamadosUrgentes} de alta prioridade`, icon: ListChecks, tone: chamadosUrgentes ? 'danger' : 'warning' },
          { label: 'Sem telemetria', value: ativosSemTelemetria, detail: 'ativos com coleta incompleta', icon: WifiOff, tone: ativosSemTelemetria ? 'warning' : 'success' }
        ].map(({ label, value, detail, icon: Icon, tone }) => (
          <article className={`command-kpi command-tone-${tone}`} key={label}><Icon size={19} /><div><strong>{value}</strong><span>{label}</span><small>{detail}</small></div></article>
        ))}
      </section>

      <div className="command-workspace">
        <section className="command-panel command-priority-panel">
          <header className="command-panel-head"><div><h3>Fila de resposta</h3><p>Proximas acoes calculadas pelo estado atual.</p></div><span>{recommendations.filter((item) => item.tone !== 'success').length} pendencia(s)</span></header>
          <div className="command-priority-list">
            {recommendations.map(({ title, text, meta, action, tone, icon: Icon }) => (
              <article className={`command-priority command-tone-${tone}`} key={title}>
                <div className="command-priority-icon"><Icon size={18} /></div><div><strong>{title}</strong><p>{text}</p></div>
                <button type="button" onClick={() => onNavigate?.(action)}>{meta}<ArrowRight size={15} /></button>
              </article>
            ))}
          </div>
        </section>

        <section className="command-panel">
          <header className="command-panel-head"><div><h3>Pressao operacional</h3><p>Leitura proporcional do ambiente monitorado.</p></div></header>
          <div className="command-pressure-list">
            {pressureSignals.map((signal) => (
              <div className="command-pressure" key={signal.label}><div><span>{signal.label}</span><strong>{signal.value}%</strong></div><div className={`command-pressure-track command-tone-${signal.tone}`}><span style={{ width: `${signal.value}%` }} /></div></div>
            ))}
          </div>
          <div className="command-pressure-summary"><Gauge size={18} /><p><strong>{ativosEmRisco} ativo(s) pedem atencao.</strong> O indice combina estado mecanico, degelo e disponibilidade de leitura.</p></div>
        </section>
      </div>

      <section className="command-panel">
        <header className="command-panel-head"><div><h3>Acessos operacionais</h3><p>Ferramentas para monitorar, investigar e responder.</p></div></header>
        <div className="command-action-grid">
          {quickActions.map((action) => {
            const allowed = action.roles.includes(userRole);
            const Icon = action.icon;
            return <button key={action.id} className={`command-action command-accent-${action.accent}`} onClick={() => allowed && onNavigate?.(action.id)} disabled={!allowed}><span className="command-action-icon">{allowed ? <Icon size={19} /> : <Lock size={19} />}</span><span><strong>{action.title}</strong><small>{allowed ? action.description : 'Acesso restrito para este perfil.'}</small></span><ArrowRight size={15} /></button>;
          })}
        </div>
      </section>

      <section className="command-panel">
        <header className="command-panel-head"><div><h3>Incidentes recentes</h3><p>Ultimas ocorrencias recebidas no escopo selecionado.</p></div><button type="button" className="btn btn-outline" onClick={() => onNavigate?.('chamados')}>Ver chamados <ArrowRight size={15} /></button></header>
        <div className="command-incident-list">
          {notificacoesDaFilial.length === 0 ? <div className="command-empty"><CheckCircle2 size={22} /><div><strong>Nenhuma anomalia recente</strong><span>O historico atual nao possui incidentes para triagem.</span></div></div> : notificacoesDaFilial.slice(0, 6).map((item, index) => (
            <article className="command-incident" key={item.id || `${item.data_hora}-${index}`}><span className="command-incident-marker" /><div><strong>{item.equipamento_nome || 'Evento do sistema'}</strong><p>{item.mensagem || 'Ocorrencia sem descricao.'}</p></div><div className="command-incident-meta"><span>{item.tipo_alerta || 'ALERTA'}</span><time>{formatEventTime(item.data_hora)}</time></div></article>
          ))}
        </div>
      </section>
    </div>
  );
}
