const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.use((socket, next) => {
    // Token may arrive via the handshake auth payload or the httpOnly cookie
    let token = socket.handshake.auth?.token;
    if (!token) {
      const cookieHeader = socket.handshake.headers?.cookie;
      if (cookieHeader) {
        for (const part of cookieHeader.split(';')) {
          const idx = part.indexOf('=');
          if (idx > -1 && part.slice(0, idx).trim() === 'access_token') {
            token = decodeURIComponent(part.slice(idx + 1).trim());
            break;
          }
        }
      }
    }
    if (!token) return next(new Error('Authentication error'));

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      socket.user = { id: decoded.sub };
      next();
    });
  });

  io.on('connection', (socket) => {
    // Join a room specifically for this user's ID to receive private messages
    socket.join(socket.user.id);

    // Group chat: clients join/leave per-space rooms to receive live messages
    socket.on('join_space', (spaceId) => {
      if (spaceId) socket.join(`space:${spaceId}`);
    });
    socket.on('leave_space', (spaceId) => {
      if (spaceId) socket.leave(`space:${spaceId}`);
    });

    socket.on('disconnect', () => {
      // Automatic cleanup
    });
  });

  return io;
};

const getIo = () => {
  if (!io) throw new Error('Socket.io not initialized!');
  return io;
};

module.exports = { initSocket, getIo };
