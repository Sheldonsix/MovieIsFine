'use server';

import { movies } from '@/data/movies';
import { Movie } from '@/types/movie';

const ITEMS_PER_PAGE = 24;

export async function fetchMovies(page: number): Promise<Movie[]> {
  // Simulate network delay for better UX demonstration (optional)
  // await new Promise(resolve => setTimeout(resolve, 500));

  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;

  return movies.slice(start, end);
}

const MAX_SEARCH_RESULTS = 10;

/**
 * 搜索电影
 * 支持按标题（中文/英文）、导演、演员进行模糊搜索
 */
export async function searchMovies(query: string): Promise<Movie[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const searchTerm = query.trim().toLowerCase();

  const results = movies.filter((movie) => {
    // 标题匹配（中文 + 英文原名）
    const titleMatch = movie.title.toLowerCase().includes(searchTerm);
    const originalTitleMatch = movie.originalTitle?.toLowerCase().includes(searchTerm);

    // 导演匹配
    const directorMatch = movie.director.toLowerCase().includes(searchTerm);

    // 演员匹配
    const castMatch = movie.cast.some((actor) =>
      actor.toLowerCase().includes(searchTerm)
    );

    return titleMatch || originalTitleMatch || directorMatch || castMatch;
  });

  return results.slice(0, MAX_SEARCH_RESULTS);
}
