import React, { useState, useMemo } from 'react';
import { Thermometer, Droplets, Power } from 'lucide-react';

export default function Monitoramento({ isTemp, listaSetores, equipamentosDaFilial, userRole }) {
  const [setorFiltroMotores, setSetorFiltroMotores] = useState('');

  const equipamentosFiltradosMotores = useMemo(() => {
    return setorFiltroMotores ? equipamentosDaFilial?.filter(eq => eq.setor === setorFiltroMotores) : equipamentosDaFilial;
  }, [equipamentosDaFilial, setorFiltroMotores]);

  return (
    <div className="anim-fade-in stagger-1">
      <div className="flex-header">
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isTemp ? <Thermometer size={24} color="var(--primary)"/> : <Droplets size={24} color="var(--info)" />} 
          {isTemp ? 'Câmaras e Ilhas Frigoríficas' : 'Gestão de Humidade (HACCP)'}
        </h3>
        <div className="action-group">
          <select className="select-input" value={setorFiltroMotores} onChange={(e) => setSetorFiltroMotores(e.target.value)}>
            <option value="">Setores (Todos)</option>
            {listaSetores?.map(setor => <option key={setor.id} value={setor.nome}>{setor.nome}</option>)}
          </select>
        </div>
      </div>
      <div className="grid-cards stagger-2">
        {equipamentosFiltradosMotores?.map(eq => {
          const valor = isTemp ? eq.ultima_temp : eq.ultima_umidade; const min = isTemp ? eq.temp_min : (eq.umidade_min || 40); const max = isTemp ? eq.temp_max : (eq.umidade_max || 60);
          const isAlta = valor > max; const isBaixa = valor < min; const isAnomalia = (isAlta || isBaixa) && !eq.em_degelo;
          let percent = 50; if (max > min) { percent = ((valor || min) - min) / (max - min) * 100; } if(percent > 100) percent=100; if(percent<5) percent=5;
          let barColor = isTemp ? 'var(--success)' : 'var(--info)'; if (isAnomalia) barColor = isTemp ? 'var(--danger)' : 'var(--warning)'; if (eq.em_degelo) barColor = 'var(--info)';

          return (
            <div key={eq.id} className={`card ${isAnomalia ? 'card-danger-border pulse-danger' : (eq.em_degelo ? 'card-info-border' : (isTemp && eq.motor_ligado ? 'card-success-border' : 'card-info-border'))}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><h3 style={{ margin: '0 0 10px 0', fontSize: '1.15rem' }}>{eq.nome}</h3></div>
              <span className="badge-setor">{userRole !== 'LOJA' ? `${eq.filial} | ` : ''}{eq.setor}</span>
              <div className={`status-box ${eq.em_degelo && isTemp ? 'status-defrost' : (isAnomalia && !isTemp ? '' : (isTemp && !eq.motor_ligado ? 'status-off' : 'status-on'))}`} style={{ marginTop: '15px', backgroundColor: !isTemp ? (isAnomalia ? 'var(--warning)' : 'var(--info)') : undefined }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {isTemp ? <Power size={20} /> : <Droplets size={20} />}
                      <span style={{ fontSize: '0.85rem', fontWeight: '800', letterSpacing: '1px' }}>{isTemp ? (eq.em_degelo ? 'DEGELO' : (eq.motor_ligado ? 'LIGADO' : 'PARADO')) : (isAlta ? 'HÚMIDO' : (isBaixa ? 'SECO' : 'ESTÁVEL'))}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>{min}{isTemp?'°C':'%'} a {max}{isTemp?'°C':'%'}</span>
                  </div>
                  <div className="thermal-bar-bg" style={{ backgroundColor: !isTemp ? 'rgba(0,0,0,0.2)' : undefined }}><div className="thermal-bar-fill" style={{ width: `${percent}%`, backgroundColor: !isTemp ? '#fff' : barColor }}></div></div>
                </div>
                <div className="temp-display" style={{ background: !isTemp ? 'rgba(0,0,0,0.15)' : undefined }}>
                  <span>Sensor</span><h2 style={{ color: (isAnomalia && isTemp) ? '#ffcccc' : 'white' }}>{valor ? `${valor}${isTemp?' °C':'%'}` : '--'}</h2>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}