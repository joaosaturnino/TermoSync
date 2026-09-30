/**
 * Módulo: frontend/src/pages/AprovacoesSaaS/AprovacoesSaaS.jsx
 * Responsabilidade: Implementa a tela Aprovacoes Saa S, seus estados, interações e integrações de dados.
 */

import { Activity, AlertTriangle, ArrowUpDown, Ban, BellRing, CalendarClock, CalendarPlus, CheckCircle2, ClipboardCheck, Clock3, CreditCard, Database, ExternalLink, Gauge, History, Hourglass, KeyRound, Link2, MessageSquareText, Pause, Phone, Play, Plus, RotateCcw, Rocket, Save, SearchCheck, Trash2, UserCheck, UserRound } from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, Mail, Loader2,
  Send, Search,
  Copy, Check, Eye, X, RefreshCw
} from 'lucide-react';
import '../Suporte/SuporteTelas.css';
import './AprovacoesSaaS.css';

const EMPTY_OVERVIEW = {
  requests: [],
  trials: [],
  trialProfiles: [],
  summary: {
    total: 0, pending: 0, approved: 0, rejected: 0, overdue: 0,
    receivedLast7Days: 0, approvalRate: 0, activeTenants: 0,
    activeTrials: 0, expiringTrials: 0, expiredTrials: 0,
    engagedTrials: 0, neverAccessedTrials: 0, manualReviewTrials: 0, trialAccounts: 0,
    engagedTrialAccounts: 0, neverAccessedAccounts: 0, blockedTrialAccounts: 0,
    oldestPendingAt: null, smtpReady: false, convertedTrials90d: 0, conversionRate90d: 0
  }
};

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

const STATUS_META = {
  pendente: { label: 'Pendente', icon: Hourglass },
  aprovado: { label: 'Aprovado', icon: CheckCircle2 },
  rejeitado: { label: 'Rejeitado', icon: AlertTriangle }
};

const TRIAL_STAGE_META = {
  NEW: { label: 'Novo', tone: 'neutral' },
  EVALUATION: { label: 'Em avaliação', tone: 'info' },
  ENGAGED: { label: 'Engajado', tone: 'success' },
  NEGOTIATION: { label: 'Negociação', tone: 'warning' },
  NO_RESPONSE: { label: 'Sem retorno', tone: 'warning' },
  PAUSED: { label: 'Pausado', tone: 'danger' },
  LOST: { label: 'Descartado', tone: 'danger' },
  WON: { label: 'Convertido', tone: 'success' }
};

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

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
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function formatDate(value) {
  if (!value) return 'Não informado';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}


