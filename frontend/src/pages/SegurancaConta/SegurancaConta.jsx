/**
 * Módulo: frontend/src/pages/SegurancaConta/SegurancaConta.jsx
 * Responsabilidade: Implementa a tela Seguranca Conta, seus estados, interações e integrações de dados.
 */

import { Check, Clock3, Eye, EyeOff, History, LogOut, MapPin, ShieldAlert, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  KeyRound,
  Loader2,
  LockKeyhole,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Trash2
} from 'lucide-react';
import './SegurancaConta.css';
import { PASSWORD_RULES } from '../../utils/passwordPolicy.js';

/**
 * Formata format date time para exibicao segura na interface.
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
const formatDateTime = (value) => {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sem registro' : date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

/**
 * Traduz o user-agent para uma identificacao curta, sem expor o texto tecnico completo.
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
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
 *
 * @param {unknown} agent - Valor de agent consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const getDeviceLabel = (agent = '') => { const text = String(agent).toLowerCase(); const platform = text.includes('iphone') || text.includes('ios') ? 'iPhone / iOS' : text.includes('android') ? 'Android' : text.includes('windows') ? 'Windows' : text.includes('mac') ? 'macOS' : text.includes('linux') ? 'Linux' : 'Dispositivo desconhecido'; const browser = text.includes('edg/') ? 'Edge' : text.includes('firefox/') ? 'Firefox' : text.includes('chrome/') ? 'Chrome' : text.includes('safari/') ? 'Safari' : ''; return browser ? `${platform} - ${browser}` : platform; }; /* Converte tipos internos de auditoria em textos adequados para o usuario. */ const getEventInfo = (event = {}) => { const type = String(event.eventType || '').toUpperCase(); const severity = String(event.severity || 'info').toLowerCase(); const labels = { LOGIN_SUCCESS: 'Login autorizado', LOGIN_FAILED: 'Tentativa de login recusada', LOGOUT: 'Sessao encerrada', PASSWORD_CHANGED: 'Senha alterada', USER_PASSWORD_CHANGED: 'Senha alterada', MFA_ENABLED: 'MFA ativado', MFA_DISABLED: 'MFA desativado', USER_SESSION_REVOKED: 'Sessao revogada', USER_SESSIONS_REVOKED: 'Sessoes revogadas' }; return { label: labels[type] || type.replaceAll('_', ' ').toLowerCase() || 'Evento de seguranca', tone: ['danger', 'error', 'critical'].includes(severity) ? 'danger' : severity === 'warning' ? 'warning' : severity === 'success' ? 'success' : 'info' }; }; /* Campo de senha reutilizavel com controle explicito de visibilidade. */ const PasswordInput = ({ visible, onToggle, value, onChange, placeholder }) => ( <div className="account-security-password-input"> <input type={visible ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} autoComplete="off" /> <button type="button" onClick={onToggle} title={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}> {visible ? <EyeOff size={16} /> : <Eye size={16} />} </button> </div> ); /* Centraliza MFA, senha, sessoes e auditoria da conta autenticada. */ export default function SegurancaConta({ api, showToast, fazerLogout, onPasswordChanged }) { const [security, setSecurity] = useState(null); const [sessions, setSessions] = useState([]); const [events, setEvents] = useState([]); const [eventFilter, setEventFilter] = useState('all'); const [loading, setLoading] = useState(true); const [actionLoading, setActionLoading] = useState(''); const [lastUpdated, setLastUpdated] = useState(null); const [mfaSetup, setMfaSetup] = useState(null); const [mfaCode, setMfaCode] = useState(''); const [disableMfa, setDisableMfa] = useState({ senhaAtual: '', code: '' }); const [passwordForm, setPasswordForm] = useState({ senhaAtual: '', novaSenha: '', confirmarSenha: '' }); const [visibleFields, setVisibleFields] = useState({}); /* Carrega cada fonte de forma independente para manter a tela util mesmo em falha parcial. */ const loadSecurity = useCallback(async () => { if (!api) return; setLoading(true); const results = await Promise.allSettled([ api.get('/auth/security'), api.get('/auth/sessions'), api.get('/auth/security-events') ]);
  const [securityResult, sessionsResult, eventsResult] = results;
  if (securityResult.status === 'fulfilled') setSecurity(securityResult.value.data);
  if (sessionsResult.status === 'fulfilled') {
    setSessions(Array.isArray(sessionsResult.value.data) ? sessionsResult.value.data : []);
  }
  if (eventsResult.status === 'fulfilled') {
    const payload = eventsResult.value.data;
    setEvents(Array.isArray(payload) ? payload : (payload?.events || []));
  }
  if (securityResult.status === 'rejected') {
    showToast?.('Falha ao carregar a segurança da conta.', 'error');
  }
  setLastUpdated(new Date());
  setLoading(false);
}, [api, showToast]);

  useEffect(() => {
    loadSecurity();
  }, [loadSecurity]);

  const passwordRules = useMemo(() => PASSWORD_RULES.map((rule) => ({
    ...rule,
    valid: rule.test(passwordForm.novaSenha)
  })), [passwordForm.novaSenha]);
  const passwordReady = Boolean(passwordForm.senhaAtual)
    && passwordRules.every((rule) => rule.valid)
    && passwordForm.novaSenha === passwordForm.confirmarSenha;
  const passwordAge = useMemo(() => {
    if (!security?.passwordChangedAt) return null;
    const changedAt = new Date(security.passwordChangedAt).getTime();
    return Number.isNaN(changedAt) ? null : Math.max(0, Math.floor((Date.now() - changedAt) / 86400000));
  }, [security?.passwordChangedAt]);
  const riskyEvents = useMemo(() => events.filter((event) => {
    const tone = getEventInfo(event).tone;
    return tone === 'warning' || tone === 'danger';
  }), [events]);
  const filteredEvents = useMemo(() => eventFilter === 'all'
    ? events
    : events.filter((event) => getEventInfo(event).tone === eventFilter), [eventFilter, events]);
  const recommendations = useMemo(() => [
    { label: 'Ativar o segundo fator', detail: 'Protege novos acessos mesmo se a senha vazar.', done: Boolean(security?.mfaEnabled) },
    { label: 'Manter somente sessões reconhecidas', detail: 'Revogue dispositivos que não estejam mais em uso.', done: sessions.length <= 2 },
    { label: 'Revisar eventos recentes', detail: 'Acompanhe tentativas recusadas e alterações da conta.', done: riskyEvents.length === 0 },
    { label: 'Renovar a senha periodicamente', detail: 'Evite manter a mesma credencial por longos períodos.', done: passwordAge !== null && passwordAge <= 90 }
  ], [passwordAge, riskyEvents.length, security?.mfaEnabled, sessions.length]);
  const securityScore = recommendations.reduce((score, item) => score + (item.done ? 25 : 0), 0);
  /**
   * Concentra a logica de start mfa para manter o restante do tela mais legivel.
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
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const startMfa = async () => {
    setActionLoading('mfa-setup');
    try {
      const response = await api.post('/auth/mfa/setup');
      setMfaSetup(response.data);
      showToast?.('Chave MFA gerada. Confirme o código do aplicativo autenticador.', 'info');
    } catch (error) { showToast?.(error.userMessage || 'Não foi possível iniciar MFA.', 'error'); }
    finally { setActionLoading(''); }
  };

  /**
   * Confirma o primeiro codigo do autenticador e conclui a ativacao de MFA.
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
  const confirmMfa = async (event) => {
    event.preventDefault();
    if (mfaCode.length !== 6) return showToast?.('Informe o código MFA de 6 dígitos.', 'warning');
    setActionLoading('mfa-confirm');
    try {
      await api.post('/auth/mfa/confirm', { code: mfaCode });
      setMfaCode(''); setMfaSetup(null);
      showToast?.('MFA ativado com sucesso.', 'success');
      await loadSecurity();
    } catch (error) { showToast?.(error.userMessage || 'Código MFA inválido.', 'error'); }
    finally { setActionLoading(''); }
  };

  /**
   * Desativa MFA somente apos validar senha e codigo da conta.
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
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleDisableMfa = async (event) => {
    event.preventDefault();
    setActionLoading('mfa-disable');
    try {
      await api.post('/auth/mfa/disable', disableMfa);
      setDisableMfa({ senhaAtual: '', code: '' });
      showToast?.('MFA desativado.', 'warning');
      await loadSecurity();
    } catch (error) { showToast?.(error.userMessage || 'Não foi possível desativar MFA.', 'error'); }
    finally { setActionLoading(''); }
  };

  /**
   * Altera a senha depois de validar os mesmos requisitos aplicados pelo backend.
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
  const changePassword = async (event) => {
    event.preventDefault();
    if (!passwordReady) return showToast?.('Atenda aos requisitos e confirme a nova senha.', 'warning');
    setActionLoading('password');
    try {
      await api.post('/auth/password', { senhaAtual: passwordForm.senhaAtual, novaSenha: passwordForm.novaSenha });
      setPasswordForm({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
      onPasswordChanged?.();
      showToast?.('Senha alterada. Outras sessões foram encerradas.', 'success');
      await loadSecurity();
    } catch (error) { showToast?.(error.userMessage || 'Não foi possível alterar a senha.', 'error'); }
    finally { setActionLoading(''); }
  };

  /**
   * Revoga uma sessao especifica pertencente ao usuario autenticado.
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
   * @param {string|number} sessionId - Identificador do registro ou recurso processado.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const revokeSession = async (sessionId) => {
    setActionLoading(`session-${sessionId}`);
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      showToast?.('Sessão encerrada.', 'success');
      await loadSecurity();
    } catch (error) { showToast?.(error.userMessage || 'Não foi possível encerrar a sessão.', 'error'); }
    finally { setActionLoading(''); }
  };

  /**
   * Mantem a sessao atual e encerra todos os outros dispositivos.
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
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const revokeOthers = async () => {
    setActionLoading('sessions-revoke');
    try {
      const response = await api.post('/auth/sessions/revoke-others');
      showToast?.(`${response.data.revoked || 0} sessão(ões) encerrada(s).`, 'success');
      await loadSecurity();
    } catch (error) { showToast?.(error.userMessage || 'Não foi possível encerrar outras sessões.', 'error'); }
    finally { setActionLoading(''); }
  };

  /**
   * Copia a chave MFA durante a configuracao sem persisti-la na interface.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copySecret = async () => {
    try { await navigator.clipboard.writeText(mfaSetup?.secret || ''); showToast?.('Chave MFA copiada.', 'success'); }
    catch { showToast?.('Não foi possível copiar automaticamente.', 'warning'); }
  };


  /**
   * Processa a interacao de toggle field e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} field - Valor de field consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const toggleField = (field) => setVisibleFields((current) => ({ ...current, [field]: !current[field] }));

  if (loading && !security) return <div className="account-security-page account-security-loading"><Loader2 className="spinner" size={30} /><span>Carregando segurança da conta...</span></div>;

  return (
    <div className="account-security-page anim-fade-in">
      <section className="account-security-hero">
        <div className={`account-security-score score-${securityScore >= 80 ? 'good' : securityScore >= 55 ? 'attention' : 'risk'}`}><strong>{securityScore}</strong><span>/ 100</span></div>
        <div className="account-security-hero-copy"><span className="account-security-kicker">Central de seguranca</span><h2>Segurança da Conta</h2><p>{security?.usuario} · {security?.role} · {security?.empresa || 'Empresa não informada'}</p></div>
        <div className="account-security-hero-actions"><span><Clock3 size={14} /> {lastUpdated ? `Atualizado ${formatDateTime(lastUpdated)}` : 'Aguardando atualização'}</span><button className="btn btn-outline" onClick={loadSecurity} disabled={Boolean(actionLoading) || loading}>{loading ? <Loader2 size={16} className="spinner" /> : <RefreshCw size={16} />} Atualizar</button></div>
      </section>

      <section className="account-security-summary" aria-label="Resumo de protecao">
        <article><ShieldCheck size={19} /><div><strong>{security?.mfaEnabled ? 'Ativo' : 'Inativo'}</strong><span>Segundo fator</span></div></article>
        <article><KeyRound size={19} /><div><strong>{passwordAge === null ? 'N/D' : `${passwordAge} dias`}</strong><span>Idade da senha</span></div></article>
        <article><MonitorSmartphone size={19} /><div><strong>{sessions.length}</strong><span>Sessoes ativas</span></div></article>
        <article><ShieldAlert size={19} /><div><strong>{riskyEvents.length}</strong><span>Eventos de atencao</span></div></article>
      </section>

      <div className="account-security-layout">
        <section className={`account-security-card ${security?.mfaEnabled ? 'success' : 'warning'}`}>
          <div className="account-security-card-head"><div className="account-security-icon"><ShieldCheck size={21} /></div><div><h3>Segundo fator</h3><span>{security?.mfaEnabled ? 'Proteção ativa em novos acessos' : security?.mfaRequired ? 'Configuração pendente de confirmação' : 'Camada adicional recomendada'}</span></div></div>
          {!security?.mfaEnabled && !mfaSetup && <button className="btn btn-primary account-security-full-btn" onClick={startMfa} disabled={actionLoading === 'mfa-setup'}>{actionLoading === 'mfa-setup' ? <Loader2 size={16} className="spinner" /> : <KeyRound size={16} />} Ativar MFA</button>}
          {mfaSetup && <form className="account-security-form" onSubmit={confirmMfa}><label>Chave manual do autenticador</label><div className="account-security-secret"><code>{mfaSetup.secret}</code><button type="button" className="btn-icon" onClick={copySecret} title="Copiar chave"><Clipboard size={16} /></button></div><label>Código de 6 dígitos</label><input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="000000" /><div className="account-security-inline-actions"><button type="button" className="btn btn-outline" onClick={() => { setMfaSetup(null); setMfaCode(''); }}>Cancelar</button><button className="btn btn-primary" disabled={actionLoading === 'mfa-confirm' || mfaCode.length !== 6}>{actionLoading === 'mfa-confirm' ? <Loader2 size={16} className="spinner" /> : <CheckCircle2 size={16} />} Confirmar</button></div></form>}
          {security?.mfaEnabled && <form className="account-security-form" onSubmit={handleDisableMfa}><div className="account-security-notice"><ShieldCheck size={17} /><span>Seu autenticador será solicitado sempre que uma nova sessão for criada.</span></div><label>Senha atual</label><PasswordInput visible={visibleFields['disable-current']} onToggle={() => toggleField('disable-current')} value={disableMfa.senhaAtual} onChange={(event) => setDisableMfa((prev) => ({ ...prev, senhaAtual: event.target.value }))} /><label>Código MFA</label><input value={disableMfa.code} onChange={(event) => setDisableMfa((prev) => ({ ...prev, code: event.target.value.replace(/\D/g, '').slice(0, 6) }))} inputMode="numeric" placeholder="000000" /><button className="btn btn-outline account-security-full-btn" disabled={actionLoading === 'mfa-disable' || !disableMfa.senhaAtual || disableMfa.code.length !== 6}>{actionLoading === 'mfa-disable' ? <Loader2 size={16} className="spinner" /> : <ShieldOff size={16} />} Desativar MFA</button></form>}
        </section>

        <section className="account-security-card">
          <div className="account-security-card-head"><div className="account-security-icon"><LockKeyhole size={21} /></div><div><h3>Senha de acesso</h3><span>Última alteração: {formatDateTime(security?.passwordChangedAt)}</span></div></div>
          <form className="account-security-form" onSubmit={changePassword}>
            <label>Senha atual</label><PasswordInput visible={visibleFields.current} onToggle={() => toggleField('current')} value={passwordForm.senhaAtual} onChange={(event) => setPasswordForm((prev) => ({ ...prev, senhaAtual: event.target.value }))} />
            <label>Nova senha</label><PasswordInput visible={visibleFields.new} onToggle={() => toggleField('new')} value={passwordForm.novaSenha} onChange={(event) => setPasswordForm((prev) => ({ ...prev, novaSenha: event.target.value }))} />
            <div className="account-security-strength"><span style={{ width: `${(passwordRules.filter((rule) => rule.valid).length / passwordRules.length) * 100}%` }} /></div>
            <div className="account-security-rules">{passwordRules.map((rule) => <span className={rule.valid ? 'valid' : ''} key={rule.id}>{rule.valid ? <Check size={13} /> : <X size={13} />}{rule.label}</span>)}</div>
            <label>Confirmar nova senha</label><PasswordInput visible={visibleFields.confirm} onToggle={() => toggleField('confirm')} value={passwordForm.confirmarSenha} onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmarSenha: event.target.value }))} />
            {passwordForm.confirmarSenha && passwordForm.novaSenha !== passwordForm.confirmarSenha && <span className="account-security-field-error">As senhas não conferem.</span>}
            <button className="btn btn-primary account-security-full-btn" disabled={actionLoading === 'password' || !passwordReady}>{actionLoading === 'password' ? <Loader2 size={16} className="spinner" /> : <KeyRound size={16} />} Alterar senha</button>
          </form>
        </section>

        <section className="account-security-card account-security-recommendations">
          <div className="account-security-card-head"><div className="account-security-icon"><CheckCircle2 size={21} /></div><div><h3>Recomendações</h3><span>Controles que influenciam sua pontuação</span></div></div>
          <div className="account-security-checklist">{recommendations.map((item) => <article className={item.done ? 'done' : 'pending'} key={item.label}>{item.done ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}<div><strong>{item.label}</strong><span>{item.detail}</span></div></article>)}</div>
        </section>
      </div>

      <section className="account-security-card account-security-sessions">
        <div className="account-security-card-head"><div className="account-security-icon"><MonitorSmartphone size={21} /></div><div><h3>Sessões autorizadas</h3><span>Revise dispositivos, IPs e horários de atividade</span></div><button className="btn btn-outline" onClick={revokeOthers} disabled={actionLoading === 'sessions-revoke' || sessions.filter((session) => !session.current).length === 0}>{actionLoading === 'sessions-revoke' ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />} Encerrar outras</button></div>
        <div className="account-session-list">{sessions.map((session) => <article className={`account-session-item ${session.current ? 'current' : ''}`} key={session.id}><div className="account-session-device"><MonitorSmartphone size={19} /><div><strong>{getDeviceLabel(session.userAgent)}</strong><span>{session.current ? 'Sessão atual' : 'Sessão remota'} {session.location ? `· ${session.location}` : ''}</span></div></div><div className="account-session-data"><span><MapPin size={13} /> {session.ip || 'IP não registrado'}</span><span><Clock3 size={13} /> Último uso: {formatDateTime(session.lastSeen)}</span><small>Expira: {formatDateTime(session.expiresAt)}</small></div>{session.current ? <button className="btn btn-outline" onClick={fazerLogout}><LogOut size={16} /> Sair</button> : <button className="btn btn-danger" onClick={() => revokeSession(session.id)} disabled={actionLoading === `session-${session.id}`}>{actionLoading === `session-${session.id}` ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />} Encerrar</button>}</article>)}</div>
        {sessions.length === 0 && <div className="account-security-empty"><AlertTriangle size={21} /> Nenhuma sessão ativa foi encontrada.</div>}
      </section>

      <section className="account-security-card account-security-events">
        <div className="account-security-card-head"><div className="account-security-icon"><History size={21} /></div><div><h3>Atividade de segurança</h3><span>Últimos eventos registrados para esta conta</span></div><div className="account-security-filters"><button className={eventFilter === 'all' ? 'active' : ''} onClick={() => setEventFilter('all')}>Todos</button><button className={eventFilter === 'warning' ? 'active' : ''} onClick={() => setEventFilter('warning')}>Atenção</button><button className={eventFilter === 'danger' ? 'active' : ''} onClick={() => setEventFilter('danger')}>Críticos</button></div></div>
        <div className="account-event-list">{filteredEvents.map((event, index) => { const info = getEventInfo(event); return <article className={`account-event account-event-${info.tone}`} key={`${event.createdAt}-${event.eventType}-${index}`}><span className="account-event-dot" /><div><strong>{info.label}</strong><span>{event.ip || 'IP não registrado'} · {getDeviceLabel(event.userAgent)}</span>{event.detail && <small>{event.detail}</small>}</div><time>{formatDateTime(event.createdAt)}</time></article>; })}{filteredEvents.length === 0 && <div className="account-security-empty"><CheckCircle2 size={21} /> Nenhum evento encontrado neste filtro.</div>}</div>
      </section>
    </div>
  );
}
