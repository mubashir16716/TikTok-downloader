export interface TikTokAuthor {
  id: string;
  uniqueId: string;
  nickname: string;
  avatar: string;
}

export interface TikTokMusic {
  title: string;
  author: string;
  url: string;
  cover?: string;
}

export interface TikTokStats {
  plays: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface TikTokMediaResult {
  id: string;
  sourceUrl: string;
  title: string;
  duration: number;
  cover: string;
  noWatermarkUrl: string;
  hdNoWatermarkUrl?: string;
  watermarkUrl?: string;
  noWatermarkSize?: number;
  hdSize?: number;
  images?: string[];
  author: TikTokAuthor;
  music?: TikTokMusic;
  stats: TikTokStats;
  fetchedAt: number;
}

export interface HistoryItem {
  id: string;
  sourceUrl: string;
  title: string;
  authorHandle: string;
  authorName: string;
  cover: string;
  duration: number;
  isSlideshow: boolean;
  savedAt: number;
}
