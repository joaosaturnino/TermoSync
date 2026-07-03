/**
 * Configuração centralizada de API — Web + Mobile (Capacitor)
 * Detecta automaticamente o servidor ou usa configuração manual.
 */

const STORAGE_KEY = 'termosync_server';

function normalizeBase(url) {
  if (!url) return '';
  return url.replace(/\/+$/, '').replace(/\/api$/, '');
}

function getStoredServer() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setServerUrl(url) {
  const base = normalizeBase(url);
  if (base) {
    localStorage.setItem(STORAGE_KEY, base);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  return base;
}

export function getServerUrl() {
  if (import.meta.env.VITE_API_URL) {
    return normalizeBase(import.meta.env.VITE_API_URL);
  }

  const stored = getStoredServer();
  if (stored) return normalizeBase(stored);

  const { hostname, protocol } = window.location;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  if (hostname.endsWith('.localhost')) {
    return 'http://localhost:3000';
  }

  if (isCapacitor()) {
    return 'http://10.0.2.2:3000';
  }

  const proto = protocol === 'https:' ? 'https' : 'http';
  return `${proto}://${hostname}:3000`;
}

export function getApiUrl() {
  return `${getServerUrl()}/api`;
}

export function getSocketUrl() {
  return getServerUrl();
}

export function isCapacitor() {
  try {
    return window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

export function isMobileDevice() {
  if (isCapacitor()) return true;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(max-width: 768px)').matches;
  }
  return window.innerWidth <= 768;
}

export function needsServerConfig() {
  if (import.meta.env.VITE_API_URL) return false;
  if (getStoredServer()) return false;
  return isCapacitor();
}
