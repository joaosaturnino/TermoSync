import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  CheckCircle2, ClipboardList, ListChecks, RefreshCw, 
  ShieldCheck, TimerReset, TrendingUp, Check, 
  Plus, Trash2, X, Clock, Server, FileText, DownloadCloud
} from 'lucide-react';
import './ChecklistTurno.css';

const STORAGE_KEY = 'termosync-checklist-turno-v3';

const initialChecklistTemplate = [
  {
    id: 'pre-turno',
    title: 'Pré-Turno (Abertura)',
    description: 'Validações iniciais de infraestrutura antes da operação.',
    items: []
  },
  {
    id: 'operacao',
    title: 'Operação Contínua',
    description: 'Monitoramento de rotina durante o expediente.',
    items: []
  },
  {
    id: 'encerramento',
    title: 'Encerramento (Fechamento)',
    description: 'Auditoria final e logs de fechamento de loja.',
    items: []
  }
];

// Array expandido: 21 Rotinas Automáticas Padrão (Seed Automático)
const rotinasPadrao = [
  // PRÉ-TURNO
  { chave: 'pre-turno', titulo: 'Verificar temperatura das câmaras frias e balcões' },
  { chave: 'pre-turno', titulo: 'Inspecionar painel elétrico e disjuntores gerais' },
  { chave: 'pre-turno', titulo: 'Validar conexão de rede do Gateway Edge (Wi-Fi/LAN)' },
  { chave: 'pre-turno', titulo: 'Checar integridade dos selos das portas das câmaras' },
  { chave: 'pre-turno', titulo: 'Verificar funcionamento dos compressores principais' },
  { chave: 'pre-turno', titulo: 'Inspecionar possíveis vazamentos de fluidos refrigerantes' },
  { chave: 'pre-turno', titulo: 'Conferir iluminação interna e externa dos equipamentos' },
  
  // OPERAÇÃO
  { chave: 'operacao', titulo: 'Monitorar alarmes críticos no painel NOC' },
  { chave: 'operacao', titulo: 'Validar ciclo de degelo da ilha de congelados' },
  { chave: 'operacao', titulo: 'Checar fechamento hermético das portas após abastecimento' },
  { chave: 'operacao', titulo: 'Monitorar consumo de energia (KWh) fora do padrão' },
  { chave: 'operacao', titulo: 'Verificar ruídos anormais nos motores e exaustores' },
  { chave: 'operacao', titulo: 'Confirmar estabilidade do sinal dos sensores IoT' },
  { chave: 'operacao', titulo: 'Registrar variações térmicas drásticas durante horário de pico' },
  { chave: 'operacao', titulo: 'Inspecionar acúmulo de gelo excessivo nos evaporadores' },
  
  // ENCERRAMENTO
  { chave: 'encerramento', titulo: 'Exportar relatório diário de eficiência e conformidade' },
  { chave: 'encerramento', titulo: 'Garantir rotina de purga de dados e backup diário' },
  { chave: 'encerramento', titulo: 'Ativar setpoints de economia/lockdown noturno' },
  { chave: 'encerramento', titulo: 'Desligar iluminação de vitrines e equipamentos não essenciais' },
  { chave: 'encerramento', titulo: 'Verificar fechamento de todas as cortinas noturnas dos balcões' },
  { chave: 'encerramento', titulo: 'Confirmar que nenhum alarme crítico ficou pendente sem nota' }
];

const sectionIndexByKey = {
  'pre-turno': 0,
  'operacao': 1,
  'encerramento': 2
};

