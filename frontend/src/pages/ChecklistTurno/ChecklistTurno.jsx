import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  TimerReset,
  TrendingUp
} from 'lucide-react';
import './ChecklistTurno.css';

const STORAGE_KEY = 'termosync-checklist-turno-v1';

const initialChecklist = [
  {
    id: 'pre-turno',
    title: 'Pré-turno',
    description: 'Validações iniciais antes de iniciar a operação.',
    items: []
  },
  {
    id: 'operacao',
    title: 'Operação',
    description: 'Acompanhamento contínuo no decorrer do turno.',
    items: []
  },
  {
    id: 'encerramento',
    title: 'Encerramento',
    description: 'Fechamento do turno com rastreabilidade.',
    items: []
  }
];

const sectionIndexByKey = {
  'pre-turno': 0,
  'operacao': 1,
  'encerramento': 2
};

const buildSections = (rows = []) => {
  const sections = initialChecklist.map((section) => ({ ...section, items: [] }));

  rows.forEach((row) => {
    const sectionIndex = sectionIndexByKey[row.chave] ?? sectionIndexByKey[row.key] ?? 0;
    const section = sections[sectionIndex];
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

  return sections;
};

export default function ChecklistTurno({ api, filialAtiva }) {
  const [sections, setSections] = useState(initialChecklist);
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          setSections(parsed);
        }
      }
    } catch {
      // fallback local
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  }, [sections]);

  const carregarTarefas = async () => {
    if (!api) return;
    try {
      const query = filialAtiva && filialAtiva !== 'Todas' ? `?tipo=checklist_turno&filial=${encodeURIComponent(filialAtiva)}` : '?tipo=checklist_turno';
      const res = await api.get(`/operacao/tarefas${query}`);
      setSections(buildSections(res.data || []));
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

  const stats = useMemo(() => {
    const total = sections.reduce((sum, section) => sum + section.items.length, 0);
    const completed = sections.reduce((sum, section) => sum + section.items.filter((item) => item.checked).length, 0);
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, progress };
  }, [sections]);

  const toggleItem = async (sectionIndex, itemIndex) => {
    const item = sections[sectionIndex]?.items?.[itemIndex];
    if (!item?.id || !api) return;

    const nextChecked = !item.checked;
    try {
      await api.put(`/operacao/tarefas/${item.id}`, { concluida: nextChecked });
      setSections((current) =>
        current.map((section, index) =>
          index === sectionIndex
            ? {
                ...section,
                items: section.items.map((entry, innerIndex) =>
                  innerIndex === itemIndex ? { ...entry, checked: nextChecked } : entry
                )
              }
            : section
        )
      );
    } catch (e) {
      // mantém fallback local
    }
  };

  const resetChecklist = () => {
    setSections(initialChecklist);
  };

  return (
    <div className="checklist-turno anim-fade-in">
      <section className="hero-checklist">
        <div>
          <div className="hero-badge-checklist">
            <ClipboardList size={16} />
            Checklist de turno
          </div>
          <h3>Organize a rotina operacional com um fluxo simples e objetivo.</h3>
          <p>
            Marque pontos críticos, acompanhe o andamento e mantenha a equipe alinhada sem depender de planilhas externas.
          </p>
        </div>
        <div className="hero-summary-checklist">
          <span><TrendingUp size={14} /> {stats.progress}% concluído</span>
          <span><CheckCircle2 size={14} /> {stats.completed}/{stats.total} itens</span>
          <span><ShieldCheck size={14} /> {isSyncing ? 'Sincronizando…' : 'Atualizado em tempo real'}</span>
        </div>
      </section>

      <section className="progress-card">
        <div className="progress-meta">
          <strong>Progresso do turno</strong>
          <button type="button" className="reset-btn" onClick={resetChecklist}>
            <RefreshCw size={14} /> Reiniciar
          </button>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${stats.progress}%` }} />
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
              <div className="section-counter">
                <ListChecks size={16} />
                {section.items.filter((item) => item.checked).length}/{section.items.length}
              </div>
            </div>

            <ul className="checklist-items">
              {section.items.map((item, itemIndex) => (
                <li key={`${section.id}-${itemIndex}`} className={`checklist-item ${item.checked ? 'checked' : ''}`}>
                  <label className="checklist-label">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleItem(sectionIndex, itemIndex)}
                    />
                    <span>{item.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="checklist-footer">
        <div className="footer-pill">
          <TimerReset size={14} />
          Atualização automática a cada 15 segundos.
        </div>
      </section>
    </div>
  );
}
