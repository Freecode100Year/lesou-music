import React, { useRef, useEffect, useState } from 'react';
import { Song } from '../types';
import { API, CACHE_TTL } from '../config';
import { requestCache } from '../utils/cache';

const SOURCE_LABELS: Record<string, string> = {
  wy: '网易云',
  kw: '酷我',
  qq: 'QQ',
  netease: '网易云',
  kuwo: '酷我',
  all: '全网',
};

interface SongRowProps {
  song: Song;
  index: number;
  isPlaying: boolean;
  isStarred: boolean;
  onPlay: () => void;
  onStar: () => void;
  onAddToQueue: () => void;
  onDownload: () => void;
}

export function SongRow({ song, index, isPlaying, isStarred, onPlay, onStar, onAddToQueue, onDownload }: SongRowProps) {
  const imgRef = useRef<HTMLDivElement>(null);
  const [imgSrc, setImgSrc] = useState<string>('');
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (!song) return;
    setImgSrc('');
    setImgLoaded(false);

    const loadPic = async () => {
      if (song.pic) {
        setImgSrc(song.pic);
        return;
      }
      if (song.sourceType === 'gd' && song.pic_id) {
        const cacheKey = `pic_${song.sourceType}_${song.source}_${song.id}`;
        const cached = requestCache.get<string>(cacheKey);
        if (cached) {
          setImgSrc(cached);
          return;
        }
        try {
          const res = await fetch(`${API.GD}?types=pic&source=${song.source}&id=${song.pic_id || song.id}&size=300`);
          const data = await res.json();
          if (data.url) {
            requestCache.set(cacheKey, data.url, CACHE_TTL.PIC);
            setImgSrc(data.url);
          }
        } catch {
          // leave blank
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadPic();
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [song]);

  return (
    <div className={`song-row ${isPlaying ? 'song-row-active' : ''}`} onClick={onPlay}>
      <div className="song-row-index">
        {isPlaying ? (
          <div className="playing-indicator">
            <span /><span /><span />
          </div>
        ) : (
          <span className="song-num">{index + 1}</span>
        )}
      </div>
      <div className="song-row-cover" ref={imgRef}>
        {imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgSrc('');
              setImgLoaded(false);
            }}
            className={imgLoaded ? 'loaded' : ''}
          />
        ) : (
          <div className="song-cover-placeholder">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" opacity="0.3">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
      </div>
      <div className="song-row-info">
        <span className="song-row-name">{song.name}</span>
        <span className="song-row-artist">{song.artist}{song.album ? ` - ${song.album}` : ''}</span>
      </div>
      <div className="song-row-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className={`action-btn ${isStarred ? 'starred' : ''}`}
          onClick={onStar}
          title="收藏"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill={isStarred ? '#fa2d48' : 'currentColor'}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
        <button className="action-btn" onClick={onAddToQueue} title="添加到队列">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
          </svg>
        </button>
        <button className="action-btn" onClick={onDownload} title="下载">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </svg>
        </button>
      </div>
      <div className="song-row-source">
        <span className="source-badge">{SOURCE_LABELS[song.source] || song.source}</span>
      </div>
    </div>
  );
}
