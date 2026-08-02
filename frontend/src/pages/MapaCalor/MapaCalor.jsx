import React, { useState, useMemo } from 'react';
import { Map, AlertTriangle, Snowflake, Activity, Search, ThermometerSnowflake, Droplets, Target, Wind } from 'lucide-react';
import './MapaCalor.css'; 

/**
 * Gêmeo Digital / Heatmap (Mapa de Calor)
 *
 * Responsabilidades:
 * - Renderizar uma visão espacial dos equipamentos e seus estados térmicos
 * - Indicar focos críticos, ciclos de degelo e equipamentos inativos
 * - Fornecer busca e KPIs resumidos para navegação rápida
 *
 * Props: `equipamentosDaFilial`, `notificacoesDaFilial`
 */
export default function MapaCalor({ equipamentosDaFilial, notificacoesDaFilial }) {
  
  const [busca, setBusca] = useState('');

  // Processa o estado de cada equipamento para o Gêmeo Digital
  const statusMapa = useMemo(() => {
    return equipamentosDaFilial.map(eq => {
      const temAlerta = notificacoesDaFilial.find(n => n.equipamento_id === eq.id && !n.resolvido);
      
      let statusColor = 'var(--success)';
      let statusText = 'ZONA ESTÁVEL';
      let pulse = false;
      let Icon = Activity;
      
      if (temAlerta) { 
        statusColor = 'var(--danger)'; 
        statusText = 'FOCO CRÍTICO';
        pulse = true; 
        Icon = AlertTriangle;
      }
      else if (eq.em_degelo) { 
        statusColor = '#38bdf8'; // Azul claro para gelo
        statusText = 'CICLO DE DEGELO';
        Icon = Snowflake;
      }
      else if (!eq.motor_ligado) { 
        statusColor = 'var(--warning)'; 
        statusText = 'COMPRESSOR PARADO';
        Icon = Wind;
      }

      return { ...eq, statusColor, statusText, pulse, temAlerta, Icon };
    });
  }, [equipamentosDaFilial, notificacoesDaFilial]);

  // Motor de Filtro
  const nodesFiltrados = useMemo(() => {
    if (!busca.trim()) return statusMapa;
    const termo = busca.toLowerCase();
    return statusMapa.filter(eq => 
      eq.nome?.toLowerCase().includes(termo) || 
      eq.setor?.toLowerCase().includes(termo)
    );
  }, [statusMapa, busca]);

  // KPIs de Borda
  const kpis = useMemo(() => {
    const total = statusMapa.length;
    let criticos = 0; let degelo = 0; let inativos = 0;
    statusMapa.forEach(eq => {
      if (eq.temAlerta) criticos++;
      else if (eq.em_degelo) degelo++;
      else if (!eq.motor_ligado) inativos++;
    });
    return { total, criticos, degelo, inativos };
  }, [statusMapa]);

  return (
    <div className="anim-fade-in stagger-1">
      
      {/* HEADER & SEARCH */}
      <div className="heatmap-header-actions">
        <div>
          <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
            <Map style={{ marginRight: '10px', color: 'var(--primary)' }}/> Gêmeo Digital (Heatmap)
          </h3>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
            Mapeamento térmico em tempo real e telemetria espacial da infraestrutura.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="search-box-heatmap">
            <Search size={16} color="var(--text-muted)" />
            <input type="text" placeholder="Pesquisar zona ou equipamento..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>
      </div>

      {/* KPI BAR */}
      <div className="heatmap-kpi-bar stagger-2">
        <div className="kpi-item total">
          <div className="kpi-icon"><Target size={22}/></div>
          <div className="kpi-data"><span className="kpi-value">{kpis.total}</span><span className="kpi-label">Zonas Monitoradas</span></div>
        </div>
        <div className="kpi-item danger">
          <div className="kpi-icon"><AlertTriangle size={22}/></div>
          <div className="kpi-data"><span className="kpi-value" style={{color: 'var(--danger)'}}>{kpis.criticos}</span><span className="kpi-label">Focos de Calor (Alertas)</span></div>
        </div>
        <div className="kpi-item success" style={{ background: 'rgba(56, 189, 248, 0.05)', borderColor: 'rgba(56, 189, 248, 0.2)' }}>
          <div className="kpi-icon" style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)' }}><Snowflake size={22}/></div>
          <div className="kpi-data"><span className="kpi-value" style={{color: '#38bdf8'}}>{kpis.degelo}</span><span className="kpi-label">Ciclos de Degelo</span></div>
        </div>
      </div>

      {/* HEATMAP GRID */}
      <div className="stagger-3">
        {statusMapa.length === 0 ? (
          <div className="card empty-state" style={{ padding: '4rem', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <Map size={48} style={{opacity: 0.2, marginBottom: '1rem'}}/>
            <p style={{ fontWeight: 'bold' }}>Nenhum ativo mapeado nesta planta digital.</p>
          </div>
        ) : (
          <div className="mapa-grid">
            {nodesFiltrados.map(eq => (
              <div 
                key={eq.id} 
                className={`mapa-node-card ${eq.pulse ? 'pulse-danger-card' : ''}`}
                style={{ '--node-color': eq.statusColor }}
              >
                
                <div className="mapa-card-header">
                  <div className="mapa-equip-info">
                    <span className="mapa-equip-nome">{eq.nome}</span>
                    <span className="mapa-equip-setor">{eq.setor}</span>
                  </div>
                  <eq.Icon size={24} color={eq.statusColor} className={eq.pulse ? 'pulse-icon-heatmap' : ''} />
                </div>

                <div className="mapa-leituras">
                  <span className="mapa-temp-principal">
                    {eq.ultima_temp != null ? `${parseFloat(eq.ultima_temp).toFixed(1)}°` : '--'}
                  </span>
                  
                  <div className="mapa-leitura-secundaria">
                    {eq.ultima_umidade != null && eq.ultima_umidade > 0 && (
                      <span className="mapa-umidade" title="Umidade Relativa">
                        <Droplets size={12} color="var(--text-muted)"/> {parseFloat(eq.ultima_umidade).toFixed(0)}%
                      </span>
                    )}
                    <span className="mapa-umidade" title="Range Configurado">
                      <ThermometerSnowflake size={12} color="var(--text-muted)"/> [{eq.temp_min} a {eq.temp_max}°]
                    </span>
                  </div>
                </div>

                <div className="mapa-status-badge">
                   <Activity size={10} /> {eq.statusText}
                </div>

              </div>
            ))}

            {nodesFiltrados.length === 0 && busca !== '' && (
               <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                 Nenhuma zona térmica encontrada com o termo "{busca}".
               </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}