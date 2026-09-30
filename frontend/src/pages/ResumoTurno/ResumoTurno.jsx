/**
 * Módulo: frontend/src/pages/ResumoTurno/ResumoTurno.jsx
 * Responsabilidade: Implementa a tela Resumo Turno, seus estados, interações e integrações de dados.
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle, Radio, ShieldCheck, Thermometer } from 'lucide-react';
import React, { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Wrench
} from 'lucide-react';
import './ResumoTurno.css';

/**
 * Verifica a condicao is open ticket e retorna um valor booleano.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} ticket - Valor de ticket consumido por esta rotina.
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function isOpenTicket(ticket) {
  return !['concluido', 'concluído', 'fechado'].includes(String(ticket.status || '').toLowerCase());
}

/**
 * Resumo para passagem de turno com checklist, pendências e prontidão operacional.
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
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; troca eventos em tempo real
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.equipamentosDaFilial - Propriedade equipamentosDaFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.notificacoesDaFilial - Propriedade notificacoesDaFilial usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.chamados - Propriedade chamados usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function ResumoTurno({ equipamentosDaFilial = [], notificacoesDaFilial = [], chamados = [], filialAtiva, userRole, api, socket, onNavigate }) {
  const [checklist, setChecklist] = useState([]);
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(true);
  const branch = filialAtiva && filialAtiva !== 'Todas' ? filialAtiva : 'Matriz';

  /** Busca as verificações reais que sustentam a passagem de turno. */
  const loadChecklist = useCallback(async () => {
    if (!api) return;
    try {
      const response = await api.get(`/operacao/tarefas?tipo=checklist_turno&filial=${encodeURIComponent(branch)}`);
      setChecklist(response.data || []);
    } catch (error) {
      setChecklist([]);
    } finally {
      setIsLoadingChecklist(false);
    }
  }, [api, branch]);

  /** Atualiza o checklist quando outro usuário altera uma verificação. */
  useEffect(() => {
    loadChecklist();

    /**
     * Processa a interacao de handle update e atualiza a interface conforme o resultado.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @param {object|Array} payload - Dados de entrada que serão validados e transformados pelo fluxo.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const handleUpdate = (payload = {}) => {
      if (!payload.tipo || payload.tipo === 'tarefas') loadChecklist();
    };
    socket?.on('operacao_atualizada', handleUpdate);
    return () => socket?.off('operacao_atualizada', handleUpdate);
  }, [loadChecklist, socket]);

  const summary = useMemo(() => {
    const openTickets = chamados.filter(isOpenTicket);
    const validTemperature = equipamentosDaFilial.filter((item) => Number.isFinite(Number.parseFloat(item.ultima_temp)));
    const outOfRange = validTemperature.filter((item) => {
      const value = Number.parseFloat(item.ultima_temp);
      const min = Number.parseFloat(item.temp_min);
      const max = Number.parseFloat(item.temp_max);
      return (Number.isFinite(min) && value < min) || (Number.isFinite(max) && value > max);
    });
    const completedChecklist = checklist.filter((item) => item.concluida).length;
    const checklistProgress = checklist.length ? Math.round((completedChecklist / checklist.length) * 100) : 0;
    const readiness = Math.max(0, Math.round(100
      - (notificacoesDaFilial.length * 8)
      - (openTickets.length * 4)
      - (outOfRange.length * 7)
      - ((100 - checklistProgress) * .35)));
    const sectors = new Map();
    equipamentosDaFilial.forEach((item) => {
      const name = item.setor || 'Sem setor';
      const current = sectors.get(name) || { name, total: 0, issues: 0 };
      current.total += 1;
      if (outOfRange.some((equipment) => String(equipment.id) === String(item.id))) current.issues += 1;
      sectors.set(name, current);
    });
    return { openTickets, outOfRange, completedChecklist, checklistProgress, readiness, sectors: [...sectors.values()].sort((a, b) => b.issues - a.issues) };
  }, [chamados, equipamentosDaFilial, notificacoesDaFilial.length, checklist]);

  const handoffState = summary.readiness >= 90 ? { label: 'Pronto para passagem', tone: 'ready' } : summary.readiness >= 65 ? { label: 'Passagem com ressalvas', tone: 'attention' } : { label: 'Pendências críticas', tone: 'critical' };

  return (
    <main className="shift-summary anim-fade-in">
      <header className="shift-summary-header">
        <div><span className="shift-summary-eyebrow"><ClipboardCheck size={15} /> Continuidade operacional</span><h2>Resumo de turno</h2><p>{branch} · {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {userRole || 'Operação'}</p></div>
        <div className={`handoff-state ${handoffState.tone}`}><span><ShieldCheck size={18} /></span><div><strong>{handoffState.label}</strong><small>Índice de prontidão: {summary.readiness}%</small></div></div>
      </header>

      <section className="shift-summary-kpis">
        <article><span><ClipboardCheck size={16} /> Checklist</span><strong>{isLoadingChecklist ? <LoaderCircle className="spin" size={20} /> : `${summary.checklistProgress}%`}</strong><p>{summary.completedChecklist} de {checklist.length} verificações</p></article>
        <article className={notificacoesDaFilial.length ? 'danger' : ''}><span><AlertTriangle size={16} /> Alertas ativos</span><strong>{notificacoesDaFilial.length}</strong><p>Ocorrências para o próximo turno</p></article>
        <article className={summary.outOfRange.length ? 'danger' : ''}><span><Thermometer size={16} /> Desvios térmicos</span><strong>{summary.outOfRange.length}</strong><p>Ativos fora da faixa configurada</p></article>
        <article><span><Wrench size={16} /> Chamados abertos</span><strong>{summary.openTickets.length}</strong><p>Demandas ainda em acompanhamento</p></article>
      </section>

      <section className="shift-summary-layout">
        <article className="shift-summary-panel handoff-panel">
          <div className="shift-panel-heading"><div><span>Passagem estruturada</span><h3>Pontos para o próximo turno</h3></div><Radio size={17} /></div>
          <div className="handoff-list">
            <button type="button" onClick={() => onNavigate?.('checklist_turno')} className={summary.checklistProgress < 100 ? 'pending' : 'done'}><span>{summary.checklistProgress < 100 ? <Clock3 size={16} /> : <CheckCircle2 size={16} />}</span><div><strong>Checklist operacional</strong><small>{summary.checklistProgress < 100 ? `${checklist.length - summary.completedChecklist} verificações pendentes` : 'Todas as verificações concluídas'}</small></div><ArrowRight size={15} /></button>
            <button type="button" onClick={() => onNavigate?.('motores')} className={summary.outOfRange.length ? 'pending' : 'done'}><span>{summary.outOfRange.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}</span><div><strong>Condição térmica</strong><small>{summary.outOfRange.length ? `${summary.outOfRange.length} ativos exigem validação` : 'Nenhum desvio térmico identificado'}</small></div><ArrowRight size={15} /></button>
            <button type="button" onClick={() => onNavigate?.('chamados')} className={summary.openTickets.length ? 'pending' : 'done'}><span>{summary.openTickets.length ? <Wrench size={16} /> : <CheckCircle2 size={16} />}</span><div><strong>Chamados técnicos</strong><small>{summary.openTickets.length ? `${summary.openTickets.length} chamados em andamento` : 'Sem chamados pendentes'}</small></div><ArrowRight size={15} /></button>
          </div>
        </article>

        <article className="shift-summary-panel alert-panel">
          <div className="shift-panel-heading"><div><span>Ocorrências abertas</span><h3>Alertas a comunicar</h3></div><AlertTriangle size={17} /></div>
          <div className="shift-alert-list">{notificacoesDaFilial.length ? notificacoesDaFilial.slice(0, 5).map((item) => <div key={item.id}><span><strong>{item.equipamento_nome || 'Equipamento'}</strong><small>{item.mensagem || item.tipo_alerta || 'Ocorrência ativa'}</small></span><time>{item.data_hora ? new Date(item.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</time></div>) : <div className="shift-summary-empty"><CheckCircle2 size={25} /><strong>Sem alertas para comunicar</strong><small>A operação não possui ocorrências ativas.</small></div>}</div>
        </article>

        <article className="shift-summary-panel sector-shift-panel">
          <div className="shift-panel-heading"><div><span>Leitura por área</span><h3>Condição dos setores</h3></div><Thermometer size={17} /></div>
          <div className="shift-sector-grid">{summary.sectors.map((sector) => <div key={sector.name} className={sector.issues ? 'with-issue' : ''}><span><strong>{sector.name}</strong><small>{sector.total} ativos</small></span><span>{sector.issues ? `${sector.issues} desvios` : 'Conforme'}</span></div>)}</div>
        </article>
      </section>
    </main>
  );
}
