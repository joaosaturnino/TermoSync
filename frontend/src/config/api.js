/**
 * Configuração centralizada de API — Web + Mobile (Capacitor) Detecta automaticamente o
 * servidor ou usa configuração manual.
 */
const STORAGE_KEY = 'termosync_server';
const DEFAULT_API_PORT = import.meta.env.VITE_API_PORT || '3001';

/**
 * Normaliza normalize base para evitar divergencia de formato nas comparacoes.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} url - Valor de url consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function normalizeBase(url) {
  if (!url) return '';
  return url.replace(/\/+$/, '').replace(/\/api$/, '');
}

/**
 * Recupera o servidor salvo no navegador sem quebrar em ambientes sem localStorage.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: lê ou grava preferências no armazenamento do navegador
 *
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function getStoredServer() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Migra URLs antigas de desenvolvimento que ainda apontam para a porta 3000.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador
 *
 * @param {unknown} url - Valor de url consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function migrateLocalDevServer(url) {
  if (!url || DEFAULT_API_PORT === '3000') return url;
  try {
    const parsed = new URL(url);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname.endsWith('.localhost');
    if (isLocal && parsed.port === '3000') {
      parsed.port = DEFAULT_API_PORT;
      const migrated = normalizeBase(parsed.toString());
      localStorage.setItem(STORAGE_KEY, migrated);
      return migrated;
    }
  } catch {
    return url;
  }
  return url;
}

/**
 * Persiste a URL base do backend informada manualmente pelo usuário.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; lê ou grava preferências no armazenamento do navegador
 *
 * @param {unknown} url - Valor de url consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function setServerUrl(url) {
  const base = normalizeBase(url);
  if (base) {
    localStorage.setItem(STORAGE_KEY, base);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  return base;
}

/**
 * Resolve a URL base do servidor considerando env, configuração salva, web e mobile.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: interage com APIs do navegador
 *
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function getServerUrl() {
  if (import.meta.env.VITE_API_URL) {
    return normalizeBase(import.meta.env.VITE_API_URL);
  }

  const stored = migrateLocalDevServer(getStoredServer());
  if (stored) return normalizeBase(stored);

  const { hostname, protocol } = window.location;

  // O dominio local usa o proxy HTTPS do frontend para API e Socket.IO.
  if (hostname === 'thermosync.com.br') {
    return `${protocol}//${hostname}`;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://localhost:${DEFAULT_API_PORT}`;
  }

  if (hostname.endsWith('.localhost')) {
    return `http://localhost:${DEFAULT_API_PORT}`;
  }

  if (isCapacitor()) {
    return `http://10.0.2.2:${DEFAULT_API_PORT}`;
  }

  const proto = protocol === 'https:' ? 'https' : 'http';
  return `${proto}://${hostname}:${DEFAULT_API_PORT}`;
}

/**
 * Monta a URL raiz da API REST a partir do servidor resolvido.
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
export function getApiUrl() {
  return `${getServerUrl()}/api`;
}

/**
 * Retorna a URL usada pelo Socket.io, sem acrescentar o sufixo /api.
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
export function getSocketUrl() {
  return getServerUrl();
}

/**
 * Detecta execução em aplicativo nativo Capacitor.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 *
 * Efeitos colaterais: interage com APIs do navegador
 *
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function isCapacitor() {
  try {
    return window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/**
 * Identifica se a interface está em contexto mobile por Capacitor ou largura de tela.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: interage com APIs do navegador
 *
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function isMobileDevice() {
  if (isCapacitor()) return true;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(max-width: 768px)').matches;
  }
  return window.innerWidth <= 768;
}

/**
 * Indica quando o app mobile precisa pedir a configuração manual do servidor.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
export function needsServerConfig() {
  if (import.meta.env.VITE_API_URL) return false;
  if (getStoredServer()) return false;
  return isCapacitor();
}
