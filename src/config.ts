export const API = {
  SEARCH: '/api/search',
  SONG: '/api/song',
  GD: '/api/gd',
  PJMP3: '/api/pjmp3',
  QQ_SEARCH: '/qqapi/soso/fcgi-bin/client_search_cp',
  YOUTUBE_SEARCH: '/api/youtube-search',
} as const;

export const PLATFORMS = [
  { key: 'all', label: '全网', type: 'aggregate' as const },
  { key: 'wy', label: '网易云', type: 'standard' as const },
  { key: 'kw', label: '酷我', type: 'standard' as const },
  { key: 'qq', label: 'QQ音乐', type: 'qq' as const },
  { key: 'ytmusic', label: 'YouTube音乐', type: 'youtube' as const },
] as const;

export const CACHE_TTL = {
  SEARCH: 5 * 60 * 1000,
  SONG_URL: 10 * 60 * 1000,
  PIC: 30 * 60 * 1000,
  LYRIC: 30 * 60 * 1000,
} as const;

export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_HISTORY_MAX = 10;
export const DEFAULT_LIMIT = 12;

export const HOT_ARTISTS = [
  '周杰伦', '林俊杰', '陈奕迅', '邓紫棋', '薛之谦',
  'Taylor Swift', '毛不易', '华晨宇', '李荣浩', '许嵩',
  'BLACKPINK', 'BTS', '五月天', 'Adele', '张学友',
  '王菲', '蔡依林', '李宗盛', 'Ed Sheeran', 'Bruno Mars',
];
