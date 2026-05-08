const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Room = require('./game/room');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // For dev
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create_room', ({ playerName }, callback) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = new Room(roomId);
    room.addPlayer(socket.id, playerName);
    rooms.set(roomId, room);
    
    socket.join(roomId);
    callback({ success: true, roomId });
    io.to(roomId).emit('room_update', room.getPublicState());
  });

  socket.on('join_room', ({ roomId, playerName }, callback) => {
    const room = rooms.get(roomId);
    if (!room) return callback({ success: false, message: 'Room not found' });
    
    if (room.addPlayer(socket.id, playerName)) {
      socket.join(roomId);
      callback({ success: true });
      io.to(roomId).emit('room_update', room.getPublicState());
    } else {
      callback({ success: false, message: 'Room full or already started' });
    }
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.startGame()) {
      io.to(roomId).emit('room_update', room.getPublicState());
    }
  });

  socket.on('finish_initial_peek', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.state === 'INITIAL_PEEK') {
      room.setPlayerFinishedInitialPeek(socket.id);
      io.to(roomId).emit('room_update', room.getPublicState());
    }
  });

  socket.on('draw_deck', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.drawFromDeck(socket.id)) {
      io.to(roomId).emit('room_update', room.getPublicState());
      // Send the actual card only to the player who drew it
      socket.emit('private_drawn_card', room.drawnCard);
    }
  });

  socket.on('draw_discard_swap', ({ roomId, cardIndex }) => {
    const room = rooms.get(roomId);
    if (room && room.drawFromDiscardAndSwap(socket.id, cardIndex)) {
      io.to(roomId).emit('room_update', room.getPublicState());
    }
  });

  socket.on('call_cabo', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.callCabo(socket.id)) {
      io.to(roomId).emit('room_update', room.getPublicState());
    }
  });

  socket.on('swap_drawn', ({ roomId, cardIndex }) => {
    const room = rooms.get(roomId);
    if (room && room.swapDrawnCard(socket.id, cardIndex)) {
      io.to(roomId).emit('room_update', room.getPublicState());
    }
  });

  socket.on('discard_drawn', ({ roomId, usePower }) => {
    const room = rooms.get(roomId);
    if (room && room.discardDrawnCard(socket.id, usePower)) {
      io.to(roomId).emit('room_update', room.getPublicState());
    }
  });

  socket.on('use_peek', ({ roomId, cardIndex }) => {
    const room = rooms.get(roomId);
    if (room && room.usePeek(socket.id, cardIndex)) {
      // Send private card info
      const player = room.players.find(p => p.id === socket.id);
      socket.emit('peek_result', { cardIndex, card: player.cards[cardIndex] });
      io.to(roomId).emit('room_update', room.getPublicState());
    }
  });

  socket.on('use_spy', ({ roomId, targetPlayerId, cardIndex }) => {
    const room = rooms.get(roomId);
    if (room && room.useSpy(socket.id, targetPlayerId, cardIndex)) {
      const target = room.players.find(p => p.id === targetPlayerId);
      socket.emit('spy_result', { targetPlayerId, cardIndex, card: target.cards[cardIndex] });
      io.to(roomId).emit('room_update', room.getPublicState());
    }
  });

  socket.on('use_swap', ({ roomId, myCardIndex, targetPlayerId, targetCardIndex }) => {
    const room = rooms.get(roomId);
    if (room && room.useSwap(socket.id, myCardIndex, targetPlayerId, targetCardIndex)) {
      io.to(roomId).emit('room_update', room.getPublicState());
    }
  });

  socket.on('use_queen_peek', ({ roomId, cardIndex }) => {
    const room = rooms.get(roomId);
    if (room && room.useQueenPeek(socket.id, cardIndex)) {
      const player = room.players.find(p => p.id === socket.id);
      socket.emit('peek_result', { cardIndex, card: player.cards[cardIndex] });
      io.to(roomId).emit('room_update', room.getPublicState());
    }
  });

  socket.on('use_queen_spy', ({ roomId, targetPlayerId, cardIndex }) => {
    const room = rooms.get(roomId);
    if (room && room.useQueenSpy(socket.id, targetPlayerId, cardIndex)) {
      const target = room.players.find(p => p.id === targetPlayerId);
      socket.emit('spy_result', { targetPlayerId, cardIndex, card: target.cards[cardIndex] });
      io.to(roomId).emit('room_update', room.getPublicState());
    }
  });

  socket.on('use_queen_swap', ({ roomId, doSwap }) => {
    const room = rooms.get(roomId);
    if (room && room.useQueenSwap(socket.id, doSwap)) {
      io.to(roomId).emit('room_update', room.getPublicState());
    }
  });

  socket.on('match_card', ({ roomId, cardIndex }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const result = room.matchCard(socket.id, cardIndex);
    if (result && result.success) {
      if (!result.isMatch) {
        // Emit failed match so everyone sees the failed card briefly
        io.to(roomId).emit('match_failed', { playerId: socket.id, cardIndex, card: result.cardToMatch });
      } else {
        io.to(roomId).emit('match_success', { playerId: socket.id });
      }
      io.to(roomId).emit('room_update', room.getPublicState());
    }
  });

  // Additional helper to view initial cards
  socket.on('view_initial_cards', ({ roomId, cardIndices }) => {
    const room = rooms.get(roomId);
    if (room && room.state === 'INITIAL_PEEK') {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        const cards = cardIndices.map(i => ({ index: i, card: player.cards[i] }));
        socket.emit('initial_cards_result', cards);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove player from any room they are in
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.some(p => p.id === socket.id)) {
        const isEmpty = room.removePlayer(socket.id);
        if (isEmpty) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('room_update', room.getPublicState());
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
