/**
 * Módulo: frontend/src/pages/PortalPublico/PortalPublico.jsx
 * Responsabilidade: Implementa a tela Portal Publico, seus estados, interações e integrações de dados.
 */

import TermoSyncLogo from '../../components/TermoSyncLogo';
import { ChevronLeft, ChevronRight, Clock3, Expand, Fan, Loader2, Pause, Play, Radio, RefreshCw, WifiOff } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Thermometer, Snowflake, Power, AlertTriangle, CheckCircle2, MapPin } from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '../../config/api'; 
import '../Monitoramento/Monitoramento.css';
import './PortalPublico.css';

const STALE_AFTER_MS = 3 * 60 * 1000;

/**
 * Busca ou monta os dados de get panel token usados no fluxo atual.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
 *
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const getPanelToken = () => {
  const storedToken = sessionStorage.getItem('token');
  if (storedToken) return storedToken;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const transferredToken = hashParams.get('panel_token');
  if (!transferredToken) return '';

  sessionStorage.setItem('token', transferredToken);
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  return transferredToken;
};

/**
 * Converte valores vindos do banco sem transformar vazio em zero válido.
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
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const toNumber = (value) => { if (value === null || value === undefined || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }; /* Normaliza flags booleanas retornadas pelo MySQL. */ const toBoolean = (value) => value === true || value === 1 || value === '1'; /* Classifica uma leitura para priorização e apresentação no painel. */ const classifyEquipment = (equipment, now) => { const temperature = toNumber(equipment.ultima_temp); const min = toNumber(equipment.temp_min); const max = toNumber(equipment.temp_max); const readingAt = equipment.atualizado_em ? new Date(equipment.atualizado_em).getTime() : null; const ageMs = readingAt && Number.isFinite(readingAt) ? Math.max(0, now - readingAt) : null; const motorOn = toBoolean(equipment.motor_ligado); const defrosting = toBoolean(equipment.em_degelo); if (temperature === null || ageMs === null || ageMs > STALE_AFTER_MS) { return { tone: 'stale', label: temperature === null ? 'SEM LEITURA' : 'SINAL ATRASADO', temperature, min, max, ageMs, motorOn, defrosting }; } if (defrosting) return { tone: 'defrost', label: 'EM DEGELO', temperature, min, max, ageMs, motorOn, defrosting }; const above = max !== null && temperature > max; const below = min !== null && temperature < min; const deviation = above ? temperature - max : below ? min - temperature : 0; if ((above || below) && deviation >= 5) { return { tone: 'critical', label: above ? 'ALTA CRÍTICA' : 'BAIXA CRÍTICA', temperature, min, max, ageMs, motorOn, defrosting }; } if (above || below) { return { tone: 'warning', label: above ? 'ACIMA DO LIMITE' : 'ABAIXO DO LIMITE', temperature, min, max, ageMs, motorOn, defrosting }; } return { tone: 'normal', label: motorOn ? 'REFRIGERANDO' : 'FAIXA NORMAL', temperature, min, max, ageMs, motorOn, defrosting }; }; /* Resume a idade da leitura em linguagem curta para visualização à distância. */ const formatAge = (ageMs) => { if (ageMs === null) return 'sem registro'; const seconds = Math.floor(ageMs / 1000); if (seconds < 15) return 'agora'; if (seconds < 60) return `há ${seconds}s`; const minutes = Math.floor(seconds / 60); if (minutes < 60) return `há ${minutes}min`; return `há ${Math.floor(minutes / 60)}h`; }; /* Exibe temperatura e limites sem propagar NaN para a interface. */ const formatTemperature = (value, digits = 1) => value === null ? '--' : value.toFixed(digits); /* Painel autenticado de TV com telemetria e atualização periódica. */ export default function PortalPublico({ filialUrl }) { const [authToken] = useState(getPanelToken); const [data, setData] = useState(null); const [error, setError] = useState(''); const [refreshing, setRefreshing] = useState(false); const [lastSuccessAt, setLastSuccessAt] = useState(null); const [now, setNow] = useState(Date.now()); const [activeGroupIndex, setActiveGroupIndex] = useState(0); const [autoRotate, setAutoRotate] = useState(true); const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement)); useEffect(() => { document.title = `Painel TV - ${filialUrl || 'Operação'} | ThermoSync`; }, [filialUrl]); /* Atualiza os dados sem apagar a última leitura válida em falhas transitórias. */ const loadData = useCallback(async () => { setRefreshing(true); try { if (!authToken) throw new Error('Sessão não encontrada. Abra o Painel TV pelo sistema.'); const response = await axios.get(`${getApiUrl()}/public/live/${encodeURIComponent(filialUrl)}`, { timeout: 8000, headers: { Authorization: `Bearer ${authToken}` } }); if (!response.data?.success) throw new Error(response.data?.error || 'Resposta inválida do servidor.'); setData({ ...response.data, equipamentos: Array.isArray(response.data.equipamentos) ? response.data.equipamentos : [] }); setLastSuccessAt(new Date()); setError(''); } catch (requestError) { setError(requestError.response?.data?.error || requestError.message || 'Não foi possível atualizar a telemetria.'); } finally { setRefreshing(false); } }, [authToken, filialUrl]);
  useEffect(() => {
    loadData();
    const refreshTimer = window.setInterval(loadData, 10000);
    return () => window.clearInterval(refreshTimer);
  }, [loadData]);
  useEffect(() => {
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);
    const handleFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => { window.clearInterval(clockTimer); document.removeEventListener('fullscreenchange', handleFullscreen); };
  }, []);

  const groups = useMemo(() => {
    const grouped = new Map();
    (data?.equipamentos || []).forEach((equipment) => {
      const branch = String(equipment.filial || data?.unidade || 'Unidade não informada');
      if (!grouped.has(branch)) grouped.set(branch, []);
      grouped.get(branch).push({ ...equipment, state: classifyEquipment(equipment, now) });
    });
    return [...grouped.entries()].map(([branch, equipment]) => ({ branch, equipment }));
  }, [data, now]);
  const activeGroup = groups[activeGroupIndex] || groups[0] || null;
  const summary = useMemo(() => {
    const states = groups.flatMap((group) => group.equipment.map((equipment) => equipment.state.tone));
    return {
      total: states.length,
      normal: states.filter((tone) => tone === 'normal').length,
      attention: states.filter((tone) => tone === 'warning' || tone === 'critical').length,
      stale: states.filter((tone) => tone === 'stale').length,
      defrost: states.filter((tone) => tone === 'defrost').length
    };
  }, [groups]);
  const overallTone = summary.attention > 0 ? 'critical' : summary.stale > 0 ? 'stale' : summary.total > 0 ? 'normal' : 'stale';
  const overallLabel = summary.attention > 0 ? 'ATENÇÃO NECESSÁRIA' : summary.stale > 0 ? 'TELEMETRIA PARCIAL' : summary.total > 0 ? 'OPERAÇÃO NORMAL' : 'SEM ATIVOS';

  useEffect(() => {
    if (activeGroupIndex >= groups.length) setActiveGroupIndex(0);
  }, [activeGroupIndex, groups.length]);
  useEffect(() => {
    if (!autoRotate || groups.length < 2) return undefined;
    const rotationTimer = window.setInterval(() => setActiveGroupIndex((index) => (index + 1) % groups.length), 12000);
    return () => window.clearInterval(rotationTimer);
  }, [autoRotate, groups.length]);
  /**
   * Processa a interacao de toggle fullscreen e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: interage com APIs do navegador
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else await document.documentElement.requestFullscreen?.();
  };


  /**
   * Concentra a logica de move group para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} direction - Valor de direction consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const moveGroup = (direction) => {
    if (groups.length < 2) return;
    setActiveGroupIndex(index => (index + direction + groups.length) % groups.length);
  };

  if (!data && error) {
    return (
      <main className="tv-state-page error">
        <TermoSyncLogo size={54} color="var(--brand-core)" />
        <WifiOff size={38} />
        <h1>Painel temporariamente indisponível</h1>
        <p>{error}</p>
        <button type="button" onClick={loadData} disabled={refreshing}><RefreshCw size={18} className={refreshing ? 'spin' : ''} /> Tentar novamente</button>
      </main>
    );
  }

  if (!data) {
    return <main className="tv-state-page"><TermoSyncLogo size={58} color="var(--brand-core)" /><Loader2 size={30} className="spin" /><h1>Sincronizando painel operacional</h1><p>Carregando as leituras mais recentes da rede.</p></main>;
  }

  return (
    <div className="tv-board">
      <header className="tv-topbar">
        <div className="tv-brand"><TermoSyncLogo size={42} color="var(--brand-core)" /><span><strong>ThermoSync</strong><small>Rede térmica sincronizada</small></span></div>
        <div className="tv-title"><small>{data.unidade?.toLowerCase() === 'todas' ? 'VISÃO CONSOLIDADA DA REDE' : 'MONITORAMENTO DA UNIDADE'}</small><h1>{data.unidade?.toLowerCase() === 'todas' ? 'Operação refrigerada' : data.unidade}</h1></div>
        <div className="tv-clock"><Clock3 size={18} /><span><strong>{new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong><small>{new Date(now).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</small></span></div>
        <div className="tv-header-actions">
          <button type="button" onClick={loadData} disabled={refreshing} title="Atualizar agora" aria-label="Atualizar agora"><RefreshCw size={19} className={refreshing ? 'spin' : ''} /></button>
          <button type="button" onClick={toggleFullscreen} title={isFullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'} aria-label={isFullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}><Expand size={19} /></button>
        </div>
      </header>

      <section className="tv-summary" aria-label="Resumo da operação">
        <div className={`tv-overall ${overallTone}`}><span className="tv-live-dot" /><div><small>ESTADO DA REDE</small><strong>{overallLabel}</strong></div></div>
        <div><small>ATIVOS</small><strong>{summary.total}</strong></div>
        <div className="normal"><small>NORMAIS</small><strong>{summary.normal}</strong></div>
        <div className="critical"><small>FORA DA FAIXA</small><strong>{summary.attention}</strong></div>
        <div className="stale"><small>SEM SINAL</small><strong>{summary.stale}</strong></div>
        <div className="defrost"><small>EM DEGELO</small><strong>{summary.defrost}</strong></div>
        <div className="tv-sync"><Radio size={15} /><span><small>{error ? 'ÚLTIMA SINCRONIZAÇÃO' : 'ATUALIZAÇÃO AUTOMÁTICA'}</small><strong>{lastSuccessAt ? lastSuccessAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}</strong></span></div>
      </section>

      {error && <div className="tv-connection-warning"><WifiOff size={16} /><span>{error} Exibindo a última atualização válida.</span></div>}

      {activeGroup ? (
        <main className="tv-stage">
          <header className="tv-branch-header">
            <div><span className="tv-branch-icon"><MapPin size={20} /></span><span><small>FILIAL EM EXIBIÇÃO</small><h2>{activeGroup.branch}</h2></span><b>{activeGroup.equipment.length} ativo(s)</b></div>
            {groups.length > 1 && <nav className="tv-rotation" aria-label="Rotação de filiais"><button type="button" onClick={() => moveGroup(-1)} title="Filial anterior"><ChevronLeft size={18} /></button><span><strong>{activeGroupIndex + 1}</strong> / {groups.length}</span><button type="button" onClick={() => setAutoRotate(value => !value)} title={autoRotate ? 'Pausar rotação' : 'Retomar rotação'}>{autoRotate ? <Pause size={17} /> : <Play size={17} />}</button><button type="button" onClick={() => moveGroup(1)} title="Próxima filial"><ChevronRight size={18} /></button></nav>}
          </header>

          <div className="tv-equipment-grid">
            {activeGroup.equipment.map((equipment, index) => {
              const { state } = equipment;
              const StateIcon = state.tone === 'normal' ? CheckCircle2 : state.tone === 'defrost' ? Snowflake : state.tone === 'stale' ? WifiOff : AlertTriangle;
              const range = state.min !== null && state.max !== null ? state.max - state.min : null;
              const position = range && state.temperature !== null ? Math.max(0, Math.min(100, ((state.temperature - state.min) / range) * 100)) : 50;
              return (
                <article className={`tv-equipment ${state.tone}`} key={`${equipment.filial}-${equipment.nome}-${index}`}>
                  <header><div><span className="tv-equipment-icon"><StateIcon size={19} /></span><span><h3>{equipment.nome}</h3><small>{equipment.setor || 'Setor não informado'}</small></span></div><b>{state.label}</b></header>
                  <div className="tv-temperature"><strong>{formatTemperature(state.temperature)}</strong><span>°C</span></div>
                  <div className="tv-range"><span><small>MÍNIMO</small><strong>{formatTemperature(state.min)}°</strong></span><div><i style={{ left: `${position}%` }} /></div><span><small>MÁXIMO</small><strong>{formatTemperature(state.max)}°</strong></span></div>
                  <footer><span>{state.defrosting ? <Snowflake size={15} /> : state.motorOn ? <Fan size={15} /> : <Power size={15} />} {state.defrosting ? 'Ciclo de degelo' : state.motorOn ? 'Motor ligado' : 'Motor em repouso'}</span><time><Clock3 size={14} /> {formatAge(state.ageMs)}</time></footer>
                </article>
              );
            })}
          </div>
        </main>
      ) : (
        <main className="tv-empty"><Thermometer size={42} /><h2>Nenhum equipamento nesta visualização</h2><p>Não há ativos vinculados à unidade <strong>{data.unidade}</strong>.</p></main>
      )}

      <footer className="tv-footer"><span><i /> Telemetria atualizada a cada 10 segundos</span><span>ThermoSync · Monitoramento público</span></footer>
    </div>
  );
}
