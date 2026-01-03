'use server';

import {
  getMovies,
  getMovieCount,
  searchMovies as searchMoviesFromDb,
  SortConfig,
} from '@/services/movieService';
import { Movie } from '@/types/movie';

const ITEMS_PER_PAGE = 24;

/**
 * 分页获取电影列表
 * @param page 页码
 * @param sortConfig 排序配置
 */
export async function fetchMovies(
  page: number,
  sortConfig: SortConfig = { field: 'rating', order: 'desc' }
): Promise<Movie[]> {
  return getMovies(page, ITEMS_PER_PAGE, sortConfig);
}

/**
 * 获取电影总数
 */
export async function fetchMovieCount(): Promise<number> {
  return getMovieCount();
}

const MAX_SEARCH_RESULTS = 10;

/**
 * 搜索电影
 * 支持按标题（中文/英文）、导演、演员进行模糊搜索
 */
export async function searchMovies(query: string): Promise<Movie[]> {
  return searchMoviesFromDb(query, MAX_SEARCH_RESULTS);
}
