import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'node:http';

let io: SocketIOServer | null = null;

export function initSocketIO(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Novo cliente conectado via Socket.IO: ${socket.id}`);

    socket.on('join_room', (room: string) => {
      socket.join(room);
      console.log(`📌 Socket ${socket.id} entrou na sala: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO não foi inicializado!');
  }
  return io;
}

// Métodos utilitários para disparo de eventos em tempo real
export function notifyOrderCreated(order: any): void {
  if (io) {
    io.to('kitchen').emit('order:created', order);
    io.to('cashier').emit('order:created', order);
  }
}

export function notifyOrderStatusChanged(order: any): void {
  if (io) {
    io.to('kitchen').emit('order:status_changed', order);
    io.to('waiter').emit('order:status_changed', order);
    io.to('cashier').emit('order:status_changed', order);
  }
}

export function notifyTableStatusChanged(table: any): void {
  if (io) {
    io.to('waiter').emit('table:status_changed', table);
    io.to('cashier').emit('table:status_changed', table);
  }
}

export function notifyPaymentProcessed(payment: any): void {
  if (io) {
    io.to('cashier').emit('payment:processed', payment);
    io.to('waiter').emit('payment:processed', payment);
  }
}
