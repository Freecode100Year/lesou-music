const PROXY_BASE = 'https://smusic0.pages.dev/api/proxy';

const SOURCE_MAP: Record<string, string> = {
  wy: 'netease',
  qq: 'netease',
  kw: 'kuwo',
  mg: 'netease',
};

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id') || '';
  const type = url.searchParams.get('type') || 'wy';
  const source = SOURCE_MAP[type] || 'netease';

  try {
    const [urlRes, picRes, lrcRes] = await Promise.allSettled([
      fetch(`${PROXY_BASE}?types=url&source=${source}&proxy_server=gdstudio&id=${id}&br=320`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      }),
      fetch(`${PROXY_BASE}?types=pic&source=${source}&proxy_server=gdstudio&id=${id}&size=300`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      }),
      fetch(`${PROXY_BASE}?types=lyric&source=${source}&proxy_server=gdstudio&id=${id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      }),
    ]);

    let songUrl = '';
    let pic = '';
    let lrc = '';

    if (urlRes.status === 'fulfilled' && urlRes.value.ok) {
      const data = await urlRes.value.json() as any;
      songUrl = data.url || '';
    }
    if (picRes.status === 'fulfilled' && picRes.value.ok) {
      const data = await picRes.value.json() as any;
      pic = data.url || '';
    }
    if (lrcRes.status === 'fulfilled' && lrcRes.value.ok) {
      const data = await lrcRes.value.json() as any;
      lrc = data.lyric || '';
    }

    return new Response(
      JSON.stringify({
        code: songUrl ? 1 : 0,
        data: { url: songUrl, pic, lrc, name: '', artist: '', album: '' },
      }),
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=600',
        },
      }
    );
  } catch {
    return new Response(JSON.stringify({ code: 0, data: null, msg: 'Failed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
