import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { env } from './config/env.js';
import { initDatabase } from './config/database.js';
import { initSocketIO } from './sockets/socketManager.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { initMDNS, stopMDNS } from './utils/mdns.js';

// Inicializar banco de dados SQLite com tabelas e dados prévios
initDatabase();

const app = express();
const httpServer = createServer(app);

// Inicializar WebSockets em tempo real (Socket.IO)
initSocketIO(httpServer);

// Middlewares globais
app.use(cors({ origin: '*' }));
app.use(express.json());

// Rota de Healthcheck
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    system: 'Central de Restaurante Multi-telas',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Rotas da API RESTful
app.use('/api', apiRoutes);

// Middleware central de tratamento de erros
app.use(errorHandler);

const PORT = Number(env.PORT) || 3000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Central rodando em http://localhost:${PORT}`);
  console.log(`📡 WebSocket Socket.IO pronto para conexões na rede local.`);
  
  // Ativar servidor mDNS (Bonjour ZeroConf) para resolver restaurante.local automaticamente na rede Wi-Fi
  initMDNS(5173, PORT);
});

process.on('SIGINT', () => {
  stopMDNS();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopMDNS();
  process.exit(0);
});