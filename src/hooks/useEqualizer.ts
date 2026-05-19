import { useState, useRef, useCallback } from 'react';
import { getEqEnabled, setEqEnabled as saveEqEnabled, getEqGains, setEqGains as saveEqGains, getEqPreset, setEqPreset as saveEqPreset } from '../utils/storage';

export const EQ_FREQUENCIES = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160,
  200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
  2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
];

export const EQ_LABELS = [
  '20', '25', '31', '40', '50', '63', '80', '100', '125', '160',
  '200', '250', '315', '400', '500', '630', '800', '1k', '1.25k', '1.6k',
  '2k', '2.5k', '3.15k', '4k', '5k', '6.3k', '8k', '10k', '12.5k', '16k', '20k',
];

export interface EqPreset {
  name: string;
  label: string;
  gains: number[];
}

export const EQ_PRESETS: EqPreset[] = [
  { name: 'flat', label: '平坦', gains: Array(31).fill(0) },
  { name: 'rock', label: '摇滚', gains: [
    4, 4, 3, 3, 2, 1, 0, -1, -2, -2,
    -1, 0, 1, 2, 3, 3, 4, 4, 3, 3,
    3, 3, 4, 4, 5, 5, 5, 5, 4, 4, 3,
  ]},
  { name: 'pop', label: '流行', gains: [
    -1, -1, 0, 1, 2, 3, 3, 2, 1, 0,
    0, 0, 1, 2, 3, 3, 3, 2, 1, 1,
    0, 0, -1, -1, -1, -1, -1, 0, 0, 0, 0,
  ]},
  { name: 'jazz', label: '爵士', gains: [
    3, 3, 2, 2, 1, 1, 0, 0, 1, 2,
    2, 3, 3, 3, 2, 1, 0, 0, 0, 1,
    1, 2, 2, 3, 3, 4, 4, 4, 3, 3, 2,
  ]},
  { name: 'classical', label: '古典', gains: [
    3, 3, 3, 2, 2, 1, 1, 0, 0, 0,
    0, 0, 0, 0, 0, -1, -1, -1, 0, 0,
    0, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4,
  ]},
  { name: 'bass', label: '低音增强', gains: [
    8, 7, 6, 6, 5, 5, 4, 3, 2, 1,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]},
  { name: 'treble', label: '高音增强', gains: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
    2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 8,
  ]},
  { name: 'vocal', label: '人声', gains: [
    -3, -3, -3, -2, -2, -1, -1, 0, 0, 1,
    1, 2, 3, 4, 5, 5, 5, 4, 3, 2,
    1, 0, -1, -1, -2, -2, -3, -3, -3, -3, -3,
  ]},
  { name: 'electronic', label: '电子', gains: [
    6, 6, 5, 4, 3, 2, 1, 0, -1, -1,
    0, 0, 1, 1, 0, 0, -1, -1, 0, 1,
    2, 3, 4, 5, 5, 6, 6, 6, 5, 5, 4,
  ]},
];

const DEFAULT_GAINS = Array(31).fill(0);

export function useEqualizer() {
  const [gains, setGains] = useState<number[]>(() => getEqGains() || DEFAULT_GAINS);
  const [enabled, setEnabledState] = useState(() => getEqEnabled());
  const [preset, setPresetState] = useState(() => getEqPreset());
  const filtersRef = useRef<BiquadFilterNode[]>([]);

  const createFilters = useCallback((ctx: AudioContext): BiquadFilterNode[] => {
    if (filtersRef.current.length > 0) return filtersRef.current;
    const currentGains = getEqGains() || DEFAULT_GAINS;
    const isEnabled = getEqEnabled();
    const filters = EQ_FREQUENCIES.map((freq, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.414;
      filter.gain.value = isEnabled ? currentGains[i] : 0;
      return filter;
    });
    for (let i = 0; i < filters.length - 1; i++) {
      filters[i].connect(filters[i + 1]);
    }
    filtersRef.current = filters;
    return filters;
  }, []);

  const setBandGain = useCallback((index: number, gain: number) => {
    const clamped = Math.max(-20, Math.min(20, gain));
    setGains(prev => {
      const next = [...prev];
      next[index] = clamped;
      saveEqGains(next);
      return next;
    });
    if (filtersRef.current[index] && enabled) {
      filtersRef.current[index].gain.value = clamped;
    }
    setPresetState('custom');
    saveEqPreset('custom');
  }, [enabled]);

  const reset = useCallback(() => {
    setGains(DEFAULT_GAINS);
    saveEqGains(DEFAULT_GAINS);
    setPresetState('flat');
    saveEqPreset('flat');
    filtersRef.current.forEach(f => { f.gain.value = 0; });
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    saveEqEnabled(on);
    const currentGains = on ? (getEqGains() || DEFAULT_GAINS) : DEFAULT_GAINS;
    filtersRef.current.forEach((f, i) => {
      f.gain.value = currentGains[i];
    });
  }, []);

  const applyPreset = useCallback((presetName: string) => {
    const p = EQ_PRESETS.find(pr => pr.name === presetName);
    if (!p) return;
    setGains([...p.gains]);
    saveEqGains(p.gains);
    setPresetState(presetName);
    saveEqPreset(presetName);
    if (enabled) {
      filtersRef.current.forEach((f, i) => {
        f.gain.value = p.gains[i];
      });
    }
  }, [enabled]);

  return {
    gains, enabled, preset, filtersRef,
    createFilters, setBandGain, reset, setEnabled, applyPreset,
  };
}
