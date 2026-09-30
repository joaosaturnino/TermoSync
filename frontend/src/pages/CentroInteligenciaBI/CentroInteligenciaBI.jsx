/**
 * Módulo: frontend/src/pages/CentroInteligenciaBI/CentroInteligenciaBI.jsx
 * Responsabilidade: Implementa a tela Centro Inteligencia BI, seus estados, interações e integrações de dados.
 */

import { useRef } from 'react';
import { Clock3 } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip as RechartsTooltip, Legend, 
  ResponsiveContainer, AreaChart, Area, Line 
} from 'recharts';
import { 
  TrendingUp, ShieldCheck, DollarSign, LineChart as ChartIcon, 
  Briefcase, RefreshCw, AlertTriangle, CheckCircle2,
  Building2, Server, Loader2, ArrowUpRight,
  Search, Download, Wrench, ShieldAlert, Cpu, Layers,
  X, Send
} from 'lucide-react';
import './CentroInteligencia.css';

/**
 * Concentra a logica de to finite number para manter o restante do tela mais legivel.
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
 * @param {unknown} fallback - Valor de fallback consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};


/**
 * Formata format currency para exibicao segura na interface.
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
const formatCurrency = (value) => toFiniteNumber(value).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/**
 * Normaliza a resposta para impedir que campos ausentes interrompam toda a tela.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object|Array} payload - Dados de entrada que serão validados e transformados pelo fluxo.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const normalizeAnalytics = (payload = {}) => ({
  generatedAt: payload.generatedAt || new Date().toISOString(),
  period: payload.period || {},
  metadata: payload.metadata || {},
  kpis: {
    mrr: toFiniteNumber(payload.kpis?.mrr),
    arr: toFiniteNumber(payload.kpis?.arr),
    margem: payload.kpis?.margem == null ? null : toFiniteNumber(payload.kpis.margem),
    uptimeGlobal: payload.kpis?.uptimeGlobal == null ? null : toFiniteNumber(payload.kpis.uptimeGlobal),
    totalLojas: toFiniteNumber(payload.kpis?.totalLojas),
    totalEquipamentos: toFiniteNumber(payload.kpis?.totalEquipamentos),
    custoCloudEstimado: toFiniteNumber(payload.kpis?.custoCloudEstimado),
    lucroLiquido: toFiniteNumber(payload.kpis?.lucroLiquido)
  },
  dreData: Array.isArray(payload.dreData) ? payload.dreData.map(item => ({
    name: String(item.name || ''),
    Receita_SaaS: toFiniteNumber(item.Receita_SaaS),
    Custos_Cloud: toFiniteNumber(item.Custos_Cloud),
    Lucro_Liquido: toFiniteNumber(item.Lucro_Liquido)
  })) : [],
  distribuicaoPlanos: Array.isArray(payload.distribuicaoPlanos)
    ? payload.distribuicaoPlanos.map(item => ({ name: String(item.name || 'Sem plano'), value: toFiniteNumber(item.value) })).filter(item => item.value > 0)
    : [],
  analiseRisco: Array.isArray(payload.analiseRisco) ? payload.analiseRisco.map(item => ({
    id: item.id,
    maquina: String(item.maquina || 'Ativo sem identificação'),
    risco: Math.min(100, Math.max(0, toFiniteNumber(item.risco))),
    alertas: Math.max(0, toFiniteNumber(item.alertas)),
    statusMotor: String(item.statusMotor || 'Desconhecido')
  })) : []
});

/**
 * Renderiza o painel executivo de BI com KPIs financeiros, risco IoT e ações rápidas.
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
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isDarkMode - Sinalizador isDarkMode que controla este comportamento visual.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function CentroInteligenciaBI({ api, isDarkMode, showToast }) {
  const [dataAnalytics, setDataAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [abaVisao, setAbaVisao] = useState('consolidada'); // 'consolidada', 'finops', 'risco'
  const [buscaAtivo, setBuscaAtivo] = useState('');
  const [visibleAssetCount, setVisibleAssetCount] = useState(20);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const refreshInFlight = useRef(false);
  const toastTimerRef = useRef(null);
  const hasDataRef = useRef(false);

  // Estados Operacionais (Substituem o alert do Chrome)
  const [modalOS, setModalOS] = useState(null); // Recebe o 'ativo' ao clicar em abrir OS
  const [enviandoOS, setEnviandoOS] = useState(false);
  const [notificacaoBI, setNotificacaoBI] = useState(null); // Alerta flutuante bonito in-app

  // Cores de Gráfico Recharts
  const COLORS = ['var(--success)', 'var(--info)', 'var(--warning)', 'var(--danger)', 'var(--accent-violet)'];
  const textFill = isDarkMode ? '#cbd5e1' : 'var(--text-muted)';
  const gridStroke = isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

  /**
   * Exibe uma notificação visual e também propaga o aviso para o toast global.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
   *
   * @param {unknown} titulo - Valor de titulo consumido por esta rotina.
   * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
   * @param {unknown} tipo - Valor de tipo consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const exibirAlertaUI = (titulo, mensagem, tipo = 'success') => {
    setNotificacaoBI({ titulo, mensagem, tipo });
    showToast?.(`${titulo}: ${mensagem}`, tipo);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setNotificacaoBI(null), 5000);
  };

  const fetchBIAnalytics = useCallback(async (silencioso = false) => {
    if (!api || refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      if (!silencioso) setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMsg('');
      const response = await api.get('/bi/analytics');
      setDataAnalytics(normalizeAnalytics(response.data));
      setLastUpdatedAt(new Date());
      hasDataRef.current = true;
    } catch (error) {
      console.error('Erro ao carregar BI:', error);
      if (!hasDataRef.current) setErrorMsg('Não foi possível sincronizar as métricas financeiras com o servidor.');
    } finally {
      refreshInFlight.current = false;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    fetchBIAnalytics(false);
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, [fetchBIAnalytics]);

  const copilotInsight = useMemo(() => {
    if (!dataAnalytics) return '';
    const { kpis, analiseRisco } = dataAnalytics;
    const criticalAssets = analiseRisco.filter((item) => item.risco >= 50).length;
    const cloudCostPerDevice = kpis.totalEquipamentos > 0 ? (12 + 45 / Math.max(1, kpis.totalLojas)).toFixed(2) : '15.00';
    return `Margem operacional em ${kpis.margem ?? 0}%, com ARR projetado de R$ ${kpis.arr.toLocaleString('pt-BR')}. Há ${criticalAssets} ativo(s) com risco operacional elevado. O custo médio em nuvem está estimado em R$ ${cloudCostPerDevice} por nó de telemetria.`;
  }, [dataAnalytics]);

  const ativosFiltrados = useMemo(() => {
    if (!dataAnalytics) return [];
    const term = buscaAtivo.trim().toLowerCase();
    if (!term) return dataAnalytics.analiseRisco;
    return dataAnalytics.analiseRisco.filter((item) => item.maquina.toLowerCase().includes(term) || String(item.alertas).includes(term));
  }, [dataAnalytics, buscaAtivo]);

  const ativosVisiveis = ativosFiltrados.slice(0, visibleAssetCount);

  /**
   * Busca os dados consolidados do BI e controla estados de carregamento/atualização.
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
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const confirmarAberturaOS = async () => {
    if (!api || !modalOS) return;
    setEnviandoOS(true);
    try {
      const prioridadeOS = modalOS.risco > 70 ? 'Crítica' : 'Alta';
      const descricaoOS = `Chamado automático gerado pelo módulo de Business Intelligence (Copilot AI).\n\n• Ativo IoT: ${modalOS.maquina}\n• Índice de Risco SLA: ${modalOS.risco}%\n• Status do Compressor: ${modalOS.statusMotor}\n• Alarmes NOC Pendentes: ${modalOS.alertas} alarme(s)\n\nIntervenção preventiva recomendada para evitar violação metrológica.`;

      await api.post('/chamados', {
        equipamento_id: modalOS.id || null,
        descricao: descricaoOS,
        urgencia: prioridadeOS,
        solicitante_nome: 'Centro de Inteligência BI'
      });

      setModalOS(null);
      exibirAlertaUI(
        'Ordem de Serviço Aberta',
        `A OS foi submetida com prioridade ${prioridadeOS} para a máquina ${modalOS.maquina}.`,
        'success'
      );
    } catch (err) {
      exibirAlertaUI(
        'Falha no Registro',
        'Não foi possível submeter a OS preventiva no servidor MySQL.',
        'error'
      );
    } finally {
      setEnviandoOS(false);
    }
  };

  /**
   * Gera e baixa um CSV de auditoria com o diagnóstico de risco dos ativos.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const exportarDiagnosticoCSV = () => {
    if (!dataAnalytics) return;

    /**
     * Prepara escape csv para exibicao sem expor dados sensiveis.
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
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    let csv = "ID,Ativo_IoT,Status_Compressor,Alertas_NOC,Grau_Risco_SLA\n";
    dataAnalytics.analiseRisco.forEach(row => {
      csv += [row.id || '', row.maquina, row.statusMotor, row.alertas, `${row.risco}%`].map(escapeCsv).join(',') + '\n';
    });
    const url = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Auditoria_Risco_BI_${Date.now()}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    exibirAlertaUI('Exportação Concluída', 'Arquivo CSV de diagnóstico de risco gerado.', 'success');
  };

  if (isLoading) {
    return (
      <div className="bi-loading-container anim-fade-in">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <Loader2 size={44} className="spin" color="var(--info)" />
          <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Consolidando Data Lake & FinOps...</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Agregando receitas de SaaS, SLA e índices de risco dos ativos IoT.
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg || !dataAnalytics) {
    return (
      <div className="bi-dashboard-container anim-fade-in">
        <div className="bi-error-box">
          <AlertTriangle size={40} color="var(--danger)" />
          <h3>Erro na Sincronização BI</h3>
          <p>{errorMsg || 'Sem dados analíticos disponíveis no momento.'}</p>
          <button className="btn btn-outline" onClick={() => fetchBIAnalytics(false)}>
            <RefreshCw size={16} /> Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const { kpis, dreData, distribuicaoPlanos, analiseRisco } = dataAnalytics;
  const ticketMedioARPU = kpis.totalLojas > 0 ? (kpis.mrr / kpis.totalLojas) : 0;
  const custoPorAtivo = kpis.totalEquipamentos > 0 ? (kpis.custoCloudEstimado / kpis.totalEquipamentos) : 0;
  const riscoGrafico = analiseRisco.slice(0, 8);
  const periodoAtual = dataAnalytics.period?.month && dataAnalytics.period?.year
    ? `${String(dataAnalytics.period.month).padStart(2, '0')}/${dataAnalytics.period.year}`
    : 'ciclo atual';
  const formattedLastUpdate = lastUpdatedAt && !Number.isNaN(lastUpdatedAt.getTime())
    ? lastUpdatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

return (
    <div className="bi-dashboard-container anim-fade-in">
      
      {/* TOAST FLUTUANTE IN-APP (SEM ALERT NATIVO) */}
      {notificacaoBI && (
        <div className={`bi-floating-toast anim-slide-up ${notificacaoBI.tipo}`}>
          <div className="bi-toast-icon">
            {notificacaoBI.tipo === 'success' ? (
              <CheckCircle2 size={22} color="var(--success)" />
            ) : (
              <AlertTriangle size={22} color="var(--danger)" />
            )}
          </div>
          <div className="bi-toast-text">
            <strong>{notificacaoBI.titulo}</strong>
            <span>{notificacaoBI.mensagem}</span>
          </div>
          <button 
            onClick={() => setNotificacaoBI(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* CABEÇALHO DO MÓDULO */}
      <header className="bi-page-header">
        <div>
          <h1 className="bi-page-title">
            <ChartIcon size={28} className="icon-glow" style={{ color: 'var(--info)' }} />
            Inteligência BI
          </h1>
          <p className="bi-subtitle">
            Faturamento SaaS, custos estimados de infraestrutura e risco operacional dos ativos IoT.
          </p>
        </div>

        <div className="bi-header-actions">
          <span className="bi-live-badge">
            <span className="bi-live-dot"></span> Atualizado às {formattedLastUpdate}
          </span>
          <button 
            className="btn btn-outline bi-btn-action"
            onClick={exportarDiagnosticoCSV}
            title="Baixar Auditoria CSV"
          >
            <Download size={15} /> Exportar CSV
          </button>
          <button 
            className="btn btn-outline bi-btn-action"
            onClick={() => fetchBIAnalytics(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar Métricas'}
          </button>
        </div>
      </header>

      {/* BANNER DE INSIGHTS AUTOMÁTICOS (FINOPS COPILOT AI) */}
      <div className="bi-copilot-banner anim-slide-up">
        <div className="bi-copilot-icon">
          <ChartIcon size={22} />
        </div>
        <div className="bi-copilot-content">
          <h4>
            <TrendingUp size={16} color="var(--info)" />
            Resumo executivo automático
          </h4>
          <p>{copilotInsight}</p>
          <small>Consolidado a partir de faturamento, inventário e alertas registrados no sistema.</small>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO EXECUTIVA */}
      <div className="bi-tabs-bar">
        <button 
          className={`bi-tab-btn ${abaVisao === 'consolidada' ? 'active' : ''}`}
          onClick={() => setAbaVisao('consolidada')}
        >
          <Layers size={16} /> Visão Consolidada
        </button>
        <button 
          className={`bi-tab-btn ${abaVisao === 'finops' ? 'active' : ''}`}
          onClick={() => setAbaVisao('finops')}
        >
          <DollarSign size={16} /> FinOps & Receita SaaS
        </button>
        <button 
          className={`bi-tab-btn ${abaVisao === 'risco' ? 'active' : ''}`}
          onClick={() => setAbaVisao('risco')}
        >
          <ShieldAlert size={16} /> Risco & Saúde IoT
        </button>
      </div>

      {/* 6 CARDS DE KPIS FINANCEIROS, UNIT ECONOMICS E SLA */}
      <div className="bi-kpi-grid">
        <div className="bi-kpi-card" style={{ borderColor: 'rgba(16, 185, 129, 0.35)' }}>
          <div className="bi-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
            <DollarSign size={26} color="var(--success)" />
          </div>
          <div className="bi-kpi-info">
            <span className="bi-kpi-label">ARR (Receita Anual Recorrente)</span>
            <h3>R$ {formatCurrency(kpis.arr)}</h3>
            <div className="bi-kpi-trend success">
              <ArrowUpRight size={14} /> MRR de {periodoAtual} × 12
            </div>
          </div>
        </div>

        <div className="bi-kpi-card" style={{ borderColor: 'rgba(56, 189, 248, 0.35)' }}>
          <div className="bi-kpi-icon" style={{ background: 'rgba(56, 189, 248, 0.12)' }}>
            <TrendingUp size={26} color="var(--info)" />
          </div>
          <div className="bi-kpi-info">
            <span className="bi-kpi-label">MRR (Receita Mensal Recorrente)</span>
            <h3>R$ {formatCurrency(kpis.mrr)}</h3>
            <div className="bi-kpi-trend info">
              <Building2 size={13} /> Faturas do ciclo {periodoAtual}
            </div>
          </div>
        </div>

        <div className="bi-kpi-card" style={{ borderColor: 'rgba(245, 158, 11, 0.35)' }}>
          <div className="bi-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)' }}>
            <Briefcase size={26} color="var(--warning)" />
          </div>
          <div className="bi-kpi-info">
            <span className="bi-kpi-label">Margem Bruta (Lucro / Cloud)</span>
            <h3>{kpis.margem == null ? '--' : `${kpis.margem}%`}</h3>
            <div className={`bi-kpi-trend ${kpis.lucroLiquido < 0 ? 'danger' : 'warning'}`}>
              <Server size={13} /> Resultado R$ {formatCurrency(kpis.lucroLiquido)}
            </div>
          </div>
        </div>

        <div className="bi-kpi-card" style={{ borderColor: 'rgba(168, 85, 247, 0.35)' }}>
          <div className="bi-kpi-icon" style={{ background: 'rgba(168, 85, 247, 0.12)' }}>
            <Building2 size={26} color="var(--accent-violet)" />
          </div>
          <div className="bi-kpi-info">
            <span className="bi-kpi-label">ARPU (Ticket Médio SaaS)</span>
            <h3>R$ {formatCurrency(ticketMedioARPU)}</h3>
            <div className="bi-kpi-trend purple">
              <TrendingUp size={13} /> Receita média por tenant
            </div>
          </div>
        </div>

        <div className="bi-kpi-card" style={{ borderColor: 'rgba(239, 68, 68, 0.35)' }}>
          <div className="bi-kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
            <Cpu size={26} color="var(--danger)" />
          </div>
          <div className="bi-kpi-info">
            <span className="bi-kpi-label">Custo Médio / Ativo IoT</span>
            <h3>R$ {formatCurrency(custoPorAtivo)}</h3>
            <div className="bi-kpi-trend warning">
              <Server size={13} /> Modelo estimado de infraestrutura
            </div>
          </div>
        </div>

        <div className="bi-kpi-card" style={{ borderColor: 'rgba(59, 130, 246, 0.35)' }}>
          <div className="bi-kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
            <ShieldCheck size={26} color="var(--info)" />
          </div>
          <div className="bi-kpi-info">
            <span className="bi-kpi-label">SLA Global Entregue</span>
            <h3>{kpis.uptimeGlobal == null ? '--' : `${kpis.uptimeGlobal}%`}</h3>
            <div className={`bi-kpi-trend ${kpis.uptimeGlobal != null && kpis.uptimeGlobal >= 99.9 ? 'success' : 'info'}`}>
              <Clock3 size={13} /> {dataAnalytics.metadata?.healthSamples || 0} amostras nas últimas 24h
            </div>
          </div>
        </div>
      </div>

      {/* GRID DE GRÁFICOS DINÂMICA CONFORME A ABA ATIVA */}
      <div className="bi-charts-grid">
        
        {/* GRÁFICO 1: EVOLUÇÃO DRE PREDITIVO */}
        {(abaVisao === 'consolidada' || abaVisao === 'finops') && (
          <div className="bi-chart-box full-width">
            <div className="bi-chart-head">
              <div>
                <h3>Evolução do DRE</h3>
                <p>Faturamento registrado versus custo mensal estimado de infraestrutura.</p>
              </div>
              <span className="bi-chart-tag">Últimos 6 ciclos</span>
            </div>
            {dreData.length > 0 ? (
              <div className="bi-chart-canvas bi-chart-canvas-wide">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
              <AreaChart data={dreData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="name" stroke={textFill} />
                <YAxis stroke={textFill} tickFormatter={(val) => `R$ ${val}`} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#0f172a' : '#fff',
                    color: textFill, 
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                  }} 
                  formatter={(val) => `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                />
                <Legend verticalAlign="top" height={36} />
                <Area type="monotone" dataKey="Receita_SaaS" name="Receita SaaS" stroke="var(--success)" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
                <Area type="monotone" dataKey="Custos_Cloud" name="Custos Nuvem/IoT" stroke="var(--danger)" strokeWidth={2} fillOpacity={1} fill="url(#colorCusto)" />
                <Line type="monotone" dataKey="Lucro_Liquido" name="Lucro Líquido" stroke="var(--info)" strokeWidth={2} dot={{ r: 4 }} />
              </AreaChart>
              </ResponsiveContainer>
              </div>
            ) : <div className="bi-empty-chart">Ainda não há ciclos de faturamento para compor o DRE.</div>}
          </div>
        )}

        {/* GRÁFICO 2: DISTRIBUIÇÃO DA CARTEIRA POR PLANO */}
        {(abaVisao === 'consolidada' || abaVisao === 'finops') && (
          <div className="bi-chart-box">
            <div className="bi-chart-head">
              <h3>Carteira de Lojas por Plano SaaS</h3>
              <span className="bi-chart-tag">Ciclo {periodoAtual}</span>
            </div>
            {distribuicaoPlanos.length > 0 ? (
              <div className="bi-chart-canvas">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
              <PieChart>
                <Pie 
                  data={distribuicaoPlanos} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={65} 
                  outerRadius={105} 
                  paddingAngle={6} 
                  dataKey="value"
                >
                  {distribuicaoPlanos.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#0f172a' : '#fff',
                    color: textFill, 
                    border: '1px solid rgba(255,255,255,0.12)', 
                    borderRadius: '8px'
                  }} 
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
              </ResponsiveContainer>
              </div>
            ) : <div className="bi-empty-chart">Nenhuma fatura encontrada no ciclo atual.</div>}
          </div>
        )}

        {/* GRÁFICO 3: ÍNDICE DE RISCO OPERACIONAL POR MÁQUINA */}
        {(abaVisao === 'consolidada' || abaVisao === 'risco') && (
          <div className="bi-chart-box" style={{ gridColumn: abaVisao === 'risco' ? '1 / -1' : 'auto' }}>
            <div className="bi-chart-head">
              <h3>Índice de Risco Operacional por Ativo IoT (%)</h3>
              <span className="bi-chart-tag">Top {riscoGrafico.length}</span>
            </div>
            {riscoGrafico.length > 0 ? (
              <div className="bi-chart-canvas" style={{ height: `${Math.max(260, riscoGrafico.length * 44)}px` }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
              <BarChart data={riscoGrafico} layout="vertical" margin={{ left: 5, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={true} vertical={false} />
                <XAxis type="number" stroke={textFill} domain={[0, 100]} />
                <YAxis dataKey="maquina" type="category" stroke={textFill} width={150} tick={{ fontSize: 11 }} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#0f172a' : '#fff',
                    color: textFill, 
                    border: '1px solid rgba(255,255,255,0.12)', 
                    borderRadius: '8px'
                  }} 
                  formatter={(val) => `${val}% de Risco`}
                />
                <Bar dataKey="risco" name="Grau de Risco" radius={[0, 6, 6, 0]}>
                  {riscoGrafico.map((entry, idx) => (
                    <Cell 
                      key={`cell-${idx}`} 
                      fill={entry.risco > 70 ? 'var(--danger)' : entry.risco > 30 ? 'var(--warning)' : 'var(--success)'}
                    />
                  ))}
                </Bar>
              </BarChart>
              </ResponsiveContainer>
              </div>
            ) : <div className="bi-empty-chart">Nenhum equipamento disponível para análise de risco.</div>}
          </div>
        )}

      </div>

      {/* TABELA INTERATIVA DE DIAGNÓSTICO E AÇÃO TÁTICA */}
      {(abaVisao === 'consolidada' || abaVisao === 'risco') && (
        <div className="bi-chart-box full-width" style={{ marginTop: '1.5rem' }}>
          <div className="bi-chart-head">
            <div>
              <h3>Diagnóstico Tático de Ativos e Intervenção Rápida</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Identificação de anomalias com acionamento preventivo de equipes técnicas
              </span>
            </div>

            <div className="bi-toolbar-search">
              <Search size={15} color="var(--text-muted)" />
              <input 
                type="text"
                placeholder="Filtrar por nome do ativo..."
                value={buscaAtivo}
                onChange={(e) => setBuscaAtivo(e.target.value)}
              />
            </div>
          </div>
          
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '14px 12px' }}>Equipamento / Unidade</th>
                  <th style={{ padding: '14px 12px' }}>Status do Compressor</th>
                  <th style={{ padding: '14px 12px' }}>Alertas NOC Abertos</th>
                  <th style={{ padding: '14px 12px' }}>Índice de Saúde (SLA)</th>
                  <th style={{ padding: '14px 12px', textAlign: 'right' }}>Ação Operacional</th>
                </tr>
              </thead>
              <tbody>
                {ativosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      Nenhum ativo corresponde ao critério pesquisado.
                    </td>
                  </tr>
                ) : (
                  ativosVisiveis.map((item) => (
                    <tr key={item.id || item.maquina} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="bi-asset-name" style={{ padding: '16px 12px', fontWeight: 'bold' }}>{item.maquina}</td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          background: item.statusMotor === 'Ativo' ? 'rgba(16, 185, 129, 0.12)' : item.statusMotor === 'Degelo' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: item.statusMotor === 'Ativo' ? 'var(--success)' : item.statusMotor === 'Degelo' ? 'var(--info)' : 'var(--danger)'
                        }}>
                          {item.statusMotor}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', color: item.alertas > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: item.alertas > 0 ? 'bold' : 'normal' }}>
                        {item.alertas} alerta(s) ativo(s)
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '85px', height: '7px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${100 - item.risco}%`,
                              height: '100%',
                              background: item.risco > 70 ? 'var(--danger)' : item.risco > 30 ? 'var(--warning)' : 'var(--success)'
                            }}></div>
                          </div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#cbd5e1' }}>
                            {100 - item.risco}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        {item.risco >= 50 ? (
                          <button 
                            className="btn btn-outline"
                            onClick={() => setModalOS(item)}
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '0.74rem', 
                              borderColor: 'var(--danger)',
                              color: 'var(--danger)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Wrench size={13} /> Abrir OS Preventiva
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 'bold' }}>
                            Estável / Normatizado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="bi-table-footer">
            <span>Exibindo {Math.min(visibleAssetCount, ativosFiltrados.length)} de {ativosFiltrados.length} ativos</span>
            {visibleAssetCount < ativosFiltrados.length && (
              <button type="button" className="btn btn-outline" onClick={() => setVisibleAssetCount(current => current + 20)}>
                Mostrar mais 20
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL OPERACIONAL DE ABERTURA DE ORDEM DE SERVIÇO PREVENTIVA          */}
      {/* ===================================================================== */}
      {modalOS && (
        <div className="modal-overlay" onClick={() => setModalOS(null)} style={{ zIndex: 99999 }}>
          <div 
            className="bi-modal-content anim-slide-up" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bi-modal-header">
              <div>
                <span className="bi-modal-kicker">
                  <Wrench size={14} /> Manutenção Preventiva - FinOps
                </span>
                <h3>Ordem de Serviço (OS) — {modalOS.maquina}</h3>
              </div>
              <button onClick={() => setModalOS(null)} className="bi-modal-close">
                <X size={22} />
              </button>
            </div>

            <div className="bi-modal-summary-grid">
              <div>
                <span>Grau de Risco</span>
                <strong style={{ color: modalOS.risco > 70 ? 'var(--danger)' : 'var(--warning)' }}>{modalOS.risco}%</strong>
              </div>
              <div>
                <span>Compressor</span>
                <strong style={{ color: modalOS.statusMotor === 'Ativo' ? 'var(--success)' : 'var(--danger)' }}>{modalOS.statusMotor}</strong>
              </div>
              <div>
                <span>Alarmes NOC</span>
                <strong>{modalOS.alertas} ativo(s)</strong>
              </div>
            </div>

            <div className="bi-modal-desc-box">
              <label>Descrição tática gerada pelo sistema</label>
              <p>
                Chamado automático gerado pelo módulo de Business Intelligence. O ativo apresenta índice de risco de {modalOS.risco}% com {modalOS.alertas} alarme(s) pendente(s). Recomendada vistoria na câmara fria e checagem do ciclo de degelo.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '10px 12px', borderRadius: '10px', fontSize: '0.78rem', color: 'var(--danger)', marginBottom: '1.4rem' }}>
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              <span>
                Esta OS será registrada na fila corporativa com prioridade <strong>{modalOS.risco > 70 ? 'Crítica' : 'Alta'}</strong>.
              </span>
            </div>

            <div className="bi-modal-footer">
              <button 
                type="button" 
                onClick={() => setModalOS(null)} 
                className="btn btn-outline" 
                style={{ padding: '8px 18px', fontSize: '0.84rem' }}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={confirmarAberturaOS} 
                className="btn btn-primary" 
                disabled={enviandoOS}
                style={{ padding: '8px 22px', fontSize: '0.84rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {enviandoOS ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                {enviandoOS ? 'Emitindo OS...' : 'Confirmar & Abrir OS'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
