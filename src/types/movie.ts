// 剧情节点
export interface PlotPoint {
  id: string;
  timestamp: number; // 时间点（分钟）
  title: string; // 节点标题
  description: string; // 剧情描述
}

// 引入家长指南类型
import type { ParentalGuide } from "./parentalGuide";

export interface Movie {
  id: string;
  imdbId?: string;
  doubanUrl?: string;
  title: string;
  originalTitle?: string;
  poster: string;
  director: string;
  writers: string[];
  cast: string[];
  genres: string[];
  language: string;
  releaseDate: string;
  duration: number; // 片长（分钟）
  synopsis: string;
  doubanRating: number;
  ratingCount?: number;
  plotPoints?: PlotPoint[]; // 剧情节点（≤20个）
  parentalGuide?: ParentalGuide; // 家长指南
}
