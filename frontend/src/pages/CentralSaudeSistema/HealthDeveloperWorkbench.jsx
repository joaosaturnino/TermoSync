/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthDeveloperWorkbench.jsx
 * Responsabilidade: Implementa a tela Health Developer Workbench, seus estados, interações e integrações de dados.
 */

import { useState } from 'react';
import { CheckCircle2, Clipboard, Code2, Download, ExternalLink, FileJson, FlaskConical, Loader2, MonitorSmartphone, Play, XCircle } from 'lucide-react';

const sensitiveKeyPattern = /authorization|cookie|credential|password|secret|senha|token|api[-_]?key/i;
// @api-contract-dynamic Os caminhos abaixo são sondados sequencialmente pelo cliente HTTP.
// @api-contract GET /api/health
// @api-contract GET /api/system/host-info
// @api-contract GET /api/security/status
const endpoints = [
  { id: 'health', label: 'Saúde da API', path: '/health', expected: 200 },
  { id: 'host', label: 'Informações do host', path: '/system/host-info', expected: 200 },
  { id: 'security', label: 'Estado de segurança', path: '/security/status', expected: 200 }
];
/**
 * Módulo: frontend/src/pages/CentralSaudeSistema/HealthDeveloperWorkbench.jsx
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
 * @param {unknown} depth - Valor de depth consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const sanitizePayload = (value, depth = 0) => {
  if (depth > 6) return '[TRUNCADO]';
  if (Array.isArray(value)) return value.slice(0, 50).map(item => sanitizePayload(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? '[REMOVIDO]' : sanitizePayload(item, depth + 1)
    ]));
  }
  if (typeof value === 'string' && value.length > 2000) return `${value.slice(0, 2000)}… [TRUNCADO]`;
  return value;
};

/**
 * Calcula o tamanho serializado sem depender da unidade de caracteres do JavaScript.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object|Array} payload - Dados de entrada que serão validados e transformados pelo fluxo.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const getPayloadBytes = (payload) => {
  try { return new TextEncoder().encode(JSON.stringify(payload)).length; } catch { return 0; }
};

/**
 * Formata bytes em uma unidade curta adequada para respostas pequenas de diagnóstico.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} bytes - Valor de bytes consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const formatBytes = (bytes) => bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;

/**
 * Retorna informações do cliente que ajudam a reproduzir erros de interface.
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
const getClientSnapshot = () => ({
  viewport: `${window.innerWidth} x ${window.innerHeight}`,
  screen: `${window.screen.width} x ${window.screen.height}`,
  pixelRatio: window.devicePixelRatio,
  online: navigator.onLine,
  language: navigator.language,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  platform: navigator.userAgentData?.platform || navigator.platform || 'Não informado',
  userAgent: navigator.userAgent
});

/**
 * Copia texto usando a API moderna e mantém compatibilidade com WebViews antigas.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: interage com APIs do navegador
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const copyText = async (value) => {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const field = document.createElement('textarea');
  field.value = value;
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  try { document.execCommand('copy'); } finally { field.remove(); }
};

/**
 * Salva um objeto como JSON para anexá-lo a uma análise técnica.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; interage com APIs do navegador
 *
 * @param {unknown} filename - Valor de filename consumido por esta rotina.
 * @param {object|Array} payload - Dados de entrada que serão validados e transformados pelo fluxo.
 * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const downloadJson = (filename, payload) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Reúne ferramentas de diagnóstico voltadas ao perfil de desenvolvimento. Nenhuma ação altera
 * o servidor: os testes executam somente requisições GET.
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
 * @param {unknown} props.api - Propriedade api usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.health - Propriedade health usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.host - Propriedade host usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.socketConnected - Propriedade socketConnected usada para configurar dados ou comportamento do componente.
 * @param {boolean} props.isOffline - Sinalizador isOffline que controla este comportamento visual.
 * @param {unknown} props.recentChecks - Propriedade recentChecks usada para configurar dados ou comportamento do componente.
 * @param {unknown} props.showToast - Propriedade showToast usada para configurar dados ou comportamento do componente.
 * @returns {React.ReactElement} Árvore de elementos que representa o componente na interface.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export default function HealthDeveloperWorkbench({ api, health, host, socketConnected, isOffline, recentChecks, showToast }) {
  const [probeResults, setProbeResults] = useState({});
  const [probing, setProbing] = useState(false);
  const [payloadTab, setPayloadTab] = useState('health');
  const [client] = useState(() => getClientSnapshot());
  const payloads = { health: health || {}, host: host || {}, probes: probeResults };
  const activePayload = payloads[payloadTab];

  /**
   * Mede cada endpoint em sequência para evitar que um teste interfira na latência do seguinte.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const runEndpointProbes = async () => {
    if (!api || isOffline || probing) return;
    setProbing(true);
    const nextResults = {};
    for (const endpoint of endpoints) {
      const startedAt = performance.now();
      try {
        const response = await api.get(endpoint.path, { validateStatus: status => status >= 200 && status < 600 });
        nextResults[endpoint.id] = {
          ok: response.status >= 200 && response.status < 400,
          status: response.status,
          durationMs: Math.round(performance.now() - startedAt),
          bytes: getPayloadBytes(response.data),
          checkedAt: new Date().toISOString(),
          data: sanitizePayload(response.data)
        };
      } catch (error) {
        nextResults[endpoint.id] = {
          ok: false,
          status: error.response?.status || 0,
          durationMs: Math.round(performance.now() - startedAt),
          bytes: getPayloadBytes(error.response?.data),
          checkedAt: new Date().toISOString(),
          error: error.userMessage || error.message || 'Falha na requisição'
        };
      }
      setProbeResults({ ...nextResults });
    }
    setProbing(false);
    const failedCount = Object.values(nextResults).filter(result => !result.ok).length;
    showToast?.(
      failedCount ? `${failedCount} endpoint${failedCount > 1 ? 's' : ''} apresentou falha.` : 'Testes dos endpoints concluídos.',
      failedCount ? 'warning' : 'success'
    );
  };

  /**
   * Copia o payload selecionado já formatado para leitura humana.
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
  const copyActivePayload = async () => {
    try {
      await copyText(JSON.stringify(activePayload, null, 2));
      showToast?.('Payload copiado.', 'success');
    } catch {
      showToast?.('Não foi possível copiar o payload.', 'warning');
    }
  };

  /**
   * Exporta o estado técnico atual sem token, senha ou conteúdo de banco.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const exportDiagnosticBundle = () => {
    downloadJson(`termosync-diagnostico-${Date.now()}.json`, {
      generatedAt: new Date().toISOString(),
      apiBaseUrl: api?.defaults?.baseURL || null,
      health: health || null,
      host: host || null,
      socketConnected,
      client,
      endpointProbes: probeResults,
      recentChecks: recentChecks.slice(0, 30)
    });
    showToast?.('Bundle técnico exportado.', 'success');
  };

  const readiness = [
    { label: 'API responde', ok: !isOffline && health?.status === 'ok' },
    { label: 'Banco conectado', ok: health?.database === 'online' },
    { label: 'Socket conectado', ok: socketConnected === true },
    { label: 'Heap abaixo de 85%', ok: health?.memory?.heapTotalMb ? (health.memory.heapUsedMb / health.memory.heapTotalMb) < 0.85 : false },
    { label: 'Host identificado', ok: Boolean(host?.os?.hostname) }
  ];

  return (
    <section className="health-section health-dev-workbench" aria-labelledby="health-dev-title">
      <div className="health-section-heading health-dev-heading">
        <div><h3 id="health-dev-title"><Code2 size={18} /> Workbench do desenvolvedor</h3><span>Testes GET, payloads e contexto para reprodução de falhas</span></div>
        <button type="button" className="health-filter" onClick={exportDiagnosticBundle}><Download size={15} /> Exportar bundle</button>
      </div>

      <div className="health-dev-readiness" aria-label="Checklist de prontidão técnica">
        {readiness.map(item => <span className={item.ok ? 'good' : 'bad'} key={item.label}>{item.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}{item.label}</span>)}
      </div>

      <div className="health-dev-layout">
        <div className="health-dev-panel">
          <div className="health-panel-title">
            <div><FlaskConical size={16} /><strong>Teste de endpoints</strong></div>
            <button type="button" className="health-dev-run" onClick={runEndpointProbes} disabled={probing || isOffline}>
              {probing ? <Loader2 className="spinner" size={15} /> : <Play size={15} />}{probing ? 'Executando' : 'Executar todos'}
            </button>
          </div>
          <div className="health-endpoint-table">
            <div className="health-endpoint-head"><span>Endpoint</span><span>HTTP</span><span>Tempo</span><span>Resposta</span></div>
            {endpoints.map(endpoint => {
              const result = probeResults[endpoint.id];
              return (
                <div className="health-endpoint-row" key={endpoint.id}>
                  <div><strong>{endpoint.label}</strong><code>GET {endpoint.path}</code></div>
                  <span className={result ? (result.ok ? 'good' : 'bad') : 'neutral'}>{result ? result.status || 'ERR' : endpoint.expected}</span>
                  <span>{result ? `${result.durationMs} ms` : '—'}</span>
                  <span>{result ? formatBytes(result.bytes) : '—'}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="health-dev-panel health-payload-panel">
          <div className="health-panel-title">
            <div><FileJson size={16} /><strong>Payload inspector</strong></div>
            <button type="button" className="health-dev-icon" onClick={copyActivePayload} title="Copiar payload" aria-label="Copiar payload"><Clipboard size={15} /></button>
          </div>
          <div className="health-payload-tabs" role="tablist" aria-label="Payload para inspecionar">
            {Object.keys(payloads).map(key => <button type="button" role="tab" aria-selected={payloadTab === key} className={payloadTab === key ? 'active' : ''} onClick={() => setPayloadTab(key)} key={key}>{key}</button>)}
          </div>
          <pre className="health-payload-code" tabIndex="0"><code>{JSON.stringify(activePayload, null, 2)}</code></pre>
        </div>
      </div>

      <div className="health-client-context">
        <div className="health-panel-title"><div><MonitorSmartphone size={16} /><strong>Ambiente do cliente</strong></div><span>Capturado ao abrir a tela</span></div>
        <dl>
          <div><dt>API base</dt><dd>{api?.defaults?.baseURL || 'Não informada'}</dd></div>
          <div><dt>Viewport</dt><dd>{client.viewport} · DPR {client.pixelRatio}</dd></div>
          <div><dt>Tela</dt><dd>{client.screen}</dd></div>
          <div><dt>Rede do navegador</dt><dd>{client.online ? 'Online' : 'Offline'}</dd></div>
          <div><dt>Idioma / fuso</dt><dd>{client.language} · {client.timezone}</dd></div>
          <div><dt>Plataforma</dt><dd>{client.platform}</dd></div>
          <div className="health-client-wide"><dt>User agent</dt><dd>{client.userAgent}</dd></div>
          <div className="health-client-wide"><dt>Origem</dt><dd><ExternalLink size={13} /> {window.location.origin}</dd></div>
        </dl>
      </div>
    </section>
  );
}
