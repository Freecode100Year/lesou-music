const OPENVERSE = 'https://api.openverse.org/v1/audio/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANONYMOUS_PAGE_SIZE = 20;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS, 'Cache-Control': 'public, max-age=300' },
  });
}

function licenseLabel(item: any): string {
  const name = String(item?.license || '').toUpperCase();
  const version = String(item?.license_version || '');
  return name ? `CC ${name}${version ? ` ${version}` : ''}` : 'Creative Commons';
}

async function openverseFetch(path: string): Promise<any | null> {
  try {
    const response = await fetch(`${OPENVERSE}${path}`, {
      headers: { 'User-Agent': 'lesou-music/1.0 (public CC music player)' },
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, {
  status: 204,
  headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' },
});

export const onRequestGet: PagesFunction = async (context) => {
  const requestUrl = new URL(context.request.url);
  const action = requestUrl.searchParams.get('action') || 'search';

  if (action === 'search') {
    const keyword = requestUrl.searchParams.get('keyword')?.trim() || '';
    const page = Math.max(1, Number.parseInt(requestUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(60, Math.max(1, Number.parseInt(requestUrl.searchParams.get('limit') || '12', 10)));
    if (!keyword) return jsonResponse({ code: 1, data: [] });

    // Openverse caps anonymous callers at 20 records per request.  Fetch the
    // required pages here so the app can still expose the shared 60-item limit.
    const pageCount = Math.ceil(limit / ANONYMOUS_PAGE_SIZE);
    const firstUpstreamPage = (page - 1) * pageCount + 1;
    const responses = await Promise.all(Array.from({ length: pageCount }, (_, index) => {
      const query = new URLSearchParams({
        q: keyword,
        page: String(firstUpstreamPage + index),
        page_size: String(ANONYMOUS_PAGE_SIZE),
      });
      return openverseFetch(`?${query.toString()}`);
    }));
    const results = responses.flatMap((result) => Array.isArray(result?.results) ? result.results : []);
    if (!results.length && responses.every((result) => result === null)) {
      return jsonResponse({ code: 0, data: [], msg: 'Openverse search failed' });
    }
    const data = results
      .filter((item: any) => UUID.test(String(item?.id || '')) && item?.url)
      .map((item: any) => ({
        id: item.id,
        name: item.title || 'Untitled',
        artist: item.creator || item.provider || 'Openverse',
        license: licenseLabel(item),
        pic: item.thumbnail || '',
        duration: typeof item.duration === 'number' ? Math.round(item.duration / 1000) : undefined,
      }))
      .slice(0, limit);
    return jsonResponse({ code: 1, data });
  }

  const id = requestUrl.searchParams.get('id') || '';
  if (!UUID.test(id)) return jsonResponse({ code: 0, data: null, msg: 'Invalid Openverse track' });

  const track = await openverseFetch(`${encodeURIComponent(id)}/`);
  const audioUrl = String(track?.url || '');
  try {
    const parsed = new URL(audioUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('Invalid protocol');
  } catch {
    return action === 'stream'
      ? new Response('Audio unavailable', { status: 404, headers: CORS_HEADERS })
      : jsonResponse({ code: 0, data: null, msg: 'Openverse audio unavailable' });
  }

  if (action === 'song') {
    // Resolve through this endpoint so only URLs returned by Openverse are ever fetched.
    return jsonResponse({ code: 1, data: { url: `/api/openverse?action=stream&id=${encodeURIComponent(id)}`, pic: track.thumbnail || '', lrc: '' } });
  }

  if (action === 'stream') {
    try {
      const headers: Record<string, string> = { 'User-Agent': 'lesou-music/1.0 (public CC music player)' };
      const range = context.request.headers.get('Range');
      if (range) headers.Range = range;
      const response = await fetch(audioUrl, { headers, redirect: 'follow' });
      const responseHeaders = new Headers(CORS_HEADERS);
      for (const key of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
        const value = response.headers.get(key);
        if (value) responseHeaders.set(key, value);
      }
      if (!responseHeaders.has('Content-Type')) responseHeaders.set('Content-Type', 'audio/mpeg');
      responseHeaders.set('Cache-Control', 'public, max-age=3600');
      return new Response(response.body, { status: response.status, headers: responseHeaders });
    } catch {
      return new Response('Openverse stream failed', { status: 502, headers: CORS_HEADERS });
    }
  }

  return jsonResponse({ code: 0, data: null, msg: 'Invalid action' });
};
