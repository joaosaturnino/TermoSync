/**
 * Módulo: frontend/src/pages/AssistenteOperacao/AssistenteOperacao.jsx
 * Responsabilidade: Implementa a tela Assistente Operacao, seus estados, interações e integrações de dados.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, BookOpen, CalendarDays, Gauge, Thermometer } from 'lucide-react';
import React, { useMemo } from 'react';
import {
  ClipboardCheck, CheckCircle2, MessageSquare,
  ShieldCheck, Sparkles, Wrench, ShieldAlert, ThermometerSnowflake,
  ArrowRight, Lock
} from 'lucide-react';
import './AssistenteOperacao.css';

/**
 * Normaliza normalize para evitar divergencia de formato nas comparacoes.
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
const normalize = (value) => String(value || '').trim().toLowerCase();

/**
 * Verifica a condicao has value e retorna um valor booleano.
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
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const hasValue = (value) => value !== null && value !== undefined && value !== '';

/**
 * Formata uma data operacional, mantendo uma saída útil para bases antigas.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatWhen = (value) => {
  if (!value) return 'Agora';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Agora' : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

/**
 * Converte telemetria, alertas e chamados em uma fila objetiva de trabalho para o turno,
 * sempre respeitando o papel e o contexto de filial do usuário.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.equipamentosDaFilial - Propriedade equipamentosDaFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.notificacoesDaFilial - Propriedade notificacoesDaFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.chamados - Propriedade chamados usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function AssistenteOperacao({
  equipamentosDaFilial = [], notificacoesDaFilial = [], chamados = [],
  userRole = 'LOJA', filialAtiva = 'Todas', onNavigate, showToast
}) {
  const readinessKey = `termosync:shift-readiness:${new Date().toISOString().slice(0, 10)}:${filialAtiva}`;
  const [completedChecks, setCompletedChecks] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(readinessKey) || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem(readinessKey, JSON.stringify([...completedChecks]));
  }, [completedChecks, readinessKey]);
  const criticalAlerts = useMemo(() => notificacoesDaFilial.filter((item) => ['CRITICA', 'CRÍTICA', 'TEMPERATURA_CRITICA', 'FALHA'].includes(String(item.tipo_alerta || item.severidade || '').toUpperCase())), [notificacoesDaFilial]);
  const riskyEquipment = useMemo(() => equipamentosDaFilial.filter((item) => item.em_degelo || item.motor_ligado || !hasValue(item.ultima_temp)), [equipamentosDaFilial]);
  const scopedTickets = useMemo(() => chamados.filter((item) => !['concluído', 'concluido', 'fechado', 'cancelado'].includes(normalize(item.status))).filter((item) => filialAtiva === 'Todas' || normalize(item.filial) === normalize(filialAtiva)), [chamados, filialAtiva]);
  const priorityQueue = useMemo(() => [
    ...criticalAlerts.map((item) => ({ id: `alert-${item.id}`, priority: 1, icon: ShieldAlert, title: item.equipamento_nome || 'Alerta crítico', description: item.mensagem || item.tipo_alerta, source: 'Alerta', location: item.setor || item.filial || 'Operação', time: item.data_hora, route: 'motores' })),
    ...riskyEquipment.map((item) => ({ id: `equipment-${item.id}`, priority: 2, icon: ThermometerSnowflake, title: item.nome, description: 'Ativo requer conferência operacional.', source: 'Telemetria', location: item.setor || item.filial || 'Operação', time: item.ultima_comunicacao, route: 'motores' })),
    ...scopedTickets.map((item) => ({ id: `ticket-${item.id}`, priority: 3, icon: Wrench, title: item.titulo || `Chamado #${item.id}`, description: item.descricao || 'Atendimento em aberto.', source: 'Chamado', location: item.setor || item.filial || 'Operação', time: item.data_abertura, route: 'chamados' }))
  ].sort((a, b) => a.priority - b.priority).slice(0, 8), [criticalAlerts, riskyEquipment, scopedTickets]);
  const healthScore = Math.max(0, 100 - criticalAlerts.length * 18 - riskyEquipment.length * 6 - scopedTickets.length * 3);
  const healthTone = healthScore >= 90 ? 'healthy' : healthScore >= 70 ? 'attention' : 'critical';
  const shiftChecks = [
    { id: 'alerts', label: 'Revisar alertas ativos', detail: `${criticalAlerts.length} ocorrência(s) crítica(s)`, route: 'motores' },
    { id: 'equipment', label: 'Conferir ativos em atenção', detail: `${riskyEquipment.length} ativo(s)`, route: 'motores' },
    { id: 'tickets', label: 'Atualizar chamados do turno', detail: `${scopedTickets.length} chamado(s)`, route: 'chamados' }
  ];
  const recommendation = priorityQueue.length ? { icon: priorityQueue[0].icon, tone: healthTone, title: priorityQueue[0].title, text: priorityQueue[0].description, route: priorityQueue[0].route, action: 'Abrir prioridade' } : { icon: CheckCircle2, tone: 'healthy', title: 'Operação sob controle', text: 'Não há ocorrências prioritárias neste contexto.', route: 'dashboard', action: 'Voltar ao painel' };
  /**
   * Concentra a logica de navigate para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} route - Valor de route consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const navigate = (route) => {
    const roleRules = {
      hardware: ['DEV'],
      kanban: ['ADMIN', 'MANUTENCAO', 'DEV'],
      metrologia: ['ADMIN', 'MANUTENCAO', 'DEV']
    };
    if (roleRules[route] && !roleRules[route].includes(userRole)) {
      showToast?.('Seu perfil não possui acesso a este módulo.', 'warning');
      return;
    }
    onNavigate?.(route);
  };

  /**
   * Alterna uma confirmação do checklist sem alterar dados operacionais.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const toggleCheck = (id) => setCompletedChecks((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const RecommendationIcon = recommendation.icon;
  const completion = Math.round((completedChecks.size / shiftChecks.length) * 100);

  return (
    <div className="ops-assistant">
      <header className="ops-assistant-header">
        <div className="ops-heading"><span><Sparkles size={22} /></span><div><small>Inteligência operacional</small><h2>Assistente de Operações</h2><p>Prioridades, riscos e próximos passos calculados para o contexto atual.</p></div></div>
        <div className="ops-context"><span>{filialAtiva === 'Todas' ? 'Rede completa' : filialAtiva}</span><strong className={healthTone}><ShieldCheck size={15} /> Saúde {healthScore}%</strong></div>
      </header>

      <section className="ops-metrics" aria-label="Resumo operacional">
        <article className={criticalAlerts.length ? 'critical' : 'healthy'}><span><BellRing size={16} /> Alertas críticos</span><strong>{criticalAlerts.length}</strong><small>{criticalAlerts.length ? 'Exigem triagem imediata' : 'Nenhuma anomalia crítica'}</small></article>
        <article className={riskyEquipment.length ? 'attention' : 'healthy'}><span><Thermometer size={16} /> Ativos em atenção</span><strong>{riskyEquipment.length}</strong><small>Degelo, motor ou leitura incompleta</small></article>
        <article className={scopedTickets.length ? 'info' : 'healthy'}><span><Wrench size={16} /> OS em aberto</span><strong>{scopedTickets.length}</strong><small>No contexto de filial selecionado</small></article>
        <article className={healthTone}><span><Gauge size={16} /> Índice operacional</span><strong>{healthScore}%</strong><small>{healthScore >= 90 ? 'Operação controlada' : healthScore >= 70 ? 'Acompanhamento necessário' : 'Intervenção prioritária'}</small></article>
      </section>

      <div className="ops-primary-grid">
        <section className="ops-priority-panel">
          <div className="ops-panel-title"><div><AlertTriangle size={17} /><span>Fila priorizada</span></div><small>{priorityQueue.length} item(ns)</small></div>
          <div className="ops-priority-list">
            {priorityQueue.map((item, index) => {
              const Icon = item.icon;
              return <button type="button" key={item.id} onClick={() => navigate(item.route)}><span className={`priority-rank p${item.priority}`}>{String(index + 1).padStart(2, '0')}</span><span className="priority-icon"><Icon size={17} /></span><span className="priority-copy"><strong>{item.title}</strong><small>{item.description}</small><em>{item.source} · {item.location} · {formatWhen(item.time)}</em></span><ArrowRight size={16} /></button>;
            })}
            {priorityQueue.length === 0 && <div className="ops-empty"><CheckCircle2 size={24} /><strong>Fila operacional limpa</strong><span>Nenhuma ação corretiva foi identificada para este contexto.</span></div>}
          </div>
        </section>

        <section className={`ops-recommendation ${recommendation.tone}`}>
          <div className="recommendation-label"><RecommendationIcon size={18} /><span>Próxima melhor ação</span></div>
          <h3>{recommendation.title}</h3><p>{recommendation.text}</p>
          <div className="ops-health"><div><span>Saúde operacional</span><strong>{healthScore}%</strong></div><div><i style={{ width: `${healthScore}%` }} /></div></div>
          <button type="button" onClick={() => navigate(recommendation.route)}>{recommendation.action}<ArrowRight size={16} /></button>
        </section>
      </div>

      <div className="ops-secondary-grid">
        <section className="ops-checklist-panel">
          <div className="ops-panel-title"><div><ClipboardCheck size={17} /><span>Prontidão do turno</span></div><small>{completion}% concluído</small></div>
          <div className="ops-check-progress"><i style={{ width: `${completion}%` }} /></div>
          <div className="ops-shift-checks">
            {shiftChecks.map((item) => <div key={item.id} className={completedChecks.has(item.id) ? 'done' : ''}><button type="button" className="check-control" onClick={() => toggleCheck(item.id)} aria-label={`${completedChecks.has(item.id) ? 'Desmarcar' : 'Concluir'} ${item.label}`}>{completedChecks.has(item.id) ? <CheckCircle2 size={18} /> : <span />}</button><button type="button" className="check-copy" onClick={() => navigate(item.route)}><strong>{item.label}</strong><small>{item.detail}</small></button><ArrowRight size={15} /></div>)}
          </div>
        </section>

        <section className="ops-shortcuts-panel">
          <div className="ops-panel-title"><div><BookOpen size={17} /><span>Recursos do turno</span></div></div>
          <div className="ops-shortcuts">
            <button type="button" onClick={() => navigate('central_procedimentos')}><BookOpen size={18} /><span><strong>Procedimentos</strong><small>Guias de resposta e escalonamento</small></span><ArrowRight size={15} /></button>
            <button type="button" onClick={() => navigate('plano_dia')}><CalendarDays size={18} /><span><strong>Plano do dia</strong><small>Prioridades e metas operacionais</small></span><ArrowRight size={15} /></button>
            <button type="button" onClick={() => navigate('chat')}><MessageSquare size={18} /><span><strong>Chat operacional</strong><small>Alinhar resposta com a equipe</small></span><ArrowRight size={15} /></button>
            <button type="button" onClick={() => navigate('chamados')}><Wrench size={18} /><span><strong>Abrir ocorrência</strong><small>Formalizar intervenção técnica</small></span><ArrowRight size={15} /></button>
          </div>
          {userRole === 'LOJA' && <div className="ops-rbac-note"><Lock size={14} /><span>Ações administrativas permanecem protegidas pelo seu perfil.</span></div>}
        </section>
      </div>
    </div>
  );
}
