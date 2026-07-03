import React, { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, LineChart, Line, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { 
  Activity, TrendingUp, Zap, Server, AlertTriangle, ShieldCheck, Thermometer, Droplets
} from 'lucide-react';
import './CentroInteligencia.css';

const CentroInteligenciaBI = ({ isDarkMode, equipamentosDaFilial = [] }) => {
  const [dataAnalytics, setDataAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cores do Tema
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
  const textFill = isDarkMode ? '#cbd5e1' : '#475569';
  const gridStroke = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

  useEffect(() => {
    // Simulando o carregamento pesado de BI
    setTimeout(() => {
      setDataAnalytics({
        kpis: {
          uptime: 99.98,
          energiaPoupada: 1245,
          incidentesEvitados: 47,
          scoreEficiencia: 94
        },
        energiaMensal: [
          { name: 'Jan', kwh: 4200, custo: 2100 },
          { name: 'Fev', kwh: 3800, custo: 1900 },
          { name: 'Mar', kwh: 4100, custo: 2050 },
          { name: 'Abr', kwh: 3600, custo: 1800 },
          { name: 'Mai', kwh: 3200, custo: 1600 },
          { name: 'Jun', kwh: 2900, custo: 1450 }
        ],
        distribuicaoCarga: [
          { name: 'Compressores', value: 45 },
          { name: 'Ventiladores', value: 25 },
          { name: 'Resistências', value: 20 },
          { name: 'Iluminação', value: 10 }
        ],
        predicaoFalhas: [
          { maquina: 'Balcão 01', risco: 12 },
          { maquina: 'Balcão 02', risco: 5 },
          { maquina: 'Câmara Fria', risco: 84 },
          { maquina: 'Ilha Congelados', risco: 22 },
        ]
      });
      setIsLoading(false);
    }, 1500);
  }, []);

  if (isLoading) {
    return (
      <div className="bi-loading-container anim-fade-in">
        <div className="bi-spinner">
          <Activity size={48} color="#10b981" className="pulse-icon" />
          <h2 style={{marginTop: '1rem'}}>Processando Data Lake...</h2>
          <p>O Motor de Inteligência Artificial está a compilar os dados massivos da rede.</p>
        </div>
      </div>
    );
  }

  const { kpis, energiaMensal, distribuicaoCarga, predicaoFalhas } = dataAnalytics;

  return (
    <div className="bi-dashboard-container anim-fade-in">
      <div className="bi-header">
        <h1 className="bi-title"><PieChart size={28} className="icon-glow" /> Centro de Inteligência (BI)</h1>
        <p className="bi-subtitle">Análise Preditiva e Desempenho Energético em Tempo Real</p>
      </div>

      <div className="bi-kpi-grid">
        <div className="bi-kpi-card">
          <div className="bi-kpi-icon"><ShieldCheck size={32} color="#10b981" /></div>
          <div className="bi-kpi-info">
            <h3>{kpis.uptime}%</h3>
            <p>Uptime do Sistema</p>
          </div>
        </div>
        <div className="bi-kpi-card">
          <div className="bi-kpi-icon"><Zap size={32} color="#f59e0b" /></div>
          <div className="bi-kpi-info">
            <h3>{kpis.energiaPoupada} kWh</h3>
            <p>Energia Poupada (Mês)</p>
          </div>
        </div>
        <div className="bi-kpi-card">
          <div className="bi-kpi-icon"><TrendingUp size={32} color="#3b82f6" /></div>
          <div className="bi-kpi-info">
            <h3>{kpis.scoreEficiencia} / 100</h3>
            <p>Score de Eficiência (AI)</p>
          </div>
        </div>
        <div className="bi-kpi-card">
          <div className="bi-kpi-icon"><Server size={32} color="#8b5cf6" /></div>
          <div className="bi-kpi-info">
            <h3>{kpis.incidentesEvitados}</h3>
            <p>Falhas Evitadas (Auto-Tuning)</p>
          </div>
        </div>
      </div>

      <div className="bi-charts-grid">
        <div className="bi-chart-box">
          <h3>Consumo Energético vs Custos (Projeção)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={energiaMensal}>
              <defs>
                <linearGradient id="colorKwh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" stroke={textFill} />
              <YAxis stroke={textFill} />
              <RechartsTooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', color: textFill, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
              <Area type="monotone" dataKey="kwh" stroke="#10b981" fillOpacity={1} fill="url(#colorKwh)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bi-chart-box">
          <h3>Distribuição de Carga Elétrica</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={distribuicaoCarga}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {distribuicaoCarga.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', color: textFill }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bi-chart-box full-width">
          <h3>Análise Preditiva de Falhas Mecânicas (Machine Learning)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={predicaoFalhas}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="maquina" stroke={textFill} />
              <YAxis stroke={textFill} />
              <RechartsTooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', color: textFill }} cursor={{fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}} />
              <Bar dataKey="risco" name="Risco de Falha em 7 dias (%)">
                {
                  predicaoFalhas.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.risco > 70 ? '#ef4444' : entry.risco > 20 ? '#f59e0b' : '#10b981'} />
                  ))
                }
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default CentroInteligenciaBI;