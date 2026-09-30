/**
 * Módulo: frontend/src/pages/CentralProcedimentos/CentralProcedimentos.jsx
 * Responsabilidade: Implementa a tela Central Procedimentos, seus estados, interações e integrações de dados.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Check, Clipboard, Clock, Filter, HeartPulse, LoaderCircle, Lock, Printer, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  DoorOpen,
  Droplets,
  MessageSquare,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Wrench
} from 'lucide-react';
import './CentralProcedimentos.css';

const PREFERENCES_KEY = 'operational-procedures';
const ICONS = { AlertTriangle, CheckCircle2, ClipboardCheck, DoorOpen, Droplets, MessageSquare, ShieldCheck, Snowflake, Thermometer, Wrench };

/**
 * Extrai parse preference de uma entrada externa ou configuracao local.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function parsePreference(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

/**
 * Monta o procedimento em texto para compartilhamento em chamados ou chat.
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
 * @param {unknown} procedure - Valor de procedure consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function buildChecklistText(procedure) { return `${procedure.title}\n${procedure.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\nEvidências: ${procedure.evidence.join(', ')}`; } /* Biblioteca operacional carregada integralmente do banco de dados. */ export default function CentralProcedimentos({ api, notificacoes = [], onNavigate, showToast, userRole = 'LOJA' }) { const [procedures, setProcedures] = useState([]); const [selectedId, setSelectedId] = useState(null); const [search, setSearch] = useState(''); const [category, setCategory] = useState('Todos'); const [favorites, setFavorites] = useState(new Set()); const [progress, setProgress] = useState({}); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(''); /* Busca procedimentos e preferências pessoais persistidas. */ const loadData = useCallback(async () => { if (!api) return; setLoading(true); setLoadError(''); try { const [proceduresResponse, preferencesResponse] = await Promise.all([ api.get('/operacao/procedimentos'), api.get(`/user/preferences/${PREFERENCES_KEY}`) ]); const rows = Array.isArray(proceduresResponse.data) ? proceduresResponse.data : []; const preferences = parsePreference(preferencesResponse.data?.value); setProcedures(rows); setFavorites(new Set(preferences.favorites || [])); setProgress(preferences.progress || {}); setSelectedId((current) => current && rows.some((item) => item.id === current) ? current : rows[0]?.id || null); } catch (error) { setLoadError(error.response?.data?.error || 'Não foi possível carregar a biblioteca operacional.'); } finally { setLoading(false); } }, [api]);
  useEffect(() => { loadData(); }, [loadData]);
  const savePreferences = useCallback(async (nextFavorites, nextProgress) => {
    try {
      await api.put(`/user/preferences/${PREFERENCES_KEY}`, { value: { favorites: [...nextFavorites], progress: nextProgress } });
    } catch {
      showToast?.('A preferência ficou salva apenas nesta sessão.', 'warning');
    }
  }, [api, showToast]);
  const categories = useMemo(() => ['Todos', ...new Set(procedures.map((item) => item.category).filter(Boolean))], [procedures]);
  const filtered = useMemo(() => procedures.filter((item) => category === 'Todos' || item.category === category).filter((item) => `${item.title} ${item.trigger} ${item.objective}`.toLowerCase().includes(search.toLowerCase())), [category, procedures, search]);
  const suggestedId = useMemo(() => procedures.find((procedure) => procedure.alertTypes?.some((type) => notificacoes.some((item) => String(item.tipo_alerta || '').toUpperCase() === type)))?.id, [notificacoes, procedures]);
  const selected = procedures.find((item) => item.id === selectedId) || procedures[0] || null;
  /**
   * Processa a interacao de toggle step e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {number} index - Posição do item dentro da coleção atual.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const toggleStep = (index) => {
    if (!selected) return;
    const completed = new Set(progress[selected.id] || []);
    if (completed.has(index)) completed.delete(index); else completed.add(index);
    const nextProgress = { ...progress, [selected.id]: [...completed] };
    setProgress(nextProgress);
    savePreferences(favorites, nextProgress);
  };

  /**
   * Alterna um favorito e salva a escolha pessoal.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {string|number} id - Identificador do registro ou recurso processado.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const toggleFavorite = (id) => {
    const nextFavorites = new Set(favorites);
    if (nextFavorites.has(id)) nextFavorites.delete(id); else nextFavorites.add(id);
    setFavorites(nextFavorites);
    savePreferences(nextFavorites, progress);
  };

  /**
   * Copia o procedimento aberto para a área de transferência.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copyChecklist = async () => {
    if (!selected) return;
    try { await navigator.clipboard.writeText(buildChecklistText(selected)); showToast?.('Checklist copiado.', 'success'); }
    catch { showToast?.('Não foi possível copiar o checklist.', 'error'); }
  };

  /**
   * Abre o módulo relacionado respeitando as permissões do perfil.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const openRelatedModule = () => {
    if (!selected) return;
     /**
      * Concentra a logica de fallback para manter o restante do tela mais legivel.
      *
      * Responsabilidade: mantém este comportamento isolado para que validação,
      * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
      *
      * Fluxo principal:
      * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
      *
      * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
      *
      * @returns {unknown} Resultado calculado para consumo do chamador.
      * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
      */

    /**
     * Concentra a logica de fallback para manter o restante do tela mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @returns {unknown} Resultado calculado para consumo do chamador.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const fallback = (selected.route === 'hardware' && userRole !== 'DEV') || (selected.route === 'metrologia' && userRole === 'LOJA');
    onNavigate?.(fallback ? 'dashboard' : selected.route);
  };

  if (loading) return <div className="procedures-page"><div className="procedures-empty"><LoaderCircle className="spin" size={26} /> Carregando procedimentos do banco...</div></div>;
  if (loadError || !selected) return <div className="procedures-page"><div className="procedures-empty"><AlertTriangle size={28} /><strong>{loadError || 'Nenhum procedimento ativo foi cadastrado.'}</strong><button type="button" onClick={loadData}><RefreshCw size={15} /> Tentar novamente</button></div></div>;

  const selectedProgress = new Set(progress[selected.id] || []);
  const completion = selected.steps.length ? Math.round((selectedProgress.size / selected.steps.length) * 100) : 0;
  const relatedAlerts = notificacoes.filter((item) => selected.alertTypes.includes(String(item.tipo_alerta || '').toUpperCase())).length;
  const SelectedIcon = ICONS[selected.icon] || Wrench;

  return (
    <div className="procedures-page">
      <header className="procedures-header">
        <div className="procedures-heading"><span><BookOpen size={22} /></span><div><small>Base operacional</small><h2>Central de Procedimentos</h2><p>Resposta guiada, evidências e critérios de escalonamento para cada ocorrência.</p></div></div>
        <div className="procedures-header-status"><span><HeartPulse size={15} /> {notificacoes.length} alerta(s) ativo(s)</span><strong>{procedures.length} procedimentos</strong></div>
      </header>
      <section className="procedures-overview">
        <div><ShieldAlert size={17} /><span><small>Resposta crítica</small><strong>{procedures.filter((item) => item.severity === 'Crítica').length} protocolos</strong></span></div>
        <div><Clock size={17} /><span><small>Menor SLA</small><strong>{procedures.find((item) => item.sla === 'Resposta imediata')?.sla || procedures[0].sla}</strong></span></div>
        <div><Wrench size={17} /><span><small>Contexto</small><strong>{userRole}</strong></span></div>
        <div className={relatedAlerts ? 'has-alert' : ''}><AlertTriangle size={17} /><span><small>Alertas relacionados</small><strong>{relatedAlerts} no procedimento aberto</strong></span></div>
      </section>

      <div className="procedures-workspace">
        <aside className="procedures-library">
          <div className="procedures-library-title"><div><Clipboard size={17} /><span>Biblioteca</span></div><small>{filtered.length} resultado(s)</small></div>
          <label className="procedures-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar procedimento ou cenário" /></label>
          <div className="procedures-filters"><Filter size={14} />{categories.map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <div className="procedures-list">
            {filtered.map((procedure) => {
              const Icon = ICONS[procedure.icon] || Wrench;
              const activeAlert = procedure.alertTypes.some((type) => notificacoes.some((item) => String(item.tipo_alerta || '').toUpperCase() === type));
              return <button type="button" key={procedure.id} className={`${selected.id === procedure.id ? 'selected' : ''} severity-${procedure.severity.toLowerCase().replace('í', 'i')}`} onClick={() => setSelectedId(procedure.id)}><span className="procedure-list-icon"><Icon size={17} /></span><span><strong>{procedure.title}</strong><small>{procedure.category} · {procedure.sla}</small></span>{activeAlert ? <em>{procedure.id === suggestedId ? 'Sugerido' : 'Ativo'}</em> : <ArrowRight size={15} />}</button>;
            })}
            {!filtered.length && <div className="procedures-empty">Nenhum procedimento corresponde aos filtros.</div>}
          </div>
        </aside>

        <main className="procedure-detail">
          <div className="procedure-detail-header">
            <div className={`procedure-detail-icon severity-${selected.severity.toLowerCase().replace('í', 'i')}`}><SelectedIcon size={25} /></div>
            <div><span>{selected.category}</span><h3>{selected.title}</h3><p>{selected.role} · {selected.sla}</p></div>
            <button type="button" title={favorites.has(selected.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} className={favorites.has(selected.id) ? 'favorite' : ''} onClick={() => toggleFavorite(selected.id)}>★</button>
          </div>
          <section className="procedure-context-grid"><div><small>Quando aplicar</small><p>{selected.trigger}</p></div><div><small>Objetivo</small><p>{selected.objective}</p></div></section>
          <section className="procedure-execution">
            <div className="procedure-section-title"><div><CheckCircle2 size={17} /><span>Execução guiada</span></div><small>{completion}% concluído</small></div>
            <div className="procedure-progress"><i style={{ width: `${completion}%` }} /></div>
            <ol>{selected.steps.map((step, index) => <li key={step} className={selectedProgress.has(index) ? 'done' : ''}><button type="button" onClick={() => toggleStep(index)}>{selectedProgress.has(index) ? <Check size={15} /> : <span>{index + 1}</span>}</button><p>{step}</p></li>)}</ol>
          </section>
          <div className="procedure-lower-grid">
            <section className="procedure-evidence"><div className="procedure-section-title"><div><Clipboard size={16} /><span>Evidências mínimas</span></div></div><ul>{selected.evidence.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section className="procedure-escalation"><div className="procedure-section-title"><div><AlertTriangle size={16} /><span>Critério de escalonamento</span></div></div><p>{selected.escalation}</p></section>
          </div>
          <footer className="procedure-actions">
            <button type="button" title="Imprimir procedimento" onClick={() => window.print()}><Printer size={16} /><span>Imprimir</span></button>
            <button type="button" onClick={copyChecklist}><Clipboard size={16} /><span>Copiar checklist</span></button>
            <button type="button" className="primary" onClick={openRelatedModule}>{selected.route === 'chamados' ? 'Abrir ocorrência' : 'Ir para monitoramento'}<ArrowRight size={16} /></button>
          </footer>
          {userRole === 'LOJA' && selected.route === 'hardware' && <div className="procedure-access-note"><Lock size={14} /> Controles técnicos permanecem protegidos; a consulta de estado respeita seu perfil.</div>}
        </main>
      </div>
    </div>
  );
}
