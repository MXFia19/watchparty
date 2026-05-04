import { useEffect, useRef, useCallback } from 'react';
import {
  MediaPlayer,
  MediaProvider,
  type MediaPlayerInstance,
} from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

interface VideoPlayerProps {
  src: string | null;
  headers?: Record<string, string>;
  playing: boolean;
  currentTime: number;
  isHost: boolean;
  onSync: (playing: boolean, currentTime: number) => void;
}

const SYNC_THRESHOLD = 2;

export default function VideoPlayer({ src, playing, currentTime, isHost, onSync }: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const ignoreEventsRef = useRef(false);
  const readyRef = useRef(false);

  // Réinitialiser readyRef quand la source change
  useEffect(() => {
    readyRef.current = false;
  }, [src]);

  // ── Appliquer la sync reçue (spectateurs) ─────────────────────────────────
  useEffect(() => {
    const player = playerRef.current;
    console.log('[VideoPlayer] sync effect:', { playing, currentTime, isHost, ready: readyRef.current });
    if (!player || isHost) return;

    const applySync = () => {
      ignoreEventsRef.current = true;

      if (Math.abs(player.currentTime - currentTime) > SYNC_THRESHOLD) {
        console.log('[VideoPlayer] seek to', currentTime);
        player.currentTime = currentTime;
      }

      if (playing && player.paused) {
        console.log('[VideoPlayer] play()');
        player.play().catch((e) => console.warn('[VideoPlayer] play() échoué:', e));
      } else if (!playing && !player.paused) {
        console.log('[VideoPlayer] pause()');
        player.pause();
      }

      setTimeout(() => { ignoreEventsRef.current = false; }, 300);
    };

    if (readyRef.current) {
      applySync();
    } else {
      // Attendre que le player soit prêt
      const unsub = player.subscribe(({ canPlay }) => {
        if (canPlay) {
          readyRef.current = true;
          applySync();
          unsub();
        }
      });
      return () => unsub();
    }
  }, [playing, currentTime, isHost]);

  // ── Callbacks host ─────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (!isHost || ignoreEventsRef.current) return;
    const t = playerRef.current?.currentTime ?? 0;
    onSync(true, t);
  }, [isHost, onSync]);

  const handlePause = useCallback(() => {
    if (!isHost || ignoreEventsRef.current) return;
    const t = playerRef.current?.currentTime ?? 0;
    onSync(false, t);
  }, [isHost, onSync]);

  const handleSeeked = useCallback(() => {
    if (!isHost || ignoreEventsRef.current) return;
    const player = playerRef.current;
    if (!player) return;
    onSync(!player.paused, player.currentTime);
  }, [isHost, onSync]);

  const handleCanPlay = useCallback(() => {
    readyRef.current = true;
  }, []);

  if (!src) {
    return (
      <div className="w-full bg-black rounded-xl overflow-hidden aspect-video flex flex-col items-center justify-center text-gray-600">
        <svg className="w-16 h-16 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-sm">{isHost ? 'Ajoute une URL vidéo pour commencer' : 'En attente du host…'}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden aspect-video">
      {/* Badge spectateur */}
      {!isHost && (
        <div className="absolute top-3 left-3 z-10 bg-black/70 text-xs text-gray-300 px-2 py-1 rounded-full pointer-events-none select-none">
          👁 Mode spectateur
        </div>
      )}

      <MediaPlayer
        ref={playerRef}
        src={src}
        className="w-full h-full"
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeeked}
        onCanPlay={handleCanPlay}
        playsInline
        keyDisabled={!isHost}
      >
        <MediaProvider />
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          // Pour les spectateurs : masquer play/seek mais garder volume + fullscreen + sous-titres
          noScrubGesture={!isHost}
        />
      </MediaPlayer>

      {/* Overlay transparent pour bloquer les clics des spectateurs sur le player */}
      {!isHost && (
        <div
          className="absolute inset-0 z-20"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}
