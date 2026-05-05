import { useEffect, useRef, useCallback, useState } from 'react';
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

// CSS injecté une seule fois pour bloquer les contrôles spectateur
const SPECTATOR_CSS = `
  /* Bloquer play/pause et seek — garder volume, fullscreen, sous-titres, audio */
  [data-spectator] .vds-play-button { pointer-events: none !important; opacity: 0.35 !important; }
  [data-spectator] .vds-seek-button { pointer-events: none !important; opacity: 0.35 !important; }
  [data-spectator] .vds-time-slider { pointer-events: none !important; opacity: 0.35 !important; cursor: default !important; }
  [data-spectator] .vds-slider-chapter { pointer-events: none !important; }
  [data-spectator] .vds-chapters-radio-group { pointer-events: none !important; }
  /* Garder accessibles : volume, fullscreen, sous-titres, qualité, audio */
  [data-spectator] .vds-mute-button { pointer-events: auto !important; opacity: 1 !important; }
  [data-spectator] .vds-fullscreen-button { pointer-events: auto !important; opacity: 1 !important; }
  [data-spectator] .vds-menu-button { pointer-events: auto !important; opacity: 1 !important; }
  [data-spectator] .vds-volume-slider { pointer-events: auto !important; opacity: 1 !important; }
`;

export default function VideoPlayer({ src, playing, currentTime, isHost, onSync }: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ignoreEventsRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const readyRef = useRef(false);

  // Injecter le CSS spectateur une seule fois
  useEffect(() => {
    if (document.getElementById('spectator-css')) return;
    const style = document.createElement('style');
    style.id = 'spectator-css';
    style.textContent = SPECTATOR_CSS;
    document.head.appendChild(style);
  }, []);

  useEffect(() => { readyRef.current = false; }, [src]);

  // ── Sync reçue (spectateurs) ───────────────────────────────────────────────
  useEffect(() => {
    const player = playerRef.current;
    if (!player || isHost) return;

    const applySync = () => {
      ignoreEventsRef.current = true;
      if (Math.abs(player.currentTime - currentTime) > SYNC_THRESHOLD) {
        player.currentTime = currentTime;
      }
      if (playing && player.paused) {
        player.play().catch(() => {});
      } else if (!playing && !player.paused) {
        player.pause();
      }
      setTimeout(() => { ignoreEventsRef.current = false; }, 300);
    };

    if (readyRef.current) {
      applySync();
    } else {
      const unsub = player.subscribe(({ canPlay }) => {
        if (canPlay) { readyRef.current = true; applySync(); unsub(); }
      });
      return () => unsub();
    }
  }, [playing, currentTime, isHost]);

  // ── Callbacks host ─────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (!isHost || ignoreEventsRef.current) return;
    onSync(true, playerRef.current?.currentTime ?? 0);
  }, [isHost, onSync]);

  const handlePause = useCallback(() => {
    if (!isHost || ignoreEventsRef.current) return;
    onSync(false, playerRef.current?.currentTime ?? 0);
  }, [isHost, onSync]);

  const handleSeeked = useCallback(() => {
    if (!isHost || ignoreEventsRef.current) return;
    const player = playerRef.current;
    if (!player) return;
    onSync(!player.paused, player.currentTime);
  }, [isHost, onSync]);

  const handleCanPlay = useCallback(() => { readyRef.current = true; }, []);

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
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden aspect-video"
      {...(!isHost ? { 'data-spectator': '' } : {})}
    >
      {/* Badge spectateur */}
      {!isHost && (
        <div className="absolute top-3 left-3 z-30 bg-black/70 text-xs text-gray-300 px-2 py-1 rounded-full pointer-events-none select-none">
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
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>

      {/* Overlay spectateur — bloque play/seek/click mais garde volume + fullscreen */}
      {!isHost && (
        <>
          {/* Overlay qui bloque les clics sur la zone vidéo */}
          <div
            className="absolute inset-x-0 top-0 z-20"
            style={{ bottom: '52px', cursor: 'default' }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
          {/* Overlay sur la barre de contrôle sauf les boutons autorisés */}
          <div
            className="absolute inset-x-0 z-20"
            style={{ bottom: 0, height: '52px', cursor: 'default', pointerEvents: 'none' }}
          />
        </>
      )}
    </div>
  );
}
