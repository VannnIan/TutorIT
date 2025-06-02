const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Store active users and their status
const users = new Map();
// Store active rooms
const rooms = new Map();

// User states
const UserState = {
  IDLE: 'idle',
  SEARCHING: 'searching',
  IN_ROOM: 'in_room'
};

io.on('connection', socket => {
  console.log('User connected:', socket.id);
  
  // Initialize user state
  users.set(socket.id, {
    state: UserState.IDLE,
    roomId: null,
    preferences: {} // Can be used for matchmaking criteria
  });

  // Handle matchmaking request
  socket.on('find-match', (preferences = {}) => {
    const user = users.get(socket.id);
    if (!user) return;

    // Update user preferences and state
    user.preferences = preferences;
    user.state = UserState.SEARCHING;
    users.set(socket.id, user);

    // Find potential match
    const match = findMatch(socket.id);
    if (match) {
      createRoom(socket.id, match);
    } else {
      socket.emit('searching');
    }
  });

  // Handle user canceling matchmaking
  socket.on('cancel-match', () => {
    const user = users.get(socket.id);
    if (user && user.state === UserState.SEARCHING) {
      user.state = UserState.IDLE;
      users.set(socket.id, user);
      socket.emit('search-cancelled');
    }
  });

  // Handle WebRTC signaling
  socket.on('offer', ({ target, sdp }) => {
    io.to(target).emit('offer', { sdp, socketId: socket.id });
  });

  socket.on('answer', ({ target, sdp }) => {
    io.to(target).emit('answer', { sdp, socketId: socket.id });
  });

  socket.on('ice-candidate', ({ target, candidate }) => {
    io.to(target).emit('ice-candidate', { candidate });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      if (user.roomId) {
        handleRoomDisconnection(socket.id, user.roomId);
      }
      users.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

// Find a matching user based on preferences and availability
function findMatch(userId) {
  const currentUser = users.get(userId);
  if (!currentUser) return null;

  for (const [potentialMatchId, potentialMatch] of users) {
    if (potentialMatchId !== userId && 
        potentialMatch.state === UserState.SEARCHING &&
        isCompatibleMatch(currentUser, potentialMatch)) {
      return potentialMatchId;
    }
  }
  return null;
}

// Check if two users are compatible for matching
function isCompatibleMatch(user1, user2) {
  // Add your matchmaking criteria here
  // For now, just checking if both are searching
  return user1.state === UserState.SEARCHING && 
         user2.state === UserState.SEARCHING;
}

// Create a room for matched users
function createRoom(user1Id, user2Id) {
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Update users' states
  const user1 = users.get(user1Id);
  const user2 = users.get(user2Id);
  
  user1.state = UserState.IN_ROOM;
  user1.roomId = roomId;
  user2.state = UserState.IN_ROOM;
  user2.roomId = roomId;
  
  users.set(user1Id, user1);
  users.set(user2Id, user2);

  // Create room
  rooms.set(roomId, {
    users: [user1Id, user2Id],
    createdAt: Date.now()
  });

  // Notify users
  io.to(user1Id).emit('matched', { 
    otherUserId: user2Id,
    roomId: roomId 
  });
  io.to(user2Id).emit('matched', { 
    otherUserId: user1Id,
    roomId: roomId 
  });
}

// Handle user disconnection from room
function handleRoomDisconnection(userId, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  // Notify other user in the room
  const otherUserId = room.users.find(id => id !== userId);
  if (otherUserId) {
    const otherUser = users.get(otherUserId);
    if (otherUser) {
      otherUser.state = UserState.IDLE;
      otherUser.roomId = null;
      users.set(otherUserId, otherUser);
      io.to(otherUserId).emit('peer-disconnected');
    }
  }

  // Clean up room
  rooms.delete(roomId);
}

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
