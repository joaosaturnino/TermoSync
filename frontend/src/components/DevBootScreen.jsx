/**
 * Módulo: frontend/src/components/DevBootScreen.jsx
 * Responsabilidade: Implementa o componente reutilizável Dev Boot Screen e seu contrato visual.
 */

import { useMemo } from 'react';
import { Activity, CheckCircle2, Cpu, Database, HardDrive, KeyRound, Loader2, MemoryStick, Network, RefreshCw, Server, Wifi } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Lock, Terminal } from 'lucide-react';
import { getApiUrl } from '../config/api';
import './DevBootScreen.css';
 /**
  * Renderiza o componente format Uptime e encapsula sua interacao visual reutilizavel.
  *
  * Responsabilidade: mantém este comportamento isolado para que validação,
  * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
  *
  * Fluxo principal:
  * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
  *
  * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
  *
  * @param {unknown} seconds - Valor de seconds consumido por esta rotina.
  * @returns {unknown} Resultado calculado para consumo do chamador.
  * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
  */

/**
 * Renderiza o componente format Uptime e encapsula sua interacao visual reutilizavel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} seconds - Valor de seconds consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatUptime = (seconds) => {
  const value = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return [days && `${days}d`, hours && `${hours}h`, `${minutes}m`].filter(Boolean).join(' ');
};
  /**
   * Renderiza o componente format Gb e encapsula sua interacao visual reutilizavel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} megabytes - Valor de megabytes consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */

 /**
  * Renderiza o componente format Gb e encapsula sua interacao visual reutilizavel.
  *
  * Responsabilidade: mantém este comportamento isolado para que validação,
  * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
  *
  * Fluxo principal:
  * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
  *
  * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
  *
  * @param {unknown} megabytes - Valor de megabytes consumido por esta rotina.
  * @returns {unknown} Resultado calculado para consumo do chamador.
  * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
  */

/**
 * Renderiza o componente format Gb e encapsula sua interacao visual reutilizavel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} megabytes - Valor de megabytes consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatGb = (megabytes) => `${(Number(megabytes || 0) / 1024).toFixed(1)} GB`;
 /**
  * Renderiza o componente status Label e encapsula sua interacao visual reutilizavel.
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
 * Renderiza o componente status Label e encapsula sua interacao visual reutilizavel.
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
const statusLabel = (value) => String(value || 'indisponível').toUpperCase();
 /**
  * Renderiza o componente is Healthy e encapsula sua interacao visual reutilizavel.
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
  * @returns {boolean} Indica se a condição avaliada foi atendida.
  * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
  */

