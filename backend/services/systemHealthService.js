/**
 * Módulo: backend/services/systemHealthService.js
 * Responsabilidade: Encapsula integrações e regras de serviço de system Health Service.
 */

const os = require('os');
const { performance } = require('perf_hooks');
const pool = require('../config/db');

let previousCpuUsage = process.cpuUsage();
let previousCpuAt = process.hrtime.bigint();
let previousEventLoopUtilization = performance.eventLoopUtilization();

/**
 * Executa a rotina de servico collect Process Cpu Percent e devolve os dados para quem chamou.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function collectProcessCpuPercent() {
  const now = process.hrtime.bigint();
  const usage = process.cpuUsage(previousCpuUsage);
  const elapsedMicros = Number(now - previousCpuAt) / 1000;
  previousCpuUsage = process.cpuUsage();
  previousCpuAt = now;
  if (!elapsedMicros) return 0;
  return Number(Math.min(999.99, ((usage.user + usage.system) / elapsedMicros) * 100).toFixed(2));
}

/**
 * Mede a proporção de tempo em que o event loop esteve ocupado desde a última amostra.
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
function collectEventLoopUtilization() {
  const current = performance.eventLoopUtilization(previousEventLoopUtilization);
  previousEventLoopUtilization = performance.eventLoopUtilization();
  return Number((current.utilization * 100).toFixed(2));
}


/**
 * Executa a rotina de servico get System Health Snapshot e devolve os dados para quem chamou.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência; publica ou consome mensagens MQTT
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.mqttConnected - Propriedade mqttConnected usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.whatsappStatus - Propriedade whatsappStatus usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.socketClients - Propriedade socketClients usada para configurar dados ou comportamento do componente.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function getSystemHealthSnapshot({ mqttConnected = null, whatsappStatus = 'unknown', socketClients = 0 } = {}) {
  const startedAt = Date.now();
  const memory = process.memoryUsage();
  const databaseStartedAt = Date.now();

  try {
    const [dbCheck] = await pool.execute('SELECT 1 AS ok');
    const databaseLatencyMs = Date.now() - databaseStartedAt;
    const dbHealthy = Array.isArray(dbCheck) && dbCheck.length > 0 && Number(dbCheck[0]?.ok) === 1;

    const payload = {
      ok: dbHealthy,
      status: dbHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Number((process.uptime() || 0).toFixed(0)),
      responseTimeMs: Date.now() - startedAt,
      databaseLatencyMs,
      cpuPercent: collectProcessCpuPercent(),
      eventLoopUtilization: collectEventLoopUtilization(),
      memory: {
        rssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
        heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
        externalMb: Number((memory.external / 1024 / 1024).toFixed(2)),
        arrayBuffersMb: Number((memory.arrayBuffers / 1024 / 1024).toFixed(2))
      },
      host: {
        freeMemoryMb: Number((os.freemem() / 1024 / 1024).toFixed(0)),
        totalMemoryMb: Number((os.totalmem() / 1024 / 1024).toFixed(0)),
        loadAverage: os.loadavg().map(value => Number(value.toFixed(2)))
      },
      runtime: {
        nodeVersion: process.version,
        pid: process.pid,
        environment: process.env.NODE_ENV || 'development',
        activeHandles: typeof process._getActiveHandles === 'function' ? process._getActiveHandles().length : null,
        activeRequests: typeof process._getActiveRequests === 'function' ? process._getActiveRequests().length : null,
        socketClients: Number(socketClients || 0)
      },
      database: dbHealthy ? 'online' : 'offline',
      mqtt: mqttConnected === true ? 'online' : mqttConnected === false ? 'offline' : 'unknown',
      whatsapp: whatsappStatus,
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
      databaseLatencyMs: Date.now() - databaseStartedAt,
      cpuPercent: collectProcessCpuPercent(),
      eventLoopUtilization: collectEventLoopUtilization(),
      memory: {
        rssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
        heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
        externalMb: Number((memory.external / 1024 / 1024).toFixed(2)),
        arrayBuffersMb: Number((memory.arrayBuffers / 1024 / 1024).toFixed(2))
      },
      host: {
        freeMemoryMb: Number((os.freemem() / 1024 / 1024).toFixed(0)),
        totalMemoryMb: Number((os.totalmem() / 1024 / 1024).toFixed(0)),
        loadAverage: os.loadavg().map(value => Number(value.toFixed(2)))
      },
      runtime: {
        nodeVersion: process.version,
        pid: process.pid,
        environment: process.env.NODE_ENV || 'development',
        activeHandles: typeof process._getActiveHandles === 'function' ? process._getActiveHandles().length : null,
        activeRequests: typeof process._getActiveRequests === 'function' ? process._getActiveRequests().length : null,
        socketClients: Number(socketClients || 0)
      },
      database: 'offline',
      mqtt: 'unknown',
      whatsapp: whatsappStatus,
      platform: 'ThermoSync Enterprise',
      error: error.message || 'Health check falhou'
    };
  }
}

module.exports = { getSystemHealthSnapshot };
