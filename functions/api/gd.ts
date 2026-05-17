const PROXY_BASE = 'https://smusic0.pages.dev/api/proxy';

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const params = url.searchParams;

  const proxyUrl = new URL(PROXY_BASE);
  params.forEach((value, key) => {
    proxyUrl.searchParams.set(key, value);
  });
  proxyUrl.searchParams.set('proxy_server', 'gdstudio');

  try {
    const response = await fetch(proxyUrl.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'API request failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
