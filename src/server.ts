import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { env } from './config/env.js';
import { initDatabase } from './config/database.js';
import { initSocketIO } from './sockets/socketManager.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';

// Inicializar banco de dados SQLite com tabelas e dados prévios
initDatabase();

const app = express();
const httpServer = createServer(app);

// Inicializar WebSockets em tempo real (Socket.IO)
initSocketIO(httpServer);

// Middlewares globais
app.use(cors());
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

const PORT = env.PORT;

httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor Central rodando com sucesso em http://localhost:${PORT}`);
  console.log(`📡 WebSocket Socket.IO pronto para conexões em tempo real.`);
});