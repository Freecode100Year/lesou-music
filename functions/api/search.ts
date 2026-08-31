const PROXY_BASES = [
  'https://music-api.gdstudio.xyz/api.php',
  'https://smusic0.pages.dev/api/proxy',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SOURCE_MAP: Record<string, string> = {
  wy: 'netease',
  kw: 'kuwo',
  jx: 'joox',
  qq: 'netease',
  mg: 'netease',
};

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const keyword = url.searchParams.get('keyword') || '';
  const type = url.searchParams.get('type') || 'wy';
  const page = url.searchParams.get('page') || '1';
  const limit = url.searchParams.get('limit') || '12';

  const source = SOURCE_MAP[type] || 'netease';

  const empty = () =>
    new Response(JSON.stringify({ code: 0, data: [] }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    });

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

      return new Response(JSON.stringify({ code: 1, data }), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch {
      continue;
    }
  }

  return empty();
};
