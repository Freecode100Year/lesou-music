import { useState, useRef, useCallback } from 'react';
import { Song, StandardPlatform, PjmpSource, SongSource } from '../types';
import { API, CACHE_TTL, SEARCH_DEBOUNCE_MS, DEFAULT_LIMIT, PLATFORMS } from '../config';
import { requestCache } from '../utils/cache';
import { addSearchHistory } from '../utils/storage';

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

        if (platformInfo.type === 'pjmp3') {
          const url = `${API.PJMP3}?action=search&keyword=${encodeURIComponent(kw)}`;
          const res = await fetch(url, { signal: abortRef.current.signal });
          const data = await res.json();
          if (data.code === 1 && Array.isArray(data.data)) {
            songs = data.data.map((item: any) => ({
              id: String(item.id),
              name: item.name || '',
              artist: item.artist || '',
              album: item.album || '',
              pic: item.pic,
              source: 'all' as PjmpSource,
              sourceType: 'pjmp3' as const,
            }));
          }
        } else {
          const url = `${API.SEARCH}?keyword=${encodeURIComponent(kw)}&type=${plat}&page=${pg}&limit=${DEFAULT_LIMIT}`;
          const res = await fetch(url, { signal: abortRef.current.signal });
          const data = await res.json();
          if (data.code === 1 && Array.isArray(data.data)) {
            songs = data.data.map((item: any) => ({
              id: String(item.id || item.ID),
              name: item.name || item.songname || '',
              artist: item.artist || item.singer || '',
              album: item.album || '',
              pic: item.pic,
              source: plat as StandardPlatform,
              sourceType: 'standard' as const,
            }));
          }
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
