export function setupProxy(app) {
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

      const contentType = response.headers.get('content-type') || '';
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');

      const isM3U8 = contentType.includes('mpegurl') || targetUrl.includes('.m3u8');

      if (isM3U8) {
        const text = await response.text();
        // baseUrl = dossier contenant le fichier m3u8
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const proxyBase = `${protocol}://${req.get('host')}/proxy/stream`;

        const rewritten = rewriteM3U8(text, baseUrl, proxyBase, { referer, origin, userAgent });
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        return res.send(rewritten);
      }

      // Segments binaires — streamer directement
      const contentLength = response.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentType) res.setHeader('Content-Type', contentType);

      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));

    } catch (err) {
      console.error('[Proxy] Erreur:', err.message);
      res.status(500).json({ error: err.message });
    }
  });
}

/**
 * Résoudre une URL relative ou absolue par rapport à une base
 */
function resolveUrl(url, baseUrl) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) {
    // Absolue depuis la racine du domaine
    const base = new URL(baseUrl);
    return `${base.protocol}//${base.host}${url}`;
  }
  // Relative
  return baseUrl + url;
}

/**
 * Construire une URL proxy
 */
function buildProxyUrl(absoluteUrl, proxyBase, { referer, origin, userAgent }) {
  const params = new URLSearchParams({ url: absoluteUrl });
  if (referer) params.set('referer', referer);
  if (origin) params.set('origin', origin);
  if (userAgent) params.set('userAgent', userAgent);
  return `${proxyBase}?${params.toString()}`;
}

/**
 * Réécrire toutes les URLs dans un M3U8 :
 * - Lignes URI (segments, sous-playlists)
 * - Attributs URI="..." dans les tags #EXT-X-MEDIA, #EXT-X-KEY, etc.
 */
function rewriteM3U8(content, baseUrl, proxyBase, opts) {
  return content
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (trimmed === '') return line;

      // Réécrire les attributs URI="..." dans les tags #EXT-X-*
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (match, uri) => {
          const absolute = resolveUrl(uri, baseUrl);
          return `URI="${buildProxyUrl(absolute, proxyBase, opts)}"`;
        });
      }

      // Lignes de segment/playlist (pas de commentaire, pas vide)
      const absolute = resolveUrl(trimmed, baseUrl);
      return buildProxyUrl(absolute, proxyBase, opts);
    })
    .join('\n');
}