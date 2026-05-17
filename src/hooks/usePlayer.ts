import { useState, useRef, useCallback, useEffect } from 'react';
import { Song, SongDetail, PlayMode } from '../types';
import { API, CACHE_TTL } from '../config';
import { requestCache } from '../utils/cache';
import { getVolume, setVolume as saveVolume, getPlayMode, setPlayMode as savePlayMode } from '../utils/storage';
import { shuffleArray } from '../utils/format';

export function usePlayer(addToast: (text: string, type?: 'success' | 'error' | 'info') => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [songDetail, setSongDetail] = useState<SongDetail | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(getVolume());
  const [playMode, setPlayModeState] = useState<PlayMode>(getPlayMode() as PlayMode);
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }
    const audio = audioRef.current;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => handleEnded();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      addToast('播放失败，请尝试其他源', 'error');
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const handleEnded = useCallback(() => {
    if (playMode === 'repeat-one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      playNext();
    }
  }, [playMode, queue, queueIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (playMode === 'repeat-one') {
        audio.currentTime = 0;
        audio.play();
      } else {
        playNext();
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [playMode, queue, queueIndex]);

  const fetchSongUrl = useCallback(async (song: Song): Promise<string | null> => {
    const cacheKey = `song_url_${song.sourceType}_${song.source}_${song.id}`;
    const cached = requestCache.get<string>(cacheKey);
    if (cached) return cached;

    let retries = 2;
    while (retries >= 0) {
      try {
        let url: string;
        if (song.sourceType === 'pjmp3') {
          const res = await fetch(`${API.PJMP3}?action=song&id=${song.id}`);
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url;
            if (data.data.pic) {
              requestCache.set(`pic_${song.sourceType}_${song.source}_${song.id}`, data.data.pic, CACHE_TTL.PIC);
            }
            if (data.data.lrc) {
              requestCache.set(`lyric_${song.sourceType}_${song.source}_${song.id}`, data.data.lrc, CACHE_TTL.LYRIC);
            }
          } else {
            url = '';
          }
        } else if (song.sourceType === 'gd') {
          const res = await fetch(`${API.GD}?types=url&source=${song.source}&id=${song.id}&br=320`);
          const data = await res.json();
          url = data.url;
        } else {
          const res = await fetch(`${API.SONG}?id=${song.id}&type=${song.source}`);
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url;
            if (data.data.pic) {
              requestCache.set(`pic_${song.sourceType}_${song.source}_${song.id}`, data.data.pic, CACHE_TTL.PIC);
            }
            if (data.data.lrc) {
              requestCache.set(`lyric_${song.sourceType}_${song.source}_${song.id}`, data.data.lrc, CACHE_TTL.LYRIC);
            }
          } else {
            url = '';
          }
        }
        if (url) {
          requestCache.set(cacheKey, url, CACHE_TTL.SONG_URL);
          return url;
        }
        return null;
      } catch {
        retries--;
        if (retries < 0) return null;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    return null;
  }, []);

  const playSong = useCallback(async (song: Song, newQueue?: Song[], index?: number) => {
    setLoading(true);
    setCurrentSong(song);
    setSongDetail(null);

    if (newQueue !== undefined && index !== undefined) {
      setQueue(newQueue);
      setQueueIndex(index);
    }

    const url = await fetchSongUrl(song);
    if (!url) {
      addToast('无法获取播放地址', 'error');
      setLoading(false);
      return;
    }

    const detail: SongDetail = { url };
    setSongDetail(detail);

    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
    }
    setLoading(false);
  }, [fetchSongUrl, addToast]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  }, [isPlaying]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const v = Math.max(0, Math.min(1, vol));
    setVolumeState(v);
    saveVolume(v);
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
  }, []);

  const setPlayMode = useCallback((mode: PlayMode) => {
    setPlayModeState(mode);
    savePlayMode(mode);
  }, []);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIndex: number;
    if (playMode === 'shuffle') {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = (queueIndex + 1) % queue.length;
    }
    setQueueIndex(nextIndex);
    playSong(queue[nextIndex], queue, nextIndex);
  }, [queue, queueIndex, playMode, playSong]);

  const playPrev = useCallback(() => {
    if (queue.length === 0) return;
    let prevIndex: number;
    if (playMode === 'shuffle') {
      prevIndex = Math.floor(Math.random() * queue.length);
    } else {
      prevIndex = (queueIndex - 1 + queue.length) % queue.length;
    }
    setQueueIndex(prevIndex);
    playSong(queue[prevIndex], queue, prevIndex);
  }, [queue, queueIndex, playMode, playSong]);

  const addToQueue = useCallback((songs: Song[]) => {
    setQueue((prev) => [...prev, ...songs]);
    addToast(`已添加 ${songs.length} 首到队列`, 'success');
  }, [addToast]);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    if (index < queueIndex) {
      setQueueIndex((i) => i - 1);
    } else if (index === queueIndex) {
      setQueueIndex(-1);
    }
  }, [queueIndex]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueueIndex(-1);
  }, []);

  const preloadNext = useCallback(() => {
    if (queue.length === 0) return;
    const nextIndex = (queueIndex + 1) % queue.length;
    const nextSong = queue[nextIndex];
    if (nextSong) {
      fetchSongUrl(nextSong);
    }
  }, [queue, queueIndex, fetchSongUrl]);

  useEffect(() => {
    if (duration > 0 && currentTime > 0 && duration - currentTime < 30) {
      preloadNext();
    }
  }, [currentTime, duration, preloadNext]);

  return {
    currentSong,
    songDetail,
    isPlaying,
    currentTime,
    duration,
    volume,
    playMode,
    queue,
    queueIndex,
    loading,
    playSong,
    togglePlay,
    seek,
    setVolume,
    setPlayMode,
    playNext,
    playPrev,
    addToQueue,
    removeFromQueue,
    clearQueue,
  };
}
