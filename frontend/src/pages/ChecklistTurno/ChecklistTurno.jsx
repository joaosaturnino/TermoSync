/**
 * Módulo: frontend/src/pages/ChecklistTurno/ChecklistTurno.jsx
 * Responsabilidade: Implementa a tela Checklist Turno, seus estados, interações e integrações de dados.
 */

import { ChevronRight, Download, LoaderCircle, RotateCcw } from 'lucide-react';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import logger from '../../utils/logger';
import {
  CheckCircle2, ListChecks, RefreshCw,
  ShieldCheck, Check,
  Plus, Trash2, X, Clock, FileText
} from 'lucide-react';
import './ChecklistTurno.css';
import { canRolePerform } from '../../config/navigationPolicy';

const CHECKLIST_TEMPLATE = [
  { id: 'pre-turno', shortTitle: 'Abertura', title: 'Pré-turno', description: 'Validações antes do início da operação.' },
  { id: 'operacao', shortTitle: 'Operação', title: 'Operação contínua', description: 'Rotinas de acompanhamento durante o expediente.' },
  { id: 'encerramento', shortTitle: 'Fechamento', title: 'Encerramento', description: 'Conferências finais e registro do turno.' }
];
const SECTION_INDEX = { 'pre-turno': 0, operacao: 1, encerramento: 2 };

