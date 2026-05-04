import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db.js';
import DiscordOAuth2 from 'discord-oauth2';

const router = express.Router();

// ─── Vérification URL vidéo ───────────────────────────────────────────────────
router.post('/verify-video', async (req, res) => {
  const { url, headers: customHeaders = {} } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requise' });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WatchParty/1.0)',
        ...customHeaders,
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    const acceptRanges = response.headers.get('accept-ranges');

    // Types valides
    const validTypes = [
      'video/', 'application/x-mpegurl', 'application/vnd.apple.mpegurl',
      'application/octet-stream', 'application/dash+xml',
    ];
    const isVideo = validTypes.some(t => contentType.toLowerCase().includes(t))
      || url.includes('.m3u8') || url.includes('.mp4') || url.includes('.mkv')
      || url.includes('.webm') || url.includes('.avi') || url.includes('.ts');

    res.json({
      ok: response.ok,
      isVideo,
      status: response.status,
      contentType,
      contentLength: contentLength ? parseInt(contentLength) : null,
      acceptRanges: !!acceptRanges,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.json({ ok: false, isVideo: false, error: 'Timeout — serveur trop lent ou URL invalide' });
    }
    res.json({ ok: false, isVideo: false, error: err.message });
  }
});

// ─── Rooms ─────────────────────────────────────────────────────────────────
router.get('/rooms', (req, res) => res.json(db.getRooms()));

router.post('/rooms', (req, res) => {
  const { name, videoUrl, isPublic, userId } = req.body;
  if (!name || !userId) return res.status(400).json({ error: 'name et userId requis' });
  const id = uuidv4().slice(0, 8).toUpperCase();
  db.createRoom({ id, name, video_url: videoUrl || null, is_public: isPublic ? 1 : 0, host_id: userId });
  res.json({ id, name, videoUrl, isPublic });
});

router.get('/rooms/:id', (req, res) => {
  const room = db.getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room introuvable' });
  res.json(room);
});

router.delete('/rooms/:id', (req, res) => {
  const { userId } = req.body;
  const room = db.getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room introuvable' });
  if (room.host_id !== userId) return res.status(403).json({ error: 'Non autorisé' });
  db.deleteRoom(req.params.id);
  res.json({ ok: true });
});

// ─── Users ──────────────────────────────────────────────────────────────────
router.post('/users/anonymous', (req, res) => {
  const { pseudo } = req.body;
  if (!pseudo || pseudo.trim().length < 2)
    return res.status(400).json({ error: 'Pseudo trop court (min 2 caractères)' });
  const id = uuidv4();
  const p = pseudo.trim().slice(0, 32);
  db.createUser({ id, pseudo: p });
  res.json({ id, pseudo: p });
});

router.get('/users/:id', (req, res) => {
  const user = db.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const { id, pseudo, discord_username, discord_avatar } = user;
  res.json({ id, pseudo, discord_username, discord_avatar });
});

// ─── Auth Discord ────────────────────────────────────────────────────────────
const oauth = new DiscordOAuth2();

router.get('/auth/discord', (req, res) => {
  const { userId } = req.query;
  if (!process.env.DISCORD_CLIENT_ID)
    return res.status(501).json({ error: 'Discord OAuth non configuré' });

  const url = oauth.generateAuthUrl({
    clientId: process.env.DISCORD_CLIENT_ID,
    scope: ['identify'],
    redirectUri: process.env.DISCORD_REDIRECT_URI,
    state: userId || '',
  });
  res.redirect(url);
});

router.get('/auth/discord/callback', async (req, res) => {
  const { code, state: userId } = req.query;
  if (!code) return res.status(400).send('Code manquant');
  try {
    const tokenData = await oauth.tokenRequest({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      code,
      scope: ['identify'],
      grantType: 'authorization_code',
      redirectUri: process.env.DISCORD_REDIRECT_URI,
    });
    const discordUser = await oauth.getUser(tokenData.access_token);

    // Construire l'URL d'avatar
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.discriminator || 0) % 5}.png`;

    if (userId) {
      db.updateUser(userId, {
        discord_id: discordUser.id,
        discord_username: discordUser.username,
        discord_avatar: avatarUrl,
      });
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    // Passer toutes les infos Discord au client via query params
    const params = new URLSearchParams({
      discord_linked: '1',
      discord_username: discordUser.username,
      discord_avatar: avatarUrl,
    });
    res.redirect(`${clientUrl}?${params.toString()}`);
  } catch (err) {
    console.error('Discord OAuth error:', err);
    res.status(500).send('Erreur Discord OAuth');
  }
});

export default router;
