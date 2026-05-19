import { useState, useRef, useCallback } from 'react';
import { Song, StandardPlatform } from '../types';
import { API, CACHE_TTL, SEARCH_DEBOUNCE_MS, DEFAULT_LIMIT, PLATFORMS } from '../config';
import { requestCache } from '../utils/cache';
import { addSearchHistory } from '../utils/storage';

function deduplicateSongs(songs: Song[]): Song[] {
  const seen = new Map<string, Song>();
  for (const song of songs) {
    const key = `${song.name.toLowerCase().trim()}|${song.artist.toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.set(key, song);
    }
  }
  return Array.from(seen.values());
}

async function searchStandard(
  kw: string,
  plat: string,
  pg: number,
  signal: AbortSignal,
): Promise<Song[]> {
  const url = `${API.SEARCH}?keyword=${encodeURIComponent(kw)}&type=${plat}&page=${pg}&limit=${DEFAULT_LIMIT}`;
  const res = await fetch(url, { signal });
  const data = await res.json();
  if (data.code === 1 && Array.isArray(data.data)) {
    return data.data.map((item: any) => ({
      id: String(item.id || item.ID),
      name: item.name || item.songname || '',
      artist: item.artist || item.singer || '',
      album: item.album || '',
      pic: item.pic,
      source: plat as StandardPlatform,
      sourceType: 'standard' as const,
    }));
  }
  return [];
}

async function searchQQ(
  kw: string,
  pg: number,
  signal: AbortSignal,
): Promise<Song[]> {
  const url = `${API.QQ_SEARCH}?w=${encodeURIComponent(kw)}&format=json&p=${pg}&n=${DEFAULT_LIMIT}`;
  const res = await fetch(url, { signal });
  const data = await res.json();
  const list = data?.data?.song?.list;
  if (Array.isArray(list)) {
    return list.map((item: any) => ({
      id: item.songmid || String(item.songid),
      name: item.songname || '',
      artist: Array.isArray(item.singer) ? item.singer.map((s: any) => s.name).join('/') : '',
      album: item.albumname || '',
      pic: item.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${item.albummid}.jpg` : undefined,
      source: 'qq' as const,
      sourceType: 'qq' as const,
    }));
  }
  return [];
}

async function searchYouTube(
  kw: string,
  pg: number,
  signal: AbortSignal,
): Promise<Song[]> {
  const url = `${API.YOUTUBE_SEARCH}?keyword=${encodeURIComponent(kw)}&page=${pg}&limit=${DEFAULT_LIMIT}`;
  const res = await fetch(url, { signal });
  const data = await res.json();
  if (data.code === 1 && Array.isArray(data.data)) {
    return data.data.map((item: any) => ({
      id: item.id || '',
      name: item.name || '',
      artist: item.artist || '',
      album: item.album || '',
      pic: item.pic || '',
      duration: item.duration,
      source: 'ytmusic' as const,
      sourceType: 'youtube' as const,
      externalUrl: item.externalUrl || '',
    }));
  }
  return [];
}

async function searchAggregate(
  kw: string,
  pg: number,
  signal: AbortSignal,
): Promise<Song[]> {
  const searches = [
    searchStandard(kw, 'wy', pg, signal).catch(() => [] as Song[]),
    searchStandard(kw, 'kw', pg, signal).catch(() => [] as Song[]),
    searchQQ(kw, pg, signal).catch(() => [] as Song[]),
    searchYouTube(kw, pg, signal).catch(() => [] as Song[]),
  ];
  const results = await Promise.all(searches);
  const merged: Song[] = [];
  const maxLen = Math.max(...results.map((r) => r.length));
  for (let i = 0; i < maxLen; i++) {
    for (const result of results) {
      if (i < result.length) {
        merged.push(result[i]);
      }
    }
  }
  return deduplicateSongs(merged);
}

export function useSearch() {
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [platform, setPlatform] = useState<string>(PLATFORMS[0].key);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (kw: string, plat: string, pg: number, append = false) => {
    if (!kw.trim()) {
      setResults([]);
      return;
    }

    const platformInfo = PLATFORMS.find((p) => p.key === plat);
    if (!platformInfo) return;

    const cacheKey = `search_${plat}_${kw}_${pg}`;
    const cached = requestCache.get<Song[]>(cacheKey);
    if (cached) {
      if (append) {
        setResults((prev) => [...prev, ...cached]);
      } else {
        setResults(cached);
      }
      setHasMore(cached.length >= DEFAULT_LIMIT);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setLoading(true);

    let retries = 2;
    while (retries >= 0) {
      try {
        let songs: Song[] = [];

        if (platformInfo.type === 'aggregate') {
          songs = await searchAggregate(kw, pg, abortRef.current.signal);
        } else if (platformInfo.type === 'qq') {
          songs = await searchQQ(kw, pg, abortRef.current.signal);
        } else if (platformInfo.type === 'youtube') {
          songs = await searchYouTube(kw, pg, abortRef.current.signal);
        } else {
          songs = await searchStandard(kw, plat, pg, abortRef.current.signal);
        }

        requestCache.set(cacheKey, songs, CACHE_TTL.SEARCH);

        if (append) {
          setResults((prev) => [...prev, ...songs]);
        } else {
          setResults(songs);
        }
        setHasMore(songs.length >= DEFAULT_LIMIT);
        setLoading(false);
        addSearchHistory(kw);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setLoading(false);
          return;
        }
        retries--;
        if (retries < 0) {
          setLoading(false);
          setResults(append ? results : []);
          return;
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }, [results]);

  const search = useCallback((kw: string, plat?: string) => {
    const p = plat || platform;
    setKeyword(kw);
    if (plat) setPlatform(plat);
    setPage(1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      doSearch(kw, p, 1);
    }, SEARCH_DEBOUNCE_MS);
  }, [platform, doSearch]);

  const searchImmediate = useCallback((kw: string, plat?: string) => {
    const p = plat || platform;
    setKeyword(kw);
    if (plat) setPlatform(plat);
    setPage(1);
    doSearch(kw, p, 1);
  }, [platform, doSearch]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    doSearch(keyword, platform, next, true);
  }, [page, keyword, platform, doSearch]);

  const changePlatform = useCallback((plat: string) => {
    setPlatform(plat);
    setPage(1);
    if (keyword.trim()) {
      doSearch(keyword, plat, 1);
    }
  }, [keyword, doSearch]);

  return {
    results,
    loading,
    keyword,
    platform,
    hasMore,
    search,
    searchImmediate,
    loadMore,
    changePlatform,
    setKeyword,
  };
}
