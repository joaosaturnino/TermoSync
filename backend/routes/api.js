/**
 * Módulo: backend/routes/api.js
 * Responsabilidade: Registra os endpoints HTTP, aplica autorização e coordena o acesso aos serviços e ao banco.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const {
  verificarToken,
  SECRET_KEY,
  invalidateAllSessionCaches,
  invalidateSessionCache,
  invalidateUserSessions
} = require('../middlewares/auth');
const pool = require('../config/db');
const { registrarAuditoria, registrarEventoSeguranca, registrarHistoricoSuporte } = require('../utils/audit');
const { getSystemHealthSnapshot } = require('../services/systemHealthService');
const { montarComandoMqtt, validarTelemetria } = require('../services/iotProtocol');
const {
  clearFailedLogin,
  createRateLimiter,
  isLoginLocked,
  isStrongPassword,
  normalizeCredential,
  recordFailedLogin,
  ROLE_PERMISSIONS,
  requirePermission,
  requireRoles
} = require('../middlewares/security');
const { createOtpAuthUrl, generateTotpSecret, verifyTotp } = require('../utils/mfa');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const { exec } = require('child_process');
const multer = require('multer');
const nodemailer = require('nodemailer');
const os = require('os');
const net = require('net');
const mqtt = require('mqtt');
const { Aedes } = require('aedes');
const { checklistTurno, planoDia } = require('../data/operationalDefaults');
const { generateDemoTelemetry, provisionDemoTenantData } = require('../services/demoTrialService');
const {
  deleteTrialTenantData,
  enforceTrialLimit,
  resetTrialTenantData
} = require('../services/trialLifecycleService');

/**
 * Concentra a logica de verificar agente sonda para manter o restante do rota/API mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: finaliza a resposta HTTP
 *
 * @param {import("express").Request} req - Requisição HTTP com parâmetros, corpo e contexto de autenticação.
 * @param {import("express").Response} res - Resposta HTTP usada para devolver o resultado ao cliente.
 * @param {import("express").NextFunction} next - Continuação da cadeia de middlewares do Express.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function verificarAgenteSonda(req, res, next) {
  const expectedToken = String(process.env.NETWORK_PROBE_AGENT_TOKEN || '');
  const authorization = String(req.headers.authorization || '');
  const suppliedToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : String(req.headers['x-probe-token'] || '');
  const agentId = normalizeCredential(req.headers['x-probe-agent-id'], 80);
  if (!expectedToken) return res.status(503).json({ error: 'Integração com agentes de rede ainda não configurada no servidor.' });
  const expectedBuffer = Buffer.from(expectedToken);
  const suppliedBuffer = Buffer.from(suppliedToken);
  const authenticated = expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
  if (!authenticated) return res.status(401).json({ error: 'Token do agente de rede inválido.' });
  if (!agentId || !/^[a-zA-Z0-9._-]{3,80}$/.test(agentId)) return res.status(400).json({ error: 'Identificador do agente inválido.' });
  req.networkProbeAgentId = agentId;
  next();
}

/**
 * Permite ao proxy IoT acessar apenas enderecos IPv4 de redes privadas.
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
  return first === 10
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 169 && second === 254);
}

/**
 * Converte um IPv4 validado para inteiro sem sinal.
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
 * Converte um inteiro sem sinal novamente para IPv4.
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
 * Confirma se um IPv4 pertence a uma rede CIDR já validada.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} ipAddress - Valor de ip address consumido por esta rotina.
 * @param {unknown} cidr - Valor de cidr consumido por esta rotina.
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function isIpv4InCidr(ipAddress, cidr) {
  const [networkAddress, prefixText] = String(cidr || '').split('/');
  const prefix = Number(prefixText);
  if (net.isIP(ipAddress) !== 4 || net.isIP(networkAddress) !== 4 || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToInteger(ipAddress) & mask) === (ipv4ToInteger(networkAddress) & mask);
}

/**
 * Converte a máscara IPv4 informada pelo sistema operacional para prefixo CIDR.
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
 * @param {unknown} netmask - Valor de netmask consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function netmaskToPrefix(netmask) {
  if (net.isIP(netmask) !== 4) return 24;
  return netmask.split('.').map(Number).reduce((total, octet) => total + octet.toString(2).split('1').length - 1, 0);
}

/**
 * Lista as redes privadas conectadas usando endereço e máscara reais do host.
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
function getPrivateNetworkInterfaces() {
  return Object.entries(os.networkInterfaces()).flatMap(([name, entries]) =>
    (entries || []).filter((item) => item.family === 'IPv4' && !item.internal && isPrivateIpv4(item.address)).map((item) => {
      const prefix = netmaskToPrefix(item.netmask);
      const mask = (0xffffffff << (32 - prefix)) >>> 0;
      const networkAddress = integerToIpv4(ipv4ToInteger(item.address) & mask);
      return {
        key: `${name}:${item.address}`,
        name,
        address: item.address,
        netmask: item.netmask,
        cidr: `${networkAddress}/${prefix}`,
        virtual: /virtual|vbox|vmware|hyper-v|vethernet|loopback|conexão local\*/i.test(name)
      };
    })
  );
}

/**
 * Executa uma consulta curta à tabela de rotas sem aceitar entrada do usuário.
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
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function readDefaultRoute() {
  const command = process.platform === 'win32' ? 'route print -4' : 'ip route show default';
  return new Promise((resolve) => {
    exec(command, { timeout: 2500, windowsHide: true }, (error, stdout) => {
      if (error) return resolve(null);
      if (process.platform === 'win32') {
        const candidates = String(stdout).split(/\r?\n/).map((line) => line.trim().split(/\s+/))
          .filter((columns) => columns[0] === '0.0.0.0' && columns[1] === '0.0.0.0' && isPrivateIpv4(columns[2]))
          .map((columns) => ({ gateway: columns[2], interfaceAddress: columns[3], metric: Number(columns[4]) || 9999 }))
          .sort((a, b) => a.metric - b.metric);
        return resolve(candidates[0] || null);
      }
      const match = String(stdout).match(/default\s+via\s+(\d+\.\d+\.\d+\.\d+)\s+dev\s+(\S+)/);
      resolve(match ? { gateway: match[1], interfaceName: match[2], metric: 0 } : null);
    });
  });
}

/**
 * Marca a interface da rota padrão e escolhe a melhor rede física disponível.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function getNetworkProbeConfig() {
  const interfaces = getPrivateNetworkInterfaces();
  const defaultRoute = await readDefaultRoute();
  const defaultInterface = interfaces.find((item) => item.address === defaultRoute?.interfaceAddress || item.name === defaultRoute?.interfaceName);
  const physical = interfaces.find((item) => /wi-?fi|wireless/i.test(item.name) && !item.virtual)
    || interfaces.find((item) => /ethernet/i.test(item.name) && !item.virtual);
  const preferred = defaultInterface || physical || interfaces.find((item) => !item.virtual) || interfaces[0];
  const networks = interfaces.map((item) => ({
    ...item,
    gateway: item.key === defaultInterface?.key ? defaultRoute?.gateway || null : null,
    isDefault: item.key === preferred?.key
  }));
  return { networks, preferred, gateway: defaultRoute?.gateway || null };
}

/**
 * Expande somente CIDRs privados, com limite rígido para proteger o servidor.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @param {unknown} maxHosts - Valor de max hosts consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function expandPrivateCidr(value, maxHosts = 64) {
  const normalized = String(value || '').trim();
  const [address, prefixText = '32'] = normalized.split('/');
  const prefix = Number(prefixText);
  if (!isPrivateIpv4(address) || !Number.isInteger(prefix) || prefix < 16 || prefix > 32) return null;

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = ipv4ToInteger(address) & mask;
  const totalAddresses = 2 ** (32 - prefix);
  const firstOffset = prefix <= 30 ? 1 : 0;
  const usableTotal = Math.max(0, totalAddresses - (prefix <= 30 ? 2 : 0));
  const count = Math.min(maxHosts, usableTotal || totalAddresses);
  const addresses = Array.from({ length: count }, (_, index) => integerToIpv4((network + firstOffset + index) >>> 0));
  return { cidr: `${integerToIpv4(network)}/${prefix}`, addresses, totalHosts: usableTotal || totalAddresses, truncated: count < (usableTotal || totalAddresses) };
}

/**
 * Normaliza uma lista curta de portas TCP para uso seguro pela sonda.
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
function normalizeProbePorts(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(source.map(Number).filter((port) => Number.isInteger(port) && port > 0 && port <= 65535))].slice(0, 20);
}

/**
 * Sanitiza portas recebidas de uma sonda remota antes de persistir o relatório.
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
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function parseProbeReportPorts(value) {
  const source = Array.isArray(value) ? value : [];
  return source.map((item) => {
    const port = Number(typeof item === 'object' ? item.porta : item);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
    return {
      porta: port,
      servico: normalizeCredential(typeof item === 'object' ? item.servico : '', 100) || 'TCP',
      latencyMs: typeof item === 'object' && Number.isFinite(Number(item.latencyMs)) ? Number(item.latencyMs) : null
    };
  }).filter(Boolean).slice(0, 20);
}

/**
 * Testa uma porta TCP e devolve a latência quando houver resposta.
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
 * @param {unknown} timeoutMs - Valor de timeout ms consumido por esta rotina.
 * @param {unknown} localAddress - Valor de local address consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function probeTcpPort(ipAddress, port, timeoutMs = 450, localAddress = null) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = new net.Socket();
    let settled = false;

    /**
     * Concentra a logica de finish para manter o restante do rota/API mais legivel.
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
      resolve({ open, latencyMs: open ? Date.now() - startedAt : null });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect({ port, host: ipAddress, ...(localAddress ? { localAddress } : {}) });
  });
}

const NETWORK_PROBE_SERVICES = [
  { porta: 21, servico: 'FTP' }, { porta: 22, servico: 'SSH' },
  { porta: 23, servico: 'Telnet' }, { porta: 80, servico: 'HTTP / Web UI' },
  { porta: 443, servico: 'HTTPS / Secure Web' }, { porta: 445, servico: 'SMB' },
  { porta: 554, servico: 'RTSP / Camera IP' }, { porta: 1883, servico: 'MQTT Broker' },
  { porta: 3000, servico: 'Aplicacao web' }, { porta: 3001, servico: 'API TermoSync' },
  { porta: 3306, servico: 'MySQL Database' }, { porta: 3389, servico: 'Remote Desktop' },
  { porta: 5432, servico: 'PostgreSQL' }, { porta: 6379, servico: 'Redis' },
  { porta: 8080, servico: 'HTTP Alternativo / Proxy' }, { porta: 8443, servico: 'HTTPS Alternativo' },
  { porta: 8883, servico: 'MQTT TLS' }, { porta: 27017, servico: 'MongoDB' }
];

/**
 * Executa uma sonda TCP limitada sobre um conjunto de enderecos privados.
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
 * @param {unknown} timeoutMs - Valor de timeout ms consumido por esta rotina.
 * @param {unknown} localAddress - Valor de local address consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function scanPrivateAddresses(addresses, ports, timeoutMs = 450, localAddress = null) {
  const serviceByPort = new Map(NETWORK_PROBE_SERVICES.map((item) => [item.porta, item.servico]));
  const devices = [];
  let cursor = 0;

  /**
   * Concentra a logica de worker para manter o restante do rota/API mais legivel.
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
      const probeSourceAddress = typeof localAddress === 'function' ? localAddress(ipAddress) : localAddress;
      const checks = await Promise.all(ports.map(async (port) => ({
        port,
        ...(await probeTcpPort(ipAddress, port, timeoutMs, probeSourceAddress))
      })));
      const openPorts = checks.filter((item) => item.open).map((item) => ({
        porta: item.port,
        servico: serviceByPort.get(item.port) || 'TCP',
        latencyMs: item.latencyMs
      }));
      if (openPorts.length > 0) {
        devices.push({
          ip: ipAddress,
          hostname: 'Host detectado',
          portas: openPorts,
          latencyMs: Math.min(...openPorts.map((item) => item.latencyMs || 0)),
          sourceAddress: probeSourceAddress
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(16, addresses.length) }, worker));
  return devices.sort((a, b) => ipv4ToInteger(a.ip) - ipv4ToInteger(b.ip));
}

const upload = multer({
  dest: process.env.UPLOAD_TMP_DIR || 'tmp/',
  limits: { fileSize: Number(process.env.UPDATE_PACKAGE_MAX_MB || 75) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isZip = file.mimetype === 'application/zip' || file.originalname.toLowerCase().endsWith('.zip');
    cb(isZip ? null : new Error('Apenas pacotes .zip são aceitos.'), isZip);
  }
});

const chamadosUploadDir = path.join(__dirname, '..', 'uploads', 'chamados');
fs.mkdirSync(chamadosUploadDir, { recursive: true });
const chamadoAnexoUpload = multer({
  storage: multer.diskStorage({
    destination: chamadosUploadDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: Number(process.env.CHAMADO_ANEXO_MAX_MB || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain'
    ]);
    const allowedExt = /\.(pdf|jpe?g|png|webp|txt)$/i.test(file.originalname || '');
    const ok = allowedMimeTypes.has(file.mimetype) || allowedExt;
    cb(ok ? null : new Error('Formato de anexo não permitido.'), ok);
  }
});


/**
 * Concentra a logica de processar upload chamado anexo para manter o restante do rota/API mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: finaliza a resposta HTTP
 *
 * @param {import("express").Request} req - Requisição HTTP com parâmetros, corpo e contexto de autenticação.
 * @param {import("express").Response} res - Resposta HTTP usada para devolver o resultado ao cliente.
 * @param {import("express").NextFunction} next - Continuação da cadeia de middlewares do Express.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function processarUploadChamadoAnexo(req, res, next) {
  chamadoAnexoUpload.single('arquivo')(req, res, (error) => {
    if (!error) return next();
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      error: error.code === 'LIMIT_FILE_SIZE'
        ? `Anexo acima do limite de ${process.env.CHAMADO_ANEXO_MAX_MB || 10} MB.`
        : (error.message || 'Anexo inválido.')
    });
  });
}

const SMTP_FROM = process.env.SMTP_FROM || (process.env.SMTP_USER ? `"TermoSync NOC" <${process.env.SMTP_USER}>` : '"TermoSync NOC" <no-reply@termosync.local>');
let smtpTransporter = null;
const resetPasswordAttempts = new Map();
const passwordResetRequestsInFlight = new Set();
const mfaLoginChallenges = new Map();
// Mantém apenas autorizações efêmeras de acesso remoto. O JWT definitivo é
// criado na aba de destino depois que o código de uso único é consumido.
const impersonationAccessCodes = new Map();
const hardwareTelemetryTouch = new Map();
let hardwareOverviewCache = { data: null, expiresAt: 0 };
const alertChecksInFlight = new Set();
const alertConditionState = new Map();
const alertConditionPending = new Map();
const alertLastCreatedAt = new Map();
const ALERT_STABILITY_MS = Math.max(1000, Number(process.env.ALERT_STABILITY_MS || 5000));
const ALERT_REOPEN_COOLDOWN_MS = Math.max(60000, Number(process.env.ALERT_REOPEN_COOLDOWN_MS || 900000));
let maintenanceModeCache = { checkedAt: 0, enabled: false };
let passwordResetSchemaReady = false;
const backupTables = ['usuarios', 'loja', 'equipamentos', 'chamados', 'notificacoes', 'tipos_refrigeracao', 'setores', 'audit_logs', 'security_events', 'chamados_comentarios', 'user_preferences'];


/**
 * Gera gerar backup json com os dados necessarios para o proximo passo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência; lê ou grava arquivos locais
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.actor - Propriedade actor usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.persistToDisk - Propriedade persistToDisk usada para configurar dados ou comportamento do componente.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function gerarBackupJson({ actor = 'system', persistToDisk = false } = {}) {
  const backup = { generatedAt: new Date().toISOString(), generatedBy: actor, format: 'termosync-json-backup-v1', tables: {} };

  for (const table of backupTables) {
    try {
      const [rows] = await pool.query(`SELECT * FROM ${table} LIMIT 10000`);
      backup.tables[table] = rows;
    } catch (tableError) {
      backup.tables[table] = { error: tableError.message };
    }
  }

  const zip = new AdmZip();
  zip.addFile('termosync-backup.json', Buffer.from(JSON.stringify(backup, null, 2), 'utf8'));
  const buffer = zip.toBuffer();
  if (!persistToDisk) return { buffer, backup };

  const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups'));
  fs.mkdirSync(backupDir, { recursive: true });
  const filename = `termosync-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
  const fullPath = path.join(backupDir, filename);
  fs.writeFileSync(fullPath, buffer);
  return { buffer, backup, fullPath, filename, backupDir };
}


/**
 * Limpa limpar backups antigos para manter o estado consistente.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 *
 * Efeitos colaterais: lê ou grava arquivos locais
 *
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function limparBackupsAntigos() {
  const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups'));
  const retention = Number(process.env.AUTO_BACKUP_RETENTION || 14);
  if (!Number.isFinite(retention) || retention <= 0 || !fs.existsSync(backupDir)) return;

  const backups = fs.readdirSync(backupDir)
    .filter((name) => /^termosync-backup-.*\.zip$/.test(name))
    .map((name) => {
      const fullPath = path.join(backupDir, name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  backups.slice(retention).forEach((item) => fs.unlink(item.fullPath, () => {}));
}


/**
 * Executa executar backup automatico coordenando as etapas principais desse fluxo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: registra informações de diagnóstico
 *
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function executarBackupAutomatico() {
  try {
    const { fullPath, buffer } = await gerarBackupJson({ actor: 'auto-backup', persistToDisk: true });
    limparBackupsAntigos();
    await registrarAuditoria('BACKUP_AUTO', 'Sistema', `Backup automático gerado (${buffer.length} bytes): ${fullPath}`, 'info');
    console.log(`[BACKUP] Backup automático gerado: ${fullPath}`);
  } catch (error) {
    console.warn('[BACKUP] Falha ao gerar backup automático:', error.message);
    await registrarEventoSeguranca({ eventType: 'AUTO_BACKUP_FAILED', actor: 'system', severity: 'danger', detail: error.message });
  }
}

/**
 * Cria o transporte SMTP sob demanda. Quando SMTP não está configurado, os fluxos continuam
 * funcionando e retornam instruções ao DEV.
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
function criarTransporterEmail() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      pool: true,
      maxConnections: Math.max(1, Number(process.env.SMTP_MAX_CONNECTIONS || 2)),
      maxMessages: Math.max(1, Number(process.env.SMTP_MAX_MESSAGES || 50)),
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: Math.max(3000, Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000)),
      greetingTimeout: Math.max(3000, Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000)),
      socketTimeout: Math.max(5000, Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20000)),
      tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' }
    });
  }
  return smtpTransporter;
}


/**
 * Prepara escape html para exibicao sem expor dados sensiveis.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function escapeHtml(value) {
  // Sanitização mínima para textos que entram em e-mails HTML administrativos.
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/**
 * Gera gerar senha provisoria com os dados necessarios para o proximo passo.
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
function gerarSenhaProvisoria() {
  // Senha temporária usada no onboarding SaaS; deve ser trocada no primeiro acesso.
  return `${crypto.randomBytes(4).toString('hex')}T!${crypto.randomInt(10, 99)}`;
}


/**
 * Gera gerar codigo recuperacao com os dados necessarios para o proximo passo.
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
function gerarCodigoRecuperacao() {
  // Código curto para o usuário digitar na segunda etapa da recuperação.
  return String(crypto.randomInt(100000, 1000000));
}


/**
 * Prepara mascarar email para exibicao sem expor dados sensiveis.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} email - Valor de email consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function mascararEmail(email) {
  // Exibe apenas uma pista do destino sem vazar o e-mail completo na tela pública.
  const value = String(email || '').trim();
  const [local, domain] = value.split('@');
  if (!local || !domain) return '';
  const visibleLocal = local.length <= 2 ? `${local[0] || ''}*` : `${local.slice(0, 2)}***`;
  const domainParts = domain.split('.');
  const visibleDomain = domainParts[0] ? `${domainParts[0][0]}***` : '***';
  return `${visibleLocal}@${visibleDomain}.${domainParts.slice(1).join('.') || '***'}`;
}


/**
 * Prepara mascarar telefone para exibicao sem expor dados sensiveis.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} telefone - Valor de telefone consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function mascararTelefone(telefone) {
  // Mostra somente os últimos dígitos do telefone para orientar o usuário.
  const digits = String(telefone || '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `•••• ${digits.slice(-4)}`;
}


/**
 * Normaliza normalizar email para evitar divergencia de formato nas comparacoes.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} email - Valor de email consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}


/**
 * Normaliza normalizar telefone digits para evitar divergencia de formato nas comparacoes.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} telefone - Valor de telefone consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function normalizarTelefoneDigits(telefone) {
  return String(telefone || '').replace(/\D/g, '');
}


/**
 * Normaliza normalizar telefone e164 para evitar divergencia de formato nas comparacoes.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} telefone - Valor de telefone consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function normalizarTelefoneE164(telefone) {
  const digits = normalizarTelefoneDigits(telefone);
  if (!digits) return '';
  if (digits.startsWith('55')) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}


/**
 * Concentra a logica de env flag enabled para manter o restante do rota/API mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function envFlagEnabled(value) {
  return ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}


/**
 * Verifica a condicao is textbelt configured e retorna um valor booleano.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function isTextbeltConfigured() {
  return envFlagEnabled(process.env.TEXTBELT_ENABLED) || Boolean(process.env.TEXTBELT_API_KEY);
}


/**
 * Verifica a condicao is textbee configured e retorna um valor booleano.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function isTextbeeConfigured() {
  return Boolean(process.env.TEXTBEE_API_KEY);
}


/**
 * Concentra a logica de mensagem erro sms recuperacao para manter o restante do rota/API mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {Error|unknown} error - Falha capturada durante a execução do fluxo.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function mensagemErroSmsRecuperacao(error) {
  const message = String(error?.message || '');
  const lower = message.toLowerCase();

  if (lower.includes('textbee')) {
    return 'Falha no envio pelo textbee. Verifique se o Android está ligado, com internet, chip ativo, app textbee conectado e TEXTBEE_API_KEY correta.';
  }

  if (lower.includes('free sms are disabled') || lower.includes('disabled for this country')) {
    return 'O Textbelt gratuito não está disponível para este país. Configure uma TEXTBELT_API_KEY paga, Twilio ou SMS_WEBHOOK_URL para envio real por SMS.';
  }

  if (lower.includes('fetch failed') || lower.includes('enotfound') || lower.includes('econnreset') || lower.includes('etimedout') || lower.includes('tempo esgotado')) {
    return 'Não foi possível conectar ao provedor SMS. Verifique internet, firewall/proxy do servidor e tente novamente.';
  }

  return 'Falha ao enviar SMS de recuperação. Verifique o telefone informado e a configuração do provedor SMS.';
}


/**
 * Concentra a logica de post form https para manter o restante do rota/API mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: atualiza estado reativo da interface; troca eventos em tempo real
 *
 * @param {unknown} urlString - Valor de url string consumido por esta rotina.
 * @param {unknown} params - Valor de params consumido por esta rotina.
 * @param {unknown} timeoutMs - Valor de timeout ms consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function postFormHttps(urlString, params, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const body = params.toString();
    const req = https.request(url, {
      method: 'POST',
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          async json() {
            return JSON.parse(raw || '{}');
          },
          async text() {
            return raw;
          }
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Tempo esgotado ao conectar no provedor SMS (${timeoutMs}ms).`));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}


/**
 * Envia enviar sms webhook para o canal ou provedor configurado.
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
 * @param {unknown} telefone - Valor de telefone consumido por esta rotina.
 * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function enviarSmsWebhook(telefone, mensagem) {
  // Integração genérica para provedor de SMS sem acoplar o sistema a um vendor.
  if (!process.env.SMS_WEBHOOK_URL) return false;
  const response = await fetch(process.env.SMS_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` } : {})
    },
    body: JSON.stringify({ to: telefone, message: mensagem })
  });
  if (!response.ok) throw new Error(`SMS webhook respondeu ${response.status}`);
  return true;
}


/**
 * Envia enviar sms textbelt para o canal ou provedor configurado.
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
 * @param {unknown} telefone - Valor de telefone consumido por esta rotina.
 * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function enviarSmsTextbelt(telefone, mensagem) {
  // Fallback simples para testes. A chave pública "textbelt" possui limite gratuito baixo.
  if (!isTextbeltConfigured()) return false;

  const params = new URLSearchParams();
  params.set('phone', normalizarTelefoneE164(telefone));
  params.set('message', mensagem);
  params.set('key', process.env.TEXTBELT_API_KEY || 'textbelt');
  if (process.env.TEXTBELT_SENDER) params.set('sender', process.env.TEXTBELT_SENDER);

  const textbeltUrl = process.env.TEXTBELT_URL || 'https://textbelt.com/text';
  const response = envFlagEnabled(process.env.TEXTBELT_USE_FETCH)
    ? await fetch(textbeltUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
        signal: AbortSignal.timeout(Number(process.env.SMS_TIMEOUT_MS || 15000))
      })
    : await postFormHttps(textbeltUrl, params, Number(process.env.SMS_TIMEOUT_MS || 15000));
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(`Textbelt SMS falhou: ${data.error || response.status}`);
  }

  return true;
}


/**
 * Envia enviar sms textbee para o canal ou provedor configurado.
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
 * @param {unknown} telefone - Valor de telefone consumido por esta rotina.
 * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function enviarSmsTextbee(telefone, mensagem) {
  // Gateway barato: usa um Android cadastrado no textbee para enviar pelo chip do aparelho.
  if (!isTextbeeConfigured()) return false;

  const payload = {
    recipients: [normalizarTelefoneE164(telefone)],
    message: mensagem
  };
  if (process.env.TEXTBEE_DEVICE_ID) payload.deviceId = process.env.TEXTBEE_DEVICE_ID;
  if (process.env.TEXTBEE_SIM_SUBSCRIPTION_ID) payload.simSubscriptionId = Number(process.env.TEXTBEE_SIM_SUBSCRIPTION_ID);

  const response = await fetch(process.env.TEXTBEE_URL || 'https://api.textbee.dev/api/v1/gateway/send-sms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.TEXTBEE_API_KEY
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(Number(process.env.SMS_TIMEOUT_MS || 15000))
  });
  const data = await response.json().catch(() => ({}));
  const success = data?.data?.success !== false && data?.data?.failureCount !== 1;

  if (!response.ok || !success) {
    throw new Error(`textbee respondeu ${response.status}: ${data?.message || data?.error || data?.data?.message || JSON.stringify(data).slice(0, 300)}`);
  }

  return true;
}


/**
 * Envia enviar sms twilio para o canal ou provedor configurado.
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
 * @param {unknown} telefone - Valor de telefone consumido por esta rotina.
 * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function enviarSmsTwilio(telefone, mensagem) {
  // Integração direta com Twilio Programmable Messaging via REST API.
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) return false;

  const params = new URLSearchParams();
  params.set('To', normalizarTelefoneE164(telefone));
  params.set('Body', mensagem);
  if (messagingServiceSid) params.set('MessagingServiceSid', messagingServiceSid);
  else params.set('From', fromNumber);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Twilio SMS respondeu ${response.status}: ${detail.slice(0, 500)}`);
  }

  return true;
}


/**
 * Busca ou monta os dados de get sms provider status usados no fluxo atual.
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
function getSmsProviderStatus() {
  const twilioConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)
  );
  const webhookConfigured = Boolean(process.env.SMS_WEBHOOK_URL);
  const textbeeConfigured = isTextbeeConfigured();
  const textbeltConfigured = isTextbeltConfigured();
  return {
    configured: twilioConfigured || webhookConfigured || textbeeConfigured || textbeltConfigured,
    twilioConfigured,
    webhookConfigured,
    textbeeConfigured,
    textbeltConfigured
  };
}


/**
 * Envia enviar codigo sms para o canal ou provedor configurado.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} telefone - Valor de telefone consumido por esta rotina.
 * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function enviarCodigoSms(telefone, mensagem) {
  if (!telefone) return false;
  if (await enviarSmsTwilio(telefone, mensagem)) return true;
  if (await enviarSmsWebhook(telefone, mensagem)) return true;
  if (await enviarSmsTextbee(telefone, mensagem)) return true;
  return enviarSmsTextbelt(telefone, mensagem);
}


/**
 * Envia enviar alerta critico multicanal para o canal ou provedor configurado.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: registra informações de diagnóstico
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.tipoAlerta - Propriedade tipoAlerta usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.equipamento - Propriedade equipamento usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.filial - Propriedade filial usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.mensagem - Propriedade mensagem usada para configurar dados ou comportamento do componente.
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function enviarAlertaCriticoMulticanal({ tipoAlerta, equipamento, filial, mensagem }) {
  // Notificações críticas opcionais. Só dispara quando ALERT_EMAIL_TO ou
  // ALERT_SMS_TO estão configurados no .env, evitando surpresas em ambiente local.
  const tiposCriticos = ['MECANICA', 'TEMPERATURA', 'PORTA', 'REDE'];
  if (!tiposCriticos.includes(tipoAlerta)) return;

  const assunto = `TermoSync NOC - Alerta crítico ${tipoAlerta}`;
  const texto = `Alerta crítico TermoSync\n\nTipo: ${tipoAlerta}\nFilial: ${filial || 'N/A'}\nEquipamento: ${equipamento || 'N/A'}\nOcorrência: ${mensagem}\nData: ${new Date().toLocaleString('pt-BR')}`;

  if (process.env.ALERT_EMAIL_TO) {
    const transporter = criarTransporterEmail();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: SMTP_FROM,
          to: process.env.ALERT_EMAIL_TO,
          subject: assunto,
          text: texto
        });
      } catch (error) {
        console.warn('[ALERTA] Falha ao enviar e-mail crítico:', error.message);
      }
    }
  }

  if (process.env.ALERT_SMS_TO) {
    try {
      await enviarCodigoSms(process.env.ALERT_SMS_TO, `TermoSync NOC: alerta ${tipoAlerta} em ${filial || 'filial'}. ${String(mensagem).slice(0, 90)}`);
    } catch (error) {
      console.warn('[ALERTA] Falha ao enviar SMS crítico:', error.message);
    }
  }
}


/**
 * Concentra a logica de garantir schema recuperacao senha para manter o restante do rota/API mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência
 *
 * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function garantirSchemaRecuperacaoSenha() {
  // Protege bases antigas caso a rota seja chamada antes do bootstrap completo do banco.
  if (passwordResetSchemaReady) return;
  const columns = [
    ['password_changed_at', 'DATETIME DEFAULT NULL'],
    ['password_reset_code_hash', 'VARCHAR(255) DEFAULT NULL'],
    ['password_reset_expires_at', 'DATETIME DEFAULT NULL'],
    ['password_reset_attempts', 'INT DEFAULT 0'],
    ['password_reset_requested_at', 'DATETIME DEFAULT NULL']
  ];

  for (const [column, definition] of columns) {
    try {
      await pool.execute(`ALTER TABLE usuarios ADD COLUMN ${column} ${definition}`);
    } catch (error) {
      const duplicateColumn = error.code === 'ER_DUP_FIELDNAME' || String(error.message).includes('Duplicate column');
      if (!duplicateColumn) throw error;
    }
  }

  passwordResetSchemaReady = true;
}


/**
 * Verifica a condicao is password reset limited e retorna um valor booleano.
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
 * @param {unknown} key - Valor de key consumido por esta rotina.
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function isPasswordResetLimited(key) {
  // Rate limit específico para recuperação de senha, separado do login normal.
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
   /**
    * Concentra a logica de attempts para manter o restante do rota/API mais legivel.
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
   * Concentra a logica de attempts para manter o restante do rota/API mais legivel.
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
  const attempts = (resetPasswordAttempts.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  if (attempts.length >= 5) {
    resetPasswordAttempts.set(key, attempts);
    return true;
  }
  attempts.push(now);
  resetPasswordAttempts.set(key, attempts);
  return false;
}

/**
 * Monta uma chave estável para impedir envios duplicados de recuperação simultâneos.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {object} options - Configurações e dados necessários para executar este bloco.
 * @param {unknown} options.usuario - Propriedade usuario usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.canal - Propriedade canal usada para configurar dados ou comportamento do componente.
 * @param {unknown} options.destino - Propriedade destino usada para configurar dados ou comportamento do componente.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function getPasswordResetRequestKey({ usuario, canal, destino }) {
  return `${String(usuario || '').toLowerCase()}:${canal}:${String(destino || '').toLowerCase()}`;
}

/**
 * Verifica se uma solicitação de recuperação recente ainda está no período de reenvio bloqueado.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} requestedAt - Valor de requested at consumido por esta rotina.
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function isPasswordResetCooldownActive(requestedAt) {
  if (!requestedAt) return false;
  const timestamp = new Date(requestedAt).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const cooldownMs = Number(process.env.PASSWORD_RESET_SMS_COOLDOWN_MS || 60000);
  return cooldownMs > 0 && Date.now() - timestamp < cooldownMs;
}


/**
 * Concentra a logica de clamp number para manter o restante do rota/API mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @param {unknown} fallback - Valor de fallback consumido por esta rotina.
 * @param {unknown} min - Valor de min consumido por esta rotina.
 * @param {unknown} max - Valor de max consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function clampNumber(value, fallback, min, max) {
  // Normaliza limites vindos por query string para evitar consultas enormes.
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}


/**
 * Verifica a condicao is maintenance mode enabled e retorna um valor booleano.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência; registra informações de diagnóstico
 *
 * @returns {Promise<boolean>} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function isMaintenanceModeEnabled() {
  // Cache curto evita consultar a tabela de configuração em toda leitura IoT.
  const now = Date.now();
  if (now - maintenanceModeCache.checkedAt < 5000) return maintenanceModeCache.enabled;

  try {
    const [sys] = await pool.execute('SELECT valor FROM configuracoes WHERE chave = "maintenanceMode" LIMIT 1');
    maintenanceModeCache = { checkedAt: now, enabled: sys.length > 0 && sys[0].valor === '1' };
  } catch (err) {
    console.warn('[SYSTEM] Falha ao verificar modo manutenção:', err.message);
    maintenanceModeCache = { checkedAt: now, enabled: false };
  }

  return maintenanceModeCache.enabled;
}

/**
 * Retorna somente o estado público do modo manutenção e sua mensagem.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência; registra informações de diagnóstico
 *
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function getMaintenancePublicState() {
  let enabled = await isMaintenanceModeEnabled();
  let noticeActive = enabled;
  let message = 'Estamos realizando uma manutenção programada. Tente novamente em alguns minutos.';
  try {
    const [rows] = await pool.execute('SELECT valor FROM configuracoes WHERE chave = "sysConfigSaas" LIMIT 1');
    const config = JSON.parse(rows[0]?.valor || '{}');
    enabled = config.maintenanceMode === true || enabled;
    noticeActive = enabled || config.maintenanceNoticeActive === true;
    if (typeof config.maintenanceMessage === 'string' && config.maintenanceMessage.trim()) {
      message = config.maintenanceMessage.trim().slice(0, 280);
    }
  } catch (error) {
    console.warn('[SYSTEM] Falha ao carregar mensagem de manutenção:', error.message);
  }
  return { maintenanceMode: enabled, maintenanceNoticeActive: noticeActive, maintenanceMessage: message };
}


/**
 * Valida validar root passcode antes de liberar a continuidade do fluxo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência
 *
 * @param {unknown} passcode - Valor de passcode consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function validarRootPasscode(passcode, expectedUserId = null) {
  // Valida ações críticas contra hash root configurado ou senha de DEV.
  if (!passcode) return { ok: false };

  const [configRows] = await pool.execute(
    'SELECT valor FROM configuracoes WHERE chave = "master_root_hash" LIMIT 1'
  );

  if (configRows.length > 0 && configRows[0].valor) {
    const isMatch = await bcrypt.compare(passcode, configRows[0].valor);
    if (isMatch) return { ok: true, actor: 'Root/Dev', source: 'master_root_hash' };
  }

  const [devUsers] = expectedUserId
    ? await pool.execute('SELECT usuario, senha FROM usuarios WHERE id = ? AND role = "DEV" LIMIT 1', [expectedUserId])
    : await pool.execute('SELECT usuario, senha FROM usuarios WHERE role = "DEV" LIMIT 5');

  for (const user of devUsers) {
    const isMatch = await bcrypt.compare(passcode, user.senha);
    if (isMatch) return { ok: true, actor: user.usuario, source: 'dev_password' };
  }

  return { ok: false };
}


/**
 * Concentra a logica de token hash para manter o restante do rota/API mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {unknown} value - Valor de value consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function tokenHash(value) {
  // Hash fixo para comparar tokens sem armazenar/expor segredo em texto puro.
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}


/**
 * Extrai extrair token autenticacao de uma entrada externa ou configuracao local.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {import("express").Request} req - Requisição HTTP com parâmetros, corpo e contexto de autenticação.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function extrairTokenAutenticacao(req) {
  // Aceita tanto "Bearer token" quanto token cru para compatibilidade com telas antigas.
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
}


/**
 * Valida validar token io t antes de liberar a continuidade do fluxo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {import("express").Request} req - Requisição HTTP com parâmetros, corpo e contexto de autenticação.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function validarTokenIoT(req) {
  // Autentica sensores/simulador HTTP. Em produção, IOT_INGEST_TOKEN é obrigatório.
  const token = req.headers['x-iot-token'] || req.headers['x-api-key'] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '');
  const configuredToken = process.env.IOT_INGEST_TOKEN;

  if (configuredToken) {
    return crypto.timingSafeEqual(Buffer.from(tokenHash(token)), Buffer.from(tokenHash(configuredToken)));
  }

  if (process.env.NODE_ENV === 'production') return false;
  return true;
}


/**
 * Busca ou monta os dados de get mqtt client options usados no fluxo atual.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: publica ou consome mensagens MQTT; lê ou grava arquivos locais
 *
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function getMqttClientOptions() {
  // Credenciais MQTT são opcionais em ambiente local e recomendadas em produção.
  const options = {};
  if (process.env.MQTT_USERNAME && process.env.MQTT_PASSWORD) {
    options.username = process.env.MQTT_USERNAME;
    options.password = process.env.MQTT_PASSWORD;
  }
  if (process.env.MQTT_TLS_CA_PATH) {
    options.ca = fs.readFileSync(path.resolve(process.env.MQTT_TLS_CA_PATH));
    options.rejectUnauthorized = true;
  }
  return options;
}


/**
 * Busca ou monta os dados de get mqtt broker url usados no fluxo atual.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
 *
 * Efeitos colaterais: publica ou consome mensagens MQTT
 *
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function getMqttBrokerUrl() {
  return process.env.MQTT_URL || 'mqtt://localhost:1883';
}

/**
 * Publica um comando MQTT do simulador e encerra a conexao assim que o broker confirma o
 * envio. A promessa evita deixar requisicoes HTTP penduradas quando o broker local estiver
 * indisponivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: publica ou consome mensagens MQTT
 *
 * @param {string|number} equipamentoId - Identificador do registro ou recurso processado.
 * @param {unknown} acao - Valor de acao consumido por esta rotina.
 * @param {unknown} estado - Valor de estado consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function publicarComandoSimulador(equipamentoId, acao, estado) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(getMqttBrokerUrl(), {
      ...getMqttClientOptions(),
      connectTimeout: 3000,
      reconnectPeriod: 0
    });
    let settled = false;


    /**
     * Concentra a logica de finalizar para manter o restante do rota/API mais legivel.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     *
     * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
     *
     * @param {Error|unknown} error - Falha capturada durante a execução do fluxo.
     * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const finalizar = (error) => {
      if (settled) return;
      settled = true;
      client.end(true);
      if (error) reject(error);
      else resolve();
    };

    client.once('error', finalizar);
    client.once('connect', () => {
      const topico = `termosync/comandos/${equipamentoId}`;
      client.publish(topico, JSON.stringify(montarComandoMqtt(acao, estado)), { qos: 1, retain: false }, finalizar);
    });
  });
}


/**
 * Concentra a logica de emitir sessao autenticada para manter o restante do rota/API mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência
 *
 * @param {object} user - Usuário autenticado ou candidato à autenticação processado por esta rotina.
 * @param {import("express").Request} req - Requisição HTTP com parâmetros, corpo e contexto de autenticação.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function obterAcessoTenant(user) {
  if (user.role === 'DEV' || !user.empresa) return { isTrial: false, demoLifetime: false, trialExpiresAt: null };

  const [[company]] = await pool.execute(
    'SELECT status, access_mode, trial_expires_at, trial_auto_block FROM empresas WHERE nome = ? LIMIT 1',
    [user.empresa]
  );
  if (company && company.status !== 'Ativa') {
    const error = new Error('Organização suspensa ou bloqueada.');
    error.statusCode = 403;
    throw error;
  }
  if (company?.access_mode === 'TRIAL' && company.trial_auto_block !== 0
      && (!company.trial_expires_at || new Date(company.trial_expires_at) <= new Date())) {
    const error = new Error('O período gratuito terminou. Entre em contato para converter a demonstração em uma conta ativa.');
    error.statusCode = 403;
    error.trialExpired = true;
    throw error;
  }

  const isDemoEnvironment = ['TRIAL', 'DEMO'].includes(company?.access_mode);
  return {
    isTrial: isDemoEnvironment,
    demoLifetime: company?.access_mode === 'DEMO',
    trialExpiresAt: company?.access_mode === 'TRIAL' ? company.trial_expires_at : null
  };
}

/** Valida datas civis ISO sem aceitar a normalização automática de dias inexistentes. */
function isValidIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

/**
 * Registra um marco funcional do ciclo de teste gratuito. O executor pode ser
 * o pool ou uma conexão transacional, permitindo que mudanças de acesso e seu
 * histórico sejam confirmados de forma atômica.
 */
async function registrarEventoTrial(executor, {
  empresa,
  eventType,
  title,
  detail = null,
  actorId = null,
  actorLabel = 'Sistema',
  metadata = null
}) {
  await executor.execute(
    `INSERT INTO saas_trial_events
       (empresa, event_type, title, detail, actor_id, actor_label, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      empresa,
      eventType,
      String(title).slice(0, 160),
      detail ? String(detail).slice(0, 4000) : null,
      actorId,
      String(actorLabel || 'Sistema').slice(0, 150),
      metadata ? JSON.stringify(metadata) : null
    ]
  );
}

async function emitirSessaoAutenticada(user, req) {
  // Centraliza criação de JWT e registro em sessoes_ativas para login normal/MFA.
  const tenantAccess = await obterAcessoTenant(user);
  const ip = req.security?.ip || req.ip || 'Desconhecido';
  const userAgent = req.security?.userAgent || req.headers['user-agent'] || 'Desconhecido';
  const tokenTtlHours = Number(process.env.JWT_EXPIRES_HOURS || 12);
  const token = jwt.sign({ id: user.id, role: user.role, filial: user.filial, empresa: user.empresa }, SECRET_KEY, { expiresIn: `${tokenTtlHours}h` });
  const nomeSessao = user.nome_gerente || user.nome_coordenador || user.nome_tecnico || user.usuario;

  await pool.execute(
    'INSERT INTO sessoes_ativas (usuario_id, usuario_nome, role, token, ip_address, user_agent, expires_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), NOW())',
    [user.id, nomeSessao, user.role, token, ip, String(userAgent).slice(0, 500), tokenTtlHours]
  );
  await registrarAuditoria('LOGIN_SUCCESS', nomeSessao, `Sessão iniciada em ${ip}`, 'success');
  await registrarEventoSeguranca({ eventType: 'LOGIN_SUCCESS', actor: nomeSessao, ip, userAgent, severity: 'success', detail: `role=${user.role}` });

  return {
    token,
    id: user.id,
    role: user.role,
    filial: user.filial,
    empresa: user.empresa,
    nome_gerente: user.nome_gerente,
    nome_coordenador: user.nome_coordenador,
    nome_tecnico: user.nome_tecnico,
    mfaEnabled: Boolean(user.mfa_enabled),
    mustChangePassword: Boolean(user.must_change_password),
    isTrial: tenantAccess.isTrial,
    demoLifetime: tenantAccess.demoLifetime,
    trialExpiresAt: tenantAccess.trialExpiresAt
  };
}


/**
 * Concentra a logica de aplicar escopo chamado para manter o restante do rota/API mais legivel.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
 *
 * @param {import("express").Request} req - Requisição HTTP com parâmetros, corpo e contexto de autenticação.
 * @param {unknown} query - Valor de query consumido por esta rotina.
 * @param {unknown} params - Valor de params consumido por esta rotina.
 * @param {unknown} alias - Valor de alias consumido por esta rotina.
 * @returns {unknown} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function aplicarEscopoChamado(req, query, params, alias = '') {
  // Aplica isolamento multi-tenant em queries de chamados sem duplicar lógica.
  const prefix = alias ? `${alias}.` : '';
  if (req.userRole !== 'DEV') {
    query += ` AND ${prefix}empresa = ?`;
    params.push(req.userEmpresa);
    if (req.userRole === 'LOJA') {
      query += ` AND ${prefix}filial = ?`;
      params.push(req.userFilial);
    }
  }
  return { query, params };
}


/**
 * Executa executar consulta opcional coordenando as etapas principais desse fluxo.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: acessa a camada de persistência; registra informações de diagnóstico
 *
 * @param {unknown} sql - Valor de sql consumido por esta rotina.
 * @param {unknown} params - Valor de params consumido por esta rotina.
 * @param {unknown} fallbackSql - Valor de fallback sql consumido por esta rotina.
 * @param {unknown} fallbackParams - Valor de fallback params consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function executarConsultaOpcional(sql, params = [], fallbackSql = null, fallbackParams = []) {
  // Permite compatibilidade com bancos legados que ainda não possuem alguma coluna/tabela.
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    const codigoLegado = ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code);
    if (codigoLegado && fallbackSql) {
      console.warn(`[DB] Consulta auxiliar em modo compatibilidade: ${error.message}`);
      const [rows] = await pool.execute(fallbackSql, fallbackParams);
      return rows;
    }
    if (codigoLegado) {
      console.warn(`[DB] Consulta auxiliar ignorada: ${error.message}`);
      return [];
    }
    throw error;
  }
}


/**
 * Extrai extrair zip com seguranca de uma entrada externa ou configuracao local.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
 *
 * Efeitos colaterais: lê ou grava arquivos locais
 *
 * @param {unknown} zip - Valor de zip consumido por esta rotina.
 * @param {unknown} destino - Valor de destino consumido por esta rotina.
 * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function extrairZipComSeguranca(zip, destino, prefixo = '') {
  // A validação acontece por completo antes da primeira escrita. Em pacotes
  // full-stack, o prefixo também impede que arquivos de um alvo vazem para outro.
  const destinoResolvido = path.resolve(destino);
  const prefixoNormalizado = prefixo ? `${String(prefixo).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}/` : '';
  const planos = [];

  for (const entry of zip.getEntries()) {
    const nomeNormalizado = entry.entryName.replace(/\\/g, '/');
    if (prefixoNormalizado && !nomeNormalizado.toLowerCase().startsWith(prefixoNormalizado.toLowerCase())) continue;

    const nomeRelativo = prefixoNormalizado ? nomeNormalizado.slice(prefixoNormalizado.length) : nomeNormalizado;
    if (!nomeRelativo) continue;
    if (nomeNormalizado.startsWith('/') || nomeNormalizado.includes('../') || path.isAbsolute(nomeNormalizado)) {
      throw new Error(`Entrada insegura no pacote: ${entry.entryName}`);
    }

    const destinoArquivo = path.resolve(destinoResolvido, nomeRelativo);
    if (destinoArquivo !== destinoResolvido && !destinoArquivo.startsWith(destinoResolvido + path.sep)) {
      throw new Error(`Entrada fora do diretório permitido: ${entry.entryName}`);
    }

    planos.push({ entry, destinoArquivo });
  }

  if (planos.length === 0) throw new Error(`O pacote não contém arquivos para ${prefixoNormalizado || 'o destino selecionado'}.`);

  for (const { entry, destinoArquivo } of planos) {
    if (entry.isDirectory) {
      fs.mkdirSync(destinoArquivo, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(destinoArquivo), { recursive: true });
      fs.writeFileSync(destinoArquivo, entry.getData());
    }
  }
}

// ============================================================================
// IMPORTAÇÕES DO WHATSAPP BOT E QR CODE
// ============================================================================
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

// ============================================================================
// VARIÁVEIS GLOBAIS (ESTADO DO SERVIDOR E SIMULADOR)
// ============================================================================
let simuladorLogBuffer = "Iniciando Node.js Edge Simulator...\nAguardando primeira leitura de sensores...\n";

// ============================================================================
// INICIALIZAÇÃO SEGURA DO BROKER MQTT (AEDES)
// ============================================================================
Aedes.createBroker()
  .then((mqttBroker) => {
    if (process.env.NODE_ENV === 'production' && (!process.env.MQTT_USERNAME || !process.env.MQTT_PASSWORD)) {
      throw new Error('MQTT_USERNAME e MQTT_PASSWORD são obrigatórios em produção.');
    }
    const tlsHabilitado = String(process.env.MQTT_TLS_ENABLED || '').toLowerCase() === 'true';
    const mqttPort = Number(process.env.MQTT_BROKER_PORT || (tlsHabilitado ? 8883 : 1883));
    let mqttServer;
    if (tlsHabilitado) {
      if (!process.env.MQTT_TLS_KEY_PATH || !process.env.MQTT_TLS_CERT_PATH) {
        throw new Error('MQTT TLS habilitado sem MQTT_TLS_KEY_PATH/MQTT_TLS_CERT_PATH.');
      }
      const tls = require('tls');
      mqttServer = tls.createServer({
        key: fs.readFileSync(path.resolve(process.env.MQTT_TLS_KEY_PATH)),
        cert: fs.readFileSync(path.resolve(process.env.MQTT_TLS_CERT_PATH)),
        ca: process.env.MQTT_TLS_CA_PATH ? fs.readFileSync(path.resolve(process.env.MQTT_TLS_CA_PATH)) : undefined,
        minVersion: 'TLSv1.2'
      }, mqttBroker.handle);
    } else {
      if (process.env.NODE_ENV === 'production' && !envFlagEnabled(process.env.MQTT_ALLOW_INSECURE)) {
        throw new Error('Broker MQTT sem TLS bloqueado em produção. Configure TLS ou MQTT_ALLOW_INSECURE=true explicitamente.');
      }
      mqttServer = require('net').createServer(mqttBroker.handle);
    }

    if (process.env.MQTT_USERNAME && process.env.MQTT_PASSWORD) {
      mqttBroker.authenticate = (client, username, password, callback) => {
        const expectedUser = Buffer.from(process.env.MQTT_USERNAME);
        const expectedPass = Buffer.from(process.env.MQTT_PASSWORD);
        const user = Buffer.from(String(username || ''));
        const pass = Buffer.from(password || '');
        const isValid = user.length === expectedUser.length
          && pass.length === expectedPass.length
          && crypto.timingSafeEqual(user, expectedUser)
          && crypto.timingSafeEqual(pass, expectedPass);
        if (!isValid) {
          registrarEventoSeguranca({ eventType: 'MQTT_AUTH_FAILED', actor: client?.id || null, severity: 'danger', detail: 'Credenciais MQTT inválidas.' });
        }
        callback(null, isValid);
      };

      mqttBroker.authorizePublish = (client, packet, callback) => {
        const topic = String(packet.topic || '');
        const allowed = topic === 'termosync/telemetria'
          || topic === 'termosync/hardware/status'
          || topic.startsWith('termosync/status/')
          || topic.startsWith('termosync/comandos/')
          || topic.startsWith('termosync/ack/')
          || /^termosync\/hardware\/[^/]+\/pedir_config$/.test(topic)
          || topic.startsWith('termosync/solicitar_config/');
        callback(allowed ? null : new Error('Publicação MQTT negada.'));
      };

      mqttBroker.authorizeSubscribe = (client, sub, callback) => {
        const topic = String(sub.topic || '');
        const allowed = topic === 'termosync/telemetria'
          || topic === 'termosync/hardware/+/pedir_config'
          || topic.startsWith('termosync/comandos/')
          || topic.startsWith('termosync/ack/');
        callback(allowed ? null : new Error('Inscrição MQTT negada.'), sub);
      };
    }

    mqttBroker.on('client', (client) => {
      console.log(`🔌 [MQTT] Dispositivo conectado: ${client ? client.id : 'Desconhecido'}`);
    });

    mqttBroker.on('clientError', (client, err) => {
      console.error(`❌ [MQTT] Erro no cliente:`, err.message);
    });

    mqttServer.on('error', (error) => {
      console.error('❌ [MQTT] Porta 1883 indisponível:', error.message);
    });

    // LIGA O BROKER MQTT ESCUTANDO TODA A REDE LOCAL
    mqttServer.listen(mqttPort, '0.0.0.0', function () {
      console.log(`🚀 [BROKER MQTT] Aedes ${tlsHabilitado ? 'TLS' : 'TCP'} em 0.0.0.0:${mqttPort}.`);
    });
  })
  .catch((error) => {
    console.error('❌ [MQTT] Falha ao iniciar o broker Aedes:', error.message);
  });

/**
 * Valida CNPJ com os dois digitos verificadores antes do onboarding publico.
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
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
function isValidCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;

  /**
   * Concentra a logica de calculate digit para manter o restante do rota/API mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
   *
   * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
   *
   * @param {unknown} base - Valor de base consumido por esta rotina.
   * @param {unknown} weights - Valor de weights consumido por esta rotina.
   * @returns {unknown} Resultado calculado para consumo do chamador.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const calculateDigit = (base, weights) => {
    const sum = base.split('').reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${first}${second}`);
}

/**
 * Mede o uso agregado da CPU em uma pequena janela sem depender de valores simulados.
 *
 * Responsabilidade: mantém este comportamento isolado para que validação,
 * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
 *
 * Fluxo principal:
 * - Transforma ou filtra a coleção sem alterar diretamente os dados recebidos.
 * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
 *
 * Efeitos colaterais: atualiza estado reativo da interface
 *
 * @param {unknown} intervalMs - Valor de interval ms consumido por esta rotina.
 * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
async function sampleCpuUsage(intervalMs = 160) {

  /**
   * Concentra a logica de snapshot para manter o restante do rota/API mais legivel.
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
  const snapshot = () => os.cpus().map((cpu) => ({
    idle: cpu.times.idle,
    total: Object.values(cpu.times).reduce((sum, value) => sum + value, 0)
  }));
  const start = snapshot();
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
  const end = snapshot();
  let idleDelta = 0;
  let totalDelta = 0;
  end.forEach((cpu, index) => {
    idleDelta += cpu.idle - (start[index]?.idle || 0);
    totalDelta += cpu.total - (start[index]?.total || 0);
  });
  return totalDelta > 0 ? Number(((1 - (idleDelta / totalDelta)) * 100).toFixed(1)) : 0;
}

module.exports = (app, io) => {
  /*
   * Mapa de manutenção deste arquivo:
   * - Saúde/diagnóstico: /api/health, /api/system/health, /api/whatsapp/status.
   * - Chat/BI/Financeiro: dados auxiliares de comunicação, analytics e cobranças.
   * - Autenticação: login, MFA, sessões, senha e permissões.
   * - Cadastros base: empresas, usuários, lojas, equipamentos e hardware IoT.
   * - Operação técnica: leituras, notificações, chamados, suporte e relatórios.
   * - DEV/SOC: auditoria, segurança, purge, deploy, SQL controlado e onboarding.
   * - Edge/MQTT: broker local, telemetria MQTT, scanner de rede e portal público.
   */
  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 20),
    keyPrefix: 'login',
    keyGenerator: (req) => req.security?.ip || req.ip || 'unknown',
    message: 'Muitas tentativas de acesso. Aguarde alguns minutos.'
  });

  const passwordResetLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX || 5),
    keyPrefix: 'password-reset',
    keyGenerator: (req) => `${req.security?.ip || req.ip || 'unknown'}:${normalizeCredential(req.body?.usuario, 120).toLowerCase()}`,
    message: 'Muitas solicitações. Tente novamente em alguns minutos.'
  });

  const passwordResetConfirmLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.PASSWORD_RESET_CONFIRM_RATE_LIMIT_MAX || 20),
    keyPrefix: 'password-reset-confirm',
    keyGenerator: (req) => `${req.security?.ip || req.ip || 'unknown'}:${normalizeCredential(req.body?.usuario, 120).toLowerCase()}`,
    message: 'Muitas tentativas de confirmação. Aguarde alguns minutos ou solicite um novo código.'
  });

  const rootPasscodeLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.ROOT_PASSCODE_RATE_LIMIT_MAX || 8),
    keyPrefix: 'root-passcode',
    keyGenerator: (req) => req.security?.ip || req.ip || 'unknown',
    message: 'Muitas tentativas de desbloqueio. Aguarde alguns minutos.'
  });

  const impersonationExchangeLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.IMPERSONATION_EXCHANGE_RATE_LIMIT_MAX || 30),
    keyPrefix: 'impersonation-exchange',
    keyGenerator: (req) => req.security?.ip || req.ip || 'unknown',
    message: 'Muitas tentativas de acesso remoto. Aguarde alguns minutos.'
  });

  const preCadastroLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.PRE_CADASTRO_RATE_LIMIT_MAX || 8),
    keyPrefix: 'pre-cadastro',
    keyGenerator: (req) => req.security?.ip || req.ip || 'unknown',
    message: 'Muitas solicitações de cadastro. Aguarde antes de tentar novamente.'
  });


  /**
   * Concentra a logica de emitir operacao atualizada para manter o restante do rota/API mais legivel.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: troca eventos em tempo real; registra informações de diagnóstico
   *
   * @param {object|Array} payload - Dados de entrada que serão validados e transformados pelo fluxo.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  async function emitirOperacaoAtualizada(payload = {}) {
    try { io.emit('operacao_atualizada', payload); } catch (e) { console.warn('[SOCKET] Falha ao emitir operação atualizada:', e.message); }
  }

  // ============================================================================
  // MOTOR DO WHATSAPP BOT (BIDIRECIONAL ZERO-TRUST)
  // ============================================================================
  const isWhatsAppEnabled = envFlagEnabled(process.env.WHATSAPP_ENABLED);
  let wpStatus = isWhatsAppEnabled ? 'STARTING' : 'DISABLED';
  let wpQrUrl = '';
  const wpContexto = {};
  let wpClient = null;

  if (isWhatsAppEnabled) {
    wpClient = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-quic']
      }
    });

    wpClient.on('qr', async (qr) => {
      wpStatus = 'AWAITING_QR';
      wpQrUrl = await qrcode.toDataURL(qr);
      console.log('📱 [WHATSAPP] QR Code gerado! Abra a aba "Robô WhatsApp" no painel.');
      if (io) io.emit('whatsapp_status', { status: wpStatus, qr: wpQrUrl });
    });

    wpClient.on('ready', () => {
      wpStatus = 'CONNECTED';
      wpQrUrl = '';
      console.log('✅ [WHATSAPP] Bot TermoSync conectado e operacional!');
      if (io) io.emit('whatsapp_status', { status: wpStatus });
    });

    wpClient.on('disconnected', () => {
      wpStatus = 'DISCONNECTED';
      if (io) io.emit('whatsapp_status', { status: wpStatus });
    });

    wpClient.on('auth_failure', (message) => {
      wpStatus = 'AUTH_FAILURE';
      console.error('[WHATSAPP] Falha de autenticação:', message);
      if (io) io.emit('whatsapp_status', { status: wpStatus });
    });

    // OUVINDO COMANDOS DO CLIENTE NO WHATSAPP
    wpClient.on('message', async (msg) => {
      try {
        const senderPhone = msg.from.replace('@c.us', '');

        // ZERO-TRUST: Verifica se esse número existe na base
        const [users] = await pool.execute('SELECT nome_gerente, nome_tecnico, role, filial FROM usuarios WHERE telefone = ? OR telefone = ?', [senderPhone, `+${senderPhone}`]);
        if (users.length === 0) return; // Ignora desconhecidos silenciosamente

        const user = users[0];
        const nomePessoa = user.nome_gerente || user.nome_tecnico || 'Equipe';
        const comando = msg.body.trim();

        // Verifica se há um alerta pendente para responder neste número
        if (wpContexto[senderPhone]) {
          const { equipamento_id, equipamento_nome } = wpContexto[senderPhone];

          if (comando === '1') {
            // Ligar Motor via MQTT Local
            const payload = JSON.stringify(montarComandoMqtt("MANUAL_RELE", true));
            const mqttCmd = mqtt.connect(getMqttBrokerUrl(), getMqttClientOptions());
            mqttCmd.on('connect', () => {
              mqttCmd.publish(`termosync/comandos/${equipamento_id}`, payload);
              mqttCmd.end();
            });

            msg.reply(`✅ *Comando Recebido, ${nomePessoa}!*\n\nSinal enviado para *${equipamento_nome}*.\nO compressor será acionado em instantes.`);
            delete wpContexto[senderPhone];
          } else if (comando === '2') {
             msg.reply(`Entendido. O alerta de *${equipamento_nome}* foi silenciado. Acompanhe pelo painel.`);
             delete wpContexto[senderPhone];
          } else {
             msg.reply(`❌ *Comando Inválido.*\nResponda *1* para ligar o compressor ou *2* para ignorar.`);
          }
        } else {
          if(comando.toLowerCase() === 'oi' || comando.toLowerCase() === 'menu') {
             msg.reply(`🤖 Olá, ${nomePessoa}! Sou a inteligência operacional do *TermoSync*.\n\nSua filial vinculada é a *${user.filial}*. Vou monitorar suas câmaras frias 24/7 e avisarei aqui se algo sair do controle!`);
          }
        }
      } catch (e) {
        console.error('Erro no WhatsApp:', e);
      }
    });

    Promise.resolve(wpClient.initialize()).catch((error) => {
      wpStatus = 'ERROR';
      console.error('[WHATSAPP] Inicialização falhou sem derrubar o backend:', error.message);
      if (io) io.emit('whatsapp_status', { status: wpStatus });
    });
  } else {
    console.log('[WHATSAPP] Integração desativada. Configure WHATSAPP_ENABLED=true para iniciar o robô.');
  }


  /**
   * Envia enviar alerta whats app para o canal ou provedor configurado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: registra informações de diagnóstico
   *
   * @param {unknown} telefone - Valor de telefone consumido por esta rotina.
   * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
   * @param {string|number} equipamentoId - Identificador do registro ou recurso processado.
   * @param {unknown} equipamentoNome - Valor de equipamento nome consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const enviarAlertaWhatsApp = async (telefone, mensagem, equipamentoId, equipamentoNome) => {
    if (!wpClient || wpStatus !== 'CONNECTED' || !telefone) return;
    try {
      const numeroLimpo = telefone.replace(/\D/g, '');
      const chatId = `55${numeroLimpo}@c.us`;
      await wpClient.sendMessage(chatId, mensagem);
      wpContexto[`55${numeroLimpo}`] = { equipamento_id: equipamentoId, equipamento_nome: equipamentoNome };
    } catch (e) { console.error('Falha ao enviar WhatsApp:', e); }
  };


  /**
   * Endpoint GET /api/whatsapp/status.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/whatsapp/status
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/whatsapp/status', verificarToken, (req, res) => {
    res.json({ status: wpStatus, qr: wpQrUrl });
  });


  /**
   * Endpoint GET /api/health.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/health
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/health', async (req, res) => {
    const snapshot = await getSystemHealthSnapshot({
      mqttConnected: mqttClientRecv?.connected,
      whatsappStatus: wpStatus,
      socketClients: io?.engine?.clientsCount || 0
    });
    const statusCode = snapshot.ok ? 200 : 503;
    res.status(statusCode).json(snapshot);
  });


  /**
   * Endpoint GET /logs.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /logs
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/logs', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [rows] = await pool.execute(`
        SELECT l.id, l.equipamento_id, l.temperatura, l.umidade, l.consumo_kwh, l.data_hora,
               e.nome, e.motor_ligado, e.em_degelo, h.sinal_wifi
        FROM leituras l
        JOIN equipamentos e ON e.id = l.equipamento_id
        LEFT JOIN hardware_iot h ON h.equipamento_id = l.equipamento_id
        ORDER BY l.id DESC LIMIT 30
      `);
      if (!rows.length) return res.type('text/plain').send(simuladorLogBuffer);
      const output = rows.reverse().map((row) => {
        const timestamp = new Date(row.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const state = row.em_degelo ? 'DEGELO' : row.motor_ligado ? 'LIGADO' : 'DESLIGADO';
        return `\n==================================================\n📡 [TELEMETRIA] Leitura persistida #${row.id}\n==================================================\n🕒 Data/Hora   : ${timestamp}\n🧊 Equipamento : ${row.nome} (#${row.equipamento_id})\n🌡️ Temperatura : ${Number(row.temperatura).toFixed(2)} °C\n💧 Umidade     : ${Number(row.umidade).toFixed(1)} %\n⚙️ Atuador     : ${state}\n📶 Sinal Wi-Fi : ${row.sinal_wifi ?? 'não informado'} dBm\n⚡ Consumo     : ${Number(row.consumo_kwh || 0).toFixed(3)} kWh\n==================================================`;
      }).join('\n');
      res.type('text/plain').send(output);
    } catch (error) {
      console.error('[LOGS] Falha ao consultar telemetria persistida:', error.message);
      res.status(500).type('text/plain').send('Falha ao consultar as leituras do banco de dados.');
    }
  });


  /**
   * Endpoint POST /clear.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /clear
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/clear', verificarToken, requireRoles('DEV'), (req, res) => {
    simuladorLogBuffer = "Memória do Simulador limpa remotamente pelo SysAdmin.\n";
    res.send('OK');
  });

  // ============================================================================
  // MOTOR DE WEBSOCKETS - INTERCETAÇÃO E GRAVAÇÃO DO CHAT
  // ============================================================================
  if (io && !io._chatListenerConfigured) {
    io.on('connection', (socket) => {
      socket.on('enviar_mensagem_chat', async (msg) => {
        try {
          const query = `INSERT INTO chat_mensagens (remetente_id, remetente_nome, destino_id, texto, data_hora) VALUES (?, ?, ?, ?, NOW())`;
          const [result] = await pool.execute(query, [msg.remetenteId, msg.remetenteNome, msg.destinoId || 'todos', msg.texto]);
          const mensagemSalva = { id: result.insertId, remetenteId: msg.remetenteId, remetenteNome: msg.remetenteNome, destinoId: msg.destinoId || 'todos', texto: msg.texto, data: new Date().toISOString(), tipo: 'received' };
          socket.broadcast.emit('nova_mensagem_chat', mensagemSalva);
        } catch (error) { console.error('❌ [ERRO CHAT] Falha ao persistir mensagem no MySQL:', error); }
      });
    });
    io._chatListenerConfigured = true;
  }


  /**
   * Endpoint GET /api/chat/historico.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/chat/historico
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/chat/historico', verificarToken, async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT id, remetente_id AS remetenteId, remetente_nome AS remetenteNome, destino_id AS destinoId, texto, data_hora AS data FROM chat_mensagens ORDER BY data_hora ASC LIMIT 100');
      res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Erro ao carregar histórico de chat.' }); }
  });

  // ============================================================================
  // BUSINESS INTELLIGENCE (BI) E FATURAMENTO SAAS
  // ============================================================================
  /** Retorna o inventário operacional e comercial de todas as licenças SaaS. */
  /**
   * Endpoint GET /api/saas/licenses.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/saas/licenses
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/saas/licenses', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT
          l.id,
          l.nome AS filial,
          l.empresa,
          company.access_mode,
          company.trial_started_at,
          company.trial_expires_at,
          l.status AS tenant_status,
          l.data_cadastro,
          COALESCE(st.plano, fat.plano, 'FREE') AS plano,
          COALESCE(st.retention_days, 30) AS retention_days,
          st.api_key_prefix,
          st.api_key_created_at,
          st.api_key_last_used_at,
          st.updated_at AS license_updated_at,
          IF(st.filial IS NULL, 0, 1) AS settings_configured,
          COALESCE(infra.equipamentos, 0) AS equipamentos,
          COALESCE(infra.online, 0) AS equipamentos_online,
          infra.ultima_telemetria,
          COALESCE(alertas.alertas_abertos, 0) AS alertas_abertos,
          COALESCE(acessos.usuarios, 0) AS usuarios,
          COALESCE(acessos.sessoes_ativas, 0) + COALESCE(remoto.sessoes_remotas, 0) AS sessoes_ativas,
          COALESCE(remoto.sessoes_remotas, 0) AS sessoes_remotas,
          remoto.ultimo_acesso_remoto,
          remoto.proxima_expiracao_remota,
          fat.status AS fatura_status,
          fat.total AS fatura_total,
          fat.data_vencimento,
          fat.ciclo_mes,
          fat.ciclo_ano
        FROM loja l
        LEFT JOIN empresas company ON company.nome COLLATE utf8mb4_unicode_ci = l.empresa COLLATE utf8mb4_unicode_ci
        LEFT JOIN saas_tenant_settings st ON st.filial = l.nome
        LEFT JOIN (
          SELECT e.filial,
                 COUNT(*) AS equipamentos,
                 SUM(CASE WHEN h.ultima_comunicacao >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) THEN 1 ELSE 0 END) AS online,
                 MAX(h.ultima_comunicacao) AS ultima_telemetria
          FROM equipamentos e
          LEFT JOIN hardware_iot h ON h.equipamento_id = e.id
          GROUP BY e.filial
        ) infra ON infra.filial COLLATE utf8mb4_unicode_ci = l.nome
        LEFT JOIN (
          SELECT e.filial, COUNT(*) AS alertas_abertos
          FROM notificacoes n
          JOIN equipamentos e ON e.id = n.equipamento_id
          WHERE n.resolvido = 0 OR n.resolvido IS NULL
          GROUP BY e.filial
        ) alertas ON alertas.filial COLLATE utf8mb4_unicode_ci = l.nome
        LEFT JOIN (
          SELECT u.filial,
                 COUNT(DISTINCT u.id) AS usuarios,
                 COUNT(DISTINCT CASE WHEN s.impersonated_filial IS NULL AND s.revogado = FALSE AND (s.expires_at IS NULL OR s.expires_at > NOW()) THEN s.id END) AS sessoes_ativas
          FROM usuarios u
          LEFT JOIN sessoes_ativas s ON s.usuario_id = u.id
          GROUP BY u.filial
        ) acessos ON acessos.filial = l.nome
        LEFT JOIN (
          SELECT impersonated_filial,
                 COUNT(*) AS sessoes_remotas,
                 MAX(data_login) AS ultimo_acesso_remoto,
                 MIN(expires_at) AS proxima_expiracao_remota
          FROM sessoes_ativas
          WHERE impersonated_filial IS NOT NULL
            AND revogado = FALSE
            AND (expires_at IS NULL OR expires_at > NOW())
          GROUP BY impersonated_filial
        ) remoto ON remoto.impersonated_filial = l.nome
        LEFT JOIN faturas_saas fat ON fat.id = (
          SELECT f2.id FROM faturas_saas f2
          WHERE f2.filial COLLATE utf8mb4_unicode_ci = l.nome
          ORDER BY f2.ciclo_ano DESC, f2.ciclo_mes DESC, f2.id DESC
          LIMIT 1
        )
        ORDER BY l.empresa, l.nome
      `);

      res.json(rows.map((row) => ({
        ...row,
        id: Number(row.id),
        settings_configured: Boolean(row.settings_configured),
        retention_days: Number(row.retention_days || 30),
        equipamentos: Number(row.equipamentos || 0),
        equipamentos_online: Number(row.equipamentos_online || 0),
        alertas_abertos: Number(row.alertas_abertos || 0),
        usuarios: Number(row.usuarios || 0),
        sessoes_ativas: Number(row.sessoes_ativas || 0),
        sessoes_remotas: Number(row.sessoes_remotas || 0),
        fatura_total: row.fatura_total == null ? null : Number(row.fatura_total)
      })));
    } catch (error) {
      console.error('[SAAS] Falha ao listar licenças:', error.message);
      res.status(500).json({ error: 'Falha ao carregar licenças SaaS.' });
    }
  });

  /** Persiste plano e retenção do tenant e mantém o estado da loja coerente. */
  /**
   * Endpoint PUT /api/saas/licenses/:filial.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/saas/licenses/:filial
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/saas/licenses/:filial', verificarToken, requireRoles('DEV'), async (req, res) => {
    const filial = normalizeCredential(req.params.filial, 100);
    const plano = String(req.body.plano || '').toUpperCase();
    const retentionDays = Number(req.body.retentionDays);
    const planosValidos = new Set(['FREE', 'PRO', 'ENTERPRISE', 'SUSPENSO']);
    const retencoesValidas = new Set([30, 90, 365]);
    if (!filial || !planosValidos.has(plano) || !retencoesValidas.has(retentionDays)) {
      return res.status(400).json({ error: 'Plano ou retenção inválidos.' });
    }

    try {
      const [lojas] = await pool.execute('SELECT nome, status FROM loja WHERE nome = ? LIMIT 1', [filial]);
      if (lojas.length === 0) return res.status(404).json({ error: 'Tenant não encontrado.' });

      await pool.execute(`
        INSERT INTO saas_tenant_settings (filial, plano, retention_days)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE plano = VALUES(plano), retention_days = VALUES(retention_days)
      `, [filial, plano, retentionDays]);

      if (plano === 'SUSPENSO') {
        await pool.execute("UPDATE loja SET status = 'Suspensa' WHERE nome = ? AND status <> 'Bloqueada'", [filial]);
      } else {
        await pool.execute("UPDATE loja SET status = 'Ativa' WHERE nome = ? AND status = 'Suspensa'", [filial]);
        await pool.execute(`
          UPDATE empresas company
          JOIN loja l ON l.empresa COLLATE utf8mb4_unicode_ci = company.nome COLLATE utf8mb4_unicode_ci
          SET company.access_mode = 'CUSTOMER',
              company.trial_started_at = NULL,
              company.trial_expires_at = NULL
          WHERE l.nome COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
        `, [filial]);
      }

      await registrarAuditoria('SAAS_LICENSE_UPDATED', req.userRole, `${filial}: ${plano}, retenção ${retentionDays}d`, plano === 'SUSPENSO' ? 'danger' : 'warning');
      if (io) io.emit('saas_license_updated', { filial, plano, retentionDays });
      res.json({ success: true, filial, plano, retentionDays });
    } catch (error) {
      console.error('[SAAS] Falha ao atualizar licença:', error.message);
      res.status(500).json({ error: 'Falha ao atualizar licença SaaS.' });
    }
  });

  /** Gera uma credencial forte e armazena somente seu hash; o segredo é exibido uma vez. */
  /**
   * Endpoint POST /api/saas/licenses/:filial/api-key.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/saas/licenses/:filial/api-key
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/saas/licenses/:filial/api-key', verificarToken, requireRoles('DEV'), async (req, res) => {
    const filial = normalizeCredential(req.params.filial, 100);
    try {
      const [lojas] = await pool.execute('SELECT nome FROM loja WHERE nome = ? LIMIT 1', [filial]);
      if (lojas.length === 0) return res.status(404).json({ error: 'Tenant não encontrado.' });

      const secret = `ts_live_${crypto.randomBytes(24).toString('hex')}`;
      const keyHash = crypto.createHash('sha256').update(secret).digest('hex');
      const prefix = `${secret.slice(0, 15)}...`;
      await pool.execute(`
        INSERT INTO saas_tenant_settings (filial, api_key_hash, api_key_prefix, api_key_created_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE api_key_hash = VALUES(api_key_hash), api_key_prefix = VALUES(api_key_prefix), api_key_created_at = NOW(), api_key_last_used_at = NULL
      `, [filial, keyHash, prefix]);
      await registrarAuditoria('SAAS_API_KEY_ROTATED', req.userRole, filial, 'warning');
      res.status(201).json({ success: true, key: secret, prefix, createdAt: new Date().toISOString() });
    } catch (error) {
      console.error('[SAAS] Falha ao gerar chave:', error.message);
      res.status(500).json({ error: 'Falha ao gerar chave de integração.' });
    }
  });

  /** Revoga a credencial de integração sem expor seu valor armazenado. */
  /**
   * Endpoint DELETE /api/saas/licenses/:filial/api-key.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route DELETE /api/saas/licenses/:filial/api-key
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.delete('/api/saas/licenses/:filial/api-key', verificarToken, requireRoles('DEV'), async (req, res) => {
    const filial = normalizeCredential(req.params.filial, 100);
    try {
      const [result] = await pool.execute('UPDATE saas_tenant_settings SET api_key_hash = NULL, api_key_prefix = NULL, api_key_created_at = NULL, api_key_last_used_at = NULL WHERE filial = ?', [filial]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Tenant não configurado.' });
      await registrarAuditoria('SAAS_API_KEY_REVOKED', req.userRole, filial, 'danger');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao revogar chave de integração.' });
    }
  });

  /** Encerra todas as sessões normais e de suporte remoto vinculadas ao tenant. */
  /**
   * Endpoint POST /api/saas/licenses/:filial/revoke-sessions.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/saas/licenses/:filial/revoke-sessions
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/saas/licenses/:filial/revoke-sessions', verificarToken, requireRoles('DEV'), async (req, res) => {
    const filial = normalizeCredential(req.params.filial, 100);
    try {
      const [result] = await pool.execute(`
        UPDATE sessoes_ativas s
        LEFT JOIN usuarios u ON u.id = s.usuario_id
        SET s.revogado = TRUE
        WHERE s.revogado = FALSE AND (u.filial = ? OR s.impersonated_filial = ? OR s.usuario_nome = ?)
      `, [filial, filial, `Impersonate: ${filial}`]);
      await registrarAuditoria('SAAS_TENANT_SESSIONS_REVOKED', req.userRole, `${filial}: ${result.affectedRows} sessão(ões)`, 'danger');
      if (io) io.emit('tenant_sessions_revoked', { filial });
      res.json({ success: true, revoked: Number(result.affectedRows || 0) });
    } catch (error) {
      console.error('[SAAS] Falha ao revogar sessões:', error.message);
      res.status(500).json({ error: 'Falha ao encerrar sessões do tenant.' });
    }
  });


  /**
   * Endpoint GET /api/bi/analytics.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/bi/analytics
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/bi/analytics', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV' && req.userRole !== 'ADMIN') return res.status(403).json({ error: 'Acesso restrito.' });
    try {
      const agora = new Date();
      const mesAtual = agora.getMonth() + 1;
      const anoAtual = agora.getFullYear();

      // MRR representa somente o ciclo corrente; somar todo o histórico inflava
      // receita, ARR e margem cada vez que um novo mês era faturado.
      const [
        [lojasRows],
        [equipRows],
        [faturasRows],
        [riscoRows],
        [historicoFaturas],
        [healthRows]
      ] = await Promise.all([
        pool.query('SELECT COUNT(*) as total FROM loja WHERE status = "Ativa"'),
        pool.query('SELECT COUNT(*) as total FROM equipamentos'),
        pool.execute(`
          SELECT plano, SUM(total) AS receita, COUNT(DISTINCT filial) AS qtd
          FROM faturas_saas
          WHERE ciclo_mes = ? AND ciclo_ano = ?
          GROUP BY plano
        `, [mesAtual, anoAtual]),
        pool.query(`SELECT e.id, e.nome as maquina, e.filial, e.motor_ligado, e.em_degelo, COUNT(n.id) as alertas_pendentes FROM equipamentos e LEFT JOIN notificacoes n FORCE INDEX (idx_notificacoes_equip_resolvido) ON n.equipamento_id = e.id AND (n.resolvido = 0 OR n.resolvido IS NULL) GROUP BY e.id, e.nome, e.filial, e.motor_ligado, e.em_degelo ORDER BY alertas_pendentes DESC, e.motor_ligado ASC LIMIT 100`),
        pool.query(`
          SELECT ciclo_ano, ciclo_mes, SUM(total) AS receita
          FROM faturas_saas
          GROUP BY ciclo_ano, ciclo_mes
          ORDER BY ciclo_ano DESC, ciclo_mes DESC
          LIMIT 6
        `),
        pool.query(`
          SELECT COUNT(*) AS total, SUM(status = 'ok') AS saudaveis
          FROM system_health_history
          WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `)
      ]);
      const totalLojas = Number(lojasRows[0]?.total || 0);
      const totalEquipamentos = Number(equipRows[0]?.total || 0);
      const mrrReal = faturasRows.reduce((total, row) => total + Number(row.receita || 0), 0);
      const arrReal = mrrReal * 12;
      const custoCloudReal = (totalLojas * 45) + (totalEquipamentos * 12);
      const lucroLiquido = mrrReal - custoCloudReal;
      const margemBruta = mrrReal > 0 ? Number(((lucroLiquido / mrrReal) * 100).toFixed(1)) : null;

      const distribuicaoPlanos = faturasRows
        .map(row => ({
          name: String(row.plano || 'Sem plano').replace(/\b\w/g, letter => letter.toUpperCase()),
          value: Number(row.qtd || 0)
        }))
        .filter(item => item.value > 0);

      const analiseRisco = riscoRows.map(r => {
        let score = Number(r.alertas_pendentes) * 25; if (r.motor_ligado == 0 && r.em_degelo == 0) score += 45;
        return { id: r.id, maquina: `${r.maquina} (${r.filial || 'Matriz'})`, risco: Math.min(98, Math.max(5, score)), alertas: Number(r.alertas_pendentes), statusMotor: r.em_degelo ? 'Degelo' : (r.motor_ligado ? 'Ativo' : 'Parado') };
      });

      const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const receitaPorCiclo = new Map(historicoFaturas.map(row => [`${row.ciclo_ano}-${row.ciclo_mes}`, Number(row.receita || 0)]));
      const mesAtualIdx = agora.getMonth();
      const dreData = [];
      for (let i = 5; i >= 0; i--) {
        const dataCiclo = new Date(anoAtual, mesAtualIdx - i, 1);
        const cicloMes = dataCiclo.getMonth() + 1;
        const cicloAno = dataCiclo.getFullYear();
        const receitaMes = receitaPorCiclo.get(`${cicloAno}-${cicloMes}`) || 0;
        dreData.push({
          name: `${mesesNomes[cicloMes - 1]}/${String(cicloAno).slice(-2)}`,
          Receita_SaaS: Number(receitaMes.toFixed(2)),
          Custos_Cloud: Number(custoCloudReal.toFixed(2)),
          Lucro_Liquido: Number((receitaMes - custoCloudReal).toFixed(2))
        });
      }

      const totalAmostras = Number(healthRows[0]?.total || 0);
      const uptimeGlobal = totalAmostras > 0
        ? Number(((Number(healthRows[0]?.saudaveis || 0) / totalAmostras) * 100).toFixed(2))
        : null;

      res.json({
        generatedAt: new Date().toISOString(),
        period: { month: mesAtual, year: anoAtual, healthWindowHours: 24 },
        kpis: {
          mrr: Number(mrrReal.toFixed(2)),
          arr: Number(arrReal.toFixed(2)),
          margem: margemBruta,
          uptimeGlobal,
          totalLojas,
          totalEquipamentos,
          custoCloudEstimado: Number(custoCloudReal.toFixed(2)),
          lucroLiquido: Number(lucroLiquido.toFixed(2))
        },
        dreData,
        distribuicaoPlanos,
        analiseRisco,
        metadata: {
          revenueSource: 'faturas_saas',
          healthSamples: totalAmostras,
          costModel: 'R$ 45 por loja + R$ 12 por equipamento/mês'
        }
      });
    } catch (error) {
      console.error('[BI] Falha ao consolidar analytics:', error.message);
      res.status(500).json({ error: 'Falha no BI.', requestId: req.security?.requestId });
    }
  });


  /**
   * Endpoint GET /api/financeiro/faturas/atuais.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/financeiro/faturas/atuais
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/financeiro/faturas/atuais', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    try {
      const [todasFaturas] = await pool.query(`SELECT filial, status, data_vencimento FROM faturas_saas ORDER BY data_vencimento ASC`);
      const faturasFormatadas = {}; const hoje = new Date();
      todasFaturas.forEach(fatura => {
        const dataVenc = new Date(fatura.data_vencimento); dataVenc.setHours(23, 59, 59, 999);
        const isVencida = dataVenc < hoje && fatura.status !== 'PAGO'; const diffDays = isVencida ? Math.ceil((hoje - dataVenc) / (1000 * 60 * 60 * 24)) : 0;
        if (!faturasFormatadas[fatura.filial]) faturasFormatadas[fatura.filial] = { foiPaga: true, atrasoDias: 0 };
        if (fatura.status !== 'PAGO') { faturasFormatadas[fatura.filial].foiPaga = false; if (isVencida && diffDays > faturasFormatadas[fatura.filial].atrasoDias) faturasFormatadas[fatura.filial].atrasoDias = diffDays; }
      });
      res.json(faturasFormatadas);
    } catch (error) { res.status(500).json({ error: "Erro interno no servidor" }); }
  });

  /** Consolida receita, recebimentos, aging e faturas do ciclo para o Core Financeiro. */
  /**
   * Endpoint GET /api/financeiro/overview.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/financeiro/overview
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/financeiro/overview', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const now = new Date();
      const month = Math.min(12, Math.max(1, Number(req.query.month) || now.getMonth() + 1));
      const year = Math.min(2200, Math.max(2020, Number(req.query.year) || now.getFullYear()));
      const [invoices] = await pool.execute(`
        SELECT f.id, f.filial, f.plano, f.valor_base AS base, f.multa, f.juros, f.total,
               CASE WHEN f.status <> 'PAGO' AND f.data_vencimento < CURDATE() THEN 'ATRASADA' ELSE f.status END AS status,
               f.data_vencimento AS dueDate, f.data_pagamento AS paidAt,
               DATEDIFF(CURDATE(), f.data_vencimento) AS daysPastDue,
               l.empresa, l.endereco, l.telefone, e.cnpj, e.email
        FROM faturas_saas f
        LEFT JOIN loja l ON l.nome COLLATE utf8mb4_unicode_ci = f.filial COLLATE utf8mb4_unicode_ci
        LEFT JOIN empresas e ON e.nome COLLATE utf8mb4_unicode_ci = l.empresa COLLATE utf8mb4_unicode_ci
        WHERE f.ciclo_mes = ? AND f.ciclo_ano = ?
        ORDER BY f.data_vencimento ASC, f.filial ASC
      `, [month, year]);
      const [timelineRows] = await pool.execute(`
        SELECT ciclo_ano AS year, ciclo_mes AS month, SUM(total) AS billed,
               SUM(CASE WHEN status = 'PAGO' THEN total ELSE 0 END) AS received,
               SUM(CASE WHEN status <> 'PAGO' THEN total ELSE 0 END) AS outstanding
        FROM faturas_saas
        GROUP BY ciclo_ano, ciclo_mes
        ORDER BY ciclo_ano DESC, ciclo_mes DESC
        LIMIT 12
      `);
      const [agingRows] = await pool.execute(`
        SELECT CASE
                 WHEN data_vencimento >= CURDATE() THEN 'A vencer'
                 WHEN DATEDIFF(CURDATE(), data_vencimento) <= 7 THEN '1-7 dias'
                 WHEN DATEDIFF(CURDATE(), data_vencimento) <= 30 THEN '8-30 dias'
                 WHEN DATEDIFF(CURDATE(), data_vencimento) <= 60 THEN '31-60 dias'
                 ELSE '61+ dias'
               END AS bucket,
               COUNT(*) AS invoices, SUM(total) AS amount
        FROM faturas_saas
        WHERE status <> 'PAGO'
        GROUP BY bucket
      `);
      const normalizedInvoices = invoices.map((invoice) => ({
        ...invoice,
        base: Number(invoice.base || 0),
        multa: Number(invoice.multa || 0),
        juros: Number(invoice.juros || 0),
        total: Number(invoice.total || 0),
        daysPastDue: Math.max(0, Number(invoice.daysPastDue || 0))
      }));
      const billed = normalizedInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
      const received = normalizedInvoices.filter((invoice) => invoice.status === 'PAGO').reduce((sum, invoice) => sum + invoice.total, 0);
      const overdue = normalizedInvoices.filter((invoice) => invoice.status === 'ATRASADA' || invoice.status === 'VENCIDA').reduce((sum, invoice) => sum + invoice.total, 0);
      const open = normalizedInvoices.filter((invoice) => invoice.status !== 'PAGO').reduce((sum, invoice) => sum + invoice.total, 0);
      res.json({
        generatedAt: new Date().toISOString(),
        period: { month, year },
        summary: {
          billed: Number(billed.toFixed(2)), received: Number(received.toFixed(2)),
          open: Number(open.toFixed(2)), overdue: Number(overdue.toFixed(2)),
          collectionRate: billed > 0 ? Number(((received / billed) * 100).toFixed(1)) : 0,
          invoiceCount: normalizedInvoices.length,
          paidCount: normalizedInvoices.filter((invoice) => invoice.status === 'PAGO').length,
          overdueCount: normalizedInvoices.filter((invoice) => invoice.status === 'ATRASADA' || invoice.status === 'VENCIDA').length
        },
        invoices: normalizedInvoices,
        timeline: timelineRows.reverse().map((row) => ({
          label: `${String(row.month).padStart(2, '0')}/${String(row.year).slice(-2)}`,
          billed: Number(row.billed || 0), received: Number(row.received || 0), outstanding: Number(row.outstanding || 0)
        })),
        aging: agingRows.map((row) => ({ bucket: row.bucket, invoices: Number(row.invoices || 0), amount: Number(row.amount || 0) }))
      });
    } catch (error) {
      console.error('[FINANCEIRO] Falha ao consolidar overview:', error.message);
      res.status(500).json({ error: 'Falha ao consolidar o Core Financeiro.' });
    }
  });

  /** Retorna o extrato persistido de um tenant, sem fabricar competências no cliente. */
  /**
   * Endpoint GET /api/financeiro/faturas/:filial/historico.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/financeiro/faturas/:filial/historico
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/financeiro/faturas/:filial/historico', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const filial = normalizeCredential(req.params.filial, 100);
      const [rows] = await pool.execute(`
        SELECT id, plano, valor_base AS base, multa, juros, total, status,
               data_vencimento AS dueDate, data_pagamento AS paidAt,
               ciclo_mes AS month, ciclo_ano AS year
        FROM faturas_saas WHERE filial = ?
        ORDER BY ciclo_ano DESC, ciclo_mes DESC LIMIT 24
      `, [filial]);
      res.json(rows.map((row) => ({
        ...row,
        competencia: `${String(row.month).padStart(2, '0')}/${row.year}`,
        base: Number(row.base || 0),
        multa: Number(row.multa || 0),
        juros: Number(row.juros || 0),
        total: Number(row.total || 0)
      })));
    } catch (error) {
      res.status(500).json({ error: 'Falha ao carregar o histórico financeiro.' });
    }
  });


  /**
   * Endpoint POST /api/financeiro/faturas/:filial/pagar.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/financeiro/faturas/:filial/pagar
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/financeiro/faturas/:filial/pagar', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    const { filial } = req.params; const { billingSetup, plano } = req.body;
    const dataAtual = new Date(); const mesAtual = dataAtual.getMonth() + 1; const anoAtual = dataAtual.getFullYear();
    const filialPlano = plano || 'PRO'; const valorBase = filialPlano === 'ENTERPRISE' ? (billingSetup?.ent || 899.90) : (billingSetup?.pro || 299.90);
    const dataVencimento = `${anoAtual}-${mesAtual}-${billingSetup?.diaVencimento || 10}`;
    try {
      await pool.query(`INSERT INTO faturas_saas (filial, plano, valor_base, total, data_vencimento, ciclo_mes, ciclo_ano, status, data_pagamento) VALUES (?, ?, ?, ?, ?, ?, ?, 'PAGO', NOW()) ON DUPLICATE KEY UPDATE status = 'PAGO', data_pagamento = NOW()`, [filial, filialPlano, valorBase, valorBase, dataVencimento, mesAtual, anoAtual]);
      if (io) io.emit('pagamento_confirmado', { filial });
      await registrarAuditoria('BILLING_PAYMENT', 'Root/Dev', `Pagamento liquidado: ${filial} (${filialPlano})`, 'success'); res.json({ success: true, message: `Pagamento de ${filial} confirmado.` });
    } catch (error) { res.status(500).json({ error: "Erro interno" }); }
  });

  /** Cria uma pendência vencida no ciclo atual para testes controlados do ambiente DEV. */
  /**
   * Endpoint POST /api/financeiro/faturas/:filial/forcar-atraso.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/financeiro/faturas/:filial/forcar-atraso
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/financeiro/faturas/:filial/forcar-atraso', verificarToken, requireRoles('DEV'), async (req, res) => {
    const filial = normalizeCredential(req.params.filial, 100);
    const plano = normalizeCredential(req.body?.plano || 'PRO', 50);
    const setup = req.body?.billingSetup || {};
    const base = plano === 'ENTERPRISE' ? Number(setup.ent || 899.9) : Number(setup.pro || 299.9);
    const penalty = Number((base * (Number(setup.multa || 2) / 100)).toFixed(2));
    const interest = Number((base * (Number(setup.juros || 1) / 100) * 0.5).toFixed(2));
    const total = Number((base + penalty + interest).toFixed(2));
    const now = new Date();
    try {
      await pool.execute(`
        INSERT INTO faturas_saas
          (filial, plano, valor_base, multa, juros, total, data_vencimento, ciclo_mes, ciclo_ano, status)
        VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL 15 DAY), ?, ?, 'ATRASADA')
        ON DUPLICATE KEY UPDATE valor_base = VALUES(valor_base), multa = VALUES(multa), juros = VALUES(juros),
          total = VALUES(total), data_vencimento = VALUES(data_vencimento), status = 'ATRASADA', data_pagamento = NULL
      `, [filial, plano, base, penalty, interest, total, now.getMonth() + 1, now.getFullYear()]);
      await registrarAuditoria('BILLING_OVERDUE_SIMULATED', 'Root/Dev', `${filial}: R$ ${total.toFixed(2)}`, 'warning');
      if (io) io.emit('atualizacao_dados', { tipo: 'financeiro', filial });
      res.json({ success: true, total, message: `Pendência criada para ${filial}.` });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao criar pendência financeira.' });
    }
  });

  /** Envia uma cobrança para o contato financeiro cadastrado da organização. */
  /**
   * Endpoint POST /api/financeiro/faturas/:filial/notificar.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/financeiro/faturas/:filial/notificar
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/financeiro/faturas/:filial/notificar', verificarToken, requireRoles('DEV'), async (req, res) => {
    const filial = normalizeCredential(req.params.filial, 100);
    try {
      const [[contact]] = await pool.execute(`
        SELECT e.email, e.nome AS empresa
        FROM loja l LEFT JOIN empresas e ON e.nome COLLATE utf8mb4_unicode_ci = l.empresa COLLATE utf8mb4_unicode_ci
        WHERE l.nome COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci LIMIT 1
      `, [filial]);
      if (!contact?.email) return res.status(422).json({ error: 'Cliente sem e-mail financeiro cadastrado.' });
      const transporter = criarTransporterEmail();
      if (!transporter) return res.status(503).json({ error: 'SMTP não configurado no servidor.' });
      const total = Number(req.body?.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      await transporter.sendMail({
        from: SMTP_FROM,
        to: contact.email,
        subject: `TermoSync | Pendência financeira de ${filial}`,
        text: `Olá, ${contact.empresa || filial}. Identificamos uma cobrança ${req.body?.status || 'pendente'} no valor de ${total}, com vencimento em ${req.body?.vencimento || 'data não informada'}. Entre em contato com o financeiro da TermoSync para regularização.`
      });
      await registrarAuditoria('BILLING_NOTICE_SENT', 'Root/Dev', `${filial}: ${contact.email}`, 'warning');
      res.json({ success: true, message: `Cobrança enviada para ${contact.email}.` });
    } catch (error) {
      console.error('[FINANCEIRO] Falha ao notificar cobrança:', error.message);
      res.status(502).json({ error: 'Falha ao enviar a cobrança por e-mail.' });
    }
  });

  /** Emite o ciclo dos tenants ativos usando os planos e preços configurados no console. */
  /**
   * Endpoint POST /api/financeiro/cobranca-lote.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/financeiro/cobranca-lote
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/financeiro/cobranca-lote', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const dataAtual = new Date(); const mesAtual = dataAtual.getMonth() + 1; const anoAtual = dataAtual.getFullYear();
      const setup = req.body?.billingSetup || {};
      const planos = req.body?.planos && typeof req.body.planos === 'object' ? req.body.planos : {};
      const diaVencimento = Math.min(28, Math.max(1, Number(setup.diaVencimento) || 10));
      const valores = { PRO: Number(setup.pro) || 299.9, ENTERPRISE: Number(setup.ent) || 899.9 };
      const [filiaisRows] = await pool.query('SELECT DISTINCT nome FROM loja WHERE status = "Ativa"');
      let processadas = 0;
      for (const filial of filiaisRows.map(f => f.nome)) {
        const planoConfigurado = normalizeCredential(planos[filial] || 'PRO', 50).toUpperCase();
        if (planoConfigurado === 'FREE' || planoConfigurado === 'TRIAL') continue;
        const plano = planoConfigurado === 'ENTERPRISE' ? 'ENTERPRISE' : 'PRO';
        const valor = valores[plano];
        const vencimento = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${String(diaVencimento).padStart(2, '0')}`;
        await pool.execute(`
          INSERT INTO faturas_saas (filial, plano, valor_base, total, data_vencimento, ciclo_mes, ciclo_ano, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDENTE')
          ON DUPLICATE KEY UPDATE plano = VALUES(plano), valor_base = VALUES(valor_base),
            total = CASE WHEN status = 'PAGO' THEN total ELSE VALUES(total) END,
            data_vencimento = CASE WHEN status = 'PAGO' THEN data_vencimento ELSE VALUES(data_vencimento) END
        `, [filial, plano, valor, valor, vencimento, mesAtual, anoAtual]);
        processadas += 1;
      }
      await registrarAuditoria('BILLING_BATCH_PROCESSED', 'Root/Dev', `${processadas} tenant(s) processados no ciclo ${mesAtual}/${anoAtual}`, 'success');
      if (io) io.emit('atualizacao_dados', { tipo: 'financeiro', ciclo: `${mesAtual}/${anoAtual}` });
      res.json({ success: true, processed: processadas, message: `${processadas} tenant(s) processados.` });
    } catch (error) {
      console.error('[FINANCEIRO] Falha no processamento em lote:', error.message);
      res.status(500).json({ error: 'Falha ao processar o lote financeiro.' });
    }
  });


  /**
   * Endpoint GET /api/system/health.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/system/health
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/system/health', async (req, res) => {
    const snapshot = await getSystemHealthSnapshot({
      mqttConnected: mqttClientRecv?.connected,
      whatsappStatus: wpStatus,
      socketClients: io?.engine?.clientsCount || 0
    });
    const statusCode = snapshot.ok ? 200 : 503;
    res.status(statusCode).json(snapshot);
  });

  /** Entrega a série persistida usada pelos gráficos da central de desenvolvimento. */
  /**
   * Endpoint GET /api/system/health/history.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/system/health/history
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/system/health/history', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito a desenvolvedores.' });
    const minutes = Math.min(10080, Math.max(5, Number(req.query.minutes) || 60));
    const limit = Math.min(2000, Math.max(10, Number(req.query.limit) || 360));
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    try {
      const [rows] = await pool.execute(`
        SELECT id, status, database_status, mqtt_status, whatsapp_status,
               response_time_ms, database_latency_ms, cpu_percent,
               event_loop_utilization, rss_mb, heap_used_mb, heap_total_mb,
               external_mb, socket_clients, error_message, recorded_at
        FROM system_health_history
        WHERE recorded_at >= ?
        ORDER BY recorded_at DESC
        LIMIT ?
      `, [cutoff, limit]);
      const samples = rows.map(row => ({
        id: String(row.id),
        at: new Date(row.recorded_at).getTime(),
        timestamp: new Date(row.recorded_at).toISOString(),
        api: row.status,
        status: row.status,
        database: row.database_status,
        mqtt: row.mqtt_status,
        whatsapp: row.whatsapp_status,
        responseTimeMs: row.response_time_ms == null ? null : Number(row.response_time_ms),
        databaseLatencyMs: row.database_latency_ms == null ? null : Number(row.database_latency_ms),
        cpuPercent: row.cpu_percent == null ? null : Number(row.cpu_percent),
        eventLoopUtilization: row.event_loop_utilization == null ? null : Number(row.event_loop_utilization),
        memory: {
          rssMb: row.rss_mb == null ? null : Number(row.rss_mb),
          heapUsedMb: row.heap_used_mb == null ? null : Number(row.heap_used_mb),
          heapTotalMb: row.heap_total_mb == null ? null : Number(row.heap_total_mb),
          externalMb: row.external_mb == null ? null : Number(row.external_mb)
        },
        runtime: { socketClients: Number(row.socket_clients || 0) },
        error: row.error_message || null,
        source: 'history'
      }));
      res.json({ samples, retentionDays: Math.max(1, Number(process.env.HEALTH_HISTORY_RETENTION_DAYS || 7)), sampleIntervalSeconds: Math.max(5, Number(process.env.HEALTH_SAMPLE_INTERVAL_SECONDS || 10)) });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao carregar histórico de saúde.' });
    }
  });


  /**
   * Endpoint POST /api/auth/password-reset/request.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/auth/password-reset/request
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/auth/password-reset/request', passwordResetLimiter, async (req, res) => {
    const usuario = normalizeCredential(req.body.usuario, 120);
    const canal = String(req.body.canal || 'email').toLowerCase() === 'sms' ? 'sms' : 'email';
    const destino = canal === 'sms'
      ? normalizarTelefoneDigits(req.body.destino)
      : normalizarEmail(req.body.destino);
    const ip = req.security?.ip || req.ip || req.socket?.remoteAddress || 'Desconhecido';
    const userAgent = req.security?.userAgent || req.headers['user-agent'] || 'Desconhecido';
    if (!usuario) return res.status(400).json({ error: 'Usuário obrigatório.' });
    if (!destino) return res.status(400).json({ error: canal === 'sms' ? 'Telefone obrigatório.' : 'E-mail obrigatório.' });
    if (isPasswordResetLimited(`${ip}:${usuario.toLowerCase()}`)) {
      return res.status(429).json({ error: 'Muitas solicitações. Tente novamente em alguns minutos.' });
    }

    const requestKey = getPasswordResetRequestKey({ usuario, canal, destino });
    if (passwordResetRequestsInFlight.has(requestKey)) {
      return res.json({
        success: true,
        duplicate: true,
        message: canal === 'sms'
          ? `Já estamos enviando um código para o telefone ${mascararTelefone(destino)}. Aguarde alguns instantes antes de solicitar outro.`
          : 'Já estamos enviando um código para o canal informado. Aguarde alguns instantes antes de solicitar outro.',
        delivery: canal,
        phoneHint: canal === 'sms' ? mascararTelefone(destino) : '',
        emailHint: canal === 'email' ? mascararEmail(destino) : ''
      });
    }

    passwordResetRequestsInFlight.add(requestKey);
    try {
      await garantirSchemaRecuperacaoSenha();
      const [users] = await pool.execute(
        'SELECT id, usuario, password_reset_requested_at FROM usuarios WHERE usuario = ? LIMIT 1',
        [usuario]
      );

      let delivery = 'generic';
      let emailHint = '';
      let phoneHint = '';

      if (users.length > 0) {
        const user = users[0];
        const nome = user.usuario;
        const transporter = canal === 'email' ? criarTransporterEmail() : null;
        if (canal === 'sms' && isPasswordResetCooldownActive(user.password_reset_requested_at)) {
          phoneHint = mascararTelefone(destino);
          return res.json({
            success: true,
            duplicate: true,
            message: `Um código de recuperação já foi enviado recentemente para o telefone ${phoneHint}. Aguarde um minuto antes de solicitar outro.`,
            delivery: 'sms',
            phoneHint
          });
        }

        if (canal === 'email' && !transporter) {
          return res.status(503).json({ error: 'Envio de e-mail não configurado no servidor.' });
        }

        const resetCode = gerarCodigoRecuperacao();
        const codeHash = await bcrypt.hash(resetCode, 12);

        if (canal === 'email') {
          const nomeSeguro = escapeHtml(nome);
          const usuarioSeguro = escapeHtml(user.usuario);
          const codigoSeguro = escapeHtml(resetCode);
          try {
            const mailInfo = await transporter.sendMail({
              from: SMTP_FROM,
              to: destino,
              subject: 'Código de recuperação de senha - TermoSync',
              html: `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px; border: 1px solid #dbeafe; border-radius: 10px;"><h2 style="color:#0f766e;margin-top:0;">Recuperação de senha</h2><p>Olá, <strong>${nomeSeguro}</strong>.</p><p>Recebemos uma solicitação para redefinir a senha do usuário <strong>${usuarioSeguro}</strong>.</p><p>Use o código abaixo na tela do TermoSync. Ele expira em <strong>15 minutos</strong>.</p><div style="font-size:28px;letter-spacing:6px;font-weight:bold;color:#0f172a;background:#f1f5f9;padding:16px;text-align:center;border-radius:8px;">${codigoSeguro}</div><p style="font-size:12px;color:#64748b;">Se você não solicitou essa alteração, ignore este e-mail e avise o administrador.</p></div>`
            });
            if (!Array.isArray(mailInfo.accepted) || mailInfo.accepted.length === 0) {
              const rejected = Array.isArray(mailInfo.rejected) ? mailInfo.rejected.join(', ') : '';
              throw new Error(rejected ? `Destinatário rejeitado pelo SMTP: ${rejected}` : 'O SMTP não confirmou o destinatário.');
            }
            console.log('[AUTH] E-mail de recuperação enviado:', {
              to: mascararEmail(destino),
              accepted: mailInfo.accepted?.map(mascararEmail) || [],
              rejected: mailInfo.rejected?.map(mascararEmail) || []
            });
          } catch (sendError) {
            console.error('[AUTH] Falha ao enviar e-mail de recuperação:', sendError.message);
            return res.status(502).json({ error: 'Falha ao enviar e-mail de recuperação. Verifique as credenciais SMTP.' });
          }
          delivery = 'email';
          emailHint = mascararEmail(destino);
        } else {
          const smsStatus = getSmsProviderStatus();
          if (!smsStatus.configured) {
            return res.status(503).json({
              error: 'SMS não configurado. Configure Twilio, SMS_WEBHOOK_URL ou habilite TEXTBELT_ENABLED no backend.',
              missing: ['TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN', 'SMS_WEBHOOK_URL', 'TEXTBELT_ENABLED=true']
            });
          }
          const mensagem = `TermoSync NOC: seu codigo de recuperacao de senha e ${resetCode}. Ele expira em 15 minutos. Por seguranca, nao compartilhe este codigo. Se voce nao solicitou, ignore esta mensagem.`;
          let sent = false;
          try {
            sent = await enviarCodigoSms(destino, mensagem);
          } catch (sendError) {
            console.error('[AUTH] Falha ao enviar SMS de recuperação:', sendError.message);
            return res.status(502).json({
              error: mensagemErroSmsRecuperacao(sendError),
              detail: process.env.NODE_ENV === 'production' ? undefined : sendError.message
            });
          }
          if (!sent) {
            return res.status(503).json({ error: 'Envio por SMS não configurado ou indisponível.' });
          }
          delivery = 'sms';
          phoneHint = mascararTelefone(destino);
        }

        await pool.execute(
          'UPDATE usuarios SET password_reset_code_hash = ?, password_reset_expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE), password_reset_attempts = 0, password_reset_requested_at = NOW() WHERE id = ?',
          [codeHash, user.id]
        );

        try {
          await registrarAuditoria('PASSWORD_RESET_CODE_SENT', nome, `Código de recuperação gerado em ${ip}`, 'warning');
          await registrarEventoSeguranca({ eventType: 'PASSWORD_RESET_CODE_SENT', actor: user.usuario, ip, userAgent, severity: 'warning', detail: `delivery=${delivery}` });
        } catch (auditError) {
          console.warn('[AUTH] Recuperação gerada, mas auditoria falhou:', auditError.message);
        }
      }

      res.json({
        success: true,
        message: delivery === 'email'
          ? `Enviamos um código de recuperação para ${emailHint}.`
          : delivery === 'sms'
            ? `Enviamos um código de recuperação para o telefone ${phoneHint}.`
            : 'Se o usuário existir, enviaremos um código para o canal informado.',
        delivery,
        emailHint,
        phoneHint
      });
    } catch (error) {
      console.error('[AUTH] Falha ao gerar recuperação de acesso:', error.message);
      res.status(500).json({ error: 'Não foi possível gerar a recuperação agora.' });
    } finally {
      passwordResetRequestsInFlight.delete(requestKey);
    }
  });


  /**
   * Endpoint POST /api/auth/password-reset/confirm.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/auth/password-reset/confirm
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/auth/password-reset/confirm', passwordResetConfirmLimiter, async (req, res) => {
    const usuario = normalizeCredential(req.body.usuario, 120);
    const codigo = String(req.body.codigo || '').replace(/\D/g, '').slice(0, 6);
    const novaSenha = String(req.body.novaSenha || '');
    const ip = req.security?.ip || req.ip || req.socket?.remoteAddress || 'Desconhecido';
    const userAgent = req.security?.userAgent || req.headers['user-agent'] || 'Desconhecido';

    if (!usuario || !codigo || !novaSenha) {
      return res.status(400).json({ error: 'Usuário, código e nova senha são obrigatórios.' });
    }
    if (!/^\d{6}$/.test(codigo)) {
      return res.status(400).json({ error: 'Informe o código de 6 dígitos.' });
    }
    if (!isStrongPassword(novaSenha)) {
      return res.status(400).json({ error: 'A nova senha deve ter 10+ caracteres, letras maiúsculas e minúsculas, número e símbolo.' });
    }
    try {
      await garantirSchemaRecuperacaoSenha();
      const [users] = await pool.execute(
        'SELECT id, usuario, senha, password_reset_code_hash, password_reset_expires_at, password_reset_attempts FROM usuarios WHERE usuario = ? LIMIT 1',
        [usuario]
      );

      if (users.length === 0 || !users[0].password_reset_code_hash) {
        return res.status(400).json({ error: 'Código inválido ou expirado.' });
      }

      const user = users[0];
      const expiresAt = user.password_reset_expires_at ? new Date(user.password_reset_expires_at).getTime() : 0;
      if (!expiresAt || expiresAt < Date.now()) {
        await pool.execute('UPDATE usuarios SET password_reset_code_hash = NULL, password_reset_expires_at = NULL, password_reset_attempts = 0 WHERE id = ?', [user.id]);
        return res.status(410).json({ error: 'Código expirado. Solicite um novo código.' });
      }

      if (Number(user.password_reset_attempts || 0) >= 5) {
        await pool.execute('UPDATE usuarios SET password_reset_code_hash = NULL, password_reset_expires_at = NULL, password_reset_attempts = 0 WHERE id = ?', [user.id]);
        await registrarEventoSeguranca({ eventType: 'PASSWORD_RESET_LOCKED', actor: user.usuario, ip, userAgent, severity: 'danger', detail: 'Limite de códigos inválidos atingido.' });
        return res.status(429).json({ error: 'Muitas tentativas inválidas. Solicite um novo código.' });
      }

      const validCode = await bcrypt.compare(codigo, user.password_reset_code_hash);
      if (!validCode) {
        await pool.execute('UPDATE usuarios SET password_reset_attempts = password_reset_attempts + 1 WHERE id = ?', [user.id]);
        await registrarEventoSeguranca({ eventType: 'PASSWORD_RESET_FAILED', actor: user.usuario, ip, userAgent, severity: 'warning', detail: 'Código inválido.' });
        return res.status(401).json({ error: 'Código inválido.' });
      }

      const samePassword = await bcrypt.compare(novaSenha, user.senha);
      if (samePassword) {
        return res.status(400).json({ error: 'Escolha uma senha diferente da senha atual.' });
      }

      const hash = await bcrypt.hash(novaSenha, 12);
      await pool.execute(
        'UPDATE usuarios SET senha = ?, password_changed_at = NOW(), password_reset_code_hash = NULL, password_reset_expires_at = NULL, password_reset_attempts = 0, password_reset_requested_at = NULL WHERE id = ?',
        [hash, user.id]
      );
      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE usuario_id = ? AND revogado = FALSE', [user.id]);
      invalidateUserSessions(user.id);
      try {
        await registrarAuditoria('PASSWORD_RESET_COMPLETED', user.usuario, 'Senha redefinida pelo próprio usuário', 'success');
        await registrarEventoSeguranca({ eventType: 'PASSWORD_RESET_COMPLETED', actor: user.usuario, ip, userAgent, severity: 'success', detail: 'Sessões anteriores revogadas.' });
      } catch (auditError) {
        console.warn('[AUTH] Senha redefinida, mas auditoria falhou:', auditError.message);
      }
      res.json({ success: true, message: 'Senha redefinida com sucesso.' });
    } catch (error) {
      console.error('[AUTH] Falha ao confirmar recuperação de acesso:', error.message);
      res.status(500).json({ error: 'Não foi possível redefinir a senha agora.' });
    }
  });


  /**
   * Endpoint POST /api/login.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/login
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/login', loginLimiter, async (req, res) => {
    const usuario = normalizeCredential(req.body.usuario, 120);
    const senha = String(req.body.senha || '');
    const ip = req.security?.ip || req.ip || 'Desconhecido';
    const userAgent = req.security?.userAgent || req.headers['user-agent'] || 'Desconhecido';
    const loginKey = `${ip}:${usuario.toLowerCase()}`;

    if (!usuario || !senha) {
      return res.status(400).json({ error: 'Credenciais obrigatórias.', requestId: req.security?.requestId });
    }

    if (isLoginLocked(loginKey)) {
      await registrarEventoSeguranca({ eventType: 'LOGIN_LOCKED', actor: usuario, ip, userAgent, severity: 'danger', detail: 'Tentativa bloqueada por excesso de falhas.' });
      return res.status(429).json({ error: 'Acesso temporariamente bloqueado. Tente novamente mais tarde.', requestId: req.security?.requestId });
    }

    const [users] = await pool.execute('SELECT * FROM usuarios WHERE usuario = ? LIMIT 1', [usuario]);
    const senhaValida = users.length > 0 ? await bcrypt.compare(senha, users[0].senha) : false;

    if (users.length === 0 || !senhaValida) {
      const failure = recordFailedLogin(loginKey);
      await registrarAuditoria('LOGIN_FAILED', usuario || 'Desconhecido', `Falha de autenticação em ${ip}`, failure.attempts >= 5 ? 'danger' : 'warning');
      await registrarEventoSeguranca({
        eventType: 'LOGIN_FAILED',
        actor: usuario || 'Desconhecido',
        ip,
        userAgent,
        severity: failure.attempts >= 5 ? 'danger' : 'warning',
        detail: `Tentativas na janela: ${failure.attempts}`
      });
      return res.status(401).json({ error: 'Credenciais inválidas.', requestId: req.security?.requestId });
    }

    if (users[0].security_blocked) {
      await registrarAuditoria('LOGIN_BLOCKED_BY_SOC', usuario, `Conta bloqueada tentou acesso em ${ip}`, 'danger');
      await registrarEventoSeguranca({ eventType: 'LOGIN_BLOCKED_BY_SOC', actor: usuario, ip, userAgent, severity: 'danger', detail: 'Conta bloqueada pelo SOC.' });
      return res.status(403).json({ error: 'Conta bloqueada pela equipe de segurança.', requestId: req.security?.requestId });
    }

    if (users[0].role !== 'DEV') {
      const maintenance = await getMaintenancePublicState();
      if (maintenance.maintenanceMode) {
        return res.status(503).json({
          error: maintenance.maintenanceMessage,
          maintenance: true,
          requestId: req.security?.requestId
        });
      }
    }

    clearFailedLogin(loginKey);

    const nomeSessao = users[0].nome_gerente || users[0].nome_coordenador || users[0].nome_tecnico || users[0].usuario;
    if (users[0].mfa_enabled && users[0].mfa_secret) {
      const challengeId = crypto.randomUUID();
      mfaLoginChallenges.set(challengeId, { userId: users[0].id, createdAt: Date.now(), ip, userAgent });
      await registrarEventoSeguranca({ eventType: 'MFA_CHALLENGE_CREATED', actor: nomeSessao, ip, userAgent, severity: 'info', detail: 'Login aguardando TOTP.' });
      return res.json({ mfaRequired: true, challengeId, usuario: users[0].usuario });
    }

    try {
      const sessionPayload = await emitirSessaoAutenticada(users[0], req);
      return res.json(sessionPayload);
    } catch (sessionError) {
      console.error('[AUTH] Login bloqueado: a sessão não foi registrada:', sessionError.message);
      return res.status(sessionError.statusCode || 500).json({
        error: sessionError.statusCode ? sessionError.message : 'Falha ao registrar sessão segura.',
        trialExpired: sessionError.trialExpired === true,
        requestId: req.security?.requestId
      });
    }
  });


  /**
   * Endpoint POST /api/login/mfa.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/login/mfa
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/login/mfa', loginLimiter, async (req, res) => {
    const challengeId = normalizeCredential(req.body.challengeId, 80);
    const code = normalizeCredential(req.body.code, 20);
    const challenge = mfaLoginChallenges.get(challengeId);
    const ip = req.security?.ip || req.ip || 'Desconhecido';
    const userAgent = req.security?.userAgent || req.headers['user-agent'] || 'Desconhecido';

    if (!challenge || Date.now() - challenge.createdAt > 5 * 60 * 1000 || challenge.ip !== ip) {
      mfaLoginChallenges.delete(challengeId);
      await registrarEventoSeguranca({ eventType: 'MFA_CHALLENGE_INVALID', ip, userAgent, severity: 'warning', detail: challengeId || 'sem challenge' });
      return res.status(401).json({ error: 'Desafio MFA inválido ou expirado.', requestId: req.security?.requestId });
    }

    try {
      const [users] = await pool.execute('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [challenge.userId]);
      if (users.length === 0 || !users[0].mfa_enabled || !users[0].mfa_secret || !verifyTotp(users[0].mfa_secret, code)) {
        await registrarEventoSeguranca({ eventType: 'MFA_FAILED', actor: String(challenge.userId), ip, userAgent, severity: 'danger', detail: 'Código TOTP inválido.' });
        return res.status(401).json({ error: 'Código MFA inválido.', requestId: req.security?.requestId });
      }
      if (users[0].role !== 'DEV') {
        const maintenance = await getMaintenancePublicState();
        if (maintenance.maintenanceMode) {
          mfaLoginChallenges.delete(challengeId);
          return res.status(503).json({ error: maintenance.maintenanceMessage, maintenance: true, requestId: req.security?.requestId });
        }
      }

      mfaLoginChallenges.delete(challengeId);
      await registrarEventoSeguranca({ eventType: 'MFA_SUCCESS', actor: users[0].usuario, ip, userAgent, severity: 'success', detail: 'Segundo fator validado.' });
      const sessionPayload = await emitirSessaoAutenticada(users[0], req);
      return res.json(sessionPayload);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.statusCode ? error.message : 'Falha ao validar MFA.',
        trialExpired: error.trialExpired === true,
        requestId: req.security?.requestId
      });
    }
  });


  /**
   * Endpoint GET /api/auth/verify.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/auth/verify
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/auth/verify', verificarToken, async (req, res) => {
    try {
      if (req.isImpersonated) {
        return res.json({
          id: req.userId,
          usuario: 'Acesso Remoto (NOC)',
          role: req.userRole,
          filial: req.userFilial,
          empresa: req.userEmpresa,
          nome_gerente: 'Suporte',
          nome_coordenador: null,
          nome_tecnico: null
        });
      }

      const [users] = await pool.execute(
        'SELECT id, usuario, role, filial, empresa, nome_gerente, nome_coordenador, nome_tecnico FROM usuarios WHERE id = ?',
        [req.userId]
      );

      if (users.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });

      res.json(users[0]);
    } catch (error) {
      res.status(500).json({ error: 'Erro interno.' });
    }
  });


  /**
   * Endpoint GET /api/auth/permissions.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/auth/permissions
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/auth/permissions', verificarToken, async (req, res) => {
    res.json({
      role: req.userRole,
      permissions: ROLE_PERMISSIONS[req.userRole] || []
    });
  });


  /**
   * Endpoint GET /api/user/preferences/:key.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/user/preferences/:key
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/user/preferences/:key', verificarToken, async (req, res) => {
    const prefKey = normalizeCredential(req.params.key, 120);
    if (!/^[a-z0-9_.:-]+$/i.test(prefKey)) return res.status(400).json({ error: 'Chave de preferência inválida.' });

    try {
      const [rows] = await pool.execute(
        'SELECT pref_value, updated_at FROM user_preferences WHERE usuario_id = ? AND pref_key = ? LIMIT 1',
        [req.userId, prefKey]
      );
      if (rows.length === 0) return res.json({ key: prefKey, value: null });
      res.json({ key: prefKey, value: rows[0].pref_value, updated_at: rows[0].updated_at });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao carregar preferência.' });
    }
  });


  /**
   * Endpoint PUT /api/user/preferences/:key.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/user/preferences/:key
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/user/preferences/:key', verificarToken, async (req, res) => {
    const prefKey = normalizeCredential(req.params.key, 120);
    if (!/^[a-z0-9_.:-]+$/i.test(prefKey)) return res.status(400).json({ error: 'Chave de preferência inválida.' });

    const value = req.body?.value;
    const serialized = JSON.stringify(value ?? null);
    if (Buffer.byteLength(serialized, 'utf8') > 20000) return res.status(413).json({ error: 'Preferência muito grande.' });

    try {
      await pool.execute(
        `INSERT INTO user_preferences (usuario_id, pref_key, pref_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE pref_value = VALUES(pref_value), updated_at = CURRENT_TIMESTAMP`,
        [req.userId, prefKey, serialized]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao salvar preferência.' });
    }
  });


  /**
   * Endpoint GET /api/auth/security.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/auth/security
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/auth/security', verificarToken, async (req, res) => {
    try {
      const [users] = await pool.execute(
        'SELECT id, usuario, role, filial, empresa, mfa_enabled, mfa_required, password_changed_at FROM usuarios WHERE id = ? LIMIT 1',
        [req.userId]
      );
      if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.', requestId: req.security?.requestId });

      const [sessionStats] = await pool.execute(
        'SELECT COUNT(*) AS total, SUM(revogado = FALSE) AS ativas FROM sessoes_ativas WHERE usuario_id = ?',
        [req.userId]
      );

      res.json({
        requestId: req.security?.requestId,
        usuario: users[0].usuario,
        role: users[0].role,
        filial: users[0].filial,
        empresa: users[0].empresa,
        mfaEnabled: Boolean(users[0].mfa_enabled),
        mfaRequired: Boolean(users[0].mfa_required),
        passwordChangedAt: users[0].password_changed_at,
        sessionsTotal: Number(sessionStats[0]?.total || 0),
        sessionsActive: Number(sessionStats[0]?.ativas || 0)
      });
    } catch (error) {
      console.error('[AUTH] Erro ao carregar segurança da conta:', error.message);
      res.status(500).json({ error: 'Falha ao carregar segurança da conta.', requestId: req.security?.requestId });
    }
  });

  /** Expõe somente o aviso necessário nas telas públicas e de autenticação. */
  /**
   * Endpoint GET /api/system-config/public.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/system-config/public
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/system-config/public', async (_req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json(await getMaintenancePublicState());
    } catch (error) {
      res.status(500).json({ error: 'Falha ao consultar o estado de manutenção.' });
    }
  });

  /** Retorna a configuração global persistida e os planos atuais dos tenants. */
  /**
   * Endpoint GET /api/system-config.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/system-config
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/system-config', verificarToken, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      const [configRows] = await pool.execute('SELECT valor FROM configuracoes WHERE chave = ? LIMIT 1', ['sysConfigSaas']);
      const [planRows] = await pool.execute('SELECT filial, plano FROM saas_tenant_settings');
      let config = {};
      try { config = JSON.parse(configRows[0]?.valor || '{}'); } catch { config = {}; }
      config.planos = Object.fromEntries(planRows.map((row) => [row.filial, row.plano]));
      res.json(config);
    } catch (error) {
      console.error('[CONFIG] Falha ao carregar configuração global:', error.message);
      res.status(500).json({ error: 'Falha ao carregar configurações do sistema.' });
    }
  });

  /** Persiste alterações globais feitas pelo desenvolvedor e sincroniza planos SaaS. */
  /**
   * Endpoint PUT /api/system-config.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/system-config
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/system-config', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const config = req.body && typeof req.body === 'object' ? req.body : {};
      const maintenanceMessage = normalizeCredential(config.maintenanceMessage, 280);
      const maintenanceNoticeActive = config.maintenanceMode === true || config.maintenanceNoticeActive === true;
      if (maintenanceNoticeActive && !maintenanceMessage) {
        return res.status(400).json({ error: 'Informe a mensagem do aviso de manutenção.' });
      }
      config.maintenanceNoticeActive = maintenanceNoticeActive;
      config.maintenanceMessage = maintenanceNoticeActive ? maintenanceMessage : '';
      const planos = config.planos && typeof config.planos === 'object' ? config.planos : {};
      const configSemPlanos = { ...config };
      delete configSemPlanos.planos;
      const serialized = JSON.stringify(configSemPlanos);
      if (Buffer.byteLength(serialized, 'utf8') > 100000) return res.status(413).json({ error: 'Configuração excede o limite permitido.' });

      await pool.execute(
        `INSERT INTO configuracoes (chave, valor) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        ['sysConfigSaas', serialized]
      );
      await pool.execute(
        `INSERT INTO configuracoes (chave, valor) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        ['maintenanceMode', config.maintenanceMode ? '1' : '0']
      );
      for (const [filial, plano] of Object.entries(planos)) {
        if (!filial || !['TRIAL', 'FREE', 'PRO', 'ENTERPRISE', 'SUSPENSO'].includes(String(plano))) continue;
        await pool.execute(
          `INSERT INTO saas_tenant_settings (filial, plano) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE plano = VALUES(plano), updated_at = CURRENT_TIMESTAMP`,
          [String(filial).slice(0, 100), plano]
        );
      }
      maintenanceModeCache = { checkedAt: Date.now(), enabled: config.maintenanceMode === true };
      io?.emit('system_config_updated', {
        regras: configSemPlanos.regras || {},
        maintenanceMode: config.maintenanceMode === true,
        maintenanceNoticeActive: config.maintenanceNoticeActive === true,
        maintenanceMessage: config.maintenanceMessage
      });
      await registrarAuditoria('SYSTEM_CONFIG_UPDATED', String(req.userId), 'Configuração global atualizada', 'warning');
      res.json({ success: true });
    } catch (error) {
      console.error('[CONFIG] Falha ao salvar configuração global:', error.message);
      res.status(500).json({ error: 'Falha ao salvar configurações do sistema.' });
    }
  });

  /** Persiste uma regra da Matriz de UI sem sobrescrever alterações concorrentes. */
  /**
   * Endpoint PATCH /api/system-config/ui-rule.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PATCH /api/system-config/ui-rule
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.patch('/api/system-config/ui-rule', verificarToken, requireRoles('DEV'), async (req, res) => {
    const scopeType = String(req.body?.scopeType || '').toUpperCase();
    const target = normalizeCredential(req.body?.target, 120);
    const moduleId = normalizeCredential(req.body?.moduleId, 80);
    const hidden = req.body?.hidden === true;
    const roleTargets = new Set(['GLOBAL', 'ADMIN', 'LOJA', 'MANUTENCAO']);
    if (!['ROLE', 'USER'].includes(scopeType)) return res.status(400).json({ error: 'Tipo de escopo inválido.' });
    if (!target || (scopeType === 'ROLE' && !roleTargets.has(target))) return res.status(400).json({ error: 'Escopo da Matriz de UI inválido.' });
    if (!moduleId || !/^[a-zA-Z0-9_-]{1,80}$/.test(moduleId)) return res.status(400).json({ error: 'Identificador de tela inválido.' });

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [rows] = await connection.execute('SELECT valor FROM configuracoes WHERE chave = ? LIMIT 1 FOR UPDATE', ['sysConfigSaas']);
      let config = {};
      try { config = JSON.parse(rows[0]?.valor || '{}'); } catch { config = {}; }
      if (!config.regras || typeof config.regras !== 'object') config.regras = {};
      if (!config.regras.USERS || typeof config.regras.USERS !== 'object') config.regras.USERS = {};
      const rulesContainer = scopeType === 'USER' ? config.regras.USERS : config.regras;
      if (!rulesContainer[target] || typeof rulesContainer[target] !== 'object') {
        rulesContainer[target] = { modulosOcultos: [], features: {} };
      }
      const currentModules = Array.isArray(rulesContainer[target].modulosOcultos) ? rulesContainer[target].modulosOcultos : [];
      rulesContainer[target].modulosOcultos = hidden
        ? [...new Set([...currentModules, moduleId])]
        : currentModules.filter((item) => item !== moduleId);

      const serialized = JSON.stringify(config);
      if (Buffer.byteLength(serialized, 'utf8') > 100000) {
        await connection.rollback();
        return res.status(413).json({ error: 'Configuração excede o limite permitido.' });
      }
      await connection.execute(
        `INSERT INTO configuracoes (chave, valor) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        ['sysConfigSaas', serialized]
      );
      await connection.commit();
      io?.emit('system_config_updated', {
        regras: config.regras,
        maintenanceMode: config.maintenanceMode === true,
        maintenanceNoticeActive: config.maintenanceMode === true || config.maintenanceNoticeActive === true,
        maintenanceMessage: config.maintenanceMessage || ''
      });
      await registrarAuditoria('UI_MATRIX_UPDATED', String(req.userId), `${scopeType}:${target}:${moduleId}:${hidden ? 'BLOCKED' : 'ENABLED'}`, 'warning');
      res.json({ success: true, scopeType, target, moduleId, hidden, regras: config.regras });
    } catch (error) {
      if (connection) await connection.rollback().catch(() => {});
      console.error('[CONFIG] Falha ao salvar regra da Matriz de UI:', error.message);
      res.status(500).json({ error: 'Falha ao salvar o bloqueio da tela.' });
    } finally {
      connection?.release();
    }
  });

  /** Retorna o histórico de segurança pertencente somente à conta autenticada. */
  /**
   * Endpoint GET /api/auth/security-events.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/auth/security-events
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/auth/security-events', verificarToken, async (req, res) => {
    try {
      const [users] = await pool.execute('SELECT usuario FROM usuarios WHERE id = ? LIMIT 1', [req.userId]);
      if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.', requestId: req.security?.requestId });

      const [events] = await pool.execute(
        `SELECT created_at AS createdAt, event_type AS eventType, ip_address AS ip,
                user_agent AS userAgent, severity, detail
         FROM security_events
         WHERE actor = ? OR actor = ?
         ORDER BY created_at DESC
         LIMIT 30`,
        [String(req.userId), users[0].usuario]
      );
      res.json(events);
    } catch (error) {
      console.error('[AUTH] Erro ao carregar eventos da conta:', error.message);
      res.status(500).json({ error: 'Falha ao carregar atividade de segurança.', requestId: req.security?.requestId });
    }
  });

  /** Revoga a própria sessão antes de o cliente limpar os dados locais. */
  /**
   * Endpoint POST /api/auth/logout.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/auth/logout
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/auth/logout', verificarToken, async (req, res) => {
    try {
      const currentToken = extrairTokenAutenticacao(req);
      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE, last_seen = NOW() WHERE token = ?', [currentToken]);
      invalidateSessionCache(currentToken);
      await registrarEventoSeguranca({ eventType: 'LOGOUT', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'info', detail: req.userFilial || 'Todas' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao encerrar a sessão.' });
    }
  });


  /**
   * Endpoint GET /api/auth/sessions.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/auth/sessions
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/auth/sessions', verificarToken, async (req, res) => {
    try {
      const currentToken = extrairTokenAutenticacao(req);
      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE usuario_id = ? AND revogado = FALSE AND expires_at IS NOT NULL AND expires_at < NOW()', [req.userId]);
      const [sessions] = await pool.execute(
        'SELECT id, usuario_nome AS usuario, role, ip_address AS ip, localizacao AS location, user_agent AS userAgent, data_login AS loginTime, last_seen AS lastSeen, expires_at AS expiresAt, token FROM sessoes_ativas WHERE usuario_id = ? AND revogado = FALSE ORDER BY COALESCE(last_seen, data_login) DESC',
        [req.userId]
      );
      res.json(sessions.map((session) => ({
        id: session.id,
        usuario: session.usuario,
        role: session.role,
        ip: session.ip,
        location: session.location,
        userAgent: session.userAgent,
        loginTime: session.loginTime,
        lastSeen: session.lastSeen,
        expiresAt: session.expiresAt,
        current: session.token === currentToken
      })));
    } catch (error) {
      console.error('[AUTH] Erro ao listar sessões:', error.message);
      res.status(500).json({ error: 'Falha ao carregar sessões.', requestId: req.security?.requestId });
    }
  });


  /**
   * Endpoint DELETE /api/auth/sessions/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route DELETE /api/auth/sessions/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.delete('/api/auth/sessions/:id', verificarToken, async (req, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId) || sessionId <= 0) return res.status(400).json({ error: 'Sessão inválida.', requestId: req.security?.requestId });
      const currentToken = extrairTokenAutenticacao(req);
      const [sessions] = await pool.execute('SELECT id, token FROM sessoes_ativas WHERE id = ? AND usuario_id = ? LIMIT 1', [sessionId, req.userId]);
      if (sessions.length === 0) return res.status(404).json({ error: 'Sessão não encontrada.', requestId: req.security?.requestId });
      if (sessions[0].token === currentToken) return res.status(409).json({ error: 'Use sair para encerrar a sessão atual.', requestId: req.security?.requestId });

      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE id = ? AND usuario_id = ?', [sessionId, req.userId]);
      invalidateSessionCache(sessions[0].token);
      await registrarEventoSeguranca({ eventType: 'USER_SESSION_REVOKED', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'warning', detail: `session=${sessionId}` });
      res.json({ success: true });
    } catch (error) {
      console.error('[AUTH] Erro ao revogar sessão:', error.message);
      res.status(500).json({ error: 'Falha ao revogar sessão.', requestId: req.security?.requestId });
    }
  });


  /**
   * Endpoint POST /api/auth/sessions/revoke-others.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/auth/sessions/revoke-others
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/auth/sessions/revoke-others', verificarToken, async (req, res) => {
    try {
      const currentToken = extrairTokenAutenticacao(req);
      const [result] = await pool.execute(
        'UPDATE sessoes_ativas SET revogado = TRUE WHERE usuario_id = ? AND token <> ? AND revogado = FALSE',
        [req.userId, currentToken]
      );
      invalidateUserSessions(req.userId, currentToken);
      await registrarEventoSeguranca({ eventType: 'USER_REVOKED_OTHER_SESSIONS', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'warning', detail: `revogadas=${result.affectedRows}` });
      res.json({ success: true, revoked: result.affectedRows });
    } catch (error) {
      console.error('[AUTH] Erro ao revogar outras sessões:', error.message);
      res.status(500).json({ error: 'Falha ao revogar outras sessões.', requestId: req.security?.requestId });
    }
  });


  /**
   * Endpoint POST /api/auth/password.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/auth/password
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/auth/password', verificarToken, async (req, res) => {
    try {
      const senhaAtual = String(req.body.senhaAtual || '');
      const novaSenha = String(req.body.novaSenha || '');
      if (!senhaAtual || !novaSenha) return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.', requestId: req.security?.requestId });
      if (!isStrongPassword(novaSenha)) return res.status(400).json({ error: 'A nova senha deve ter 10+ caracteres, letras, números e símbolo.', requestId: req.security?.requestId });

      const [users] = await pool.execute('SELECT usuario, senha FROM usuarios WHERE id = ? LIMIT 1', [req.userId]);
      if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.', requestId: req.security?.requestId });
      const valid = await bcrypt.compare(senhaAtual, users[0].senha);
      if (!valid) {
        await registrarEventoSeguranca({ eventType: 'PASSWORD_CHANGE_FAILED', actor: users[0].usuario, ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'warning', detail: 'Senha atual inválida.' });
        return res.status(401).json({ error: 'Senha atual inválida.', requestId: req.security?.requestId });
      }

      const hash = await bcrypt.hash(novaSenha, 12);
      const currentToken = extrairTokenAutenticacao(req);
      await pool.execute('UPDATE usuarios SET senha = ?, password_changed_at = NOW(), must_change_password = FALSE WHERE id = ?', [hash, req.userId]);
      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE usuario_id = ? AND token <> ?', [req.userId, currentToken]);
      invalidateUserSessions(req.userId, currentToken);
      await registrarAuditoria('PASSWORD_CHANGED', users[0].usuario, 'Senha alterada pelo usuário', 'success');
      await registrarEventoSeguranca({ eventType: 'PASSWORD_CHANGED', actor: users[0].usuario, ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'success', detail: 'Outras sessões revogadas.' });
      res.json({ success: true });
    } catch (error) {
      console.error('[AUTH] Erro ao alterar senha:', error.message);
      res.status(500).json({ error: 'Falha ao alterar senha.', requestId: req.security?.requestId });
    }
  });


  /**
   * Endpoint POST /api/auth/mfa/setup.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/auth/mfa/setup
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/auth/mfa/setup', verificarToken, async (req, res) => {
    try {
      const [users] = await pool.execute('SELECT id, usuario, mfa_enabled FROM usuarios WHERE id = ? LIMIT 1', [req.userId]);
      if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
      if (users[0].mfa_enabled) return res.status(409).json({ error: 'MFA já está ativo.' });

      const secret = generateTotpSecret();
      await pool.execute('UPDATE usuarios SET mfa_secret = ?, mfa_required = TRUE WHERE id = ?', [secret, req.userId]);
      await registrarEventoSeguranca({ eventType: 'MFA_SETUP_STARTED', actor: users[0].usuario, ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'warning', detail: 'Segredo TOTP provisionado aguardando confirmação.' });
      res.json({
        secret,
        otpAuthUrl: createOtpAuthUrl({ account: users[0].usuario, secret })
      });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao iniciar MFA.' });
    }
  });


  /**
   * Endpoint POST /api/auth/mfa/confirm.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/auth/mfa/confirm
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/auth/mfa/confirm', verificarToken, async (req, res) => {
    try {
      const code = normalizeCredential(req.body.code, 20);
      const [users] = await pool.execute('SELECT usuario, mfa_secret FROM usuarios WHERE id = ? LIMIT 1', [req.userId]);
      if (users.length === 0 || !users[0].mfa_secret) return res.status(404).json({ error: 'MFA não iniciado.' });
      if (!verifyTotp(users[0].mfa_secret, code)) return res.status(401).json({ error: 'Código MFA inválido.' });

      await pool.execute('UPDATE usuarios SET mfa_enabled = TRUE, mfa_required = TRUE WHERE id = ?', [req.userId]);
      await registrarAuditoria('MFA_ENABLED', users[0].usuario, 'Segundo fator ativado', 'success');
      await registrarEventoSeguranca({ eventType: 'MFA_ENABLED', actor: users[0].usuario, ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'success', detail: 'TOTP confirmado.' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao confirmar MFA.' });
    }
  });


  /**
   * Endpoint POST /api/auth/mfa/disable.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/auth/mfa/disable
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/auth/mfa/disable', verificarToken, async (req, res) => {
    try {
      const passcode = String(req.body.passcode || '');
      const senhaAtual = String(req.body.senhaAtual || '');
      const code = normalizeCredential(req.body.code, 20);
      const [users] = await pool.execute('SELECT usuario, senha, mfa_enabled, mfa_secret FROM usuarios WHERE id = ? LIMIT 1', [req.userId]);
      if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const validated = passcode ? await validarRootPasscode(passcode) : { ok: false };
      if (!validated.ok) {
        const senhaValida = senhaAtual ? await bcrypt.compare(senhaAtual, users[0].senha) : false;
        if (!senhaValida) return res.status(403).json({ error: 'Confirme sua senha atual para desativar MFA.' });
        if (users[0].mfa_enabled && users[0].mfa_secret && !verifyTotp(users[0].mfa_secret, code)) {
          return res.status(401).json({ error: 'Código MFA inválido.' });
        }
      }

      await pool.execute('UPDATE usuarios SET mfa_enabled = FALSE, mfa_required = FALSE, mfa_secret = NULL WHERE id = ?', [req.userId]);
      await registrarAuditoria('MFA_DISABLED', users[0].usuario, 'Segundo fator desativado', 'danger');
      await registrarEventoSeguranca({ eventType: 'MFA_DISABLED', actor: users[0].usuario, ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: validated.ok ? 'MFA desativado via passcode root.' : 'MFA desativado pelo usuário.' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao desativar MFA.' });
    }
  });


  /**
   * Endpoint GET /api/empresas.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/empresas
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/empresas', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json([]);
    try { const [r] = await pool.execute('SELECT * FROM empresas ORDER BY nome ASC'); res.json(r); } catch (e) { res.status(500).json([]); }
  });
  /** Consolida cadastro e indicadores operacionais de cada organização. */
  /**
   * Endpoint GET /api/empresas/overview.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/empresas/overview
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/empresas/overview', verificarToken, requireRoles('DEV'), async (_req, res) => {
    try {
      const [rows] = await pool.execute(`
        SELECT e.*,
          COALESCE(branches.total, 0) AS branchesTotal,
          COALESCE(branches.active, 0) AS branchesActive,
          COALESCE(users.total, 0) AS usersTotal,
          COALESCE(users.blocked, 0) AS usersBlocked,
          COALESCE(sessions.total, 0) AS activeSessions,
          COALESCE(equipment.equipmentTotal, 0) AS equipmentTotal,
          COALESCE(equipment.openAlerts, 0) AS openAlerts,
          equipment.lastTelemetryAt
        FROM empresas e
        LEFT JOIN (
          SELECT empresa, COUNT(*) AS total, SUM(status = 'Ativa') AS active
          FROM loja
          GROUP BY empresa
        ) branches ON branches.empresa COLLATE utf8mb4_unicode_ci = e.nome COLLATE utf8mb4_unicode_ci
        LEFT JOIN (
          SELECT empresa, COUNT(*) AS total, SUM(security_blocked = TRUE) AS blocked
          FROM usuarios
          GROUP BY empresa
        ) users ON users.empresa COLLATE utf8mb4_unicode_ci = e.nome COLLATE utf8mb4_unicode_ci
        LEFT JOIN (
          SELECT u.empresa, COUNT(*) AS total
          FROM sessoes_ativas s
          INNER JOIN usuarios u ON u.id = s.usuario_id
          WHERE s.revogado = FALSE AND (s.expires_at IS NULL OR s.expires_at > NOW())
          GROUP BY u.empresa
        ) sessions ON sessions.empresa COLLATE utf8mb4_unicode_ci = e.nome COLLATE utf8mb4_unicode_ci
        LEFT JOIN (
          SELECT eq.empresa,
            COUNT(*) AS equipmentTotal,
            COALESCE(SUM(alerts.openAlerts), 0) AS openAlerts,
            MAX(h.ultima_comunicacao) AS lastTelemetryAt
          FROM equipamentos eq
          LEFT JOIN hardware_iot h ON h.equipamento_id = eq.id
          LEFT JOIN (
            SELECT equipamento_id, COUNT(*) AS openAlerts
            FROM notificacoes
            WHERE resolvido = FALSE
            GROUP BY equipamento_id
          ) alerts ON alerts.equipamento_id = eq.id
          GROUP BY eq.empresa
        ) equipment ON equipment.empresa COLLATE utf8mb4_unicode_ci = e.nome COLLATE utf8mb4_unicode_ci
        ORDER BY e.nome ASC
      `);
      res.json({
        generatedAt: new Date().toISOString(),
        organizations: rows.map((row) => ({
          ...row,
          branchesTotal: Number(row.branchesTotal || 0),
          branchesActive: Number(row.branchesActive || 0),
          usersTotal: Number(row.usersTotal || 0),
          usersBlocked: Number(row.usersBlocked || 0),
          activeSessions: Number(row.activeSessions || 0),
          equipmentTotal: Number(row.equipmentTotal || 0),
          openAlerts: Number(row.openAlerts || 0)
        }))
      });
    } catch (error) {
      console.error('[ORGANIZACOES] Falha ao consolidar portfólio:', error.message);
      res.status(500).json({ error: 'Falha ao carregar as organizações.' });
    }
  });

  /**
   * Endpoint POST /api/empresas.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/empresas
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/empresas', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' });
    const nome = normalizeCredential(req.body.nome, 150);
    const status = ['Ativa', 'Suspensa', 'Bloqueada'].includes(req.body.status) ? req.body.status : 'Ativa';
    if (!nome) return res.status(400).json({ error: 'A designação da empresa é obrigatória.' });
    try {
      const [result] = await pool.execute('INSERT INTO empresas (nome, cnpj, contato, email, status) VALUES (?, ?, ?, ?, ?)', [nome, req.body.cnpj || null, req.body.contato || null, req.body.email || null, status]);
      if (io) io.emit('organizacoes_updated', { id: Number(result.insertId), action: 'created' });
      res.status(201).json({ success: true, id: Number(result.insertId) });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe uma organização com esta designação.' });
      res.status(500).json({ error: 'Falha ao criar a organização.' });
    }
  });

  /**
   * Endpoint DELETE /api/empresas/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route DELETE /api/empresas/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.delete('/api/empresas/:id', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('DELETE FROM empresas WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (error) { res.status(500).send(); } });


  /**
   * Endpoint GET /api/usuarios.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/usuarios
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/usuarios', verificarToken, async (req, res) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json([]);
    try {
      let q = 'SELECT id, usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa, mfa_enabled, mfa_required, security_blocked FROM usuarios WHERE 1=1'; let p = [];
      if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); }
      const [r] = await pool.execute(q + ' ORDER BY role ASC', p); res.json(r);
    } catch (error) { res.status(500).json([]); }
  });


  /**
   * Endpoint GET /api/lojas.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/lojas
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/lojas', verificarToken, async (req, res) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json([]);
    try {
      let q = `SELECT l.*,
        (SELECT COUNT(*) FROM equipamentos e WHERE e.filial COLLATE utf8mb4_unicode_ci = l.nome COLLATE utf8mb4_unicode_ci AND e.empresa COLLATE utf8mb4_unicode_ci = l.empresa COLLATE utf8mb4_unicode_ci) AS equipamentos_total,
        (SELECT COUNT(*) FROM usuarios u WHERE u.filial COLLATE utf8mb4_unicode_ci = l.nome COLLATE utf8mb4_unicode_ci AND u.empresa COLLATE utf8mb4_unicode_ci = l.empresa COLLATE utf8mb4_unicode_ci) AS usuarios_total
        FROM loja l WHERE 1=1`; let p = [];
      if (req.userRole !== 'DEV') { q += ' AND l.empresa = ?'; p.push(req.userEmpresa); }
      const [lojas] = await pool.execute(q + ' ORDER BY nome ASC', p);
      let usuariosQuery = 'SELECT filial, nome_gerente, nome_coordenador, empresa FROM usuarios';
      const usuariosParams = [];
      if (req.userRole !== 'DEV') { usuariosQuery += ' WHERE empresa = ?'; usuariosParams.push(req.userEmpresa); }
      const [usuarios] = await pool.execute(usuariosQuery, usuariosParams);
      res.json(lojas.map(l => {

        /**
         * Concentra a logica de mesma loja para manter o restante do rota/API mais legivel.
         *
         * Responsabilidade: mantém este comportamento isolado para que validação,
         * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
         *
         * Fluxo principal:
         * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
         *
         * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
         *
         * @param {object} user - Usuário autenticado ou candidato à autenticação processado por esta rotina.
         * @returns {unknown} Resultado calculado para consumo do chamador.
         * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
         */
        const mesmaLoja = user => user.filial === l.nome && user.empresa === l.empresa;
        const uGerente = usuarios.find(user => mesmaLoja(user) && user.nome_gerente);
        const uCoord = usuarios.find(user => mesmaLoja(user) && user.nome_coordenador);
        return { ...l, equipamentos_total: Number(l.equipamentos_total || 0), usuarios_total: Number(l.usuarios_total || 0), nome_gerente: uGerente?.nome_gerente || null, nome_coordenador: uCoord?.nome_coordenador || null };
      }));
    } catch (error) {
      console.error('[LOJAS] Falha ao carregar gestão de lojas:', error.message);
      res.status(500).json({ error: 'Falha ao carregar a gestão de lojas.' });
    }
  });


  /**
   * Endpoint GET /api/equipamentos.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/equipamentos
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/equipamentos', verificarToken, async (req, res) => {
    try {
      let q = `
        SELECT e.*,
          latest_reading.temperatura AS ultima_temp,
          latest_reading.umidade AS ultima_umidade,
          latest_reading.data_hora AS atualizado_em,
          h.mac_address,
          h.ip_local,
          h.sinal_wifi,
          h.uptime,
          h.firmware_version,
          COALESCE(GREATEST(h.ultima_comunicacao, latest_reading.data_hora), h.ultima_comunicacao, latest_reading.data_hora) AS ultima_comunicacao,
          TIMESTAMPDIFF(SECOND, COALESCE(GREATEST(h.ultima_comunicacao, latest_reading.data_hora), h.ultima_comunicacao, latest_reading.data_hora), NOW()) AS segundos_sem_sinal,
          CASE
            WHEN COALESCE(h.ultima_comunicacao, latest_reading.data_hora) IS NULL THEN 'sem-sinal'
            WHEN COALESCE(GREATEST(h.ultima_comunicacao, latest_reading.data_hora), h.ultima_comunicacao, latest_reading.data_hora) >= DATE_SUB(NOW(), INTERVAL 3 MINUTE) THEN 'online'
            ELSE 'offline'
          END AS status_conexao
        FROM equipamentos e
        LEFT JOIN equipamento_ultima_leitura latest_reading
          ON latest_reading.equipamento_id = e.id
        LEFT JOIN hardware_iot h ON h.equipamento_id = e.id
        WHERE 1=1
      `;
      const p = [];
      if (req.userRole !== 'DEV') {
        q += ' AND e.empresa = ?';
        p.push(req.userEmpresa);
        if (req.userRole === 'LOJA') {
          q += ' AND e.filial = ?';
          p.push(req.userFilial);
        }
      }
      const [r] = await pool.execute(q, p);
      res.json(r);
    } catch (error) {
      console.error('[EQUIPAMENTOS] Falha ao listar equipamentos:', error.message);
      res.status(500).json({ error: 'Erro ao carregar equipamentos.', requestId: req.security?.requestId });
    }
  });


  /**
   * Endpoint POST /api/equipamentos.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/equipamentos
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/equipamentos', verificarToken, requireRoles('ADMIN', 'DEV'), async (req, res) => {
    try {
      const { nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao } = req.body;
      await enforceTrialLimit(pool, req.userEmpresa, 'equipment');
      /**
       * Concentra a logica de u min val para manter o restante do rota/API mais legivel.
       *
       * Responsabilidade: mantém este comportamento isolado para que validação,
       * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
       *
       * Fluxo principal:
       * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
       *
       * Efeitos colaterais: acessa a camada de persistência; finaliza a resposta HTTP
       *
       * @param {unknown} umidade_min - Valor de umidade min consumido por esta rotina.
       * @param {unknown} tipo - Valor de tipo consumido por esta rotina.
       * @param {unknown} temp_min - Valor de temp min consumido por esta rotina.
       * @param {unknown} temp_max - Valor de temp max consumido por esta rotina.
       * @param {unknown} umidade_min - Valor de umidade min consumido por esta rotina.
       * @param {unknown} umidade_max - Valor de umidade max consumido por esta rotina.
       * @param {unknown} intervalo_degelo - Valor de intervalo degelo consumido por esta rotina.
       * @param {unknown} duracao_degelo - Valor de duracao degelo consumido por esta rotina.
       * @param {unknown} setor - Valor de setor consumido por esta rotina.
       * @param {unknown} filial - Valor de filial consumido por esta rotina.
       * @param {unknown} data_calibracao - Valor de data calibracao consumido por esta rotina.
       * @param {unknown} tipo - Valor de tipo consumido por esta rotina.
       * @param {unknown} temp_min - Valor de temp min consumido por esta rotina.
       * @param {unknown} temp_max - Valor de temp max consumido por esta rotina.
       * @param {unknown} uMinVal - Valor de u min val consumido por esta rotina.
       * @param {unknown} uMaxVal - Valor de u max val consumido por esta rotina.
       * @param {unknown} intervalo_degelo - Valor de intervalo degelo consumido por esta rotina.
       * @param {unknown} duracao_degelo - Valor de duracao degelo consumido por esta rotina.
       * @param {unknown} setor - Valor de setor consumido por esta rotina.
       * @param {unknown} filial - Valor de filial consumido por esta rotina.
       * @param {unknown} verificarToken - Valor de verificar token consumido por esta rotina.
       * @param {import("express").Response} res - Resposta HTTP usada para devolver o resultado ao cliente.
       * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
       * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
       */
      const uMinVal = (umidade_min === '' || umidade_min === undefined) ? null : parseFloat(umidade_min);
      /**
       * Concentra a logica de u max val para manter o restante do rota/API mais legivel.
       *
       * Responsabilidade: mantém este comportamento isolado para que validação,
       * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
       *
       * Fluxo principal:
       * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
       *
       * Efeitos colaterais: acessa a camada de persistência; finaliza a resposta HTTP
       *
       * @param {unknown} umidade_max - Valor de umidade max consumido por esta rotina.
       * @param {unknown} tipo - Valor de tipo consumido por esta rotina.
       * @param {unknown} temp_min - Valor de temp min consumido por esta rotina.
       * @param {unknown} temp_max - Valor de temp max consumido por esta rotina.
       * @param {unknown} umidade_min - Valor de umidade min consumido por esta rotina.
       * @param {unknown} umidade_max - Valor de umidade max consumido por esta rotina.
       * @param {unknown} intervalo_degelo - Valor de intervalo degelo consumido por esta rotina.
       * @param {unknown} duracao_degelo - Valor de duracao degelo consumido por esta rotina.
       * @param {unknown} setor - Valor de setor consumido por esta rotina.
       * @param {unknown} filial - Valor de filial consumido por esta rotina.
       * @param {unknown} data_calibracao - Valor de data calibracao consumido por esta rotina.
       * @param {unknown} tipo - Valor de tipo consumido por esta rotina.
       * @param {unknown} temp_min - Valor de temp min consumido por esta rotina.
       * @param {unknown} temp_max - Valor de temp max consumido por esta rotina.
       * @param {unknown} uMinVal - Valor de u min val consumido por esta rotina.
       * @param {unknown} uMaxVal - Valor de u max val consumido por esta rotina.
       * @param {unknown} intervalo_degelo - Valor de intervalo degelo consumido por esta rotina.
       * @param {unknown} duracao_degelo - Valor de duracao degelo consumido por esta rotina.
       * @param {unknown} setor - Valor de setor consumido por esta rotina.
       * @param {unknown} filial - Valor de filial consumido por esta rotina.
       * @param {unknown} verificarToken - Valor de verificar token consumido por esta rotina.
       * @param {import("express").Response} res - Resposta HTTP usada para devolver o resultado ao cliente.
       * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
       * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
       */
      const uMaxVal = (umidade_max === '' || umidade_max === undefined) ? null : parseFloat(umidade_max);
      await pool.execute('INSERT INTO equipamentos (nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao, empresa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [nome, tipo, temp_min, temp_max, uMinVal, uMaxVal, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao || null, req.userEmpresa]
      );
      res.status(201).send();
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Erro ao cadastrar equipamento.' });
    }
  });


  /**
   * Endpoint GET /api/hardware.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/hardware
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/hardware', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).send();
    try {
      const [r] = await pool.execute(`
      SELECT e.id, e.nome, e.filial, e.motor_ligado, e.em_degelo,
            h.mac_address AS mac, h.ip_local AS ip, h.sinal_wifi AS signal_dbm,
            h.uptime, h.firmware_version AS fwVersion, h.ultima_comunicacao
      FROM equipamentos e
      LEFT JOIN hardware_iot h ON e.id = h.equipamento_id
    `);
      res.json(r);
    } catch (e) { res.status(500).send(); }
  });

  /**
   * Le o buffer serial e a saude diretamente do ESP inventariado. O proxy evita
   * CORS/mixed-content no navegador e devolve o texto sem transforma-lo.
   */
  /**
   * Endpoint POST /api/hardware/:id/serial/read.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/hardware/:id/serial/read
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/hardware/:id/serial/read', verificarToken, requireRoles('DEV'), async (req, res) => {
    const equipamentoId = Number(req.params.id);
    if (!Number.isInteger(equipamentoId) || equipamentoId <= 0) {
      return res.status(400).json({ error: 'Equipamento inválido.' });
    }

    try {
      const [rows] = await pool.execute(
        'SELECT ip_local FROM hardware_iot WHERE equipamento_id = ? LIMIT 1',
        [equipamentoId]
      );
      const ipAddress = String(rows[0]?.ip_local || '').trim();
      if (!isPrivateIpv4(ipAddress)) {
        return res.status(422).json({ error: 'O equipamento não possui um IPv4 privado válido no inventário.' });
      }

      const username = String(req.body?.username || '').slice(0, 128);
      const password = String(req.body?.password || '').slice(0, 256);
      const headers = username && password
        ? { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` }
        : {};

      /**
       * Consulta uma rota do servidor embarcado com limite de tempo independente.
       *
       * Responsabilidade: mantém este comportamento isolado para que validação,
       * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
       *
       * Fluxo principal:
       * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
       * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
       *
       * Efeitos colaterais: atualiza estado reativo da interface; consulta ou altera dados pela API
       *
       * @param {unknown} edgePath - Valor de edge path consumido por esta rotina.
       * @returns {Promise<unknown>} Resultado calculado para consumo do chamador.
       * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
       */
      const fetchEdgePath = async (edgePath) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        try {
          return await fetch(`http://${ipAddress}${edgePath}`, {
            headers,
            signal: controller.signal,
            cache: 'no-store'
          });
        } finally {
          clearTimeout(timeoutId);
        }
      };

      const [logsResult, healthResult] = await Promise.allSettled([
        fetchEdgePath('/logs'),
        fetchEdgePath('/health')
      ]);
      const logsResponse = logsResult.status === 'fulfilled' ? logsResult.value : null;
      const healthResponse = healthResult.status === 'fulfilled' ? healthResult.value : null;

      if (!logsResponse?.ok && !healthResponse?.ok) {
        const unauthorized = logsResponse?.status === 401 || healthResponse?.status === 401;
        return res.json({
          connected: false,
          code: unauthorized ? 'EDGE_AUTH_REQUIRED' : 'EDGE_UNAVAILABLE',
          error: unauthorized
            ? 'Credenciais do ESP inválidas ou não informadas.'
            : 'O ESP não respondeu aos endpoints de diagnóstico.'
        });
      }

      let logs = '';
      let health = null;
      if (logsResponse?.ok) logs = await logsResponse.text();
      if (healthResponse?.ok) {
        try { health = await healthResponse.json(); }
        catch (_error) { health = null; }
      }

      return res.json({
        connected: true,
        logs,
        health,
        logsAvailable: Boolean(logsResponse?.ok),
        source: 'edge-proxy',
        ip: ipAddress
      });
    } catch (error) {
      console.error('[SERIAL EDGE] Falha ao consultar placa:', error.message);
      return res.status(500).json({ error: 'Falha ao consultar o monitor serial da placa.' });
    }
  });

  /** Consolida inventário, conectividade e versões da frota IoT para o console DEV. */
  /**
   * Endpoint GET /api/hardware/overview.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/hardware/overview
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/hardware/overview', verificarToken, requireRoles('DEV'), async (req, res) => {
    if (req.query.refresh !== '1' && hardwareOverviewCache.data && hardwareOverviewCache.expiresAt > Date.now()) {
      return res.json(hardwareOverviewCache.data);
    }
    try {
      const [rows] = await pool.execute(`
        SELECT e.id, e.nome, e.filial, e.empresa, e.setor, e.tipo, e.motor_ligado, e.em_degelo,
               h.mac_address AS mac, h.ip_local AS ip, h.sinal_wifi AS signalDbm,
               h.uptime, h.firmware_version AS firmwareVersion, h.ultima_comunicacao AS lastSeen,
               TIMESTAMPDIFF(SECOND, h.ultima_comunicacao, NOW()) AS secondsSinceSeen,
               latest_reading.temperatura AS temperature, latest_reading.umidade AS humidity
        FROM equipamentos e
        LEFT JOIN hardware_iot h ON h.equipamento_id = e.id
        LEFT JOIN equipamento_ultima_leitura latest_reading
          ON latest_reading.equipamento_id = e.id
        ORDER BY e.filial, e.nome
      `);
      const [eventRows] = await pool.execute(`
        SELECT id, event_type AS type, actor, severity, detail, created_at AS createdAt
        FROM security_events
        WHERE event_type LIKE 'IOT\\_%'
        ORDER BY created_at DESC LIMIT 12
      `);

      const devices = rows.map((row) => {
        const seconds = row.secondsSinceSeen === null ? null : Math.max(0, Number(row.secondsSinceSeen));
        const status = seconds === null ? 'UNPROVISIONED' : seconds <= 180 ? 'ONLINE' : seconds <= 900 ? 'DEGRADED' : 'OFFLINE';
        const signalDbm = row.signalDbm === null ? null : Number(row.signalDbm);
        const signalQuality = signalDbm === null ? 'UNKNOWN' : signalDbm >= -60 ? 'EXCELLENT' : signalDbm >= -70 ? 'GOOD' : signalDbm >= -80 ? 'WEAK' : 'CRITICAL';
        return {
          ...row,
          signalDbm,
          secondsSinceSeen: seconds,
          temperature: row.temperature === null ? null : Number(row.temperature),
          humidity: row.humidity === null ? null : Number(row.humidity),
          status,
          signalQuality,
          motorOn: Boolean(row.motor_ligado),
          defrosting: Boolean(row.em_degelo)
        };
      });

      const versions = [...new Set(devices.map(device => device.firmwareVersion).filter(Boolean))];

      /**
       * Extrai parse version de uma entrada externa ou configuracao local.
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
      const parseVersion = (value) => String(value).replace(/^v/i, '').split('.').map(part => Number(part) || 0);
      versions.sort((a, b) => {
        const left = parseVersion(a); const right = parseVersion(b);
        for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
          if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) - (right[index] || 0);
        }
        return 0;
      });
      const firmwareCounts = new Map();
      devices.forEach((device) => {
        if (device.firmwareVersion) firmwareCounts.set(device.firmwareVersion, (firmwareCounts.get(device.firmwareVersion) || 0) + 1);
      });
      const targetFirmware = [...firmwareCounts.entries()].sort((a, b) => b[1] - a[1] || versions.indexOf(b[0]) - versions.indexOf(a[0]))[0]?.[0] || null;
      const signalValues = devices.map(device => device.signalDbm).filter(value => Number.isFinite(value));
      const sitesMap = new Map();
      devices.forEach((device) => {
        const key = device.filial || 'Sem filial';
        const site = sitesMap.get(key) || { filial: key, total: 0, online: 0, degraded: 0, offline: 0 };
        site.total += 1;
        if (device.status === 'ONLINE') site.online += 1;
        else if (device.status === 'DEGRADED') site.degraded += 1;
        else site.offline += 1;
        sitesMap.set(key, site);
      });

      const payload = {
        generatedAt: new Date().toISOString(),
        summary: {
          total: devices.length,
          online: devices.filter(device => device.status === 'ONLINE').length,
          degraded: devices.filter(device => device.status === 'DEGRADED').length,
          offline: devices.filter(device => device.status === 'OFFLINE').length,
          unprovisioned: devices.filter(device => device.status === 'UNPROVISIONED').length,
          weakSignal: devices.filter(device => ['WEAK', 'CRITICAL'].includes(device.signalQuality)).length,
          averageSignal: signalValues.length ? Math.round(signalValues.reduce((sum, value) => sum + value, 0) / signalValues.length) : null,
          targetFirmware,
          outdatedFirmware: targetFirmware ? devices.filter(device => device.firmwareVersion && device.firmwareVersion !== targetFirmware).length : 0
        },
        devices: devices.sort((a, b) => {
          const priority = { OFFLINE: 0, DEGRADED: 1, UNPROVISIONED: 2, ONLINE: 3 };
          return priority[a.status] - priority[b.status] || String(a.filial || '').localeCompare(String(b.filial || '')) || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { numeric: true });
        }),
        sites: [...sitesMap.values()].sort((a, b) => b.offline - a.offline || a.filial.localeCompare(b.filial)),
        firmware: versions.map(version => ({ version, count: devices.filter(device => device.firmwareVersion === version).length })),
        events: eventRows
      };
      hardwareOverviewCache = { data: payload, expiresAt: Date.now() + 10000 };
      res.json(payload);
    } catch (error) {
      console.error('[HARDWARE] Falha ao consolidar a frota IoT:', error.message);
      res.status(500).json({ error: 'Falha ao consolidar a frota IoT.' });
    }
  });


  /**
   * Endpoint PUT /api/equipamentos/:id/edit.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/equipamentos/:id/edit
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/equipamentos/:id/edit', verificarToken, async (req, res) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') {
      return res.status(403).json({ error: 'Acesso restrito.' });
    }

    const { id } = req.params;
    const { nome, temp_max, temp_min, umidade_max, umidade_min, setor, filial } = req.body;

    try {

      /**
       * Extrai parse numero de uma entrada externa ou configuracao local.
       *
       * Responsabilidade: mantém este comportamento isolado para que validação,
       * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
       *
       * Fluxo principal:
       * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
       *
       * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
       *
       * @param {unknown} valor - Valor de valor consumido por esta rotina.
       * @param {unknown} fallback - Valor de fallback consumido por esta rotina.
       * @returns {unknown} Resultado calculado para consumo do chamador.
       * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
       */
      const parseNumero = (valor, fallback) => {
        return (valor !== undefined && valor !== '' && valor !== null && !isNaN(valor)) ? parseFloat(valor) : fallback;
      };

      const valNome = nome || 'Equipamento Edge';
      const valTempMax = parseNumero(temp_max, 30.0);
      const valTempMin = parseNumero(temp_min, 15.0);
      const valUmidMax = parseNumero(umidade_max, 80.0);
      const valUmidMin = parseNumero(umidade_min, 20.0);
      const valSetor = setor || 'Geral';
      const valFilial = filial || 'Matriz';

      const queryParams = [valNome, valTempMax, valTempMin, valUmidMax, valUmidMin, valSetor, valFilial, id];

      let sql = `UPDATE equipamentos SET
                 nome=?, temp_max=?, temp_min=?, umidade_max=?, umidade_min=?, setor=?, filial=?
                 WHERE id=?`;

      if (req.userRole !== 'DEV') {
        sql += ` AND empresa=?`;
        queryParams.push(req.userEmpresa);
      }

      const [result] = await pool.execute(sql, queryParams);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Equipamento não encontrado ou acesso negado.' });
      }

      try {
        const mqtt = require('mqtt');
        const clientTemp = mqtt.connect(getMqttBrokerUrl(), getMqttClientOptions());
        clientTemp.on('connect', () => {
          const payloadConfig = JSON.stringify(montarComandoMqtt("CONFIG", null, {
            temp_critica: valTempMax,
            temp_atencao: valTempMax - 2.0
          }));
          clientTemp.publish(`termosync/comandos/${id}`, payloadConfig, { qos: 1, retain: false });
          clientTemp.end();
        });
      } catch (mqttErr) {
        console.warn('[MQTT] Equipamento atualizado, mas a configuração não foi enviada:', mqttErr.message);
      }

      res.json({ success: true, message: 'Equipamento atualizado com sucesso!' });

    } catch (error) {
      console.error('❌ [ERRO UPDATE EQUIPAMENTO]:', error);
      res.status(500).json({ error: `Falha no Banco de Dados: ${error.message}` });
    }
  });

  // Deploy por upload altera arquivos executáveis do servidor. Em produção ele
  // só fica disponível após habilitação explícita no ambiente.
  const requireWebDeployEnabled = (req, res, next) => {
    const enabled = process.env.NODE_ENV !== 'production' || process.env.ALLOW_WEB_DEPLOY === 'true';
    if (!enabled) {
      return res.status(503).json({
        error: 'Deploy pelo painel está desativado neste ambiente. Use a esteira oficial ou habilite ALLOW_WEB_DEPLOY=true.'
      });
    }
    next();
  };

  /**
   * Remove um equipamento e os registros auxiliares que não possuem chave estrangeira.
   * Leituras, alertas e chamados são eliminados pelas regras ON DELETE CASCADE do banco.
   */
  app.delete('/api/equipamentos/:id', verificarToken, requireRoles('ADMIN', 'DEV'), async (req, res) => {
    const equipamentoId = Number(req.params.id);
    if (!Number.isInteger(equipamentoId) || equipamentoId <= 0) {
      return res.status(400).json({ error: 'Equipamento inválido.' });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const params = [equipamentoId];
      let selectSql = 'SELECT id, nome, empresa FROM equipamentos WHERE id = ?';
      if (req.userRole !== 'DEV') {
        selectSql += ' AND empresa = ?';
        params.push(req.userEmpresa);
      }
      selectSql += ' FOR UPDATE';

      const [equipamentos] = await connection.execute(selectSql, params);
      if (!equipamentos.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Equipamento não encontrado ou acesso negado.' });
      }

      await connection.execute('DELETE FROM hardware_iot WHERE equipamento_id = ?', [equipamentoId]);
      try {
        await connection.execute('DELETE FROM equipamento_ultima_leitura WHERE equipamento_id = ?', [equipamentoId]);
      } catch (cacheError) {
        if (cacheError.code !== 'ER_NO_SUCH_TABLE') throw cacheError;
      }
      const [result] = await connection.execute('DELETE FROM equipamentos WHERE id = ?', [equipamentoId]);
      await connection.commit();

      try {
        await registrarAuditoria('EQUIPMENT_DELETED', req.userRole, `${equipamentos[0].nome} (ID ${equipamentoId})`, 'danger');
      } catch (auditError) {
        // A exclusão já foi confirmada no banco; uma indisponibilidade da auditoria
        // não deve transformar a resposta em erro nem induzir uma nova tentativa.
        console.warn('[EQUIPAMENTOS] Equipamento removido, mas a auditoria falhou:', auditError.message);
      }
      if (io) io.emit('atualizacao_dados');
      return res.json({ success: true, deletedId: equipamentoId, affectedRows: result.affectedRows });
    } catch (error) {
      if (connection) await connection.rollback().catch(() => {});
      console.error('[EQUIPAMENTOS] Falha ao remover equipamento:', error.message);
      return res.status(500).json({ error: 'Falha ao remover equipamento.', requestId: req.security?.requestId });
    } finally {
      connection?.release();
    }
  });


  /**
   * Endpoint POST /api/system/verify-root-passcode.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/system/verify-root-passcode
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/system/verify-root-passcode', rootPasscodeLimiter, verificarToken, requireRoles('DEV'), async (req, res) => {
    const { passcode } = req.body;
    if (!passcode) {
      return res.status(400).json({ success: false, error: 'Credencial ausente.' });
    }

    const ip = req.security?.ip || req.ip || req.socket?.remoteAddress || 'Desconhecido';
    const userAgent = req.security?.userAgent || req.headers['user-agent'] || 'Desconhecido';

    try {
      const validated = await validarRootPasscode(passcode);
      if (validated.ok) {
        await registrarAuditoria('ROOT_BOOT_SUCCESS', validated.actor, `Desbloqueio de terminal bem-sucedido (${ip})`, 'success');
        await registrarEventoSeguranca({ eventType: 'ROOT_BOOT_SUCCESS', actor: validated.actor, ip, userAgent, severity: 'success', detail: validated.source });
        return res.json({ success: true, usuario: validated.actor });
      }

      await registrarAuditoria('ROOT_BOOT_FAILED', 'Desconhecido', `Falha ao tentar desbloquear terminal Root (${ip})`, 'danger');
      await registrarEventoSeguranca({ eventType: 'ROOT_BOOT_FAILED', actor: 'Desconhecido', ip, userAgent, severity: 'danger', detail: 'Credencial root inválida.' });
      return res.status(401).json({ success: false, error: 'Credencial Root inválida.' });
    } catch (error) {
      console.error('❌ [ERRO ROOT BOOT]:', error);
      return res.status(500).json({ success: false, error: 'Erro de validação no servidor.' });
    }
  });


  /**
   * Endpoint POST /api/auth/impersonate/exchange.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/auth/impersonate/exchange
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/auth/impersonate/exchange', impersonationExchangeLimiter, async (req, res) => {
    const accessCode = normalizeCredential(req.body?.code, 128);
    const pendingAccess = impersonationAccessCodes.get(accessCode);

    // O código é consumido antes de qualquer operação assíncrona para impedir
    // que duas requisições concorrentes criem sessões para a mesma autorização.
    if (accessCode) impersonationAccessCodes.delete(accessCode);
    if (!pendingAccess || pendingAccess.expiresAt <= Date.now()) {
      return res.status(401).json({ error: 'Acesso remoto inválido ou expirado.' });
    }

    const ip = req.security?.ip || req.ip || req.socket?.remoteAddress || 'Desconhecido';
    const userAgent = req.security?.userAgent || req.headers['user-agent'] || 'Desconhecido';
    const expiresInMinutes = 60;
    const token = jwt.sign({
      id: pendingAccess.userId,
      role: pendingAccess.role,
      filial: pendingAccess.filial,
      empresa: pendingAccess.empresa,
      impersonated: true,
      impersonatedBy: pendingAccess.userId
    }, SECRET_KEY, { expiresIn: `${expiresInMinutes}m` });

    try {
      await pool.execute(
        'INSERT INTO sessoes_ativas (usuario_id, usuario_nome, role, token, ip_address, user_agent, expires_at, last_seen, impersonated_filial, impersonated_by) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW(), ?, ?)',
        [pendingAccess.userId, `Impersonate: ${pendingAccess.filial}`, pendingAccess.role, token, ip, String(userAgent).slice(0, 500), expiresInMinutes, pendingAccess.filial, pendingAccess.userId]
      );
      try {
        await registrarAuditoria('IMPERSONATE', 'Root/Dev', `Acesso remoto a: ${pendingAccess.filial}`, 'warning');
        await registrarEventoSeguranca({ eventType: 'IMPERSONATE', actor: 'Root/Dev', ip, userAgent, severity: 'warning', detail: `Acesso remoto a: ${pendingAccess.filial}` });
      } catch (auditError) {
        console.warn('[AUDIT] Falha ao registrar acesso remoto:', auditError.message);
      }

      return res.json({
        token,
        id: pendingAccess.userId,
        role: pendingAccess.role,
        filial: pendingAccess.filial,
        empresa: pendingAccess.empresa,
        nome: `Suporte Remoto (${pendingAccess.filial})`,
        expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString()
      });
    } catch (error) {
      console.error('[IMPERSONATE] Falha ao trocar código por sessão:', error.message);
      return res.status(500).json({ error: 'Não foi possível iniciar a sessão remota.' });
    }
  });


  /**
   * Endpoint POST /api/impersonate.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/impersonate
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/impersonate', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Apenas Root.' });

    const alvo = normalizeCredential(req.body.filialDestino || req.body.filial, 100);
    const targetRole = String(req.body.role || 'LOJA').toUpperCase();
    if (!alvo) return res.status(400).json({ error: 'Selecione uma filial válida.' });
    if (!new Set(['ADMIN', 'LOJA', 'MANUTENCAO']).has(targetRole)) return res.status(400).json({ error: 'Perfil de acesso remoto inválido.' });

    try {
      const [lojas] = await pool.execute('SELECT nome, empresa, status FROM loja WHERE nome = ? LIMIT 1', [alvo]);
      if (lojas.length === 0) return res.status(404).json({ error: 'Tenant não encontrado.' });
      if (lojas[0].status !== 'Ativa') return res.status(409).json({ error: 'O tenant está suspenso ou bloqueado.' });
      const empresaDestino = lojas[0].empresa || 'Cliente Alpha (Padrão)';
      const accessCode = crypto.randomBytes(32).toString('hex');
      const accessCodeTtlMs = 60 * 1000;

      // Remove autorizações abandonadas e mantém o mapa pequeno mesmo em
      // instalações onde o processo permanece ativo por longos períodos.
      const now = Date.now();
      for (const [code, access] of impersonationAccessCodes.entries()) {
        if (access.expiresAt <= now) impersonationAccessCodes.delete(code);
      }
      impersonationAccessCodes.set(accessCode, {
        userId: req.userId,
        filial: alvo,
        empresa: empresaDestino,
        role: targetRole,
        expiresAt: now + accessCodeTtlMs
      });

      res.json({
        accessCode,
        filial: alvo,
        expiresAt: new Date(now + accessCodeTtlMs).toISOString()
      });
    } catch (error) {
      console.error('❌ [ERRO IMPERSONATE]:', error);
      res.status(500).json({ error: 'Falha ao gerar sessão de acesso remoto.' });
    }
  });


  /**
   * Endpoint PUT /api/empresas/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/empresas/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/empresas/:id', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' });
    const { id } = req.params; const { nome, cnpj, contato, telefone, email, status } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ success: false, error: 'A designação da empresa é obrigatória.' });
    try {
      const contatoValor = contato || telefone || null;
      const queryParams = [nome.trim(), cnpj ? cnpj.trim() : null, contatoValor ? contatoValor.trim() : null, email ? email.trim() : null, status || 'Ativa', id];
      const sql = `UPDATE empresas SET nome = ?, cnpj = ?, contato = ?, email = ?, status = ? WHERE id = ?`;
      const [result] = await pool.execute(sql, queryParams);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });
      if (io) io.emit('organizacoes_updated', { id: Number(id), action: 'updated' });
      return res.json({ success: true, message: 'Empresa atualizada com sucesso!' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Erro interno.' }); }
  });


  /**
   * Endpoint POST /api/usuarios.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/usuarios
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/usuarios', verificarToken, requireRoles('ADMIN', 'DEV'), async (req, res) => {
    try {
      const allowedRoles = ['DEV', 'ADMIN', 'MANUTENCAO', 'LOJA'];
      const usuario = normalizeCredential(req.body.usuario, 120);
      const senha = String(req.body.senha || '');
      const role = normalizeCredential(req.body.role, 50).toUpperCase();
      const filial = normalizeCredential(req.body.filial, 120) || null;
      const nome_gerente = normalizeCredential(req.body.nome_gerente, 120) || null;
      const nome_coordenador = normalizeCredential(req.body.nome_coordenador, 120) || null;
      const nome_tecnico = normalizeCredential(req.body.nome_tecnico, 120) || null;
      const empresa = req.userRole === 'DEV' && req.body.empresa ? normalizeCredential(req.body.empresa, 120) : req.userEmpresa;

      if (!usuario || !senha || !allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Dados obrigatórios inválidos.' });
      }
      if (role === 'DEV' && req.userRole !== 'DEV') {
        return res.status(403).json({ error: 'Apenas DEV pode criar identidades DEV.' });
      }
      if (!isStrongPassword(senha)) {
        return res.status(400).json({ error: 'A senha precisa ter 10+ caracteres, maiúscula, minúscula, número e símbolo.' });
      }

      await enforceTrialLimit(pool, empresa, 'users');

      await pool.execute(
        'INSERT INTO usuarios (usuario, senha, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [usuario, await bcrypt.hash(senha, 12), role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa]
      );
      await registrarAuditoria('USER_CREATED', req.userRole, `${usuario} (${role})`, 'warning');
      await registrarEventoSeguranca({ eventType: 'USER_CREATED', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'warning', detail: `${usuario} (${role})` });
      res.status(201).json({ success: true });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Usuário já existe.' });
      res.status(500).json({ error: 'Erro ao criar usuário.' });
    }
  });


  /**
   * Endpoint PUT /api/usuarios/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/usuarios/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/usuarios/:id', verificarToken, requireRoles('ADMIN', 'DEV'), async (req, res) => {
    try {
      const allowedRoles = ['DEV', 'ADMIN', 'MANUTENCAO', 'LOJA'];
      const usuario = normalizeCredential(req.body.usuario, 120);
      const role = normalizeCredential(req.body.role, 50).toUpperCase();
      const filial = normalizeCredential(req.body.filial, 120) || null;
      const nome_gerente = normalizeCredential(req.body.nome_gerente, 120) || null;
      const nome_coordenador = normalizeCredential(req.body.nome_coordenador, 120) || null;
      const nome_tecnico = normalizeCredential(req.body.nome_tecnico, 120) || null;
      const empresaTarget = req.userRole === 'DEV' && req.body.empresa ? normalizeCredential(req.body.empresa, 120) : req.userEmpresa;
      const senha = req.body.senha ? String(req.body.senha) : '';
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0 || !usuario || !allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Dados obrigatórios inválidos.' });
      }
      if (role === 'DEV' && req.userRole !== 'DEV') {
        return res.status(403).json({ error: 'Apenas DEV pode promover identidades DEV.' });
      }
      const [targetUsers] = await pool.execute('SELECT role, empresa FROM usuarios WHERE id = ? LIMIT 1', [id]);
      if (!targetUsers.length) return res.status(404).json({ error: 'Usuário não encontrado.' });
      if (req.userRole !== 'DEV' && targetUsers[0].role === 'DEV') {
        return res.status(403).json({ error: 'Administradores não podem alterar identidades DEV.' });
      }
      if (senha && !isStrongPassword(senha)) {
        return res.status(400).json({ error: 'A senha precisa ter 10+ caracteres, maiúscula, minúscula, número e símbolo.' });
      }

      const params = [usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresaTarget];
      let sql = 'UPDATE usuarios SET usuario=?, role=?, filial=?, nome_gerente=?, nome_coordenador=?, nome_tecnico=?, empresa=?';
      if (senha) {
        sql += ', senha=?';
        params.push(await bcrypt.hash(senha, 12));
      }
      sql += ' WHERE id=?';
      params.push(id);
      if (req.userRole !== 'DEV') {
        sql += ' AND empresa=?';
        params.push(req.userEmpresa);
      }

      const [result] = await pool.execute(sql, params);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
      if (senha) {
        await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE usuario_id = ?', [id]);
        invalidateUserSessions(id);
      }
      await registrarAuditoria('USER_UPDATED', req.userRole, `${usuario} (${role})`, senha ? 'danger' : 'warning');
      await registrarEventoSeguranca({ eventType: 'USER_UPDATED', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: senha ? 'danger' : 'warning', detail: `${usuario} (${role}) senha=${senha ? 'alterada' : 'inalterada'}` });
      res.status(200).json({ success: true });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Usuário já existe.' });
      res.status(500).json({ error: 'Erro ao editar.' });
    }
  });


  /**
   * Endpoint DELETE /api/usuarios/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route DELETE /api/usuarios/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.delete('/api/usuarios/:id', verificarToken, requireRoles('ADMIN', 'DEV'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
      if (id === Number(req.userId)) return res.status(400).json({ error: 'Não é possível excluir a própria identidade.' });
      const [targetUsers] = await pool.execute('SELECT role FROM usuarios WHERE id = ? LIMIT 1', [id]);
      if (!targetUsers.length) return res.status(404).json({ error: 'Usuário não encontrado.' });
      if (req.userRole !== 'DEV' && targetUsers[0].role === 'DEV') return res.status(403).json({ error: 'Administradores não podem excluir identidades DEV.' });

      let sql = 'DELETE FROM usuarios WHERE id=?';
      const params = [id];
      if (req.userRole !== 'DEV') {
        sql += ' AND empresa=?';
        params.push(req.userEmpresa);
      }

      const [result] = await pool.execute(sql, params);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE usuario_id = ?', [id]);
      invalidateUserSessions(id);
      await registrarAuditoria('USER_DELETED', req.userRole, `ID ${id}`, 'danger');
      await registrarEventoSeguranca({ eventType: 'USER_DELETED', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: `ID ${id}` });
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir.' });
    }
  });


  /**
   * Endpoint POST /api/lojas.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/lojas
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/lojas', verificarToken, async (req, res) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send();
    try {
      const empresa = req.userRole === 'DEV' && req.body.empresa ? req.body.empresa : req.userEmpresa;
      await enforceTrialLimit(pool, empresa, 'stores');
      await pool.execute(
        'INSERT INTO loja (nome, endereco, telefone, empresa, status) VALUES (?, ?, ?, ?, ?)',
        [req.body.nome, req.body.endereco, req.body.telefone, empresa, req.userRole === 'DEV' && req.body.status ? req.body.status : 'Ativa']
      );
      res.status(201).send();
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Erro ao cadastrar loja.' });
    }
  });

  /**
   * Endpoint PUT /api/lojas/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/lojas/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/lojas/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { if (req.userRole === 'DEV') { await pool.execute('UPDATE loja SET nome=?, endereco=?, telefone=?, empresa=?, status=? WHERE id=?', [req.body.nome, req.body.endereco, req.body.telefone, req.body.empresa || req.userEmpresa, req.body.status || 'Ativa', req.params.id]); } else { await pool.execute('UPDATE loja SET nome=?, endereco=?, telefone=? WHERE id=? AND empresa=?', [req.body.nome, req.body.endereco, req.body.telefone, req.params.id, req.userEmpresa]); } res.status(200).send(); } catch (error) { res.status(500).send(); } });

  /**
   * Endpoint DELETE /api/lojas/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route DELETE /api/lojas/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.delete('/api/lojas/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' }); try { if (req.userRole === 'DEV') { await pool.execute('DELETE FROM loja WHERE id = ?', [req.params.id]); } else { await pool.execute('DELETE FROM loja WHERE id = ? AND empresa = ?', [req.params.id, req.userEmpresa]); } res.status(200).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Erro interno.' }); } });


  /**
   * Endpoint POST /api/hardware/:id/comando.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/hardware/:id/comando
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/hardware/:id/comando', verificarToken, requirePermission('hardware:command'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const acao = normalizeCredential(req.body.acao, 60);
      const estado = req.body.estado;
      const allowedActions = ['MANUAL_RELE', 'CONFIG', 'REBOOT', 'OTA', 'DEGELO', 'LIGAR', 'DESLIGAR'];
      if (!Number.isInteger(id) || id <= 0 || !allowedActions.includes(acao)) {
        return res.status(400).json({ error: 'Comando de hardware inválido.' });
      }
      const topico = `termosync/comandos/${id}`;
      const estadoNormalizado = acao === 'LIGAR' ? true : acao === 'DESLIGAR' ? false : Boolean(estado);
      const payload = JSON.stringify(montarComandoMqtt(acao, estadoNormalizado));
      const mqttClientCmd = mqtt.connect(getMqttBrokerUrl(), getMqttClientOptions());
      mqttClientCmd.on('connect', () => {
        mqttClientCmd.publish(topico, payload, { qos: 1, retain: false }, (err) => {
          if (err) { mqttClientCmd.end(); return res.status(500).json({ error: 'Falha ao comunicar com o equipamento.' }); }
          registrarEventoSeguranca({ eventType: 'IOT_COMMAND_SENT', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'warning', detail: `${topico}: ${acao}` });
          console.log(`⚡ [MQTT COMANDO] Enviado para Equipamento ${id}: ${payload}`); mqttClientCmd.end(); res.json({ success: true, message: `Comando enviado com sucesso.` });
        });
      });
    } catch (error) { res.status(500).json({ error: 'Erro interno ao processar comando.' }); }
  });


  /**
   * Endpoint POST /api/leituras.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/leituras
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/leituras', async (req, res) => {
    try {
      if (!(await validarTokenIoT(req))) {
        await registrarEventoSeguranca({ eventType: 'IOT_INGEST_DENIED', ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: 'Token IoT ausente ou inválido.' });
        return res.status(401).json({ error: 'Token IoT inválido.' });
      }

      if (await isMaintenanceModeEnabled()) return res.status(503).json({ error: 'Sistema em Manutenção.' });

      const {
        equipamento_id, temperatura, umidade, alerta_forcado, consumo_kwh,
        motor_ligado, em_degelo, mac_address, ip_local, sinal_wifi, uptime, firmware_version
      } = req.body;

      const telemetria = validarTelemetria({ equipamento_id, temperatura, umidade, consumo_kwh });
      const t = telemetria.temperatura;
      const u = telemetria.umidade;
      const c_kwh = telemetria.consumo;

      const hw_mac = (mac_address || 'A4:CF:12:XX:XX:XX').substring(0, 20);
      const hw_ip = (ip_local || '192.168.1.100').substring(0, 15);
      const hw_wifi = sinal_wifi ? parseInt(sinal_wifi) : -65;
      const hw_up = (uptime || '0h').substring(0, 50);
      const hw_fw = (firmware_version || 'v1.0.0').substring(0, 20);

      const now = Date.now();
      const shouldTouchHardware = String(equipamento_id) !== "1"
        && now - (hardwareTelemetryTouch.get(String(equipamento_id)) || 0) > 15000;

      if (shouldTouchHardware) {
        try {
          await pool.execute(`
            INSERT INTO hardware_iot (equipamento_id, mac_address, ip_local, sinal_wifi, uptime, firmware_version, ultima_comunicacao)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              mac_address = ?, ip_local = ?, sinal_wifi = ?, uptime = ?, firmware_version = ?, ultima_comunicacao = NOW()
          `, [
            equipamento_id, hw_mac, hw_ip, hw_wifi, hw_up, hw_fw,
            hw_mac, hw_ip, hw_wifi, hw_up, hw_fw
          ]);
        } catch (e) {
          console.error("❌ ERRO BD HARDWARE (HTTP):", e.message);
        }
        hardwareTelemetryTouch.set(String(equipamento_id), now);
      }

      const [r] = await pool.execute('INSERT INTO leituras (equipamento_id, temperatura, umidade, consumo_kwh) VALUES (?, ?, ?, ?)', [equipamento_id, t, u, c_kwh]);

      const [eq] = await pool.execute('SELECT temp_max, temp_min, umidade_min, umidade_max, nome, em_degelo, motor_ligado, setor, filial, empresa FROM equipamentos WHERE id = ?', [equipamento_id]);

      if (eq.length > 0) {
        /**
         * Verifica a condicao is motor ligado e retorna um valor booleano.
         *
         * Responsabilidade: mantém este comportamento isolado para que validação,
         * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
         *
         * Fluxo principal:
         * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
         * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
         *
         * Efeitos colaterais: acessa a camada de persistência; registra informações de diagnóstico
         *
         * @param {unknown} motor_ligado - Valor de motor ligado consumido por esta rotina.
         * @param {unknown} em_degelo - Valor de em degelo consumido por esta rotina.
         * @param {unknown} isEmDegelo - Valor de is em degelo consumido por esta rotina.
         * @param {unknown} tipoAlerta - Valor de tipo alerta consumido por esta rotina.
         * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
         * @returns {boolean} Indica se a condição avaliada foi atendida.
         * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
         */
        const isMotorLigado = (motor_ligado == 1 || motor_ligado === true);
        /**
         * Verifica a condicao is em degelo e retorna um valor booleano.
         *
         * Responsabilidade: mantém este comportamento isolado para que validação,
         * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
         *
         * Fluxo principal:
         * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
         * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
         *
         * Efeitos colaterais: acessa a camada de persistência; registra informações de diagnóstico
         *
         * @param {unknown} em_degelo - Valor de em degelo consumido por esta rotina.
         * @param {unknown} em_degelo - Valor de em degelo consumido por esta rotina.
         * @param {unknown} isEmDegelo - Valor de is em degelo consumido por esta rotina.
         * @param {unknown} tipoAlerta - Valor de tipo alerta consumido por esta rotina.
         * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
         * @returns {boolean} Indica se a condição avaliada foi atendida.
         * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
         */
        const isEmDegelo = (em_degelo == 1 || em_degelo === true);
        await pool.execute('UPDATE equipamentos SET motor_ligado=?, em_degelo=? WHERE id=?', [isMotorLigado, isEmDegelo, equipamento_id]);

        const tMax = parseFloat(eq[0].temp_max);
        const tMin = parseFloat(eq[0].temp_min);
        const uMax = parseFloat(eq[0].umidade_max || 0);
        const uMin = parseFloat(eq[0].umidade_min || 0);

        let novosAlertas = [];


        /**
         * Concentra a logica de check and alert para manter o restante do rota/API mais legivel.
         *
         * Responsabilidade: mantém este comportamento isolado para que validação,
         * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
         *
         * Fluxo principal:
         * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
         * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
         * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
         *
         * Efeitos colaterais: acessa a camada de persistência; registra informações de diagnóstico
         *
         * @param {unknown} condicaoAnomala - Valor de condicao anomala consumido por esta rotina.
         * @param {unknown} tipoAlerta - Valor de tipo alerta consumido por esta rotina.
         * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
         * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
         * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
         */
        const checkAndAlert = async (condicaoAnomala, tipoAlerta, mensagem) => {
          const alertKey = `${equipamento_id}:${tipoAlerta}`;
          const pendingState = alertConditionPending.get(alertKey);
          if (!pendingState || pendingState.value !== condicaoAnomala) {
            alertConditionPending.set(alertKey, { value: condicaoAnomala, since: Date.now() });
            return;
          }
          if (Date.now() - pendingState.since < ALERT_STABILITY_MS) return;
          if (alertConditionState.get(alertKey) === condicaoAnomala || alertChecksInFlight.has(alertKey)) return;
          alertChecksInFlight.add(alertKey);
          try {
            if (condicaoAnomala) {
              const [existe] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=? LIMIT 1', [equipamento_id, tipoAlerta]);
              if (existe.length > 0) alertLastCreatedAt.set(alertKey, Date.now());
              if (existe.length === 0) {
                let lastCreatedAt = alertLastCreatedAt.get(alertKey) || 0;
                if (!lastCreatedAt) {
                  const [recentAlerts] = await pool.execute('SELECT data_hora FROM notificacoes WHERE equipamento_id=? AND tipo_alerta=? ORDER BY id DESC LIMIT 1', [equipamento_id, tipoAlerta]);
                  lastCreatedAt = recentAlerts[0]?.data_hora ? new Date(recentAlerts[0].data_hora).getTime() : 0;
                  if (lastCreatedAt) alertLastCreatedAt.set(alertKey, lastCreatedAt);
                }
                if (Date.now() - lastCreatedAt >= ALERT_REOPEN_COOLDOWN_MS) {
                  const [inserido] = await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta, resolvido) VALUES (?, ?, ?, 0)', [equipamento_id, mensagem, tipoAlerta]);
                  alertLastCreatedAt.set(alertKey, Date.now());
                  novosAlertas.push({ id: inserido.insertId, equipamento_id, mensagem, tipo_alerta: tipoAlerta });
                  enviarAlertaCriticoMulticanal({ tipoAlerta, equipamento: eq[0].nome, filial: eq[0].filial, mensagem }).catch((err) => console.warn('[ALERTA] Falha multicanal:', err.message));

                  if (tipoAlerta === 'MECANICA' || tipoAlerta === 'TEMPERATURA') {
                     console.log(`📱 [WHATSAPP HTTP] Enviando alerta para gerência da loja ${eq[0].filial}: ${mensagem}`);
                     const [responsaveis] = await pool.execute('SELECT telefone FROM usuarios WHERE filial = ? AND role IN ("LOJA", "MANUTENCAO") AND telefone IS NOT NULL', [eq[0].filial]);
                     if (responsaveis.length > 0) {
                       const zapMsg = `🚨 *TERMOSYNC: ALERTA CRÍTICO* 🚨\n\n*Filial:* ${eq[0].filial}\n*Máquina:* ${eq[0].nome}\n*Anomalia:* ${mensagem}\n\n🤖 Responda:\n*[ 1 ]* Ligar compressor remotamente\n*[ 2 ]* Ignorar alerta`;
                       enviarAlertaWhatsApp(responsaveis[0].telefone, zapMsg, equipamento_id, eq[0].nome);
                     }
                  }
                }
              }
            } else {
              const [resolved] = await pool.execute('UPDATE notificacoes SET resolvido=1 WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
              if (resolved.affectedRows > 0) alertLastCreatedAt.set(alertKey, Date.now());
            }
            alertConditionState.set(alertKey, condicaoAnomala);
          } finally {
            alertChecksInFlight.delete(alertKey);
          }
        };

        const condRede = (alerta_forcado === 'REDE');
        await checkAndAlert(condRede, 'REDE', `FALHA IoT/REDE: Sensor offline em "${eq[0].nome}".`);
        const condPorta = (alerta_forcado === 'PORTA_ABERTA');
        await checkAndAlert(condPorta, 'PORTA', `PORTA ABERTA: O equipamento "${eq[0].nome}" está com a porta violada!`);

        const condMecanica = (!isMotorLigado && !isEmDegelo && alerta_forcado !== 'REDE' && t >= (tMax + 10.0));
        await checkAndAlert(condMecanica, 'MECANICA', `MOTOR PARADO: O compressor de "${eq[0].nome}" falhou e a temperatura subiu!`);

        const condTemp = ((t > tMax || t < tMin) && !isEmDegelo);
        await checkAndAlert(condTemp, 'TEMPERATURA', `ALERTA TÉRMICO: "${eq[0].nome}" fora da faixa configurada (${t}°C).`);

        if (u !== null && (uMax > 0 || uMin > 0)) {
          /**
           * Concentra a logica de cond umi para manter o restante do rota/API mais legivel.
           *
           * Responsabilidade: mantém este comportamento isolado para que validação,
           * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
           *
           * Fluxo principal:
           * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
           *
           * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
           *
           * @param {string|number} equipamento_id - Identificador do registro ou recurso processado.
           * @param {unknown} verificarToken - Valor de verificar token consumido por esta rotina.
           * @param {import("express").Response} res - Resposta HTTP usada para devolver o resultado ao cliente.
           * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
           * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
           */
          const condUmi = ((u > uMax || u < uMin) && !isEmDegelo);
          await checkAndAlert(condUmi, 'UMIDADE', `ALERTA HIGROMÉTRICO: Umidade de "${eq[0].nome}" fora dos limites permitidos (${u}%).`);
        }

        if (novosAlertas.length > 0) { io.emit('atualizacao_dados'); novosAlertas.forEach(a => io.emit('novo_alerta', a)); }
        io.emit('nova_leitura', { id: r.insertId, equipamento_id, temperatura: t, umidade: u, consumo_kwh: c_kwh, motor_ligado: isMotorLigado, em_degelo: isEmDegelo, ultima_comunicacao: new Date(), status_conexao: 'online', data_hora: new Date(), nome: eq[0].nome, setor: eq[0].setor, filial: eq[0].filial, empresa: eq[0].empresa });
      }
      res.status(201).send();
    } catch (error) { res.status(500).send(); }
  });


  /**
   * Endpoint POST /api/simulador/executar.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/simulador/executar
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/simulador/executar', verificarToken, requireRoles('DEV'), async (req, res) => {
    const cenarios = {
      NORMAL: { tipoAlerta: null, mensagem: null, motorLigado: true, emDegelo: false, acaoHardware: 'LIGAR', estadoHardware: 1 },
      TEMPERATURA: { tipoAlerta: 'TEMPERATURA', mensagem: 'Temperatura simulada fora da faixa operacional.', motorLigado: true, emDegelo: false, acaoHardware: null },
      UMIDADE: { tipoAlerta: 'UMIDADE', mensagem: 'Umidade simulada fora da faixa operacional.', motorLigado: true, emDegelo: false, acaoHardware: null },
      PORTA_ABERTA: { tipoAlerta: 'PORTA', mensagem: 'Abertura de porta simulada pelo laboratorio DEV.', motorLigado: true, emDegelo: false, acaoHardware: null },
      MECANICA: { tipoAlerta: 'MECANICA', mensagem: 'Parada de compressor simulada pelo laboratorio DEV.', motorLigado: false, emDegelo: false, acaoHardware: 'DESLIGAR', estadoHardware: 0 },
      DEGELO: { tipoAlerta: null, mensagem: null, motorLigado: false, emDegelo: true, acaoHardware: 'DEGELO', estadoHardware: 1 },
      REDE: { tipoAlerta: 'REDE', mensagem: 'Indisponibilidade de rede simulada pelo laboratorio DEV.', motorLigado: true, emDegelo: false, acaoHardware: 'REBOOT', estadoHardware: 1 }
    };

    try {
      const scenario = normalizeCredential(req.body.scenario, 40).toUpperCase();
      const config = cenarios[scenario];
      const temperatura = Number(req.body.temperature);
      const umidade = Number(req.body.humidity);
      const consumo = Number(req.body.consumption ?? 0.85);
      const enviarHardware = req.body.sendHardware === true;
      const ids = [...new Set((Array.isArray(req.body.equipmentIds) ? req.body.equipmentIds : [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0))].slice(0, 250);

      if (!config) return res.status(400).json({ error: 'Cenario de simulacao invalido.' });
      if (ids.length === 0) return res.status(400).json({ error: 'Selecione ao menos um equipamento.' });
      validarTelemetria({ equipamento_id: ids[0], temperatura, umidade, consumo_kwh: consumo });

      const placeholders = ids.map(() => '?').join(',');
      const [equipamentosAlvo] = await pool.execute(
        `SELECT id, nome, setor, filial, empresa FROM equipamentos WHERE id IN (${placeholders})`,
        ids
      );
      const equipamentosPorId = new Map(equipamentosAlvo.map((item) => [Number(item.id), item]));
      const resultados = [];

      for (const id of ids) {
        const equipamento = equipamentosPorId.get(id);
        if (!equipamento) {
          resultados.push({ id, success: false, error: 'Equipamento nao encontrado.' });
          continue;
        }

        try {
          const [leitura] = await pool.execute(
            'INSERT INTO leituras (equipamento_id, temperatura, umidade, consumo_kwh) VALUES (?, ?, ?, ?)',
            [id, temperatura, umidade, consumo]
          );
          await pool.execute(
            'UPDATE equipamentos SET motor_ligado = ?, em_degelo = ? WHERE id = ?',
            [config.motorLigado, config.emDegelo, id]
          );

          let alertaCriado = false;
          if (scenario === 'NORMAL') {
            await pool.execute(
              'UPDATE notificacoes SET resolvido = 1, nota_resolucao = ? WHERE equipamento_id = ? AND (resolvido = 0 OR resolvido IS NULL)',
              ['Normalizado pelo simulador DEV.', id]
            );
          } else if (config.tipoAlerta) {
            const [alertasAtivos] = await pool.execute(
              'SELECT id FROM notificacoes WHERE equipamento_id = ? AND tipo_alerta = ? AND (resolvido = 0 OR resolvido IS NULL) LIMIT 1',
              [id, config.tipoAlerta]
            );
            if (alertasAtivos.length === 0) {
              const mensagem = `${config.mensagem} Equipamento: ${equipamento.nome}.`;
              const [alerta] = await pool.execute(
                'INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta, resolvido) VALUES (?, ?, ?, 0)',
                [id, mensagem, config.tipoAlerta]
              );
              alertaCriado = true;
              io.emit('novo_alerta', { id: alerta.insertId, equipamento_id: id, mensagem, tipo_alerta: config.tipoAlerta });
            }
          }

          let hardware = 'ignorado';
          if (enviarHardware && config.acaoHardware) {
            try {
              await publicarComandoSimulador(id, config.acaoHardware, config.estadoHardware);
              hardware = 'enviado';
            } catch (mqttError) {
              hardware = 'falhou';
            }
          } else if (enviarHardware) {
            hardware = 'nao_aplicavel';
          }

          const evento = {
            id: leitura.insertId,
            equipamento_id: id,
            temperatura,
            umidade,
            consumo_kwh: consumo,
            motor_ligado: config.motorLigado,
            em_degelo: config.emDegelo,
            ultima_comunicacao: new Date(),
            status_conexao: scenario === 'REDE' ? 'instavel' : 'online',
            data_hora: new Date(),
            nome: equipamento.nome,
            setor: equipamento.setor,
            filial: equipamento.filial,
            empresa: equipamento.empresa,
            origem: 'simulador_dev'
          };
          io.emit('nova_leitura', evento);
          resultados.push({ id, name: equipamento.nome, success: hardware !== 'falhou', readingId: leitura.insertId, alertCreated: alertaCriado, hardware });
        } catch (targetError) {
          resultados.push({ id, name: equipamento.nome, success: false, error: targetError.message });
        }
      }

      const sucessos = resultados.filter((item) => item.success).length;
      const falhas = resultados.length - sucessos;
      await registrarAuditoria(
        scenario === 'NORMAL' ? 'SIMULATOR_RECOVERY' : 'SIMULATOR_RUN',
        'Root/Dev',
        `${scenario}: ${sucessos}/${resultados.length} alvo(s), hardware=${enviarHardware ? 'sim' : 'nao'}`,
        falhas > 0 ? 'warning' : 'info'
      );
      io.emit('atualizacao_dados', { tipo: 'simulador', scenario, equipmentIds: ids });
      res.status(falhas === resultados.length ? 502 : 200).json({ success: falhas === 0, scenario, totals: { requested: ids.length, success: sucessos, failed: falhas }, results: resultados });
    } catch (error) {
      const status = /invalido|fora da faixa/i.test(error.message) ? 400 : 500;
      res.status(status).json({ error: error.message || 'Falha ao executar a simulacao.' });
    }
  });


  /**
   * Endpoint GET /api/notificacoes.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/notificacoes
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/notificacoes', verificarToken, async (req, res) => {
    try {
      // O painel precisa do estado atual de cada anomalia, não de todas as
      // repetições históricas ainda abertas. A deduplicação evita transferir e
      // renderizar dezenas de milhares de registros em instalações antigas.
      let q = `
        SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial
        FROM notificacoes n
        JOIN (
          SELECT MAX(id) AS id
          FROM notificacoes
          WHERE (resolvido = 0 OR resolvido IS NULL)
          GROUP BY equipamento_id, tipo_alerta
        ) alerta_atual ON alerta_atual.id = n.id
        JOIN equipamentos e ON n.equipamento_id = e.id
        WHERE 1=1
      `;
      const p = [];
      if (req.userRole !== 'DEV') {
        q += ' AND e.empresa = ?';
        p.push(req.userEmpresa);
      }
      if (req.userRole === 'LOJA') {
        q += ' AND e.filial = ?';
        p.push(req.userFilial);
      }
      const [r] = await pool.execute(`${q} ORDER BY n.data_hora DESC LIMIT 1000`, p);
      res.json(r);
    } catch (error) {
      console.error('[NOTIFICACOES] Falha ao listar alertas ativos:', error.message);
      res.status(500).json({ error: 'Erro ao carregar notificações.', requestId: req.security?.requestId });
    }
  });

  /**
   * Endpoint GET /api/notificacoes/historico.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/notificacoes/historico
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/notificacoes/historico', verificarToken, async (req, res) => { try { let q = `SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE n.resolvido = 1`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } if (req.userRole === 'LOJA') { q += ` AND e.filial = ?`; p.push(req.userFilial); } const [r] = await pool.execute(q + ' ORDER BY n.data_hora DESC LIMIT 150', p); res.json(r); } catch (e) { res.status(500).send(); } });

  /**
   * Endpoint PUT /api/notificacoes/:id/resolver.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/notificacoes/:id/resolver
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/notificacoes/:id/resolver', verificarToken, async (req, res) => {
    try {
      let targetQuery = 'SELECT n.equipamento_id, n.tipo_alerta FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE n.id = ?';
      const targetParams = [req.params.id];
      if (req.userRole !== 'DEV') {
        targetQuery += ' AND e.empresa = ?';
        targetParams.push(req.userEmpresa);
        if (req.userRole === 'LOJA') {
          targetQuery += ' AND e.filial = ?';
          targetParams.push(req.userFilial);
        }
      }

      const [targets] = await pool.execute(targetQuery, targetParams);
      if (targets.length === 0) return res.status(404).json({ error: 'Notificação não encontrada ou sem permissão.' });

      const target = targets[0];
      await pool.execute(
        'UPDATE notificacoes SET resolvido=1, nota_resolucao=? WHERE equipamento_id=? AND tipo_alerta=? AND (resolvido=0 OR resolvido IS NULL)',
        [req.body.nota_resolucao || 'Resolvido pelo operador.', target.equipamento_id, target.tipo_alerta]
      );

      io.emit('alerta_removido', { equipamento_id: target.equipamento_id, tipo_alerta: target.tipo_alerta });
      io.emit('atualizacao_dados');
      res.status(200).send();
    } catch (error) {
      res.status(500).send();
    }
  });

  /**
   * Endpoint PUT /api/notificacoes/resolver-todas.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/notificacoes/resolver-todas
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/notificacoes/resolver-todas', verificarToken, async (req, res) => { try { let q = 'UPDATE notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id SET n.resolvido=1, n.nota_resolucao="Limpeza em Lote" WHERE (n.resolvido=0 OR n.resolvido IS NULL)'; let p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } } await pool.execute(q, p); io.emit('alertas_limpos'); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });


  /**
   * Endpoint GET /api/chamados.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/chamados
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/chamados', verificarToken, async (req, res) => {
    try {
      const isHistorico = req.query.historico === '1';
      const limit = req.query.all === '1' ? 5000 : clampNumber(req.query.limit, isHistorico ? 500 : 250, 50, 2000);
      let q = `
        SELECT c.*, e.nome as equipamento_nome, e.filial as equipamento_filial, u.usuario as aberto_por
        FROM chamados c
        LEFT JOIN equipamentos e ON c.equipamento_id = e.id
        LEFT JOIN usuarios u ON c.usuario_id = u.id
        WHERE 1=1
      `;
      const p = [];
      if (req.userRole !== 'DEV') {
        q += ' AND c.empresa = ?';
        p.push(req.userEmpresa);
        if (req.userRole === 'LOJA') {
          q += ' AND (c.filial = ? OR (c.filial IS NULL AND e.filial = ?))';
          p.push(req.userFilial, req.userFilial);
        }
      }
      if (isHistorico) {
        q += ' AND (LOWER(c.status) LIKE "%conclu%" OR LOWER(c.status) LIKE "%fechad%" OR c.arquivado = 1)';
        q += ' ORDER BY COALESCE(c.data_conclusao, c.data_abertura) DESC LIMIT ?';
      } else {
        q += ' ORDER BY c.data_abertura DESC LIMIT ?';
      }
      p.push(limit);
      const [r] = await pool.execute(q, p);
      res.json(r);
    } catch (error) {
      console.error('[CHAMADOS] Falha ao listar chamados:', error.message);
      res.status(500).json({ error: 'Erro ao carregar chamados.', requestId: req.security?.requestId });
    }
  });

  /**
   * Endpoint POST /api/chamados.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/chamados
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/chamados', verificarToken, async (req, res) => {
    try {
      const { equipamento_id, descricao, solicitante_nome, tecnico_responsavel, urgencia } = req.body;
      let filialStr = req.userFilial;
      let empresaStr = req.userEmpresa;

      if (equipamento_id) {
        let equipmentQuery = 'SELECT filial, empresa FROM equipamentos WHERE id = ?';
        const equipmentParams = [equipamento_id];
        if (req.userRole !== 'DEV') {
          equipmentQuery += ' AND empresa = ?';
          equipmentParams.push(req.userEmpresa);
        }
        if (req.userRole === 'LOJA') {
          equipmentQuery += ' AND filial = ?';
          equipmentParams.push(req.userFilial);
        }
        const [equipmentRows] = await pool.execute(equipmentQuery, equipmentParams);
        if (equipmentRows.length === 0) {
          return res.status(404).json({ error: 'Equipamento não encontrado ou sem permissão.' });
        }
        filialStr = equipmentRows[0].filial || filialStr;
        empresaStr = equipmentRows[0].empresa || empresaStr;
      }

      const tecnicoPermitido = req.userRole === 'LOJA' ? null : (tecnico_responsavel || null);
      await pool.execute(
        `INSERT INTO chamados (equipamento_id, usuario_id, filial, descricao, solicitante_nome, tecnico_responsavel, empresa, urgencia, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aberto')`,
        [equipamento_id || null, req.userId, filialStr, descricao, solicitante_nome || null, tecnicoPermitido, empresaStr, urgencia || 'Pendente']
      );
      io.emit('atualizacao_dados');
      res.status(201).send();
    } catch (error) {
      res.status(500).send();
    }
  });

  /**
   * Endpoint PUT /api/chamados/:id/status.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/chamados/:id/status
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/chamados/:id/status', verificarToken, requireRoles('MANUTENCAO', 'ADMIN', 'DEV'), async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) return res.status(400).json({ error: 'Status ausente.' });

      let query = 'UPDATE chamados SET status = ?';
      let params = [status];
      query += status === 'Concluído' ? ', data_conclusao = CURRENT_TIMESTAMP' : ', data_conclusao = NULL';
      query += ' WHERE id = ?';
      params.push(req.params.id);
      ({ query, params } = aplicarEscopoChamado(req, query, params));

      const [result] = await pool.execute(query, params);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão.' });

      io.emit('atualizacao_dados');
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Falha no banco.' });
    }
  });


  /**
   * Endpoint DELETE /api/chamados/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route DELETE /api/chamados/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.delete('/api/chamados/:id', verificarToken, async (req, res) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send();
    try {
      let query = 'DELETE FROM chamados WHERE id=?';
      let params = [req.params.id];
      ({ query, params } = aplicarEscopoChamado(req, query, params));
      const [result] = await pool.execute(query, params);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão.' });
      io.emit('atualizacao_dados');
      res.status(200).send();
    } catch (error) {
      res.status(500).send();
    }
  });


  /**
   * Endpoint PUT /api/chamados/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/chamados/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/chamados/:id', verificarToken, requireRoles('MANUTENCAO', 'ADMIN', 'DEV'), async (req, res) => {
    try {
      let selectQuery = 'SELECT * FROM chamados WHERE id=?';
      let selectParams = [req.params.id];
      ({ query: selectQuery, params: selectParams } = aplicarEscopoChamado(req, selectQuery, selectParams));
      const [atual] = await pool.execute(selectQuery, selectParams);
      if (atual.length === 0) return res.status(404).send();

      const chamado = atual[0];
      const novoStatus = req.body.status !== undefined ? req.body.status : chamado.status;
      let query = 'UPDATE chamados SET status=?, nota_resolucao=?, arquivado=?, urgencia=?, tecnico_responsavel=?';
      let params = [
        novoStatus,
        req.body.nota_resolucao !== undefined ? req.body.nota_resolucao : chamado.nota_resolucao,
        req.body.arquivado !== undefined ? (req.body.arquivado ? 1 : 0) : chamado.arquivado,
        req.body.urgencia !== undefined ? req.body.urgencia : chamado.urgencia,
        req.body.tecnico_responsavel !== undefined ? req.body.tecnico_responsavel : chamado.tecnico_responsavel
      ];
      if (novoStatus === 'Concluído' && chamado.status !== 'Concluído') query += ', data_conclusao=CURRENT_TIMESTAMP';
      query += ' WHERE id=?';
      params.push(req.params.id);
      ({ query, params } = aplicarEscopoChamado(req, query, params));

      await pool.execute(query, params);
      io.emit('atualizacao_dados');
      res.status(200).send();
    } catch (error) {
      res.status(500).send();
    }
  });


  /**
   * Endpoint PUT /api/chamados/:id/arquivar.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/chamados/:id/arquivar
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/chamados/:id/arquivar', verificarToken, requireRoles('MANUTENCAO', 'ADMIN', 'DEV'), async (req, res) => {
    try {
      let query = 'UPDATE chamados SET arquivado=1, data_conclusao=CURRENT_TIMESTAMP WHERE id=?';
      let params = [req.params.id];
      ({ query, params } = aplicarEscopoChamado(req, query, params));
      const [result] = await pool.execute(query, params);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão.' });
      io.emit('atualizacao_dados');
      res.status(200).send();
    } catch (error) {
      res.status(500).send();
    }
  });


  /**
   * Endpoint GET /api/chamados/:id/comentarios.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/chamados/:id/comentarios
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/chamados/:id/comentarios', verificarToken, async (req, res) => {
    try {
      let selectQuery = 'SELECT id FROM chamados WHERE id=?';
      let selectParams = [req.params.id];
      ({ query: selectQuery, params: selectParams } = aplicarEscopoChamado(req, selectQuery, selectParams));
      const [chamadoRows] = await pool.execute(selectQuery, selectParams);
      if (chamadoRows.length === 0) return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão.' });

      const [rows] = await pool.execute(
        'SELECT id, chamado_id, autor, papel, tipo, mensagem, anexo_url, criado_em FROM chamados_comentarios WHERE chamado_id = ? ORDER BY criado_em ASC, id ASC',
        [req.params.id]
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Falha ao carregar comentários.' });
    }
  });


  /**
   * Endpoint POST /api/chamados/:id/comentarios.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/chamados/:id/comentarios
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/chamados/:id/comentarios', verificarToken, async (req, res) => {
    const mensagem = normalizeCredential(req.body.mensagem, 2000);
    const anexoUrl = normalizeCredential(req.body.anexo_url, 500);
    const tipo = anexoUrl ? 'ANEXO' : 'COMENTARIO';
    if (!mensagem && !anexoUrl) return res.status(400).json({ error: 'Informe comentário ou anexo.' });

    try {
      let selectQuery = 'SELECT id FROM chamados WHERE id=?';
      let selectParams = [req.params.id];
      ({ query: selectQuery, params: selectParams } = aplicarEscopoChamado(req, selectQuery, selectParams));
      const [chamadoRows] = await pool.execute(selectQuery, selectParams);
      if (chamadoRows.length === 0) return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão.' });

      const autor = req.userName || req.userUsuario || `Usuário ${req.userId}`;
      await pool.execute(
        'INSERT INTO chamados_comentarios (chamado_id, autor, papel, tipo, mensagem, anexo_url) VALUES (?, ?, ?, ?, ?, ?)',
        [req.params.id, autor, req.userRole, tipo, mensagem || 'Anexo vinculado ao chamado.', anexoUrl || null]
      );
      await registrarAuditoria(tipo === 'ANEXO' ? 'CHAMADO_ANEXO' : 'CHAMADO_COMENTARIO', autor, `OS-${req.params.id}`, 'info');
      io.emit('atualizacao_dados');
      res.status(201).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao registrar comentário.' });
    }
  });


  /**
   * Endpoint POST /api/chamados/:id/anexos.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/chamados/:id/anexos
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/chamados/:id/anexos', verificarToken, processarUploadChamadoAnexo, async (req, res) => {
    const mensagem = normalizeCredential(req.body.mensagem, 1000) || 'Anexo enviado pelo usuário.';
    if (!req.file) return res.status(400).json({ error: 'Envie um arquivo válido para anexar à OS.' });

    try {
      let selectQuery = 'SELECT id FROM chamados WHERE id=?';
      let selectParams = [req.params.id];
      ({ query: selectQuery, params: selectParams } = aplicarEscopoChamado(req, selectQuery, selectParams));
      const [chamadoRows] = await pool.execute(selectQuery, selectParams);
      if (chamadoRows.length === 0) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão.' });
      }

      const autor = req.userName || req.userUsuario || `Usuário ${req.userId}`;
      const anexoUrl = `/uploads/chamados/${req.file.filename}`;
      await pool.execute(
        'INSERT INTO chamados_comentarios (chamado_id, autor, papel, tipo, mensagem, anexo_url) VALUES (?, ?, ?, "ANEXO", ?, ?)',
        [req.params.id, autor, req.userRole, mensagem, anexoUrl]
      );
      await registrarAuditoria('CHAMADO_ANEXO_UPLOAD', autor, `OS-${req.params.id}: ${req.file.originalname}`, 'info');
      io.emit('atualizacao_dados');
      res.status(201).json({ success: true, anexo_url: anexoUrl });
    } catch (error) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: 'Falha ao enviar anexo.' });
    }
  });


  /**
   * Endpoint PUT /api/chamados/:id/reabrir.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/chamados/:id/reabrir
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/chamados/:id/reabrir', verificarToken, async (req, res) => {
    const motivo = normalizeCredential(req.body.motivo, 1000);
    if (!motivo) return res.status(400).json({ error: 'Informe o motivo da reabertura.' });

    try {
      let query = 'UPDATE chamados SET status = "Aberto", arquivado = 0, data_conclusao = NULL WHERE id=?';
      let params = [req.params.id];
      ({ query, params } = aplicarEscopoChamado(req, query, params));
      const [result] = await pool.execute(query, params);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão.' });

      const autor = req.userName || req.userUsuario || `Usuário ${req.userId}`;
      await pool.execute(
        'INSERT INTO chamados_comentarios (chamado_id, autor, papel, tipo, mensagem) VALUES (?, ?, ?, "REABERTURA", ?)',
        [req.params.id, autor, req.userRole, motivo]
      );
      await registrarAuditoria('CHAMADO_REABERTO', autor, `OS-${req.params.id}: ${motivo}`, 'warning');
      io.emit('atualizacao_dados');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao reabrir chamado.' });
    }
  });


  /**
   * Endpoint PUT /api/chamados/:id/urgencia.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/chamados/:id/urgencia
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/chamados/:id/urgencia', verificarToken, requireRoles('MANUTENCAO', 'ADMIN', 'DEV'), async (req, res) => {
    try {
      let query = 'UPDATE chamados SET urgencia=? WHERE id=?';
      let params = [req.body.urgencia, req.params.id];
      ({ query, params } = aplicarEscopoChamado(req, query, params));
      const [result] = await pool.execute(query, params);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão.' });
      io.emit('atualizacao_dados');
      res.status(200).send();
    } catch (error) {
      res.status(500).send();
    }
  });


  /**
   * Endpoint GET /api/suporte/artigos.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/suporte/artigos
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/suporte/artigos', verificarToken, async (req, res) => { try { const isDev = req.userRole === 'DEV'; const publico = isDev ? [] : ['USUARIO', 'AMBOS']; let query = 'SELECT * FROM suporte_artigos WHERE ativo = TRUE'; const params = []; if (!isDev) { query += ' AND publico IN (?, ?)'; params.push(publico[0], publico[1]); } const [rows] = await pool.execute(query + ' ORDER BY destaque DESC, updated_at DESC, titulo ASC', params); res.json(rows); } catch (error) { res.status(500).json({ error: 'Falha.' }); } });

  /**
   * Endpoint GET /api/suporte/chamados.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/suporte/chamados
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/suporte/chamados', verificarToken, async (req, res) => { try { let query = 'SELECT * FROM suporte_chamados WHERE 1=1'; const params = []; if (req.userRole !== 'DEV') { query += ' AND empresa = ?'; params.push(req.userEmpresa); if (req.userRole === 'LOJA') { query += ' AND filial = ?'; params.push(req.userFilial); } } const [rows] = await pool.execute(query + ' ORDER BY criado_em DESC', params); res.json(rows); } catch (error) { res.status(500).json({ error: 'Falha.' }); } });

  /**
   * Endpoint POST /api/suporte/chamados.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/suporte/chamados
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/suporte/chamados', verificarToken, async (req, res) => { try { const { titulo, descricao, categoria, prioridade, solicitante, email } = req.body; if (!titulo || !descricao || !solicitante) return res.status(400).json({ error: 'Campos obrigatórios.' }); const [result] = await pool.execute('INSERT INTO suporte_chamados (titulo, descricao, categoria, prioridade, origem, solicitante, email, empresa, filial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [titulo, descricao, categoria || 'Geral', prioridade || 'Média', req.userRole === 'DEV' ? 'DEV' : 'USUARIO', solicitante, email || null, req.userEmpresa || null, req.userFilial || null]); try { await pool.execute('INSERT INTO suporte_chamado_historico (chamado_id, evento, autor, papel, status_anterior, status_novo, mensagem) VALUES (?, ?, ?, ?, ?, ?, ?)', [result.insertId, 'ABERTURA', solicitante, req.userRole || 'USUARIO', null, 'Aberto', descricao]); } catch (errHist) { console.error('⚠️ [AVISO] Falha na auditoria inicial de suporte:', errHist.message); } const novoTicketPayload = { id: result.insertId, titulo, descricao, categoria: categoria || 'Geral', prioridade: prioridade || 'Média', solicitante, empresa: req.userEmpresa || null, filial: req.userFilial || null, criado_em: new Date().toISOString(), status: 'Aberto' }; if (io) { io.emit('novo_chamado_suporte', novoTicketPayload); io.emit('atualizacao_dados'); } res.status(201).json({ success: true, id: result.insertId }); } catch (error) { res.status(500).json({ error: 'Falha ao abrir chamado de suporte.' }); } });

  /**
   * Endpoint PUT /api/suporte/chamados/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/suporte/chamados/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/suporte/chamados/:id', verificarToken, requireRoles('DEV'), async (req, res) => { try { const { status, resposta, responsavel } = req.body; const [atual] = await pool.execute('SELECT * FROM suporte_chamados WHERE id = ?', [req.params.id]); if (atual.length === 0) return res.status(404).json({ error: 'Não encontrado.' }); const chamadoAtual = atual[0]; let novoStatus = status || chamadoAtual.status || 'Concluído'; if (resposta && (novoStatus === 'Aberto' || novoStatus === 'Em análise')) { novoStatus = 'Respondido'; } if (novoStatus === 'Resolvido' || novoStatus === 'Fechado') novoStatus = 'Concluído'; if (novoStatus === 'Em Atendimento') novoStatus = 'Em análise'; const novaResposta = (resposta !== undefined && resposta !== '') ? resposta : (chamadoAtual.resposta || null); const novoResponsavel = responsavel || chamadoAtual.responsavel || 'Suporte NOC (DEV)'; await pool.execute('UPDATE suporte_chamados SET status = ?, resposta = ?, responsavel = ? WHERE id = ?', [novoStatus, novaResposta, novoResponsavel, req.params.id]); try { if ((resposta !== undefined && resposta !== chamadoAtual.resposta) || novoStatus !== chamadoAtual.status) { await pool.execute('INSERT INTO suporte_chamado_historico (chamado_id, evento, autor, papel, status_anterior, status_novo, mensagem) VALUES (?, ?, ?, ?, ?, ?, ?)', [req.params.id, resposta !== undefined ? 'RESPOSTA' : 'ATUALIZACAO_STATUS', novoResponsavel, req.userRole || 'DEV', chamadoAtual.status || 'Aberto', novoStatus, resposta !== undefined ? resposta : `Status alterado para ${novoStatus}`]); } } catch (errHist) { console.error('⚠️ [AVISO] Falha ao registrar auditoria de suporte:', errHist.message); } if (io) { io.emit('resposta_suporte', { id: req.params.id, titulo: chamadoAtual.titulo, resposta: novaResposta, status: novoStatus, responsavel: novoResponsavel, empresa: chamadoAtual.empresa, filial: chamadoAtual.filial }); io.emit('atualizacao_dados'); } res.status(200).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Falha ao atualizar chamado de suporte.' }); } });

  /**
   * Endpoint GET /api/suporte/chamados/:id/historico.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/suporte/chamados/:id/historico
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/suporte/chamados/:id/historico', verificarToken, async (req, res) => { try { const [ticket] = await pool.execute('SELECT id, empresa, filial, solicitante FROM suporte_chamados WHERE id = ?', [req.params.id]); if (ticket.length === 0) return res.status(404).json({ error: 'Não encontrado.' }); if (req.userRole !== 'DEV') { const permitidoEmpresa = ticket[0].empresa === req.userEmpresa; const permitidoFilial = req.userRole !== 'LOJA' || ticket[0].filial === req.userFilial; if (!permitidoEmpresa || !permitidoFilial) return res.status(403).json({ error: 'Acesso negado.' }); } const [historico] = await pool.execute('SELECT * FROM suporte_chamado_historico WHERE chamado_id = ? ORDER BY criado_em ASC, id ASC', [req.params.id]); res.json(historico); } catch (error) { res.status(500).json({ error: 'Falha.' }); } });

  /**
   * Endpoint GET /api/relatorios.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/relatorios
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/relatorios', verificarToken, async (req, res) => { let q = `SELECT l.id, l.equipamento_id, l.temperatura, l.umidade, l.consumo_kwh, l.data_hora, e.nome, e.setor, e.filial FROM leituras l JOIN equipamentos e ON l.equipamento_id = e.id WHERE 1=1`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } if (req.query.data_inicio && req.query.data_fim) { q += ' AND l.data_hora BETWEEN ? AND ?'; p.push(new Date(req.query.data_inicio), new Date(req.query.data_fim)); } else { q += ' AND l.data_hora >= DATE_SUB(NOW(), INTERVAL 6 HOUR)'; } const [r] = await pool.execute(q + ' ORDER BY l.data_hora ASC LIMIT 3000', p); res.json(r); });


  /**
   * Endpoint GET /api/operacao/resumo.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/operacao/resumo
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/operacao/resumo', verificarToken, async (req, res) => {
    const filialFiltro = req.query.filial || req.userFilial || 'Todas';
    const empresaFiltro = req.userEmpresa || 'Cliente Alpha (Padrão)';

    try {
      const filtros = ['e.empresa = ?'];
      const params = [empresaFiltro];
      if (req.userRole === 'LOJA') {
        filtros.push('e.filial = ?');
        params.push(req.userFilial);
      } else if (filialFiltro && filialFiltro !== 'Todas') {
        filtros.push('e.filial = ?');
        params.push(filialFiltro);
      }

      const whereClause = filtros.join(' AND ');
      let equipamentosRows = [];
      let alertasRows = [];
      let chamadosRows = [];
      let alertasAtivos = 0;
      let chamadosAbertos = 0;

      try {
        [equipamentosRows] = await pool.execute(
          `SELECT e.id, e.nome, e.filial, e.motor_ligado, e.em_degelo, e.temp_min, e.temp_max, ultima.temperatura AS ultima_temp, ultima.umidade AS ultima_umidade FROM equipamentos e LEFT JOIN equipamento_ultima_leitura ultima ON ultima.equipamento_id = e.id WHERE ${whereClause}`,
          params
        );
      } catch (e) {
        console.warn('[OPERACAO] Falha ao carregar equipamentos do resumo:', e.message);
      }

      try {
        [alertasRows] = await pool.execute(
          `SELECT n.id, n.mensagem, n.data_hora, e.nome AS equipamento_nome, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE ${whereClause} AND (n.resolvido = 0 OR n.resolvido IS NULL) ORDER BY n.data_hora DESC LIMIT 8`,
          params
        );
        const [alertasCountRows] = await pool.execute(
          `SELECT COUNT(*) AS total FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE ${whereClause} AND (n.resolvido = 0 OR n.resolvido IS NULL)`,
          params
        );
        alertasAtivos = Number(alertasCountRows[0]?.total || 0);
      } catch (e) {
        console.warn('[OPERACAO] Falha ao carregar alertas do resumo:', e.message);
      }

      try {
        [chamadosRows] = await pool.execute(
          `SELECT c.id, c.status, c.urgencia, e.nome AS equipamento_nome FROM chamados c LEFT JOIN equipamentos e ON c.equipamento_id = e.id WHERE ${whereClause} AND c.status <> 'Concluído' AND c.status <> 'Fechado' ORDER BY c.data_abertura DESC LIMIT 8`,
          params
        );
        const [chamadosCountRows] = await pool.execute(
          `SELECT COUNT(*) AS total FROM chamados c LEFT JOIN equipamentos e ON c.equipamento_id = e.id WHERE ${whereClause} AND c.status <> 'Concluído' AND c.status <> 'Fechado'`,
          params
        );
        chamadosAbertos = Number(chamadosCountRows[0]?.total || 0);
      } catch (e) {
        console.warn('[OPERACAO] Falha ao carregar chamados do resumo:', e.message);
      }

      const totalEquipamentos = equipamentosRows.length;
      // Motor parado pode ser apenas repouso do termostato; só é falha quando há sobretemperatura severa.
      const equipamentosFalha = equipamentosRows.filter((eq) => {
        const temperatura = Number(eq.ultima_temp);
        const limiteMaximo = Number(eq.temp_max);
        return !eq.motor_ligado && !eq.em_degelo && Number.isFinite(temperatura) && Number.isFinite(limiteMaximo) && temperatura >= limiteMaximo + 10;
      }).length;
      const equipamentosDegelo = equipamentosRows.filter((eq) => eq.em_degelo).length;
      const temperaturasValidas = equipamentosRows.map((item) => item.ultima_temp).filter((value) => value !== null && value !== '' && Number.isFinite(Number(value))).map(Number);
      const umidadesValidas = equipamentosRows.map((item) => item.ultima_umidade).filter((value) => value !== null && value !== '' && Number.isFinite(Number(value))).map(Number);
      const temperaturaMedia = temperaturasValidas.length ? (temperaturasValidas.reduce((acc, value) => acc + value, 0) / temperaturasValidas.length).toFixed(1) : 0;
      const umidadeMedia = umidadesValidas.length ? (umidadesValidas.reduce((acc, value) => acc + value, 0) / umidadesValidas.length).toFixed(1) : 0;

      res.json({
        total_equipamentos: totalEquipamentos,
        alertas_ativos: alertasAtivos,
        chamados_abertos: chamadosAbertos,
        equipamentos_em_falha: equipamentosFalha,
        equipamentos_em_degelo: equipamentosDegelo,
        temperatura_media: Number(temperaturaMedia),
        umidade_media: Number(umidadeMedia),
        ultimos_alertas: alertasRows,
        ultimos_chamados: chamadosRows,
        filial: filialFiltro,
        atualizada_em: new Date().toISOString()
      });
    } catch (e) {
      console.error('[OPERACAO] Falha geral no resumo:', e.message);
      res.json({
        total_equipamentos: 0,
        alertas_ativos: 0,
        chamados_abertos: 0,
        equipamentos_em_falha: 0,
        equipamentos_em_degelo: 0,
        temperatura_media: 0,
        umidade_media: 0,
        ultimos_alertas: [],
        ultimos_chamados: [],
        filial: filialFiltro,
        atualizada_em: new Date().toISOString()
      });
    }
  });
  /**
   * Garante que uma filial nova tenha suas rotinas iniciais persistidas antes da leitura.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
   *
   * Efeitos colaterais: acessa a camada de persistência
   *
   * @param {unknown} tipo - Valor de tipo consumido por esta rotina.
   * @param {unknown} filial - Valor de filial consumido por esta rotina.
   * @param {unknown} empresa - Valor de empresa consumido por esta rotina.
   * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  async function provisionarTarefasOperacionais(tipo, filial, empresa) {
    const modelos = tipo === 'checklist_turno' ? checklistTurno : tipo === 'plano_dia' ? planoDia : [];
    if (!modelos.length || filial === 'Todas') return;

    const [existentes] = await pool.execute(
      'SELECT COUNT(*) AS total FROM operacao_tarefas WHERE tipo = ? AND filial = ? AND empresa = ?',
      [tipo, filial, empresa]
    );
    if (Number(existentes[0]?.total || 0) > 0) return;

    for (const modelo of modelos) {
      await pool.execute(
        `INSERT INTO operacao_tarefas
          (tipo, chave, titulo, descricao, horario, concluida, ordem, filial, empresa)
         SELECT ?, ?, ?, ?, NULL, FALSE, ?, ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM operacao_tarefas WHERE tipo = ? AND chave = ? AND filial = ? AND empresa = ?
         )`,
        [tipo, modelo.chave, modelo.titulo, modelo.horario || null, modelo.ordem, filial, empresa, tipo, modelo.chave, filial, empresa]
      );
    }
  }

  /** Retorna tarefas reais do tenant; o provisionamento inicial ocorre no servidor e fica no banco. */
  /**
   * Endpoint GET /api/operacao/tarefas.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/operacao/tarefas
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/operacao/tarefas', verificarToken, async (req, res) => {
    try {
      const tipo = req.query.tipo || 'checklist_turno';
      const filial = req.userRole === 'LOJA'
        ? (req.userFilial || 'Matriz')
        : (req.query.filial || req.userFilial || 'Matriz');
      const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)';
      await provisionarTarefasOperacionais(tipo, filial, empresa);

      let sql = 'SELECT * FROM operacao_tarefas WHERE tipo = ? AND empresa = ?';
      const params = [tipo, empresa];
      if (filial && filial !== 'Todas') { sql += ' AND filial = ?'; params.push(filial); }
      sql += ' ORDER BY ordem ASC, created_at ASC';
      const [rows] = await pool.execute(sql, params);
      res.json(rows);
    } catch (error) {
      console.error('[OPERACAO] Erro ao buscar tarefas:', error.message);
      res.status(500).json({ error: 'Erro ao buscar tarefas.' });
    }
  });

  /** Entrega a biblioteca de procedimentos cadastrada no banco. */
  /**
   * Endpoint GET /api/operacao/procedimentos.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/operacao/procedimentos
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/operacao/procedimentos', verificarToken, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, chave, titulo, categoria, severidade, responsavel, sla, icone,
                tipos_alerta, rota, gatilho, objetivo, etapas, evidencias, escalonamento, ordem
         FROM operacao_procedimentos WHERE ativo = TRUE ORDER BY ordem ASC, titulo ASC`
      );

      /**
       * Concentra a logica de as array para manter o restante do rota/API mais legivel.
       *
       * Responsabilidade: mantém este comportamento isolado para que validação,
       * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
       *
       * Fluxo principal:
       * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
       * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
       *
       * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
       *
       * @param {unknown} value - Valor de value consumido por esta rotina.
       * @returns {unknown} Resultado calculado para consumo do chamador.
       * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
       */
      const asArray = (value) => {
        if (Array.isArray(value)) return value;
        try { return JSON.parse(value || '[]'); } catch { return []; }
      };
      res.json(rows.map((row) => ({
        id: row.chave,
        databaseId: row.id,
        title: row.titulo,
        category: row.categoria,
        severity: row.severidade,
        role: row.responsavel,
        sla: row.sla,
        icon: row.icone,
        alertTypes: asArray(row.tipos_alerta),
        route: row.rota,
        trigger: row.gatilho,
        objective: row.objetivo,
        steps: asArray(row.etapas),
        evidence: asArray(row.evidencias),
        escalation: row.escalonamento
      })));
    } catch (error) {
      console.error('[OPERACAO] Erro ao buscar procedimentos:', error.message);
      res.status(500).json({ error: 'Erro ao carregar procedimentos.' });
    }
  });

  /**
   * Endpoint POST /api/operacao/tarefas.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/operacao/tarefas
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/operacao/tarefas', verificarToken, requireRoles('MANUTENCAO', 'ADMIN', 'DEV'), async (req, res) => { try { const { tipo, chave, titulo, descricao, concluida, filial } = req.body; const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)'; if (!chave || !titulo) return res.status(400).json({ error: 'Chave e título são obrigatórios.' }); const sql = `INSERT INTO operacao_tarefas (tipo, chave, titulo, descricao, concluida, filial, empresa) VALUES (?, ?, ?, ?, ?, ?, ?)`; const params = [tipo || 'checklist_turno', chave, titulo, descricao || null, concluida ? 1 : 0, filial || 'Matriz', empresa]; const [result] = await pool.execute(sql, params); await emitirOperacaoAtualizada({ tipo: 'tarefas', empresa, usuario: req.userId }); res.status(201).json({ success: true, id: result.insertId }); } catch (error) { res.status(500).json({ error: 'Erro ao criar tarefa.' }); } });

  /**
   * Endpoint PUT /api/operacao/tarefas/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/operacao/tarefas/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/operacao/tarefas/:id', verificarToken, async (req, res) => { try { const { id } = req.params; const { concluida } = req.body; const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)'; let horario = null; if (concluida) { const dataAtual = new Date(); horario = dataAtual.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }); } let sql = 'UPDATE operacao_tarefas SET concluida = ?, horario = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'; const params = [concluida ? 1 : 0, horario, id]; if (req.userRole !== 'DEV') { sql += ' AND empresa = ?'; params.push(empresa); } if (req.userRole === 'LOJA') { sql += ' AND filial = ?'; params.push(req.userFilial); } const [result] = await pool.execute(sql, params); if (result.affectedRows === 0) return res.status(404).json({ error: 'Tarefa não encontrada ou sem permissão.' }); await emitirOperacaoAtualizada({ tipo: 'tarefas', empresa, usuario: req.userId }); res.status(200).json({ success: true, concluida, horario }); } catch (error) { res.status(500).json({ error: 'Erro ao atualizar.' }); } });

  /**
   * Endpoint DELETE /api/operacao/tarefas/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route DELETE /api/operacao/tarefas/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.delete('/api/operacao/tarefas/:id', verificarToken, requireRoles('MANUTENCAO', 'ADMIN', 'DEV'), async (req, res) => { try { const { id } = req.params; const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)'; let sql = 'DELETE FROM operacao_tarefas WHERE id = ?'; const params = [id]; if (req.userRole !== 'DEV') { sql += ' AND empresa = ?'; params.push(empresa); } const [result] = await pool.execute(sql, params); if (result.affectedRows === 0) return res.status(404).json({ error: 'Não encontrada.' }); await emitirOperacaoAtualizada({ tipo: 'tarefas', empresa, usuario: req.userId }); res.status(200).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Erro ao excluir.' }); } });

  /**
   * Endpoint GET /api/auxiliares/filiais.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/auxiliares/filiais
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/auxiliares/filiais', verificarToken, async (req, res) => {
    try {
      const paramsEmpresa = req.userRole !== 'DEV' ? [req.userEmpresa || 'Cliente Alpha (Padrão)'] : [];
      const filtroEmpresa = req.userRole !== 'DEV' ? ' AND empresa = ?' : '';
      const lojas = await executarConsultaOpcional(
        `SELECT DISTINCT nome AS filial FROM loja WHERE nome IS NOT NULL${filtroEmpresa}`,
        paramsEmpresa,
        'SELECT DISTINCT nome AS filial FROM loja WHERE nome IS NOT NULL'
      );
      const equipamentos = await executarConsultaOpcional(
        `SELECT DISTINCT filial FROM equipamentos WHERE filial IS NOT NULL${filtroEmpresa}`,
        paramsEmpresa,
        'SELECT DISTINCT filial FROM equipamentos WHERE filial IS NOT NULL'
      );
      const filiais = Array.from(new Set([...lojas, ...equipamentos]
        .map((item) => String(item.filial || '').trim())
        .filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));

      res.json(filiais);
    } catch (error) {
      console.error('[AUXILIARES] Erro ao buscar filiais:', error.message);
      res.status(500).json({ error: 'Erro ao carregar filiais.', requestId: req.security?.requestId });
    }
  });

  /**
   * Endpoint GET /api/contatos.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/contatos
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/contatos', verificarToken, async (req, res) => { try { let q = 'SELECT id, usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa FROM usuarios WHERE id != ?'; let p = [req.userId]; if (req.userRole !== 'DEV') { q += ' AND (empresa = ? OR role = "DEV")'; p.push(req.userEmpresa); } const [rows] = await pool.execute(q, p); res.json(rows.map(u => { let nome = u.usuario; let cargo = 'Usuário'; if (u.role === 'DEV') { nome = 'NOC (Desenvolvedor)'; cargo = 'Suporte Master'; } else if (u.role === 'ADMIN') { nome = 'Administração'; cargo = 'Suporte Corporativo'; } else if (u.role === 'MANUTENCAO') { nome = u.nome_tecnico || u.usuario; cargo = 'Técnico Manutenção'; } else if (u.role === 'LOJA') { if (u.nome_gerente) { nome = u.nome_gerente; cargo = `Gerente - ${u.filial}`; } else if (u.nome_coordenador) { nome = u.nome_coordenador; cargo = `Coordenador - ${u.filial}`; } else { nome = `Equipe ${u.filial}`; cargo = 'Operador Loja'; } } return { id: u.id, nome, cargo, role: u.role, filial: u.filial, empresa: u.empresa }; })); } catch (error) { res.status(500).json({ error: error.message }); } });

  /**
   * Endpoint GET /api/tecnicos.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/tecnicos
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/tecnicos', verificarToken, requireRoles('MANUTENCAO', 'ADMIN', 'DEV'), async (req, res) => { try { let q = 'SELECT id, usuario, nome_tecnico, empresa FROM usuarios WHERE role = "MANUTENCAO" AND nome_tecnico IS NOT NULL'; const p = []; if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); } q += ' ORDER BY nome_tecnico ASC'; const [r] = await pool.execute(q, p); res.json(r); } catch (e) { res.status(500).send(); } });

  /**
   * Endpoint GET /api/auxiliares/equipamentos-abertura.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/auxiliares/equipamentos-abertura
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/auxiliares/equipamentos-abertura', verificarToken, async (req, res) => {
    try {
      const paramsEmpresa = req.userRole !== 'DEV' ? [req.userEmpresa || 'Cliente Alpha (Padrão)'] : [];
      let filtroEmpresa = req.userRole !== 'DEV' ? ' AND empresa = ?' : '';
      let fallbackQuery = 'SELECT id, nome, setor, filial, NULL AS empresa FROM equipamentos WHERE 1=1';
      const fallbackParams = [];
      if (req.userRole === 'LOJA') {
        filtroEmpresa += ' AND filial = ?';
        paramsEmpresa.push(req.userFilial);
        fallbackQuery += ' AND filial = ?';
        fallbackParams.push(req.userFilial);
      }
      fallbackQuery += ' ORDER BY filial ASC, setor ASC, nome ASC';
      const equipamentos = await executarConsultaOpcional(
        `SELECT id, nome, setor, filial, empresa FROM equipamentos WHERE 1=1${filtroEmpresa} ORDER BY filial ASC, setor ASC, nome ASC`,
        paramsEmpresa,
        fallbackQuery,
        fallbackParams
      );
      res.json(equipamentos);
    } catch (error) {
      console.error('[AUXILIARES] Erro ao buscar equipamentos para abertura:', error.message);
      res.status(500).json({ error: 'Erro ao carregar equipamentos.', requestId: req.security?.requestId });
    }
  });

  /**
   * Endpoint GET /api/setores.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/setores
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/setores', verificarToken, async (req, res) => { try { const [r] = await pool.execute('SELECT id, nome FROM setores ORDER BY nome ASC'); res.json(r); } catch (e) { res.status(500).send(); } });

  /**
   * Endpoint POST /api/setores.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/setores
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/setores', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('INSERT INTO setores (nome) VALUES (?)', [req.body.nome]); res.status(201).send(); } catch (e) { res.status(500).send(); } });

  /**
   * Endpoint PUT /api/setores/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/setores/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/setores/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('UPDATE setores SET nome=? WHERE id=?', [req.body.nome, req.params.id]); res.status(200).send(); } catch (e) { res.status(500).send(); } });

  /**
   * Endpoint DELETE /api/setores/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route DELETE /api/setores/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.delete('/api/setores/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('DELETE FROM setores WHERE id=?', [req.params.id]); res.status(200).send(); } catch (e) { res.status(500).send(); } });

  /**
   * Endpoint GET /api/tipos-refrigeracao.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/tipos-refrigeracao
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/tipos-refrigeracao', verificarToken, async (req, res) => { try { const [r] = await pool.execute('SELECT * FROM tipos_refrigeracao ORDER BY nome ASC'); res.json(r); } catch (e) { res.status(500).send(); } });

  /**
   * Endpoint POST /api/tipos-refrigeracao.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/tipos-refrigeracao
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/tipos-refrigeracao', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { const { nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo } = req.body; const parseNum = (v) => (v === '' || v === undefined || v === null) ? null : parseFloat(v); await pool.execute('INSERT INTO tipos_refrigeracao (nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo) VALUES (?, ?, ?, ?, ?, ?, ?)', [nome, parseNum(temp_min), parseNum(temp_max), parseNum(umidade_min), parseNum(umidade_max), parseNum(intervalo_degelo) || 6, parseNum(duracao_degelo) || 30]); res.status(201).send(); } catch (e) { res.status(500).send(); } });

  /**
   * Endpoint PUT /api/tipos-refrigeracao/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/tipos-refrigeracao/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/tipos-refrigeracao/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { const { nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo } = req.body; const parseNum = (v) => (v === '' || v === undefined || v === null) ? null : parseFloat(v); await pool.execute('UPDATE tipos_refrigeracao SET nome=?, temp_min=?, temp_max=?, umidade_min=?, umidade_max=?, intervalo_degelo=?, duracao_degelo=? WHERE id=?', [nome, parseNum(temp_min), parseNum(temp_max), parseNum(umidade_min), parseNum(umidade_max), parseNum(intervalo_degelo) || 6, parseNum(duracao_degelo) || 30, req.params.id]); res.status(200).send(); } catch (error) { res.status(500).json({ error: 'Erro ao editar usuário.' }); } });

  /**
   * Endpoint DELETE /api/tipos-refrigeracao/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route DELETE /api/tipos-refrigeracao/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.delete('/api/tipos-refrigeracao/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('DELETE FROM tipos_refrigeracao WHERE id=?', [req.params.id]); res.status(200).send(); } catch (e) { res.status(500).send(); } });


  /**
   * Endpoint GET /api/soc/sessoes.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/soc/sessoes
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/soc/sessoes', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [sessoes] = await pool.execute(
        'SELECT id, usuario_nome as usuario, role, ip_address as ip, localizacao as location, user_agent as userAgent, data_login as loginTime, last_seen as lastSeen, expires_at as expiresAt FROM sessoes_ativas WHERE revogado = FALSE AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY data_login DESC LIMIT 500'
      );
      res.json(sessoes);
    } catch (e) {
      res.status(500).send();
    }
  });


  /**
   * Endpoint POST /api/soc/revogar-todas.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/soc/revogar-todas
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/soc/revogar-todas', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [result] = await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE revogado = FALSE AND usuario_id <> ?', [req.userId]);
      invalidateAllSessionCaches(extrairTokenAutenticacao(req));
      await registrarAuditoria('TOKEN_REVOKED_ALL', 'root_dev', `Sessões revogadas: ${result.affectedRows}`, 'danger');
      await registrarEventoSeguranca({ eventType: 'TOKEN_REVOKED_ALL', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: `Sessões revogadas: ${result.affectedRows}` });
      res.json({ success: true, revoked: result.affectedRows });
    } catch (e) {
      res.status(500).json({ error: 'Falha ao revogar sessões.' });
    }
  });


  /**
   * Endpoint POST /api/soc/revogar/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/soc/revogar/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/soc/revogar/:id', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [sessao] = await pool.execute('SELECT usuario_nome, token FROM sessoes_ativas WHERE id = ?', [req.params.id]);
      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE id = ?', [req.params.id]);
      if (sessao[0]?.token) invalidateSessionCache(sessao[0].token);
      const alvo = sessao.length > 0 ? sessao[0].usuario_nome : 'ID ' + req.params.id;
      await registrarAuditoria('TOKEN_REVOKED', 'root_dev', alvo, 'danger');
      await registrarEventoSeguranca({ eventType: 'TOKEN_REVOKED', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: alvo });
      res.json({ success: true });
    } catch (e) {
      res.status(500).send();
    }
  });


  /**
   * Endpoint GET /api/soc/auditoria.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/soc/auditoria
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/soc/auditoria', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [logs] = await pool.execute('SELECT data_hora, acao as action, ator as actor, alvo as target, severidade as severity FROM audit_logs ORDER BY data_hora DESC LIMIT 100');
      res.json(logs);
    } catch (e) {
      res.status(500).send();
    }
  });


  /**
   * Endpoint GET /api/soc/security-events.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/soc/security-events
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/soc/security-events', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [events] = await pool.execute(
        'SELECT created_at as createdAt, event_type as eventType, actor, ip_address as ip, severity, detail FROM security_events ORDER BY created_at DESC LIMIT 100'
      );
      res.json(events);
    } catch (e) {
      res.status(500).send();
    }
  });

  /** Entrega a visão consolidada usada para triagem e investigação no SOC. */
  /**
   * Endpoint GET /api/soc/overview.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/soc/overview
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/soc/overview', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [timelineResult, topIpsResult, eventTypesResult, roleSessionsResult, auditChainResult] = await Promise.all([
        pool.execute(`
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') AS bucket,
               COUNT(*) AS total,
               SUM(severity = 'danger') AS danger,
               SUM(severity = 'warning') AS warning,
               SUM(severity = 'success') AS success
        FROM security_events
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY bucket
        ORDER BY bucket ASC
      `),
        pool.execute(`
        SELECT COALESCE(NULLIF(ip_address, ''), 'Desconhecido') AS ip, COUNT(*) AS events,
               SUM(severity = 'danger') AS danger
        FROM security_events
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY ip
        ORDER BY danger DESC, events DESC
        LIMIT 8
      `),
        pool.execute(`
        SELECT event_type AS eventType, COUNT(*) AS events
        FROM security_events
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY event_type
        ORDER BY events DESC
        LIMIT 8
      `),
        pool.execute(`
        SELECT role, COUNT(*) AS sessions
        FROM sessoes_ativas
        WHERE revogado = FALSE AND (expires_at IS NULL OR expires_at > NOW())
        GROUP BY role
        ORDER BY sessions DESC
      `),
        pool.execute(`
        SELECT id, event_hash, previous_hash
        FROM audit_logs
        WHERE event_hash IS NOT NULL
        ORDER BY id DESC
        LIMIT 500
      `)
      ]);
      const timeline = timelineResult[0];
      const topIps = topIpsResult[0];
      const eventTypes = eventTypesResult[0];
      const roleSessions = roleSessionsResult[0];
      const auditChain = auditChainResult[0];
      auditChain.reverse();
      let brokenLinks = 0;
      for (let index = 1; index < auditChain.length; index += 1) {
        if (auditChain[index].previous_hash !== auditChain[index - 1].event_hash) {
          brokenLinks += 1;
        }
      }
      res.json({
        timeline: timeline.map((row) => ({ ...row, total: Number(row.total || 0), danger: Number(row.danger || 0), warning: Number(row.warning || 0), success: Number(row.success || 0) })),
        topIps: topIps.map((row) => ({ ...row, events: Number(row.events || 0), danger: Number(row.danger || 0) })),
        eventTypes: eventTypes.map((row) => ({ ...row, events: Number(row.events || 0) })),
        roleSessions: roleSessions.map((row) => ({ ...row, sessions: Number(row.sessions || 0) })),
        auditIntegrity: { ok: brokenLinks === 0, brokenLinks, verifiedRecords: auditChain.length },
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('[SOC] Falha ao consolidar visão de segurança:', error.message);
      res.status(500).json({ error: 'Falha ao consolidar dados do SOC.' });
    }
  });

  /** Bloqueia ou libera uma identidade e encerra suas sessões ao bloquear. */
  /**
   * Endpoint PATCH /api/soc/users/:id/security.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PATCH /api/soc/users/:id/security
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.patch('/api/soc/users/:id/security', verificarToken, requireRoles('DEV'), async (req, res) => {
    const userId = Number(req.params.id);
    const blocked = req.body?.blocked === true;
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Usuário inválido.' });
    if (blocked && userId === Number(req.userId)) return res.status(409).json({ error: 'A sessão atual não pode bloquear a própria conta.' });
    try {
      const [users] = await pool.execute('SELECT usuario FROM usuarios WHERE id = ? LIMIT 1', [userId]);
      if (!users.length) return res.status(404).json({ error: 'Usuário não encontrado.' });
      await pool.execute('UPDATE usuarios SET security_blocked = ? WHERE id = ?', [blocked, userId]);
      let revoked = 0;
      if (blocked) {
        const [result] = await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE usuario_id = ? AND revogado = FALSE', [userId]);
        revoked = Number(result.affectedRows || 0);
        invalidateUserSessions(userId);
      }
      const eventType = blocked ? 'SOC_USER_BLOCKED' : 'SOC_USER_UNBLOCKED';
      await registrarAuditoria(eventType, String(req.userId), users[0].usuario, blocked ? 'danger' : 'warning');
      await registrarEventoSeguranca({ eventType, actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: blocked ? 'danger' : 'warning', detail: `${users[0].usuario}; sessões revogadas=${revoked}` });
      res.json({ success: true, blocked, revoked });
    } catch (error) {
      console.error('[SOC] Falha ao atualizar bloqueio:', error.message);
      res.status(500).json({ error: 'Falha ao atualizar a identidade.' });
    }
  });


  /**
   * Endpoint GET /api/security/status.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/security/status
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/security/status', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [sessionResult, failedResult, mfaResult] = await Promise.all([
        pool.execute('SELECT SUM(revogado = FALSE AND (expires_at IS NULL OR expires_at > NOW())) AS activeSessions, SUM(revogado = TRUE OR (expires_at IS NOT NULL AND expires_at <= NOW())) AS revokedSessions FROM sessoes_ativas'),
        pool.execute('SELECT COUNT(*) AS failedLogins24h FROM security_events WHERE event_type = "LOGIN_FAILED" AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'),
        pool.execute('SELECT COUNT(*) AS usersTotal, SUM(mfa_enabled = TRUE) AS mfaEnabled FROM usuarios')
      ]);
      const sessionRows = sessionResult[0];
      const failedRows = failedResult[0];
      const mfaRows = mfaResult[0];
      const checks = [
        { id: 'jwt_secret', label: 'JWT_SECRET configurado', ok: Boolean(process.env.JWT_SECRET), severity: process.env.NODE_ENV === 'production' ? 'danger' : 'warning' },
        { id: 'cors_origin', label: 'CORS restrito por origem', ok: Boolean(process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*'), severity: 'warning' },
        { id: 'node_env', label: 'NODE_ENV definido', ok: Boolean(process.env.NODE_ENV), severity: 'info' },
        { id: 'raw_sql', label: 'Mutação SQL bruta bloqueada por padrão', ok: process.env.ALLOW_RAW_SQL_MUTATION !== 'true', severity: 'danger' },
        { id: 'smtp_tls', label: 'TLS SMTP validado', ok: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false', severity: 'warning' },
        { id: 'iot_token', label: 'Token de ingestão IoT configurado', ok: Boolean(process.env.IOT_INGEST_TOKEN), severity: process.env.NODE_ENV === 'production' ? 'danger' : 'warning' },
        { id: 'mqtt_auth', label: 'Broker MQTT com autenticação', ok: Boolean(process.env.MQTT_USERNAME && process.env.MQTT_PASSWORD), severity: process.env.NODE_ENV === 'production' ? 'danger' : 'warning' },
        { id: 'mfa_adoption', label: 'MFA disponível para usuários', ok: Number(mfaRows[0]?.mfaEnabled || 0) > 0, severity: 'warning' }
      ];
      res.json({
        ok: checks.every((check) => check.ok || check.severity === 'info'),
        requestId: req.security?.requestId,
        generatedAt: new Date().toISOString(),
        checks,
        metrics: {
          activeSessions: Number(sessionRows[0]?.activeSessions || 0),
          revokedSessions: Number(sessionRows[0]?.revokedSessions || 0),
          failedLogins24h: Number(failedRows[0]?.failedLogins24h || 0),
          usersTotal: Number(mfaRows[0]?.usersTotal || 0),
          mfaEnabled: Number(mfaRows[0]?.mfaEnabled || 0)
        },
        policy: {
          loginRateLimit: Number(process.env.LOGIN_RATE_LIMIT_MAX || 20),
          apiRateLimit: Number(process.env.API_RATE_LIMIT_MAX || 1200),
          jwtExpiresHours: Number(process.env.JWT_EXPIRES_HOURS || 12)
        }
      });
    } catch (e) {
      res.status(500).json({ error: 'Falha ao verificar segurança.' });
    }
  });

  /**
   * Endpoint POST /api/system/reports/log.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/system/reports/log
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/system/reports/log', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { const { tipo, formato, solicitante } = req.body; await pool.execute('INSERT INTO sys_relatorios_log (tipo_relatorio, formato, solicitante) VALUES (?, ?, ?)', [tipo, formato, solicitante]); res.status(201).send(); } catch (e) { res.status(500).send(); } });

  /**
   * Endpoint POST /api/system/purge.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/system/purge
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/system/purge', verificarToken, requireRoles('DEV'), async (req, res) => {
    const dias = Number(req.body.dias);
    const validated = await validarRootPasscode(req.body.passcode);
    if (!validated.ok) return res.status(403).json({ error: 'Passcode root obrigatório.' });
    if (!Number.isInteger(dias) || dias < 1 || dias > 3650) return res.status(400).json({ error: 'Janela de retenção inválida.' });
    try {
      const [resPurge] = await pool.execute(`DELETE FROM leituras WHERE data_hora < DATE_SUB(NOW(), INTERVAL ? DAY)`, [dias]);
      await registrarAuditoria('DB_PURGE', validated.actor, `Limpeza da tabela de leituras (> ${dias} dias)`, 'danger');
      await registrarEventoSeguranca({ eventType: 'DB_PURGE', actor: validated.actor, ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: `dias=${dias}; deleted=${resPurge.affectedRows}` });
      res.json({ deleted: resPurge.affectedRows });
    } catch (e) { res.status(500).send(); }
  });

  /**
   * Endpoint GET /api/system/backup-json.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/system/backup-json
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/system/backup-json', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const { buffer } = await gerarBackupJson({ actor: req.userId });
      await registrarAuditoria('BACKUP_JSON_EXPORT', 'Root/Dev', `Backup JSON gerado (${buffer.length} bytes)`, 'warning');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="termosync-backup-${Date.now()}.zip"`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: 'Falha ao gerar backup.' });
    }
  });

  /** Entrega ao DEV uma fotografia real e autenticada da máquina do backend. */
  /**
   * Endpoint GET /api/system/host-info.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/system/host-info
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/system/host-info', verificarToken, requireRoles('DEV'), async (_req, res) => {
    try {
      const cpus = os.cpus();
      const totalMemMB = Math.round(os.totalmem() / (1024 * 1024));
      const freeMemMB = Math.round(os.freemem() / (1024 * 1024));
      const usedMemMB = Math.max(0, totalMemMB - freeMemMB);
      const platform = os.platform();
      const release = os.release();
      const arch = os.arch();
      const hostname = os.hostname();
      const type = os.type();
      const interfaces = Object.entries(os.networkInterfaces()).flatMap(([name, addresses]) =>
        (addresses || [])
          .filter((address) => address.family === 'IPv4')
          .map((address) => ({ name, address: address.address, family: address.family, mac: address.mac, internal: address.internal }))
      );
      let filesystem = { available: false, path: path.parse(process.cwd()).root };
      try {
        const stats = fs.statfsSync(filesystem.path);
        const totalMB = Math.round((stats.blocks * stats.bsize) / (1024 * 1024));
        const freeMB = Math.round((stats.bavail * stats.bsize) / (1024 * 1024));
        const usedMB = Math.max(0, totalMB - freeMB);
        filesystem = { available: true, path: filesystem.path, totalMB, freeMB, usedMB, usedPercent: totalMB ? Number(((usedMB / totalMB) * 100).toFixed(1)) : 0 };
      } catch (filesystemError) {
        console.warn('[HOST] Espaço em disco indisponível:', filesystemError.message);
      }

      res.json({
        success: true,
        collectedAt: new Date().toISOString(),
        cpu: {
          model: cpus[0]?.model || 'Não informado pelo sistema operacional',
          cores: cpus.length || 1,
          speed: cpus[0]?.speed || 0,
          usedPercent: await sampleCpuUsage(),
          loadAverage: os.loadavg().map((value) => Number(value.toFixed(2)))
        },
        memory: { totalMB: totalMemMB, freeMB: freeMemMB, usedMB: usedMemMB, usedPercent: totalMemMB ? Number(((usedMemMB / totalMemMB) * 100).toFixed(1)) : 0 },
        filesystem,
        network: { interfaces },
        uptimeSeconds: Number(os.uptime().toFixed(0)),
        runtime: {
          nodeVersion: process.version,
          pid: process.pid,
          environment: process.env.NODE_ENV || 'development',
          workingDirectory: process.cwd(),
          memory: Object.fromEntries(Object.entries(process.memoryUsage()).map(([key, value]) => [key, Math.round(value / (1024 * 1024))]))
        },
        os: { platform, release, arch, hostname, type, kernelString: `${type} ${hostname} ${release} ${arch}` }
      });
    } catch (error) {
      console.error('[HOST] Falha ao coletar dados reais:', error.message);
      res.status(500).json({ success: false, error: 'Falha ao coletar dados do host.' });
    }
  });

  /** Consolida o histórico persistido e indicadores da esteira de deploy. */
  /**
   * Endpoint GET /api/system/deployments.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/system/deployments
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/system/deployments', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [deployments] = await pool.execute(`
        SELECT id, version, title, type, target, status, package_name, package_size,
               package_checksum, entry_count, initiated_by, error_message,
               created_at, completed_at,
               TIMESTAMPDIFF(SECOND, created_at, COALESCE(completed_at, NOW())) AS duration_seconds
        FROM system_deployments
        ORDER BY created_at DESC
        LIMIT 100
      `);
      const [summaryRows] = await pool.execute(`
        SELECT COUNT(*) AS total,
               SUM(status = 'SUCCESS') AS successful,
               SUM(status = 'FAILED') AS failed,
               SUM(status = 'PROCESSING') AS processing,
               MAX(completed_at) AS last_completed_at
        FROM system_deployments
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);
      const summary = summaryRows[0] || {};
      res.json({
        deployments,
        capabilities: {
          webDeployEnabled: process.env.NODE_ENV !== 'production' || process.env.ALLOW_WEB_DEPLOY === 'true',
          environment: String(process.env.NODE_ENV || 'development').toUpperCase(),
          requireMfa: process.env.NODE_ENV === 'production' || process.env.REQUIRE_DEPLOY_MFA === 'true',
          confirmationPhrase: `DEPLOY ${String(process.env.NODE_ENV || 'development').toUpperCase()}`
        },
        summary: {
          total: Number(summary.total || 0),
          successful: Number(summary.successful || 0),
          failed: Number(summary.failed || 0),
          processing: Number(summary.processing || 0),
          lastCompletedAt: summary.last_completed_at || null
        }
      });
    } catch (error) {
      console.error('[DEPLOY] Falha ao consultar histórico:', error.message);
      res.status(500).json({ error: 'Falha ao carregar o histórico de deploys.' });
    }
  });


  /**
   * Endpoint POST /api/system/deploy-update.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização e recebimento controlado de arquivo,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/system/deploy-update
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/system/deploy-update', verificarToken, requireRoles('DEV'), rootPasscodeLimiter, requireWebDeployEnabled, upload.single('updatePackage'), async (req, res) => {
    let deploymentId = null;
    try {
      if (req.isImpersonated) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Deploy não pode ser executado durante uma sessão impersonada.' });
      }

      const ambiente = String(process.env.NODE_ENV || 'development').toUpperCase();
      const confirmacaoEsperada = `DEPLOY ${ambiente}`;
      if (String(req.body.confirmation || '').trim().toUpperCase() !== confirmacaoEsperada) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: `Digite "${confirmacaoEsperada}" para confirmar o ambiente.` });
      }

      const exigirMfa = process.env.NODE_ENV === 'production' || process.env.REQUIRE_DEPLOY_MFA === 'true';
      if (exigirMfa) {
        const [[usuarioDeploy]] = await pool.execute('SELECT mfa_enabled FROM usuarios WHERE id = ? AND role = "DEV" LIMIT 1', [req.userId]);
        if (!usuarioDeploy?.mfa_enabled) {
          if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(403).json({ error: 'Ative o MFA da conta DEV antes de executar deploy neste ambiente.' });
        }
      }

      const validated = await validarRootPasscode(req.body.passcode, req.userId);
      if (!validated.ok) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Passcode root obrigatório para deploy.' });
      }
      const file = req.file;
      const { version, title, type, desc, targetType } = req.body;
      if (!file) { return res.status(400).json({ error: 'Nenhum pacote (.zip) foi enviado.' }); }
      const normalizedVersion = normalizeCredential(version, 40);
      const normalizedTitle = normalizeCredential(title, 150);
      const normalizedType = normalizeCredential(type, 30).toLowerCase();
      const normalizedTarget = normalizeCredential(targetType, 30).toUpperCase() || 'AUTO';
      const normalizedDescription = String(desc || '').trim().slice(0, 5000);
      if (!normalizedVersion || !normalizedTitle || !normalizedDescription) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Versão, título e descrição são obrigatórios.' });
      }
      if (!/^[a-z0-9][a-z0-9._-]{0,39}$/i.test(normalizedVersion)) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Formato de versão inválido.' });
      }
      if (!new Set(['FEATURE', 'FIX', 'SECURITY', 'REFACTOR']).has(normalizedType.toUpperCase()) || !new Set(['AUTO', 'FRONTEND', 'BACKEND', 'FULLSTACK']).has(normalizedTarget)) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Categoria ou destino de deploy inválido.' });
      }

      const zip = new AdmZip(file.path);
      const zipEntries = zip.getEntries();
      if (zipEntries.length === 0 || zipEntries.length > 10000) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'O pacote está vazio ou excede 10.000 arquivos.' });
      }
      const maxUncompressedBytes = Number(process.env.UPDATE_PACKAGE_MAX_UNCOMPRESSED_MB || 250) * 1024 * 1024;
      const totalUncompressedBytes = zipEntries.reduce((total, entry) => total + Number(entry.header?.size || 0), 0);
      if (!Number.isFinite(totalUncompressedBytes) || totalUncompressedBytes > maxUncompressedBytes) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(413).json({ error: 'O conteúdo descompactado excede o limite permitido.' });
      }

      const seenEntries = new Set();
      const forbiddenSegments = new Set(['.git', 'node_modules', 'backups', 'uploads', 'tmp']);
      for (const entry of zipEntries) {
        const normalizedName = entry.entryName.replace(/\\/g, '/').replace(/^\.\//, '');
        const comparisonName = normalizedName.toLowerCase();
        const segments = comparisonName.split('/').filter(Boolean);
        if (!normalizedName || normalizedName.includes('\0') || segments.some((segment) => forbiddenSegments.has(segment)) || segments.some((segment) => segment === '.env' || segment.startsWith('.env.'))) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return res.status(400).json({ error: `O pacote contém um caminho proibido: ${entry.entryName}` });
        }
        if (!entry.isDirectory && seenEntries.has(comparisonName)) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return res.status(400).json({ error: `O pacote contém entradas duplicadas: ${entry.entryName}` });
        }
        if (!entry.isDirectory) seenEntries.add(comparisonName);
      }
      let temArquivosFrontend = false; let temArquivosBackend = false;

      zipEntries.forEach((entry) => {
        const name = entry.entryName.toLowerCase();
        if (name.includes('index.html') || name.includes('assets/') || name.endsWith('.css') || name.endsWith('.jsx')) { temArquivosFrontend = true; }
        if (name.includes('app.js') || name.includes('server.js') || name.includes('package.json') || name.includes('routes/')) { temArquivosBackend = true; }
      });

      let destinoFinal = normalizedTarget;
      if (destinoFinal === 'AUTO') {
        if (temArquivosFrontend && !temArquivosBackend) destinoFinal = 'FRONTEND';
        else if (temArquivosBackend && !temArquivosFrontend) destinoFinal = 'BACKEND';
        else destinoFinal = 'FULLSTACK';
      }

      const possuiPastaFrontend = zipEntries.some((entry) => entry.entryName.replace(/\\/g, '/').toLowerCase().startsWith('frontend/'));
      const possuiPastaBackend = zipEntries.some((entry) => entry.entryName.replace(/\\/g, '/').toLowerCase().startsWith('backend/'));
      if (destinoFinal === 'FULLSTACK' && (!possuiPastaFrontend || !possuiPastaBackend)) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Pacotes full-stack devem conter as pastas frontend/ e backend/ na raiz.' });
      }

      const [[deployEmAndamento]] = await pool.execute("SELECT COUNT(*) AS total FROM system_deployments WHERE status = 'PROCESSING' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)");
      if (Number(deployEmAndamento?.total || 0) > 0) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(409).json({ error: 'Já existe um deploy em processamento. Aguarde a conclusão antes de iniciar outro.' });
      }

      const backup = await gerarBackupJson({ actor: `pre-deploy:${validated.actor}`, persistToDisk: true });

      const packageChecksum = crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex');
      const [deploymentResult] = await pool.execute(`
        INSERT INTO system_deployments
          (version, title, type, target, status, package_name, package_size, package_checksum, entry_count, initiated_by)
        VALUES (?, ?, ?, ?, 'PROCESSING', ?, ?, ?, ?, ?)
      `, [normalizedVersion, normalizedTitle, normalizedType, destinoFinal, file.originalname, file.size, packageChecksum, zipEntries.length, validated.actor]);
      deploymentId = deploymentResult.insertId;

      const pastaFrontend = path.join(__dirname, '../public_html');
      const pastaBackend = path.join(__dirname, '../');

      if (destinoFinal === 'FRONTEND') { extrairZipComSeguranca(zip, pastaFrontend); }
      else if (destinoFinal === 'BACKEND') { extrairZipComSeguranca(zip, pastaBackend); }
      else {
        extrairZipComSeguranca(zip, pastaFrontend, 'frontend');
        extrairZipComSeguranca(zip, pastaBackend, 'backend');
      }

      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

      if (normalizedVersion && normalizedTitle && normalizedDescription) {
        try { await pool.execute('INSERT INTO system_changelog (version, title, type, desc_text, author) VALUES (?, ?, ?, ?, ?)', [normalizedVersion, `[${destinoFinal}] ${normalizedTitle}`, normalizedType, normalizedDescription, validated.actor]); }
        catch (errDb) { console.warn('[DEPLOY] Falha ao registrar changelog:', errDb.message); }
      }

      await pool.execute("UPDATE system_deployments SET status = 'SUCCESS', completed_at = NOW(3) WHERE id = ?", [deploymentId]);

      await registrarAuditoria('DEPLOY_SISTEMA', validated.actor, `Deploy ${destinoFinal} (${normalizedVersion}): ${normalizedTitle}; backup=${backup.filename}`, 'warning');
      await registrarEventoSeguranca({ eventType: 'DEPLOY_SISTEMA', actor: validated.actor, ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: `${destinoFinal}: ${normalizedVersion}` });

      if (io) {
        io.emit('novo_changelog', { version: normalizedVersion, title: normalizedTitle, target: destinoFinal });
        io.emit('operacao_atualizada', { tipo: 'deploy', target: destinoFinal, version: normalizedVersion });
      }

      if (destinoFinal === 'BACKEND' || destinoFinal === 'FULLSTACK') {
        setTimeout(() => { exec('pm2 restart all', (error) => { if (error) console.error(`Erro ao tentar reiniciar o PM2: ${error}`); }); }, 1000);
      }
      res.json({ success: true, deploymentId, targetDetected: destinoFinal, checksum: packageChecksum, entryCount: zipEntries.length, backupFile: backup.filename, message: `Deploy do tipo [${destinoFinal}] processado com sucesso!` });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      if (deploymentId) {
        try {
          await pool.execute("UPDATE system_deployments SET status = 'FAILED', error_message = ?, completed_at = NOW(3) WHERE id = ?", [String(error.message || 'Falha desconhecida').slice(0, 500), deploymentId]);
        } catch (historyError) {
          console.warn('[DEPLOY] Falha ao atualizar histórico do deploy:', historyError.message);
        }
      }
      console.error('[DEPLOY] Falha ao processar pacote:', error.message);
      res.status(500).json({ error: 'Falha ao processar e extrair o pacote de atualização.', detail: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  });

  /** Retorna somente metadados estruturais necessários para o explorador do Console SQL. */
  /**
   * Endpoint GET /api/system/sql-console/metadata.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/system/sql-console/metadata
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/system/sql-console/metadata', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [[databaseRow]] = await pool.execute('SELECT DATABASE() AS databaseName');
      const [tables] = await pool.execute(`
        SELECT TABLE_NAME AS name,
               ENGINE AS engine,
               TABLE_ROWS AS estimatedRows,
               DATA_LENGTH + INDEX_LENGTH AS sizeBytes,
               UPDATE_TIME AS updatedAt
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME
      `);

      res.json({
        databaseName: databaseRow?.databaseName || 'termosync',
        mutationEnabled: process.env.ALLOW_RAW_SQL_MUTATION === 'true',
        destructiveEnabled: process.env.ALLOW_DESTRUCTIVE_SQL === 'true',
        maxQueryChars: Number(process.env.RAW_SQL_MAX_CHARS || 6000),
        tables: tables.map((table) => ({
          ...table,
          estimatedRows: Number(table.estimatedRows || 0),
          sizeBytes: Number(table.sizeBytes || 0)
        }))
      });
    } catch (error) {
      console.error('[SQL CONSOLE] Falha ao carregar metadados:', error.message);
      res.status(500).json({ error: 'Falha ao carregar metadados do banco.' });
    }
  });

  /** Executa uma única instrução SQL sob as políticas de segurança do terminal DEV. */
  /**
   * Endpoint POST /api/system/query-raw.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/system/query-raw
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/system/query-raw', verificarToken, requireRoles('DEV'), rootPasscodeLimiter, async (req, res) => {
    const sql = String(req.body.sql || '').trim();
    if (!sql) return res.status(400).json({ success: false, error: 'Instrução SQL ausente.' });
    if (sql.length > Number(process.env.RAW_SQL_MAX_CHARS || 6000)) {
      return res.status(413).json({ success: false, error: 'Instrução SQL excede o limite permitido.' });
    }
    if (/;\s*\S/.test(sql)) return res.status(400).json({ success: false, error: 'Execute uma instrução por vez.' });

    const isReadOnlyQuery = /^(select|show|describe|desc|explain)\b/i.test(sql);
    const isDestructiveQuery = /\b(drop|truncate)\b/i.test(sql);
    const isFileSystemQuery = /\b(into\s+outfile|into\s+dumpfile|load_file\s*\(|load\s+data)\b/i.test(sql);
    const queryFingerprint = crypto.createHash('sha256').update(sql).digest('hex');

    if (isFileSystemQuery) {
      await registrarAuditoria('RAW_SQL_FILESYSTEM_BLOCKED', 'Root/Dev', `Query hash: ${queryFingerprint}`, 'danger');
      await registrarEventoSeguranca({ eventType: 'RAW_SQL_FILESYSTEM_BLOCKED', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: queryFingerprint });
      return res.status(403).json({ success: false, error: 'Operações SQL com acesso ao sistema de arquivos estão bloqueadas.' });
    }

    if (isDestructiveQuery && process.env.ALLOW_DESTRUCTIVE_SQL !== 'true') {
      await registrarAuditoria('RAW_SQL_DESTRUCTIVE_BLOCKED', 'Root/Dev', `Query hash: ${queryFingerprint}`, 'danger');
      await registrarEventoSeguranca({ eventType: 'RAW_SQL_DESTRUCTIVE_BLOCKED', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: queryFingerprint });
      return res.status(403).json({ success: false, error: 'DROP/TRUNCATE exigem ALLOW_DESTRUCTIVE_SQL=true.' });
    }

    if (!isReadOnlyQuery && process.env.ALLOW_RAW_SQL_MUTATION !== 'true') {
      await registrarAuditoria('RAW_SQL_BLOCKED', 'Root/Dev', `Query hash: ${queryFingerprint}`, 'danger');
      await registrarEventoSeguranca({ eventType: 'RAW_SQL_BLOCKED', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: queryFingerprint });
      return res.status(403).json({ success: false, error: 'Comandos de escrita via terminal SQL exigem ALLOW_RAW_SQL_MUTATION=true.' });
    }

    if (!isReadOnlyQuery) {
      const validated = await validarRootPasscode(req.body.passcode);
      if (!validated.ok) {
        await registrarEventoSeguranca({ eventType: 'RAW_SQL_PASSCODE_FAILED', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: queryFingerprint });
        return res.status(403).json({ success: false, error: 'Passcode root obrigatório para SQL de escrita.' });
      }
    }

    const startedAt = Date.now();
    try {
      const [rows, fields] = await pool.execute(sql);
      await registrarAuditoria(isReadOnlyQuery ? 'RAW_SQL_READ' : 'RAW_SQL_MUTATION', 'Root/Dev', `Query hash: ${queryFingerprint}`, isReadOnlyQuery ? 'warning' : 'danger');
      await registrarEventoSeguranca({ eventType: isReadOnlyQuery ? 'RAW_SQL_READ' : 'RAW_SQL_MUTATION', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: isReadOnlyQuery ? 'warning' : 'danger', detail: queryFingerprint });
      const resultRows = Array.isArray(rows) ? rows : [];
      res.json({
        success: true,
        data: resultRows,
        meta: {
          queryType: sql.match(/^\s*([a-z]+)/i)?.[1]?.toUpperCase() || 'SQL',
          readOnly: isReadOnlyQuery,
          rowCount: resultRows.length,
          affectedRows: Number(rows?.affectedRows || 0),
          insertId: Number(rows?.insertId || 0) || null,
          columns: Array.isArray(fields) ? fields.map((field) => field.name) : [],
          durationMs: Date.now() - startedAt,
          executedAt: new Date().toISOString(),
          fingerprint: queryFingerprint.slice(0, 12)
        }
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message, durationMs: Date.now() - startedAt });
    }
  });

  /**
   * Recebe uma solicitação pública já classificada pelo endpoint de origem.
   * `forcedAccessType` impede que o navegador transforme um teste gratuito em
   * cadastro comercial apenas alterando o corpo da requisição.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @param {'TRIAL'|'COMERCIAL'|null} forcedAccessType Tipo imposto pela rota pública.
   * @param {{requireLegal?: boolean}} options Exige o aceite quando a própria pessoa envia o formulário público.
   * @route POST /api/pre-cadastros[/teste-gratis|/cadastro-definitivo]
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  const receivePreRegistration = (forcedAccessType = null, { requireLegal = true } = {}) => async (req, res) => {
    try {
      const empresa = normalizeCredential(req.body?.empresa, 180);
      const cnpj = String(req.body?.cnpj || '').replace(/\D/g, '');
      const responsavel = normalizeCredential(req.body?.responsavel, 150);
      const email = normalizeCredential(req.body?.email, 180).toLowerCase();
      const telefone = String(req.body?.telefone || '').replace(/\D/g, '').slice(0, 15);
      const tipoAcesso = forcedAccessType || String(req.body?.tipoAcesso || '').trim().toUpperCase();
      const legalAccepted = req.body?.legalAccepted === true;
      const legalVersion = normalizeCredential(req.body?.legalVersion, 20);

      if (empresa.length < 3 || responsavel.length < 3) return res.status(400).json({ error: 'Informe a organização e o responsável.' });
      if (!isValidCnpj(cnpj)) return res.status(400).json({ error: 'Informe um CNPJ válido.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Informe um e-mail corporativo válido.' });
      if (telefone.length < 10) return res.status(400).json({ error: 'Informe um telefone válido com DDD.' });
      if (!new Set(['TRIAL', 'COMERCIAL']).has(tipoAcesso)) return res.status(400).json({ error: 'Tipo de acesso inválido.' });
      if (requireLegal && (!legalAccepted || legalVersion !== '1.0')) return res.status(400).json({ error: 'Confirme os Termos de Uso e a Política de Privacidade vigentes.' });

      const [pending] = await pool.execute(
        `SELECT id FROM pre_cadastros
         WHERE status = 'pendente'
           AND (LOWER(email) = ? OR REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = ?)
         LIMIT 1`,
        [email, cnpj]
      );
      if (pending.length) return res.status(409).json({ error: 'Já existe uma solicitação pendente para este e-mail ou CNPJ.' });

      const [result] = await pool.execute(
        'INSERT INTO pre_cadastros (empresa, cnpj, responsavel, email, telefone, tipo_acesso, legal_version, legal_accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? THEN NOW() ELSE NULL END)',
        [empresa, cnpj, responsavel, email, telefone, tipoAcesso, legalAccepted ? legalVersion : null, legalAccepted]
      );
      if (io) io.emit('novo_pre_cadastro');
      res.status(201).json({ success: true, status: 'pendente', tipoAcesso, protocol: `PC-${String(result.insertId).padStart(6, '0')}` });
    } catch (error) {
      console.error('[ONBOARDING] Falha no pré-cadastro público:', error.message);
      res.status(500).json({ error: 'Erro ao processar pré-cadastro.' });
    }
  };

  // Cada intenção possui uma rota própria; não há endpoint público capaz de
  // alternar o tipo pelo corpo da requisição.
  app.post('/api/pre-cadastros/teste-gratis', preCadastroLimiter, receivePreRegistration('TRIAL'));
  app.post('/api/pre-cadastros/cadastro-definitivo', preCadastroLimiter, receivePreRegistration('COMERCIAL'));
  // Entradas registradas pelo desenvolvedor vêm de canais externos e, por isso,
  // não recebem falsamente um aceite feito na interface de autoatendimento.
  app.post('/api/pre-cadastros/manual', verificarToken, requireRoles('DEV'), receivePreRegistration(null, { requireLegal: false }));

  /**
   * Endpoint GET /api/pre-cadastros.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/pre-cadastros
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/pre-cadastros', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' }); try { const [rows] = await pool.execute('SELECT * FROM pre_cadastros WHERE status = "pendente" ORDER BY data_solicitacao ASC'); res.json(rows); } catch (error) { res.status(500).send(); } });
  /** Consolida fila, histórico e indicadores de qualidade do onboarding SaaS. */
  /**
   * Endpoint GET /api/pre-cadastros/overview.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/pre-cadastros/overview
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/pre-cadastros/overview', verificarToken, requireRoles('DEV'), async (_req, res) => {
    try {
      const [[[summaryRow]], [rows], [[tenantRow]], [trialRows], [trialUserRows], [[conversionRow]]] = await Promise.all([
        pool.execute(`
          SELECT COUNT(*) AS total,
                 SUM(status = 'pendente') AS pending,
                 SUM(status = 'aprovado') AS approved,
                 SUM(status = 'rejeitado') AS rejected,
                 SUM(status = 'pendente' AND data_solicitacao < DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS overdue,
                 SUM(data_solicitacao >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS receivedLast7Days,
                 MIN(CASE WHEN status = 'pendente' THEN data_solicitacao END) AS oldestPendingAt
          FROM pre_cadastros
        `),
        pool.execute('SELECT * FROM pre_cadastros ORDER BY data_solicitacao DESC, id DESC LIMIT 150'),
        pool.execute('SELECT COUNT(*) AS activeTenants FROM empresas WHERE status = "Ativa"'),
        pool.execute(`
          SELECT company.nome AS empresa, company.email, company.status, company.access_mode,
                 company.trial_started_at, company.trial_expires_at, company.trial_auto_block,
                 company.trial_warning_days, company.trial_warning_sent_at, company.trial_stage,
                 company.trial_paused_at, company.trial_delete_at,
                 company.trial_max_users, company.trial_max_stores, company.trial_max_equipment,
                 TIMESTAMPDIFF(DAY, NOW(), company.trial_expires_at) AS days_remaining,
                 TIMESTAMPDIFF(DAY, company.trial_started_at, NOW()) AS days_elapsed,
                 l.nome AS filial, COALESCE(st.plano, 'TRIAL') AS plano,
                 st.custom_monthly_price, st.billing_due_day,
                 (SELECT COUNT(*) FROM equipamentos eq WHERE eq.empresa = company.nome AND eq.is_virtual = TRUE) AS virtual_equipment,
                 (SELECT u.usuario FROM usuarios u WHERE u.empresa = company.nome AND u.role = 'ADMIN' ORDER BY u.id LIMIT 1) AS admin_user,
                 (SELECT MAX(COALESCE(session.last_seen, session.data_login))
                    FROM usuarios account
                    JOIN sessoes_ativas session ON session.usuario_id = account.id
                   WHERE account.empresa = company.nome AND session.revogado = FALSE) AS last_activity_at,
                 (SELECT COUNT(*)
                    FROM usuarios account
                    JOIN sessoes_ativas session ON session.usuario_id = account.id
                   WHERE account.empresa = company.nome) AS session_count,
                 (SELECT COUNT(*) FROM saas_trial_events event
                   WHERE event.empresa COLLATE utf8mb4_unicode_ci = company.nome COLLATE utf8mb4_unicode_ci) AS history_count
                 ,(SELECT COUNT(*) FROM trial_usage_events usage_event
                    WHERE usage_event.empresa COLLATE utf8mb4_unicode_ci = company.nome COLLATE utf8mb4_unicode_ci) AS usage_count
                 ,(SELECT COUNT(DISTINCT usage_event.screen_id) FROM trial_usage_events usage_event
                    WHERE usage_event.empresa COLLATE utf8mb4_unicode_ci = company.nome COLLATE utf8mb4_unicode_ci) AS screens_visited
                 ,(SELECT usage_event.screen_id FROM trial_usage_events usage_event
                    WHERE usage_event.empresa COLLATE utf8mb4_unicode_ci = company.nome COLLATE utf8mb4_unicode_ci
                    GROUP BY usage_event.screen_id ORDER BY COUNT(*) DESC, MAX(usage_event.occurred_at) DESC LIMIT 1) AS favorite_screen
          FROM empresas company
          LEFT JOIN loja l ON l.id = (
            SELECT l2.id FROM loja l2 WHERE l2.empresa = company.nome ORDER BY l2.id LIMIT 1
          )
          LEFT JOIN saas_tenant_settings st ON st.filial COLLATE utf8mb4_unicode_ci = l.nome COLLATE utf8mb4_unicode_ci
          WHERE company.access_mode IN ('TRIAL', 'DEMO')
          ORDER BY company.status = 'Ativa' DESC, company.trial_expires_at ASC, company.nome
        `),
        pool.execute(`
          SELECT account.id, account.usuario, account.email, account.role, account.filial,
                 account.empresa, account.security_blocked,
                 MAX(COALESCE(session.last_seen, session.data_login)) AS last_activity_at,
                 COUNT(session.id) AS session_count
          FROM usuarios account
          JOIN empresas company ON company.nome = account.empresa
          LEFT JOIN sessoes_ativas session ON session.usuario_id = account.id
          WHERE company.access_mode IN ('TRIAL', 'DEMO')
          GROUP BY account.id, account.usuario, account.email, account.role, account.filial,
                   account.empresa, account.security_blocked
          ORDER BY account.empresa, FIELD(account.role, 'ADMIN', 'LOJA', 'MANUTENCAO', 'DEV'), account.usuario
        `),
        pool.execute(`
          SELECT COUNT(DISTINCT CASE WHEN event_type = 'TRIAL_CREATED' THEN empresa END) AS started,
                 COUNT(DISTINCT CASE WHEN event_type = 'TRIAL_CONVERTED' THEN empresa END) AS converted
            FROM saas_trial_events
           WHERE created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        `)
      ]);

      const duplicateKeys = new Map();
      rows.forEach((row) => {
        const keys = [String(row.email || '').trim().toLowerCase(), String(row.cnpj || '').replace(/\D/g, '')].filter(Boolean);
        keys.forEach((key) => duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1));
      });

      const requests = rows.map((row) => {
        const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email || ''));
        const documentDigits = String(row.cnpj || '').replace(/\D/g, '');
        const phoneDigits = String(row.telefone || '').replace(/\D/g, '');
        const checks = [Boolean(row.empresa?.trim()), Boolean(row.responsavel?.trim()), emailValid, documentDigits.length >= 11, phoneDigits.length >= 10];
        const duplicate = [String(row.email || '').trim().toLowerCase(), documentDigits].filter(Boolean).some((key) => duplicateKeys.get(key) > 1);
        return {
          ...row,
          qualityScore: Math.round((checks.filter(Boolean).length / checks.length) * 100),
          duplicate,
          emailValid,
          documentDigits: documentDigits.length
        };
      });

      const approved = Number(summaryRow.approved || 0);
      const rejected = Number(summaryRow.rejected || 0);
      const accountsByCompany = trialUserRows.reduce((groups, account) => {
        const companyAccounts = groups.get(account.empresa) || [];
        companyAccounts.push({
          ...account,
          security_blocked: Boolean(account.security_blocked),
          session_count: Number(account.session_count || 0)
        });
        groups.set(account.empresa, companyAccounts);
        return groups;
      }, new Map());
      const trials = trialRows.map((trial) => ({
        ...trial,
        accounts: accountsByCompany.get(trial.empresa) || [],
        trial_auto_block: Boolean(trial.trial_auto_block),
        trial_warning_days: Number(trial.trial_warning_days || 3),
        days_remaining: trial.days_remaining == null ? null : Number(trial.days_remaining),
        days_elapsed: trial.days_elapsed == null ? null : Number(trial.days_elapsed),
        virtual_equipment: Number(trial.virtual_equipment || 0),
        session_count: Number(trial.session_count || 0),
        history_count: Number(trial.history_count || 0),
        usage_count: Number(trial.usage_count || 0),
        screens_visited: Number(trial.screens_visited || 0),
        trial_max_users: Number(trial.trial_max_users || 3),
        trial_max_stores: Number(trial.trial_max_stores || 1),
        trial_max_equipment: Number(trial.trial_max_equipment || 10),
        custom_monthly_price: trial.custom_monthly_price == null ? null : Number(trial.custom_monthly_price)
      }));
      const trialProfiles = trials.flatMap((trial) => trial.accounts.map((account) => ({
        ...trial,
        account_id: account.id,
        account_user: account.usuario,
        account_email: account.email,
        account_role: account.role,
        account_filial: account.filial,
        account_blocked: account.security_blocked,
        account_last_activity_at: account.last_activity_at,
        account_session_count: account.session_count
      })));
      res.json({
        summary: {
          total: Number(summaryRow.total || 0),
          pending: Number(summaryRow.pending || 0),
          approved,
          rejected,
          overdue: Number(summaryRow.overdue || 0),
          receivedLast7Days: Number(summaryRow.receivedLast7Days || 0),
          oldestPendingAt: summaryRow.oldestPendingAt,
          approvalRate: approved + rejected ? Math.round((approved / (approved + rejected)) * 100) : 0,
          activeTenants: Number(tenantRow.activeTenants || 0),
          smtpReady: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
          activeTrials: trials.filter((trial) => trial.status === 'Ativa').length,
          expiringTrials: trials.filter((trial) => trial.days_remaining != null && trial.days_remaining >= 0 && trial.days_remaining <= trial.trial_warning_days).length,
          expiredTrials: trials.filter((trial) => trial.days_remaining != null && trial.days_remaining < 0).length,
          engagedTrials: trials.filter((trial) => trial.session_count > 0).length,
          neverAccessedTrials: trials.filter((trial) => trial.access_mode === 'TRIAL' && trial.session_count === 0).length,
          manualReviewTrials: trials.filter((trial) => trial.access_mode === 'TRIAL' && !trial.trial_auto_block).length,
          trialAccounts: trialProfiles.length,
          engagedTrialAccounts: trialProfiles.filter((profile) => profile.account_session_count > 0).length,
          neverAccessedAccounts: trialProfiles.filter((profile) => profile.account_session_count === 0).length,
          blockedTrialAccounts: trialProfiles.filter((profile) => profile.account_blocked || profile.status !== 'Ativa').length,
          convertedTrials90d: Number(conversionRow.converted || 0),
          conversionRate90d: Number(conversionRow.started || 0)
            ? Math.round((Number(conversionRow.converted || 0) / Number(conversionRow.started || 1)) * 100)
            : 0
        },
        requests,
        trials,
        trialProfiles
      });
    } catch (error) {
      console.error('[ONBOARDING] Falha ao consolidar visão operacional:', error.message);
      res.status(500).json({ error: 'Falha ao carregar a visão de onboarding.' });
    }
  });

  /**
   * Endpoint POST /api/pre-cadastros/:id/aprovar.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/pre-cadastros/:id/aprovar
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/pre-cadastros/:id/aprovar', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [reqs] = await connection.execute('SELECT * FROM pre_cadastros WHERE id = ? FOR UPDATE', [req.params.id]);
      if (reqs.length === 0) {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(404).json({ error: 'Requerimento não encontrado' });
      }
      if (reqs[0].status !== 'pendente') {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(409).json({ error: 'Este requerimento já foi processado.' });
      }

      const reqData = reqs[0];
      const [existingCompanies] = await connection.execute(
        'SELECT id FROM empresas WHERE nome = ? OR cnpj = ? LIMIT 1 FOR UPDATE',
        [reqData.empresa, reqData.cnpj]
      );
      if (existingCompanies.length) {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(409).json({ error: 'A organização já possui um ambiente. Use a gestão de licenças para alterar o plano.' });
      }

      // A aprovação respeita a origem da solicitação. A migração de um trial para
      // cliente definitivo ocorre somente pelo fluxo auditado de conversão comercial.
      const requestedAccess = reqData.tipo_acesso === 'COMERCIAL' ? 'CUSTOMER' : 'TRIAL';
      const isTrial = requestedAccess === 'TRIAL';
      const trialDays = clampNumber(req.body?.trialDays, Number(process.env.TRIAL_DURATION_DAYS) || 14, 1, 365);
      const trialAutoBlock = req.body?.autoBlock !== false;
      const trialWarningDays = clampNumber(req.body?.warningDays, 3, 1, 30);
      const customerPlan = String(req.body?.plan || 'PRO').toUpperCase();
      const monthlyValue = Number(req.body?.monthlyValue || 0);
      const firstDueDate = String(req.body?.firstDueDate || '').slice(0, 10);
      const firstDueDateValue = new Date(`${firstDueDate}T12:00:00`);
      const firstDueDateIsValid = isValidIsoDate(firstDueDate);
      if (!isTrial && !new Set(['FREE', 'PRO', 'ENTERPRISE']).has(customerPlan)) {
        await connection.rollback(); connection.release(); connection = null;
        return res.status(400).json({ error: 'Selecione um plano comercial válido.' });
      }
      if (!isTrial && customerPlan !== 'FREE' && (!Number.isFinite(monthlyValue) || monthlyValue <= 0 || !firstDueDateIsValid)) {
        await connection.rollback(); connection.release(); connection = null;
        return res.status(400).json({ error: 'Informe o valor mensal e a data da primeira fatura.' });
      }
      const contatoCompleto = `${reqData.responsavel || 'Responsável'} (${reqData.telefone || 'sem telefone'})`;
      if (isTrial) {
        await connection.execute(
          `INSERT INTO empresas
             (nome, cnpj, contato, email, status, access_mode, trial_started_at, trial_expires_at,
              trial_auto_block, trial_warning_days, trial_warning_sent_at, trial_stage)
           VALUES (?, ?, ?, ?, 'Ativa', 'TRIAL', NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), ?, ?, NULL, 'NEW')
           ON DUPLICATE KEY UPDATE cnpj = VALUES(cnpj), contato = VALUES(contato), email = VALUES(email),
             status = 'Ativa', access_mode = 'TRIAL', trial_started_at = NOW(),
             trial_expires_at = DATE_ADD(NOW(), INTERVAL ? DAY), trial_auto_block = VALUES(trial_auto_block),
             trial_warning_days = VALUES(trial_warning_days), trial_warning_sent_at = NULL, trial_stage = 'NEW'`,
          [reqData.empresa, reqData.cnpj, contatoCompleto, reqData.email, trialDays, trialAutoBlock, trialWarningDays, trialDays]
        );
      } else {
        await connection.execute(
          `INSERT INTO empresas (nome, cnpj, contato, email, status, access_mode, trial_started_at, trial_expires_at)
           VALUES (?, ?, ?, ?, 'Ativa', 'CUSTOMER', NULL, NULL)
           ON DUPLICATE KEY UPDATE cnpj = VALUES(cnpj), contato = VALUES(contato), email = VALUES(email), status = 'Ativa'`,
          [reqData.empresa, reqData.cnpj, contatoCompleto, reqData.email]
        );
      }

      const nomeFilialMatriz = `Matriz - ${reqData.empresa}`;
      await connection.execute(
        'INSERT IGNORE INTO loja (nome, endereco, telefone, empresa, status) VALUES (?, ?, ?, ?, "Ativa")',
        [nomeFilialMatriz, 'Sede Principal (Pendente de Atualização)', reqData.telefone, reqData.empresa]
      );

      let demoProvision = null;
      if (isTrial) {
        await connection.execute(
          `INSERT INTO saas_tenant_settings (filial, plano, retention_days, custom_monthly_price, billing_due_day)
           VALUES (?, 'TRIAL', ?, NULL, NULL)
           ON DUPLICATE KEY UPDATE plano = 'TRIAL', retention_days = VALUES(retention_days),
             custom_monthly_price = NULL, billing_due_day = NULL`,
          [nomeFilialMatriz, trialDays]
        );
        demoProvision = await provisionDemoTenantData(connection, { empresa: reqData.empresa, filial: nomeFilialMatriz });
      } else {
        const dueDay = customerPlan === 'FREE' ? null : Number(firstDueDate.slice(8, 10));
        await connection.execute(
          `INSERT INTO saas_tenant_settings (filial, plano, retention_days, custom_monthly_price, billing_due_day)
           VALUES (?, ?, 30, ?, ?)
           ON DUPLICATE KEY UPDATE plano = VALUES(plano), custom_monthly_price = VALUES(custom_monthly_price),
             billing_due_day = VALUES(billing_due_day)`,
          [nomeFilialMatriz, customerPlan, customerPlan === 'FREE' ? null : monthlyValue, dueDay]
        );
        if (customerPlan !== 'FREE') {
          await connection.execute(
            `INSERT INTO faturas_saas
               (filial, plano, valor_base, total, data_vencimento, ciclo_mes, ciclo_ano, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDENTE')
             ON DUPLICATE KEY UPDATE plano = VALUES(plano), valor_base = VALUES(valor_base),
               total = VALUES(total), data_vencimento = VALUES(data_vencimento), status = 'PENDENTE'`,
            [nomeFilialMatriz, customerPlan, monthlyValue, monthlyValue, firstDueDate, firstDueDateValue.getMonth() + 1, firstDueDateValue.getFullYear()]
          );
        }
      }

      const baseUsername = reqData.empresa.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 8) || 'cliente';
      const usuarioGerado = `admin.${baseUsername}${crypto.randomInt(100, 999)}`;
      const senhaGerada = gerarSenhaProvisoria();
      const senhaHash = await bcrypt.hash(senhaGerada, 10);

      await connection.execute(
        'INSERT INTO usuarios (usuario, senha, email, telefone, role, filial, nome_gerente, empresa, must_change_password) VALUES (?, ?, ?, ?, "ADMIN", "Todas", ?, ?, TRUE)',
        [usuarioGerado, senhaHash, reqData.email, reqData.telefone, reqData.responsavel, reqData.empresa]
      );
      await connection.execute('UPDATE pre_cadastros SET status = "aprovado" WHERE id = ?', [req.params.id]);
      if (isTrial) {
        await registrarEventoTrial(connection, {
          empresa: reqData.empresa,
          eventType: 'TRIAL_CREATED',
          title: 'Teste gratuito aprovado',
          detail: `${trialDays} dias de acesso com ${trialAutoBlock ? 'bloqueio automático' : 'decisão manual'} no vencimento.`,
          actorId: req.userId,
          actorLabel: `DEV #${req.userId}`,
          metadata: { trialDays, warningDays: trialWarningDays, autoBlock: trialAutoBlock }
        });
      }
      await connection.commit();
      connection.release();
      connection = null;

      const empresaSegura = escapeHtml(reqData.empresa);
      const responsavelSeguro = escapeHtml(reqData.responsavel);
      const usuarioSeguro = escapeHtml(usuarioGerado);
      const senhaSegura = escapeHtml(senhaGerada);
      const mailOptions = {
        from: SMTP_FROM,
        to: reqData.email,
        subject: `${isTrial ? 'Seu teste gratuito' : 'Seu acesso'} ao TermoSync, ${reqData.empresa}!`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;"><h2 style="color: #10b981; text-align: center;">${isTrial ? `Demonstração de ${trialDays} dias liberada` : `Plano ${customerPlan} ativado`}</h2><p>Olá, <strong>${responsavelSeguro}</strong>,</p><p>O ambiente da organização <strong>${empresaSegura}</strong> já está operacional.${isTrial ? ` Os equipamentos e as leituras são virtuais, sem instalação física. O acesso ficará disponível por ${trialDays} dias.` : customerPlan === 'FREE' ? ' O cadastro foi ativado no plano gratuito.' : ` A primeira fatura terá vencimento em ${escapeHtml(firstDueDate)}.`}</p><div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #38bdf8; margin: 20px 0; border-radius: 4px;"><h3 style="margin-top: 0; color: #0f172a;">Credenciais de Acesso (Administrador)</h3><p><strong>Usuário:</strong> <span style="font-family: monospace; font-size: 1.1em; color: #0369a1;">${usuarioSeguro}</span></p><p><strong>Senha:</strong> <span style="font-family: monospace; font-size: 1.1em; color: #0369a1;">${senhaSegura}</span></p><p style="font-size: 12px; color: #ef4444; margin-bottom: 0;">Altere esta senha após o primeiro acesso.</p></div><hr style="border:none; border-top:1px solid #eee; margin:20px 0;"><p style="font-size:12px; color:#999; text-align:center;">ThermoSync Enterprise Operations</p></div>`
      };

      let emailSent = false;
      const transporter = criarTransporterEmail();
      if (transporter) {
        try {
          await transporter.sendMail(mailOptions);
          emailSent = true;
        } catch (emailError) {
          console.warn('[SMTP] Tenant provisionado, mas o e-mail de boas-vindas falhou:', emailError.message);
        }
      } else {
        console.warn('[SMTP] Tenant aprovado sem envio de e-mail. Configure SMTP_USER e SMTP_PASS.');
      }

      try {
        await registrarAuditoria(isTrial ? 'TRIAL_APPROVED' : 'ONBOARDING_APPROVED', 'Root/Dev', `${isTrial ? 'Trial' : 'Tenant'} provisionado: ${reqData.empresa} (Admin: ${usuarioGerado})`, 'success');
      } catch (auditError) {
        console.warn('[ONBOARDING] Tenant provisionado, mas o registro de auditoria falhou:', auditError.message);
      }
      if (io) {
        io.emit('atualizacao_dados', { tipo: 'onboarding', id: Number(req.params.id), status: 'aprovado' });
        io.emit('onboarding_updated', { id: Number(req.params.id), status: 'aprovado' });
      }

      res.json({
        success: true,
        emailSent,
        usuario: usuarioGerado,
        senhaProvisoria: emailSent ? undefined : senhaGerada,
        isTrial,
        trialDays: isTrial ? trialDays : null,
        trialExpiresAt: isTrial ? new Date(Date.now() + trialDays * 86400000).toISOString() : null,
        autoBlock: isTrial ? trialAutoBlock : null,
        warningDays: isTrial ? trialWarningDays : null,
        plan: isTrial ? 'TRIAL' : customerPlan,
        monthlyValue: !isTrial && customerPlan !== 'FREE' ? monthlyValue : null,
        firstDueDate: !isTrial && customerPlan !== 'FREE' ? firstDueDate : null,
        demoEquipmentCount: demoProvision?.equipmentCount || 0,
        message: emailSent ? 'Aprovado com sucesso. Credenciais enviadas por e-mail.' : 'Aprovado com sucesso. SMTP não configurado; credenciais retornadas ao DEV.'
      });
    } catch (error) {
      if (connection) {
        try { await connection.rollback(); } catch (rollbackError) { console.warn('[ONBOARDING] Falha no rollback:', rollbackError.message); }
        connection.release();
      }
      console.error('[ONBOARDING] Falha ao aprovar pré-cadastro:', error.message);
      res.status(500).json({ error: 'Erro interno' });
    }
  });

  /** Entrega a linha do tempo funcional de um trial sem expor o log técnico global. */
  app.get('/api/saas/trials/:empresa/history', verificarToken, requireRoles('DEV'), async (req, res) => {
    const empresa = normalizeCredential(req.params.empresa, 150);
    if (!empresa) return res.status(400).json({ error: 'Empresa inválida.' });
    try {
      const [[company]] = await pool.execute('SELECT nome FROM empresas WHERE nome = ? LIMIT 1', [empresa]);
      if (!company) return res.status(404).json({ error: 'Empresa não encontrada.' });
      const limit = clampNumber(req.query.limit, 60, 1, 150);
      const [events] = await pool.query(
        `SELECT id, event_type, title, detail, actor_id, actor_label, metadata, created_at
         FROM saas_trial_events
         WHERE empresa COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [empresa, limit]
      );
      res.json({ empresa, events });
    } catch (error) {
      console.error('[TRIAL] Falha ao carregar histórico:', error.message);
      res.status(500).json({ error: 'Falha ao carregar o histórico do teste.' });
    }
  });

  /** Registra navegação agregável somente para contas de demonstração autenticadas. */
  app.post('/api/saas/trials/usage', verificarToken, async (req, res) => {
    if (!req.isTrial || !req.userEmpresa) return res.status(204).send();
    const screenId = normalizeCredential(req.body?.screenId, 80);
    const durationMs = clampNumber(req.body?.durationMs, 0, 0, 86400000);
    if (!screenId || !/^[a-z0-9_-]{2,80}$/i.test(screenId)) {
      return res.status(400).json({ error: 'Tela inválida para telemetria de uso.' });
    }
    try {
      await pool.execute(
        'INSERT INTO trial_usage_events (empresa, usuario_id, screen_id, duration_ms) VALUES (?, ?, ?, ?)',
        [req.userEmpresa, req.userId, screenId, durationMs]
      );
      res.status(201).json({ success: true });
    } catch (error) {
      console.warn('[TRIAL] Falha ao registrar uso:', error.message);
      res.status(500).json({ error: 'Falha ao registrar atividade da demonstração.' });
    }
  });

  /** Gera uma nova senha provisória, encerra sessões e tenta entregá-la por e-mail. */
  app.post('/api/saas/trials/:empresa/accounts/:accountId/reset-password', verificarToken, requireRoles('DEV'), async (req, res) => {
    const empresa = normalizeCredential(req.params.empresa, 150);
    const accountId = Number(req.params.accountId);
    if (!empresa || !Number.isInteger(accountId) || accountId <= 0) return res.status(400).json({ error: 'Conta inválida.' });
    try {
      const [[account]] = await pool.execute(
        `SELECT user_account.id, user_account.usuario, user_account.email
           FROM usuarios user_account JOIN empresas company ON company.nome = user_account.empresa
          WHERE user_account.id = ? AND user_account.empresa = ? AND company.access_mode IN ('TRIAL', 'DEMO')`,
        [accountId, empresa]
      );
      if (!account) return res.status(404).json({ error: 'Conta de demonstração não encontrada.' });
      const temporaryPassword = gerarSenhaProvisoria();
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);
      await pool.execute(
        'UPDATE usuarios SET senha = ?, must_change_password = TRUE, password_changed_at = NULL WHERE id = ?',
        [passwordHash, account.id]
      );
      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE usuario_id = ? AND revogado = FALSE', [account.id]);
      invalidateUserSessions(account.id);

      let emailSent = false;
      const transporter = criarTransporterEmail();
      if (transporter && account.email) {
        try {
          await transporter.sendMail({
            from: SMTP_FROM,
            to: account.email,
            subject: 'TermoSync | Nova senha provisória',
            html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Novo acesso à demonstração</h2><p>Usuário: <strong>${escapeHtml(account.usuario)}</strong></p><p>Senha provisória: <strong>${escapeHtml(temporaryPassword)}</strong></p><p>Altere a senha no primeiro acesso.</p></div>`
          });
          emailSent = true;
        } catch (emailError) {
          console.warn('[SMTP] Falha ao entregar nova senha de trial:', emailError.message);
        }
      }
      await registrarEventoTrial(pool, {
        empresa,
        eventType: 'TRIAL_PASSWORD_RESET',
        title: `Senha de ${account.usuario} redefinida`,
        detail: emailSent ? 'A senha provisória foi enviada por e-mail.' : 'A senha provisória deve ser entregue por um canal seguro.',
        actorId: req.userId,
        actorLabel: `DEV #${req.userId}`,
        metadata: { accountId, emailSent }
      });
      await registrarAuditoria('TRIAL_PASSWORD_RESET', req.userRole, `${empresa}: ${account.usuario}`, 'warning');
      res.json({ success: true, emailSent, temporaryPassword: emailSent ? undefined : temporaryPassword });
    } catch (error) {
      console.error('[TRIAL] Falha ao redefinir senha:', error.message);
      res.status(500).json({ error: 'Falha ao redefinir a senha da demonstração.' });
    }
  });

  /** Exclui imediatamente um ambiente temporário inteiro após decisão explícita do DEV. */
  app.delete('/api/saas/trials/:empresa', verificarToken, requireRoles('DEV'), async (req, res) => {
    const empresa = normalizeCredential(req.params.empresa, 150);
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const result = await deleteTrialTenantData(connection, empresa);
      await connection.commit();
      connection.release();
      connection = null;
      result.userIds.forEach((id) => invalidateUserSessions(id));
      invalidateAllSessionCaches(extrairTokenAutenticacao(req));
      await registrarAuditoria('TRIAL_ENVIRONMENT_DELETED', req.userRole, empresa, 'danger');
      if (io) io.emit('atualizacao_dados', { tipo: 'trial_deleted', empresa });
      res.json({ success: true, empresa });
    } catch (error) {
      if (connection) { try { await connection.rollback(); } catch {} connection.release(); }
      res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Falha ao excluir o ambiente.' });
    }
  });

  /** Remove uma credencial de teste e encerra o tenant quando ela era a última do trial. */
  app.delete('/api/saas/trials/:empresa/accounts/:accountId', verificarToken, requireRoles('DEV'), async (req, res) => {
    const empresa = normalizeCredential(req.params.empresa, 150);
    const accountId = Number(req.params.accountId);
    if (!empresa || !Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({ error: 'Conta de teste inválida.' });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [[company]] = await connection.execute(
        `SELECT nome, access_mode, status FROM empresas
         WHERE nome = ? AND access_mode IN ('TRIAL', 'DEMO') FOR UPDATE`,
        [empresa]
      );
      const [[account]] = await connection.execute(
        'SELECT id, usuario, role FROM usuarios WHERE id = ? AND empresa = ? FOR UPDATE',
        [accountId, empresa]
      );
      if (!company || !account) {
        throw Object.assign(new Error('Conta gratuita não encontrada.'), { statusCode: 404 });
      }

      const [[countRow]] = await connection.execute('SELECT COUNT(*) AS total FROM usuarios WHERE empresa = ?', [empresa]);
      const isLastAccount = Number(countRow.total || 0) <= 1;
      if (company.access_mode === 'DEMO' && isLastAccount) {
        throw Object.assign(new Error('A última conta da demonstração permanente não pode ser excluída.'), { statusCode: 409 });
      }

      await connection.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE usuario_id = ? AND revogado = FALSE', [account.id]);
      await connection.execute('DELETE FROM usuarios WHERE id = ? AND empresa = ?', [account.id, empresa]);

      const environmentClosed = company.access_mode === 'TRIAL' && isLastAccount;
      if (environmentClosed) {
        await connection.execute("UPDATE empresas SET status = 'Suspensa', trial_stage = 'LOST' WHERE nome = ?", [empresa]);
        await connection.execute("UPDATE loja SET status = 'Suspensa' WHERE empresa = ? AND status <> 'Bloqueada'", [empresa]);
      }

      await registrarEventoTrial(connection, {
        empresa,
        eventType: environmentClosed ? 'TRIAL_CLOSED' : 'TRIAL_ACCOUNT_DELETED',
        title: environmentClosed ? `Trial encerrado após excluir ${account.usuario}` : `Conta ${account.usuario} excluída`,
        detail: environmentClosed
          ? 'A última credencial foi removida; o ambiente foi suspenso e a telemetria virtual interrompida.'
          : 'A credencial e suas sessões foram removidas sem afetar as demais contas do ambiente.',
        actorId: req.userId,
        actorLabel: `DEV #${req.userId}`,
        metadata: { accountId: account.id, username: account.usuario, role: account.role, environmentClosed }
      });

      await connection.commit();
      connection.release();
      connection = null;
      invalidateUserSessions(account.id);
      invalidateAllSessionCaches(extrairTokenAutenticacao(req));
      await registrarAuditoria('TRIAL_ACCOUNT_DELETED', req.userRole, `${empresa}: ${account.usuario}`, 'danger');
      if (io) io.emit('atualizacao_dados', { tipo: 'trial_account_deleted', empresa, accountId, environmentClosed });
      res.json({ success: true, empresa, accountId, environmentClosed });
    } catch (error) {
      if (connection) {
        try { await connection.rollback(); } catch {}
        connection.release();
      }
      console.error('[TRIAL] Falha ao excluir conta gratuita:', error.message);
      res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Falha ao excluir a conta gratuita.' });
    }
  });

  /** Gerencia ciclo, bloqueio, acompanhamento e conversão comercial de um ambiente de teste. */
  app.patch('/api/saas/trials/:empresa', verificarToken, requireRoles('DEV'), async (req, res) => {
    const empresa = normalizeCredential(req.params.empresa, 150);
    const action = String(req.body?.action || '').toLowerCase();
    if (!empresa || !new Set(['block', 'unblock', 'block_account', 'unblock_account', 'extend', 'schedule', 'policy', 'note', 'convert', 'pause', 'resume', 'reset', 'limits', 'schedule_delete', 'cancel_delete']).has(action)) {
      return res.status(400).json({ error: 'Ação de trial inválida.' });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [[company]] = await connection.execute(
        `SELECT id, nome, status, access_mode, trial_expires_at, trial_auto_block, trial_stage,
                trial_paused_at, trial_delete_at
         FROM empresas WHERE nome = ? FOR UPDATE`,
        [empresa]
      );
      if (!company || !['TRIAL', 'DEMO'].includes(company.access_mode)) {
        await connection.rollback(); connection.release(); connection = null;
        return res.status(404).json({ error: 'Ambiente de demonstração não encontrado.' });
      }
      const [[store]] = await connection.execute('SELECT nome FROM loja WHERE empresa = ? ORDER BY id LIMIT 1', [empresa]);
      if (['extend', 'schedule', 'policy'].includes(action) && company.access_mode !== 'TRIAL') {
        throw Object.assign(new Error('A demonstração permanente não possui vencimento para ajustar.'), { statusCode: 409 });
      }
      if (action === 'convert' && !store?.nome) {
        throw Object.assign(new Error('A empresa não possui uma filial válida para receber o plano.'), { statusCode: 409 });
      }
      let trialEvent = null;

      if (action === 'pause') {
        if (company.access_mode !== 'TRIAL') throw Object.assign(new Error('A demonstração permanente não precisa ser pausada.'), { statusCode: 409 });
        if (company.trial_paused_at) throw Object.assign(new Error('Este período já está pausado.'), { statusCode: 409 });
        await connection.execute("UPDATE empresas SET status = 'Suspensa', trial_stage = 'PAUSED', trial_paused_at = NOW() WHERE nome = ?", [empresa]);
        await connection.execute("UPDATE loja SET status = 'Suspensa' WHERE empresa = ? AND status <> 'Bloqueada'", [empresa]);
        await connection.execute(`UPDATE sessoes_ativas session JOIN usuarios user_account ON user_account.id = session.usuario_id SET session.revogado = TRUE WHERE user_account.empresa = ? AND session.revogado = FALSE`, [empresa]);
        trialEvent = { eventType: 'TRIAL_PAUSED', title: 'Contagem do teste pausada', detail: 'O acesso e a contagem do prazo foram interrompidos.' };
      }

      if (action === 'resume') {
        if (company.access_mode !== 'TRIAL' || !company.trial_paused_at) throw Object.assign(new Error('Este teste não está pausado.'), { statusCode: 409 });
        await connection.execute(`
          UPDATE empresas SET status = 'Ativa', trial_stage = 'EVALUATION',
            trial_expires_at = DATE_ADD(trial_expires_at, INTERVAL TIMESTAMPDIFF(SECOND, trial_paused_at, NOW()) SECOND),
            trial_paused_at = NULL WHERE nome = ?
        `, [empresa]);
        await connection.execute("UPDATE loja SET status = 'Ativa' WHERE empresa = ? AND status = 'Suspensa'", [empresa]);
        trialEvent = { eventType: 'TRIAL_RESUMED', title: 'Contagem do teste retomada', detail: 'O vencimento foi deslocado pelo período em que o ambiente permaneceu pausado.' };
      }

      if (action === 'reset') {
        const resetResult = await resetTrialTenantData(connection, empresa);
        trialEvent = { eventType: 'TRIAL_RESET', title: 'Demonstração restaurada', detail: 'Dados operacionais e telemetria retornaram ao cenário inicial.', metadata: resetResult };
      }

      if (action === 'limits') {
        const maxUsers = clampNumber(req.body?.maxUsers, 3, 1, 50);
        const maxStores = clampNumber(req.body?.maxStores, 1, 1, 20);
        const maxEquipment = clampNumber(req.body?.maxEquipment, 10, 1, 200);
        await connection.execute('UPDATE empresas SET trial_max_users = ?, trial_max_stores = ?, trial_max_equipment = ? WHERE nome = ?', [maxUsers, maxStores, maxEquipment, empresa]);
        trialEvent = { eventType: 'TRIAL_LIMITS_UPDATED', title: 'Limites da demonstração atualizados', detail: `${maxUsers} usuário(s), ${maxStores} loja(s) e ${maxEquipment} equipamento(s).`, metadata: { maxUsers, maxStores, maxEquipment } };
      }

      if (action === 'schedule_delete') {
        if (company.access_mode !== 'TRIAL') throw Object.assign(new Error('A demonstração permanente não pode receber descarte automático.'), { statusCode: 409 });
        const retentionDays = clampNumber(req.body?.retentionDays, 30, 1, 90);
        await connection.execute('UPDATE empresas SET trial_delete_at = DATE_ADD(NOW(), INTERVAL ? DAY) WHERE nome = ?', [retentionDays, empresa]);
        trialEvent = { eventType: 'TRIAL_DELETION_SCHEDULED', title: 'Exclusão definitiva agendada', detail: `Os dados serão removidos em ${retentionDays} dia(s), salvo cancelamento.`, metadata: { retentionDays } };
      }

      if (action === 'cancel_delete') {
        await connection.execute('UPDATE empresas SET trial_delete_at = NULL WHERE nome = ?', [empresa]);
        trialEvent = { eventType: 'TRIAL_DELETION_CANCELLED', title: 'Exclusão agendada cancelada' };
      }

      if (['block_account', 'unblock_account'].includes(action)) {
        const accountId = Number(req.body?.accountId);
        const [[account]] = await connection.execute(
          'SELECT id, usuario, security_blocked FROM usuarios WHERE id = ? AND empresa = ? FOR UPDATE',
          [accountId, empresa]
        );
        if (!account) {
          throw Object.assign(new Error('Conta de teste não encontrada neste ambiente.'), { statusCode: 404 });
        }
        const shouldBlock = action === 'block_account';
        await connection.execute('UPDATE usuarios SET security_blocked = ? WHERE id = ?', [shouldBlock, account.id]);
        if (shouldBlock) {
          await connection.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE usuario_id = ? AND revogado = FALSE', [account.id]);
        }
        trialEvent = {
          eventType: shouldBlock ? 'TRIAL_ACCOUNT_BLOCKED' : 'TRIAL_ACCOUNT_UNBLOCKED',
          title: shouldBlock ? `Conta ${account.usuario} bloqueada` : `Conta ${account.usuario} liberada`,
          detail: shouldBlock ? 'As sessões desta conta foram revogadas sem bloquear os demais usuários do ambiente.' : 'O usuário pode voltar a autenticar normalmente.',
          metadata: { accountId: account.id, username: account.usuario }
        };
      }

      if (action === 'block') {
        await connection.execute("UPDATE empresas SET status = 'Suspensa', trial_stage = 'PAUSED' WHERE nome = ?", [empresa]);
        await connection.execute("UPDATE loja SET status = 'Suspensa' WHERE empresa = ? AND status <> 'Bloqueada'", [empresa]);
        await connection.execute(`
          UPDATE sessoes_ativas session
          JOIN usuarios user_account ON user_account.id = session.usuario_id
          SET session.revogado = TRUE
          WHERE user_account.empresa = ? AND session.revogado = FALSE
        `, [empresa]);
        trialEvent = { eventType: 'TRIAL_BLOCKED', title: 'Acesso bloqueado manualmente', detail: 'As sessões ativas foram revogadas.' };
      }

      if (action === 'unblock') {
        const trialExpired = company.access_mode === 'TRIAL' && company.trial_expires_at && new Date(company.trial_expires_at) <= new Date();
        await connection.execute(
          "UPDATE empresas SET status = 'Ativa', trial_auto_block = ?, trial_stage = IF(trial_stage = 'PAUSED', 'EVALUATION', trial_stage) WHERE nome = ?",
          [trialExpired ? false : Boolean(company.trial_auto_block), empresa]
        );
        await connection.execute("UPDATE loja SET status = 'Ativa' WHERE empresa = ? AND status = 'Suspensa'", [empresa]);
        trialEvent = { eventType: 'TRIAL_UNBLOCKED', title: 'Acesso liberado manualmente', detail: trialExpired ? 'Trial expirado mantido sob decisão manual.' : null };
      }

      if (action === 'extend') {
        const days = clampNumber(req.body?.days, 7, 1, 365);
        await connection.execute(`
          UPDATE empresas
          SET status = 'Ativa', access_mode = 'TRIAL', trial_auto_block = ?,
              trial_expires_at = DATE_ADD(GREATEST(COALESCE(trial_expires_at, NOW()), NOW()), INTERVAL ? DAY),
              trial_warning_sent_at = NULL
          WHERE nome = ?
        `, [req.body?.autoBlock !== false, days, empresa]);
        await connection.execute('DELETE FROM saas_trial_notifications WHERE empresa = ?', [empresa]);
        await connection.execute("UPDATE loja SET status = 'Ativa' WHERE empresa = ? AND status = 'Suspensa'", [empresa]);
        trialEvent = { eventType: 'TRIAL_EXTENDED', title: `Teste prorrogado por ${days} dia(s)`, metadata: { days, autoBlock: req.body?.autoBlock !== false } };
      }

      if (action === 'schedule') {
        const expiresOn = String(req.body?.expiresOn || '').slice(0, 10);
        const expiration = new Date(`${expiresOn}T23:59:59`);
        if (!isValidIsoDate(expiresOn) || expiration <= new Date()) {
          throw Object.assign(new Error('Escolha uma data futura válida para o encerramento.'), { statusCode: 400 });
        }
        const warningDays = clampNumber(req.body?.warningDays, 3, 1, 30);
        const autoBlock = req.body?.autoBlock !== false;
        await connection.execute(
          `UPDATE empresas SET status = 'Ativa', trial_expires_at = CONCAT(?, ' 23:59:59'),
             trial_auto_block = ?, trial_warning_days = ?, trial_warning_sent_at = NULL
           WHERE nome = ?`,
          [expiresOn, autoBlock, warningDays, empresa]
        );
        await connection.execute('DELETE FROM saas_trial_notifications WHERE empresa = ?', [empresa]);
        await connection.execute("UPDATE loja SET status = 'Ativa' WHERE empresa = ? AND status = 'Suspensa'", [empresa]);
        trialEvent = {
          eventType: 'TRIAL_RESCHEDULED',
          title: 'Data de encerramento alterada',
          detail: `Novo encerramento em ${expiresOn}; aviso com ${warningDays} dia(s) de antecedência.`,
          metadata: { expiresOn, warningDays, autoBlock }
        };
      }

      if (action === 'policy') {
        const warningDays = clampNumber(req.body?.warningDays, 3, 1, 30);
        await connection.execute(
          'UPDATE empresas SET trial_auto_block = ?, trial_warning_days = ?, trial_warning_sent_at = NULL WHERE nome = ?',
          [req.body?.autoBlock !== false, warningDays, empresa]
        );
        trialEvent = {
          eventType: 'TRIAL_POLICY_UPDATED',
          title: 'Política de vencimento atualizada',
          detail: `${req.body?.autoBlock !== false ? 'Bloqueio automático' : 'Decisão manual'}; aviso ${warningDays} dia(s) antes.`,
          metadata: { warningDays, autoBlock: req.body?.autoBlock !== false }
        };
      }

      if (action === 'note') {
        const note = String(req.body?.note || '').trim();
        const stage = String(req.body?.stage || company.trial_stage || 'NEW').toUpperCase();
        const allowedStages = new Set(['NEW', 'EVALUATION', 'ENGAGED', 'NEGOTIATION', 'NO_RESPONSE', 'PAUSED', 'LOST']);
        if (note.length < 3 || note.length > 2000) {
          throw Object.assign(new Error('A anotação deve ter entre 3 e 2000 caracteres.'), { statusCode: 400 });
        }
        if (!allowedStages.has(stage)) {
          throw Object.assign(new Error('Estágio de acompanhamento inválido.'), { statusCode: 400 });
        }
        await connection.execute('UPDATE empresas SET trial_stage = ? WHERE nome = ?', [stage, empresa]);
        trialEvent = { eventType: 'TRIAL_NOTE', title: 'Acompanhamento registrado', detail: note, metadata: { stage } };
      }

      if (action === 'convert') {
        const plan = String(req.body?.plan || '').toUpperCase();
        const monthlyValue = Number(req.body?.monthlyValue || 0);
        const firstDueDate = String(req.body?.firstDueDate || '').slice(0, 10);
        const dueDate = new Date(`${firstDueDate}T12:00:00`);
        const firstDueDateIsValid = isValidIsoDate(firstDueDate);
        if (!new Set(['FREE', 'PRO', 'ENTERPRISE']).has(plan)) throw Object.assign(new Error('Plano comercial inválido.'), { statusCode: 400 });
        if (plan !== 'FREE' && (!Number.isFinite(monthlyValue) || monthlyValue <= 0 || !firstDueDateIsValid)) {
          throw Object.assign(new Error('Informe valor e vencimento válidos.'), { statusCode: 400 });
        }
        const dueDay = plan === 'FREE' ? null : Number(firstDueDate.slice(8, 10));
        await connection.execute(`
          UPDATE empresas SET status = 'Ativa', access_mode = 'CUSTOMER', trial_started_at = NULL,
            trial_expires_at = NULL, trial_warning_sent_at = NULL, trial_stage = 'WON',
            trial_paused_at = NULL, trial_delete_at = NULL WHERE nome = ?
        `, [empresa]);
        await connection.execute("UPDATE loja SET status = 'Ativa' WHERE empresa = ? AND status = 'Suspensa'", [empresa]);
        await connection.execute(`
          INSERT INTO saas_tenant_settings (filial, plano, retention_days, custom_monthly_price, billing_due_day)
          VALUES (?, ?, 30, ?, ?)
          ON DUPLICATE KEY UPDATE plano = VALUES(plano), custom_monthly_price = VALUES(custom_monthly_price),
            billing_due_day = VALUES(billing_due_day)
        `, [store?.nome, plan, plan === 'FREE' ? null : monthlyValue, dueDay]);
        if (plan !== 'FREE') {
          await connection.execute(`
            INSERT INTO faturas_saas
              (filial, plano, valor_base, total, data_vencimento, ciclo_mes, ciclo_ano, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDENTE')
            ON DUPLICATE KEY UPDATE plano = VALUES(plano), valor_base = VALUES(valor_base),
              total = VALUES(total), data_vencimento = VALUES(data_vencimento), status = 'PENDENTE'
          `, [store?.nome, plan, monthlyValue, monthlyValue, firstDueDate, dueDate.getMonth() + 1, dueDate.getFullYear()]);
        }
        trialEvent = {
          eventType: 'TRIAL_CONVERTED',
          title: `Convertido para o plano ${plan}`,
          detail: plan === 'FREE' ? 'Conta convertida sem cobrança recorrente.' : `Mensalidade de R$ ${monthlyValue.toFixed(2)} com primeiro vencimento em ${firstDueDate}.`,
          metadata: { plan, monthlyValue: plan === 'FREE' ? null : monthlyValue, firstDueDate: plan === 'FREE' ? null : firstDueDate }
        };
      }

      await registrarEventoTrial(connection, {
        empresa,
        ...trialEvent,
        actorId: req.userId,
        actorLabel: `DEV #${req.userId}`
      });

      await connection.commit();
      connection.release();
      connection = null;
      invalidateAllSessionCaches(extrairTokenAutenticacao(req));
      await registrarAuditoria('TRIAL_MANAGED', req.userRole, `${empresa}: ${action}`, action === 'block' ? 'danger' : 'warning');
      if (io) io.emit('atualizacao_dados', { tipo: 'trial', empresa, action });
      res.json({ success: true, empresa, action });
    } catch (error) {
      if (connection) {
        try { await connection.rollback(); } catch {}
        connection.release();
      }
      console.error('[TRIAL] Falha ao gerenciar demonstração:', error.message);
      res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Falha ao atualizar o ambiente de demonstração.' });
    }
  });

  /**
   * Endpoint POST /api/pre-cadastros/:id/rejeitar.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/pre-cadastros/:id/rejeitar
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/pre-cadastros/:id/rejeitar', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' }); try { const [result] = await pool.execute('UPDATE pre_cadastros SET status = "rejeitado" WHERE id = ? AND status = "pendente"', [req.params.id]); if (!result.affectedRows) return res.status(409).json({ error: 'Este requerimento já foi processado.' }); if (io) io.emit('onboarding_updated', { id: Number(req.params.id), status: 'rejeitado' }); res.json({ success: true }); } catch (error) { res.status(500).send(); } });

  /**
   * Endpoint GET /api/system/changelog.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/system/changelog
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/system/changelog', verificarToken, async (req, res) => { try { const [rows] = await pool.execute('SELECT * FROM system_changelog ORDER BY date DESC, id DESC LIMIT 20'); res.json(rows); } catch (error) { res.status(500).json({ error: 'Erro ao carregar o changelog do sistema.' }); } });

  /**
   * Endpoint POST /api/system/changelog.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/system/changelog
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/system/changelog', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito a desenvolvedores.' }); const { version, title, type, desc_text } = req.body; if (!version || !title || !desc_text) return res.status(400).json({ error: 'Campos obrigatórios ausentes.' }); try { await pool.execute('INSERT INTO system_changelog (version, title, type, desc_text, author) VALUES (?, ?, ?, ?, ?)', [version, title, type || 'Improvement', desc_text, req.userRole || 'DEV']); io.emit('novo_changelog', { version, title }); res.status(201).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Falha ao registrar versão.' }); } });

  /**
   * Endpoint GET /api/tecnicos/ativos.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/tecnicos/ativos
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/tecnicos/ativos', verificarToken, requireRoles('DEV'), async (req, res) => { try { const [rows] = await pool.execute('SELECT id, nome, telefone FROM tecnicos ORDER BY nome ASC'); res.json(rows); } catch (error) { res.status(500).json({ error: 'Erro ao listar técnicos.' }); } });

  /**
   * Endpoint POST /api/tecnicos.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/tecnicos
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/tecnicos', verificarToken, requireRoles('DEV'), async (req, res) => { const { nome, telefone } = req.body; if (!nome) return res.status(400).json({ error: 'Nome do técnico é obrigatório.' }); try { const [result] = await pool.execute('INSERT INTO tecnicos (nome, telefone) VALUES (?, ?)', [nome, telefone || '']); res.status(201).json({ id: result.insertId, nome, telefone }); } catch (error) { res.status(500).json({ error: 'Falha ao cadastrar técnico.' }); } });

  /**
   * Endpoint PUT /api/chamados/:id/atribuir-tecnico.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route PUT /api/chamados/:id/atribuir-tecnico
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.put('/api/chamados/:id/atribuir-tecnico', verificarToken, requireRoles('MANUTENCAO', 'ADMIN', 'DEV'), async (req, res) => { const { tecnico_id, tecnico_nome } = req.body; try { let query = 'UPDATE chamados SET tecnico_id = ?, tecnico_responsavel = ? WHERE id = ?'; let params = [tecnico_id || null, tecnico_nome || null, req.params.id]; ({ query, params } = aplicarEscopoChamado(req, query, params)); const [result] = await pool.execute(query, params); if (result.affectedRows === 0) return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão.' }); io.emit('atualizacao_dados'); res.json({ success: true }); } catch (error) { res.status(500).json({ error: 'Erro ao atribuir técnico.' }); } });

  // ============================================================================
  // MOTOR MQTT - RECEPÇÃO DE TELEMETRIA E SINCRONIZAÇÃO DE HARDWARE
  // ============================================================================
  const mqttClientRecv = mqtt.connect(getMqttBrokerUrl(), getMqttClientOptions());
  const telemetriaSchemaReady = pool.execute(`
    CREATE TABLE IF NOT EXISTS telemetria_ingestao (
      leitura_uid VARCHAR(96) NOT NULL PRIMARY KEY,
      equipamento_id INT NOT NULL,
      recebida_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_telemetria_ingestao_equipamento (equipamento_id, recebida_em),
      CONSTRAINT telemetria_ingestao_ibfk_1
        FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);


  /**
   * Processa a interacao de confirmar leitura mqtt e atualiza a interface conforme o resultado.
   *
   * Responsabilidade: mantém este comportamento isolado para que validação,
   * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
   *
   * Fluxo principal:
   * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
   *
   * Efeitos colaterais: publica ou consome mensagens MQTT
   *
   * @param {string|number} equipamentoId - Identificador do registro ou recurso processado.
   * @param {string|number} leituraUid - Identificador do registro ou recurso processado.
   * @returns {void} Não devolve valor; comunica o resultado por estado, evento ou efeito colateral.
   * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
   */
  const confirmarLeituraMqtt = (equipamentoId, leituraUid) => {
    if (!leituraUid || !mqttClientRecv.connected) return;
    mqttClientRecv.publish(
      `termosync/ack/${equipamentoId}`,
      JSON.stringify({ leitura_uid: leituraUid, status: 'persistida' }),
      { qos: 1, retain: false }
    );
  };

  mqttClientRecv.on('connect', () => {
    console.log('🟢 [MQTT] Backend conectado ao Broker. Escutando ESP32...');
    mqttClientRecv.subscribe('termosync/telemetria');
    mqttClientRecv.subscribe('termosync/hardware/+/pedir_config');
  });

  mqttClientRecv.on('message', async (topic, message) => {

    // 1. ESP32 PEDINDO CONFIGURAÇÃO DO BANCO DE DADOS (PLUG & PLAY)
    if (topic.startsWith('termosync/hardware/') && topic.endsWith('/pedir_config')) {
      const idEquipamento = topic.split('/')[2];
      try {
        const [eq] = await pool.execute('SELECT temp_max FROM equipamentos WHERE id = ?', [idEquipamento]);
        if (eq.length > 0) {
          const tMax = parseFloat(eq[0].temp_max) || 30.0;
          const tAtencao = tMax - 2.0;
          const payloadConfig = JSON.stringify(montarComandoMqtt("CONFIG", null, {
            temp_critica: tMax,
            temp_atencao: tAtencao
          }));
          mqttClientRecv.publish(`termosync/comandos/${idEquipamento}`, payloadConfig, { qos: 1, retain: false });
          console.log(`📡 [MQTT] Banco de Dados -> ESP32 ID ${idEquipamento}: Temp Máx atualizada para ${tMax}°C`);
        }
      } catch (err) {
        console.error('❌ [ERRO BD] Falha ao buscar config para ESP32:', err.message);
      }
      return;
    }

    // 2. RECEBENDO LEITURAS DE TELEMETRIA NORMAIS
    if (topic === 'termosync/telemetria') {
      let uidRegistrado = null;
      let leituraPersistida = false;
      try {
        const rawPayload = message.toString();
        const payload = JSON.parse(rawPayload);

        let isMaintenance = false;
        try {
          const [sys] = await pool.execute('SELECT valor FROM configuracoes WHERE chave = "maintenanceMode"');
          if (sys.length > 0 && sys[0].valor === '1') isMaintenance = true;
        } catch (err) {
          console.warn('[SYSTEM] Falha ao verificar modo manutenção para telemetria MQTT:', err.message);
        }

        if (isMaintenance) return;

        const {
          equipamento_id, temperatura, umidade, alerta_forcado, consumo_kwh,
          motor_ligado, em_degelo, mac_address, ip_local, sinal_wifi, uptime, uptime_ms,
          firmware_version, temperatura_valida, umidade_valida, leitura_uid,
          timestamp, timestamp_valido
        } = payload;

        const telemetria = validarTelemetria({
          equipamento_id, temperatura, umidade, consumo_kwh,
          temperatura_valida, umidade_valida
        });
        const t = telemetria.temperatura;
        const u = telemetria.umidade;
        const c_kwh = telemetria.consumo;

        const leituraUid = typeof leitura_uid === 'string' && /^[A-Fa-f0-9]{12}-\d+-\d+$/.test(leitura_uid)
          ? leitura_uid.slice(0, 96)
          : null;
        if (leituraUid) {
          await telemetriaSchemaReady;
          const [dedup] = await pool.execute(
            'INSERT IGNORE INTO telemetria_ingestao (leitura_uid, equipamento_id) VALUES (?, ?)',
            [leituraUid, equipamento_id]
          );
          if (dedup.affectedRows === 0) {
            confirmarLeituraMqtt(equipamento_id, leituraUid);
            return;
          }
          uidRegistrado = leituraUid;
        }

        const hw_mac = (mac_address || 'A4:CF:12:XX:XX:XX').substring(0, 20);
        const hw_ip = (ip_local || '192.168.1.100').substring(0, 15);
        const hw_wifi = sinal_wifi ? parseInt(sinal_wifi) : -65;
        const hw_up = String(uptime ?? uptime_ms ?? '0').substring(0, 50);
        const hw_fw = (firmware_version || 'v1.0.0').substring(0, 20);

        try {
          await pool.execute(`
            INSERT INTO hardware_iot (equipamento_id, mac_address, ip_local, sinal_wifi, uptime, firmware_version, ultima_comunicacao)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              mac_address = ?, ip_local = ?, sinal_wifi = ?, uptime = ?, firmware_version = ?, ultima_comunicacao = NOW()
          `, [
            equipamento_id, hw_mac, hw_ip, hw_wifi, hw_up, hw_fw,
            hw_mac, hw_ip, hw_wifi, hw_up, hw_fw
          ]);
        } catch (e) {
          console.error("❌ ERRO BD HARDWARE (MQTT):", e.message);
        }

        const epoch = Number(timestamp);
        const agoraSegundos = Math.floor(Date.now() / 1000);
        const capturadaEm = timestamp_valido === true
          && Number.isInteger(epoch)
          && epoch >= 1609459200
          && epoch <= agoraSegundos + 86400
          ? new Date(epoch * 1000)
          : new Date();
        const [r] = await pool.execute(
          'INSERT INTO leituras (equipamento_id, temperatura, umidade, consumo_kwh, data_hora) VALUES (?, ?, ?, ?, ?)',
          [equipamento_id, t, u, c_kwh, capturadaEm]
        );
        leituraPersistida = true;
        confirmarLeituraMqtt(equipamento_id, leituraUid);
        const [eq] = await pool.execute('SELECT temp_max, temp_min, umidade_min, umidade_max, nome, em_degelo, motor_ligado, setor, filial, empresa FROM equipamentos WHERE id = ?', [equipamento_id]);

        if (eq.length > 0) {
          /**
           * Verifica a condicao is motor ligado e retorna um valor booleano.
           *
           * Responsabilidade: mantém este comportamento isolado para que validação,
           * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
           *
           * Fluxo principal:
           * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
           * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
           *
           * Efeitos colaterais: acessa a camada de persistência; publica ou consome mensagens MQTT; registra informações de diagnóstico
           *
           * @param {unknown} motor_ligado - Valor de motor ligado consumido por esta rotina.
           * @param {unknown} em_degelo - Valor de em degelo consumido por esta rotina.
           * @param {unknown} isEmDegelo - Valor de is em degelo consumido por esta rotina.
           * @param {unknown} tipoAlerta - Valor de tipo alerta consumido por esta rotina.
           * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
           * @returns {boolean} Indica se a condição avaliada foi atendida.
           * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
           */
          const isMotorLigado = (motor_ligado == 1 || motor_ligado === true);
          /**
           * Verifica a condicao is em degelo e retorna um valor booleano.
           *
           * Responsabilidade: mantém este comportamento isolado para que validação,
           * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
           *
           * Fluxo principal:
           * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
           * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
           *
           * Efeitos colaterais: acessa a camada de persistência; publica ou consome mensagens MQTT; registra informações de diagnóstico
           *
           * @param {unknown} em_degelo - Valor de em degelo consumido por esta rotina.
           * @param {unknown} em_degelo - Valor de em degelo consumido por esta rotina.
           * @param {unknown} isEmDegelo - Valor de is em degelo consumido por esta rotina.
           * @param {unknown} tipoAlerta - Valor de tipo alerta consumido por esta rotina.
           * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
           * @returns {boolean} Indica se a condição avaliada foi atendida.
           * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
           */
          const isEmDegelo = (em_degelo == 1 || em_degelo === true);
          await pool.execute('UPDATE equipamentos SET motor_ligado=?, em_degelo=? WHERE id=?', [isMotorLigado, isEmDegelo, equipamento_id]);

          const tMax = parseFloat(eq[0].temp_max);
          const tMin = parseFloat(eq[0].temp_min);
          const uMax = parseFloat(eq[0].umidade_max || 0);
          const uMin = parseFloat(eq[0].umidade_min || 0);

          let novosAlertas = [];


          /**
           * Concentra a logica de check and alert para manter o restante do rota/API mais legivel.
           *
           * Responsabilidade: mantém este comportamento isolado para que validação,
           * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
           *
           * Fluxo principal:
           * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
           * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
           * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
           *
           * Efeitos colaterais: acessa a camada de persistência; publica ou consome mensagens MQTT; registra informações de diagnóstico
           *
           * @param {unknown} condicaoAnomala - Valor de condicao anomala consumido por esta rotina.
           * @param {unknown} tipoAlerta - Valor de tipo alerta consumido por esta rotina.
           * @param {unknown} mensagem - Valor de mensagem consumido por esta rotina.
           * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
           * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
           */
          const checkAndAlert = async (condicaoAnomala, tipoAlerta, mensagem) => {
            const alertKey = `${equipamento_id}:${tipoAlerta}`;
            const pendingState = alertConditionPending.get(alertKey);
            if (!pendingState || pendingState.value !== condicaoAnomala) {
              alertConditionPending.set(alertKey, { value: condicaoAnomala, since: Date.now() });
              return;
            }
            if (Date.now() - pendingState.since < ALERT_STABILITY_MS) return;
            if (alertConditionState.get(alertKey) === condicaoAnomala || alertChecksInFlight.has(alertKey)) return;
            alertChecksInFlight.add(alertKey);
            try {
              if (condicaoAnomala) {
                const [existe] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=? LIMIT 1', [equipamento_id, tipoAlerta]);
                if (existe.length > 0) alertLastCreatedAt.set(alertKey, Date.now());
                if (existe.length === 0) {
                  let lastCreatedAt = alertLastCreatedAt.get(alertKey) || 0;
                  if (!lastCreatedAt) {
                    const [recentAlerts] = await pool.execute('SELECT data_hora FROM notificacoes WHERE equipamento_id=? AND tipo_alerta=? ORDER BY id DESC LIMIT 1', [equipamento_id, tipoAlerta]);
                    lastCreatedAt = recentAlerts[0]?.data_hora ? new Date(recentAlerts[0].data_hora).getTime() : 0;
                    if (lastCreatedAt) alertLastCreatedAt.set(alertKey, lastCreatedAt);
                  }
                  if (Date.now() - lastCreatedAt >= ALERT_REOPEN_COOLDOWN_MS) {
                    const [inserido] = await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta, resolvido) VALUES (?, ?, ?, 0)', [equipamento_id, mensagem, tipoAlerta]);
                    alertLastCreatedAt.set(alertKey, Date.now());
                    novosAlertas.push({ id: inserido.insertId, equipamento_id, mensagem, tipo_alerta: tipoAlerta });
                    enviarAlertaCriticoMulticanal({ tipoAlerta, equipamento: eq[0].nome, filial: eq[0].filial, mensagem }).catch((err) => console.warn('[ALERTA] Falha multicanal:', err.message));

                    if (tipoAlerta === 'MECANICA' || tipoAlerta === 'TEMPERATURA') {
                       console.log(`📱 [WHATSAPP - MQTT] Enviando alerta para gerência da loja ${eq[0].filial}: ${mensagem}`);
                       const [responsaveis] = await pool.execute('SELECT telefone FROM usuarios WHERE filial = ? AND role IN ("LOJA", "MANUTENCAO") AND telefone IS NOT NULL', [eq[0].filial]);
                       if (responsaveis.length > 0) {
                         const zapMsg = `🚨 *TERMOSYNC: ALERTA CRÍTICO* 🚨\n\n*Filial:* ${eq[0].filial}\n*Máquina:* ${eq[0].nome}\n*Anomalia:* ${mensagem}\n\n🤖 Responda:\n*[ 1 ]* Ligar compressor remotamente\n*[ 2 ]* Ignorar alerta`;
                         enviarAlertaWhatsApp(responsaveis[0].telefone, zapMsg, equipamento_id, eq[0].nome);
                       }
                    }
                  }
                }
              } else {
                const [resolved] = await pool.execute('UPDATE notificacoes SET resolvido=1 WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
                if (resolved.affectedRows > 0) alertLastCreatedAt.set(alertKey, Date.now());
              }
              alertConditionState.set(alertKey, condicaoAnomala);
            } finally {
              alertChecksInFlight.delete(alertKey);
            }
          };

          const condRede = (alerta_forcado === 'REDE');
          await checkAndAlert(condRede, 'REDE', `FALHA IoT/REDE: Sensor offline em "${eq[0].nome}".`);

          const condPorta = (alerta_forcado === 'PORTA_ABERTA');
          await checkAndAlert(condPorta, 'PORTA', `PORTA ABERTA: O equipamento "${eq[0].nome}" está com a porta violada!`);

          const condMecanica = (!isMotorLigado && !isEmDegelo && alerta_forcado !== 'REDE' && t >= (tMax + 10.0));
          await checkAndAlert(condMecanica, 'MECANICA', `MOTOR PARADO: O compressor de "${eq[0].nome}" falhou e a temperatura subiu!`);

          const condTemp = ((t > tMax || t < tMin) && !isEmDegelo);
          await checkAndAlert(condTemp, 'TEMPERATURA', `ALERTA TÉRMICO: "${eq[0].nome}" fora da faixa (${t}°C).`);

          if (u !== null && (uMax > 0 || uMin > 0)) {
            const condUmi = ((u > uMax || u < uMin) && !isEmDegelo);
            await checkAndAlert(condUmi, 'UMIDADE', `ALERTA HIGROMÉTRICO: Umidade de "${eq[0].nome}" fora dos limites permitidos (${u}%).`);
          }

          if (novosAlertas.length > 0) { io.emit('atualizacao_dados'); novosAlertas.forEach(a => io.emit('novo_alerta', a)); }
          const eventoLeitura = { id: r.insertId, equipamento_id, temperatura: t, umidade: u, consumo_kwh: c_kwh, motor_ligado: isMotorLigado, em_degelo: isEmDegelo, ultima_comunicacao: new Date(), status_conexao: 'online', data_hora: capturadaEm, nome: eq[0].nome, setor: eq[0].setor, filial: eq[0].filial, empresa: eq[0].empresa };
          io.emit('nova_leitura', eventoLeitura);
          // O monitor serial recebe a telemetria pelo backend, sem depender de
          // acesso HTTP direto ao ESP32 a partir do navegador do desenvolvedor.
          io.to('system_health_dev').emit('edge_serial_data', {
            ...eventoLeitura,
            origem: 'mqtt',
            raw_payload: rawPayload,
            leitura_uid: leituraUid,
            ip_local: hw_ip,
            mac_address: hw_mac,
            sinal_wifi: hw_wifi,
            firmware_version: hw_fw,
            device_uuid: payload.device_uuid || null,
            wifi_ok: payload.wifi_ok !== false,
            mqtt_ok: true,
            ntc_ok: payload.temperatura_valida !== false,
            dht_ok: payload.umidade_valida !== false,
            heap_livre: Number(payload.heap_livre) || null,
            heap_minimo: Number(payload.heap_minimo) || null,
            ultimo_reset: payload.ultimo_reset || null,
            estado: payload.estado_controle || null,
            controle_manual: Boolean(payload.controle_manual),
            rele: Boolean(payload.motor_ligado)
          });
        }
      } catch (error) {
        if (uidRegistrado && !leituraPersistida) {
          try { await pool.execute('DELETE FROM telemetria_ingestao WHERE leitura_uid = ?', [uidRegistrado]); }
          catch (cleanupError) { console.warn('[MQTT] Falha ao liberar UID após erro:', cleanupError.message); }
        }
        console.error('❌ [ERRO MQTT]: Falha ao processar payload', error.message);
      }
    }
  });

  // ============================================================================
  // ROTAS DO RASPBERRY PI (NETWORK SCANNER PROBE VIA API)
  // ============================================================================


  /**
   * Endpoint POST /api/soc/scanner/iniciar.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/soc/scanner/iniciar
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/soc/scanner/iniciar', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    const filial = normalizeCredential(req.body?.filial, 100);
    const ipRange = normalizeCredential(req.body?.ip_range, 32);
    const networkMode = String(req.body?.network_mode || 'AUTO').toUpperCase() === 'MANUAL' ? 'MANUAL' : 'AUTO';
    const ports = normalizeProbePorts(req.body?.ports);
    if (!filial) return res.status(400).json({ error: 'Selecione a filial responsável pela sonda.' });
    const parsedRange = expandPrivateCidr(ipRange, 64);
    if (!parsedRange) return res.status(400).json({ error: 'Informe uma faixa CIDR IPv4 privada válida entre /16 e /32.' });

    try {
      const [result] = await pool.execute(
        'INSERT INTO scanner_jobs (filial, ip_range, network_mode, ports_json) VALUES (?, ?, ?, ?)',
        [filial, parsedRange.cidr, networkMode, JSON.stringify(ports.length ? ports : NETWORK_PROBE_SERVICES.map((item) => item.porta))]
      );
      io?.emit('network_probe_job_updated', { id: result.insertId, filial, status: 'Pendente' });
      res.json({ success: true, id: result.insertId, message: `Ordem enfileirada para a sonda de ${filial}.` });
    } catch(e) {
      res.status(500).json({ error: 'Erro ao registrar ordem de varredura.' });
    }
  });

  /** Lista os jobs recentes para acompanhamento pelo console do desenvolvedor. */
  /**
   * Endpoint GET /api/soc/scanner/jobs.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/soc/scanner/jobs
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/soc/scanner/jobs', verificarToken, requireRoles('DEV'), async (_req, res) => {
    try {
      const [jobs] = await pool.execute('SELECT * FROM scanner_jobs ORDER BY id DESC LIMIT 100');
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao carregar a fila de sondas.' });
    }
  });

  /** Lista agentes Raspberry/edge e calcula disponibilidade pelo heartbeat. */
  /**
   * Endpoint GET /api/soc/scanner/agents.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/soc/scanner/agents
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/soc/scanner/agents', verificarToken, requireRoles('DEV'), async (_req, res) => {
    try {
      const [agents] = await pool.execute(`
        SELECT agent_id, filial, hostname, platform, architecture, agent_version,
               local_ip, gateway, detected_cidr, interfaces_json, metadata_json,
               first_seen_at, last_seen_at,
               TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) AS seconds_since_seen
        FROM network_probe_agents
        ORDER BY last_seen_at DESC
      `);
      res.json(agents.map((agent) => ({ ...agent, online: Number(agent.seconds_since_seen) <= 90 })));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao carregar agentes de rede.' });
    }
  });

  /** Entrega ao agente Nmap apenas os alvos IoT privados cadastrados na filial. */
  /**
   * Endpoint GET /api/soc/scanner/agent/iot-targets.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/soc/scanner/agent/iot-targets
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/soc/scanner/agent/iot-targets', verificarAgenteSonda, async (req, res) => {
    const filial = normalizeCredential(req.query?.filial, 100);
    if (!filial) return res.status(400).json({ error: 'Informe a filial do agente.' });
    try {
      const [devices] = await pool.execute(`
        SELECT h.equipamento_id, h.ip_local AS ip, h.mac_address AS mac,
               h.firmware_version AS firmware, h.ultima_comunicacao AS last_seen,
               e.nome, e.filial, e.setor
        FROM hardware_iot h
        LEFT JOIN equipamentos e ON e.id = h.equipamento_id
        WHERE (? = 'Todas' OR e.filial = ?)
          AND h.ip_local IS NOT NULL AND h.ip_local NOT IN ('', '0.0.0.0')
        ORDER BY e.filial, e.nome
      `, [filial, filial]);
      const targets = devices.filter((device) => isPrivateIpv4(String(device.ip || '').trim()));
      res.json({ filial, targets, count: targets.length, generatedAt: new Date().toISOString() });
    } catch (error) {
      console.error('[NETWORK PROBE AGENT] Falha ao listar alvos IoT:', error.message);
      res.status(500).json({ error: 'Falha ao buscar dispositivos IoT cadastrados.' });
    }
  });

  /** Registra a rede realmente conectada ao Raspberry Pi e sua saúde básica. */
  /**
   * Endpoint POST /api/soc/scanner/agent/heartbeat.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/soc/scanner/agent/heartbeat
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/soc/scanner/agent/heartbeat', verificarAgenteSonda, async (req, res) => {
    const filial = normalizeCredential(req.body?.filial, 100);
    if (!filial) return res.status(400).json({ error: 'A filial do agente é obrigatória.' });
    const interfaces = Array.isArray(req.body?.interfaces) ? req.body.interfaces.slice(0, 16) : [];
    try {
      await pool.execute(`
        INSERT INTO network_probe_agents
          (agent_id, filial, hostname, platform, architecture, agent_version, local_ip, gateway, detected_cidr, interfaces_json, metadata_json, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          filial = VALUES(filial), hostname = VALUES(hostname), platform = VALUES(platform),
          architecture = VALUES(architecture), agent_version = VALUES(agent_version),
          local_ip = VALUES(local_ip), gateway = VALUES(gateway), detected_cidr = VALUES(detected_cidr),
          interfaces_json = VALUES(interfaces_json), metadata_json = VALUES(metadata_json), last_seen_at = NOW()
      `, [
        req.networkProbeAgentId, filial,
        normalizeCredential(req.body?.hostname, 120), normalizeCredential(req.body?.platform, 40),
        normalizeCredential(req.body?.architecture, 40), normalizeCredential(req.body?.version, 30),
        normalizeCredential(req.body?.localIp, 45), normalizeCredential(req.body?.gateway, 45),
        normalizeCredential(req.body?.cidr, 50), JSON.stringify(interfaces),
        JSON.stringify(req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {})
      ]);
      io?.emit('network_probe_agent_updated', { agentId: req.networkProbeAgentId, filial });
      res.json({ success: true, serverTime: new Date().toISOString() });
    } catch (error) {
      console.error('[NETWORK PROBE AGENT] Falha no heartbeat:', error.message);
      res.status(500).json({ error: 'Falha ao registrar heartbeat do agente.' });
    }
  });

  /** Reserva atomicamente um job e entrega ao Pi os IoT cadastrados da filial. */
  /**
   * Endpoint GET /api/soc/scanner/agent/work.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/soc/scanner/agent/work
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/soc/scanner/agent/work', verificarAgenteSonda, async (req, res) => {
    const filial = normalizeCredential(req.query?.filial, 100);
    if (!filial) return res.status(400).json({ error: 'Informe a filial do agente.' });
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      await connection.execute(`
        UPDATE scanner_jobs
        SET status = 'Pendente', agent_id = NULL, claimed_at = NULL,
            error_message = 'Job devolvido à fila após perda de heartbeat do agente.'
        WHERE status = 'Em andamento' AND claimed_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      `);
      const [jobs] = await connection.execute(
        `SELECT * FROM scanner_jobs
         WHERE (filial = ? OR filial = 'Todas') AND status = 'Pendente'
         ORDER BY (filial = ?) DESC, data_criacao ASC LIMIT 1 FOR UPDATE`,
        [filial, filial]
      );
      const job = jobs[0] || null;
      if (job) {
        await connection.execute(
          `UPDATE scanner_jobs SET status = 'Em andamento', agent_id = ?, claimed_at = NOW(), error_message = NULL
           WHERE id = ? AND status = 'Pendente'`,
          [req.networkProbeAgentId, job.id]
        );
        job.status = 'Em andamento';
        job.agent_id = req.networkProbeAgentId;
      }
      await connection.commit();

      const [iotDevices] = await pool.execute(`
        SELECT h.equipamento_id, h.ip_local AS ip, h.mac_address AS mac,
               h.firmware_version AS firmware, h.ultima_comunicacao AS last_seen,
               e.nome, e.filial, e.setor
        FROM hardware_iot h
        LEFT JOIN equipamentos e ON e.id = h.equipamento_id
        WHERE e.filial = ? AND h.ip_local IS NOT NULL AND h.ip_local NOT IN ('', '0.0.0.0')
        ORDER BY e.nome
      `, [filial]);
      let parsedPorts = [];
      if (job?.ports_json) {
        try { parsedPorts = normalizeProbePorts(typeof job.ports_json === 'string' ? JSON.parse(job.ports_json) : job.ports_json); }
        catch (_error) { parsedPorts = []; }
      }
      if (job) io?.emit('network_probe_job_updated', { id: job.id, filial, status: job.status, agentId: req.networkProbeAgentId });
      res.json({ job: job ? { ...job, ports: parsedPorts } : null, iotDevices, pollAfterMs: 15000 });
    } catch (error) {
      if (connection) await connection.rollback().catch(() => {});
      console.error('[NETWORK PROBE AGENT] Falha ao reservar job:', error.message);
      res.status(500).json({ error: 'Falha ao buscar trabalho para o agente.' });
    } finally {
      connection?.release();
    }
  });

  /** Persiste o relatório produzido na rede local do Pi e conclui seu job. */
  /**
   * Endpoint POST /api/soc/scanner/agent/jobs/:id/complete.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/soc/scanner/agent/jobs/:id/complete
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/soc/scanner/agent/jobs/:id/complete', verificarAgenteSonda, async (req, res) => {
    const jobId = Number(req.params.id);
    const devices = Array.isArray(req.body?.devices) ? req.body.devices.slice(0, 4096) : [];
    if (!Number.isInteger(jobId) || jobId <= 0) return res.status(400).json({ error: 'Job inválido.' });
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [jobs] = await connection.execute('SELECT * FROM scanner_jobs WHERE id = ? AND agent_id = ? FOR UPDATE', [jobId, req.networkProbeAgentId]);
      if (!jobs[0]) {
        await connection.rollback();
        return res.status(404).json({ error: 'Job não pertence a este agente.' });
      }
      for (const device of devices) {
        const ipAddress = normalizeCredential(device?.ip, 45);
        if (!isPrivateIpv4(ipAddress)) continue;
        await connection.execute(
          `INSERT INTO rede_scans
            (filial, ip_alvo, hostname, portas_abertas, status, agent_id, equipamento_id, mac_address, source_type, latency_ms, source_address)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            jobs[0].filial === 'Todas' ? normalizeCredential(req.body?.filial, 100) || 'Todas' : jobs[0].filial,
            ipAddress, normalizeCredential(device?.hostname || 'Host sem nome', 100),
            JSON.stringify(parseProbeReportPorts(device?.portas)), normalizeCredential(device?.status || 'Online', 20),
            req.networkProbeAgentId, Number(device?.equipamentoId) || null,
            normalizeCredential(device?.macAddress, 20), device?.registeredIot ? 'IOT_INVENTORY' : 'DISCOVERY',
            Number.isFinite(Number(device?.latencyMs)) ? Math.max(0, Math.round(Number(device.latencyMs))) : null,
            normalizeCredential(device?.sourceAddress, 45)
          ]
        );
      }
      await connection.execute(
        `UPDATE scanner_jobs SET status = 'Concluido', source_cidr = ?, completed_at = NOW(), error_message = NULL WHERE id = ?`,
        [normalizeCredential(req.body?.cidr, 50), jobId]
      );
      await connection.commit();
      io?.emit('network_probe_job_updated', { id: jobId, status: 'Concluido', agentId: req.networkProbeAgentId });
      io?.emit('network_probe_results_updated', { filial: req.body?.filial, agentId: req.networkProbeAgentId });
      res.json({ success: true, stored: devices.length });
    } catch (error) {
      if (connection) await connection.rollback().catch(() => {});
      console.error('[NETWORK PROBE AGENT] Falha ao concluir job:', error.message);
      res.status(500).json({ error: 'Falha ao armazenar o relatório do agente.' });
    } finally {
      connection?.release();
    }
  });

  /** Registra falha da execução remota para diagnóstico no console. */
  /**
   * Endpoint POST /api/soc/scanner/agent/jobs/:id/fail.
   *
   * Responsabilidade: recebe a requisição, aplica validação executada pelo próprio handler,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/soc/scanner/agent/jobs/:id/fail
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/soc/scanner/agent/jobs/:id/fail', verificarAgenteSonda, async (req, res) => {
    const jobId = Number(req.params.id);
    if (!Number.isInteger(jobId) || jobId <= 0) return res.status(400).json({ error: 'Job inválido.' });
    try {
      const [result] = await pool.execute(
        `UPDATE scanner_jobs SET status = 'Erro', completed_at = NOW(), error_message = ? WHERE id = ? AND agent_id = ?`,
        [normalizeCredential(req.body?.error || 'Falha não detalhada pelo agente.', 500), jobId, req.networkProbeAgentId]
      );
      if (!result.affectedRows) return res.status(404).json({ error: 'Job não pertence a este agente.' });
      io?.emit('network_probe_job_updated', { id: jobId, status: 'Erro', agentId: req.networkProbeAgentId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao registrar erro do agente.' });
    }
  });


  /**
   * Endpoint GET /api/soc/scanner/jobs/:filial.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/soc/scanner/jobs/:filial
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/soc/scanner/jobs/:filial', verificarToken, requireRoles('DEV'), async (req, res) => {
    const { filial } = req.params;
    try {
      const [jobs] = await pool.execute(
        'SELECT * FROM scanner_jobs WHERE (filial = ? OR filial = "Todas") AND status = "Pendente"',
        [filial]
      );
      res.json({ jobs });
    } catch(e) {
      res.status(500).json({ error: 'Erro ao buscar jobs.' });
    }
  });


  /**
   * Endpoint POST /api/soc/scanner/jobs/:id/concluir.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/soc/scanner/jobs/:id/concluir
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/soc/scanner/jobs/:id/concluir', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      await pool.execute('UPDATE scanner_jobs SET status = "Concluido" WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch(e) {
      res.status(500).json({ error: 'Erro ao concluir job.' });
    }
  });

  /** Cancela somente jobs ainda pendentes, preservando o histórico da fila. */
  /**
   * Endpoint DELETE /api/soc/scanner/jobs/:id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route DELETE /api/soc/scanner/jobs/:id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.delete('/api/soc/scanner/jobs/:id', verificarToken, requireRoles('DEV'), async (req, res) => {
    const jobId = Number(req.params.id);
    if (!Number.isInteger(jobId) || jobId <= 0) return res.status(400).json({ error: 'Job inválido.' });
    try {
      const [result] = await pool.execute(
        'UPDATE scanner_jobs SET status = "Cancelado" WHERE id = ? AND status = "Pendente"',
        [jobId]
      );
      if (!result.affectedRows) return res.status(409).json({ error: 'O job não está mais pendente.' });
      io?.emit('network_probe_job_updated', { id: jobId, status: 'Cancelado' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao cancelar o job.' });
    }
  });


  /**
   * Endpoint POST /api/soc/scanner/resultado.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/soc/scanner/resultado
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/soc/scanner/resultado', verificarToken, requireRoles('DEV'), async (req, res) => {
    const relatorio = req.body;
    const dispositivos = Array.isArray(relatorio?.dispositivos) ? relatorio.dispositivos.slice(0, 256) : [];
    const filial = normalizeCredential(relatorio?.filial, 100);
    if (!filial || dispositivos.length === 0) return res.status(400).json({ error: 'Relatório de sonda inválido.' });
    try {
      console.log(`🛡️ [SOC API] Relatório de Rede recebido da filial: ${filial}`);

      for (const disp of dispositivos) {
        const ipAddress = normalizeCredential(disp?.ip, 45);
        if (!isPrivateIpv4(ipAddress)) continue;
        const hostname = normalizeCredential(disp?.hostname || 'Host sem nome', 180);
        const ports = parseProbeReportPorts(disp?.portas);
        await pool.execute(
          `INSERT INTO rede_scans (filial, ip_alvo, hostname, portas_abertas, status)
           VALUES (?, ?, ?, ?, 'Online')`,
          [filial, ipAddress, hostname, JSON.stringify(ports)]
        );
      }

      io?.emit('network_probe_results_updated', { filial });
      io?.emit('atualizacao_dados');
      res.json({ success: true, message: 'Relatório armazenado com sucesso no MySQL.' });
    } catch(e) {
      res.status(500).json({ error: 'Erro ao salvar resultados da varredura.' });
    }
  });


  /**
   * Endpoint GET /api/soc/scanner/resultados.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/soc/scanner/resultados
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/soc/scanner/resultados', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    try {
      const limit = clampNumber(req.query.limit, 250, 1, 500);
      const filial = normalizeCredential(req.query.filial, 100);
      const where = filial && filial !== 'Todas' ? ' WHERE filial = ?' : '';
      const params = filial && filial !== 'Todas' ? [filial, limit] : [limit];
      const [rows] = await pool.execute(`SELECT * FROM rede_scans${where} ORDER BY data_scan DESC LIMIT ?`, params);
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: 'Erro ao buscar resultados.' });
    }
  });

  // ============================================================================
  // NOVAS ROTAS DA FASE 1: PAINEL DE TV E RELATÓRIO ANVISA
  // ============================================================================


  /**
   * Endpoint GET /api/public/live/:filial.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/public/live/:filial
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/public/live/:filial', verificarToken, async (req, res) => {
    try {
      const filialSolicitada = normalizeCredential(req.params.filial, 100) || 'Todas';
      const filialUsuario = normalizeCredential(req.userFilial, 100);
      const empresaUsuario = normalizeCredential(req.userEmpresa, 180);
      const isDeveloper = req.userRole === 'DEV';
      const usuarioTemFilialEspecifica = filialUsuario && filialUsuario.toLowerCase() !== 'todas';
      const filialEfetiva = isDeveloper
        ? filialSolicitada
        : usuarioTemFilialEspecifica ? filialUsuario : 'Todas';

      let query = `
        SELECT e.id, e.nome, e.filial, e.setor, e.motor_ligado, e.em_degelo, e.temp_max, e.temp_min,
          latest_reading.temperatura AS ultima_temp,
          latest_reading.data_hora AS atualizado_em
        FROM equipamentos e
        LEFT JOIN equipamento_ultima_leitura latest_reading
          ON latest_reading.equipamento_id = e.id
      `;
      const conditions = [];
      const params = [];

      // Perfis comuns nunca consultam dados de outra empresa, mesmo alterando a URL.
      if (!isDeveloper) {
        conditions.push('e.empresa = ?');
        params.push(empresaUsuario);
      }

      if (filialEfetiva.toLowerCase() !== 'todas') {
        conditions.push('e.filial = ?');
        params.push(filialEfetiva);
      }

      if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;

      const [r] = await pool.execute(query, params);
      res.json({ success: true, unidade: filialEfetiva, equipamentos: r });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Falha ao carregar o Painel TV.' });
    }
  });


  /**
   * Endpoint GET /api/relatorios/anvisa/:equipamento_id.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/relatorios/anvisa/:equipamento_id
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/relatorios/anvisa/:equipamento_id', verificarToken, async (req, res) => {
    const { equipamento_id } = req.params;
    try {
      let equipamentoQuery = 'SELECT nome, filial, setor FROM equipamentos WHERE id = ?';
      const equipamentoParams = [equipamento_id];
      if (req.userRole !== 'DEV') {
        equipamentoQuery += ' AND empresa = ?';
        equipamentoParams.push(req.userEmpresa);
        if (req.userRole === 'LOJA') {
          equipamentoQuery += ' AND filial = ?';
          equipamentoParams.push(req.userFilial);
        }
      }

      const [eq] = await pool.execute(equipamentoQuery, equipamentoParams);
      if (eq.length === 0) return res.status(404).json({ success: false, error: 'Equipamento não encontrado ou sem permissão.' });

      const [rows] = await pool.execute(`
        SELECT DATE(data_hora) as data_registro,
               MAX(temperatura) as temp_maxima,
               MIN(temperatura) as temp_minima,
               AVG(temperatura) as temp_media
        FROM leituras
        WHERE equipamento_id = ? AND data_hora >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(data_hora)
        ORDER BY data_registro DESC
      `, [equipamento_id]);

      res.json({ success: true, equipamento: eq[0], historico_diario: rows });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Falha ao processar laudo oficial.' });
    }
  });


  /**
   * Endpoint GET /api/network-scan/config.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/network-scan/config
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/network-scan/config', verificarToken, requireRoles('DEV', 'ADMIN'), async (_req, res) => {
    const { networks, preferred, gateway } = await getNetworkProbeConfig();
    res.json({
      recommendedCidr: preferred?.cidr || '192.168.1.0/24',
      defaultNetworkKey: preferred?.key || null,
      gateway,
      interfaces: networks,
      maxHostsPerScan: 128,
      maxPortsPerScan: 20,
      services: NETWORK_PROBE_SERVICES
    });
  });


  /**
   * Endpoint GET /api/network-scan.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route GET /api/network-scan
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.get('/api/network-scan', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV' && req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso restrito.' });
    }
    const { networks, preferred } = await getNetworkProbeConfig();
    const selectedAddress = normalizeCredential(req.query.interfaceAddress, 45);
    const selectedNetwork = networks.find((item) => item.address === selectedAddress) || preferred;
    const requestedCidr = normalizeCredential(req.query.cidr, 32) || selectedNetwork?.cidr || '192.168.1.0/24';
    const limit = clampNumber(req.query.limit, 64, 1, 128);
    const range = expandPrivateCidr(requestedCidr, limit);
    if (!range) return res.status(400).json({ error: 'CIDR inválido. Use uma faixa IPv4 privada entre /16 e /32.' });

    const requestedPorts = normalizeProbePorts(req.query.ports);
    const ports = requestedPorts.length ? requestedPorts : NETWORK_PROBE_SERVICES.map((item) => item.porta);
    const startedAt = new Date();
    try {
      let iotQuery = `
        SELECT h.equipamento_id, h.ip_local, h.mac_address, h.sinal_wifi,
               h.firmware_version, h.ultima_comunicacao,
               TIMESTAMPDIFF(SECOND, h.ultima_comunicacao, NOW()) AS segundos_sem_sinal,
               e.nome, e.filial, e.empresa, e.setor, e.tipo
        FROM hardware_iot h
        LEFT JOIN equipamentos e ON e.id = h.equipamento_id
        WHERE h.ip_local IS NOT NULL AND h.ip_local NOT IN ('', '0.0.0.0')
      `;
      const iotParams = [];
      if (req.userRole !== 'DEV') {
        iotQuery += ' AND e.empresa = ?';
        iotParams.push(req.userEmpresa);
      }
      iotQuery += ' ORDER BY h.ultima_comunicacao DESC, h.equipamento_id';
      const [iotRows] = await pool.execute(iotQuery, iotParams);
      const registeredIot = iotRows.filter((item) => isPrivateIpv4(String(item.ip_local || '').trim()));
      const iotAddresses = registeredIot.map((item) => String(item.ip_local).trim());
      const addressesToProbe = [...new Set([...range.addresses, ...iotAddresses])];

      /**
       * Concentra a logica de resolve source address para manter o restante do rota/API mais legivel.
       *
       * Responsabilidade: mantém este comportamento isolado para que validação,
       * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
       *
       * Fluxo principal:
       * - Processa os dados recebidos e entrega o resultado ao ponto que iniciou o fluxo.
       *
       * Efeitos colaterais: não possui efeitos externos identificados; opera apenas sobre os valores recebidos.
       *
       * @param {unknown} targetAddress - Valor de target address consumido por esta rotina.
       * @returns {unknown} Resultado calculado para consumo do chamador.
       * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
       */
      const resolveSourceAddress = (targetAddress) => networks.find((item) => isIpv4InCidr(targetAddress, item.cidr))?.address || selectedNetwork?.address;
      const probedDevices = await scanPrivateAddresses(addressesToProbe, ports, 450, resolveSourceAddress);
      const probedByIp = new Map(probedDevices.map((item) => [item.ip, item]));
      const registeredIpSet = new Set(iotAddresses);

      const discoveredDevices = probedDevices.filter((item) => !registeredIpSet.has(item.ip));
      const iotDevices = registeredIot.map((item) => {
        const ipAddress = String(item.ip_local).trim();
        const probe = probedByIp.get(ipAddress);
        const secondsSinceSeen = item.segundos_sem_sinal === null ? null : Math.max(0, Number(item.segundos_sem_sinal));
        const telemetryOnline = secondsSinceSeen !== null && secondsSinceSeen <= 180;
        const networkReachable = Boolean(probe?.portas?.length);
        return {
          ip: ipAddress,
          hostname: item.nome || `IoT #${item.equipamento_id}`,
          portas: probe?.portas || [],
          latencyMs: probe?.latencyMs ?? null,
          sourceAddress: probe?.sourceAddress || resolveSourceAddress(ipAddress) || null,
          status: networkReachable && telemetryOnline ? 'Online' : telemetryOnline ? 'Telemetria ativa' : networkReachable ? 'IP acessível' : 'Sem resposta',
          registeredIot: true,
          networkReachable,
          telemetryOnline,
          equipamentoId: item.equipamento_id,
          filial: item.filial,
          empresa: item.empresa,
          setor: item.setor,
          tipo: item.tipo,
          macAddress: item.mac_address,
          signalDbm: item.sinal_wifi === null ? null : Number(item.sinal_wifi),
          firmwareVersion: item.firmware_version,
          lastSeen: item.ultima_comunicacao,
          secondsSinceSeen
        };
      });
      const devices = [...iotDevices, ...discoveredDevices];
      res.json({
        success: true,
        subnet: range.cidr,
        dispositivos: devices,
        metadata: {
          startedAt: startedAt.toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt.getTime(),
          scannedHosts: range.addresses.length,
          availableHosts: range.totalHosts,
          truncated: range.truncated,
          testedPorts: ports,
          registeredIotCount: registeredIot.length,
          reachableIotCount: iotDevices.filter((item) => item.networkReachable || item.telemetryOnline).length,
          unreachableIotCount: iotDevices.filter((item) => !item.networkReachable && !item.telemetryOnline).length,
          totalAddressesTested: addressesToProbe.length,
          iotInventoryTruncated: false,
          gateway: selectedNetwork?.gateway || null,
          sourceInterface: selectedNetwork || null,
          interfaces: networks
        }
      });
    } catch (error) {
      console.error('[NETWORK PROBE] Falha na varredura:', error.message);
      res.status(500).json({ error: 'Falha ao executar a varredura de rede.' });
    }
  });

  /** Revalida um único host privado com um perfil de portas informado pelo DEV. */
  /**
   * Endpoint POST /api/network-scan/host.
   *
   * Responsabilidade: recebe a requisição, aplica autenticação e autorização,
   * delega a regra de negócio e devolve um contrato HTTP serializável.
   * Entradas: parâmetros de rota/query e corpo definidos pelo consumidor da API.
   * Saídas: resposta de sucesso ou erro normalizado com status HTTP apropriado.
   * Efeitos colaterais: pode consultar ou alterar persistência e serviços integrados.
   *
   * @route POST /api/network-scan/host
   * @maintenance-generated v3 - Contrato documental do endpoint Express.
   */
  app.post('/api/network-scan/host', verificarToken, requireRoles('DEV'), async (req, res) => {
    const ipAddress = normalizeCredential(req.body?.ip, 45);
    if (!isPrivateIpv4(ipAddress)) return res.status(400).json({ error: 'Informe um IPv4 privado válido.' });
    const requestedPorts = normalizeProbePorts(req.body?.ports);
    const ports = requestedPorts.length ? requestedPorts : NETWORK_PROBE_SERVICES.map((item) => item.porta);
    const startedAt = Date.now();
    try {
      const devices = await scanPrivateAddresses([ipAddress], ports, 650);
      res.json({
        success: true,
        host: devices[0] || { ip: ipAddress, hostname: 'Sem serviços TCP detectados', portas: [], latencyMs: null },
        testedPorts: ports,
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      res.status(500).json({ error: 'Falha ao revalidar o host.' });
    }
  });

  // ============================================================================
  // WATCHDOG: MOTOR AUTÔNOMO DE DETECÇÃO DE QUEDA DE HARDWARE
  // ============================================================================
  if (!app.locals.termosyncHealthMonitorStarted) {
    app.locals.termosyncHealthMonitorStarted = true;
    const sampleIntervalSeconds = Math.max(5, Number(process.env.HEALTH_SAMPLE_INTERVAL_SECONDS || 10));
    const retentionDays = Math.max(1, Number(process.env.HEALTH_HISTORY_RETENTION_DAYS || 7));
    let samplesSinceCleanup = 0;

    /**
     * Coleta, persiste e transmite uma amostra única para todos os painéis conectados.
     *
     * Responsabilidade: mantém este comportamento isolado para que validação,
     * atualização de estado e integração possam evoluir sem duplicação em outros blocos.
     *
     * Fluxo principal:
     * - Valida as condições de entrada e interrompe caminhos que não podem prosseguir.
     * - Executa a operação protegida e converte falhas para o tratamento previsto pelo módulo.
     * - Aguarda as operações assíncronas antes de confirmar o resultado ao chamador.
     *
     * Efeitos colaterais: troca eventos em tempo real; acessa a camada de persistência; publica ou consome mensagens MQTT; registra informações de diagnóstico
     *
     * @returns {Promise<void>} Promise concluída quando todas as etapas assíncronas terminam.
     * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
     */
    const collectSystemHealth = async () => {
      try {
        const snapshot = await getSystemHealthSnapshot({
          mqttConnected: mqttClientRecv?.connected,
          whatsappStatus: wpStatus,
          socketClients: io?.engine?.clientsCount || 0
        });
        const [result] = await pool.execute(`
          INSERT INTO system_health_history (
            status, database_status, mqtt_status, whatsapp_status,
            response_time_ms, database_latency_ms, cpu_percent,
            event_loop_utilization, rss_mb, heap_used_mb, heap_total_mb,
            external_mb, socket_clients, error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          snapshot.status,
          snapshot.database,
          snapshot.mqtt,
          snapshot.whatsapp,
          snapshot.responseTimeMs,
          snapshot.databaseLatencyMs,
          snapshot.cpuPercent,
          snapshot.eventLoopUtilization,
          snapshot.memory?.rssMb,
          snapshot.memory?.heapUsedMb,
          snapshot.memory?.heapTotalMb,
          snapshot.memory?.externalMb,
          snapshot.runtime?.socketClients || 0,
          snapshot.error ? String(snapshot.error).slice(0, 500) : null
        ]);
        const event = { ...snapshot, id: String(result.insertId), at: Date.now(), api: snapshot.status, source: 'realtime' };
        if (io) io.to('system_health_dev').emit('system_health_update', event);

        samplesSinceCleanup += 1;
        if (samplesSinceCleanup >= Math.ceil(3600 / sampleIntervalSeconds)) {
          samplesSinceCleanup = 0;
          await pool.execute('DELETE FROM system_health_history WHERE recorded_at < DATE_SUB(NOW(), INTERVAL ? DAY)', [retentionDays]);
        }
      } catch (error) {
        console.warn('[HEALTH] Falha ao persistir amostra:', error.message);
      }
    };

    setTimeout(collectSystemHealth, 3000);
    const healthMonitorInterval = setInterval(collectSystemHealth, sampleIntervalSeconds * 1000);
    healthMonitorInterval.unref?.();
    console.log(`[HEALTH] Monitor em tempo real ativo a cada ${sampleIntervalSeconds}s. Retenção: ${retentionDays} dia(s).`);
  }

  setInterval(async () => {
    try {
      const [hardwaresMortos] = await pool.execute(`
        SELECT h.equipamento_id, h.ultima_comunicacao, e.nome, e.setor, e.filial, e.empresa
        FROM hardware_iot h JOIN equipamentos e ON h.equipamento_id = e.id
        WHERE h.ultima_comunicacao < DATE_SUB(NOW(), INTERVAL 3 MINUTE)
          AND e.is_virtual = FALSE
      `);

      for (const hw of hardwaresMortos) {
        const [alertaAberto] = await pool.execute(`SELECT id FROM notificacoes WHERE equipamento_id = ? AND tipo_alerta = 'REDE' AND (resolvido = 0 OR resolvido IS NULL)`, [hw.equipamento_id]);
        if (alertaAberto.length === 0) {
          const msg = `FALHA CRÍTICA (TIMEOUT): O sensor físico em "${hw.nome}" parou de transmitir dados há mais de 3 minutos!`;
          await pool.execute(`INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta, resolvido) VALUES (?, ?, 'REDE', 0)`, [hw.equipamento_id, msg]);
          if (io) io.emit('atualizacao_dados');
        }
      }
    } catch (error) {
      console.error('[WATCHDOG] Falha ao verificar hardware offline:', error.message);
    }
  }, 60000);

  // Mantém os ativos de demonstração atualizados sem iniciar o simulador DEV
  // nem aceitar telemetria externa. Apenas trials ativos entram na consulta.
  if (!app.locals.termosyncDemoTelemetryStarted) {
    app.locals.termosyncDemoTelemetryStarted = true;
    const demoIntervalSeconds = Math.max(60, Number(process.env.DEMO_TELEMETRY_INTERVAL_SECONDS || 120));
    const collectDemoTelemetry = async () => {
      try {
        await generateDemoTelemetry(pool, io);
      } catch (error) {
        console.warn('[TRIAL] Falha ao gerar telemetria virtual:', error.message);
      }
    };
    const initialDemoTelemetry = setTimeout(collectDemoTelemetry, 10000);
    initialDemoTelemetry.unref?.();
    const demoTelemetryInterval = setInterval(collectDemoTelemetry, demoIntervalSeconds * 1000);
    demoTelemetryInterval.unref?.();
    console.log(`[TRIAL] Telemetria virtual ativa a cada ${demoIntervalSeconds}s.`);
  }

  // Processa avisos e bloqueios automáticos sem interferir em demonstrações
  // permanentes ou em trials configurados para decisão manual do desenvolvedor.
  if (!app.locals.termosyncTrialLifecycleStarted) {
    app.locals.termosyncTrialLifecycleStarted = true;
    const lifecycleIntervalMinutes = Math.max(15, Number(process.env.TRIAL_LIFECYCLE_INTERVAL_MINUTES || 60));
    const processTrialLifecycle = async () => {
      try {
        const [expiredTrials] = await pool.execute(`
          SELECT nome FROM empresas
          WHERE access_mode = 'TRIAL' AND status = 'Ativa' AND trial_auto_block = TRUE
            AND trial_expires_at IS NOT NULL AND trial_expires_at <= NOW()
        `);
        for (const trial of expiredTrials) {
          await pool.execute("UPDATE empresas SET status = 'Suspensa', trial_delete_at = COALESCE(trial_delete_at, DATE_ADD(NOW(), INTERVAL 30 DAY)) WHERE nome = ?", [trial.nome]);
          await pool.execute("UPDATE loja SET status = 'Suspensa' WHERE empresa = ? AND status <> 'Bloqueada'", [trial.nome]);
          await pool.execute(`
            UPDATE sessoes_ativas session
            JOIN usuarios user_account ON user_account.id = session.usuario_id
            SET session.revogado = TRUE
            WHERE user_account.empresa = ? AND session.revogado = FALSE
          `, [trial.nome]);
          await registrarEventoTrial(pool, {
            empresa: trial.nome,
            eventType: 'TRIAL_AUTO_BLOCKED',
            title: 'Acesso bloqueado no vencimento',
            detail: 'Bloqueio automático executado pela política configurada.'
          });
          await registrarAuditoria('TRIAL_AUTO_BLOCKED', 'Sistema', `Trial expirado: ${trial.nome}`, 'danger');
        }
        if (expiredTrials.length) invalidateAllSessionCaches();

        const [warningTrials] = await pool.execute(`
          SELECT nome, email, trial_expires_at, DATEDIFF(DATE(trial_expires_at), CURDATE()) AS milestone_days
          FROM empresas
          WHERE access_mode = 'TRIAL' AND status = 'Ativa' AND trial_expires_at > NOW()
            AND DATEDIFF(DATE(trial_expires_at), CURDATE()) IN (7, 3, 1)
            AND NOT EXISTS (
              SELECT 1 FROM saas_trial_notifications notification
               WHERE notification.empresa = empresas.nome
                 AND notification.milestone_days = DATEDIFF(DATE(empresas.trial_expires_at), CURDATE())
            )
        `);
        const transporter = warningTrials.length ? criarTransporterEmail() : null;
        for (const trial of warningTrials) {
          if (!transporter || !trial.email) continue;
          const expirationDate = new Date(trial.trial_expires_at).toLocaleDateString('pt-BR');
          const developerRecipient = process.env.TRIAL_ALERT_EMAIL || process.env.SMTP_USER || '';
          const recipients = [...new Set([trial.email, developerRecipient].filter(Boolean))];
          await transporter.sendMail({
            from: SMTP_FROM,
            to: recipients.join(', '),
            subject: `TermoSync | ${trial.milestone_days} dia(s) para o fim do teste`,
            html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Seu teste está perto do fim</h2><p>Olá, <strong>${escapeHtml(trial.nome)}</strong>.</p><p>Restam <strong>${trial.milestone_days} dia(s)</strong>. O ambiente ficará disponível até <strong>${escapeHtml(expirationDate)}</strong>. Entre em contato com a equipe TermoSync para prorrogar o período ou escolher um plano.</p></div>`
          });
          await pool.execute('INSERT IGNORE INTO saas_trial_notifications (empresa, milestone_days, recipient) VALUES (?, ?, ?)', [trial.nome, trial.milestone_days, recipients.join(', ')]);
          await pool.execute('UPDATE empresas SET trial_warning_sent_at = NOW() WHERE nome = ?', [trial.nome]);
          await registrarEventoTrial(pool, {
            empresa: trial.nome,
            eventType: 'TRIAL_WARNING_SENT',
            title: `Aviso de ${trial.milestone_days} dia(s) enviado`,
            detail: `E-mail enviado para ${trial.email}; encerramento em ${expirationDate}.`,
            metadata: { expirationDate, milestoneDays: trial.milestone_days }
          });
          await registrarAuditoria('TRIAL_EXPIRATION_WARNING_SENT', 'Sistema', `${trial.nome}: ${expirationDate}`, 'warning');
        }

        const [trialsToDelete] = await pool.execute(`
          SELECT nome FROM empresas
           WHERE access_mode = 'TRIAL' AND trial_delete_at IS NOT NULL AND trial_delete_at <= NOW()
        `);
        for (const trial of trialsToDelete) {
          let cleanupConnection;
          try {
            cleanupConnection = await pool.getConnection();
            await cleanupConnection.beginTransaction();
            const deleted = await deleteTrialTenantData(cleanupConnection, trial.nome);
            await cleanupConnection.commit();
            cleanupConnection.release();
            cleanupConnection = null;
            deleted.userIds.forEach((id) => invalidateUserSessions(id));
            await registrarAuditoria('TRIAL_AUTO_DELETED', 'Sistema', trial.nome, 'danger');
          } catch (cleanupError) {
            if (cleanupConnection) { try { await cleanupConnection.rollback(); } catch {} cleanupConnection.release(); }
            console.warn(`[TRIAL] Falha ao excluir ${trial.nome}:`, cleanupError.message);
          }
        }
        if (trialsToDelete.length) invalidateAllSessionCaches();
      } catch (error) {
        console.warn('[TRIAL] Falha no ciclo de avisos e bloqueios:', error.message);
      }
    };
    const initialTrialLifecycle = setTimeout(processTrialLifecycle, 20000);
    initialTrialLifecycle.unref?.();
    const trialLifecycleInterval = setInterval(processTrialLifecycle, lifecycleIntervalMinutes * 60000);
    trialLifecycleInterval.unref?.();
  }

  if (envFlagEnabled(process.env.AUTO_BACKUP_ENABLED) && !app.locals.termosyncAutoBackupStarted) {
    app.locals.termosyncAutoBackupStarted = true;
    const intervalHours = Math.max(1, Number(process.env.AUTO_BACKUP_INTERVAL_HOURS || 24));
    const intervalMs = intervalHours * 60 * 60 * 1000;
    console.log(`[BACKUP] Backup automático ativo a cada ${intervalHours}h. Retenção: ${process.env.AUTO_BACKUP_RETENTION || 14} arquivo(s).`);

    if (envFlagEnabled(process.env.AUTO_BACKUP_RUN_ON_START)) {
      setTimeout(executarBackupAutomatico, 15000);
    }

    setInterval(executarBackupAutomatico, intervalMs);
  }

};
