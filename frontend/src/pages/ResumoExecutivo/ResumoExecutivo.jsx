import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import './ResumoExecutivo.css';

const initialSummary = {
  total_equipamentos: 0,
  alertas_ativos: 0,
  chamados_abertos: 0,
  equipamentos_em_falha: 0,
  equipamentos_em_degelo: 0,
  temperatura_media: 0,
  umidade_media: 0,
  ultimos_alertas: [],
  ultimos_chamados: []
};

export default function ResumoExecutivo({ api, filialAtiva }) {
  const [summary, setSummary] = useState(initialSummary);
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    const carregarResumo = async () => {
      if (!api) return;
      try {
        const query = filialAtiva && filialAtiva !== 'Todas' ? `?filial=${encodeURIComponent(filialAtiva)}` : '';
        const res = await api.get(`/operacao/resumo${query}`);
        setSummary(res.data || initialSummary);
        setIsSyncing(false);
      } catch (e) {
        setIsSyncing(false);
      }
    };

    carregarResumo();
    const interval = window.setInterval(() => carregarResumo(), 15000);
    return () => window.clearInterval(interval);
  }, [api, filialAtiva]);

  const highlights = useMemo(() => [
    {
      title: 'Equipamentos',
      value: summary.total_equipamentos,
      detail: 'itens na visão atual'
    },
    {
      title: 'Alertas',
      value: summary.alertas_ativos,
      detail: 'situações em observação'
    },
    {
      title: 'Chamados',
      value: summary.chamados_abertos,
      detail: 'abertos para suporte'
    },
    {
      title: 'Temp./Umid.',
      value: `${summary.temperatura_media.toFixed(1)}°C / ${summary.umidade_media.toFixed(1)}%`,
      detail: 'médias operacionais'
    }
  ], [summary]);

  const agenda = useMemo(() => [
    summary.equipamentos_em_falha > 0
      ? `Há ${summary.equipamentos_em_falha} equipamento(s) com falha operacional.`
      : 'Nenhuma falha operacional detectada no momento.',
    summary.equipamentos_em_degelo > 0
      ? `Há ${summary.equipamentos_em_degelo} equipamento(s) em degelo.`
      : 'Nenhum ciclo de degelo em andamento.',
    summary.alertas_ativos > 0
      ? `${summary.alertas_ativos} alerta(s) requerem atenção imediata.`
      : 'O ambiente está sem alertas ativos.'
  ], [summary]);

  return (
    <div className="resumo-executivo anim-fade-in">
      <section className="hero-resumo-executivo">
        <div>
          <div className="hero-badge-resumo-executivo">
            <BarChart3 size={16} />
            Resumo executivo
          </div>
          <h3>Uma visão rápida para liderança e supervisão operacional.</h3>
          <p>
            Indicadores, riscos e próximos passos são atualizados automaticamente a partir do estado vivo do sistema.
          </p>
        </div>
        <div className="hero-summary-resumo-executivo">
          <span><ShieldCheck size={14} /> {isSyncing ? 'Sincronizando…' : 'Supervisão ativa'}</span>
          <span><TrendingUp size={14} /> Indicadores operacionais</span>
          <span><Sparkles size={14} /> Tomada de decisão ágil</span>
        </div>
      </section>

      <section className="highlights-resumo-executivo">
        {highlights.map((item) => (
          <article key={item.title} className="highlight-card-executivo">
            <h4>{item.value}</h4>
            <p>{item.title}</p>
            <span>{item.detail}</span>
          </article>
        ))}
      </section>

      <section className="executive-grid">
        <article className="panel-executivo">
          <div className="panel-title-executivo">
            <AlertTriangle size={16} />
            <h4>Pontos críticos</h4>
          </div>
          <ul>
            {(summary.ultimos_alertas || []).slice(0, 3).map((alerta) => (
              <li key={alerta.id}>{alerta.equipamento_nome || 'Sistema'}: {alerta.mensagem}</li>
            ))}
            {(!summary.ultimos_alertas || summary.ultimos_alertas.length === 0) && (
              <li>Nenhum alerta ativo está sendo reportado neste momento.</li>
            )}
          </ul>
        </article>

        <article className="panel-executivo">
          <div className="panel-title-executivo">
            <ClipboardList size={16} />
            Agenda de acompanhamento
          </div>
          <ul>
            {agenda.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="footer-executivo">
        <div className="footer-pill-executivo">
          <CheckCircle2 size={14} />
          Status geral: operação monitorada com atualização automática.
        </div>
      </section>
    </div>
  );
}
