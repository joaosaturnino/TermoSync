/**
 * Configuração centralizada de API — Web + Mobile (Capacitor)
 * Detecta automaticamente o servidor ou usa configuração manual.
 */

const STORAGE_KEY = 'termosync_server';
const DEFAULT_API_PORT = import.meta.env.VITE_API_PORT || '3001';

/**
 * Remove barras finais e o sufixo /api para manter uma URL base consistente.
 */
function normalizeBase(url) {
  if (!url) return '';
  return url.replace(/\/+$/, '').replace(/\/api$/, '');
}

/**
 * Recupera o servidor salvo no navegador sem quebrar em ambientes sem localStorage.
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
 */
export function getServerUrl() {
  if (import.meta.env.VITE_API_URL) {
    return normalizeBase(import.meta.env.VITE_API_URL);
  }

  const stored = migrateLocalDevServer(getStoredServer());
  if (stored) return normalizeBase(stored);

  const { hostname, protocol } = window.location;

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
 */
export function getApiUrl() {
  return `${getServerUrl()}/api`;
}

/**
 * Retorna a URL usada pelo Socket.io, sem acrescentar o sufixo /api.
 */
export function getSocketUrl() {
  return getServerUrl();
}

/**
 * Detecta execução em aplicativo nativo Capacitor.
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
 */
export function needsServerConfig() {
  if (import.meta.env.VITE_API_URL) return false;
  if (getStoredServer()) return false;
  return isCapacitor();
}
