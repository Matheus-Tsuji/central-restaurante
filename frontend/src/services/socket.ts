import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';

let socketInstance: Socket | null = null;

try {
  socketInstance = io(SOCKET_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 3000
  });
} catch (e) {
  console.warn('Socket.IO não pôde ser inicializado de imediato:', e);
}

export const socket = socketInstance;

export function joinRoom(room: 'kitchen' | 'waiter' | 'cashier') {
  if (socket && socket.connected) {
    socket.emit('join_room', room);
  }
}
