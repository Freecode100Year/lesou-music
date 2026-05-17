import { useState, useCallback } from 'react';
import { Song, UserInfo } from '../types';
import { getUser, setUser as saveUser, getStarred, setStarred } from '../utils/storage';

export function useUser(addToast: (text: string, type?: 'success' | 'error' | 'info') => void) {
  const [user, setUserState] = useState<UserInfo | null>(getUser());
  const [starred, setStarredState] = useState<Song[]>(getStarred());

  const login = useCallback((username: string) => {
    const userInfo: UserInfo = { username };
    setUserState(userInfo);
    saveUser(userInfo);
    addToast(`欢迎回来，${username}`, 'success');
  }, [addToast]);

  const logout = useCallback(() => {
    setUserState(null);
    saveUser(null);
    addToast('已退出登录', 'info');
  }, [addToast]);

  const toggleStar = useCallback((song: Song) => {
    setStarredState((prev) => {
      const exists = prev.find((s) => s.id === song.id && s.source === song.source);
      let next: Song[];
      if (exists) {
        next = prev.filter((s) => !(s.id === song.id && s.source === song.source));
        addToast('已取消收藏', 'info');
      } else {
        next = [song, ...prev];
        addToast('已添加到收藏', 'success');
      }
      setStarred(next);
      return next;
    });
  }, [addToast]);

  const isStarred = useCallback((song: Song) => {
    return starred.some((s) => s.id === song.id && s.source === song.source);
  }, [starred]);

  return {
    user,
    starred,
    login,
    logout,
    toggleStar,
    isStarred,
  };
}
