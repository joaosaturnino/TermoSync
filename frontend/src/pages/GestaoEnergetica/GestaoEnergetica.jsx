import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import { 
  Zap, Leaf, Activity, ChevronDown, DollarSign
} from 'lucide-react';
import './GestaoEnergetica.css';

const GestaoEnergetica = ({ isDarkMode, equipamentosDaFilial = [] }) => {
  const [loading, setLoading] = useState(true);
  const [energiaData, setEnergiaData] = useState(null);
  
  const textFill = isDarkMode ? '#cbd5e1' : '#475569';
  const gridStroke = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

  useEffect(() => {
    // Simulando fetch de API para telemetria energética
    setTimeout(() => {
      setEnergiaData({
        totalKw: 12450.4,
        custoEstimado: 6225.20,
        pegadaCarbono: 3.4,
        picoDemanda: '14:30 - 15:00',
        consumoDiario: [
          { dia: 'Seg', kwh: 450, meta: 500 },
          { dia: 'Ter', kwh: 480, meta: 500 },
          { dia: 'Qua', kwh: 420, meta: 500 },
          { dia: 'Qui', kwh: 510, meta: 500 },
          { dia: 'Sex', kwh: 490, meta: 500 },
          { dia: 'Sáb', kwh: 600, meta: 500 },
          { dia: 'Dom', kwh: 580, meta: 500 }
        ],
        topConsumidores: [
          { nome: 'Câmara Fria Principal', kwh: 4500 },
          { nome: 'Balcão de Laticínios', kwh: 3200 },
          { nome: 'Ilha de Congelados 1', kwh: 2800 },
          { nome: 'Ilha de Congelados 2', kwh: 1950 }
        ]
      });
      setLoading(false);
    }, 1200);
  }, []);

  if (loading) {
    return (
      <div className="energy-loading-container anim-fade-in">
        <div className="energy-spinner">
          <Zap size={48} color="#f59e0b" className="pulse-icon" />
          <h2 style={{marginTop: '1rem'}}>Lendo Smart Meters...</h2>
          <p>Sincronizando medidores inteligentes de energia.</p>
        </div>
      </div>
    );
  }

  const { totalKw, custoEstimado, pegadaCarbono, picoDemanda, consumoDiario, topConsumidores } = energiaData;

  return (
    <div className="energy-dashboard-container anim-fade-in">
      <div className="energy-header">
        <h1 className="energy-title"><Zap size={28} className="energy-icon-glow" /> Gestão Energética (ESG)</h1>
        <p className="energy-subtitle">Monitoramento de eficiência e sustentabilidade da filial.</p>
      </div>

      <div className="energy-kpi-grid">
        <div className="energy-kpi-card">
          <div className="energy-kpi-icon yellow"><Zap size={32} /></div>
          <div className="energy-kpi-info">
            <h3>{totalKw.toLocaleString('pt-PT')} kWh</h3>
            <p>Consumo Acumulado Mês</p>
          </div>
        </div>
        <div className="energy-kpi-card">
          <div className="energy-kpi-icon green"><DollarSign size={32} /></div>
          <div className="energy-kpi-info">
            <h3>€ {custoEstimado.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</h3>
            <p>Custo Financeiro Estimado</p>
          </div>
        </div>
        <div className="energy-kpi-card">
          <div className="energy-kpi-icon blue"><Leaf size={32} /></div>
          <div className="energy-kpi-info">
            <h3>{pegadaCarbono} tCO₂e</h3>
            <p>Pegada de Carbono Emitida</p>
          </div>
        </div>
        <div className="energy-kpi-card">
          <div className="energy-kpi-icon red"><Activity size={32} /></div>
          <div className="energy-kpi-info">
            <h3>{picoDemanda}</h3>
            <p>Horário de Pico de Demanda</p>
          </div>
        </div>
      </div>

      <div className="energy-charts-grid">
        <div className="energy-chart-box">
          <h3>Consumo Diário vs. Meta de Eficiência</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={consumoDiario}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="dia" stroke={textFill} />
              <YAxis stroke={textFill} />
              <RechartsTooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', color: textFill, borderRadius: '8px' }} />
              <Legend />
              <Line type="monotone" dataKey="kwh" name="Consumo Real (kWh)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="meta" name="Meta ESG (kWh)" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="energy-chart-box">
          <h3>Maiores Consumidores Térmicos</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topConsumidores} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis type="number" stroke={textFill} />
              <YAxis dataKey="nome" type="category" stroke={textFill} width={150} />
              <RechartsTooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', color: textFill, borderRadius: '8px' }} cursor={{fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}} />
              <Bar dataKey="kwh" fill="#3b82f6" radius={[0, 4, 4, 0]}>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default GestaoEnergetica;