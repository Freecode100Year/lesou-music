const PROXY_BASE = 'https://smusic0.pages.dev/api/proxy';

const SOURCE_MAP: Record<string, string> = {
  wy: 'netease',
  qq: 'netease',
  kw: 'kuwo',
  mg: 'netease',
};

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const keyword = url.searchParams.get('keyword') || '';
  const type = url.searchParams.get('type') || 'wy';
  const page = url.searchParams.get('page') || '1';
  const limit = url.searchParams.get('limit') || '12';

  const source = SOURCE_MAP[type] || 'netease';

  const proxyUrl = `${PROXY_BASE}?types=search&source=${source}&proxy_server=gdstudio&name=${encodeURIComponent(keyword)}&count=${limit}&pages=${page}`;

  try {
    const response = await fetch(proxyUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ code: 0, data: [] }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const raw = await response.json() as any[];

    const data = Array.isArray(raw)
      ? raw.map((item: any) => ({
          id: item.url_id || item.id,
          name: item.name || '',
          artist: Array.isArray(item.artist) ? item.artist.join('/') : item.artist || '',
          album: item.album || '',
          pic: item.pic_id || item.pic || '',
          lyric_id: item.lyric_id || '',
          source: item.source || source,
        }))
      : [];

    return new Response(JSON.stringify({ code: 1, data }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return new Response(JSON.stringify({ code: 0, data: [], msg: 'Search failed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
