import React, { useState } from 'react';
import { Page, UserInfo } from '../types';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface LayoutProps {
  currentPage: Page;
  setPage: (page: Page) => void;
  children: React.ReactNode;
  onSearchFocus: () => void;
  gainMultiplier: number;
  onSetGainMultiplier: (v: number) => void;
  user: UserInfo | null;
  onLogin: (username: string, password: string) => boolean;
  onRegister: (username: string, password: string) => boolean;
  onLogout: () => void;
}

export function Layout({ currentPage, setPage, children, onSearchFocus, gainMultiplier, onSetGainMultiplier, user, onLogin, onRegister, onLogout }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        currentPage={currentPage}
        setPage={setPage}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        user={user}
        onLogin={onLogin}
        onRegister={onRegister}
        onLogout={onLogout}
      />
      <main className="main-content">
        <TopBar
          currentPage={currentPage}
          onMenuClick={() => setMobileOpen(true)}
          onSearchFocus={onSearchFocus}
          gainMultiplier={gainMultiplier}
          onSetGainMultiplier={onSetGainMultiplier}
        />
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
