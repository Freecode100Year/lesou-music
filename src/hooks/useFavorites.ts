import { useState, useCallback } from 'react';
import { Song } from '../types';
import { clearLegacyAuthData, getStarred, setStarred } from '../utils/storage';

export function useFavorites(addToast: (text: string, type?: 'success' | 'error' | 'info') => void) {
  const [starred, setStarredState] = useState<Song[]>(() => {
    // The former login implementation stored plaintext account data only in
    // this browser. It is no longer needed now that favorites are device-local.
    clearLegacyAuthData();
    return getStarred();
  });

  const toggleStar = useCallback((song: Song) => {
    setStarredState((prev) => {
      const exists = prev.find((s) => s.id === song.id && s.source === song.source);
      const next = exists
        ? prev.filter((s) => !(s.id === song.id && s.source === song.source))
        : [song, ...prev];
      setStarred(next);
      addToast(exists ? '已取消收藏' : '已添加到收藏', exists ? 'info' : 'success');
      return next;
    });
  }, [addToast]);

  const isStarred = useCallback((song: Song) => {
    return starred.some((s) => s.id === song.id && s.source === song.source);
  }, [starred]);

  return { starred, toggleStar, isStarred };
}
