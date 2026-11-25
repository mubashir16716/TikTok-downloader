import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const ALLOWED_TIKTOK_HOSTS = [
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
  't.tiktok.com',
  'v.tiktok.com',
];

const ALLOWED_MEDIA_DOMAINS = [
  'tikwm.com',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokcdn-eu.com',
  'tiktokcdn-in.com',
  'tiktokv.com',
  'muscdn.com',
  'byteoversea.com',
  'ibytedtos.com',
  'ibyteimg.com',
  'byteimg.com',
  'byteicdn.com',
  'ttwstatic.com',
  'snssdk.com',
  'tikcdn.io',
  'tiktok.com',
  'akamaized.net',
];

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function isPrivateOrDisallowedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  const ipType = net.isIP(lower);
  if (ipType !== 0) {
    return true;
  }

  return false;
}

function matchesDomainAllowlist(hostname: string, allowlist: string[]): boolean {
  const lower = hostname.toLowerCase();
  return allowlist.some((domain) => lower === domain || lower.endsWith(`.${domain}`));
}

function validateTikTokPageUrl(rawInput: string): URL | null {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > 1024) {
    return null;
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  if (parsed.username || parsed.password) {
    return null;
  }

  if (isPrivateOrDisallowedHost(parsed.hostname)) {
    return null;
  }

  if (!matchesDomainAllowlist(parsed.hostname, ALLOWED_TIKTOK_HOSTS)) {
    return null;
  }

  parsed.protocol = 'https:';
  return parsed;
}

function validateMediaCdnUrl(rawUrl: string): URL | null {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 4096) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  if (parsed.username || parsed.password) {
    return null;
  }

  if (isPrivateOrDisallowedHost(parsed.hostname)) {
    return null;
  }

  if (!matchesDomainAllowlist(parsed.hostname, ALLOWED_MEDIA_DOMAINS)) {
    return null;
  }

  parsed.protocol = 'https:';
  return parsed;
}

function normalizeUpstreamMediaUrl(maybeRelative: unknown): string {
  if (typeof maybeRelative !== 'string' || !maybeRelative.trim()) {
    return '';
  }
  const trimmed = maybeRelative.trim();
  try {
    const resolved = trimmed.startsWith('/')
      ? new URL(trimmed, 'https://www.tikwm.com').toString()
      : trimmed;
    const validated = validateMediaCdnUrl(resolved);
    return validated ? validated.toString() : '';
  } catch {
    return '';
  }
}

