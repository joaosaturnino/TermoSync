import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Leaf, Zap, Percent, Thermometer, Clock, Download, FileText, List } from 'lucide-react';

const CUSTO_KWH_REAIS = 0.72; 
const FATOR_EMISSAO_CO2 = 0.25; 

export default function Relatorios({ 
  totalEnergia, slaCompliance, kpis, mktValueProcessado, dataInicio, setDataInicio, dataFim, setDataFim,
  isOffline, equipamentoFiltro, setEquipamentoFiltro, equipamentosDaFilial, gerarExportacao, 
  dadosGraficoFiltrados, isDarkMode, equipamentoSelecionado, ultimasLeiturasRaw 
}) {
  const [mostrarTabelaBruta, setMostrarTabelaBruta] = useState(false);
  const aplicarFiltroRapido = (horas) => { const agora = new Date(); setDataFim(agora); setDataInicio(new Date(agora.getTime() - (horas * 60 * 60 * 1000))); };

  return (
    <div className="anim-fade-in stagger-1">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card pulse-danger" style={{ padding: '1rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', animationDuration: '4s' }}>
              <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}><Leaf size={18} /> Métrica ESG: Pegada de Carbono</h4>
              <div style={{ fontSize: '3.5rem', fontWeight: '900', color: '#10b981' }}>{(totalEnergia * FATOR_EMISSAO_CO2).toFixed(1)} <span style={{fontSize: '1rem', color:'var(--text-muted)'}}>kg CO2</span></div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Impacto ambiental derivado do consumo elétrico.</div>
          </div>
          <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}><Zap size={18} /> Custo Estimado (ESG)</h4>
              <div style={{ fontSize: '3.5rem', fontWeight: '900', color: '#f59e0b' }}><span style={{fontSize: '1.5rem'}}>R$ </span>{(totalEnergia * CUSTO_KWH_REAIS).toFixed(2)}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Baseado em {(totalEnergia).toFixed(0)} kWh medidos.</div>
          </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--success)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}><Percent size={18} /> Compliance Score (SLA)</h4>
              <div style={{ fontSize: '3.5rem', fontWeight: '900', color: parseFloat(slaCompliance) >= 99 ? 'var(--success)' : (parseFloat(slaCompliance) > 90 ? 'var(--warning)' : 'var(--danger)') }}>{slaCompliance}%</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tempo de operação dentro da norma ideal.</div>
          </div>
          <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--primary)' }}>
              <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}><Thermometer size={16} /> Fator Térmico / MKT</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '10px' }}>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mínima</div><div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--success)' }}>{kpis.kpiMinT}°C</div></div>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Média</div><div style={{ fontSize: '1.2rem', fontWeight: '800' }}>{kpis.kpiMediaT}°C</div></div>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Máxima</div><div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--danger)' }}>{kpis.kpiMaxT}°C</div></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '5px' }}>
                  <div style={{ textAlign: 'left' }}><div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)' }}>Temp. Cinética Média</div></div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)', background: 'var(--bg-color)', padding: '5px 15px', borderRadius: '8px' }}>{mktValueProcessado}°C</div>
              </div>
          </div>
      </div>

      <div className="flex-header stagger-2">
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" style={{ padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => aplicarFiltroRapido(1)}><Clock size={14}/> 1h</button>
          <button className="btn btn-outline" style={{ padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => aplicarFiltroRapido(12)}><Clock size={14}/> 12h</button>
          <button className="btn btn-outline" style={{ padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => aplicarFiltroRapido(24)}><Clock size={14}/> 24h</button>
        </div>
        <div className="action-group">
          <div className="date-filter-group"><DatePicker selected={dataInicio} onChange={(date) => setDataInicio(date)} selectsStart startDate={dataInicio} endDate={dataFim} disabled={isOffline} /><span className="date-separator">até</span><DatePicker selected={dataFim} onChange={(date) => setDataFim(date)} selectsEnd startDate={dataInicio} endDate={dataFim} minDate={dataInicio} disabled={isOffline} /></div>
          <select className="select-input" value={equipamentoFiltro} onChange={(e) => setEquipamentoFiltro(e.target.value)} style={{maxWidth: '200px'}}><option value="">Geral da Loja</option>{equipamentosDaFilial?.map(eq => <option key={eq.id} value={eq.nome}>{eq.nome}</option>)}</select>
          <button className="btn btn-outline" onClick={() => gerarExportacao('csv')}><Download size={18} /></button>
          <button className="btn btn-danger" onClick={() => gerarExportacao('pdf')}><FileText size={18} /></button>
        </div>
      </div>

      <div className="chart-container stagger-3" style={{ height: '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dadosGraficoFiltrados} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs><linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--primary)" stopOpacity={0.6}/><stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e5e7eb'} vertical={false} />
            <XAxis dataKey="hora" stroke={isDarkMode ? '#94a3b8' : '#6b7280'} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" stroke="var(--primary)" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{ fontSize: 11 }} label={{ value: 'Consumo kWh', angle: 90, position: 'insideRight', fill: '#f59e0b' }} />
            <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow)' }} />
            {equipamentoSelecionado && <ReferenceLine yAxisId="left" y={equipamentoSelecionado.temp_max} stroke="var(--danger)" strokeDasharray="4 4" />}
            <Area isAnimationActive={false} yAxisId="left" type="monotone" dataKey="temperatura" name="Temp (°C)" stroke="var(--primary)" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={2} activeDot={{ r: 4 }} />
            <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="consumo_kwh" name="Consumo (kWh)" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div style={{ marginTop: '1.5rem' }} className="stagger-4">
          <button className="btn btn-outline w-100" onClick={() => setMostrarTabelaBruta(!mostrarTabelaBruta)} style={{ background: 'var(--card-bg)', borderStyle: 'dashed' }}><List size={18} /> {mostrarTabelaBruta ? 'Esconder Matriz Bruta' : 'Ver Matriz de Dados p/ Auditores'}</button>
          {mostrarTabelaBruta && (
            <div className="card table-responsive" style={{ marginTop: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
              <table className="table">
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-color)', zIndex: 1 }}><tr><th>Data/Hora</th><th>Localização / Máquina</th><th>Sensor Térmico (°C)</th><th>Energia Injetada (kWh)</th></tr></thead>
                <tbody>
                  {ultimasLeiturasRaw?.map((dado, index) => {
                      const eqRef = equipamentosDaFilial?.find(e => e.nome === dado.nome);
                      const isTempAlerta = eqRef && dado.temperatura > eqRef.temp_max;
                      return (
                        <tr key={index}>
                          <td data-label="Data/Hora" style={{ fontSize: '0.9rem' }}>{dado.dataExata}</td>
                          <td data-label="Localização" style={{ fontWeight: '600' }}>{dado.filial} - {dado.nome}</td>
                          <td data-label="Temp (°C)" style={{ fontWeight: '800', color: isTempAlerta ? 'var(--danger)' : 'var(--primary)' }}>{dado.temperatura} °C</td>
                          <td data-label="Consumo kWh" style={{ fontWeight: '800', color: '#f59e0b' }}>{dado.consumo_kwh} kWh <Zap size={14} style={{ verticalAlign: 'middle' }}/></td>
                        </tr>
                      )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}