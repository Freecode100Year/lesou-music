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
  const crossfeedRef = useRef<{
    splitter: ChannelSplitterNode;
    merger: ChannelMergerNode;
    directL: BiquadFilterNode;
    directR: BiquadFilterNode;
    lpL: BiquadFilterNode;
    lpR: BiquadFilterNode;
    crossL: GainNode;
    crossR: GainNode;
    output: GainNode;
  } | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const loudnessGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const loudnessTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Headphone crossfeed (Bauer/Meier style).
  //
  // Headphones deliver each channel to one ear only, which never happens with
  // real sources - some of the left signal always reaches the right ear, low-passed
  // by head shadowing and delayed by the extra path around the head. Feeding a
  // filtered, delayed copy across restores that and relieves the in-head
  // localisation that makes wide mixes tiring.
  //
  // The previous implementation got all three details wrong: the cross gain was
  // negative (phase-inverted), which cancelled the centre image where vocals and
  // bass live; the delay sat on the main path instead of the cross path, applying
  // a fixed 400 us interaural difference that pushed the whole mix ~55 degrees left;
  // and a white-noise convolution reverb added smear with no early reflections.
  const CROSSFEED_CUTOFF_HZ = 700;   // above this the head shadows the far ear
  const CROSSFEED_LEVEL = 0.4;       // -8 dB into the opposite ear
  // Adding a cross copy lifts correlated (centre) content by (1 + level). Cutting
  // the direct path by the same amount *below the crossfeed cutoff only* keeps the
  // response flat; a flat gain would have dragged everything above 700 Hz down 2.9 dB.
  const CROSSFEED_COMP_DB = -20 * Math.log10(1 + CROSSFEED_LEVEL);

  const ensureCrossfeedNodes = useCallback((ctx: AudioContext) => {
    if (crossfeedRef.current) return crossfeedRef.current;

    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);

    // Direct path carries the shelf compensation and, crucially, no delay - so
    // the stereo image stays centred instead of being shoved to one side.
    const makeShelf = () => {
      const f = ctx.createBiquadFilter();
      f.type = 'lowshelf';
      f.frequency.value = CROSSFEED_CUTOFF_HZ;
      f.gain.value = CROSSFEED_COMP_DB;
      return f;
    };
    const directL = makeShelf();
    const directR = makeShelf();

    // No explicit delay line: a 2nd-order 700 Hz lowpass already carries ~330 us
    // of group delay in its passband, which is the real acoustic path around the
    // head. Adding a delay on top pushed the centre notch down to -5.7 dB.
    const makeLowpass = () => {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = CROSSFEED_CUTOFF_HZ;
      f.Q.value = 0.707;
      return f;
    };
    const lpL = makeLowpass();
    const lpR = makeLowpass();

    // In phase, unlike the old -0.15 which cancelled the centre image.
    const crossL = ctx.createGain();
    const crossR = ctx.createGain();
    crossL.gain.value = CROSSFEED_LEVEL;
    crossR.gain.value = CROSSFEED_LEVEL;

    const output = ctx.createGain();
    output.gain.value = 1.0;

    splitter.connect(directL, 0);
    splitter.connect(directR, 1);
    directL.connect(merger, 0, 0);
    directR.connect(merger, 0, 1);

    // L -> lowpass -> opposite ear, and mirrored.
    splitter.connect(lpL, 0);
    lpL.connect(crossL);
    crossL.connect(merger, 0, 1);

    splitter.connect(lpR, 1);
    lpR.connect(crossR);
    crossR.connect(merger, 0, 0);

    merger.connect(output);

    const nodes = { splitter, merger, directL, directR, lpL, lpR, crossL, crossR, output };
    crossfeedRef.current = nodes;
    return nodes;
  }, []);

  // Brick-wall safety net. The EQ can reach +39 dB on a single band and the user
  // gain adds up to 3x on top, so without this the chain clips hard into the
  // headphones.
  const ensureLimiter = useCallback((ctx: AudioContext) => {
    if (!limiterRef.current) {
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.12;
      limiterRef.current = limiter;
    }
    return limiterRef.current;
  }, []);

  // Slow RMS levelling. The three sources are mastered at noticeably different
  // levels, so without this every track change is a volume jump.
  const ensureLoudnessNodes = useCallback((ctx: AudioContext) => {
    if (!loudnessGainRef.current) {
      loudnessGainRef.current = ctx.createGain();
      loudnessGainRef.current.gain.value = 1.0;
    }
    if (!analyserRef.current) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
    }
    return { loudnessGain: loudnessGainRef.current, analyser: analyserRef.current };
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
    const limiter = ensureLimiter(ctx);
    const { loudnessGain, analyser } = ensureLoudnessNodes(ctx);

    const eqFilters = equalizer.filtersRef.current.length > 0
      ? equalizer.filtersRef.current
      : equalizer.createFilters(ctx);

    const eqFirst = eqFilters[0];
    const eqLast = eqFilters[eqFilters.length - 1];

    disconnectSafe(source);
    if (eqLast) disconnectSafe(eqLast);
    disconnectSafe(gainNode);
    disconnectSafe(loudnessGain);
    disconnectSafe(limiter);
    if (crossfeedRef.current) {
      disconnectSafe(crossfeedRef.current.output);
    }

    // source -> EQ -> [crossfeed] -> loudness -> user gain -> limiter -> out
    source.connect(eqFirst);

    if (useSpatial) {
      const cf = ensureCrossfeedNodes(ctx);
      eqLast.connect(cf.splitter);
      cf.output.connect(loudnessGain);
    } else {
      eqLast.connect(loudnessGain);
    }

    loudnessGain.connect(gainNode);
    gainNode.connect(limiter);
    limiter.connect(ctx.destination);

    // Tap for RMS measurement; an analyser has no effect on the signal it sees.
    loudnessGain.connect(analyser);

    webAudioActiveRef.current = true;
    ctx.resume().catch(() => {});
  }, [disconnectSafe, ensureGainNode, ensureCrossfeedNodes, ensureLimiter, ensureLoudnessNodes, equalizer]);

  // Measure the post-EQ signal and walk loudnessGain towards a common level.
  // Deliberately slow (2 s time constant, +/-6 dB of authority) so it levels
  // between tracks without audibly pumping inside one.
  useEffect(() => {
    const TARGET_RMS = 0.1;      // about -20 dBFS
    const MIN_RMS = 0.005;       // below this treat it as silence and hold
    const MAX_GAIN = 2.0;        // +6 dB
    const MIN_GAIN = 0.5;        // -6 dB

    const tick = () => {
      const analyser = analyserRef.current;
      const gain = loudnessGainRef.current;
      const ctx = audioCtxRef.current;
      if (!analyser || !gain || !ctx || !isPlaying) return;

      const buf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buf);

      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      if (rms < MIN_RMS) return;

      // rms here is already scaled by the current gain, so divide it back out.
      const current = gain.gain.value || 1;
      const raw = rms / current;
      const wanted = Math.max(MIN_GAIN, Math.min(MAX_GAIN, TARGET_RMS / raw));
      gain.gain.setTargetAtTime(wanted, ctx.currentTime, 2.0);
    };

    loudnessTimerRef.current = setInterval(tick, 500);
    return () => {
      if (loudnessTimerRef.current) clearInterval(loudnessTimerRef.current);
      loudnessTimerRef.current = null;
    };
  }, [isPlaying]);

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
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      addToast('播放失败，请尝试其他源', 'error');
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
    };
  }, []);



  const fetchSongUrl = useCallback(async (song: Song): Promise<string | null> => {
    const cacheKey = `song_url_${song.sourceType}_${song.source}_${song.id}`;
    const cached = requestCache.get<string>(cacheKey);
    if (cached) return cached;

    let retries = 2;
    while (retries >= 0) {
      try {
        let url: string = '';

        if (song.sourceType === 'audius') {
          const res = await fetch(`${API.AUDIUS}?action=song&id=${encodeURIComponent(song.id)}`);
          const data = await res.json();
          if (data.code === 1 && data.data) {
            url = data.data.url;
            if (data.data.pic) {
              requestCache.set(`pic_${song.sourceType}_${song.source}_${song.id}`, data.data.pic, CACHE_TTL.PIC);
            }
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (playMode === 'repeat-one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        playNext();
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [playMode, playNext]);

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
      addToast('耳机交叉馈送 已开启', 'success');
    } else {
      if (webAudioActiveRef.current) {
        activateWebAudio(false);
      }
      addToast('耳机交叉馈送 已关闭', 'info');
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
