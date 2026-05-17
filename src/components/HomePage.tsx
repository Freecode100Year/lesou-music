import React, { useEffect, useState, useCallback } from 'react';
import { Song } from '../types';
import { API, HOT_ARTISTS, CACHE_TTL } from '../config';
import { requestCache } from '../utils/cache';
import { SongList } from './SongList';

interface HomePageProps {
  currentSong: Song | null;
  isStarred: (song: Song) => boolean;
  onPlay: (song: Song, list: Song[], index: number) => void;
  onStar: (song: Song) => void;
  onAddToQueue: (song: Song) => void;
  onDownload: (song: Song) => void;
}

export function HomePage({ currentSong, isStarred, onPlay, onStar, onAddToQueue, onDownload }: HomePageProps) {
  const [recommendations, setRecommendations] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionTitle, setSectionTitle] = useState('');

  const fetchRecommendations = useCallback(async () => {
    const artist = HOT_ARTISTS[Math.floor(Math.random() * HOT_ARTISTS.length)];
    setSectionTitle(`热门推荐 - ${artist}`);

    const cacheKey = `home_recommend_${artist}`;
    const cached = requestCache.get<Song[]>(cacheKey);
    if (cached) {
      setRecommendations(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API.SEARCH}?keyword=${encodeURIComponent(artist)}&type=wy&page=1&limit=12`);
      const data = await res.json();
      if (data.code === 1 && Array.isArray(data.data)) {
        const songs: Song[] = data.data.map((item: any) => ({
          id: String(item.id),
          name: item.name || '',
          artist: item.artist || '',
          album: item.album || '',
          pic: item.pic,
          source: 'wy' as const,
          sourceType: 'standard' as const,
        }));
        setRecommendations(songs);
        requestCache.set(cacheKey, songs, CACHE_TTL.SEARCH);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return (
    <div className="home-page page-transition">
      <div className="home-header">
        <h2 className="section-title">{sectionTitle || '热门推荐'}</h2>
        <button className="refresh-btn" onClick={fetchRecommendations} disabled={loading}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
          <span>换一批</span>
        </button>
      </div>

      <SongList
        songs={recommendations}
        currentSong={currentSong}
        isStarred={isStarred}
        onPlay={(song, index) => onPlay(song, recommendations, index)}
        onStar={onStar}
        onAddToQueue={onAddToQueue}
        onDownload={onDownload}
        loading={loading}
      />

      <div className="home-banner">
        <div className="banner-content">
          <h3>全网音乐聚合</h3>
          <p>支持网易云、酷我等多平台搜索</p>
          <p>快捷键: 空格 播放/暂停, 方向键 快进/快退/音量</p>
        </div>
      </div>
    </div>
  );
}
