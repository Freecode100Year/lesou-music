const PROXY_BASES = [
  'https://music-api.gdstudio.xyz/api.php',
  'https://smusic0.pages.dev/api/proxy',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const params = url.searchParams;

  for (const base of PROXY_BASES) {
    try {
      const proxyUrl = new URL(base);
      params.forEach((value, key) => {
        proxyUrl.searchParams.set(key, value);
      });
      proxyUrl.searchParams.set('proxy_server', 'gdstudio');

      const response = await fetch(proxyUrl.toString(), { headers: { 'User-Agent': UA } });
      if (!response.ok) continue;

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
      continue;
    }
  }

  return new Response(JSON.stringify({ error: 'API request failed' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};
