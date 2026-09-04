import { useState, useCallback } from 'react';
import { Song, UserInfo } from '../types';
import { getUser, setUser as saveUser, getStarred, setStarred, registerAccount, authenticateAccount } from '../utils/storage';

export function useUser(addToast: (text: string, type?: 'success' | 'error' | 'info') => void) {
  const [user, setUserState] = useState<UserInfo | null>(getUser());
  const [starred, setStarredState] = useState<Song[]>(getStarred());

  const register = useCallback((username: string, password: string): boolean => {
    if (!registerAccount(username, password)) {
      addToast('用户名已被注册', 'error');
      return false;
    }
    const userInfo: UserInfo = { username };
    setUserState(userInfo);
    saveUser(userInfo);
    addToast(`注册成功，欢迎 ${username}`, 'success');
    return true;
  }, [addToast]);

  const login = useCallback((username: string, password: string): boolean => {
    if (!authenticateAccount(username, password)) {
      addToast('用户名或密码错误', 'error');
      return false;
    }
    const userInfo: UserInfo = { username };
    setUserState(userInfo);
    saveUser(userInfo);
    addToast(`欢迎回来，${username}`, 'success');
    return true;
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
    register,
    login,
    logout,
    toggleStar,
    isStarred,
  };
}
