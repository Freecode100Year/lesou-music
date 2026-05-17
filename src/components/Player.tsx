import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Song, PlayMode } from '../types';
import { formatTime } from '../utils/format';
import { API, CACHE_TTL } from '../config';
import { requestCache } from '../utils/cache';

interface PlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playMode: PlayMode;
  spatialAudio: boolean;
  loading: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSetVolume: (vol: number) => void;
  onSetPlayMode: (mode: PlayMode) => void;
  onToggleSpatial: () => void;
  onNext: () => void;
  onPrev: () => void;
  onShowLyrics: () => void;
  onShowQueue: () => void;
}

export function Player({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  volume,
  playMode,
  spatialAudio,
  loading,
  onTogglePlay,
  onSeek,
  onSetVolume,
  onSetPlayMode,
  onToggleSpatial,
  onNext,
  onPrev,
  onShowLyrics,
  onShowQueue,
}: PlayerProps) {
  const [coverUrl, setCoverUrl] = useState('');
  const [showVolume, setShowVolume] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (!currentSong) {
      setCoverUrl('');
      return;
    }
    const loadCover = async () => {
      if (currentSong.pic) {
        setCoverUrl(currentSong.pic);
        return;
      }
      const cacheKey = `pic_${currentSong.sourceType}_${currentSong.source}_${currentSong.id}`;
      const cached = requestCache.get<string>(cacheKey);
      if (cached) {
        setCoverUrl(cached);
        return;
      }
      if (currentSong.sourceType === 'gd') {
        try {
          const res = await fetch(`${API.GD}?types=pic&source=${currentSong.source}&id=${currentSong.pic_id || currentSong.id}&size=300`);
          const data = await res.json();
          if (data.url) {
            requestCache.set(cacheKey, data.url, CACHE_TTL.PIC);
            setCoverUrl(data.url);
          }
        } catch {
          setCoverUrl('');
        }
      }
    };
    loadCover();
  }, [currentSong]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  }, [duration, onSeek]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 80) {
      if (diff > 0) {
        onPrev();
      } else {
        onNext();
      }
    }
  };

  const cyclePlayMode = () => {
    const modes: PlayMode[] = ['sequential', 'repeat-one', 'shuffle'];
    const idx = modes.indexOf(playMode);
    onSetPlayMode(modes[(idx + 1) % modes.length]);
  };

  const playModeIcon = () => {
    switch (playMode) {
      case 'repeat-one':
        return (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
            <text x="12" y="14.5" textAnchor="middle" fontSize="7" fill="currentColor">1</text>
          </svg>
        );
      case 'shuffle':
        return (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
          </svg>
        );
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`player ${currentSong ? 'player-visible' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="player-progress" ref={progressRef} onClick={handleProgressClick}>
        <div className="player-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <div className="player-content">
        <div className="player-left" onClick={onShowLyrics}>
          <div className="player-cover">
            {coverUrl ? (
              <img src={coverUrl} alt="" />
            ) : (
              <div className="player-cover-placeholder">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" opacity="0.4">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
          </div>
          <div className="player-info">
            <span className="player-song-name">{currentSong?.name || '未播放'}</span>
            <span className="player-artist">{currentSong?.artist || '选择一首歌曲开始播放'}</span>
          </div>
        </div>

        <div className="player-center">
          <button className="player-btn" onClick={cyclePlayMode} title={playMode}>
            {playModeIcon()}
          </button>
          <button className="player-btn" onClick={onPrev}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
          <button className="player-btn player-btn-play" onClick={onTogglePlay} disabled={!currentSong}>
            {loading ? (
              <div className="spinner-small" />
            ) : isPlaying ? (
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button className="player-btn" onClick={onNext}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
          <button className="player-btn" onClick={onShowQueue}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
            </svg>
          </button>
          <button
            className={`player-btn spatial-btn ${spatialAudio ? 'active' : ''}`}
            onClick={onToggleSpatial}
            title={spatialAudio ? '杜比全景声: 开' : '杜比全景声: 关'}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 3v18c-5-2-8-6-8-9s3-7 8-9z" opacity={spatialAudio ? 1 : 0.4} />
              <path d="M14 5.5c3 1.5 5 4.5 5 6.5s-2 5-5 6.5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={spatialAudio ? 1 : 0.3} />
              <path d="M16 3.5c4 2 6.5 5.5 6.5 8.5s-2.5 6.5-6.5 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={spatialAudio ? 1 : 0.3} />
            </svg>
          </button>
        </div>

        <div className="player-right">
          <span className="player-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="player-volume-wrap">
            <button className="player-btn" onClick={() => setShowVolume(!showVolume)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                {volume === 0 ? (
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                ) : volume < 0.5 ? (
                  <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                ) : (
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                )}
              </svg>
            </button>
            {showVolume && (
              <div className="volume-slider-popup">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => onSetVolume(parseFloat(e.target.value))}
                  className="volume-slider"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
