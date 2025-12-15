import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import env from '../lib/env';
import { socketAuthMiddleware } from './auth';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from './types';
import { setupLocationHandlers } from './locationHandlers';

let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null =
  null;

export const initSocket = (server: HttpServer) => {
  io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    server,
    {
      cors: {
        origin: '*', // TODO: Change this to app domain in production
        methods: ['GET', 'POST'],
      },
      pingTimeout: 60000, // closes inactive sockets
    },
  );

  io.use(socketAuthMiddleware);

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;

    if (!userId) return;

    // Join personal room
    socket.join(`user:${userId}`);
    socket.emit('connection:ack', { message: 'Socket connected', userId });

    console.log(`✅ User ${userId} connected to socket.`);

    // Location handlers
    if (io) {
      setupLocationHandlers(socket, io);
    }

    socket.on('ping:client', () => {
      const timestamp = new Date().toISOString();
      console.log(`\n📥 [PING RECEIVED]\n🕒 Time: ${timestamp}\n------------------------------`);

      socket.emit('pong:server', { time: timestamp });
    });

    socket.on('disconnect', reason => {
      console.log(`[${new Date().toISOString()}] ❌ User ${userId} disconnected (${reason})`);
    });
  });

  console.log('⚡️ Socket.IO initialized');
  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.io not initialized yet');
  return io;
};
