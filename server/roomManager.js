/**
 * RoomManager — gère l'état en mémoire des rooms actives.
 * La DB persiste les métadonnées, mais l'état de lecture (position, playing...)
 * vit uniquement en mémoire pour être ultra-réactif.
 */

const rooms = new Map();

export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

export function createRoomState(roomId, hostId, videoUrl = null) {
  const state = {
    roomId,
    hostId,
    videoUrl,
    playing: false,
    currentTime: 0,
    lastSyncAt: Date.now(),
    members: new Map(), // socketId → { userId, pseudo, avatar }
  };
  rooms.set(roomId, state);
  return state;
}

export function deleteRoomState(roomId) {
  rooms.delete(roomId);
}

export function addMember(roomId, socketId, userInfo) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.members.set(socketId, userInfo);
  return room;
}

export function removeMember(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.members.delete(socketId);
  return room;
}

export function updatePlayState(roomId, { playing, currentTime }) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.playing = playing;
  room.currentTime = currentTime;
  room.lastSyncAt = Date.now();
  return room;
}

export function updateVideoUrl(roomId, videoUrl) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.videoUrl = videoUrl;
  room.playing = false;
  room.currentTime = 0;
  return room;
}

export function getRoomMembers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.members.entries()).map(([socketId, info]) => ({
    socketId,
    ...info,
  }));
}

export function getMemberCount(roomId) {
  const room = rooms.get(roomId);
  return room ? room.members.size : 0;
}

export function isHost(roomId, userId) {
  const room = rooms.get(roomId);
  return room ? room.hostId === userId : false;
}

export function transferHost(roomId, newHostId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.hostId = newHostId;
  return room;
}