export default function ChecklistTurno({ api, filialAtiva, showToast, userRole = 'LOJA' }) {
  const [sections, setSections] = useState(initialChecklistTemplate);
  const [isSyncing, setIsSyncing] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [addingTaskTo, setAddingTaskTo] = useState(null);
  const [newTaskText, setNewTaskText] = useState('');

  // Verificação de Acesso: Apenas Admin, Manutenção ou Dev podem gerenciar (adicionar/excluir) tarefas
  const roleFormatada = userRole.toUpperCase();
  const canManageTasks = ['ADMIN', 'MANUTENCAO', 'DEV'].includes(roleFormatada);

  const emitToast = (msg, type) => {
    if (showToast) showToast(msg, type);
    else console.log(`[${type.toUpperCase()}] ${msg}`);
  };

  const buildSections = useCallback((rows = []) => {
    const newSections = initialChecklistTemplate.map((section) => ({ ...section, items: [] }));
    rows.forEach((row) => {
      const sectionIndex = sectionIndexByKey[row.chave] ?? sectionIndexByKey[row.key] ?? 0;
      const section = newSections[sectionIndex];
      if (section) {
        section.items.push({
          id: row.id,
          label: row.titulo,
          checked: Boolean(row.concluida),
          description: row.descricao || '',
          time: row.horario || ''
        });
      }
    });
    return newSections;
  }, []);

  const carregarTarefas = useCallback(async () => {
    if (!api) return;
    try {
      const query = filialAtiva && filialAtiva !== 'Todas' ? `?tipo=checklist_turno&filial=${encodeURIComponent(filialAtiva)}` : '?tipo=checklist_turno';
      const res = await api.get(`/operacao/tarefas${query}`);
      const tarefasDB = res.data || [];
      
      // AUTO-SEED: Se o banco estiver vazio e o usuário tiver permissão, injeta as mais de 20 tarefas padrão
      if (tarefasDB.length === 0 && canManageTasks && !isSyncing) {
         emitToast('Banco vazio. Injetando 21 rotinas padrão...', 'info');
         await Promise.all(rotinasPadrao.map(rotina => 
           api.post('/operacao/tarefas', {
             tipo: 'checklist_turno', chave: rotina.chave, titulo: rotina.titulo,
             concluida: false, filial: filialAtiva === 'Todas' ? 'Matriz' : filialAtiva
           })
         ));
         // Chama a si mesmo novamente para carregar as tarefas injetadas
         const resAtualizada = await api.get(`/operacao/tarefas${query}`);
         setSections(buildSections(resAtualizada.data || []));
      } else {
         setSections(buildSections(tarefasDB));
      }
      setIsSyncing(false);
    } catch (e) {
      setIsSyncing(false);
    }
  }, [api, filialAtiva, buildSections, canManageTasks, isSyncing]);

  useEffect(() => {
    carregarTarefas();
    const interval = window.setInterval(() => carregarTarefas(), 15000);
    return () => window.clearInterval(interval);
  }, [carregarTarefas]);

  const stats = useMemo(() => {
    const total = sections.reduce((sum, section) => sum + section.items.length, 0);
    const completed = sections.reduce((sum, section) => sum + section.items.filter((item) => item.checked).length, 0);
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, progress };
  }, [sections]);

  // --- AÇÕES DA API ---

  const toggleItem = async (sectionIndex, itemIndex) => {
    const item = sections[sectionIndex]?.items?.[itemIndex];
    if (!item?.id || !api) return;

    const nextChecked = !item.checked;
    
    setSections((current) => current.map((section, index) => 
      index === sectionIndex ? { ...section, items: section.items.map((entry, innerIndex) => 
        innerIndex === itemIndex ? { ...entry, checked: nextChecked, time: nextChecked ? new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '' } : entry
      )} : section
    ));

    try {
      await api.put(`/operacao/tarefas/${item.id}`, { concluida: nextChecked });
    } catch (e) {
      emitToast('Falha ao sincronizar com o servidor.', 'error');
      carregarTarefas(); 
    }
  };

  const handleAddTask = async (e, sectionId) => {
    e.preventDefault();
    if (!newTaskText.trim() || !api || !canManageTasks) return;

    const payload = {
      tipo: 'checklist_turno',
      chave: sectionId,
      titulo: newTaskText.trim(),
      concluida: false,
      filial: filialAtiva === 'Todas' ? 'Matriz' : filialAtiva
    };

    try {
      await api.post('/operacao/tarefas', payload);
      emitToast('Tarefa provisionada com sucesso.', 'success');
      setNewTaskText('');
      setAddingTaskTo(null);
      carregarTarefas();
    } catch (err) {
      emitToast('Erro ao criar tarefa no servidor.', 'error');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!api || !canManageTasks) return;
    try {
      await api.delete(`/operacao/tarefas/${itemId}`);
      emitToast('Registro excluído.', 'success');
      carregarTarefas();
    } catch (err) {
      emitToast('Falha ao excluir tarefa.', 'error');
    }
  };

  const resetChecklist = async () => {
    if (!api) return;
    setIsResetting(true);
    emitToast('Iniciando purga e reset do turno diário...', 'info');
    
    try {
      const checkedItems = sections.flatMap(s => s.items).filter(i => i.checked);
      await Promise.all(checkedItems.map(item => 
        api.put(`/operacao/tarefas/${item.id}`, { concluida: false })
      ));
      
      emitToast('Turno reiniciado. Verificação diária zerada.', 'success');
      carregarTarefas();
    } catch (e) {
      emitToast('Falha ao reiniciar o turno globalmente.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // --- RELATÓRIOS ---
  const exportarRelatorio = (tipo) => {
    emitToast(`Gerando relatório ${tipo}...`, 'info');
    
    let csvContent = "Seção,Tarefa,Status,Hora_Conclusão\n";
    sections.forEach(sec => {
      sec.items.forEach(item => {
        csvContent += `"${sec.title}","${item.label}","${item.checked ? 'Concluído' : 'Pendente'}","${item.time || 'N/A'}"\n`;
      });
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); 
    link.href = URL.createObjectURL(blob); 
    link.download = `Relatorio_Turno_${tipo}_${Date.now()}.csv`;
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
    
    setTimeout(() => emitToast(`Relatório ${tipo} exportado com sucesso!`, 'success'), 800);
  };

  return (
    <div className="checklist-turno anim-fade-in">
      <section className="hero-checklist">
        <div>
          <div className="hero-badge-checklist">
            <Server size={14} /> Protocolo Operacional Diário
          </div>
          <h3>Checklist de Turno & Validação de Status</h3>
          <p>
            {canManageTasks 
              ? "Supervisione os nós críticos da operação. Como Administrador/Técnico, você pode cadastrar novas tarefas." 
              : "Realize a verificação diária das rotinas operacionais estabelecidas pela engenharia."}
          </p>
        </div>
        <div className="hero-summary-checklist">
          <span><TrendingUp size={14} color={stats.progress === 100 ? '#10b981' : '#38bdf8'} /> {stats.progress}% Verificado</span>
          <span><CheckCircle2 size={14} color="#10b981" /> {stats.completed}/{stats.total} Rotinas Diárias</span>
          <span><ShieldCheck size={14} color="#f59e0b" /> {isSyncing ? 'Sincronizando...' : 'Auditoria em Tempo Real'}</span>
        </div>
      </section>

      <section className="progress-card">
        <div className="progress-meta">
          <strong>Andamento do Ciclo Operacional</strong>
          <div className="action-buttons-group">
            <button type="button" className="report-btn" onClick={() => exportarRelatorio('Diario')} title="Baixar CSV Diário">
              <FileText size={14} /> Relatório Diário
            </button>
            <button type="button" className="report-btn" onClick={() => exportarRelatorio('Semanal')} title="Baixar CSV Semanal">
              <DownloadCloud size={14} /> Semanal
            </button>
            <button type="button" className="report-btn" onClick={() => exportarRelatorio('Mensal')} title="Baixar CSV Mensal">
              <DownloadCloud size={14} /> Mensal
            </button>
            <button type="button" className="reset-btn" onClick={resetChecklist} disabled={isResetting || stats.completed === 0}>
              {isResetting ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />} NOVO TURNO (RESET)
            </button>
          </div>
        </div>
        <div className="progress-bar">
          <div className={`progress-bar-fill ${stats.progress === 100 ? 'complete' : ''}`} style={{ width: `${stats.progress}%` }} />
        </div>
      </section>

      <section className="checklist-sections">
        {sections.map((section, sectionIndex) => (
          <article key={section.id} className="checklist-section">
            
            <div className="section-header">
              <div>
                <h4>{section.title}</h4>
                <p>{section.description}</p>
              </div>
              <div className="section-counter" style={{ color: section.items.every(i => i.checked) && section.items.length > 0 ? '#10b981' : '#38bdf8', borderColor: section.items.every(i => i.checked) && section.items.length > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(56,189,248,0.2)' }}>
                <ListChecks size={14} />
                {section.items.filter((item) => item.checked).length}/{section.items.length}
              </div>
            </div>

            <ul className="checklist-items">
              {section.items.length === 0 && <li style={{color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: '10px', fontStyle: 'italic'}}>Nenhuma rotina mapeada.</li>}
              
              {section.items.map((item, itemIndex) => (
                <li key={`${section.id}-${item.id}`} className={`checklist-item ${item.checked ? 'checked' : ''}`}>
                  <label className="checklist-label">
                    <input type="checkbox" checked={item.checked} onChange={() => toggleItem(sectionIndex, itemIndex)} />
                    <div className="custom-checkbox">
                       {item.checked && <Check size={14} color="white" strokeWidth={4} />}
                    </div>
                    <div className="item-content">
                      <span className="item-title">{item.label}</span>
                      {item.checked && item.time && <span className="item-time"><Clock size={10}/> Verificado às {item.time}</span>}
                    </div>
                  </label>
                  
                  {/* Ação de Excluir aparece APENAS para Admin/Manutencao/Dev */}
                  {canManageTasks && (
                    <div className="task-actions">
                      <button type="button" className="btn-icon-tiny" onClick={() => handleDeleteItem(item.id)} title="Excluir Rotina"><Trash2 size={14}/></button>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Input Dinâmico de Nova Tarefa (Aparece APENAS para Admin/Manutencao/Dev) */}
            {canManageTasks && (
              <div className="add-task-container">
                {addingTaskTo === section.id ? (
                  <form onSubmit={(e) => handleAddTask(e, section.id)} className="add-task-form">
                     <input 
                       autoFocus 
                       value={newTaskText} 
                       onChange={e => setNewTaskText(e.target.value)} 
                       placeholder="Nova tarefa de verificação..." 
                       maxLength={80}
                     />
                     <div className="add-task-actions">
                       <button type="button" className="btn-cancel-task" onClick={() => {setAddingTaskTo(null); setNewTaskText('');}}><X size={14}/></button>
                       <button type="submit" className="btn-submit-task" disabled={!newTaskText.trim()}><Check size={14}/></button>
                     </div>
                  </form>
                ) : (
                  <button type="button" className="btn-add-task" onClick={() => {setAddingTaskTo(section.id); setNewTaskText('');}}>
                    <Plus size={14} /> ADICIONAR TAREFA
                  </button>
                )}
              </div>
            )}

          </article>
        ))}
      </section>

      <section className="checklist-footer">
        <div className="footer-pill">
          <TimerReset size={14} />
          Pool de sincronização: Atualização contínua entre usuários.
        </div>
      </section>
    </div>
  );
}