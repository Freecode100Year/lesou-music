const INVIDIOUS_INSTANCES = [
  'https://yt.chocolatemoo53.com',
  'https://invidious.materialio.us',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const keyword = url.searchParams.get('keyword') || '';
  const page = url.searchParams.get('page') || '1';
  const limit = parseInt(url.searchParams.get('limit') || '12', 10);

  if (!keyword) {
    return jsonResponse({ code: 1, data: [] });
  }

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const searchUrl = `${instance}/api/v1/search?q=${encodeURIComponent(keyword)}&type=video&sort=relevance&page=${page}`;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': UA },
      });
      if (!res.ok) continue;

      const results = await res.json() as any[];
      if (!Array.isArray(results)) continue;

      const data = results
        .filter((item: any) => item.type === 'video')
        .slice(0, limit)
        .map((item: any) => {
          const thumbnails = item.videoThumbnails || [];
          const thumb = thumbnails.find((t: any) => t.quality === 'medium')
            || thumbnails.find((t: any) => t.quality === 'default')
            || thumbnails[0];
          let picUrl = thumb?.url || '';
          if (picUrl.startsWith('//')) picUrl = 'https:' + picUrl;
          if (picUrl.startsWith('/')) picUrl = instance + picUrl;

          return {
            id: item.videoId,
            name: item.title || '',
            artist: (item.author || '').replace(/ - Topic$/, ''),
            album: '',
            pic: picUrl,
            duration: item.lengthSeconds || 0,
            externalUrl: `https://music.youtube.com/watch?v=${item.videoId}`,
          };
        });

      return jsonResponse({ code: 1, data });
    } catch {
      continue;
    }
  }

  return jsonResponse({ code: 0, data: [], msg: 'YouTube search failed' });
};

function jsonResponse(data: any): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
