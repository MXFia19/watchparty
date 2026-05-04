const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export function toProxyUrl(
  videoUrl: string,
  headers: Record<string, string> = {}
): string {
  if (videoUrl.startsWith(SERVER_URL) || videoUrl.includes('localhost')) {
    return videoUrl;
  }

  const params = new URLSearchParams({ url: videoUrl });
  if (headers['Referer']) params.set('referer', headers['Referer']);
  if (headers['Origin']) params.set('origin', headers['Origin']);
  if (headers['User-Agent']) params.set('userAgent', headers['User-Agent']);

  return `${SERVER_URL}/proxy/stream?${params.toString()}`;
}

export function needsProxy(url: string): boolean {
  return !url.includes('localhost') && !url.includes('127.0.0.1') && !url.startsWith(SERVER_URL);
}
