import { useState, useRef, useCallback, useEffect } from 'react';
import { Song, SongDetail, PlayMode } from '../types';
import { API, CACHE_TTL } from '../config';
import { requestCache } from '../utils/cache';
import { getVolume, setVolume as saveVolume, getPlayMode, setPlayMode as savePlayMode, getSpatialAudio, setSpatialAudio as saveSpatialAudio, getGainMultiplier, setGainMultiplier as saveGainMultiplier } from '../utils/storage';
import { shuffleArray } from '../utils/format';

export function usePlayer(addToast: (text: string, type?: 'success' | 'error' | 'info') => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const spatialNodesRef = useRef<{
    source: MediaElementAudioSourceNode;
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

  const disconnectNode = useCallback((node: AudioNode) => {
    try {
      node.disconnect();
    } catch {
      // Node may already be disconnected.
    }
  }, []);

  const ensureGainNode = useCallback((ctx: AudioContext) => {
    if (!gainNodeRef.current) {
      gainNodeRef.current = ctx.createGain();
      gainNodeRef.current.gain.value = gainMultiplier;
    }
    return gainNodeRef.current;
  }, [gainMultiplier]);

  const createSpatialNodes = useCallback((ctx: AudioContext, audio: HTMLAudioElement, gainNode: GainNode) => {
    const source = ctx.createMediaElementSource(audio);
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);

    // Stereo widening via micro-delays
    const delayL = ctx.createDelay(0.05);
    const delayR = ctx.createDelay(0.05);
    delayL.delayTime.value = 0.0003;
    delayR.delayTime.value = 0.0007;

    // Channel gains
    const gainL = ctx.createGain();
    const gainR = ctx.createGain();
    gainL.gain.value = 1.0;
    gainR.gain.value = 1.0;

    // Cross-feed for immersion
    const crossL = ctx.createGain();
    const crossR = ctx.createGain();
    crossL.gain.value = -0.15;
    crossR.gain.value = -0.15;

    // Room reverb simulation
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

    const wetGain = ctx.createGain();
    const dryGain = ctx.createGain();
    wetGain.gain.value = 0.08;
    dryGain.gain.value = 1.0;

    // Bass enhancement
    const bassBoost = ctx.createBiquadFilter();
    bassBoost.type = 'lowshelf';
    bassBoost.frequency.value = 150;
    bassBoost.gain.value = 3;

    const output = ctx.createGain();
    output.gain.value = 1.0;

    // Routing: source → splitter → delays → gains + cross-feed → merger → bass → dry/wet → output
    source.connect(splitter);

    splitter.connect(delayL, 0);
    splitter.connect(delayR, 1);

    delayL.connect(gainL);
    delayR.connect(gainR);

    // Cross-feed: R into L, L into R
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
    output.connect(gainNode);

    return { source, splitter, merger, delayL, delayR, gainL, gainR, crossL, crossR, convolver, wetGain, dryGain, bassBoost, output };
  }, []);

  const ensureAudioGraph = useCallback(() => {
    if (!audioRef.current) return null;
    try {
      const ctx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = ctx;
      const gainNode = ensureGainNode(ctx);
      if (!spatialNodesRef.current) {
        spatialNodesRef.current = createSpatialNodes(ctx, audioRef.current, gainNode);
      }
      return { ctx, gainNode, nodes: spatialNodesRef.current };
    } catch {
      return null;
    }
  }, [createSpatialNodes, ensureGainNode]);

  const connectGainToDestination = useCallback((ctx: AudioContext, gainNode: GainNode) => {
    disconnectNode(gainNode);
    gainNode.connect(ctx.destination);
  }, [disconnectNode]);

  const enableSpatial = useCallback(() => {
    const graph = ensureAudioGraph();
    if (!graph) return;

    const { ctx, gainNode, nodes } = graph;
    disconnectNode(nodes.source);
    disconnectNode(nodes.output);
    nodes.source.connect(nodes.splitter);
    nodes.output.connect(gainNode);
    connectGainToDestination(ctx, gainNode);
    nodes.wetGain.gain.value = 0.08;
    nodes.crossL.gain.value = -0.15;
    nodes.crossR.gain.value = -0.15;
    nodes.bassBoost.gain.value = 3;

    ctx.resume().catch(() => {});
  }, [connectGainToDestination, disconnectNode, ensureAudioGraph]);

  const disableSpatial = useCallback(() => {
    const graph = ensureAudioGraph();
    if (!graph) return;

    const { ctx, gainNode, nodes } = graph;
    disconnectNode(nodes.source);
    disconnectNode(nodes.output);
    nodes.source.connect(gainNode);
    connectGainToDestination(ctx, gainNode);
    nodes.wetGain.gain.value = 0;
    nodes.crossL.gain.value = 0;
    nodes.crossR.gain.value = 0;
    nodes.bassBoost.gain.value = 0;

    ctx.resume().catch(() => {});
  }, [connectGainToDestination, disconnectNode, ensureAudioGraph]);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
      audioRef.current.crossOrigin = 'anonymous';
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

  const setGainMultiplier = useCallback((gain: number) => {
    const next = Math.max(1, Math.min(3, Number.isFinite(gain) ? gain : 1));
    setGainMultiplierState(next);
    saveGainMultiplier(next);
    if (!gainNodeRef.current && audioRef.current) {
      if (spatialAudio) {
        enableSpatial();
      } else {
        disableSpatial();
      }
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = next;
    }
  }, [disableSpatial, enableSpatial, spatialAudio]);

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

  const toggleSpatialAudio = useCallback(() => {
    const next = !spatialAudio;
    setSpatialAudioState(next);
    saveSpatialAudio(next);
    if (next) {
      enableSpatial();
      addToast('杜比全景声 已开启', 'success');
    } else {
      disableSpatial();
      addToast('杜比全景声 已关闭', 'info');
    }
  }, [spatialAudio, enableSpatial, disableSpatial, addToast]);

  // Initialize the Web Audio route on first play.
  useEffect(() => {
    if (!isPlaying) return;
    if (spatialAudio) {
      enableSpatial();
    } else {
      disableSpatial();
    }
  }, [disableSpatial, enableSpatial, isPlaying, spatialAudio]);

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
  };
}
