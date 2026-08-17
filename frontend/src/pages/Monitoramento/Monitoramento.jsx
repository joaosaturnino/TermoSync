import React, { useState, useMemo } from 'react';
import { Thermometer, Droplets, Power, Snowflake, AlertOctagon, MapPin, Gauge, ShieldAlert, CheckCircle2, WifiOff, Search, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';
import './Monitoramento.css';

/**
 * Tela de Monitoramento
 *
 * Responsabilidades:
 * - Mostrar mapa de calor e lista de equipamentos com telemetria em tempo real
 * - Fornecer filtros por filial, grupos e tipos de sensores
 * - Modo Foco para destacar apenas ocorrências relevantes
 *
 * Props:
 * - `isTemp`: booleano que indica se a visão é térmica (true) ou higrométrica (false)
 * - `listaSetores`: lista de setores disponíveis para filtro
 * - `equipamentosDaFilial`: lista de equipamentos pertencentes à filial selecionada
 */
export default function Monitoramento({ isTemp, listaSetores, equipamentosDaFilial }) {
  const [setorFiltro, setSetorFiltro] = useState('');
  const [buscaNome, setBuscaNome] = useState('');
  const [modoFoco, setModoFoco] = useState(false);

  // Filtro combinado: Setor + Nome + Modo Foco + Ordenação Inteligente
  const filtrados = useMemo(() => {
    let resultado = equipamentosDaFilial || [];
    
    // 1. Filtros de Texto e Dropdown
    if (setorFiltro) resultado = resultado.filter(eq => eq.setor === setorFiltro);
    if (buscaNome) resultado = resultado.filter(eq => eq.nome.toLowerCase().includes(buscaNome.toLowerCase()));

    // 2. Lógica do Modo Foco e Pontuação de Gravidade (Triagem)
    resultado = resultado.filter(eq => {
      const min = isTemp ? parseFloat(eq.temp_min) : parseFloat(eq.umidade_min || 40);
      const max = isTemp ? parseFloat(eq.temp_max) : parseFloat(eq.umidade_max || 80);
      const val = isTemp ? parseFloat(eq.ultima_temp) : parseFloat(eq.ultima_umidade);
      const temDados = !isNaN(val);
      
      const isFora = temDados && (val < min || val > max);

      // REGRA DE OURO FRONTEND: Motor parado só é alerta se a temperatura estiver 10 GRAUS ACIMA do máximo
      const isFalhaMecanica = !eq.motor_ligado && temDados && (val >= max + 10.0) && !eq.em_degelo;
      const isAlerta = !temDados || isFalhaMecanica || isFora;
      
      // Se o Modo Foco estiver ativo, só mostra quem tem problemas reais ou está em degelo
      if (modoFoco) return isAlerta || eq.em_degelo;
      return true;
    });

    // 3. Ordenação Inteligente: Alertas Críticos > Offline > Degelo > Normal
    resultado.sort((a, b) => {
      const getScore = (eq) => {
        const min = isTemp ? parseFloat(eq.temp_min) : parseFloat(eq.umidade_min || 40);
        const max = isTemp ? parseFloat(eq.temp_max) : parseFloat(eq.umidade_max || 80);
        const val = isTemp ? parseFloat(eq.ultima_temp) : parseFloat(eq.ultima_umidade);
        const temDados = !isNaN(val);
        
        const isFora = temDados && (val < min || val > max);
        const isFalhaMecanica = !eq.motor_ligado && temDados && (val >= max + 10.0) && !eq.em_degelo;

        if (isFalhaMecanica || isFora) return 4; // Prioridade Máxima (Fogo!)
        if (!temDados) return 3; // Sem Sinal
        if (eq.em_degelo) return 2; // Atenção (Manutenção)
        return 1; // Tudo OK (Mesmo com motor desligado descansando)
      };
      
      return getScore(b) - getScore(a);
    });

    return resultado;
  }, [equipamentosDaFilial, setorFiltro, buscaNome, modoFoco, isTemp]);

  // Cálculo de KPIs para o topo da página
  const kpis = useMemo(() => {
    const baseList = equipamentosDaFilial || [];
    let alertas = 0, degelo = 0, offline = 0, ok = 0;

    baseList.forEach(eq => {
      const min = isTemp ? parseFloat(eq.temp_min) : parseFloat(eq.umidade_min || 40);
      const max = isTemp ? parseFloat(eq.temp_max) : parseFloat(eq.umidade_max || 80);
      const val = isTemp ? parseFloat(eq.ultima_temp) : parseFloat(eq.ultima_umidade);
      const temDados = !isNaN(val);
      
      const isFora = temDados && (val < min || val > max);
      const isFalhaMecanica = !eq.motor_ligado && temDados && (val >= max + 10.0) && !eq.em_degelo;

      if (!temDados) offline++;
      else if (eq.em_degelo) degelo++;
      else if (isFalhaMecanica || isFora) alertas++;
      else ok++;
    });

    return { total: baseList.length, alertas, degelo, offline, ok };
  }, [equipamentosDaFilial, isTemp]);

  return (
    <div className="anim-fade-in stagger-1">
      {/* CABEÇALHO E FILTROS */}
      <div className="flex-header monitoramento-header">
        <div className="header-title-area">
          <div className="icon-circle" style={{ background: isTemp ? 'var(--primary)' : '#0ea5e9', color: 'white' }}>
            {isTemp ? <Thermometer size={24} /> : <Droplets size={24} />}
          </div>
          <div>
            <h3 style={{ margin: 0 }}>{isTemp ? 'Controle Térmico' : 'Controle Higrométrico'}</h3>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--success)', marginTop: '4px' }}>
              <span className="live-indicator-dot"></span> Telemetria em Tempo Real
            </span>
          </div>
        </div>
        
        <div className="action-group" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          <button 
            className={`btn-focus-mode ${modoFoco ? 'active' : ''}`}
            onClick={() => setModoFoco(!modoFoco)}
            title="Ocultar equipamentos saudáveis e focar apenas nas ocorrências"
          >
            <Filter size={16} /> {modoFoco ? 'Apenas Alertas' : 'Modo Foco'}
          </button>

          <div className="monitor-search-box">
            <Search size={16} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="Pesquisar máquina..." 
              value={buscaNome} 
              onChange={e => setBuscaNome(e.target.value)} 
            />
          </div>
          <select className="select-input" value={setorFiltro} onChange={(e) => setSetorFiltro(e.target.value)}>
            <option value="">Visão Global (Todos)</option>
            {listaSetores?.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
          </select>
        </div>
      </div>

      {/* BARRA DE KPIS RÁPIDOS */}
      <div className="monitor-kpi-bar stagger-2">
        <div className="kpi-item total">
          <div className="kpi-icon"><Gauge size={20}/></div>
          <div className="kpi-data">
            <span className="kpi-value">{kpis.total}</span>
            <span className="kpi-label">Equipamentos</span>
          </div>
        </div>
        <div className="kpi-item ok">
          <div className="kpi-icon"><CheckCircle2 size={20}/></div>
          <div className="kpi-data">
            <span className="kpi-value">{kpis.ok}</span>
            <span className="kpi-label">Operacionais</span>
          </div>
        </div>
        <div className={`kpi-item danger ${kpis.alertas > 0 ? 'pulse-kpi-danger' : ''}`}>
          <div className="kpi-icon"><ShieldAlert size={20}/></div>
          <div className="kpi-data">
            <span className="kpi-value">{kpis.alertas}</span>
            <span className="kpi-label">Em Alerta</span>
          </div>
        </div>
        <div className="kpi-item info">
          <div className="kpi-icon"><Snowflake size={20}/></div>
          <div className="kpi-data">
            <span className="kpi-value">{kpis.degelo}</span>
            <span className="kpi-label">Em Degelo</span>
          </div>
        </div>
        <div className="kpi-item warning">
          <div className="kpi-icon"><WifiOff size={20}/></div>
          <div className="kpi-data">
            <span className="kpi-value">{kpis.offline}</span>
            <span className="kpi-label">Sem Sinal</span>
          </div>
        </div>
      </div>

      {/* ESTADO VAZIO (EMPTY STATE) */}
      {!filtrados || filtrados.length === 0 ? (
        <div className="monitor-empty-state stagger-3">
          {modoFoco ? (
             <ShieldAlert size={64} style={{ color: 'var(--success)', marginBottom: '1rem', animation: 'pulse-kpi-success 2s infinite' }} />
          ) : (
             <Gauge size={64} style={{ opacity: 0.2, marginBottom: '1rem', color: 'var(--text-main)' }} />
          )}
          
          <h3>{modoFoco ? 'Operação 100% Segura' : 'Nenhuma Máquina Encontrada'}</h3>
          <p>{modoFoco ? 'Não existem equipamentos fora dos parâmetros no momento. Ótimo trabalho!' : 'Não existem equipamentos registrados ou a sua pesquisa não retornou resultados.'}</p>
        </div>
      ) : (
        /* GRELHA DE EQUIPAMENTOS */
        <div className="monitor-grid stagger-3">
          {filtrados.map(eq => {
            const min = isTemp ? parseFloat(eq.temp_min) : parseFloat(eq.umidade_min || 40);
            const max = isTemp ? parseFloat(eq.temp_max) : parseFloat(eq.umidade_max || 80);
            const val = isTemp ? parseFloat(eq.ultima_temp) : parseFloat(eq.ultima_umidade);
            const unit = isTemp ? '°C' : '%';
            const temDados = !isNaN(val);
            
            // Inteligência do Alerta
            const isAcima = temDados && val > max;
            const isAbaixo = temDados && val < min;
            const isFora = isAcima || isAbaixo;
            const isFalhaMecanica = !eq.motor_ligado && temDados && (val >= max + 10.0) && !eq.em_degelo;
            
            // Definição de Status, Cores e Ícones
            let status = 'NORMAL';
            let statusCor = 'var(--success)';
            let IconeStatus = CheckCircle2;
            let statusLabel = 'Operação Segura';

            if (!temDados) {
              status = 'OFFLINE'; statusCor = 'var(--warning)'; IconeStatus = WifiOff; statusLabel = 'Sem Comunicação';
            } else if (eq.em_degelo) {
              status = 'DEGELO'; statusCor = '#0ea5e9'; IconeStatus = Snowflake; statusLabel = 'Ciclo de Degelo';
            } else if (isFalhaMecanica) {
              status = 'PARADO'; statusCor = 'var(--danger)'; IconeStatus = Power; statusLabel = 'Motor Falhou';
            } else if (isAcima) {
              status = 'ALERTA'; statusCor = 'var(--danger)'; IconeStatus = ArrowUpRight; statusLabel = isTemp ? 'Alta Temperatura' : 'Alta Umidade';
            } else if (isAbaixo) {
              status = 'ALERTA'; statusCor = '#38bdf8'; IconeStatus = ArrowDownRight; statusLabel = isTemp ? 'Baixa Temperatura' : 'Baixa Umidade';
            } else if (!eq.motor_ligado) {
              // Se não há alertas e o motor está desligado, é apenas repouso do termostato!
              statusLabel = 'Em Repouso (Ideal)';
            }

            // Cálculo Inteligente do Ponteiro (Com margem visual de 20% para fora dos limites)
            let position = 50;
            if (temDados && max !== min) {
              const range = max - min;
              const visualMin = min - (range * 0.2); 
              const visualMax = max + (range * 0.2);
              const visualRange = visualMax - visualMin;
              
              const calcPos = ((val - visualMin) / visualRange) * 100;
              position = Math.max(0, Math.min(100, calcPos)); 
            }

            return (
              <div key={eq.id} className={`monitor-card status-${status.toLowerCase()}`}>
                <div className="monitor-card-header">
                  <div className="monitor-title-box">
                    <span className="monitor-setor">{eq.setor}</span>
                    <h4 title={eq.nome}>{eq.nome}</h4>
                  </div>
                  <div className={`status-badge badge-${status.toLowerCase()}`}>
                    <IconeStatus size={14}/> {statusLabel}
                  </div>
                </div>

                <div className="monitor-leitura-principal">
                  {temDados ? (
                    <span className={`valor-destaque ${isFora && !eq.em_degelo ? 'piscar-alerta' : ''}`} style={{ color: statusCor }}>
                      {val.toFixed(1)}{unit}
                    </span>
                  ) : (
                    <span className="valor-destaque" style={{ color: 'var(--text-muted)' }}>--{unit}</span>
                  )}
                </div>

                {/* LIMITES E GAUGE TÉRMICO */}
                <div className="monitor-limites">
                  <div className="limites-text">
                    <span>Min: {min.toFixed(1)}{unit}</span>
                    <span>Max: {max.toFixed(1)}{unit}</span>
                  </div>
                  
                  <div className="thermal-track">
                    <div className="thermal-gradient-bg"></div>
                    {temDados && (
                      <div 
                        className="thermal-pointer" 
                        style={{ 
                          border: `3px solid ${statusCor}`,
                          left: `${position}%`, 
                          transition: 'left 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      ></div>
                    )}
                  </div>
                </div>

                <div className="monitor-footer">
                  <span className="monitor-filial">
                    <MapPin size={14}/> {eq.filial || 'Unidade Local'}
                  </span>
                  
                  {!temDados ? (
                    <span className="footer-alerta warning">AGUARDANDO SENSORES</span>
                  ) : isFalhaMecanica ? (
                    <span className="footer-alerta danger">FALHA CRÍTICA DO MOTOR</span>
                  ) : isAcima && !eq.em_degelo ? (
                    <span className="footer-alerta danger">ACIMA DO LIMITE</span>
                  ) : isAbaixo && !eq.em_degelo ? (
                    <span className="footer-alerta" style={{color: '#38bdf8'}}>ABAIXO DO LIMITE</span>
                  ) : eq.em_degelo ? (
                    <span className="footer-alerta info">EM MANUTENÇÃO TÉRMICA</span>
                  ) : (
                    <span className="footer-alerta success">DENTRO DA NORMA</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}