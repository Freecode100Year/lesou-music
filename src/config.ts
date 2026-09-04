export const API = {
  SEARCH: '/api/search',
  SONG: '/api/song',
  GD: '/api/gd',
  AUDIUS: '/api/audius',
  AUDIO_PROXY: '/api/audio-proxy',
} as const;

// Only sources that actually serve their own audio. Kuwo and QQ were dropped:
// both still return search hits but neither can hand back a playable url.
export const PLATFORMS = [
  { key: 'all', label: '全网', type: 'aggregate' as const },
  { key: 'wy', label: '网易云', type: 'standard' as const },
  { key: 'jx', label: 'JOOX', type: 'standard' as const },
  { key: 'au', label: 'Audius', type: 'audius' as const },
] as const;

export const CACHE_TTL = {
  SEARCH: 5 * 60 * 1000,
  SONG_URL: 10 * 60 * 1000,
  PIC: 30 * 60 * 1000,
  LYRIC: 30 * 60 * 1000,
} as const;

export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_HISTORY_MAX = 10;
// Keep a full first page of results. Individual sources can still return fewer
// when the query genuinely has fewer playable matches.
export const DEFAULT_LIMIT = 30;

export const HOT_ARTISTS = [
  '周杰伦', '林俊杰', '陈奕迅', '邓紫棋', '薛之谦',
  'Taylor Swift', '毛不易', '华晨宇', '李荣浩', '许嵩',
  'BLACKPINK', 'BTS', '五月天', 'Adele', '张学友',
  '王菲', '蔡依林', '李宗盛', 'Ed Sheeran', 'Bruno Mars',
];
