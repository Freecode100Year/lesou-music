export interface Song {
  id: string;
  name: string;
  artist: string;
  album?: string;
  pic?: string;
  pic_id?: string;
  duration?: number;
  source: SongSource;
  sourceType: SourceType;
}

export type SourceType = 'standard' | 'gd' | 'pjmp3' | 'qq';
export type StandardPlatform = 'wy' | 'kw';
export type GDSource = 'netease' | 'kuwo';
export type PjmpSource = 'all';
export type QQSource = 'qq';
export type SongSource = StandardPlatform | GDSource | PjmpSource | QQSource;

export interface SongDetail {
  url: string;
  pic?: string;
  lrc?: string;
  name?: string;
  artist?: string;
  album?: string;
}

export interface SearchResult {
  songs: Song[];
  keyword: string;
  platform: string;
  page: number;
}

export interface UserInfo {
  username: string;
  avatar?: string;
}

export type PlayMode = 'sequential' | 'repeat-one' | 'shuffle';

export type Page = 'home' | 'search' | 'starred';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

export interface LyricLine {
  time: number;
  text: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}
