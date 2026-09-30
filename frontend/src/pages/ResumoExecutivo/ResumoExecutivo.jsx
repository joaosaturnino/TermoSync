/**
 * Módulo: frontend/src/pages/ResumoExecutivo/ResumoExecutivo.jsx
 * Responsabilidade: Implementa a tela Resumo Executivo, seus estados, interações e integrações de dados.
 */

import { useCallback } from 'react';
import { ArrowRight, Building2, Clock3, Droplets, RefreshCw, Thermometer, Wrench } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import './ResumoExecutivo.css';

const EMPTY_SUMMARY = {
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

/**
 * Renderiza a tela Resumo Executivo e concentra as regras de apresentacao desse modulo.
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
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onNavigate - Callback onNavigate fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function ResumoExecutivo({ api, filialAtiva, socket, onNavigate }) {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [isSyncing, setIsSyncing] = useState(true);
  const [loadError, setLoadError] = useState(false);

  /** Busca os agregados oficiais do backend para o escopo selecionado. */
  const loadSummary = useCallback(async ({ silent = false } = {}) => {
    if (!api) return;
    if (!silent) setIsSyncing(true);
    try {
      const query = filialAtiva && filialAtiva !== 'Todas' ? `?filial=${encodeURIComponent(filialAtiva)}` : '';
      const response = await api.get(`/operacao/resumo${query}`);
      setSummary({ ...EMPTY_SUMMARY, ...(response.data || {}) });
      setLoadError(false);
    } catch (error) {
      setLoadError(true);
    } finally {
      setIsSyncing(false);
    }
  }, [api, filialAtiva]);

  /** Combina eventos em tempo real com atualização periódica de contingência. */
  useEffect(() => {
    loadSummary();

    /**
     * Concentra a logica de refresh para manter o restante do tela mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const refresh = () => loadSummary({ silent: true });
    socket?.on('atualizacao_dados', refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      socket?.off('atualizacao_dados', refresh);
      window.clearInterval(interval);
    };
  }, [loadSummary, socket]);

  const decision = useMemo(() => {
    const total = Math.max(Number(summary.total_equipamentos) || 0, 1);
    const failures = Number(summary.equipamentos_em_falha) || 0;
    const alerts = Number(summary.alertas_ativos) || 0;
    const tickets = Number(summary.chamados_abertos) || 0;
    const exposure = Math.min(100, Math.round((failures / total) * 55 + (alerts / total) * 30 + (tickets / total) * 15));
    const availability = Math.max(0, Math.round(((total - failures) / total) * 100));
    const state = exposure >= 55 ? { label: 'Exposição elevada', tone: 'critical' } : exposure >= 25 ? { label: 'Atenção gerencial', tone: 'attention' } : { label: 'Operação controlada', tone: 'healthy' };
    const priorities = [
      failures > 0 && { title: 'Falhas operacionais', detail: `${failures} ativo(s) indisponível(is) precisam de resposta.`, route: 'motores', severity: 'critical' },
      alerts > 0 && { title: 'Alertas sem resolução', detail: `${alerts} ocorrência(s) permanecem abertas.`, route: 'timeline_operacional', severity: 'attention' },
      tickets > 0 && { title: 'Fila de manutenção', detail: `${tickets} chamado(s) aguardam conclusão.`, route: 'chamados', severity: 'attention' },
      !failures && !alerts && { title: 'Operação dentro do esperado', detail: 'Não há exposição crítica identificada neste momento.', route: 'dashboard', severity: 'healthy' }
    ].filter(Boolean);
    return { exposure, availability, state, priorities };
  }, [summary]);

  return (
    <main className="executive-summary anim-fade-in">
      <header className="executive-header">
        <div><span className="executive-eyebrow"><BarChart3 size={15} /> Supervisão gerencial</span><h2>Resumo executivo</h2><p>{filialAtiva === 'Todas' ? 'Consolidado da operação' : filialAtiva} · visão para decisão</p></div>
        <div className={`executive-state ${decision.state.tone}`}><span><ShieldCheck size={18} /></span><div><strong>{decision.state.label}</strong><small>Exposição operacional: {decision.exposure}%</small></div></div>
      </header>

      {loadError && <div className="executive-error"><AlertTriangle size={16} /> Os últimos dados permanecem visíveis, mas a atualização falhou.<button type="button" onClick={() => loadSummary()}>Tentar novamente</button></div>}

      <section className="executive-kpis">
        <article><span><Building2 size={16} /> Disponibilidade estimada</span><strong>{decision.availability}<small>%</small></strong><p>{summary.total_equipamentos - summary.equipamentos_em_falha} de {summary.total_equipamentos} ativos disponíveis</p><i><b style={{ width: `${decision.availability}%` }} /></i></article>
        <article className={summary.alertas_ativos ? 'danger' : ''}><span><AlertTriangle size={16} /> Alertas ativos</span><strong>{summary.alertas_ativos}</strong><p>Ocorrências em observação</p></article>
        <article><span><Wrench size={16} /> Chamados abertos</span><strong>{summary.chamados_abertos}</strong><p>Demandas técnicas em curso</p></article>
        <article><span><Thermometer size={16} /> Temperatura média</span><strong>{Number(summary.temperatura_media || 0).toFixed(1)}<small>°C</small></strong><p>Média do parque monitorado</p></article>
        <article><span><Droplets size={16} /> Umidade média</span><strong>{Number(summary.umidade_media || 0).toFixed(1)}<small>%</small></strong><p>Condição higrométrica agregada</p></article>
      </section>

      <section className="executive-layout">
        <article className="executive-panel priorities-panel">
          <div className="executive-panel-heading"><div><span>Decisão recomendada</span><h3>Prioridades executivas</h3></div><AlertTriangle size={17} /></div>
          <div className="executive-priorities">{decision.priorities.map((item) => <button key={item.title} type="button" className={item.severity} onClick={() => onNavigate?.(item.route)}><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowRight size={16} /></button>)}</div>
        </article>

        <article className="executive-panel executive-health-panel">
          <div className="executive-panel-heading"><div><span>Composição da operação</span><h3>Estado do parque</h3></div><CheckCircle2 size={17} /></div>
          <div className="fleet-composition"><div><span>Operacionais</span><strong>{Math.max(0, summary.total_equipamentos - summary.equipamentos_em_falha - summary.equipamentos_em_degelo)}</strong></div><div><span>Em falha</span><strong>{summary.equipamentos_em_falha}</strong></div><div><span>Em degelo</span><strong>{summary.equipamentos_em_degelo}</strong></div></div>
          <div className="fleet-bar"><i style={{ width: `${summary.total_equipamentos ? ((summary.total_equipamentos - summary.equipamentos_em_falha - summary.equipamentos_em_degelo) / summary.total_equipamentos) * 100 : 0}%` }} /><i className="failure" style={{ width: `${summary.total_equipamentos ? (summary.equipamentos_em_falha / summary.total_equipamentos) * 100 : 0}%` }} /><i className="defrost" style={{ width: `${summary.total_equipamentos ? (summary.equipamentos_em_degelo / summary.total_equipamentos) * 100 : 0}%` }} /></div>
        </article>

        <article className="executive-panel executive-events-panel">
          <div className="executive-panel-heading"><div><span>Risco corrente</span><h3>Alertas recentes</h3></div><button type="button" onClick={() => onNavigate?.('timeline_operacional')}>Ver timeline <ArrowRight size={14} /></button></div>
          <div className="executive-event-list">{summary.ultimos_alertas.length ? summary.ultimos_alertas.slice(0, 5).map((item) => <div key={item.id}><span><strong>{item.equipamento_nome || 'Sistema'}</strong><small>{item.mensagem || 'Ocorrência operacional'}</small></span><time>{item.data_hora ? new Date(item.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--'}</time></div>) : <div className="executive-empty"><CheckCircle2 size={24} /><strong>Sem alertas ativos</strong></div>}</div>
        </article>

        <article className="executive-panel executive-tickets-panel">
          <div className="executive-panel-heading"><div><span>Capacidade de resposta</span><h3>Chamados prioritários</h3></div><button type="button" onClick={() => onNavigate?.('chamados')}>Abrir fila <ArrowRight size={14} /></button></div>
          <div className="executive-ticket-list">{summary.ultimos_chamados.length ? summary.ultimos_chamados.slice(0, 5).map((item) => <div key={item.id}><span><strong>{item.equipamento_nome || `Chamado ${item.id}`}</strong><small>{item.status || 'Aberto'}</small></span><span className={`ticket-urgency ${String(item.urgencia || '').toLowerCase()}`}>{item.urgencia || 'Normal'}</span></div>) : <div className="executive-empty"><CheckCircle2 size={24} /><strong>Sem chamados abertos</strong></div>}</div>
        </article>
      </section>

      <footer className="executive-footer"><RefreshCw size={14} className={isSyncing ? 'spin' : ''} /><span>{isSyncing ? 'Atualizando indicadores' : summary.atualizada_em ? `Atualizado em ${new Date(summary.atualizada_em).toLocaleString('pt-BR')}` : 'Indicadores disponíveis'}</span><Clock3 size={14} /></footer>
    </main>
  );
}
