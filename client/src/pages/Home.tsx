import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import Avatar from '../components/Avatar';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface Room {
  id: string;
  name: string;
  video_url: string | null;
  created_at: number;
}

export default function Home() {
  const { user, login, linkDiscord } = useUser();
  const navigate = useNavigate();

  const [pseudo, setPseudo] = useState('');
  const [roomNotFound, setRoomNotFound] = useState(false);

  // Détecter une redirection depuis une room introuvable
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'room_not_found') {
      setRoomNotFound(true);
      window.history.replaceState({}, '', '/');
      setTimeout(() => setRoomNotFound(false), 4000);
    }
  }, []);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const [createName, setCreateName] = useState('');
  const [createUrl, setCreateUrl] = useState('');
  const [createPublic, setCreatePublic] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);

  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (user) fetchRooms();
  }, [user]);

  const fetchRooms = async () => {
    setRoomsLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`);
      setRooms(await res.json());
    } finally {
      setRoomsLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(pseudo.trim());
    } catch (e: unknown) {
      setLoginError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim() || !user) return;
    setCreateLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          videoUrl: createUrl.trim() || null,
          isPublic: createPublic,
          userId: user.id,
        }),
      });
      const room = await res.json();
      navigate(`/room/${room.id}`);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length > 0) navigate(`/room/${code}`);
  };

  const handleDelete = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    if (!user) return;
    if (!confirm('Supprimer cette room ?')) return;
    await fetch(`${SERVER_URL}/api/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    });
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
  };

  // ─── Écran de login ───────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🎬</div>
            <h1 className="text-2xl font-bold">WatchParty</h1>
            <p className="text-gray-500 text-sm mt-1">Regardez ensemble, en sync</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Ton pseudo</label>
              <input
                className="input"
                placeholder="Entre ton pseudo…"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                maxLength={32}
                autoFocus
              />
            </div>
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <button
              className="btn-primary w-full"
              onClick={handleLogin}
              disabled={loginLoading || pseudo.trim().length < 2}
            >
              {loginLoading ? 'Connexion…' : 'Rejoindre →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto">
      {/* Bannière room introuvable */}
      {roomNotFound && (
        <div className="mb-4 mt-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Room introuvable — ce code ne correspond à aucune room active.
        </div>
      )}
      {/* Header */}
      <header className="flex items-center justify-between mb-8 pt-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎬</span>
          <div>
            <h1 className="text-xl font-bold">WatchParty</h1>
            <p className="text-gray-500 text-xs">Bonjour, <span className="text-brand-400">{user.pseudo}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user.discordUsername ? (
            /* Discord lié — afficher avatar + pseudo */
            <div className="flex items-center gap-2 bg-dark-700 px-3 py-1.5 rounded-full">
              <Avatar pseudo={user.discordUsername} src={user.discordAvatar} size={24} />
              <span className="text-sm font-medium text-white">{user.discordUsername}</span>
              <span className="text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full">Discord</span>
            </div>
          ) : (
            /* Discord non lié — bouton Lier */
            <button onClick={linkDiscord} className="btn-secondary text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/>
              </svg>
              Lier Discord
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Créer une room */}
        <div className="card lg:col-span-1">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <span>✨</span> Créer une room
          </h2>
          <div className="space-y-3">
            <input
              className="input"
              placeholder="Nom de la room"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              maxLength={50}
            />
            <input
              className="input"
              placeholder="URL vidéo (MP4, HLS…) — optionnel"
              value={createUrl}
              onChange={(e) => setCreateUrl(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={createPublic}
                onChange={(e) => setCreatePublic(e.target.checked)}
                className="accent-brand-500"
              />
              Room publique (visible dans la liste)
            </label>
            <button
              className="btn-primary w-full"
              onClick={handleCreate}
              disabled={createLoading || !createName.trim()}
            >
              {createLoading ? 'Création…' : 'Créer'}
            </button>
          </div>

          <hr className="border-dark-700 my-4" />

          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <span>🔗</span> Rejoindre par code
          </h2>
          <div className="flex gap-2">
            <input
              className="input flex-1 uppercase tracking-widest"
              placeholder="CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={8}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button className="btn-secondary" onClick={handleJoin} disabled={!joinCode.trim()}>
              Go
            </button>
          </div>
        </div>

        {/* Rooms publiques */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <span>🌍</span> Rooms publiques
            </h2>
            <button onClick={fetchRooms} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Actualiser
            </button>
          </div>

          {roomsLoading ? (
            <div className="text-center text-gray-500 py-12">Chargement…</div>
          ) : rooms.length === 0 ? (
            <div className="card text-center text-gray-500 py-12">
              <p>Aucune room active pour l'instant.</p>
              <p className="text-sm mt-1">Crée-en une !</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="card flex items-center justify-between hover:border-brand-500/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/room/${room.id}`)}
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{room.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Code : <span className="font-mono text-brand-400">{room.id}</span>
                      {room.video_url && (
                        <span className="ml-2 text-green-400">● Vidéo active</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <button className="btn-primary text-sm">
                      Rejoindre
                    </button>
                    {room.host_id === user?.id && (
                      <button
                        onClick={(e) => handleDelete(e, room.id)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Supprimer la room"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
