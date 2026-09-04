import React, { useState, useCallback, useMemo } from 'react';
import { Page, Song, ToastMessage } from './types';
import { generateId } from './utils/format';
import { usePlayer } from './hooks/usePlayer';
import { useSearch } from './hooks/useSearch';
import { useFavorites } from './hooks/useFavorites';
import { useKeyboard } from './hooks/useKeyboard';
import { useLyrics } from './hooks/useLyrics';
import { useEqualizer } from './hooks/useEqualizer';
import { Layout } from './components/Layout';
import { HomePage } from './components/HomePage';
import { SearchPage } from './components/SearchPage';
import { StarredPage } from './components/StarredPage';
import { Player } from './components/Player';
import { LyricsOverlay } from './components/LyricsOverlay';
import { QueuePanel } from './components/QueuePanel';
import { Equalizer } from './components/Equalizer';
import { Toast } from './components/Toast';
import { API, CACHE_TTL } from './config';
import { requestCache } from './utils/cache';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0);

  const addToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, text, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const eq = useEqualizer();
  // Stable bridge object: usePlayer keys its graph rebuild off this, and a fresh
  // object literal every render used to re-route the whole audio chain four times
  // a second while a track played.
  const eqBridge = useMemo(
    () => ({ filtersRef: eq.filtersRef, preampRef: eq.preampRef, createFilters: eq.createFilters, createPreamp: eq.createPreamp }),
    [eq.filtersRef, eq.preampRef, eq.createFilters, eq.createPreamp],
  );
  const player = usePlayer(addToast, eqBridge);
  const searchHook = useSearch();
  const favorites = useFavorites(addToast);

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
        if (song.sourceType === 'audius') {
          const res = await fetch(`${API.AUDIUS}?action=song&id=${encodeURIComponent(song.id)}`);
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url || '';
          }
        } else if (song.sourceType === 'ccmixter') {
          const res = await fetch(`${API.CCMIXTER}?action=song&id=${encodeURIComponent(song.id)}`);
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url || '';
          }
        } else if (song.sourceType === 'archive') {
          const res = await fetch(`${API.ARCHIVE}?action=song&id=${encodeURIComponent(song.id)}`);
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url || '';
          }
        } else if (song.sourceType === 'gd') {
          const res = await fetch(`${API.GD}?types=url&source=${song.source}&id=${song.id}&br=320`);
          const data = await res.json();
          url = data.url || '';
        } else {
          const res = await fetch(
            `${API.SONG}?id=${song.id}&type=${song.source}` +
              `&name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist)}`,
          );
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

  const handlePlayAllStarred = useCallback(() => {
    if (favorites.starred.length === 0) return;
    player.setPlayMode('sequential');
    player.playSong(favorites.starred[0], favorites.starred, 0);
  }, [favorites.starred, player.playSong, player.setPlayMode]);

  const handleShuffleAllStarred = useCallback(() => {
    if (favorites.starred.length === 0) return;
    player.setPlayMode('shuffle');
    const idx = Math.floor(Math.random() * favorites.starred.length);
    player.playSong(favorites.starred[idx], favorites.starred, idx);
  }, [favorites.starred, player.playSong, player.setPlayMode]);

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
    const song = player.currentSong;
    const cacheKey = `pic_${song.sourceType}_${song.source}_${song.id}`;
    const cached = requestCache.get<string>(cacheKey);
    if (cached) return cached;
    if (song.pic && song.pic.startsWith('http')) return song.pic;
    return '';
  };

  return (
    <>
      <Layout
        currentPage={currentPage}
        setPage={setCurrentPage}
        onSearchFocus={handleSearchFocus}
        gainMultiplier={player.gainMultiplier}
        onSetGainMultiplier={player.setGainMultiplier}
      >
        {currentPage === 'home' && (
          <HomePage
            currentSong={player.currentSong}
            isStarred={favorites.isStarred}
            onPlay={playSongInList}
            onStar={favorites.toggleStar}
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
            isStarred={favorites.isStarred}
            onPlay={(song, index) => playSongInList(song, searchHook.results, index)}
            onStar={favorites.toggleStar}
            onAddToQueue={(song) => player.addToQueue([song])}
            onDownload={handleDownload}
            playSongInList={playSongInList}
            focusTrigger={searchFocusTrigger}
          />
        )}
        {currentPage === 'starred' && (
          <StarredPage
            starred={favorites.starred}
            currentSong={player.currentSong}
            isStarred={favorites.isStarred}
            onPlay={playSongInList}
            onStar={favorites.toggleStar}
            onAddToQueue={(song) => player.addToQueue([song])}
            onDownload={handleDownload}
            onPlayAll={handlePlayAllStarred}
            onShuffleAll={handleShuffleAllStarred}
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
        crossfeedMode={player.crossfeedMode}
        outputMode={player.outputMode}
        loading={player.loading}
        onTogglePlay={player.togglePlay}
        onSeek={player.seek}
        onSetVolume={player.setVolume}
        onSetPlayMode={player.setPlayMode}
        onCycleCrossfeed={player.cycleCrossfeed}
        onToggleOutput={player.toggleOutputMode}
        onNext={player.playNext}
        onPrev={player.playPrev}
        onShowLyrics={() => setShowLyrics(true)}
        onShowQueue={() => setShowQueue(true)}
        onShowEqualizer={() => setShowEqualizer(true)}
        eqEnabled={eq.enabled}
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

      <Equalizer
        visible={showEqualizer}
        onClose={() => setShowEqualizer(false)}
        gains={eq.gains}
        enabled={eq.enabled}
        preset={eq.preset}
        onSetBandGain={eq.setBandGain}
        onReset={eq.reset}
        onSetEnabled={(on) => {
          eq.setEnabled(on);
          if (on && player.isPlaying) {
            player.activateWebAudio();
          }
        }}
        onApplyPreset={eq.applyPreset}
        deEsser={player.deEsser}
        loudnessComp={player.loudnessComp}
        outputMode={player.outputMode}
        onToggleDeEsser={player.toggleDeEsser}
        onToggleLoudnessComp={player.toggleLoudnessComp}
      />

      <Toast toasts={toasts} removeToast={removeToast} />
    </>
  );
}
