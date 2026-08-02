const isProd = process.env.NODE_ENV === 'production';

function info(...args) {
  if (!isProd) console.info(...args);
}

function warn(...args) {
  if (!isProd) console.warn(...args);
}

function error(...args) {
  // always log errors to console to help debugging even in prod
  console.error(...args);
}

export default { info, warn, error };
