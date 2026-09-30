/**
 * Módulo: frontend/src/pages/PlanoDia/PlanoDia.jsx
 * Responsabilidade: Implementa a tela Plano Dia, seus estados, interações e integrações de dados.
 */

import usePersistentState from '../../hooks/usePersistentState';
import { AlertCircle, Download, LoaderCircle, RotateCcw } from 'lucide-react';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  CalendarDays, CheckCircle2, Clock3,
  Target, Check, Trash2, Plus,
  X, RefreshCw
} from 'lucide-react';
import './PlanoDia.css';
import logger from '../../utils/logger';
import { canRolePerform } from '../../config/navigationPolicy';

/**
 * Concentra a logica de time to minutes para manter o restante do tela mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function timeToMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return Number.MAX_SAFE_INTEGER;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Escapa um valor para uso seguro no relatório CSV.
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
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function csvField(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; } /* Painel de execução e acompanhamento do plano operacional diário. */ export default function PlanoDia({ api, filialAtiva, showToast, userRole = 'LOJA', socket }) { const [tasks, setTasks] = useState([]); const [isSyncing, setIsSyncing] = useState(true); const [isResetting, setIsResetting] = useState(false); const [pendingId, setPendingId] = useState(null); const [isAdding, setIsAdding] = useState(false); const [newTaskText, setNewTaskText] = useState(''); const [newTaskTime, setNewTaskTime] = useState(''); const [filter, setFilter] = usePersistentState('termosync_day_plan_filter', 'all'); const [lastSync, setLastSync] = useState(null); const [currentMinute, setCurrentMinute] = useState(() => { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); }); const canManage = canRolePerform(userRole, 'MANAGE_OPERATION_TASKS'); const branch = filialAtiva && filialAtiva !== 'Todas' ? filialAtiva : 'Matriz'; /* Emite mensagens usando o sistema global de notificações. */ const notify = useCallback((message, type = 'info') => { if (showToast) showToast(message, type); else logger.info(`[${type.toUpperCase()}] ${message}`); }, [showToast]);
  const loadTasks = useCallback(async ({ silent = false } = {}) => {
    if (!api) return;
    if (!silent) setIsSyncing(true);
    try {
      const response = await api.get(`/operacao/tarefas?tipo=plano_dia&filial=${encodeURIComponent(branch)}`);
      setTasks(Array.isArray(response.data) ? response.data : []);
      setLastSync(new Date());
    } catch (error) {
      notify(error.response?.data?.error || 'Não foi possível carregar o plano do dia.', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [api, branch, notify]);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => loadTasks({ silent: true });
    socket.on('operacao_atualizada', refresh);
    return () => socket.off('operacao_atualizada', refresh);
  }, [loadTasks, socket]);
  useEffect(() => {
    const updateClock = () => { const now = new Date(); setCurrentMinute(now.getHours() * 60 + now.getMinutes()); };
    const timer = window.setInterval(updateClock, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const timeline = useMemo(() => tasks.map((task) => ({
    ...task,
    concluida: Boolean(task.concluida),
    overdue: !task.concluida && timeToMinutes(task.descricao) < currentMinute
  })).sort((a, b) => timeToMinutes(a.descricao) - timeToMinutes(b.descricao)), [tasks, currentMinute]);
  const stats = useMemo(() => {
    const completed = timeline.filter((task) => task.concluida).length;
    const pending = timeline.length - completed;
    const overdue = timeline.filter((task) => task.overdue).length;
    return { completed, pending, overdue, progress: timeline.length ? Math.round((completed / timeline.length) * 100) : 0, next: timeline.find((task) => !task.concluida) || null };
  }, [timeline]);
  const visibleTasks = useMemo(() => timeline.filter((task) => {
    if (filter === 'completed') return task.concluida;
    if (filter === 'pending') return !task.concluida;
    if (filter === 'overdue') return task.overdue;
    return true;
  }), [timeline, filter]);
  /**
   * Processa a interacao de toggle task e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {unknown} task - Valor de task consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const toggleTask = async (task) => {
    if (!api || pendingId) return;
    const nextValue = !task.concluida;
    setPendingId(task.id);
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, concluida: nextValue, horario: nextValue ? new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null } : item));
    try {
      await api.put(`/operacao/tarefas/${task.id}`, { concluida: nextValue });
    } catch (error) {
      notify('Falha ao sincronizar a atividade.', 'error');
      await loadTasks({ silent: true });
    } finally {
      setPendingId(null);
    }
  };

  /**
   * Adiciona uma nova atividade em seu horário planejado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const addTask = async (event) => {
    event.preventDefault();
    if (!api || !canManage || !newTaskText.trim() || !newTaskTime) return;
    try {
      await api.post('/operacao/tarefas', { tipo: 'plano_dia', chave: `meta-${Date.now()}`, titulo: newTaskText.trim(), descricao: newTaskTime, concluida: false, filial: branch });
      setNewTaskText(''); setNewTaskTime(''); setIsAdding(false);
      notify('Atividade adicionada ao plano.', 'success');
      await loadTasks({ silent: true });
    } catch (error) { notify('Não foi possível adicionar a atividade.', 'error'); }
  };

  /**
   * Exclui uma atividade após confirmação explícita.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: consulta ou altera dados pela API; interage com APIs do navegador
   *
   * @param {unknown} task - Valor de task consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const deleteTask = async (task) => {
    if (!api || !canManage || !window.confirm(`Excluir a atividade "${task.titulo}"?`)) return;
    try {
      await api.delete(`/operacao/tarefas/${task.id}`);
      notify('Atividade removida.', 'success');
      await loadTasks({ silent: true });
    } catch (error) { notify('Não foi possível excluir a atividade.', 'error'); }
  };

  /**
   * Reinicia todas as atividades concluídas para um novo ciclo diário.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const resetPlan = async () => {
    if (!api || !stats.completed || !window.confirm('Iniciar um novo dia e reabrir todas as atividades concluídas?')) return;
    setIsResetting(true);
    try {
      await Promise.all(tasks.filter((task) => task.concluida).map((task) => api.put(`/operacao/tarefas/${task.id}`, { concluida: false })));
      notify('Novo ciclo diário iniciado.', 'success');
      await loadTasks({ silent: true });
    } catch (error) { notify('Não foi possível reiniciar o plano.', 'error'); }
    finally { setIsResetting(false); }
  };

  /**
   * Exporta o cronograma atual para um arquivo CSV de auditoria.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const exportReport = () => {
    const rows = [['Horário previsto', 'Atividade', 'Status', 'Conclusão', 'Filial']];
    timeline.forEach((task) => rows.push([task.descricao || '', task.titulo, task.concluida ? 'Concluída' : task.overdue ? 'Atrasada' : 'Pendente', task.horario || '', branch]));
    const csv = rows.map((row) => row.map(csvField).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `plano-dia-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="day-plan anim-fade-in">
      <header className="day-plan-header">
        <div><span className="day-plan-eyebrow"><CalendarDays size={15} /> Coordenação operacional</span><h2>Plano do dia</h2><p>{branch} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}</p></div>
        <div className="day-plan-actions"><button type="button" onClick={exportReport} disabled={!timeline.length}><Download size={16} /> Exportar</button><button type="button" onClick={resetPlan} disabled={!stats.completed || isResetting}>{isResetting ? <LoaderCircle size={16} className="spin" /> : <RotateCcw size={16} />} Novo dia</button></div>
      </header>

      <section className="day-plan-summary">
        <div className="day-progress" style={{ '--day-progress': `${stats.progress}%` }}><span><strong>{stats.progress}%</strong><small>executado</small></span></div>
        <article><span><Target size={16} /> Próxima prioridade</span><strong>{stats.next?.titulo || 'Plano concluído'}</strong><p>{stats.next ? `Prevista para ${stats.next.descricao || '--:--'}` : 'Todas as atividades foram verificadas.'}</p></article>
        <div className="day-stat"><strong>{stats.pending}</strong><span>Pendentes</span></div>
        <div className={`day-stat ${stats.overdue ? 'danger' : ''}`}><strong>{stats.overdue}</strong><span>Atrasadas</span></div>
        <div className="day-sync"><RefreshCw size={14} className={isSyncing ? 'spin' : ''} /><span>{lastSync ? `Atualizado às ${lastSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Sincronizando'}</span></div>
      </section>

      <section className="day-plan-workspace">
        <div className="day-plan-toolbar">
          <div className="day-filter" role="tablist">{[['all', 'Todas'], ['pending', 'Pendentes'], ['overdue', 'Atrasadas'], ['completed', 'Concluídas']].map(([value, label]) => <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
          {canManage && <button type="button" className="day-add-trigger" onClick={() => setIsAdding(true)}><Plus size={16} /> Nova atividade</button>}
        </div>

        {isAdding && <form className="day-add-form" onSubmit={addTask}><input type="time" value={newTaskTime} onChange={(event) => setNewTaskTime(event.target.value)} required /><input autoFocus value={newTaskText} onChange={(event) => setNewTaskText(event.target.value)} maxLength={120} placeholder="Descreva a atividade operacional" required /><button type="button" onClick={() => { setIsAdding(false); setNewTaskText(''); setNewTaskTime(''); }} title="Cancelar"><X size={17} /></button><button type="submit" title="Adicionar"><Check size={17} /></button></form>}

        <div className="day-timeline">
          {!visibleTasks.length && <div className="day-empty"><CalendarDays size={30} /><strong>Nenhuma atividade neste filtro</strong><span>O cronograma não possui itens com esse status.</span></div>}
          {visibleTasks.map((task) => <article key={task.id} className={`day-task ${task.concluida ? 'completed' : ''} ${task.overdue ? 'overdue' : ''}`}>
            <time>{task.descricao || '--:--'}</time><span className="timeline-node">{pendingId === task.id ? <LoaderCircle size={15} className="spin" /> : task.concluida ? <Check size={15} /> : task.overdue ? <AlertCircle size={15} /> : <Clock3 size={15} />}</span>
            <button type="button" className="day-task-main" onClick={() => toggleTask(task)} disabled={pendingId === task.id}><strong>{task.titulo}</strong><span>{task.concluida ? `Concluída${task.horario ? ` às ${task.horario}` : ''}` : task.overdue ? 'Horário previsto ultrapassado' : 'Aguardando execução'}</span></button>
            <span className="day-task-status">{task.concluida ? <><CheckCircle2 size={15} /> Concluída</> : task.overdue ? <><AlertCircle size={15} /> Atrasada</> : <><Clock3 size={15} /> Programada</>}</span>
            {canManage && <button type="button" className="day-delete" onClick={() => deleteTask(task)} title="Excluir atividade"><Trash2 size={16} /></button>}
          </article>)}
        </div>
      </section>
    </main>
  );
}
