const PJMP3_BASE = 'https://pjmp3.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const action = url.searchParams.get('action') || 'search';

  if (action === 'search') {
    return handleSearch(url);
  } else if (action === 'song') {
    return handleSong(url);
  }

  return new Response(JSON.stringify({ code: 0, msg: 'Invalid action' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

async function handleSearch(url: URL): Promise<Response> {
  const keyword = url.searchParams.get('keyword') || '';
  if (!keyword) {
    return jsonResponse({ code: 1, data: [] });
  }

  try {
    const res = await fetch(`${PJMP3_BASE}/search.php?keyword=${encodeURIComponent(keyword)}`, {
      headers: { 'User-Agent': UA },
    });
    const html = await res.text();

    const results: any[] = [];
    const regex = /href="song\.php\?id=(\d+)".*?<img src="([^"]*)".*?item-left-song">([^<]+)<.*?item-left-singer">([^<]+)</gs;
    let match;
    while ((match = regex.exec(html)) !== null) {
      results.push({
        id: match[1],
        name: match[3].trim(),
        artist: match[4].trim(),
        album: '',
        pic: match[2],
      });
    }

    return jsonResponse({ code: 1, data: results });
  } catch {
    return jsonResponse({ code: 0, data: [], msg: 'Search failed' });
  }
}

async function handleSong(url: URL): Promise<Response> {
  const id = url.searchParams.get('id') || '';
  if (!id) {
    return jsonResponse({ code: 0, data: null });
  }

  try {
    const res = await fetch(`${PJMP3_BASE}/song.php?id=${id}`, {
      headers: { 'User-Agent': UA },
    });
    const html = await res.text();

    const urlMatch = html.match(/url:\s*'([^']+)'/);
    const coverMatch = html.match(/cover:\s*'([^']+)'/);
    const nameMatch = html.match(/name:\s*'([^']+)'/);
    const artistMatch = html.match(/artist:\s*'([^']+)'/);

    // Extract lyrics (plain text)
    let lrc = '';
    const lyricItems = [...html.matchAll(/lyric-item[^>]*>([^<]+)</g)];
    if (lyricItems.length > 1) {
      lrc = lyricItems.map(m => m[1].trim()).filter(l => l).join('\n');
    }

    const songUrl = urlMatch?.[1] || '';

    return jsonResponse({
      code: songUrl ? 1 : 0,
      data: {
        url: songUrl,
        pic: coverMatch?.[1] || '',
        lrc,
        name: nameMatch?.[1] || '',
        artist: artistMatch?.[1] || '',
      },
    });
  } catch {
    return jsonResponse({ code: 0, data: null, msg: 'Failed to get song' });
  }
}

function jsonResponse(data: any): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
