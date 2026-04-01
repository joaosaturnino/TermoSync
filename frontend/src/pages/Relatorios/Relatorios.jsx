import React, { useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Leaf, Zap, CheckCircle, BrainCircuit, Thermometer, Droplets, Clock3, Wifi, WifiOff, FileText, Bot, ShieldCheck, MapPin, Loader2 } from 'lucide-react';

// 🔴 CORREÇÃO DA IMPORTAÇÃO DO IDIOMA
import { pt } from 'date-fns/locale/pt'; 
registerLocale('pt', pt);

import 'react-datepicker/dist/react-datepicker.css';
import './Relatorios.css';

export default function Relatorios({ 
  totalEnergia, slaCompliance, kpis, mktValueProcessado, dataInicio, setDataInicio, dataFim, setDataFim, 
  isOffline, equipamentoFiltro, setEquipamentoFiltro, equipamentosDaFilial, gerarExportacao, 
  dadosGraficoFiltrados, isDarkMode, equipamentoSelecionado, ultimasLeiturasRaw 
}) {
  return (
    <div className="anim-fade-in stagger-1">
      {/* SEÇÃO 1: KPIs SUPERIORES INTELIGENTES */}
      <div className="kpi-relatorios-grid stagger-1">
        
        {/* Sustentabilidade ESG (Energia) */}
        <div className="kpi-relatorios-card">
          <div className="kpi-relatorios-header">
            <span className="kpi-relatorios-title">Consumo Energético ESG</span>
            <div className="kpi-relatorios-icon-box" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
              <Zap size={20} color="#f59e0b" />
            </div>
          </div>
          <div className="kpi-relatorios-value kpi-neon-blue">
            {totalEnergia?.toFixed(1) || '--'} <span style={{ fontSize: '1.2rem', opacity: 0.6 }}>kWh</span>
          </div>
          <span className="kpi-relatorios-subtitle">Impacto na pegada de carbono</span>
        </div>

        {/* Auditoria Legal (SLA) */}
        <div className="kpi-relatorios-card">
          <div className="kpi-relatorios-header">
            <span className="kpi-relatorios-title">Conformidade Legal (ANVISA)</span>
            <div className="kpi-relatorios-icon-box">
              <CheckCircle size={20} color="var(--success)" />
            </div>
          </div>
          <div className={`kpi-relatorios-value ${Number(slaCompliance) < 95 ? 'kpi-neon-red' : 'kpi-neon-green'}`}>
            {slaCompliance || '--'} <span style={{ fontSize: '1.2rem', opacity: 0.6 }}>%</span>
          </div>
          <span className="kpi-relatorios-subtitle">Tempo dentro do SLA de temperatura</span>
        </div>

        {/* Inteligência Metrológica (MKT) */}
        <div className="kpi-relatorios-card">
          <div className="kpi-relatorios-header">
            <span className="kpi-relatorios-title">MKT - Média Cinética</span>
            <div className="kpi-relatorios-icon-box" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
              <BrainCircuit size={20} color="var(--info)" />
            </div>
          </div>
          <div className="kpi-relatorios-value kpi-neon-blue">
            {mktValueProcessado || '--'} <span style={{ fontSize: '1.2rem', opacity: 0.6 }}>°C</span>
          </div>
          <span className="kpi-relatorios-subtitle">Média de impacto na vida útil do produto</span>
        </div>

        {/* Pico Térmico */}
        <div className="kpi-relatorios-card">
          <div className="kpi-relatorios-header">
            <span className="kpi-relatorios-title">Pico Térmico Registado</span>
            <div className="kpi-relatorios-icon-box" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
              <Thermometer size={20} color="var(--danger)" />
            </div>
          </div>
          <div className="kpi-relatorios-value kpi-neon-red">
            {kpis?.kpiMaxT || '--'} <span style={{ fontSize: '1.2rem', opacity: 0.6 }}>°C</span>
          </div>
          <span className="kpi-relatorios-subtitle">Temperatura máxima no período</span>
        </div>
      </div>

      {/* SEÇÃO 2: PAINEL DE CONTROLOS UNIFICADO */}
      <div className="card relatorios-controls-card stagger-2">
        <div className="relatorios-controls-header">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
             <ShieldCheck size={22} color="var(--primary)" /> 
             Auditoria de Qualidade RDC
          </h3>
          {isOffline ? (
            <div className="empty-state" style={{ flexDirection: 'row', gap: '8px', padding: '8px 16px' }}><WifiOff size={18} color="var(--danger)"/> Offline</div>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}><div className="empty-state" style={{ flexDirection: 'row', gap: '8px', padding: '8px 16px', color: 'var(--success)' }}><Loader2 size={18} color="var(--success)" className="spinner" /> Sincronizado</div></div>
          )}
        </div>
        
        <div className="controls-section">
          {/* Equipamento */}
          <div className="filter-group">
            <label className="filter-label"><Thermometer size={14}/> Ativo IoT</label>
            <select className="select-input" value={equipamentoFiltro} onChange={(e) => setEquipamentoFiltro(e.target.value)}>
              <option value="">Todos os Ativos</option>
              {equipamentosDaFilial?.map(eq => <option key={eq.id} value={eq.nome}>{eq.nome}</option>)}
            </select>
          </div>
          
          {/* Data Inicio */}
          <div className="filter-group">
            <label className="filter-label"><Clock3 size={14}/> Início da Auditoria</label>
            <DatePicker selected={dataInicio} onChange={(date) => setDataInicio(date)} selectsStart startDate={dataInicio} endDate={dataFim} showTimeSelect locale={pt} dateFormat="Pp" className="date-picker-custom w-100" />
          </div>
          
          {/* Data Fim */}
          <div className="filter-group">
            <label className="filter-label"><Clock3 size={14}/> Conclusão da Auditoria</label>
            <DatePicker selected={dataFim} onChange={(date) => setDataFim(date)} selectsEnd startDate={dataInicio} endDate={dataFim} minDate={dataInicio} showTimeSelect locale={pt} dateFormat="Pp" className="date-picker-custom w-100" />
          </div>

          {/* Botões de Exportação */}
          <div className="relatorios-export-group">
            <button className="btn btn-primary" onClick={() => gerarExportacao('pdf')} disabled={isOffline}><FileText size={18} /> Exportar PDF Auditável</button>
            <button className="btn btn-outline" style={{ background: 'rgba(255,255,255,0.05)' }} onClick={() => gerarExportacao('csv')} disabled={isOffline}><FileText size={18} /> Planilha CSV</button>
          </div>
        </div>
      </div>

      {/* SEÇÃO 3: GRÁFICO E TABELA */}
      <div className="relatorios-grid stagger-3">
        {/* Gráfico de Monitorização */}
        <div className="card chart-relatorios-container">
          <div className="flex-header" style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontWeight: '800' }}>Monitorização Térmica Contínua</h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Leituras do sensor de 15 em 15 minutos</span>
          </div>
          {!dadosGraficoFiltrados || dadosGraficoFiltrados.length === 0 ? (
            <div className="chart-loading"><Thermometer size={32} style={{ marginBottom: '1rem' }}/> Sem dados para o gráfico.</div>
          ) : (
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={dadosGraficoFiltrados} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                <YAxis unit="°C" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)', borderRadius: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} />
                <Line type="monotone" dataKey="temperatura" name="Temperatura" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 3 }} />
                {dadosGraficoFiltrados[0]?.umidade > 0 && <Line type="monotone" dataKey="umidade" name="Humidade" stroke="#38bdf8" strokeWidth={2} dot={false} strokeDasharray="5 5" />}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tabela Raw Data */}
        <div className="card table-responsive">
          <div className="flex-header" style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontWeight: '800' }}>Livro de Registo Auditável</h4>
          </div>
          <div className="table-raw-container">
            {!ultimasLeiturasRaw || ultimasLeiturasRaw.length === 0 ? (
              <div className="empty-state">Sem leituras pendentes.</div>
            ) : (
              <table className="table">
                <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1 }}><tr><th>Hora</th><th>Eq.</th><th>Temp</th><th>Hum</th><th>kWh</th></tr></thead>
                <tbody>
                  {ultimasLeiturasRaw.map((d, i) => (
                    <tr key={i}>
                      <td>{d.hora}</td>
                      <td style={{ fontWeight: '700' }} title={`${d.filial} - ${d.nome}`}>{d.nome}</td>
                      <td className={d.temperatura < (equipamentoSelecionado?.temp_min || 0) || d.temperatura > (equipamentoSelecionado?.temp_max || 8) ? 'val-red' : 'val-green'}>{d.temperatura.toFixed(1)}°C</td>
                      <td>{d.umidade > 0 ? d.umidade.toFixed(1) + '%' : '--'}</td>
                      <td>{d.consumo_kwh.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}