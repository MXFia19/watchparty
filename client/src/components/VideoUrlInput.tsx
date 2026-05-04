import { useState } from 'react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface Header { key: string; value: string; }

interface VerifyResult {
  ok: boolean;
  isVideo: boolean;
  contentType?: string;
  contentLength?: number | null;
  error?: string;
}

interface VideoUrlInputProps {
  currentUrl: string | null;
  onConfirm: (url: string, headers: Record<string, string>) => void;
  onCancel: () => void;
}

export default function VideoUrlInput({ currentUrl, onConfirm, onCancel }: VideoUrlInputProps) {
  const [url, setUrl] = useState(currentUrl || '');
  const [headers, setHeaders] = useState<Header[]>([]);
  const [showHeaders, setShowHeaders] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const headersAsObject = () =>
    Object.fromEntries(headers.filter(h => h.key.trim()).map(h => [h.key.trim(), h.value.trim()]));

  const verify = async () => {
    if (!url.trim()) return;
    setVerifying(true);
    setResult(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/verify-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), headers: headersAsObject() }),
      });
      setResult(await res.json());
    } catch {
      setResult({ ok: false, isVideo: false, error: 'Impossible de contacter le serveur' });
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirm = () => {
    if (!url.trim()) return;
    onConfirm(url.trim(), headersAsObject());
  };

  const addHeader = () => setHeaders(h => [...h, { key: '', value: '' }]);
  const removeHeader = (i: number) => setHeaders(h => h.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: 'key' | 'value', val: string) =>
    setHeaders(h => h.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const formatSize = (bytes: number) => {
    if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    return `${(bytes / 1e3).toFixed(0)} KB`;
  };

  const canSubmit = url.trim().length > 0;

  return (
    <div className="card space-y-3">
      <p className="text-sm font-medium text-gray-300 flex items-center gap-2">
        🎬 {currentUrl ? 'Changer la vidéo' : 'Ajouter une vidéo'}
      </p>

      {/* URL input */}
      <div className="flex gap-2">
        <input
          className="input flex-1 font-mono text-sm"
          placeholder="https://exemple.com/video.mp4 ou stream.m3u8"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setResult(null); }}
          onKeyDown={(e) => e.key === 'Enter' && verify()}
          autoFocus
        />
        <button
          onClick={verify}
          disabled={!canSubmit || verifying}
          className="btn-secondary text-sm flex items-center gap-1.5 flex-shrink-0"
          title="Vérifier si l'URL est une vidéo valide"
        >
          {verifying ? (
            <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          Vérifier
        </button>
      </div>

      {/* Résultat de vérification */}
      {result && (
        <div className={`rounded-lg px-3 py-2.5 text-sm flex items-start gap-2 ${
          result.isVideo
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          <span className="text-base flex-shrink-0">{result.isVideo ? '✅' : '❌'}</span>
          <div>
            {result.isVideo ? (
              <>
                <p className="font-medium">Vidéo valide</p>
                <p className="text-xs opacity-75 mt-0.5">
                  {result.contentType}
                  {result.contentLength ? ` · ${formatSize(result.contentLength)}` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">
                  {result.error || 'Ce lien ne semble pas être une vidéo'}
                </p>
                {result.contentType && (
                  <p className="text-xs opacity-75 mt-0.5">Type reçu : {result.contentType}</p>
                )}
                <p className="text-xs opacity-60 mt-1">Tu peux quand même forcer l'ajout si tu es sûr.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Headers custom */}
      <div>
        <button
          onClick={() => setShowHeaders(!showHeaders)}
          className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
        >
          <svg
            className={`w-3 h-3 transition-transform ${showHeaders ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Headers HTTP personnalisés
          {headers.filter(h => h.key).length > 0 && (
            <span className="bg-brand-500/20 text-brand-400 px-1.5 rounded-full">
              {headers.filter(h => h.key).length}
            </span>
          )}
        </button>

        {showHeaders && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-gray-600">Utile pour Referer, Authorization, Origin, etc.</p>

            {headers.map((h, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <input
                  className="input flex-1 text-xs py-1.5 font-mono"
                  placeholder="Clé (ex: Referer)"
                  value={h.key}
                  onChange={(e) => updateHeader(i, 'key', e.target.value)}
                />
                <span className="text-gray-600 text-xs">:</span>
                <input
                  className="input flex-1 text-xs py-1.5 font-mono"
                  placeholder="Valeur"
                  value={h.value}
                  onChange={(e) => updateHeader(i, 'value', e.target.value)}
                />
                <button
                  onClick={() => removeHeader(i)}
                  className="text-gray-600 hover:text-red-400 transition-colors p-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            {/* Headers suggérés */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {['Referer', 'Origin', 'Authorization', 'User-Agent'].map(k => (
                <button
                  key={k}
                  onClick={() => setHeaders(h => [...h, { key: k, value: '' }])}
                  className="text-xs bg-dark-700 hover:bg-dark-600 text-gray-400 px-2 py-0.5 rounded-full transition-colors"
                >
                  + {k}
                </button>
              ))}
              <button
                onClick={addHeader}
                className="text-xs bg-dark-700 hover:bg-dark-600 text-gray-400 px-2 py-0.5 rounded-full transition-colors"
              >
                + Autre
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleConfirm}
          disabled={!canSubmit}
          className="btn-primary flex-1"
        >
          {result?.isVideo ? '▶ Lancer' : canSubmit ? 'Forcer l\'ajout' : 'Ajouter'}
        </button>
        <button onClick={onCancel} className="btn-secondary">
          Annuler
        </button>
      </div>
    </div>
  );
}
