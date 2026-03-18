import { Server } from 'socket.io';
import { config } from '../config.js';

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
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
    io.emit('alert_created', alert);
  }
}
