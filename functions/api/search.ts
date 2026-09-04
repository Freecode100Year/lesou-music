const PROXY_BASES = [
  'https://music-api.gdstudio.xyz/api.php',
  'https://smusic0.pages.dev/api/proxy',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=300',
};

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), { headers: JSON_HEADERS });
}

// The catalogue proxy occasionally rejects Cloudflare Worker egress with a
// 520 even though it remains reachable from ordinary browsers. NetEase's
// public search endpoint is a direct, independent fallback for its catalogue.
async function searchNeteaseDirect(keyword: string, page: string, limit: string) {
  const searchUrl = new URL('https://music.163.com/api/search/get');
  searchUrl.searchParams.set('csrf_token', '');
  searchUrl.searchParams.set('s', keyword);
  searchUrl.searchParams.set('type', '1');
  searchUrl.searchParams.set('offset', String((Math.max(Number(page), 1) - 1) * Math.max(Number(limit), 1)));
  searchUrl.searchParams.set('total', 'true');
  searchUrl.searchParams.set('limit', limit);

  const response = await fetch(searchUrl.toString(), {
    headers: { 'User-Agent': UA, Referer: 'https://music.163.com/' },
  });
  if (!response.ok) return [];

  const raw = await response.json() as any;
  const songs = raw?.result?.songs;
  if (!Array.isArray(songs)) return [];

  return songs.map((song: any) => ({
    id: song.id,
    name: song.name || '',
    artist: Array.isArray(song.artists) ? song.artists.map((artist: any) => artist?.name).filter(Boolean).join('/') : '',
    album: song.album?.name || '',
    pic: song.album?.picUrl || '',
    lyric_id: song.id,
    source: 'netease',
  }));
}

// Meting is used only when both the primary catalogue proxy and NetEase's
// direct endpoint reject Cloudflare egress. Its search payload carries song
// ids in the generated URL, which lets the existing playback route continue
// to resolve the track through its own source fallbacks.
async function searchNeteaseMeting(keyword: string, page: string, limit: string) {
  const searchUrl = new URL('https://api.qijieya.cn/meting/');
  searchUrl.searchParams.set('server', 'netease');
  searchUrl.searchParams.set('type', 'search');
  searchUrl.searchParams.set('id', keyword);
  searchUrl.searchParams.set('page', page);
  searchUrl.searchParams.set('limit', limit);

  const response = await fetch(searchUrl.toString(), { headers: { 'User-Agent': UA } });
  if (!response.ok) return [];

  const raw = await response.json() as any;
  if (!Array.isArray(raw)) return [];

  return raw.map((song: any) => {
    let id = '';
    try { id = new URL(song.url).searchParams.get('id') || ''; } catch {}
    return {
      id,
      name: song.name || '',
      artist: song.artist || '',
      album: '',
      pic: song.pic || '',
      lyric_id: id,
      source: 'netease',
    };
  }).filter((song: { id: string; name: string }) => song.id && song.name);
}

// Kuwo and QQ were removed: they still return search hits upstream but no
// longer hand back a playable url, so they only ever produced silent results.
const SOURCE_MAP: Record<string, string> = {
  wy: 'netease',
  jx: 'joox',
};

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const keyword = url.searchParams.get('keyword') || '';
  const type = url.searchParams.get('type') || 'wy';
  const page = url.searchParams.get('page') || '1';
  const limit = url.searchParams.get('limit') || '12';

  const empty = () =>
    new Response(JSON.stringify({ code: 0, data: [] }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    });

  // A retired source must stay retired: never quietly fall back to another
  // platform's catalogue for a type we no longer serve.
  const source = SOURCE_MAP[type];
  if (!source) return empty();

  for (const base of PROXY_BASES) {
    try {
      const proxyUrl = new URL(base);
      proxyUrl.searchParams.set('types', 'search');
      proxyUrl.searchParams.set('source', source);
      proxyUrl.searchParams.set('proxy_server', 'gdstudio');
      proxyUrl.searchParams.set('name', keyword);
      proxyUrl.searchParams.set('count', limit);
      proxyUrl.searchParams.set('pages', page);

      const response = await fetch(proxyUrl.toString(), { headers: { 'User-Agent': UA } });
      if (!response.ok) continue;

      const raw = (await response.json()) as any[];
      if (!Array.isArray(raw)) continue;

      const data = raw.map((item: any) => ({
        id: item.url_id || item.id,
        name: item.name || '',
        artist: Array.isArray(item.artist) ? item.artist.join('/') : item.artist || '',
        album: item.album || '',
        pic: item.pic_id || item.pic || '',
        lyric_id: item.lyric_id || '',
        source: item.source || source,
      }));

      return jsonResponse({ code: 1, data });
    } catch {
      continue;
    }
  }

  if (source === 'netease') {
    try {
      const data = await searchNeteaseDirect(keyword, page, limit);
      if (data.length) return jsonResponse({ code: 1, data });
    } catch {
      // Try the final Meting fallback below.
    }
    try {
      const data = await searchNeteaseMeting(keyword, page, limit);
      if (data.length) return jsonResponse({ code: 1, data });
    } catch {
      // Preserve the client response shape when every provider is unavailable.
    }
  }

  return empty();
};
