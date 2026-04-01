import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { logger } from './logger.js';

let io;

function roomForUser(userId) {
  return `user:${String(userId)}`;
}

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
    transports: ['websocket'], // ✅ force websocket (production safe)
  });

  io.on('connection', (socket) => {
    try {
      const token =
        socket.handshake?.auth?.token ||
        (typeof socket.handshake?.headers?.authorization === 'string' &&
        socket.handshake.headers.authorization.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice('Bearer '.length)
          : null);

      if (!token) {
        socket.disconnect(true);
        return;
      }

      const payload = jwt.verify(token, config.jwtSecret);
      const userId = payload?.sub ? String(payload.sub) : null;

      if (!userId) {
        socket.disconnect(true);
        return;
      }

      socket.data.userId = userId;
      socket.join(roomForUser(userId));

      logger.info({ socket_id: socket.id, user_id: userId }, 'socket_connected');

    } catch (err) {
      logger.warn({ err }, 'socket_auth_failed');
      socket.disconnect(true);
      return;
    }

    /* =========================
       SOCKET ERROR HANDLING
    ========================= */

    socket.on('error', (err) => {
      logger.error({ err, socket_id: socket.id }, 'socket_error');
    });

    socket.on('disconnect', (reason) => {
      logger.info(
        { socket_id: socket.id, reason },
        'socket_disconnected'
      );
    });
  });

  return io;
}

/* =========================
   SAFE BROADCAST
========================= */

export function broadcastAlert(alert) {
  if (!io) {
    logger.error('socket_not_initialized');
    return;
  }

  const userId = alert?.user_id ? String(alert.user_id) : null;
  if (!userId) return;

  io.to(roomForUser(userId)).emit('alert_created', alert);
}