/**
 * Busca ou monta os dados de get age usados no fluxo atual.
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
function getAge(value) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const hours = Math.floor(elapsed / 3600000);
  if (hours < 1) return `${Math.max(1, Math.floor(elapsed / 60000))} min`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/**
 * Central DEV para validar, provisionar e acompanhar solicitações SaaS.
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
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.socket - Propriedade socket usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.setModalConfig - Propriedade setModalConfig usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function AprovacoesSaaS({ showToast, isOffline, api, socket, setModalConfig }) { const [overview, setOverview] = useState(EMPTY_OVERVIEW); const [loading, setLoading] = useState(true); const [processingId, setProcessingId] = useState(null); const [searchTerm, setSearchTerm] = useState(''); const [statusFilter, setStatusFilter] = useState('pendente'); const [requestTypeFilter, setRequestTypeFilter] = useState('TRIAL'); const [sortMode, setSortMode] = useState('oldest'); const [selectedRequest, setSelectedRequest] = useState(null); const [manualOpen, setManualOpen] = useState(false); const [manualSubmitting, setManualSubmitting] = useState(false); const [provisionResult, setProvisionResult] = useState(null); const [credentialResult, setCredentialResult] = useState(null); const [copiedKey, setCopiedKey] = useState(''); const [approvalTarget, setApprovalTarget] = useState(null); const [approvalForm, setApprovalForm] = useState({ accessType: 'TRIAL', trialDays: 14, autoBlock: true, warningDays: 3, plan: 'PRO', monthlyValue: 299.9, firstDueDate: defaultDueDate() }); const [trialBusy, setTrialBusy] = useState(''); const [conversionTarget, setConversionTarget] = useState(null); const [conversionForm, setConversionForm] = useState({ plan: 'PRO', monthlyValue: 299.9, firstDueDate: defaultDueDate() }); const [manualForm, setManualForm] = useState({ empresa: '', cnpj: '', responsavel: '', email: '', telefone: '', tipoAcesso: 'TRIAL' }); const [trialSearch, setTrialSearch] = useState(''); const [trialFilter, setTrialFilter] = useState('all'); const [trialDetail, setTrialDetail] = useState(null); const [trialHistory, setTrialHistory] = useState([]); const [historyLoading, setHistoryLoading] = useState(false); const [trialSchedule, setTrialSchedule] = useState({ expiresOn: '', warningDays: 3, autoBlock: true }); const [trialLimits, setTrialLimits] = useState({ maxUsers: 3, maxStores: 1, maxEquipment: 10, retentionDays: 30 }); const [trialNote, setTrialNote] = useState({ stage: 'NEW', note: '' }); /* Atualiza indicadores e histórico em uma única consulta consistente. */ const loadOverview = useCallback(async (silent = false) => { if (!silent) setLoading(true); try { const response = await api.get('/pre-cadastros/overview'); const nextOverview = { ...EMPTY_OVERVIEW, ...response.data, summary: { ...EMPTY_OVERVIEW.summary, ...response.data?.summary }, trials: Array.isArray(response.data?.trials) ? response.data.trials : [], trialProfiles: Array.isArray(response.data?.trialProfiles) ? response.data.trialProfiles : [] }; setOverview(nextOverview); return nextOverview; } catch (error) { if (!silent) showToast?.(error.response?.data?.error || 'Falha ao carregar o onboarding SaaS.', 'error'); return null; } finally { if (!silent) setLoading(false); } }, [api, showToast]);
  useEffect(() => { loadOverview(); }, [loadOverview]);
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
    const refresh = () => loadOverview(true);
    socket.on('atualizacao_dados', refresh);
    return () => socket.off('atualizacao_dados', refresh);
  }, [loadOverview, socket]);

  /**
   * Concentra a logica de approve request para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {import("express").Request} request - Requisição HTTP com parâmetros, corpo e contexto de autenticação.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const approveRequest = async (request) => {
    setProcessingId(request.id);
    try {
      // Envia apenas os parâmetros permitidos para a origem da solicitação.
      // O backend repete essa validação usando `tipo_acesso` persistido.
      const approvalPayload = approvalForm.accessType === 'TRIAL'
        ? { trialDays: approvalForm.trialDays, autoBlock: approvalForm.autoBlock, warningDays: approvalForm.warningDays }
        : { plan: approvalForm.plan, monthlyValue: approvalForm.monthlyValue, firstDueDate: approvalForm.firstDueDate };
      const response = await api.post(`/pre-cadastros/${request.id}/aprovar`, approvalPayload);
      setProvisionResult({ ...response.data, request });
      setSelectedRequest(null);
      setApprovalTarget(null);
      showToast?.('Tenant provisionado com sucesso.', 'success');
      await loadOverview(true);
    } catch (error) {
      showToast?.(error.response?.data?.error || 'Falha ao provisionar o tenant.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const summary = overview.summary || EMPTY_OVERVIEW.summary;
  const requests = useMemo(() => Array.isArray(overview.requests) ? overview.requests : [], [overview.requests]);
  const requestTypeCounts = useMemo(() => requests.reduce((counts, request) => {
    const type = request.tipo_acesso === 'COMERCIAL' ? 'COMERCIAL' : 'TRIAL';
    counts[type] += 1;
    return counts;
  }, { TRIAL: 0, COMERCIAL: 0 }), [requests]);
  const trials = useMemo(() => Array.isArray(overview.trials) ? overview.trials : [], [overview.trials]);
  const trialProfiles = useMemo(() => Array.isArray(overview.trialProfiles) ? overview.trialProfiles : [], [overview.trialProfiles]);
  const filteredTrials = useMemo(() => trialProfiles
    .filter((profile) => normalize([profile.account_user, profile.account_email, profile.account_role, profile.account_filial, profile.empresa].join(' ')).includes(normalize(trialSearch)))
    .filter((profile) => {
      if (trialFilter === 'active') return profile.status === 'Ativa' && !profile.account_blocked && (profile.days_remaining == null || profile.days_remaining >= 0);
      if (trialFilter === 'expiring') return profile.days_remaining != null && profile.days_remaining >= 0 && profile.days_remaining <= profile.trial_warning_days;
      if (trialFilter === 'expired') return profile.days_remaining != null && profile.days_remaining < 0;
      if (trialFilter === 'blocked') return profile.status !== 'Ativa' || profile.account_blocked;
      if (trialFilter === 'never-accessed') return profile.account_session_count === 0;
      return true;
    }), [trialFilter, trialProfiles, trialSearch]);
  const filteredRequests = useMemo(() => requests
    .filter((request) => requestTypeFilter === 'TODOS' || request.tipo_acesso === requestTypeFilter)
    .filter((request) => statusFilter === 'todos' || request.status === statusFilter)
    .filter((request) => normalize([request.empresa, request.cnpj, request.responsavel, request.email].join(' ')).includes(normalize(searchTerm)))
    .sort((left, right) => {
      if (sortMode === 'quality') return Number(left.qualityScore || 0) - Number(right.qualityScore || 0);
      const direction = sortMode === 'newest' ? -1 : 1;
      return direction * (new Date(left.data_solicitacao).getTime() - new Date(right.data_solicitacao).getTime());
    }), [requestTypeFilter, requests, searchTerm, sortMode, statusFilter]);
  const selectedLive = requests.find((request) => request.id === selectedRequest?.id) || selectedRequest;
  const approvedShare = summary.total ? (summary.approved / summary.total) * 100 : 0;
  const pendingShare = summary.total ? (summary.pending / summary.total) * 100 : 0;
  const rejectedShare = summary.total ? (summary.rejected / summary.total) * 100 : 0;

  const loadTrialHistory = useCallback(async (empresa, silent = false) => {
    if (!silent) setHistoryLoading(true);
    try {
      const response = await api.get(`/saas/trials/${encodeURIComponent(empresa)}/history`);
      setTrialHistory(Array.isArray(response.data?.events) ? response.data.events : []);
    } catch (error) {
      setTrialHistory([]);
      if (!silent) showToast?.(error.response?.data?.error || 'Falha ao carregar o histórico do trial.', 'error');
    } finally {
      if (!silent) setHistoryLoading(false);
    }
  }, [api, showToast]);

  const openTrialDetail = (trial) => {
    setTrialDetail(trial);
    setTrialSchedule({
      expiresOn: toDateInput(trial.trial_expires_at),
      warningDays: trial.trial_warning_days || 3,
      autoBlock: Boolean(trial.trial_auto_block)
    });
    setTrialNote({ stage: trial.trial_stage || 'NEW', note: '' });
    setTrialLimits({ maxUsers: trial.trial_max_users || 3, maxStores: trial.trial_max_stores || 1, maxEquipment: trial.trial_max_equipment || 10, retentionDays: 30 });
    loadTrialHistory(trial.empresa);
  };

  const manageTrial = async (trial, payload, successMessage) => {
    if (isOffline) return showToast?.('Ação bloqueada enquanto o sistema está offline.', 'error');
    setTrialBusy(trial.empresa);
    try {
      await api.patch(`/saas/trials/${encodeURIComponent(trial.empresa)}`, payload);
      showToast?.(successMessage, 'success');
      setConversionTarget(null);
      const refreshed = await loadOverview(true);
      if (payload.action === 'convert') setTrialDetail(null);
      else if (trialDetail?.empresa === trial.empresa) {
        const refreshedProfile = refreshed?.trialProfiles?.find((profile) => profile.account_id === trialDetail.account_id);
        if (refreshedProfile) setTrialDetail(refreshedProfile);
        if (payload.action === 'note') setTrialNote((current) => ({ ...current, note: '' }));
        await loadTrialHistory(trial.empresa, true);
      }
    } catch (error) {
      showToast?.(error.response?.data?.error || 'Falha ao atualizar o trial.', 'error');
    } finally {
      setTrialBusy('');
    }
  };

  const requestTrialAccountDeletion = (trial) => {
    if (isOffline) return showToast?.('Ação bloqueada enquanto o sistema está offline.', 'error');
    const closesEnvironment = trial.access_mode === 'TRIAL' && (trial.accounts?.length || 0) <= 1;
    setModalConfig?.({
      isOpen: true,
      title: `Excluir ${trial.account_user}`,
      message: closesEnvironment
        ? 'Esta é a última conta do trial. A credencial será excluída, o ambiente será suspenso e a telemetria virtual será interrompida.'
        : 'A credencial e suas sessões serão removidas. As outras contas do ambiente continuarão funcionando.',
      onConfirm: async () => {
        setTrialBusy(trial.empresa);
        try {
          const response = await api.delete(`/saas/trials/${encodeURIComponent(trial.empresa)}/accounts/${trial.account_id}`);
          if (trialDetail?.account_id === trial.account_id) setTrialDetail(null);
          showToast?.(response.data?.environmentClosed ? 'Conta removida e trial encerrado.' : 'Conta de teste excluída.', 'success');
          await loadOverview(true);
        } catch (error) {
          showToast?.(error.response?.data?.error || 'Falha ao excluir a conta de teste.', 'error');
        } finally {
          setTrialBusy('');
        }
      }
    });
  };

  const openTrialAsAdmin = async (trial) => {
    if (isOffline || !trial.filial) return showToast?.('Acesso remoto indisponível para este ambiente.', 'error');
    const accessWindow = window.open('', '_blank');
    if (!accessWindow) return showToast?.('Permita a abertura de novas guias para acessar o ambiente.', 'error');
    accessWindow.document.title = 'Preparando acesso seguro...';
    setTrialBusy(trial.empresa);
    try {
      const response = await api.post('/impersonate', { filialDestino: trial.filial, role: 'ADMIN' });
      const accessUrl = new URL(window.location.origin);
      accessUrl.searchParams.set('impersonateCode', response.data.accessCode);
      accessWindow.opener = null;
      accessWindow.location.replace(accessUrl.toString());
      showToast?.('Acesso administrativo auditado aberto em uma nova guia.', 'success');
    } catch (error) {
      accessWindow.close();
      showToast?.(error.response?.data?.error || 'Falha ao abrir o ambiente.', 'error');
    } finally {
      setTrialBusy('');
    }
  };

  const requestTrialReset = (trial) => setModalConfig?.({
    isOpen: true,
    title: `Redefinir ${trial.empresa}`,
    message: 'Chamados, alertas, tarefas, equipamentos e leituras simuladas voltarão ao cenário inicial. Usuários, prazo e histórico comercial serão preservados.',
    onConfirm: () => manageTrial(trial, { action: 'reset' }, 'Ambiente de demonstração restaurado.')
  });

  const resetTrialPassword = async (trial) => {
    setTrialBusy(trial.empresa);
    try {
      const response = await api.post(`/saas/trials/${encodeURIComponent(trial.empresa)}/accounts/${trial.account_id}/reset-password`);
      setCredentialResult({ ...response.data, usuario: trial.account_user, empresa: trial.empresa });
      showToast?.(response.data.emailSent ? 'Nova senha enviada por e-mail.' : 'Nova senha provisória gerada.', 'success');
      await loadOverview(true);
    } catch (error) {
      showToast?.(error.response?.data?.error || 'Falha ao redefinir a senha.', 'error');
    } finally {
      setTrialBusy('');
    }
  };

  const requestEnvironmentDeletion = (trial) => setModalConfig?.({
    isOpen: true,
    title: `Excluir ambiente ${trial.empresa}`,
    message: 'Esta ação remove definitivamente contas, lojas, equipamentos, leituras e histórico do trial. Ela não poderá ser desfeita.',
    onConfirm: async () => {
      setTrialBusy(trial.empresa);
      try {
        await api.delete(`/saas/trials/${encodeURIComponent(trial.empresa)}`);
        setTrialDetail(null);
        showToast?.('Ambiente temporário excluído definitivamente.', 'success');
        await loadOverview(true);
      } catch (error) {
        showToast?.(error.response?.data?.error || 'Falha ao excluir o ambiente.', 'error');
      } finally {
        setTrialBusy('');
      }
    }
  });
  /**
   * Processa a interacao de copy value e atualiza a interface conforme o resultado.
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
   * @param {unknown} value - Valor de value consumido por esta rotina.
   * @param {unknown} key - Valor de key consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copyValue = async (value, key) => {
    try {
      await navigator.clipboard.writeText(String(value || ''));
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(''), 1600);
      showToast?.('Conteúdo copiado.', 'success');
    } catch {
      showToast?.('Não foi possível copiar o conteúdo.', 'warning');
    }
  };
  /**
   * Concentra a logica de request approval para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {import("express").Request} request - Requisição HTTP com parâmetros, corpo e contexto de autenticação.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const requestApproval = (request) => {
    if (isOffline) return showToast?.('Ação bloqueada enquanto o sistema está offline.', 'error');
    setApprovalForm({
      accessType: request.tipo_acesso === 'COMERCIAL' ? 'CUSTOMER' : 'TRIAL',
      trialDays: 14,
      autoBlock: true,
      warningDays: 3,
      plan: 'PRO',
      monthlyValue: 299.9,
      firstDueDate: defaultDueDate()
    });
    setApprovalTarget(request);
  };

  /**
   * Arquiva uma solicitação pendente após confirmação explícita.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @param {import("express").Request} request - Requisição HTTP com parâmetros, corpo e contexto de autenticação.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const requestRejection = (request) => {
    setModalConfig?.({
      isOpen: true,
      title: `Rejeitar ${request.empresa}`,
      message: 'O requerimento será removido da fila operacional e ficará disponível no histórico como rejeitado.',
      onConfirm: async () => {
        setProcessingId(request.id);
        try {
          await api.post(`/pre-cadastros/${request.id}/rejeitar`);
          setSelectedRequest(null);
          showToast?.('Requerimento rejeitado e arquivado.', 'warning');
          await loadOverview(true);
        } catch (error) {
          showToast?.(error.response?.data?.error || 'Falha ao rejeitar o requerimento.', 'error');
        } finally {
          setProcessingId(null);
        }
      }
    });
  };

  /**
   * Cria uma solicitação manual usando o mesmo pipeline do formulário público.
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
  const submitManualRequest = async (event) => {
    event.preventDefault();
    if (isOffline) return showToast?.('Sem conexão com o servidor.', 'error');
    setManualSubmitting(true);
    try {
      await api.post('/pre-cadastros/manual', manualForm);
      setRequestTypeFilter(manualForm.tipoAcesso);
      setManualForm({ empresa: '', cnpj: '', responsavel: '', email: '', telefone: '', tipoAcesso: 'TRIAL' });
      setManualOpen(false);
      setStatusFilter('pendente');
      showToast?.('Solicitação adicionada à fila de onboarding.', 'success');
      await loadOverview(true);
    } catch (error) {
      showToast?.(error.response?.data?.error || 'Falha ao criar a solicitação.', 'error');
    } finally {
      setManualSubmitting(false);
    }
  };

  const publicLinks = {
    trial: `${window.location.origin}/teste-gratis`,
    customer: `${window.location.origin}/cadastro`
  };

  return (
    <section className="onboarding-page anim-fade-in" aria-labelledby="onboarding-title">
      <header className="onboarding-header">
        <div><span className="onboarding-eyebrow"><Rocket size={14} /> Operação SaaS</span><h2 id="onboarding-title">Onboarding SaaS</h2><p>Fila de validação, provisionamento e entrega de novos tenants.</p></div>
        <div className="onboarding-header-actions"><span className={summary.smtpReady ? 'is-ready' : 'is-warning'}><Mail size={15} /> SMTP {summary.smtpReady ? 'operacional' : 'não configurado'}</span><button type="button" onClick={() => setManualOpen(true)}><Plus size={16} /> Nova solicitação</button><button type="button" title="Atualizar dados" onClick={() => loadOverview()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /></button></div>
      </header>

      <div className="onboarding-kpis">
        <article className="is-pending"><span><Hourglass size={15} /> Fila pendente</span><strong>{summary.pending}</strong><p>{summary.overdue} fora do SLA de 24 horas</p></article>
        <article className="is-volume"><span><UserCheck size={15} /> Trials ativos</span><strong>{summary.activeTrials}</strong><p>Ambientes de avaliação e demonstração</p></article>
        <article className="is-rate"><span><BellRing size={15} /> Próximos do fim</span><strong>{summary.expiringTrials}</strong><p>{summary.expiredTrials} trial(s) já expirado(s)</p></article>
        <article className="is-tenants"><span><Building2 size={15} /> Tenants ativos</span><strong>{summary.activeTenants}</strong><p>Organizações operacionais na plataforma</p></article>
      </div>

      <section className="onboarding-pipeline" aria-label="Pipeline de provisionamento">
        {[['1', 'Recepção', 'Cadastro recebido'], ['2', 'Validação', 'Dados e duplicidades'], ['3', 'Provisionamento', 'Empresa, matriz e admin'], ['4', 'Entrega', 'Credenciais e acesso']].map(([step, title, detail], index) => <React.Fragment key={step}><div><b>{step}</b><span><strong>{title}</strong><small>{detail}</small></span></div>{index < 3 && <i />}</React.Fragment>)}
      </section>

      <div className="onboarding-workspace">
        <main className="onboarding-queue">
          <div className="onboarding-toolbar">
            <label><Search size={15} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar organização, documento ou contato" />{searchTerm && <button type="button" title="Limpar busca" onClick={() => setSearchTerm('')}><X size={14} /></button>}</label>
            <div><select value={sortMode} onChange={(event) => setSortMode(event.target.value)} aria-label="Ordenar solicitações"><option value="oldest">Mais antigas</option><option value="newest">Mais recentes</option><option value="quality">Menor qualidade</option></select><ArrowUpDown size={14} /></div>
          </div>

          <div className="onboarding-type-tabs" role="tablist" aria-label="Tipo de solicitação">
            {[['TRIAL', 'Testes gratuitos', requestTypeCounts.TRIAL], ['COMERCIAL', 'Cadastros definitivos', requestTypeCounts.COMERCIAL], ['TODOS', 'Todos os fluxos', requests.length]].map(([key, label, count]) => <button type="button" role="tab" aria-selected={requestTypeFilter === key} className={requestTypeFilter === key ? 'active' : ''} key={key} onClick={() => setRequestTypeFilter(key)}>{label}<b>{count}</b></button>)}
          </div>

          <div className="onboarding-tabs" role="tablist" aria-label="Status do onboarding">
            {[['pendente', 'Pendentes', summary.pending], ['todos', 'Todos', summary.total], ['aprovado', 'Aprovados', summary.approved], ['rejeitado', 'Rejeitados', summary.rejected]].map(([key, label, count]) => <button type="button" role="tab" aria-selected={statusFilter === key} className={statusFilter === key ? 'active' : ''} key={key} onClick={() => setStatusFilter(key)}>{label}<b>{count}</b></button>)}
          </div>

          <div className="onboarding-list">
            {loading ? <div className="onboarding-empty"><Loader2 size={25} className="spin" /><strong>Carregando fila</strong></div> : filteredRequests.length === 0 ? <div className="onboarding-empty"><ClipboardCheck size={28} /><strong>{searchTerm ? 'Nenhum resultado encontrado' : 'Nenhuma solicitação neste status'}</strong><span>{searchTerm ? 'Revise o termo pesquisado.' : 'A fila operacional está atualizada.'}</span></div> : filteredRequests.map((request) => {
              const meta = STATUS_META[request.status] || STATUS_META.pendente;
              const StatusIcon = meta.icon;
              const overdue = request.status === 'pendente' && Date.now() - new Date(request.data_solicitacao).getTime() > 86400000;
              return <article className={`onboarding-request is-${request.status}`} key={request.id}>
                <button type="button" className="onboarding-request-main" onClick={() => setSelectedRequest(request)}>
                  <span className="onboarding-org-icon">{String(request.empresa || '?').slice(0, 2).toUpperCase()}</span>
                  <span className="onboarding-request-copy"><strong>{request.empresa}</strong><small>{request.responsavel || 'Responsável não informado'} · {request.email}</small><em>{request.tipo_acesso === 'TRIAL' ? 'Teste gratuito · sem hardware' : 'Implantação comercial'} · {request.cnpj || 'Documento não informado'}</em></span>
                  <span className="onboarding-quality"><small>Qualidade</small><strong className={request.qualityScore < 80 ? 'is-warning' : ''}>{request.qualityScore}%</strong></span>
                  <span className="onboarding-age"><small>{request.status === 'pendente' ? 'Em espera' : 'Solicitado em'}</small><strong className={overdue ? 'is-overdue' : ''}>{request.status === 'pendente' ? getAge(request.data_solicitacao) : new Date(request.data_solicitacao).toLocaleDateString('pt-BR')}</strong></span>
                  <span className={`onboarding-status is-${request.status}`}><StatusIcon size={13} />{meta.label}</span>
                </button>
                <div className="onboarding-request-actions"><button type="button" title="Inspecionar solicitação" onClick={() => setSelectedRequest(request)}><Eye size={15} /></button>{request.status === 'pendente' && <button type="button" className="is-primary" onClick={() => requestApproval(request)} disabled={processingId === request.id}>{processingId === request.id ? <Loader2 size={15} className="spin" /> : <Rocket size={15} />}<span>Provisionar</span></button>}</div>
              </article>;
            })}
          </div>
        </main>

        <aside className="onboarding-insights">
          <section><div className="onboarding-section-title"><div><Clock3 size={16} /><span>SLA da fila</span></div><small>Meta: 24h</small></div><strong className="onboarding-oldest">{summary.oldestPendingAt ? getAge(summary.oldestPendingAt) : 'Fila vazia'}</strong><p>Tempo da solicitação pendente mais antiga.</p><div className="onboarding-sla-track"><i style={{ width: `${summary.pending ? Math.max(4, ((summary.pending - summary.overdue) / summary.pending) * 100) : 100}%` }} /></div><small>{summary.pending ? `${summary.pending - summary.overdue} de ${summary.pending} dentro do prazo` : 'Nenhuma violação ativa'}</small></section>
          <section><div className="onboarding-section-title"><div><Database size={16} /><span>Distribuição histórica</span></div><small>{summary.total} solicitações</small></div><div className="onboarding-distribution"><i className="is-approved" style={{ width: `${approvedShare}%` }} /><i className="is-pending" style={{ width: `${pendingShare}%` }} /><i className="is-rejected" style={{ width: `${rejectedShare}%` }} /></div><ul><li><i className="is-approved" />Aprovadas <b>{summary.approved}</b></li><li><i className="is-pending" />Pendentes <b>{summary.pending}</b></li><li><i className="is-rejected" />Rejeitadas <b>{summary.rejected}</b></li></ul></section>
          <section><div className="onboarding-section-title"><div><Link2 size={16} /><span>Canais públicos</span></div><small>Fluxos separados</small></div><div className="onboarding-public-links"><span><small>Teste gratuito</small><code>{publicLinks.trial}</code><button type="button" onClick={() => copyValue(publicLinks.trial, 'trial-link')}>{copiedKey === 'trial-link' ? <Check size={14} /> : <Copy size={14} />} Copiar</button></span><span><small>Cadastro definitivo</small><code>{publicLinks.customer}</code><button type="button" onClick={() => copyValue(publicLinks.customer, 'customer-link')}>{copiedKey === 'customer-link' ? <Check size={14} /> : <Copy size={14} />} Copiar</button></span></div></section>
        </aside>
      </div>

      <section className="trial-control" aria-labelledby="trial-control-title">
        <header>
          <div><span><UserCheck size={15} /> Gestão de demonstrações</span><h3 id="trial-control-title">Ambientes e contas gratuitas</h3></div>
          <div className="trial-control-summary"><span><UserRound size={14} /> {summary.trialAccounts} conta(s) em {trials.length} ambiente(s)</span><span><Activity size={14} /> {summary.engagedTrialAccounts} acessaram</span><span><SearchCheck size={14} /> {summary.neverAccessedAccounts} sem acesso</span><span><Gauge size={14} /> {summary.conversionRate90d}% conversão em 90 dias</span><span><Ban size={14} /> {summary.blockedTrialAccounts} bloqueada(s)</span></div>
        </header>
        <div className="trial-control-toolbar">
          <label><Search size={15} /><input value={trialSearch} onChange={(event) => setTrialSearch(event.target.value)} placeholder="Buscar conta, e-mail ou administrador" />{trialSearch && <button type="button" title="Limpar busca" onClick={() => setTrialSearch('')}><X size={14} /></button>}</label>
          <select value={trialFilter} onChange={(event) => setTrialFilter(event.target.value)} aria-label="Filtrar contas gratuitas"><option value="all">Todas as contas</option><option value="active">Ativas</option><option value="expiring">Próximas do fim</option><option value="expired">Expiradas</option><option value="blocked">Bloqueadas</option><option value="never-accessed">Nunca acessadas</option></select>
        </div>
        <div className="trial-control-grid">
          {filteredTrials.length === 0 ? <div className="trial-control-empty"><ClipboardCheck size={24} /><span>{trialProfiles.length ? 'Nenhuma conta corresponde ao filtro.' : 'Nenhuma conta gratuita cadastrada.'}</span></div> : filteredTrials.map((trial) => {
            const isPermanent = trial.access_mode === 'DEMO';
            const isExpired = trial.days_remaining != null && trial.days_remaining < 0;
            const isBlocked = trial.status !== 'Ativa' || trial.account_blocked;
            const busy = trialBusy === trial.empresa;
            const stage = TRIAL_STAGE_META[trial.trial_stage] || TRIAL_STAGE_META.NEW;
            const timeLabel = isPermanent ? 'Permanente' : isExpired ? `Expirado há ${Math.abs(trial.days_remaining)} dia(s)` : `${trial.days_remaining} dia(s) restante(s)`;
            return <article className={`trial-control-card ${isExpired ? 'is-expired' : ''} ${isBlocked ? 'is-blocked' : ''}`} key={trial.account_id}>
              <div className="trial-control-main"><span className="trial-control-avatar">{String(trial.account_user).slice(0, 2).toUpperCase()}</span><div><strong>{trial.account_user}</strong><small>{trial.empresa} · {trial.account_email || 'E-mail não informado'}</small></div><span className={`trial-stage is-${stage.tone}`}>{trial.account_role}</span><em>{isBlocked ? 'Conta bloqueada' : timeLabel}</em></div>
              <dl><div><dt>Perfil</dt><dd>{trial.account_role}</dd></div><div><dt>Filial</dt><dd>{trial.account_filial || 'Todas'}</dd></div><div><dt>Última atividade</dt><dd>{trial.account_last_activity_at ? getAge(trial.account_last_activity_at) : 'Nunca acessou'}</dd></div><div><dt>Telas visitadas</dt><dd>{trial.screens_visited || 0}</dd></div><div><dt>Encerramento</dt><dd>{isPermanent ? 'Sem expiração' : formatDate(trial.trial_expires_at).split(' ')[0]}</dd></div><div><dt>Mais utilizada</dt><dd>{trial.favorite_screen || 'Sem dados'}</dd></div></dl>
              <div className="trial-control-actions">
                <button type="button" disabled={busy} onClick={() => openTrialDetail(trial)}><History size={14} /> Detalhes</button>
                <button type="button" disabled={busy || isBlocked} onClick={() => openTrialAsAdmin(trial)}><ExternalLink size={14} /> Acessar</button>
                {!isPermanent && <button type="button" title="Prorrogar por 7 dias" disabled={busy} onClick={() => manageTrial(trial, { action: 'extend', days: 7, autoBlock: trial.trial_auto_block }, 'Trial prorrogado por 7 dias.')}><CalendarPlus size={14} /> +7 dias</button>}
                <button type="button" className={trial.account_blocked ? 'is-success' : 'is-danger'} disabled={busy || trial.status !== 'Ativa'} onClick={() => manageTrial(trial, { action: trial.account_blocked ? 'unblock_account' : 'block_account', accountId: trial.account_id }, trial.account_blocked ? 'Conta liberada.' : 'Conta bloqueada sem afetar os demais usuários.')}><Ban size={14} /> {trial.account_blocked ? 'Liberar conta' : 'Bloquear conta'}</button>
                <button type="button" className="is-danger" title={isPermanent && trial.accounts?.length <= 1 ? 'A conta principal da demonstração permanente deve ser preservada' : 'Excluir conta de teste'} disabled={busy || (isPermanent && trial.accounts?.length <= 1)} onClick={() => requestTrialAccountDeletion(trial)}><Trash2 size={14} /> Excluir</button>
                <button type="button" className="is-primary" disabled={busy} onClick={() => { setConversionForm({ plan: 'PRO', monthlyValue: 299.9, firstDueDate: defaultDueDate() }); setConversionTarget(trial); }}><CreditCard size={14} /> Converter ambiente</button>
              </div>
            </article>;
          })}
        </div>
      </section>

      {trialDetail && <div className="modal-overlay" onClick={() => setTrialDetail(null)}><section className="onboarding-modal trial-detail-modal" onClick={(event) => event.stopPropagation()}>
        <header><div><span>{trialDetail.empresa}</span><h3>{trialDetail.account_user}</h3></div><button type="button" title="Fechar" onClick={() => setTrialDetail(null)}><X size={19} /></button></header>
        <div className="trial-detail-body">
          <div className="trial-detail-overview">
            <article><Activity size={16} /><span>Última atividade</span><strong>{trialDetail.account_last_activity_at ? getAge(trialDetail.account_last_activity_at) : 'Nunca acessou'}</strong></article>
            <article><Clock3 size={16} /><span>Tempo utilizado</span><strong>{trialDetail.access_mode === 'DEMO' ? 'Permanente' : `${Math.max(0, trialDetail.days_elapsed || 0)} dia(s)`}</strong></article>
            <article><UserRound size={16} /><span>Perfil e filial</span><strong>{trialDetail.account_role} · {trialDetail.account_filial || 'Todas'}</strong></article>
            <article><Database size={16} /><span>Ambiente virtual</span><strong>{trialDetail.virtual_equipment} equipamento(s)</strong></article>
            <article><Gauge size={16} /><span>Uso registrado</span><strong>{trialDetail.usage_count || 0} visita(s)</strong></article>
            <article><SearchCheck size={16} /><span>Telas exploradas</span><strong>{trialDetail.screens_visited || 0}</strong></article>
            <article><Activity size={16} /><span>Tela mais usada</span><strong>{trialDetail.favorite_screen || 'Sem dados'}</strong></article>
            <article><CalendarClock size={16} /><span>Exclusão prevista</span><strong>{trialDetail.trial_delete_at ? formatDate(trialDetail.trial_delete_at) : 'Não agendada'}</strong></article>
          </div>

          <section className="trial-detail-accounts"><div className="trial-detail-heading"><UserRound size={16} /><div><strong>Contas de acesso</strong><small>{trialDetail.accounts?.length || 0} usuário(s) vinculado(s) a este ambiente.</small></div></div><div>{(trialDetail.accounts || []).map((account) => <article key={account.id}><span><strong>{account.usuario}</strong><em>{account.role}</em></span><small>{account.email || 'Sem e-mail'} · {account.filial || 'Todas as filiais'}</small><b>{account.security_blocked ? 'Bloqueada' : account.last_activity_at ? `Ativa há ${getAge(account.last_activity_at)}` : 'Nunca acessou'}</b></article>)}</div></section>

          <div className="trial-detail-columns">
            <form className="trial-settings-form" onSubmit={(event) => { event.preventDefault(); manageTrial(trialDetail, { action: 'schedule', ...trialSchedule }, 'Agenda do trial atualizada.'); }}>
              <div className="trial-detail-heading"><CalendarClock size={16} /><div><strong>Vencimento e automação</strong><small>Controle a data exata e a ação ao expirar.</small></div></div>
              {trialDetail.access_mode === 'DEMO' ? <p className="trial-permanent-note">Esta é uma demonstração permanente e não possui data de encerramento.</p> : <>
                <label>Encerramento<input type="date" required value={trialSchedule.expiresOn} onChange={(event) => setTrialSchedule((current) => ({ ...current, expiresOn: event.target.value }))} /></label>
                <label>Avisar com antecedência<input type="number" min="1" max="30" required value={trialSchedule.warningDays} onChange={(event) => setTrialSchedule((current) => ({ ...current, warningDays: event.target.value }))} /></label>
                <label className="onboarding-check"><input type="checkbox" checked={trialSchedule.autoBlock} onChange={(event) => setTrialSchedule((current) => ({ ...current, autoBlock: event.target.checked }))} /><span><strong>Bloqueio automático</strong><small>Revoga as sessões quando o período terminar.</small></span></label>
                <button type="submit" className="is-primary" disabled={trialBusy === trialDetail.empresa}><Save size={14} /> Salvar agenda</button>
              </>}
            </form>

            <form className="trial-note-form" onSubmit={(event) => { event.preventDefault(); manageTrial(trialDetail, { action: 'note', ...trialNote }, 'Acompanhamento registrado.'); }}>
              <div className="trial-detail-heading"><MessageSquareText size={16} /><div><strong>Acompanhamento comercial</strong><small>Registre o contexto para a próxima decisão.</small></div></div>
              <label>Estágio<select value={trialNote.stage} onChange={(event) => setTrialNote((current) => ({ ...current, stage: event.target.value }))}><option value="NEW">Novo</option><option value="EVALUATION">Em avaliação</option><option value="ENGAGED">Engajado</option><option value="NEGOTIATION">Negociação</option><option value="NO_RESPONSE">Sem retorno</option><option value="PAUSED">Pausado</option><option value="LOST">Descartado</option></select></label>
              <label>Anotação<textarea required minLength="3" maxLength="2000" value={trialNote.note} onChange={(event) => setTrialNote((current) => ({ ...current, note: event.target.value }))} placeholder="Contato realizado, necessidade do cliente ou próximo passo" /></label>
              <button type="submit" className="is-primary" disabled={trialBusy === trialDetail.empresa || trialNote.note.trim().length < 3}><Plus size={14} /> Registrar acompanhamento</button>
            </form>

            <form className="trial-settings-form" onSubmit={(event) => { event.preventDefault(); manageTrial(trialDetail, { action: 'limits', ...trialLimits }, 'Limites da demonstração atualizados.'); }}>
              <div className="trial-detail-heading"><Gauge size={16} /><div><strong>Limites do ambiente</strong><small>Evita expansão indevida durante a avaliação.</small></div></div>
              <div className="trial-limit-grid"><label>Usuários<input type="number" min="1" max="50" value={trialLimits.maxUsers} onChange={(event) => setTrialLimits((current) => ({ ...current, maxUsers: event.target.value }))} /></label><label>Lojas<input type="number" min="1" max="20" value={trialLimits.maxStores} onChange={(event) => setTrialLimits((current) => ({ ...current, maxStores: event.target.value }))} /></label><label>Equipamentos<input type="number" min="1" max="200" value={trialLimits.maxEquipment} onChange={(event) => setTrialLimits((current) => ({ ...current, maxEquipment: event.target.value }))} /></label></div>
              <button type="submit" className="is-primary" disabled={trialBusy === trialDetail.empresa}><Save size={14} /> Salvar limites</button>
            </form>

            <section className="trial-settings-form trial-maintenance-actions">
              <div className="trial-detail-heading"><RotateCcw size={16} /><div><strong>Manutenção da demonstração</strong><small>Restaure o cenário, pause o prazo ou prepare o descarte.</small></div></div>
              <div><button type="button" onClick={() => requestTrialReset(trialDetail)} disabled={trialBusy === trialDetail.empresa}><RotateCcw size={14} /> Redefinir dados</button><button type="button" onClick={() => resetTrialPassword(trialDetail)} disabled={trialBusy === trialDetail.empresa}><KeyRound size={14} /> Nova senha</button>{trialDetail.access_mode === 'TRIAL' && <button type="button" onClick={() => manageTrial(trialDetail, { action: trialDetail.trial_paused_at ? 'resume' : 'pause' }, trialDetail.trial_paused_at ? 'Teste retomado e prazo recalculado.' : 'Teste pausado sem consumir o prazo.')} disabled={trialBusy === trialDetail.empresa}>{trialDetail.trial_paused_at ? <Play size={14} /> : <Pause size={14} />} {trialDetail.trial_paused_at ? 'Retomar prazo' : 'Pausar prazo'}</button>}</div>
              {trialDetail.access_mode === 'TRIAL' && <div className="trial-retention-row"><label>Retenção após decisão<input type="number" min="1" max="90" value={trialLimits.retentionDays} onChange={(event) => setTrialLimits((current) => ({ ...current, retentionDays: event.target.value }))} /></label><button type="button" onClick={() => manageTrial(trialDetail, { action: trialDetail.trial_delete_at ? 'cancel_delete' : 'schedule_delete', retentionDays: trialLimits.retentionDays }, trialDetail.trial_delete_at ? 'Exclusão agendada cancelada.' : 'Exclusão definitiva agendada.')} disabled={trialBusy === trialDetail.empresa}>{trialDetail.trial_delete_at ? 'Cancelar exclusão' : 'Agendar exclusão'}</button><button type="button" className="is-danger" onClick={() => requestEnvironmentDeletion(trialDetail)} disabled={trialBusy === trialDetail.empresa}><Trash2 size={14} /> Excluir agora</button></div>}
            </section>
          </div>

          <section className="trial-timeline"><div className="trial-detail-heading"><History size={16} /><div><strong>Linha do tempo</strong><small>{trialHistory.length} evento(s) registrado(s)</small></div></div>{historyLoading ? <div className="trial-history-empty"><Loader2 size={20} className="spin" /> Carregando histórico</div> : trialHistory.length === 0 ? <div className="trial-history-empty">Nenhum evento registrado até o momento.</div> : <ol>{trialHistory.map((event) => <li key={event.id}><i /><div><strong>{event.title}</strong><p>{event.detail || 'Sem observações adicionais.'}</p><small>{formatDate(event.created_at)} · {event.actor_label || 'Sistema'}</small></div></li>)}</ol>}</section>
        </div>
        <footer><button type="button" onClick={() => setTrialDetail(null)}>Fechar</button><button type="button" onClick={() => openTrialAsAdmin(trialDetail)} disabled={trialBusy === trialDetail.empresa || trialDetail.status !== 'Ativa'}><ExternalLink size={14} /> Acessar como administrador</button><button type="button" className="is-primary" onClick={() => { setConversionForm({ plan: 'PRO', monthlyValue: 299.9, firstDueDate: defaultDueDate() }); setConversionTarget(trialDetail); }}><CreditCard size={14} /> Converter em cliente</button></footer>
      </section></div>}

      {selectedLive && <div className="modal-overlay" onClick={() => setSelectedRequest(null)}><section className="onboarding-modal" onClick={(event) => event.stopPropagation()}><header><div><span>Solicitação #{selectedLive.id} · {selectedLive.tipo_acesso === 'TRIAL' ? 'Teste gratuito' : 'Comercial'}</span><h3>{selectedLive.empresa}</h3></div><button type="button" title="Fechar" onClick={() => setSelectedRequest(null)}><X size={19} /></button></header><div className="onboarding-modal-body"><div className="onboarding-detail-grid"><div><Building2 size={15} /><span>Documento</span><strong>{selectedLive.cnpj || 'Não informado'}</strong></div><div><UserRound size={15} /><span>Responsável</span><strong>{selectedLive.responsavel || 'Não informado'}</strong></div><div><Mail size={15} /><span>E-mail</span><strong>{selectedLive.email}</strong></div><div><Phone size={15} /><span>Telefone</span><strong>{selectedLive.telefone || 'Não informado'}</strong></div></div><div className="onboarding-readiness"><div><span>Prontidão cadastral</span><strong>{selectedLive.qualityScore}%</strong></div><div className="onboarding-readiness-track"><i style={{ width: `${selectedLive.qualityScore}%` }} /></div>{selectedLive.duplicate && <p><AlertTriangle size={14} /> Documento ou e-mail aparece em outra solicitação.</p>}{!selectedLive.emailValid && <p><AlertTriangle size={14} /> O endereço de e-mail precisa ser revisado.</p>}</div><div className="onboarding-deploy-plan"><strong>Plano transacional</strong><ol><li>Registrar organização ativa</li><li>Criar filial Matriz</li><li>Gerar administrador corporativo</li>{selectedLive.tipo_acesso === 'TRIAL' && <li>Criar equipamentos e telemetria virtuais</li>}<li>Entregar credenciais via SMTP</li></ol></div><small className="onboarding-submitted-at">Recebido em {formatDate(selectedLive.data_solicitacao)}</small></div><footer><button type="button" onClick={() => copyValue(`${selectedLive.empresa}\n${selectedLive.cnpj}\n${selectedLive.responsavel}\n${selectedLive.email}\n${selectedLive.telefone}`, `request-${selectedLive.id}`)}><Copy size={15} /> Copiar dados</button>{selectedLive.status === 'pendente' && <><button type="button" className="is-danger" onClick={() => requestRejection(selectedLive)} disabled={processingId === selectedLive.id}>Rejeitar</button><button type="button" className="is-primary" onClick={() => requestApproval(selectedLive)} disabled={processingId === selectedLive.id}>{processingId === selectedLive.id ? <Loader2 size={15} className="spin" /> : <Rocket size={15} />} Provisionar {selectedLive.tipo_acesso === 'TRIAL' ? 'trial' : 'tenant'}</button></>}</footer></section></div>}

      {approvalTarget && <div className="modal-overlay" onClick={() => setApprovalTarget(null)}><section className="onboarding-modal onboarding-commercial-modal" onClick={(event) => event.stopPropagation()}><header><div><span>Decisão de onboarding</span><h3>{approvalTarget.empresa}</h3></div><button type="button" title="Fechar" onClick={() => setApprovalTarget(null)}><X size={19} /></button></header><form onSubmit={(event) => { event.preventDefault(); approveRequest(approvalTarget); }}><div className="onboarding-fixed-access"><span>Tipo de liberação</span><strong>{approvalForm.accessType === 'TRIAL' ? 'Teste gratuito com dados virtuais' : 'Cadastro definitivo como cliente'}</strong><small>Definido pela origem da solicitação e protegido pela API.</small></div>{approvalForm.accessType === 'TRIAL' ? <><div><label>Duração do teste<input type="number" min="1" max="365" value={approvalForm.trialDays} onChange={(event) => setApprovalForm((current) => ({ ...current, trialDays: event.target.value }))} /></label><label>Avisar antes do fim<input type="number" min="1" max="30" value={approvalForm.warningDays} onChange={(event) => setApprovalForm((current) => ({ ...current, warningDays: event.target.value }))} /></label></div><label className="onboarding-check"><input type="checkbox" checked={approvalForm.autoBlock} onChange={(event) => setApprovalForm((current) => ({ ...current, autoBlock: event.target.checked }))} /><span><strong>Bloquear automaticamente no vencimento</strong><small>Desmarcado, o acesso continuará até uma decisão manual.</small></span></label></> : <><label>Plano<select value={approvalForm.plan} onChange={(event) => setApprovalForm((current) => ({ ...current, plan: event.target.value }))}><option value="FREE">Free</option><option value="PRO">Pro</option><option value="ENTERPRISE">Enterprise</option></select></label>{approvalForm.plan !== 'FREE' && <div><label>Valor mensal (R$)<input type="number" min="0.01" step="0.01" value={approvalForm.monthlyValue} onChange={(event) => setApprovalForm((current) => ({ ...current, monthlyValue: event.target.value }))} /></label><label>Primeiro vencimento<input type="date" value={approvalForm.firstDueDate} onChange={(event) => setApprovalForm((current) => ({ ...current, firstDueDate: event.target.value }))} /></label></div>}</>}<footer><button type="button" onClick={() => setApprovalTarget(null)}>Cancelar</button><button type="submit" className="is-primary" disabled={processingId === approvalTarget.id}>{processingId === approvalTarget.id ? <Loader2 size={15} className="spin" /> : <Rocket size={15} />} Aprovar e enviar acesso</button></footer></form></section></div>}

      {conversionTarget && <div className="modal-overlay" onClick={() => setConversionTarget(null)}><section className="onboarding-modal onboarding-commercial-modal" onClick={(event) => event.stopPropagation()}><header><div><span>Conversão comercial</span><h3>{conversionTarget.empresa}</h3></div><button type="button" title="Fechar" onClick={() => setConversionTarget(null)}><X size={19} /></button></header><form onSubmit={(event) => { event.preventDefault(); manageTrial(conversionTarget, { action: 'convert', ...conversionForm }, 'Trial convertido em cliente.'); }}><label>Plano contratado<select value={conversionForm.plan} onChange={(event) => setConversionForm((current) => ({ ...current, plan: event.target.value }))}><option value="FREE">Free</option><option value="PRO">Pro</option><option value="ENTERPRISE">Enterprise</option></select></label>{conversionForm.plan !== 'FREE' && <div><label>Valor mensal (R$)<input type="number" min="0.01" step="0.01" value={conversionForm.monthlyValue} onChange={(event) => setConversionForm((current) => ({ ...current, monthlyValue: event.target.value }))} /></label><label>Primeiro vencimento<input type="date" value={conversionForm.firstDueDate} onChange={(event) => setConversionForm((current) => ({ ...current, firstDueDate: event.target.value }))} /></label></div>}<p className="onboarding-conversion-note"><CreditCard size={15} /> A conversão preserva usuários, equipamentos e histórico. O ambiente deixa de expirar e passa a integrar o faturamento.</p><footer><button type="button" onClick={() => setConversionTarget(null)}>Cancelar</button><button type="submit" className="is-primary" disabled={trialBusy === conversionTarget.empresa}>{trialBusy === conversionTarget.empresa ? <Loader2 size={15} className="spin" /> : <UserCheck size={15} />} Confirmar conversão</button></footer></form></section></div>}

      {credentialResult && <div className="modal-overlay" onClick={() => setCredentialResult(null)}><section className="onboarding-modal onboarding-result-modal" onClick={(event) => event.stopPropagation()}><header><div><span>Credencial renovada</span><h3>{credentialResult.usuario}</h3></div><button type="button" title="Fechar" onClick={() => setCredentialResult(null)}><X size={19} /></button></header><div className="onboarding-result-state"><KeyRound size={34} /><strong>{credentialResult.emailSent ? 'Senha enviada por e-mail' : 'Senha provisória disponível'}</strong><span>As sessões anteriores foram encerradas e a troca da senha será solicitada no próximo acesso.</span></div>{credentialResult.temporaryPassword && <div className="onboarding-credentials"><div><span>Senha provisória</span><strong>{credentialResult.temporaryPassword}</strong><button type="button" title="Copiar senha" onClick={() => copyValue(credentialResult.temporaryPassword, 'reset-password')}><Copy size={14} /></button></div></div>}<footer><button type="button" className="is-primary" onClick={() => setCredentialResult(null)}>Concluir</button></footer></section></div>}

      {manualOpen && <div className="modal-overlay" onClick={() => setManualOpen(false)}><section className="onboarding-modal onboarding-manual-modal" onClick={(event) => event.stopPropagation()}><header><div><span>Entrada assistida</span><h3>Nova solicitação SaaS</h3></div><button type="button" title="Fechar" onClick={() => setManualOpen(false)}><X size={19} /></button></header><form onSubmit={submitManualRequest}><label>Tipo de acesso<select value={manualForm.tipoAcesso} onChange={(event) => setManualForm((current) => ({ ...current, tipoAcesso: event.target.value }))}><option value="TRIAL">Teste gratuito sem hardware</option><option value="COMERCIAL">Implantação comercial</option></select></label><label>Organização<input required value={manualForm.empresa} onChange={(event) => setManualForm((current) => ({ ...current, empresa: event.target.value }))} placeholder="Razão social" /></label><div><label>CNPJ / NIF<input required value={manualForm.cnpj} onChange={(event) => setManualForm((current) => ({ ...current, cnpj: event.target.value }))} placeholder="Documento fiscal" /></label><label>Telefone<input required value={manualForm.telefone} onChange={(event) => setManualForm((current) => ({ ...current, telefone: event.target.value }))} placeholder="Contato com DDD" /></label></div><label>Responsável<input required value={manualForm.responsavel} onChange={(event) => setManualForm((current) => ({ ...current, responsavel: event.target.value }))} placeholder="Gestor responsável" /></label><label>E-mail corporativo<input type="email" required value={manualForm.email} onChange={(event) => setManualForm((current) => ({ ...current, email: event.target.value }))} placeholder="contato@empresa.com.br" /></label><footer><button type="button" onClick={() => setManualOpen(false)}>Cancelar</button><button type="submit" className="is-primary" disabled={manualSubmitting}>{manualSubmitting ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Adicionar à fila</button></footer></form></section></div>}

      {provisionResult && <div className="modal-overlay" onClick={() => setProvisionResult(null)}><section className="onboarding-modal onboarding-result-modal" onClick={(event) => event.stopPropagation()}><header><div><span>Provisionamento concluído</span><h3>{provisionResult.request.empresa}</h3></div><button type="button" title="Fechar" onClick={() => setProvisionResult(null)}><X size={19} /></button></header><div className="onboarding-result-state"><CheckCircle2 size={34} /><strong>{provisionResult.isTrial ? 'Trial operacional' : 'Tenant operacional'}</strong><span>{provisionResult.isTrial ? `${provisionResult.demoEquipmentCount} equipamentos virtuais criados para ${provisionResult.trialDays} dias de demonstração. ` : ''}{provisionResult.emailSent ? 'As credenciais foram entregues pelo canal SMTP.' : 'O SMTP não confirmou a entrega. Encaminhe as credenciais abaixo por um canal seguro.'}</span></div>{!provisionResult.emailSent && <div className="onboarding-credentials"><div><span>Usuário</span><strong>{provisionResult.usuario}</strong><button type="button" title="Copiar usuário" onClick={() => copyValue(provisionResult.usuario, 'username')}><Copy size={14} /></button></div><div><span>Senha provisória</span><strong>{provisionResult.senhaProvisoria}</strong><button type="button" title="Copiar senha" onClick={() => copyValue(provisionResult.senhaProvisoria, 'password')}><KeyRound size={14} /></button></div></div>}<footer><button type="button" className="is-primary" onClick={() => setProvisionResult(null)}>Concluir</button></footer></section></div>}
    </section>
  );
}
