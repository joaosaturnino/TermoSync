const pool = require('../config/db');

/**
 * Executa a rotina de servico get System Health Snapshot e devolve os dados para quem chamou.
 */
async function getSystemHealthSnapshot() {
  const startedAt = Date.now();
  const memory = process.memoryUsage();

  try {
    const [dbCheck] = await pool.execute('SELECT 1 AS ok');
    const dbHealthy = Array.isArray(dbCheck) && dbCheck.length > 0 && Number(dbCheck[0]?.ok) === 1;

    const payload = {
      ok: dbHealthy,
      status: dbHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Number((process.uptime() || 0).toFixed(0)),
      responseTimeMs: Date.now() - startedAt,
      memory: {
        rssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
        heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((memory.heapTotal / 1024 / 1024).toFixed(2))
      },
      database: dbHealthy ? 'online' : 'offline',
      mqtt: 'online',
      whatsapp: 'unknown',
      platform: 'ThermoSync Enterprise'
    };

    return payload;
  } catch (error) {
    return {
      ok: false,
      status: 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Number((process.uptime() || 0).toFixed(0)),
      responseTimeMs: Date.now() - startedAt,
      memory: {
        rssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
        heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((memory.heapTotal / 1024 / 1024).toFixed(2))
      },
      database: 'offline',
      mqtt: 'unknown',
      whatsapp: 'unknown',
      platform: 'ThermoSync Enterprise',
      error: error.message || 'Health check falhou'
    };
  }
}

module.exports = { getSystemHealthSnapshot };
