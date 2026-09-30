/**
 * Módulo: frontend/src/pages/Simulador/Simulador.jsx
 * Responsabilidade: Implementa a tela Simulador, seus estados, interações e integrações de dados.
 */

import { AlertTriangle, CheckCircle2, ChevronRight, CircleGauge, Gauge, History, Play, Radio, RotateCcw, Search, Server, Terminal, Trash2, Wifi } from 'lucide-react';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Cpu, Zap, Flame, WifiOff,
  ShieldCheck, Activity, DoorOpen, ShieldAlert
} from 'lucide-react';
import './Simulador.css';

const SCENARIOS = [
  { id: 'NORMAL', label: 'Operação normal', description: 'Leitura estável dentro dos limites.', severity: 'Informativo', tone: 'safe', icon: ShieldCheck },
  { id: 'TEMPERATURA', label: 'Temperatura elevada', description: 'Simula valor acima do limite configurado.', severity: 'Crítico', tone: 'danger', icon: Flame },
  { id: 'UMIDADE', label: 'Umidade elevada', description: 'Simula umidade acima da faixa esperada.', severity: 'Atenção', tone: 'warning', icon: Activity },
  { id: 'PORTA_ABERTA', label: 'Porta aberta', description: 'Representa perda térmica por abertura prolongada.', severity: 'Atenção', tone: 'warning', icon: DoorOpen },
  { id: 'MECANICA', label: 'Falha mecânica', description: 'Simula refrigeração ineficiente e baixo consumo.', severity: 'Crítico', tone: 'danger', icon: ShieldAlert },
  { id: 'DEGELO', label: 'Ciclo de degelo', description: 'Simula um ciclo controlado de degelo.', severity: 'Operacional', tone: 'info', icon: Zap },
  { id: 'REDE', label: 'Falha de comunicação', description: 'Simula indisponibilidade do equipamento na rede.', severity: 'Crítico', tone: 'danger', icon: WifiOff }
];
 /**
  * Formata format time para exibicao segura na interface.
  *
  * Responsabilidade: mantém este comportamento isolado para que validação,
  * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
  *
  * Fluxo principal:
  * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
  *
  * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
  *
  * @param {unknown} value - Valor de value consumido por esta rotina.
  * @returns {unknown} Resultado calculado para consumo do chamador.
  * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
  */

