/**
 * Módulo: frontend/src/pages/GestaoEnergetica/GestaoEnergetica.jsx
 * Responsabilidade: Implementa a tela Gestao Energetica, seus estados, interações e integrações de dados.
 */

import { Download, Filter, Gauge } from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ResponsiveContainer, ComposedChart, Area, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Zap, Leaf, Activity, DollarSign, CalendarDays, Loader2, Server, CheckCircle2, Clock } from 'lucide-react';

import ptBR from 'date-fns/locale/pt-BR';
registerLocale('pt', ptBR);

import 'react-datepicker/dist/react-datepicker.css';
import './GestaoEnergetica.css';

/**
 * Renderiza a tela Gestao Energetica e concentra as regras de apresentacao desse modulo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.filialAtiva - Propriedade filialAtiva usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isDarkMode - Sinalizador isDarkMode que controla este comportamento visual.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function GestaoEnergetica({ api, filialAtiva, showToast, isDarkMode, isOffline }) {
  
  // ==========================================
  // ESTADOS DO COMPONENTE
  // Ampliado para 30 dias para garantir a captura de dados de teste do banco
  // ==========================================
  const [dataInicio, setDataInicio] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [dataFim, setDataFim] = useState(() => new Date());
  
  const [leiturasBrutas, setLeiturasBrutas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [equipamentoFiltro, setEquipamentoFiltro] = useState('');
  const [tarifaKwh, setTarifaKwh] = useState(0.85);

  // Fator médio configurado para a estimativa ambiental exibida nesta tela.
  const FATOR_CARBONO = 0.082; 

  const buscarDadosEnergia = useCallback(async () => {
    if (!api || isOffline) return;
    setIsLoading(true);
    try {
      const response = await api.get('/relatorios', {
        params: { data_inicio: dataInicio.toISOString(), data_fim: dataFim.toISOString() }
      });
      setLeiturasBrutas(Array.isArray(response.data) ? response.data : []);
    } catch {
      setLeiturasBrutas([]);
      showToast?.('Não foi possível carregar os dados energéticos.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [api, dataFim, dataInicio, isOffline, showToast]);

  useEffect(() => { buscarDadosEnergia(); }, [buscarDadosEnergia]);

  /**
   * ==========================================
   * INTEGRAÇÃO COM A API (DADOS REAIS)
   * ==========================================
   * Carrega as leituras energéticas do período selecionado respeitando o modo offline.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} days - Valor de days consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const setQuickRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDataInicio(start);
    setDataFim(end);
  };

  /**
   * Exporta o resumo diário já filtrado para conferência financeira.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: interage com APIs do navegador
   *
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const exportarEnergiaCsv = () => {
    if (!consumoDiario.length) return showToast?.('Não há dados energéticos para exportar.', 'warning');
    const linhas = consumoDiario.map(item => `"${item.dia}",${item.kwh},${(item.kwh * Math.max(0, Number(tarifaKwh) || 0)).toFixed(2)},${(item.kwh * FATOR_CARBONO).toFixed(3)}`);
    const csv = ['Data,Consumo (kWh),Custo estimado (BRL),Emissoes estimadas (kgCO2e)', ...linhas].join('\n');
    const url = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gestao_Energetica_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast?.('Relatório energético exportado.', 'success');
  };

  const currentRangeDays = Math.round((dataFim - dataInicio) / (1000 * 60 * 60 * 24));

    const { totalKw, custoEstimado, pegadaCarbono, consumoDiario, topConsumidores, picoDemanda } = useMemo(() => {
      
      let leituras = leiturasBrutas;
      if (filialAtiva && filialAtiva !== 'Todas') {
        leituras = leituras.filter(l => {
          const filialDB = (l.filial || 'Loja Principal').trim().toLowerCase();
          return filialDB === filialAtiva.trim().toLowerCase();
        });
      }
  
      if (equipamentoFiltro) leituras = leituras.filter((item) => String(item.equipamento_id || item.id) === String(equipamentoFiltro));

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
        custoEstimado: Number((totalGeral * Math.max(0, Number(tarifaKwh) || 0)).toFixed(2)),
        pegadaCarbono: Number((totalGeral * FATOR_CARBONO).toFixed(2)),
        consumoDiario: arrayDiario,
        topConsumidores: arrayTopConsumidores,
        picoDemanda: horaDePico
      };
  
    }, [equipamentoFiltro, filialAtiva, leiturasBrutas, tarifaKwh]);

  const equipamentosDisponiveis = useMemo(() => {
    const unique = new Map();
    leiturasBrutas.forEach((item) => {
      const id = item.equipamento_id || item.id;
      if (id != null && !unique.has(String(id))) unique.set(String(id), { id, nome: item.nome || `Equipamento ${id}` });
    });
    return [...unique.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [leiturasBrutas]);
  const totalLeituras = leiturasBrutas.length;
  const diasMonitorados = consumoDiario.length;
  const mediaDiaria = diasMonitorados ? totalKw / diasMonitorados : 0;

return (
    <div className="anim-fade-in stagger-1">
      
      <div className="energy-hero">
        <div className="hero-title-box">
          <div className="hero-icon-circle" style={{ color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--warning) 30%, transparent)' }}>
            <Zap size={28} />
          </div>
          <div>
            <h3 className="hero-main-title">Gestão Energética (ESG)</h3>
            <span className="hero-subtitle">Auditoria de consumo elétrico, projeção de custos e pegada de carbono.</span>
          </div>
        </div>
        <button className="energy-export-button" type="button" onClick={exportarEnergiaCsv} disabled={isLoading || isOffline || !consumoDiario.length}>
          <Download size={17} /> Exportar análise
        </button>
      </div>

      <div className="filtros-deck stagger-2">
        <div className="deck-row">
          <div className="control-group">
            <label className="control-label"><Filter size={14}/> Equipamento</label>
            <select className="energy-select" value={equipamentoFiltro} onChange={event => setEquipamentoFiltro(event.target.value)} disabled={isLoading || isOffline}>
              <option value="">Todos os equipamentos</option>
              {equipamentosDisponiveis.map(equipamento => <option key={equipamento.id} value={equipamento.id}>{equipamento.nome}</option>)}
            </select>
          </div>
          <div className="control-group">
            <label className="control-label"><CalendarDays size={14}/> Período do Relatório</label>
            <div className="energy-date-range">
              <DatePicker selected={dataInicio} onChange={(date) => setDataInicio(date)} dateFormat="dd/MM/yyyy" className="custom-datepicker" disabled={isLoading || isOffline} />
              <DatePicker selected={dataFim} onChange={(date) => setDataFim(date)} dateFormat="dd/MM/yyyy" className="custom-datepicker" disabled={isLoading || isOffline} minDate={dataInicio} />
            </div>
          </div>
          <div className="control-group energy-tariff-control">
            <label className="control-label"><DollarSign size={14}/> Tarifa simulada (R$/kWh)</label>
            <input className="energy-tariff-input" type="number" min="0" step="0.01" value={tarifaKwh} onChange={event => setTarifaKwh(event.target.value)} disabled={isLoading || isOffline} />
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
        <div className="kpi-card" style={{ '--kpi-color': 'var(--warning)' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><Zap size={20} /></div><span>Consumo Acumulado</span></div>
          <h4 className="kpi-value">{totalKw.toLocaleString('pt-BR')}<span className="kpi-unit">kWh</span></h4>
          <p className="kpi-trend">Energia ativa consumida no período.</p>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': 'var(--success)' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><DollarSign size={20} /></div><span>Custo Projetado</span></div>
          <h4 className="kpi-value"><span className="kpi-unit" style={{fontSize:'1.2rem', marginRight:'4px'}}>R$</span>{custoEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h4>
          <p className="kpi-trend">Simulação local com tarifa de R$ {Number(tarifaKwh || 0).toFixed(2).replace('.', ',')}/kWh.</p>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': 'var(--info)' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><Leaf size={20} /></div><span>Pegada de Carbono</span></div>
          <h4 className="kpi-value">{pegadaCarbono}<span className="kpi-unit">kgCO₂e</span></h4>
          <p className="kpi-trend">Estimativa pelo fator de {FATOR_CARBONO} kgCO₂e/kWh.</p>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': 'var(--danger)' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><Clock size={20} /></div><span>Pico de Demanda</span></div>
          <h4 className="kpi-value" style={{ fontSize: '1.7rem', marginTop: '5px' }}>{picoDemanda}</h4>
          <p className="kpi-trend">Horário com maior gasto de energia.</p>
        </div>
      </div>

      <div className="energy-summary-strip" aria-label="Indicadores do período energético">
        <div><Gauge size={17}/><span>Média diária<strong>{mediaDiaria.toLocaleString('pt-BR')} kWh</strong></span></div>
        <div><CalendarDays size={17}/><span>Dias com dados<strong>{diasMonitorados}</strong></span></div>
        <div><Activity size={17}/><span>Amostras processadas<strong>{totalLeituras.toLocaleString('pt-BR')}</strong></span></div>
        <div><Server size={17}/><span>Equipamentos no escopo<strong>{equipamentoFiltro ? 1 : equipamentosDisponiveis.length}</strong></span></div>
      </div>

      <div className="charts-grid stagger-4">
        <div className="chart-container-hud">
          <div className="chart-header">
            <div className="chart-title"><Activity size={20} color="var(--warning)" /> Demanda Diária vs Média</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: '800', background: 'color-mix(in srgb, var(--success) 10%, transparent)', padding: '4px 8px', borderRadius: '6px', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)' }}><CheckCircle2 size={12} style={{ display: 'inline', marginBottom: '-2px' }}/> DADOS DO BANCO</span>
          </div>
          
          {isLoading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={32} className="spin" style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <p>Processando matriz energética...</p>
            </div>
          ) : consumoDiario?.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Server size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <h4 style={{ margin: 0 }}>Sem Leituras</h4>
              <p style={{ fontSize: '0.85rem' }}>Não há dados de medidores para este período.</p>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 300 }}>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={consumoDiario} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorKw" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--warning)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                  <XAxis dataKey="dia" stroke="var(--text-muted)" fontSize={11} tickMargin={10} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => `${val}k`} width={50} />
                  <Tooltip contentStyle={{ backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'white', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '8px', color: isDarkMode ? 'white' : '#0f172a' }} itemStyle={{ color: isDarkMode ? 'white' : '#0f172a' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="kwh" name="Consumo Real (kWh)" stroke="var(--warning)" fillOpacity={1} fill="url(#colorKw)" strokeWidth={2} activeDot={{ r: 6 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="meta" name="Média do Período" stroke="var(--info)" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="chart-container-hud">
          <div className="chart-header">
            <div className="chart-title"><Server size={20} color="var(--danger)" /> Ranking de Consumo por Equipamento</div>
          </div>
          
          {isLoading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={32} className="spin" style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <p>Analisando telemetria de hardware...</p>
            </div>
          ) : topConsumidores?.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Server size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p style={{ fontSize: '0.85rem' }}>Equipamentos inativos no período.</p>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 300 }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topConsumidores} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} horizontal={false} />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => `${val}k`} />
                  <YAxis dataKey="nome" type="category" stroke="#cbd5e1" fontSize={10} width={120} tickFormatter={(val) => val.length > 15 ? val.substring(0,15)+'...' : val} />
                  <Tooltip cursor={{fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}} contentStyle={{ backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'white', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '8px' }} />
                  <Bar dataKey="kwh" name="Consumo (kWh)" fill="var(--danger)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
