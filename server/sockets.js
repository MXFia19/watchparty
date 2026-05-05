import {
  createRoomState, getRoom, deleteRoomState,
  addMember, removeMember, updatePlayState,
  updateVideoUrl, getRoomMembers, getMemberCount,
  isHost, transferHost, setCollaborativeMode,
} from './roomManager.js';
import { db } from './db.js';

export function setupSockets(io) {
  io.on('connection', (socket) => {
    let currentRoomId = null;
    let currentUserId = null;

    socket.on('room:join', ({ roomId, userId, pseudo, avatar }, callback) => {
      const dbRoom = db.getRoom(roomId);
      if (!dbRoom) return callback?.({ error: 'Room introuvable' });

      let roomState = getRoom(roomId);
      if (!roomState) roomState = createRoomState(roomId, dbRoom.host_id, dbRoom.video_url);

      addMember(roomId, socket.id, { userId, pseudo, avatar: avatar || null });
      socket.join(roomId);
      currentRoomId = roomId;
      currentUserId = userId;
      db.touchRoom(roomId);

      callback?.({ ok: true, state: { videoUrl: roomState.videoUrl, playing: roomState.playing, currentTime: roomState.currentTime, hostId: roomState.hostId } });
      io.to(roomId).emit('room:members', getRoomMembers(roomId));
      socket.to(roomId).emit('room:user_joined', { userId, pseudo, avatar });
      console.log(`[Room ${roomId}] ${pseudo} (${getMemberCount(roomId)} membres)`);
    });

    socket.on('room:leave', () => {
      handleLeave(socket, io, currentRoomId, currentUserId);
      currentRoomId = null; currentUserId = null;
    });

    socket.on('player:sync', ({ roomId, playing, currentTime, userId }) => {
      const room = getRoom(roomId);
      if (!room) return;
      // En mode normal : seul le host peut contrôler
      // En mode collaboratif : tout le monde peut contrôler
      if (!room.collaborativeMode && room.hostId !== userId && getMemberCount(roomId) > 1) return;
      updatePlayState(roomId, { playing, currentTime });
      socket.to(roomId).emit('player:sync', { playing, currentTime, from: userId });
    });

    socket.on('player:change_video', ({ roomId, videoUrl, userId }) => {
      const room = getRoom(roomId);
      if (!room) return;
      if (!room.collaborativeMode && room.hostId !== userId) return;
      updateVideoUrl(roomId, videoUrl);
      db.updateRoom(roomId, { video_url: videoUrl });
      io.to(roomId).emit('player:change_video', { videoUrl });
    });

    socket.on('player:request_sync', ({ roomId }) => {
      const room = getRoom(roomId);
      if (!room) return;
      socket.emit('player:sync', { playing: room.playing, currentTime: room.currentTime, from: 'server' });
    });

    socket.on('chat:message', ({ roomId, userId, pseudo, avatar, message }) => {
      if (!message?.trim() || message.length > 500) return;
      io.to(roomId).emit('chat:message', { userId, pseudo, avatar, message: message.trim(), timestamp: Date.now() });
    });

    socket.on('room:kick', ({ roomId, targetUserId, userId }) => {
      if (!isHost(roomId, userId)) return;
      const room = getRoom(roomId);
      if (!room) return;
      // Trouver le socket du membre à kicker
      const members = getRoomMembers(roomId);
      const target = members.find(m => m.userId === targetUserId);
      if (!target) return;
      // Envoyer l'event kicked uniquement à lui
      io.to(target.socketId).emit('room:kicked');
      // Le déconnecter de la room côté serveur
      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) {
        removeMember(roomId, target.socketId);
        targetSocket.leave(roomId);
        io.to(roomId).emit('room:members', getRoomMembers(roomId));
        io.to(roomId).emit('room:user_left', { userId: targetUserId, pseudo: target.pseudo });
        console.log(`[Room ${roomId}] ${target.pseudo} a été kické`);
      }
    });

    socket.on('room:toggle_collaborative', ({ roomId, userId, enabled }) => {
      // Seul le host peut activer/désactiver le mode collaboratif
      if (!isHost(roomId, userId)) return;
      const room = setCollaborativeMode(roomId, enabled);
      if (!room) return;
      io.to(roomId).emit('room:collaborative_changed', { enabled });
      console.log(`[Room ${roomId}] Mode collaboratif : ${enabled ? 'ON' : 'OFF'}`);
    });

    socket.on('room:transfer_host', ({ roomId, newHostId, userId }) => {
      if (!isHost(roomId, userId)) return;
      const room = transferHost(roomId, newHostId);
      if (!room) return;
      db.updateRoom(roomId, { host_id: newHostId });
      io.to(roomId).emit('room:host_changed', { newHostId });
    });

    socket.on('disconnect', () => {
      if (currentRoomId) handleLeave(socket, io, currentRoomId, currentUserId);
    });
  });
}

function handleLeave(socket, io, roomId, userId) {
  if (!roomId) return;
  const room = getRoom(roomId);
  if (!room) return;

  removeMember(roomId, socket.id);
  socket.leave(roomId);

  if (getMemberCount(roomId) === 0) {
    deleteRoomState(roomId);
  } else {
    if (room.hostId === userId) {
      const members = getRoomMembers(roomId);
      if (members.length > 0) {
        const newHostId = members[0].userId;
        transferHost(roomId, newHostId);
        db.updateRoom(roomId, { host_id: newHostId });
        io.to(roomId).emit('room:host_changed', { newHostId });
      }
    }
    io.to(roomId).emit('room:members', getRoomMembers(roomId));
    io.to(roomId).emit('room:user_left', { userId });
  }
}