function sanitizeFilename(input: string, fallbackExt: string): string {
  const base = input
    .replace(/[\r\n"]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72);

  const safeBase = base || 'cleanreel_video';
  if (safeBase.toLowerCase().endsWith(`.${fallbackExt}`)) {
    return safeBase;
  }
  return `${safeBase}.${fallbackExt}`;
}

async function fetchWithSafeRedirects(
  initialUrl: URL,
  allowlist: string[],
  init: RequestInit = {},
  maxHops = 5
): Promise<{ response: globalThis.Response; finalUrl: URL }> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= maxHops; hop++) {
    const response = await fetch(currentUrl.toString(), {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return { response, finalUrl: currentUrl };
      }

      let nextUrl: URL;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        throw new Error('Invalid redirect target.');
      }

      if (
        (nextUrl.protocol !== 'https:' && nextUrl.protocol !== 'http:') ||
        nextUrl.username ||
        nextUrl.password ||
        isPrivateOrDisallowedHost(nextUrl.hostname) ||
        !matchesDomainAllowlist(nextUrl.hostname, allowlist)
      ) {
        throw new Error('Redirect target is outside allowed domains.');
      }

      nextUrl.protocol = 'https:';
      currentUrl = nextUrl;
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error('Too many redirects.');
}

interface TikWmApiResponse {
  code: number;
  msg?: string;
  data?: {
    id?: string;
    title?: string;
    cover?: string;
    origin_cover?: string;
    duration?: number;
    play?: string;
    hdplay?: string;
    wmplay?: string;
    size?: number;
    hd_size?: number;
    music?: string;
    music_info?: {
      title?: string;
      author?: string;
      play?: string;
      cover?: string;
    };
    play_count?: number;
    digg_count?: number;
    comment_count?: number;
    share_count?: number;
    images?: string[];
    author?: {
      id?: string;
      unique_id?: string;
      nickname?: string;
      avatar?: string;
    };
  };
}

async function extractViaTikWm(tiktokUrl: string) {
  const form = new URLSearchParams();
  form.set('url', tiktokUrl);
  form.set('hd', '1');

  const response = await fetch('https://www.tikwm.com/api/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/json',
      'User-Agent': BROWSER_USER_AGENT,
    },
    body: form.toString(),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Resolver responded with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as TikWmApiResponse;
  if (payload.code !== 0 || !payload.data) {
    throw new Error(payload.msg || 'Could not extract video from this TikTok URL.');
  }

  const d = payload.data;
  const noWatermarkUrl = normalizeUpstreamMediaUrl(d.play);
  const hdNoWatermarkUrl = normalizeUpstreamMediaUrl(d.hdplay);
  const watermarkUrl = normalizeUpstreamMediaUrl(d.wmplay);
  const cover =
    normalizeUpstreamMediaUrl(d.origin_cover) || normalizeUpstreamMediaUrl(d.cover);
  const images = Array.isArray(d.images)
    ? d.images.map(normalizeUpstreamMediaUrl).filter(Boolean)
    : undefined;

  if (!noWatermarkUrl && (!images || images.length === 0)) {
    throw new Error('No downloadable media stream found for this post.');
  }

  const musicUrl = normalizeUpstreamMediaUrl(d.music || d.music_info?.play);

  return {
    id: String(d.id || Date.now()),
    sourceUrl: tiktokUrl,
    title: (d.title || '').trim() || 'TikTok Video',
    duration: Number(d.duration || 0),
    cover,
    noWatermarkUrl: noWatermarkUrl || hdNoWatermarkUrl,
    hdNoWatermarkUrl:
      hdNoWatermarkUrl && hdNoWatermarkUrl !== noWatermarkUrl ? hdNoWatermarkUrl : undefined,
    watermarkUrl: watermarkUrl || undefined,
    noWatermarkSize: typeof d.size === 'number' ? d.size : undefined,
    hdSize: typeof d.hd_size === 'number' ? d.hd_size : undefined,
    images: images && images.length > 0 ? images : undefined,
    author: {
      id: String(d.author?.id || ''),
      uniqueId: d.author?.unique_id || 'creator',
      nickname: d.author?.nickname || d.author?.unique_id || 'TikTok Creator',
      avatar: normalizeUpstreamMediaUrl(d.author?.avatar),
    },
    music: musicUrl
      ? {
          title: d.music_info?.title || 'Original Sound',
          author: d.music_info?.author || d.author?.nickname || 'Creator',
          url: musicUrl,
          cover: normalizeUpstreamMediaUrl(d.music_info?.cover),
        }
      : undefined,
    stats: {
      plays: Number(d.play_count || 0),
      likes: Number(d.digg_count || 0),
      comments: Number(d.comment_count || 0),
      shares: Number(d.share_count || 0),
    },
    fetchedAt: Date.now(),
  };
}

async function extractViaTikTokWebFallback(tiktokUrl: URL) {
  const { response, finalUrl } = await fetchWithSafeRedirects(tiktokUrl, ALLOWED_TIKTOK_HOSTS, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`TikTok page returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!match?.[1]) {
    throw new Error('Unable to read TikTok video metadata from page.');
  }

  const parsed = JSON.parse(match[1]) as {
    __DEFAULT_SCOPE__?: {
      'webapp.video-detail'?: {
        itemInfo?: {
          itemStruct?: {
            id?: string;
            desc?: string;
            video?: {
              duration?: number;
              cover?: string;
              originCover?: string;
              playAddr?: string;
              downloadAddr?: string;
              bitrateInfo?: Array<{ PlayAddr?: { UrlList?: string[]; DataSize?: number } }>;
            };
            imagePost?: {
              images?: Array<{ imageURL?: { urlList?: string[] } }>;
            };
            author?: {
              id?: string;
              uniqueId?: string;
              nickname?: string;
              avatarThumb?: string;
            };
            music?: {
              title?: string;
              authorName?: string;
              playUrl?: string;
              coverThumb?: string;
            };
            stats?: {
              playCount?: number;
              diggCount?: number;
              commentCount?: number;
              shareCount?: number;
            };
          };
        };
      };
    };
  };

  const item = parsed.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
  if (!item) {
    throw new Error('Video details unavailable. Post may be private or deleted.');
  }

  const rawPlay =
    item.video?.playAddr ||
    item.video?.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0] ||
    item.video?.downloadAddr ||
    '';
  const noWatermarkUrl = normalizeUpstreamMediaUrl(rawPlay);
  const cover =
    normalizeUpstreamMediaUrl(item.video?.originCover) ||
    normalizeUpstreamMediaUrl(item.video?.cover);

  const images = item.imagePost?.images
    ?.map((img) => normalizeUpstreamMediaUrl(img.imageURL?.urlList?.[0] || ''))
    .filter(Boolean);

  if (!noWatermarkUrl && (!images || images.length === 0)) {
    throw new Error('Could not locate a playable media URL for this post.');
  }

  const musicUrl = normalizeUpstreamMediaUrl(item.music?.playUrl);

  return {
    id: String(item.id || Date.now()),
    sourceUrl: finalUrl.toString(),
    title: (item.desc || '').trim() || 'TikTok Video',
    duration: Number(item.video?.duration || 0),
    cover,
    noWatermarkUrl,
    images: images && images.length > 0 ? images : undefined,
    author: {
      id: String(item.author?.id || ''),
      uniqueId: item.author?.uniqueId || 'creator',
      nickname: item.author?.nickname || item.author?.uniqueId || 'TikTok Creator',
      avatar: normalizeUpstreamMediaUrl(item.author?.avatarThumb),
    },
    music: musicUrl
      ? {
          title: item.music?.title || 'Original Sound',
          author: item.music?.authorName || item.author?.nickname || 'Creator',
          url: musicUrl,
          cover: normalizeUpstreamMediaUrl(item.music?.coverThumb),
        }
      : undefined,
    stats: {
      plays: Number(item.stats?.playCount || 0),
      likes: Number(item.stats?.diggCount || 0),
      comments: Number(item.stats?.commentCount || 0),
      shares: Number(item.stats?.shareCount || 0),
    },
    fetchedAt: Date.now(),
  };
}

function createApiRouter(): express.Router {
  const router = express.Router();

  router.post('/tiktok', async (req: Request, res: Response) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
    const validatedUrl = validateTikTokPageUrl(rawUrl);

    if (!validatedUrl) {
      res.status(400).json({
        error: 'Please enter a valid public TikTok link (tiktok.com, vm.tiktok.com, or vt.tiktok.com).',
      });
      return;
    }

    try {
      const result = await extractViaTikWm(validatedUrl.toString());
      res.json(result);
    } catch (primaryErr) {
      try {
        const fallbackResult = await extractViaTikTokWebFallback(validatedUrl);
        res.json(fallbackResult);
      } catch (fallbackErr) {
        const message =
          primaryErr instanceof Error
            ? primaryErr.message
            : fallbackErr instanceof Error
              ? fallbackErr.message
              : 'Unable to fetch this TikTok video right now.';
        res.status(422).json({
          error: `${message} Make sure the video is public and the URL is complete.`,
        });
      }
    }
  });

  router.get('/download', async (req: Request, res: Response) => {
    const rawMediaUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const rawFilename = typeof req.query.filename === 'string' ? req.query.filename : 'cleanreel';
    const mediaType = typeof req.query.type === 'string' ? req.query.type : 'video';

    const validatedUrl = validateMediaCdnUrl(rawMediaUrl);
    if (!validatedUrl) {
      res.status(400).json({ error: 'Invalid or unsupported media source URL.' });
      return;
    }

    const fallbackExt = mediaType === 'audio' ? 'mp3' : mediaType === 'image' ? 'jpg' : 'mp4';
    const safeName = sanitizeFilename(rawFilename, fallbackExt);

    try {
      const { response: upstream } = await fetchWithSafeRedirects(
        validatedUrl,
        ALLOWED_MEDIA_DOMAINS,
        {
          headers: {
            'User-Agent': BROWSER_USER_AGENT,
            Referer: 'https://www.tiktok.com/',
          },
        }
      );

      if (!upstream.ok || !upstream.body) {
        res.status(502).json({ error: `Media CDN returned HTTP ${upstream.status}.` });
        return;
      }

      const upstreamContentType = upstream.headers.get('content-type') || '';
      if (upstreamContentType.includes('text/html')) {
        res.status(502).json({ error: 'Media link expired. Please fetch the TikTok URL again.' });
        return;
      }

      const contentType =
        upstreamContentType ||
        (mediaType === 'audio'
          ? 'audio/mpeg'
          : mediaType === 'image'
            ? 'image/jpeg'
            : 'video/mp4');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      res.setHeader('Cache-Control', 'no-store');

      const contentLength = upstream.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      const nodeStream = Readable.fromWeb(
        upstream.body as unknown as import('node:stream/web').ReadableStream
      );
      await pipeline(nodeStream, res);
    } catch (err) {
      if (!res.headersSent) {
        const message = err instanceof Error ? err.message : 'Download stream failed.';
        res.status(502).json({ error: message });
      }
    }
  });

  router.get('/stream', async (req: Request, res: Response) => {
    const rawMediaUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const validatedUrl = validateMediaCdnUrl(rawMediaUrl);
    if (!validatedUrl) {
      res.status(400).json({ error: 'Invalid or unsupported stream URL.' });
      return;
    }

    try {
      const headers: Record<string, string> = {
        'User-Agent': BROWSER_USER_AGENT,
        Referer: 'https://www.tiktok.com/',
      };
      if (typeof req.headers.range === 'string') {
        headers.Range = req.headers.range;
      }

      const { response: upstream } = await fetchWithSafeRedirects(
        validatedUrl,
        ALLOWED_MEDIA_DOMAINS,
        { headers }
      );

      if ((!upstream.ok && upstream.status !== 206) || !upstream.body) {
        res.status(502).end();
        return;
      }

      res.status(upstream.status);
      const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
      for (const h of passHeaders) {
        const val = upstream.headers.get(h);
        if (val) {
          res.setHeader(h, val);
        }
      }

      const nodeStream = Readable.fromWeb(
        upstream.body as unknown as import('node:stream/web').ReadableStream
      );
      await pipeline(nodeStream, res);
    } catch {
      if (!res.headersSent) {
        res.status(502).end();
      }
    }
  });

  return router;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.use('/api', createApiRouter());

  if (IS_PROD) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      try {
        const templatePath = path.resolve(__dirname, 'index.html');
        let html = fs.readFileSync(templatePath, 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CleanReel server listening on http://localhost:${PORT}`);
  });
}

startServer();
