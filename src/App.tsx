import React, { useState, useCallback } from 'react';
import { Page, Song, ToastMessage } from './types';
import { generateId } from './utils/format';
import { usePlayer } from './hooks/usePlayer';
import { useSearch } from './hooks/useSearch';
import { useUser } from './hooks/useUser';
import { useKeyboard } from './hooks/useKeyboard';
import { useLyrics } from './hooks/useLyrics';
import { Layout } from './components/Layout';
import { HomePage } from './components/HomePage';
import { SearchPage } from './components/SearchPage';
import { StarredPage } from './components/StarredPage';
import { LoginPage } from './components/LoginPage';
import { Player } from './components/Player';
import { LyricsOverlay } from './components/LyricsOverlay';
import { QueuePanel } from './components/QueuePanel';
import { Toast } from './components/Toast';
import { API, CACHE_TTL } from './config';
import { requestCache } from './utils/cache';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0);

  const addToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, text, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const player = usePlayer(addToast);
  const searchHook = useSearch();
  const userHook = useUser(addToast);

  const { lyrics, currentLineIndex } = useLyrics(player.currentSong, player.currentTime);

  useKeyboard({
    togglePlay: player.togglePlay,
    seek: player.seek,
    setVolume: player.setVolume,
    currentTime: player.currentTime,
    volume: player.volume,
  });

  const playSongInList = useCallback((song: Song, list: Song[], index: number) => {
    player.playSong(song, list, index);
  }, [player.playSong]);

  const handleDownload = useCallback(async (song: Song) => {
    let url = '';
    const cacheKey = `song_url_${song.sourceType}_${song.source}_${song.id}`;
    const cached = requestCache.get<string>(cacheKey);
    if (cached) {
      url = cached;
    } else {
      try {
        if (song.sourceType === 'pjmp3') {
          const res = await fetch(`${API.PJMP3}?action=song&id=${song.id}`);
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url || '';
          }
        } else if (song.sourceType === 'gd') {
          const res = await fetch(`${API.GD}?types=url&source=${song.source}&id=${song.id}&br=320`);
          const data = await res.json();
          url = data.url || '';
        } else {
          const res = await fetch(`${API.SONG}?id=${song.id}&type=${song.source}`);
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url || '';
          }
        }
        if (url) {
          requestCache.set(cacheKey, url, CACHE_TTL.SONG_URL);
        }
      } catch {
        addToast('获取下载地址失败', 'error');
        return;
      }
    }
    if (url) {
      window.open(url, '_blank');
      addToast('已打开下载链接', 'success');
    } else {
      addToast('暂无下载地址', 'error');
    }
  }, [addToast]);

  const handleSearchFocus = useCallback(() => {
    setCurrentPage('search');
    setSearchFocusTrigger((n) => n + 1);
  }, []);

  const handleQueuePlay = useCallback((index: number) => {
    const song = player.queue[index];
    if (song) {
      player.playSong(song, player.queue, index);
    }
  }, [player]);

  const getCoverUrl = (): string => {
    if (!player.currentSong) return '';
    if (player.currentSong.pic) return player.currentSong.pic;
    const cacheKey = `pic_${player.currentSong.sourceType}_${player.currentSong.source}_${player.currentSong.id}`;
    return requestCache.get<string>(cacheKey) || '';
  };

  return (
    <>
      <Layout
        currentPage={currentPage}
        setPage={setCurrentPage}
        user={userHook.user}
        onSearchFocus={handleSearchFocus}
      >
        {currentPage === 'home' && (
          <HomePage
            currentSong={player.currentSong}
            isStarred={userHook.isStarred}
            onPlay={playSongInList}
            onStar={userHook.toggleStar}
            onAddToQueue={(song) => player.addToQueue([song])}
            onDownload={handleDownload}
          />
        )}
        {currentPage === 'search' && (
          <SearchPage
            results={searchHook.results}
            loading={searchHook.loading}
            keyword={searchHook.keyword}
            platform={searchHook.platform}
            hasMore={searchHook.hasMore}
            search={searchHook.search}
            searchImmediate={searchHook.searchImmediate}
            loadMore={searchHook.loadMore}
            changePlatform={searchHook.changePlatform}
            setKeyword={searchHook.setKeyword}
            currentSong={player.currentSong}
            isStarred={userHook.isStarred}
            onPlay={(song, index) => playSongInList(song, searchHook.results, index)}
            onStar={userHook.toggleStar}
            onAddToQueue={(song) => player.addToQueue([song])}
            onDownload={handleDownload}
            playSongInList={playSongInList}
            focusTrigger={searchFocusTrigger}
          />
        )}
        {currentPage === 'starred' && (
          <StarredPage
            starred={userHook.starred}
            currentSong={player.currentSong}
            isStarred={userHook.isStarred}
            onPlay={playSongInList}
            onStar={userHook.toggleStar}
            onAddToQueue={(song) => player.addToQueue([song])}
            onDownload={handleDownload}
          />
        )}
        {currentPage === 'login' && (
          <LoginPage
            user={userHook.user}
            login={userHook.login}
            logout={userHook.logout}
          />
        )}
      </Layout>

      <Player
        currentSong={player.currentSong}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        volume={player.volume}
        playMode={player.playMode}
        loading={player.loading}
        onTogglePlay={player.togglePlay}
        onSeek={player.seek}
        onSetVolume={player.setVolume}
        onSetPlayMode={player.setPlayMode}
        onNext={player.playNext}
        onPrev={player.playPrev}
        onShowLyrics={() => setShowLyrics(true)}
        onShowQueue={() => setShowQueue(true)}
      />

      <LyricsOverlay
        visible={showLyrics}
        onClose={() => setShowLyrics(false)}
        lyrics={lyrics}
        currentLineIndex={currentLineIndex}
        song={player.currentSong}
        coverUrl={getCoverUrl()}
      />

      <QueuePanel
        visible={showQueue}
        onClose={() => setShowQueue(false)}
        queue={player.queue}
        queueIndex={player.queueIndex}
        onPlay={handleQueuePlay}
        onRemove={player.removeFromQueue}
        onClear={player.clearQueue}
      />

      <Toast toasts={toasts} removeToast={removeToast} />
    </>
  );
}
