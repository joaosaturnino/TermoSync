/** Inicializa o servidor HTTP, o Socket.IO e o ciclo de vida da plataforma TermoSync. */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { addSecurityHeaders, attachSecurityContext, createRateLimiter, logHttpRequest } = require('./middlewares/security');

const app = express();
app.disable('x-powered-by');
const server = http.createServer(app);

// HTTP e Socket.IO compartilham a mesma lista de origens permitidas.
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : '*';
const corsOptions = { origin: corsOrigins, methods: ['GET', 'POST', 'PUT', 'DELETE'] };

const io = new Server(server, {
  cors: corsOptions,
  maxHttpBufferSize: 5e7
});

// A ordem garante contexto de segurança e logs antes do processamento da rota.
app.use(attachSecurityContext);
app.use(logHttpRequest);
app.use(addSecurityHeaders);
app.use(cors(corsOptions));

const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 3000),
  keyPrefix: 'api'
});

const iotIngestRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.IOT_INGEST_RATE_LIMIT_MAX || 5000),
  message: 'Volume de telemetria acima do permitido. Aguarde alguns instantes.',
  keyPrefix: 'iot-ingest'
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/system/health') return next();
  if (req.method === 'POST' && req.path === '/leituras') return iotIngestRateLimiter(req, res, next);
  return apiRateLimiter(req, res, next);
});
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  immutable: true,
  maxAge: '7d'
}));

require('./config/db');
require('./sockets')(io);
// A camada HTTP centraliza autenticação, trials com prazo e ambientes permanentes de demonstração.
require('./routes/api')(app, io);

const PORT = process.env.PORT || 3000;
/**
 * Verifica a condicao is env flag enabled e retorna um valor booleano.
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
 * @returns {boolean} Indica se a condição avaliada foi atendida.
 * @maintenance-generated v3 - Comentário gerado a partir da assinatura e das integrações locais.
 */
const isEnvFlagEnabled = (value) => ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
const smsProviders = {
    twilio: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)),
    webhook: Boolean(process.env.SMS_WEBHOOK_URL),
    textbee: Boolean(process.env.TEXTBEE_API_KEY),
    textbelt: isEnvFlagEnabled(process.env.TEXTBELT_ENABLED) || Boolean(process.env.TEXTBELT_API_KEY)
};

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`[STARTUP] A porta ${PORT} já está em uso. Encerre a instância anterior do backend antes de iniciar outra.`);
        process.exitCode = 1;
        return;
    }
    console.error('[STARTUP] Falha ao iniciar o servidor:', error);
    process.exitCode = 1;
});

server.listen(PORT, '0.0.0.0', () => { 
    console.log(`✅ Backend online na porta ${PORT}. Motor Multi-Tenant SaaS Ativo.`); 
    console.log(`[CONFIG] SMS Twilio=${smsProviders.twilio ? 'ON' : 'OFF'} Webhook=${smsProviders.webhook ? 'ON' : 'OFF'} Textbee=${smsProviders.textbee ? 'ON' : 'OFF'} Textbelt=${smsProviders.textbelt ? 'ON' : 'OFF'}`);
});
