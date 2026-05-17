import React, { useState, useCallback } from 'react';
import { Page, UserInfo, Song } from '../types';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface LayoutProps {
  currentPage: Page;
  setPage: (page: Page) => void;
  user: UserInfo | null;
  children: React.ReactNode;
  onSearchFocus: () => void;
}

export function Layout({ currentPage, setPage, user, children, onSearchFocus }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        currentPage={currentPage}
        setPage={setPage}
        user={user}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <main className="main-content">
        <TopBar
          currentPage={currentPage}
          onMenuClick={() => setMobileOpen(true)}
          onSearchFocus={onSearchFocus}
        />
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
