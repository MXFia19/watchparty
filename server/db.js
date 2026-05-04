/**
 * Stockage JSON simple — zéro dépendance native.
 * Fonctionne en local, Railway, Render, Fly.io...
 * Pour la prod, remplacer par Turso (SQLite edge) ou PlanetScale.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_FILE = join(__dirname, 'data.json');

function load() {
  if (!existsSync(DB_FILE)) return { rooms: {}, users: {} };
  try { return JSON.parse(readFileSync(DB_FILE, 'utf8')); }
  catch { return { rooms: {}, users: {} }; }
}

function save(data) {
  writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ── API ────────────────────────────────────────────────────────────────────────

export const db = {
  // Rooms
  getRooms() {
    const data = load();
    const now = Math.floor(Date.now() / 1000);
    return Object.values(data.rooms)
      .filter(r => r.is_public && r.last_activity > now - 3600)
      .sort((a, b) => b.last_activity - a.last_activity)
      .slice(0, 20);
  },

  getRoom(id) {
    return load().rooms[id] || null;
  },

  createRoom(room) {
    const data = load();
    const now = Math.floor(Date.now() / 1000);
    data.rooms[room.id] = { ...room, created_at: now, last_activity: now };
    save(data);
  },

  updateRoom(id, fields) {
    const data = load();
    if (!data.rooms[id]) return;
    Object.assign(data.rooms[id], fields);
    save(data);
  },

  touchRoom(id) {
    this.updateRoom(id, { last_activity: Math.floor(Date.now() / 1000) });
  },

  deleteRoom(id) {
    const data = load();
    delete data.rooms[id];
    save(data);
  },

  // Users
  getUser(id) {
    return load().users[id] || null;
  },

  createUser(user) {
    const data = load();
    const now = Math.floor(Date.now() / 1000);
    data.users[user.id] = { ...user, created_at: now };
    save(data);
  },

  updateUser(id, fields) {
    const data = load();
    if (!data.users[id]) return;
    Object.assign(data.users[id], fields);
    save(data);
  },
};