/**
 * Formata format time para exibicao segura na interface.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatTime = (value = new Date()) => new Date(value).toLocaleTimeString('pt-BR', { hour12: false });

/**
 * Concentra a logica de number or para manter o restante do tela mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @param {unknown} fallback - Valor de fallback consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

/**
 * Oferece um laboratorio controlado para testar telemetria, alertas e comandos de hardware sem
 * expor o token tecnico usado pelos dispositivos IoT.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; lê ou grava preferências no armazenamento do navegador; publica ou consome mensagens MQTT
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.equipamentos - Propriedade equipamentos usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function Simulador({ api, equipamentos = [], showToast, socket, setModalConfig }) {
  const [targetMode, setTargetMode] = useState('SINGLE');
  const [eqId, setEqId] = useState('');
  const [scenario, setScenario] = useState('TEMPERATURA');
  const [temperature, setTemperature] = useState('12.0');
  const [humidity, setHumidity] = useState('60');
  const [consumption, setConsumption] = useState('1.20');
  const [sendHardware, setSendHardware] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState([{ id: 'boot', time: formatTime(), level: 'info', message: 'Laboratorio DEV pronto. Saida fisica desativada por padrao.' }]);
  const [results, setResults] = useState([]);
  const [liveReading, setLiveReading] = useState(null);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('termosync:simulator-history') || '[]'); }
    catch { return []; }
  });
  const logEndRef = useRef(null);

  useEffect(() => {
    sessionStorage.setItem('termosync:simulator-history', JSON.stringify(history.slice(0, 12)));
  }, [history]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [logs]);

  useEffect(() => {
    if (!socket || !eqId) return undefined;
    const receiveReading = (reading) => {
      const equipmentId = reading?.equipamento_id ?? reading?.equipamentoId ?? reading?.id;
      if (String(equipmentId) === String(eqId)) setLiveReading(reading);
    };
    socket.on('nova_leitura', receiveReading);
    return () => socket.off('nova_leitura', receiveReading);
  }, [eqId, socket]);

  const selectedEquipment = useMemo(
    () => equipamentos.find((item) => String(item.id) === String(eqId)) || null,
    [equipamentos, eqId]
  );
  const selectedScenario = useMemo(
    () => SCENARIOS.find((item) => item.id === scenario) || SCENARIOS[0],
    [scenario]
  );
  const filteredEquipment = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return equipamentos;
    return equipamentos.filter((item) => `${item.id} ${item.nome} ${item.filial} ${item.setor}`.toLowerCase().includes(term));
  }, [equipamentos, search]);
  const targetIds = useMemo(
    () => targetMode === 'CLUSTER' ? equipamentos.map((item) => Number(item.id)) : (eqId ? [Number(eqId)] : []),
    [targetMode, equipamentos, eqId]
  );

  /**
   * Mantem o historico curto da sessao disponivel durante a navegacao.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} message - Valor de message consumido por esta rotina.
   * @param {unknown} level - Valor de level consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const addLog = (message, level = 'info') => {
    setLogs((current) => [...current.slice(-79), { id: `${Date.now()}-${Math.random()}`, time: formatTime(), level, message }]);
  };

  /**
   * Carrega valores coerentes com o cenario e os limites do equipamento atual.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} nextScenario - Valor de next scenario consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const selectScenario = (nextScenario) => {
    const min = numberOr(selectedEquipment?.temp_min, 0);
    const max = numberOr(selectedEquipment?.temp_max, 8);
    const humidityMax = numberOr(selectedEquipment?.umidade_max, 75);
    const presets = {
      NORMAL: [((min + max) / 2).toFixed(1), '50', '0.85'],
      TEMPERATURA: [Math.min(80, max + 8).toFixed(1), '55', '1.60'],
      UMIDADE: [((min + max) / 2).toFixed(1), Math.min(100, humidityMax + 15).toFixed(0), '1.10'],
      PORTA_ABERTA: [Math.min(80, max + 3).toFixed(1), '62', '1.35'],
      MECANICA: [Math.min(80, max + 12).toFixed(1), '58', '0.20'],
      DEGELO: [Math.min(80, max + 5).toFixed(1), '70', '1.80'],
      REDE: [((min + max) / 2).toFixed(1), '50', '0.90']
    };
    const [nextTemperature, nextHumidity, nextConsumption] = presets[nextScenario];
    setScenario(nextScenario);
    setTemperature(nextTemperature);
    setHumidity(nextHumidity);
    setConsumption(nextConsumption);
  };

  /**
   * Executa o cenario no backend e consolida o resultado por equipamento.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const executeScenario = async () => {
    if (targetIds.length === 0) {
      showToast('Selecione um equipamento para executar o teste.', 'warning');
      return;
    }
    setIsRunning(true);
    setResults([]);
    addLog(`Iniciando ${scenario} em ${targetIds.length} alvo(s). Hardware: ${sendHardware ? 'habilitado' : 'desabilitado'}.`, 'run');
    try {
      const response = await api.post('/simulador/executar', {
        scenario,
        equipmentIds: targetIds,
        temperature: Number(temperature),
        humidity: Number(humidity),
        consumption: Number(consumption),
        sendHardware
      });
      const payload = response.data || {};
      setResults(payload.results || []);
      setHistory((current) => [{
        id: Date.now(), time: new Date().toISOString(), scenario, label: selectedScenario.label,
        targets: targetIds.length, success: payload.totals?.success || 0,
        failed: payload.totals?.failed || 0, hardware: sendHardware
      }, ...current].slice(0, 12));
      addLog(`Execucao concluida: ${payload.totals?.success || 0} sucesso(s), ${payload.totals?.failed || 0} falha(s).`, payload.success ? 'success' : 'warning');
      showToast(payload.success ? 'Simulacao concluida com sucesso.' : 'Simulacao concluida com ressalvas.', payload.success ? 'success' : 'warning');
    } catch (error) {
      const payload = error.response?.data;
      if (payload?.results) setResults(payload.results);
      const message = payload?.error || 'Nao foi possivel executar a simulacao.';
      addLog(message, 'error');
      showToast(message, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  /**
   * Solicita confirmacao para operacoes amplas ou que alcancam hardware real.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; publica ou consome mensagens MQTT
   *
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const requestExecution = (event) => {
    event?.preventDefault();
    if (targetIds.length === 0) return executeScenario();
    if (!setModalConfig || (!sendHardware && targetMode !== 'CLUSTER')) return executeScenario();
    setModalConfig({
      isOpen: true,
      title: sendHardware ? 'Confirmar saida para hardware' : 'Confirmar simulacao em lote',
      message: `Executar ${selectedScenario.label} em ${targetIds.length} equipamento(s)${sendHardware ? ' com comandos MQTT fisicos habilitados' : ''}?`,
      isPrompt: false,
      onConfirm: executeScenario
    });
  };

  /**
   * Prepara a normalizacao apenas para os alvos atualmente selecionados.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const requestRecovery = () => {
    selectScenario('NORMAL');
    addLog('Cenario de recuperacao carregado. Revise os alvos e execute para confirmar.', 'success');
    showToast('Recuperacao preparada. Execute quando estiver pronto.', 'info');
  };

  const displayTemperature = liveReading?.temperatura ?? selectedEquipment?.ultima_temp ?? selectedEquipment?.temperatura ?? '--';
  const displayHumidity = liveReading?.umidade ?? selectedEquipment?.ultima_umidade ?? '--';

  return (
    <div className="simulator-page">
      <header className="simulator-header">
        <div className="simulator-heading">
          <span className="simulator-heading-icon"><Cpu size={24} /></span>
          <div><span className="simulator-kicker">Laboratorio de engenharia</span><h2>Simulador IoT</h2><p>Valide telemetria, regras de alerta e recuperacao com escopo controlado.</p></div>
        </div>
        <div className={`simulator-live ${socket?.connected ? 'online' : ''}`}><Radio size={16} /><span>{socket?.connected ? 'Tempo real conectado' : 'Tempo real indisponivel'}</span></div>
      </header>

      <section className="simulator-metrics" aria-label="Resumo da simulacao">
        <div><Server size={18} /><span>Alvos</span><strong>{targetIds.length || 0}</strong></div>
        <div><CircleGauge size={18} /><span>Cenario</span><strong>{selectedScenario.severity}</strong></div>
        <div><Gauge size={18} /><span>Temperatura</span><strong>{temperature} C</strong></div>
        <div><Wifi size={18} /><span>Saida fisica</span><strong className={sendHardware ? 'is-warning' : 'is-safe'}>{sendHardware ? 'Habilitada' : 'Protegida'}</strong></div>
      </section>

      <div className="simulator-layout">
        <main className="simulator-main">
          <section className="simulator-section simulator-targets">
            <div className="simulator-section-title"><div><span>01</span><div><h3>Escopo do teste</h3><p>Defina onde o evento sera aplicado.</p></div></div></div>
            <div className="simulator-segmented" role="group" aria-label="Modo de alvo">
              <button type="button" className={targetMode === 'SINGLE' ? 'active' : ''} onClick={() => setTargetMode('SINGLE')}>Equipamento unico</button>
              <button type="button" className={targetMode === 'CLUSTER' ? 'active' : ''} onClick={() => setTargetMode('CLUSTER')}>Todos os equipamentos</button>
            </div>

            {targetMode === 'SINGLE' ? (
              <>
                <label className="simulator-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, filial ou ID" /></label>
                <div className="simulator-device-list">
                  {filteredEquipment.slice(0, 40).map((item) => (
                    <button key={item.id} type="button" className={String(item.id) === String(eqId) ? 'selected' : ''} onClick={() => { setEqId(String(item.id)); setLiveReading(null); }}>
                      <span className="device-status" /><span><strong>{item.nome}</strong><small>#{item.id} · {item.filial || item.setor || 'Sem localizacao'}</small></span><ChevronRight size={17} />
                    </button>
                  ))}
                  {filteredEquipment.length === 0 && <p className="simulator-empty">Nenhum equipamento encontrado.</p>}
                </div>
              </>
            ) : <div className="simulator-cluster-note"><AlertTriangle size={18} /><span><strong>{equipamentos.length} equipamentos no escopo.</strong> A execucao sera processada e auditada individualmente.</span></div>}
          </section>

          <section className="simulator-section">
            <div className="simulator-section-title"><div><span>02</span><div><h3>Cenario</h3><p>Escolha uma condicao e ajuste a telemetria.</p></div></div></div>
            <div className="simulator-scenarios">
              {SCENARIOS.map((item) => {
                const Icon = item.icon;
                return <button key={item.id} type="button" className={`${scenario === item.id ? 'selected' : ''} tone-${item.tone}`} onClick={() => selectScenario(item.id)}><Icon size={19} /><span><strong>{item.label}</strong><small>{item.description}</small></span><em>{item.severity}</em></button>;
              })}
            </div>

            <form className="simulator-form" onSubmit={requestExecution}>
              <label>Temperatura (C)<input type="number" min="-80" max="80" step="0.1" value={temperature} onChange={(event) => setTemperature(event.target.value)} required /></label>
              <label>Umidade (%)<input type="number" min="0" max="100" step="0.1" value={humidity} onChange={(event) => setHumidity(event.target.value)} required /></label>
              <label>Consumo (kWh)<input type="number" min="0" max="100000" step="0.01" value={consumption} onChange={(event) => setConsumption(event.target.value)} required /></label>
              <label className={`simulator-hardware-toggle ${sendHardware ? 'enabled' : ''}`}>
                <input type="checkbox" checked={sendHardware} onChange={(event) => setSendHardware(event.target.checked)} /><span className="toggle-track"><span /></span>
                <span><strong>Enviar ao hardware fisico</strong><small>Permite MQTT apenas quando o cenario possui uma acao segura.</small></span>
              </label>
              <div className="simulator-actions">
                <button type="button" className="simulator-button secondary" onClick={requestRecovery} disabled={isRunning}><RotateCcw size={17} /> Preparar recuperacao</button>
                <button type="submit" className="simulator-button primary" disabled={isRunning || targetIds.length === 0}><Play size={17} /> {isRunning ? 'Executando...' : 'Executar simulacao'}</button>
              </div>
            </form>
          </section>

          {(results.length > 0 || isRunning) && (
            <section className="simulator-section simulator-results">
              <div className="simulator-section-title"><div><span>03</span><div><h3>Resultado da execucao</h3><p>Status retornado para cada equipamento.</p></div></div></div>
              {isRunning && <div className="simulator-progress"><span /></div>}
              <div className="simulator-result-list">
                {results.map((item) => <div key={item.id} className={item.success ? 'success' : 'failed'}>{item.success ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}<span><strong>{item.name || `Equipamento #${item.id}`}</strong><small>{item.error || `Leitura #${item.readingId} · MQTT ${item.hardware}`}</small></span><em>{item.success ? 'Concluido' : 'Falhou'}</em></div>)}
              </div>
            </section>
          )}
        </main>

        <aside className="simulator-sidebar">
          <section className="simulator-side-panel">
            <div className="side-panel-title"><Activity size={17} /><h3>Estado do alvo</h3><span className="live-dot" /></div>
            {targetMode === 'SINGLE' && selectedEquipment ? (
              <div className="simulator-device-state">
                <div><span>{selectedEquipment.nome}</span><small>{selectedEquipment.filial || selectedEquipment.setor || `ID ${selectedEquipment.id}`}</small></div>
                <dl><div><dt>Temperatura</dt><dd>{displayTemperature}{displayTemperature !== '--' ? ' C' : ''}</dd></div><div><dt>Umidade</dt><dd>{displayHumidity}{displayHumidity !== '--' ? '%' : ''}</dd></div><div><dt>Motor</dt><dd>{liveReading ? (liveReading.motor_ligado ? 'Ligado' : 'Parado') : (selectedEquipment.motor_ligado ? 'Ligado' : 'Parado')}</dd></div><div><dt>Degelo</dt><dd>{liveReading ? (liveReading.em_degelo ? 'Ativo' : 'Inativo') : (selectedEquipment.em_degelo ? 'Ativo' : 'Inativo')}</dd></div></dl>
              </div>
            ) : <p className="simulator-empty">Selecione um equipamento para acompanhar seu estado ao vivo.</p>}
          </section>

          <section className="simulator-side-panel">
            <div className="side-panel-title"><Terminal size={17} /><h3>Console da execucao</h3><button type="button" title="Limpar console" onClick={() => setLogs([])}><Trash2 size={15} /></button></div>
            <div className="simulator-console">{logs.map((log) => <div key={log.id} className={`log-${log.level}`}><time>{log.time}</time><span>{log.message}</span></div>)}{logs.length === 0 && <p>Console limpo.</p>}<div ref={logEndRef} /></div>
          </section>

          <section className="simulator-side-panel">
            <div className="side-panel-title"><History size={17} /><h3>Execucoes recentes</h3></div>
            <div className="simulator-history">
              {history.map((item) => <div key={item.id}><span className={item.failed ? 'failed' : 'success'}>{item.failed ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}</span><span><strong>{item.label}</strong><small>{new Date(item.time).toLocaleString('pt-BR')} · {item.targets} alvo(s)</small></span><em>{item.success}/{item.targets}</em></div>)}
              {history.length === 0 && <p className="simulator-empty">Nenhuma execucao nesta sessao.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
