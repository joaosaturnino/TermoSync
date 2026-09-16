require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const { verificarToken, SECRET_KEY } = require('../middlewares/auth');
const pool = require('../config/db');
const { registrarAuditoria, registrarEventoSeguranca, registrarHistoricoSuporte } = require('../utils/audit');
const { getSystemHealthSnapshot } = require('../services/systemHealthService');
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
const mqtt = require('mqtt');
const { Aedes } = require('aedes');

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
const resetPasswordAttempts = new Map();
const passwordResetRequestsInFlight = new Set();
const mfaLoginChallenges = new Map();
const hardwareTelemetryTouch = new Map();
let maintenanceModeCache = { checkedAt: 0, enabled: false };
let passwordResetSchemaReady = false;
const backupTables = ['usuarios', 'loja', 'equipamentos', 'chamados', 'notificacoes', 'tipos_refrigeracao', 'setores', 'audit_logs', 'security_events', 'chamados_comentarios', 'user_preferences'];

/**
 * Gera gerar backup json com os dados necessarios para o proximo passo.
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

// Cria o transporte SMTP sob demanda. Quando SMTP não está configurado,
// os fluxos continuam funcionando e retornam instruções ao DEV.
function criarTransporterEmail() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' }
  });
}

/**
 * Prepara escape html para exibicao sem expor dados sensiveis.
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
 */
function gerarSenhaProvisoria() {
  // Senha temporária usada no onboarding SaaS; deve ser trocada no primeiro acesso.
  return `${crypto.randomBytes(4).toString('hex')}T!${crypto.randomInt(10, 99)}`;
}

/**
 * Gera gerar codigo recuperacao com os dados necessarios para o proximo passo.
 */
