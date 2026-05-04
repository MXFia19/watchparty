import { useEffect, useState, useCallback } from 'react';
import { useSocket } from './useSocket';

export interface Member {
  socketId: string;
  userId: string;
  pseudo: string;
  avatar?: string;
}

export interface ChatMessage {
  userId: string;
  pseudo: string;
  avatar?: string;
  message: string;
  timestamp: number;
}

interface RoomState {
  videoUrl: string | null;
  playing: boolean;
  currentTime: number;
  hostId: string;
}

interface UseWatchPartyOptions {
  roomId: string;
  userId: string;
  pseudo: string;
  avatar?: string;
  onVideoChange?: (url: string) => void;
  onSync?: (playing: boolean, currentTime: number) => void;
  onKicked?: () => void;
  onRoomNotFound?: () => void;
}

export function useWatchParty({ roomId, userId, pseudo, avatar, onVideoChange, onSync, onKicked, onRoomNotFound }: UseWatchPartyOptions) {
  const { socket, connected } = useSocket();

  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hostId, setHostId] = useState<string>('');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const isHost = hostId === userId;

  // ── Rejoindre la room ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !connected || !roomId || !userId) return;

    console.log('[WatchParty] Envoi room:join', { roomId, userId, pseudo });

    socket.emit('room:join', { roomId, userId, pseudo, avatar }, (res: { ok?: boolean; state?: RoomState; error?: string }) => {
      console.log('[WatchParty] Réponse room:join', res);

      if (res?.error) {
        setJoinError(res.error);
        onRoomNotFound?.();
        return;
      }
      if (res?.state) {
        setRoomState(res.state);
        setHostId(res.state.hostId);
        console.log('[WatchParty] État initial reçu:', res.state);
        if (res.state.videoUrl) {
          console.log('[WatchParty] Appel onSync initial:', res.state.playing, res.state.currentTime);
          onSync?.(res.state.playing, res.state.currentTime);
        }
      }
      setJoined(true);
    });

    return () => {
      socket.emit('room:leave');
      setJoined(false);
      setMembers([]);
      setMessages([]);
    };
  }, [socket, connected, roomId, userId]);

  // ── Écouter les events ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onMembers = (list: Member[]) => setMembers(list);

    const onSyncEvent = ({ playing, currentTime }: { playing: boolean; currentTime: number }) => {
      console.log('[WatchParty] player:sync reçu:', { playing, currentTime });
      setRoomState((prev) => prev ? { ...prev, playing, currentTime } : prev);
      onSync?.(playing, currentTime);
    };

    const onVideoChanged = ({ videoUrl }: { videoUrl: string }) => {
      console.log('[WatchParty] player:change_video reçu:', videoUrl);
      setRoomState((prev) => prev ? { ...prev, videoUrl, playing: false, currentTime: 0 } : prev);
      onVideoChange?.(videoUrl);
      onSync?.(false, 0);
    };

    const onHostChanged = ({ newHostId }: { newHostId: string }) => {
      setHostId(newHostId);
      setMessages((prev) => [...prev, {
        userId: 'system', pseudo: 'Système',
        message: '👑 Un nouveau host a été désigné', timestamp: Date.now(),
      }]);
    };

    const onKickedEvent = () => {
      setMessages((prev) => [...prev, {
        userId: 'system', pseudo: 'Système',
        message: '🚫 Tu as été expulsé de la room', timestamp: Date.now(),
      }]);
      setTimeout(() => onKicked?.(), 2000);
    };

    const onChat = (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-199), msg]);
    };

    const onUserJoined = ({ pseudo: p }: { userId: string; pseudo: string }) => {
      setMessages((prev) => [...prev, {
        userId: 'system', pseudo: 'Système',
        message: `${p} a rejoint la room`, timestamp: Date.now(),
      }]);
    };

    const onUserLeft = ({ userId: uid, pseudo: p }: { userId: string; pseudo: string }) => {
      setMembers((prev) => prev.filter((m) => m.userId !== uid));
      if (uid !== userId) {
        setMessages((prev) => [...prev, {
          userId: 'system', pseudo: 'Système',
          message: `${p || 'Quelqu\'un'} a quitté la room`, timestamp: Date.now(),
        }]);
      }
    };

    console.log('[WatchParty] Enregistrement des listeners socket');
    socket.on('room:members', onMembers);
    socket.on('player:sync', onSyncEvent);
    socket.on('player:change_video', onVideoChanged);
    socket.on('room:host_changed', onHostChanged);
    socket.on('room:kicked', onKickedEvent);
    socket.on('chat:message', onChat);
    socket.on('room:user_joined', onUserJoined);
    socket.on('room:user_left', onUserLeft);

    return () => {
      socket.off('room:members', onMembers);
      socket.off('player:sync', onSyncEvent);
      socket.off('player:change_video', onVideoChanged);
      socket.off('room:host_changed', onHostChanged);
      socket.off('room:kicked', onKickedEvent);
      socket.off('chat:message', onChat);
      socket.off('room:user_joined', onUserJoined);
      socket.off('room:user_left', onUserLeft);
    };
  }, [socket]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const syncPlayState = useCallback((playing: boolean, currentTime: number) => {
    if (!isHost) return;
    console.log('[WatchParty] Envoi player:sync', { playing, currentTime });
    socket?.emit('player:sync', { roomId, playing, currentTime, userId });
  }, [socket, roomId, userId, isHost]);

  const changeVideo = useCallback((videoUrl: string) => {
    if (!isHost) return;
    socket?.emit('player:change_video', { roomId, videoUrl, userId });
  }, [socket, roomId, userId, isHost]);

  const requestSync = useCallback(() => {
    socket?.emit('player:request_sync', { roomId });
  }, [socket, roomId]);

  const sendMessage = useCallback((message: string) => {
    socket?.emit('chat:message', { roomId, userId, pseudo, avatar, message });
  }, [socket, roomId, userId, pseudo, avatar]);

  const kickMember = useCallback((targetUserId: string) => {
    if (!isHost) return;
    socket?.emit('room:kick', { roomId, targetUserId, userId });
  }, [socket, roomId, userId, isHost]);

  const transferHostTo = useCallback((newHostId: string) => {
    if (!isHost) return;
    socket?.emit('room:transfer_host', { roomId, newHostId, userId });
  }, [socket, roomId, userId, isHost]);

  return {
    joined,
    joinError,
    members,
    messages,
    hostId,
    isHost,
    roomState,
    syncPlayState,
    changeVideo,
    requestSync,
    sendMessage,
    kickMember,
    transferHostTo,
  };
}
