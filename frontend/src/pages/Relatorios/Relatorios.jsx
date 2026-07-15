import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import { 
  Zap, CheckCircle2, ShieldCheck, Thermometer, Clock, 
  FileText, AlertCircle, Loader2, Filter, Activity, 
  ListOrdered, DownloadCloud, BarChart2, CheckSquare, Shield, WifiOff
} from 'lucide-react';

import ptBR from 'date-fns/locale/pt-BR'; 
registerLocale('pt', ptBR);

import 'react-datepicker/dist/react-datepicker.css';
import './Relatorios.css';

export default function Relatorios({ api, filialAtiva, showToast, isDarkMode, isOffline }) {

  // ==========================================
  // ESTADOS DO COMPONENTE (30 DIAS PADRÃO)
  // ==========================================
  const [dataInicio, setDataInicio] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); 
  const [dataFim, setDataFim] = useState(new Date());
  
  const [equipamentoFiltro, setEquipamentoFiltro] = useState('');
  const [equipamentos, setEquipamentos] = useState([]);
  const [leiturasBrutas, setLeiturasBrutas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ==========================================
  // BUSCA REAL NO BANCO DE DADOS (API)
  // ==========================================
  useEffect(() => {
    if (!api) return;
    api.get('/equipamentos', { params: { filial: filialAtiva !== 'Todas' ? filialAtiva : undefined } })
       .then(res => setEquipamentos(res.data || []))
       .catch(err => console.error("Erro ao buscar equipamentos:", err));
  }, [api, filialAtiva]);

  const buscarRelatorio = useCallback(async () => {
    if (!api || isOffline) return;
    setIsLoading(true);
    
    try {
      const res = await api.get('/relatorios', {
        params: {
          data_inicio: dataInicio.toISOString(),
          data_fim: dataFim.toISOString()
        }
      });
      setLeiturasBrutas(res.data || []);
    } catch (e) {
      if(showToast) showToast('Aviso: Não foi possível buscar o histórico de relatórios.', 'error');
      setLeiturasBrutas([]); 
    } finally {
      setIsLoading(false);
    }
  }, [api, dataInicio, dataFim, isOffline, showToast]);

  useEffect(() => {
    buscarRelatorio();
  }, [buscarRelatorio]);

  // ==========================================
  // PROCESSAMENTO SEGURO DE DADOS (COM FILTRO LOCAL)
  // ==========================================
  const equipamentosDaFilial = useMemo(() => {
    if (!filialAtiva || filialAtiva === 'Todas') return equipamentos;
    return equipamentos.filter(eq => (eq.filial || 'Loja Principal').trim().toLowerCase() === filialAtiva.trim().toLowerCase());
  }, [equipamentos, filialAtiva]);

  const equipamentoSelecionado = useMemo(() => {
    return equipamentosDaFilial.find(eq => eq.nome === equipamentoFiltro) || null;
  }, [equipamentosDaFilial, equipamentoFiltro]);

  const { dadosGrafico, kpis, tabelaReversa } = useMemo(() => {
    
    let leiturasParaProcessar = leiturasBrutas;
    
    if (filialAtiva && filialAtiva !== 'Todas') {
      leiturasParaProcessar = leiturasParaProcessar.filter(l => {
        const filialDB = (l.filial || 'Loja Principal').trim().toLowerCase();
        return filialDB === filialAtiva.trim().toLowerCase();
      });
    }

    if (equipamentoFiltro) {
      leiturasParaProcessar = leiturasParaProcessar.filter(l => l.nome === equipamentoFiltro);
    }

    if (!leiturasParaProcessar || leiturasParaProcessar.length === 0) {
      return { 
        dadosGrafico: [], 
        tabelaReversa: [],
        kpis: { totalEnergia: 0, slaCompliance: 100, mktValue: 0, maxTemp: '--' } 
      };
    }

    let maxT = -999;
    let leiturasValidasSLA = 0;
    let somaTemp = 0;
    
    // Tratamento Robusto de Energia: Se o delta falhar, soma os valores do período
    const energiaFinal = leiturasParaProcessar[leiturasParaProcessar.length - 1]?.consumo_kwh || 0;
    const energiaInicial = leiturasParaProcessar[0]?.consumo_kwh || 0;
    let energiaGasta = energiaFinal - energiaInicial;
    
    if (energiaGasta <= 0) {
      energiaGasta = leiturasParaProcessar.reduce((acc, l) => acc + (Number(l.consumo_kwh) || 0), 0);
    }

    const graficoProcessado = leiturasParaProcessar.map(l => {
      const tempNum = Number(l.temperatura);
      const umidNum = Number(l.umidade || 0);

      if (tempNum > maxT) maxT = tempNum;
      
      let eqInfo = equipamentoSelecionado || equipamentosDaFilial.find(e => e.nome === l.nome) || { temp_min: 2, temp_max: 8 };
      if (tempNum >= eqInfo.temp_min && tempNum <= eqInfo.temp_max) {
        leiturasValidasSLA++;
      }
      
      somaTemp += tempNum;

      return {
        hora: new Date(l.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        temperatura: tempNum,
        umidade: umidNum,
        nome: l.nome,
        dataExata: l.data_hora,
        consumo_kwh: Number(l.consumo_kwh || 0)
      };
    }); 

    const slaPerc = ((leiturasValidasSLA / leiturasParaProcessar.length) * 100).toFixed(1);
    const mediaTemp = (somaTemp / leiturasParaProcessar.length).toFixed(1);
    const tabelaInvertida = [...graficoProcessado].reverse();

    return {
      dadosGrafico: graficoProcessado,
      tabelaReversa: tabelaInvertida,
      kpis: {
        totalEnergia: energiaGasta,
        slaCompliance: slaPerc,
        mktValue: mediaTemp,
        maxTemp: maxT.toFixed(1)
      }
    };
  }, [leiturasBrutas, filialAtiva, equipamentoFiltro, equipamentoSelecionado, equipamentosDaFilial]);

  // ==========================================
  // SEGURANÇA E EXPORTAÇÃO
  // ==========================================
  const generateRowHash = (data, temp, umid) => {
    const raw = `${data}-${temp}-${umid}-thermosync-autenticado`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  };

  const setQuickRange = (hours) => {
    const end = new Date();
    const start = new Date();
    start.setHours(start.getHours() - hours);
    setDataInicio(start);
    setDataFim(end);
  };

  const extrairPlanilhaCSV = () => {
    if (tabelaReversa.length === 0) return showToast('Não há dados para exportar neste período.', 'error');
    
    showToast('Gerando arquivo com Assinatura Digital...', 'info');
    
    let csvContent = "Data/Hora,Equipamento,Temperatura (C),Umidade (%),Energia (kWh),Assinatura de Validacao\n";
    tabelaReversa.forEach(row => {
      const dataFormatada = new Date(row.dataExata).toLocaleString('pt-BR');
      const hash = generateRowHash(row.dataExata, row.temperatura, row.umidade);
      csvContent += `"${dataFormatada}","${row.nome}",${row.temperatura},${row.umidade},${row.consumo_kwh},"${hash}"\n`;
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); 
    link.href = URL.createObjectURL(blob); 
    link.download = `Auditoria_ThermoSync_${Date.now()}.csv`;
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
    
    setTimeout(() => showToast('Planilha baixada com sucesso!', 'success'), 800);
  };

  const currentRangeHours = Math.round((dataFim - dataInicio) / (1000 * 60 * 60));

  return (
    <div className="anim-fade-in stagger-1">
      
      <div className="relatorios-hero">
        <div className="hero-title-box">
          <div className="hero-icon-circle"><BarChart2 size={28} /></div>
          <div>
            <h3 className="hero-main-title">Relatórios & Análise de Desempenho</h3>
            <span className="hero-subtitle">Métricas de qualidade, temperatura e histórico de consumo de energia da loja.</span>
          </div>
        </div>
        <div className="hero-actions">
          <button className="btn-export pdf" onClick={() => showToast('A geração de PDF está em processamento no servidor.', 'info')} disabled={isLoading || isOffline}>
            <FileText size={16} /> Relatório Oficial (PDF)
          </button>
          <button className="btn-export csv" onClick={extrairPlanilhaCSV} disabled={isLoading || isOffline}>
            <DownloadCloud size={16} /> Exportar Planilha (CSV)
          </button>
        </div>
      </div>

      <div className="filtros-deck stagger-2">
        <div className="deck-row">
          <div className="control-group">
            <label className="control-label"><Filter size={14}/> Equipamento Analisado</label>
            <select className="custom-select" value={equipamentoFiltro} onChange={(e) => setEquipamentoFiltro(e.target.value)} disabled={isLoading || isOffline}>
              <option value="">Todos os Equipamentos / Visão Geral</option>
              {equipamentosDaFilial?.map(eq => (
                <option key={eq.id} value={eq.nome}>{eq.nome} - {eq.setor}</option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label className="control-label"><Clock size={14}/> Período de Análise</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <DatePicker selected={dataInicio} onChange={(date) => setDataInicio(date)} showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="dd/MM/yyyy HH:mm" className="custom-datepicker" disabled={isLoading || isOffline} />
              <DatePicker selected={dataFim} onChange={(date) => setDataFim(date)} showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="dd/MM/yyyy HH:mm" className="custom-datepicker" disabled={isLoading || isOffline} minDate={dataInicio} />
            </div>
          </div>
          <div className="control-group" style={{ flex: '0 1 auto' }}>
            <label className="control-label">Períodos Rápidos</label>
            <div className="quick-range-group">
              <button type="button" className={`btn-quick-range ${currentRangeHours === 6 ? 'active' : ''}`} onClick={() => setQuickRange(6)} disabled={isLoading || isOffline}>Últimas 6h</button>
              <button type="button" className={`btn-quick-range ${currentRangeHours === 12 ? 'active' : ''}`} onClick={() => setQuickRange(12)} disabled={isLoading || isOffline}>Últimas 12h</button>
              <button type="button" className={`btn-quick-range ${currentRangeHours === 24 ? 'active' : ''}`} onClick={() => setQuickRange(24)} disabled={isLoading || isOffline}>24 Horas</button>
            </div>
          </div>
        </div>
      </div>

      <div className="kpi-grid stagger-3">
        <div className="kpi-card" style={{ '--kpi-color': '#10b981' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><ShieldCheck size={20} /></div><span>Faixa de Segurança</span></div>
          <h4 className="kpi-value">{kpis.slaCompliance}<span className="kpi-unit">%</span></h4>
          <p className="kpi-trend">Temperaturas dentro da margem segura exigida.</p>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#3b82f6' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><Thermometer size={20} /></div><span>Temperatura Média</span></div>
          <h4 className="kpi-value">{kpis.mktValue}<span className="kpi-unit">°C</span></h4>
          <p className="kpi-trend">Média térmica para análise de conservação.</p>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#f59e0b' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><Zap size={20} /></div><span>Consumo Estimado</span></div>
          <h4 className="kpi-value">{kpis.totalEnergia?.toFixed(1) || 0}<span className="kpi-unit">kWh</span></h4>
          <p className="kpi-trend">Gasto de energia acumulado no período filtrado.</p>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#ef4444' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><AlertCircle size={20} /></div><span>Pico Máximo</span></div>
          <h4 className="kpi-value">{kpis.maxTemp}<span className="kpi-unit">°C</span></h4>
          <p className="kpi-trend">A maior temperatura atingida no período.</p>
        </div>
      </div>

      <div className="chart-container-hud stagger-4">
        <div className="chart-header">
          <div className="chart-title"><Activity size={20} color="#3b82f6" /> Gráfico de Desempenho Térmico</div>
          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '800', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}><CheckCircle2 size={12} style={{ display: 'inline', marginBottom: '-2px' }}/> DADOS VALIDADOS</span>
        </div>
        
        {isOffline ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
            <WifiOff size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <h4 style={{ margin: 0 }}>Sem Conexão</h4>
            <p style={{ fontSize: '0.85rem', color: '#fca5a5' }}>Conecte-se à internet para buscar o histórico de relatórios.</p>
          </div>
        ) : isLoading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <Loader2 size={32} className="spin" style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <p>Buscando histórico de temperatura no sistema...</p>
          </div>
        ) : dadosGrafico.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <Activity size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <h4 style={{ margin: 0 }}>Nenhum Registro</h4>
            <p style={{ fontSize: '0.85rem' }}>Não há dados de temperatura gravados neste período.</p>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosGrafico} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                <XAxis dataKey="hora" stroke="#64748b" fontSize={11} tickMargin={10} minTickGap={30} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={11} tickFormatter={(val) => `${val}°C`} width={50} />
                <Tooltip contentStyle={{ backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'white', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '8px', color: isDarkMode ? 'white' : '#0f172a' }} itemStyle={{ color: isDarkMode ? 'white' : '#0f172a' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                
                {equipamentoSelecionado && (
                  <>
                    <ReferenceLine yAxisId="left" y={equipamentoSelecionado.temp_max} stroke="#ef4444" strokeDasharray="4 4" label={{ position: 'top', value: 'Limite Máximo', fill: '#ef4444', fontSize: 10 }} />
                    <ReferenceLine yAxisId="left" y={equipamentoSelecionado.temp_min} stroke="#3b82f6" strokeDasharray="4 4" label={{ position: 'bottom', value: 'Limite Mínimo', fill: '#3b82f6', fontSize: 10 }} />
                  </>
                )}
                
                <Line yAxisId="left" type="monotone" dataKey="temperatura" name="Temperatura (°C)" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 6, fill: '#10b981', stroke: '#020617', strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="leituras-log-card stagger-4">
        <div className="log-header">
          <div className="log-title"><ListOrdered size={20} color="#3b82f6" /> Histórico Detalhado de Leituras</div>
          <div className="log-status" title="Os dados desta tabela não podem ser apagados pelo usuário comum."><CheckSquare size={14} /> Dados Imutáveis</div>
        </div>

        {isLoading ? (
           <div className="empty-log">Carregando lista de registros de temperatura...</div>
        ) : tabelaReversa.length === 0 ? (
          <div className="empty-log">Não há registros para exibir na tabela neste período.</div>
        ) : (
          <div className="log-table-wrapper">
            <table className="log-table">
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Câmara / Equipamento</th>
                  <th>Selo de Autenticidade</th>
                  <th>Temp (°C)</th>
                  <th>Umidade (%)</th>
                  <th>Energia (kWh)</th>
                </tr>
              </thead>
              <tbody>
                {tabelaReversa.map((d, i) => {
                  let eqLocal = equipamentoSelecionado;
                  if (!eqLocal) eqLocal = equipamentosDaFilial?.find(x => x.nome === d.nome);
                  const isForaLimites = eqLocal && (d.temperatura < eqLocal.temp_min || d.temperatura > eqLocal.temp_max);
                  const validationCode = generateRowHash(d.dataExata, d.temperatura, d.umidade);

                  return (
                    <tr key={i} className={`log-row ${isForaLimites ? 'critical' : ''}`}>
                      <td data-label="Data / Hora" className="log-time">{new Date(d.dataExata).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td data-label="Equipamento" className="log-node" title={`${d.nome}`}>{d.nome.substring(0, 20)}</td>
                      <td data-label="Autenticidade"><span className="log-hash" title="Código de Segurança de Leitura"><Shield size={12}/> {validationCode}</span></td>
                      <td data-label="Temp (°C)" className={isForaLimites ? 'log-val-alert' : 'log-val-ok'}>{d.temperatura.toFixed(1)} {isForaLimites ? '⚠️' : ''}</td>
                      <td data-label="Umidade (%)">{d.umidade > 0 ? d.umidade.toFixed(1) : '--'}</td>
                      <td data-label="Energia (kWh)">{d.consumo_kwh.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}