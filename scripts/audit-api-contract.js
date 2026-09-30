/** Compara chamadas HTTP locais do frontend com as rotas Express registradas no backend. */
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const frontendRoot = path.join(projectRoot, 'frontend', 'src');
const backendSource = readFileSync(path.join(projectRoot, 'backend', 'routes', 'api.js'), 'utf8');
const httpMethods = 'get|post|put|patch|delete';

function listSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolutePath);
    return entry.isFile() && /\.(?:js|jsx)$/.test(entry.name) ? [absolutePath] : [];
  });
}

function normalizeRoute(rawRoute, usesApiClient = false) {
  let route = String(rawRoute || '').trim();
  route = route.replace(/\$\{\s*getApiUrl\(\)\s*\}/g, '');
  route = route.replace(/\$\{\s*(?:query|searchParams|params)\s*\}/g, '');
  route = route.replace(/\$\{[^}]+\}/g, ':param');
  route = route.split('?')[0];
  if (!route.startsWith('/') || /^(?:https?:|ws:)/i.test(route)) return null;
  if (usesApiClient && !route.startsWith('/api/')) route = `/api${route}`;
  if (!route.startsWith('/api/') && route !== '/logs' && route !== '/clear') return null;
  return route.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
}

function routeMatches(registeredPath, requestedPath) {
  const registered = registeredPath.split('/');
  const requested = requestedPath.split('/');
  if (registered.length !== requested.length) return false;
  return registered.every((segment, index) => {
    if (requested[index] === ':param') return segment.startsWith(':');
    return segment.startsWith(':') || segment === requested[index];
  });
}

function listBackendRoutes() {
  const pattern = new RegExp(`app\\.(${httpMethods})\\(\\s*(['\"])([^'\"]+)\\2`, 'g');
  return [...backendSource.matchAll(pattern)].map((match) => ({
    method: match[1].toUpperCase(),
    path: match[3]
  }));
}

function listFrontendCalls() {
  const calls = [];
  const unresolved = [];
  const clientPattern = new RegExp(`\\b(api|axios)\\.(${httpMethods})\\s*\\(\\s*(?:\`([^\`]*)\`|'([^']*)'|\"([^\"]*)\")`, 'g');
  const anyClientCallPattern = new RegExp(`\\b(api|axios)\\.(${httpMethods})\\s*\\(`, 'g');
  const fetchPattern = /\bfetch\s*\(\s*(?:`([^`]*)`|'([^']*)'|"([^"]*)")\s*(?:,\s*([\s\S]{0,500}?))?\)/g;

  listSourceFiles(frontendRoot).forEach((file) => {
    const source = readFileSync(file, 'utf8');
    const relativeFile = path.relative(projectRoot, file).replaceAll('\\', '/');
    const extractedPositions = new Set();
    let dynamicAllowance = [...source.matchAll(/@api-contract-dynamic\b/g)].length;

    for (const match of source.matchAll(clientPattern)) {
      extractedPositions.add(match.index);
      const route = normalizeRoute(match[3] ?? match[4] ?? match[5], match[1] === 'api');
      if (route) calls.push({ method: match[2].toUpperCase(), path: route, file: relativeFile });
    }

    for (const match of source.matchAll(anyClientCallPattern)) {
      if (!extractedPositions.has(match.index) && dynamicAllowance > 0) {
        dynamicAllowance -= 1;
      } else if (!extractedPositions.has(match.index)) {
        const line = source.slice(0, match.index).split('\n').length;
        unresolved.push({ method: match[2].toUpperCase(), file: relativeFile, line });
      }
    }

    for (const match of source.matchAll(/@api-contract\s+(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/[^\s*]+)/g)) {
      calls.push({ method: match[1], path: match[2], file: relativeFile });
    }

    for (const match of source.matchAll(fetchPattern)) {
      const route = normalizeRoute(match[1] ?? match[2] ?? match[3]);
      if (!route) continue;
      const method = match[4]?.match(/method\s*:\s*['"](GET|POST|PUT|PATCH|DELETE)['"]/i)?.[1]?.toUpperCase() || 'GET';
      calls.push({ method, path: route, file: relativeFile });
    }
  });

  return { calls, unresolved };
}

function auditApiContract() {
  const backendRoutes = listBackendRoutes();
  const { calls, unresolved } = listFrontendCalls();
  const uniqueCalls = [...new Map(calls.map((call) => [`${call.method} ${call.path}`, call])).values()];
  const missing = uniqueCalls.filter((call) => !backendRoutes.some((route) => (
    route.method === call.method && routeMatches(route.path, call.path)
  )));

  return {
    backendRouteCount: backendRoutes.length,
    frontendCallCount: uniqueCalls.length,
    missing,
    unresolved
  };
}

if (require.main === module) {
  const result = auditApiContract();
  console.log(JSON.stringify(result, null, 2));
  if (result.missing.length || result.unresolved.length) process.exitCode = 1;
}

module.exports = { auditApiContract, listBackendRoutes, listFrontendCalls, normalizeRoute, routeMatches };
