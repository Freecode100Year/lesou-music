import React from 'react';
import { Page, UserInfo } from '../types';

interface SidebarProps {
  currentPage: Page;
  setPage: (page: Page) => void;
  user: UserInfo | null;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function Sidebar({ currentPage, setPage, user, mobileOpen, setMobileOpen }: SidebarProps) {
  const navigate = (page: Page) => {
    setPage(page);
    setMobileOpen(false);
  };

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <svg viewBox="0 0 64 64" width="32" height="32">
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#fa2d48' }} />
                <stop offset="100%" style={{ stopColor: '#e91e3a' }} />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="14" fill="url(#logoGrad)" />
            <path d="M44 16v22a8 8 0 1 1-4-6.93V22H28v18a8 8 0 1 1-4-6.93V16h20z" fill="white" />
          </svg>
          <span className="sidebar-title">XQL MUSIC</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-item ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => navigate('home')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            <span>发现音乐</span>
          </button>
          <button
            className={`sidebar-item ${currentPage === 'search' ? 'active' : ''}`}
            onClick={() => navigate('search')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <span>搜索</span>
          </button>
          <button
            className={`sidebar-item ${currentPage === 'starred' ? 'active' : ''}`}
            onClick={() => navigate('starred')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span>我的收藏</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button
            className={`sidebar-item ${currentPage === 'login' ? 'active' : ''}`}
            onClick={() => navigate('login')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
            <span>{user ? user.username : '登录'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
