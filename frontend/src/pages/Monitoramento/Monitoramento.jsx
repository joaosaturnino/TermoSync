import React, { useState, useMemo } from 'react';
import { Thermometer, Droplets, Power, Snowflake, AlertOctagon, MapPin, Gauge } from 'lucide-react';
import './Monitoramento.css';

export default function Monitoramento({ isTemp, listaSetores, equipamentosDaFilial }) {
  const [setorFiltro, setSetorFiltro] = useState('');

  const filtrados = useMemo(() => {
    return setorFiltro ? equipamentosDaFilial?.filter(eq => eq.setor === setorFiltro) : equipamentosDaFilial;
  }, [equipamentosDaFilial, setorFiltro]);

  return (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="icon-circle" style={{ background: isTemp ? 'var(--primary)' : '#0ea5e9', color: 'white' }}>
            {isTemp ? <Thermometer size={24} /> : <Droplets size={24} />}
          </div>
          <div>
            {isTemp ? 'Cadeia de Frio' : 'Controlo Higrométrico'}
            <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)', marginTop: '2px' }}>Monitorização em Tempo Real</span>
          </div>
        </h3>
        
        <div className="action-group">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <MapPin size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', zIndex: 1 }} />
            <select 
              className="select-input" 
              style={{ paddingLeft: '38px', minWidth: '200px' }}
              value={setorFiltro} 
              onChange={(e) => setSetorFiltro(e.target.value)}
            >
              <option value="">Todos os Setores</option>
              {listaSetores?.map((s, idx) => (
                <option key={idx} value={typeof s === 'object' ? s.nome : s}>{typeof s === 'object' ? s.nome : s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="monitor-grid">
        {filtrados?.map((eq, index) => {
          // 🛠️ CORREÇÃO CRÍTICA: Tenta ler ultima_umidade (Socket), umidade (API) ou humidade (alternativo)
          // Se não encontrar nada, define como NULL (não como 0) para evitar erro de "menor que o mínimo"
          const valRaw = isTemp 
            ? (eq.ultima_temp ?? eq.temperatura ?? null) 
            : (eq.ultima_umidade ?? eq.umidade ?? eq.humidade ?? null);
          
          const val = valRaw !== null ? parseFloat(valRaw) : null;
          
          // Fallbacks de Limites (Garante que se não houver limite definido, não dispara erro falso)
          // No seu Monitoramento.jsx, garanta que os mínimos são realistas:
const min = parseFloat(isTemp ? (eq.temp_min ?? -5) : (eq.umidade_min ?? 35)); // Use 35 como fallback de segurança
const max = parseFloat(isTemp ? (eq.temp_max ?? 15) : (eq.umidade_max ?? 85));
          
          // SÓ ATIVA ALERTA SE: O valor existir E for maior que 0.1 (evita offline) E estiver fora dos limites
          const temDados = val !== null && val > 0.1;
          const isFora = temDados && (val < min || val > max);
          
          const statusCor = isFora ? 'var(--danger)' : (isTemp && eq.em_degelo ? '#0ea5e9' : 'var(--primary)');
          
          // Cálculo da posição do ponteiro (Proteção contra divisão por zero)
          const range = max - min;
          const position = (temDados && range !== 0) 
            ? Math.min(Math.max(((val - min) / range) * 100, 0), 100) 
            : 0;

          return (
            <div key={eq.id} className={`monitor-card anim-fade-in ${isFora ? 'border-danger' : ''}`} style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="monitor-card-header">
                <div className="monitor-info-main">
                  <h4>{eq.nome}</h4>
                  <span className="monitor-info-sub">{eq.setor} • ID: #{eq.id}</span>
                </div>
                {isTemp && (
                  <div className={`status-pill ${eq.em_degelo ? 'defrost' : (eq.motor_ligado ? 'on' : 'off')}`}>
                    {eq.em_degelo ? <Snowflake size={14} /> : <Power size={14} />}
                    {eq.em_degelo ? 'DEGELO' : (eq.motor_ligado ? 'ATIVO' : 'FALHA')}
                  </div>
                )}
              </div>

              <div className="value-display-wrapper">
                <div className="current-value">
                  {temDados ? val.toFixed(1) : '--'}<span className="current-unit">{isTemp ? '°C' : '%'}</span>
                </div>
                {isFora ? (
                  <AlertOctagon size={36} color="var(--danger)" style={{ filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.5))' }} />
                ) : (
                  <Gauge size={36} color={temDados ? "var(--primary)" : "var(--text-muted)"} style={{ opacity: 0.3 }} />
                )}
              </div>

              <div className="thermal-container" style={{ marginTop: '10px' }}>
                <div className="thermal-limits" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                  <span>MÍN: {min.toFixed(1)}{isTemp ? '°' : '%'}</span>
                  <span>MÁX: {max.toFixed(1)}{isTemp ? '°' : '%'}</span>
                </div>
                <div className="thermal-track" style={{ height: '8px', background: 'var(--border)', borderRadius: '10px', position: 'relative', margin: '10px 0' }}>
                  <div 
                    className="thermal-pointer" 
                    style={{ 
                        position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', 
                        width: '14px', height: '14px', background: 'white', borderRadius: '50%',
                        border: `3px solid ${temDados ? statusCor : 'var(--border)'}`,
                        left: `${position}%`, transition: 'left 0.8s ease'
                    }}
                  ></div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <MapPin size={14}/> {eq.filial || 'Unidade Local'}
                </span>
                {!temDados ? (
                  <span style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: '800' }}>AGUARDANDO DADOS DOS SENSORES...</span>
                ) : isFora && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: '800', letterSpacing: '0.5px' }}>FORA DE PARÂMETROS</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}