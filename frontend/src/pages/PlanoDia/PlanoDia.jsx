import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  CalendarDays, CheckCircle2, ClipboardList, Clock3, 
  Sparkles, Target, Users, Check, Trash2, Plus, 
  X, Server, FileText, DownloadCloud, RefreshCw, Wand2, Clock
} from 'lucide-react';
import './PlanoDia.css';

// Rotinas do Plano do Dia (Auto-Seed)
const metasPadrao = [
  { chave: 'meta-1', titulo: 'Validar presenças e faltas da equipa do turno', horario: '08:00' },
  { chave: 'meta-2', titulo: 'Revisar anomalias pendentes de ontem no NOC', horario: '08:30' },
  { chave: 'meta-3', titulo: 'Inspecionar balcões da frente de loja (Limpeza/Organização)', horario: '09:00' },
  { chave: 'meta-4', titulo: 'Verificar SLAs de chamados técnicos abertos', horario: '10:00' },
  { chave: 'meta-5', titulo: 'Validar ciclo térmico na ilha de congelados (Pico)', horario: '12:00' },
  { chave: 'meta-6', titulo: 'Auditoria de mercadorias no corredor de laticínios', horario: '14:00' },
  { chave: 'meta-7', titulo: 'Revisar KWH / Consumo de Energia parcial do dia', horario: '15:30' },
  { chave: 'meta-8', titulo: 'Acompanhar recebimento e armazenagem na câmara fria', horario: '16:00' },
  { chave: 'meta-9', titulo: 'Sincronizar relatório com a Manutenção Central', horario: '17:30' },
  { chave: 'meta-10', titulo: 'Reunião de alinhamento com encarregados de setor', horario: '18:00' },
  { chave: 'meta-11', titulo: 'Inspecionar cortinas de ar para o turno da noite', horario: '19:30' },
  { chave: 'meta-12', titulo: 'Conferência final do painel de alarmes e temperatura', horario: '21:00' },
  { chave: 'meta-13', titulo: 'Consolidar relatório diário (Fecho de Operação)', horario: '21:45' },
  { chave: 'meta-14', titulo: 'Ativar Lockdown Digital dos equipamentos / Encerramento', horario: '22:00' }
];

