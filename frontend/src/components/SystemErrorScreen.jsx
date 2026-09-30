/**
 * Módulo: frontend/src/components/SystemErrorScreen.jsx
 * Responsabilidade: Implementa o componente reutilizável System Error Screen e seu contrato visual.
 */

import { useMemo, useState } from 'react';
import TermoSyncLogo from './TermoSyncLogo';
import { AlertTriangle, Check, Home, LifeBuoy, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import './SystemErrorScreen.css';
/**
 * Módulo: frontend/src/components/SystemErrorScreen.jsx
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
const createIncidentCode = () => {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TS-${stamp}-${suffix}`;
};

/**
 * Tela segura de recuperação para falhas fatais da aplicação ou de um módulo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Monta a árvore visual conforme o estado e as permissões disponíveis.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {unknown} props.error - Propriedade error usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.errorInfo - Propriedade errorInfo usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.moduleName - Propriedade moduleName usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.scope - Propriedade scope usada para configurar dados ou comportamento do componente.
 * @param {Function} props.onRetry - Callback onRetry fornecido pelo componente responsável.
 * @param {Function} props.onGoHome - Callback onGoHome fornecido pelo componente responsável.
 * @param {Function} props.onOpenSupport - Callback onOpenSupport fornecido pelo componente responsável.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function SystemErrorScreen({
  error,
  errorInfo,
  moduleName,
  scope = 'app',
  onRetry,
  onGoHome,
  onOpenSupport
}) {
  const [copied, setCopied] = useState(false);
  const incidentCode = useMemo(() => createIncidentCode(), []);
  const occurredAt = useMemo(() => new Date(), []);
  const isModuleFailure = scope === 'module';
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;

  /**
   * Copia somente metadados técnicos seguros para acelerar o atendimento.
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
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const copyDiagnostic = async () => {
    const diagnostic = [
      'ThermoSync - diagnóstico de erro',
      `Código: ${incidentCode}`,
      `Escopo: ${isModuleFailure ? moduleName || 'Módulo' : 'Aplicação'}`,
      `Rota: ${window.location.pathname}`,
      `Horário: ${occurredAt.toLocaleString('pt-BR')}`,
      `Conexão: ${isOnline ? 'online' : 'offline'}`,
      `Erro: ${error?.message || 'Falha de renderização não identificada'}`,
      `Componente: ${errorInfo?.componentStack?.trim().split('\n')[0] || 'não identificado'}`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(diagnostic);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  /**
   * Usa callback do módulo quando disponível e mantém um destino global seguro.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: lê ou grava preferências no armazenamento do navegador; interage com APIs do navegador
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const goHome = () => {
    if (onGoHome) onGoHome();
    else window.location.assign(sessionStorage.getItem('token') ? '/sistema/dashboard-operacional' : '/entrar');
  };

  return (
    <main className={`system-error-screen ${isModuleFailure ? 'module-error' : 'full-error'}`} role="alert" aria-live="assertive">
      <section className="system-error-panel" aria-labelledby="system-error-title">
        {/* Identifica claramente que o fallback ainda pertence ao ThermoSync. */}
        <header className="system-error-brand">
          <span><TermoSyncLogo size={30} color="currentColor" /></span>
          <div><strong>ThermoSync</strong><small>Central de recuperação</small></div>
        </header>

        {/* Mensagem varia conforme a falha esteja isolada em um módulo ou em toda a aplicação. */}
        <div className="system-error-content">
          <span className="system-error-icon"><AlertTriangle size={29} /></span>
          <div className="system-error-copy">
            <span className="system-error-eyebrow">{isModuleFailure ? 'Falha isolada no módulo' : 'Interrupção inesperada'}</span>
            <h1 id="system-error-title">Não foi possível concluir esta operação</h1>
            <p>
              {isModuleFailure
                ? `${moduleName || 'Esta tela'} encontrou um problema e foi interrompida para proteger o restante do sistema.`
                : 'A interface encontrou um problema inesperado. Sua sessão continua protegida e nenhuma ação precisa ser repetida até a recuperação.'}
            </p>
          </div>
        </div>

        {/* Resumo copiável do incidente, sem stack trace ou credenciais. */}
        <dl className="system-error-status">
          <div><dt>Código do incidente</dt><dd>{incidentCode}</dd></div>
          <div><dt>Horário</dt><dd>{occurredAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</dd></div>
          <div><dt>Conexão</dt><dd className={isOnline ? 'online' : 'offline'}>{isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}{isOnline ? 'Online' : 'Offline'}</dd></div>
        </dl>

        {/* Orientação curta para evitar repetição acidental de operações. */}
        <div className="system-error-guidance">
          <LifeBuoy size={18} />
          <div><strong>O que fazer agora</strong><span>Tente novamente. Se o problema continuar, copie o diagnóstico e envie ao suporte.</span></div>
        </div>

        {/* Recuperação local, retorno seguro, diagnóstico e suporte opcional. */}
        <div className="system-error-actions">
          <button type="button" className="system-error-primary" onClick={onRetry || (() => window.location.reload())}><RefreshCw size={17} /> Tentar novamente</button>
          <button type="button" onClick={goHome}><Home size={17} /> Ir para o início</button>
          <button type="button" onClick={copyDiagnostic}>{copied ? <Check size={17} /> : <Clipboard size={17} />}{copied ? 'Diagnóstico copiado' : 'Copiar diagnóstico'}</button>
          {onOpenSupport && <button type="button" onClick={onOpenSupport}><LifeBuoy size={17} /> Abrir suporte</button>}
        </div>
      </section>
    </main>
  );
}
