/**
 * Módulo: frontend/src/components/LockScreen.jsx
 * Responsabilidade: Implementa o componente reutilizável Lock Screen e seu contrato visual.
 */

import { useEffect, useRef, useState } from 'react';
import TermoSyncLogo from './TermoSyncLogo';
import { AlertTriangle, Building2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, LogOut, ShieldCheck, Terminal, Unlock, UserRound, Wifi, WifiOff } from 'lucide-react';
import './LockScreen.css';
/**
 * Módulo: frontend/src/components/LockScreen.jsx
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} date - Valor de date consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatClock = (date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * Renderiza o componente format Date e encapsula sua interacao visual reutilizavel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} date - Valor de date consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatDate = (date) => date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

/**
 * Reautentica uma sessão protegida sem expor o conteúdo do sistema bloqueado.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.password - Propriedade password usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.error - Propriedade error usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isUnlocking - Sinalizador isUnlocking que controla este comportamento visual.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {unknown} props.userName - Propriedade userName usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userLogin - Propriedade userLogin usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userRole - Propriedade userRole usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.userFilial - Propriedade userFilial usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onPasswordChange - Callback onPasswordChange fornecido pelo componente responsável.
 * @param {Function} props.onSubmit - Callback onSubmit fornecido pelo componente responsável.
 * @param {Function} props.onLogout - Callback onLogout fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function LockScreen({
  password,
  error,
  isUnlocking,
  isOffline,
  userName,
  userLogin,
  userRole,
  userFilial,
  onPasswordChange,
  onSubmit,
  onLogout
}) {
  const inputRef = useRef(null);
  const isDeveloper = userRole === 'DEV';
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isUnlocking) inputRef.current?.focus();
  }, [isUnlocking]);


  /**
   * Renderiza o componente update Caps Lock e encapsula sua interacao visual reutilizavel.
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
  const updateCapsLock = (event) => setCapsLock(Boolean(event.getModifierState?.('CapsLock')));

  if (!isDeveloper) {
    return (
      <main className="user-lock" aria-labelledby="user-lock-title">
        <section className="user-lock-panel">
          <header className="user-lock-brand"><TermoSyncLogo size={34} color="var(--brand-core)" /><strong>ThermoSync</strong></header>
          <div className="user-lock-icon"><LockKeyhole size={25} /></div>
          <h1 id="user-lock-title">Sessão bloqueada</h1>
          <p className="user-lock-message">Olá, <strong>{userName || userLogin || 'usuário'}</strong>. Digite sua senha para continuar.</p>

          <form onSubmit={onSubmit}>
            <label className={`user-lock-field ${error ? 'invalid' : ''}`}>
              <span>Senha</span>
              <div>
                <KeyRound size={18} />
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  onKeyDown={updateCapsLock}
                  onKeyUp={updateCapsLock}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  disabled={isUnlocking}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'user-lock-error' : undefined}
                />
                <button type="button" onClick={() => setShowPassword((current) => !current)} title={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </label>

            {capsLock && <div className="user-lock-notice"><AlertTriangle size={15} /> Caps Lock está ativo</div>}
            {error && <div id="user-lock-error" className="user-lock-error" role="alert">{error}</div>}
            {isOffline && <div className="user-lock-error" role="status">Sem conexão. Aguarde a rede voltar para continuar.</div>}

            <button className="user-lock-submit" type="submit" disabled={isUnlocking || isOffline || !password.trim()}>
              {isUnlocking ? <Loader2 size={18} className="spin" /> : <Unlock size={18} />}
              {isUnlocking ? 'Verificando...' : 'Continuar'}
            </button>
          </form>

          <button className="user-lock-logout" type="button" onClick={onLogout}><LogOut size={15} /> Sair da conta</button>
        </section>
      </main>
    );
  }

  return (
    <main className="session-lock developer" aria-labelledby="session-lock-title">
      <section className="session-lock-shell">
        <header className="session-lock-bar">
          <div className="session-lock-window-dots" aria-hidden="true"><i /><i /><i /></div>
          <span><Terminal size={14} /> security/session-lock</span>
          <strong className={isOffline ? 'offline' : 'online'}><i />{isOffline ? 'SEM REDE' : 'PROTEGIDO'}</strong>
        </header>

        <div className="session-lock-body">
          <aside className="session-lock-context" aria-label="Estado da sessão">
            <div className="session-lock-brand"><TermoSyncLogo size={38} color="var(--brand-core)" /><div><strong>ThermoSync</strong><small>CONTROLE DE ACESSO</small></div></div>
            <div className="session-lock-console" aria-live="polite">
              <p><span>[OK]</span> Interface operacional protegida</p>
              <p><span>[OK]</span> Contexto da sessão preservado</p>
              <p><span>[AUTH]</span> Reautenticação necessária</p>
              <p className="active"><i /> Aguardando credencial do usuário</p>
            </div>
            <div className="session-lock-clock"><strong>{formatClock(now)}</strong><span>{formatDate(now)}</span></div>
          </aside>

          <form className="session-lock-form" onSubmit={onSubmit}>
            <div className="session-lock-heading">
              <span><LockKeyhole size={22} /></span>
              <div><small>Sessão suspensa</small><h1 id="session-lock-title">Terminal bloqueado</h1><p>Confirme sua credencial para restaurar o acesso com segurança.</p></div>
            </div>

            <div className="session-lock-identity">
              <div><UserRound size={17} /><p><small>Usuário</small><strong>{userName || userLogin || 'Usuário autenticado'}</strong></p></div>
              <div><ShieldCheck size={17} /><p><small>Perfil</small><strong>{userRole || 'Operador'}</strong></p></div>
              {userFilial && <div><Building2 size={17} /><p><small>Contexto</small><strong>{userFilial}</strong></p></div>}
            </div>

            <label className={`session-lock-field ${error ? 'invalid' : ''}`}>
              <span>Senha da conta</span>
              <div>
                <KeyRound size={18} />
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  onKeyDown={updateCapsLock}
                  onKeyUp={updateCapsLock}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  disabled={isUnlocking}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'session-lock-error' : undefined}
                />
                <button type="button" onClick={() => setShowPassword((current) => !current)} title={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </label>

            {capsLock && <div className="session-lock-warning"><AlertTriangle size={15} /> Caps Lock está ativo</div>}
            {error && <div id="session-lock-error" className="session-lock-error" role="alert"><AlertTriangle size={16} /><span>{error}</span></div>}
            {isOffline && <div className="session-lock-error offline" role="status"><WifiOff size={16} /><span>A conexão precisa ser restabelecida para validar a credencial.</span></div>}

            <button className="session-lock-submit" type="submit" disabled={isUnlocking || isOffline || !password.trim()}>
              {isUnlocking ? <Loader2 size={18} className="spin" /> : <Unlock size={18} />}
              {isUnlocking ? 'Validando credencial...' : 'Restaurar sessão'}
            </button>

            <footer className="session-lock-footer">
              <span>{isOffline ? <WifiOff size={14} /> : <Wifi size={14} />}{isOffline ? 'Servidor indisponível' : 'Conexão segura ativa'}</span>
              <button type="button" onClick={onLogout}><LogOut size={15} /> Encerrar sessão</button>
            </footer>
          </form>
        </div>
      </section>
    </main>
  );
}
