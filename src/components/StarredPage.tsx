import React from 'react';
import { Song } from '../types';
import { SongList } from './SongList';

interface StarredPageProps {
  starred: Song[];
  currentSong: Song | null;
  isStarred: (song: Song) => boolean;
  onPlay: (song: Song, list: Song[], index: number) => void;
  onStar: (song: Song) => void;
  onAddToQueue: (song: Song) => void;
  onDownload: (song: Song) => void;
}

export function StarredPage({ starred, currentSong, isStarred, onPlay, onStar, onAddToQueue, onDownload }: StarredPageProps) {
  return (
    <div className="starred-page page-transition">
      <div className="starred-header">
        <h2 className="section-title">我的收藏</h2>
        <span className="starred-count">{starred.length} 首歌曲</span>
      </div>

      {starred.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor" opacity="0.2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <p>还没有收藏歌曲</p>
          <p className="empty-hint">在搜索结果中点击心形图标收藏歌曲</p>
        </div>
      ) : (
        <SongList
          songs={starred}
          currentSong={currentSong}
          isStarred={isStarred}
          onPlay={(song, index) => onPlay(song, starred, index)}
          onStar={onStar}
          onAddToQueue={onAddToQueue}
          onDownload={onDownload}
        />
      )}
    </div>
  );
}
