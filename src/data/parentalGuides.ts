import { promises as fs } from 'fs';
import path from 'path';
import type { ParentalGuide } from '@/types/parentalGuide';

const PARENTAL_GUIDES_DIR = path.join(process.cwd(), 'scripts', 'scraping', 'parental_guides');

/**
 * 根据 IMDB ID 获取家长指南数据
 * @param imdbId IMDB ID (如 tt0111161)
 * @returns ParentalGuide 数据，如果不存在则返回 null
 */
export async function getParentalGuideByImdbId(
  imdbId: string
): Promise<ParentalGuide | null> {
  try {
    const filePath = path.join(
      PARENTAL_GUIDES_DIR,
      `${imdbId}_parental_guide.json`
    );
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent) as ParentalGuide;
  } catch {
    // 文件不存在或解析失败
    return null;
  }
}

/**
 * 检查指定 IMDB ID 的家长指南是否存在
 * @param imdbId IMDB ID
 * @returns 是否存在
 */
export async function hasParentalGuide(imdbId: string): Promise<boolean> {
  try {
    const filePath = path.join(
      PARENTAL_GUIDES_DIR,
      `${imdbId}_parental_guide.json`
    );
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
