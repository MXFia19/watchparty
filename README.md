# 🎬 WatchParty

Regardez des vidéos ensemble, en synchronisation, avec chat en temps réel.

## Stack

- **Frontend** : React + Vite + TypeScript + Tailwind CSS
- **Backend** : Node.js + Express + Socket.IO
- **DB** : SQLite (zéro config)
- **Player** : HLS.js (supporte MP4 et flux HLS .m3u8)

---

## 🚀 Démarrage local

### Prérequis

- Node.js 18+

### 1. Backend

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Le serveur démarre sur **http://localhost:3001**

### 2. Frontend

Dans un second terminal :

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Le frontend démarre sur **http://localhost:5173**

---

## 🔐 Discord OAuth (optionnel)

Pour activer le lien de compte Discord :

1. Va sur https://discord.com/developers/applications
2. Crée une application, note le **Client ID** et **Client Secret**
3. Dans **OAuth2 > Redirects**, ajoute : `http://localhost:3001/auth/discord/callback`
4. Remplis `server/.env` :

```env
DISCORD_CLIENT_ID=ton_client_id
DISCORD_CLIENT_SECRET=ton_client_secret
DISCORD_REDIRECT_URI=http://localhost:3001/auth/discord/callback
```

---

## 🌍 Déploiement (Railway + Vercel)

### Backend → Railway

1. Crée un compte sur https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Sélectionne le dossier `server/`
4. Ajoute les variables d'environnement :
   - `CLIENT_URL` = URL de ton frontend Vercel
   - `PORT` = 3001
   - (optionnel) variables Discord

### Frontend → Vercel

1. Crée un compte sur https://vercel.com
2. "Import Project" → sélectionne le dossier `client/`
3. Ajoute la variable d'environnement :
   - `VITE_SERVER_URL` = URL de ton backend Railway

---

## 📡 Architecture Socket.IO

| Événement | Direction | Description |
|---|---|---|
| `room:join` | Client → Serveur | Rejoindre une room |
| `room:leave` | Client → Serveur | Quitter |
| `room:members` | Serveur → Clients | Liste des membres mise à jour |
| `player:sync` | Host → Serveur → Clients | Sync play/pause/seek |
| `player:change_video` | Host → Serveur → Clients | Changer l'URL vidéo |
| `player:request_sync` | Client → Serveur | Demander l'état actuel |
| `chat:message` | Client → Serveur → Clients | Message de chat |
| `room:host_changed` | Serveur → Clients | Transfert de host |
