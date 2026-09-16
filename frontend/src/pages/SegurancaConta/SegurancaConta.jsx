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

/**
 * Formata format date time para exibicao segura na interface.
 */
const formatDateTime = (value) => {
  if (!value) return 'Sem registro';
  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Sem registro';
  }
};

/**
 * Busca ou monta os dados de get device label usados no fluxo atual.
 */
const getDeviceLabel = (agent = '') => {
  const text = String(agent || '').toLowerCase();
  if (text.includes('iphone') || text.includes('ios')) return 'iPhone / iOS';
  if (text.includes('android')) return 'Android';
  if (text.includes('windows')) return 'Windows';
  if (text.includes('mac')) return 'macOS';
  return 'Dispositivo desconhecido';
};

/**
 * Renderiza a tela Seguranca Conta e concentra as regras de apresentacao desse modulo.
 */
export default function SegurancaConta({ api, showToast, fazerLogout }) {
  const [security, setSecurity] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [disableMfa, setDisableMfa] = useState({ senhaAtual: '', code: '' });
  const [passwordForm, setPasswordForm] = useState({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });

  const mfaTone = security?.mfaEnabled ? 'success' : 'warning';
  const passwordUpdated = useMemo(() => formatDateTime(security?.passwordChangedAt), [security?.passwordChangedAt]);

  const loadSecurity = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const [securityRes, sessionsRes] = await Promise.all([
        api.get('/auth/security'),
        api.get('/auth/sessions')
      ]);
      setSecurity(securityRes.data);
      setSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
    } catch (error) {
      showToast?.(error.userMessage || 'Falha ao carregar segurança da conta.', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, showToast]);

  useEffect(() => {
    loadSecurity();
  }, [loadSecurity]);

  /**
   * Concentra a logica de start mfa para manter o restante do tela mais legivel.
   */
  const startMfa = async () => {
    setActionLoading('mfa-setup');
    try {
      const response = await api.post('/auth/mfa/setup');
      setMfaSetup(response.data);
      showToast?.('Chave MFA gerada. Confirme o código do aplicativo autenticador.', 'info');
    } catch (error) {
      showToast?.(error.userMessage || 'Não foi possível iniciar MFA.', 'error');
    } finally {
      setActionLoading('');
    }
  };

  /**
   * Concentra a logica de confirm mfa para manter o restante do tela mais legivel.
   */
  const confirmMfa = async (event) => {
    event.preventDefault();
    if (!mfaCode.trim()) return showToast?.('Informe o código MFA.', 'warning');
    setActionLoading('mfa-confirm');
    try {
      await api.post('/auth/mfa/confirm', { code: mfaCode });
      setMfaCode('');
      setMfaSetup(null);
      showToast?.('MFA ativado com sucesso.', 'success');
      await loadSecurity();
    } catch (error) {
      showToast?.(error.userMessage || 'Código MFA inválido.', 'error');
    } finally {
      setActionLoading('');
    }
  };

  /**
   * Processa a interacao de handle disable mfa e atualiza a interface conforme o resultado.
   */
  const handleDisableMfa = async (event) => {
    event.preventDefault();
    setActionLoading('mfa-disable');
    try {
      await api.post('/auth/mfa/disable', disableMfa);
      setDisableMfa({ senhaAtual: '', code: '' });
      showToast?.('MFA desativado.', 'warning');
      await loadSecurity();
    } catch (error) {
      showToast?.(error.userMessage || 'Não foi possível desativar MFA.', 'error');
    } finally {
      setActionLoading('');
    }
  };

  /**
   * Concentra a logica de change password para manter o restante do tela mais legivel.
   */
  const changePassword = async (event) => {
    event.preventDefault();
    if (passwordForm.novaSenha !== passwordForm.confirmarSenha) return showToast?.('As senhas novas não conferem.', 'warning');
    setActionLoading('password');
    try {
      await api.post('/auth/password', {
        senhaAtual: passwordForm.senhaAtual,
        novaSenha: passwordForm.novaSenha
      });
      setPasswordForm({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
      showToast?.('Senha alterada. Outras sessões foram encerradas.', 'success');
      await loadSecurity();
    } catch (error) {
      showToast?.(error.userMessage || 'Não foi possível alterar a senha.', 'error');
    } finally {
      setActionLoading('');
    }
  };

  /**
   * Concentra a logica de revoke session para manter o restante do tela mais legivel.
   */
  const revokeSession = async (sessionId) => {
    setActionLoading(`session-${sessionId}`);
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      showToast?.('Sessão encerrada.', 'success');
      await loadSecurity();
    } catch (error) {
      showToast?.(error.userMessage || 'Não foi possível encerrar a sessão.', 'error');
    } finally {
      setActionLoading('');
    }
  };

  /**
   * Concentra a logica de revoke others para manter o restante do tela mais legivel.
   */
  const revokeOthers = async () => {
    setActionLoading('sessions-revoke');
    try {
      const response = await api.post('/auth/sessions/revoke-others');
      showToast?.(`${response.data.revoked || 0} sessão(ões) encerrada(s).`, 'success');
      await loadSecurity();
    } catch (error) {
      showToast?.(error.userMessage || 'Não foi possível encerrar outras sessões.', 'error');
    } finally {
      setActionLoading('');
    }
  };

  /**
   * Processa a interacao de copy secret e atualiza a interface conforme o resultado.
   */
  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(mfaSetup?.secret || '');
      showToast?.('Chave MFA copiada.', 'success');
    } catch {
      showToast?.('Não foi possível copiar automaticamente.', 'warning');
    }
  };

  if (loading) {
    return (
      <div className="account-security-page account-security-loading">
        <Loader2 className="spinner" size={32} />
        <span>Carregando segurança da conta...</span>
      </div>
    );
  }

  return (
    <div className="account-security-page anim-fade-in">
      <section className="account-security-hero">
        <div>
          <span className="account-security-kicker">Central de Segurança</span>
          <h2>Segurança da Conta</h2>
          <p>{security?.usuario} • {security?.role} • {security?.empresa || 'Empresa não informada'}</p>
        </div>
        <button className="btn btn-outline" onClick={loadSecurity} disabled={Boolean(actionLoading)}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </section>

      <div className="account-security-grid">
        <section className={`account-security-card ${mfaTone}`}>
          <div className="account-security-card-head">
            <div className="account-security-icon"><ShieldCheck size={22} /></div>
            <div>
              <h3>Segundo fator</h3>
              <span>{security?.mfaEnabled ? 'Proteção ativa' : 'Proteção recomendada'}</span>
            </div>
          </div>

          {!security?.mfaEnabled && !mfaSetup && (
            <button className="btn btn-primary account-security-full-btn" onClick={startMfa} disabled={actionLoading === 'mfa-setup'}>
              {actionLoading === 'mfa-setup' ? <Loader2 size={16} className="spinner" /> : <KeyRound size={16} />}
              Ativar MFA
            </button>
          )}

          {mfaSetup && (
            <form className="account-security-form" onSubmit={confirmMfa}>
              <label>Chave manual do autenticador</label>
              <div className="account-security-secret">
                <code>{mfaSetup.secret}</code>
                <button type="button" className="btn-icon" onClick={copySecret} title="Copiar chave">
                  <Clipboard size={16} />
                </button>
              </div>
              <label>Código de 6 dígitos</label>
              <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="000000" />
              <button className="btn btn-primary account-security-full-btn" disabled={actionLoading === 'mfa-confirm'}>
                {actionLoading === 'mfa-confirm' ? <Loader2 size={16} className="spinner" /> : <CheckCircle2 size={16} />}
                Confirmar MFA
              </button>
            </form>
          )}

          {security?.mfaEnabled && (
            <form className="account-security-form" onSubmit={handleDisableMfa}>
              <label>Senha atual</label>
              <input type="password" value={disableMfa.senhaAtual} onChange={(event) => setDisableMfa((prev) => ({ ...prev, senhaAtual: event.target.value }))} />
              <label>Código MFA</label>
              <input value={disableMfa.code} onChange={(event) => setDisableMfa((prev) => ({ ...prev, code: event.target.value.replace(/\D/g, '').slice(0, 6) }))} inputMode="numeric" placeholder="000000" />
              <button className="btn btn-outline account-security-full-btn" disabled={actionLoading === 'mfa-disable'}>
                {actionLoading === 'mfa-disable' ? <Loader2 size={16} className="spinner" /> : <ShieldOff size={16} />}
                Desativar MFA
              </button>
            </form>
          )}
        </section>

        <section className="account-security-card">
          <div className="account-security-card-head">
            <div className="account-security-icon"><LockKeyhole size={22} /></div>
            <div>
              <h3>Senha</h3>
              <span>Última alteração: {passwordUpdated}</span>
            </div>
          </div>
          <form className="account-security-form" onSubmit={changePassword}>
            <label>Senha atual</label>
            <input type="password" value={passwordForm.senhaAtual} onChange={(event) => setPasswordForm((prev) => ({ ...prev, senhaAtual: event.target.value }))} />
            <label>Nova senha forte</label>
            <input type="password" value={passwordForm.novaSenha} onChange={(event) => setPasswordForm((prev) => ({ ...prev, novaSenha: event.target.value }))} />
            <label>Confirmar nova senha</label>
            <input type="password" value={passwordForm.confirmarSenha} onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmarSenha: event.target.value }))} />
            <button className="btn btn-primary account-security-full-btn" disabled={actionLoading === 'password'}>
              {actionLoading === 'password' ? <Loader2 size={16} className="spinner" /> : <KeyRound size={16} />}
              Alterar senha
            </button>
          </form>
        </section>
      </div>

      <section className="account-security-card account-security-sessions">
        <div className="account-security-card-head">
          <div className="account-security-icon"><MonitorSmartphone size={22} /></div>
          <div>
            <h3>Sessões ativas</h3>
            <span>{sessions.length} conexão(ões) autorizada(s)</span>
          </div>
          <button className="btn btn-outline" onClick={revokeOthers} disabled={actionLoading === 'sessions-revoke'}>
            {actionLoading === 'sessions-revoke' ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />}
            Encerrar outras
          </button>
        </div>

        <div className="account-session-list">
          {sessions.map((session) => (
            <article className={`account-session-item ${session.current ? 'current' : ''}`} key={session.id}>
              <div>
                <strong>{getDeviceLabel(session.userAgent)}</strong>
                <span>{session.ip || 'IP não registrado'} • {session.current ? 'Sessão atual' : 'Outra sessão'}</span>
                <small>Login: {formatDateTime(session.loginTime)} • Último uso: {formatDateTime(session.lastSeen)}</small>
              </div>
              {session.current ? (
                <button className="btn btn-outline" onClick={fazerLogout}>Sair</button>
              ) : (
                <button className="btn btn-danger" onClick={() => revokeSession(session.id)} disabled={actionLoading === `session-${session.id}`}>
                  {actionLoading === `session-${session.id}` ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />}
                  Encerrar
                </button>
              )}
            </article>
          ))}
          {sessions.length === 0 && (
            <div className="account-security-empty">
              <AlertTriangle size={22} />
              Nenhuma sessão ativa foi encontrada para esta conta.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
