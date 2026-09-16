/**
 * Servidor Backend - TermoSync Enterprise (Arquitetura Multi-Tenant SaaS)
 * Otimizado para alta performance e sincronizado com o Simulador IoT
 * --- REFATORADO ---
 */

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

// CORS é centralizado aqui para que HTTP e Socket.io usem a mesma política.
// Em produção, configure CORS_ORIGIN com a lista de origens permitidas.
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : '*';
const corsOptions = { origin: corsOrigins, methods: ['GET', 'POST', 'PUT', 'DELETE'] };

// Socket.io transporta telemetria, alertas e eventos operacionais em tempo real.
// O limite alto de payload evita falhas ao enviar pacotes administrativos grandes.
const io = new Server(server, { 
  cors: corsOptions,
  maxHttpBufferSize: 5e7 
});

// Ordem dos middlewares importa: primeiro cria requestId/contexto, depois registra
// logs, aplica headers de segurança, CORS, rate limit e só então parseia JSON.
app.use(attachSecurityContext);
app.use(logHttpRequest);
app.use(addSecurityHeaders);
app.use(cors(corsOptions));

// Rate limit geral protege a API usada pela interface humana.
const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 3000),
  keyPrefix: 'api'
});

// Telemetria IoT recebe um limitador próprio para o simulador/sensores não
// consumirem o mesmo orçamento das telas do usuário.
const iotIngestRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.IOT_INGEST_RATE_LIMIT_MAX || 5000),
  message: 'Volume de telemetria acima do permitido. Aguarde alguns instantes.',
  keyPrefix: 'iot-ingest'
});

// Health checks ficam fora do rate limit; ingestão de leituras usa o balde IoT;
// demais rotas continuam protegidas pelo limitador padrão.
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/system/health') return next();
  if (req.method === 'POST' && req.path === '/leituras') {
    return iotIngestRateLimiter(req, res, next);
  }
  return apiRateLimiter(req, res, next);
});
app.use(express.json({ limit: '50mb' })); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  immutable: true,
  maxAge: '7d'
}));

// 1. Inicializa o banco de dados e as migrações (automático via config/db.js)
require('./config/db');

// 2. Registra os eventos do Socket.io
require('./sockets')(io);

// 3. Registra as Rotas (passando instância do App e do Socket.io)
require('./routes/api')(app, io);

const PORT = process.env.PORT || 3000;
/**
 * Verifica a condicao is env flag enabled e retorna um valor booleano.
 */
const isEnvFlagEnabled = (value) => ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
const smsProviders = {
    twilio: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)),
    webhook: Boolean(process.env.SMS_WEBHOOK_URL),
    textbee: Boolean(process.env.TEXTBEE_API_KEY),
    textbelt: isEnvFlagEnabled(process.env.TEXTBELT_ENABLED) || Boolean(process.env.TEXTBELT_API_KEY)
};

server.listen(PORT, '0.0.0.0', () => { 
    console.log(`✅ Backend online na porta ${PORT}. Motor Multi-Tenant SaaS Ativo.`); 
    console.log(`[CONFIG] SMS Twilio=${smsProviders.twilio ? 'ON' : 'OFF'} Webhook=${smsProviders.webhook ? 'ON' : 'OFF'} Textbee=${smsProviders.textbee ? 'ON' : 'OFF'} Textbelt=${smsProviders.textbelt ? 'ON' : 'OFF'}`);
});
