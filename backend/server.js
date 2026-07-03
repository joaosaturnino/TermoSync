/**
 * Servidor Backend - TermoSync Enterprise (Arquitetura Multi-Tenant SaaS)
 * Otimizado para alta performance e sincronizado com o Simulador IoT
 * --- REFATORADO ---
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
  maxHttpBufferSize: 5e7 
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// 1. Inicializa o banco de dados e as migrações (automático via config/db.js)
require('./config/db');

// 2. Registra os eventos do Socket.io
require('./sockets')(io);

// 3. Registra as Rotas (passando instância do App e do Socket.io)
require('./routes/api')(app, io);

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => { 
    console.log(`✅ Backend online na porta ${PORT}. Motor Multi-Tenant SaaS Ativo.`); 
});