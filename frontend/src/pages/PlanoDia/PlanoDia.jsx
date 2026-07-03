import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Sparkles,
  Target,
  Users
} from 'lucide-react';
import './PlanoDia.css';

const initialTasks = [
  { id: 1, title: 'Revisar alertas críticos', time: '08:00', done: true },
  { id: 2, title: 'Validar temperatura das áreas prioritárias', time: '09:00', done: false },
  { id: 3, title: 'Acompanhar chamados em andamento', time: '11:00', done: false },
  { id: 4, title: 'Consolidar relatório de turno', time: '16:00', done: false }
];

export default function PlanoDia({ api, filialAtiva }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [isSyncing, setIsSyncing] = useState(true);

  const carregarTarefas = async () => {
    if (!api) return;
    try {
      const query = filialAtiva && filialAtiva !== 'Todas' ? `?tipo=plano_dia&filial=${encodeURIComponent(filialAtiva)}` : '?tipo=plano_dia';
      const res = await api.get(`/operacao/tarefas${query}`);
      const mapped = (res.data || []).map((item) => ({
        id: item.id,
        title: item.titulo,
        time: item.horario || '—',
        done: Boolean(item.concluida)
      }));
      setTasks(mapped.length ? mapped : initialTasks);
      setIsSyncing(false);
    } catch (e) {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    carregarTarefas();
    const interval = window.setInterval(() => carregarTarefas(), 15000);
    return () => window.clearInterval(interval);
  }, [api, filialAtiva]);

  const completedCount = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);
  const progress = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  const toggleTask = async (id) => {
    const task = tasks.find((entry) => entry.id === id);
    if (!task || !api) return;

    try {
      await api.put(`/operacao/tarefas/${id}`, { concluida: !task.done });
      setTasks((current) => current.map((entry) => (entry.id === id ? { ...entry, done: !entry.done } : entry)));
    } catch (e) {
      // fallback local
    }
  };

  return (
    <div className="plano-dia anim-fade-in">
      <section className="hero-plano-dia">
        <div>
          <div className="hero-badge-plano-dia">
            <CalendarDays size={16} />
            Plano do dia
          </div>
          <h3>Estruture as prioridades da operação com foco em execução e acompanhamento.</h3>
          <p>
            Combine metas, horários e status em uma visão simples para manter o dia alinhado com a rotina operacional.
          </p>
        </div>
        <div className="hero-summary-plano-dia">
          <span><Target size={14} /> {completedCount}/{tasks.length} concluídas</span>
          <span><Clock3 size={14} /> Progresso de {progress}%</span>
          <span><Users size={14} /> {isSyncing ? 'Sincronizando…' : 'Atualizado em tempo real'}</span>
        </div>
      </section>

      <section className="progress-card-plano">
        <div className="progress-meta-plano">
          <strong>Andamento do dia</strong>
          <span>{progress}%</span>
        </div>
        <div className="progress-bar-plano">
          <div className="progress-bar-fill-plano" style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section className="tasks-plano">
        {tasks.map((task) => (
          <article key={task.id} className={`task-plano ${task.done ? 'done' : ''}`}>
            <label className="task-label-plano">
              <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
              <div>
                <h4>{task.title}</h4>
                <p>{task.time}</p>
              </div>
            </label>
            <div className="task-status-plano">
              {task.done ? <CheckCircle2 size={16} /> : <ClipboardList size={16} />}
            </div>
          </article>
        ))}
      </section>

      <section className="footer-plano">
        <div className="footer-pill-plano">
          <Sparkles size={14} />
          Sincronização automática a cada 15 segundos.
        </div>
      </section>
    </div>
  );
}
