#!/usr/bin/env node

/**
 * Módulo: backend/agents/networkProbeAgent.js
 * Responsabilidade: Centraliza as responsabilidades do módulo network Probe Agent.
 */

const os = require('os');
const net = require('net');
const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');

require('dotenv').config({
  path: process.env.PROBE_ENV_FILE || path.join(__dirname, 'network-probe.env')
});

const execFileAsync = promisify(execFile);
const VERSION = '1.0.0';
const API_URL = String(process.env.PROBE_API_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const TOKEN = String(process.env.PROBE_AGENT_TOKEN || '');
const AGENT_ID = String(process.env.PROBE_AGENT_ID || os.hostname()).trim();
const FILIAL = String(process.env.PROBE_FILIAL || '').trim();
const POLL_INTERVAL_MS = Math.max(5000, Number(process.env.PROBE_POLL_INTERVAL_MS || 15000));
const MAX_HOSTS = Math.max(1, Math.min(4096, Number(process.env.PROBE_MAX_HOSTS || 1024)));
const CONCURRENCY = Math.max(1, Math.min(64, Number(process.env.PROBE_CONCURRENCY || 16)));
const DEFAULT_PORTS = [80, 443, 1883, 8883];

/**
 * Concentra a logica de ipv4 to integer para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} ipAddress - Valor de ip address consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function ipv4ToInteger(ipAddress) {
  return ipAddress.split('.').reduce((total, octet) => ((total << 8) + Number(octet)) >>> 0, 0);
}


/**
 * Concentra a logica de integer to ipv4 para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function integerToIpv4(value) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}


/**
 * Verifica a condicao is private ipv4 e retorna um valor booleano.
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
 * @param {unknown} ipAddress - Valor de ip address consumido por esta rotina.
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function isPrivateIpv4(ipAddress) {
  if (net.isIP(ipAddress) !== 4) return false;
  const [first, second] = ipAddress.split('.').map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || (first === 169 && second === 254);
}


/**
 * Concentra a logica de netmask to prefix para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} netmask - Valor de netmask consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function netmaskToPrefix(netmask) {
  return netmask.split('.').map(Number).reduce((total, octet) => total + octet.toString(2).replace(/0/g, '').length, 0);
}


/**
 * Concentra a logica de cidr contains para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} cidr - Valor de cidr consumido por esta rotina.
 * @param {unknown} ipAddress - Valor de ip address consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function cidrContains(cidr, ipAddress) {
  const [networkAddress, prefixText] = String(cidr || '').split('/');
  const prefix = Number(prefixText);
  if (net.isIP(networkAddress) !== 4 || net.isIP(ipAddress) !== 4 || !Number.isInteger(prefix)) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToInteger(networkAddress) & mask) === (ipv4ToInteger(ipAddress) & mask);
}


/**
 * Concentra a logica de expand cidr para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} cidr - Valor de cidr consumido por esta rotina.
 * @param {unknown} limit - Valor de limit consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function expandCidr(cidr, limit = MAX_HOSTS) {
  const [address, prefixText] = String(cidr || '').split('/');
  const prefix = Number(prefixText);
  if (!isPrivateIpv4(address) || !Number.isInteger(prefix) || prefix < 16 || prefix > 32) return [];
   /**
    * Concentra a logica de mask para manter o restante do modulo mais legivel.
    *
    * Responsabilidade: mantém este comportamento isolado para que validação,
    * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
    *
    * Fluxo principal:
    * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
    *
    * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
    *
    * @param {number} index - Posição do item dentro da coleção atual.
    * @returns {unknown} Resultado calculado para consumo do chamador.
    * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
    */

  /**
   * Concentra a logica de mask para manter o restante do modulo mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {number} index - Posição do item dentro da coleção atual.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  const networkAddress = ipv4ToInteger(address) & mask;
  const total = 2 ** (32 - prefix);
  const firstOffset = prefix <= 30 ? 1 : 0;
  const usable = Math.max(1, total - (prefix <= 30 ? 2 : 0));
  return Array.from({ length: Math.min(limit, usable) }, (_, index) => integerToIpv4((networkAddress + firstOffset + index) >>> 0));
}

/**
 * Lê interfaces reais do Linux e identifica aquela usada pela rota padrão.
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
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function detectNetwork() {
  let defaultRoute = null;
  try {
    const { stdout } = await execFileAsync('ip', ['-4', 'route', 'show', 'default'], { timeout: 2500 });
    const match = stdout.match(/default\s+via\s+(\d+\.\d+\.\d+\.\d+)\s+dev\s+(\S+)/);
    if (match) defaultRoute = { gateway: match[1], interfaceName: match[2] };
  } catch (_error) {
    defaultRoute = null;
  }

  const interfaces = Object.entries(os.networkInterfaces()).flatMap(([name, entries]) =>
    (entries || []).filter((item) => item.family === 'IPv4' && !item.internal && isPrivateIpv4(item.address)).map((item) => {
      const prefix = netmaskToPrefix(item.netmask);
       /**
        * Concentra a logica de mask para manter o restante do modulo mais legivel.
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

      /**
       * Concentra a logica de mask para manter o restante do modulo mais legivel.
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
      const mask = (0xffffffff << (32 - prefix)) >>> 0;
      return {
        name,
        address: item.address,
        mac: item.mac,
        cidr: `${integerToIpv4(ipv4ToInteger(item.address) & mask)}/${prefix}`,
        gateway: name === defaultRoute?.interfaceName ? defaultRoute.gateway : null,
        isDefault: name === defaultRoute?.interfaceName
      };
    })
  );
  const preferred = interfaces.find((item) => item.isDefault) || interfaces[0] || null;
  return { interfaces, preferred, gateway: defaultRoute?.gateway || null };
}


/**
 * Concentra a logica de api request para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: consulta ou altera dados pela API
 *
 * @param {unknown} pathname - Valor de pathname consumido por esta rotina.
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function apiRequest(pathname, options = {}) {
  const response = await fetch(`${API_URL}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'X-Probe-Agent-Id': AGENT_ID,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(Number(options.timeoutMs || 15000))
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `API respondeu HTTP ${response.status}`);
  return payload;
}


/**
 * Concentra a logica de probe port para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; troca eventos em tempo real
 *
 * @param {unknown} ipAddress - Valor de ip address consumido por esta rotina.
 * @param {unknown} port - Valor de port consumido por esta rotina.
 * @param {unknown} localAddress - Valor de local address consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function probePort(ipAddress, port, localAddress) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const startedAt = Date.now();
    let settled = false;

    /**
     * Concentra a logica de finish para manter o restante do modulo mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     *
     * Efeitos colaterais: troca eventos em tempo real
     *
     * @param {unknown} open - Valor de open consumido por esta rotina.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ porta: port, open, latencyMs: open ? Date.now() - startedAt : null });
    };
    socket.setTimeout(600);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect({ host: ipAddress, port, ...(localAddress ? { localAddress } : {}) });
  });
}


/**
 * Concentra a logica de inspect esp para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: consulta ou altera dados pela API
 *
 * @param {unknown} ipAddress - Valor de ip address consumido por esta rotina.
 * @param {unknown} ports - Valor de ports consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function inspectEsp(ipAddress, ports) {
  if (!ports.some((item) => item.porta === 80)) return null;
  try {
    const response = await fetch(`http://${ipAddress}/health`, { signal: AbortSignal.timeout(1200) });
    if (!response.ok) return null;
    const health = await response.json();
    const looksLikeEsp = health.device_uuid || health.firmware_version || health.heap_livre || health.mqtt_ok !== undefined;
    return looksLikeEsp ? health : null;
  } catch (_error) {
    return null;
  }
}

/**
 * Varre endereços com concorrência limitada para não sobrecarregar o Raspberry.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} addresses - Valor de addresses consumido por esta rotina.
 * @param {unknown} ports - Valor de ports consumido por esta rotina.
 * @param {unknown} network - Valor de network consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function scanAddresses(addresses, ports, network) {
  const results = [];
  let cursor = 0;

  /**
   * Concentra a logica de worker para manter o restante do modulo mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const worker = async () => {
    while (cursor < addresses.length) {
      const ipAddress = addresses[cursor++];
      const directInterface = network.interfaces.find((item) => cidrContains(item.cidr, ipAddress));
      const sourceAddress = directInterface?.address || network.preferred?.address;
      const checks = await Promise.all(ports.map((port) => probePort(ipAddress, port, sourceAddress)));
      const openPorts = checks.filter((item) => item.open).map(({ porta, latencyMs }) => ({ porta, latencyMs }));
      if (!openPorts.length) continue;
      const edgeHealth = await inspectEsp(ipAddress, openPorts);
      results.push({
        ip: ipAddress,
        hostname: edgeHealth?.device_uuid ? `ESP ${edgeHealth.device_uuid}` : 'Host detectado pelo Raspberry',
        portas: openPorts,
        latencyMs: Math.min(...openPorts.map((item) => item.latencyMs || 0)),
        sourceAddress,
        espDetected: Boolean(edgeHealth),
        edgeHealth
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, addresses.length) }, worker));
  return results;
}


/**
 * Envia send heartbeat para o canal ou provedor configurado.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} network - Valor de network consumido por esta rotina.
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function sendHeartbeat(network) {
  await apiRequest('/api/soc/scanner/agent/heartbeat', {
    method: 'POST',
    body: JSON.stringify({
      filial: FILIAL,
      hostname: os.hostname(),
      platform: os.platform(),
      architecture: os.arch(),
      version: VERSION,
      localIp: network.preferred?.address,
      gateway: network.gateway,
      cidr: network.preferred?.cidr,
      interfaces: network.interfaces,
      metadata: { uptimeSeconds: Math.round(os.uptime()), loadAverage: os.loadavg(), nodeVersion: process.version }
    })
  });
}


/**
 * Concentra a logica de execute job para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: registra informações de diagnóstico
 *
 * @param {unknown} job - Valor de job consumido por esta rotina.
 * @param {unknown} iotDevices - Valor de iot devices consumido por esta rotina.
 * @param {unknown} network - Valor de network consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function executeJob(job, iotDevices, network) {
  const connectedCidr = network.preferred?.cidr;
  if (!connectedCidr) throw new Error('O Raspberry não possui uma interface IPv4 privada ativa.');
  const manualCidr = job.network_mode === 'MANUAL' && network.interfaces.some((item) => cidrContains(item.cidr, String(job.ip_range).split('/')[0]))
    ? job.ip_range
    : null;
  const scanCidr = manualCidr || connectedCidr;
  const ports = Array.isArray(job.ports) && job.ports.length ? job.ports : DEFAULT_PORTS;
   /**
    * Concentra a logica de registered para manter o restante do modulo mais legivel.
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

  /**
   * Concentra a logica de registered para manter o restante do modulo mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const registered = (iotDevices || []).filter((item) => isPrivateIpv4(String(item.ip || '').trim()));
  const targets = [...new Set([...expandCidr(scanCidr), ...registered.map((item) => String(item.ip).trim())])];
  const probed = await scanAddresses(targets, ports, network);
  const probedByIp = new Map(probed.map((item) => [item.ip, item]));
  const registeredIps = new Set(registered.map((item) => String(item.ip).trim()));
  const discovered = probed.filter((item) => !registeredIps.has(item.ip));
  const registeredResults = registered.map((item) => {
    const probe = probedByIp.get(String(item.ip).trim());
    const lastSeenAt = item.last_seen ? new Date(item.last_seen).getTime() : 0;
    const telemetryOnline = lastSeenAt > 0 && Date.now() - lastSeenAt <= 180000;
    const networkReachable = Boolean(probe?.portas?.length);
    return {
      ...probe,
      ip: String(item.ip).trim(),
      hostname: item.nome || `IoT #${item.equipamento_id}`,
      portas: probe?.portas || [],
      registeredIot: true,
      equipamentoId: item.equipamento_id,
      macAddress: item.mac,
      status: networkReachable && telemetryOnline ? 'Online' : telemetryOnline ? 'Telemetria ativa' : networkReachable ? 'IP acessível' : 'Sem resposta',
      sourceAddress: probe?.sourceAddress || network.interfaces.find((entry) => cidrContains(entry.cidr, String(item.ip)))?.address || network.preferred.address
    };
  });
  await apiRequest(`/api/soc/scanner/agent/jobs/${job.id}/complete`, {
    method: 'POST',
    timeoutMs: 60000,
    body: JSON.stringify({ filial: FILIAL, cidr: scanCidr, devices: [...registeredResults, ...discovered] })
  });
  console.log(`[PROBE] Job #${job.id} concluído: ${targets.length} IPs, ${registeredResults.length} IoT, ${discovered.length} host(s) adicional(is).`);
}

let stopping = false;
let cycleTimer = null;

/**
 * Concentra a logica de cycle para manter o restante do modulo mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; registra informações de diagnóstico
 *
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function cycle() {
  try {
    const network = await detectNetwork();
    await sendHeartbeat(network);
    const work = await apiRequest(`/api/soc/scanner/agent/work?filial=${encodeURIComponent(FILIAL)}`);
    if (work.job) {
      try {
        await executeJob(work.job, work.iotDevices, network);
      } catch (error) {
        await apiRequest(`/api/soc/scanner/agent/jobs/${work.job.id}/fail`, {
          method: 'POST', body: JSON.stringify({ error: error.message })
        }).catch(() => {});
        throw error;
      }
    }
  } catch (error) {
    console.error(`[PROBE] ${new Date().toISOString()} ${error.message}`);
  } finally {
    if (!stopping) cycleTimer = setTimeout(cycle, POLL_INTERVAL_MS);
  }
}

if (!TOKEN || !FILIAL) {
  console.error('[PROBE] Configure PROBE_AGENT_TOKEN e PROBE_FILIAL antes de iniciar.');
  process.exitCode = 1;
} else {
  console.log(`[PROBE] Agente ${AGENT_ID} v${VERSION} iniciado para ${FILIAL}.`);
  cycle();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    if (cycleTimer) clearTimeout(cycleTimer);
    console.log(`[PROBE] Encerrando após ${signal}.`);
  });
}
