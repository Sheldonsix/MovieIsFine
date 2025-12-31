// 家长指南类别内容
export interface GuideCategory {
  severity: 'None' | 'Mild' | 'Moderate' | 'Severe';
  items: string[];
  items_zh: string[];
}

// 各国分级
export interface CertificationRating {
  rating: string;
  note: string;
}

export interface Certification {
  country: string;
  ratings: CertificationRating[];
}

// 家长指南完整数据
export interface ParentalGuide {
  imdb_id: string;
  title: string;
  url: string;
  content_rating: string;
  content_rating_zh: string;
  sex_nudity: GuideCategory;
  violence_gore: GuideCategory;
  profanity: GuideCategory;
  alcohol_drugs_smoking: GuideCategory;
  frightening_intense: GuideCategory;
  certifications: Certification[];
}

// 类别键名类型
export type GuideCategoryKey =
  | 'sex_nudity'
  | 'violence_gore'
  | 'profanity'
  | 'alcohol_drugs_smoking'
  | 'frightening_intense';

// 类别配置（用于 UI 展示）
export interface CategoryConfig {
  key: GuideCategoryKey;
  label: string;
  icon: string;
  colorClass: string;
}
