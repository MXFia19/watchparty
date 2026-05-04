import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * Proxy de stream — le serveur télécharge le contenu à la place du navigateur.
 * Utilisé pour contourner les restrictions CORS/Referer des serveurs vidéo.
 * 
 * Usage depuis le client :
 *   /proxy/stream?url=https://example.com/video.m3u8&referer=https://example.com/
 */
export function setupProxy(app) {
  // Route proxy générique
  app.get('/proxy/stream', async (req, res) => {
    const { url, referer, origin, userAgent } = req.query;

    if (!url) return res.status(400).json({ error: 'url requis' });

    try {
      const targetUrl = decodeURIComponent(url);

      const headers = {
        'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      if (referer) headers['Referer'] = decodeURIComponent(referer);
      if (origin) headers['Origin'] = decodeURIComponent(origin);

      const response = await fetch(targetUrl, { headers });

      if (!response.ok) {
        return res.status(response.status).json({ error: `Stream répondu ${response.status}` });
      }

      // Transmettre les headers importants
      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);

      const contentLength = response.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      // CORS pour le navigateur
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');

      // Si c'est un fichier M3U8 — réécrire les URLs internes pour passer par le proxy
      if (contentType?.includes('mpegurl') || targetUrl.includes('.m3u8')) {
        const text = await response.text();
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

        const rewritten = rewriteM3U8(text, baseUrl, referer, origin, userAgent, req);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        return res.send(rewritten);
      }

      // Sinon streamer directement (segments .ts, .m4s, etc.)
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));

    } catch (err) {
      console.error('[Proxy] Erreur:', err.message);
      res.status(500).json({ error: err.message });
    }
  });
}

/**
 * Réécrire les URLs dans un fichier M3U8 pour qu'elles passent toutes par le proxy.
 */
function rewriteM3U8(content, baseUrl, referer, origin, userAgent, req) {
  const proxyBase = `${req.protocol}://${req.get('host')}/proxy/stream`;

  const buildProxyUrl = (url) => {
    // URL absolue
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const params = new URLSearchParams({ url });
      if (referer) params.set('referer', referer);
      if (origin) params.set('origin', origin);
      if (userAgent) params.set('userAgent', userAgent);
      return `${proxyBase}?${params.toString()}`;
    }

    // URL relative
    const absoluteUrl = baseUrl + url;
    const params = new URLSearchParams({ url: absoluteUrl });
    if (referer) params.set('referer', referer);
    if (origin) params.set('origin', origin);
    if (userAgent) params.set('userAgent', userAgent);
    return `${proxyBase}?${params.toString()}`;
  };

  return content
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      // Ignorer les commentaires et lignes vides
      if (trimmed.startsWith('#') || trimmed === '') return line;
      // Réécrire les URLs de segments et playlists
      return buildProxyUrl(trimmed);
    })
    .join('\n');
}
