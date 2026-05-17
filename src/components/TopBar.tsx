import React, { useState } from 'react';
import { Page } from '../types';

interface TopBarProps {
  currentPage: Page;
  onMenuClick: () => void;
  onSearchFocus: () => void;
  gainMultiplier: number;
  onSetGainMultiplier: (v: number) => void;
}

export function TopBar({ currentPage, onMenuClick, onSearchFocus, gainMultiplier, onSetGainMultiplier }: TopBarProps) {
  const [showBoost, setShowBoost] = useState(false);
  const titles: Record<Page, string> = {
    home: '发现音乐',
    search: '搜索',
    starred: '我的收藏',
  };

  return (
    <header className="topbar">
      <button className="topbar-menu" onClick={onMenuClick}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
        </svg>
      </button>
      <h1 className="topbar-title">{titles[currentPage]}</h1>
      <div className="volume-boost-wrap">
        <button
          className={`volume-boost-btn ${gainMultiplier > 1 ? 'boosted' : ''}`}
          onClick={() => setShowBoost((show) => !show)}
          title="Volume boost"
        >
          {gainMultiplier.toFixed(1)}x
        </button>
        {showBoost && (
          <div className="volume-boost-popup">
            <div className="volume-boost-label">
              <span>Volume boost</span>
              <span className="volume-boost-value">{gainMultiplier.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={gainMultiplier}
              onChange={(e) => onSetGainMultiplier(parseFloat(e.target.value))}
              className="volume-boost-slider"
            />
          </div>
        )}
      </div>
      <button className="topbar-search" onClick={onSearchFocus}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
      </button>
    </header>
  );
}
