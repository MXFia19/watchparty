interface ReadyMember {
  userId: string;
  pseudo: string;
  ready: boolean;
}

interface ReadyToggleProps {
  readyList: ReadyMember[];
  currentUserId: string;
  isReady: boolean;
  onToggle: (ready: boolean) => void;
  isHost: boolean;
  onStartWhenReady: () => void;
}

export default function ReadyToggle({ readyList, currentUserId, isReady, onToggle, isHost, onStartWhenReady }: ReadyToggleProps) {
  const totalCount = readyList.length;
  const readyCount = readyList.filter(m => m.ready).length;
  const allReady = totalCount > 0 && readyCount === totalCount;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-300 flex items-center gap-2">
          ✋ Prêts
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${allReady ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-gray-500'}`}>
            {readyCount}/{totalCount}
          </span>
        </p>

        {/* Bouton du host pour lancer quand tout le monde est prêt */}
        {isHost && (
          <button
            onClick={onStartWhenReady}
            disabled={!allReady}
            className="btn-primary text-xs py-1 px-3 disabled:opacity-40"
          >
            ▶ Lancer
          </button>
        )}
      </div>

      {/* Liste des membres */}
      <div className="flex flex-wrap gap-2">
        {readyList.map(m => (
          <div
            key={m.userId}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors ${
              m.ready
                ? 'bg-green-500/20 text-green-400'
                : 'bg-dark-700 text-gray-500'
            }`}
          >
            <span>{m.ready ? '✅' : '⏳'}</span>
            <span>{m.userId === currentUserId ? 'Toi' : m.pseudo}</span>
          </div>
        ))}
      </div>

      {/* Bouton toggle pour soi-même */}
      <button
        onClick={() => onToggle(!isReady)}
        className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${
          isReady
            ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
            : 'btn-secondary'
        }`}
      >
        {isReady ? '✅ Je suis prêt !' : '⏳ Pas encore prêt'}
      </button>
    </div>
  );
}
