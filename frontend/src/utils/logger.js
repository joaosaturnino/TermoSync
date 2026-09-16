const isProd = process.env.NODE_ENV === 'production';

/**
 * Concentra a logica de info para manter o restante do utilitario mais legivel.
 */
function info(...args) {
  if (!isProd) console.info(...args);
}

/**
 * Concentra a logica de warn para manter o restante do utilitario mais legivel.
 */
function warn(...args) {
  if (!isProd) console.warn(...args);
}

/**
 * Concentra a logica de error para manter o restante do utilitario mais legivel.
 */
function error(...args) {
  // always log errors to console to help debugging even in prod
  console.error(...args);
}

export default { info, warn, error };
