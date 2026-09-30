/**
 * Módulo: frontend/src/pages/Relatorios/Relatorios.jsx
 * Responsabilidade: Implementa a tela Relatorios, seus estados, interações e integrações de dados.
 */

import usePersistentState from '../../hooks/usePersistentState';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import {
  Zap, CheckCircle2, ShieldCheck, Thermometer, Clock,
  AlertCircle, Loader2, Filter, Activity,
  ListOrdered, DownloadCloud, BarChart2, CheckSquare, Shield, WifiOff, FileCheck
} from 'lucide-react';
import jsPDF from 'jspdf'; // [NOVO] Importação do gerador de PDF

import ptBR from 'date-fns/locale/pt-BR'; 
registerLocale('pt', ptBR);

import 'react-datepicker/dist/react-datepicker.css';
import './Relatorios.css';
import logger from '../../utils/logger';

/**
 * Renderiza a tela Relatorios e concentra as regras de apresentacao desse modulo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
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
export default function Relatorios({ api, filialAtiva, showToast, isDarkMode, isOffline }) {

  // ==========================================
  // ESTADOS DO COMPONENTE (30 DIAS PADRÃO)
  // ==========================================
  const [dataInicio, setDataInicio] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); 
  const [dataFim, setDataFim] = useState(new Date());
  
  const [equipamentoFiltro, setEquipamentoFiltro] = usePersistentState('termosync_reports_equipment', '');
  const [equipamentos, setEquipamentos] = useState([]);
  const [leiturasBrutas, setLeiturasBrutas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ==========================================
  // BUSCA REAL NO BANCO DE DADOS (API)
  // ==========================================
  useEffect(() => {
    if (!api) return;
    api.get('/equipamentos', { params: { filial: filialAtiva !== 'Todas' ? filialAtiva : undefined } })
      .then(res => setEquipamentos(res.data || []))
      .catch(err => logger.error("Erro ao buscar equipamentos:", err));
  }, [api, filialAtiva]);

  const buscarRelatorio = useCallback(async () => {
    if (!api || isOffline) return;
    if (!(dataInicio instanceof Date) || !(dataFim instanceof Date) || Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime()) || dataInicio > dataFim) {
      showToast?.('Selecione um período válido para gerar o relatório.', 'warning');
      return;
    }
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
      if(showToast) showToast('Aviso: Não foi possível buscar o histórico de relatórios.', 'error');
      setLeiturasBrutas([]); 
    } finally {
      setIsLoading(false);
    }
  }, [api, dataInicio, dataFim, isOffline, showToast]);

  useEffect(() => {
    buscarRelatorio();
  }, [buscarRelatorio]);

  // ==========================================
  // PROCESSAMENTO SEGURO DE DADOS (COM FILTRO LOCAL)
  // ==========================================
  const equipamentosDaFilial = useMemo(() => {
    if (!filialAtiva || filialAtiva === 'Todas') return equipamentos;
    return equipamentos.filter(eq => (eq.filial || 'Loja Principal').trim().toLowerCase() === filialAtiva.trim().toLowerCase());
  }, [equipamentos, filialAtiva]);

  const equipamentoSelecionado = useMemo(() => {
    return equipamentosDaFilial.find(eq => String(eq.id) === String(equipamentoFiltro)) || null;
  }, [equipamentosDaFilial, equipamentoFiltro]);

  const { dadosGrafico, kpis, tabelaReversa } = useMemo(() => {
    
    let leiturasParaProcessar = leiturasBrutas;
    
    if (filialAtiva && filialAtiva !== 'Todas') {
      leiturasParaProcessar = leiturasParaProcessar.filter(l => {
        const filialDB = (l.filial || 'Loja Principal').trim().toLowerCase();
        return filialDB === filialAtiva.trim().toLowerCase();
      });
    }

    if (equipamentoFiltro) {
      leiturasParaProcessar = leiturasParaProcessar.filter(l => String(l.equipamento_id) === String(equipamentoFiltro));
    }

    if (!leiturasParaProcessar || leiturasParaProcessar.length === 0) {
      return { 
        dadosGrafico: [], 
        tabelaReversa: [],
        kpis: { totalEnergia: 0, slaCompliance: 0, mediaTemp: '--', maxTemp: '--', minTemp: '--', mediaUmidade: '--', totalLeituras: 0, excursoes: 0 }
      };
    }

    let maxT = -Infinity;
    let minT = Infinity;
    let leiturasValidasSLA = 0;
    let somaTemp = 0;
    let somaUmidade = 0;
    let leiturasComUmidade = 0;
    const energiaGasta = leiturasParaProcessar.reduce((acc, l) => acc + Math.max(0, Number(l.consumo_kwh) || 0), 0);

    const graficoProcessado = leiturasParaProcessar.map(l => {
      const tempNum = Number(l.temperatura);
      const umidNum = Number(l.umidade || 0);

      if (tempNum > maxT) maxT = tempNum;
      if (tempNum < minT) minT = tempNum;
      if (umidNum > 0) {
        somaUmidade += umidNum;
        leiturasComUmidade++;
      }
      
      const eqInfo = equipamentoSelecionado || equipamentosDaFilial.find(e => String(e.id) === String(l.equipamento_id)) || { temp_min: 2, temp_max: 8 };
      if (tempNum >= eqInfo.temp_min && tempNum <= eqInfo.temp_max) {
        leiturasValidasSLA++;
      }
      
      somaTemp += tempNum;

      return {
        hora: new Date(l.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        temperatura: tempNum,
        umidade: umidNum,
        nome: l.nome,
        equipamentoId: l.equipamento_id,
        dataExata: l.data_hora,
        consumo_kwh: Number(l.consumo_kwh || 0)
      };
    }); 
       /**
        * Concentra a logica de sla perc para manter o restante do tela mais legivel.
        *
        * Responsabilidade: mantém este comportamento isolado para que validação,
        * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
        *
        * Fluxo principal:
        * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
        *
        * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
        *
        * @param {number} index - Posição do item dentro da coleção atual.
        * @returns {unknown} Resultado calculado para consumo do chamador.
        * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
        */

      /**
       * Concentra a logica de sla perc para manter o restante do tela mais legivel.
       *
       * Responsabilidade: mantém este comportamento isolado para que validação,
       * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
       *
       * Fluxo principal:
       * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
       *
       * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
       *
       * @param {number} index - Posição do item dentro da coleção atual.
       * @returns {unknown} Resultado calculado para consumo do chamador.
       * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
       */

     /**
      * Concentra a logica de sla perc para manter o restante do tela mais legivel.
      *
      * Responsabilidade: mantém este comportamento isolado para que validação,
      * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
      *
      * Fluxo principal:
      * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
      *
      * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
      *
      * @param {number} index - Posição do item dentro da coleção atual.
      * @returns {unknown} Resultado calculado para consumo do chamador.
      * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
      */

    /**
     * Concentra a logica de sla perc para manter o restante do tela mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @param {number} index - Posição do item dentro da coleção atual.
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const slaPerc = ((leiturasValidasSLA / leiturasParaProcessar.length) * 100).toFixed(1);
     /**
      * Concentra a logica de media temp para manter o restante do tela mais legivel.
      *
      * Responsabilidade: mantém este comportamento isolado para que validação,
      * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
      *
      * Fluxo principal:
      * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
      *
      * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
      *
      * @param {number} index - Posição do item dentro da coleção atual.
      * @returns {unknown} Resultado calculado para consumo do chamador.
      * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
      */

    /**
     * Concentra a logica de media temp para manter o restante do tela mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @param {number} index - Posição do item dentro da coleção atual.
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const mediaTemp = (somaTemp / leiturasParaProcessar.length).toFixed(1);
    const tabelaInvertida = [...graficoProcessado].reverse();
    const passoGrafico = Math.max(1, Math.ceil(graficoProcessado.length / 400));
    const serieGrafico = graficoProcessado.filter((_, index) => index % passoGrafico === 0 || index === graficoProcessado.length - 1);

    return {
      dadosGrafico: serieGrafico,
      tabelaReversa: tabelaInvertida,
      kpis: {
        totalEnergia: energiaGasta,
        slaCompliance: slaPerc,
        mediaTemp,
        maxTemp: maxT.toFixed(1),
        minTemp: minT.toFixed(1),
        mediaUmidade: leiturasComUmidade ? (somaUmidade / leiturasComUmidade).toFixed(1) : '--',
        totalLeituras: leiturasParaProcessar.length,
        excursoes: leiturasParaProcessar.length - leiturasValidasSLA
      }
    };
  }, [leiturasBrutas, filialAtiva, equipamentoFiltro, equipamentoSelecionado, equipamentosDaFilial]);

  /**
   * ========================================== SEGURANÇA E EXPORTAÇÃO
   * ==========================================
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {object|Array} data - Dados de entrada que serão validados e transformados pelo fluxo.
   * @param {unknown} temp - Valor de temp consumido por esta rotina.
   * @param {string|number} umid - Identificador do registro ou recurso processado.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const generateRecordId = (data, temp, umid) => {
    const raw = `${data}-${temp}-${umid}-thermosync-autenticado`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  };


  /**
   * Atualiza set quick range mantendo o estado persistido em sincronia.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} hours - Valor de hours consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const setQuickRange = (hours) => {
    const end = new Date();
    const start = new Date();
    start.setHours(start.getHours() - hours);
    setDataInicio(start);
    setDataFim(end);
  };


  /**
   * Extrai extrair planilha csv de uma entrada externa ou configuracao local.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
   *
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const extrairPlanilhaCSV = () => {
    if (tabelaReversa.length === 0) return showToast('Não há dados para exportar neste período.', 'error');
    
    showToast('Gerando planilha com identificadores de registro...', 'info');
    
    let csvContent = "Data/Hora,Equipamento,Temperatura (C),Umidade (%),Energia (kWh),ID do Registro\n";
    tabelaReversa.forEach(row => {
      const dataFormatada = new Date(row.dataExata).toLocaleString('pt-BR');
      const hash = generateRecordId(row.dataExata, row.temperatura, row.umidade);
      csvContent += `"${dataFormatada}","${row.nome}",${row.temperatura},${row.umidade},${row.consumo_kwh},"${hash}"\n`;
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); 
    link.href = URL.createObjectURL(blob); 
    link.download = `Auditoria_ThermoSync_${Date.now()}.csv`;
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
    
    setTimeout(() => showToast('Planilha baixada com sucesso!', 'success'), 800);
  };

  /**
   * ========================================== [NOVO] GERADOR DE LAUDO OFICIAL ANVISA / MAPA
   * ==========================================
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; registra informações de diagnóstico
   *
   * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const gerarLaudoAnvisaOficial = async () => {
    // Valida se o operador selecionou um equipamento específico
    if (!equipamentoSelecionado) {
      return showToast('Por favor, selecione um Equipamento específico no filtro acima para emitir o Laudo ANVISA.', 'warning');
    }

    showToast(`Buscando histórico oficial de 30 dias para ${equipamentoSelecionado.nome}...`, 'info');
    
    try {
      const res = await api.get(`/relatorios/anvisa/${equipamentoSelecionado.id}`);
      const dados = res.data;

      if (!dados.success || !dados.historico_diario || dados.historico_diario.length === 0) {
        return showToast('Não há dados suficientes nos últimos 30 dias para este ativo.', 'warning');
      }

      const doc = new jsPDF('p', 'mm', 'a4');
      
      // Cabeçalho Oficial
      doc.setFillColor(15, 23, 42); 
      doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text("TERMOSYNC ENTERPRISE - LAUDO METROLÓGICO", 105, 13, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Relatório Oficial de Temperaturas Diárias (Conformidade ANVISA / MAPA)", 105, 21, { align: "center" });

      // Dados da Máquina
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text(`Ativo Monitorado: ${dados.equipamento.nome}`, 15, 42);
      doc.text(`Unidade / Filial: ${dados.equipamento.filial} | Setor: ${dados.equipamento.setor}`, 15, 49);
      doc.text(`Limites Térmicos Configurados: Mín: ${equipamentoSelecionado.temp_min}°C | Máx: ${equipamentoSelecionado.temp_max}°C`, 15, 56);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 15, 63);

      doc.setDrawColor(200, 200, 200);
      doc.line(15, 68, 195, 68);

      // Tabela de Dados (Cabeçalho)
      let y = 78;
      doc.setFillColor(241, 245, 249);
      doc.rect(15, y - 5, 180, 8, 'F');
      doc.setFont("helvetica", "bold");
      doc.text("Data de Registro", 20, y);
      doc.text("Temperatura Mínima", 70, y);
      doc.text("Temperatura Média", 120, y);
      doc.text("Temperatura Máxima", 160, y);
      
      doc.setFont("helvetica", "normal");
      y += 9;

      // Linhas do Histórico Diário
      dados.historico_diario.forEach((dia) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }

        const dataBr = new Date(dia.data_registro).toLocaleDateString('pt-BR');
        const tMax = parseFloat(dia.temp_maxima);
        const tMin = parseFloat(dia.temp_minima);
        
        // Alerta visual no PDF se estourou os limites normativos
        const isViolacao = tMax > parseFloat(equipamentoSelecionado.temp_max) || tMin < parseFloat(equipamentoSelecionado.temp_min);
        if (isViolacao) doc.setTextColor(220, 38, 38); 
        else doc.setTextColor(50, 50, 50); 

        doc.text(dataBr, 20, y);
        doc.text(`${tMin.toFixed(1)} °C`, 70, y);
        doc.text(`${parseFloat(dia.temp_media).toFixed(1)} °C`, 120, y);
        doc.text(`${tMax.toFixed(1)} °C ${isViolacao ? '(*)' : ''}`, 160, y);

        doc.setDrawColor(245, 245, 245);
        doc.line(15, y + 2, 195, y + 2);
        
        y += 8;
      });

      // Rodapé oficial
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.text("Documento gerado digitalmente pela plataforma TermoSync. Válido para fiscalização sanitária.", 105, 287, { align: "center" });

      doc.save(`Laudo_ANVISA_${equipamentoSelecionado.nome.replace(/\s+/g, '_')}.pdf`);
      showToast('Laudo ANVISA gerado com sucesso!', 'success');

    } catch (err) {
      console.error(err);
      showToast('Falha ao processar o PDF oficial.', 'error');
    }
  };

  const currentRangeHours = Math.round((dataFim - dataInicio) / (1000 * 60 * 60));

  return (
    <div className="anim-fade-in stagger-1">
      
      <div className="relatorios-hero">
        <div className="hero-title-box">
          <div className="hero-icon-circle"><BarChart2 size={28} /></div>
          <div>
            <h3 className="hero-main-title">Relatórios & Análise de Desempenho</h3>
            <span className="hero-subtitle">Métricas de qualidade, temperatura e histórico de consumo de energia da loja.</span>
          </div>
        </div>
        <div className="hero-actions">
          <button className="btn-export pdf" onClick={gerarLaudoAnvisaOficial} disabled={isLoading || isOffline || !equipamentoSelecionado} title={!equipamentoSelecionado ? "Selecione um equipamento específico no filtro abaixo para emitir o laudo" : "Emitir Laudo Oficial exigido pela ANVISA"}>
            <FileCheck size={16} /> Laudo ANVISA (PDF)
          </button>
          <button className="btn-export csv" onClick={extrairPlanilhaCSV} disabled={isLoading || isOffline}>
            <DownloadCloud size={16} /> Exportar Planilha (CSV)
          </button>
        </div>
      </div>

      <div className="filtros-deck stagger-2">
        <div className="deck-row">
          <div className="control-group">
            <label className="control-label"><Filter size={14}/> Equipamento Analisado</label>
            <select className="custom-select" value={equipamentoFiltro} onChange={(e) => setEquipamentoFiltro(e.target.value)} disabled={isLoading || isOffline}>
              <option value="">Todos os equipamentos</option>
              {equipamentosDaFilial?.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.nome} - {eq.setor}</option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label className="control-label"><Clock size={14}/> Período de Análise</label>
            <div className="report-date-range">
              <DatePicker selected={dataInicio} onChange={(date) => setDataInicio(date)} showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="dd/MM/yyyy HH:mm" className="custom-datepicker" disabled={isLoading || isOffline} />
              <DatePicker selected={dataFim} onChange={(date) => setDataFim(date)} showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="dd/MM/yyyy HH:mm" className="custom-datepicker" disabled={isLoading || isOffline} minDate={dataInicio} />
            </div>
          </div>
          <div className="control-group" style={{ flex: '0 1 auto' }}>
            <label className="control-label">Períodos Rápidos</label>
            <div className="quick-range-group">
              <button type="button" className={`btn-quick-range ${currentRangeHours === 6 ? 'active' : ''}`} onClick={() => setQuickRange(6)} disabled={isLoading || isOffline}>Últimas 6h</button>
              <button type="button" className={`btn-quick-range ${currentRangeHours === 12 ? 'active' : ''}`} onClick={() => setQuickRange(12)} disabled={isLoading || isOffline}>Últimas 12h</button>
              <button type="button" className={`btn-quick-range ${currentRangeHours === 24 ? 'active' : ''}`} onClick={() => setQuickRange(24)} disabled={isLoading || isOffline}>24 Horas</button>
            </div>
          </div>
        </div>
      </div>

      <div className="kpi-grid stagger-3">
        <div className="kpi-card" style={{ '--kpi-color': 'var(--success)' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><ShieldCheck size={20} /></div><span>Faixa de Segurança</span></div>
          <h4 className="kpi-value">{kpis.slaCompliance}<span className="kpi-unit">%</span></h4>
          <p className="kpi-trend">Temperaturas dentro da margem segura exigida.</p>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': 'var(--info)' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><Thermometer size={20} /></div><span>Temperatura Média</span></div>
          <h4 className="kpi-value">{kpis.mediaTemp}<span className="kpi-unit">°C</span></h4>
          <p className="kpi-trend">Média térmica para análise de conservação.</p>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': 'var(--warning)' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><Zap size={20} /></div><span>Consumo Estimado</span></div>
          <h4 className="kpi-value">{kpis.totalEnergia?.toFixed(1) || 0}<span className="kpi-unit">kWh</span></h4>
          <p className="kpi-trend">Soma das amostras de consumo registradas no período.</p>
        </div>
        <div className="kpi-card" style={{ '--kpi-color': 'var(--danger)' }}>
          <div className="kpi-header"><div className="kpi-icon-wrapper"><AlertCircle size={20} /></div><span>Pico Máximo</span></div>
          <h4 className="kpi-value">{kpis.maxTemp}<span className="kpi-unit">°C</span></h4>
          <p className="kpi-trend">Faixa observada: {kpis.minTemp}°C a {kpis.maxTemp}°C.</p>
        </div>
      </div>

      <div className="report-summary-strip" aria-label="Resumo da qualidade dos dados">
        <div><span>Leituras analisadas</span><strong>{kpis.totalLeituras.toLocaleString('pt-BR')}</strong></div>
        <div><span>Excursões térmicas</span><strong className={kpis.excursoes > 0 ? 'summary-alert' : ''}>{kpis.excursoes.toLocaleString('pt-BR')}</strong></div>
        <div><span>Umidade média</span><strong>{kpis.mediaUmidade}{kpis.mediaUmidade !== '--' ? '%' : ''}</strong></div>
        <div><span>Escopo</span><strong>{equipamentoSelecionado?.nome || `${equipamentosDaFilial.length} equipamento(s)`}</strong></div>
      </div>

      <div className="chart-container-hud stagger-4">
        <div className="chart-header">
          <div className="chart-title"><Activity size={20} color="var(--info)" /> Gráfico de Desempenho Térmico</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: '800', background: 'color-mix(in srgb, var(--success) 10%, transparent)', padding: '4px 8px', borderRadius: '6px', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)' }}><CheckCircle2 size={12} style={{ display: 'inline', marginBottom: '-2px' }}/> DADOS VALIDADOS</span>
        </div>
        
        {isOffline ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
            <WifiOff size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <h4 style={{ margin: 0 }}>Sem Conexão</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>Conecte-se à internet para buscar o histórico de relatórios.</p>
          </div>
        ) : isLoading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="spin" style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <p>Buscando histórico de temperatura no sistema...</p>
          </div>
        ) : dadosGrafico.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <Activity size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <h4 style={{ margin: 0 }}>Nenhum Registro</h4>
            <p style={{ fontSize: '0.85rem' }}>Não há dados de temperatura gravados neste período.</p>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 340 }}>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={dadosGrafico} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                <XAxis dataKey="hora" stroke="var(--text-muted)" fontSize={11} tickMargin={10} minTickGap={30} />
                <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => `${val}°C`} width={50} />
                <Tooltip contentStyle={{ backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'white', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#cbd5e1', borderRadius: '8px', color: isDarkMode ? 'white' : '#0f172a' }} itemStyle={{ color: isDarkMode ? 'white' : '#0f172a' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                
                {equipamentoSelecionado && (
                  <>
                    <ReferenceLine yAxisId="left" y={equipamentoSelecionado.temp_max} stroke="var(--danger)" strokeDasharray="4 4" label={{ position: 'top', value: 'Limite Máximo', fill: 'var(--danger)', fontSize: 10 }} />
                    <ReferenceLine yAxisId="left" y={equipamentoSelecionado.temp_min} stroke="var(--info)" strokeDasharray="4 4" label={{ position: 'bottom', value: 'Limite Mínimo', fill: 'var(--info)', fontSize: 10 }} />
                  </>
                )}
                
                <Line yAxisId="left" type="monotone" dataKey="temperatura" name="Temperatura (°C)" stroke="var(--success)" strokeWidth={2.5} dot={false} activeDot={{ r: 6, fill: 'var(--success)', stroke: 'var(--technical-canvas)', strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="leituras-log-card stagger-4">
        <div className="log-header">
          <div className="log-title"><ListOrdered size={20} color="var(--info)" /> Histórico Detalhado de Leituras</div>
          <div className="log-status" title="Registros retornados pelo histórico do sistema."><CheckSquare size={14} /> Dados registrados</div>
        </div>

        {isLoading ? (
           <div className="empty-log">Carregando lista de registros de temperatura...</div>
        ) : tabelaReversa.length === 0 ? (
          <div className="empty-log">Não há registros para exibir na tabela neste período.</div>
        ) : (
          <div className="log-table-wrapper">
            <table className="log-table">
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Câmara / Equipamento</th>
                  <th>ID do Registro</th>
                  <th>Temp (°C)</th>
                  <th>Umidade (%)</th>
                  <th>Energia (kWh)</th>
                </tr>
              </thead>
              <tbody>
                {tabelaReversa.map((d, i) => {
                  let eqLocal = equipamentoSelecionado;
                  if (!eqLocal) eqLocal = equipamentosDaFilial?.find(x => String(x.id) === String(d.equipamentoId));
                  const isForaLimites = eqLocal && (d.temperatura < eqLocal.temp_min || d.temperatura > eqLocal.temp_max);
                  const validationCode = generateRecordId(d.dataExata, d.temperatura, d.umidade);

                  return (
                    <tr key={i} className={`log-row ${isForaLimites ? 'critical' : ''}`}>
                      <td data-label="Data / Hora" className="log-time">{new Date(d.dataExata).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td data-label="Equipamento" className="log-node" title={`${d.nome}`}>{d.nome.substring(0, 20)}</td>
                      <td data-label="ID do registro"><span className="log-hash" title="Identificador local desta leitura"><Shield size={12}/> {validationCode}</span></td>
                      <td data-label="Temp (°C)" className={isForaLimites ? 'log-val-alert' : 'log-val-ok'}>{d.temperatura.toFixed(1)} {isForaLimites ? '⚠️' : ''}</td>
                      <td data-label="Umidade (%)">{d.umidade > 0 ? d.umidade.toFixed(1) : '--'}</td>
                      <td data-label="Energia (kWh)">{d.consumo_kwh.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
