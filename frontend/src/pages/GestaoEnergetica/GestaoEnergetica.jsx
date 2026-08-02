import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ResponsiveContainer, ComposedChart, Area, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Zap, Leaf, Activity, DollarSign, CalendarDays, Loader2, Server, CheckCircle2, Clock } from 'lucide-react';
import axios from 'axios';

import ptBR from 'date-fns/locale/pt-BR'; 
registerLocale('pt', ptBR);

import 'react-datepicker/dist/react-datepicker.css';
import './GestaoEnergetica.css'; 

/**
 * Página de Gestão Energética (ESG)
 *
 * Responsabilidades:
 * - Agregar leituras de energia por equipamento e período
 * - Calcular custo estimado, pegada de carbono e identificar picos
 * - Expor gráficos e relatórios para auditoria energética
 *
 * Props: `api`, `filialAtiva`, `showToast`, `isDarkMode`, `isOffline`
 */
export default function GestaoEnergetica({ api, filialAtiva, showToast, isDarkMode, isOffline }) {
  
  // ==========================================
  // ESTADOS DO COMPONENTE
  // Ampliado para 30 dias para garantir a captura de dados de teste do banco
  // ==========================================
  const [dataInicio, setDataInicio] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); 
  const [dataFim, setDataFim] = useState(new Date());
  
  const [leiturasBrutas, setLeiturasBrutas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Parâmetros Fiscais/Ecológicos 
  const TARIFA_KWH = 0.85; 
  const FATOR_CARBONO = 0.082; 

  // ==========================================
  // INTEGRAÇÃO COM A API (DADOS REAIS)
  // ==========================================
  const buscarDadosEnergia = useCallback(async () => {
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
      if (showToast) showToast('Aviso: Erro ao buscar os dados energéticos do servidor.', 'error');
      setLeiturasBrutas([]); 
    } finally {
      setIsLoading(false);
    }
  }, [api, dataInicio, dataFim, isOffline, showToast]);

  useEffect(() => {
    buscarDadosEnergia();
  }, [buscarDadosEnergia]);

  // ==========================================
  // PROCESSAMENTO DE DADOS (ESG)
  // ==========================================
  const { totalKw, custoEstimado, pegadaCarbono, consumoDiario, topConsumidores, picoDemanda } = useMemo(() => {
    
    let leituras = leiturasBrutas;
    if (filialAtiva && filialAtiva !== 'Todas') {
      leituras = leituras.filter(l => {
        const filialDB = (l.filial || 'Loja Principal').trim().toLowerCase();
        return filialDB === filialAtiva.trim().toLowerCase();
      });
    }

    if (!leituras || leituras.length === 0) {
      return { totalKw: 0, custoEstimado: 0, pegadaCarbono: 0, consumoDiario: [], topConsumidores: [], picoDemanda: '--:--' };
    }

    let totalGeral = 0;
    const mapaEquipamentos = {};
    const mapaDiario = {};
    const mapaHorario = {};

    leituras.forEach(l => {
      const dataObj = new Date(l.data_hora);
      const diaKey = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const horaKey = dataObj.getHours().toString().padStart(2, '0') + ':00';
      
      const eqNome = l.nome || 'Desconhecido';
      // Soma direta para garantir que o gráfico mostre resultados mesmo com dados de teste
      const gastoKwh = Number(l.consumo_kwh) || 0;

      if (!mapaEquipamentos[eqNome]) mapaEquipamentos[eqNome] = 0;
      if (!mapaDiario[diaKey]) mapaDiario[diaKey] = 0;
      if (!mapaHorario[horaKey]) mapaHorario[horaKey] = 0;

      if (gastoKwh > 0) {
        mapaEquipamentos[eqNome] += gastoKwh;
        mapaDiario[diaKey] += gastoKwh;
        mapaHorario[horaKey] += gastoKwh;
        totalGeral += gastoKwh;
      }
    });

    const diasUnicos = Object.keys(mapaDiario).length || 1;
    const mediaPorDia = totalGeral / diasUnicos;

    const arrayDiario = Object.keys(mapaDiario).map(dia => ({
      dia: dia,
      kwh: Number(mapaDiario[dia].toFixed(1)),
      meta: Number(mediaPorDia.toFixed(1))
    }));

    const arrayTopConsumidores = Object.keys(mapaEquipamentos)
      .map(nome => ({
        nome: nome,
        kwh: Number(mapaEquipamentos[nome].toFixed(1))
      }))
      .filter(x => x.kwh > 0) 
      .sort((a, b) => b.kwh - a.kwh) 
      .slice(0, 5); 
      
    let horaDePico = '--:--';
    let maxGastoHora = -1;
    for (const [hora, gasto] of Object.entries(mapaHorario)) {
      if (gasto > maxGastoHora) {
        maxGastoHora = gasto;
        horaDePico = hora;
      }
    }

    return {
      totalKw: Number(totalGeral.toFixed(1)),
      custoEstimado: Number((totalGeral * TARIFA_KWH).toFixed(2)),
      pegadaCarbono: Number((totalGeral * FATOR_CARBONO).toFixed(2)),
      consumoDiario: arrayDiario,
      topConsumidores: arrayTopConsumidores,
      picoDemanda: horaDePico
    };

  }, [leiturasBrutas, filialAtiva]);

  const setQuickRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDataInicio(start);
    setDataFim(end);
  };

  const currentRangeDays = Math.round((dataFim - dataInicio) / (1000 * 60 * 60 * 24));

  return (
    <div className="anim-fade-in stagger-1">
      
      <div className="energy-hero">
        <div className="hero-title-box">
          <div className="hero-icon-circle" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
            <Zap size={28} />
          </div>
          <div>
            <h3 className="hero-main-title">Gestão Energética (ESG)</h3>
            <span className="hero-subtitle">Auditoria de consumo elétrico, projeção de custos e pegada de carbono.</span>
          </div>
        </div>
      </div>

      <div className="filtros-deck stagger-2">
        <div className="deck-row">
          <div className="control-group">
            <label className="control-label"><CalendarDays size={14}/> Período do Relatório</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <DatePicker selected={dataInicio} onChange={(date) => setDataInicio(date)} dateFormat="dd/MM/yyyy" className="custom-datepicker" disabled={isLoading || isOffline} />
              <DatePicker selected={dataFim} onChange={(date) => setDataFim(date)} dateFormat="dd/MM/yyyy" className="custom-datepicker" disabled={isLoading || isOffline} minDate={dataInicio} />
            </div>
          </div>
          <div className="control-group" style={{ flex: '0 1 auto' }}>
            <label className="control-label">Intervalos Rápidos</label>
            <div className="quick-range-group">
              <button type="button" className={`btn-quick-range ${currentRangeDays === 7 ? 'active' : ''}`} onClick={() => setQuickRange(7)} disabled={isLoading || isOffline}>Últ. 7 Dias</button>
              <button type="button" className={`btn-quick-range ${currentRangeDays === 15 ? 'active' : ''}`} onClick={() => setQuickRange(15)} disabled={isLoading || isOffline}>Últ. 15 Dias</button>
              <button type="button" className={`btn-quick-range ${currentRangeDays === 30 ? 'active' : ''}`} onClick={() => setQuickRange(30)} disabled={isLoading || isOffline}>Mês Completo</button>
            </div>
          </div>
        </div>
      </div>

      <div className="kpi-grid stagger-3">
        <div className="kpi-card" style={{ '--kpi-color': '#f59e0b' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><Zap size={20} /></div><span>Consumo Acumulado</span></div>
          <h4 className="kpi-value">{totalKw.toLocaleString('pt-BR')}<span className="kpi-unit">kWh</span></h4>
          <p className="kpi-trend">Energia ativa consumida no período.</p>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#10b981' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><DollarSign size={20} /></div><span>Custo Projetado</span></div>
          <h4 className="kpi-value"><span className="kpi-unit" style={{fontSize:'1.2rem', marginRight:'4px'}}>R$</span>{custoEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h4>
          <p className="kpi-trend">Estimativa financeira (Base: R$ 0,85/kWh).</p>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#38bdf8' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><Leaf size={20} /></div><span>Pegada de Carbono</span></div>
          <h4 className="kpi-value">{pegadaCarbono}<span className="kpi-unit">tCO₂e</span></h4>
          <p className="kpi-trend">Estimativa de emissões de gases estufa.</p>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': '#ef4444' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><Clock size={20} /></div><span>Pico de Demanda</span></div>
          <h4 className="kpi-value" style={{ fontSize: '1.7rem', marginTop: '5px' }}>{picoDemanda}</h4>
          <p className="kpi-trend">Horário com maior gasto de energia.</p>
        </div>
      </div>

      <div className="charts-grid stagger-4">
        <div className="chart-container-hud">
          <div className="chart-header">
            <div className="chart-title"><Activity size={20} color="#f59e0b" /> Demanda Diária vs Média</div>
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '800', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}><CheckCircle2 size={12} style={{ display: 'inline', marginBottom: '-2px' }}/> DADOS DO BANCO</span>
          </div>
          
          {isLoading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <Loader2 size={32} className="spin" style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <p>Processando matriz energética...</p>
            </div>
          ) : consumoDiario?.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <Server size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <h4 style={{ margin: 0 }}>Sem Leituras</h4>
              <p style={{ fontSize: '0.85rem' }}>Não há dados de medidores para este período.</p>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={consumoDiario} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorKw" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                  <XAxis dataKey="dia" stroke="#64748b" fontSize={11} tickMargin={10} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `${val}k`} width={50} />
                  <Tooltip contentStyle={{ backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'white', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '8px', color: isDarkMode ? 'white' : '#0f172a' }} itemStyle={{ color: isDarkMode ? 'white' : '#0f172a' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="kwh" name="Consumo Real (kWh)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorKw)" strokeWidth={2} activeDot={{ r: 6 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="meta" name="Média do Período" stroke="#38bdf8" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="chart-container-hud">
          <div className="chart-header">
            <div className="chart-title"><Server size={20} color="#ef4444" /> Ranking de Consumo por Equipamento</div>
          </div>
          
          {isLoading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <Loader2 size={32} className="spin" style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <p>Analisando telemetria de hardware...</p>
            </div>
          ) : topConsumidores?.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <Server size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p style={{ fontSize: '0.85rem' }}>Equipamentos inativos no período.</p>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topConsumidores} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(val) => `${val}k`} />
                  <YAxis dataKey="nome" type="category" stroke="#cbd5e1" fontSize={10} width={120} tickFormatter={(val) => val.length > 15 ? val.substring(0,15)+'...' : val} />
                  <Tooltip cursor={{fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}} contentStyle={{ backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'white', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '8px' }} />
                  <Bar dataKey="kwh" name="Consumo (kWh)" fill="#ef4444" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}