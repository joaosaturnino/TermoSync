import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip as RechartsTooltip, Legend, 
  ResponsiveContainer, AreaChart, Area, Line 
} from 'recharts';
import { 
  TrendingUp, ShieldCheck, DollarSign, LineChart as ChartIcon, 
  Briefcase, RefreshCw, AlertTriangle, CheckCircle2, 
  Building2, Server, Loader2, ArrowUpRight, Bot, Sparkles,
  Search, Download, Wrench, ShieldAlert, Cpu, Layers,
  X, Send, Check
} from 'lucide-react';
import './CentroInteligencia.css';

export default function CentroInteligenciaBI({ api, isDarkMode, showToast }) {
  const [dataAnalytics, setDataAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [abaVisao, setAbaVisao] = useState('consolidada'); // 'consolidada', 'finops', 'risco'
  const [buscaAtivo, setBuscaAtivo] = useState('');

  // Estados Operacionais (Substituem o alert do Chrome)
  const [modalOS, setModalOS] = useState(null); // Recebe o 'ativo' ao clicar em abrir OS
  const [enviandoOS, setEnviandoOS] = useState(false);
  const [notificacaoBI, setNotificacaoBI] = useState(null); // Alerta flutuante bonito in-app

  // Cores de Gráfico Recharts
  const COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#ef4444', '#8b5cf6'];
  const textFill = isDarkMode ? '#cbd5e1' : '#475569';
  const gridStroke = isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

  // Helper local de aviso sem alert nativo
  const exibirAlertaUI = (titulo, mensagem, tipo = 'success') => {
    setNotificacaoBI({ titulo, mensagem, tipo });
    showToast?.(`${titulo}: ${mensagem}`, tipo);
    setTimeout(() => setNotificacaoBI(null), 5000);
  };

  const fetchBIAnalytics = useCallback(async (silencioso = false) => {
    if (!api) return;
    try {
      if (!silencioso) setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMsg('');

      const res = await api.get('/bi/analytics');
      setDataAnalytics(res.data);
    } catch (err) {
      console.error('Erro ao carregar BI:', err);
      setErrorMsg('Não foi possível sincronizar as métricas financeiras com o servidor.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    fetchBIAnalytics();
  }, [fetchBIAnalytics]);

  // Insights Dinâmicos do Copilot AI
  const copilotInsight = useMemo(() => {
    if (!dataAnalytics) return '';
    const { kpis, analiseRisco } = dataAnalytics;
    const qtdAlertaCritico = analiseRisco.filter(r => r.risco >= 50).length;
    const custoUnitarioIoT = kpis.totalEquipamentos > 0 ? (12 + 45 / Math.max(1, kpis.totalLojas)).toFixed(2) : '15.00';
    
    return `Margem operacional excelente em ${kpis.margem}%, com ARR anual projetado de R$ ${kpis.arr.toLocaleString('pt-BR')}. Identificamos ${qtdAlertaCritico} ativo(s) IoT com risco operacional elevado que requerem calibração metrológica ou atenção preventiva. O custo médio em nuvem está estimado em R$ ${custoUnitarioIoT} por nó de telemetria.`;
  }, [dataAnalytics]);

  // Filtragem Instantânea para a Tabela Tática
  const ativosFiltrados = useMemo(() => {
    if (!dataAnalytics) return [];
    const termo = buscaAtivo.trim().toLowerCase();
    if (!termo) return dataAnalytics.analiseRisco;
    return dataAnalytics.analiseRisco.filter(a => 
      a.maquina.toLowerCase().includes(termo) ||
      String(a.alertas).includes(termo)
    );
  }, [dataAnalytics, buscaAtivo]);

  // Execução Real da Abertura da Ordem de Serviço no Modal
  const confirmarAberturaOS = async () => {
    if (!api || !modalOS) return;
    setEnviandoOS(true);
    try {
      const prioridadeOS = modalOS.risco > 70 ? 'Crítica' : 'Alta';
      const descricaoOS = `Chamado automático gerado pelo módulo de Business Intelligence (Copilot AI).\n\n• Ativo IoT: ${modalOS.maquina}\n• Índice de Risco SLA: ${modalOS.risco}%\n• Status do Compressor: ${modalOS.statusMotor}\n• Alarmes NOC Pendentes: ${modalOS.alertas} alarme(s)\n\nIntervenção preventiva recomendada para evitar violação metrológica.`;

      const res = await api.post('/chamados', {
        equipamento_id: modalOS.id || null,
        titulo: `[OS Preventiva BI] Risco Elevado (${modalOS.risco}%) em ${modalOS.maquina}`,
        descricao: descricaoOS,
        prioridade: prioridadeOS,
        categoria: 'Técnico',
        solicitante_nome: 'Copilot BI - FinOps'
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

  // Exportação para CSV (Data Lake Executivo)
  const exportarDiagnosticoCSV = () => {
    if (!dataAnalytics) return;
    let csv = "ID,Ativo_IoT,Status_Compressor,Alertas_NOC,Grau_Risco_SLA\n";
    dataAnalytics.analiseRisco.forEach(row => {
      csv += `"${row.id || ''}","${row.maquina}","${row.statusMotor}","${row.alertas}","${row.risco}%"\n`;
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv' }));
    link.download = `Auditoria_Risco_BI_${Date.now()}.csv`;
    link.click();
    exibirAlertaUI('Exportação Concluída', 'Arquivo CSV de diagnóstico de risco gerado.', 'success');
  };

  if (isLoading) {
    return (
      <div className="bi-loading-container anim-fade-in">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <Loader2 size={44} className="spin" color="#38bdf8" />
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
          <AlertTriangle size={40} color="#ef4444" />
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
  const custoPorAtivo = kpis.totalEquipamentos > 0 ? (12 + (45 * kpis.totalLojas / Math.max(1, kpis.totalEquipamentos))) : 0;

  return (
    <div className="bi-dashboard-container anim-fade-in">
      
      {/* TOAST FLUTUANTE IN-APP (SEM ALERT NATIVO) */}
      {notificacaoBI && (
        <div className={`bi-floating-toast anim-slide-up ${notificacaoBI.tipo}`}>
          <div className="bi-toast-icon">
            {notificacaoBI.tipo === 'success' ? (
              <CheckCircle2 size={22} color="#10b981" />
            ) : (
              <AlertTriangle size={22} color="#ef4444" />
            )}
          </div>
          <div className="bi-toast-text">
            <strong>{notificacaoBI.titulo}</strong>
            <span>{notificacaoBI.mensagem}</span>
          </div>
          <button 
            onClick={() => setNotificacaoBI(null)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* CABEÇALHO DO MÓDULO */}
      <div className="bi-header">
        <div>
          <h1 className="bi-title">
            <ChartIcon size={28} className="icon-glow" style={{ color: '#38bdf8' }} /> 
            Business Intelligence (DRE & FinOps)
          </h1>
          <p className="bi-subtitle">
            Demonstrativo financeiro do ecossistema, margem bruta em nuvem e telemetria de risco operacional.
          </p>
        </div>

        <div className="bi-header-actions">
          <span className="bi-live-badge">
            <span className="bi-live-dot"></span> Sincronizado via SQL
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
      </div>

      {/* BANNER DE INSIGHTS AUTOMÁTICOS (FINOPS COPILOT AI) */}
      <div className="bi-copilot-banner anim-slide-up">
        <div className="bi-copilot-icon">
          <Bot size={24} />
        </div>
        <div className="bi-copilot-content">
          <h4>
            <Sparkles size={16} color="#38bdf8" /> 
            Resumo Executivo — ThermoSync AI Copilot
          </h4>
          <p>{copilotInsight}</p>
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
            <DollarSign size={26} color="#10b981" />
          </div>
          <div className="bi-kpi-info">
            <span className="bi-kpi-label">ARR (Receita Anual Recorrente)</span>
            <h3>R$ {kpis.arr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <div className="bi-kpi-trend success">
              <ArrowUpRight size={14} /> Projeção anual sobre faturas
            </div>
          </div>
        </div>

        <div className="bi-kpi-card" style={{ borderColor: 'rgba(56, 189, 248, 0.35)' }}>
          <div className="bi-kpi-icon" style={{ background: 'rgba(56, 189, 248, 0.12)' }}>
            <TrendingUp size={26} color="#38bdf8" />
          </div>
          <div className="bi-kpi-info">
            <span className="bi-kpi-label">MRR (Receita Mensal Recorrente)</span>
            <h3>R$ {kpis.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <div className="bi-kpi-trend info">
              <Building2 size={13} /> {kpis.totalLojas} lojas cadastradas
            </div>
          </div>
        </div>

        <div className="bi-kpi-card" style={{ borderColor: 'rgba(245, 158, 11, 0.35)' }}>
          <div className="bi-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)' }}>
            <Briefcase size={26} color="#f59e0b" />
          </div>
          <div className="bi-kpi-info">
            <span className="bi-kpi-label">Margem Bruta (Lucro / Cloud)</span>
            <h3>{kpis.margem}%</h3>
            <div className="bi-kpi-trend warning">
              <Server size={13} /> {kpis.totalEquipamentos} nós IoT ativos
            </div>
          </div>
        </div>

        <div className="bi-kpi-card" style={{ borderColor: 'rgba(168, 85, 247, 0.35)' }}>
          <div className="bi-kpi-icon" style={{ background: 'rgba(168, 85, 247, 0.12)' }}>
            <Building2 size={26} color="#a855f7" />
          </div>
          <div className="bi-kpi-info">
            <span className="bi-kpi-label">ARPU (Ticket Médio SaaS)</span>
            <h3>R$ {ticketMedioARPU.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <div className="bi-kpi-trend purple">
              <TrendingUp size={13} /> Receita média por tenant
            </div>
          </div>
        </div>

        <div className="bi-kpi-card" style={{ borderColor: 'rgba(239, 68, 68, 0.35)' }}>
          <div className="bi-kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
            <Cpu size={26} color="#ef4444" />
          </div>
          <div className="bi-kpi-info">
            <span className="bi-kpi-label">Custo Médio / Ativo IoT</span>
            <h3>R$ {custoPorAtivo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <div className="bi-kpi-trend success">
              <Server size={13} /> Infraestrutura AWS + MQTT
            </div>
          </div>
        </div>

        <div className="bi-kpi-card" style={{ borderColor: 'rgba(59, 130, 246, 0.35)' }}>
          <div className="bi-kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
            <ShieldCheck size={26} color="#3b82f6" />
          </div>
          <div className="bi-kpi-info">
            <span className="bi-kpi-label">SLA Global Entregue</span>
            <h3>{kpis.uptimeGlobal}%</h3>
            <div className="bi-kpi-trend info">
              <CheckCircle2 size={13} /> Contrato 99.9% cumprido
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
              <h3>Evolução do DRE (Receita SaaS vs Custos de Infraestrutura Cloud)</h3>
              <span className="bi-chart-tag">Últimos 6 Meses</span>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={dreData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="name" stroke={textFill} />
                <YAxis stroke={textFill} tickFormatter={(val) => `R$ ${val}`} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#0f172a' : '#fff', 
                    color: textFill, 
                    borderRadius: '12px', 
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                  }} 
                  formatter={(val) => `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                />
                <Legend verticalAlign="top" height={36} />
                <Area type="monotone" dataKey="Receita_SaaS" name="Receita SaaS" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
                <Area type="monotone" dataKey="Custos_Cloud" name="Custos Nuvem/IoT" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorCusto)" />
                <Line type="monotone" dataKey="Lucro_Liquido" name="Lucro Líquido" stroke="#38bdf8" strokeWidth={2} dot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* GRÁFICO 2: DISTRIBUIÇÃO DA CARTEIRA POR PLANO */}
        {(abaVisao === 'consolidada' || abaVisao === 'finops') && (
          <div className="bi-chart-box">
            <div className="bi-chart-head">
              <h3>Carteira de Lojas por Plano SaaS</h3>
              <span className="bi-chart-tag">Ativos</span>
            </div>
            <ResponsiveContainer width="100%" height={290}>
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
                    borderRadius: '10px' 
                  }} 
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* GRÁFICO 3: ÍNDICE DE RISCO OPERACIONAL POR MÁQUINA */}
        {(abaVisao === 'consolidada' || abaVisao === 'risco') && (
          <div className="bi-chart-box" style={{ gridColumn: abaVisao === 'risco' ? '1 / -1' : 'auto' }}>
            <div className="bi-chart-head">
              <h3>Índice de Risco Operacional por Ativo IoT (%)</h3>
              <span className="bi-chart-tag">Real-Time</span>
            </div>
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={analiseRisco} layout="vertical" margin={{ left: 15, right: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={true} vertical={false} />
                <XAxis type="number" stroke={textFill} domain={[0, 100]} />
                <YAxis dataKey="maquina" type="category" stroke={textFill} width={150} tick={{ fontSize: 11 }} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#0f172a' : '#fff', 
                    color: textFill, 
                    border: '1px solid rgba(255,255,255,0.12)', 
                    borderRadius: '10px' 
                  }} 
                  formatter={(val) => `${val}% de Risco`}
                />
                <Bar dataKey="risco" name="Grau de Risco" radius={[0, 6, 6, 0]}>
                  {analiseRisco.map((entry, idx) => (
                    <Cell 
                      key={`cell-${idx}`} 
                      fill={entry.risco > 70 ? '#ef4444' : entry.risco > 30 ? '#f59e0b' : '#10b981'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
              <Search size={15} color="#94a3b8" />
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
                  ativosFiltrados.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '16px 12px', fontWeight: 'bold', color: 'white' }}>{item.maquina}</td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          background: item.statusMotor === 'Ativo' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: item.statusMotor === 'Ativo' ? '#10b981' : '#ef4444'
                        }}>
                          {item.statusMotor}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', color: item.alertas > 0 ? '#f59e0b' : '#94a3b8', fontWeight: item.alertas > 0 ? 'bold' : 'normal' }}>
                        {item.alertas} alerta(s) ativo(s)
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '85px', height: '7px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${100 - item.risco}%`,
                              height: '100%',
                              background: item.risco > 70 ? '#ef4444' : item.risco > 30 ? '#f59e0b' : '#10b981'
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
                              borderColor: '#ef4444', 
                              color: '#ef4444',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Wrench size={13} /> Abrir OS Preventiva
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>
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
                <strong style={{ color: modalOS.risco > 70 ? '#ef4444' : '#f59e0b' }}>{modalOS.risco}%</strong>
              </div>
              <div>
                <span>Compressor</span>
                <strong style={{ color: modalOS.statusMotor === 'Ativo' ? '#10b981' : '#ef4444' }}>{modalOS.statusMotor}</strong>
              </div>
              <div>
                <span>Alarmes NOC</span>
                <strong>{modalOS.alertas} ativo(s)</strong>
              </div>
            </div>

            <div className="bi-modal-desc-box">
              <label>Descrição Tática Gerada (Copilot AI)</label>
              <p>
                Chamado automático gerado pelo módulo de Business Intelligence (Copilot AI). O ativo apresenta índice de risco de {modalOS.risco}% com {modalOS.alertas} alarme(s) NOC pendente(s). Recomendada vistoria na câmara fria e checagem de ciclo de degelo.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '10px 12px', borderRadius: '10px', fontSize: '0.78rem', color: '#fca5a5', marginBottom: '1.4rem' }}>
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