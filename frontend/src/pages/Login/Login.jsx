/**
 * Módulo: frontend/src/pages/Login/Login.jsx
 * Responsabilidade: Implementa a tela Login, seus estados, interações e integrações de dados.
 */

import { useMemo } from 'react';
import { Check, CheckCircle2, KeyRound, LockKeyhole, Radio } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  User, AlertTriangle, WifiOff, Loader2, ArrowRight, 
  Eye, EyeOff, ArrowLeft, ShieldCheck,
  Mail, Smartphone
} from 'lucide-react';
import TermoSyncLogo from '../../components/TermoSyncLogo';
import LegalLink from '../../components/LegalModal';
import { getApiUrl } from '../../config/api.js';
import { PASSWORD_RULES } from '../../utils/passwordPolicy.js';

import './Login.css';

const passwordRules = PASSWORD_RULES;

/**
 * Formata format phone para exibicao segura na interface.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) return digits.replace(/^(\d{0,2})(\d{0,4})(\d{0,4})$/, (_, ddd, first, last) => [ddd && `(${ddd})`, first, last && `-${last}`].filter(Boolean).join(' '));
  return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
};

/**
 * Reúne login, MFA e recuperação de senha numa única jornada de autenticação.
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
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {boolean} props.isLoginLoading - Sinalizador isLoginLoading que controla este comportamento visual.
 * @param {unknown} props.fazerLogin - Propriedade fazerLogin usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.loginErro - Propriedade loginErro usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.mfaChallenge - Propriedade mfaChallenge usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.concluirMfaLogin - Propriedade concluirMfaLogin usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.cancelarMfa - Propriedade cancelarMfa usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onBack - Callback onBack fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function Login({ isOffline, isLoginLoading, fazerLogin, loginErro, mfaChallenge, concluirMfaLogin, cancelarMfa, onBack }) {
  const [view, setView] = useState('login');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockAtivo, setCapsLockAtivo] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [resetUser, setResetUser] = useState('');
  const [resetStep, setResetStep] = useState('request');
  const [resetChannel, setResetChannel] = useState('email');
  const [resetDestination, setResetDestination] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resetRequestInFlightRef = useRef(false);

  const passedRules = useMemo(() => passwordRules.filter((rule) => rule.test(newPassword)).length, [newPassword]);
  const passwordIsStrong = passedRules === passwordRules.length;

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  /**
   * Mantém o indicador de Caps Lock sincronizado com a digitação da senha.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const checkCapsLock = (event) => setCapsLockAtivo(Boolean(event.getModifierState?.('CapsLock')));

  /**
   * Envia as credenciais somente quando os dois campos obrigatórios estão completos.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleLoginSubmit = (event) => {
    event.preventDefault();
    if (usuario.trim() && senha && !isOffline) fazerLogin(usuario.trim(), senha);
  };

  /**
   * Solicita um único código e inicia a espera que protege contra reenvios acidentais.
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
   * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const requestResetCode = async () => {
    if (resetRequestInFlightRef.current || isResetLoading || isOffline) return;
    const destinationDigits = resetDestination.replace(/\D/g, '');
    setResetError('');
    if (!resetUser.trim()) return setResetError('Informe seu usuário de acesso.');
    if (!resetDestination.trim()) return setResetError(`Informe o ${resetChannel === 'sms' ? 'telefone' : 'e-mail'} que receberá o código.`);
    if (resetChannel === 'sms' && destinationDigits.length < 10) return setResetError('Informe um telefone válido com DDD.');
    if (resetChannel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetDestination.trim())) return setResetError('Informe um e-mail válido.');

    resetRequestInFlightRef.current = true;
    setIsResetLoading(true);
    try {
      const { data } = await axios.post(`${getApiUrl()}/auth/password-reset/request`, {
        usuario: resetUser.trim(), canal: resetChannel, destino: resetDestination.trim()
      }, { timeout: 35000 });
      setResetMessage(data?.message || 'Se os dados estiverem corretos, o código será enviado.');
      setResetStep('confirm');
      setResendCooldown(60);
    } catch (error) {
      setResetError(error.response?.data?.error || (error.code === 'ECONNABORTED' ? 'O servidor demorou para responder. Tente novamente.' : 'Não foi possível solicitar o código agora.'));
    } finally {
      resetRequestInFlightRef.current = false;
      setIsResetLoading(false);
    }
  };

  /**
   * Valida código e política de senha antes de confirmar a redefinição na API.
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
  const handleResetConfirmSubmit = async (event) => {
    event.preventDefault();
    setResetError('');
    if (!/^\d{6}$/.test(resetCode)) return setResetError('Informe os 6 dígitos do código recebido.');
    if (!passwordIsStrong) return setResetError('A nova senha ainda não atende a todos os requisitos.');
    if (newPassword !== confirmPassword) return setResetError('As senhas digitadas não coincidem.');

    setIsResetLoading(true);
    try {
      await axios.post(`${getApiUrl()}/auth/password-reset/confirm`, {
        usuario: resetUser.trim(), codigo: resetCode, novaSenha: newPassword
      }, { timeout: 20000 });
      setView('success');
    } catch (error) {
      setResetError(error.response?.data?.error || 'Não foi possível redefinir a senha agora.');
    } finally {
      setIsResetLoading(false);
    }
  };

  /**
   * Limpa dados sensíveis ao retornar para o login.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const resetRecoveryFlow = () => {
    setUsuario(resetUser.trim());
    setView('login');
    setResetUser('');
    setResetStep('request');
    setResetChannel('email');
    setResetDestination('');
    setResetCode('');
    setResetMessage('');
    setResetError('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setResendCooldown(0);
  };

  /**
   * Confirma o desafio MFA usando apenas um código numérico de seis dígitos.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleMfaSubmit = (event) => {
    event.preventDefault();
    if (/^\d{6}$/.test(mfaCode)) concluirMfaLogin?.(mfaCode);
  };


  /**
   * Concentra a logica de open recovery para manter o restante do tela mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const openRecovery = () => {
    setResetUser(usuario.trim());
    setResetError('');
    setView('reset');
  };

  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <button type="button" onClick={onBack}><ArrowLeft size={17} /> Início</button>
        <div className="auth-brand"><TermoSyncLogo size={33} color="var(--brand-core)" /><span><strong>ThermoSync</strong><small>Rede térmica sincronizada</small></span></div>
        <span className={`auth-connection ${isOffline ? 'offline' : ''}`}>{isOffline ? <WifiOff size={14} /> : <Radio size={14} />}{isOffline ? 'Sem conexão' : 'Serviço disponível'}</span>
      </header>

      <main className="auth-layout">
        <aside className="auth-context">
          <img src="/login-refrigerated-displays-v4.png" alt="Parede de expositores refrigerados abastecidos" />
          <div className="auth-context-shade" />
          <div className="auth-context-copy">
            <span><ShieldCheck size={15} /> Acesso seguro</span>
            <h1>Controle operacional, sem perder o contexto.</h1>
            <p>Acesse telemetria, alertas e rotinas das unidades autorizadas para o seu perfil.</p>
            <div><span><Check size={15} /> Sessão individual</span><span><Check size={15} /> Permissões por perfil</span><span><Check size={15} /> Eventos auditáveis</span></div>
          </div>
        </aside>

        <section className="auth-workspace">
          {mfaChallenge ? (
            <form className="auth-form" onSubmit={handleMfaSubmit}>
              <div className="auth-form-heading"><span className="auth-heading-icon"><ShieldCheck size={22} /></span><div><small>Segunda etapa</small><h2>Confirme sua identidade</h2><p>Digite o código atual do seu aplicativo autenticador.</p></div></div>
              {loginErro && <div className="auth-alert error" role="alert"><AlertTriangle size={18} /><span>{loginErro}</span></div>}
              <label className="auth-field"><span>Código MFA</span><div className="auth-input code"><KeyRound size={18} /><input autoFocus type="text" inputMode="numeric" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoComplete="one-time-code" disabled={isLoginLoading} /></div></label>
              <button className="auth-primary" type="submit" disabled={isLoginLoading || mfaCode.length !== 6}>{isLoginLoading ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />}{isLoginLoading ? 'Validando...' : 'Validar e entrar'}<ArrowRight size={17} /></button>
              <button className="auth-back" type="button" onClick={() => { setMfaCode(''); cancelarMfa?.(); }}><ArrowLeft size={16} /> Voltar ao login</button>
            </form>
          ) : view === 'login' ? (
            <form className="auth-form" onSubmit={handleLoginSubmit}>
              <div className="auth-form-heading"><small>Área de clientes</small><h2>Entre na plataforma</h2><p>Use as credenciais vinculadas à sua organização.</p></div>
              {loginErro && <div className="auth-alert error" role="alert"><AlertTriangle size={18} /><span>{loginErro}</span></div>}
              {isOffline && <div className="auth-alert warning"><WifiOff size={18} /><span>O servidor está indisponível. O acesso será liberado quando a conexão retornar.</span></div>}
              <label className="auth-field"><span>Usuário</span><div className="auth-input"><User size={18} /><input autoFocus type="text" value={usuario} onChange={(event) => setUsuario(event.target.value)} placeholder="Seu usuário" autoComplete="username" disabled={isLoginLoading} /></div></label>
              <label className="auth-field"><span>Senha</span><div className="auth-input"><LockKeyhole size={18} /><input type={showPassword ? 'text' : 'password'} value={senha} onChange={(event) => setSenha(event.target.value)} onKeyUp={checkCapsLock} onKeyDown={checkCapsLock} placeholder="Sua senha" autoComplete="current-password" disabled={isLoginLoading} /><button type="button" title={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{capsLockAtivo && <small className="auth-field-warning">Caps Lock está ativo</small>}</label>
              <div className="auth-form-options"><span>Credenciais pessoais e intransferíveis</span><button type="button" onClick={openRecovery}>Esqueci minha senha</button></div>
              <button className="auth-primary" type="submit" disabled={isLoginLoading || isOffline || !usuario.trim() || !senha}>{isLoginLoading ? <Loader2 size={18} className="spin" /> : <LockKeyhole size={18} />}{isLoginLoading ? 'Entrando...' : 'Entrar no sistema'}<ArrowRight size={17} /></button>
            </form>
          ) : view === 'reset' ? (
            <form className="auth-form auth-recovery" onSubmit={resetStep === 'request' ? (event) => { event.preventDefault(); requestResetCode(); } : handleResetConfirmSubmit}>
              <div className="auth-recovery-progress" aria-label="Progresso da redefinição"><div className="active"><span>{resetStep === 'confirm' ? <Check size={13} /> : '1'}</span><small>Identificação</small></div><div className={resetStep === 'confirm' ? 'active' : ''}><span>2</span><small>Nova senha</small></div></div>
              <div className="auth-form-heading"><small>Recuperação de acesso</small><h2>{resetStep === 'request' ? 'Solicite um código' : 'Crie uma nova senha'}</h2><p>{resetStep === 'request' ? 'Confirme seu usuário e escolha o canal de entrega.' : 'Use o código recebido. Ele é válido por 15 minutos.'}</p></div>
              {resetError && <div className="auth-alert error" role="alert"><AlertTriangle size={18} /><span>{resetError}</span></div>}
              {resetMessage && <div className="auth-alert success" aria-live="polite"><CheckCircle2 size={18} /><span>{resetMessage}</span></div>}
              <label className="auth-field"><span>Usuário</span><div className="auth-input"><User size={18} /><input type="text" value={resetUser} onChange={(event) => setResetUser(event.target.value)} placeholder="Seu usuário" autoComplete="username" disabled={isResetLoading || resetStep === 'confirm'} /></div></label>

              {resetStep === 'request' ? <>
                <div className="auth-field"><span>Receber código por</span><div className="auth-channel" role="radiogroup" aria-label="Canal de recuperação"><button type="button" className={resetChannel === 'email' ? 'active' : ''} aria-pressed={resetChannel === 'email'} onClick={() => { setResetChannel('email'); setResetDestination(''); setResetError(''); }}><Mail size={18} /><span>E-mail</span></button><button type="button" className={resetChannel === 'sms' ? 'active' : ''} aria-pressed={resetChannel === 'sms'} onClick={() => { setResetChannel('sms'); setResetDestination(''); setResetError(''); }}><Smartphone size={18} /><span>SMS</span></button></div></div>
                <label className="auth-field"><span>{resetChannel === 'sms' ? 'Telefone com DDD' : 'E-mail de recuperação'}</span><div className="auth-input">{resetChannel === 'sms' ? <Smartphone size={18} /> : <Mail size={18} />}<input type={resetChannel === 'sms' ? 'tel' : 'email'} inputMode={resetChannel === 'sms' ? 'tel' : 'email'} value={resetDestination} onChange={(event) => setResetDestination(resetChannel === 'sms' ? formatPhone(event.target.value) : event.target.value)} placeholder={resetChannel === 'sms' ? '(00) 00000-0000' : 'nome@empresa.com'} autoComplete={resetChannel === 'sms' ? 'tel' : 'email'} disabled={isResetLoading} /></div></label>
              </> : <>
                <label className="auth-field"><span>Código de recuperação</span><div className="auth-input code"><KeyRound size={18} /><input autoFocus type="text" inputMode="numeric" maxLength={6} value={resetCode} onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoComplete="one-time-code" disabled={isResetLoading} /></div></label>
                <label className="auth-field"><span>Nova senha</span><div className="auth-input"><LockKeyhole size={18} /><input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Defina uma senha forte" autoComplete="new-password" disabled={isResetLoading} /><button type="button" title={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowNewPassword((value) => !value)}>{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
                <div className="auth-password-meter"><div><span style={{ width: `${(passedRules / passwordRules.length) * 100}%` }} /></div><small>{passedRules === passwordRules.length ? 'Senha forte' : `${passedRules} de ${passwordRules.length} requisitos atendidos`}</small><ul>{passwordRules.map((rule) => <li className={rule.test(newPassword) ? 'passed' : ''} key={rule.id}><Check size={12} /> {rule.label}</li>)}</ul></div>
                <label className="auth-field"><span>Confirmar nova senha</span><div className={`auth-input ${confirmPassword && confirmPassword !== newPassword ? 'invalid' : ''}`}><ShieldCheck size={18} /><input type={showNewPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repita a nova senha" autoComplete="new-password" disabled={isResetLoading} /></div>{confirmPassword && confirmPassword !== newPassword && <small className="auth-field-warning">As senhas ainda não coincidem</small>}</label>
              </>}

              <button className="auth-primary" type="submit" disabled={isResetLoading || isOffline || !resetUser.trim() || (resetStep === 'request' ? !resetDestination.trim() : !/^\d{6}$/.test(resetCode) || !passwordIsStrong || newPassword !== confirmPassword)}>{isResetLoading ? <Loader2 size={18} className="spin" /> : resetStep === 'request' ? resetChannel === 'sms' ? <Smartphone size={18} /> : <Mail size={18} /> : <KeyRound size={18} />}{isResetLoading ? 'Processando...' : resetStep === 'request' ? 'Enviar código' : 'Redefinir senha'}<ArrowRight size={17} /></button>
              {resetStep === 'confirm' && <div className="auth-resend"><button type="button" disabled={resendCooldown > 0 || isResetLoading || isOffline} onClick={requestResetCode}>{resendCooldown > 0 ? `Reenviar código em ${resendCooldown}s` : 'Reenviar código'}</button><button type="button" onClick={() => { setResetStep('request'); setResetCode(''); setResetMessage(''); setResetError(''); }}>Alterar canal</button></div>}
              <button className="auth-back" type="button" onClick={resetRecoveryFlow}><ArrowLeft size={16} /> Voltar ao login</button>
            </form>
          ) : (
            <div className="auth-form auth-success">
              <span className="auth-success-icon"><CheckCircle2 size={30} /></span><small>Acesso recuperado</small><h2>Senha redefinida com sucesso</h2><p>As sessões anteriores foram encerradas. Entre novamente usando sua nova senha.</p><button className="auth-primary" type="button" onClick={resetRecoveryFlow}><LockKeyhole size={18} /> Ir para o login <ArrowRight size={17} /></button>
            </div>
          )}
        </section>
      </main>
      <footer className="auth-footer"><span>© 2026 ThermoSync</span><nav aria-label="Links legais"><LegalLink type="terms">Termos de Uso</LegalLink><LegalLink type="privacy">Privacidade</LegalLink></nav><span>Ambiente monitorado e auditável</span></footer>
    </div>
  );
}
