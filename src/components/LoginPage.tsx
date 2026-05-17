import React, { useState } from 'react';
import { UserInfo } from '../types';

interface LoginPageProps {
  user: UserInfo | null;
  login: (username: string) => void;
  logout: () => void;
}

export function LoginPage({ user, login, logout }: LoginPageProps) {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      login(username.trim());
      setUsername('');
    }
  };

  if (user) {
    return (
      <div className="login-page page-transition">
        <div className="user-profile">
          <div className="user-avatar">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <h2 className="user-name">{user.username}</h2>
          <p className="user-info-text">已登录</p>
          <button className="logout-btn" onClick={logout}>
            退出登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page page-transition">
      <div className="login-card">
        <div className="login-header">
          <svg viewBox="0 0 64 64" width="48" height="48">
            <defs>
              <linearGradient id="loginGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#fa2d48' }} />
                <stop offset="100%" style={{ stopColor: '#e91e3a' }} />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="14" fill="url(#loginGrad)" />
            <path d="M44 16v22a8 8 0 1 1-4-6.93V22H28v18a8 8 0 1 1-4-6.93V16h20z" fill="white" />
          </svg>
          <h2>登录 XQL MUSIC</h2>
          <p>输入昵称即可使用</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="login-input"
            placeholder="请输入昵称"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
          />
          <button type="submit" className="login-submit" disabled={!username.trim()}>
            登录
          </button>
        </form>
      </div>
    </div>
  );
}