/**
 * Renderiza o componente is Healthy e encapsula sua interacao visual reutilizavel.
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
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const isHealthy = (value) => ['ok', 'online', 'connected', 'active'].includes(String(value || '').toLowerCase());

/**
 * Terminal pós-login do desenvolvedor alimentado exclusivamente por telemetria real.
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
 * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador; publica ou consome mensagens MQTT
 *
 * @param {object} props - Configurações e dados necessários para executar este bloco.
 * @param {Function} props.onComplete - Callback onComplete fornecido pelo componente responsável.
 * @param {unknown} props.authToken - Propriedade authToken usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function DevBootScreen({ onComplete, authToken }) { const [host, setHost] = useState(null); const [health, setHealth] = useState(null); const [telemetryError, setTelemetryError] = useState(''); const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(true); const [visibleLines, setVisibleLines] = useState(0); const [passcode, setPasscode] = useState(''); const [authError, setAuthError] = useState(''); const [isAuthenticating, setIsAuthenticating] = useState(false); const [attempts, setAttempts] = useState(0); const [lockSeconds, setLockSeconds] = useState(0); const [history, setHistory] = useState([]); const [theme, setTheme] = useState('cyan'); const terminalRef = useRef(null); const inputRef = useRef(null); const headers = useMemo(() => authToken ? { Authorization: `Bearer ${authToken}` } : {}, [authToken]); /* Carrega host e serviços usando o token DEV recém-emitido pelo login. */ const loadTelemetry = useCallback(async () => { setIsLoadingTelemetry(true); setTelemetryError(''); try { const [hostResult, healthResult] = await Promise.allSettled([ axios.get(`${getApiUrl()}/system/host-info`, { headers, timeout: 10000 }), axios.get(`${getApiUrl()}/system/health`, { headers, timeout: 10000 }) ]); if (hostResult.status === 'fulfilled' && hostResult.value.data?.success) setHost(hostResult.value.data); else setTelemetryError('A leitura do host não respondeu.'); if (healthResult.status === 'fulfilled') setHealth(healthResult.value.data); else setTelemetryError((current) => `${current}${current ? ' ' : ''}A saúde dos serviços não respondeu.`); } finally { setIsLoadingTelemetry(false); } }, [headers]);
  const bootLines = useMemo(() => [
    { type: isHealthy(health?.status) ? 'ok' : 'warn', text: `API ${statusLabel(health?.status)}` },
    { type: isHealthy(health?.database) ? 'ok' : 'warn', text: `Banco de dados ${statusLabel(health?.database)}` },
    { type: isHealthy(health?.mqtt) ? 'ok' : 'warn', text: `MQTT ${statusLabel(health?.mqtt)}` },
    { type: host ? 'info' : 'warn', text: host ? `${host.os?.platform || 'SO'} ${host.os?.release || ''} · ${host.cpu?.model || 'CPU não identificada'}` : 'Telemetria do host indisponível' }
  ], [health, host]);
  const bootComplete = !isLoadingTelemetry && visibleLines >= bootLines.length;

  useEffect(() => { loadTelemetry(); }, [loadTelemetry]);
  useEffect(() => {
    if (isLoadingTelemetry || visibleLines >= bootLines.length) return undefined;
    const timer = window.setTimeout(() => setVisibleLines((value) => value + 1), 180);
    return () => window.clearTimeout(timer);
  }, [bootLines.length, isLoadingTelemetry, visibleLines]);
  useEffect(() => {
    if (lockSeconds <= 0) return undefined;
    const timer = window.setInterval(() => setLockSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [lockSeconds]);
  useEffect(() => { terminalRef.current?.scrollTo?.({ top: terminalRef.current.scrollHeight }); }, [history, visibleLines]);
  /**
   * Renderiza o componente append History e encapsula sua interacao visual reutilizavel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: atualiza estado reativo da interface
   *
   * @param {unknown} text - Valor de text consumido por esta rotina.
   * @param {unknown} type - Valor de type consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const appendHistory = (text, type = 'output') => setHistory((current) => [...current, { id: `${Date.now()}-${current.length}`, text, type }]);

  /**
   * Executa comandos locais de diagnóstico sem inventar portas ou serviços.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; publica ou consome mensagens MQTT
   *
   * @param {unknown} command - Valor de command consumido por esta rotina.
   * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const runCommand = async (command) => {
    const cmd = command.toLowerCase();
    if (cmd === 'help') {
      appendHistory('Comandos: status, host, network, refresh, clear e help.', 'info');
      return true;
    }
    if (cmd === 'status') {
      appendHistory(`API=${statusLabel(health?.status)} DB=${statusLabel(health?.database)} MQTT=${statusLabel(health?.mqtt)} sockets=${health?.runtime?.socketClients ?? 0}`, 'info');
      return true;
    }
    if (cmd === 'host' || cmd === 'uname -a') {
      appendHistory(host ? `${host.os.kernelString} | Node ${host.runtime.nodeVersion} | uptime ${formatUptime(host.uptimeSeconds)}` : 'Informações do host indisponíveis.', 'info');
      return true;
    }
    if (cmd === 'network' || cmd === 'ipconfig') {
      const interfaces = host?.network?.interfaces || [];
      appendHistory(interfaces.length ? interfaces.map((item) => `${item.name}: ${item.address} (${item.family})`).join('\n') : 'Interfaces de rede indisponíveis.', 'info');
      return true;
    }
    if (cmd === 'refresh') {
      appendHistory('Atualizando telemetria do host...', 'muted');
      await loadTelemetry();
      return true;
    }
    if (cmd === 'clear') {
      setHistory([]);
      return true;
    }
    return false;
  };

  /**
   * Interpreta comandos permitidos ou valida a credencial ROOT no servidor.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API; interage com APIs do navegador
   *
   * @param {Event} event - Evento que iniciou a interação ou mudança de estado.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    const typed = passcode.trim();
    if (!typed || isAuthenticating || lockSeconds > 0) return;
    setPasscode('');
    setAuthError('');
    appendHistory(`root@${host?.os?.hostname || 'host'}:~$ ${['help', 'status', 'host', 'uname -a', 'network', 'ipconfig', 'refresh', 'clear'].includes(typed.toLowerCase()) ? typed : '••••••••'}`, 'command');
    if (await runCommand(typed)) return;

    setIsAuthenticating(true);
    try {
      const response = await axios.post(`${getApiUrl()}/system/verify-root-passcode`, { passcode: typed }, { headers, timeout: 10000 });
      if (!response.data?.success) throw new Error('Credencial ROOT inválida.');
      appendHistory(`Acesso ROOT confirmado para ${response.data.usuario || 'DEV'}. Abrindo console...`, 'success');
      window.setTimeout(onComplete, 450);
    } catch (error) {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      const message = error.response?.data?.error || 'Não foi possível validar a credencial ROOT.';
      setAuthError(message);
      appendHistory(message, 'error');
      if (nextAttempts >= 3) {
        setLockSeconds(15);
        setAttempts(0);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className={`dev-boot dev-boot-${theme}`}>
      <header className="dev-boot-header">
        <div><Terminal size={16} /><strong>TermoSync Developer Console</strong><span>root@{host?.os?.hostname || 'carregando'}</span></div>
        <div className="dev-boot-themes" aria-label="Cor do terminal">{['cyan', 'green', 'amber'].map((color) => <button key={color} className={theme === color ? 'active' : ''} title={`Tema ${color}`} onClick={() => setTheme(color)} />)}</div>
      </header>

      <main className="dev-boot-main">
        <section className="dev-boot-terminal" onClick={() => inputRef.current?.focus()}>
          <div className="dev-boot-terminal-bar"><span><span /><span /><span /></span><strong>cmd.exe · sessão administrativa</strong><small>UTF-8</small></div>
          <div className="dev-boot-host-strip" aria-label="Resumo do host">
            <div><Server size={15} /><span>Host</span><strong>{host?.os?.hostname || 'Coletando'}</strong></div>
            <div><Cpu size={15} /><span>CPU</span><strong>{host ? `${host.cpu.cores} núcleos · ${host.cpu.usedPercent}%` : '--'}</strong></div>
            <div><MemoryStick size={15} /><span>Memória</span><strong>{host ? `${host.memory.usedPercent}% de ${formatGb(host.memory.totalMB)}` : '--'}</strong></div>
            <div><HardDrive size={15} /><span>Disco</span><strong>{host?.filesystem?.available ? `${host.filesystem.usedPercent}% de ${formatGb(host.filesystem.totalMB)}` : '--'}</strong></div>
          </div>
          <div className="dev-boot-output" ref={terminalRef} aria-live="polite">
            <div className="dev-boot-brand">
              <h1>THERMOSYNC</h1>
              <p>SENTINEL OS · COMMAND &amp; CONTROL RUNTIME</p>
            </div>
            {isLoadingTelemetry && <div className="dev-boot-loading"><Loader2 size={18} className="spin" /> Consultando telemetria autenticada do servidor...</div>}
            {telemetryError && <div className="dev-boot-line warn"><b>[WARN]</b><pre>{telemetryError}</pre></div>}
            {bootLines.slice(0, visibleLines).map((line, index) => <div className={`dev-boot-line ${line.type}`} key={`${line.text}-${index}`}><b>{line.type === 'ok' ? '[ OK ]' : line.type === 'warn' ? '[WARN]' : line.type === 'info' ? '[INFO]' : '      '}</b><pre>{line.text}</pre></div>)}
            {history.map((line) => <div className={`dev-boot-history ${line.type}`} key={line.id}><pre>{line.text}</pre></div>)}
            {bootComplete && <form className="dev-boot-command" onSubmit={handleSubmit}><span>root@{host?.os?.hostname || 'host'}:~$</span><div><KeyRound size={15} /><input ref={inputRef} type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} placeholder={lockSeconds ? `Terminal bloqueado por ${lockSeconds}s` : "Credencial ROOT ou comando 'help'"} disabled={isAuthenticating || lockSeconds > 0} autoComplete="off" /><i /></div></form>}
          </div>
          <footer className="dev-boot-terminal-footer"><span>{bootComplete ? 'BOOT COMPLETO' : `CARREGANDO ${bootLines.length ? Math.round((visibleLines / bootLines.length) * 100) : 0}%`}</span><span>{host?.runtime?.nodeVersion || 'Node indisponível'}</span><span>{new Date().toLocaleString('pt-BR')}</span></footer>
        </section>

        <div className="dev-boot-actions">
          <div>{authError ? <><Lock size={15} /> <span>{authError}</span></> : <><CheckCircle2 size={15} /><span>{bootComplete ? 'Telemetria real carregada. Terminal aguardando autenticação ROOT.' : 'Coletando dados do servidor.'}</span></>}</div>
          {!bootComplete && !isLoadingTelemetry && <button type="button" onClick={() => setVisibleLines(bootLines.length)}>Exibir tudo</button>}
          <button type="button" onClick={loadTelemetry} disabled={isLoadingTelemetry}><RefreshCw size={15} className={isLoadingTelemetry ? 'spin' : ''} /> Atualizar leituras</button>
        </div>
      </main>

      <aside className="dev-boot-services" aria-label="Serviços reais">
        <div><Activity size={15} /><span>API</span><strong data-status={health?.status}>{statusLabel(health?.status)}</strong></div>
        <div><Database size={15} /><span>Banco</span><strong data-status={health?.database}>{statusLabel(health?.database)}</strong></div>
        <div><Wifi size={15} /><span>MQTT</span><strong data-status={health?.mqtt}>{statusLabel(health?.mqtt)}</strong></div>
        <div><Network size={15} /><span>Interfaces</span><strong>{host?.network?.interfaces?.length ?? '--'}</strong></div>
      </aside>
    </div>
  );
}
