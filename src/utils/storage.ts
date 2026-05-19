import { Song, UserInfo } from '../types';
import { SEARCH_HISTORY_MAX } from '../config';

const KEYS = {
  USER: 'xql_user',
  STARRED: 'xql_starred',
  SEARCH_HISTORY: 'xql_search_history',
  VOLUME: 'xql_volume',
  PLAY_MODE: 'xql_play_mode',
  SPATIAL_AUDIO: 'xql_spatial_audio',
  GAIN_MULTIPLIER: 'xql_gain_multiplier',
  EQ_ENABLED: 'xql_eq_enabled',
  EQ_GAINS: 'xql_eq_gains',
  EQ_PRESET: 'xql_eq_preset',
} as const;

export function getUser(): UserInfo | null {
  const raw = localStorage.getItem(KEYS.USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setUser(user: UserInfo | null): void {
  if (user) {
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(KEYS.USER);
  }
}

export function getStarred(): Song[] {
  const raw = localStorage.getItem(KEYS.STARRED);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function setStarred(songs: Song[]): void {
  localStorage.setItem(KEYS.STARRED, JSON.stringify(songs));
}

export function getSearchHistory(): string[] {
  const raw = localStorage.getItem(KEYS.SEARCH_HISTORY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addSearchHistory(keyword: string): void {
  const history = getSearchHistory().filter((h) => h !== keyword);
  history.unshift(keyword);
  if (history.length > SEARCH_HISTORY_MAX) history.pop();
  localStorage.setItem(KEYS.SEARCH_HISTORY, JSON.stringify(history));
}

export function clearSearchHistory(): void {
  localStorage.removeItem(KEYS.SEARCH_HISTORY);
}

export function getVolume(): number {
  const raw = localStorage.getItem(KEYS.VOLUME);
  return raw ? parseFloat(raw) : 0.8;
}

export function setVolume(vol: number): void {
  localStorage.setItem(KEYS.VOLUME, String(vol));
}

export function getPlayMode(): string {
  return localStorage.getItem(KEYS.PLAY_MODE) || 'sequential';
}

export function setPlayMode(mode: string): void {
  localStorage.setItem(KEYS.PLAY_MODE, mode);
}

export function getSpatialAudio(): boolean {
  const raw = localStorage.getItem(KEYS.SPATIAL_AUDIO);
  return raw === null ? false : raw === 'true';
}

export function setSpatialAudio(enabled: boolean): void {
  localStorage.setItem(KEYS.SPATIAL_AUDIO, String(enabled));
}

export function getGainMultiplier(): number {
  const raw = localStorage.getItem(KEYS.GAIN_MULTIPLIER);
  return raw ? parseFloat(raw) : 1.0;
}

export function setGainMultiplier(gain: number): void {
  localStorage.setItem(KEYS.GAIN_MULTIPLIER, String(gain));
}

export function getEqEnabled(): boolean {
  return localStorage.getItem(KEYS.EQ_ENABLED) === 'true';
}

export function setEqEnabled(enabled: boolean): void {
  localStorage.setItem(KEYS.EQ_ENABLED, String(enabled));
}

export function getEqGains(): number[] | null {
  const raw = localStorage.getItem(KEYS.EQ_GAINS);
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length === 31 ? arr : null;
  } catch {
    return null;
  }
}

export function setEqGains(gains: number[]): void {
  localStorage.setItem(KEYS.EQ_GAINS, JSON.stringify(gains));
}

export function getEqPreset(): string {
  return localStorage.getItem(KEYS.EQ_PRESET) || 'flat';
}

export function setEqPreset(preset: string): void {
  localStorage.setItem(KEYS.EQ_PRESET, preset);
}