function gerarCodigoRecuperacao() {
  // Código curto para o usuário digitar na segunda etapa da recuperação.
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Prepara mascarar email para exibicao sem expor dados sensiveis.
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
 */
function mascararTelefone(telefone) {
  // Mostra somente os últimos dígitos do telefone para orientar o usuário.
  const digits = String(telefone || '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `•••• ${digits.slice(-4)}`;
}

/**
 * Normaliza normalizar email para evitar divergencia de formato nas comparacoes.
 */
function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Normaliza normalizar telefone digits para evitar divergencia de formato nas comparacoes.
 */
function normalizarTelefoneDigits(telefone) {
  return String(telefone || '').replace(/\D/g, '');
}

/**
 * Normaliza normalizar telefone e164 para evitar divergencia de formato nas comparacoes.
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
 */
function envFlagEnabled(value) {
  return ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

/**
 * Verifica a condicao is textbelt configured e retorna um valor booleano.
 */
function isTextbeltConfigured() {
  return envFlagEnabled(process.env.TEXTBELT_ENABLED) || Boolean(process.env.TEXTBELT_API_KEY);
}

/**
 * Verifica a condicao is textbee configured e retorna um valor booleano.
 */
function isTextbeeConfigured() {
  return Boolean(process.env.TEXTBEE_API_KEY);
}

/**
 * Concentra a logica de mensagem erro sms recuperacao para manter o restante do rota/API mais legivel.
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
 */
function isPasswordResetLimited(key) {
  // Rate limit específico para recuperação de senha, separado do login normal.
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
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
 */
function getPasswordResetRequestKey({ usuario, canal, destino }) {
  return `${String(usuario || '').toLowerCase()}:${canal}:${String(destino || '').toLowerCase()}`;
}

/**
 * Verifica se uma solicitação de recuperação recente ainda está no período de reenvio bloqueado.
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
 */
function clampNumber(value, fallback, min, max) {
  // Normaliza limites vindos por query string para evitar consultas enormes.
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

/**
 * Verifica a condicao is maintenance mode enabled e retorna um valor booleano.
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
 * Valida validar root passcode antes de liberar a continuidade do fluxo.
 */
async function validarRootPasscode(passcode) {
  // Valida ações críticas contra hash root configurado ou senha de DEV.
  if (!passcode) return { ok: false };

  const [configRows] = await pool.execute(
    'SELECT valor FROM configuracoes WHERE chave = "master_root_hash" LIMIT 1'
  );

  if (configRows.length > 0 && configRows[0].valor) {
    const isMatch = await bcrypt.compare(passcode, configRows[0].valor);
    if (isMatch) return { ok: true, actor: 'Root/Dev', source: 'master_root_hash' };
  }

  const [devUsers] = await pool.execute(
    'SELECT usuario, senha FROM usuarios WHERE role = "DEV" LIMIT 5'
  );

  for (const user of devUsers) {
    const isMatch = await bcrypt.compare(passcode, user.senha);
    if (isMatch) return { ok: true, actor: user.usuario, source: 'dev_password' };
  }

  return { ok: false };
}

/**
 * Concentra a logica de token hash para manter o restante do rota/API mais legivel.
 */
function tokenHash(value) {
  // Hash fixo para comparar tokens sem armazenar/expor segredo em texto puro.
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

/**
 * Extrai extrair token autenticacao de uma entrada externa ou configuracao local.
 */
function extrairTokenAutenticacao(req) {
  // Aceita tanto "Bearer token" quanto token cru para compatibilidade com telas antigas.
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
}

/**
 * Valida validar token io t antes de liberar a continuidade do fluxo.
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
 * Valida validar telemetria antes de liberar a continuidade do fluxo.
 */
function validarTelemetria(payload) {
  // Validação de faixa protege o banco e as regras de alerta contra payloads inválidos.
  const equipamentoId = Number(payload.equipamento_id);
  const temperatura = Number(payload.temperatura);
  const umidade = payload.umidade === undefined || payload.umidade === null || payload.umidade === '' ? 50 : Number(payload.umidade);
  const consumo = payload.consumo_kwh === undefined || payload.consumo_kwh === null || payload.consumo_kwh === '' ? 0 : Number(payload.consumo_kwh);

  if (!Number.isInteger(equipamentoId) || equipamentoId <= 0) throw new Error('equipamento_id inválido.');
  if (!Number.isFinite(temperatura) || temperatura < -80 || temperatura > 80) throw new Error('temperatura fora da faixa segura.');
  if (!Number.isFinite(umidade) || umidade < 0 || umidade > 100) throw new Error('umidade fora da faixa segura.');
  if (!Number.isFinite(consumo) || consumo < 0 || consumo > 100000) throw new Error('consumo_kwh inválido.');

  return { equipamentoId, temperatura, umidade, consumo };
}

/**
 * Busca ou monta os dados de get mqtt client options usados no fluxo atual.
 */
function getMqttClientOptions() {
  // Credenciais MQTT são opcionais em ambiente local e recomendadas em produção.
  if (!process.env.MQTT_USERNAME || !process.env.MQTT_PASSWORD) return {};
  return {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
  };
}

/**
 * Concentra a logica de emitir sessao autenticada para manter o restante do rota/API mais legivel.
 */
async function emitirSessaoAutenticada(user, req) {
  // Centraliza criação de JWT e registro em sessoes_ativas para login normal/MFA.
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
    mfaEnabled: Boolean(user.mfa_enabled)
  };
}

/**
 * Concentra a logica de aplicar escopo chamado para manter o restante do rota/API mais legivel.
 */
function aplicarEscopoChamado(req, query, params, alias = '') {
  // Aplica isolamento multi-tenant em queries de chamados sem duplicar lógica.
  const prefix = alias ? `${alias}.` : '';
  if (req.userRole !== 'DEV') {
    query += ` AND (${prefix}empresa = ? OR ${prefix}empresa IS NULL OR ${prefix}empresa = "")`;
    params.push(req.userEmpresa);
    if (req.userRole === 'LOJA') {
      query += ` AND (${prefix}filial = ? OR ${prefix}filial IS NULL OR ${prefix}filial = "")`;
      params.push(req.userFilial);
    }
  }
  return { query, params };
}

/**
 * Executa executar consulta opcional coordenando as etapas principais desse fluxo.
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
 */
function extrairZipComSeguranca(zip, destino) {
  // Evita Zip Slip: nenhum arquivo do pacote pode sair do diretório de destino.
  const destinoResolvido = path.resolve(destino);
  for (const entry of zip.getEntries()) {
    const nomeNormalizado = entry.entryName.replace(/\\/g, '/');
    if (nomeNormalizado.startsWith('/') || nomeNormalizado.includes('../') || path.isAbsolute(nomeNormalizado)) {
      throw new Error(`Entrada insegura no pacote: ${entry.entryName}`);
    }

    const destinoArquivo = path.resolve(destinoResolvido, nomeNormalizado);
    if (destinoArquivo !== destinoResolvido && !destinoArquivo.startsWith(destinoResolvido + path.sep)) {
      throw new Error(`Entrada fora do diretório permitido: ${entry.entryName}`);
    }

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
    const mqttServer = require('net').createServer(mqttBroker.handle);

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
          || /^termosync\/hardware\/[^/]+\/pedir_config$/.test(topic)
          || topic.startsWith('termosync/solicitar_config/');
        callback(allowed ? null : new Error('Publicação MQTT negada.'));
      };

      mqttBroker.authorizeSubscribe = (client, sub, callback) => {
        const topic = String(sub.topic || '');
        const allowed = topic === 'termosync/telemetria'
          || topic === 'termosync/hardware/+/pedir_config'
          || topic.startsWith('termosync/comandos/');
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
    mqttServer.listen(1883, '0.0.0.0', function () {
      console.log('🚀 [BROKER MQTT] Aedes rodando e escutando em 0.0.0.0:1883!');
    });
  })
  .catch((error) => {
    console.error('❌ [MQTT] Falha ao iniciar o broker Aedes:', error.message);
  });

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

  /**
   * Concentra a logica de emitir operacao atualizada para manter o restante do rota/API mais legivel.
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
            const payload = JSON.stringify({ acao: "MANUAL_RELE", estado: 1 });
            const mqttCmd = mqtt.connect('mqtt://localhost:1883', getMqttClientOptions());
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

  // Rota de status do WhatsApp para o React
  app.get('/api/whatsapp/status', verificarToken, (req, res) => {
    res.json({ status: wpStatus, qr: wpQrUrl });
  });

  app.get('/api/health', async (req, res) => {
    const snapshot = await getSystemHealthSnapshot();
    const statusCode = snapshot.ok ? 200 : 503;
    res.status(statusCode).json({ ...snapshot, whatsapp: wpStatus });
  });

  // ============================================================================
  // ROTAS DO SIMULADOR (WEB SERIAL VIRTUAL) - Para Auto-Scroll React
  // ============================================================================
  app.get('/logs', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (Math.random() > 0.8) {
      const horaAtual = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const t = (Math.random() * 5 + 20).toFixed(2);
      const u = (Math.random() * 20 + 40).toFixed(1);
      const m = Math.random() > 0.5 ? 'LIGADO' : 'DESLIGADO';

      const novaLeitura = `\n==================================================\n 📡 [TELEMETRIA SIMULADOR] Nova Leitura\n==================================================\n 🕒  Data/Hora    : ${horaAtual}\n 🌡️  Temperatura  : ${t} °C\n 💧  Umidade      : ${u} %\n ⚙️  Atuador (M)  : ${m}\n 📶  Sinal Wi-Fi  : -45 dBm\n==================================================\n 📦 [PAYLOAD] : {"equipamento_id":0,"status":"OK"}\n`;

      simuladorLogBuffer += novaLeitura;
      if (simuladorLogBuffer.length > 15000) {
        simuladorLogBuffer = simuladorLogBuffer.substring(simuladorLogBuffer.length - 10000);
      }
    }
    res.send(simuladorLogBuffer);
  });

  app.post('/clear', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
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

  app.get('/api/chat/historico', verificarToken, async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT id, remetente_id AS remetenteId, remetente_nome AS remetenteNome, destino_id AS destinoId, texto, data_hora AS data FROM chat_mensagens ORDER BY data_hora ASC LIMIT 100');
      res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Erro ao carregar histórico de chat.' }); }
  });

  // ============================================================================
  // BUSINESS INTELLIGENCE (BI) E FATURAMENTO SAAS
  // ============================================================================
  app.get('/api/bi/analytics', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV' && req.userRole !== 'ADMIN') return res.status(403).json({ error: 'Acesso restrito.' });
    try {
      const [lojasRows] = await pool.query('SELECT COUNT(*) as total FROM loja WHERE status = "Ativa"');
      const [equipRows] = await pool.query('SELECT COUNT(*) as total FROM equipamentos');
      const totalLojas = Number(lojasRows[0]?.total || 0); const totalEquipamentos = Number(equipRows[0]?.total || 0);
      const [faturasRows] = await pool.query('SELECT plano, SUM(total) as receita, COUNT(*) as qtd FROM faturas_saas WHERE status = "PAGO" OR status = "PENDENTE" GROUP BY plano');

      let mrrReal = 0; const planoCounts = {};
      faturasRows.forEach(f => { mrrReal += Number(f.receita || 0); planoCounts[f.plano || 'PRO'] = Number(f.qtd || 0); });
      if (mrrReal === 0 && totalLojas > 0) mrrReal = totalLojas * 299.90;

      const arrReal = mrrReal * 12; const custoCloudReal = (totalLojas * 45) + (totalEquipamentos * 12);
      const lucroLiquido = mrrReal - custoCloudReal; const margemBruta = mrrReal > 0 ? Number(((lucroLiquido / mrrReal) * 100).toFixed(1)) : 0;

      const distribuicaoPlanos = [
        { name: 'Enterprise', value: planoCounts['ENTERPRISE'] || Math.max(1, Math.floor(totalLojas * 0.25)) },
        { name: 'Pro', value: planoCounts['PRO'] || Math.max(1, Math.floor(totalLojas * 0.60)) },
        { name: 'Free', value: planoCounts['FREE'] || Math.max(0, Math.floor(totalLojas * 0.15)) }
      ].filter(p => p.value > 0);

      const [riscoRows] = await pool.query(`SELECT e.id, e.nome as maquina, e.filial, e.motor_ligado, e.em_degelo, COUNT(n.id) as alertas_pendentes FROM equipamentos e LEFT JOIN notificacoes n ON n.equipamento_id = e.id AND (n.resolvido = 0 OR n.resolvido IS NULL) GROUP BY e.id, e.nome, e.filial, e.motor_ligado, e.em_degelo ORDER BY alertas_pendentes DESC, e.motor_ligado ASC LIMIT 6`);
      const analiseRisco = riscoRows.map(r => {
        let score = Number(r.alertas_pendentes) * 25; if (r.motor_ligado == 0 && r.em_degelo == 0) score += 45;
        return { id: r.id, maquina: `${r.maquina} (${r.filial || 'Matriz'})`, risco: Math.min(98, Math.max(5, score)), alertas: Number(r.alertas_pendentes), statusMotor: r.motor_ligado ? 'Ativo' : 'Parado' };
      });

      const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const mesAtualIdx = new Date().getMonth(); const dreData = [];
      for (let i = 5; i >= 0; i--) {
        let idx = (mesAtualIdx - i + 12) % 12; const fator = 1 - (i * 0.08);
        const receitaMes = Number((mrrReal * Math.max(0.45, fator)).toFixed(2)); const custoMes = Number((custoCloudReal * Math.max(0.55, fator)).toFixed(2));
        dreData.push({ name: mesesNomes[idx], Receita_SaaS: receitaMes, Custos_Cloud: custoMes, Lucro_Liquido: Number((receitaMes - custoMes).toFixed(2)) });
      }

      res.json({ kpis: { mrr: Number(mrrReal.toFixed(2)), arr: Number(arrReal.toFixed(2)), margem: Math.max(0, margemBruta), uptimeGlobal: 99.98, totalLojas, totalEquipamentos }, dreData, distribuicaoPlanos, analiseRisco });
    } catch (error) { res.status(500).json({ error: 'Falha no BI.' }); }
  });

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

  app.post('/api/financeiro/cobranca-lote', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    try {
      const dataAtual = new Date(); const mesAtual = dataAtual.getMonth() + 1; const anoAtual = dataAtual.getFullYear();
      const [filiaisRows] = await pool.query('SELECT DISTINCT nome FROM loja WHERE status = "Ativa"');
      for (const filial of filiaisRows.map(f => f.nome)) {
        await pool.query(`INSERT IGNORE INTO faturas_saas (filial, plano, valor_base, total, data_vencimento, ciclo_mes, ciclo_ano, status) VALUES (?, 'PRO', 299.9, 299.9, ?, ?, ?, 'PENDENTE')`, [filial, `${anoAtual}-${mesAtual}-10`, mesAtual, anoAtual]);
      }
      res.json({ success: true, message: "Lote processado!" });
    } catch (error) { res.status(500).json({ error: "Erro interno" }); }
  });

  // ============================================================================
  // ROTAS GERAIS E AUTENTICAÇÃO
  // ============================================================================
  app.get('/api/system/health', async (req, res) => {
    const snapshot = await getSystemHealthSnapshot();
    const statusCode = snapshot.ok ? 200 : 503;
    res.status(statusCode).json({ ...snapshot, whatsapp: wpStatus });
  });

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
      return res.status(500).json({ error: 'Falha ao registrar sessão segura.', requestId: req.security?.requestId });
    }
  });

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

      mfaLoginChallenges.delete(challengeId);
      await registrarEventoSeguranca({ eventType: 'MFA_SUCCESS', actor: users[0].usuario, ip, userAgent, severity: 'success', detail: 'Segundo fator validado.' });
      const sessionPayload = await emitirSessaoAutenticada(users[0], req);
      return res.json(sessionPayload);
    } catch (error) {
      return res.status(500).json({ error: 'Falha ao validar MFA.', requestId: req.security?.requestId });
    }
  });

  app.get('/api/auth/verify', verificarToken, async (req, res) => {
    try {
      if (req.userId === 9999) {
        return res.json({
          id: 9999,
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

  app.get('/api/auth/permissions', verificarToken, async (req, res) => {
    res.json({
      role: req.userRole,
      permissions: ROLE_PERMISSIONS[req.userRole] || []
    });
  });

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

  app.delete('/api/auth/sessions/:id', verificarToken, async (req, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId) || sessionId <= 0) return res.status(400).json({ error: 'Sessão inválida.', requestId: req.security?.requestId });
      const currentToken = extrairTokenAutenticacao(req);
      const [sessions] = await pool.execute('SELECT id, token FROM sessoes_ativas WHERE id = ? AND usuario_id = ? LIMIT 1', [sessionId, req.userId]);
      if (sessions.length === 0) return res.status(404).json({ error: 'Sessão não encontrada.', requestId: req.security?.requestId });
      if (sessions[0].token === currentToken) return res.status(409).json({ error: 'Use sair para encerrar a sessão atual.', requestId: req.security?.requestId });

      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE id = ? AND usuario_id = ?', [sessionId, req.userId]);
      await registrarEventoSeguranca({ eventType: 'USER_SESSION_REVOKED', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'warning', detail: `session=${sessionId}` });
      res.json({ success: true });
    } catch (error) {
      console.error('[AUTH] Erro ao revogar sessão:', error.message);
      res.status(500).json({ error: 'Falha ao revogar sessão.', requestId: req.security?.requestId });
    }
  });

  app.post('/api/auth/sessions/revoke-others', verificarToken, async (req, res) => {
    try {
      const currentToken = extrairTokenAutenticacao(req);
      const [result] = await pool.execute(
        'UPDATE sessoes_ativas SET revogado = TRUE WHERE usuario_id = ? AND token <> ? AND revogado = FALSE',
        [req.userId, currentToken]
      );
      await registrarEventoSeguranca({ eventType: 'USER_REVOKED_OTHER_SESSIONS', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'warning', detail: `revogadas=${result.affectedRows}` });
      res.json({ success: true, revoked: result.affectedRows });
    } catch (error) {
      console.error('[AUTH] Erro ao revogar outras sessões:', error.message);
      res.status(500).json({ error: 'Falha ao revogar outras sessões.', requestId: req.security?.requestId });
    }
  });

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
      await pool.execute('UPDATE usuarios SET senha = ?, password_changed_at = NOW() WHERE id = ?', [hash, req.userId]);
      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE usuario_id = ? AND token <> ?', [req.userId, currentToken]);
      await registrarAuditoria('PASSWORD_CHANGED', users[0].usuario, 'Senha alterada pelo usuário', 'success');
      await registrarEventoSeguranca({ eventType: 'PASSWORD_CHANGED', actor: users[0].usuario, ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'success', detail: 'Outras sessões revogadas.' });
      res.json({ success: true });
    } catch (error) {
      console.error('[AUTH] Erro ao alterar senha:', error.message);
      res.status(500).json({ error: 'Falha ao alterar senha.', requestId: req.security?.requestId });
    }
  });

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

  // ============================================================================
  // ROTAS DE EMPRESAS, LOJAS E USUÁRIOS
  // ============================================================================
  app.get('/api/empresas', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json([]);
    try { const [r] = await pool.execute('SELECT * FROM empresas ORDER BY nome ASC'); res.json(r); } catch (e) { res.status(500).json([]); }
  });
  app.post('/api/empresas', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('INSERT INTO empresas (nome, cnpj, contato, email, status) VALUES (?, ?, ?, ?, ?)', [req.body.nome, req.body.cnpj || null, req.body.contato || null, req.body.email || null, req.body.status || 'Ativa']); res.status(201).send(); } catch (e) { res.status(500).send(); } });
  app.delete('/api/empresas/:id', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('DELETE FROM empresas WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (error) { res.status(500).send(); } });

  app.get('/api/usuarios', verificarToken, async (req, res) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json([]);
    try {
      let q = 'SELECT id, usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa FROM usuarios WHERE 1=1'; let p = [];
      if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); }
      const [r] = await pool.execute(q + ' ORDER BY role ASC', p); res.json(r);
    } catch (error) { res.status(500).json([]); }
  });

  app.get('/api/lojas', verificarToken, async (req, res) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json([]);
    try {
      let q = 'SELECT * FROM loja WHERE 1=1'; let p = [];
      if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); }
      const [lojas] = await pool.execute(q + ' ORDER BY nome ASC', p);
      const [usuarios] = await pool.execute('SELECT filial, nome_gerente, nome_coordenador FROM usuarios');
      res.json(lojas.map(l => {
        const uGerente = usuarios.find(user => user.filial === l.nome && user.nome_gerente);
        const uCoord = usuarios.find(user => user.filial === l.nome && user.nome_coordenador);
        return { ...l, nome_gerente: uGerente ? uGerente.nome_gerente : null, nome_coordenador: uCoord ? uCoord.nome_coordenador : null };
      }));
    } catch (e) { res.status(500).json([]); }
  });

  // ============================================================================
  // ROTAS DE EQUIPAMENTOS
  // ============================================================================
  app.get('/api/equipamentos', verificarToken, async (req, res) => {
    try {
      let q = `
        SELECT e.*,
          (
            SELECT l.temperatura
            FROM leituras l
            WHERE l.equipamento_id = e.id
            ORDER BY l.id DESC
            LIMIT 1
          ) AS ultima_temp,
          (
            SELECT l.umidade
            FROM leituras l
            WHERE l.equipamento_id = e.id
            ORDER BY l.id DESC
            LIMIT 1
          ) AS ultima_umidade,
          h.mac_address,
          h.ip_local,
          h.sinal_wifi,
          h.uptime,
          h.firmware_version,
          h.ultima_comunicacao,
          TIMESTAMPDIFF(SECOND, h.ultima_comunicacao, NOW()) AS segundos_sem_sinal,
          CASE
            WHEN h.ultima_comunicacao IS NULL THEN 'sem-sinal'
            WHEN h.ultima_comunicacao >= DATE_SUB(NOW(), INTERVAL 3 MINUTE) THEN 'online'
            ELSE 'offline'
          END AS status_conexao
        FROM equipamentos e
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

  app.post('/api/equipamentos', verificarToken, async (req, res) => {
    try {
      const { nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao } = req.body;
      const uMinVal = (umidade_min === '' || umidade_min === undefined) ? null : parseFloat(umidade_min);
      const uMaxVal = (umidade_max === '' || umidade_max === undefined) ? null : parseFloat(umidade_max);
      await pool.execute('INSERT INTO equipamentos (nome, tipo, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao, empresa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [nome, tipo, temp_min, temp_max, uMinVal, uMaxVal, intervalo_degelo, duracao_degelo, setor, filial, data_calibracao || null, req.userEmpresa]
      );
      res.status(201).send();
    } catch (error) {
      res.status(500).send();
    }
  });

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

  app.put('/api/equipamentos/:id/edit', verificarToken, async (req, res) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') {
      return res.status(403).json({ error: 'Acesso restrito.' });
    }

    const { id } = req.params;
    const { nome, temp_max, temp_min, umidade_max, umidade_min, setor, filial } = req.body;

    try {
      /**
       * Extrai parse numero de uma entrada externa ou configuracao local.
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
        const clientTemp = mqtt.connect('mqtt://localhost:1883', getMqttClientOptions());
        clientTemp.on('connect', () => {
          const payloadConfig = JSON.stringify({
            acao: "CONFIG",
            temp_critica: valTempMax,
            temp_atencao: valTempMax - 2.0
          });
          clientTemp.publish(`termosync/comandos/${id}`, payloadConfig);
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

  app.post('/api/system/verify-root-passcode', rootPasscodeLimiter, async (req, res) => {
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

  // ============================================================================
  // ROTAS RESTAURADAS: IMPERSONATE (ACESSO REMOTO) E CRUD DE ADMINISTRAÇÃO
  // ============================================================================
  app.post('/api/impersonate', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Apenas Root.' });

    const alvo = req.body.filialDestino || req.body.filial || req.body.empresa || 'Todas';
    let empresaDestino = 'Cliente Alpha (Padrão)';
    const ip = req.security?.ip || req.ip || req.socket?.remoteAddress || 'Desconhecido';
    const userAgent = req.security?.userAgent || req.headers['user-agent'] || 'Desconhecido';

    try {
      const [lojas] = await pool.execute('SELECT empresa FROM loja WHERE nome = ? LIMIT 1', [alvo]);
      if (lojas.length > 0 && lojas[0].empresa) {
        empresaDestino = lojas[0].empresa;
      } else {
        const [eqs] = await pool.execute('SELECT empresa FROM equipamentos WHERE filial = ? LIMIT 1', [alvo]);
        if (eqs.length > 0 && eqs[0].empresa) empresaDestino = eqs[0].empresa;
      }

      const token = jwt.sign({ id: 9999, role: 'ADMIN', filial: 'Todas', empresa: empresaDestino }, SECRET_KEY, { expiresIn: '1h' });

      try {
        await pool.execute(
          'INSERT INTO sessoes_ativas (usuario_id, usuario_nome, role, token, ip_address, user_agent, expires_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())',
          [9999, `Impersonate: ${empresaDestino}`, 'ADMIN', token, ip, String(userAgent).slice(0, 500)]
        );
      } catch (socErr) {
        console.warn('[SOC] Falha ao registrar sessão Impersonate:', socErr.message);
      }

      try {
        await registrarAuditoria('IMPERSONATE', 'Root/Dev', `Acesso remoto a: ${alvo}`, 'warning');
        await registrarEventoSeguranca({ eventType: 'IMPERSONATE', actor: 'Root/Dev', ip, userAgent, severity: 'warning', detail: `Acesso remoto a: ${alvo}` });
      } catch (e) {
        console.warn('[AUDIT] Falha ao registrar Impersonate:', e.message);
      }

      res.json({ token, empresa: empresaDestino });
    } catch (error) {
      console.error('❌ [ERRO IMPERSONATE]:', error);
      res.status(500).json({ error: 'Falha ao gerar sessão de acesso remoto.' });
    }
  });

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
      return res.json({ success: true, message: 'Empresa atualizada com sucesso!' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Erro interno.' }); }
  });

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
        return res.status(400).json({ error: 'A senha precisa ter 8+ caracteres, maiúscula, minúscula, número e símbolo.' });
      }

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
      if (senha && !isStrongPassword(senha)) {
        return res.status(400).json({ error: 'A senha precisa ter 8+ caracteres, maiúscula, minúscula, número e símbolo.' });
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
      }
      await registrarAuditoria('USER_UPDATED', req.userRole, `${usuario} (${role})`, senha ? 'danger' : 'warning');
      await registrarEventoSeguranca({ eventType: 'USER_UPDATED', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: senha ? 'danger' : 'warning', detail: `${usuario} (${role}) senha=${senha ? 'alterada' : 'inalterada'}` });
      res.status(200).json({ success: true });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Usuário já existe.' });
      res.status(500).json({ error: 'Erro ao editar.' });
    }
  });

  app.delete('/api/usuarios/:id', verificarToken, requireRoles('ADMIN', 'DEV'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
      if (id === Number(req.userId)) return res.status(400).json({ error: 'Não é possível excluir a própria identidade.' });

      let sql = 'DELETE FROM usuarios WHERE id=?';
      const params = [id];
      if (req.userRole !== 'DEV') {
        sql += ' AND empresa=?';
        params.push(req.userEmpresa);
      }

      const [result] = await pool.execute(sql, params);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE usuario_id = ?', [id]);
      await registrarAuditoria('USER_DELETED', req.userRole, `ID ${id}`, 'danger');
      await registrarEventoSeguranca({ eventType: 'USER_DELETED', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: `ID ${id}` });
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir.' });
    }
  });

  app.post('/api/lojas', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('INSERT INTO loja (nome, endereco, telefone, empresa, status) VALUES (?, ?, ?, ?, ?)', [req.body.nome, req.body.endereco, req.body.telefone, req.userRole === 'DEV' && req.body.empresa ? req.body.empresa : req.userEmpresa, req.userRole === 'DEV' && req.body.status ? req.body.status : 'Ativa']); res.status(201).send(); } catch (error) { res.status(500).send(); } });
  app.put('/api/lojas/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { if (req.userRole === 'DEV') { await pool.execute('UPDATE loja SET nome=?, endereco=?, telefone=?, empresa=?, status=? WHERE id=?', [req.body.nome, req.body.endereco, req.body.telefone, req.body.empresa || req.userEmpresa, req.body.status || 'Ativa', req.params.id]); } else { await pool.execute('UPDATE loja SET nome=?, endereco=?, telefone=? WHERE id=? AND empresa=?', [req.body.nome, req.body.endereco, req.body.telefone, req.params.id, req.userEmpresa]); } res.status(200).send(); } catch (error) { res.status(500).send(); } });
  app.delete('/api/lojas/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito.' }); try { if (req.userRole === 'DEV') { await pool.execute('DELETE FROM loja WHERE id = ?', [req.params.id]); } else { await pool.execute('DELETE FROM loja WHERE id = ? AND empresa = ?', [req.params.id, req.userEmpresa]); } res.status(200).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Erro interno.' }); } });

  // ============================================================================
  // COMANDOS REMOTOS (FRONTEND -> HARDWARE FÍSICO)
  // ============================================================================
  app.post('/api/hardware/:id/comando', verificarToken, requirePermission('hardware:command'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const acao = normalizeCredential(req.body.acao, 60);
      const estado = req.body.estado;
      const allowedActions = ['MANUAL_RELE', 'CONFIG', 'REBOOT', 'OTA', 'DEGELO', 'LIGAR', 'DESLIGAR'];
      if (!Number.isInteger(id) || id <= 0 || !allowedActions.includes(acao)) {
        return res.status(400).json({ error: 'Comando de hardware inválido.' });
      }
      const topico = `termosync/comandos/${id}`; const payload = JSON.stringify({ acao, estado });
      const mqttClientCmd = mqtt.connect('mqtt://localhost:1883', getMqttClientOptions());
      mqttClientCmd.on('connect', () => {
        mqttClientCmd.publish(topico, payload, { qos: 0, retain: false }, (err) => {
          if (err) { mqttClientCmd.end(); return res.status(500).json({ error: 'Falha ao comunicar com o equipamento.' }); }
          registrarEventoSeguranca({ eventType: 'IOT_COMMAND_SENT', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'warning', detail: `${topico}: ${acao}` });
          console.log(`⚡ [MQTT COMANDO] Enviado para Equipamento ${id}: ${payload}`); mqttClientCmd.end(); res.json({ success: true, message: `Comando enviado com sucesso.` });
        });
      });
    } catch (error) { res.status(500).json({ error: 'Erro interno ao processar comando.' }); }
  });

  // ============================================================================
  // LEITURAS HTTP (SIMULADOR DE CAOS) E INTEGRAÇÃO SEGURA DO BD
  // ============================================================================
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
        const isMotorLigado = (motor_ligado == 1 || motor_ligado === true);
        const isEmDegelo = (em_degelo == 1 || em_degelo === true);
        await pool.execute('UPDATE equipamentos SET motor_ligado=?, em_degelo=? WHERE id=?', [isMotorLigado, isEmDegelo, equipamento_id]);

        const tMax = parseFloat(eq[0].temp_max);
        const tMin = parseFloat(eq[0].temp_min);
        const uMax = parseFloat(eq[0].umidade_max || 0);
        const uMin = parseFloat(eq[0].umidade_min || 0);

        let novosAlertas = [];

        /**
         * Concentra a logica de check and alert para manter o restante do rota/API mais legivel.
         */
        const checkAndAlert = async (condicaoAnomala, tipoAlerta, mensagem) => {
          if (condicaoAnomala) {
            const [existe] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
            if (existe.length === 0) {
              const [inserido] = await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta, resolvido) VALUES (?, ?, ?, 0)', [equipamento_id, mensagem, tipoAlerta]);
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
          } else {
            await pool.execute('UPDATE notificacoes SET resolvido=1 WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
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

        if (uMax > 0 || uMin > 0) {
          const condUmi = ((u > uMax || u < uMin) && !isEmDegelo);
          await checkAndAlert(condUmi, 'UMIDADE', `ALERTA HIGROMÉTRICO: Umidade de "${eq[0].nome}" fora dos limites permitidos (${u}%).`);
        }

        if (novosAlertas.length > 0) { io.emit('atualizacao_dados'); novosAlertas.forEach(a => io.emit('novo_alerta', a)); }
        io.emit('nova_leitura', { id: r.insertId, equipamento_id, temperatura: t, umidade: u, consumo_kwh: c_kwh, motor_ligado: isMotorLigado, em_degelo: isEmDegelo, ultima_comunicacao: new Date(), status_conexao: 'online', data_hora: new Date(), nome: eq[0].nome, setor: eq[0].setor, filial: eq[0].filial, empresa: eq[0].empresa });
      }
      res.status(201).send();
    } catch (error) { res.status(500).send(); }
  });

  // ==========================================
  // ROTAS DE NOTIFICAÇÕES E CHAMADOS (ORIGINAIS)
  // ==========================================
  app.get('/api/notificacoes', verificarToken, async (req, res) => { try { let q = `SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE (n.resolvido = 0 OR n.resolvido IS NULL OR n.resolvido = FALSE)`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } if (req.userRole === 'LOJA') { q += ` AND e.filial = ?`; p.push(req.userFilial); } const [r] = await pool.execute(q + ' ORDER BY n.data_hora DESC', p); res.json(r); } catch (e) { res.status(500).send(); } });
  app.get('/api/notificacoes/historico', verificarToken, async (req, res) => { try { let q = `SELECT n.*, e.nome AS equipamento_nome, e.setor, e.filial FROM notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id WHERE n.resolvido = 1`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } if (req.userRole === 'LOJA') { q += ` AND e.filial = ?`; p.push(req.userFilial); } const [r] = await pool.execute(q + ' ORDER BY n.data_hora DESC LIMIT 150', p); res.json(r); } catch (e) { res.status(500).send(); } });
  app.put('/api/notificacoes/:id/resolver', verificarToken, async (req, res) => {
    try {
      let query = 'UPDATE notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id SET n.resolvido=1, n.nota_resolucao=? WHERE n.id=?';
      const params = [req.body.nota_resolucao || 'Resolvido pelo operador.', req.params.id];
      if (req.userRole !== 'DEV') {
        query += ' AND e.empresa = ?';
        params.push(req.userEmpresa);
        if (req.userRole === 'LOJA') {
          query += ' AND e.filial = ?';
          params.push(req.userFilial);
        }
      }

      const [result] = await pool.execute(query, params);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Notificação não encontrada ou sem permissão.' });

      io.emit('alerta_removido_id', { id: req.params.id });
      io.emit('atualizacao_dados');
      res.status(200).send();
    } catch (error) {
      res.status(500).send();
    }
  });
  app.put('/api/notificacoes/resolver-todas', verificarToken, async (req, res) => { try { let q = 'UPDATE notificacoes n JOIN equipamentos e ON n.equipamento_id = e.id SET n.resolvido=1, n.nota_resolucao="Limpeza em Lote" WHERE (n.resolvido=0 OR n.resolvido IS NULL)'; let p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } } await pool.execute(q, p); io.emit('alertas_limpos'); io.emit('atualizacao_dados'); res.status(200).send(); } catch (error) { res.status(500).send(); } });

  app.get('/api/chamados', verificarToken, async (req, res) => {
    try {
      const isHistorico = req.query.historico === '1';
      const limit = req.query.all === '1' ? 5000 : clampNumber(req.query.limit, isHistorico ? 1200 : 800, 50, 2000);
      let q = `
        SELECT c.*, e.nome as equipamento_nome, e.filial as equipamento_filial, u.usuario as aberto_por
        FROM chamados c
        LEFT JOIN equipamentos e ON c.equipamento_id = e.id
        LEFT JOIN usuarios u ON c.usuario_id = u.id
        WHERE 1=1
      `;
      const p = [];
      if (req.userRole !== 'DEV') {
        q += ' AND (c.empresa = ? OR c.empresa IS NULL OR c.empresa = "")';
        p.push(req.userEmpresa);
        if (req.userRole === 'LOJA') {
          q += ` AND (c.filial = ? OR c.filial IS NULL OR c.filial = "" OR e.filial = ?)`;
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
  app.post('/api/chamados', verificarToken, async (req, res) => {
    try {
      const { equipamento_id, descricao, solicitante_nome, tecnico_responsavel, urgencia } = req.body;
      let filialStr = req.userFilial;

      if (equipamento_id) {
        try {
          const [eq] = await pool.execute('SELECT filial FROM equipamentos WHERE id=?', [equipamento_id]);
          if (eq.length > 0 && eq[0].filial) filialStr = eq[0].filial;
        } catch (e) {
          console.warn('[CHAMADOS] Não foi possível inferir filial do equipamento:', e.message);
        }
      }

      await pool.execute(
        `INSERT INTO chamados (equipamento_id, usuario_id, filial, descricao, solicitante_nome, tecnico_responsavel, empresa, urgencia, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aberto')`,
        [equipamento_id || null, req.userId, filialStr, descricao, solicitante_nome || null, tecnico_responsavel || null, req.userEmpresa, urgencia || 'Pendente']
      );
      io.emit('atualizacao_dados');
      res.status(201).send();
    } catch (error) {
      res.status(500).send();
    }
  });
  app.put('/api/chamados/:id/status', verificarToken, async (req, res) => {
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

  app.put('/api/chamados/:id', verificarToken, async (req, res) => {
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

  app.put('/api/chamados/:id/arquivar', verificarToken, async (req, res) => {
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

  app.put('/api/chamados/:id/urgencia', verificarToken, async (req, res) => {
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

  app.get('/api/suporte/artigos', verificarToken, async (req, res) => { try { const isDev = req.userRole === 'DEV'; const publico = isDev ? [] : ['USUARIO', 'AMBOS']; let query = 'SELECT * FROM suporte_artigos WHERE ativo = TRUE'; const params = []; if (!isDev) { query += ' AND publico IN (?, ?)'; params.push(publico[0], publico[1]); } const [rows] = await pool.execute(query + ' ORDER BY destaque DESC, updated_at DESC, titulo ASC', params); res.json(rows); } catch (error) { res.status(500).json({ error: 'Falha.' }); } });
  app.get('/api/suporte/chamados', verificarToken, async (req, res) => { try { let query = 'SELECT * FROM suporte_chamados WHERE 1=1'; const params = []; if (req.userRole !== 'DEV') { query += ' AND (empresa = ? OR empresa IS NULL OR empresa = "")'; params.push(req.userEmpresa); if (req.userRole === 'LOJA') { query += ' AND (filial = ? OR filial IS NULL OR filial = "")'; params.push(req.userFilial); } } const [rows] = await pool.execute(query + ' ORDER BY criado_em DESC', params); res.json(rows); } catch (error) { res.status(500).json({ error: 'Falha.' }); } });
  app.post('/api/suporte/chamados', verificarToken, async (req, res) => { try { const { titulo, descricao, categoria, prioridade, solicitante, email } = req.body; if (!titulo || !descricao || !solicitante) return res.status(400).json({ error: 'Campos obrigatórios.' }); const [result] = await pool.execute('INSERT INTO suporte_chamados (titulo, descricao, categoria, prioridade, origem, solicitante, email, empresa, filial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [titulo, descricao, categoria || 'Geral', prioridade || 'Média', req.userRole === 'DEV' ? 'DEV' : 'USUARIO', solicitante, email || null, req.userEmpresa || null, req.userFilial || null]); try { await pool.execute('INSERT INTO suporte_chamado_historico (chamado_id, evento, autor, papel, status_anterior, status_novo, mensagem) VALUES (?, ?, ?, ?, ?, ?, ?)', [result.insertId, 'ABERTURA', solicitante, req.userRole || 'USUARIO', null, 'Aberto', descricao]); } catch (errHist) { console.error('⚠️ [AVISO] Falha na auditoria inicial de suporte:', errHist.message); } const novoTicketPayload = { id: result.insertId, titulo, descricao, categoria: categoria || 'Geral', prioridade: prioridade || 'Média', solicitante, empresa: req.userEmpresa || null, filial: req.userFilial || null, criado_em: new Date().toISOString(), status: 'Aberto' }; if (io) { io.emit('novo_chamado_suporte', novoTicketPayload); io.emit('atualizacao_dados'); } res.status(201).json({ success: true, id: result.insertId }); } catch (error) { res.status(500).json({ error: 'Falha ao abrir chamado de suporte.' }); } });
  app.put('/api/suporte/chamados/:id', verificarToken, async (req, res) => { try { const { status, resposta, responsavel } = req.body; const [atual] = await pool.execute('SELECT * FROM suporte_chamados WHERE id = ?', [req.params.id]); if (atual.length === 0) return res.status(404).json({ error: 'Não encontrado.' }); const chamadoAtual = atual[0]; let novoStatus = status || chamadoAtual.status || 'Concluído'; if (resposta && (novoStatus === 'Aberto' || novoStatus === 'Em análise')) { novoStatus = 'Respondido'; } if (novoStatus === 'Resolvido' || novoStatus === 'Fechado') novoStatus = 'Concluído'; if (novoStatus === 'Em Atendimento') novoStatus = 'Em análise'; const novaResposta = (resposta !== undefined && resposta !== '') ? resposta : (chamadoAtual.resposta || null); const novoResponsavel = responsavel || chamadoAtual.responsavel || 'Suporte NOC (DEV)'; await pool.execute('UPDATE suporte_chamados SET status = ?, resposta = ?, responsavel = ? WHERE id = ?', [novoStatus, novaResposta, novoResponsavel, req.params.id]); try { if ((resposta !== undefined && resposta !== chamadoAtual.resposta) || novoStatus !== chamadoAtual.status) { await pool.execute('INSERT INTO suporte_chamado_historico (chamado_id, evento, autor, papel, status_anterior, status_novo, mensagem) VALUES (?, ?, ?, ?, ?, ?, ?)', [req.params.id, resposta !== undefined ? 'RESPOSTA' : 'ATUALIZACAO_STATUS', novoResponsavel, req.userRole || 'DEV', chamadoAtual.status || 'Aberto', novoStatus, resposta !== undefined ? resposta : `Status alterado para ${novoStatus}`]); } } catch (errHist) { console.error('⚠️ [AVISO] Falha ao registrar auditoria de suporte:', errHist.message); } if (io) { io.emit('resposta_suporte', { id: req.params.id, titulo: chamadoAtual.titulo, resposta: novaResposta, status: novoStatus, responsavel: novoResponsavel, empresa: chamadoAtual.empresa, filial: chamadoAtual.filial }); io.emit('atualizacao_dados'); } res.status(200).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Falha ao atualizar chamado de suporte.' }); } });
  app.get('/api/suporte/chamados/:id/historico', verificarToken, async (req, res) => { try { const [ticket] = await pool.execute('SELECT id, empresa, filial, solicitante FROM suporte_chamados WHERE id = ?', [req.params.id]); if (ticket.length === 0) return res.status(404).json({ error: 'Não encontrado.' }); if (req.userRole !== 'DEV') { const permitidoEmpresa = ticket[0].empresa === req.userEmpresa || !ticket[0].empresa; const permitidoFilial = req.userRole !== 'LOJA' || ticket[0].filial === req.userFilial || !ticket[0].filial; if (!permitidoEmpresa || !permitidoFilial) return res.status(403).json({ error: 'Acesso negado.' }); } const [historico] = await pool.execute('SELECT * FROM suporte_chamado_historico WHERE chamado_id = ? ORDER BY criado_em ASC, id ASC', [req.params.id]); res.json(historico); } catch (error) { res.status(500).json({ error: 'Falha.' }); } });
  app.get('/api/relatorios', verificarToken, async (req, res) => { let q = `SELECT l.id, l.temperatura, l.umidade, l.consumo_kwh, l.data_hora, e.nome, e.setor, e.filial FROM leituras l JOIN equipamentos e ON l.equipamento_id = e.id WHERE 1=1`; const p = []; if (req.userRole !== 'DEV') { q += ' AND e.empresa = ?'; p.push(req.userEmpresa); } if (req.userRole === 'LOJA') { q += ' AND e.filial = ?'; p.push(req.userFilial); } if (req.query.data_inicio && req.query.data_fim) { q += ' AND l.data_hora BETWEEN ? AND ?'; p.push(new Date(req.query.data_inicio), new Date(req.query.data_fim)); } else { q += ' AND l.data_hora >= DATE_SUB(NOW(), INTERVAL 6 HOUR)'; } const [r] = await pool.execute(q + ' ORDER BY l.data_hora ASC LIMIT 3000', p); res.json(r); });

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

      try {
        [equipamentosRows] = await pool.execute(
          `SELECT e.id, e.nome, e.filial, e.motor_ligado, e.em_degelo, (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp, (SELECT umidade FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_umidade FROM equipamentos e WHERE ${whereClause}`,
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
      } catch (e) {
        console.warn('[OPERACAO] Falha ao carregar alertas do resumo:', e.message);
      }

      try {
        [chamadosRows] = await pool.execute(
          `SELECT c.id, c.status, c.urgencia, e.nome AS equipamento_nome FROM chamados c LEFT JOIN equipamentos e ON c.equipamento_id = e.id WHERE ${whereClause} AND c.status <> 'Concluído' AND c.status <> 'Fechado' ORDER BY c.data_abertura DESC LIMIT 8`,
          params
        );
      } catch (e) {
        console.warn('[OPERACAO] Falha ao carregar chamados do resumo:', e.message);
      }

      const totalEquipamentos = equipamentosRows.length;
      const alertasAtivos = alertasRows.length;
      const chamadosAbertos = chamadosRows.length;
      const equipamentosFalha = equipamentosRows.filter((eq) => !eq.motor_ligado && !eq.em_degelo).length;
      const equipamentosDegelo = equipamentosRows.filter((eq) => eq.em_degelo).length;
      const temperaturaMedia = totalEquipamentos ? (equipamentosRows.reduce((acc, item) => acc + (Number(item.ultima_temp) || 0), 0) / totalEquipamentos).toFixed(1) : 0;
      const umidadeMedia = totalEquipamentos ? (equipamentosRows.reduce((acc, item) => acc + (Number(item.ultima_umidade) || 0), 0) / totalEquipamentos).toFixed(1) : 0;

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
  app.get('/api/operacao/tarefas', verificarToken, async (req, res) => { try { const tipo = req.query.tipo || 'checklist_turno'; const filial = req.query.filial || req.userFilial || 'Todas'; const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)'; let sql = 'SELECT * FROM operacao_tarefas WHERE tipo = ?'; const params = [tipo]; if (req.userRole !== 'DEV') { sql += ' AND empresa = ?'; params.push(empresa); } if (filial && filial !== 'Todas') { sql += ' AND (filial = ? OR filial = "Matriz" OR filial = "Todas" OR filial IS NULL)'; params.push(filial); } sql += ' ORDER BY created_at ASC'; const [rows] = await pool.execute(sql, params); res.json(rows); } catch (error) { res.status(500).json({ error: 'Erro ao buscar tarefas.' }); } });
  app.post('/api/operacao/tarefas', verificarToken, async (req, res) => { try { if (req.userRole === 'LOJA') return res.status(403).json({ error: 'Acesso negado.' }); const { tipo, chave, titulo, descricao, concluida, filial } = req.body; const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)'; if (!chave || !titulo) return res.status(400).json({ error: 'Chave e título são obrigatórios.' }); const sql = `INSERT INTO operacao_tarefas (tipo, chave, titulo, descricao, concluida, filial, empresa) VALUES (?, ?, ?, ?, ?, ?, ?)`; const params = [tipo || 'checklist_turno', chave, titulo, descricao || null, concluida ? 1 : 0, filial || 'Matriz', empresa]; const [result] = await pool.execute(sql, params); await emitirOperacaoAtualizada({ tipo: 'tarefas', empresa, usuario: req.userId }); res.status(201).json({ success: true, id: result.insertId }); } catch (error) { res.status(500).json({ error: 'Erro ao criar tarefa.' }); } });
  app.put('/api/operacao/tarefas/:id', verificarToken, async (req, res) => { try { const { id } = req.params; const { concluida } = req.body; const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)'; let horario = null; if (concluida) { const dataAtual = new Date(); horario = dataAtual.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }); } let sql = 'UPDATE operacao_tarefas SET concluida = ?, horario = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'; const params = [concluida ? 1 : 0, horario, id]; if (req.userRole !== 'DEV') { sql += ' AND empresa = ?'; params.push(empresa); } const [result] = await pool.execute(sql, params); if (result.affectedRows === 0) return res.status(404).json({ error: 'Tarefa não encontrada ou sem permissão.' }); await emitirOperacaoAtualizada({ tipo: 'tarefas', empresa, usuario: req.userId }); res.status(200).json({ success: true, concluida, horario }); } catch (error) { res.status(500).json({ error: 'Erro ao atualizar.' }); } });
  app.delete('/api/operacao/tarefas/:id', verificarToken, async (req, res) => { try { if (req.userRole === 'LOJA') return res.status(403).json({ error: 'Acesso negado.' }); const { id } = req.params; const empresa = req.userEmpresa || 'Cliente Alpha (Padrão)'; let sql = 'DELETE FROM operacao_tarefas WHERE id = ?'; const params = [id]; if (req.userRole !== 'DEV') { sql += ' AND empresa = ?'; params.push(empresa); } const [result] = await pool.execute(sql, params); if (result.affectedRows === 0) return res.status(404).json({ error: 'Não encontrada.' }); await emitirOperacaoAtualizada({ tipo: 'tarefas', empresa, usuario: req.userId }); res.status(200).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Erro ao excluir.' }); } });
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
  app.get('/api/contatos', verificarToken, async (req, res) => { try { let q = 'SELECT id, usuario, role, filial, nome_gerente, nome_coordenador, nome_tecnico, empresa FROM usuarios WHERE id != ?'; let p = [req.userId]; if (req.userRole !== 'DEV') { q += ' AND (empresa = ? OR role = "DEV")'; p.push(req.userEmpresa); } const [rows] = await pool.execute(q, p); res.json(rows.map(u => { let nome = u.usuario; let cargo = 'Usuário'; if (u.role === 'DEV') { nome = 'NOC (Desenvolvedor)'; cargo = 'Suporte Master'; } else if (u.role === 'ADMIN') { nome = 'Administração'; cargo = 'Suporte Corporativo'; } else if (u.role === 'MANUTENCAO') { nome = u.nome_tecnico || u.usuario; cargo = 'Técnico Manutenção'; } else if (u.role === 'LOJA') { if (u.nome_gerente) { nome = u.nome_gerente; cargo = `Gerente - ${u.filial}`; } else if (u.nome_coordenador) { nome = u.nome_coordenador; cargo = `Coordenador - ${u.filial}`; } else { nome = `Equipe ${u.filial}`; cargo = 'Operador Loja'; } } return { id: u.id, nome, cargo, role: u.role, filial: u.filial, empresa: u.empresa }; })); } catch (error) { res.status(500).json({ error: error.message }); } });
  app.get('/api/tecnicos', verificarToken, async (req, res) => { try { let q = 'SELECT id, usuario, nome_tecnico, empresa FROM usuarios WHERE role = "MANUTENCAO" AND nome_tecnico IS NOT NULL'; const p = []; if (req.userRole !== 'DEV') { q += ' AND empresa = ?'; p.push(req.userEmpresa); } q += ' ORDER BY nome_tecnico ASC'; const [r] = await pool.execute(q, p); res.json(r); } catch (e) { res.status(500).send(); } });
  app.get('/api/auxiliares/equipamentos-abertura', verificarToken, async (req, res) => {
    try {
      const paramsEmpresa = req.userRole !== 'DEV' ? [req.userEmpresa || 'Cliente Alpha (Padrão)'] : [];
      const filtroEmpresa = req.userRole !== 'DEV' ? ' AND empresa = ?' : '';
      const equipamentos = await executarConsultaOpcional(
        `SELECT id, nome, setor, filial, empresa FROM equipamentos WHERE 1=1${filtroEmpresa} ORDER BY filial ASC, setor ASC, nome ASC`,
        paramsEmpresa,
        'SELECT id, nome, setor, filial, NULL AS empresa FROM equipamentos ORDER BY filial ASC, setor ASC, nome ASC'
      );
      res.json(equipamentos);
    } catch (error) {
      console.error('[AUXILIARES] Erro ao buscar equipamentos para abertura:', error.message);
      res.status(500).json({ error: 'Erro ao carregar equipamentos.', requestId: req.security?.requestId });
    }
  });
  app.get('/api/setores', verificarToken, async (req, res) => { try { const [r] = await pool.execute('SELECT id, nome FROM setores ORDER BY nome ASC'); res.json(r); } catch (e) { res.status(500).send(); } });
  app.post('/api/setores', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('INSERT INTO setores (nome) VALUES (?)', [req.body.nome]); res.status(201).send(); } catch (e) { res.status(500).send(); } });
  app.put('/api/setores/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('UPDATE setores SET nome=? WHERE id=?', [req.body.nome, req.params.id]); res.status(200).send(); } catch (e) { res.status(500).send(); } });
  app.delete('/api/setores/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('DELETE FROM setores WHERE id=?', [req.params.id]); res.status(200).send(); } catch (e) { res.status(500).send(); } });
  app.get('/api/tipos-refrigeracao', verificarToken, async (req, res) => { try { const [r] = await pool.execute('SELECT * FROM tipos_refrigeracao ORDER BY nome ASC'); res.json(r); } catch (e) { res.status(500).send(); } });
  app.post('/api/tipos-refrigeracao', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { const { nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo } = req.body; const parseNum = (v) => (v === '' || v === undefined || v === null) ? null : parseFloat(v); await pool.execute('INSERT INTO tipos_refrigeracao (nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo) VALUES (?, ?, ?, ?, ?, ?, ?)', [nome, parseNum(temp_min), parseNum(temp_max), parseNum(umidade_min), parseNum(umidade_max), parseNum(intervalo_degelo) || 6, parseNum(duracao_degelo) || 30]); res.status(201).send(); } catch (e) { res.status(500).send(); } });
  app.put('/api/tipos-refrigeracao/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { const { nome, temp_min, temp_max, umidade_min, umidade_max, intervalo_degelo, duracao_degelo } = req.body; const parseNum = (v) => (v === '' || v === undefined || v === null) ? null : parseFloat(v); await pool.execute('UPDATE tipos_refrigeracao SET nome=?, temp_min=?, temp_max=?, umidade_min=?, umidade_max=?, intervalo_degelo=?, duracao_degelo=? WHERE id=?', [nome, parseNum(temp_min), parseNum(temp_max), parseNum(umidade_min), parseNum(umidade_max), parseNum(intervalo_degelo) || 6, parseNum(duracao_degelo) || 30, req.params.id]); res.status(200).send(); } catch (error) { res.status(500).json({ error: 'Erro ao editar usuário.' }); } });
  app.delete('/api/tipos-refrigeracao/:id', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).send(); try { await pool.execute('DELETE FROM tipos_refrigeracao WHERE id=?', [req.params.id]); res.status(200).send(); } catch (e) { res.status(500).send(); } });

  // ==========================================
  // ROTAS DO SOC (SECURITY OPERATIONS CENTER) E RELATÓRIOS
  // ==========================================
  app.get('/api/soc/sessoes', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE revogado = FALSE AND expires_at IS NOT NULL AND expires_at < NOW()');
      const [sessoes] = await pool.execute(
        'SELECT id, usuario_nome as usuario, role, ip_address as ip, localizacao as location, user_agent as userAgent, data_login as loginTime, last_seen as lastSeen, expires_at as expiresAt FROM sessoes_ativas WHERE revogado = FALSE ORDER BY data_login DESC'
      );
      res.json(sessoes);
    } catch (e) {
      res.status(500).send();
    }
  });

  app.post('/api/soc/revogar-todas', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [result] = await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE revogado = FALSE AND usuario_id <> ?', [req.userId]);
      await registrarAuditoria('TOKEN_REVOKED_ALL', 'root_dev', `Sessões revogadas: ${result.affectedRows}`, 'danger');
      await registrarEventoSeguranca({ eventType: 'TOKEN_REVOKED_ALL', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: `Sessões revogadas: ${result.affectedRows}` });
      res.json({ success: true, revoked: result.affectedRows });
    } catch (e) {
      res.status(500).json({ error: 'Falha ao revogar sessões.' });
    }
  });

  app.post('/api/soc/revogar/:id', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [sessao] = await pool.execute('SELECT usuario_nome FROM sessoes_ativas WHERE id = ?', [req.params.id]);
      await pool.execute('UPDATE sessoes_ativas SET revogado = TRUE WHERE id = ?', [req.params.id]);
      const alvo = sessao.length > 0 ? sessao[0].usuario_nome : 'ID ' + req.params.id;
      await registrarAuditoria('TOKEN_REVOKED', 'root_dev', alvo, 'danger');
      await registrarEventoSeguranca({ eventType: 'TOKEN_REVOKED', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: alvo });
      res.json({ success: true });
    } catch (e) {
      res.status(500).send();
    }
  });

  app.get('/api/soc/auditoria', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [logs] = await pool.execute('SELECT data_hora, acao as action, ator as actor, alvo as target, severidade as severity FROM audit_logs ORDER BY data_hora DESC LIMIT 100');
      res.json(logs);
    } catch (e) {
      res.status(500).send();
    }
  });

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

  app.get('/api/security/status', verificarToken, requireRoles('DEV'), async (req, res) => {
    try {
      const [sessionRows] = await pool.execute('SELECT SUM(revogado = FALSE) AS activeSessions, SUM(revogado = TRUE) AS revokedSessions FROM sessoes_ativas');
      const [failedRows] = await pool.execute('SELECT COUNT(*) AS failedLogins24h FROM security_events WHERE event_type = "LOGIN_FAILED" AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)');
      const [mfaRows] = await pool.execute('SELECT COUNT(*) AS usersTotal, SUM(mfa_enabled = TRUE) AS mfaEnabled FROM usuarios');
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
  app.post('/api/system/reports/log', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).send(); try { const { tipo, formato, solicitante } = req.body; await pool.execute('INSERT INTO sys_relatorios_log (tipo_relatorio, formato, solicitante) VALUES (?, ?, ?)', [tipo, formato, solicitante]); res.status(201).send(); } catch (e) { res.status(500).send(); } });
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

  app.get('/api/system/host-info', async (req, res) => { try { const cpus = os.cpus(); const cpuModel = cpus[0]?.model || 'Generic x86_64 Processor'; const cpuCores = cpus.length || 1; const totalMemMB = Math.round(os.totalmem() / (1024 * 1024)); const freeMemMB = Math.round(os.freemem() / (1024 * 1024)); const platform = os.platform(); const release = os.release(); const arch = os.arch(); const hostname = os.hostname(); const type = os.type(); res.json({ success: true, cpu: { model: cpuModel, cores: cpuCores, speed: cpus[0]?.speed || 0 }, memory: { totalMB: totalMemMB, freeMB: freeMemMB }, os: { platform, release, arch, hostname, type, kernelString: `${type} ${hostname} ${release} ${arch}` } }); } catch (error) { res.status(500).json({ success: false, error: 'Falha ao coletar dados do host.' }); } });

  app.post('/api/system/deploy-update', verificarToken, upload.single('updatePackage'), async (req, res) => {
    if (req.userRole !== 'DEV') {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Acesso negado. Permissão exclusiva de SysAdmin (DEV).' });
    }
    try {
      const validated = await validarRootPasscode(req.body.passcode);
      if (!validated.ok) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Passcode root obrigatório para deploy.' });
      }
      const file = req.file;
      const { version, title, type, desc, targetType } = req.body;
      if (!file) { return res.status(400).json({ error: 'Nenhum pacote (.zip) foi enviado.' }); }

      const zip = new AdmZip(file.path);
      const zipEntries = zip.getEntries();
      let temArquivosFrontend = false; let temArquivosBackend = false;

      zipEntries.forEach((entry) => {
        const name = entry.entryName.toLowerCase();
        if (name.includes('index.html') || name.includes('assets/') || name.endsWith('.css') || name.endsWith('.jsx')) { temArquivosFrontend = true; }
        if (name.includes('app.js') || name.includes('server.js') || name.includes('package.json') || name.includes('routes/')) { temArquivosBackend = true; }
      });

      let destinoFinal = targetType || 'AUTO';
      if (destinoFinal === 'AUTO') {
        if (temArquivosFrontend && !temArquivosBackend) destinoFinal = 'FRONTEND';
        else if (temArquivosBackend && !temArquivosFrontend) destinoFinal = 'BACKEND';
        else destinoFinal = 'FULLSTACK';
      }

      const pastaFrontend = path.join(__dirname, '../public_html');
      const pastaBackend = path.join(__dirname, '../');

      if (destinoFinal === 'FRONTEND') { extrairZipComSeguranca(zip, pastaFrontend); }
      else if (destinoFinal === 'BACKEND') { extrairZipComSeguranca(zip, pastaBackend); }
      else { extrairZipComSeguranca(zip, pastaFrontend); extrairZipComSeguranca(zip, pastaBackend); }

      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

      if (version && title && desc) {
        try { await pool.execute('INSERT INTO system_changelog (version, title, type, desc_text, author) VALUES (?, ?, ?, ?, ?)', [version, `[${destinoFinal}] ${title}`, type || 'feature', desc, 'Root/DEV']); }
        catch (errDb) { console.warn('[DEPLOY] Falha ao registrar changelog:', errDb.message); }
      }

      await registrarAuditoria('DEPLOY_SISTEMA', validated.actor, `Deploy ${destinoFinal} (${version || 'v.x'}): ${title || file.originalname}`, 'warning');
      await registrarEventoSeguranca({ eventType: 'DEPLOY_SISTEMA', actor: validated.actor, ip: req.security?.ip, userAgent: req.security?.userAgent, severity: 'danger', detail: `${destinoFinal}: ${version || 'v.x'}` });

      if (io) {
        io.emit('novo_changelog', { version, title, target: destinoFinal });
        io.emit('operacao_atualizada', { tipo: 'deploy', target: destinoFinal, version });
      }

      if (destinoFinal === 'BACKEND' || destinoFinal === 'FULLSTACK') {
        setTimeout(() => { exec('pm2 restart all', (error) => { if (error) console.error(`Erro ao tentar reiniciar o PM2: ${error}`); }); }, 1000);
      }
      res.json({ success: true, targetDetected: destinoFinal, message: `Deploy do tipo [${destinoFinal}] processado com sucesso!` });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: 'Falha ao processar e extrair o pacote de atualização.' });
    }
  });

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

    try {
      const [rows] = await pool.execute(sql);
      await registrarAuditoria(isReadOnlyQuery ? 'RAW_SQL_READ' : 'RAW_SQL_MUTATION', 'Root/Dev', `Query hash: ${queryFingerprint}`, isReadOnlyQuery ? 'warning' : 'danger');
      await registrarEventoSeguranca({ eventType: isReadOnlyQuery ? 'RAW_SQL_READ' : 'RAW_SQL_MUTATION', actor: String(req.userId), ip: req.security?.ip, userAgent: req.security?.userAgent, severity: isReadOnlyQuery ? 'warning' : 'danger', detail: queryFingerprint });
      res.json({ success: true, data: rows });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/pre-cadastros', async (req, res) => { try { const { empresa, cnpj, responsavel, email, telefone } = req.body; if (!empresa || !email) return res.status(400).json({ error: 'Dados incompletos' }); await pool.execute('INSERT INTO pre_cadastros (empresa, cnpj, responsavel, email, telefone) VALUES (?, ?, ?, ?, ?)', [empresa, cnpj, responsavel, email, telefone]); if (io) io.emit('novo_pre_cadastro'); res.status(201).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Erro ao processar pré-cadastro.' }); } });
  app.get('/api/pre-cadastros', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' }); try { const [rows] = await pool.execute('SELECT * FROM pre_cadastros WHERE status = "pendente" ORDER BY data_solicitacao ASC'); res.json(rows); } catch (error) { res.status(500).send(); } });
  app.post('/api/pre-cadastros/:id/aprovar', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });

    try {
      const [reqs] = await pool.execute('SELECT * FROM pre_cadastros WHERE id = ?', [req.params.id]);
      if (reqs.length === 0) return res.status(404).json({ error: 'Requerimento não encontrado' });

      const reqData = reqs[0];
      await pool.execute('UPDATE pre_cadastros SET status = "aprovado" WHERE id = ?', [req.params.id]);

      const contatoCompleto = `${reqData.responsavel || 'Responsável'} (${reqData.telefone || 'sem telefone'})`;
      await pool.execute(
        'INSERT IGNORE INTO empresas (nome, cnpj, contato, email, status) VALUES (?, ?, ?, ?, "Ativa")',
        [reqData.empresa, reqData.cnpj, contatoCompleto, reqData.email]
      );

      const nomeFilialMatriz = `Matriz - ${reqData.empresa}`;
      await pool.execute(
        'INSERT IGNORE INTO loja (nome, endereco, telefone, empresa, status) VALUES (?, ?, ?, ?, "Ativa")',
        [nomeFilialMatriz, 'Sede Principal (Pendente de Atualização)', reqData.telefone, reqData.empresa]
      );

      const baseUsername = reqData.empresa.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 8) || 'cliente';
      const usuarioGerado = `admin.${baseUsername}${crypto.randomInt(100, 999)}`;
      const senhaGerada = gerarSenhaProvisoria();
      const senhaHash = await bcrypt.hash(senhaGerada, 10);

      await pool.execute(
        'INSERT INTO usuarios (usuario, senha, role, filial, nome_gerente, empresa) VALUES (?, ?, "ADMIN", "Todas", ?, ?)',
        [usuarioGerado, senhaHash, reqData.responsavel, reqData.empresa]
      );

      const empresaSegura = escapeHtml(reqData.empresa);
      const responsavelSeguro = escapeHtml(reqData.responsavel);
      const usuarioSeguro = escapeHtml(usuarioGerado);
      const senhaSegura = escapeHtml(senhaGerada);
      const mailOptions = {
        from: SMTP_FROM,
        to: reqData.email,
        subject: `Bem-vindo ao TermoSync, ${reqData.empresa}!`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;"><h2 style="color: #10b981; text-align: center;">Infraestrutura Provisionada!</h2><p>Olá, <strong>${responsavelSeguro}</strong>,</p><p>O seu requerimento foi aprovado pela nossa equipa de Engenharia.</p><p>O Tenant dedicado para a organização <strong>${empresaSegura}</strong> foi gerado com sucesso e já se encontra operacional.</p><div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #38bdf8; margin: 20px 0; border-radius: 4px;"><h3 style="margin-top: 0; color: #0f172a;">Credenciais de Acesso (Administrador)</h3><p><strong>Usuário:</strong> <span style="font-family: monospace; font-size: 1.1em; color: #0369a1;">${usuarioSeguro}</span></p><p><strong>Senha:</strong> <span style="font-family: monospace; font-size: 1.1em; color: #0369a1;">${senhaSegura}</span></p><p style="font-size: 12px; color: #ef4444; margin-bottom: 0;">Recomendamos fortemente a alteração desta senha após o primeiro acesso.</p></div><hr style="border:none; border-top:1px solid #eee; margin:20px 0;"><p style="font-size:12px; color:#999; text-align:center;">TermoSync Enterprise Operations</p></div>`
      };

      let emailSent = false;
      const transporter = criarTransporterEmail();
      if (transporter) {
        await transporter.sendMail(mailOptions);
        emailSent = true;
      } else {
        console.warn('[SMTP] Tenant aprovado sem envio de e-mail. Configure SMTP_USER e SMTP_PASS.');
      }

      await registrarAuditoria('ONBOARDING_APPROVED', 'Root/Dev', `Tenant provisionado: ${reqData.empresa} (Admin: ${usuarioGerado})`, 'success');
      if (io) io.emit('atualizacao_dados');

      res.json({
        success: true,
        emailSent,
        usuario: usuarioGerado,
        senhaProvisoria: emailSent ? undefined : senhaGerada,
        message: emailSent ? 'Aprovado com sucesso. Credenciais enviadas por e-mail.' : 'Aprovado com sucesso. SMTP não configurado; credenciais retornadas ao DEV.'
      });
    } catch (error) {
      console.error('[ONBOARDING] Falha ao aprovar pré-cadastro:', error.message);
      res.status(500).json({ error: 'Erro interno' });
    }
  });
  app.post('/api/pre-cadastros/:id/rejeitar', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' }); try { await pool.execute('UPDATE pre_cadastros SET status = "rejeitado" WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (error) { res.status(500).send(); } });
  app.get('/api/system/changelog', verificarToken, async (req, res) => { try { const [rows] = await pool.execute('SELECT * FROM system_changelog ORDER BY date DESC, id DESC LIMIT 20'); res.json(rows); } catch (error) { res.status(500).json({ error: 'Erro ao carregar o changelog do sistema.' }); } });
  app.post('/api/system/changelog', verificarToken, async (req, res) => { if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso restrito a desenvolvedores.' }); const { version, title, type, desc_text } = req.body; if (!version || !title || !desc_text) return res.status(400).json({ error: 'Campos obrigatórios ausentes.' }); try { await pool.execute('INSERT INTO system_changelog (version, title, type, desc_text, author) VALUES (?, ?, ?, ?, ?)', [version, title, type || 'Improvement', desc_text, req.userRole || 'DEV']); io.emit('novo_changelog', { version, title }); res.status(201).json({ success: true }); } catch (error) { res.status(500).json({ error: 'Falha ao registrar versão.' }); } });
  app.get('/api/tecnicos/ativos', verificarToken, async (req, res) => { try { const [rows] = await pool.execute('SELECT id, nome, telefone FROM tecnicos ORDER BY nome ASC'); res.json(rows); } catch (error) { res.status(500).json({ error: 'Erro ao listar técnicos.' }); } });
  app.post('/api/tecnicos', verificarToken, async (req, res) => { if (req.userRole !== 'ADMIN' && req.userRole !== 'DEV') return res.status(403).json({ error: 'Sem permissão.' }); const { nome, telefone } = req.body; if (!nome) return res.status(400).json({ error: 'Nome do técnico é obrigatório.' }); try { const [result] = await pool.execute('INSERT INTO tecnicos (nome, telefone) VALUES (?, ?)', [nome, telefone || '']); res.status(201).json({ id: result.insertId, nome, telefone }); } catch (error) { res.status(500).json({ error: 'Falha ao cadastrar técnico.' }); } });
  app.put('/api/chamados/:id/atribuir-tecnico', verificarToken, async (req, res) => { const { tecnico_id, tecnico_nome } = req.body; try { await pool.execute('UPDATE chamados SET tecnico_id = ?, tecnico_responsavel = ? WHERE id = ?', [tecnico_id || null, tecnico_nome || null, req.params.id]); io.emit('atualizacao_dados'); res.json({ success: true }); } catch (error) { res.status(500).json({ error: 'Erro ao atribuir técnico.' }); } });

  // ============================================================================
  // MOTOR MQTT - RECEPÇÃO DE TELEMETRIA E SINCRONIZAÇÃO DE HARDWARE
  // ============================================================================
  const mqttClientRecv = mqtt.connect('mqtt://localhost:1883', getMqttClientOptions());

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
          const payloadConfig = JSON.stringify({
            acao: "CONFIG",
            temp_critica: tMax,
            temp_atencao: tAtencao
          });
          mqttClientRecv.publish(`termosync/comandos/${idEquipamento}`, payloadConfig);
          console.log(`📡 [MQTT] Banco de Dados -> ESP32 ID ${idEquipamento}: Temp Máx atualizada para ${tMax}°C`);
        }
      } catch (err) {
        console.error('❌ [ERRO BD] Falha ao buscar config para ESP32:', err.message);
      }
      return;
    }

    // 2. RECEBENDO LEITURAS DE TELEMETRIA NORMAIS
    if (topic === 'termosync/telemetria') {
      try {
        const payload = JSON.parse(message.toString());

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
          motor_ligado, em_degelo, mac_address, ip_local, sinal_wifi, uptime, firmware_version
        } = payload;

        const telemetria = validarTelemetria({ equipamento_id, temperatura, umidade, consumo_kwh });
        const t = telemetria.temperatura;
        const u = telemetria.umidade;
        const c_kwh = telemetria.consumo;

        const hw_mac = (mac_address || 'A4:CF:12:XX:XX:XX').substring(0, 20);
        const hw_ip = (ip_local || '192.168.1.100').substring(0, 15);
        const hw_wifi = sinal_wifi ? parseInt(sinal_wifi) : -65;
        const hw_up = (uptime || '0h').substring(0, 50);
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

        const [r] = await pool.execute('INSERT INTO leituras (equipamento_id, temperatura, umidade, consumo_kwh) VALUES (?, ?, ?, ?)', [equipamento_id, t, u, c_kwh]);
        const [eq] = await pool.execute('SELECT temp_max, temp_min, umidade_min, umidade_max, nome, em_degelo, motor_ligado, setor, filial, empresa FROM equipamentos WHERE id = ?', [equipamento_id]);

        if (eq.length > 0) {
          const isMotorLigado = (motor_ligado == 1 || motor_ligado === true);
          const isEmDegelo = (em_degelo == 1 || em_degelo === true);
          await pool.execute('UPDATE equipamentos SET motor_ligado=?, em_degelo=? WHERE id=?', [isMotorLigado, isEmDegelo, equipamento_id]);

          const tMax = parseFloat(eq[0].temp_max);
          const tMin = parseFloat(eq[0].temp_min);
          const uMax = parseFloat(eq[0].umidade_max || 0);
          const uMin = parseFloat(eq[0].umidade_min || 0);

          let novosAlertas = [];

          /**
           * Concentra a logica de check and alert para manter o restante do rota/API mais legivel.
           */
          const checkAndAlert = async (condicaoAnomala, tipoAlerta, mensagem) => {
            if (condicaoAnomala) {
              const [existe] = await pool.execute('SELECT id FROM notificacoes WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
              if (existe.length === 0) {
                const [inserido] = await pool.execute('INSERT INTO notificacoes (equipamento_id, mensagem, tipo_alerta, resolvido) VALUES (?, ?, ?, 0)', [equipamento_id, mensagem, tipoAlerta]);
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
            } else {
              await pool.execute('UPDATE notificacoes SET resolvido=1 WHERE equipamento_id=? AND (resolvido=0 OR resolvido IS NULL) AND tipo_alerta=?', [equipamento_id, tipoAlerta]);
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

          if (uMax > 0 || uMin > 0) {
            const condUmi = ((u > uMax || u < uMin) && !isEmDegelo);
            await checkAndAlert(condUmi, 'UMIDADE', `ALERTA HIGROMÉTRICO: Umidade de "${eq[0].nome}" fora dos limites permitidos (${u}%).`);
          }

          if (novosAlertas.length > 0) { io.emit('atualizacao_dados'); novosAlertas.forEach(a => io.emit('novo_alerta', a)); }
          io.emit('nova_leitura', { id: r.insertId, equipamento_id, temperatura: t, umidade: u, consumo_kwh: c_kwh, motor_ligado: isMotorLigado, em_degelo: isEmDegelo, ultima_comunicacao: new Date(), status_conexao: 'online', data_hora: new Date(), nome: eq[0].nome, setor: eq[0].setor, filial: eq[0].filial, empresa: eq[0].empresa });
        }
      } catch (error) {
        console.error('❌ [ERRO MQTT]: Falha ao processar payload', error.message);
      }
    }
  });

  // ============================================================================
  // ROTAS DO RASPBERRY PI (NETWORK SCANNER PROBE VIA API)
  // ============================================================================

  app.post('/api/soc/scanner/iniciar', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    const { filial, ip_range } = req.body;

    try {
      await pool.execute('INSERT INTO scanner_jobs (filial, ip_range) VALUES (?, ?)', [filial, ip_range]);
      res.json({ success: true, message: `Sonda ativada! Ordem enfileirada para a filial ${filial}` });
    } catch(e) {
      res.status(500).json({ error: 'Erro ao registrar ordem de varredura.' });
    }
  });

  app.get('/api/soc/scanner/jobs/:filial', verificarToken, async (req, res) => {
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

  app.post('/api/soc/scanner/jobs/:id/concluir', verificarToken, async (req, res) => {
    try {
      await pool.execute('UPDATE scanner_jobs SET status = "Concluido" WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch(e) {
      res.status(500).json({ error: 'Erro ao concluir job.' });
    }
  });

  app.post('/api/soc/scanner/resultado', verificarToken, async (req, res) => {
    const relatorio = req.body;
    try {
      console.log(`🛡️ [SOC API] Relatório de Rede recebido da filial: ${relatorio.filial}`);

      for (const disp of relatorio.dispositivos) {
        await pool.execute(
          `INSERT INTO rede_scans (filial, ip_alvo, hostname, portas_abertas, status)
           VALUES (?, ?, ?, ?, 'Online')`,
          [relatorio.filial, disp.ip, disp.hostname, JSON.stringify(disp.portas)]
        );
      }

      if (io) io.emit('atualizacao_dados');
      res.json({ success: true, message: 'Relatório armazenado com sucesso no MySQL.' });
    } catch(e) {
      res.status(500).json({ error: 'Erro ao salvar resultados da varredura.' });
    }
  });

  app.get('/api/soc/scanner/resultados', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV') return res.status(403).json({ error: 'Acesso negado.' });
    try {
      const [rows] = await pool.execute('SELECT * FROM rede_scans ORDER BY data_scan DESC LIMIT 100');
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: 'Erro ao buscar resultados.' });
    }
  });

  // ============================================================================
  // NOVAS ROTAS DA FASE 1: PORTAL PÚBLICO E RELATÓRIO ANVISA
  // ============================================================================

  app.get('/api/public/live/:filial', async (req, res) => {
    try {
      const filialReq = req.params.filial.replace(/-/g, ' ');

      let query = `
        SELECT e.nome, e.filial, e.setor, e.motor_ligado, e.em_degelo, e.temp_max, e.temp_min,
        (SELECT temperatura FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS ultima_temp,
        (SELECT data_hora FROM leituras WHERE equipamento_id = e.id ORDER BY data_hora DESC LIMIT 1) AS atualizado_em
        FROM equipamentos e
      `;
      let params = [];

      if (filialReq.toLowerCase() !== 'todas') {
        query += ` WHERE e.filial LIKE ?`;
        params.push(`%${filialReq}%`);
      }

      const [r] = await pool.execute(query, params);
      res.json({ success: true, unidade: filialReq, equipamentos: r });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Falha ao carregar portal público.' });
    }
  });

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

  // ============================================================================
  // VARREDURA DE REDE E PORTAS NO BACKEND (NODE.JS)
  // ============================================================================
  app.get('/api/network-scan', verificarToken, async (req, res) => {
    if (req.userRole !== 'DEV' && req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso restrito.' });
    }

    const net = require('net');
    const os = require('os');

    let baseSubnet = '192.168.200.';
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const netInterface of interfaces[name]) {
        if (netInterface.family === 'IPv4' && !netInterface.internal) {
          const parts = netInterface.address.split('.');
          if (parts.length === 4) {
            baseSubnet = `${parts[0]}.${parts[1]}.${parts[2]}.`;
          }
        }
      }
    }

    const portasAlvo = [
      { porta: 80, servico: 'HTTP / Web UI' },
      { porta: 443, servico: 'HTTPS / Secure Web' },
      { porta: 1883, servico: 'MQTT Broker' },
      { porta: 3306, servico: 'MySQL Database' },
      { porta: 8080, servico: 'HTTP Alternativo / Proxy' },
      { porta: 554, servico: 'RTSP / Câmera IP' }
    ];

    const dispositivosAtivos = [];
    const promessas = [];

    for (let i = 1; i <= 30; i++) {
      const ip = baseSubnet + i;
      promessas.push(
        new Promise((resolve) => {
          const portasAbertas = [];
          let checksRestantes = portasAlvo.length;

          portasAlvo.forEach(({ porta, servico }) => {
            const socket = new net.Socket();
            socket.setTimeout(250);

            socket.on('connect', () => {
              portasAbertas.push({ porta, servico });
              socket.destroy();
            });

            socket.on('timeout', () => {
              socket.destroy();
            });

            socket.on('error', () => {
              socket.destroy();
            });

            socket.on('close', () => {
              checksRestantes--;
              if (checksRestantes === 0) {
                if (portasAbertas.length > 0) {
                  dispositivosAtivos.push({
                    ip,
                    hostname: ip === baseSubnet + '1' ? 'Gateway / Roteador' : 'Dispositivo IoT / Servidor',
                    portas: portasAbertas
                  });
                }
                resolve();
              }
            });

            socket.connect(porta, ip);
          });
        })
      );
    }

    await Promise.all(promessas);
    res.json({ success: true, subnet: baseSubnet + '0/24', dispositivos: dispositivosAtivos });
  });

  // ============================================================================
  // WATCHDOG: MOTOR AUTÔNOMO DE DETECÇÃO DE QUEDA DE HARDWARE
  // ============================================================================
  setInterval(async () => {
    try {
      const [hardwaresMortos] = await pool.execute(`
        SELECT h.equipamento_id, h.ultima_comunicacao, e.nome, e.setor, e.filial, e.empresa
        FROM hardware_iot h JOIN equipamentos e ON h.equipamento_id = e.id
        WHERE h.ultima_comunicacao < DATE_SUB(NOW(), INTERVAL 3 MINUTE)
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