export default function PlanoDia({ api, filialAtiva, showToast, userRole = 'LOJA' }) {
  const [tasks, setTasks] = useState([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');

  // Verificação de Acesso: Apenas Admin, Manutenção ou Dev podem gerenciar
  const roleFormatada = (userRole || 'LOJA').toUpperCase();
  const canManageTasks = ['ADMIN', 'MANUTENCAO', 'DEV'].includes(roleFormatada);

  const emitToast = (msg, type) => {
    if (showToast) showToast(msg, type);
    else console.log(`[${type.toUpperCase()}] ${msg}`);
  };

  const carregarTarefas = useCallback(async () => {
    if (!api) return;
    try {
      const query = filialAtiva && filialAtiva !== 'Todas' ? `?tipo=plano_dia&filial=${encodeURIComponent(filialAtiva)}` : '?tipo=plano_dia';
      const res = await api.get(`/operacao/tarefas${query}`);
      const tarefasDB = res.data || [];
      
      // AUTO-SEED: Injeção das Metas Padrão
      if (tarefasDB.length === 0 && canManageTasks && !isSyncing) {
         emitToast('A construir estrutura do Plano do Dia...', 'info');
         await Promise.all(metasPadrao.map(meta => 
           api.post('/operacao/tarefas', {
             tipo: 'plano_dia', chave: meta.chave, titulo: meta.titulo,
             descricao: meta.horario, // Usamos o campo descrição p/ guardar a hora estipulada
             concluida: false, filial: filialAtiva === 'Todas' ? 'Matriz' : filialAtiva
           })
         ));
         const resAtualizada = await api.get(`/operacao/tarefas${query}`);
         setTasks(resAtualizada.data || []);
      } else {
         setTasks(tarefasDB);
      }
      setIsSyncing(false);
    } catch (e) {
      setIsSyncing(false);
    }
  }, [api, filialAtiva, canManageTasks, isSyncing]);

  useEffect(() => {
    carregarTarefas();
    const interval = window.setInterval(() => carregarTarefas(), 15000);
    return () => window.clearInterval(interval);
  }, [carregarTarefas]);

  const completedCount = useMemo(() => tasks.filter(t => t.concluida).length, [tasks]);
  const progress = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  // --- AÇÕES DA API ---

  const toggleTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !api) return;

    const nextChecked = !task.concluida;
    
    // UI Otimista
    setTasks(current => current.map(t => 
      t.id === id ? { ...t, concluida: nextChecked, horario: nextChecked ? new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : null } : t
    ));

    try {
      await api.put(`/operacao/tarefas/${id}`, { concluida: nextChecked });
    } catch (e) {
      emitToast('Falha ao sincronizar com o servidor.', 'error');
      carregarTarefas(); 
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim() || !api || !canManageTasks) return;

    const payload = {
      tipo: 'plano_dia',
      chave: `meta-${Date.now()}`,
      titulo: newTaskText.trim(),
      descricao: newTaskTime || '--:--', // Guarda o horário planeado
      concluida: false,
      filial: filialAtiva === 'Todas' ? 'Matriz' : filialAtiva
    };

    try {
      await api.post('/operacao/tarefas', payload);
      emitToast('Meta adicionada ao cronograma.', 'success');
      setNewTaskText(''); setNewTaskTime(''); setIsAdding(false);
      carregarTarefas();
    } catch (err) {
      emitToast('Erro ao criar meta.', 'error');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!api || !canManageTasks) return;
    try {
      await api.delete(`/operacao/tarefas/${itemId}`);
      emitToast('Meta removida do plano.', 'success');
      carregarTarefas();
    } catch (err) {
      emitToast('Falha ao excluir.', 'error');
    }
  };

  const resetPlano = async () => {
    if (!api) return;
    setIsResetting(true);
    emitToast('Iniciando ciclo diário...', 'info');
    
    try {
      const checkedItems = tasks.filter(i => i.concluida);
      await Promise.all(checkedItems.map(item => 
        api.put(`/operacao/tarefas/${item.id}`, { concluida: false })
      ));
      
      emitToast('Cronograma diário resetado com sucesso.', 'success');
      carregarTarefas();
    } catch (e) {
      emitToast('Falha ao reiniciar o plano.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // --- RELATÓRIOS ---
  const exportarRelatorio = (tipo) => {
    emitToast(`Extraindo cronograma ${tipo}...`, 'info');
    
    let csvContent = "Horário Previsto,Meta/Atividade,Status,Hora de Conclusão\n";
    tasks.forEach(item => {
      csvContent += `"${item.descricao || '--'}","${item.titulo}","${item.concluida ? 'Concluído' : 'Pendente'}","${item.horario || 'N/A'}"\n`;
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); 
    link.href = URL.createObjectURL(blob); 
    link.download = `PlanoOperacional_${tipo}_${Date.now()}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    
    setTimeout(() => emitToast(`Cronograma ${tipo} exportado!`, 'success'), 800);
  };

  return (
    <div className="plano-dia anim-fade-in">
      <section className="hero-plano-dia">
        <div>
          <div className="hero-badge-plano-dia">
            <CalendarDays size={14} /> Cronograma Operacional
          </div>
          <h3>Plano do Dia & Gestão de Metas</h3>
          <p>
            {canManageTasks 
              ? "Estruture as prioridades. Como Administrador/Técnico, você pode adicionar novas metas para as lojas." 
              : "Acompanhe e valide o cronograma estabelecido para garantir a eficiência das operações diárias."}
          </p>
        </div>
        <div className="hero-summary-plano-dia">
          <span><Target size={14} color={progress === 100 ? '#10b981' : '#a78bfa'} /> {completedCount}/{tasks.length} Concluídas</span>
          <span><Clock3 size={14} color="#38bdf8" /> Meta: {progress}%</span>
          <span><Users size={14} color="#f59e0b" /> {isSyncing ? 'Sincronizando...' : 'Painel em Tempo Real'}</span>
        </div>
      </section>

      <section className="progress-card-plano">
        <div className="progress-meta-plano">
          <strong>Acompanhamento do Dia</strong>
          <div className="action-buttons-group">
            <button type="button" className="report-btn" onClick={() => exportarRelatorio('Diario')} title="Baixar CSV">
              <FileText size={14} /> Relatório Diário
            </button>
            <button type="button" className="report-btn" onClick={() => exportarRelatorio('Semanal')} title="Baixar CSV">
              <DownloadCloud size={14} /> Semanal
            </button>
            <button type="button" className="reset-btn" onClick={resetPlano} disabled={isResetting || completedCount === 0}>
              {isResetting ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />} INICIAR NOVO DIA
            </button>
          </div>
        </div>
        <div className="progress-bar-plano">
          <div className={`progress-bar-fill-plano ${progress === 100 ? 'complete' : ''}`} style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section className="tasks-plano">
        {tasks.length === 0 && <div style={{color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem', fontStyle: 'italic'}}>Nenhuma meta operacional definida para hoje.</div>}
        
        {tasks.map(task => (
          <article key={task.id} className={`task-plano ${task.concluida ? 'done' : ''}`}>
            
            <label className="task-label-plano">
              <input type="checkbox" checked={Boolean(task.concluida)} onChange={() => toggleTask(task.id)} />
              <div className="custom-checkbox">
                 {task.concluida && <Check size={14} color="white" strokeWidth={4} />}
              </div>
              <div className="item-content">
                <h4>{task.titulo}</h4>
                <p>
                  <Clock size={12}/> 
                  Meta: {task.descricao || '--:--'} 
                  {task.concluida && task.horario && <span style={{color: '#10b981', marginLeft: '6px', fontWeight: 'bold'}}>• Validação às {task.horario}</span>}
                </p>
              </div>
            </label>
            
            <div className="task-actions-group">
              <div className="task-status-plano">
                {task.concluida ? <CheckCircle2 size={18} /> : <ClipboardList size={18} />}
              </div>
              
              {canManageTasks && (
                <div className="task-actions">
                  <button type="button" className="btn-icon-tiny" onClick={() => handleDeleteItem(task.id)} title="Remover Meta">
                    <Trash2 size={16}/>
                  </button>
                </div>
              )}
            </div>

          </article>
        ))}

        {/* Input Dinâmico de Nova Meta (Aparece APENAS para Admin/Manutencao/Dev) */}
        {canManageTasks && (
          <div className="add-task-container">
            {isAdding ? (
              <form onSubmit={handleAddTask} className="add-task-form">
                 <input 
                   type="time"
                   value={newTaskTime} 
                   onChange={e => setNewTaskTime(e.target.value)} 
                   required
                 />
                 <input 
                   type="text"
                   autoFocus 
                   value={newTaskText} 
                   onChange={e => setNewTaskText(e.target.value)} 
                   placeholder="Ex: Verificar relatório de energia semanal..." 
                   maxLength={100}
                   required
                 />
                 <div className="add-task-actions">
                   <button type="button" className="btn-cancel-task" onClick={() => {setIsAdding(false); setNewTaskText(''); setNewTaskTime('');}}><X size={14}/></button>
                   <button type="submit" className="btn-submit-task" disabled={!newTaskText.trim()}><Check size={14}/></button>
                 </div>
              </form>
            ) : (
              <button type="button" className="btn-add-task" onClick={() => setIsAdding(true)}>
                <Plus size={16} /> ADICIONAR NOVA META AO CRONOGRAMA
              </button>
            )}
          </div>
        )}

      </section>

      <section className="footer-plano">
        <div className="footer-pill-plano">
          <Server size={14} />
          Pool de sincronização: Persistência diária garantida.
        </div>
      </section>
    </div>
  );
}