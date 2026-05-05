import { useEffect, useRef, useCallback, useState } from 'react';
import {
  MediaPlayer,
  MediaProvider,
  type MediaPlayerInstance,
} from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { SyncEngine, type SyncStatus } from '../utils/syncEngine';

interface VideoPlayerProps {
  src: string | null;
  headers?: Record<string, string>;
  playing: boolean;
  currentTime: number;
  isHost: boolean;
  syncMode?: 'classic' | 'pro';
  masterUpdatedAt?: number;
  onSync: (playing: boolean, currentTime: number) => void;
}

const CLASSIC_THRESHOLD = 2;

// CSS spectateur
const SPECTATOR_CSS = `
  [data-spectator] .vds-play-button { pointer-events: none !important; opacity: 0.35 !important; }
  [data-spectator] .vds-seek-button { pointer-events: none !important; opacity: 0.35 !important; }
  [data-spectator] .vds-time-slider { pointer-events: none !important; opacity: 0.35 !important; cursor: default !important; }
  [data-spectator] .vds-mute-button { pointer-events: auto !important; opacity: 1 !important; }
  [data-spectator] .vds-fullscreen-button { pointer-events: auto !important; opacity: 1 !important; }
  [data-spectator] .vds-menu-button { pointer-events: auto !important; opacity: 1 !important; }
  [data-spectator] .vds-volume-slider { pointer-events: auto !important; opacity: 1 !important; }
`;

const STATUS_LABELS: Record<SyncStatus, { label: string; color: string }> = {
  classic:     { label: '⚡ Classic',     color: 'text-gray-400' },
  calibrating: { label: '📡 Calibration…', color: 'text-yellow-400' },
  adjusting:   { label: '🔄 Ajustement',  color: 'text-blue-400' },
  perfect:     { label: '✅ Sync parfaite', color: 'text-green-400' },
  unstable:    { label: '⚠️ Instable',    color: 'text-red-400' },
};

export default function VideoPlayer({
  src, playing, currentTime, isHost,
  syncMode = 'classic', masterUpdatedAt,
  onSync,
}: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const ignoreEventsRef = useRef(false);
  const readyRef = useRef(false);
  const syncEngineRef = useRef(new SyncEngine());
  const tickIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('classic');
  const [muted, setMuted] = useState(false);

  // Injecter CSS spectateur
  useEffect(() => {
    if (document.getElementById('spectator-css')) return;
    const style = document.createElement('style');
    style.id = 'spectator-css';
    style.textContent = SPECTATOR_CSS;
    document.head.appendChild(style);
  }, []);

  useEffect(() => { readyRef.current = false; }, [src]);

  // Changer le mode de sync
  useEffect(() => {
    const engine = syncEngineRef.current;
    const cmds = engine.setMode(syncMode);
    applySyncCommands(cmds, setSyncStatus);
  }, [syncMode]);

  // Recevoir le masterState du parent
  useEffect(() => {
    if (isHost) return;
    syncEngineRef.current.ingestMasterState({
      isPlaying: playing,
      position: currentTime,
      updatedAt: masterUpdatedAt ?? Date.now(),
    });
  }, [playing, currentTime, masterUpdatedAt, isHost]);

  // Mode Classic — appliquer la sync directement
  useEffect(() => {
    const player = playerRef.current;
    if (!player || isHost || syncMode !== 'classic') return;

    const applySync = () => {
      ignoreEventsRef.current = true;
      if (Math.abs(player.currentTime - currentTime) > CLASSIC_THRESHOLD) {
        player.currentTime = currentTime;
      }
      if (playing && player.paused) player.play().catch(() => {});
      else if (!playing && !player.paused) player.pause();
      setTimeout(() => { ignoreEventsRef.current = false; }, 300);
    };

    if (readyRef.current) applySync();
    else {
      const unsub = player.subscribe(({ canPlay }) => {
        if (canPlay) { readyRef.current = true; applySync(); unsub(); }
      });
      return () => unsub();
    }
  }, [playing, currentTime, isHost, syncMode]);

  // Mode Pro — tick toutes les 500ms
  useEffect(() => {
    if (isHost || syncMode !== 'pro') {
      clearInterval(tickIntervalRef.current);
      return;
    }

    tickIntervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player || !readyRef.current) return;

      const cmds = syncEngineRef.current.tick({
        now: Date.now(),
        currentTime: player.currentTime,
        isPlaying: !player.paused,
        playbackRate: player.playbackRate,
      });

      applySyncCommands(cmds, setSyncStatus, player, ignoreEventsRef);
    }, 500);

    return () => clearInterval(tickIntervalRef.current);
  }, [isHost, syncMode]);

  const handleCanPlay = useCallback(() => { readyRef.current = true; }, []);

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

  const statusInfo = STATUS_LABELS[syncStatus];

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden aspect-video"
      {...(!isHost ? { 'data-spectator': '' } : {})}
    >
      {/* Badge spectateur + statut sync */}
      {!isHost && (
        <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
          <div className="bg-black/70 text-xs text-gray-300 px-2 py-1 rounded-full pointer-events-none select-none">
            👁 Spectateur
          </div>
          {syncMode === 'pro' && (
            <div className={`bg-black/70 text-xs px-2 py-1 rounded-full pointer-events-none select-none ${statusInfo.color}`}>
              {statusInfo.label}
            </div>
          )}
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

      {/* Overlay spectateur */}
      {!isHost && (
        <>
          <div
            className="absolute inset-x-0 top-0 z-20"
            style={{ bottom: '52px', cursor: 'default' }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <div className="absolute inset-x-0 z-20" style={{ bottom: 0, height: '52px', pointerEvents: 'none' }} />
        </>
      )}
    </div>
  );
}

// Appliquer les commandes du moteur de sync au player
function applySyncCommands(
  cmds: ReturnType<SyncEngine['tick']>,
  setSyncStatus: (s: SyncStatus) => void,
  player?: MediaPlayerInstance | null,
  ignoreRef?: React.MutableRefObject<boolean>,
) {
  for (const cmd of cmds) {
    if (cmd.action === 'status') {
      setSyncStatus(cmd.value as SyncStatus);
    } else if (player) {
      if (ignoreRef) ignoreRef.current = true;
      if (cmd.action === 'play') player.play().catch(() => {});
      else if (cmd.action === 'pause') player.pause();
      else if (cmd.action === 'seek') player.currentTime = cmd.value!;
      else if (cmd.action === 'setPlaybackRate') player.playbackRate = cmd.value!;
      else if (cmd.action === 'resetPlaybackRate') player.playbackRate = 1.0;
      if (ignoreRef) setTimeout(() => { ignoreRef.current = false; }, 300);
    }
  }
}
