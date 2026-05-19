import React, { useState } from 'react';
import { Page, UserInfo } from '../types';

const ALPHANUMERIC = /^[a-zA-Z0-9]+$/;

interface SidebarProps {
  currentPage: Page;
  setPage: (page: Page) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  user: UserInfo | null;
  onLogin: (username: string, password: string) => boolean;
  onRegister: (username: string, password: string) => boolean;
  onLogout: () => void;
}

function SidebarAuthForm({ onLogin, onRegister }: {
  onLogin: (username: string, password: string) => boolean;
  onRegister: (username: string, password: string) => boolean;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const validate = (): string => {
    if (!username) return '请输入用户名';
    if (!ALPHANUMERIC.test(username)) return '用户名仅支持英文字母和数字';
    if (username.length < 2) return '用户名至少 2 个字符';
    if (!password) return '请输入密码';
    if (!ALPHANUMERIC.test(password)) return '密码仅支持英文字母和数字';
    if (password.length < 4) return '密码至少 4 个字符';
    return '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    const ok = mode === 'register'
      ? onRegister(username, password)
      : onLogin(username, password);
    if (ok) {
      setUsername('');
      setPassword('');
    }
  };

  const handleUsernameChange = (v: string) => {
    setUsername(v);
    if (error) setError('');
  };

  const handlePasswordChange = (v: string) => {
    setPassword(v);
    if (error) setError('');
  };

  return (
    <form className="sidebar-auth-form" onSubmit={handleSubmit}>
      <div className="sidebar-auth-tabs">
        <button
          type="button"
          className={`sidebar-auth-tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => { setMode('login'); setError(''); }}
        >
          登录
        </button>
        <button
          type="button"
          className={`sidebar-auth-tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => { setMode('register'); setError(''); }}
        >
          注册
        </button>
      </div>
      <input
        type="text"
        className="sidebar-auth-input"
        placeholder="用户名（字母/数字）"
        value={username}
        onChange={(e) => handleUsernameChange(e.target.value)}
        maxLength={20}
        autoComplete="username"
      />
      <input
        type="password"
        className="sidebar-auth-input"
        placeholder="密码（字母/数字）"
        value={password}
        onChange={(e) => handlePasswordChange(e.target.value)}
        maxLength={20}
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
      />
      {error && <div className="sidebar-auth-error">{error}</div>}
      <button type="submit" className="sidebar-auth-submit">
        {mode === 'register' ? '注册' : '登录'}
      </button>
    </form>
  );
}

export function Sidebar({ currentPage, setPage, mobileOpen, setMobileOpen, user, onLogin, onRegister, onLogout }: SidebarProps) {
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
          {user ? (
            <div className="sidebar-user">
              <div className="sidebar-user-info">
                <div className="sidebar-user-avatar">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <span className="sidebar-user-name">{user.username}</span>
              </div>
              <button className="sidebar-logout-btn" onClick={onLogout} title="退出登录">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                </svg>
              </button>
            </div>
          ) : (
            <SidebarAuthForm onLogin={onLogin} onRegister={onRegister} />
          )}
        </div>
      </aside>
    </>
  );
}