/**
 * Concentra a logica de map tasks to sections para manter o restante do tela mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} rows - Valor de rows consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function mapTasksToSections(rows = []) {
  const sections = CHECKLIST_TEMPLATE.map((section) => ({ ...section, items: [] }));
  rows.forEach((row) => {
    const index = SECTION_INDEX[row.chave] ?? SECTION_INDEX[row.key] ?? 0;
    sections[index].items.push({ id: row.id, label: row.titulo, checked: Boolean(row.concluida), description: row.descricao || '', time: row.horario || '' });
  });
  return sections;
}

/**
 * Escapa campos do relatório para produzir um CSV válido.
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
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador; troca eventos em tempo real
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function csvField(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; } /* Central operacional para executar e acompanhar o checklist diário da filial. */ export default function ChecklistTurno({ api, filialAtiva, showToast, userRole = 'LOJA', socket }) { const [sections, setSections] = useState(() => mapTasksToSections()); const [activeSection, setActiveSection] = useState('pre-turno'); const [isSyncing, setIsSyncing] = useState(true); const [isResetting, setIsResetting] = useState(false); const [pendingItemId, setPendingItemId] = useState(null); const [addingTaskTo, setAddingTaskTo] = useState(null); const [newTaskText, setNewTaskText] = useState(''); const [lastSync, setLastSync] = useState(null); const canManageTasks = canRolePerform(userRole, 'MANAGE_OPERATION_TASKS'); const branch = filialAtiva && filialAtiva !== 'Todas' ? filialAtiva : 'Matriz'; /* Exibe uma notificação pela aplicação e mantém fallback para desenvolvimento. */ const notify = useCallback((message, type = 'info') => { if (showToast) showToast(message, type); else logger.info(`[${type.toUpperCase()}] ${message}`); }, [showToast]);
  const loadTasks = useCallback(async ({ silent = false } = {}) => {
    if (!api) return;
    if (!silent) setIsSyncing(true);
    try {
      const response = await api.get(`/operacao/tarefas?tipo=checklist_turno&filial=${encodeURIComponent(branch)}`);
      setSections(mapTasksToSections(Array.isArray(response.data) ? response.data : []));
      setLastSync(new Date());
    } catch (error) {
      notify(error.response?.data?.error || 'Não foi possível carregar o checklist.', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [api, branch, notify]);
  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { if (!socket) return undefined; const refresh = () => loadTasks({ silent: true }); socket.on('operacao_atualizada', refresh); return () => socket.off('operacao_atualizada', refresh); }, [loadTasks, socket]);
  const stats = useMemo(() => { const items = sections.flatMap((section) => section.items); const completed = items.filter((item) => item.checked).length; return { total: items.length, completed, pending: items.length - completed, progress: items.length ? Math.round((completed / items.length) * 100) : 0, next: items.find((item) => !item.checked) || null }; }, [sections]);
  const selectedSection = sections.find((section) => section.id === activeSection) || sections[0];
  /**
   * Processa a interacao de toggle item e atualiza a interface conforme o resultado.
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
   * @param {string|number} sectionId - Identificador do registro ou recurso processado.
   * @param {unknown} item - Valor de item consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const toggleItem = async (sectionId, item) => {
    if (!item?.id || !api || pendingItemId) return;
    const nextChecked = !item.checked;
    const nextTime = nextChecked ? new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    setPendingItemId(item.id);
    setSections((current) => current.map((section) => section.id === sectionId ? { ...section, items: section.items.map((entry) => entry.id === item.id ? { ...entry, checked: nextChecked, time: nextTime } : entry) } : section));
    try {
      await api.put(`/operacao/tarefas/${item.id}`, { concluida: nextChecked });
    } catch (error) {
      notify('Falha ao sincronizar a verificação.', 'error');
      await loadTasks({ silent: true });
    } finally {
      setPendingItemId(null);
    }
  };

  /**
   * Cadastra uma rotina adicional na etapa escolhida.
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
   * @param {string|number} sectionId - Identificador do registro ou recurso processado.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const addTask = async (event, sectionId) => {
    event.preventDefault();
    const title = newTaskText.trim();
    if (!title || !api || !canManageTasks) return;
    try {
      await api.post('/operacao/tarefas', { tipo: 'checklist_turno', chave: sectionId, titulo: title, concluida: false, filial: branch });
      setNewTaskText(''); setAddingTaskTo(null);
      notify('Rotina adicionada ao turno.', 'success');
      await loadTasks({ silent: true });
    } catch (error) { notify('Não foi possível adicionar a rotina.', 'error'); }
  };

  /**
   * Remove uma rotina após confirmação para evitar exclusões acidentais.
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
   * @param {unknown} item - Valor de item consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const deleteTask = async (item) => {
    if (!api || !canManageTasks || !window.confirm(`Excluir a rotina "${item.label}"?`)) return;
    try {
      await api.delete(`/operacao/tarefas/${item.id}`);
      notify('Rotina excluída.', 'success');
      await loadTasks({ silent: true });
    } catch (error) { notify('Não foi possível excluir a rotina.', 'error'); }
  };

  /**
   * Zera somente as tarefas concluídas e inicia um novo ciclo operacional.
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
  const resetChecklist = async () => {
    if (!api || !stats.completed || !window.confirm('Iniciar um novo turno e zerar todas as verificações concluídas?')) return;
    setIsResetting(true);
    try {
      const completedItems = sections.flatMap((section) => section.items).filter((item) => item.checked);
      await Promise.all(completedItems.map((item) => api.put(`/operacao/tarefas/${item.id}`, { concluida: false })));
      notify('Novo turno iniciado.', 'success');
      await loadTasks({ silent: true });
    } catch (error) { notify('Não foi possível reiniciar o turno.', 'error'); }
    finally { setIsResetting(false); }
  };

  /**
   * Exporta o estado atual do turno para auditoria em formato CSV.
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
    const rows = [['Etapa', 'Tarefa', 'Status', 'Conclusão', 'Filial']];
    sections.forEach((section) => section.items.forEach((item) => rows.push([section.title, item.label, item.checked ? 'Concluído' : 'Pendente', item.time || '', branch])));
    const csv = rows.map((row) => row.map(csvField).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `checklist-turno-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    URL.revokeObjectURL(url);
    notify('Relatório do turno exportado.', 'success');
  };

  return (
    <main className="shift-checklist anim-fade-in">
      <header className="shift-header">
        <div><span className="shift-eyebrow"><ShieldCheck size={15} /> Rotina operacional</span><h2>Checklist de turno</h2><p>{branch} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}</p></div>
        <div className="shift-header-actions">
          <button type="button" className="shift-button secondary" onClick={exportReport} disabled={!stats.total}><Download size={16} /> Exportar</button>
          <button type="button" className="shift-button danger" onClick={resetChecklist} disabled={isResetting || !stats.completed}>{isResetting ? <LoaderCircle className="spin" size={16} /> : <RotateCcw size={16} />} Novo turno</button>
        </div>
      </header>

      <section className="shift-overview" aria-label="Resumo do turno">
        <div className="shift-progress-ring" style={{ '--progress': `${stats.progress * 3.6}deg` }}><div><strong>{stats.progress}%</strong><span>concluído</span></div></div>
        <div className="shift-overview-copy">
          <span className={`shift-state ${stats.progress === 100 ? 'complete' : ''}`}>{stats.progress === 100 ? <CheckCircle2 size={15} /> : <Clock size={15} />}{stats.progress === 100 ? 'Turno verificado' : `${stats.pending} verificações pendentes`}</span>
          <h3>{stats.next ? stats.next.label : 'Todas as rotinas foram concluídas'}</h3>
          <p>{stats.next ? 'Próxima ação recomendada para avançar no ciclo.' : 'O turno está pronto para fechamento e exportação.'}</p>
        </div>
        <div className="shift-sync"><RefreshCw size={15} className={isSyncing ? 'spin' : ''} /><span>{isSyncing ? 'Sincronizando' : 'Sincronizado'}</span><small>{lastSync ? lastSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</small></div>
      </section>

      <section className="shift-workspace">
        <nav className="shift-stage-nav" aria-label="Etapas do checklist">
          <div className="stage-nav-heading"><ListChecks size={17} /><span>Etapas do turno</span></div>
          {sections.map((section, index) => {
            const completed = section.items.filter((item) => item.checked).length;
            const percentage = section.items.length ? Math.round((completed / section.items.length) * 100) : 0;
            return <button key={section.id} type="button" className={`stage-nav-item ${activeSection === section.id ? 'active' : ''}`} onClick={() => setActiveSection(section.id)}><span className="stage-index">{percentage === 100 && section.items.length ? <Check size={15} /> : index + 1}</span><span className="stage-nav-copy"><strong>{section.shortTitle}</strong><small>{completed} de {section.items.length}</small></span><span className="stage-mini-progress"><i style={{ width: `${percentage}%` }} /></span><ChevronRight size={16} /></button>;
          })}
          <div className="shift-counts"><span><strong>{stats.completed}</strong> concluídas</span><span><strong>{stats.pending}</strong> pendentes</span></div>
        </nav>

        <article className="shift-task-panel">
          <div className="task-panel-header"><div><span>Etapa {SECTION_INDEX[selectedSection.id] + 1} de 3</span><h3>{selectedSection.title}</h3><p>{selectedSection.description}</p></div><strong>{selectedSection.items.filter((item) => item.checked).length}/{selectedSection.items.length}</strong></div>
          <div className="shift-task-list">
            {!selectedSection.items.length && <div className="shift-empty"><ListChecks size={28} /><strong>Nenhuma rotina nesta etapa</strong><span>Adicione a primeira verificação para iniciar.</span></div>}
            {selectedSection.items.map((item, index) => <div key={item.id} className={`shift-task ${item.checked ? 'checked' : ''}`}>
              <button type="button" className="task-check" onClick={() => toggleItem(selectedSection.id, item)} disabled={pendingItemId === item.id} aria-label={item.checked ? `Reabrir ${item.label}` : `Concluir ${item.label}`}>{pendingItemId === item.id ? <LoaderCircle className="spin" size={16} /> : item.checked ? <Check size={17} /> : <span>{index + 1}</span>}</button>
              <button type="button" className="task-main" onClick={() => toggleItem(selectedSection.id, item)} disabled={pendingItemId === item.id}><strong>{item.label}</strong><span>{item.checked ? `Verificado${item.time ? ` às ${item.time}` : ''}` : item.description || 'Aguardando verificação'}</span></button>
              {canManageTasks && <button type="button" className="task-delete" onClick={() => deleteTask(item)} title="Excluir rotina"><Trash2 size={16} /></button>}
            </div>)}
          </div>
          {canManageTasks && <div className="task-add-area">{addingTaskTo === selectedSection.id ? <form className="task-add-form" onSubmit={(event) => addTask(event, selectedSection.id)}><input autoFocus maxLength={120} value={newTaskText} onChange={(event) => setNewTaskText(event.target.value)} placeholder="Descreva a nova verificação" /><button type="button" onClick={() => { setAddingTaskTo(null); setNewTaskText(''); }} title="Cancelar"><X size={17} /></button><button type="submit" disabled={!newTaskText.trim()} title="Adicionar"><Check size={17} /></button></form> : <button type="button" className="task-add-button" onClick={() => setAddingTaskTo(selectedSection.id)}><Plus size={16} /> Adicionar rotina</button>}</div>}
        </article>
      </section>
      <footer className="shift-footer-note"><FileText size={15} /> As alterações são compartilhadas em tempo real com os usuários da filial.</footer>
    </main>
  );
}
