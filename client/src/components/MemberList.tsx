import { useState } from 'react';
import Avatar from './Avatar';
import type { Member } from '../hooks/useWatchParty';

interface MemberListProps {
  members: Member[];
  hostId: string;
  currentUserId: string;
  isHost: boolean;
  onKick: (userId: string) => void;
  onTransferHost: (userId: string) => void;
}

export default function MemberList({ members, hostId, currentUserId, isHost, onKick, onTransferHost }: MemberListProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const handleAction = (action: () => void) => {
    action();
    setMenuOpen(null);
  };

  return (
    <div className="px-4 py-3">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">
        Membres ({members.length})
      </p>
      <div className="space-y-1">
        {members.map((m) => {
          const isMe = m.userId === currentUserId;
          const isMemberHost = m.userId === hostId;
          const canManage = isHost && !isMe;

          return (
            <div key={m.socketId} className="relative">
              <div
                className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${canManage ? 'hover:bg-dark-700 cursor-pointer' : ''}`}
                onClick={() => canManage && setMenuOpen(menuOpen === m.userId ? null : m.userId)}
              >
                {/* Avatar + indicateur en ligne */}
                <div className="relative flex-shrink-0">
                  <Avatar pseudo={m.pseudo} src={m.avatar} size={36} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-dark-800" />
                </div>

                {/* Nom + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{m.pseudo}</p>
                    {isMe && <span className="text-xs text-gray-600">(toi)</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {isMemberHost && (
                      <span className="text-xs text-yellow-400 flex items-center gap-0.5">
                        👑 Host
                      </span>
                    )}
                  </div>
                </div>

                {/* Indicateur menu dispo */}
                {canManage && (
                  <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                )}
              </div>

              {/* Menu contextuel */}
              {menuOpen === m.userId && canManage && (
                <>
                  {/* Overlay pour fermer */}
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                  <div className="absolute left-0 right-0 z-20 mt-1 bg-dark-600 border border-dark-500 rounded-xl shadow-xl overflow-hidden">
                    {/* Transfert de host */}
                    {!isMemberHost && (
                      <button
                        onClick={() => handleAction(() => {
                          if (confirm(`Passer le host à ${m.pseudo} ?`)) onTransferHost(m.userId);
                        })}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-dark-500 transition-colors text-yellow-400"
                      >
                        <span>👑</span>
                        Passer host
                      </button>
                    )}
                    {/* Kick */}
                    <button
                      onClick={() => handleAction(() => {
                        if (confirm(`Expulser ${m.pseudo} ?`)) onKick(m.userId);
                      })}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-red-500/20 transition-colors text-red-400"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Expulser
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
