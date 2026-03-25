import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

let io;

function roomForUser(userId) {
  return `user:${String(userId)}`;
}

export function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    const token =
      socket.handshake?.auth?.token ||
      (typeof socket.handshake?.headers?.authorization === 'string' && socket.handshake.headers.authorization.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.slice('Bearer '.length)
        : null);

    if (!token) {
      socket.disconnect(true);
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const userId = payload?.sub ? String(payload.sub) : null;
      if (!userId) {
        socket.disconnect(true);
        return;
      }
      socket.data.userId = userId;
      socket.join(roomForUser(userId));
    } catch {
      socket.disconnect(true);
      return;
    }

    if (config.nodeEnv !== 'production') {
      // eslint-disable-next-line no-console
      console.log('socket connected', socket.id);
    }

    socket.on('disconnect', () => {
      if (config.nodeEnv !== 'production') {
        // eslint-disable-next-line no-console
        console.log('socket disconnected', socket.id);
      }
    });
  });

  return io;
}

export function broadcastAlert(alert) {
  if (io) {
    const userId = alert?.user_id ? String(alert.user_id) : null;
    if (!userId) return;
    io.to(roomForUser(userId)).emit('alert_created', alert);
  }
}
