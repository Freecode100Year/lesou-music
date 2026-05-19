import { useState, useRef, useCallback, useEffect } from 'react';
import { Song, SongDetail, PlayMode } from '../types';
import { API, CACHE_TTL } from '../config';
import { requestCache } from '../utils/cache';
import { getVolume, setVolume as saveVolume, getPlayMode, setPlayMode as savePlayMode, getSpatialAudio, setSpatialAudio as saveSpatialAudio, getGainMultiplier, setGainMultiplier as saveGainMultiplier } from '../utils/storage';

interface EqualizerBridge {
  filtersRef: React.MutableRefObject<BiquadFilterNode[]>;
  createFilters: (ctx: AudioContext) => BiquadFilterNode[];
}

export function usePlayer(
  addToast: (text: string, type?: 'success' | 'error' | 'info') => void,
  equalizer: EqualizerBridge,
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const webAudioActiveRef = useRef(false);
  const mediaActionsRef = useRef<{ next: () => void; prev: () => void }>({ next: () => {}, prev: () => {} });
  const spatialNodesRef = useRef<{
    splitter: ChannelSplitterNode;
    merger: ChannelMergerNode;
    delayL: DelayNode;
    delayR: DelayNode;
    gainL: GainNode;
    gainR: GainNode;
    crossL: GainNode;
    crossR: GainNode;
    convolver: ConvolverNode;
    wetGain: GainNode;
    dryGain: GainNode;
    bassBoost: BiquadFilterNode;
    output: GainNode;
  } | null>(null);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [songDetail, setSongDetail] = useState<SongDetail | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(getVolume());
  const [playMode, setPlayModeState] = useState<PlayMode>(getPlayMode() as PlayMode);
  const [spatialAudio, setSpatialAudioState] = useState(getSpatialAudio());
  const [gainMultiplier, setGainMultiplierState] = useState(getGainMultiplier());
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  const disconnectSafe = useCallback((node: AudioNode) => {
    try { node.disconnect(); } catch {}
  }, []);

  const ensureGainNode = useCallback((ctx: AudioContext) => {
    if (!gainNodeRef.current) {
      gainNodeRef.current = ctx.createGain();
      gainNodeRef.current.gain.value = gainMultiplier;
    }
    return gainNodeRef.current;
  }, [gainMultiplier]);

  const ensureSpatialNodes = useCallback((ctx: AudioContext) => {
    if (spatialNodesRef.current) return spatialNodesRef.current;

    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    const delayL = ctx.createDelay(0.05);
    const delayR = ctx.createDelay(0.05);
    delayL.delayTime.value = 0.0003;
    delayR.delayTime.value = 0.0007;

    const gainL = ctx.createGain(); gainL.gain.value = 1.0;
    const gainR = ctx.createGain(); gainR.gain.value = 1.0;
    const crossL = ctx.createGain(); crossL.gain.value = -0.15;
    const crossR = ctx.createGain(); crossR.gain.value = -0.15;

    const convolver = ctx.createConvolver();
    const length = ctx.sampleRate * 1.2;
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.25));
      }
    }
    convolver.buffer = impulse;

    const wetGain = ctx.createGain(); wetGain.gain.value = 0.08;
    const dryGain = ctx.createGain(); dryGain.gain.value = 1.0;

    const bassBoost = ctx.createBiquadFilter();
    bassBoost.type = 'lowshelf';
    bassBoost.frequency.value = 150;
    bassBoost.gain.value = 3;

    const output = ctx.createGain(); output.gain.value = 1.0;

    splitter.connect(delayL, 0);
    splitter.connect(delayR, 1);
    delayL.connect(gainL);
    delayR.connect(gainR);
    delayL.connect(crossR);
    delayR.connect(crossL);
    gainL.connect(merger, 0, 0);
    gainR.connect(merger, 0, 1);
    crossL.connect(merger, 0, 0);
    crossR.connect(merger, 0, 1);
    merger.connect(bassBoost);
    bassBoost.connect(dryGain);
    bassBoost.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(output);
    wetGain.connect(output);

    const nodes = { splitter, merger, delayL, delayR, gainL, gainR, crossL, crossR, convolver, wetGain, dryGain, bassBoost, output };
    spatialNodesRef.current = nodes;
    return nodes;
  }, []);

  const activateWebAudio = useCallback((useSpatial: boolean) => {
    if (!audioRef.current) return;

    let ctx = audioCtxRef.current;
    if (!ctx) {
      ctx = new AudioContext();
      audioCtxRef.current = ctx;
    }

    if (!sourceNodeRef.current) {
      try {
        sourceNodeRef.current = ctx.createMediaElementSource(audioRef.current);
      } catch {
        return;
      }
    }

    const source = sourceNodeRef.current;
    const gainNode = ensureGainNode(ctx);

    const eqFilters = equalizer.filtersRef.current.length > 0
      ? equalizer.filtersRef.current
      : equalizer.createFilters(ctx);

    const eqFirst = eqFilters[0];
    const eqLast = eqFilters[eqFilters.length - 1];

    disconnectSafe(source);
    if (eqLast) disconnectSafe(eqLast);
    disconnectSafe(gainNode);
    if (spatialNodesRef.current) {
      disconnectSafe(spatialNodesRef.current.output);
    }

    source.connect(eqFirst);

    if (useSpatial) {
      const spatial = ensureSpatialNodes(ctx);
      eqLast.connect(spatial.splitter);
      spatial.output.connect(gainNode);
      spatial.wetGain.gain.value = 0.08;
      spatial.crossL.gain.value = -0.15;
      spatial.crossR.gain.value = -0.15;
      spatial.bassBoost.gain.value = 3;
    } else {
      eqLast.connect(gainNode);
      if (spatialNodesRef.current) {
        spatialNodesRef.current.wetGain.gain.value = 0;
        spatialNodesRef.current.crossL.gain.value = 0;
        spatialNodesRef.current.crossR.gain.value = 0;
        spatialNodesRef.current.bassBoost.gain.value = 0;
      }
    }

    gainNode.connect(ctx.destination);
    webAudioActiveRef.current = true;
    ctx.resume().catch(() => {});
  }, [disconnectSafe, ensureGainNode, ensureSpatialNodes, equalizer]);

  const proxyUrl = useCallback((url: string): string => {
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return url;
    return `${API.AUDIO_PROXY}?url=${encodeURIComponent(url)}`;
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
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

  const resolveQQSongUrl = useCallback(async (song: Song): Promise<string | null> => {
    const query = `${song.name} ${song.artist}`.trim();
    const platforms: Array<{ type: string; source: string }> = [
      { type: 'wy', source: 'wy' },
      { type: 'kw', source: 'kw' },
    ];
    for (const plat of platforms) {
      try {
        const searchUrl = `${API.SEARCH}?keyword=${encodeURIComponent(query)}&type=${plat.type}&page=1&limit=5`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        if (searchData.code === 1 && Array.isArray(searchData.data) && searchData.data.length > 0) {
          const match = searchData.data[0];
          const songId = String(match.id || match.ID);
          const songRes = await fetch(`${API.SONG}?id=${songId}&type=${plat.source}`);
          const songData = await songRes.json();
          if (songData.code === 1 && songData.data && songData.data.url) {
            if (songData.data.pic) {
              requestCache.set(`pic_${song.sourceType}_${song.source}_${song.id}`, songData.data.pic, CACHE_TTL.PIC);
            }
            if (songData.data.lrc) {
              requestCache.set(`lyric_${song.sourceType}_${song.source}_${song.id}`, songData.data.lrc, CACHE_TTL.LYRIC);
            }
            return songData.data.url;
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }, []);

  const fetchSongUrl = useCallback(async (song: Song): Promise<string | null> => {
    const cacheKey = `song_url_${song.sourceType}_${song.source}_${song.id}`;
    const cached = requestCache.get<string>(cacheKey);
    if (cached) return cached;

    let retries = 2;
    while (retries >= 0) {
      try {
        let url: string = '';

        if (song.sourceType === 'qq') {
          const resolved = await resolveQQSongUrl(song);
          url = resolved || '';
        } else if (song.sourceType === 'pjmp3') {
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
          }
        } else if (song.sourceType === 'gd') {
          const res = await fetch(`${API.GD}?types=url&source=${song.source}&id=${song.id}&br=320`);
          const data = await res.json();
          url = data.url || '';
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
  }, [resolveQQSongUrl]);

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
      audioRef.current.src = proxyUrl(url);
      audioRef.current.play().catch(() => {});
    }
    setLoading(false);
  }, [fetchSongUrl, addToast, proxyUrl]);

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

  const setGainMultiplier = useCallback((gain: number) => {
    const next = Math.max(1, Math.min(3, Number.isFinite(gain) ? gain : 1));
    setGainMultiplierState(next);
    saveGainMultiplier(next);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = next;
    }
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

  useEffect(() => { mediaActionsRef.current = { next: playNext, prev: playPrev }; }, [playNext, playPrev]);

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

  const toggleSpatialAudio = useCallback(() => {
    const next = !spatialAudio;
    setSpatialAudioState(next);
    saveSpatialAudio(next);
    if (next) {
      activateWebAudio(true);
      addToast('杜比全景声 已开启（部分音源可能不支持）', 'success');
    } else {
      if (webAudioActiveRef.current) {
        activateWebAudio(false);
      }
      addToast('杜比全景声 已关闭', 'info');
    }
  }, [spatialAudio, activateWebAudio, addToast]);

  // Rebuild audio routing when playback starts or EQ/spatial state changes
  useEffect(() => {
    if (!isPlaying) return;
    const needWebAudio = spatialAudio || equalizer.filtersRef.current.length > 0;
    if (needWebAudio || webAudioActiveRef.current) {
      activateWebAudio(spatialAudio);
    }
  }, [isPlaying, spatialAudio, activateWebAudio, equalizer]);

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

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play().catch(() => {}));
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => mediaActionsRef.current.prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => mediaActionsRef.current.next());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (audioRef.current && details.seekTime != null) {
        audioRef.current.currentTime = details.seekTime;
      }
    });
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.name,
      artist: currentSong.artist,
      album: currentSong.album || '',
    });
  }, [currentSong]);

  return {
    currentSong,
    songDetail,
    isPlaying,
    currentTime,
    duration,
    volume,
    playMode,
    spatialAudio,
    gainMultiplier,
    queue,
    queueIndex,
    loading,
    playSong,
    togglePlay,
    seek,
    setVolume,
    setPlayMode,
    setGainMultiplier,
    toggleSpatialAudio,
    playNext,
    playPrev,
    addToQueue,
    removeFromQueue,
    clearQueue,
    activateWebAudio,
  };
}
