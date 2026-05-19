const ALLOWED_DOMAINS = [
  'music.126.net',
  'kuwo.cn',
  'qq.com',
  'gtimg.cn',
  'pjmp3.com',
  'kugou.com',
  'bilivideo.com',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' },
  });
};

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const audioUrl = url.searchParams.get('url');

  if (!audioUrl) {
    return new Response('Missing url parameter', { status: 400, headers: CORS_HEADERS });
  }

  let parsed: URL;
  try {
    parsed = new URL(audioUrl);
  } catch {
    return new Response('Invalid url', { status: 400, headers: CORS_HEADERS });
  }

  const isAllowed = ALLOWED_DOMAINS.some(d => parsed.hostname.endsWith(d));
  if (!isAllowed) {
    return new Response('Domain not allowed', { status: 403, headers: CORS_HEADERS });
  }

  try {
    const reqHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': parsed.origin + '/',
    };

    const range = context.request.headers.get('Range');
    if (range) reqHeaders['Range'] = range;

    const response = await fetch(audioUrl, { headers: reqHeaders });

    const headers = new Headers(CORS_HEADERS);
    for (const key of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
      const val = response.headers.get(key);
      if (val) headers.set(key, val);
    }
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'audio/mpeg');
    }
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(response.body, { status: response.status, headers });
  } catch {
    return new Response('Proxy failed', { status: 502, headers: CORS_HEADERS });
  }
};
