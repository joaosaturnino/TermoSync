/**
 * Módulo: frontend/src/pages/GestaoEmpresas/GestaoEmpresas.jsx
 * Responsabilidade: Implementa a tela Gestao Empresas, seus estados, interações e integrações de dados.
 */

import { AlertTriangle, ArrowUpDown, BellRing, CalendarDays, Check, CheckCircle2, ChevronRight, Copy, Edit3, Globe2, Network, Plus, RadioTower, Store, Users, Wifi } from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2, X, Save, Phone, Mail, RefreshCw,
  Search, Briefcase,
  ShieldAlert, Loader2,
  DownloadCloud, Activity
} from 'lucide-react';
import './GestaoEmpresas.css';

const EMPTY_FORM = { id: null, nome: '', cnpj: '', contato: '', email: '', status: 'Ativa' };

/**
 * Normaliza normalize para evitar divergencia de formato nas comparacoes.
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
function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}


/**
 * Formata format date para exibicao segura na interface.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @param {unknown} fallback - Valor de fallback consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function formatDate(value, fallback = 'Sem atividade') {
  if (!value) return fallback;
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}


/**
 * Concentra a logica de mask cnpj para manter o restante do tela mais legivel.
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
function maskCNPJ(value) {
  return String(value || '').replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').slice(0, 18);
}


/**
 * Concentra a logica de csv cell para manter o restante do tela mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function csvCell(value) {
  let safe = String(value ?? '').replaceAll('"', '""');
  if (/^[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe}"`;
}


/**
 * Busca ou monta os dados de get completeness usados no fluxo atual.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} organization - Valor de organization consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function getCompleteness(organization) {
  const checks = [organization.nome, organization.cnpj, organization.contato, organization.email];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/**
 * Centraliza cadastro, estrutura e atividade das organizações multi-tenant.
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
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador; troca eventos em tempo real
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function GestaoEmpresas({ api, socket, showToast, setModalConfig }) { const [organizations, setOrganizations] = useState([]); const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState('Todas'); const [sortMode, setSortMode] = useState('name'); const [selectedId, setSelectedId] = useState(null); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [saving, setSaving] = useState(false); const [exporting, setExporting] = useState(false); const [modalOpen, setModalOpen] = useState(false); const [form, setForm] = useState(EMPTY_FORM); const [lastUpdated, setLastUpdated] = useState(null); const [copied, setCopied] = useState(false); /* Carrega cadastro e indicadores correlacionados em uma única chamada. */ const loadOrganizations = useCallback(async (silent = false) => { if (silent) setRefreshing(true); else setLoading(true); try { const response = await api.get('/empresas/overview'); const next = Array.isArray(response.data?.organizations) ? response.data.organizations : []; setOrganizations(next); setSelectedId((current) => next.some((item) => item.id === current) ? current : next[0]?.id ?? null); setLastUpdated(new Date(response.data?.generatedAt || Date.now())); } catch (error) { showToast(error.response?.data?.error || 'Falha ao carregar as organizações.', 'error'); } finally { setLoading(false); setRefreshing(false); } }, [api, showToast]);
  useEffect(() => { loadOrganizations(); }, [loadOrganizations]);
  useEffect(() => {
    if (!socket) return undefined;
    /**
     * Concentra a logica de refresh para manter o restante do tela mais legivel.
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
    const refresh = () => loadOrganizations(true);
    socket.on('atualizacao_dados', refresh);
    return () => socket.off('atualizacao_dados', refresh);
  }, [loadOrganizations, socket]);

  const filteredOrganizations = useMemo(() => organizations
    .filter((item) => statusFilter === 'Todas' || item.status === statusFilter)
    .filter((item) => normalize([item.nome, item.cnpj, item.contato, item.email].join(' ')).includes(normalize(search)))
    .sort((left, right) => {
      if (sortMode === 'alerts') return Number(right.openAlerts || 0) - Number(left.openAlerts || 0);
      if (sortMode === 'sessions') return Number(right.activeSessions || 0) - Number(left.activeSessions || 0);
      if (sortMode === 'branches') return Number(right.branchesTotal || 0) - Number(left.branchesTotal || 0);
      if (sortMode === 'recent') return new Date(right.data_cadastro || 0) - new Date(left.data_cadastro || 0);
      return String(left.nome || '').localeCompare(String(right.nome || ''), 'pt-BR');
    }), [organizations, search, sortMode, statusFilter]);
  const selected = organizations.find((item) => item.id === selectedId) || null;
  const summary = useMemo(() => organizations.reduce((totals, item) => ({
    total: totals.total + 1,
    active: totals.active + (item.status === 'Ativa' ? 1 : 0),
    restricted: totals.restricted + (item.status === 'Ativa' ? 0 : 1),
    branches: totals.branches + Number(item.branchesTotal || 0),
    activeBranches: totals.activeBranches + Number(item.branchesActive || 0),
    users: totals.users + Number(item.usersTotal || 0),
    sessions: totals.sessions + Number(item.activeSessions || 0),
    equipment: totals.equipment + Number(item.equipmentTotal || 0),
    alerts: totals.alerts + Number(item.openAlerts || 0)
  }), { total: 0, active: 0, restricted: 0, branches: 0, activeBranches: 0, users: 0, sessions: 0, equipment: 0, alerts: 0 }), [organizations]);
  const activeShare = summary.total ? Math.round((summary.active / summary.total) * 100) : 0;
  const branchShare = summary.branches ? Math.round((summary.activeBranches / summary.branches) * 100) : 0;
  const completeShare = summary.total ? Math.round((organizations.filter((item) => getCompleteness(item) === 100).length / summary.total) * 100) : 0;
  /**
   * Concentra a logica de open form para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} organization - Valor de organization consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const openForm = (organization = null) => {
    setForm(organization ? {
      id: organization.id,
      nome: organization.nome || '',
      cnpj: organization.cnpj || '',
      contato: organization.contato || '',
      email: organization.email || '',
      status: organization.status || 'Ativa'
    } : { ...EMPTY_FORM });
    setModalOpen(true);
  };

  /**
   * Persiste criação ou edição com o mesmo contrato de dados do backend.
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
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const saveOrganization = async (event) => {
    event.preventDefault();
    if (!form.nome.trim()) return showToast('A designação da organização é obrigatória.', 'error');
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      cnpj: form.cnpj.trim() || null,
      contato: form.contato.trim() || null,
      email: form.email.trim() || null,
      status: form.status
    };
    try {
      if (form.id) await api.put(`/empresas/${form.id}`, payload);
      else await api.post('/empresas', payload);
      showToast(form.id ? 'Organização atualizada.' : 'Organização provisionada.', 'success');
      setModalOpen(false);
      setForm({ ...EMPTY_FORM });
      await loadOrganizations(true);
    } catch (error) {
      showToast(error.response?.data?.error || 'Falha ao salvar a organização.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Exige confirmação para restringir ou reativar o tenant selecionado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {unknown} organization - Valor de organization consumido por esta rotina.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const requestStatusChange = (organization) => {
    const nextStatus = organization.status === 'Ativa' ? 'Suspensa' : 'Ativa';
    setModalConfig({
      isOpen: true,
      title: nextStatus === 'Ativa' ? 'Reativar organização' : 'Suspender organização',
      message: nextStatus === 'Ativa'
        ? `${organization.nome} voltará ao estado operacional.`
        : `${organization.nome} será marcada como suspensa. Os dados serão preservados.`,
      onConfirm: async () => {
        try {
          await api.put(`/empresas/${organization.id}`, { ...organization, status: nextStatus });
          showToast(`Organização ${nextStatus === 'Ativa' ? 'reativada' : 'suspensa'}.`, nextStatus === 'Ativa' ? 'success' : 'warning');
          await loadOrganizations(true);
        } catch (error) {
          showToast(error.response?.data?.error || 'Falha ao alterar o status.', 'error');
        }
      }
    });
  };

  /**
   * Exporta apenas o recorte atual e neutraliza fórmulas em células CSV.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
   *
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const exportCsv = () => {
    if (!filteredOrganizations.length) return showToast('Não há organizações para exportar.', 'warning');
    setExporting(true);
    const header = ['ID', 'Organização', 'CNPJ', 'Contato', 'Email', 'Status', 'Filiais', 'Usuários', 'Sessões', 'Equipamentos', 'Alertas'];
    const rows = filteredOrganizations.map((item) => [item.id, item.nome, item.cnpj, item.contato, item.email, item.status, item.branchesTotal, item.usersTotal, item.activeSessions, item.equipmentTotal, item.openAlerts]);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `organizacoes-termosync-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    showToast('Portfólio exportado.', 'success');
  };


  /**
   * Processa a interacao de copy summary e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
   *
   * @param {unknown} organization - Valor de organization consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copySummary = async (organization) => {
    try {
      await navigator.clipboard.writeText(`${organization.nome}\nCNPJ: ${organization.cnpj || 'Não informado'}\nStatus: ${organization.status}\nFiliais: ${organization.branchesTotal}\nUsuários: ${organization.usersTotal}\nEquipamentos: ${organization.equipmentTotal}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      showToast('Resumo da organização copiado.', 'success');
    } catch {
      showToast('Não foi possível copiar o resumo.', 'error');
    }
  };

  return (
    <section className="org-page anim-fade-in" aria-labelledby="org-page-title">
      <header className="org-header">
        <div><span className="org-eyebrow"><Globe2 size={14} /> Portfólio multi-tenant</span><h2 id="org-page-title">Organizações</h2><p>Estrutura, identidade, atividade e governança dos clientes corporativos.</p></div>
        <div className="org-header-actions"><small>{lastUpdated ? `Atualizado às ${lastUpdated.toLocaleTimeString('pt-BR')}` : 'Sincronizando...'}</small><button type="button" title="Atualizar organizações" onClick={() => loadOrganizations(true)} disabled={refreshing}>{refreshing ? <Loader2 size={17} className="spin" /> : <RefreshCw size={17} />}</button><button type="button" onClick={exportCsv} disabled={exporting}>{exporting ? <Loader2 size={16} className="spin" /> : <DownloadCloud size={16} />}<span>Exportar</span></button><button type="button" className="is-primary" onClick={() => openForm()}><Plus size={17} /><span>Nova organização</span></button></div>
      </header>

      <div className="org-kpi-grid">
        <article className="is-portfolio"><span><Building2 size={15} /> Portfólio</span><strong>{summary.total}</strong><small>{activeShare}% em operação</small></article>
        <article className="is-branches"><span><Store size={15} /> Filiais</span><strong>{summary.branches}</strong><small>{summary.activeBranches} ativas · {branchShare}% disponível</small></article>
        <article className="is-users"><span><Users size={15} /> Identidades</span><strong>{summary.users}</strong><small>{summary.sessions} sessões conectadas</small></article>
        <article className={summary.alerts ? 'is-alerts' : 'is-healthy'}><span><BellRing size={15} /> Atenção operacional</span><strong>{summary.alerts}</strong><small>{summary.equipment} ativos vinculados</small></article>
      </div>

      <div className="org-workspace">
        <main className="org-directory">
          <div className="org-toolbar">
            <label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar organização, CNPJ, contato ou e-mail" />{search && <button type="button" title="Limpar busca" onClick={() => setSearch('')}><X size={14} /></button>}</label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por status"><option value="Todas">Todos os status</option><option value="Ativa">Ativas</option><option value="Suspensa">Suspensas</option><option value="Bloqueada">Bloqueadas</option></select>
            <div><select value={sortMode} onChange={(event) => setSortMode(event.target.value)} aria-label="Ordenar organizações"><option value="name">Nome</option><option value="alerts">Mais alertas</option><option value="sessions">Mais sessões</option><option value="branches">Mais filiais</option><option value="recent">Mais recentes</option></select><ArrowUpDown size={14} /></div>
          </div>

          <div className="org-list-header"><span>Organização</span><span>Estrutura</span><span>Atividade</span><span>Status</span><span /></div>
          <div className="org-list">
            {loading ? <div className="org-empty"><Loader2 size={25} className="spin" /><strong>Carregando portfólio</strong></div> : !filteredOrganizations.length ? <div className="org-empty"><Globe2 size={28} /><strong>Nenhuma organização encontrada</strong><span>Revise a busca ou os filtros selecionados.</span></div> : filteredOrganizations.map((organization) => {
              const completeness = getCompleteness(organization);
              const attention = organization.openAlerts + organization.usersBlocked + Math.max(0, organization.branchesTotal - organization.branchesActive);
              return <button type="button" className={`org-row ${selectedId === organization.id ? 'selected' : ''}`} key={organization.id} onClick={() => setSelectedId(organization.id)}>
                <span className="org-row-identity"><i>{String(organization.nome || '?').slice(0, 2).toUpperCase()}</i><span><strong>{organization.nome}</strong><small>{organization.cnpj || 'Documento não informado'} · cadastro {formatDate(organization.data_cadastro, '--')}</small></span></span>
                <span className="org-row-structure"><strong>{organization.branchesTotal} filiais</strong><small>{organization.usersTotal} usuários · {organization.equipmentTotal} ativos</small></span>
                <span className="org-row-activity"><strong className={attention ? 'is-warning' : ''}>{attention ? `${attention} pendência(s)` : 'Normal'}</strong><small>{organization.activeSessions} sessões · {completeness}% cadastrado</small></span>
                <span className={`org-status is-${normalize(organization.status)}`}>{organization.status}</span>
                <ChevronRight size={17} />
              </button>;
            })}
          </div>
        </main>

        <aside className="org-inspector">
          {selected ? <>
            <div className="org-inspector-head"><span className={`org-inspector-avatar is-${normalize(selected.status)}`}>{String(selected.nome || '?').slice(0, 2).toUpperCase()}</span><div><span>Organização #{String(selected.id).padStart(4, '0')}</span><h3>{selected.nome}</h3><small className={`org-status is-${normalize(selected.status)}`}>{selected.status}</small></div><button type="button" title="Editar organização" onClick={() => openForm(selected)}><Edit3 size={16} /></button></div>
            <div className="org-readiness"><div><span>Completude cadastral</span><strong>{getCompleteness(selected)}%</strong></div><i><em style={{ width: `${getCompleteness(selected)}%` }} /></i></div>
            <dl className="org-contact-list"><div><dt><Briefcase size={14} /> Documento</dt><dd>{selected.cnpj || 'Não informado'}</dd></div><div><dt><Mail size={14} /> E-mail</dt><dd>{selected.email || 'Não informado'}</dd></div><div><dt><Phone size={14} /> Contato</dt><dd>{selected.contato || 'Não informado'}</dd></div><div><dt><CalendarDays size={14} /> Criada em</dt><dd>{formatDate(selected.data_cadastro, 'Não informado')}</dd></div></dl>
            <div className="org-inspector-metrics"><div><Store size={15} /><span>Filiais<strong>{selected.branchesActive}/{selected.branchesTotal}</strong></span></div><div><Users size={15} /><span>Usuários<strong>{selected.usersTotal}</strong></span></div><div><Wifi size={15} /><span>Sessões<strong>{selected.activeSessions}</strong></span></div><div><RadioTower size={15} /><span>Equipamentos<strong>{selected.equipmentTotal}</strong></span></div></div>
            <section className="org-operational-state"><div><Activity size={15} /><span>Última telemetria</span><strong>{formatDate(selected.lastTelemetryAt)}</strong></div><div className={selected.openAlerts ? 'is-warning' : 'is-ok'}>{selected.openAlerts ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}<span>Alertas abertos</span><strong>{selected.openAlerts}</strong></div><div className={selected.usersBlocked ? 'is-warning' : 'is-ok'}>{selected.usersBlocked ? <ShieldAlert size={15} /> : <CheckCircle2 size={15} />}<span>Identidades bloqueadas</span><strong>{selected.usersBlocked}</strong></div></section>
            <footer className="org-inspector-actions"><button type="button" onClick={() => copySummary(selected)}>{copied ? <Check size={15} /> : <Copy size={15} />} Copiar resumo</button><button type="button" className={selected.status === 'Ativa' ? 'is-danger' : 'is-primary'} onClick={() => requestStatusChange(selected)}>{selected.status === 'Ativa' ? 'Suspender' : 'Reativar'}</button></footer>
          </> : <div className="org-empty"><Network size={28} /><strong>Selecione uma organização</strong></div>}
        </aside>
      </div>

      <section className="org-intelligence-grid">
        <article><div className="org-section-title"><div><Activity size={16} /><span>Saúde do portfólio</span></div><small>{summary.total} organizações</small></div><div className="org-distribution"><i className="is-active" style={{ width: `${activeShare}%` }} /><i className="is-restricted" style={{ width: `${100 - activeShare}%` }} /></div><div className="org-legend"><span><i className="is-active" />Ativas <b>{summary.active}</b></span><span><i className="is-restricted" />Restritas <b>{summary.restricted}</b></span></div></article>
        <article><div className="org-section-title"><div><Store size={16} /><span>Cobertura operacional</span></div><small>{branchShare}% disponível</small></div><strong className="org-big-number">{summary.activeBranches}<small> / {summary.branches} filiais</small></strong><p>Filiais em estado ativo dentro do portfólio.</p></article>
        <article><div className="org-section-title"><div><CheckCircle2 size={16} /><span>Qualidade cadastral</span></div><small>{completeShare}% completo</small></div><strong className="org-big-number">{summary.complete}<small> cadastros completos</small></strong><p>Organizações com documento, contato e e-mail preenchidos.</p></article>
      </section>

      {modalOpen && <div className="org-modal-overlay" onClick={() => !saving && setModalOpen(false)}><section className="org-modal" onClick={(event) => event.stopPropagation()}><header><div><span>{form.id ? `Organização #${String(form.id).padStart(4, '0')}` : 'Provisionamento manual'}</span><h3>{form.id ? 'Editar organização' : 'Nova organização'}</h3></div><button type="button" title="Fechar" onClick={() => setModalOpen(false)} disabled={saving}><X size={19} /></button></header><form onSubmit={saveOrganization}><div className="org-form-section"><div className="org-section-title"><div><Building2 size={16} /><span>Identidade corporativa</span></div><small>Campos principais</small></div><label>Nome da organização<input required autoFocus value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Razão social ou nome do grupo" /></label><label>CNPJ / identificação fiscal<input value={form.cnpj} onChange={(event) => setForm((current) => ({ ...current, cnpj: maskCNPJ(event.target.value) }))} placeholder="00.000.000/0000-00" maxLength={18} /></label></div><div className="org-form-section"><div className="org-section-title"><div><Mail size={16} /><span>Contato administrativo</span></div><small>Canal de serviço</small></div><label>E-mail corporativo<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="administracao@empresa.com.br" /></label><label>Contato / telefone<input value={form.contato} onChange={(event) => setForm((current) => ({ ...current, contato: event.target.value }))} placeholder="Responsável ou telefone" /></label></div><fieldset><legend>Status operacional</legend>{['Ativa', 'Suspensa', 'Bloqueada'].map((status) => <label key={status} className={form.status === status ? 'selected' : ''}><input type="radio" name="status" value={status} checked={form.status === status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} /><span>{status}</span></label>)}</fieldset><footer><button type="button" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button><button type="submit" className="is-primary" disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}{saving ? 'Salvando...' : 'Salvar organização'}</button></footer></form></section></div>}
    </section>
  );
}
