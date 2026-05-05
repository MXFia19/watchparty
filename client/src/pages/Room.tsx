import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useWatchParty } from '../hooks/useWatchParty';
import VideoPlayer from '../components/VideoPlayer';
import Chat from '../components/Chat';
import MemberList from '../components/MemberList';
import Avatar from '../components/Avatar';
import { toProxyUrl, needsProxy } from '../utils/proxy';
import VideoUrlInput from '../components/VideoUrlInput';
import ReadyToggle from '../components/ReadyToggle';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useUser();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'chat' | 'members'>('chat');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [videoHeaders, setVideoHeaders] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [kickedMessage, setKickedMessage] = useState(false);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [syncPlaying, setSyncPlaying] = useState(false);
  const [syncTime, setSyncTime] = useState(0);



  // Reçu depuis le serveur (spectateurs) — mettre à jour le player local
  const handleSyncReceived = useCallback((playing: boolean, currentTime: number) => {
    console.log('[Room] handleSyncReceived appelé:', { playing, currentTime, isHost: false });
    setSyncPlaying(playing);
    setSyncTime(currentTime);
  }, []);

  // Quand le host change la vidéo — proxifier pour les spectateurs aussi
  const handleVideoChange = useCallback((url: string) => {
    const srcToPlay = needsProxy(url) ? toProxyUrl(url) : url;
    setVideoSrc(srcToPlay);
    setSyncPlaying(false);
    setSyncTime(0);
    setVideoHeaders({});
  }, []);

  // Quand on est kické — afficher un message 2s puis rediriger
  const handleKicked = useCallback(() => {
    setKickedMessage(true);
    setTimeout(() => navigate('/'), 2000);
  }, [navigate]);

  // Quand la room n'existe pas — rediriger immédiatement
  const handleRoomNotFound = useCallback(() => {
    navigate('/?error=room_not_found');
  }, [navigate]);

  const {
    joined,
    joinError,
    members,
    messages,
    hostId,
    isHost,
    roomState,
    syncPlayState,
    changeVideo,
    sendMessage,
    kickMember,
    transferHostTo,
    collaborativeMode,
    toggleCollaborativeMode,
    isReady,
    readyList,
    toggleReady,
    syncMode,
    setSyncMode,
    masterUpdatedAt,
  } = useWatchParty({
    roomId: roomId || '',
    userId: user?.id || '',
    pseudo: user?.discordUsername || user?.pseudo || '',
    avatar: user?.discordAvatar,
    onVideoChange: handleVideoChange,
    onSync: handleSyncReceived,
    onKicked: handleKicked,
    onRoomNotFound: handleRoomNotFound,
  });

  const handleSync = useCallback((playing: boolean, currentTime: number) => {
    syncPlayState(playing, currentTime);
    setSyncPlaying(playing);
    setSyncTime(currentTime);
  }, [syncPlayState]);

  const handleChangeVideo = (url: string, headers: Record<string, string>) => {
    // Envoyer l'URL originale aux autres membres via socket
    changeVideo(url);
    // Mais jouer localement via le proxy si nécessaire
    const srcToPlay = needsProxy(url) ? toProxyUrl(url, headers) : url;
    setVideoSrc(srcToPlay);
    setVideoHeaders(headers);
    setNewVideoUrl('');
    setShowUrlInput(false);
  };

  const handleDeleteRoom = async () => {
    if (!user || !isHost) return;
    if (!confirm('Supprimer la room ? Tout le monde sera éjecté.')) return;
    await fetch(`${SERVER_URL}/api/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    });
    navigate('/');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomId || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) { navigate('/'); return null; }

  // ── Écran "tu as été kické" ────────────────────────────────────────────────
  if (kickedMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card text-center max-w-sm">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-xl font-bold mb-2">Tu as été expulsé</h2>
          <p className="text-gray-400 text-sm">Redirection en cours…</p>
        </div>
      </div>
    );
  }

  // ── Chargement / erreur ────────────────────────────────────────────────────
  if (!joined && !joinError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Connexion à la room…</p>
        </div>
      </div>
    );
  }

  if (joinError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card text-center max-w-sm">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-bold mb-2">Room introuvable</h2>
          <p className="text-gray-400 text-sm mb-4">Le code <span className="font-mono text-brand-400">{roomId}</span> ne correspond à aucune room active.</p>
          <button className="btn-primary w-full" onClick={() => navigate('/')}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  // ── Room ───────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-dark-700 bg-dark-800">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Accueil
        </button>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <button
            onClick={copyCode}
            className="font-mono text-brand-400 text-sm bg-dark-700 px-2 py-0.5 rounded hover:bg-dark-600 transition-colors flex-shrink-0"
            title="Copier le code"
          >
            {roomId} {copied ? '✓' : '⎘'}
          </button>
          {isHost && (
            <span className="text-xs bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded-full flex-shrink-0">
              👑 Host
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <Avatar
            pseudo={user.discordUsername || user.pseudo}
            src={user.discordAvatar}
            size={28}
          />
          <span className="text-sm font-medium hidden sm:block">
            {user.discordUsername || user.pseudo}
          </span>
          <span className="text-xs text-gray-500">{members.length} en ligne</span>
          {isHost && (
            <button
              onClick={() => toggleCollaborativeMode(!collaborativeMode)}
              className={`text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded-lg ${
                collaborativeMode
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-dark-700 text-gray-400 hover:text-gray-200'
              }`}
              title={collaborativeMode ? 'Désactiver le mode collaboratif' : 'Activer le mode collaboratif'}
            >
              {collaborativeMode ? '🤝' : '👑'}
              <span className="hidden sm:inline">{collaborativeMode ? 'Collaboratif' : 'Host only'}</span>
            </button>
          )}
          {isHost && (
            <button
              onClick={handleDeleteRoom}
              className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors ml-1"
              title="Supprimer la room"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Colonne gauche — player */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto min-h-0">
          <VideoPlayer
            src={videoSrc}
            headers={videoHeaders}
            playing={syncPlaying}
            currentTime={syncTime}
            isHost={isHost || collaborativeMode}
            syncMode={syncMode}
            masterUpdatedAt={masterUpdatedAt}
            onSync={handleSync}
          />

          {/* Ready Toggle — visible par tous */}
          <ReadyToggle
            readyList={readyList}
            currentUserId={user.id}
            isReady={isReady}
            onToggle={toggleReady}
            isHost={isHost}
            onStartWhenReady={() => {
              syncPlayState(true, syncTime);
              setSyncPlaying(true);
            }}
          />

          {isHost && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-500">Mode sync :</span>
                <button
                  onClick={() => setSyncMode(syncMode === 'classic' ? 'pro' : 'classic')}
                  className={`text-xs px-2 py-1 rounded-lg transition-colors ${syncMode === 'pro' ? 'bg-brand-500/20 text-brand-400' : 'bg-dark-700 text-gray-400'}`}
                >
                  {syncMode === 'pro' ? '⚡ Sync Pro' : '⚡ Classic'}
                </button>
              </div>
              {showUrlInput ? (
                <VideoUrlInput
                  currentUrl={videoSrc}
                  onConfirm={handleChangeVideo}
                  onCancel={() => setShowUrlInput(false)}
                />
              ) : (
                <button className="btn-secondary text-sm" onClick={() => setShowUrlInput(true)}>
                  {videoSrc ? '🔄 Changer la vidéo' : '+ Ajouter une vidéo'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Colonne droite — chat + membres */}
        <div className="w-80 flex flex-col border-l border-dark-700 bg-dark-800">
          <div className="flex border-b border-dark-700">
            {(['chat', 'members'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-brand-400 border-b-2 border-brand-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab === 'chat' ? 'Chat' : `Membres (${members.length})`}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === 'chat' ? (
              <Chat messages={messages} onSend={sendMessage} currentUserId={user.id} />
            ) : (
              <div className="overflow-y-auto h-full">
                <MemberList
                  members={members}
                  hostId={hostId}
                  currentUserId={user.id}
                  isHost={isHost}
                  onKick={kickMember}
                  onTransferHost={transferHostTo}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
